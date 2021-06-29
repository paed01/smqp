import {generateId, sortByPriority} from './shared';
import {Message} from './Message';

export {Queue, Consumer};

const consumersSymbol = Symbol.for('consumers');
const consumingSymbol = Symbol.for('consuming');
const eventEmitterSymbol = Symbol.for('eventEmitter');
const exclusiveSymbol = Symbol.for('exclusive');
const internalQueueSymbol = Symbol.for('internalQueue');
const isReadySymbol = Symbol.for('isReady');
const onConsumedSymbol = Symbol.for('onConsumedSymbol');
const onMessageConsumedSymbol = Symbol.for('onMessageConsumed');
const pendingMessageCountSymbol = Symbol.for('pendingMessageCount');
const stoppedSymbol = Symbol.for('stopped');

function Queue(name, options = {}, eventEmitter) {
  if (!(this instanceof Queue)) {
    return new Queue(name, options, eventEmitter);
  }

  if (!name) name = `smq.qname-${generateId()}`;
  this.name = name;

  this.options = {autoDelete: true, ...options};

  this.messages = [];
  this[consumersSymbol] = [];
  this[stoppedSymbol] = false;
  this[pendingMessageCountSymbol] = 0;
  this[exclusiveSymbol] = false;
  this[eventEmitterSymbol] = eventEmitter;
  this[onConsumedSymbol] = this[onMessageConsumedSymbol].bind(this);
}

Object.defineProperty(Queue.prototype, 'consumerCount', {
  enumerable: true,
  get() {
    return this[consumersSymbol].length;
  },
});

Object.defineProperty(Queue.prototype, 'consumers', {
  get() {
    return this[consumersSymbol].slice();
  },
});

Object.defineProperty(Queue.prototype, 'exclusive', {
  get() {
    return this[exclusiveSymbol];
  },
});

Object.defineProperty(Queue.prototype, 'messageCount', {
  enumerable: true,
  get() {
    return this.messages.length;
  },
});

Object.defineProperty(Queue.prototype, 'stopped', {
  enumerable: true,
  get() {
    return this[stoppedSymbol];
  },
});

Queue.prototype.queueMessage = function queueMessage(fields, content, properties, onMessageQueued) {
  if (this[stoppedSymbol]) return;

  const messageProperties = {...properties};
  const messageTtl = this.options.messageTtl;
  if (messageTtl) messageProperties.expiration = messageProperties.expiration || messageTtl;
  const message = new Message(fields, content, messageProperties, this[onConsumedSymbol]);

  const capacity = this.getCapacity();
  this.messages.push(message);
  this[pendingMessageCountSymbol]++;

  let discarded;
  switch (capacity) {
    case 0:
      discarded = this.evictFirst(message);
    case 1:
      this.emit('saturated', this);
  }

  if (onMessageQueued) onMessageQueued(message);
  this.emit('message', message);

  return discarded ? 0 : this.consumeNext();
};

Queue.prototype.evictFirst = function evictFirst(compareMessage) {
  const evict = this.get();
  if (!evict) return;
  evict.nack(false, false);
  return evict === compareMessage;
};

Queue.prototype.consumeNext = function consumeNext() {
  if (this[stoppedSymbol]) return;
  if (!this[pendingMessageCountSymbol]) return;
  const consumers = this[consumersSymbol];
  if (!consumers.length) return;

  const readyConsumers = consumers.filter((consumer) => consumer.ready);
  if (!readyConsumers.length) return 0;

  let consumed = 0;
  for (const consumer of readyConsumers) {
    const msgs = this.consumeMessages(consumer.capacity, consumer.options);
    if (!msgs.length) return consumed;
    consumer.push(msgs);
    consumed += msgs.length;
  }

  return consumed;
};

Queue.prototype.consume = function consume(onMessage, consumeOptions = {}, owner) {
  const consumers = this[consumersSymbol];

  if (this[exclusiveSymbol] && consumers.length) throw new Error(`Queue ${this.name} is exclusively consumed by ${consumers[0].consumerTag}`);
  else if (consumeOptions.exclusive && consumers.length) throw new Error(`Queue ${this.name} already has consumers and cannot be exclusively consumed`);

  const consumer = new Consumer(this, onMessage, consumeOptions, owner, new ConsumerEmitter(this));
  consumers.push(consumer);
  consumers.sort(sortByPriority);

  if (consumer.options.exclusive) {
    this[exclusiveSymbol] = consumer.options.exclusive;
  }

  this.emit('consume', consumer);

  const pendingMessages = this.consumeMessages(consumer.capacity, consumer.options);
  if (pendingMessages.length) consumer.push(pendingMessages);

  return consumer;
};

