import { Exchange, EventExchange } from './Exchange';
import { Queue } from './Queue';
import { Shovel } from './Shovel';


const prv = Symbol('private');

const brokerPublicMethods = [
  'subscribe',
  'subscribeOnce',
  'subscribeTmp',
  'unsubscribe',
  'createShovel',
  'closeShovel',
  'getShovel',
  'assertExchange',
  'ack',
  'ackAll',
  'nack',
  'nackAll',
  'cancel',
  'close',
  'deleteExchange',
  'bindExchange',
  'bindQueue',
  'assertQueue',
  'consume',
  'createQueue',
  'deleteQueue',
  'getConsumer',
  'getConsumers',
  'getExchange',
  'getQueue',
  'getState',
  'on',
  'off',
  'publish',
  'purgeQueue',
  'recover',
  'reject',
  'reset',
  'sendToQueue',
  'stop',
  'unbindExchange',
  'unbindQueue',
];

class _Broker {
  constructor(owner) {

    this[prv] = {
      exchanges: [],
      queues: [],
      consumers: [],
      shovels: [],
      events: EventExchange(),
    };

    this.owner = owner;

    brokerPublicMethods.forEach((fn) => {
      this[fn] = _Broker.prototype[fn].bind(this);
    });
    // renamed methods
    this.prefetch = _Broker.prototype.setPrefetch;
    this.get = _Broker.prototype.getMessageFromQueue.bind(this);
  }

  get exchangeCount() {
    return this[prv].exchanges.length;
  }

  get queueCount() {
    return this[prv].queues.length;
  }

  get consumerCount() {
    return this[prv].consumers.length;
  }

  subscribe(exchangeName, pattern, queueName, onMessage, options = { durable: true }) {
    if (!exchangeName || !pattern || typeof onMessage !== 'function') throw new Error('exchange name, pattern, and message callback are required');
    if (options && options.consumerTag) this._validateConsumerTag(options.consumerTag);

    this.assertExchange(exchangeName);
    const queue = this.assertQueue(queueName, options);

    this.bindQueue(queue.name, exchangeName, pattern, options);

    return queue.assertConsumer(onMessage, options, this.owner);
  }

  subscribeTmp(exchangeName, pattern, onMessage, options = {}) {
    return this.subscribe(exchangeName, pattern, null, onMessage, { ...options, durable: false });
  }

  subscribeOnce(exchangeName, pattern, onMessage, options = {}) {
    if (typeof onMessage !== 'function') throw new Error('message callback is required');
    if (options && options.consumerTag) this._validateConsumerTag(options.consumerTag);

    this.assertExchange(exchangeName);
    const onceOptions = { autoDelete: true, durable: false, priority: options.priority || 0 };
    const onceQueue = this.createQueue(null, onceOptions);

    this.bindQueue(onceQueue.name, exchangeName, pattern, { ...onceOptions });

    return this.consume(onceQueue.name, wrappedOnMessage, { noAck: true, consumerTag: options.consumerTag });

    function wrappedOnMessage(...args) {
      onceQueue.delete();
      onMessage(...args);
    }
  }

  unsubscribe(queueName, onMessage) {
    const queue = this.getQueue(queueName);
    if (!queue) return;
    queue.dismiss(onMessage);
  }

  assertExchange(exchangeName, type, options) {
    let exchange = this._getExchangeByName(exchangeName);
    if (exchange) {
      if (type && exchange.type !== type) throw new Error('Type doesn\'t match');
    } else {
      exchange = Exchange(exchangeName, type || 'topic', options);
      exchange.on('delete', () => {
        const idx = this[prv].exchanges.indexOf(exchange);
        if (idx === -1) return;
        this[prv].exchanges.splice(idx, 1);
      });
      exchange.on('return', (_, msg) => {
        this[prv].events.publish('return', msg.content);
      });
      exchange.on('message.undelivered', (_, msg) => {
        this[prv].events.publish('message.undelivered', msg.content);
      });
      this[prv].exchanges.push(exchange);
    }

    return exchange;
  }

  _getExchangeByName(exchangeName) {
    return this[prv].exchanges.find((exchange) => exchange.name === exchangeName);
  }

  bindQueue(queueName, exchangeName, pattern, bindOptions) {
    const exchange = this.getExchange(exchangeName);
    const queue = this.getQueue(queueName);
    exchange.bind(queue, pattern, bindOptions);
  }

