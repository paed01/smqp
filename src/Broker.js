import { Exchange, EventExchange } from './Exchange.js';
import { Queue } from './Queue.js';
import { Shovel, Exchange2Exchange } from './Shovel.js';
import { generateId } from './shared.js';
import {
  SmqpError,
  ERR_EXCHANGE_TYPE_MISMATCH,
  ERR_QUEUE_DURABLE_MISMATCH,
  ERR_CONSUMER_TAG_CONFLICT,
  ERR_QUEUE_NAME_CONFLICT,
  ERR_SHOVEL_NAME_CONFLICT,
  ERR_QUEUE_NOT_FOUND,
} from './Errors.js';

const kEntities = Symbol.for('entities');
const kEventHandler = Symbol.for('eventHandler');

export function Broker(owner) {
  if (!(this instanceof Broker)) {
    return new Broker(owner);
  }
  this.owner = owner;
  const events = (this.events = new EventExchange('broker__events'));
  const entities = (this[kEntities] = new Map([
    ['exchanges', new Map()],
    ['queues', new Map()],
    ['consumers', new Map()],
    ['shovels', new Map()],
  ]));
  this[kEventHandler] = new BrokerEventHandler(events, entities);
}

Object.defineProperties(Broker.prototype, {
  exchangeCount: {
    get() {
      return this[kEntities].get('exchanges').size;
    },
  },
  queueCount: {
    get() {
      return this[kEntities].get('queues').size;
    },
  },
  consumerCount: {
    get() {
      return this[kEntities].get('consumers').size;
    },
  },
});

Broker.prototype.subscribe = function subscribe(exchangeName, pattern, queueName, onMessage, options = { durable: true }) {
  if (!exchangeName || !pattern || typeof onMessage !== 'function')
    throw new TypeError('exchange name, pattern, and message callback are required');
  if (options && options.consumerTag) this.validateConsumerTag(options.consumerTag);

  const exchange = this.assertExchange(exchangeName);
  const queue = this.assertQueue(queueName, options);

  exchange.bindQueue(queue, pattern, options);

  return queue.assertConsumer(onMessage, options, this.owner);
};

Broker.prototype.subscribeTmp = function subscribeTmp(exchangeName, pattern, onMessage, options) {
  return this.subscribe(exchangeName, pattern, null, onMessage, { ...options, durable: false });
};

Broker.prototype.subscribeOnce = function subscribeOnce(exchangeName, pattern, onMessage, options = {}) {
  if (typeof onMessage !== 'function') throw new TypeError('message callback is required');
  if (options && options.consumerTag) this.validateConsumerTag(options.consumerTag);

  const exchange = this.assertExchange(exchangeName);
  const onceOptions = { autoDelete: true, durable: false, priority: options.priority || 0 };

  const onceQueue = this.createQueue(null, onceOptions);
  exchange.bindQueue(onceQueue, pattern, onceOptions);

  return this.consume(onceQueue.name, wrappedOnMessage, { noAck: true, consumerTag: options.consumerTag });

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
    if (type && exchange.type !== type) throw new SmqpError("Type doesn't match", ERR_EXCHANGE_TYPE_MISMATCH);
    return exchange;
  }

  exchange = new Exchange(exchangeName, type || 'topic', options);
  this[kEventHandler].listen(exchange.events);
  this[kEntities].get('exchanges').set(exchangeName, exchange);

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
  if (!queue) throw new SmqpError(`Queue with name <${queueName}> was not found`, ERR_QUEUE_NOT_FOUND);

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
  const result = [];
  for (const consumer of this[kEntities].get('consumers').values()) {
    result.push({
      queue: consumer.queue.name,
      consumerTag: consumer.options.consumerTag,
      ready: consumer.ready,
      options: { ...consumer.options },
    });
  }
  return result;
};

Broker.prototype.getConsumer = function getConsumer(consumerTag) {
  if (typeof consumerTag !== 'string') throw new TypeError('consumer tag must be a string');
  return this[kEntities].get('consumers').get(consumerTag);
};

Broker.prototype.getExchange = function getExchange(exchangeName) {
  if (typeof exchangeName !== 'string') throw new TypeError('exchange name must be a string');
  return this[kEntities].get('exchanges').get(exchangeName);
};

