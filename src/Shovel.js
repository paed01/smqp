import {EventExchange} from './Exchange';

export function Shovel(name, source, destination, cloneMessage) {
  const {broker: sourceBroker, exchange: sourceExchangeName, pattern, queue} = source;
  const {broker: destinationBroker, exchange: destinationExchangeName} = destination;

  const sourceExchange = sourceBroker.getExchange(sourceExchangeName);
  if (!sourceExchange) {
    throw new Error(`shovel ${name} source exchange <${sourceExchangeName}> not found`);
  }

  const destinationExchange = destinationBroker.getExchange(destinationExchangeName);
  if (!destinationExchange) {
    throw new Error(`shovel ${name} destination exchange <${destinationExchangeName}> not found`);
  }

  const consumerTag = `smq.shoveltag-${name}`;
  const routingKeyPattern = pattern || '#';
  const events = EventExchange();

  let closed = false;
  const api = {
    name,
    source: {...source, pattern: routingKeyPattern},
    destination: {...destination},
    consumerTag,
    close,
    on: events.on,
  };

  Object.defineProperty(api, 'closed', {
    enumerable: true,
    get: () => closed
  });

  const eventHandlers = [
    sourceExchange.on('delete', close),
    destinationExchange.on('delete', close),
  ];
  if (queue) {
    sourceBroker.subscribe(sourceExchangeName, routingKeyPattern, queue, onShovelMessage, {consumerTag});
  } else {
    sourceBroker.subscribeTmp(sourceExchangeName, routingKeyPattern, onShovelMessage, {consumerTag});
  }

  return api;

  function onShovelMessage(routingKey, message) {
    const {content, properties} = messageHandler(message);
    destinationExchange.publish(routingKey, content, {...properties, 'shovel-name': name});
    message.ack();
  }

  function close() {
    if (closed) return;
    closed = true;
    eventHandlers.forEach((e) => e.cancel());
    events.emit('close', api);
    events.close();
    sourceBroker.cancel(consumerTag);
  }

  function messageHandler(message) {
    if (!cloneMessage) return message;

    const {fields, content, properties} = message;
    const {content: newContent, properties: newProperties} = cloneMessage({
      fields: {...fields},
      content,
      properties: {...properties},
    });

    return {
      fields,
      content: newContent,
      properties: {...properties, ...newProperties},
    };
  }
}
