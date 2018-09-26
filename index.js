import {Broker} from './src/Broker';

export default Broker;
export {Broker};

// export function Broker(owner) {
//   const exchanges = [];
//   const queues = [];
//   const consumers = [];

//   const broker = {
//     subscribe,
//     subscribeOnce,
//     subscribeTmp,
//     unsubscribe,
//     assertExchange,
//     ack: ackMessage,
//     nack: nackMessage,
//     cancel,
//     close,
//     deleteExchange,
//     bindExchange,
//     bindQueue,
//     assertQueue,
//     consume,
//     createQueue,
//     deleteQueue,
//     get: getMessageFromQueue,
//     getExchange,
//     getQueue,
//     getState,
//     prefetch: setPrefetch,
//     publish,
//     purgeQueue,
//     recover,
//     sendToQueue,
//     stop,
//     unbindExchange,
//     unbindQueue,
//   };

//   Object.defineProperty(broker, 'exchangesCount', {
//     enumerable: true,
//     get: () => exchanges.length
//   });

//   Object.defineProperty(broker, 'queuesCount', {
//     enumerable: true,
//     get: () => queues.length
//   });

//   Object.defineProperty(broker, 'consumersCount', {
//     enumerable: true,
//     get: () => consumers.length
//   });

//   return broker;

//   function subscribe(exchangeName, pattern, queueName, onMessage, options = {durable: true}) {
//     if (!exchangeName || !pattern || typeof onMessage !== 'function') throw new Error('exchange name, pattern, and message callback are required');

//     assertExchange(exchangeName);
//     const queue = assertQueue(queueName, options);

//     bindQueue(queue.name, exchangeName, pattern, options);

//     return consume(queue.name, onMessage, options);
//   }

//   function subscribeTmp(exchangeName, pattern, onMessage, options = {}) {
//     return subscribe(exchangeName, pattern, null, onMessage, {...options, durable: false});
//   }

//   function subscribeOnce(exchangeName, pattern, onMessage, options = {}) {
//     if (typeof onMessage !== 'function') throw new Error('message callback is required');

//     assertExchange(exchangeName);
//     const onceOptions = {autoDelete: true, durable: false};
//     const onceQueue = createQueue(null, onceOptions);

//     bindQueue(onceQueue.name, exchangeName, pattern, onceOptions);

//     const onceConsumer = consume(onceQueue.name, wrappedOnMessage, {noAck: true, consumerTag: options.consumerTag});
//     return onceConsumer;

//     function wrappedOnMessage(...args) {
//       unbindQueue(onceQueue.name, exchangeName, pattern);
//       deleteQueue(onceQueue.name);
//       onMessage(...args);
//     }
//   }

//   function unsubscribe(queueName, onMessage) {
//     const queue = getQueue(queueName);
//     if (!queue) return;
//     queue.removeConsumer(onMessage);
//     if (!queue.options.autoDelete) return true;
//     if (!queue.consumersCount) deleteQueue(queueName);
//     return true;
//   }

//   function assertExchange(exchangeName, type, options) {
//     let exchange = getExchangeByName(exchangeName);
//     if (exchange) {
//       if (type && exchange.type !== type) throw new Error('Type doesn\'t match');
//     } else {
//       exchange = Exchange(exchangeName, type || 'topic', options, {onEvent: onExchangeEvent});
//       exchanges.push(exchange);
//     }

//     return exchange;
//   }

//   function onExchangeEvent(routingKey, message, exchange) {
//     switch (routingKey) {
//       case 'exchange.bind': {

//         break;
//       }
//       case 'exchange.unbind': {
//         if (!exchange.options.autoDelete) break;
//         if (!exchange.bindings.length) deleteExchange(exchange.name);
//         break;
//       }
//     }
//   }

//   function getExchangeByName(exchangeName) {
//     return exchanges.find((exchange) => exchange.name === exchangeName);
//   }

//   function bindQueue(queueName, exchangeName, pattern, bindOptions) {
//     const exchange = getExchange(exchangeName);
//     const queue = getQueue(queueName);
//     exchange.bind(queue, pattern, bindOptions);
//   }

//   function unbindQueue(queueName, exchangeName, pattern) {
//     const exchange = getExchange(exchangeName);
//     if (!exchange) return;
//     const queue = getQueue(queueName);
//     if (!queue) return;
//     exchange.unbind(queue, pattern);
//   }