Broker.prototype.deleteExchange = function deleteExchange(exchangeName, { ifUnused } = {}) {
  if (typeof exchangeName !== 'string') throw new TypeError('exchange name must be a string');

  const exchange = this.getExchange(exchangeName);
  if (!exchange || (ifUnused && exchange.bindingCount)) return false;

  this[kEntities].get('exchanges').delete(exchangeName);
  exchange.close();
  return true;
};

Broker.prototype.stop = function stop() {
  const entities = this[kEntities];
  for (const exchange of entities.get('exchanges').values()) exchange.stop();
  for (const queue of entities.get('queues').values()) queue.stop();
};

Broker.prototype.close = function close() {
  const entities = this[kEntities];
  for (const shovel of entities.get('shovels').values()) shovel.close();
  for (const exchange of entities.get('exchanges').values()) exchange.close();
  for (const queue of entities.get('queues').values()) queue.close();
};

Broker.prototype.reset = function reset() {
  this.stop();
  this.close();
  const entities = this[kEntities];
  entities.get('exchanges').clear();
  entities.get('queues').clear();
  entities.get('consumers').clear();
  entities.get('shovels').clear();
};

Broker.prototype.getState = function getState(onlyWithContent) {
  const exchanges = this._getExchangeState(onlyWithContent);
  const queues = this._getQueuesState(onlyWithContent);

  if (onlyWithContent && !exchanges && !queues) return;

  return {
    exchanges,
    queues,
  };
};

Broker.prototype.recover = function recover(state) {
  const boundGetQueue = this.getQueue.bind(this);
  if (state) {
    if (state.queues) {
      for (const qState of state.queues) this.assertQueue(qState.name, qState.options).recover(qState);
    }
    if (state.exchanges)
      for (const eState of state.exchanges) this.assertExchange(eState.name, eState.type, eState.options).recover(eState, boundGetQueue);
  } else {
    const entities = this[kEntities];
    for (const queue of entities.get('queues').values()) {
      if (queue.stopped) queue.recover();
    }
    for (const exchange of entities.get('exchanges').values()) {
      if (exchange.stopped) exchange.recover(null, boundGetQueue);
    }
  }

  return this;
};

Broker.prototype.bindExchange = function bindExchange(source, destination, pattern = '#', args = {}) {
  const name = `e2e-${source}2${destination}-${pattern}`;
  const { priority } = args;
  const shovel = this.createShovel(
    name,
    {
      broker: this,
      exchange: source,
      pattern,
      priority,
      consumerTag: `smq.ctag-${name}`,
    },
    {
      broker: this,
      exchange: destination,
    },
    { ...args }
  );

  return new Exchange2Exchange(shovel);
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
  if (!queue) throw new SmqpError(`Queue with name <${queueName}> was not found`, ERR_QUEUE_NOT_FOUND);
  return queue.queueMessage(null, content, options);
};

Broker.prototype._getQueuesState = function getQueuesState(onlyWithContent) {
  let result;
  for (const queue of this[kEntities].get('queues').values()) {
    if (!queue.options.durable) continue;
    if (onlyWithContent && !queue.messageCount) continue;
    if (!result) result = [];
    result.push(queue.getState());
  }
  return result;
};

Broker.prototype._getExchangeState = function getExchangeState(onlyWithContent) {
  let result;
  for (const exchange of this[kEntities].get('exchanges').values()) {
    if (!exchange.options.durable) continue;
    if (onlyWithContent && !exchange.undeliveredCount) continue;
    if (!result) result = [];
    result.push(exchange.getState());
  }
  return result;
};

Broker.prototype.createQueue = function createQueue(queueName, options) {
  if (queueName && typeof queueName !== 'string') throw new TypeError('queue name must be a string');
  else if (!queueName) queueName = `smq.qname-${generateId()}`;
  else if (this.getQueue(queueName)) throw new SmqpError(`Queue named ${queueName} already exists`, ERR_QUEUE_NAME_CONFLICT);

  const queueEmitter = new EventExchange(`${queueName}__events`);
  this[kEventHandler].listen(queueEmitter);
  const queue = new Queue(queueName, options, queueEmitter);

  this[kEntities].get('queues').set(queueName, queue);
  return queue;
};

Broker.prototype.getQueue = function getQueue(queueName) {
  if (!queueName || typeof queueName !== 'string') throw new TypeError('queue name must be a string');
  return this[kEntities].get('queues').get(queueName);
};

