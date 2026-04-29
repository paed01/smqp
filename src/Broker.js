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

/**
 * Smqp message broker
 * @param {any} [owner] optional broker owner, forwarded to message consumer
 */
export function Broker(owner) {
  if (!(this instanceof Broker)) {
    return new Broker(owner);
  }
  this.owner = owner;
  /** @type {import('./Exchange.js').ExchangeBase} */
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

/**
 * Subscribe to exchange via queue
 * @param {string} exchangeName exhange name
 * @param {string} pattern routing key pattern
 * @param {string} queueName queue name
 * @param {import('#types').onMessage} onMessage message handlers
 * @param {import('#types').SubscribeOptions} [options] optional subscribe options
 */
Broker.prototype.subscribe = function subscribe(exchangeName, pattern, queueName, onMessage, options) {
  if (!exchangeName || !pattern || typeof onMessage !== 'function')
    throw new TypeError('exchange name, pattern, and message callback are required');
  if (options?.consumerTag) this.validateConsumerTag(options.consumerTag);

  const exchange = this.assertExchange(exchangeName);
  const queueOptions = { durable: true, ...options };
  const queue = this.assertQueue(queueName, queueOptions);

  exchange.bindQueue(queue, pattern, queueOptions);

  return queue.assertConsumer(onMessage, queueOptions, this.owner);
};

/**
 * Subscribe to exchange via temporary, non-durable queue
 * @param {string} exchangeName exchange name
 * @param {string} pattern routing key pattern
 * @param {import('#types').onMessage} onMessage message handler
 * @param {import('#types').SubscribeOptions} [options] optional subscribe options
 */
Broker.prototype.subscribeTmp = function subscribeTmp(exchangeName, pattern, onMessage, options) {
  return this.subscribe(exchangeName, pattern, null, onMessage, { ...options, durable: false });
};

/**
 * Subscribe once to first matching message, then auto-cancel.
 *
 * Only `consumerTag` and `priority` from `options` are honored. `noAck`, `autoDelete`,
 * and `durable` are forced internally; queue-lifecycle and dead-letter options are ignored
 * because the temporary queue is deleted after the first delivery.
 *
 * @param {string} exchangeName exchange name
 * @param {string} pattern routing key pattern
 * @param {import('#types').onMessage} onMessage message handler
 * @param {import('#types').SubscribeOptions} [options] optional subscribe options
 */
Broker.prototype.subscribeOnce = function subscribeOnce(exchangeName, pattern, onMessage, options) {
  if (typeof onMessage !== 'function') throw new TypeError('message callback is required');
  if (options?.consumerTag) this.validateConsumerTag(options.consumerTag);

  const exchange = this.assertExchange(exchangeName);
  const onceOptions = { autoDelete: true, durable: false, priority: options?.priority ?? 0 };

  const onceQueue = this.createQueue(null, onceOptions);
  exchange.bindQueue(onceQueue, pattern, onceOptions);

  return this.consume(onceQueue.name, wrappedOnMessage, { noAck: true, consumerTag: options?.consumerTag });

  function wrappedOnMessage(...args) {
    onceQueue.delete();
    onMessage(...args);
  }
};

/**
 * Cancel consumer matching queue + handler
 * @param {string} queueName queue name
 * @param {import('#types').onMessage} onMessage handler previously passed to subscribe
 */
Broker.prototype.unsubscribe = function unsubscribe(queueName, onMessage) {
  const queue = this.getQueue(queueName);
  if (!queue) return;
  queue.dismiss(onMessage);
};

/**
 * Assert exchange exists, create if absent
 * @param {string} exchangeName exchange name
 * @param {import('#types').exchangeType} [type] exchange type, defaults to topic
 * @param {import('#types').ExchangeOptions} [options] optional exchange options
 */
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

/**
 * Bind queue to exchange with routing key pattern
 * @param {string} queueName queue name
 * @param {string} exchangeName exchange name
 * @param {string} pattern routing key pattern
 * @param {import('#types').BindingOptions} [bindOptions] optional binding options
 */
Broker.prototype.bindQueue = function bindQueue(queueName, exchangeName, pattern, bindOptions) {
  const exchange = this.getExchange(exchangeName);
  const queue = this.getQueue(queueName);
  return exchange.bindQueue(queue, pattern, bindOptions);
};

/**
 * Unbind queue from exchange
 * @param {string} queueName queue name
 * @param {string} exchangeName exchange name
 * @param {string} pattern routing key pattern
 */
Broker.prototype.unbindQueue = function unbindQueue(queueName, exchangeName, pattern) {
  const exchange = this.getExchange(exchangeName);
  if (!exchange) return;
  const queue = this.getQueue(queueName);
  if (!queue) return;
  exchange.unbindQueue(queue, pattern);
};

/**
 * Add consumer to queue
 * @param {string} queueName queue name
 * @param {import('#types').onMessage} onMessage message handler
 * @param {import('#types').ConsumeOptions} [options] optional consume options
 */
Broker.prototype.consume = function consume(queueName, onMessage, options) {
  const queue = this.getQueue(queueName);
  if (!queue) throw new SmqpError(`Queue with name <${queueName}> was not found`, ERR_QUEUE_NOT_FOUND);
  return queue.consume(onMessage, options, this.owner);
};

/**
 * Cancel consumer by tag
 * @param {string} consumerTag consumer tag
 * @param {boolean} [requeue] requeue messages held by the consumer, defaults to true
 */
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

/**
 * Get consumer by tag
 * @param {string} consumerTag consumer tag
 */
Broker.prototype.getConsumer = function getConsumer(consumerTag) {
  if (typeof consumerTag !== 'string') throw new TypeError('consumer tag must be a string');
  return this[kEntities].get('consumers').get(consumerTag);
};

/**
 * Get exchange by name
 * @param {string} exchangeName exchange name
 */
Broker.prototype.getExchange = function getExchange(exchangeName) {
  if (typeof exchangeName !== 'string') throw new TypeError('exchange name must be a string');
  return this[kEntities].get('exchanges').get(exchangeName);
};

/**
 * Delete exchange
 * @param {string} exchangeName exchange name
 * @param {{ ifUnused?: boolean }} [options] only delete if no bindings remain
 */
Broker.prototype.deleteExchange = function deleteExchange(exchangeName, options) {
  const exchange = this.getExchange(exchangeName);
  if (!exchange || (options?.ifUnused && exchange.bindingCount)) return false;

  this[kEntities].get('exchanges').delete(exchangeName);
  exchange.close();
  return true;
};

/**
 * Stop broker with corresponding exchanges and queues, entities remain but does not accepts messages
 */
Broker.prototype.stop = function stop() {
  const entities = this[kEntities];
  for (const exchange of entities.get('exchanges').values()) exchange.stop();
  for (const queue of entities.get('queues').values()) queue.stop();
};

/**
 * Close and clean-up all entities
 */
Broker.prototype.close = function close() {
  const entities = this[kEntities];
  for (const shovel of entities.get('shovels').values()) shovel.close();
  for (const exchange of entities.get('exchanges').values()) exchange.close();
  for (const queue of entities.get('queues').values()) queue.close();
};

/**
 * Danger! Resets all entities, stop, close and delete
 */
Broker.prototype.reset = function reset() {
  this.stop();
  this.close();
  const entities = this[kEntities];
  entities.get('exchanges').clear();
  entities.get('queues').clear();
  entities.get('consumers').clear();
  entities.get('shovels').clear();
};

/**
 * Get broker state for persistence
 * @param {boolean} [onlyWithContent] omit exchanges and queues without content
 */
Broker.prototype.getState = function getState(onlyWithContent) {
  const exchanges = this._getExchangeState(onlyWithContent);
  const queues = this._getQueuesState(onlyWithContent);

  if (onlyWithContent && !exchanges && !queues) return;

  return {
    exchanges,
    queues,
  };
};

/**
 * Recover broker from previously captured state
 * @param {import('#types').BrokerState} [state] broker state, omit to recover stopped entities in place
 */
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

/**
 * Bind one exchange to another via internal shovel
 * @param {string} source source exchange name
 * @param {string} destination destination exchange name
 * @param {string} [pattern] routing key pattern, defaults to #
 * @param {import('#types').ShovelOptions} [args] optional shovel options
 */
Broker.prototype.bindExchange = function bindExchange(source, destination, pattern = '#', args) {
  const name = `e2e-${source}2${destination}-${pattern}`;
  const shovel = this.createShovel(
    name,
    {
      broker: this,
      exchange: source,
      pattern,
      priority: args?.priority,
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

/**
 * Unbind exchange-to-exchange shovel
 * @param {string} source source exchange name
 * @param {string} destination destination exchange name
 * @param {string} [pattern] routing key pattern, defaults to #
 */
Broker.prototype.unbindExchange = function unbindExchange(source, destination, pattern = '#') {
  const name = `e2e-${source}2${destination}-${pattern}`;
  return this.closeShovel(name);
};

/**
 * Publish a message to an exchange
 * @param {string} exchangeName exchange name
 * @param {string} routingKey routing key
 * @param {any} [content] message content
 * @param {import('#types').MessageProperties} [properties] optional message properties
 */
Broker.prototype.publish = function publish(exchangeName, routingKey, content, properties) {
  const exchange = this.getExchange(exchangeName);
  if (!exchange) return;
  return exchange.publish(routingKey, content, properties);
};

/**
 * Purge all non-pending messages from queue
 * @param {string} queueName queue name
 */
Broker.prototype.purgeQueue = function purgeQueue(queueName) {
  const queue = this.getQueue(queueName);
  if (!queue) return;
  return queue.purge();
};

/**
 * Send content directly to a queue, bypassing exchanges
 * @param {string} queueName queue name
 * @param {any} content message content
 * @param {import('#types').MessageProperties} [options] optional message properties
 */
Broker.prototype.sendToQueue = function sendToQueue(queueName, content, options) {
  const queue = this.getQueue(queueName);
  if (!queue) throw new SmqpError(`Queue with name <${queueName}> was not found`, ERR_QUEUE_NOT_FOUND);
  return queue.queueMessage({}, content, options);
};

/**
 * @private
 * @param {boolean} [onlyWithContent] skip queues without messages
 */
Broker.prototype._getQueuesState = function getQueuesState(onlyWithContent) {
  let result;
  /** @type {Set<import('./Queue.js').Queue>} */
  const queues = this[kEntities].get('queues').values();
  for (const queue of queues) {
    if (!queue.options.durable) continue;
    if (onlyWithContent && !queue.messageCount) continue;
    if (!result) result = [];
    result.push(queue.getState());
  }
  return result;
};

/**
 * @private
 * @param {boolean} [onlyWithContent] skip exchanges without undelivered messages
 */
Broker.prototype._getExchangeState = function getExchangeState(onlyWithContent) {
  let result;
  /** @type {Set<import('./Exchange.js').ExchangeBase>} */
  const exhanges = this[kEntities].get('exchanges').values();
  for (const exchange of exhanges) {
    if (!exchange.options.durable) continue;
    if (onlyWithContent && !exchange.undeliveredCount) continue;
    if (!result) result = [];
    result.push(exchange.getState());
  }
  return result;
};

/**
 * Create queue
 * @param {string} [queueName] queue name, defaults to a generated name
 * @param {import('#types').QueueOptions} [options] optional queue options
 */
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

/**
 * Get queue by name
 * @param {string} queueName queue name
 */
Broker.prototype.getQueue = function getQueue(queueName) {
  if (!queueName || typeof queueName !== 'string') throw new TypeError('queue name must be a string');
  return this[kEntities].get('queues').get(queueName);
};

/**
 * Assert queue exists, create if absent
 * @param {string} [queueName] queue name, defaults to a generated name
 * @param {import('#types').QueueOptions} [options] optional queue options
 */
Broker.prototype.assertQueue = function assertQueue(queueName, options) {
  if (queueName && typeof queueName !== 'string') throw new TypeError('queue name must be a string');
  else if (!queueName) return this.createQueue(null, options);

  const queue = this.getQueue(queueName);
  const queueOptions = { durable: true, ...options };
  if (!queue) return this.createQueue(queueName, queueOptions);

  if (queue.options.durable !== queueOptions?.durable) throw new SmqpError("Durable doesn't match", ERR_QUEUE_DURABLE_MISMATCH);
  return queue;
};

/**
 * Delete queue
 * @param {string} queueName queue name
 * @param {import('#types').DeleteQueueOptions} [options] optional delete guards
 */
Broker.prototype.deleteQueue = function deleteQueue(queueName, options) {
  const queue = this.getQueue(queueName);
  if (!queue) return;
  return queue.delete(options);
};

/**
 * Get one message from queue
 * @param {string} queueName queue name
 * @param {import('#types').ConsumeOptions} [options] optional consume options
 */
Broker.prototype.get = function getMessageFromQueue(queueName, options) {
  const queue = this.getQueue(queueName);
  if (!queue) return;

  return queue.get({ noAck: options?.noAck });
};

/**
 * Acknowledge message
 * @param {import('./Message.js').Message} message message to ack
 * @param {boolean} [allUpTo] ack all messages up to and including this one
 */
Broker.prototype.ack = function ack(message, allUpTo) {
  message.ack(allUpTo);
};

/** Acknowledge all outstanding messages across all queues */
Broker.prototype.ackAll = function ackAll() {
  for (const queue of this[kEntities].get('queues').values()) queue.ackAll();
};

/**
 * Reject message
 * @param {import('./Message.js').Message} message message to nack
 * @param {boolean} [allUpTo] nack all messages up to and including this one
 * @param {boolean} [requeue] requeue nacked messages, defaults to true
 */
Broker.prototype.nack = function nack(message, allUpTo, requeue) {
  message.nack(allUpTo, requeue);
};

/**
 * Reject all outstanding messages across all queues
 * @param {boolean} [requeue] requeue nacked messages, defaults to true
 */
Broker.prototype.nackAll = function nackAll(requeue) {
  for (const queue of this[kEntities].get('queues').values()) queue.nackAll(requeue);
};

/**
 * Reject message
 * @param {import('./Message.js').Message} message message to reject
 * @param {boolean} [requeue] requeue rejected message, defaults to true
 */
Broker.prototype.reject = function reject(message, requeue) {
  message.reject(requeue);
};

/**
 * Validate that a consumer tag is unused; throws if occupied
 * @param {string} consumerTag consumer tag to validate
 */
Broker.prototype.validateConsumerTag = function validateConsumerTag(consumerTag) {
  return this[kEventHandler].validateConsumerTag('' + consumerTag);
};

/**
 * Create shovel between source and destination exchanges
 * @param {string} name unique shovel name
 * @param {import('#types').ShovelSource} source source spec
 * @param {import('#types').ShovelDestination} destination destination spec
 * @param {import('#types').ShovelOptions} [options] optional shovel options
 */
Broker.prototype.createShovel = function createShovel(name, source, destination, options) {
  const shovels = this[kEntities].get('shovels');
  if (shovels.has(name)) throw new SmqpError(`Shovel name must be unique, ${name} is occupied`, ERR_SHOVEL_NAME_CONFLICT);
  const shovel = new Shovel(name, { ...source, broker: this }, destination, options);
  this[kEventHandler].listen(shovel.events);
  shovels.set(name, shovel);
  return shovel;
};

/**
 * Close shovel by name
 * @param {string} name shovel name
 */
Broker.prototype.closeShovel = function closeShovel(name) {
  const shovel = this.getShovel(name);
  if (shovel) {
    shovel.close();
    return true;
  }
  return false;
};

/**
 * Get shovel by name
 * @param {string} name shovel name
 */
Broker.prototype.getShovel = function getShovel(name) {
  return this[kEntities].get('shovels').get(name);
};

/** List all shovels */
Broker.prototype.getShovels = function getShovels() {
  return [...this[kEntities].get('shovels').values()];
};

/**
 * Subscribe to broker event
 * @param {string} eventName event name pattern
 * @param {(event: { name: string } & Record<string, any>) => void} callback event callback
 * @param {import('#types').ConsumeOptions} [options] optional consume options
 */
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

/**
 * Unsubscribe from broker event
 * @param {string} eventName event name previously passed to on
 * @param {Function | { consumerTag?: string }} callbackOrObject the callback used in on, or an object with the consumer tag
 */
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

BrokerEventHandler.prototype.validateConsumerTag = function validateConsumerTag(consumerTag) {
  if (this.entities.get('consumers').has(consumerTag)) {
    throw new SmqpError(`Consumer tag must be unique, ${consumerTag} is occupied`, ERR_CONSUMER_TAG_CONFLICT);
  }

  return true;
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
      this.validateConsumerTag(msg.content.consumerTag);
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