//   function consume(queueName, onMessage, options) {
//     const queue = getQueue(queueName);
//     if (!queue) throw new Error(`Queue with name <${queueName}> was not found`);

//     if (options && options.consumerTag && consumers.find((c) => c.consumerTag === options.consumerTag)) {
//       throw new Error(`Consumer tag must be unique, ${options.consumerTag} is occupied`);
//     }
//     const consumer = Consumer(queue, onMessage, options, owner);
//     consumer.consume();
//     return consumer;
//   }

//   function cancel(consumerTag) {
//     const consumer = consumers.find((c) => c.consumerTag === consumerTag);
//     if (!consumer) return false;
//     consumer.cancel(false);
//     return true;
//   }

//   function getExchange(exchangeName) {
//     return exchanges.find(({name}) => name === exchangeName);
//   }

//   function deleteExchange(exchangeName, ifUnused) {
//     const idx = exchanges.findIndex((exchange) => exchange.name === exchangeName);
//     if (idx === -1) return false;

//     const exchange = exchanges[idx];
//     if (ifUnused && exchange.bindingsCount) return false;

//     exchanges.splice(idx, 1);
//     exchange.close();
//     return true;
//   }

//   function stop() {
//     exchanges.forEach((exchange) => exchange.stop());
//     queues.forEach((queue) => queue.stop());
//   }

//   function close() {
//     exchanges.forEach((e) => e.close());
//     queues.forEach((q) => q.close());
//   }

//   function getState() {
//     return {
//       exchanges: getExchangeState(),
//       queues: getQueuesState(),
//     };

//     function getExchangeState() {
//       return exchanges.reduce((result, exchange) => {
//         if (!exchange.options.durable) return result;
//         if (!result) result = [];
//         result.push(exchange.getState());
//         return result;
//       }, undefined);
//     }
//   }

//   function recover(state) {
//     if (!state) {
//       queues.forEach((queue) => queue.recover());
//       exchanges.forEach((exchange) => exchange.recover());
//       return;
//     }

//     if (state.queues) state.queues.forEach(recoverQueue);
//     queues.forEach((queue) => queue.stopped && queue.recover());

//     if (state.exchanges) state.exchanges.forEach(recoverExchange);
//     exchanges.forEach((exchange) => exchange.stopped && exchange.recover());

//     return broker;

//     function recoverQueue(qState) {
//       const queue = assertQueue(qState.name, qState.options);
//       queue.recover(qState);
//     }

//     function recoverExchange(eState) {
//       const exchange = assertExchange(eState.name, eState.type, eState.options);
//       exchange.recover(eState);
//     }
//   }

//   function bindExchange() {}
//   function unbindExchange() {}

//   function publish(exchangeName, routingKey, content, options) {
//     const exchange = getExchangeByName(exchangeName);
//     if (!exchange) return;
//     return exchange.publish(routingKey, content, options);
//   }

//   function purgeQueue(queueName) {
//     const queue = getQueue(queueName);
//     if (!queue) return;
//     return queue.purge();
//   }

//   function sendToQueue(queueName, content, options) {
//     const queue = getQueue(queueName);
//     if (!queue) throw new Error(`Queue named ${queueName} doesn't exists`);
//     return queue.queueMessage(undefined, undefined, content, options);
//   }

//   function getQueuesState() {
//     return queues.reduce((result, queue) => {
//       if (!queue.options.durable) return result;
//       if (!result) result = [];
//       result.push(queue.getState());
//       return result;
//     }, undefined);
//   }

//   function createQueue(queueName, options) {
//     if (getQueue(queueName)) throw new Error(`Queue named ${queueName} already exists`);

//     const queue = Queue(queueName, options);
//     queues.push(queue);
//     return queue;
//   }

//   function getQueue(queueName) {
//     if (!queueName) return;
//     const idx = queues.findIndex((queue) => queue.name === queueName);
//     if (idx > -1) return queues[idx];
//   }

//   function assertQueue(queueName, options = {}) {
//     if (!queueName) return createQueue(null, options);

//     const queue = getQueue(queueName);
//     options = {durable: true, ...options};
//     if (!queue) return createQueue(queueName, options);

