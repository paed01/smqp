'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Broker = Broker;
function Broker(source) {
  const exchanges = [];
  const queues = [];

  const broker = {
    subscribe,
    subscribeOnce,
    subscribeTmp,
    unsubscribe,
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
    sendToQueue,
    stop,
    unbindExchange,
    unbindQueue
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

  function subscribe(exchangeName, pattern, queueName, onMessage, options = { durable: true }) {
    if (!exchangeName || !pattern || typeof onMessage !== 'function') throw new Error('exchange name, pattern, and message callback are required');

    assertExchange(exchangeName);
    const queue = assertQueue(queueName, options);

    bindQueue(queueName, exchangeName, pattern, options);

    return queue.addConsumer(onMessage, options);
  }

  function subscribeTmp(exchangeName, routingKey, onMessage, options = {}) {
    return subscribe(exchangeName, routingKey, generateId(), onMessage, { ...options, durable: false });
  }

  function subscribeOnce(exchangeName, routingKey, onMessage) {
    if (typeof onMessage !== 'function') throw new Error('message callback is required');

    const onceQueueName = generateId();
    const onceConsumer = subscribe(exchangeName, routingKey, onceQueueName, wrappedOnMessage, { durable: false, noAck: true });
    return onceConsumer;

    function wrappedOnMessage(...args) {
      unsubscribe(onceQueueName, wrappedOnMessage);
      onMessage(...args);
    }
  }

  function unsubscribe(queueName, onMessage) {
    const queue = getQueue(queueName);
    if (!queue) return;
    queue.removeConsumer(onMessage);
    if (!queue.options.autoDelete) return true;
    if (!queue.consumersCount) deleteQueue(queueName);
    return true;
  }

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
    return exchanges.find(exchange => exchange.name === exchangeName);
  }

  function bindQueue(queueName, exchangeName, pattern, bindOptions) {
    const exchange = getExchange(exchangeName);
    const queue = getQueue(queueName);
    exchange.bind(queue, pattern, bindOptions);
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
    return exchanges.find(({ name }) => name === exchangeName);
  }

  function deleteExchange(exchangeName, ifUnused) {
    const idx = exchanges.findIndex(exchange => exchange.name === exchangeName);
    if (idx === -1) return;

    const exchange = exchanges[idx];

    if (ifUnused && exchange.queuesCount) return;
    exchanges.splice(idx, 1);
  }

  function stop() {
    exchanges.forEach(exchange => exchange.stop());
    queues.forEach(queue => queue.stop());
  }

  function close() {
    exchanges.forEach(e => e.close());
    queues.forEach(q => q.close());
  }

  function getState() {
    return {
      exchanges: getExchangeState(),
      queues: getQueuesState()
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
    if (!state) {
      queues.forEach(queue => queue.recover());
      exchanges.forEach(exchange => exchange.recover());
      return;
    }

    if (state.queues) state.queues.forEach(recoverQueue);
    queues.forEach(queue => queue.stopped && queue.recover());

    if (state.exchanges) state.exchanges.forEach(recoverExchange);
    exchanges.forEach(exchange => exchange.stopped && exchange.recover());

    return broker;

    function recoverQueue(qState) {
      const queue = assertQueue(qState.name, qState.options);
      queue.recover(qState);
    }

    function recoverExchange(eState) {
      const exchange = assertExchange(eState.name, eState.type, eState.options);
      exchange.recover(eState);
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

  function getQueuesState() {
    return queues.reduce((result, queue) => {
      if (!queue.options.durable) return result;
      if (!result) result = [];
      result.push(queue.getState());
      return result;
    }, undefined);
  }

  function createQueue(queueName, options) {
    if (getQueue(queueName)) throw new Error(`Queue named ${queueName} already exists`);

    const queue = Queue(queueName, options);
    queues.push(queue);
    return queue;
  }

  function getQueue(queueName) {
    const idx = queues.findIndex(queue => queue.name === queueName);
    if (idx > -1) return queues[idx];
  }

  function assertQueue(queueName, options = {}) {
    if (!queueName) return createQueue(generateId(), options);

    const queue = getQueue(queueName);
    options = { durable: true, ...options };
    if (!queue) return createQueue(queueName, options);

    if (queue.options.durable !== options.durable) throw new Error('Durable doesn\'t match');
    return queue;
  }

  function deleteQueue(queueName) {
    if (!queueName) return false;

    const idx = queues.findIndex(queue => queue.name === queueName);
    if (idx === -1) return;

    const queue = queues[idx];
    if (queue.exchangeName) {
      const exchange = getExchangeByName(queue.exchangeName);
      if (exchange) exchange.unbindQueueByName(queue.name);
    }
    queues.splice(idx, 1);
    return true;
  }

  function Exchange(exchangeName, type = 'topic', options = {}) {
    if (['topic', 'direct'].indexOf(type) === -1) throw Error('Exchange type must be one of topic or direct');

    const bindings = [];
    let stopped;
    options = Object.assign({ durable: true, autoDelete: true }, options);

    const directQueue = Queue('messages-queue', { autoDelete: false });
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
      stop: stopExchange,
      unbind,
      unbindQueueByName
    };

    Object.defineProperty(exchange, 'bindingsCount', {
      enumerable: true,
      get: () => bindings.length
    });

    Object.defineProperty(exchange, 'bindings', {
      enumerable: true,
      get: () => bindings.slice()
    });

    Object.defineProperty(exchange, 'stopped', {
      enumerable: true,
      get: () => stopped
    });

    return exchange;

    function publishToQueues(routingKey, content, msgOptions) {
      if (stopped) return;

      if (type === 'direct') return directQueue.queueMessage(routingKey, content, msgOptions);

      const deliverTo = bindings.reduce((result, { queue, testPattern }) => {
        if (testPattern(routingKey)) result.push(queue);
        return result;
      }, []);

      if (!deliverTo.length) return 0;

      deliverTo.forEach(queue => queue.queueMessage(routingKey, content, msgOptions));
    }

    function direct(routingKey, message) {
      const deliverTo = bindings.reduce((result, bound) => {
        if (bound.testPattern(routingKey)) result.push(bound);
        return result;
      }, []);

      const first = deliverTo[0];
      if (!first) {
        message.ack();
        return 0;
      }
      if (deliverTo.length > 1) shift(deliverTo[0]);
      first.queue.queueMessage(routingKey, message.content, message.options, message.ack);
    }

    function shift(bound) {
      const idx = bindings.indexOf(bound);
      bindings.splice(idx, 1);
      bindings.push(bound);
    }

    function bind(queue, pattern, bindOptions) {
      const bound = bindings.find(bq => bq.queue === queue && bq.pattern === pattern);
      if (bound) return bound;

      const binding = Binding(queue, pattern, bindOptions);
      bindings.push(binding);
      bindings.sort(sortByPriority);
      return binding;
    }

    function unbind(queue, pattern) {
      const idx = bindings.findIndex(bq => bq.queue === queue && bq.pattern === pattern);
      if (idx === -1) return;
      bindings.splice(idx, 1);
      if (options.autoDelete) deleteExchange(exchangeName, true);
    }

    function unbindQueueByName(queueName) {
      const bounds = bindings.filter(bq => bq.queue.name === queueName);
      bounds.forEach(bound => {
        unbind(bound.queue, bound.pattern);
      });
    }

    function closeExchange() {
      bindings.forEach(q => q.close());
      directQueue.removeConsumer(direct, false);
      directQueue.close();
    }

    function getExchangeState() {
      return {
        name: exchangeName,
        type,
        options: Object.assign({}, options),
        bindings: getBoundState(),
        undelivered: getUndelivered()
      };

      function getBoundState() {
        return bindings.reduce((result, bound) => {
          if (!bound.queue.options.durable) return;
          if (!result) result = [];
          result.push({
            pattern: bound.pattern,
            queueName: bound.queue.name
          });
          return result;
        }, undefined);
      }

      function getUndelivered() {
        if (type !== 'direct') return;
        return directQueue.getState().messages;
      }
    }

    function stopExchange() {
      stopped = true;
    }

    function recoverExchange(state) {
      stopped = false;
      if (!state) {
        if (type === 'direct') {
          directQueue.recover();
        }
        return;
      }

      recoverBindings();

      if (state && type === 'direct') {
        directQueue.recover({ messages: state.undelivered });
      }

      return exchange;

      function recoverBindings() {
        if (!state.bindings) return;
        state.bindings.forEach(binding => {
          const queue = getQueue(binding.queueName);
          if (!queue) return;
          bind(queue, binding.pattern);
        });
      }
    }

    function Binding(queue, pattern, bindOptions = { priority: 0 }) {
      const rPattern = getRPattern();
      return {
        id: `${queue.name}/${pattern}`,
        options: { ...bindOptions },
        pattern,
        queue,
        close: closeBinding,
        testPattern
      };

      function testPattern(routingKey) {
        return rPattern.test(routingKey);
      }

      function closeBinding() {
        queue.close();
      }

      function getRPattern() {
        const rpattern = pattern.replace('.', '\\.').replace('*', '[^.]+?').replace('#', '.+?');

        return new RegExp(`^${rpattern}$`);
      }
    }
  }

  function Queue(queueName, options = {}) {
    const messages = [],
          queueConsumers = [];
    let pendingResume, exclusive, exchangeName, stopped;
    options = Object.assign({ autoDelete: true }, options);

    const queue = {
      name: queueName,
      options,
      addConsumer,
      bind,
      close: closeQueue,
      get,
      getState: getQueueState,
      peek,
      purge,
      queueMessage,
      removeConsumer,
      recover: recoverQueue,
      stop: stopQueue,
      unbind
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

    Object.defineProperty(queue, 'stopped', {
      enumerable: true,
      get: () => stopped
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
      return queueConsumers.find(consumer => consumer.onMessage === onMessage);
    }

    function unbind(consumer, requeue) {
      if (!consumer) return;
      const idx = queueConsumers.indexOf(consumer);
      if (idx === -1) return;
      queueConsumers.splice(idx, 1);

      exclusive = false;

      const consumerMessages = messages.filter(message => message.consumerTag === consumer.options.consumerTag);
      for (let i = 0; i < consumerMessages.length; i++) {
        consumerMessages[i].unsetConsumer();
        nack(consumerMessages[i], requeue);
      }
    }

    function nack(message, requeue) {
      message.unsetConsumer();
      message.nack(false, requeue);
    }

    function queueMessage(routingKey, content, msgOptions, onMessageQueued) {
      const message = Message(generateId(), routingKey, content, msgOptions, onConsumed);
      messages.push(message);
      if (onMessageQueued) onMessageQueued(message);
      return consumeNext();
    }

    function consumeNext() {
      if (stopped) return;

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
        if (! --count) break;
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

    function purge() {
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
        options
      };

      result.messages = messages.map(message => {
        const { routingKey, messageId, content } = message;
        return {
          routingKey,
          messageId,
          content
        };
      });

      return JSON.parse(JSON.stringify(result));
    }

    function recoverQueue(state) {
      stopped = false;
      if (!state) return;
      messages.splice(0);
      state.messages.forEach(({ messageId, routingKey, content, options: msgOptions }) => {
        const msg = Message(messageId, routingKey, content, msgOptions, onConsumed);
        messages.push(msg);
      });
      consumeNext();
    }

    function closeQueue() {
      exclusive = false;
      queueConsumers.splice(0).forEach(consumer => consumer.close());
    }

    function stopQueue() {
      stopped = true;
    }
  }

  function Consumer(queueName, onMessage, options) {
    const consumerOptions = Object.assign({ consumerTag: generateId(), prefetch: 1, priority: 0 }, options);
    const { consumerTag, noAck, priority } = consumerOptions;
    let prefetch;
    setPrefetch(consumerOptions.prefetch);
    const messages = [];

    const consumer = {
      consumerTag,
      noAck,
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
      prefetch: setPrefetch
    };

    return consumer;

    function getMessages(queue) {
      if (messages.length >= prefetch) return 0;

      const newMessages = queue.get(prefetch - messages.length);
      if (!newMessages.length) return 0;

      messages.push(...newMessages);
      newMessages.forEach(message => {
        message.setConsumer(consumerTag, onConsumed);
      });

      newMessages.forEach(message => {
        onMessage(message.routingKey, message, source);
      });

      return newMessages.length;
    }

    function nackAll(requeue) {
      if (!messages.length) return;
      messages.slice().forEach(message => message.nack(false, requeue));
    }

    function ackAll() {
      if (!messages.length) return;
      messages.slice().forEach(message => message.ack());
    }

    function ack(allUpTo) {
      if (!messages.length) return;
      messages[0].ack(allUpTo);
    }

    function nack(allUpTo, requeue) {
      if (!messages.length) return;
      messages[0].nack(allUpTo, requeue);
    }

    function onConsumed(message) {
      const idx = messages.indexOf(message);
      if (idx === -1) return;
      messages.splice(idx, 1);
      return true;
    }

    function closeConsumer(requeue = true) {
      unsubscribe(consumer.queueName, onMessage);
      nackAll(requeue);
      consumer.queueName = undefined;
    }

    function setPrefetch(value) {
      const val = parseInt(value);
      if (!val) {
        prefetch = 1;
        return;
      }
      prefetch = val;
      return prefetch;
    }
  }

  function sortByPriority(a, b) {
    return b.options.priority - a.options.priority;
  }

  function Message(messageId, routingKey, content = {}, msgOptions = {}, onConsumed) {
    let pending = false,
        consumerTag;
    let consumedCallback;

    const message = {
      options: { ...msgOptions },
      messageId,
      routingKey,
      setConsumer,
      ack,
      nack,
      reject,
      unsetConsumer
    };

    Object.defineProperty(message, 'pending', {
      enumerable: true,
      get: () => pending
    });

    Object.defineProperty(message, 'consumerTag', {
      enumerable: true,
      get: () => consumerTag
    });

    if (content) message.content = { ...content };

    return message;

    function setConsumer(consumedByTag, consumedCb) {
      pending = true;
      consumerTag = consumedByTag;
      consumedCallback = consumedCb;
    }

    function unsetConsumer() {
      pending = false;
      consumedCallback = undefined;
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
      [consumedCallback, onConsumed].forEach(fn => {
        if (fn) fn(message, operation, allUpTo, requeue);
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