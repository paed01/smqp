import { Message } from './Message.js';
import { Queue } from './Queue.js';
import { sortByPriority, getRoutingKeyPattern, generateId } from './shared.js';

const kType = Symbol.for('type');
const kStopped = Symbol.for('stopped');
const kBindings = Symbol.for('bindings');
const kDeliveryQueue = Symbol.for('deliveryQueue');

const exchangeTypes = [ 'topic', 'direct' ];

export function Exchange(name, type = 'topic', options) {
  if (!name || typeof name !== 'string') throw new TypeError('Exchange name is required and must be a string');

  if (exchangeTypes.indexOf(type) === -1) throw Error('Exchange type must be one of topic or direct');
  const eventExchange = new EventExchange(`${name}__events`);
  return new ExchangeBase(name, type, options, eventExchange);
}

export function EventExchange(name) {
  if (!name) name = `smq.ename-${generateId()}`;
  return new ExchangeBase(name, 'topic', { durable: false, autoDelete: true });
}

function ExchangeBase(name, type, options, eventExchange) {
  this.name = name;
  this[kType] = type;
  this[kBindings] = [];
  this[kStopped] = false;
  this.options = { durable: true, autoDelete: true, ...options };
  this.events = eventExchange;

  const deliveryQueue = this[kDeliveryQueue] = new Queue('delivery-q', { autoDelete: false });
  const onMessage = (type === 'topic' ? this._onTopicMessage : this._onDirectMessage).bind(this);
  deliveryQueue.consume(onMessage, { exclusive: true, consumerTag: '_exchange-tag' });
}

Object.defineProperties(ExchangeBase.prototype, {
  bindingCount: {
    get() {
      return this[kBindings].length;
    },
  },
  bindings: {
    get() {
      return this[kBindings].slice();
    },
  },
  type: {
    get() {
      return this[kType];
    },
  },
  stopped: {
    get() {
      return this[kStopped];
    },
  },
  undeliveredCount: {
    get() {
      return this[kDeliveryQueue].messageCount;
    },
  },
});

ExchangeBase.prototype.publish = function publish(routingKey, content, properties) {
  if (this[kStopped]) return;
  if (!this.bindingCount) return this._emitReturn(routingKey, content, properties);

  return this[kDeliveryQueue].queueMessage({ routingKey }, {
    content,
    properties,
  });
};

ExchangeBase.prototype._onTopicMessage = function topic(routingKey, message) {
  const publishedMsg = message.content;
  const bindings = this[kBindings];

  message.ack();

  const deliverTo = bindings.filter((binding) => binding.testPattern(routingKey));
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
  const bindings = this[kBindings];

  const deliverTo = bindings.find((binding) => binding.testPattern(routingKey));
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
  queue.queueMessage({ routingKey, exchange: this.name }, content, properties);
};

ExchangeBase.prototype._emitReturn = function emitReturn(routingKey, content, properties) {
  if (!this.events || !properties) return;

  if (properties.confirm) {
    this.emit('message.undelivered', new Message({ routingKey, exchange: this.name }, content, properties));
  }
  if (properties.mandatory) {
    this.emit('return', new Message({ routingKey, exchange: this.name }, content, properties));
  }
};

ExchangeBase.prototype.bindQueue = function bindQueue(queue, pattern, bindOptions) {
  const bindings = this[kBindings];
  const bound = bindings.find((bq) => bq.queue === queue && bq.pattern === pattern);
  if (bound) return bound;

  const binding = new Binding(this, queue, pattern, bindOptions);
  bindings.push(binding);
  bindings.sort(sortByPriority);

  this.emit('bind', binding);

  return binding;
};

ExchangeBase.prototype.unbindQueue = function unbindQueue(queue, pattern) {
  const bindings = this[kBindings];
  const idx = bindings.findIndex((bq) => bq.queue === queue && bq.pattern === pattern);
  if (idx === -1) return;

  const [ binding ] = bindings.splice(idx, 1);
  binding.close();

  this.emit('unbind', binding);

  if (!bindings.length && this.options.autoDelete) this.emit('delete', this);
};

ExchangeBase.prototype.unbindQueueByName = function unbindQueueByName(queueName) {
  for (const binding of this[kBindings]) {
    if (binding.queue.name !== queueName) continue;
    this.unbindQueue(binding.queue, binding.pattern);
  }
};

ExchangeBase.prototype.close = function close() {
  for (const binding of this[kBindings].slice()) {
    binding.close();
  }
  const deliveryQueue = this[kDeliveryQueue];
  deliveryQueue.cancel('_exchange-tag');
  deliveryQueue.close();
};

ExchangeBase.prototype.getState = function getState() {
  let bindings;
  for (const binding of this[kBindings]) {
    if (!binding.queue.options.durable) continue;
    if (!bindings) bindings = [];
    bindings.push(binding.getState());
  }

  const deliveryQueue = this[kDeliveryQueue];
  return {
    name: this.name,
    type: this.type,
    options: { ...this.options },
    ...(deliveryQueue.messageCount ? { deliveryQueue: deliveryQueue.getState() } : undefined),
    ...(bindings ? { bindings } : undefined),
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
    deliveryQueue.consume(onMessage, { exclusive: true, consumerTag: '_exchange-tag' });
  }

  return this;
};

ExchangeBase.prototype.getBinding = function getBinding(queueName, pattern) {
  return this[kBindings].find((binding) => binding.queue.name === queueName && binding.pattern === pattern);
};

ExchangeBase.prototype.emit = function emit(eventName, content) {
  if (this.events) return this.events.publish(`exchange.${eventName}`, content);
  return this.publish(eventName, content);
};

ExchangeBase.prototype.on = function on(pattern, handler, consumeOptions = {}) {
  if (this.events) return this.events.on(`exchange.${pattern}`, handler, consumeOptions);

  const eventQueue = new Queue(null, { durable: false, autoDelete: true });
  const binding = this.bindQueue(eventQueue, pattern);
  eventQueue.events = {
    emit(eventName) {
      if (eventName === 'queue.delete') binding.close();
    },
  };

  return eventQueue.consume(handler, { ...consumeOptions, noAck: true }, this);
};

ExchangeBase.prototype.off = function off(pattern, handler) {
  if (this.events) return this.events.off(`exchange.${pattern}`, handler);

  const { consumerTag } = handler;

  for (const binding of this[kBindings]) {
    if (binding.pattern === pattern) {
      if (consumerTag) binding.queue.cancel(consumerTag);
      else binding.queue.dismiss(handler);
    }
  }
};

function Binding(exchange, queue, pattern, bindOptions) {
  this.id = `${queue.name}/${pattern}`;
  this.options = { priority: 0, ...bindOptions };
  this.pattern = pattern;
  this.exchange = exchange;
  this.queue = queue;
  this._compiledPattern = getRoutingKeyPattern(pattern);

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
    options: { ...this.options },
    queueName: this.queue.name,
    pattern: this.pattern,
  };
};