  unbindQueue(queueName, exchangeName, pattern) {
    const exchange = this.getExchange(exchangeName);
    if (!exchange) return;
    const queue = this.getQueue(queueName);
    if (!queue) return;
    exchange.unbind(queue, pattern);
  }

  consume(queueName, onMessage, options) {
    const queue = this.getQueue(queueName);
    if (!queue) throw new Error(`Queue with name <${queueName}> was not found`);

    if (options) this._validateConsumerTag(options.consumerTag);

    return queue.consume(onMessage, options, this.owner);
  }

  cancel(consumerTag) {
    const consumer = this.getConsumer(consumerTag);
    if (!consumer) return false;
    consumer.cancel(false);
    return true;
  }

  getConsumers() {
    return this[prv].consumers.map((consumer) => {
      return {
        queue: consumer.queue.name,
        consumerTag: consumer.options.consumerTag,
        options: { ...consumer.options }
      };
    });
  }

  getConsumer(consumerTag) {
    return this[prv].consumers.find((c) => c.consumerTag === consumerTag);
  }

  getExchange(exchangeName) {
    return this[prv].exchanges.find(({ name }) => name === exchangeName);
  }

  deleteExchange(exchangeName, { ifUnused } = {}) {
    const idx = this[prv].exchanges.findIndex((exchange) => exchange.name === exchangeName);
    if (idx === -1) return false;

    const exchange = this[prv].exchanges[idx];
    if (ifUnused && exchange.bindingCount) return false;

    this[prv].exchanges.splice(idx, 1);
    exchange.close();
    return true;
  }

  stop() {
    this[prv].exchanges.forEach((exchange) => exchange.stop());
    this[prv].queues.forEach((queue) => queue.stop());
  }

  close() {
    this[prv].shovels.forEach((shovel) => shovel.close());
    this[prv].exchanges.forEach((exchange) => exchange.close());
    this[prv].queues.forEach((queue) => queue.close());
  }

  reset() {
    this.stop();
    this.close();
    this[prv].exchanges.splice(0);
    this[prv].queues.splice(0);
    this[prv].consumers.splice(0);
    this[prv].shovels.splice(0);
  }

  getState() {
    return {
      exchanges: this.getExchangeState(),
      queues: this.getQueuesState(),
    };
  }

  recover(state) {
    const recoverQueue = (qState) => {
      const queue = this.assertQueue(qState.name, qState.options);
      queue.recover(qState);
    };

    const recoverExchange = (eState) => {
      const exchange = this.assertExchange(eState.name, eState.type, eState.options);
      exchange.recover(eState, this.getQueue);
    };

    if (state) {
      if (state.queues) state.queues.forEach(recoverQueue);
      if (state.exchanges) state.exchanges.forEach(recoverExchange);
    } else {
      this[prv].queues.forEach((queue) => queue.stopped && queue.recover());
      this[prv].exchanges.forEach((exchange) => exchange.stopped && exchange.recover(null, this.getQueue));
    }

    return this;
  }

  bindExchange(source, destination, pattern = '#', args = {}) {
    const name = `e2e-${source}2${destination}-${pattern}`;
    const { priority } = args;
    const { consumerTag, on: onShovel, close: onClose, source: shovelSource } = this.createShovel(name, {
      broker: this,
      exchange: source,
      pattern,
      priority,
      consumerTag: `smq.ctag-${name}`,
    }, {
      broker: this,
      exchange: destination
    }, {
      ...args
    });

    return {
      name,
      source,
      destination,
      queue: shovelSource.queue,
      consumerTag,
      on: onShovel,
      close: onClose,
    };
  }

  unbindExchange(source, destination, pattern = '#') {
    const name = `e2e-${source}2${destination}-${pattern}`;
    return this.closeShovel(name);
  }

  publish(exchangeName, routingKey, content, options) {
    const exchange = this._getExchangeByName(exchangeName);
    if (!exchange) return;
    return exchange.publish(routingKey, content, options);
  }

  purgeQueue(queueName) {
    const queue = this.getQueue(queueName);
    if (!queue) return;
    return queue.purge();
  }

  sendToQueue(queueName, content, options = {}) {
    const queue = this.getQueue(queueName);
    if (!queue) throw new Error(`Queue named ${queueName} doesn't exists`);
    return queue.queueMessage(null, content, options);
  }