//     if (queue.options.durable !== options.durable) throw new Error('Durable doesn\'t match');
//     return queue;
//   }

//   function deleteQueue(queueName) {
//     if (!queueName) return false;

//     const idx = queues.findIndex((queue) => queue.name === queueName);
//     if (idx === -1) return;

//     const queue = queues[idx];
//     const bindings = queue.bindings;
//     for (const binding of bindings) {
//       binding.close();
//     }
//     queues.splice(idx, 1);
//     return true;
//   }

//   function getMessageFromQueue(queueName, {noAck} = {}) {
//     const queue = getQueue(queueName);
//     if (!queue) return;

//     let message;
//     const tmpConsumer = queue.addConsumer(onceHandler, {noAck: false, prefetch: 1});
//     if (!message) {
//       tmpConsumer.cancel();
//       return message;
//     }

//     return message;

//     function onceHandler(_, msg) {
//       message = msg;
//     }
//   }

//   function ackMessage() {}
//   function nackMessage() {}
//   function setPrefetch() {}

//   // function Exchange(exchangeName, type = 'topic', options = {}) {
//   //   if (['topic', 'direct'].indexOf(type) === -1) throw Error('Exchange type must be one of topic or direct');

//   //   const bindings = [];
//   //   let stopped;
//   //   options = Object.assign({durable: true, autoDelete: true}, options);

//   //   const publishQueue = Queue('messages-queue', {autoDelete: false});
//   //   publishQueue.addConsumer(type === 'topic' ? topic : direct);

//   //   const exchange = {
//   //     name: exchangeName,
//   //     type,
//   //     options,
//   //     bind,
//   //     close: closeExchange,
//   //     delete: () => deleteExchange(exchangeName),
//   //     getBinding,
//   //     getState: getExchangeState,
//   //     publish: publishToQueues,
//   //     recover: recoverExchange,
//   //     stop: stopExchange,
//   //     unbind,
//   //     unbindQueueByName,
//   //   };

//   //   Object.defineProperty(exchange, 'bindingsCount', {
//   //     enumerable: true,
//   //     get: () => bindings.length
//   //   });

//   //   Object.defineProperty(exchange, 'bindings', {
//   //     enumerable: true,
//   //     get: () => bindings.slice()
//   //   });

//   //   Object.defineProperty(exchange, 'stopped', {
//   //     enumerable: true,
//   //     get: () => stopped
//   //   });

//   //   return exchange;

//   //   function publishToQueues(routingKey, content, msgOptions) {
//   //     if (stopped) return;
//   //     return publishQueue.queueMessage(exchangeName, routingKey, content, msgOptions);
//   //   }

//   //   function topic(routingKey, message) {
//   //     const deliverTo = getConcernedBindings(routingKey);
//   //     if (!deliverTo.length) {
//   //       message.ack();
//   //       return 0;
//   //     }

//   //     deliverTo.forEach(({queue}) => queue.queueMessage(exchangeName, routingKey, message.content, message.options));
//   //     message.ack();
//   //   }

//   //   function direct(routingKey, message) {
//   //     const deliverTo = getConcernedBindings(routingKey);
//   //     const first = deliverTo[0];
//   //     if (!first) {
//   //       message.ack();
//   //       return 0;
//   //     }

//   //     if (deliverTo.length > 1) shift(deliverTo[0]);
//   //     first.queue.queueMessage(exchangeName, routingKey, message.content, message.options, message.ack);
//   //   }

//   //   function getConcernedBindings(routingKey) {
//   //     return bindings.reduce((result, bound) => {
//   //       if (bound.testPattern(routingKey)) result.push(bound);
//   //       return result;
//   //     }, []);
//   //   }

//   //   function shift(bound) {
//   //     const idx = bindings.indexOf(bound);
//   //     bindings.splice(idx, 1);
//   //     bindings.push(bound);
//   //   }

//   //   function bind(queue, pattern, bindOptions) {
//   //     const bound = bindings.find((bq) => bq.queue === queue && bq.pattern === pattern);
//   //     if (bound) return bound;

//   //     const binding = Binding(queue, pattern, bindOptions);
//   //     bindings.push(binding);
//   //     bindings.sort(sortByPriority);
//   //     return binding;
//   //   }

