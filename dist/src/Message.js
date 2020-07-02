"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Message = Message;

var _shared = require("./shared");

function Message(fields = {}, content, properties = {}, onConsumed) {
  let pending = false;
  let consumedCallback;
  const messageId = properties.messageId || `smq.mid-${(0, _shared.generateId)()}`;
  const messageProperties = { ...properties,
    messageId
  };
  const timestamp = messageProperties.timestamp = properties.timestamp || Date.now();
  let ttl;

  if (properties.expiration) {
    ttl = messageProperties.ttl = timestamp + parseInt(properties.expiration);
  }

  const message = {
    fields: { ...fields,
      consumerTag: undefined
    },
    content,
    properties: messageProperties,
    consume,
    ack,
    nack,
    reject
  };
  Object.defineProperty(message, 'messageId', {
    get() {
      return messageId;
    }

  });
  Object.defineProperty(message, 'ttl', {
    value: ttl
  });
  Object.defineProperty(message, 'consumerTag', {
    get() {
      return message.fields.consumerTag;
    },

    set(value) {
      message.fields.consumerTag = value;
    }

  });
  Object.defineProperty(message, 'pending', {
    get: () => pending
  });
  return message;

  function consume({
    consumerTag
  } = {}, consumedCb) {
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
    [consumedCallback, onConsumed, reset].forEach(fn => {
      if (fn) fn(message, operation, allUpTo, requeue);
    });
  }
}