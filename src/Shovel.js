import { EventExchange } from './Exchange.js';

const kBrokerInternal = Symbol.for('brokerInternal');
const kCloneMessage = Symbol.for('cloneMessage');
const kClosed = Symbol.for('closed');
const kConsumerTag = Symbol.for('consumerTag');
const kDestinationExchange = Symbol.for('destinationExchange');
const kEventHandlers = Symbol.for('eventHandlers');
const kSourceBroker = Symbol.for('sourceBroker');
const kSourceExchange = Symbol.for('sourceExchange');
const kE2EShovel = Symbol.for('shovel');

export function Shovel(name, source, destination, options = {}) {
  if (!name || typeof name !== 'string') throw new TypeError('Shovel name is required and must be a string');

  const { broker: sourceBroker, exchange: sourceExchangeName, pattern, queue, priority } = source;
  const { broker: destinationBroker, exchange: destinationExchangeName } = destination;

  const sourceExchange = sourceBroker.getExchange(sourceExchangeName);
  if (!sourceExchange) {
    throw new Error(`shovel ${name} source exchange <${sourceExchangeName}> not found`);
  }

  const destinationExchange = destinationBroker.getExchange(destinationExchangeName);
  if (!destinationExchange) {
    throw new Error(`shovel ${name} destination exchange <${destinationExchangeName}> not found`);
  }

  if (!(this instanceof Shovel)) {
    return new Shovel(name, source, destination, options);
  }

  this[kBrokerInternal] = sourceBroker === destinationBroker;
  const routingKeyPattern = pattern || '#';

  this.name = name;
  this.source = { ...source, pattern: routingKeyPattern };
  this.destination = { ...destination };
  this.events = new EventExchange('shovel__events');

  const consumerTag = this[kConsumerTag] = source.consumerTag || `smq.shoveltag-${name}`;
  this[kClosed] = false;
  this[kSourceBroker] = sourceBroker;
  this[kSourceExchange] = sourceExchange;
  this[kDestinationExchange] = destinationExchange;
  this[kCloneMessage] = options.cloneMessage;

  const boundClose = this.close.bind(this);

  const eventHandlers = this[kEventHandlers] = [
    sourceExchange.on('delete', boundClose),
    destinationExchange.on('delete', boundClose),
  ];

  let consumer;
  const shovelHandler = this._onShovelMessage.bind(this);
  if (queue) {
    consumer = sourceBroker.subscribe(sourceExchangeName, routingKeyPattern, queue, shovelHandler, { consumerTag, priority });
  } else {
    consumer = sourceBroker.subscribeTmp(sourceExchangeName, routingKeyPattern, shovelHandler, { consumerTag, priority });
    this.source.queue = consumer.queue.name;
  }
  eventHandlers.push(consumer.on('cancel', boundClose));
}

Object.defineProperties(Shovel.prototype, {
  closed: {
    get() {
      return this[kClosed];
    },
  },
  consumerTag: {
    get() {
      return this[kConsumerTag];
    },
  },
});

Shovel.prototype.emit = function emit(eventName, content) {
  this.events.emit(`shovel.${eventName}`, content);
};

Shovel.prototype.on = function on(eventName, handler) {
  return this.events.on(`shovel.${eventName}`, handler);
};

Shovel.prototype.off = function off(eventName, handler) {
  return this.events.off(`shovel.${eventName}`, handler);
};

Shovel.prototype.close = function closeShovel() {
  if (this[kClosed]) return;
  this[kClosed] = true;
  for (const eh of this[kEventHandlers].splice(0)) eh.cancel();
  const events = this.events;
  this.emit('close', this);
  events.close();
  this[kSourceBroker].cancel(this[kConsumerTag]);
};

Shovel.prototype._messageHandler = function messageHandler(message) {
  const cloneMessage = this[kCloneMessage];
  if (!cloneMessage) return message;

  const { fields, content, properties } = message;
  const { content: newContent, properties: newProperties } = cloneMessage({
    fields: { ...fields },
    content,
    properties: { ...properties },
  });

  return {
    fields,
    content: newContent,
    properties: { ...properties, ...newProperties },
  };
};

Shovel.prototype._onShovelMessage = function onShovelMessage(routingKey, message) {
  const destinationExchange = this[kDestinationExchange];
  if (!destinationExchange.bindingCount && !message.properties.mandatory) return message.ack();

  const { content, properties } = this._messageHandler(message);
  const props = { ...properties, ...this.destination.publishProperties, 'source-exchange': this[kSourceExchange].name };
  if (!this[kBrokerInternal]) props['shovel-name'] = this.name;
  destinationExchange.publish(this.destination.exchangeKey || routingKey, content, props);
  message.ack();
};

export function Exchange2Exchange(shovel) {
  this[kE2EShovel] = shovel;
}

Object.defineProperties(Exchange2Exchange.prototype, {
  name: {
    get() {
      return this[kE2EShovel].name;
    },
  },
  source: {
    get() {
      return this[kE2EShovel].source.exchange;
    },
  },
  destination: {
    get() {
      return this[kE2EShovel].destination.exchange;
    },
  },
  pattern: {
    get() {
      return this[kE2EShovel].source.pattern;
    },
  },
  queue: {
    get() {
      return this[kE2EShovel].source.queue;
    },
  },
  consumerTag: {
    get() {
      return this[kE2EShovel].consumerTag;
    },
  },
});

Exchange2Exchange.prototype.on = function e2eon(...args) {
  return this[kE2EShovel].on(...args);
};

Exchange2Exchange.prototype.close = function e2eclose() {
  return this[kE2EShovel].close();
};
