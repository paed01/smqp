import {generateId} from './shared';

export {Message};

function Message(fields = {}, content, properties = {}, onConsumed) {
  let pending = false;
  let consumedCallback;

  const messageId = properties.messageId || `smq.mid-${generateId()}`;
  const messageProperties = {...properties, messageId};
  const timestamp = messageProperties.timestamp = properties.timestamp || Date.now();
  let ttl;
  if (properties.expiration) {
    ttl = messageProperties.ttl = timestamp + parseInt(properties.expiration);
  }

  const message = {
    fields: {...fields, consumerTag: undefined},
    content,
    properties: messageProperties,
    get messageId() {
      return messageId;
    },
    get ttl() {
      return ttl;
    },
    get consumerTag() {
      return message.fields.consumerTag;
    },
    get pending() {
      return pending;
    },
    consume,
    ack,
    nack,
    reject,
  };

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