Queue.prototype.assertConsumer = function assertConsumer(onMessage, consumeOptions = {}, owner) {
  const consumers = this[consumersSymbol];
  if (!consumers.length) return this.consume(onMessage, consumeOptions, owner);
  for (const consumer of consumers) {
    if (consumer.onMessage !== onMessage) continue;

    if (consumeOptions.consumerTag && consumeOptions.consumerTag !== consumer.consumerTag) {
      continue;
    } else if ('exclusive' in consumeOptions && consumeOptions.exclusive !== consumer.options.exclusive) {
      continue;
    }

    return consumer;
  }
  return this.consume(onMessage, consumeOptions, owner);
};

Queue.prototype.get = function getMessage({noAck, consumerTag} = {}) {
  const message = this.consumeMessages(1, {noAck, consumerTag})[0];
  if (!message) return;
  if (noAck) this.dequeue(message);

  return message;
};

Queue.prototype.consumeMessages = function consumeMessages(n, consumeOptions) {
  if (this[stoppedSymbol] || !this[pendingMessageCountSymbol] || !n) return [];

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
    this[pendingMessageCountSymbol]--;
    msgs.push(message);
    if (!--n) break;
  }

  for (const expired of evict) this.nack(expired, false, false);

  return msgs;
};

Queue.prototype.ack = function ack(message, allUpTo) {
  this[onMessageConsumedSymbol](message, 'ack', allUpTo);
};

Queue.prototype.nack = function nack(message, allUpTo, requeue = true) {
  this[onMessageConsumedSymbol](message, 'nack', allUpTo, requeue);
};

Queue.prototype.reject = function reject(message, requeue = true) {
  this[onMessageConsumedSymbol](message, 'nack', false, requeue);
};

Queue.prototype[onMessageConsumedSymbol] = function onMessageConsumed(message, operation, allUpTo, requeue) {
  if (this[stoppedSymbol]) return;
  const pending = allUpTo && this.getPendingMessages(message);
  const {properties} = message;
  const {deadLetterExchange, deadLetterRoutingKey} = this.options;

  let deadLetter = false;
  switch (operation) {
    case 'ack': {
      if (!this.dequeue(message)) return;
      break;
    }
    case 'nack':
      if (requeue) {
        this.requeueMessage(message);
        break;
      }

      if (!this.dequeue(message)) return;
      deadLetter = !!deadLetterExchange;
      break;
  }

  let capacity;
  if (!this.messages.length) this.emit('depleted', this);
  else if ((capacity = this.getCapacity()) === 1) this.emit('ready', capacity);

  if (!pending || !pending.length) this.consumeNext();

  if (!requeue && properties.confirm) {
    this.emit('message.consumed.' + operation, {operation, message: {...message}});
  }

  if (deadLetter) {
    const deadMessage = new Message(message.fields, message.content, {...properties, expiration: undefined});
    if (deadLetterRoutingKey) deadMessage.fields.routingKey = deadLetterRoutingKey;

    this.emit('dead-letter', {
      deadLetterExchange,
      message: deadMessage
    });
  }

  if (pending && pending.length) {
    pending.forEach((msg) => msg[operation](false, requeue));
  }
};

Queue.prototype.ackAll = function ackAll() {
  this.getPendingMessages().forEach((msg) => msg.ack(false));
};

Queue.prototype.nackAll = function nackAll(requeue = true) {
  this.getPendingMessages().forEach((msg) => msg.nack(false, requeue));
};

Queue.prototype.getPendingMessages = function getPendingMessages(fromAndNotIncluding) {
  if (!fromAndNotIncluding) return this.messages.filter((msg) => msg.pending);

  const msgIdx = this.messages.indexOf(fromAndNotIncluding);
  if (msgIdx === -1) return [];

  return this.messages.slice(0, msgIdx).filter((msg) => msg.pending);
};

Queue.prototype.requeueMessage = function requeueMessage(message) {
  const msgIdx = this.messages.indexOf(message);
  if (msgIdx === -1) return;
  this[pendingMessageCountSymbol]++;
  this.messages.splice(msgIdx, 1, new Message({...message.fields, redelivered: true}, message.content, message.properties, this[onConsumedSymbol]));
};

Queue.prototype.peek = function peek(ignoreDelivered) {
  const message = this.messages[0];
  if (!message) return;

  if (!ignoreDelivered) return message;
  if (!message.pending) return message;

  for (let idx = 1; idx < this.messages.length; idx++) {
    if (!this.messages[idx].pending) {
      return this.messages[idx];
    }
  }
};

