import { generateId, sortByPriority } from './shared';
import { Message } from './Message';

export { Queue, Consumer };

const prv = Symbol('private');

const queuePublicMethods = [
  'ack',
  'ackAll',
  'assertConsumer',
  'cancel',
  'close',
  'consume',
  'delete',
  'dequeueMessage',
  'dismiss',
  'get',
  'getState',
  'nack',
  'nackAll',
  'off',
  'on',
  'peek',
  'purge',
  'queueMessage',
  'recover',
  'reject',
  'stop',
  'unbindConsumer',
];

class _Queue {
  constructor(name, options = {}, eventEmitter) {
    this[prv] = {
      eventEmitter,
      consumers: [],
      pendingMessageCount: 0,
      onMessageConsumed: _Queue.prototype._onMessageConsumed.bind(this),
    };

    this.name = name || `smq.qname-${generateId()}`;
    this.options = { autoDelete: true, ...options };
    if (this.options.maxLength === undefined) {
      this.options.maxLength = Infinity;
    }

    this.messages = [];

    queuePublicMethods.forEach((fn) => {
      this[fn] = _Queue.prototype[fn].bind(this);
    });
  }

  get messageCount() {
    return this.messages.length;
  }

  get consumers() {
    return this[prv].consumers.slice();
  }

  get consumerCount() {
    return this[prv].consumers.length;
  }

  get stopped() {
    return this[prv].stopped;
  }

  get exclusive() {
    return this[prv].exclusivelyConsumed;
  }

  get maxLength() {
    return this.options.maxLength;
  }

  set maxLength(maxLength) {
    this.options.maxLength = maxLength;
  }

  get capacity() {
    return this.getCapacity();
  }

  queueMessage(fields, content, properties, onMessageQueued) {
    if (this[prv].stopped) return;

    const messageProperties = { ...properties };
    const messageTtl = this.options.messageTtl;

    if (messageTtl) {
      messageProperties.expiration = messageProperties.expiration || messageTtl;
    }
    const message = Message(
      fields,
      content,
      messageProperties,
      this[prv].onMessageConsumed
    );

    const capacity = this.getCapacity();
    this.messages.push(message);
    this[prv].pendingMessageCount++;

    let discarded;

    const evictOld = () => {
      const evict = this.get();
      if (!evict) return;
      evict.nack(false, false);
      return evict === message;
    };

    switch (capacity) {
      case 0:
        discarded = evictOld();
      case 1:
        this._emit('saturated');
    }

    if (onMessageQueued) onMessageQueued(message);
    this._emit('message', message);

    return discarded ? 0 : this._consumeNext();
  }

  _consumeNext() {
    const consumers = this[prv].consumers;
    if (this[prv].stopped) return;
    if (!this[prv].pendingMessageCount) return;
    if (!consumers.length) return;

    const readyConsumers = consumers.filter((consumer) => consumer.ready);
    if (!readyConsumers.length) return 0;

    let consumed = 0;
    for (const consumer of readyConsumers) {
      const msgs = this._consumeMessages(consumer.capacity, consumer.options);
      if (!msgs.length) return consumed;
      consumer.push(msgs);
      consumed += msgs.length;
    }

    return consumed;
  }

  consume(onMessage, consumeOptions = {}, owner) {
    const consumers = this[prv].consumers;

    if (this[prv].exclusivelyConsumed && consumers.length) {
      throw new Error(
        `Queue ${this.name} is exclusively consumed by ${consumers[0].consumerTag}`
      );
    } else if (consumeOptions.exclusive && consumers.length) {
      throw new Error(
        `Queue ${this.name} already has consumers and cannot be exclusively consumed`
      );
    }

    const consumerEmitter = {
      emit: (eventName, ...args) => {
        if (eventName === 'consumer.cancel') {
          this.unbindConsumer(consumer);
        }
        this._emit(eventName, ...args);
      },
      on: this.on,
    };

    const consumer = Consumer(
      this,
      onMessage,
      consumeOptions,
      owner,
      consumerEmitter
    );
    consumers.push(consumer);
    consumers.sort(sortByPriority);

    this[prv].exclusivelyConsumed = consumer.options.exclusive;

    this._emit('consume', consumer);

    const pendingMessages = this._consumeMessages(
      consumer.capacity,
      consumer.options
    );
    if (pendingMessages.length) consumer.push(pendingMessages);

    return consumer;
  }

