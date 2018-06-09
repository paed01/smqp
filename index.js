export function Broker(source) {
  const exchanges = [];
  const queues = [];

  const broker = {
    assertExchange,
    close,
    deleteExchange,
    bindExchange,
    bindQueue,
    assertQueue,
    consume,
    createQueue,
    deleteQueue,
    getExchange,
    getQueue,
    getState,
    publish,
    purgeQueue,
    recover,
    resumeConsumption,
    sendToQueue,
    subscribe,
    subscribeTmp,
    unbindExchange,
    unbindQueue,
    unsubscribe,
  };

  Object.defineProperty(broker, 'exchangesCount', {
    enumerable: true,
    get: () => exchanges.length
  });

  Object.defineProperty(broker, 'queuesCount', {
    enumerable: true,
    get: () => queues.length
  });

  return broker;

  function assertExchange(exchangeName, type, options) {
    let exchange = getExchangeByName(exchangeName);
    if (exchange) {
      if (type && exchange.type !== type) throw new Error('Type doesn\'t match');
    } else {
      exchange = Exchange(exchangeName, type || 'topic', options);
      exchanges.push(exchange);
    }

    return exchange;
  }

  function getExchangeByName(exchangeName) {
    return exchanges.find((exchange) => exchange.name === exchangeName);
  }

  function bindQueue(queueName, exchangeName, pattern) {
    const exchange = getExchange(exchangeName);
    const queue = getQueue(queueName);
    exchange.bind(queue, pattern);
    queue.bind(exchangeName);
  }

  function unbindQueue(queueName, exchangeName, pattern) {
    const exchange = getExchange(exchangeName);
    if (!exchange) return;
    const queue = getQueue(queueName);
    if (!queue) return;
    queue.unbind(exchangeName);
    exchange.unbind(queue, pattern);
  }

  function consume(queueName, onMessage, options) {
    const queue = getQueue(queueName);
    return queue.addConsumer(onMessage, options);
  }

  function getExchange(exchangeName) {
    return exchanges.find(({name}) => name === exchangeName);
  }

  function deleteExchange(exchangeName, ifUnused) {
    const idx = exchanges.findIndex((exchange) => exchange.name === exchangeName);
    if (idx === -1) return;

    const exchange = exchanges[idx];

    if (ifUnused && exchange.queuesCount) return;
    exchanges.splice(idx, 1);
  }

  function close() {
    exchanges.forEach((e) => e.close());
    queues.forEach((q) => q.close());
  }

  function getState() {
    return {
      exchanges: getExchangeState(),
      queues: getQueuesState(),
    };

    function getExchangeState() {
      return exchanges.reduce((result, exchange) => {
        if (!exchange.options.durable) return result;
        if (!result) result = [];
        result.push(exchange.getState());
        return result;
      }, undefined);
    }
  }

  function recover(state) {
    if (!state) return;
    if (state.queues) state.queues.forEach(recoverQueue);
    if (state.exchanges) state.exchanges.forEach(recoverExchange);

    return broker;

    function recoverExchange(eState) {
      const exchange = assertExchange(eState.name, eState.type, eState.options);
      exchange.recover(eState);
    }

    function recoverQueue(qState) {
      const queue = assertQueue(qState.name, qState.options);
      queue.recover(qState);
    }
  }

  function bindExchange() {}
  function unbindExchange() {}

  function publish(exchangeName, routingKey, content, options) {
    const exchange = getExchangeByName(exchangeName);
    if (!exchange) return;
    return exchange.publish(routingKey, content, options);
  }

  function purgeQueue(queueName) {
    const queue = getQueue(queueName);
    if (!queue) return;
    return queue.purge();
  }

  function sendToQueue(queueName, routingKey, content, options) {
    const queue = getQueue(queueName);
    if (!queue) throw new Error(`Queue named ${queueName} doesn't exists`);
    return queue.queueMessage(routingKey, content, options);
  }

  function subscribeTmp(exchangeName, routingKey, onMessage, options = {}) {
    return subscribe(exchangeName, routingKey, generateId(), onMessage, {...options, durable: false});
  }

  function subscribe(exchangeName, pattern, queueName, onMessage, options = {durable: true}) {
    if (!exchangeName || !pattern || typeof onMessage !== 'function') throw new Error('exchange name, pattern, and onMessage are required');

    assertExchange(exchangeName);
    const queue = assertQueue(queueName, options);

    bindQueue(queueName, exchangeName, pattern);

    return queue.addConsumer(onMessage, options);
  }

  function unsubscribe(queueName, onMessage) {
    const queue = getQueue(queueName);
    if (!queue) return;
    queue.removeConsumer(onMessage);
    if (!queue.options.autoDelete) return true;
    if (!queue.consumersCount) deleteQueue(queueName);
    return true;
  }

  function getQueuesState() {
    return queues.reduce((result, queue) => {
      if (!queue.options.durable) return result;
      if (!result) result = [];
      result.push(queue.getState());
      return result;
    }, undefined);
  }

  function resumeConsumption() {
    queues.forEach((queue) => queue.resume());
  }

  function createQueue(queueName, options) {
    if (getQueue(queueName)) throw new Error(`Queue named ${queueName} already exists`);

    const queue = Queue(queueName, options);
    queues.push(queue);
    return queue;
  }

  function getQueue(queueName) {
    const idx = queues.findIndex((queue) => queue.name === queueName);
    if (idx > -1) return queues[idx];
  }

  function assertQueue(queueName, options = {}) {
    if (!queueName) return createQueue(generateId(), options);

    const queue = getQueue(queueName);
    options = {durable: true, ...options};
    if (!queue) return createQueue(queueName, options);

    if (queue.options.durable !== options.durable) throw new Error('Durable doesn\'t match');
    return queue;
  }

  function deleteQueue(queueName) {
    if (!queueName) return false;

    const idx = queues.findIndex((queue) => queue.name === queueName);
    if (idx > -1) queues.splice(idx, 1);

    return true;
  }

  function Exchange(exchangeName, type = 'topic', options = {}) {
    const boundQueues = [];
    options = Object.assign({durable: true, autoDelete: true}, options);

    const directQueue = Queue('messages-queue', {autoDelete: false});
    directQueue.addConsumer(direct);

    const exchange = {
      name: exchangeName,
      type,
      options,
      bind,
      close: closeExchange,
      getState: getExchangeState,
      publish: publishToQueues,
      recover: recoverExchange,
      unbind,
    };

    Object.defineProperty(exchange, 'queuesCount', {
      enumerable: true,
      get: () => boundQueues.length
    });

    Object.defineProperty(exchange, 'queues', {
      enumerable: true,
      get: () => boundQueues.slice()
    });

    return exchange;

    function publishToQueues(routingKey, content, msgOptions) {
      if (type === 'direct') return directQueue.queueMessage(routingKey, content, msgOptions);

      const deliverTo = boundQueues.reduce((result, {queue, testPattern}) => {
        if (testPattern(routingKey)) result.push(queue);
        return result;
      }, []);

      if (!deliverTo.length) return 0;

      deliverTo.forEach((queue) => queue.queueMessage(routingKey, content, msgOptions));
    }

    function direct(routingKey, message) {
      const deliverTo = boundQueues.reduce((result, bound) => {
        if (bound.testPattern(routingKey)) result.push(bound);
        return result;
      }, []);

      const first = deliverTo[0];
      if (!first) return 0;
      if (deliverTo.length > 1) shift(deliverTo[0]);

      first.queue.queueMessage(routingKey, message.content, message.options);
      message.ack();
    }

    function shift(bound) {
      const idx = boundQueues.indexOf(bound);
      boundQueues.splice(idx, 1);
      boundQueues.push(bound);
    }

    function bind(queue, pattern) {
      const bound = boundQueues.find((bq) => bq.queue === queue && bq.pattern === pattern);
      if (bound) return bound;

      const binding = BoundQueue(queue, pattern);
      boundQueues.push(binding);
      return binding;
    }

    function unbind(queue, pattern) {
      const idx = boundQueues.findIndex((bq) => bq.queue === queue && bq.pattern === pattern);
      if (idx === -1) return;
      boundQueues.splice(idx, 1);
      if (options.autoDelete) deleteExchange(exchangeName, true);
    }

    function closeExchange() {
      boundQueues.forEach((q) => q.close());
      directQueue.removeConsumer(direct, false);
      directQueue.close();
    }

    function getExchangeState() {
      return {
        name: exchangeName,
        type,
        options: Object.assign({}, options),
        bindings: getBoundState(),
        undelivered: getUndelivered(),
      };

      function getBoundState() {
        return boundQueues.reduce((result, bound) => {
          if (!bound.queue.options.durable) return;
          if (!result) result = [];
          result.push({
            pattern: bound.pattern,
            queueName: bound.queue.name,
          });
          return result;
        }, undefined);
      }

      function getUndelivered() {
        if (type !== 'direct') return;
        return directQueue.getState().messages;
      }
    }

    function recoverExchange(state) {
      recoverBindings();

      if (type === 'direct') {
        directQueue.recover({messages: state.undelivered});
      }

      return exchange;

      function recoverBindings() {
        if (!state.bindings) return;
        state.bindings.forEach((binding) => {
          const queue = getQueue(binding.queueName);
          if (!queue) return;
          bind(queue, binding.pattern);
        });
      }
    }

    function BoundQueue(queue, pattern) {
      const rPattern = getRPattern();
      return {
        id: `${queue.name}/${pattern}`,
        queue,
        pattern,
        close: closeBoundQueue,
        testPattern,
      };

      function testPattern(routingKey) {
        return rPattern.test(routingKey);
      }

      function closeBoundQueue() {
        queue.close();
      }

      function getRPattern() {
        const rpattern = pattern
          .replace('.', '\\.')
          .replace('*', '[^.]+?')
          .replace('#', '.+?');

        return new RegExp(`^${rpattern}$`);
      }
    }
  }

  function Queue(queueName, options = {}) {
    const messages = [], queueConsumers = [];
    let pendingResume, exclusive, exchangeName;
    options = Object.assign({autoDelete: true}, options);

    const queue = {
      name: queueName,
      options,
      addConsumer,
      bind,
      close: closeQueue,
      get,
      getState: getQueueState,
      nackAll,
      peek,
      purge,
      queueMessage,
      removeConsumer,
      recover: recoverQueue,
      unbind,
    };

    Object.defineProperty(queue, 'length', {
      enumerable: true,
      get: () => messages.length
    });

    Object.defineProperty(queue, 'consumersCount', {
      enumerable: true,
      get: () => queueConsumers.length
    });

    Object.defineProperty(queue, 'exchangeName', {
      enumerable: true,
      get: () => exchangeName
    });

    Object.defineProperty(queue, 'exclusive', {
      enumerable: true,
      get: () => exclusive
    });

    return queue;

    function bind(bindToExchange) {
      exchangeName = bindToExchange;
    }

    function addConsumer(onMessage, consumeOptions) {
      if (typeof onMessage !== 'function') throw new TypeError('Message callback is mandatory');
      let consumer = getConsumer(onMessage);
      if (consumer) return consumer;

      if (exclusive) throw new Error(`Queue ${queueName} is exclusively consumed`);
      if (consumeOptions && consumeOptions.exclusive) {
        if (queueConsumers.length) throw new Error(`Cannot exclusively subscribe to queue ${queueName} since it is already consumed`);
        exclusive = true;
      }

      consumer = Consumer(queueName, onMessage, consumeOptions);
      queueConsumers.push(consumer);
      queueConsumers.sort(sortByPriority);
      consumeNext();
      return consumer;
    }

    function removeConsumer(onMessage, requeue = true) {
      if (typeof onMessage !== 'function') throw new TypeError('Message callback is mandatory');
      const consumer = getConsumer(onMessage);
      unbind(consumer, requeue);
    }

    function getConsumer(onMessage) {
      return queueConsumers.find((consumer) => consumer.onMessage === onMessage);
    }

    function unbind(consumer, requeue) {
      if (!consumer) return;
      const idx = queueConsumers.indexOf(consumer);
      if (idx === -1) return;
      queueConsumers.splice(idx, 1);

      exclusive = false;

      const consumerMessages = messages.filter((message) => message.consumerTag === consumer.options.consumerTag);
      for (let i = 0; i < consumerMessages.length; i++) {
        consumerMessages[i].nack(null, !!requeue);
      }
    }

    function queueMessage(routingKey, content, msgOptions) {
      const message = createMessage(generateId(), routingKey, content, msgOptions, onConsumed);
      messages.push(message);
      return consumeNext();
    }

    function consumeNext() {
      if (!messages.length) return;
      const activeConsumers = queueConsumers.slice();

      let consumed = 0;
      const immediateAcks = [];
      for (const consumer of activeConsumers) {
        if (consumer.options.noAck) immediateAcks.push(consumer);
        consumed += consumer.consume(queue);
      }

      if (!consumed) return consumed;

      for (const consumer of immediateAcks) {
        consumer.ack();
      }

      return consumed;
    }

    function onConsumed(message, operation, allUpTo, requeue) {
      switch (operation) {
        case 'nack':
          if (!requeue) dequeue(message);
          break;
        default:
          dequeue(message);
          break;
      }

      consumeNext();
    }

    function get(prefetch = 1) {
      if (pendingResume) return [];
      if (!prefetch) return [];
      return getMessages(prefetch);
    }

    function getMessages(count) {
      const msgs = [];
      if (!count) return msgs;

      for (const msg of messages) {
        if (msg.pending) continue;
        msgs.push(msg);
        if (!--count) break;
      }

      return msgs;
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

    function nackAll(channel, requeue) {
      const channelMessages = messages.filter((message) => message.consumerTag === channel.consumerTag);
      channelMessages.forEach((message) => message.nack(null, requeue));
    }

    function purge() {
      queue.purging = true;
      return messages.splice(0).length;
    }

    function dequeue(message) {
      const msgIdx = messages.indexOf(message);
      if (msgIdx === -1) return;
      messages.splice(msgIdx, 1);
      return true;
    }

    function getQueueState() {
      const result = {
        name: queueName,
        options,
      };

      result.messages = messages.map((message) => {
        const {routingKey, messageId, content} = message;
        return {
          routingKey,
          messageId,
          content,
        };
      });

      return JSON.parse(JSON.stringify(result));
    }

    function recoverQueue(state) {
      if (!state) return;
      messages.splice(0);
      state.messages.forEach(({messageId, routingKey, content, options: msgOptions}) => {
        const msg = createMessage(messageId, routingKey, content, msgOptions, onConsumed);
        messages.push(msg);
      });
      consumeNext();
    }

    function closeQueue() {
      queueConsumers.splice(0).forEach((consumer) => consumer.close());
    }
  }

  function Consumer(queueName, onMessage, options) {
    const consumerOptions = Object.assign({consumerTag: generateId(), prefetch: 1, priority: 0}, options);
    const {consumerTag, prefetch, noAck, priority} = consumerOptions;
    const messages = [];

    const consumer = {
      consumerTag,
      noAck,
      prefetch,
      priority,
      queueName,
      messages,
      options: consumerOptions,
      ack,
      ackAll,
      close: closeConsumer,
      nack,
      onMessage,
      consume: getMessages,
      nackAll,
    };

    return consumer;

    function getMessages(queue) {
      if (messages.length >= prefetch) return 0;

      const newMessages = queue.get(prefetch - messages.length);
      if (!newMessages.length) return 0;

      messages.push(...newMessages);
      newMessages.forEach((message) => {
        message.pendingAck(consumerTag, onDequeued);
      });

      newMessages.forEach((message) => {
        onMessage(message.routingKey, message, source);
      });

      return newMessages.length;
    }

    function nackAll(requeue) {
      if (!messages.length) return;
      messages.slice().forEach((message) => message.nack(false, requeue));
    }

    function ackAll() {
      if (!messages.length) return;
      messages.slice().forEach((message) => message.ack());
    }

    function ack(allUpTo) {
      if (!messages.length) return;
      messages[0].ack(allUpTo);
    }

    function nack(allUpTo, requeue) {
      if (!messages.length) return;
      messages[0].nack(allUpTo, requeue);
    }

    function onDequeued(message) {
      const idx = messages.indexOf(message);
      if (idx === -1) return;
      messages.splice(idx, 1);
      return true;
    }

    function closeConsumer() {
      unsubscribe(consumer.queueName, onMessage);
      nackAll(true);
      consumer.queueName = undefined;
    }
  }

  function sortByPriority(a, b) {
    return b.options.priority - a.options.priority;
  }

  function createMessage(messageId, routingKey, content = {}, msgOptions = {}, onConsumed) {
    let pending = false, consumerTag, consumerCallback;

    const envelope = {
      options: {...msgOptions},
      messageId,
      routingKey,
      pendingAck,
      ack,
      nack,
      reject,
    };

    Object.defineProperty(envelope, 'pending', {
      enumerable: true,
      get: () => pending
    });

    Object.defineProperty(envelope, 'consumerTag', {
      enumerable: true,
      get: () => consumerTag
    });

    if (content) envelope.content = {...content};

    return envelope;

    function pendingAck(consumedByTag, ackCallback) {
      pending = true;
      consumerTag = consumedByTag;
      consumerCallback = ackCallback;
    }

    function reject(requeue) {
      if (!pending) return;
      pending = false;
      consumerTag = undefined;
      consumed('reject', null, requeue);
    }

    function ack(allUpTo) {
      if (!pending) return;
      pending = false;
      consumerTag = undefined;
      consumed('ack', allUpTo);
    }

    function nack(allUpTo, requeue) {
      if (!pending) return;
      pending = false;
      consumerTag = undefined;
      consumed('nack', allUpTo, requeue);
    }

    function consumed(operation, allUpTo, requeue) {
      [consumerCallback, onConsumed].forEach((fn) => {
        if (!fn) return;
        fn(envelope, operation, allUpTo, requeue);
      });
    }
  }
}

function generateId() {
  const min = 110000;
  const max = 9999999;
  const rand = Math.floor(Math.random() * (max - min)) + min;

  return rand.toString(16);
}
