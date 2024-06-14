"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.EventExchange = EventExchange;
exports.Exchange = Exchange;
var _Message = require("./Message.js");
var _Queue = require("./Queue.js");
var _shared = require("./shared.js");
const kName = Symbol.for('name');
const kType = Symbol.for('type');
const kStopped = Symbol.for('stopped');
const kBindings = Symbol.for('bindings');
const kDeliveryQueue = Symbol.for('deliveryQueue');
function Exchange(name, type = 'topic', options) {
  if (!name || typeof name !== 'string') throw new TypeError('Exchange name is required and must be a string');
  if (type !== 'topic' && type !== 'direct') throw new TypeError('Exchange type must be one of topic or direct');
  const eventExchange = new EventExchange(`${name}__events`);
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
  this[kName] = name;
  this[kType] = type;
  this[kBindings] = [];
  this[kStopped] = false;
  this.options = {
    durable: true,
    autoDelete: true,
    ...options
  };
  this.events = eventExchange;
  const deliveryQueue = this[kDeliveryQueue] = new _Queue.Queue('delivery-q', {
    autoDelete: false
  });
  const onMessage = (type === 'topic' ? this._onTopicMessage : this._onDirectMessage).bind(this);
  deliveryQueue.consume(onMessage, {
    exclusive: true,
    consumerTag: '_exchange-tag'
  });
}
Object.defineProperties(ExchangeBase.prototype, {
  name: {
    get() {
      return this[kName];
    }
  },
  bindingCount: {
    get() {
      return this[kBindings].length;
    }
  },
  bindings: {
    get() {
      return this[kBindings].slice();
    }
  },
  type: {
    get() {
      return this[kType];
    }
  },
  stopped: {
    get() {
      return this[kStopped];
    }
  },
  undeliveredCount: {
    get() {
      return this[kDeliveryQueue].messageCount;
    }
  }
});
ExchangeBase.prototype.publish = function publish(routingKey, content, properties) {
  if (this[kStopped]) return;
  if (!this[kBindings].length) return this._emitReturn(routingKey, content, properties);
  return this[kDeliveryQueue].queueMessage({
    routingKey
  }, {
    content,
    properties
  });
};
ExchangeBase.prototype._onTopicMessage = function topic(routingKey, message) {
  const publishedMsg = message.content;
  message.ack();
  let delivered = 0;
  for (const binding of this[kBindings].slice()) {
    if (!binding.testPattern(routingKey)) continue;
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
  const bindings = this[kBindings];
  let deliverToBinding;
  for (const binding of bindings) {
    if (!binding.testPattern(routingKey)) continue;
    deliverToBinding = binding;
    break;
  }
  if (!deliverToBinding) {
    message.ack();
    this._emitReturn(routingKey, publishedMsg.content, publishedMsg.properties);
    return 0;
  }
  if (bindings.length > 1) {
    const idx = bindings.indexOf(deliverToBinding);
    bindings.splice(idx, 1);
    bindings.push(deliverToBinding);
  }
  message.ack();
  this._publishToQueue(deliverToBinding.queue, routingKey, publishedMsg.content, publishedMsg.properties);
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
  const bindings = this[kBindings];
  for (const binding of bindings) {
    if (binding.queue === queue && binding.pattern === pattern) return binding;
  }
  const binding = new Binding(this, queue, pattern, bindOptions);
  if (bindings.push(binding) > 1 && binding.options.priority) {
    bindings.sort(_shared.sortByPriority);
  }
  return binding;
};
ExchangeBase.prototype.unbindQueue = function unbindQueue(queue, pattern) {
  for (const binding of this[kBindings]) {
    if (binding.queue === queue && binding.pattern === pattern) {
      return this.closeBinding(binding);
    }
  }
};
ExchangeBase.prototype.unbindQueueByName = function unbindQueueByName(queueName) {
  for (const binding of this[kBindings]) {
    if (binding.queue.name === queueName) this.closeBinding(binding);
  }
};
ExchangeBase.prototype.close = function close() {
  for (const binding of this[kBindings]) {
    binding.close();
  }
  const deliveryQueue = this[kDeliveryQueue];
  deliveryQueue.cancel('_exchange-tag');
  deliveryQueue.close();
};
ExchangeBase.prototype.getState = function getState() {
  const bindingsState = [];
  for (const binding of this[kBindings]) {
    if (!binding.queue.options.durable) continue;
    bindingsState.push(binding.getState());
  }
  const deliveryQueue = this[kDeliveryQueue];
  return {
    name: this.name,
    type: this.type,
    options: {
      ...this.options
    },
    ...(deliveryQueue.messageCount && {
      deliveryQueue: deliveryQueue.getState()
    }),
    ...(bindingsState.length && {
      bindings: bindingsState
    })
  };
};
ExchangeBase.prototype.stop = function stop() {
  this[kStopped] = true;
};
ExchangeBase.prototype.recover = function recover(state, getQueue) {
  this[kStopped] = false;
  if (!state) return this;
  const deliveryQueue = this[kDeliveryQueue];
  if (state.bindings) {
    for (const bindingState of state.bindings) {
      const queue = getQueue(bindingState.queueName);
      if (!queue) return;
      this.bindQueue(queue, bindingState.pattern, bindingState.options);
    }
  }
  deliveryQueue.recover(state.deliveryQueue);
  if (!deliveryQueue.consumerCount) {
    const onMessage = (this[kType] === 'topic' ? this._onTopicMessage : this._onDirectMessage).bind(this);
    deliveryQueue.consume(onMessage, {
      exclusive: true,
      consumerTag: '_exchange-tag'
    });
  }
  return this;
};
ExchangeBase.prototype.getBinding = function getBinding(queueName, pattern) {
  for (const binding of this[kBindings]) {
    if (binding.queue.name === queueName && binding.pattern === pattern) return binding;
  }
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
  return eventQueue.consume(handler, {
    ...consumeOptions,
    noAck: true
  }, this);
};
ExchangeBase.prototype.off = function off(pattern, handler) {
  if (this.events) return this.events.off(`exchange.${pattern}`, handler);
  const {
    consumerTag
  } = handler;
  for (const binding of this[kBindings]) {
    if (binding.pattern === pattern) {
      if (consumerTag) binding.queue.cancel(consumerTag);else binding.queue.dismiss(handler);
    }
  }
};
ExchangeBase.prototype.closeBinding = function closeBinding(binding) {
  const bindings = this[kBindings];
  const idx = bindings.indexOf(binding);
  if (idx === -1) return;
  bindings.splice(idx, 1);
  binding.close();
  if (!bindings.length && this.options.autoDelete) this.emit('delete', this);
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
    options: {
      ...this.options
    },
    queueName: this.queue.name,
    pattern: this.pattern
  };
};