//   //   function unbind(queue, pattern) {
//   //     const idx = bindings.findIndex((bq) => bq.queue === queue && bq.pattern === pattern);
//   //     if (idx === -1) return;

//   //     const [binding] = bindings.splice(idx, 1);
//   //     binding.close();
//   //     if (options.autoDelete && !bindings.length) deleteExchange(exchangeName, true);
//   //   }

//   //   function unbindQueueByName(queueName) {
//   //     const bounds = bindings.filter((bq) => bq.queue.name === queueName);
//   //     bounds.forEach((bound) => {
//   //       unbind(bound.queue, bound.pattern);
//   //     });
//   //   }

//   //   function closeExchange() {
//   //     bindings.slice().forEach((binding) => binding.close());
//   //     publishQueue.removeConsumer(type === 'topic' ? topic : direct, false);
//   //     publishQueue.close();
//   //   }

//   //   function getExchangeState() {
//   //     return {
//   //       name: exchangeName,
//   //       type,
//   //       options: Object.assign({}, options),
//   //       bindings: getBoundState(),
//   //       undelivered: getUndelivered(),
//   //     };

//   //     function getBoundState() {
//   //       return bindings.reduce((result, binding) => {
//   //         if (!binding.queue.options.durable) return result;
//   //         if (!result) result = [];
//   //         result.push(binding.getState());
//   //         return result;
//   //       }, undefined);
//   //     }

//   //     function getUndelivered() {
//   //       return publishQueue.getState().messages;
//   //     }
//   //   }

//   //   function stopExchange() {
//   //     stopped = true;
//   //   }

//   //   function recoverExchange(state) {
//   //     stopped = false;

//   //     recoverBindings();
//   //     if (state) {
//   //       publishQueue.recover({messages: state.undelivered});
//   //     }

//   //     return exchange;

//   //     function recoverBindings() {
//   //       if (!state || !state.bindings) return;
//   //       state.bindings.forEach((bindingState) => {
//   //         const queue = getQueue(bindingState.queueName);
//   //         if (!queue) return;
//   //         bind(queue, bindingState.pattern, bindingState.options);
//   //       });
//   //     }
//   //   }

//   //   function getBinding(queueName, pattern) {
//   //     return bindings.find((binding) => binding.queue.name === queueName && binding.pattern === pattern);
//   //   }

//   //   function Binding(queue, pattern, bindOptions = {}) {
//   //     const rPattern = getRPattern();

//   //     const binding = {
//   //       id: `${queue.name}/${pattern}`,
//   //       options: {priority: 0, ...bindOptions},
//   //       pattern,
//   //       exchange,
//   //       queue,
//   //       close: closeBinding,
//   //       getState: getBindingState,
//   //       testPattern,
//   //     };

//   //     queue.addBinding(binding);

//   //     return binding;

//   //     function testPattern(routingKey) {
//   //       return rPattern.test(routingKey);
//   //     }

//   //     function closeBinding() {
//   //       queue.removeBinding(binding);
//   //       unbind(queue, pattern);
//   //     }

//   //     function getRPattern() {
//   //       const rpattern = pattern
//   //         .replace('.', '\\.')
//   //         .replace('*', '[^.]+?')
//   //         .replace('#', '.+?');

//   //       return new RegExp(`^${rpattern}$`);
//   //     }

//   //     function getBindingState() {
//   //       return {
//   //         pattern: pattern,
//   //         queueName: queue.name,
//   //         options: Object.assign({}, bindOptions)
//   //       };
//   //     }
//   //   }
//   // }

//   // function Queue(queueName, options = {}) {
//   //   const messages = [], queueConsumers = [], bindings = [];
//   //   let pendingResume, exclusive, stopped;
//   //   options = Object.assign({autoDelete: true}, options);
//   //   const {deadLetterExchange} = options;
//   //   if (deadLetterExchange) assertExchange(deadLetterExchange);

//   //   // const consumeQ = Queue(`consume-${queueName}`);
//   //   // consumeQ.addConsumer(onQueueMessage, {noAck: false});

//   //   // function onQueueMessage(routingKey, message) {
//   //   //   console.log(routingKey);
//   //   // }

