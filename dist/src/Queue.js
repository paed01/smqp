"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Queue = Queue;
exports.Consumer = Consumer;

var _shared = require("./shared");

var _Message = require("./Message");

function Queue(name, options = {}, eventEmitter) {
  if (!name) name = `smq.qname-${(0, _shared.generateId)()}`;
  const messages = [],
        consumers = [];
  let exclusivelyConsumed,
      stopped,
      pendingMessageCount = 0;
  options = {
    autoDelete: true,
    ...options
  };
  let maxLength = 'maxLength' in options ? options.maxLength : Infinity;
  const messageTtl = options.messageTtl;
  const {
    deadLetterExchange,
    deadLetterRoutingKey
  } = options;
  const queue = {
    name,
    options,
    messages,
    ack,
    ackAll,
    assertConsumer,
    cancel,
    close,
    consume,
    delete: deleteQueue,
    dequeueMessage,
    dismiss,
    get,
    getState,
    nack,
    nackAll,
    off,
    on,
    peek,
    purge,
    queueMessage,
    recover,
    reject,
    stop,
    unbindConsumer
  };
  Object.defineProperty(queue, 'messageCount', {
    enumerable: true,

    get() {
      return messages.length;
    }

  });
  Object.defineProperty(queue, 'consumers', {
    get() {
      return consumers.slice();
    }

  });
  Object.defineProperty(queue, 'consumerCount', {
    get() {
      return consumers.length;
    }

  });
  Object.defineProperty(queue, 'stopped', {
    get() {
      return stopped;
    }

  });
  Object.defineProperty(queue, 'exclusive', {
    get() {
      return exclusivelyConsumed;
    }

  });
  Object.defineProperty(queue, 'maxLength', {
    set(value) {
      maxLength = options.maxLength = value;
    },

    get() {
      return maxLength;
    }

  });
  Object.defineProperty(queue, 'capacity', {
    get: getCapacity
  });
  return queue;

  function queueMessage(fields, content, properties, onMessageQueued) {
    if (stopped) return;
    const messageProperties = { ...properties
    };
    if (messageTtl) messageProperties.expiration = messageProperties.expiration || messageTtl;
    const message = (0, _Message.Message)(fields, content, messageProperties, onMessageConsumed);
    const capacity = getCapacity();
    messages.push(message);
    pendingMessageCount++;
    let discarded;

    switch (capacity) {
      case 0:
        discarded = evictOld();

      case 1:
        emit('saturated');
    }

    if (onMessageQueued) onMessageQueued(message);
    emit('message', message);
    return discarded ? 0 : consumeNext();

    function evictOld() {
      const evict = get();
      if (!evict) return;
      evict.nack(false, false);
      return evict === message;
    }
  }

  function consumeNext() {
    if (stopped) return;
    if (!pendingMessageCount) return;
    if (!consumers.length) return;
    const readyConsumers = consumers.filter(consumer => consumer.ready);
    if (!readyConsumers.length) return 0;
    let consumed = 0;

    for (const consumer of readyConsumers) {
      const msgs = consumeMessages(consumer.capacity, consumer.options);
      if (!msgs.length) return consumed;
      consumer.push(msgs);
      consumed += msgs.length;
    }

    return consumed;
  }

  function consume(onMessage, consumeOptions = {}, owner) {
    if (exclusivelyConsumed && consumers.length) throw new Error(`Queue ${name} is exclusively consumed by ${consumers[0].consumerTag}`);else if (consumeOptions.exclusive && consumers.length) throw new Error(`Queue ${name} already has consumers and cannot be exclusively consumed`);
    const consumer = Consumer(queue, onMessage, consumeOptions, owner, consumerEmitter());
    consumers.push(consumer);
    consumers.sort(_shared.sortByPriority);
    exclusivelyConsumed = consumer.options.exclusive;
    emit('consume', consumer);
    const pendingMessages = consumeMessages(consumer.capacity, consumer.options);
    if (pendingMessages.length) consumer.push(pendingMessages);
    return consumer;

    function consumerEmitter() {
      return {
        emit: onConsumerEmit,
        on
      };

      function onConsumerEmit(eventName, ...args) {
        if (eventName === 'consumer.cancel') {
          unbindConsumer(consumer);
        }

        emit(eventName, ...args);
      }
    }
  }

  function assertConsumer(onMessage, consumeOptions = {}, owner) {
    if (!consumers.length) return consume(onMessage, consumeOptions, owner);

    for (const consumer of consumers) {
      if (consumer.onMessage !== onMessage) continue;

      if (consumeOptions.consumerTag && consumeOptions.consumerTag !== consumer.consumerTag) {
        continue;
      } else if ('exclusive' in consumeOptions && consumeOptions.exclusive !== consumer.options.exclusive) {
        continue;
      }

      return consumer;
    }

    return consume(onMessage, consumeOptions, owner);
  }

  function get({
    noAck,
    consumerTag
  } = {}) {
    const message = consumeMessages(1, {
      noAck,
      consumerTag
    })[0];
    if (!message) return;
    if (noAck) dequeue(message);
    return message;
  }

  function consumeMessages(n, consumeOptions) {
    if (stopped || !pendingMessageCount || !n) return [];
    const now = Date.now();
    const msgs = [];
    const evict = [];

    for (const message of messages) {
      if (message.pending) continue;

      if (message.ttl && message.ttl < now) {
        evict.push(message);
        continue;
      }

      message.consume(consumeOptions);
      pendingMessageCount--;
      msgs.push(message);
      if (! --n) break;
    }

    for (const expired of evict) nack(expired, false, false);

    return msgs;
  }

  function ack(message, allUpTo) {
    onMessageConsumed(message, 'ack', allUpTo);
  }

  function nack(message, allUpTo, requeue = true) {
    onMessageConsumed(message, 'nack', allUpTo, requeue);
  }

  function reject(message, requeue = true) {
    onMessageConsumed(message, 'nack', false, requeue);
  }

  function onMessageConsumed(message, operation, allUpTo, requeue) {
    if (stopped) return;
    const pending = allUpTo && getPendingMessages(message);
    const {
      properties
    } = message;
    let deadLetter = false;

    switch (operation) {
      case 'ack':
        {
          if (!dequeue(message)) return;
          break;
        }

      case 'nack':
        if (requeue) {
          requeueMessage(message);
          break;
        }

        if (!dequeue(message)) return;
        deadLetter = !!deadLetterExchange;
        break;
    }

    let capacity;
    if (!messages.length) emit('depleted', queue);else if ((capacity = getCapacity()) === 1) emit('ready', capacity);
    if (!pending || !pending.length) consumeNext();

    if (!requeue && properties.confirm) {
      emit('message.consumed.' + operation, {
        operation,
        message: { ...message
        }
      });
    }

    if (deadLetter) {
      const deadMessage = (0, _Message.Message)(message.fields, message.content, { ...properties,
        expiration: undefined
      });
      if (deadLetterRoutingKey) deadMessage.fields.routingKey = deadLetterRoutingKey;
      emit('dead-letter', {
        deadLetterExchange,
        message: deadMessage
      });
    }

    if (pending && pending.length) {
      pending.forEach(msg => msg[operation](false, requeue));
    }
  }

  function ackAll() {
    getPendingMessages().forEach(msg => msg.ack(false));
  }

  function nackAll(requeue = true) {
    getPendingMessages().forEach(msg => msg.nack(false, requeue));
  }

  function getPendingMessages(fromAndNotIncluding) {
    if (!fromAndNotIncluding) return messages.filter(msg => msg.pending);
    const msgIdx = messages.indexOf(fromAndNotIncluding);
    if (msgIdx === -1) return [];
    return messages.slice(0, msgIdx).filter(msg => msg.pending);
  }

  function requeueMessage(message) {
    const msgIdx = messages.indexOf(message);
    if (msgIdx === -1) return;
    pendingMessageCount++;
    messages.splice(msgIdx, 1, (0, _Message.Message)({ ...message.fields,
      redelivered: true
    }, message.content, message.properties, onMessageConsumed));
  }

  function peek(ignoreDelivered) {
    const message = messages[0];
    if (!message) return;
    if (!ignoreDelivered) return message;
    if (!message.pending) return message;

    for (let idx = 1; idx < messages.length; idx++) {
      if (!messages[idx].pending) {
        return messages[idx];
      }
    }
  }

  function cancel(consumerTag) {
    const idx = consumers.findIndex(c => c.consumerTag === consumerTag);
    if (idx === -1) return;
    return unbindConsumer(consumers[idx]);
  }

  function dismiss(onMessage) {
    const consumer = consumers.find(c => c.onMessage === onMessage);
    if (!consumer) return;
    unbindConsumer(consumer);
  }

  function unbindConsumer(consumer) {
    const idx = consumers.indexOf(consumer);
    if (idx === -1) return;
    consumers.splice(idx, 1);

    if (exclusivelyConsumed) {
      exclusivelyConsumed = false;
    }

    consumer.stop();
    if (options.autoDelete && !consumers.length) return deleteQueue();
    consumer.nackAll(true);
  }

  function emit(eventName, content) {
    if (!eventEmitter || !eventEmitter.emit) return;
    const routingKey = `queue.${eventName}`;
    eventEmitter.emit(routingKey, content);
  }

  function on(eventName, handler) {
    if (!eventEmitter || !eventEmitter.on) return;
    const pattern = `queue.${eventName}`;
    return eventEmitter.on(pattern, handler);
  }

  function off(eventName, handler) {
    if (!eventEmitter || !eventEmitter.off) return;
    const pattern = `queue.${eventName}`;
    return eventEmitter.off(pattern, handler);
  }

  function purge() {
    const toDelete = messages.filter(({
      pending
    }) => !pending);
    pendingMessageCount = 0;
    toDelete.forEach(dequeue);
    if (!messages.length) emit('depleted', queue);
    return toDelete.length;
  }

  function dequeueMessage(message) {
    if (message.pending) return nack(message, false, false);
    message.consume({});
    nack(message, false, false);
  }

  function dequeue(message) {
    const msgIdx = messages.indexOf(message);
    if (msgIdx === -1) return;
    messages.splice(msgIdx, 1);
    return true;
  }

  function getState() {
    return JSON.parse(JSON.stringify(queue));
  }

  function recover(state) {
    stopped = false;
    if (!state) return consumeNext();
    name = queue.name = state.name;
    messages.splice(0);
    let continueConsume;

    if (consumers.length) {
      consumers.forEach(c => c.nackAll(false));
      continueConsume = true;
    }

    state.messages.forEach(({
      fields,
      content,
      properties
    }) => {
      if (properties.persistent === false) return;
      const msg = (0, _Message.Message)({ ...fields,
        redelivered: true
      }, content, properties, onMessageConsumed);
      messages.push(msg);
    });
    pendingMessageCount = messages.length;
    consumers.forEach(c => c.recover());

    if (continueConsume) {
      consumeNext();
    }
  }

  function deleteQueue({
    ifUnused,
    ifEmpty
  } = {}) {
    if (ifUnused && consumers.length) return;
    if (ifEmpty && messages.length) return;
    const messageCount = messages.length;
    queue.stop();
    const deleteConsumers = consumers.splice(0);
    deleteConsumers.forEach(consumer => {
      consumer.cancel();
    });
    if (deadLetterExchange) nackAll(false);else messages.splice(0);
    emit('delete', queue);
    return {
      messageCount
    };
  }

  function close() {
    consumers.splice(0).forEach(consumer => consumer.cancel());
    exclusivelyConsumed = false;
  }

  function stop() {
    stopped = true;
  }

  function getCapacity() {
    return maxLength - messages.length;
  }
}

