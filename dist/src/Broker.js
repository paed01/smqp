"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Broker = Broker;

var _Exchange = require("./Exchange");

var _Queue = require("./Queue");

var _Shovel = require("./Shovel");

const exchangesSymbol = Symbol.for('exchanges');
const queuesSymbol = Symbol.for('queues');
const consumersSymbol = Symbol.for('consumers');
const shovelsSymbol = Symbol.for('shovels');
const eventHandlerSymbol = Symbol.for('eventHandler');

function Broker(owner) {
  if (!(this instanceof Broker)) {
    return new Broker(owner);
  }

  this.owner = owner;
  this.events = new _Exchange.EventExchange('broker__events');
  const exchanges = this[exchangesSymbol] = [];
  const queues = this[queuesSymbol] = [];
  const consumers = this[consumersSymbol] = [];
  const shovels = this[shovelsSymbol] = [];
  this[eventHandlerSymbol] = new EventHandler(this, {
    exchanges,
    queues,
    consumers,
    shovels
  });
}

Object.defineProperty(Broker.prototype, 'exchangeCount', {
  enumerable: true,

  get() {
    return this[exchangesSymbol].length;
  }

});
Object.defineProperty(Broker.prototype, 'queueCount', {
  enumerable: true,

  get() {
    return this[queuesSymbol].length;
  }

});
Object.defineProperty(Broker.prototype, 'consumerCount', {
  enumerable: true,

  get() {
    return this[consumersSymbol].length;
  }

});

Broker.prototype.subscribe = function subscribe(exchangeName, pattern, queueName, onMessage, options = {
  durable: true
}) {
  if (!exchangeName || !pattern || typeof onMessage !== 'function') throw new Error('exchange name, pattern, and message callback are required');
  if (options && options.consumerTag) this.validateConsumerTag(options.consumerTag);
  const exchange = this.assertExchange(exchangeName);
  const queue = this.assertQueue(queueName, options);
  exchange.bind(queue, pattern, options);
  return queue.assertConsumer(onMessage, options, this.owner);
};

Broker.prototype.subscribeTmp = function subscribeTmp(exchangeName, pattern, onMessage, options) {
  return this.subscribe(exchangeName, pattern, null, onMessage, { ...options,
    durable: false
  });
};

Broker.prototype.subscribeOnce = function subscribeOnce(exchangeName, pattern, onMessage, options = {}) {
  if (typeof onMessage !== 'function') throw new Error('message callback is required');
  if (options && options.consumerTag) this.validateConsumerTag(options.consumerTag);
  const exchange = this.assertExchange(exchangeName);
  const onceOptions = {
    autoDelete: true,
    durable: false,
    priority: options.priority || 0
  };
  const onceQueue = this.createQueue(null, onceOptions);
  exchange.bind(onceQueue, pattern, onceOptions);
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
  let exchange = this.getExchangeByName(exchangeName);

  if (exchange) {
    if (type && exchange.type !== type) throw new Error('Type doesn\'t match');
    return exchange;
  }

  exchange = new _Exchange.Exchange(exchangeName, type || 'topic', options);
  this[eventHandlerSymbol].listen(exchange.events);
  this[exchangesSymbol].push(exchange);
  return exchange;
};

Broker.prototype.getExchangeByName = function getExchangeByName(exchangeName) {
  return this[exchangesSymbol].find(exchange => exchange.name === exchangeName);
};

Broker.prototype.bindQueue = function bindQueue(queueName, exchangeName, pattern, bindOptions) {
  const exchange = this.getExchange(exchangeName);
  const queue = this.getQueue(queueName);
  exchange.bind(queue, pattern, bindOptions);
};

Broker.prototype.unbindQueue = function unbindQueue(queueName, exchangeName, pattern) {
  const exchange = this.getExchange(exchangeName);
  if (!exchange) return;
  const queue = this.getQueue(queueName);
  if (!queue) return;
  exchange.unbind(queue, pattern);
};

Broker.prototype.consume = function consume(queueName, onMessage, options) {
  const queue = this.getQueue(queueName);
  if (!queue) throw new Error(`Queue with name <${queueName}> was not found`);
  if (options) this.validateConsumerTag(options.consumerTag);
  return queue.consume(onMessage, options, this.owner);
};

Broker.prototype.cancel = function cancel(consumerTag) {
  const consumer = this.getConsumer(consumerTag);
  if (!consumer) return false;
  consumer.cancel(false);
  return true;
};

