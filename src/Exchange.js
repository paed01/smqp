import { Message } from './Message';
import { Queue } from './Queue';
import { sortByPriority, getRoutingKeyPattern, generateId } from './shared';

export { Exchange, EventExchange };

function Exchange(name, type, options) {
  const eventExchange = EventExchange();
  return new ExchangeBase(name, true, type, options, eventExchange);
}

function EventExchange(name) {
  if (!name) name = `smq.ename-${generateId()}`;
  return new ExchangeBase(name, false, 'topic', {
    durable: false,
    autoDelete: true,
  });
}

const prv = Symbol('private');

const exchangePublicMethods = [
  'bind',
  'close',
  'emit',
  'getBinding',
  'getState',
  'on',
  'off',
  'publish',
  'recover',
  'stop',
  'unbind',
  'unbindQueueByName',
];

class ExchangeBase {
  constructor(name, isExchange, type = 'topic', options = {}, eventExchange) {
    if (!name) throw new Error('Exchange name is required');
    if (['topic', 'direct'].indexOf(type) === -1) {
      throw Error('Exchange type must be one of topic or direct');
    }

    const deliveryQueue = Queue(
      'delivery-q',
      {},
      { emit: ExchangeBase.prototype._onInternalQueueEmit.bind(this) }
    );
    const consumerCallback = ExchangeBase.prototype[type];
    const consumer = deliveryQueue.consume(consumerCallback.bind(this));
    if (!isExchange) eventExchange = undefined;

    this[prv] = {
      isExchange,
      deliveryQueue,
      consumer,
      eventExchange,
      bindings: [],
      stopped: undefined,
    };

    this.name = name;
    this.type = type;
    this.options = { durable: true, autoDelete: true, ...options };

    exchangePublicMethods.forEach((fn) => {
      this[fn] = ExchangeBase.prototype[fn].bind(this);
    });
  }

  get bindingCount() {
    return this[prv].bindings.length;
  }

  get bindings() {
    return this[prv].bindings.slice();
  }

  get stopped() {
    return this[prv].stopped;
  }

  publish(routingKey, content, properties = {}) {
    if (!this._shouldIPublish(properties)) return;
    return this[prv].deliveryQueue.queueMessage(
      { routingKey },
      {
        content,
        properties,
      }
    );
  }

  _shouldIPublish(messageProperties) {
    if (this[prv].stopped) return;
    if (messageProperties.mandatory || messageProperties.confirm) return true;
    return this[prv].bindings.length;
  }

  topic(routingKey, message) {
    const deliverTo = this._getConcernedBindings(routingKey);
    const publishedMsg = message.content;

    if (!deliverTo.length) {
      message.ack();
      this._emitReturn(routingKey, publishedMsg);
      return 0;
    }

    message.ack();
    deliverTo.forEach(({ queue }) =>
      this.publishToQueue(
        queue,
        routingKey,
        publishedMsg.content,
        publishedMsg.properties
      )
    );
  }

  direct(routingKey, message) {
    const deliverTo = this._getConcernedBindings(routingKey);
    const publishedMsg = message.content;

    const first = deliverTo[0];
    if (!first) {
      message.ack();
      this._emitReturn(routingKey, publishedMsg);
      return 0;
    }

    if (deliverTo.length > 1) this._shift(deliverTo[0]);

    message.ack();
    this.publishToQueue(
      first.queue,
      routingKey,
      publishedMsg.content,
      publishedMsg.properties
    );
  }

  publishToQueue(queue, routingKey, content, properties) {
    queue.queueMessage({ routingKey, exchange: this.name }, content, properties);
  }

  _emitReturn(routingKey, returnMessage) {
    const { content, properties } = returnMessage;
    if (properties.confirm) {
      this.emit(
        'message.undelivered',
        Message({ routingKey, exchange: this.name }, content, properties)
      );
    }
    if (properties.mandatory) {
      this.emit(
        'return',
        Message({ routingKey, exchange: this.name }, content, properties)
      );
    }
  }

  _getConcernedBindings(routingKey) {
    return this[prv].bindings.reduce((result, bound) => {
      if (bound.testPattern(routingKey)) result.push(bound);
      return result;
    }, []);
  }

  _shift(bound) {
    const idx = this[prv].bindings.indexOf(bound);
    this[prv].bindings.splice(idx, 1);
    this[prv].bindings.push(bound);
  }