  getQueuesState() {
    return this[prv].queues.reduce((result, queue) => {
      if (!queue.options.durable) return result;
      if (!result) result = [];
      result.push(queue.getState());
      return result;
    }, undefined);
  }

  getExchangeState() {
    return this[prv].exchanges.reduce((result, exchange) => {
      if (!exchange.options.durable) return result;
      if (!result) result = [];
      result.push(exchange.getState());
      return result;
    }, undefined);
  }

  createQueue(queueName, options) {
    if (this.getQueue(queueName)) throw new Error(`Queue named ${queueName} already exists`);

    const queue = Queue(queueName, options, EventExchange(queueName + '-events'));

    const onDelete = () => {
      const idx = this[prv].queues.indexOf(queue);
      if (idx === -1) return;
      this[prv].queues.splice(idx, 1);
    };

    const onDeadLetter = (_, { content }) => {
      const exchange = this.getExchange(content.deadLetterExchange);
      if (!exchange) return;
      exchange.publish(content.message.fields.routingKey, content.message.content, content.message.properties);
    };

    queue.on('delete', onDelete);
    queue.on('dead-letter', onDeadLetter);
    queue.on('consume', (_, event) => this[prv].consumers.push(event.content));
    queue.on('consumer.cancel', (_, event) => {
      const idx = this[prv].consumers.indexOf(event.content);
      if (idx !== -1) this[prv].consumers.splice(idx, 1);
    });
    queue.on('message.consumed.#', (_, msg) => {
      const { operation, message } = msg.content;
      this[prv].events.publish('message.' + operation, message);
    });

    this[prv].queues.push(queue);
    return queue;
  }

  getQueue(queueName) {
    if (!queueName) return;
    const idx = this[prv].queues.findIndex((queue) => queue.name === queueName);
    if (idx > -1) return this[prv].queues[idx];
  }

  assertQueue(queueName, options = {}) {
    if (!queueName) return this.createQueue(null, options);

    const queue = this.getQueue(queueName);
    options = { durable: true, ...options };
    if (!queue) return this.createQueue(queueName, options);

    if (queue.options.durable !== options.durable) throw new Error('Durable doesn\'t match');
    return queue;
  }

  deleteQueue(queueName, options) {
    if (!queueName) return false;
    const queue = this.getQueue(queueName);
    if (!queue) return false;
    return queue.delete(options);
  }

  getMessageFromQueue(queueName, { noAck } = {}) {
    const queue = this.getQueue(queueName);
    if (!queue) return;

    return queue.get({ noAck });
  }

  ack(message, allUpTo) {
    message.ack(allUpTo);
  }

  ackAll() {
    this[prv].queues.forEach((queue) => queue.ackAll());
  }

  nack(message, allUpTo, requeue) {
    message.nack(allUpTo, requeue);
  }

  nackAll(requeue) {
    this[prv].queues.forEach((queue) => queue.nackAll(requeue));
  }

  reject(message, requeue) {
    message.reject(requeue);
  }

  _validateConsumerTag(consumerTag) {
    if (!consumerTag) return true;

    if (this.getConsumer(consumerTag)) {
      throw new Error(`Consumer tag must be unique, ${consumerTag} is occupied`);
    }

    return true;
  }

  createShovel(name, source, destination, options) {
    if (this.getShovel(name)) throw new Error(`Shovel name must be unique, ${name} is occupied`);

    const onClose = () => {
      const idx = this[prv].shovels.indexOf(shovel);
      if (idx > -1) this[prv].shovels.splice(idx, 1);
    };

    const shovel = Shovel(name, { ...source, broker: this }, destination, options);
    this[prv].shovels.push(shovel);
    shovel.on('close', onClose);
    return shovel;
  }

  closeShovel(name) {
    const shovel = this.getShovel(name);
    if (shovel) {
      shovel.close();
      return true;
    }
    return false;
  }

  getShovel(name) {
    return this[prv].shovels.find((s) => s.name === name);
  }

  on(eventName, callback, options) {
    return this[prv].events.on(eventName, getEventCallback(), { ...options, origin: callback });

    function getEventCallback() {
      return function eventCallback(name, msg) {
        callback({
          name,
          ...msg.content,
        });
      };
    }
  }

  off(eventName, callbackOrObject) {
    const { consumerTag } = callbackOrObject;
    for (const binding of this[prv].events.bindings) {
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
  }

  setPrefetch() { }
}

export function Broker(owner) {
  return new _Broker(owner);
}