Queue.prototype.cancel = function cancel(consumerTag) {
  const consumers = this[consumersSymbol];
  const idx = consumers.findIndex((c) => c.consumerTag === consumerTag);
  if (idx === -1) return;

  return this.unbindConsumer(consumers[idx]);
};

Queue.prototype.dismiss = function dismiss(onMessage) {
  const consumers = this[consumersSymbol];
  const consumer = consumers.find((c) => c.onMessage === onMessage);
  if (!consumer) return;
  this.unbindConsumer(consumer);
};

Queue.prototype.unbindConsumer = function unbindConsumer(consumer) {
  const consumers = this[consumersSymbol];
  const idx = consumers.indexOf(consumer);
  if (idx === -1) return;

  consumers.splice(idx, 1);

  if (this[exclusiveSymbol]) {
    this[exclusiveSymbol] = false;
  }

  consumer.stop();

  if (this.options.autoDelete && !consumers.length) return this.delete();

  consumer.nackAll(true);
};

Queue.prototype.emit = function emit(eventName, content) {
  const eventEmitter = this[eventEmitterSymbol];
  if (!eventEmitter || !eventEmitter.emit) return;
  const routingKey = `queue.${eventName}`;
  eventEmitter.emit(routingKey, content);
};

Queue.prototype.on = function on(eventName, handler) {
  const eventEmitter = this[eventEmitterSymbol];
  if (!eventEmitter || !eventEmitter.on) return;
  const pattern = `queue.${eventName}`;
  return eventEmitter.on(pattern, handler);
};

Queue.prototype.off = function off(eventName, handler) {
  const eventEmitter = this[eventEmitterSymbol];
  if (!eventEmitter || !eventEmitter.off) return;
  const pattern = `queue.${eventName}`;
  return eventEmitter.off(pattern, handler);
};

Queue.prototype.purge = function purge() {
  const toDelete = this.messages.filter(({pending}) => !pending);
  this[pendingMessageCountSymbol] = 0;

  for (const msg of toDelete) {
    this.dequeue(msg);
  }

  if (!this.messages.length) this.emit('depleted', this);
  return toDelete.length;
};

Queue.prototype.dequeueMessage = function dequeueMessage(message) {
  if (message.pending) return this.nack(message, false, false);

  message.consume({});

  this.nack(message, false, false);
};

Queue.prototype.dequeue = function dequeue(message) {
  const msgIdx = this.messages.indexOf(message);
  if (msgIdx === -1) return false;

  this.messages.splice(msgIdx, 1);

  return true;
};

Queue.prototype.getState = function getState() {
  return {
    name: this.name,
    options: {...this.options},
    ...(this.messages.length ? {messages: JSON.parse(JSON.stringify(this.messages))} : undefined),
  };
};

Queue.prototype.recover = function recover(state) {
  this[stoppedSymbol] = false;
  const consumers = this[consumersSymbol];
  if (!state) {
    consumers.slice().forEach((c) => c.recover());
    return this.consumeNext();
  }

  this.name = state.name;

  this.messages.splice(0);

  let continueConsume;
  if (consumers.length) {
    consumers.forEach((c) => c.nackAll(false));
    continueConsume = true;
  }

  if (!state.messages) return this;

  state.messages.forEach(({fields, content, properties}) => {
    if (properties.persistent === false) return;
    const msg = new Message({...fields, redelivered: true}, content, properties, this[onConsumedSymbol]);
    this.messages.push(msg);
  });
  this[pendingMessageCountSymbol] = this.messages.length;
  consumers.forEach((c) => c.recover());
  if (continueConsume) {
    this.consumeNext();
  }

  return this;
};

Queue.prototype.delete = function deleteQueue({ifUnused, ifEmpty} = {}) {
  const consumers = this[consumersSymbol];
  if (ifUnused && consumers.length) return;
  if (ifEmpty && this.messages.length) return;

  const messageCount = this.messages.length;
  this.stop();

  const deleteConsumers = consumers.splice(0);
  deleteConsumers.forEach((consumer) => {
    consumer.cancel();
  });

  this.messages.splice(0);

  this.emit('delete', this);
  return {messageCount};
};

Queue.prototype.close = function close() {
  this[consumersSymbol].splice(0).forEach((consumer) => consumer.cancel());
  this[exclusiveSymbol] = false;
};

Queue.prototype.stop = function stop() {
  this[stoppedSymbol] = true;
  this[consumersSymbol].slice().forEach((consumer) => consumer.stop());
};

Queue.prototype.getCapacity = function getCapacity() {
  const maxLength = 'maxLength' in this.options ? this.options.maxLength : Infinity;
  return maxLength - this.messages.length;
};

