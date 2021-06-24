"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Exchange = Exchange;
exports.EventExchange = EventExchange;

var _Message = require("./Message");

var _Queue = require("./Queue");

var _shared = require("./shared");

function Exchange(name, type, options) {
  const eventExchange = EventExchange();
  return ExchangeBase(name, true, type, options, eventExchange);
}

function EventExchange(name) {
  if (!name) name = `smq.ename-${(0, _shared.generateId)()}`;
  return ExchangeBase(name, false, 'topic', {
    durable: false,
    autoDelete: true
  });
}

function ExchangeBase(name, isExchange, type = 'topic', options = {}, eventExchange) {
  if (!name) throw new Error('Exchange name is required');
  if (['topic', 'direct'].indexOf(type) === -1) throw Error('Exchange type must be one of topic or direct');
  const deliveryQueue = (0, _Queue.Queue)('delivery-q', {}, {
    emit: onInternalQueueEmit
  });
  let consumer = deliveryQueue.consume(type === 'topic' ? topic : direct);
  if (!isExchange) eventExchange = undefined;
  const bindings = [];
  let stopped;
  options = {
    durable: true,
    autoDelete: true,
    ...options
  };
  const exchange = {
    name,
    type,
    options,

    get bindingCount() {
      return bindings.length;
    },

    get bindings() {
      return bindings.slice();
    },

    get stopped() {
      return stopped;
    },

    bind,
    close,
    emit,
    getBinding,
    getState,
    on,
    off,
    publish,
    recover,
    stop,
    unbind,
    unbindQueueByName
  };
  return exchange;

  function publish(routingKey, content, properties = {}) {
    if (!shouldIPublish(properties)) return;
    return deliveryQueue.queueMessage({
      routingKey
    }, {
      content,
      properties
    });
  }

  function shouldIPublish(messageProperties) {
    if (stopped) return;
    if (messageProperties.mandatory || messageProperties.confirm) return true;
    return bindings.length;
  }

  function topic(routingKey, message) {
    const deliverTo = getConcernedBindings(routingKey);
    const publishedMsg = message.content;

    if (!deliverTo.length) {
      message.ack();
      emitReturn(routingKey, publishedMsg);
      return 0;
    }

    message.ack();
    deliverTo.forEach(({
      queue
    }) => publishToQueue(queue, routingKey, publishedMsg.content, publishedMsg.properties));
  }

  function direct(routingKey, message) {
    const deliverTo = getConcernedBindings(routingKey);
    const publishedMsg = message.content;
    const first = deliverTo[0];

    if (!first) {
      message.ack();
      emitReturn(routingKey, publishedMsg);
      return 0;
    }

    if (deliverTo.length > 1) shift(deliverTo[0]);
    message.ack();
    publishToQueue(first.queue, routingKey, publishedMsg.content, publishedMsg.properties);
  }

  function publishToQueue(queue, routingKey, content, properties) {
    queue.queueMessage({
      routingKey,
      exchange: name
    }, content, properties);
  }

  function emitReturn(routingKey, returnMessage) {
    const {
      content,
      properties
    } = returnMessage;

    if (properties.confirm) {
      emit('message.undelivered', (0, _Message.Message)({
        routingKey,
        exchange: name
      }, content, properties));
    }

    if (properties.mandatory) {
      emit('return', (0, _Message.Message)({
        routingKey,
        exchange: name
      }, content, properties));
    }
  }

  function getConcernedBindings(routingKey) {
    return bindings.reduce((result, bound) => {
      if (bound.testPattern(routingKey)) result.push(bound);
      return result;
    }, []);
  }

  function shift(bound) {
    const idx = bindings.indexOf(bound);
    bindings.splice(idx, 1);
    bindings.push(bound);
  }

  function bind(queue, pattern, bindOptions) {
    const bound = bindings.find(bq => bq.queue === queue && bq.pattern === pattern);
    if (bound) return bound;
    const binding = Binding(queue, pattern, bindOptions);
    bindings.push(binding);
    bindings.sort(_shared.sortByPriority);
    emit('bind', binding);
    return binding;
  }

  function unbind(queue, pattern) {
    const idx = bindings.findIndex(bq => bq.queue === queue && bq.pattern === pattern);
    if (idx === -1) return;
    const [binding] = bindings.splice(idx, 1);
    binding.close();
    emit('unbind', binding);
    if (!bindings.length && options.autoDelete) emit('delete', exchange);
  }

  function unbindQueueByName(queueName) {
    const bounds = bindings.filter(bq => bq.queue.name === queueName);
    bounds.forEach(bound => {
      unbind(bound.queue, bound.pattern);
    });
  }

  function close() {
    bindings.slice().forEach(binding => binding.close());
    deliveryQueue.unbindConsumer(consumer);
    deliveryQueue.close();
  }

  function getState() {
    return {
      name,
      type,
      options: { ...options
      },
      ...(deliveryQueue.messageCount ? {
        deliveryQueue: deliveryQueue.getState()
      } : undefined),
      bindings: getBoundState()
    };

    function getBoundState() {
      return bindings.reduce((result, binding) => {
        if (!binding.queue.options.durable) return result;
        if (!result) result = [];
        result.push(binding.getState());
        return result;
      }, undefined);
    }
  }

  function stop() {
    stopped = true;
  }

  function recover(state, getQueue) {
    stopped = false;
    recoverBindings();

    if (state) {
      name = exchange.name = state.name;
      deliveryQueue.recover(state.deliveryQueue);
      consumer = deliveryQueue.consume(type === 'topic' ? topic : direct);
    }

    return exchange;

    function recoverBindings() {
      if (!state || !state.bindings) return;
      state.bindings.forEach(bindingState => {
        const queue = getQueue(bindingState.queueName);
        if (!queue) return;
        bind(queue, bindingState.pattern, bindingState.options);
      });
    }
  }

  function getBinding(queueName, pattern) {
    return bindings.find(binding => binding.queue.name === queueName && binding.pattern === pattern);
  }

  function emit(eventName, content) {
    if (isExchange) return eventExchange.publish(`exchange.${eventName}`, content);
    publish(eventName, content);
  }

  function on(pattern, handler, consumeOptions = {}) {
    if (isExchange) return eventExchange.on(`exchange.${pattern}`, handler, consumeOptions);
    const eventQueue = (0, _Queue.Queue)(null, {
      durable: false,
      autoDelete: true
    });
    bind(eventQueue, pattern);
    const eventConsumer = eventQueue.consume(handler, { ...consumeOptions,
      noAck: true
    }, exchange);
    return eventConsumer;
  }

  function off(pattern, handler) {
    if (isExchange) return eventExchange.off(`exchange.${pattern}`, handler);
    const {
      consumerTag
    } = handler;

    for (const binding of bindings) {
      if (binding.pattern === pattern) {
        if (consumerTag) binding.queue.cancel(consumerTag);
        binding.queue.dismiss(handler);
      }
    }
  }

  function Binding(queue, pattern, bindOptions = {}) {
    const rPattern = (0, _shared.getRoutingKeyPattern)(pattern);
    queue.on('delete', closeBinding);
    const binding = {
      id: `${queue.name}/${pattern}`,
      options: {
        priority: 0,
        ...bindOptions
      },
      pattern,

      get queue() {
        return queue;
      },

      get queueName() {
        return queue.name;
      },

      close: closeBinding,
      testPattern,
      getState: getBindingState
    };
    return binding;

    function testPattern(routingKey) {
      return rPattern.test(routingKey);
    }

    function closeBinding() {
      unbind(queue, pattern);
    }

    function getBindingState() {
      return {
        id: binding.id,
        options: { ...binding.options
        },
        queueName: binding.queueName,
        pattern
      };
    }
  }

  function onInternalQueueEmit() {}
}