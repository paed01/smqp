import {Message} from './Message';
import {Queue} from './Queue';
import {sortByPriority, getRoutingKeyPattern, generateId} from './shared';

export {Exchange, EventExchange};

function Exchange(name, type, options) {
  const eventExchange = EventExchange();
  return ExchangeBase(name, true, type, options, eventExchange);
}

function EventExchange(name) {
  if (!name) name = `smq.ename-${generateId()}`;
  return ExchangeBase(name, false, 'topic', {durable: false, autoDelete: true});
}

function ExchangeBase(name, isExchange, type = 'topic', options = {}, eventExchange) {
  if (!name) throw new Error('Exchange name is required');
  if (['topic', 'direct'].indexOf(type) === -1) throw Error('Exchange type must be one of topic or direct');

  const deliveryQueue = Queue('delivery-q', {}, {emit: onInternalQueueEmit});
  let consumer = deliveryQueue.consume(type === 'topic' ? topic : direct);
  if (!isExchange) eventExchange = undefined;

  const bindings = [];
  let stopped;
  options = {durable: true, autoDelete: true, ...options};

  const exchange = {
    name,
    type,
    options,
    bind,
    close,
    emit,
    getBinding,
    getState,
    on,
    publish,
    recover,
    stop,
    unbind,
    unbindQueueByName,
  };

  Object.defineProperty(exchange, 'bindingCount', {
    enumerable: true,
    get: () => bindings.length
  });

  Object.defineProperty(exchange, 'bindings', {
    enumerable: true,
    get: () => bindings.slice()
  });

  Object.defineProperty(exchange, 'stopped', {
    enumerable: true,
    get: () => stopped
  });

  return exchange;

  function publish(routingKey, content, properties = {}) {
    if (stopped) return;
    return deliveryQueue.queueMessage({routingKey}, {
      content,
      properties,
    });
  }

  function topic(routingKey, message) {
    const deliverTo = getConcernedBindings(routingKey);
    const publishedMsg = message.content;

    if (!deliverTo.length) {
      message.ack();
      if (publishedMsg.properties.mandatory) {
        emitReturn(routingKey, publishedMsg);
      }
      return 0;
    }

    message.ack();
    deliverTo.forEach(({queue}) => publishToQueue(queue, routingKey, publishedMsg.content, publishedMsg.properties));
  }

  function direct(routingKey, message) {
    const deliverTo = getConcernedBindings(routingKey);
    const publishedMsg = message.content;

    const first = deliverTo[0];
    if (!first) {
      message.ack();
      if (publishedMsg.properties.mandatory) {
        emitReturn(routingKey, publishedMsg);
      }
      return 0;
    }

    if (deliverTo.length > 1) shift(deliverTo[0]);

    message.ack();
    publishToQueue(first.queue, routingKey, publishedMsg.content, publishedMsg.properties);
  }

  function publishToQueue(queue, routingKey, content, properties) {
    queue.queueMessage({routingKey, exchange: name}, content, properties);
  }

  function emitReturn(routingKey, returnMessage) {
    emit('return', Message({routingKey, exchange: name}, returnMessage.content, returnMessage.properties));
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
    const bound = bindings.find((bq) => bq.queue === queue && bq.pattern === pattern);
    if (bound) return bound;

    const binding = Binding(queue, pattern, bindOptions);
    bindings.push(binding);
    bindings.sort(sortByPriority);

    emit('bind', binding);

    return binding;
  }

  function unbind(queue, pattern) {
    const idx = bindings.findIndex((bq) => bq.queue === queue && bq.pattern === pattern);
    if (idx === -1) return;

    const [binding] = bindings.splice(idx, 1);
    binding.close();

    emit('unbind', binding);

    if (!bindings.length && options.autoDelete) emit('delete', exchange);
  }

  function unbindQueueByName(queueName) {
    const bounds = bindings.filter((bq) => bq.queue.name === queueName);
    bounds.forEach((bound) => {
      unbind(bound.queue, bound.pattern);
    });
  }

  function close() {
    bindings.slice().forEach((binding) => binding.close());
    deliveryQueue.unbindConsumer(consumer);
    deliveryQueue.close();
  }

  function getState() {
    return JSON.parse(JSON.stringify({
      name: name,
      type,
      options: {...options},
      deliveryQueue,
      bindings: getBoundState()}));

    function getBoundState() {
      return bindings.reduce((result, binding) => {
        if (!binding.queue.options.durable) return result;
        if (!result) result = [];
        result.push(binding);
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
      state.bindings.forEach((bindingState) => {
        const queue = getQueue(bindingState.queueName);
        if (!queue) return;
        bind(queue, bindingState.pattern, bindingState.options);
      });
    }
  }

  function getBinding(queueName, pattern) {
    return bindings.find((binding) => binding.queue.name === queueName && binding.pattern === pattern);
  }

  function emit(eventName, content) {
    if (isExchange) return eventExchange.publish(`exchange.${eventName}`, content);
    publish(eventName, content);
  }

  function on(pattern, handler) {
    if (isExchange) return eventExchange.on(`exchange.${pattern}`, handler);

    const eventQueue = Queue(null, {durable: false, autoDelete: true});
    bind(eventQueue, pattern);
    const eventConsumer = eventQueue.consume(handler, {noAck: true}, exchange);
    return eventConsumer;
  }

  function Binding(queue, pattern, bindOptions = {}) {
    const rPattern = getRoutingKeyPattern(pattern);
    queue.on('delete', closeBinding);

    const binding = {
      id: `${queue.name}/${pattern}`,
      options: {priority: 0, ...bindOptions},
      pattern,
      close: closeBinding,
      testPattern,
    };

    Object.defineProperty(binding, 'queue', {
      enumerable: false,
      value: queue,
    });

    Object.defineProperty(binding, 'queueName', {
      enumerable: true,
      get: () => queue.name,
    });

    return binding;

    function testPattern(routingKey) {
      return rPattern.test(routingKey);
    }

    function closeBinding() {
      unbind(queue, pattern);
    }
  }

  function onInternalQueueEmit() {}
}
