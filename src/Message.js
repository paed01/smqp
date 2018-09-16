import {generateId} from './shared';

export {Message};

function Message(fields = {}, content, properties = {}, onConsumed) {
  let pending = false;
  let consumedCallback;

  const messageId = properties.messageId || `smq.mid-${generateId()}`;
  const message = {
    fields: {...fields, consumerTag: undefined},
    content,
    properties: {...properties, messageId},
    consume,
    ack,
    nack,
    reject,
  };

  Object.defineProperty(message, 'messageId', {
    get: () => messageId
  });

  Object.defineProperty(message, 'consumerTag', {
    get: () => message.fields.consumerTag,
    set: (value) => {
      message.fields.consumerTag = value;
    },
  });

  Object.defineProperty(message, 'pending', {
    get: () => pending
  });

  return message;

  function consume({consumerTag} = {}, consumedCb) {
    pending = true;
    message.fields.consumerTag = consumerTag;
    consumedCallback = consumedCb;
  }

  function reset() {
    pending = false;
  }

  function ack(allUpTo) {
    if (!pending) return;
    consumed('ack', allUpTo);
  }

  function nack(allUpTo, requeue = true) {
    if (!pending) return;
    consumed('nack', allUpTo, requeue);
  }

  function reject(requeue = true) {
    nack(false, requeue);
  }

  function consumed(operation, allUpTo, requeue) {
    [consumedCallback, onConsumed, reset].forEach((fn) => {
      if (fn) fn(message, operation, allUpTo, requeue);
    });
  }
}
