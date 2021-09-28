"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Exchange = Exchange;
exports.EventExchange = EventExchange;

var _Message = require("./Message");

var _Queue = require("./Queue");

var _shared = require("./shared");

const typeSymbol = Symbol.for('type');
const stoppedSymbol = Symbol.for('stopped');
const bindingsSymbol = Symbol.for('bindings');
const deliveryQueueSymbol = Symbol.for('deliveryQueue');
const deliveryConsumerSymbol = Symbol.for('deliveryConsumer');
const onTopicMessageSymbol = Symbol.for('onTopicMessage');
const onDirectMessageSymbol = Symbol.for('onDirectMessage');
const emitReturnSymbol = Symbol.for('emitReturn');

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
  const deliveryQueue = this[deliveryQueueSymbol] = new _Queue.Queue('delivery-q');
  const onMessage = (type === 'topic' ? this[onTopicMessageSymbol] : this[onDirectMessageSymbol]).bind(this);
  this[deliveryConsumerSymbol] = deliveryQueue.consume(onMessage);
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
  if (!this.bindingCount) return this[emitReturnSymbol](routingKey, content, properties);
  return this[deliveryQueueSymbol].queueMessage({
    routingKey
  }, {
    content,
    properties
  });
};

ExchangeBase.prototype[onTopicMessageSymbol] = function topic(routingKey, message) {
  const publishedMsg = message.content;
  const bindings = this[bindingsSymbol];
  message.ack();
  const deliverTo = bindings.filter(binding => binding.testPattern(routingKey));

  if (!deliverTo.length) {
    this[emitReturnSymbol](routingKey, publishedMsg.content, publishedMsg.properties);
    return 0;
  }

  deliverTo.forEach(binding => this.publishToQueue(binding.queue, routingKey, publishedMsg.content, publishedMsg.properties));
};

ExchangeBase.prototype[onDirectMessageSymbol] = function direct(routingKey, message) {
  const publishedMsg = message.content;
  const bindings = this[bindingsSymbol];
  const deliverTo = bindings.filter(binding => binding.testPattern(routingKey));
  const first = deliverTo[0];

  if (!first) {
    message.ack();
    this[emitReturnSymbol](routingKey, publishedMsg.content, publishedMsg.properties);
    return 0;
  }

  if (deliverTo.length > 1) {
    const idx = bindings.indexOf(first);
    bindings.splice(idx, 1);
    bindings.push(first);
  }

  message.ack();
  this.publishToQueue(first.queue, routingKey, publishedMsg.content, publishedMsg.properties);
};

ExchangeBase.prototype.publishToQueue = function publishToQueue(queue, routingKey, content, properties) {
  queue.queueMessage({
    routingKey,
    exchange: this.name
  }, content, properties);
};

ExchangeBase.prototype[emitReturnSymbol] = function emitReturn(routingKey, content, properties) {
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

ExchangeBase.prototype.bind = function bind(queue, pattern, bindOptions) {
  const bindings = this[bindingsSymbol];
  const bound = bindings.find(bq => bq.queue === queue && bq.pattern === pattern);
  if (bound) return bound;
  const binding = new Binding(this, queue, pattern, bindOptions);
  bindings.push(binding);
  bindings.sort(_shared.sortByPriority);
  this.emit('bind', binding);
  return binding;
};

ExchangeBase.prototype.unbind = function unbind(queue, pattern) {
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
    this.unbind(binding.queue, binding.pattern);
  }
};

ExchangeBase.prototype.close = function close() {
  for (const binding of this[bindingsSymbol].slice()) {
    binding.close();
  }

  const deliveryQueue = this[deliveryQueueSymbol];
  deliveryQueue.unbindConsumer(this[deliveryConsumerSymbol]);
  deliveryQueue.close();
};

ExchangeBase.prototype.getState = function getState() {
  const self = this;
  const deliveryQueue = self[deliveryQueueSymbol];
  return {
    name: self.name,
    type: self[typeSymbol],
    options: { ...self.options
    },
    ...(deliveryQueue.messageCount ? {
      deliveryQueue: deliveryQueue.getState()
    } : undefined),
    bindings: getBoundState()
  };

  function getBoundState() {
    return self[bindingsSymbol].reduce((result, binding) => {
      if (!binding.queue.options.durable) return result;
      if (!result) result = [];
      result.push(binding.getState());
      return result;
    }, undefined);
  }
};

ExchangeBase.prototype.stop = function stop() {
  this[stoppedSymbol] = true;
};

ExchangeBase.prototype.recover = function recover(state, getQueue) {
  const deliveryQueue = this[deliveryQueueSymbol];
  this[stoppedSymbol] = false;

  if (state) {
    this.name = state.name;

    if (state.bindings) {
      state.bindings.forEach(bindingState => {
        const queue = getQueue(bindingState.queueName);
        if (!queue) return;
        this.bind(queue, bindingState.pattern, bindingState.options);
      });
    }

    deliveryQueue.recover(state.deliveryQueue);
    const onMessage = (this[typeSymbol] === 'topic' ? this[onTopicMessageSymbol] : this[onDirectMessageSymbol]).bind(this);
    this[deliveryConsumerSymbol] = deliveryQueue.consume(onMessage);
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
  const binding = this.bind(eventQueue, pattern);
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
  this.compiledPattern = (0, _shared.getRoutingKeyPattern)(pattern);
  queue.on('delete', () => {
    this.close();
  });
}

Binding.prototype.testPattern = function testPattern(routingKey) {
  return this.compiledPattern.test(routingKey);
};

Binding.prototype.close = function closeBinding() {
  this.exchange.unbind(this.queue, this.pattern);
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