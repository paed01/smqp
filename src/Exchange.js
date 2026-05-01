import { Message } from './Message.js';
import { Queue } from './Queue.js';
import { Binding } from './Binding.js';
import { sortByPriority, generateId } from './shared.js';

const kName = Symbol.for('name');
const kType = Symbol.for('type');
const kStopped = Symbol.for('stopped');
const kBindings = Symbol.for('bindings');
const kDeliveryQueue = Symbol.for('deliveryQueue');

/** @typedef {import('./Binding.js').Binding} Binding */

/**
 * Exchange
 * @param {string} name required exchange name
 * @param {import('#types').exchangeType} [type] optional type, defaults to topic
 * @param {import('#types').ExchangeOptions} [options] optional exchange options
 */
export function Exchange(name, type = 'topic', options) {
  if (!name || typeof name !== 'string') throw new TypeError('Exchange name is required and must be a string');

  if (type !== 'topic' && type !== 'direct') throw new TypeError('Exchange type must be one of topic or direct');
  const eventExchange = new EventExchange(`${name}__events`);
  return new ExchangeBase(name, type, options, eventExchange);
}

/**
 * Event exchange
 * @param {string} [name] optional event exchange name, defaults to smq.ename-<random>
 */
export function EventExchange(name) {
  if (!name) name = `smq.ename-${generateId()}`;
  return new ExchangeBase(name, 'topic', { durable: false, autoDelete: true });
}

/**
 * Exchange
 * @param {string} name name
 * @param {import('#types').exchangeType} type
 * @param {import('#types').ExchangeOptions} [options]
 * @param {ExchangeBase} [eventExchange]
 */
export function ExchangeBase(name, type, options, eventExchange) {
  this[kName] = name;
  this[kType] = type;
  /** @type {Binding[]} */
  this[kBindings] = [];
  this[kStopped] = false;
  /** @type {import('#types').ExchangeOptions} */
  this.options = { durable: true, autoDelete: true, ...options };
  this.events = eventExchange;

  /** @type {Queue} */
  const deliveryQueue = (this[kDeliveryQueue] = new Queue('delivery-q', { autoDelete: false }));
  const onMessage = (type === 'topic' ? this._onTopicMessage : this._onDirectMessage).bind(this);
  deliveryQueue.consume(onMessage, { exclusive: true, consumerTag: '_exchange-tag' });
}

