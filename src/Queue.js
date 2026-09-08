import { generateId, sortByPriority } from './shared.js';
import { Message } from './Message.js';
import { SmqpError, ERR_EXCLUSIVE_CONFLICT, ERR_EXCLUSIVE_NOT_ALLOWED } from './Errors.js';
import { K_NAME, K_STOPPED } from './constants.js';

const K_CONSUMERS = Symbol.for('consumers');
const K_CONSUMING = Symbol.for('consuming');
const K_EXCLUSIVE = Symbol.for('exclusive');
const K_INTERNAL_QUEUE = Symbol.for('internalQueue');
const K_IS_READY = Symbol.for('isReady');
const K_AVAILABLE_COUNT = Symbol.for('availableCount');

/**
 * Queue
 * @param {string} [name] optional, but recommended queue name, defaults to `smq.qname-<random>`
 * @param {import('#types').QueueOptions} [options] queue options
 * @param {import('#types').ExchangeEventEmitter} [eventEmitter] optional event emitter
 */
export function Queue(name, options, eventEmitter) {
  if (name && typeof name !== 'string') throw new TypeError('Queue name must be a string');
  else if (!name) name = `smq.qname-${generateId()}`;
  this[K_NAME] = name;

  /** @type {import('#types').QueueOptions} */
  this.options = { autoDelete: true, ...options };

  /** @type {Message[]} */
  this.messages = [];
  this.events = eventEmitter;
  this[K_CONSUMERS] = [];
  this[K_STOPPED] = false;
  this[K_AVAILABLE_COUNT] = 0;
  this[K_EXCLUSIVE] = false;
  /** @internal */
  this._onMessageConsumed = this._onMessageConsumed.bind(this);
}

Object.defineProperties(Queue.prototype, {
  name: {
    get() {
      return this[K_NAME];
    },
  },
  consumerCount: {
    get() {
      return this[K_CONSUMERS].length;
    },
  },
  consumers: {
    get() {
      return this[K_CONSUMERS].slice();
    },
  },
  exclusive: {
    get() {
      return this[K_EXCLUSIVE];
    },
  },
  messageCount: {
    get() {
      return this.messages.length;
    },
  },
  stopped: {
    get() {
      return this[K_STOPPED];
    },
  },
});

/**
 * Enqueue a message
 * @param {import('#types').MessageFields} fields message fields
 * @param {any} [content] message content
 * @param {import('#types').MessageProperties} [properties] message properties
 */
Queue.prototype.queueMessage = function queueMessage(fields, content, properties) {
  if (fields && typeof fields !== 'object') throw new TypeError('fields must be an object');
  if (properties && typeof properties !== 'object') throw new TypeError('properties must be an object');

  if (this[K_STOPPED]) return;

  const messageTtl = this.options.messageTtl;
  const messageProperties = { ...properties };
  if (messageTtl && !('expiration' in messageProperties)) {
    messageProperties.expiration = messageTtl;
  }
  const message = new Message(fields ?? {}, content, messageProperties, this._onMessageConsumed);

  const capacity = this._getCapacity();
  this.messages.push(message);
  this[K_AVAILABLE_COUNT]++;

  let discarded;
  switch (capacity) {
    case 0:
      discarded = this.evictFirst(message);
      break;
    case 1:
      this.emit('saturated', this);
      break;
  }

  return discarded ? 0 : this.consumeNext();
};

/**
 * Evict first non-pending message; returns true if it was the supplied message
 * @param {Message} [compareMessage] message to compare against the evicted one
 */
Queue.prototype.evictFirst = function evictFirst(compareMessage) {
  const evict = this.get();
  if (!evict) return;
  evict.nack(false, false);
  return evict === compareMessage;
};

/**
 * Deliver available messages to ready consumers, e.g. after a consumer's capacity hook has granted more credit
 * @returns {number | undefined} number of delivered messages, undefined if stopped or nothing is available
 */
