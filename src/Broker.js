import {Exchange, EventExchange} from './Exchange';
import {Queue} from './Queue';
import {Shovel} from './Shovel';

export function Broker(owner) {
  const exchanges = [];
  const queues = [];
  const consumers = [];
  const shovels = [];
  const events = EventExchange();

  const broker = {
    owner,
    subscribe,
    subscribeOnce,
    subscribeTmp,
    unsubscribe,
    createShovel,
    closeShovel,
    getShovel,
    assertExchange,
    ack,
    ackAll,
    nack,
    nackAll,
    cancel,
    close,
    deleteExchange,
    bindExchange,
    bindQueue,
    assertQueue,
    consume,
    createQueue,
    deleteQueue,
    get: getMessageFromQueue,
    getConsumer,
    getExchange,
    getQueue,
    getState,
    on,
    off,
    prefetch: setPrefetch,
    publish,
    purgeQueue,
    recover,
    reject,
    reset,
    sendToQueue,
    stop,
    unbindExchange,
    unbindQueue,
  };

  Object.defineProperty(broker, 'exchangeCount', {
    enumerable: true,
    get: () => exchanges.length
  });

  Object.defineProperty(broker, 'queueCount', {
    enumerable: true,
    get: () => queues.length
  });

  Object.defineProperty(broker, 'consumerCount', {
    enumerable: true,
    get: () => consumers.length
  });

  return broker;

  function subscribe(exchangeName, pattern, queueName, onMessage, options = {durable: true}) {
    if (!exchangeName || !pattern || typeof onMessage !== 'function') throw new Error('exchange name, pattern, and message callback are required');
    if (options && options.consumerTag) validateConsumerTag(options.consumerTag);

    assertExchange(exchangeName);
    const queue = assertQueue(queueName, options);

    bindQueue(queue.name, exchangeName, pattern, options);

    return queue.assertConsumer(onMessage, options, owner);
  }

  function subscribeTmp(exchangeName, pattern, onMessage, options = {}) {
    return subscribe(exchangeName, pattern, null, onMessage, {...options, durable: false});
  }

  function subscribeOnce(exchangeName, pattern, onMessage, options = {}) {
    if (typeof onMessage !== 'function') throw new Error('message callback is required');
    if (options && options.consumerTag) validateConsumerTag(options.consumerTag);

    assertExchange(exchangeName);
    const onceOptions = {autoDelete: true, durable: false, priority: options.priority || 0};
    const onceQueue = createQueue(null, onceOptions);

    bindQueue(onceQueue.name, exchangeName, pattern, {...onceOptions});

    return consume(onceQueue.name, wrappedOnMessage, {noAck: true, consumerTag: options.consumerTag});

    function wrappedOnMessage(...args) {
      onceQueue.delete();
      onMessage(...args);
    }
  }

  function unsubscribe(queueName, onMessage) {
    const queue = getQueue(queueName);
    if (!queue) return;
    queue.dismiss(onMessage);
  }

  function assertExchange(exchangeName, type, options) {
    let exchange = getExchangeByName(exchangeName);
    if (exchange) {
      if (type && exchange.type !== type) throw new Error('Type doesn\'t match');
    } else {
      exchange = Exchange(exchangeName, type || 'topic', options);
      exchange.on('delete', () => {
        const idx = exchanges.indexOf(exchange);
        if (idx === -1) return;
        exchanges.splice(idx, 1);
      });
      exchange.on('return', (_, msg) => {
        events.publish('return', msg);
      });
      exchanges.push(exchange);
    }

    return exchange;
  }

  function getExchangeByName(exchangeName) {
    return exchanges.find((exchange) => exchange.name === exchangeName);
  }

  function bindQueue(queueName, exchangeName, pattern, bindOptions) {
    const exchange = getExchange(exchangeName);
    const queue = getQueue(queueName);
    exchange.bind(queue, pattern, bindOptions);
  }

  function unbindQueue(queueName, exchangeName, pattern) {
    const exchange = getExchange(exchangeName);
    if (!exchange) return;
    const queue = getQueue(queueName);
    if (!queue) return;
    exchange.unbind(queue, pattern);
  }

  function consume(queueName, onMessage, options) {
    const queue = getQueue(queueName);
    if (!queue) throw new Error(`Queue with name <${queueName}> was not found`);

    if (options) validateConsumerTag(options.consumerTag);

    return queue.consume(onMessage, options, owner);
  }

  function cancel(consumerTag) {
    const consumer = getConsumer(consumerTag);
    if (!consumer) return false;
    consumer.cancel(false);
    return true;
  }

  function getConsumer(consumerTag) {
    return consumers.find((c) => c.consumerTag === consumerTag);
  }

  function getExchange(exchangeName) {
    return exchanges.find(({name}) => name === exchangeName);
  }

  function deleteExchange(exchangeName, {ifUnused} = {}) {
    const idx = exchanges.findIndex((exchange) => exchange.name === exchangeName);
    if (idx === -1) return false;

    const exchange = exchanges[idx];
    if (ifUnused && exchange.bindingCount) return false;

    exchanges.splice(idx, 1);
    exchange.close();
    return true;
  }

  function stop() {
    for (const exchange of exchanges) exchange.stop();
    for (const queue of queues) queue.stop();
  }

  function close() {
    for (const shovel of shovels) shovel.close();
    for (const exchange of exchanges) exchange.close();
    for (const queue of queues) queue.close();
  }

  function reset() {
    stop();
    close();
    exchanges.splice(0);
    queues.splice(0);
    consumers.splice(0);
    shovels.splice(0);
  }

  function getState() {
    return {
      exchanges: getExchangeState(),
      queues: getQueuesState(),
    };
  }

  function recover(state) {
    if (state) {
      if (state.queues) for (const qState of state.queues) recoverQueue(qState);
      if (state.exchanges) for (const eState of state.exchanges) recoverExchange(eState);
    } else {
      for (const queue of queues) {
        if (queue.stopped) queue.recover();
      }
      for (const exchange of exchanges) {
        if (exchange.stopped) exchange.recover(null, getQueue);
      }
    }

    return broker;

    function recoverQueue(qState) {
      const queue = assertQueue(qState.name, qState.options);
      queue.recover(qState);
    }

    function recoverExchange(eState) {
      const exchange = assertExchange(eState.name, eState.type, eState.options);
      exchange.recover(eState, getQueue);
    }
  }

  function bindExchange(source, destination, pattern = '#', args = {}) {
    const name = `e2e-${source}2${destination}-${pattern}`;
    const {consumerTag, on: onShovel, close: onClose, source: shovelSource} = createShovel(name, {
      broker,
      exchange: source,
      pattern,
      consumerTag: `smq.ctag-${name}`,
    }, {
      broker,
      exchange: destination
    }, {
      ...args
    });

    return {
      name,
      source,
      destination,
      queue: shovelSource.queue,
      consumerTag,
      on: onShovel,
      close: onClose,
    };
  }

  function unbindExchange(source, destination, pattern = '#') {
    const name = `e2e-${source}2${destination}-${pattern}`;
    return closeShovel(name);
  }

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

  function sendToQueue(queueName, content, options) {
    const queue = getQueue(queueName);
    if (!queue) throw new Error(`Queue named ${queueName} doesn't exists`);
    return queue.queueMessage(null, content, options);
  }

  function getQueuesState() {
    return queues.reduce((result, queue) => {
      if (!queue.options.durable) return result;
      if (!result) result = [];
      result.push(queue.getState());
      return result;
    }, undefined);
  }

  function getExchangeState() {
    return exchanges.reduce((result, exchange) => {
      if (!exchange.options.durable) return result;
      if (!result) result = [];
      result.push(exchange.getState());
      return result;
    }, undefined);
  }

  function createQueue(queueName, options) {
    if (getQueue(queueName)) throw new Error(`Queue named ${queueName} already exists`);

    const queue = Queue(queueName, options, EventExchange());
    queue.on('delete', onDelete);
    queue.on('dead-letter', onDeadLetter);
    queue.on('consume', (_, event) => consumers.push(event.content));
    queue.on('consumer.cancel', (_, event) => {
      const idx = consumers.indexOf(event.content);

      if (idx !== -1) consumers.splice(idx, 1);
    });

    queues.push(queue);
    return queue;

    function onDelete() {
      const idx = queues.indexOf(queue);
      if (idx === -1) return;
      queues.splice(idx, 1);
    }

    function onDeadLetter(_, {content}) {
      const exchange = getExchange(content.deadLetterExchange);
      if (!exchange) return;
      exchange.publish(content.message.fields.routingKey, content.message.content, content.message.properties);
    }
  }

  function getQueue(queueName) {
    if (!queueName) return;
    const idx = queues.findIndex((queue) => queue.name === queueName);
    if (idx > -1) return queues[idx];
  }

  function assertQueue(queueName, options = {}) {
    if (!queueName) return createQueue(null, options);

    const queue = getQueue(queueName);
    options = {durable: true, ...options};
    if (!queue) return createQueue(queueName, options);

    if (queue.options.durable !== options.durable) throw new Error('Durable doesn\'t match');
    return queue;
  }

  function deleteQueue(queueName, options) {
    if (!queueName) return false;
    const queue = getQueue(queueName);
    if (!queue) return false;
    return queue.delete(options);
  }

  function getMessageFromQueue(queueName, {noAck} = {}) {
    const queue = getQueue(queueName);
    if (!queue) return;

    return queue.get({noAck});
  }

  function ack(message, allUpTo) {
    message.ack(allUpTo);
  }

  function ackAll() {
    for (const queue of queues) queue.ackAll();
  }

  function nack(message, allUpTo, requeue) {
    message.nack(allUpTo, requeue);
  }

  function nackAll(requeue) {
    for (const queue of queues) queue.nackAll(requeue);
  }

  function reject(message, requeue) {
    message.reject(requeue);
  }

  function validateConsumerTag(consumerTag) {
    if (!consumerTag) return true;

    if (getConsumer(consumerTag)) {
      throw new Error(`Consumer tag must be unique, ${consumerTag} is occupied`);
    }

    return true;
  }

  function createShovel(name, source, destination, cloneMessage) {
    if (getShovel(name)) throw new Error(`Shovel name must be unique, ${name} is occupied`);
    const shovel = Shovel(name, {...source, broker}, destination, cloneMessage);
    shovels.push(shovel);
    shovel.on('close', onClose);
    return shovel;

    function onClose() {
      const idx = shovels.indexOf(shovel);
      if (idx > -1) shovels.splice(idx, 1);
    }
  }

  function closeShovel(name) {
    const shovel = getShovel(name);
    if (shovel) {
      shovel.close();
      return true;
    }
    return false;
  }

  function getShovel(name) {
    return shovels.find((s) => s.name === name);
  }

  function on(eventName, callback) {
    switch (eventName) {
      case 'return': {
        return events.on('return', getEventCallback(), {origin: callback});
      }
    }

    function getEventCallback() {
      return function eventCallback(_, msg) {
        callback(msg.content.content);
      };
    }
  }

  function off(eventName, callback) {
    for (const binding of events.bindings) {
      if (binding.pattern === eventName) {
        for (const consumer of binding.queue.consumers) {
          if (consumer.options && consumer.options.origin === callback) {
            consumer.cancel();
          }
        }
      }
    }
  }

  function setPrefetch() {}
}
