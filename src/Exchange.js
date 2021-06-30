import {Message} from './Message';
import {Queue} from './Queue';
import {sortByPriority, getRoutingKeyPattern, generateId} from './shared';

export {Exchange, EventExchange};

const typeSymbol = Symbol.for('type');
const stoppedSymbol = Symbol.for('stopped');
const bindingsSymbol = Symbol.for('bindings');
const deliveryQueueSymbol = Symbol.for('deliveryQueue');
const deliveryConsumerSymbol = Symbol.for('deliveryConsumer');
const onTopicMessageSymbol = Symbol.for('onTopicMessage');
const onDirectMessageSymbol = Symbol.for('onDirectMessage');
const emitReturnSymbol = Symbol.for('emitReturn');
const isExchangeSymbol = Symbol.for('isExchange');
const eventExchangeSymbol = Symbol.for('eventExchange');
const exchangeSymbol = Symbol.for('exchange');
const queueSymbol = Symbol.for('queue');
const compiledPatternSymbol = Symbol.for('compiledPattern');

function Exchange(name, type, options) {
  const eventExchange = EventExchange();
  return new ExchangeBase(name, true, type, options, eventExchange);
}

function EventExchange(name) {
  if (!name) name = `smq.ename-${generateId()}`;
  return new ExchangeBase(name, false, 'topic', {durable: false, autoDelete: true});
}

function ExchangeBase(name, isExchange, type = 'topic', options = {}, eventExchange) {
  if (!name) throw new Error('Exchange name is required');
  if (['topic', 'direct'].indexOf(type) === -1) throw Error('Exchange type must be one of topic or direct');

  this[isExchangeSymbol] = isExchange;
  this[eventExchangeSymbol] = eventExchange;

  const deliveryQueue = new Queue('delivery-q', {}, {emit() {}});
  this[deliveryQueueSymbol] = deliveryQueue;

  const onMessage = (type === 'topic' ? this[onTopicMessageSymbol] : this[onDirectMessageSymbol]).bind(this);
  this[deliveryConsumerSymbol] = deliveryQueue.consume(onMessage);
  if (!isExchange) eventExchange = undefined;

  this.name = name;
  this[typeSymbol] = type;
  this[bindingsSymbol] = [];
  this[stoppedSymbol] = false;
  this.options = {durable: true, autoDelete: true, ...options};
}

Object.defineProperty(ExchangeBase.prototype, 'bindingCount', {
  get() {
    return this[bindingsSymbol].length;
  },
});

Object.defineProperty(ExchangeBase.prototype, 'bindings', {
  get() {
    return this[bindingsSymbol].slice();
  },
});

Object.defineProperty(ExchangeBase.prototype, 'type', {
  get() {
    return this[typeSymbol];
  },
});

Object.defineProperty(ExchangeBase.prototype, 'stopped', {
  get() {
    return this[stoppedSymbol];
  },
});

ExchangeBase.prototype.publish = function publish(routingKey, content, properties = {}) {
  if (this[stoppedSymbol]) return;
  if (!properties.mandatory && !properties.confirm && !this[bindingsSymbol].length) return;

  return this[deliveryQueueSymbol].queueMessage({routingKey}, {
    content,
    properties,
  });
};

ExchangeBase.prototype[onTopicMessageSymbol] = function topic(routingKey, message) {
  const deliverTo = this[bindingsSymbol].reduce((result, bound) => {
    if (bound.testPattern(routingKey)) result.push(bound);
    return result;
  }, []);

  const publishedMsg = message.content;

  if (!deliverTo.length) {
    message.ack();
    this[emitReturnSymbol](routingKey, publishedMsg);
    return 0;
  }

  message.ack();
  deliverTo.forEach(({queue}) => this.publishToQueue(queue, routingKey, publishedMsg.content, publishedMsg.properties));
};

ExchangeBase.prototype[onDirectMessageSymbol] = function direct(routingKey, message) {
  const bindings = this[bindingsSymbol];
  const deliverTo = bindings.reduce((result, bound) => {
    if (bound.testPattern(routingKey)) result.push(bound);
    return result;
  }, []);

  const publishedMsg = message.content;

  const first = deliverTo[0];
  if (!first) {
    message.ack();
    this[emitReturnSymbol](routingKey, publishedMsg);
    return 0;
  }

  if (deliverTo.length > 1) {
    const bound = deliverTo[0];
    const idx = bindings.indexOf(bound);
    bindings.splice(idx, 1);
    bindings.push(bound);
  }

  message.ack();
  this.publishToQueue(first.queue, routingKey, publishedMsg.content, publishedMsg.properties);
};

ExchangeBase.prototype.publishToQueue = function publishToQueue(queue, routingKey, content, properties) {
  queue.queueMessage({routingKey, exchange: this.name}, content, properties);
};

ExchangeBase.prototype[emitReturnSymbol] = function emitReturn(routingKey, returnMessage) {
  const {content, properties} = returnMessage;
  if (properties.confirm) {
    this.emit('message.undelivered', new Message({routingKey, exchange: this.name}, content, properties));
  }
  if (properties.mandatory) {
    this.emit('return', new Message({routingKey, exchange: this.name}, content, properties));
  }
};