Queue.prototype.consumeNext = function consumeNext() {
  if (this[K_STOPPED] || !this[K_AVAILABLE_COUNT]) return;

  const consumers = this[K_CONSUMERS];
  let consumed = 0;
  if (!consumers.length) return consumed;

  for (const consumer of consumers) {
    if (!consumer.ready) continue;
    const msgs = this._consumeMessages(consumer.capacity, consumer.options);
    if (!msgs.length) return consumed;
    consumer._push(msgs);
    consumed += msgs.length;
  }

  return consumed;
};

/**
 * Add a consumer
 * @param {import('#types').onMessage} onMessage message handler
 * @param {import('#types').ConsumeOptions} [consumeOptions] optional consume options
 * @param {any} [owner] forwarded to the message handler as the third arg
 */
Queue.prototype.consume = function consume(onMessage, consumeOptions, owner) {
  const consumers = this[K_CONSUMERS];
  if (consumers.length) {
    if (this[K_EXCLUSIVE])
      throw new SmqpError(`Queue ${this.name} is exclusively consumed by ${consumers[0].consumerTag}`, ERR_EXCLUSIVE_CONFLICT);
    if (consumeOptions?.exclusive)
      throw new SmqpError(`Queue ${this.name} already has consumers and cannot be exclusively consumed`, ERR_EXCLUSIVE_NOT_ALLOWED);
  }

  const consumer =
    consumeOptions && 'capacity' in consumeOptions
      ? new CreditConsumer(this, onMessage, consumeOptions, owner, new ConsumerEmitter(this))
      : new Consumer(this, onMessage, consumeOptions, owner, new ConsumerEmitter(this));
  this.emit('consume', consumer);

  if (consumers.push(consumer) > 1 && consumer.options.priority) {
    consumers.sort(sortByPriority);
  }

  if (consumer.options.exclusive) {
    this[K_EXCLUSIVE] = true;
  }

  const pendingMessages = this._consumeMessages(consumer.capacity, consumer.options);
  if (pendingMessages.length) consumer._push(pendingMessages);

  return consumer;
};

/**
 * Assert consumer matching handler + options exists, create if absent
 * @param {import('#types').onMessage} onMessage message handler
 * @param {import('#types').ConsumeOptions} [consumeOptions] optional consume options
 * @param {any} [owner] forwarded to the message handler as the third arg
 */
Queue.prototype.assertConsumer = function assertConsumer(onMessage, consumeOptions, owner) {
  /** @type {Consumer[]} */
  const consumers = this[K_CONSUMERS];
  if (!consumers.length) return this.consume(onMessage, consumeOptions, owner);
  for (const consumer of consumers) {
    if (consumer.onMessage !== onMessage) continue;

    if (consumeOptions) {
      if (consumeOptions.consumerTag && consumeOptions.consumerTag !== consumer.consumerTag) {
        continue;
      } else if ('exclusive' in consumeOptions && consumeOptions.exclusive !== consumer.options.exclusive) {
        continue;
      }
    }

    return consumer;
  }
  return this.consume(onMessage, consumeOptions, owner);
};

/**
 * Get next message from queue
 * @param {import('#types').ConsumeOptions} [options] optional consume options
 * @returns {import('#types').ConsumeMessage | undefined}
 */
Queue.prototype.get = function getMessage(options) {
  const message = this._consumeMessages(1, { noAck: options?.noAck, consumerTag: options?.consumerTag })[0];
  if (!message) return false;
  if (options?.noAck) {
    this._dequeueMessage(message);
    message._clearPending();
  }

  return message;
};

/**
 * @private
 * @param {number} n
 * @param {import('#types').ConsumeOptions} consumeOptions
 */
