import {Exchange, EventExchange} from './Exchange';
import {Queue} from './Queue';

export function Broker(owner) {
  const exchanges = [];
  const queues = [];
  const consumers = [];

  const broker = {
    subscribe,
    subscribeOnce,
    subscribeTmp,
    unsubscribe,
    assertExchange,
    ack: ackMessage,
    nack: nackMessage,
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
    getExchange,
    getQueue,
    getState,
    prefetch: setPrefetch,
    publish,
    purgeQueue,
    recover,
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

    assertExchange(exchangeName);
    const queue = assertQueue(queueName, options);

    bindQueue(queue.name, exchangeName, pattern, options);

    return consume(queue.name, onMessage, options);
  }

  function subscribeTmp(exchangeName, pattern, onMessage, options = {}) {
    return subscribe(exchangeName, pattern, null, onMessage, {...options, durable: false});
  }

  function subscribeOnce(exchangeName, pattern, onMessage, options = {}) {
    if (typeof onMessage !== 'function') throw new Error('message callback is required');

    assertExchange(exchangeName);
    const onceOptions = {autoDelete: true, durable: false};
    const onceQueue = createQueue(null, onceOptions);

    bindQueue(onceQueue.name, exchangeName, pattern, onceOptions);

    const onceConsumer = consume(onceQueue.name, wrappedOnMessage, {noAck: true, consumerTag: options.consumerTag});
    return onceConsumer;

    function wrappedOnMessage(...args) {
      onceQueue.delete();
      onMessage(...args);
    }
  }

  function unsubscribe(queueName, onMessage) {
    const queue = getQueue(queueName);
    if (!queue) return;
    queue.dismiss(onMessage);
    return true;
  }

  function assertExchange(exchangeName, type, options) {
    let exchange = getExchangeByName(exchangeName);
    if (exchange) {
      if (type && exchange.type !== type) throw new Error('Type doesn\'t match');
    } else {
      exchange = Exchange(exchangeName, type || 'topic', options, {onEvent: onExchangeEvent});
      exchanges.push(exchange);
    }

    return exchange;
  }

  function onExchangeEvent(routingKey, message, exchange) {
    switch (routingKey) {
      case 'exchange.bind': {

        break;
      }
      case 'exchange.unbind': {
        if (!exchange.options.autoDelete) break;
        if (!exchange.bindings.length) deleteExchange(exchange.name);
        break;
      }
    }
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

    if (options && options.consumerTag && consumers.find((c) => c.consumerTag === options.consumerTag)) {
      throw new Error(`Consumer tag must be unique, ${options.consumerTag} is occupied`);
    }

    return queue.consume(onMessage, options, owner);
  }

  function cancel(consumerTag) {
    const consumer = consumers.find((c) => c.consumerTag === consumerTag);
    if (!consumer) return false;
    consumer.cancel(false);
    return true;
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
    exchanges.forEach((exchange) => exchange.stop());
    queues.forEach((queue) => queue.stop());
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
    if (!state) {
      queues.forEach((queue) => queue.recover());
      exchanges.forEach((exchange) => exchange.recover(null, getQueue));
      return;
    }

    if (state.queues) state.queues.forEach(recoverQueue);
    queues.forEach((queue) => queue.stopped && queue.recover());

    if (state.exchanges) state.exchanges.forEach(recoverExchange);
    exchanges.forEach((exchange) => exchange.stopped && exchange.recover(null, getQueue));

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

  function createQueue(queueName, options) {
    if (getQueue(queueName)) throw new Error(`Queue named ${queueName} already exists`);

    const queue = Queue(queueName, options, EventExchange());
    queue.on('delete', onDelete);
    queue.on('dead-letter', onDeadLetter);
    queue.on('consume', (_, event) => consumers.push(event.content));
    queue.on('consumer.cancel', (_, event) => {
      const idx = consumers.indexOf(event.content);
      consumers.splice(idx, 1);
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

  function deleteQueue(queueName) {
    if (!queueName) return false;
    const queue = getQueue(queueName);
    if (!queue) return false;
    queue.delete();
    return true;
  }

  function getMessageFromQueue(queueName, {noAck} = {}) {
    const queue = getQueue(queueName);
    if (!queue) return;

    let message;
    const tmpConsumer = queue.addConsumer(onceHandler, {noAck: false, prefetch: 1});
    if (!message) {
      tmpConsumer.cancel();
      return message;
    }

    return message;

    function onceHandler(_, msg) {
      message = msg;
    }
  }

  function ackMessage() {}
  function nackMessage() {}
  function setPrefetch() {}
}
