import {generateId, sortByPriority} from './shared';
import {Message} from './Message';

export {Queue, Consumer};

function Queue(name, options = {}, eventEmitter) {
  if (!name) name = `smq.qname-${generateId()}`;

  const messages = [], consumers = [];
  let exclusivelyConsumed, stopped, deadLetterPattern;
  options = Object.assign({autoDelete: true}, options);

  const {deadLetterExchange, deadLetterRoutingKey} = options;

  const queue = {
    name,
    options,
    messages,
    ack,
    ackAll,
    cancel,
    close,
    consume,
    delete: deleteQueue,
    dismiss,
    get,
    getState,
    nack,
    nackAll,
    on,
    peek,
    purge,
    queueMessage,
    reject,
    unbindConsumer,
    recover: recoverQueue,
    stop,
  };

  Object.defineProperty(queue, 'messageCount', {
    enumerable: true,
    get: () => messages.length
  });

  Object.defineProperty(queue, 'consumerCount', {
    get: () => consumers.length
  });

  Object.defineProperty(queue, 'stopped', {
    get: () => stopped
  });

  return queue;

  function queueMessage(fields, content, properties, onMessageQueued) {
    if (stopped) return;
    const maxLength = 'maxLength' in options ? options.maxLength : -1;
    const message = Message(fields, content, properties, onMessageConsumed);

    const capacity = getCapacity();
    messages.push(message);

    switch (capacity) {
      case 0:
        evictOld();
      case 1:
        emit('saturated');
    }

    if (onMessageQueued) onMessageQueued(message);

    emit('message', message);

    return consumeNext();

    function getCapacity() {
      if (maxLength === -1) return 2;
      return maxLength - messages.length;
    }

    function evictOld() {
      const evict = get();
      if (evict) evict.nack(false, false);
    }
  }

  function consumeNext() {
    if (stopped) return;
    if (!messages.length) return;
    if (!consumers.length) return;

    const readyConsumers = consumers.filter((consumer) => consumer.ready);
    if (!readyConsumers.length) return 0;

    let consumed = 0;
    for (const consumer of readyConsumers) {
      const msgs = consumeMessages(consumer.options);
      consumer.push(msgs);
      consumed += msgs.length;
    }

    return consumed;
  }

  function consume(onMessage, consumeOptions, owner) {
    if (exclusivelyConsumed && consumers.length) throw new Error(`Queue ${name} is exclusively consumed by ${consumers[0].consumerTag}`);

    const consumer = Consumer(queue, onMessage, consumeOptions, owner, consumerEmitter());
    consumers.push(consumer);
    consumers.sort(sortByPriority);

    exclusivelyConsumed = consumer.options.exclusive;

    emit('consume', consumer);

    const pendingMessages = consumeMessages(consumer.options);
    consumer.push(pendingMessages);

    return consumer;

    function consumerEmitter() {
      return {
        emit: onConsumerEmit,
        on: onConsumer,
      };

      function onConsumerEmit(eventName, ...args) {
        if (eventName === 'consumer.cancel') {
          unbindConsumer(consumer);
        }
        emit(eventName, ...args);
      }

      function onConsumer(...args) {
        if (eventEmitter && eventEmitter.on) return;
        eventEmitter.on(...args);
      }
    }
  }

  function dismiss(onMessage) {
    const idx = consumers.findIndex((c) => c.onMessage === onMessage);
    if (idx === -1) return;

    const [consumer] = consumers.splice(idx, 1);
    if (options.autoDelete && !consumers.length) return deleteQueue();

    consumer.stop();

    consumer.nackAll(true);
  }

  function cancel(consumerTag) {
    const idx = consumers.findIndex((c) => c.consumerTag === consumerTag);
    if (idx === -1) return;

    const [consumer] = consumers.splice(idx, 1);
    if (options.autoDelete && !consumers.length) return deleteQueue();

    consumer.stop();

    consumer.nackAll(true);
  }

  function get(consumeOptions = {}) {
    const message = consumeMessages({...consumeOptions, prefetch: 1})[0];
    if (!message) return;
    return message;
  }

  function consumeMessages(consumeOptions = {}) {
    if (stopped) return [];

    let prefetch = 'prefetch' in consumeOptions ? consumeOptions.prefetch : 1;
    if (!prefetch) return [];

    const msgs = [];
    if (!prefetch) return msgs;

    for (const message of messages) {
      if (message.pending) continue;
      message.consume(consumeOptions);
      msgs.push(message);
      if (!--prefetch) break;
    }

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
    let deadLetter = false;

    switch (operation) {
      case 'ack': {
        if (!dequeue(message, allUpTo)) return;
        break;
      }
      case 'nack':
        if (requeue) {
          requeueMessage(message);
          break;
        }

        if (!dequeue(message, allUpTo)) return;
        deadLetter = deadLetterExchange && (!deadLetterPattern || deadLetterPattern.test(message.fields.routingKey));
        break;
    }

    if (!messages.length) emit('depleted', queue);
    else consumeNext();

    if (!deadLetter) return;

    const deadMessage = Message(message.fields, message.content, message.properties);
    if (deadLetterRoutingKey) deadMessage.fields.routingKey = deadLetterRoutingKey;

    emit('dead-letter', {
      deadLetterExchange,
      message: deadMessage
    });
  }

  function ackAll() {
    const pending = messages.filter((msg) => msg.pending);
    pending.forEach((msg) => msg.ack(false));
  }

  function nackAll(requeue = true) {
    const pending = messages.filter((msg) => msg.pending);
    pending.forEach((msg) => msg.nack(false, requeue));
  }

  function requeueMessage(message) {
    const msgIdx = messages.indexOf(message);
    if (msgIdx === -1) return;

    messages.splice(msgIdx, 1, Message({...message.fields, redelivered: true}, message.content, message.properties, onMessageConsumed));
  }

  function peek(ignorePendingAck) {
    const message = messages[0];
    if (!message) return;

    if (!ignorePendingAck) return message;
    if (!message.pending) return message;

    for (let idx = 1; idx < messages.length; idx++) {
      if (!messages[idx].pending) {
        return messages[idx];
      }
    }
  }

  // function unbind(consumer, requeue) {
  //   if (!consumer) return;

  //   const idx = consumers.indexOf(consumer);
  //   if (idx === -1) return;
  //   consumers.splice(idx, 1);

  //   exclusive = false;

  //   const consumerMessages = messages.filter((message) => message.consumerTag === consumer.consumerTag);
  //   for (let i = 0; i < consumerMessages.length; i++) {
  //     consumerMessages[i].unsetConsumer();
  //     nack(consumerMessages[i], requeue);
  //   }
  // }

  // function bindConsumer(consumer) {
  //   if (exclusive) throw new Error(`Queue ${name} is exclusively consumed by ${consumers[0].consumerTag}`);
  //   if (consumer.options.exclusive) {
  //     if (consumers.length) throw new Error(`Cannot exclusively subscribe to queue ${name} since it is already consumed`);
  //     exclusive = true;
  //   }

  //   consumer.on('cancel', () => {
  //     unbindConsumer(consumer);
  //   });

  //   consumers.push(consumer);
  // }

  function unbindConsumer(consumer) {
    const idx = consumers.indexOf(consumer);
    if (idx === -1) return;

    consumers.splice(idx, 1);

    if (exclusivelyConsumed) {
      exclusivelyConsumed = false;
    }

    if (options.autoDelete && !consumers.length) {
      deleteQueue();
    }
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

  function purge() {
    const toNack = messages.splice(0);
    emit('depleted');
    return toNack.length;
  }

  function dequeue(message, allUpTo) {
    const msgIdx = messages.indexOf(message);
    if (msgIdx === -1) return;

    if (allUpTo) {
      messages.splice(0, msgIdx + 1);
    } else {
      messages.splice(msgIdx, 1);
    }

    return true;
  }

  function getState() {
    return JSON.parse(JSON.stringify(queue));
  }

  function recoverQueue(state) {
    stopped = false;
    if (!state) return;

    name = queue.name = state.name;
    messages.splice(0);
    state.messages.forEach(({fields, content, properties}) => {
      const msg = Message(fields, content, properties, onMessageConsumed);
      messages.push(msg);
    });
  }

  function deleteQueue({ifUnused, ifEmpty} = {}) {
    if (ifUnused && consumers.length) return;
    if (ifEmpty && messages.length) return;

    const messageCount = messages.length;
    queue.stop();

    const deleteConsumers = consumers.splice(0);
    deleteConsumers.forEach((consumer) => {
      consumer.cancel();
    });

    if (deadLetterExchange) nackAll(false);
    else messages.splice(0);

    emit('delete', queue);
    return {messageCount};
  }

  function close() {
    consumers.splice(0).forEach((consumer) => consumer.cancel());
    exclusivelyConsumed = false;
  }

  function stop() {
    stopped = true;
  }
}

function Consumer(queue, onMessage, options = {}, owner, eventEmitter) {
  options = Object.assign({prefetch: 1, priority: 0, noAck: false}, options);
  if (!options.consumerTag) options.consumerTag = `smq.ctag-${generateId()}`;

  let ready = true, stopped = false;
  const internalQueue = Queue(`${options.consumerTag}-q`, {maxLength: options.prefetch}, {emit: onInternalQueueEvent});

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
    stop,
  };

  Object.defineProperty(consumer, 'consumerTag', {
    value: options.consumerTag
  });

  Object.defineProperty(consumer, 'messageCount', {
    get: () => internalQueue.messageCount
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
    messages.forEach((message) => {
      internalQueue.queueMessage(message.fields, message, message.properties, onInternalMessageQueued);
    });
  }

  function onInternalQueueEvent(eventName, msg) {
    switch (eventName) {
      case 'queue.message': {
        if (options.noAck) msg.content.ack();
        onMessage(msg.fields.routingKey, msg.content, owner);
        break;
      }
      case 'queue.saturated': {
        ready = false;
        break;
      }
      case 'queue.depleted': {
        ready = true;
        break;
      }
    }
  }

  function onInternalMessageQueued(msg) {
    const message = msg.content;
    msg.consume(options);
    message.consume(options, onConsumed);

    function onConsumed() {
      msg.nack(false, false);
    }
  }

  function nackAll(requeue) {
    internalQueue.messages.slice().forEach((msg) => {
      msg.content.nack(false, requeue);
    });
  }

  function ackAll() {
    internalQueue.messages.slice().forEach((msg) => {
      msg.content.ack(false);
    });
  }

  function cancel(requeue = true) {
    nackAll(requeue);
    emit('cancel', consumer);
  }

  function prefetch(value) {
    const val = parseInt(value);
    if (!val) {
      prefetch = 1;
      return;
    }
    prefetch = val;
    return prefetch;
  }

  function emit(eventName, content) {
    if (!eventEmitter) return;
    const routingKey = `consumer.${eventName}`;
    eventEmitter.emit(routingKey, content);
  }

  function on(eventName, handler) {
    if (!eventEmitter) return;
    const pattern = `consumer.${eventName}`;
    return eventEmitter.on(pattern, handler);
  }

  function stop() {
    stopped = true;
  }
}

