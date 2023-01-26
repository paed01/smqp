"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Shovel = Shovel;
var _Exchange = require("./Exchange");
const brokerInternalSymbol = Symbol.for('brokerInternal');
const cloneMessageSymbol = Symbol.for('cloneMessage');
const closedSymbol = Symbol.for('closed');
const consumerTagSymbol = Symbol.for('consumerTag');
const destinationExchangeSymbol = Symbol.for('destinationExchange');
const eventHandlersSymbol = Symbol.for('eventHandlers');
const sourceBrokerSymbol = Symbol.for('sourceBroker');
const sourceExchangeSymbol = Symbol.for('sourceExchange');
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
    exchange: destinationExchangeName
  } = destination;
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
  this[brokerInternalSymbol] = sourceBroker === destinationBroker;
  const routingKeyPattern = pattern || '#';
  this.name = name;
  this.source = {
    ...source,
    pattern: routingKeyPattern
  };
  this.destination = {
    ...destination
  };
  this.events = new _Exchange.EventExchange('shovel__events');
  const consumerTag = this[consumerTagSymbol] = source.consumerTag || `smq.shoveltag-${name}`;
  this[closedSymbol] = false;
  this[sourceBrokerSymbol] = sourceBroker;
  this[sourceExchangeSymbol] = sourceExchange;
  this[destinationExchangeSymbol] = destinationExchange;
  this[cloneMessageSymbol] = options.cloneMessage;
  const boundClose = this.close.bind(this);
  const eventHandlers = this[eventHandlersSymbol] = [sourceExchange.on('delete', boundClose), destinationExchange.on('delete', boundClose)];
  let consumer;
  const shovelHandler = this._onShovelMessage.bind(this);
  if (queue) {
    consumer = sourceBroker.subscribe(sourceExchangeName, routingKeyPattern, queue, shovelHandler, {
      consumerTag,
      priority
    });
  } else {
    consumer = sourceBroker.subscribeTmp(sourceExchangeName, routingKeyPattern, shovelHandler, {
      consumerTag,
      priority
    });
    this.source.queue = consumer.queue.name;
  }
  eventHandlers.push(consumer.on('cancel', boundClose));
}
Object.defineProperty(Shovel.prototype, 'closed', {
  enumerable: true,
  get() {
    return this[closedSymbol];
  }
});
Object.defineProperty(Shovel.prototype, 'consumerTag', {
  enumerable: true,
  get() {
    return this[consumerTagSymbol];
  }
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
  if (this[closedSymbol]) return;
  this[closedSymbol] = true;
  this[eventHandlersSymbol].splice(0).forEach(e => e.cancel());
  const events = this.events;
  this.emit('close', this);
  events.close();
  this[sourceBrokerSymbol].cancel(this[consumerTagSymbol]);
};
Shovel.prototype._messageHandler = function messageHandler(message) {
  const cloneMessage = this[cloneMessageSymbol];
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
    fields: {
      ...fields
    },
    content,
    properties: {
      ...properties
    }
  });
  return {
    fields,
    content: newContent,
    properties: {
      ...properties,
      ...newProperties
    }
  };
};
Shovel.prototype._onShovelMessage = function onShovelMessage(routingKey, message) {
  const {
    content,
    properties
  } = this._messageHandler(message);
  const props = {
    ...properties,
    ...this.destination.publishProperties,
    'source-exchange': this[sourceExchangeSymbol].name
  };
  if (!this[brokerInternalSymbol]) props['shovel-name'] = this.name;
  this[destinationExchangeSymbol].publish(this.destination.exchangeKey || routingKey, content, props);
  message.ack();
};