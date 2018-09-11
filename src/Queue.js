import {generateId} from './shared';
import {Message} from './Message';

export {Queue};

function Queue(name, options = {}) {
  if (!name) name = `smq.qname-${generateId()}`;
  const {deadLetterExchange} = options;
  const messages = [], queueConsumers = [], bindings = [];
  let pendingResume, exclusive, stopped;
  options = Object.assign({autoDelete: true}, options);

  const queue = {
    name,
    options,
    messages,
    ack,
    addConsumer,
    addBinding,
    removeBinding,
    close,
    consume,
    get,
    getState,
    nack,
    peek,
    purge,
    queueMessage,
    reject,
    removeConsumer,
    recover: recoverQueue,
    stop,
    unbind,
  };

  Object.defineProperty(queue, 'messagesCount', {
    enumerable: true,
    get: () => messages.length
  });

  Object.defineProperty(queue, 'stopped', {
    get: () => stopped
  });

  return queue;

  function queueMessage(fields, content, properties, onMessageQueued) {
    if (stopped) return;

    const message = Message(fields, content, properties, onConsumed);
    messages.push(message);
    if (onMessageQueued) onMessageQueued(message);
    return consumeNext();
  }

  function get(consumeOptions = {}) {
    return consume({...consumeOptions, prefetch: 1})[0];
  }

  function consume({prefetch = 1, consumerTag} = {}) {
    if (stopped) return [];
    if (pendingResume) return [];
    if (!prefetch) return [];

    const msgs = [];
    if (!prefetch) return msgs;

    for (const msg of messages) {
      if (msg.pending) continue;
      msg.consume({consumerTag});
      msgs.push(msg);
      if (!--prefetch) break;
    }

    return msgs;
  }

  function ack(message, allUpTo) {
    onConsumed(message, 'ack', allUpTo);
  }

  function nack(message, allUpTo, requeue = true) {
    onConsumed(message, 'nack', allUpTo, requeue);
  }

  function reject(message, requeue = true) {
    onConsumed(message, 'reject', false, requeue);
  }

  function onConsumed(message, operation, allUpTo, requeue) {
    if (stopped) return;

    switch (operation) {
      case 'ack': {
        if (!dequeue(message, allUpTo)) return;
        break;
      }
      case 'reject':
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

  function addConsumer(onMessage, consumeOptions) {
    if (typeof onMessage !== 'function') throw new TypeError('Message callback is mandatory');
    let consumer = getConsumer(onMessage);
    if (consumer) return consumer;

    if (exclusive) throw new Error(`Queue ${queueName} is exclusively consumed by ${queueConsumers[0].consumerTag}`);
    if (consumeOptions && consumeOptions.exclusive) {
      if (queueConsumers.length) throw new Error(`Cannot exclusively subscribe to queue ${queueName} since it is already consumed`);
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

  function consumeNext() {
    if (stopped) return;

    if (!messages.length) return;
    const activeConsumers = queueConsumers.slice();

    let consumed = 0;
    for (const consumer of activeConsumers) {
      consumed += consumer.consume(queue);
    }

    if (!consumed) return consumed;

    return consumed;
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
      const msg = Message(fields, content, properties, onConsumed);
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