Queue.prototype._consumeMessages = function consumeMessages(n, consumeOptions) {
  /** @type {import('#types').ConsumeMessage[]} */
  const msgs = [];

  if (this[K_STOPPED] || !this[K_AVAILABLE_COUNT] || !n) return msgs;

  const evict = [];
  for (const message of this.messages) {
    if (message.pending) continue;
    if (message.properties.expiration && message.properties.ttl < Date.now()) {
      evict.push(message);
      continue;
    }
    message._consume(consumeOptions?.consumerTag);
    this[K_AVAILABLE_COUNT]--;
    msgs.push(message);
    if (!--n) break;
  }

  if (evict.length) this._evict(evict);

  return msgs;
};

/**
 * Evict expired undelivered messages, dead-lettering them if the queue has a dead letter exchange
 * @returns {number} number of evicted messages
 */
Queue.prototype.evictExpired = function evictExpired() {
  if (this[K_STOPPED] || !this[K_AVAILABLE_COUNT]) return 0;

  const now = Date.now();
  /** @type {Message[]} */
  const evict = [];
  for (const message of this.messages) {
    if (message.pending) continue;
    if (message.properties.expiration && message.properties.ttl < now) evict.push(message);
  }

  if (evict.length) this._evict(evict);
  return evict.length;
};

/**
 * Nack undelivered messages without requeue
 * @private
 * @param {Message[]} messages
 */
Queue.prototype._evict = function evict(messages) {
  this[K_AVAILABLE_COUNT] -= messages.length;
  for (const message of messages) this.nack(message, false, false);
};

/**
 * Acknowledge message
 * @param {Message} message message to ack
 * @param {boolean} [allUpTo] ack all messages up to and including this one
 */
Queue.prototype.ack = function ack(message, allUpTo) {
  if (this._onMessageConsumed(message, 'ack', allUpTo, false)) message._clearPending();
};

/**
 * Reject message
 * @param {Message} message message to nack
 * @param {boolean} [allUpTo] nack all messages up to and including this one
 * @param {boolean} [requeue] requeue nacked message(s), defaults to true
 */
Queue.prototype.nack = function nack(message, allUpTo, requeue = true) {
  if (this._onMessageConsumed(message, 'nack', allUpTo, requeue)) message._clearPending();
};

/**
 * Reject message
 * @param {Message} message message to reject
 * @param {boolean} [requeue] requeue rejected message, defaults to true
 */
Queue.prototype.reject = function reject(message, requeue = true) {
  if (this._onMessageConsumed(message, 'nack', false, requeue)) message._clearPending();
};

/**
 * @private
 * @param {Message} message
 * @param {string} operation
 * @param {boolean} allUpTo
 * @param {boolean} requeue
 */
Queue.prototype._onMessageConsumed = function onMessageConsumed(message, operation, allUpTo, requeue) {
  if (this[K_STOPPED]) return;

  const msgIdx = this._dequeueMessage(message);
  if (msgIdx === -1) return false;

  const messages = this.messages;
  const pending = allUpTo && this._getPendingMessages(msgIdx);

  let deadLetterExchange;
  switch (operation) {
    case 'ack':
      break;
    case 'nack': {
      if (requeue) {
        this[K_AVAILABLE_COUNT]++;
        messages.splice(
          msgIdx,
          0,
          new Message({ ...message.fields, redelivered: true }, message.content, message.properties, this._onMessageConsumed)
        );
      } else {
        deadLetterExchange = this.options.deadLetterExchange;
      }
      break;
    }
  }

  let capacity;
  if (!messages.length) this.emit('depleted', this);
  else if ((capacity = this._getCapacity()) === 1) this.emit('ready', capacity);

  const pendingLength = pending && pending.length;
  if (!pendingLength) this.consumeNext();

  if (!requeue && message.properties.confirm) {
    this.emit(`message.consumed.${operation}`, { operation, message: { ...message } });
  }

  if (deadLetterExchange) {
    const deadLetterRoutingKey = this.options.deadLetterRoutingKey;
    const { expiration, ...messageProperties } = message.properties;
    const deadMessage = new Message(message.fields, message.content, messageProperties);
    if (deadLetterRoutingKey) deadMessage.fields.routingKey = deadLetterRoutingKey;
    else if (deadMessage.fields.routingKey === undefined) deadMessage.fields.routingKey = '';

    this.emit('dead-letter', {
      deadLetterExchange,
      message: deadMessage,
    });
  }

  if (pendingLength) {
    for (const msg of pending) {
      msg[operation](false, requeue);
    }
  }
  return true;
};