  assertConsumer(onMessage, consumeOptions = {}, owner) {
    const consumers = this[prv].consumers;

    if (!consumers.length) {
      return this.consume(onMessage, consumeOptions, owner);
    }
    for (const consumer of consumers) {
      if (consumer.onMessage !== onMessage) continue;

      if (
        consumeOptions.consumerTag &&
        consumeOptions.consumerTag !== consumer.consumerTag
      ) {
        continue;
      } else if (
        'exclusive' in consumeOptions &&
        consumeOptions.exclusive !== consumer.options.exclusive
      ) {
        continue;
      }

      return consumer;
    }
    return this.consume(onMessage, consumeOptions, owner);
  }

  get({ noAck, consumerTag } = {}) {
    const message = this._consumeMessages(1, { noAck, consumerTag })[0];
    if (!message) return;
    if (noAck) this._dequeue(message);

    return message;
  }

  _consumeMessages(n, consumeOptions) {
    if (this[prv].stopped || !this[prv].pendingMessageCount || !n) return [];

    const now = Date.now();
    const msgs = [];
    const evict = [];
    for (const message of this.messages) {
      if (message.pending) continue;
      if (message.ttl && message.ttl < now) {
        evict.push(message);
        continue;
      }
      message.consume(consumeOptions);
      this[prv].pendingMessageCount--;
      msgs.push(message);
      if (!--n) break;
    }

    for (const expired of evict) this.nack(expired, false, false);

    return msgs;
  }

  ack(message, allUpTo) {
    this[prv].onMessageConsumed(message, 'ack', allUpTo);
  }

  nack(message, allUpTo, requeue = true) {
    this[prv].onMessageConsumed(message, 'nack', allUpTo, requeue);
  }

  reject(message, requeue = true) {
    this[prv].onMessageConsumed(message, 'nack', false, requeue);
  }

  _onMessageConsumed(message, operation, allUpTo, requeue) {
    if (this[prv].stopped) return;
    const pending = allUpTo && this._getPendingMessages(message);
    const { properties } = message;

    let deadLetter = false;
    switch (operation) {
      case 'ack': {
        if (!this._dequeue(message)) return;
        break;
      }
      case 'nack':
        if (requeue) {
          this._requeueMessage(message);
          break;
        }

        if (!this._dequeue(message)) return;
        deadLetter = !!this.options.deadLetterExchange;
        break;
    }

    let capacity;
    if (!this.messages.length) this._emit('depleted', this);
    else if ((capacity = this.getCapacity()) === 1) {
      this._emit('ready', capacity);
    }

    if (!pending || !pending.length) this._consumeNext();

    if (!requeue && properties.confirm) {
      this._emit('message.consumed.' + operation, {
        operation,
        message: { ...message },
      });
    }

    if (deadLetter) {
      const deadMessage = Message(message.fields, message.content, {
        ...properties,
        expiration: undefined,
      });
      if (this.options.deadLetterRoutingKey) {
        deadMessage.fields.routingKey = this.options.deadLetterRoutingKey;
      }

      this._emit('dead-letter', {
        deadLetterExchange: this.options.deadLetterExchange,
        message: deadMessage,
      });
    }

    if (pending && pending.length) {
      pending.forEach((msg) => msg[operation](false, requeue));
    }
  }

  ackAll() {
    this._getPendingMessages().forEach((msg) => msg.ack(false));
  }

  nackAll(requeue = true) {
    this._getPendingMessages().forEach((msg) => msg.nack(false, requeue));
  }

  _getPendingMessages(fromAndNotIncluding) {
    if (!fromAndNotIncluding) return this.messages.filter((msg) => msg.pending);

    const msgIdx = this.messages.indexOf(fromAndNotIncluding);
    if (msgIdx === -1) return [];

    return this.messages.slice(0, msgIdx).filter((msg) => msg.pending);
  }

  _requeueMessage(message) {
    const msgIdx = this.messages.indexOf(message);
    if (msgIdx === -1) return;
    this[prv].pendingMessageCount++;
    this.messages.splice(
      msgIdx,
      1,
      Message(
        { ...message.fields, redelivered: true },
        message.content,
        message.properties,
        this[prv].onMessageConsumed
      )
    );
  }