Object.defineProperties(ExchangeBase.prototype, {
  name: {
    get() {
      return this[kName];
    },
  },
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

/**
 * Publish a message through the exchange
 * @param {string} routingKey routing key
 * @param {any} [content] message content
 * @param {import('#types').MessageProperties} [properties] optional message properties
 */
ExchangeBase.prototype.publish = function publish(routingKey, content, properties) {
  if (this[kStopped]) return;
  if (!this[kBindings].length) return this._emitReturn(routingKey, content, properties);

  return this[kDeliveryQueue].queueMessage(
    { routingKey },
    {
      content,
      properties,
    }
  );
};

/** @private */
ExchangeBase.prototype._onTopicMessage = function topic(routingKey, message) {
  const publishedMsg = message.content;

  message.ack();

  let delivered = 0;
  for (const binding of this[kBindings].slice()) {
    if (!binding.testPattern(routingKey)) continue;
    binding.queue.queueMessage({ routingKey, exchange: this.name }, publishedMsg.content, publishedMsg.properties);
    ++delivered;
  }

  if (!delivered) {
    this._emitReturn(routingKey, publishedMsg.content, publishedMsg.properties);
  }

  return delivered;
};

/**
 * @private
 * @param {string} routingKey
 * @param {Message} message
 */
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

  deliverToBinding.queue.queueMessage({ routingKey, exchange: this.name }, publishedMsg.content, publishedMsg.properties);

  return 1;
};

/** @private */
ExchangeBase.prototype._emitReturn = function emitReturn(routingKey, content, properties) {
  if (!this.events || !properties) return;

  if (properties.confirm) {
    this.emit('message.undelivered', new Message({ routingKey, exchange: this.name }, content, properties));
  }
  if (properties.mandatory) {
    this.emit('return', new Message({ routingKey, exchange: this.name }, content, properties));
  }
};

/**
 * Bind a queue to this exchange with a routing key pattern
 * @param {import('./Queue.js').Queue} queue queue to bind
 * @param {string} pattern routing key pattern
 * @param {import('#types').BindingOptions} [bindOptions] optional binding options
 */
ExchangeBase.prototype.bindQueue = function bindQueue(queue, pattern, bindOptions) {
  const bindings = this[kBindings];

  for (const binding of bindings) {
    if (binding.queue === queue && binding.pattern === pattern) return binding;
  }

  const binding = new Binding(this, queue, pattern, bindOptions);
  if (bindings.push(binding) > 1 && binding.options.priority) {
    bindings.sort(sortByPriority);
  }

  return binding;
};

/**
 * Unbind a queue from this exchange
 * @param {import('./Queue.js').Queue} queue queue previously bound
 * @param {string} pattern routing key pattern
 */
ExchangeBase.prototype.unbindQueue = function unbindQueue(queue, pattern) {
  for (const binding of this[kBindings]) {
    if (binding.queue === queue && binding.pattern === pattern) {
      return this.closeBinding(binding);
    }
  }
};

/**
 * Unbind every binding pointing at the named queue
 * @param {string} queueName queue name
 */
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
  /** @type {ReturnType<Binding['getState']>[]} */
  const bindingsState = [];
  for (const binding of this[kBindings]) {
    if (!binding.queue.options.durable) continue;
    bindingsState.push(binding.getState());
  }

  /** @type {Queue} */
  const deliveryQueue = this[kDeliveryQueue];
  return {
    name: this.name,
    type: this.type,
    options: { ...this.options },
    ...(deliveryQueue.messageCount && { deliveryQueue: deliveryQueue.getState() }),
    ...(bindingsState.length && { bindings: bindingsState }),
  };
};

ExchangeBase.prototype.stop = function stop() {
  this[kStopped] = true;
};

/**
 * Recover exchange from previously captured state
 * @param {import('#types').ExchangeState} [state] exchange state, omit to recover stopped exchange in place
 * @param {(name: string) => import('./Queue.js').Queue} [getQueue] callback to resolve a queue by name (used during binding restore)
 */
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

/**
 * Find a binding by queue name and pattern
 * @param {string} queueName queue name
 * @param {string} pattern routing key pattern
 */
ExchangeBase.prototype.getBinding = function getBinding(queueName, pattern) {
  for (const binding of this[kBindings]) {
    if (binding.queue.name === queueName && binding.pattern === pattern) return binding;
  }
};

/**
 * Emit an exchange event (or, if no event sub-exchange, publish on the exchange itself)
 * @param {string} eventName event name (without `exchange.` prefix)
 * @param {any} [content] event payload
 */
ExchangeBase.prototype.emit = function emit(eventName, content) {
  if (this.events) return this.events.publish(`exchange.${eventName}`, content);
  return this.publish(eventName, content);
};

/**
 * Subscribe to an exchange event
 * @param {string} pattern event name pattern (without `exchange.` prefix)
 * @param {import('#types').onMessage} handler event handler
 * @param {import('#types').ConsumeOptions} [consumeOptions] optional consume options
 */
ExchangeBase.prototype.on = function on(pattern, handler, consumeOptions) {
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

/**
 * Unsubscribe from an exchange event
 * @param {string} pattern event name pattern previously passed to on
 * @param {import('#types').onMessage | { consumerTag?: string }} handler the handler used in on, or an object with the consumer tag
 */
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

/**
 * Remove a single binding from this exchange
 * @param {import('./Binding.js').Binding} binding binding to close
 */
ExchangeBase.prototype.closeBinding = function closeBinding(binding) {
  const bindings = this[kBindings];
  const idx = bindings.indexOf(binding);
  if (idx === -1) return;

  bindings.splice(idx, 1);
  binding.close();

  if (!bindings.length && this.options.autoDelete) this.emit('delete', this);
};