Queue.prototype.ackAll = function ackAll() {
  for (const msg of this._getPendingMessages()) {
    msg.ack(false);
  }
};

/**
 * Reject all pending messages
 * @param {boolean} [requeue] requeue nacked messages, defaults to true
 */
Queue.prototype.nackAll = function nackAll(requeue = true) {
  for (const msg of this._getPendingMessages()) {
    msg.nack(false, requeue);
  }
};

/**
 * @private
 * @param {number} untilIndex
 */
Queue.prototype._getPendingMessages = function getPendingMessages(untilIndex) {
  const messages = this.messages;
  const l = messages.length;
  const result = [];
  if (!l) return result;

  const until = untilIndex ?? l;

  for (let i = 0; i < until; ++i) {
    const msg = messages[i];
    if (!msg.pending) continue;
    result.push(msg);
  }

  return result;
};

/**
 * Peek at the next message without consuming it
 * @param {boolean} [ignoreDelivered] skip pending messages
 */
Queue.prototype.peek = function peek(ignoreDelivered) {
  const message = this.messages[0];
  if (!message) return;

  if (!ignoreDelivered) return message;
  if (!message.pending) return message;

  for (const msg of this.messages) {
    if (!msg.pending) return msg;
  }
};

/**
 * Cancel consumer by tag
 * @param {string} consumerTag consumer tag
 * @param {boolean | import('#types').CancelOptions} [requeue] requeue messages held by the consumer, defaults to true, or cancel options
 */
Queue.prototype.cancel = function cancel(consumerTag, requeue) {
  const consumers = this[K_CONSUMERS];
  const idx = consumers.findIndex((c) => c.consumerTag === consumerTag);
  if (idx === -1) return false;

  const consumer = consumers[idx];
  this.unbindConsumer(consumer, requeue);

  return true;
};

/**
 * Cancel consumer matching the given handler
 * @param {import('#types').onMessage} onMessage handler previously passed to consume
 * @param {boolean | import('#types').CancelOptions} [requeue] requeue messages held by the consumer, defaults to true, or cancel options
 */
Queue.prototype.dismiss = function dismiss(onMessage, requeue) {
  const consumers = this[K_CONSUMERS];
  const consumer = consumers.find((c) => c.onMessage === onMessage);
  if (!consumer) return;
  this.unbindConsumer(consumer, requeue);
};

/**
 * Unbind consumer from queue
 * @param {Consumer} consumer consumer to unbind
 * @param {boolean | import('#types').CancelOptions} [requeue] requeue messages held by the consumer, defaults to true, or cancel options
 */
Queue.prototype.unbindConsumer = function unbindConsumer(consumer, requeue = true) {
  const consumers = this[K_CONSUMERS];
  const idx = consumers.indexOf(consumer);
  if (idx === -1) return;

  consumers.splice(idx, 1);

  this[K_EXCLUSIVE] = false;

  consumer.stop();
  if (requeue && typeof requeue === 'object') {
    if (!requeue.keepPending) consumer.nackAll(requeue.requeue ?? true);
  } else {
    consumer.nackAll(requeue);
  }

  this.emit('consumer.cancel', consumer);

  if (!consumers.length && this.options.autoDelete) return this.emit('delete', this);
};

/**
 * Emit a queue event
 * @param {string} eventName event name (without `queue.` prefix)
 * @param {any} [content] event payload
 */
Queue.prototype.emit = function emit(eventName, content) {
  if (!this.events) return;
  this.events.emit(`queue.${eventName}`, content);
};