  peek(ignoreDelivered) {
    const message = this.messages[0];
    if (!message) return;

    if (!ignoreDelivered) return message;
    if (!message.pending) return message;

    for (let idx = 1; idx < this.messages.length; idx++) {
      if (!this.messages[idx].pending) {
        return this.messages[idx];
      }
    }
  }

  cancel(consumerTag) {
    const consumers = this[prv].consumers;
    const idx = consumers.findIndex((c) => c.consumerTag === consumerTag);
    if (idx === -1) return;

    return this.unbindConsumer(consumers[idx]);
  }

  dismiss(onMessage) {
    const consumer = this[prv].consumers.find((c) => c.onMessage === onMessage);
    if (!consumer) return;
    this.unbindConsumer(consumer);
  }

  unbindConsumer(consumer) {
    const idx = this[prv].consumers.indexOf(consumer);
    if (idx === -1) return;

    this[prv].consumers.splice(idx, 1);

    if (this[prv].exclusivelyConsumed) {
      this[prv].exclusivelyConsumed = false;
    }

    consumer.stop();

    if (this.options.autoDelete && !this[prv].consumers.length) {
      return this.delete();
    }

    consumer.nackAll(true);
  }

  _emit(eventName, content) {
    if (!this[prv].eventEmitter || !this[prv].eventEmitter.emit) return;
    const routingKey = `queue.${eventName}`;
    this[prv].eventEmitter.emit(routingKey, content);
  }

  on(eventName, handler) {
    if (!this[prv].eventEmitter || !this[prv].eventEmitter.on) return;
    const pattern = `queue.${eventName}`;
    return this[prv].eventEmitter.on(pattern, handler);
  }

  off(eventName, handler) {
    if (!this[prv].eventEmitter || !this[prv].eventEmitter.off) return;
    const pattern = `queue.${eventName}`;
    return this[prv].eventEmitter.off(pattern, handler);
  }

  purge() {
    const toDelete = this.messages.filter(({ pending }) => !pending);
    this[prv].pendingMessageCount = 0;

    toDelete.forEach((message) => this._dequeue(message));

    if (!this.messages.length) this._emit('depleted', this);
    return toDelete.length;
  }

  dequeueMessage(message) {
    if (message.pending) return this.nack(message, false, false);

    message.consume({});

    this.nack(message, false, false);
  }

  _dequeue(message) {
    const msgIdx = this.messages.indexOf(message);
    if (msgIdx === -1) return;

    this.messages.splice(msgIdx, 1);

    return true;
  }

  getState() {
    return {
      name: this.name,
      options: { ...this.options },
      ...(this.messages.length
        ? { messages: JSON.parse(JSON.stringify(this.messages)) }
        : undefined),
    };
  }

  recover(state) {
    this[prv].stopped = false;
    const consumers = this[prv].consumers;

    if (!state) {
      consumers.slice().forEach((c) => c.recover());
      return this._consumeNext();
    }

    this.name = state.name;

    this.messages.splice(0);

    let continueConsume;
    if (consumers.length) {
      consumers.forEach((c) => c.nackAll(false));
      continueConsume = true;
    }

    if (!state.messages) return this;

    state.messages.forEach(({ fields, content, properties }) => {
      if (properties.persistent === false) return;
      const msg = Message(
        { ...fields, redelivered: true },
        content,
        properties,
        this[prv].onMessageConsumed
      );
      this.messages.push(msg);
    });

    this[prv].pendingMessageCount = this.messages.length;
    consumers.forEach((c) => c.recover());
    if (continueConsume) {
      this._consumeNext();
    }

    return this;
  }

  delete({ ifUnused, ifEmpty } = {}) {
    const consumers = this[prv].consumers;
    if (ifUnused && consumers.length) return;
    if (ifEmpty && this.messages.length) return;

    const messageCount = this.messages.length;
    this.stop();

    const deleteConsumers = consumers.splice(0);
    deleteConsumers.forEach((consumer) => {
      consumer.cancel();
    });

    this.messages.splice(0);

    this._emit('delete', this);
    return { messageCount };
  }

  close() {
    this[prv].consumers.splice(0).forEach((consumer) => consumer.cancel());
    this[prv].exclusivelyConsumed = false;
  }

  stop() {
    this[prv].stopped = true;
    this.consumers.forEach((consumer) => consumer.stop());
  }