function Consumer(queue, onMessage, options = {}, owner, eventEmitter) {
  if (typeof onMessage !== 'function') throw new Error('message callback is required and must be a function');
  options = {
    prefetch: 1,
    priority: 0,
    noAck: false,
    ...options
  };
  if (!options.consumerTag) options.consumerTag = `smq.ctag-${(0, _shared.generateId)()}`;
  let ready = true,
      stopped = false,
      consuming;
  const internalQueue = Queue(`${options.consumerTag}-q`, {
    maxLength: options.prefetch
  }, {
    emit: onInternalQueueEvent
  });
  const consumer = {
    queue,
    options,
    on,
    onMessage,
    ackAll,
    cancel,
    nackAll,
    prefetch,
    push,
    recover,
    stop
  };
  Object.defineProperty(consumer, 'consumerTag', {
    value: options.consumerTag
  });
  Object.defineProperty(consumer, 'messageCount', {
    get: () => internalQueue.messageCount
  });
  Object.defineProperty(consumer, 'capacity', {
    get: () => internalQueue.capacity
  });
  Object.defineProperty(consumer, 'queueName', {
    get: () => queue.name
  });
  Object.defineProperty(consumer, 'ready', {
    get: () => ready && !stopped
  });
  Object.defineProperty(consumer, 'stopped', {
    get: () => stopped
  });
  return consumer;

  function push(messages) {
    messages.forEach(message => {
      internalQueue.queueMessage(message.fields, message, message.properties, onInternalMessageQueued);
    });

    if (!consuming) {
      consume();
    }
  }

  function onInternalMessageQueued(msg) {
    const message = msg.content;
    message.consume(options, onConsumed);

    function onConsumed() {
      internalQueue.dequeueMessage(msg);
    }
  }

  function consume() {
    if (stopped) return;
    consuming = true;
    const msg = internalQueue.get();

    if (!msg) {
      consuming = false;
      return;
    }

    msg.consume(options);
    const message = msg.content;
    message.consume(options, onConsumed);
    if (options.noAck) msg.content.ack();
    onMessage(msg.fields.routingKey, msg.content, owner);
    consuming = false;
    return consume();

    function onConsumed() {
      msg.nack(false, false);
    }
  }

  function onInternalQueueEvent(eventName) {
    switch (eventName) {
      case 'queue.saturated':
        {
          ready = false;
          break;
        }

      case 'queue.depleted':
      case 'queue.ready':
        ready = true;
        break;
    }
  }

  function nackAll(requeue) {
    internalQueue.messages.slice().forEach(msg => {
      msg.content.nack(false, requeue);
    });
  }

  function ackAll() {
    internalQueue.messages.slice().forEach(msg => {
      msg.content.ack(false);
    });
  }

  function cancel(requeue = true) {
    emit('cancel', consumer);
    nackAll(requeue);
  }

  function prefetch(value) {
    options.prefetch = internalQueue.maxLength = value;
  }

  function emit(eventName, content) {
    const routingKey = `consumer.${eventName}`;
    eventEmitter.emit(routingKey, content);
  }

  function on(eventName, handler) {
    const pattern = `consumer.${eventName}`;
    return eventEmitter.on(pattern, handler);
  }

  function recover() {
    stopped = false;
  }

  function stop() {
    stopped = true;
  }
}