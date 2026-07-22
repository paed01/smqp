import { EventExchange } from './Exchange.js';
import { SmqpError, ERR_SHOVEL_DESTINATION_EXCHANGE_NOT_FOUND, ERR_SHOVEL_SOURCE_EXCHANGE_NOT_FOUND } from './Errors.js';
import { K_NAME } from './constants.js';

const K_BROKER_INTERNAL = Symbol.for('brokerInternal');
const K_CLONE_MESSAGE = Symbol.for('cloneMessage');
const K_CLOSED = Symbol.for('closed');
const K_CONSUMER_TAG = Symbol.for('consumerTag');
const K_DESTINATION_EXCHANGE = Symbol.for('destinationExchange');
const K_EVENT_HANDLERS = Symbol.for('eventHandlers');
const K_SOURCE_BROKER = Symbol.for('sourceBroker');
const K_SOURCE_EXCHANGE = Symbol.for('sourceExchange');
const K_E2E_SHOVEL = Symbol.for('shovel');

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

  /** @internal */
  this[K_BROKER_INTERNAL] = sourceBroker === destinationBroker;
  const routingKeyPattern = pattern || '#';

  /** @internal */
  this[K_NAME] = name;
  this.source = { ...source, pattern: routingKeyPattern };
  this.destination = { ...destination };
  /** @type {import('#types').ExchangeEventEmitter} */
  this.events = new EventExchange('shovel__events');

  const consumerTag = source.consumerTag || `smq.shoveltag-${name}`;
  /** @internal */
  this[K_CONSUMER_TAG] = consumerTag;
  /** @internal */
  this[K_CLOSED] = false;
  /** @internal */
  this[K_SOURCE_BROKER] = sourceBroker;
  /** @internal */
  this[K_SOURCE_EXCHANGE] = sourceExchange;
  /** @internal */
  this[K_DESTINATION_EXCHANGE] = destinationExchange;
  /** @internal */
  this[K_CLONE_MESSAGE] = options?.cloneMessage;

  const boundClose = this.close.bind(this);

  const eventHandlers = (this[K_EVENT_HANDLERS] = new Set([
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
      return this[K_NAME];
    },
  },
  closed: {
    get() {
      return this[K_CLOSED];
    },
  },
  consumerTag: {
    get() {
      return this[K_CONSUMER_TAG];
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
  if (this[K_CLOSED]) return;
  this[K_CLOSED] = true;
  for (const eh of this[K_EVENT_HANDLERS]) eh.cancel();
  this[K_EVENT_HANDLERS].clear();
  const events = this.events;
  this.emit('close', this);
  events.close();
  this[K_SOURCE_BROKER].cancel(this[K_CONSUMER_TAG]);
};

/** @private */
Shovel.prototype._messageHandler = function messageHandler(message) {
  const cloneMessage = this[K_CLONE_MESSAGE];
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
  const destinationExchange = this[K_DESTINATION_EXCHANGE];
  if (!destinationExchange.bindingCount && !message.properties.mandatory) return message.ack();

  const { content, properties } = this._messageHandler(message);
  const props = { ...properties, ...this.destination.publishProperties, 'source-exchange': this[K_SOURCE_EXCHANGE].name };
  if (!this[K_BROKER_INTERNAL]) props['shovel-name'] = this[K_NAME];
  destinationExchange.publish(this.destination.exchangeKey || routingKey, content, props);
  message.ack();
};

/**
 * Exchange-to-exchange shovel wrapper, returned by `broker.bindExchange`
 * @param {Shovel} shovel underlying shovel
 */
export function Exchange2Exchange(shovel) {
  /** @internal */
  this[K_E2E_SHOVEL] = shovel;
}

Object.defineProperties(Exchange2Exchange.prototype, {
  name: {
    get() {
      return this[K_E2E_SHOVEL].name;
    },
  },
  source: {
    get() {
      return this[K_E2E_SHOVEL].source.exchange;
    },
  },
  destination: {
    get() {
      return this[K_E2E_SHOVEL].destination.exchange;
    },
  },
  pattern: {
    get() {
      return this[K_E2E_SHOVEL].source.pattern;
    },
  },
  queue: {
    get() {
      return this[K_E2E_SHOVEL].source.queue;
    },
  },
  consumerTag: {
    get() {
      return this[K_E2E_SHOVEL].consumerTag;
    },
  },
});

/**
 * Subscribe to underlying shovel events
 * @param {string} eventName event name (without `shovel.` prefix)
 * @param {Function} handler event handler
 * @returns {import('./Queue.js').Consumer}
 */
Exchange2Exchange.prototype.on = function e2eon(eventName, handler) {
  return this[K_E2E_SHOVEL].on(eventName, handler);
};

/** Close the underlying shovel */
Exchange2Exchange.prototype.close = function e2eclose() {
  this[K_E2E_SHOVEL].close();
};