function Consumer(queue, onMessage, options = {}, owner, eventEmitter) {
  if (typeof onMessage !== 'function') throw new Error('message callback is required and must be a function');

  if (!(this instanceof Consumer)) {
    return new Consumer(queue, onMessage, options, owner, eventEmitter);
  }

  this.options = {prefetch: 1, priority: 0, noAck: false, ...options};
  if (!this.options.consumerTag) this.options.consumerTag = 'smq.ctag-' + generateId();

  this[isReadySymbol] = true;
  this[stoppedSymbol] = false;
  this[consumingSymbol] = false;
  this.queue = queue;
  this.onMessage = onMessage;
  this.owner = owner;
  this[eventEmitterSymbol] = eventEmitter;

  const self = this;
  self[internalQueueSymbol] = new Queue(self.options.consumerTag + '-q', {
    autoDelete: false,
    maxLength: self.options.prefetch,
  }, {
    emit(eventName) {
      switch (eventName) {
        case 'queue.saturated': {
          self[isReadySymbol] = false;
          break;
        }
        case 'queue.depleted':
        case 'queue.ready':
          self[isReadySymbol] = true;
          break;
      }
    },
  });
}

Object.defineProperty(Consumer.prototype, 'consumerTag', {
  enumerable: true,
  get() {
    return this.options.consumerTag;
  },
});

Object.defineProperty(Consumer.prototype, 'ready', {
  enumerable: true,
  get() {
    return this[isReadySymbol] && !this[stoppedSymbol];
  },
});

Object.defineProperty(Consumer.prototype, 'stopped', {
  get() {
    return this[stoppedSymbol];
  },
});

Object.defineProperty(Consumer.prototype, 'capacity', {
  get() {
    return this[internalQueueSymbol].getCapacity();
  },
});

Object.defineProperty(Consumer.prototype, 'messageCount', {
  get() {
    return this[internalQueueSymbol].messageCount;
  },
});

Object.defineProperty(Consumer.prototype, 'queueName', {
  get() {
    return this.queue.name;
  },
});

Consumer.prototype.push = function push(messages) {
  const internalQueue = this[internalQueueSymbol];
  const options = this.options;
  messages.forEach((message) => {
    internalQueue.queueMessage(message.fields, message, message.properties, onMessageQueued);
  });
  if (!this[consumingSymbol]) {
    this.consume();
  }

  function onMessageQueued(msg) {
    const message = msg.content;
    message.consume(options, onConsumed);

    function onConsumed() {
      internalQueue.dequeueMessage(msg);
    }
  }
};

Consumer.prototype.consume = function consume() {
  if (this[stoppedSymbol]) return;
  this[consumingSymbol] = true;

  const msg = this[internalQueueSymbol].get();

  if (!msg) {
    this[consumingSymbol] = false;
    return;
  }

  msg.consume(this.options);
  const message = msg.content;
  message.consume(this.options, onConsumed);

  if (this.options.noAck) msg.content.ack();
  this.onMessage(msg.fields.routingKey, msg.content, this.owner);

  this[consumingSymbol] = false;

  return this.consume();

  function onConsumed() {
    msg.nack(false, false);
  }
};

Consumer.prototype.nackAll = function nackAll(requeue) {
  this[internalQueueSymbol].messages.slice().forEach((msg) => {
    msg.content.nack(false, requeue);
  });
};

Consumer.prototype.ackAll = function ackAll() {
  this[internalQueueSymbol].messages.slice().forEach((msg) => {
    msg.content.ack(false);
  });
};

Consumer.prototype.cancel = function cancel(requeue = true) {
  this.emit('cancel', this);
  this.nackAll(requeue);
};

Consumer.prototype.prefetch = function prefetch(value) {
  this.options.prefetch = this[internalQueueSymbol].options.maxLength = value;
};

Consumer.prototype.emit = function emit(eventName, content) {
  const routingKey = `consumer.${eventName}`;
  this[eventEmitterSymbol].emit(routingKey, content);
};

Consumer.prototype.on = function on(eventName, handler) {
  const pattern = `consumer.${eventName}`;
  return this[eventEmitterSymbol].on(pattern, handler);
};

Consumer.prototype.recover = function recover() {
  this[stoppedSymbol] = false;
};

Consumer.prototype.stop = function stop() {
  this[stoppedSymbol] = true;
};

function ConsumerEmitter(queue) {
  this.queue = queue;
}

ConsumerEmitter.prototype.on = function on(...args) {
  return this.queue.on(...args);
};

ConsumerEmitter.prototype.emit = function emit(eventName, content) {
  if (eventName === 'consumer.cancel') {
    this.queue.unbindConsumer(content);
  }
  this.queue.emit(eventName, content);
};