Broker.prototype.getConsumers = function getConsumers() {
  return this[consumersSymbol].map(consumer => {
    return {
      queue: consumer.queue.name,
      consumerTag: consumer.options.consumerTag,
      options: { ...consumer.options
      }
    };
  });
};

Broker.prototype.getConsumer = function getConsumer(consumerTag) {
  return this[consumersSymbol].find(c => c.consumerTag === consumerTag);
};

Broker.prototype.getExchange = function getExchange(exchangeName) {
  return this[exchangesSymbol].find(({
    name
  }) => name === exchangeName);
};

Broker.prototype.deleteExchange = function deleteExchange(exchangeName, {
  ifUnused
} = {}) {
  const exchanges = this[exchangesSymbol];
  const idx = exchanges.findIndex(exchange => exchange.name === exchangeName);
  if (idx === -1) return false;
  const exchange = exchanges[idx];
  if (ifUnused && exchange.bindingCount) return false;
  exchanges.splice(idx, 1);
  exchange.close();
  return true;
};

Broker.prototype.stop = function stop() {
  for (const exchange of this[exchangesSymbol]) exchange.stop();

  for (const queue of this[queuesSymbol]) queue.stop();
};

Broker.prototype.close = function close() {
  for (const shovel of this[shovelsSymbol]) shovel.close();

  for (const exchange of this[exchangesSymbol]) exchange.close();

  for (const queue of this[queuesSymbol]) queue.close();
};

Broker.prototype.reset = function reset() {
  this.stop();
  this.close();
  this[exchangesSymbol].splice(0);
  this[queuesSymbol].splice(0);
  this[consumersSymbol].splice(0);
  this[shovelsSymbol].splice(0);
};

Broker.prototype.getState = function getState(onlyWithContent) {
  const exchanges = this.getExchangeState(onlyWithContent);
  const queues = this.getQueuesState(onlyWithContent);
  if (onlyWithContent && !exchanges && !queues) return;
  return {
    exchanges,
    queues
  };
};

Broker.prototype.recover = function recover(state) {
  const self = this;
  const boundGetQueue = self.getQueue.bind(self);

  if (state) {
    if (state.queues) for (const qState of state.queues) recoverQueue(qState);
    if (state.exchanges) for (const eState of state.exchanges) recoverExchange(eState);
  } else {
    for (const queue of self[queuesSymbol]) {
      if (queue.stopped) queue.recover();
    }

    for (const exchange of self[exchangesSymbol]) {
      if (exchange.stopped) exchange.recover(null, boundGetQueue);
    }
  }

  return self;

  function recoverQueue(qState) {
    const queue = self.assertQueue(qState.name, qState.options);
    queue.recover(qState);
  }

  function recoverExchange(eState) {
    const exchange = self.assertExchange(eState.name, eState.type, eState.options);
    exchange.recover(eState, boundGetQueue);
  }
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
  }, { ...args
  });
  const {
    consumerTag,
    source: shovelSource
  } = shovel;
  return {
    name,
    source,
    destination,
    queue: shovelSource.queue,
    consumerTag,

    on(...onargs) {
      return shovel.on(...onargs);
    },

    close() {
      return shovel.close();
    }

  };
};

Broker.prototype.unbindExchange = function unbindExchange(source, destination, pattern = '#') {
  const name = `e2e-${source}2${destination}-${pattern}`;
  return this.closeShovel(name);
};

Broker.prototype.publish = function publish(exchangeName, routingKey, content, options) {
  const exchange = this.getExchangeByName(exchangeName);
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
  if (!queue) throw new Error(`Queue named ${queueName} doesn't exists`);
  return queue.queueMessage(null, content, options);
};

Broker.prototype.getQueuesState = function getQueuesState(onlyWithContent) {
  return this[queuesSymbol].reduce((result, queue) => {
    if (!queue.options.durable) return result;
    if (onlyWithContent && !queue.messageCount) return result;
    if (!result) result = [];
    result.push(queue.getState());
    return result;
  }, undefined);
};

Broker.prototype.getExchangeState = function getExchangeState(onlyWithContent) {
  return this[exchangesSymbol].reduce((result, exchange) => {
    if (!exchange.options.durable) return result;
    if (onlyWithContent && !exchange.undeliveredCount) return result;
    if (!result) result = [];
    result.push(exchange.getState());
    return result;
  }, undefined);
};

