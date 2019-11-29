"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Shovel = Shovel;

var _Exchange = require("./Exchange");

function Shovel(name, source, destination, options = {}) {
  const {
    broker: sourceBroker,
    exchange: sourceExchangeName,
    pattern,
    queue,
    priority
  } = source;
  const {
    broker: destinationBroker,
    exchange: destinationExchangeName,
    publishProperties,
    exchangeKey
  } = destination;
  const {
    cloneMessage
  } = options;
  const sourceExchange = sourceBroker.getExchange(sourceExchangeName);

  if (!sourceExchange) {
    throw new Error(`shovel ${name} source exchange <${sourceExchangeName}> not found`);
  }

  const destinationExchange = destinationBroker.getExchange(destinationExchangeName);

  if (!destinationExchange) {
    throw new Error(`shovel ${name} destination exchange <${destinationExchangeName}> not found`);
  }

  const sameBroker = sourceBroker === destinationBroker;
  const consumerTag = source.consumerTag || `smq.shoveltag-${name}`;
  const routingKeyPattern = pattern || '#';
  const events = (0, _Exchange.EventExchange)();
  let closed = false;
  const api = {
    name,
    source: { ...source,
      pattern: routingKeyPattern
    },
    destination: { ...destination
    },
    consumerTag,
    close,
    on: events.on
  };
  Object.defineProperty(api, 'closed', {
    enumerable: true,
    get: () => closed
  });
  const eventHandlers = [sourceExchange.on('delete', close), destinationExchange.on('delete', close)];
  let consumer;

  if (queue) {
    consumer = sourceBroker.subscribe(sourceExchangeName, routingKeyPattern, queue, onShovelMessage, {
      consumerTag,
      priority
    });
  } else {
    consumer = sourceBroker.subscribeTmp(sourceExchangeName, routingKeyPattern, onShovelMessage, {
      consumerTag,
      priority
    });
    api.source.queue = consumer.queue.name;
  }

  eventHandlers.push(consumer.on('cancel', close));
  return api;

  function onShovelMessage(routingKey, message) {
    const {
      content,
      properties
    } = messageHandler(message);
    const props = { ...properties,
      ...publishProperties,
      'source-exchange': sourceExchangeName
    };
    if (!sameBroker) props['shovel-name'] = name;
    destinationExchange.publish(exchangeKey || routingKey, content, props);
    message.ack();
  }

  function close() {
    if (closed) return;
    closed = true;
    eventHandlers.splice(0).forEach(e => e.cancel());
    events.emit('close', api);
    events.close();
    sourceBroker.cancel(consumerTag);
  }

  function messageHandler(message) {
    if (!cloneMessage) return message;
    const {
      fields,
      content,
      properties
    } = message;
    const {
      content: newContent,
      properties: newProperties
    } = cloneMessage({
      fields: { ...fields
      },
      content,
      properties: { ...properties
      }
    });
    return {
      fields,
      content: newContent,
      properties: { ...properties,
        ...newProperties
      }
    };
  }
}