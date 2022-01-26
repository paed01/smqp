"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.EventExchange = EventExchange;
exports.Exchange = Exchange;

var _Message = require("./Message");

var _Queue = require("./Queue");

var _shared = require("./shared");

const typeSymbol = Symbol.for('type');
const stoppedSymbol = Symbol.for('stopped');
const bindingsSymbol = Symbol.for('bindings');
const deliveryQueueSymbol = Symbol.for('deliveryQueue');

function Exchange(name, type = 'topic', options) {
  if (!name) throw new Error('Exchange name is required');
  if (['topic', 'direct'].indexOf(type) === -1) throw Error('Exchange type must be one of topic or direct');
  const eventExchange = EventExchange(name + '__events');
  return new ExchangeBase(name, type, options, eventExchange);
}

function EventExchange(name) {
  if (!name) name = `smq.ename-${(0, _shared.generateId)()}`;
  return new ExchangeBase(name, 'topic', {
    durable: false,
    autoDelete: true
  });
}

function ExchangeBase(name, type, options, eventExchange) {
  this.name = name;
  this[typeSymbol] = type;
  this[bindingsSymbol] = [];
  this[stoppedSymbol] = false;
  this.options = {
    durable: true,
    autoDelete: true,
    ...options
  };
  this.events = eventExchange;
  const deliveryQueue = this[deliveryQueueSymbol] = new _Queue.Queue('delivery-q', {
    autoDelete: false
  });
  const onMessage = (type === 'topic' ? this._onTopicMessage : this._onDirectMessage).bind(this);
  deliveryQueue.consume(onMessage, {
    exclusive: true,
    consumerTag: '_exchange-tag'
  });
}

Object.defineProperty(ExchangeBase.prototype, 'bindingCount', {
  get() {
    return this[bindingsSymbol].length;
  }

});
Object.defineProperty(ExchangeBase.prototype, 'bindings', {
  get() {
    return this[bindingsSymbol].slice();
  }

});
Object.defineProperty(ExchangeBase.prototype, 'type', {
  get() {
    return this[typeSymbol];
  }

});
Object.defineProperty(ExchangeBase.prototype, 'stopped', {
  get() {
    return this[stoppedSymbol];
  }

});
Object.defineProperty(ExchangeBase.prototype, 'undeliveredCount', {
  get() {
    return this[deliveryQueueSymbol].messageCount;
  }

});

ExchangeBase.prototype.publish = function publish(routingKey, content, properties) {
  if (this[stoppedSymbol]) return;
  if (!this.bindingCount) return this._emitReturn(routingKey, content, properties);
  return this[deliveryQueueSymbol].queueMessage({
    routingKey
  }, {
    content,
    properties
  });
};

ExchangeBase.prototype._onTopicMessage = function topic(routingKey, message) {
  const publishedMsg = message.content;
  const bindings = this[bindingsSymbol];
  message.ack();
  const deliverTo = bindings.filter(binding => binding.testPattern(routingKey));
  let delivered = 0;

  for (const binding of deliverTo) {
    this._publishToQueue(binding.queue, routingKey, publishedMsg.content, publishedMsg.properties);

    ++delivered;
  }

  if (!delivered) {
    this._emitReturn(routingKey, publishedMsg.content, publishedMsg.properties);
  }

  return delivered;
};

ExchangeBase.prototype._onDirectMessage = function direct(routingKey, message) {
  const publishedMsg = message.content;
  const bindings = this[bindingsSymbol];
  const deliverTo = bindings.find(binding => binding.testPattern(routingKey));

  if (!deliverTo) {
    message.ack();

    this._emitReturn(routingKey, publishedMsg.content, publishedMsg.properties);

    return 0;
  }

  if (bindings.length > 1) {
    const idx = bindings.indexOf(deliverTo);
    bindings.splice(idx, 1);
    bindings.push(deliverTo);
  }

  message.ack();

  this._publishToQueue(deliverTo.queue, routingKey, publishedMsg.content, publishedMsg.properties);

  return 1;
};

ExchangeBase.prototype._publishToQueue = function publishToQueue(queue, routingKey, content, properties) {
  queue.queueMessage({
    routingKey,
    exchange: this.name
  }, content, properties);
};

ExchangeBase.prototype._emitReturn = function emitReturn(routingKey, content, properties) {
  if (!this.events || !properties) return;

  if (properties.confirm) {
    this.emit('message.undelivered', new _Message.Message({
      routingKey,
      exchange: this.name
    }, content, properties));
  }

  if (properties.mandatory) {
    this.emit('return', new _Message.Message({
      routingKey,
      exchange: this.name
    }, content, properties));
  }
};

ExchangeBase.prototype.bindQueue = function bindQueue(queue, pattern, bindOptions) {
  const bindings = this[bindingsSymbol];
  const bound = bindings.find(bq => bq.queue === queue && bq.pattern === pattern);
  if (bound) return bound;
  const binding = new Binding(this, queue, pattern, bindOptions);
  bindings.push(binding);
  bindings.sort(_shared.sortByPriority);
  this.emit('bind', binding);
  return binding;
};