Broker.prototype.createQueue = function createQueue(queueName, options) {
  const self = this;
  if (self.getQueue(queueName)) throw new Error(`Queue named ${queueName} already exists`);
  const queueEmitter = (0, _Exchange.EventExchange)(queueName + '__events');
  this[eventHandlerSymbol].listen(queueEmitter);
  const queue = new _Queue.Queue(queueName, options, queueEmitter);
  self[queuesSymbol].push(queue);
  return queue;
};

Broker.prototype.getQueue = function getQueue(queueName) {
  if (!queueName) return;
  const queues = this[queuesSymbol];
  const idx = queues.findIndex(queue => queue.name === queueName);
  if (idx > -1) return queues[idx];
};

Broker.prototype.assertQueue = function assertQueue(queueName, options = {}) {
  if (!queueName) return this.createQueue(null, options);
  const queue = this.getQueue(queueName);
  options = {
    durable: true,
    ...options
  };
  if (!queue) return this.createQueue(queueName, options);
  if (queue.options.durable !== options.durable) throw new Error('Durable doesn\'t match');
  return queue;
};

Broker.prototype.deleteQueue = function deleteQueue(queueName, options) {
  if (!queueName) return false;
  const queue = this.getQueue(queueName);
  if (!queue) return false;
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
  for (const queue of this[queuesSymbol]) queue.ackAll();
};

Broker.prototype.nack = function nack(message, allUpTo, requeue) {
  message.nack(allUpTo, requeue);
};

Broker.prototype.nackAll = function nackAll(requeue) {
  for (const queue of this[queuesSymbol]) queue.nackAll(requeue);
};

Broker.prototype.reject = function reject(message, requeue) {
  message.reject(requeue);
};

Broker.prototype.validateConsumerTag = function validateConsumerTag(consumerTag) {
  if (!consumerTag) return true;

  if (this.getConsumer(consumerTag)) {
    throw new Error(`Consumer tag must be unique, ${consumerTag} is occupied`);
  }

  return true;
};

Broker.prototype.createShovel = function createShovel(name, source, destination, options) {
  const shovels = this[shovelsSymbol];
  if (this.getShovel(name)) throw new Error(`Shovel name must be unique, ${name} is occupied`);
  const shovel = new _Shovel.Shovel(name, { ...source,
    broker: this
  }, destination, options);
  this[eventHandlerSymbol].listen(shovel.events);
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
  return this[shovelsSymbol].find(s => s.name === name);
};

Broker.prototype.on = function on(eventName, callback, options) {
  return this.events.on(eventName, getEventCallback(), { ...options,
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

function EventHandler(broker, lists) {
  this.broker = broker;
  this.lists = lists;
  this.handler = this.handler.bind(this);
}

EventHandler.prototype.listen = function listen(emitter) {
  emitter.on('#', this.handler);
};

EventHandler.prototype.handler = function eventHandler(eventName, msg) {
  switch (eventName) {
    case 'exchange.delete':
      {
        const idx = this.lists.exchanges.indexOf(msg.content);
        if (idx === -1) return;
        this.lists.exchanges.splice(idx, 1);
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
        const idx = this.lists.queues.indexOf(msg.content);
        if (idx === -1) return;
        this.lists.queues.splice(idx, 1);
        break;
      }

    case 'queue.dead-letter':
      {
        const exchange = this.broker.getExchange(msg.content.deadLetterExchange);
        if (!exchange) return;
        exchange.publish(msg.content.message.fields.routingKey, msg.content.message.content, msg.content.message.properties);
        break;
      }

    case 'queue.consume':
      {
        this.lists.consumers.push(msg.content);
        break;
      }

    case 'queue.consumer.cancel':
      {
        const idx = this.lists.consumers.indexOf(msg.content);
        if (idx !== -1) this.lists.consumers.splice(idx, 1);
        break;
      }

    case 'queue.message.consumed.ack':
    case 'queue.message.consumed.nack':
      {
        const {
          operation,
          message
        } = msg.content;
        this.broker.events.publish('message.' + operation, message);
        break;
      }

    case 'shovel.close':
      {
        const idx = this.lists.shovels.indexOf(msg.content);
        if (idx > -1) this.lists.shovels.splice(idx, 1);
        break;
      }
  }
};