  getCapacity() {
    return this.options.maxLength - this.messages.length;
  }
}

function Queue(name, options = {}, eventEmitter) {
  return new _Queue(name, options, eventEmitter);
}

const consumerPublicMethods = [
  'on',
  'ackAll',
  'cancel',
  'nackAll',
  'prefetch',
  'push',
  'recover',
  'stop',
];

class _Consumer {
  constructor(queue, onMessage, options = {}, owner, eventEmitter) {
    this.options = { prefetch: 1, priority: 0, noAck: false, ...options };
    if (!this.options.consumerTag) {
      this.options.consumerTag = `smq.ctag-${generateId()}`;
    }

    const internalQueue = Queue(
      `${this.options.consumerTag}-q`,
      { maxLength: this.options.prefetch },
      { emit: _Consumer.prototype._onInternalQueueEvent.bind(this) }
    );

    this[prv] = {
      eventEmitter,
      owner,
      internalQueue,
      ready: true,
      stopped: false,
      consuming: undefined,
      onInternalMessageQueued:
        _Consumer.prototype._onInternalMessageQueued.bind(this),
    };

    this.queue = queue;
    this.onMessage = onMessage;

    consumerPublicMethods.forEach((fn) => {
      this[fn] = _Consumer.prototype[fn].bind(this);
    });
  }

  get consumerTag() {
    return this.options.consumerTag;
  }

  get messageCount() {
    return this[prv].internalQueue.messageCount;
  }

  get capacity() {
    return this[prv].internalQueue.capacity;
  }

  get queueName() {
    return this.queue.name;
  }

  get ready() {
    return this[prv].ready && !this[prv].stopped;
  }

  get stopped() {
    return this[prv].stopped;
  }

  on(eventName, handler) {
    const pattern = `consumer.${eventName}`;
    return this[prv].eventEmitter.on(pattern, handler);
  }

  ackAll() {
    this[prv].internalQueue.messages.slice().forEach((msg) => {
      msg.content.ack(false);
    });
  }

  cancel(requeue = true) {
    this._emit('cancel', this);
    this.nackAll(requeue);
  }

  nackAll(requeue) {
    this[prv].internalQueue.messages.slice().forEach((msg) => {
      msg.content.nack(false, requeue);
    });
  }

  prefetch(value) {
    this.options.prefetch = this[prv].internalQueue.maxLength = value;
  }

  push(messages) {
    const { internalQueue, onInternalMessageQueued } = this[prv];
    messages.forEach((message) => {
      internalQueue.queueMessage(
        message.fields,
        message,
        message.properties,
        onInternalMessageQueued
      );
    });
    if (!this[prv].consuming) {
      this._consume();
    }
  }

  recover() {
    this[prv].stopped = false;
  }

  stop() {
    this[prv].stopped = true;
  }

  /* private methods */

  _emit(eventName, content) {
    const routingKey = `consumer.${eventName}`;
    this[prv].eventEmitter.emit(routingKey, content);
  }

  _consume() {
    if (this[prv].stopped) return;
    this[prv].consuming = true;

    const msg = this[prv].internalQueue.get();

    if (!msg) {
      this[prv].consuming = false;
      return;
    }

    msg.consume(this.options);
    const message = msg.content;
    message.consume(this.options, onConsumed);

    if (this.options.noAck) msg.content.ack();
    this.onMessage(msg.fields.routingKey, msg.content, this[prv].owner);

    this[prv].consuming = false;

    return this._consume();

    function onConsumed() {
      msg.nack(false, false);
    }
  }

  _onInternalMessageQueued(msg) {
    const message = msg.content;
    const internalQueue = this[prv].internalQueue;
    message.consume(this.options, () => internalQueue.dequeueMessage(msg));
  }

  _onInternalQueueEvent(eventName) {
    switch (eventName) {
      case 'queue.saturated': {
        this[prv].ready = false;
        break;
      }
      case 'queue.depleted':
      case 'queue.ready':
        this[prv].ready = true;
        break;
    }
  }
}

function Consumer(queue, onMessage, options = {}, owner, eventEmitter) {
  if (typeof onMessage !== 'function') {
    throw new Error('message callback is required and must be a function');
  }

  return new _Consumer(queue, onMessage, options, owner, eventEmitter);
}