ExchangeBase.prototype.bind = function bind(queue, pattern, bindOptions) {
  const bindings = this[bindingsSymbol];
  const bound = bindings.find((bq) => bq.queue === queue && bq.pattern === pattern);
  if (bound) return bound;

  const binding = new Binding(this, queue, pattern, bindOptions);
  bindings.push(binding);
  bindings.sort(sortByPriority);

  this.emit('bind', binding);

  return binding;
};

ExchangeBase.prototype.unbind = function unbind(queue, pattern) {
  const bindings = this[bindingsSymbol];
  const idx = bindings.findIndex((bq) => bq.queue === queue && bq.pattern === pattern);
  if (idx === -1) return;

  const [binding] = bindings.splice(idx, 1);
  binding.close();

  this.emit('unbind', binding);

  if (!bindings.length && this.options.autoDelete) this.emit('delete', this);
};

ExchangeBase.prototype.unbindQueueByName = function unbindQueueByName(queueName) {
  const bounds = this[bindingsSymbol].filter((bq) => bq.queue.name === queueName);
  bounds.forEach((bound) => {
    this.unbind(bound.queue, bound.pattern);
  });
};

ExchangeBase.prototype.close = function close() {
  this[bindingsSymbol].slice().forEach((binding) => binding.close());
  const deliveryQueue = this[deliveryQueueSymbol];
  deliveryQueue.unbindConsumer(this[deliveryConsumerSymbol]);
  deliveryQueue.close();
};

ExchangeBase.prototype.getState = function getState() {
  const self = this;
  const deliveryQueue = self[deliveryQueueSymbol];
  return {
    name: self.name,
    type: self[typeSymbol],
    options: {...self.options},
    ...(deliveryQueue.messageCount ? {deliveryQueue: deliveryQueue.getState()} : undefined),
    bindings: getBoundState()
  };

  function getBoundState() {
    return self[bindingsSymbol].reduce((result, binding) => {
      if (!binding.queue.options.durable) return result;
      if (!result) result = [];
      result.push(binding.getState());
      return result;
    }, undefined);
  }
};

ExchangeBase.prototype.stop = function stop() {
  this[stoppedSymbol] = true;
};

ExchangeBase.prototype.recover = function recover(state, getQueue) {
  const deliveryQueue = this[deliveryQueueSymbol];
  this[stoppedSymbol] = false;

  if (state) {
    this.name = state.name;
    if (state.bindings) {
      state.bindings.forEach((bindingState) => {
        const queue = getQueue(bindingState.queueName);
        if (!queue) return;
        this.bind(queue, bindingState.pattern, bindingState.options);
      });
    }
    deliveryQueue.recover(state.deliveryQueue);
    const onMessage = (this[typeSymbol] === 'topic' ? this[onTopicMessageSymbol] : this[onDirectMessageSymbol]).bind(this);
    this[deliveryConsumerSymbol] = deliveryQueue.consume(onMessage);
  }

  return this;
};

ExchangeBase.prototype.getBinding = function getBinding(queueName, pattern) {
  return this[bindingsSymbol].find((binding) => binding.queue.name === queueName && binding.pattern === pattern);
};

ExchangeBase.prototype.emit = function emit(eventName, content) {
  if (this[isExchangeSymbol]) return this[eventExchangeSymbol].publish(`exchange.${eventName}`, content);
  this.publish(eventName, content);
};

ExchangeBase.prototype.on = function on(pattern, handler, consumeOptions = {}) {
  if (this[isExchangeSymbol]) return this[eventExchangeSymbol].on(`exchange.${pattern}`, handler, consumeOptions);

  const eventQueue = new Queue(null, {durable: false, autoDelete: true});
  this.bind(eventQueue, pattern);
  return eventQueue.consume(handler, {...consumeOptions, noAck: true}, this);
};

ExchangeBase.prototype.off = function off(pattern, handler) {
  if (this[isExchangeSymbol]) return this[eventExchangeSymbol].off(`exchange.${pattern}`, handler);

  const {consumerTag} = handler;
  for (const binding of this[bindingsSymbol]) {
    if (binding.pattern === pattern) {
      if (consumerTag) binding.queue.cancel(consumerTag);
      binding.queue.dismiss(handler);
    }
  }
};

function Binding(exchange, queue, pattern, bindOptions = {}) {
  this.id = `${queue.name}/${pattern}`;
  this.options = {priority: 0, ...bindOptions};
  this.pattern = pattern;
  this[exchangeSymbol] = exchange;
  this[queueSymbol] = queue;
  this[compiledPatternSymbol] = getRoutingKeyPattern(pattern);

  queue.on('delete', () => this.close());
}

Object.defineProperty(Binding.prototype, 'queue', {
  enumerable: true,
  get() {
    return this[queueSymbol];
  },
});

Object.defineProperty(Binding.prototype, 'queueName', {
  enumerable: true,
  get() {
    return this[queueSymbol].name;
  },
});

Binding.prototype.testPattern = function testPattern(routingKey) {
  return this[compiledPatternSymbol].test(routingKey);
};

Binding.prototype.close = function closeBinding() {
  this[exchangeSymbol].unbind(this[queueSymbol], this.pattern);
};

Binding.prototype.getState = function getBindingState() {
  return {
    id: this.id,
    options: {...this.options},
    queueName: this[queueSymbol].name,
    pattern: this.pattern,
  };
};
