import {Consumer} from './Consumer';
import {Queue} from './Queue';
import {sortByPriority} from './shared';

export {Exchange};

function Exchange(name, type = 'topic', options = {}) {
  if (!name) throw new Error('Exchange name is required');
  if (['topic', 'direct'].indexOf(type) === -1) throw Error('Exchange type must be one of topic or direct');

  const deliveryQueue = Queue('delivery-q');
  const consumer = Consumer(deliveryQueue, type === 'topic' ? topic : direct, {});

  const bindings = [];
  let stopped;
  options = Object.assign({durable: true, autoDelete: true}, options);

  const exchange = {
    name,
    type,
    options,
    bind,
    close,
    getBinding,
    getState,
    publish,
    recover,
    stop,
    unbind,
    unbindQueueByName,
  };

  Object.defineProperty(exchange, 'bindingsCount', {
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

  function publish(routingKey, content, properties) {
    if (stopped) return;
    return deliveryQueue.queueMessage({exchange, routingKey}, content, properties);
  }

  function topic(routingKey, message) {
    const deliverTo = getConcernedBindings(routingKey);
    if (!deliverTo.length) {
      message.ack();
      return 0;
    }

    deliverTo.forEach(({queue}) => queue.queueMessage({exchange, routingKey}, message.content, message.properties));
    message.ack();
  }

  function direct(routingKey, message) {
    const deliverTo = getConcernedBindings(routingKey);
    const first = deliverTo[0];
    if (!first) {
      message.ack();
      return 0;
    }

    if (deliverTo.length > 1) shift(deliverTo[0]);
    first.queue.queueMessage({exchange, routingKey}, message.content, message.properties, message.ack);
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
    return binding;
  }

  function unbind(queue, pattern) {
    const idx = bindings.findIndex((bq) => bq.queue === queue && bq.pattern === pattern);
    if (idx === -1) return;

    const [binding] = bindings.splice(idx, 1);
    binding.close();
    if (options.autoDelete && !bindings.length) deleteExchange(name, true);
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
    return {
      name: name,
      type,
      options: Object.assign({}, options),
      bindings: getBoundState(),
      deliveryQueue
    };

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
      deliveryQueue.recover({messages: state.deliveryQueue.messages});
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

  function Binding(queue, pattern, bindOptions = {}) {
    const rPattern = getRPattern();

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

    queue.addBinding(binding);

    return binding;

    function testPattern(routingKey) {
      return rPattern.test(routingKey);
    }

    function closeBinding() {
      unbind(queue, pattern);
    }

    function getRPattern() {
      const rpattern = pattern
        .replace('.', '\\.')
        .replace('*', '[^.]+?')
        .replace('#', '.+?');

      return new RegExp(`^${rpattern}$`);
    }
  }
}