Broker.prototype.assertQueue = function assertQueue(queueName, options = {}) {
  if (queueName && typeof queueName !== 'string') throw new TypeError('queue name must be a string');
  else if (!queueName) return this.createQueue(null, options);

  const queue = this.getQueue(queueName);
  options = { durable: true, ...options };
  if (!queue) return this.createQueue(queueName, options);

  if (queue.options.durable !== options.durable) throw new SmqpError("Durable doesn't match", ERR_QUEUE_DURABLE_MISMATCH);
  return queue;
};

Broker.prototype.deleteQueue = function deleteQueue(queueName, options) {
  const queue = this.getQueue(queueName);
  if (!queue) return;
  return queue.delete(options);
};

Broker.prototype.get = function getMessageFromQueue(queueName, { noAck } = {}) {
  const queue = this.getQueue(queueName);
  if (!queue) return;

  return queue.get({ noAck });
};

Broker.prototype.ack = function ack(message, allUpTo) {
  message.ack(allUpTo);
};

Broker.prototype.ackAll = function ackAll() {
  for (const queue of this[kEntities].get('queues').values()) queue.ackAll();
};

Broker.prototype.nack = function nack(message, allUpTo, requeue) {
  message.nack(allUpTo, requeue);
};

Broker.prototype.nackAll = function nackAll(requeue) {
  for (const queue of this[kEntities].get('queues').values()) queue.nackAll(requeue);
};

Broker.prototype.reject = function reject(message, requeue) {
  message.reject(requeue);
};

Broker.prototype.validateConsumerTag = function validateConsumerTag(consumerTag) {
  if (!consumerTag) return true;

  if (this[kEntities].get('consumers').has(consumerTag)) {
    throw new SmqpError(`Consumer tag must be unique, ${consumerTag} is occupied`, ERR_CONSUMER_TAG_CONFLICT);
  }

  return true;
};

Broker.prototype.createShovel = function createShovel(name, source, destination, options) {
  const shovels = this[kEntities].get('shovels');
  if (shovels.has(name)) throw new SmqpError(`Shovel name must be unique, ${name} is occupied`, ERR_SHOVEL_NAME_CONFLICT);
  const shovel = new Shovel(name, { ...source, broker: this }, destination, options);
  this[kEventHandler].listen(shovel.events);
  shovels.set(name, shovel);
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
  return this[kEntities].get('shovels').get(name);
};

Broker.prototype.getShovels = function getShovels() {
  return [...this[kEntities].get('shovels').values()];
};

Broker.prototype.on = function on(eventName, callback, options) {
  return this.events.on(eventName, getEventCallback(), { ...options, origin: callback });

  function getEventCallback() {
    return function eventCallback(name, msg) {
      callback({
        name,
        ...msg.content,
      });
    };
  }
};

Broker.prototype.off = function off(eventName, callbackOrObject) {
  const { consumerTag } = callbackOrObject;
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

function BrokerEventHandler(eventExchange, entities) {
  this.eventExchange = eventExchange;
  this.entities = entities;
  this.handler = this.handler.bind(this);
}

BrokerEventHandler.prototype.listen = function listen(emitter) {
  emitter.on('#', this.handler);
};

BrokerEventHandler.prototype.handler = function eventHandler(eventName, msg) {
  switch (eventName) {
    case 'exchange.delete': {
      this.entities.get('exchanges').delete(msg.content.name);
      break;
    }
    case 'exchange.return': {
      this.eventExchange.publish('return', msg.content);
      break;
    }
    case 'exchange.message.undelivered': {
      this.eventExchange.publish('message.undelivered', msg.content);
      break;
    }
    case 'queue.delete': {
      this.entities.get('queues').delete(msg.content.name);
      break;
    }
    case 'queue.dead-letter': {
      const exchange = this.entities.get('exchanges').get(msg.content.deadLetterExchange);
      if (!exchange) return;
      const { fields, content, properties } = msg.content.message;
      exchange.publish(fields.routingKey, content, properties);
      break;
    }
    case 'queue.consume': {
      this.entities.get('consumers').set(msg.content.consumerTag, msg.content);
      break;
    }
    case 'queue.consumer.cancel': {
      this.entities.get('consumers').delete(msg.content.consumerTag);
      break;
    }
    case 'queue.message.consumed.ack':
    case 'queue.message.consumed.nack': {
      const { operation, message } = msg.content;
      this.eventExchange.publish(`message.${operation}`, message);
      break;
    }
    case 'shovel.close': {
      this.entities.get('shovels').delete(msg.content.name);
      break;
    }
  }
};