//   //   const queue = {
//   //     name: queueName,
//   //     deadLetterExchange,
//   //     options,
//   //     addConsumer,
//   //     addBinding,
//   //     removeBinding,
//   //     close: closeQueue,
//   //     get,
//   //     getState: getQueueState,
//   //     peek,
//   //     purge,
//   //     queueMessage,
//   //     removeConsumer,
//   //     recover: recoverQueue,
//   //     stop: stopQueue,
//   //     unbind,
//   //   };

//   //   Object.defineProperty(queue, 'length', {
//   //     enumerable: true,
//   //     get: () => messages.length
//   //   });

//   //   Object.defineProperty(queue, 'consumersCount', {
//   //     enumerable: true,
//   //     get: () => queueConsumers.length
//   //   });

//   //   Object.defineProperty(queue, 'bindings', {
//   //     enumerable: true,
//   //     get: () => bindings.slice()
//   //   });

//   //   Object.defineProperty(queue, 'exclusive', {
//   //     enumerable: true,
//   //     get: () => exclusive
//   //   });

//   //   Object.defineProperty(queue, 'stopped', {
//   //     enumerable: true,
//   //     get: () => stopped
//   //   });

//   //   return queue;

//   //   function addBinding(binding) {
//   //     if (binding.queue !== queue) throw new Error('bindings are exclusive and cannot be passed around');
//   //     if (bindings.indexOf(binding) !== -1) return;
//   //     bindings.push(binding);
//   //   }

//   //   function removeBinding(binding) {
//   //     const idx = bindings.indexOf(binding);
//   //     if (idx === -1) return;
//   //     bindings.splice(idx, 1);
//   //   }

//   //   function unbind(consumer, requeue) {
//   //     if (!consumer) return;

//   //     const idx = queueConsumers.indexOf(consumer);
//   //     if (idx === -1) return;
//   //     queueConsumers.splice(idx, 1);

//   //     const mainIdx = consumers.indexOf(consumer);
//   //     if (mainIdx > -1) {
//   //       consumers.splice(mainIdx, 1);
//   //     }

//   //     exclusive = false;

//   //     const consumerMessages = messages.filter((message) => message.consumerTag === consumer.consumerTag);
//   //     for (let i = 0; i < consumerMessages.length; i++) {
//   //       consumerMessages[i].unsetConsumer();
//   //       nack(consumerMessages[i], requeue);
//   //     }
//   //   }

//   //   function addConsumer(onMessage, consumeOptions) {
//   //     if (typeof onMessage !== 'function') throw new TypeError('Message callback is mandatory');
//   //     let consumer = getConsumer(onMessage);
//   //     if (consumer) return consumer;

//   //     if (exclusive) throw new Error(`Queue ${queueName} is exclusively consumed by ${queueConsumers[0].consumerTag}`);
//   //     if (consumeOptions && consumeOptions.exclusive) {
//   //       if (queueConsumers.length) throw new Error(`Cannot exclusively subscribe to queue ${queueName} since it is already consumed`);
//   //       exclusive = true;
//   //     }

//   //     consumer = Consumer(queueName, onMessage, consumeOptions);

//   //     consumers.push(consumer);
//   //     queueConsumers.push(consumer);
//   //     queueConsumers.sort(sortByPriority);
//   //     consumeNext();
//   //     return consumer;
//   //   }

//   //   function removeConsumer(onMessage, requeue = true) {
//   //     if (typeof onMessage !== 'function') throw new TypeError('Message callback is mandatory');
//   //     const consumer = getConsumer(onMessage);
//   //     unbind(consumer, requeue);
//   //   }

//   //   function getConsumer(onMessage) {
//   //     return queueConsumers.find((consumer) => consumer.onMessage === onMessage);
//   //   }

//   //   function nack(message, requeue) {
//   //     message.unsetConsumer();
//   //     message.nack(false, requeue);
//   //   }

//   //   function queueMessage(exchangeName, routingKey, content, msgOptions, onMessageQueued) {
//   //     const message = Message(generateId(), {exchangeName, routingKey}, content, msgOptions, onConsumed);
//   //     messages.push(message);
//   //     if (onMessageQueued) onMessageQueued(message);
//   //     return consumeNext();
//   //   }

//   //   function consumeNext() {
//   //     if (stopped) return;

//   //     if (!messages.length) return;
//   //     const activeConsumers = queueConsumers.slice();