  bind(queue, pattern, bindOptions) {
    const bound = this[prv].bindings.find(
      (bq) => bq.queue === queue && bq.pattern === pattern
    );
    if (bound) return bound;

    const binding = new Binding(queue, pattern, bindOptions, this);
    this[prv].bindings.push(binding);
    this[prv].bindings.sort(sortByPriority);

    this.emit('bind', binding);

    return binding;
  }

  unbind(queue, pattern) {
    const idx = this[prv].bindings.findIndex(
      (bq) => bq.queue === queue && bq.pattern === pattern
    );
    if (idx === -1) return;

    const [binding] = this[prv].bindings.splice(idx, 1);
    binding.close();

    this.emit('unbind', binding);

    if (!this[prv].bindings.length && this.options.autoDelete) {
      this.emit('delete', this);
    }
  }

  unbindQueueByName(queueName) {
    const bounds = this[prv].bindings.filter(
      (bq) => bq.queue.name === queueName
    );
    bounds.forEach((bound) => {
      this.unbind(bound.queue, bound.pattern);
    });
  }

  close() {
    this[prv].bindings.slice().forEach((binding) => binding.close());
    this[prv].deliveryQueue.unbindConsumer(this[prv].consumer);
    this[prv].deliveryQueue.close();
  }

  getState() {
    const getBoundState = () => {
      return this[prv].bindings.reduce((result, binding) => {
        if (!binding.queue.options.durable) return result;
        if (!result) result = [];
        result.push(binding.getState());
        return result;
      }, undefined);
    };

    return {
      name: this.name,
      type: this.type,
      options: { ...this.options },
      ...(this[prv].deliveryQueue.messageCount
        ? { deliveryQueue: this[prv].deliveryQueue.getState() }
        : undefined),
      bindings: getBoundState(),
    };
  }

  stop() {
    this[prv].stopped = true;
  }

  recover(state, getQueue) {
    this[prv].stopped = false;

    if (!state) {
      return this;
    }

    if (state.bindings) {
      state.bindings.forEach((bindingState) => {
        const queue = getQueue(bindingState.queueName);
        if (!queue) return;
        this.bind(queue, bindingState.pattern, bindingState.options);
      });
    }

    this.name = state.name;
    this[prv].deliveryQueue.recover(state.deliveryQueue);
    this[prv].consumer = this[prv].deliveryQueue.consume(
      ExchangeBase.prototype[this.type].bind(this)
    );

    return this;
  }

  getBinding(queueName, pattern) {
    return this[prv].bindings.find(
      (binding) =>
        binding.queue.name === queueName && binding.pattern === pattern
    );
  }

  emit(eventName, content) {
    if (this[prv].isExchange) {
      return this[prv].eventExchange.publish(`exchange.${eventName}`, content);
    }
    this.publish(eventName, content);
  }

  on(pattern, handler, consumeOptions = {}) {
    if (this[prv].isExchange) {
      return this[prv].eventExchange.on(`exchange.${pattern}`, handler, consumeOptions);
    }

    const eventQueue = Queue(null, { durable: false, autoDelete: true });
    this.bind(eventQueue, pattern);
    const eventConsumer = eventQueue.consume(
      handler,
      { ...consumeOptions, noAck: true },
      this
    );
    return eventConsumer;
  }

  off(pattern, handler) {
    if (this[prv].isExchange) return this[prv].eventExchange.off(`exchange.${pattern}`, handler);

    const { consumerTag } = handler;
    for (const binding of this[prv].bindings) {
      if (binding.pattern === pattern) {
        if (consumerTag) binding.queue.cancel(consumerTag);
        binding.queue.dismiss(handler);
      }
    }
  }
  _onInternalQueueEmit() { }
}

const bindingPublicMethods = [
  'close',
  'testPattern',
  'getState',
];
class Binding {
  constructor(queue, pattern, bindOptions = {}, exchange) {

    this[prv] = {
      rPattern: getRoutingKeyPattern(pattern),
      exchange,
      queue
    };

    this.id = `${queue.name}/${pattern}`;
    this.options = { priority: 0, ...bindOptions };
    this.pattern = pattern;

    bindingPublicMethods.forEach((fn) => {
      this[fn] = Binding.prototype[fn].bind(this);
    });

    queue.on('delete', this.close);
  }

  get queue() {
    return this[prv].queue;
  }

  get queueName() {
    return this[prv].queue.name;
  }

  testPattern(routingKey) {
    return this[prv].rPattern.test(routingKey);
  }

  close() {
    this[prv].exchange.unbind(this[prv].queue, this.pattern);
  }

  getState() {
    return {
      id: this.id,
      options: { ...this.options },
      queueName: this.queueName,
      pattern: this.pattern,
    };
  }
}
