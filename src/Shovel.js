import { EventExchange } from './Exchange.js';
import { SmqpError, ERR_SHOVEL_DESTINATION_EXCHANGE_NOT_FOUND, ERR_SHOVEL_SOURCE_EXCHANGE_NOT_FOUND } from './Errors.js';

/** @type {symbol} */
const kName = Symbol.for('name');
/** @type {symbol} */
const kBrokerInternal = Symbol.for('brokerInternal');
/** @type {symbol} */
const kCloneMessage = Symbol.for('cloneMessage');
/** @type {symbol} */
const kClosed = Symbol.for('closed');
/** @type {symbol} */
const kConsumerTag = Symbol.for('consumerTag');
/** @type {symbol} */
const kDestinationExchange = Symbol.for('destinationExchange');
/** @type {symbol} */
const kEventHandlers = Symbol.for('eventHandlers');
/** @type {symbol} */
const kSourceBroker = Symbol.for('sourceBroker');
/** @type {symbol} */
const kSourceExchange = Symbol.for('sourceExchange');
/** @type {symbol} */
const kE2EShovel = Symbol.for('shovel');

/**
 * Shovel — pipe messages from a source exchange to a destination exchange
 * @param {string} name unique shovel name
 * @param {import('#types').ShovelSource} source source spec
 * @param {import('#types').ShovelDestination} destination destination spec
 * @param {import('#types').ShovelOptions} [options] optional shovel options
 */
export function Shovel(name, source, destination, options) {
  if (!name || typeof name !== 'string') throw new TypeError('Shovel name is required and must be a string');

  const { broker: sourceBroker, exchange: sourceExchangeName, pattern, queue, priority } = source;
  const { broker: destinationBroker, exchange: destinationExchangeName } = destination;

  const sourceExchange = sourceBroker.getExchange(sourceExchangeName);
  if (!sourceExchange) {
    throw new SmqpError(`shovel ${name} source exchange <${sourceExchangeName}> not found`, ERR_SHOVEL_SOURCE_EXCHANGE_NOT_FOUND);
  }

  const destinationExchange = destinationBroker.getExchange(destinationExchangeName);
  if (!destinationExchange) {
    throw new SmqpError(
      `shovel ${name} destination exchange <${destinationExchangeName}> not found`,
      ERR_SHOVEL_DESTINATION_EXCHANGE_NOT_FOUND
    );
  }

  if (!(this instanceof Shovel)) {
    return new Shovel(name, source, destination, options);
  }

  this[kBrokerInternal] = sourceBroker === destinationBroker;
  const routingKeyPattern = pattern || '#';

  this[kName] = name;
  this.source = { ...source, pattern: routingKeyPattern };
  this.destination = { ...destination };
  /** @type {import('#types').ExchangeEventEmitter} */
  this.events = new EventExchange('shovel__events');

  const consumerTag = (this[kConsumerTag] = source.consumerTag || `smq.shoveltag-${name}`);
  this[kClosed] = false;
  this[kSourceBroker] = sourceBroker;
  this[kSourceExchange] = sourceExchange;
  this[kDestinationExchange] = destinationExchange;
  this[kCloneMessage] = options?.cloneMessage;

  const boundClose = this.close.bind(this);

  const eventHandlers = (this[kEventHandlers] = new Set([
    sourceExchange.on('delete', boundClose),
    destinationExchange.on('delete', boundClose),
  ]));

  let consumer;
  const shovelHandler = this._onShovelMessage.bind(this);
  if (queue) {
    consumer = sourceBroker.subscribe(sourceExchangeName, routingKeyPattern, queue, shovelHandler, { consumerTag, priority });
  } else {
    consumer = sourceBroker.subscribeTmp(sourceExchangeName, routingKeyPattern, shovelHandler, { consumerTag, priority });
    this.source.queue = consumer.queue.name;
  }
  eventHandlers.add(consumer.on('cancel', boundClose));
}

Object.defineProperties(Shovel.prototype, {
  name: {
    get() {
      return this[kName];
    },
  },
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

/**
 * Emit shovel event
 * @param {string} eventName event name (without `shovel.` prefix)
 * @param {any} [content] event payload
 */
Shovel.prototype.emit = function emit(eventName, content) {
  this.events.emit(`shovel.${eventName}`, content);
};

/**
 * Subscribe to shovel event
 * @param {string} eventName event name (without `shovel.` prefix)
 * @param {Function} handler event handler
 * @param {import('#types').ConsumeOptions} [options] optional consume options
 */
Shovel.prototype.on = function on(eventName, handler, options) {
  return this.events.on(`shovel.${eventName}`, handler, options);
};

/**
 * Unsubscribe from shovel event
 * @param {string} eventName event name previously passed to on
 * @param {Function | { consumerTag?: string }} handler the handler used in on, or an object with the consumer tag
 */
Shovel.prototype.off = function off(eventName, handler) {
  return this.events.off(`shovel.${eventName}`, handler);
};

/** Close shovel and cancel its source consumer */
Shovel.prototype.close = function closeShovel() {
  if (this[kClosed]) return;
  this[kClosed] = true;
  for (const eh of this[kEventHandlers]) eh.cancel();
  this[kEventHandlers].clear();
  const events = this.events;
  this.emit('close', this);
  events.close();
  this[kSourceBroker].cancel(this[kConsumerTag]);
};

/** @private */
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

/** @private */
Shovel.prototype._onShovelMessage = function onShovelMessage(routingKey, message) {
  const destinationExchange = this[kDestinationExchange];
  if (!destinationExchange.bindingCount && !message.properties.mandatory) return message.ack();

  const { content, properties } = this._messageHandler(message);
  const props = { ...properties, ...this.destination.publishProperties, 'source-exchange': this[kSourceExchange].name };
  if (!this[kBrokerInternal]) props['shovel-name'] = this[kName];
  destinationExchange.publish(this.destination.exchangeKey || routingKey, content, props);
  message.ack();
};

/**
 * Exchange-to-exchange shovel wrapper, returned by `broker.bindExchange`
 * @param {Shovel} shovel underlying shovel
 */
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

/**
 * Subscribe to underlying shovel events
 * @param {string} eventName event name (without `shovel.` prefix)
 * @param {Function} handler event handler
 */
Exchange2Exchange.prototype.on = function e2eon(eventName, handler) {
  return this[kE2EShovel].on(eventName, handler);
};

/** Close the underlying shovel */
Exchange2Exchange.prototype.close = function e2eclose() {
  return this[kE2EShovel].close();
};