//   //     let consumed = 0;
//   //     for (const consumer of activeConsumers) {
//   //       consumed += consumer.consume(queue);
//   //     }

//   //     if (!consumed) return consumed;

//   //     return consumed;
//   //   }

//   //   function onConsumed(message, operation, allUpTo, requeue) {
//   //     switch (operation) {
//   //       case 'ack': {
//   //         dequeue(message, allUpTo);
//   //         break;
//   //       }
//   //       case 'reject':
//   //       case 'nack':
//   //         if (requeue) break;

//   //         dequeue(message, allUpTo);
//   //         if (deadLetterExchange) {
//   //           publish(deadLetterExchange, message.routingKey, message.content);
//   //         }
//   //         break;
//   //     }

//   //     consumeNext();
//   //   }

//   //   function get(prefetch = 1) {
//   //     if (pendingResume) return [];
//   //     if (!prefetch) return [];
//   //     return getMessages(prefetch);
//   //   }

//   //   function getMessages(count) {
//   //     const msgs = [];
//   //     if (!count) return msgs;

//   //     for (const msg of messages) {
//   //       if (msg.pending) continue;
//   //       msgs.push(msg);
//   //       if (!--count) break;
//   //     }

//   //     return msgs;
//   //   }

//   //   function peek(ignorePendingAck) {
//   //     const message = messages[0];
//   //     if (!message) return;

//   //     if (!ignorePendingAck) return message;
//   //     if (!message.pending) return message;

//   //     for (let idx = 1; idx < messages.length; idx++) {
//   //       if (!messages[idx].pending) {
//   //         return messages[idx];
//   //       }
//   //     }
//   //   }

//   //   function purge() {
//   //     return messages.splice(0).length;
//   //   }

//   //   function dequeue(message, allUpTo) {
//   //     const msgIdx = messages.indexOf(message);
//   //     if (msgIdx === -1) return;

//   //     if (allUpTo) {
//   //       messages.splice(0, msgIdx + 1);
//   //     } else {
//   //       messages.splice(msgIdx, 1);
//   //     }

//   //     return true;
//   //   }

//   //   function getQueueState() {
//   //     const result = {
//   //       name: queueName,
//   //       options,
//   //     };

//   //     result.messages = messages.map((message) => {
//   //       const {messageId, fields, content} = message;
//   //       return {
//   //         messageId,
//   //         fields,
//   //         content,
//   //       };
//   //     });

//   //     return JSON.parse(JSON.stringify(result));
//   //   }

//   //   function recoverQueue(state) {
//   //     stopped = false;
//   //     if (!state) return;
//   //     messages.splice(0);
//   //     state.messages.forEach(({messageId, fields, content, options: msgOptions}) => {
//   //       const msg = Message(messageId, fields, content, msgOptions, onConsumed);
//   //       messages.push(msg);
//   //     });
//   //     consumeNext();
//   //   }

//   //   function closeQueue() {
//   //     exclusive = false;
//   //     queueConsumers.splice(0).forEach((consumer) => consumer.cancel());
//   //   }

//   //   function stopQueue() {
//   //     stopped = true;
//   //   }
//   // }

//   // function Consumer(queueName, onMessage, options) {
//   //   const consumerOptions = Object.assign({prefetch: 1, priority: 0}, options);
//   //   if (!consumerOptions.consumerTag) consumerOptions.consumerTag = `smq.ctag-${generateId()}`;

//   //   const {consumerTag, noAck, priority} = consumerOptions;

//   //   let prefetch;
//   //   setConsumerPrefetch(consumerOptions.prefetch);
//   //   let messages = [], pendingMessages = [];

//   //   const consumer = {
//   //     consumerTag,
//   //     noAck,
//   //     priority,
//   //     queueName,
//   //     options: consumerOptions,
//   //     ack,
//   //     ackAll,
//   //     cancel: cancelConsumer,
//   //     nack,
//   //     onMessage,
//   //     consume: getMessages,
//   //     nackAll,
//   //     prefetch: setConsumerPrefetch
//   //   };

//   //   return consumer;

//   //   function getMessages(queue) {
//   //     if (messages.length >= prefetch) return 0;

//   //     const newMessages = queue.get(prefetch - messages.length);
//   //     if (!newMessages.length) return 0;

//   //     messages = messages.concat(newMessages);
//   //     pendingMessages = pendingMessages.concat(newMessages);

