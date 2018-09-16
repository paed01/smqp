import {generateId} from './shared';
import {Queue} from './Queue';

export {Consumer};

function Consumer(owner, queue, onMessage, options = {}) {
  options = Object.assign({prefetch: 1, priority: 0, noAck: false}, options);
  if (!options.consumerTag) options.consumerTag = `smq.ctag-${generateId()}`;

  const internalQueue = Queue(`${options.consumerTag}-q`, {}, {onEmpty, onMessage: onInternalMessage});

  const consumer = {
    queue,
    options,
    ackAll,
    cancel,
    consume,
    nackAll,
    prefetch: setConsumerPrefetch
  };

  Object.defineProperty(consumer, 'consumerTag', {
    value: options.consumerTag
  });

  Object.defineProperty(consumer, 'messageCount', {
    get: () => internalQueue.messageCount
  });

  queue.bindConsumer(consumer);

  return consumer;

  function consume() {
    if (internalQueue.messageCount) return 0;

    const newMessages = queue.consume(options);
    if (!newMessages.length) return 0;

    newMessages.forEach((message) => internalQueue.queueMessage(message.fields, message, message.properties, onInternalMessageQueued));

    if (options.noAck) internalQueue.ackAll();

    return newMessages.length;
  }

  function onInternalMessageQueued(msg) {
    const message = msg.content;
    msg.consume(options);
    message.consume(options, onConsumed);

    function onConsumed() {
      msg.nack(false, false);
    }
  }

  function onEmpty() {
    consume();
  }

  function onInternalMessage(routingKey, msg) {
    const message = msg.content;
    onMessage(routingKey, message, owner);
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

  // function ack(message, allUpTo) {
  //   if (!messages.length) return;
  //   messages[0].ack(allUpTo);
  // }

  // function nack(message, requeue) {
  //   if (!messages.length) return;
  //   messages[0].nack(allUpTo, requeue);
  // }

  function cancel(requeue = true) {
    queue.unbindConsumer(consumer);
    nackAll(requeue);
  }

  function setConsumerPrefetch(value) {
    const val = parseInt(value);
    if (!val) {
      prefetch = 1;
      return;
    }
    prefetch = val;
    return prefetch;
  }
}
