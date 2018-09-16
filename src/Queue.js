import {generateId} from './shared';
import {Message} from './Message';

export {Queue};

function Queue(name, options = {}, {onMessage, onEmpty, onConsumed} = {}) {
  if (!name) name = `smq.qname-${generateId()}`;
  const {deadLetterExchange} = options;
  const messages = [], queueConsumers = [], bindings = [];
  let exclusive, stopped;
  options = Object.assign({autoDelete: true}, options);

  const queue = {
    name,
    options,
    messages,
    bindConsumer,
    ack,
    ackAll,
    addBinding,
    addConsumer,
    removeBinding,
    close,
    consume,
    get,
    getState,
    nack,
    nackAll,
    peek,
    purge,
    queueMessage,
    reject,
    unbindConsumer,
    recover: recoverQueue,
    stop,
    unbind,
  };

  Object.defineProperty(queue, 'messageCount', {
    enumerable: true,
    get: () => messages.length
  });

  Object.defineProperty(queue, 'consumerCount', {
    get: () => queueConsumers.length
  });

  Object.defineProperty(queue, 'stopped', {
    get: () => stopped
  });

  return queue;

  function queueMessage(fields, content, properties, onMessageQueued) {
    if (stopped) return;

    const message = Message(fields, content, properties, onMessageConsumed);
    messages.push(message);
    if (onMessageQueued) onMessageQueued(message);

    if (onMessage) onMessage(fields.routingKey, message);
    return consumeNext();
  }

  function consumeNext() {
    if (stopped) return;
    if (!messages.length) return;
    if (!queueConsumers.length) return;

    const activeConsumers = queueConsumers.slice();

    let consumed = 0;
    for (const consumer of activeConsumers) {
      consumed += consumer.consume();
    }

    if (!consumed) return consumed;

    return consumed;
  }

  function get(consumeOptions = {}) {
    const message = consume({...consumeOptions, prefetch: 1})[0];
    if (!message) return;
    message.consume(consumeOptions);
    return message;
  }

  function consume({prefetch = 1, noAck = false} = {}) {
    if (stopped) return [];
    if (!prefetch) return [];

    const msgs = [];
    if (!prefetch) return msgs;

    for (const msg of messages) {
      if (msg.pending) continue;
      if (noAck) onMessageConsumed(msg, 'ack', false);
      msgs.push(msg);
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
        if (deadLetterExchange) {
          publish(deadLetterExchange, message.routingKey, message.content);
        }
        break;
    }

    if (onEmpty && !messages.length) onEmpty(queue);
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

    messages.splice(msgIdx, 1, Message(message.fields, message.content, message.properties, onConsumed));
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

  function addBinding(binding) {
    if (binding.queue !== queue) throw new Error('bindings are exclusive and cannot be passed around');
    if (bindings.indexOf(binding) !== -1) return;
    bindings.push(binding);
  }

  function removeBinding(binding) {
    const idx = bindings.indexOf(binding);
    if (idx === -1) return;
    bindings.splice(idx, 1);
  }

  function unbind(consumer, requeue) {
    if (!consumer) return;

    const idx = queueConsumers.indexOf(consumer);
    if (idx === -1) return;
    queueConsumers.splice(idx, 1);

    const mainIdx = consumers.indexOf(consumer);
    if (mainIdx > -1) {
      consumers.splice(mainIdx, 1);
    }

    exclusive = false;

    const consumerMessages = messages.filter((message) => message.consumerTag === consumer.consumerTag);
    for (let i = 0; i < consumerMessages.length; i++) {
      consumerMessages[i].unsetConsumer();
      nack(consumerMessages[i], requeue);
    }
  }

  function bindConsumer(consumer) {
    if (exclusive) throw new Error(`Queue ${name} is exclusively consumed by ${queueConsumers[0].consumerTag}`);
    if (consumer.options.exclusive) {
      if (queueConsumers.length) throw new Error(`Cannot exclusively subscribe to queue ${name} since it is already consumed`);
      exclusive = true;
    }

    queueConsumers.push(consumer);
  }

  function unbindConsumer(consumer) {
    const idx = queueConsumers.indexOf(consumer);
    if (idx === -1) return;

    queueConsumers.splice(idx, 1);

    if (consumer.options.exclusive) {
      exclusive = false;
    }
  }

  function addConsumer(onMessage, consumeOptions) {
    if (typeof onMessage !== 'function') throw new TypeError('Message callback is mandatory');
    let consumer = getConsumer(onMessage);
    if (consumer) return consumer;

    if (exclusive) throw new Error(`Queue ${name} is exclusively consumed by ${queueConsumers[0].consumerTag}`);
    if (consumeOptions && consumeOptions.exclusive) {
      if (queueConsumers.length) throw new Error(`Cannot exclusively subscribe to queue ${name} since it is already consumed`);
      exclusive = true;
    }

    consumer = Consumer(queueName, onMessage, consumeOptions);

    queueConsumers.push(consumer);
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

  function purge() {
    return messages.splice(0).length;
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

  function close() {
    exclusive = false;
    queueConsumers.splice(0).forEach((consumer) => consumer.cancel());
  }

  function stop() {
    stopped = true;
  }
}