//   //     newMessages.forEach((message) => {
//   //       message.setConsumer(consumerTag, onConsumed);
//   //     });

//   //     const noOfMessages = newMessages.length;
//   //     consumePendingMessages();

//   //     return noOfMessages;
//   //   }

//   //   function consumePendingMessages() {
//   //     while (pendingMessages.length) {
//   //       const message = pendingMessages.shift();
//   //       if (noAck) message.ack();
//   //       onMessage(message.fields.routingKey, message, source);
//   //     }
//   //   }

//   //   function nackAll(requeue) {
//   //     if (!messages.length) return;
//   //     messages.slice().forEach((message) => message.nack(false, requeue));
//   //   }

//   //   function ackAll() {
//   //     if (!messages.length) return;
//   //     messages.slice().forEach((message) => message.ack());
//   //   }

//   //   function ack(allUpTo) {
//   //     if (!messages.length) return;
//   //     messages[0].ack(allUpTo);
//   //   }

//   //   function nack(allUpTo, requeue) {
//   //     if (!messages.length) return;
//   //     messages[0].nack(allUpTo, requeue);
//   //   }

//   //   function onConsumed(message) {
//   //     const idx = messages.indexOf(message);
//   //     if (idx === -1) return;
//   //     messages.splice(idx, 1);
//   //     return true;
//   //   }

//   //   function cancelConsumer(requeue = true) {
//   //     unsubscribe(consumer.queueName, onMessage);
//   //     nackAll(requeue);
//   //     consumer.queueName = undefined;
//   //   }

//   //   function setConsumerPrefetch(value) {
//   //     const val = parseInt(value);
//   //     if (!val) {
//   //       prefetch = 1;
//   //       return;
//   //     }
//   //     prefetch = val;
//   //     return prefetch;
//   //   }
//   // }

//   // function Message(messageId, {exchangeName, routingKey}, content = {}, properties = {}, onConsumed) {
//   //   let pending = false, consumerTag;
//   //   let consumedCallback;
//   //   const fields = {
//   //     exchange: exchangeName,
//   //     routingKey,
//   //   };

//   //   const message = {
//   //     messageId,
//   //     fields,
//   //     content,
//   //     properties: {...properties},
//   //     setConsumer,
//   //     ack,
//   //     nack,
//   //     reject,
//   //     unsetConsumer,
//   //   };

//   //   Object.defineProperty(message, 'pending', {
//   //     enumerable: true,
//   //     get: () => pending
//   //   });

//   //   Object.defineProperty(message, 'consumerTag', {
//   //     enumerable: true,
//   //     get: () => consumerTag
//   //   });

//   //   return message;

//   //   function setConsumer(consumedByTag, consumedCb) {
//   //     pending = true;
//   //     consumerTag = consumedByTag;
//   //     fields.consumerTag = consumerTag;
//   //     consumedCallback = consumedCb;
//   //   }

//   //   function unsetConsumer() {
//   //     pending = false;
//   //     consumerTag = undefined;
//   //     consumedCallback = undefined;
//   //   }

//   //   function reject(requeue) {
//   //     if (!pending) return;
//   //     pending = false;
//   //     consumerTag = undefined;
//   //     consumed('reject', null, requeue);
//   //   }

//   //   function ack(allUpTo) {
//   //     console.log('ACK', pending)
//   //     if (!pending) return;

//   //     pending = false;
//   //     consumerTag = undefined;
//   //     consumed('ack', allUpTo);
//   //   }

//   //   function nack(allUpTo, requeue) {
//   //     if (!pending) return;
//   //     pending = false;
//   //     consumerTag = undefined;
//   //     consumed('nack', allUpTo, requeue);
//   //   }

//   //   function consumed(operation, allUpTo, requeue) {
//   //     [consumedCallback, onConsumed].forEach((fn) => {
//   //       if (fn) fn(message, operation, allUpTo, requeue);
//   //     });
//   //   }
//   // }
// }

// // function generateId() {
// //   const min = 110000;
// //   const max = 9999999;
// //   const rand = Math.floor(Math.random() * (max - min)) + min;

// //   return rand.toString(16);
// // }

// // function sortByPriority(a, b) {
// //   return b.options.priority - a.options.priority;
// // }
