"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Broker = Broker;
var _Exchange = require("./Exchange.js");
var _Queue = require("./Queue.js");
var _Shovel = require("./Shovel.js");
var _shared = require("./shared.js");
var _Errors = require("./Errors.js");
const kEntities = Symbol.for('entities');
const kEventHandler = Symbol.for('eventHandler');
function Broker(owner) {
  if (!(this instanceof Broker)) {
    return new Broker(owner);
  }
  this.owner = owner;
  this.events = new _Exchange.EventExchange('broker__events');
  const entities = this[kEntities] = {
    exchanges: [],
    queues: [],
    consumers: [],
    shovels: []
  };
  this[kEventHandler] = new EventHandler(this, entities);
}
Object.defineProperties(Broker.prototype, {
  exchangeCount: {
    get() {
      return this[kEntities].exchanges.length;
    }
  },
  queueCount: {
    get() {
      return this[kEntities].queues.length;
    }
  },
  consumerCount: {
    get() {
      return this[kEntities].consumers.length;
    }
  }
});
Broker.prototype.subscribe = function subscribe(exchangeName, pattern, queueName, onMessage, options = {
  durable: true
}) {
  if (!exchangeName || !pattern || typeof onMessage !== 'function') throw new TypeError('exchange name, pattern, and message callback are required');
  if (options && options.consumerTag) this.validateConsumerTag(options.consumerTag);
  const exchange = this.assertExchange(exchangeName);
  const queue = this.assertQueue(queueName, options);
  exchange.bindQueue(queue, pattern, options);
  return queue.assertConsumer(onMessage, options, this.owner);
};
Broker.prototype.subscribeTmp = function subscribeTmp(exchangeName, pattern, onMessage, options) {
  return this.subscribe(exchangeName, pattern, null, onMessage, {
    ...options,
    durable: false
  });
};
Broker.prototype.subscribeOnce = function subscribeOnce(exchangeName, pattern, onMessage, options = {}) {
  if (typeof onMessage !== 'function') throw new TypeError('message callback is required');
  if (options && options.consumerTag) this.validateConsumerTag(options.consumerTag);
  const exchange = this.assertExchange(exchangeName);
  const onceOptions = {
    autoDelete: true,
    durable: false,
    priority: options.priority || 0
  };
  const onceQueue = this.createQueue(null, onceOptions);
  exchange.bindQueue(onceQueue, pattern, onceOptions);
  return this.consume(onceQueue.name, wrappedOnMessage, {
    noAck: true,
    consumerTag: options.consumerTag
  });
  function wrappedOnMessage(...args) {
    onceQueue.delete();
    onMessage(...args);
  }
};
Broker.prototype.unsubscribe = function unsubscribe(queueName, onMessage) {
  const queue = this.getQueue(queueName);
  if (!queue) return;
  queue.dismiss(onMessage);
};
Broker.prototype.assertExchange = function assertExchange(exchangeName, type, options) {
  let exchange = this.getExchange(exchangeName);
  if (exchange) {
    if (type && exchange.type !== type) throw new _Errors.SmqpError('Type doesn\'t match', _Errors.ERR_EXCHANGE_TYPE_MISMATCH);
    return exchange;
  }
  exchange = new _Exchange.Exchange(exchangeName, type || 'topic', options);
  this[kEventHandler].listen(exchange.events);
  this[kEntities].exchanges.push(exchange);
  return exchange;
};
Broker.prototype.bindQueue = function bindQueue(queueName, exchangeName, pattern, bindOptions) {
  const exchange = this.getExchange(exchangeName);
  const queue = this.getQueue(queueName);
  return exchange.bindQueue(queue, pattern, bindOptions);
};
Broker.prototype.unbindQueue = function unbindQueue(queueName, exchangeName, pattern) {
  const exchange = this.getExchange(exchangeName);
  if (!exchange) return;
  const queue = this.getQueue(queueName);
  if (!queue) return;
  exchange.unbindQueue(queue, pattern);
};
Broker.prototype.consume = function consume(queueName, onMessage, options) {
  const queue = this.getQueue(queueName);
  if (!queue) throw new _Errors.SmqpError(`Queue with name <${queueName}> was not found`, _Errors.ERR_QUEUE_NOT_FOUND);
  if (options) this.validateConsumerTag(options.consumerTag);
  return queue.consume(onMessage, options, this.owner);
};
Broker.prototype.cancel = function cancel(consumerTag, requeue = true) {
  const consumer = this.getConsumer(consumerTag);
  if (!consumer) return false;
  consumer.cancel(requeue);
  return true;
};
Broker.prototype.getConsumers = function getConsumers() {
  return this[kEntities].consumers.map(consumer => {
    return {
      queue: consumer.queue.name,
      consumerTag: consumer.options.consumerTag,
      options: {
        ...consumer.options
      }
    };
  });
};
Broker.prototype.getConsumer = function getConsumer(consumerTag) {
  return this[kEntities].consumers.find(c => c.consumerTag === consumerTag);
};
Broker.prototype.getExchange = function getExchange(exchangeName) {
  if (typeof exchangeName !== 'string') throw new TypeError('exchange name must be a string');
  return this[kEntities].exchanges.find(({
    name
  }) => name === exchangeName);
};
Broker.prototype.deleteExchange = function deleteExchange(exchangeName, {
  ifUnused
} = {}) {
  if (typeof exchangeName !== 'string') throw new TypeError('exchange name must be a string');
  const exchanges = this[kEntities].exchanges;
  const idx = exchanges.findIndex(exchange => exchange.name === exchangeName);
  if (idx === -1) return false;
  const exchange = exchanges[idx];
  if (ifUnused && exchange.bindingCount) return false;
  exchanges.splice(idx, 1);
  exchange.close();
  return true;
};
Broker.prototype.stop = function stop() {
  const {
    exchanges,
    queues
  } = this[kEntities];
  for (const exchange of exchanges) exchange.stop();
  for (const queue of queues) queue.stop();
};
Broker.prototype.close = function close() {
  const {
    shovels,
    exchanges,
    queues
  } = this[kEntities];
  for (const shovel of shovels) shovel.close();
  for (const exchange of exchanges) exchange.close();
  for (const queue of queues) queue.close();
};
Broker.prototype.reset = function reset() {
  this.stop();
  this.close();
  const {
    exchanges,
    queues,
    consumers,
    shovels
  } = this[kEntities];
  exchanges.splice(0);
  queues.splice(0);
  consumers.splice(0);
  shovels.splice(0);
};
Broker.prototype.getState = function getState(onlyWithContent) {
  const exchanges = this._getExchangeState(onlyWithContent);
  const queues = this._getQueuesState(onlyWithContent);
  if (onlyWithContent && !exchanges && !queues) return;
  return {
    exchanges,
    queues
  };
};
Broker.prototype.recover = function recover(state) {
  const boundGetQueue = this.getQueue.bind(this);
  if (state) {
    if (state.queues) {
      for (const qState of state.queues) this.assertQueue(qState.name, qState.options).recover(qState);
    }
    if (state.exchanges) for (const eState of state.exchanges) this.assertExchange(eState.name, eState.type, eState.options).recover(eState, boundGetQueue);
  } else {
    const {
      queues,
      exchanges
    } = this[kEntities];
    for (const queue of queues) {
      if (queue.stopped) queue.recover();
    }
    for (const exchange of exchanges) {
      if (exchange.stopped) exchange.recover(null, boundGetQueue);
    }
  }
  return this;
};
Broker.prototype.bindExchange = function bindExchange(source, destination, pattern = '#', args = {}) {
  const name = `e2e-${source}2${destination}-${pattern}`;
  const {
    priority
  } = args;
  const shovel = this.createShovel(name, {
    broker: this,
    exchange: source,
    pattern,
    priority,
    consumerTag: `smq.ctag-${name}`
  }, {
    broker: this,
    exchange: destination
  }, {
    ...args
  });
  return new _Shovel.Exchange2Exchange(shovel);
};
Broker.prototype.unbindExchange = function unbindExchange(source, destination, pattern = '#') {
  const name = `e2e-${source}2${destination}-${pattern}`;
  return this.closeShovel(name);
};
Broker.prototype.publish = function publish(exchangeName, routingKey, content, options) {
  const exchange = this.getExchange(exchangeName);
  if (!exchange) return;
  return exchange.publish(routingKey, content, options);
};
Broker.prototype.purgeQueue = function purgeQueue(queueName) {
  const queue = this.getQueue(queueName);
  if (!queue) return;
  return queue.purge();
};
Broker.prototype.sendToQueue = function sendToQueue(queueName, content, options = {}) {
  const queue = this.getQueue(queueName);
  if (!queue) throw new _Errors.SmqpError(`Queue with name <${queueName}> was not found`, _Errors.ERR_QUEUE_NOT_FOUND);
  return queue.queueMessage(null, content, options);
};
Broker.prototype._getQueuesState = function getQueuesState(onlyWithContent) {
  let result;
  for (const queue of this[kEntities].queues) {
    if (!queue.options.durable) continue;
    if (onlyWithContent && !queue.messageCount) continue;
    if (!result) result = [];
    result.push(queue.getState());
  }
  return result;
};
Broker.prototype._getExchangeState = function getExchangeState(onlyWithContent) {
  let result;
  for (const exchange of this[kEntities].exchanges) {
    if (!exchange.options.durable) continue;
    if (onlyWithContent && !exchange.undeliveredCount) continue;
    if (!result) result = [];
    result.push(exchange.getState());
  }
  return result;
};
Broker.prototype.createQueue = function createQueue(queueName, options) {
  if (queueName && typeof queueName !== 'string') throw new TypeError('queue name must be a string');else if (!queueName) queueName = `smq.qname-${(0, _shared.generateId)()}`;else if (this.getQueue(queueName)) throw new _Errors.SmqpError(`Queue named ${queueName} already exists`, _Errors.ERR_QUEUE_NAME_CONFLICT);
  const queueEmitter = new _Exchange.EventExchange(`${queueName}__events`);
  this[kEventHandler].listen(queueEmitter);
  const queue = new _Queue.Queue(queueName, options, queueEmitter);
  this[kEntities].queues.push(queue);
  return queue;
};
Broker.prototype.getQueue = function getQueue(queueName) {
  if (!queueName || typeof queueName !== 'string') throw new TypeError('queue name must be a string');
  const queues = this[kEntities].queues;
  const idx = queues.findIndex(queue => queue.name === queueName);
  if (idx > -1) return queues[idx];
};
Broker.prototype.assertQueue = function assertQueue(queueName, options = {}) {
  if (queueName && typeof queueName !== 'string') throw new TypeError('queue name must be a string');else if (!queueName) return this.createQueue(null, options);
  const queue = this.getQueue(queueName);
  options = {
    durable: true,
    ...options
  };
  if (!queue) return this.createQueue(queueName, options);
  if (queue.options.durable !== options.durable) throw new _Errors.SmqpError('Durable doesn\'t match', _Errors.ERR_QUEUE_DURABLE_MISMATCH);
  return queue;
};
Broker.prototype.deleteQueue = function deleteQueue(queueName, options) {
  const queue = this.getQueue(queueName);
  if (!queue) return;
  return queue.delete(options);
};
Broker.prototype.get = function getMessageFromQueue(queueName, {
  noAck
} = {}) {
  const queue = this.getQueue(queueName);
  if (!queue) return;
  return queue.get({
    noAck
  });
};
Broker.prototype.ack = function ack(message, allUpTo) {
  message.ack(allUpTo);
};
Broker.prototype.ackAll = function ackAll() {
  for (const queue of this[kEntities].queues) queue.ackAll();
};
Broker.prototype.nack = function nack(message, allUpTo, requeue) {
  message.nack(allUpTo, requeue);
};
Broker.prototype.nackAll = function nackAll(requeue) {
  for (const queue of this[kEntities].queues) queue.nackAll(requeue);
};
Broker.prototype.reject = function reject(message, requeue) {
  message.reject(requeue);
};
Broker.prototype.validateConsumerTag = function validateConsumerTag(consumerTag) {
  if (!consumerTag) return true;
  if (this.getConsumer(consumerTag)) {
    throw new _Errors.SmqpError(`Consumer tag must be unique, ${consumerTag} is occupied`, _Errors.ERR_CONSUMER_TAG_CONFLICT);
  }
  return true;
};
Broker.prototype.createShovel = function createShovel(name, source, destination, options) {
  const shovels = this[kEntities].shovels;
  if (this.getShovel(name)) throw new _Errors.SmqpError(`Shovel name must be unique, ${name} is occupied`, _Errors.ERR_SHOVEL_NAME_CONFLICT);
  const shovel = new _Shovel.Shovel(name, {
    ...source,
    broker: this
  }, destination, options);
  this[kEventHandler].listen(shovel.events);
  shovels.push(shovel);
  return shovel;
};
Broker.prototype.closeShovel = function closeShovel(name) {
  const shovel = this.getShovel(name);
  if (shovel) {
    shovel.close();
    return true;
  }
  return false;
};
Broker.prototype.getShovel = function getShovel(name) {
  return this[kEntities].shovels.find(s => s.name === name);
};
Broker.prototype.getShovels = function getShovels() {
  return this[kEntities].shovels.slice();
};
Broker.prototype.on = function on(eventName, callback, options) {
  return this.events.on(eventName, getEventCallback(), {
    ...options,
    origin: callback
  });
  function getEventCallback() {
    return function eventCallback(name, msg) {
      callback({
        name,
        ...msg.content
      });
    };
  }
};
Broker.prototype.off = function off(eventName, callbackOrObject) {
  const {
    consumerTag
  } = callbackOrObject;
  for (const binding of this.events.bindings) {
    if (binding.pattern === eventName) {
      if (consumerTag) {
        binding.queue.cancel(consumerTag);
        continue;
      }
      for (const consumer of binding.queue.consumers) {
        if (consumer.options && consumer.options.origin === callbackOrObject) {
          consumer.cancel();
        }
      }
    }
  }
};
Broker.prototype.prefetch = function prefetch() {};
function EventHandler(broker, entities) {
  this.broker = broker;
  this.entities = entities;
  this.handler = this.handler.bind(this);
}
EventHandler.prototype.listen = function listen(emitter) {
  emitter.on('#', this.handler);
};
EventHandler.prototype.handler = function eventHandler(eventName, msg) {
  switch (eventName) {
    case 'exchange.delete':
      {
        const exchanges = this.entities.exchanges;
        const idx = exchanges.indexOf(msg.content);
        if (idx === -1) return;
        exchanges.splice(idx, 1);
        break;
      }
    case 'exchange.return':
      {
        this.broker.events.publish('return', msg.content);
        break;
      }
    case 'exchange.message.undelivered':
      {
        this.broker.events.publish('message.undelivered', msg.content);
        break;
      }
    case 'queue.delete':
      {
        const queues = this.entities.queues;
        const idx = queues.indexOf(msg.content);
        if (idx === -1) return;
        queues.splice(idx, 1);
        break;
      }
    case 'queue.dead-letter':
      {
        const exchange = this.broker.getExchange(msg.content.deadLetterExchange);
        if (!exchange) return;
        const {
          fields,
          content,
          properties
        } = msg.content.message;
        exchange.publish(fields.routingKey, content, properties);
        break;
      }
    case 'queue.consume':
      {
        this.entities.consumers.push(msg.content);
        break;
      }
    case 'queue.consumer.cancel':
      {
        const consumers = this.entities.consumers;
        const idx = consumers.indexOf(msg.content);
        if (idx !== -1) consumers.splice(idx, 1);
        break;
      }
    case 'queue.message.consumed.ack':
    case 'queue.message.consumed.nack':
      {
        const {
          operation,
          message
        } = msg.content;
        this.broker.events.publish(`message.${operation}`, message);
        break;
      }
    case 'shovel.close':
      {
        const shovels = this.entities.shovels;
        const idx = shovels.indexOf(msg.content);
        if (idx > -1) shovels.splice(idx, 1);
        break;
      }
  }
};