/**
 * Subscribe to a queue event
 * @param {import('#types').QueueEventNames | string} eventName event name (without `queue.` prefix); accepts known names or a routing pattern
 * @param {Function} handler event handler
 * @param {import('#types').ConsumeOptions} [options] optional consume options
 */
Queue.prototype.on = function on(eventName, handler, options) {
  if (!this.events) return;
  return this.events.on(`queue.${eventName}`, handler, options);
};

/**
 * Unsubscribe from a queue event
 * @param {import('#types').QueueEventNames | string} eventName event name previously passed to on
 * @param {Function | { consumerTag?: string }} handler the handler used in on, or an object with the consumer tag
 */
Queue.prototype.off = function off(eventName, handler) {
  if (!this.events) return;
  return this.events.off(`queue.${eventName}`, handler);
};

Queue.prototype.purge = function purge() {
  const toDelete = this.messages.filter(({ pending }) => !pending);
  this[K_AVAILABLE_COUNT] = 0;

  for (const msg of toDelete) {
    this._dequeueMessage(msg);
  }

  if (!this.messages.length) this.emit('depleted', this);
  return toDelete.length;
};

/**
 * @private
 * @param {Message} message
 */
Queue.prototype._dequeueMessage = function dequeueMessage(message) {
  const messages = this.messages;
  const msgIdx = messages.indexOf(message);
  if (msgIdx === -1) return msgIdx;
  messages.splice(msgIdx, 1);
  return msgIdx;
};

/**
 * Get queue statistics on demand
 * @returns {import('#types').QueueStats}
 */
Queue.prototype.getStats = function getStats() {
  const messages = this.messages;
  let unackedCount = 0;
  for (const message of messages) {
    if (message.pending) unackedCount++;
  }
  return {
    name: this.name,
    messageCount: messages.length,
    unackedCount,
    consumerCount: this[K_CONSUMERS].length,
  };
};

/**
 * Snapshot queue state
 * @returns {import('#types').QueueState}
 */
Queue.prototype.getState = function getState() {
  const msgs = this.messages;
  /** @type {{name: string, options: import('#types').QueueOptions, messages?: import('#types').MessageEnvelope[] }} */
  const state = {
    name: this.name,
    options: { ...this.options },
  };
  if (msgs.length) {
    try {
      state.messages = JSON.parse(JSON.stringify(msgs));
    } catch (err) {
      err.code = 'EQUEUE_STATE';
      err.queue = this.name;
      throw err;
    }
  }

  return state;
};

/**
 * Recover queue from previously captured state
 * @param {import('#types').QueueState} [state] queue state, omit to recover stopped queue in place
 */
Queue.prototype.recover = function recover(state) {
  this[K_STOPPED] = false;
  const consumers = this[K_CONSUMERS];
  if (!state) {
    for (const c of consumers.slice()) c.recover();
    this.consumeNext();
    return this;
  }

  this.messages.splice(0);

  let continueConsume;
  if (consumers.length) {
    for (const c of consumers) c.nackAll(false);
    continueConsume = true;
  }

  if (!state.messages) return this;

  for (const { fields, content, properties } of state.messages) {
    if (properties?.persistent === false) continue;
    const msg = new Message({ ...fields, redelivered: true }, content, properties, this._onMessageConsumed);
    this.messages.push(msg);
  }
  this[K_AVAILABLE_COUNT] = this.messages.length;
  for (const c of consumers) c.recover();
  if (continueConsume) {
    this.consumeNext();
  }

  return this;
};

/**
 * Delete queue
 * @param {import('#types').DeleteQueueOptions} [options] optional delete guards
 */
Queue.prototype.delete = function deleteQueue(options) {
  const consumers = this[K_CONSUMERS];
  if (options?.ifUnused && consumers.length) return;
  const messages = this.messages;
  if (options?.ifEmpty && messages.length) return;

  this[K_STOPPED] = true;
  const messageCount = messages.length;
  for (const consumer of this[K_CONSUMERS].splice(0)) {
    this.emit('consumer.cancel', consumer);
  }

  messages.splice(0);

  this.emit('delete', this);
  return { messageCount };
};