ExchangeBase.prototype.unbindQueue = function unbindQueue(queue, pattern) {
  const bindings = this[bindingsSymbol];
  const idx = bindings.findIndex(bq => bq.queue === queue && bq.pattern === pattern);
  if (idx === -1) return;
  const [binding] = bindings.splice(idx, 1);
  binding.close();
  this.emit('unbind', binding);
  if (!bindings.length && this.options.autoDelete) this.emit('delete', this);
};

ExchangeBase.prototype.unbindQueueByName = function unbindQueueByName(queueName) {
  for (const binding of this[bindingsSymbol]) {
    if (binding.queue.name !== queueName) continue;
    this.unbindQueue(binding.queue, binding.pattern);
  }
};

ExchangeBase.prototype.close = function close() {
  for (const binding of this[bindingsSymbol].slice()) {
    binding.close();
  }

  const deliveryQueue = this[deliveryQueueSymbol];
  deliveryQueue.cancel('_exchange-tag', true);
  deliveryQueue.close();
};

ExchangeBase.prototype.getState = function getState() {
  let bindings;

  for (const binding of this[bindingsSymbol]) {
    if (!binding.queue.options.durable) continue;
    if (!bindings) bindings = [];
    bindings.push(binding.getState());
  }

  const deliveryQueue = this[deliveryQueueSymbol];
  return {
    name: this.name,
    type: this.type,
    options: { ...this.options
    },
    ...(deliveryQueue.messageCount ? {
      deliveryQueue: deliveryQueue.getState()
    } : undefined),
    ...(bindings ? {
      bindings
    } : undefined)
  };
};

ExchangeBase.prototype.stop = function stop() {
  this[stoppedSymbol] = true;
};

ExchangeBase.prototype.recover = function recover(state, getQueue) {
  this[stoppedSymbol] = false;
  if (!state) return this;
  const deliveryQueue = this[deliveryQueueSymbol];

  if (state.bindings) {
    for (const bindingState of state.bindings) {
      const queue = getQueue(bindingState.queueName);
      if (!queue) return;
      this.bindQueue(queue, bindingState.pattern, bindingState.options);
    }
  }

  deliveryQueue.recover(state.deliveryQueue);

  if (!deliveryQueue.consumerCount) {
    const onMessage = (this[typeSymbol] === 'topic' ? this._onTopicMessage : this._onDirectMessage).bind(this);
    deliveryQueue.consume(onMessage, {
      exclusive: true,
      consumerTag: '_exchange-tag'
    });
  }

  return this;
};

ExchangeBase.prototype.getBinding = function getBinding(queueName, pattern) {
  return this[bindingsSymbol].find(binding => binding.queue.name === queueName && binding.pattern === pattern);
};

ExchangeBase.prototype.emit = function emit(eventName, content) {
  if (this.events) return this.events.publish(`exchange.${eventName}`, content);
  return this.publish(eventName, content);
};

ExchangeBase.prototype.on = function on(pattern, handler, consumeOptions = {}) {
  if (this.events) return this.events.on(`exchange.${pattern}`, handler, consumeOptions);
  const eventQueue = new _Queue.Queue(null, {
    durable: false,
    autoDelete: true
  });
  const binding = this.bindQueue(eventQueue, pattern);
  eventQueue.events = {
    emit(eventName) {
      if (eventName === 'queue.delete') binding.close();
    }

  };
  return eventQueue.consume(handler, { ...consumeOptions,
    noAck: true
  }, this);
};

ExchangeBase.prototype.off = function off(pattern, handler) {
  if (this.events) return this.events.off(`exchange.${pattern}`, handler);
  const {
    consumerTag
  } = handler;

  for (const binding of this[bindingsSymbol]) {
    if (binding.pattern === pattern) {
      if (consumerTag) binding.queue.cancel(consumerTag);else binding.queue.dismiss(handler);
    }
  }
};

function Binding(exchange, queue, pattern, bindOptions) {
  this.id = `${queue.name}/${pattern}`;
  this.options = {
    priority: 0,
    ...bindOptions
  };
  this.pattern = pattern;
  this.exchange = exchange;
  this.queue = queue;
  this._compiledPattern = (0, _shared.getRoutingKeyPattern)(pattern);
  queue.on('delete', () => {
    this.close();
  });
}

Binding.prototype.testPattern = function testPattern(routingKey) {
  return this._compiledPattern.test(routingKey);
};

Binding.prototype.close = function closeBinding() {
  this.exchange.unbindQueue(this.queue, this.pattern);
};

Binding.prototype.getState = function getBindingState() {
  return {
    id: this.id,
    options: { ...this.options
    },
    queueName: this.queue.name,
    pattern: this.pattern
  };
};