Queue.prototype.close = function close() {
  for (const consumer of this[K_CONSUMERS].slice()) {
    this.unbindConsumer(consumer);
  }
};

Queue.prototype.stop = function stop() {
  this[K_STOPPED] = true;
  for (const consumer of this[K_CONSUMERS].slice()) {
    consumer.stop();
  }
};

/**
 * @private
 */
Queue.prototype._getCapacity = function getCapacity() {
  if ('maxLength' in this.options) {
    return this.options.maxLength - this.messages.length;
  }
  return Infinity;
};

/**
 * Queue consumer
 * @param {Queue} queue queue this consumer reads from
 * @param {import('#types').onMessage} onMessage message handler
 * @param {import('#types').ConsumeOptions} [options] consume options
 * @param {any} [owner] forwarded to the message handler as the third arg
 * @param {import('#types').ExchangeEventEmitter} [eventEmitter] internal queue event bridge
 */
export function Consumer(queue, onMessage, options, owner, eventEmitter) {
  if (typeof onMessage !== 'function') throw new TypeError('message callback is required and must be a function');

  const { consumerTag } = (this.options = { prefetch: 1, priority: 0, noAck: false, ...options });
  if (!consumerTag) this.options.consumerTag = `smq.ctag-${generateId()}`;
  else if (typeof consumerTag !== 'string') throw new TypeError('consumerTag must be a string');

  this.queue = queue;
  this.onMessage = onMessage;
  this.owner = owner;
  this.events = eventEmitter;
  this[K_NAME] = this.options.consumerTag;
  this[K_IS_READY] = true;
  this[K_STOPPED] = false;
  this[K_CONSUMING] = false;

  this[K_INTERNAL_QUEUE] = new Queue(
    `${this.options.consumerTag}-q`,
    {
      autoDelete: false,
      maxLength: this.options.prefetch,
    },
    new ConsumerQueueEvents(this)
  );
}

Object.defineProperties(Consumer.prototype, {
  consumerTag: {
    get() {
      return this[K_NAME];
    },
  },
  ready: {
    get() {
      return this[K_IS_READY] && !this[K_STOPPED];
    },
  },
  stopped: {
    get() {
      return this[K_STOPPED];
    },
  },
  capacity: {
    get() {
      return this[K_INTERNAL_QUEUE]._getCapacity();
    },
  },
  messageCount: {
    get() {
      return this[K_INTERNAL_QUEUE].messageCount;
    },
  },
  queueName: {
    get() {
      return this.queue.name;
    },
  },
});

/**
 * Project consumer state for serialization (used by `Broker.getConsumers` and `JSON.stringify`)
 * @returns {import('#types').ConsumerState}
 */
Consumer.prototype.toJSON = function toJSON() {
  return {
    queue: this.queue.name,
    consumerTag: this.consumerTag,
    ready: this.ready,
    options: { ...this.options },
  };
};

/** @private */
Consumer.prototype._push = function push(messages) {
  const internalQueue = this[K_INTERNAL_QUEUE];
  for (const message of messages) {
    internalQueue.queueMessage(message.fields, message, message.properties);
  }
  if (!this[K_CONSUMING]) {
    this[K_CONSUMING] = true;
    try {
      this._consume();
    } finally {
      this[K_CONSUMING] = false;
    }
  }
};

/** @private */
Consumer.prototype._consume = function consume() {
  const internalQ = this[K_INTERNAL_QUEUE];
  const consumerTag = this[K_NAME];

  let _msg;

  while ((_msg = internalQ.get())) {
    const msg = _msg;
    msg._consume(consumerTag);
    const message = msg.content;
    message._consume(consumerTag, () => msg.ack(false));

    if (this.options.noAck) message.ack();
    this.onMessage(msg.fields.routingKey, message, this.owner);

    if (this[K_STOPPED]) break;
  }
};

/**
 * Reject all messages held by this consumer
 * @param {boolean} [requeue] requeue nacked messages, defaults to true
 */
Consumer.prototype.nackAll = function nackAll(requeue) {
  for (const msg of this[K_INTERNAL_QUEUE].messages.slice()) {
    msg.content.nack(false, requeue);
  }
};

/** Acknowledge all messages held by this consumer */
Consumer.prototype.ackAll = function ackAll() {
  for (const msg of this[K_INTERNAL_QUEUE].messages.slice()) {
    msg.content.ack(false);
  }
};

/**
 * Cancel consumer
 * @param {boolean | import('#types').CancelOptions} [requeue] requeue messages held by the consumer, defaults to true, or cancel options
 */
Consumer.prototype.cancel = function cancel(requeue = true) {
  this.stop();
  this.queue.unbindConsumer(this, requeue);
};

/**
 * Set consumer prefetch count
 * @param {number} value new prefetch count
 */
Consumer.prototype.prefetch = function prefetch(value) {
  this.options.prefetch = this[K_INTERNAL_QUEUE].options.maxLength = value;
};

/**
 * Emit consumer event
 * @param {string} eventName event name (without `consumer.` prefix)
 * @param {any} [content] event payload
 */
Consumer.prototype.emit = function emit(eventName, content) {
  const routingKey = `consumer.${eventName}`;
  this.events.emit(routingKey, content);
};

/**
 * Subscribe to consumer event
 * @param {string} eventName event name (without `consumer.` prefix)
 * @param {Function} handler event handler
 */
Consumer.prototype.on = function on(eventName, handler) {
  const pattern = `consumer.${eventName}`;
  return this.events.on(pattern, handler);
};

Consumer.prototype.recover = function recover() {
  this[K_STOPPED] = false;
};

Consumer.prototype.stop = function stop() {
  this[K_STOPPED] = true;
};

/**
 * Consumer whose capacity is additionally limited by a credit hook
 * @param {Queue} queue queue this consumer reads from
 * @param {import('#types').onMessage} onMessage message handler
 * @param {import('#types').ConsumeOptions} options consume options with capacity hook
 * @param {any} [owner] forwarded to the message handler as the third arg
 * @param {import('#types').ExchangeEventEmitter} [eventEmitter] internal queue event bridge
 */
function CreditConsumer(queue, onMessage, options, owner, eventEmitter) {
  if (typeof options.capacity !== 'function') throw new TypeError('capacity must be a function');
  Consumer.call(this, queue, onMessage, options, owner, eventEmitter);
}

CreditConsumer.prototype = Object.create(Consumer.prototype, {
  constructor: { value: CreditConsumer, writable: true, configurable: true },
  ready: {
    get() {
      return this[K_IS_READY] && !this[K_STOPPED] && this.options.capacity() > 0;
    },
  },
  capacity: {
    get() {
      const capacity = this[K_INTERNAL_QUEUE]._getCapacity();
      const credit = this.options.capacity();
      if (credit < capacity) return credit > 0 ? credit : 0;
      return capacity;
    },
  },
});

function ConsumerEmitter(queue) {
  this.queue = queue;
}

ConsumerEmitter.prototype.on = function on(...args) {
  return this.queue.on(...args);
};

ConsumerEmitter.prototype.emit = function emit(eventName, content) {
  this.queue.emit(eventName, content);
};

function ConsumerQueueEvents(consumer) {
  this.consumer = consumer;
}

ConsumerQueueEvents.prototype.emit = function queueHandler(eventName) {
  switch (eventName) {
    case 'queue.saturated': {
      this.consumer[K_IS_READY] = false;
      break;
    }
    case 'queue.depleted':
    case 'queue.ready':
      this.consumer[K_IS_READY] = true;
      break;
  }
};
