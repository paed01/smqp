# API Reference

The api is inspired by the amusing [`amqplib`](https://github.com/squaremo/amqp.node) api reference.

<!-- toc -->

- [`new Broker([owner])`](#new-brokerowner)
  - [`broker.subscribe(exchangeName, pattern, queueName, onMessage[, options])`](#brokersubscribeexchangename-pattern-queuename-onmessage-options)
  - [`broker.subscribeTmp(exchangeName, pattern, onMessage[, options])`](#brokersubscribetmpexchangename-pattern-onmessage-options)
  - [`broker.subscribeOnce(exchangeName, pattern, onMessage[, options])`](#brokersubscribeonceexchangename-pattern-onmessage-options)
  - [`broker.unsubscribe(queueName, onMessage)`](#brokerunsubscribequeuename-onmessage)
  - [`broker.publish(exchangeName, routingKey[, content, options])`](#brokerpublishexchangename-routingkey-content-options)
  - [`broker.close()`](#brokerclose)
  - [`broker.assertExchange(exchangeName[, type = topic, options])`](#brokerassertexchangeexchangename-type-topic-options)
  - [`broker.deleteExchange(exchangeName[, {ifUnused}])`](#brokerdeleteexchangeexchangename-ifunused)
  - [`broker.bindExchange(source, destination[, pattern, args])`](#brokerbindexchangesource-destination-pattern-args)
  - [`broker.unbindExchange(source, destination[, pattern])`](#brokerunbindexchangesource-destination-pattern)
  - [`broker.assertQueue(queueName[, options])`](#brokerassertqueuequeuename-options)
  - [`broker.bindQueue(queueName, exchangeName, pattern[, options])`](#brokerbindqueuequeuename-exchangename-pattern-options)
  - [`broker.unbindQueue(queueName, exchangeName, pattern)`](#brokerunbindqueuequeuename-exchangename-pattern)
  - [`broker.consume(queueName, onMessage[, options])`](#brokerconsumequeuename-onmessage-options)
  - [`broker.cancel(consumerTag[, requeue = true])`](#brokercancelconsumertag-requeue-true)
  - [`broker.createQueue([queueName, options])`](#brokercreatequeuequeuename-options)
  - [`broker.deleteQueue(queueName[, {ifUnused, ifEmpty}])`](#brokerdeletequeuequeuename-ifunused-ifempty)
  - [`broker.getExchange(exchangeName)`](#brokergetexchangeexchangename)
  - [`broker.getQueue(queueName)`](#brokergetqueuequeuename)
  - [`broker.getConsumers()`](#brokergetconsumers)
  - [`broker.getConsumer(consumerTag)`](#brokergetconsumerconsumertag)
  - [`broker.getState([onlyWithContent])`](#brokergetstateonlywithcontent)
  - [`broker.recover([state])`](#brokerrecoverstate)
  - [`broker.getStats()`](#brokergetstats)
  - [`broker.purgeQueue(queueName)`](#brokerpurgequeuequeuename)
  - [`broker.evictExpired([queueName])`](#brokerevictexpiredqueuename)
  - [`broker.sendToQueue(queueName, content[, options])`](#brokersendtoqueuequeuename-content-options)
  - [`broker.stop()`](#brokerstop)
  - [`broker.get(queueName[, options])`](#brokergetqueuename-options)
  - [`broker.ack(message[, allUpTo])`](#brokerackmessage-allupto)
  - [`broker.ackAll()`](#brokerackall)
  - [`broker.nack(message[, allUpTo, requeue])`](#brokernackmessage-allupto-requeue)
  - [`broker.nackAll([requeue])`](#brokernackallrequeue)
  - [`broker.reject(message[, requeue])`](#brokerrejectmessage-requeue)
  - [`broker.createShovel(name, source, destination[, options])`](#brokercreateshovelname-source-destination-options)
  - [`broker.getShovel(name)`](#brokergetshovelname)
  - [`broker.getShovels()`](#brokergetshovels)
  - [`broker.closeShovel(name)`](#brokercloseshovelname)
  - [`broker.validateConsumerTag(consumerTag)`](#brokervalidateconsumertagconsumertag)
  - [`broker.on(eventName, callback[, options])`](#brokeroneventname-callback-options)
  - [`broker.off(eventName, callbackOrObject)`](#brokeroffeventname-callbackorobject)
  - [`broker.prefetch(count)`](#brokerprefetchcount)
  - [`broker.reset()`](#brokerreset)
- [Exchange](#exchange)
  - [`exchange.bindQueue(queue, pattern[, bindOptions])`](#exchangebindqueuequeue-pattern-bindoptions)
  - [`exchange.close()`](#exchangeclose)
  - [`exchange.emit(eventName[, content])`](#exchangeemiteventname-content)
  - [`exchange.getBinding(queueName, pattern)`](#exchangegetbindingqueuename-pattern)
  - [`exchange.getState()`](#exchangegetstate)
  - [`exchange.on(pattern, handler[, consumeOptions])`](#exchangeonpattern-handler-consumeoptions)
  - [`exchange.off(pattern, handlerOrObject)`](#exchangeoffpattern-handlerorobject)
  - [`exchange.publish(routingKey[, content, properties])`](#exchangepublishroutingkey-content-properties)
  - [`exchange.recover([state, getQueue])`](#exchangerecoverstate-getqueue)
  - [`exchange.stop()`](#exchangestop)
  - [`exchange.unbindQueue(queue, pattern)`](#exchangeunbindqueuequeue-pattern)
  - [`exchange.unbindQueueByName(queueName)`](#exchangeunbindqueuebynamequeuename)
  - [`exchange.closeBinding(binding)`](#exchangeclosebindingbinding)
- [Binding](#binding)
  - [`binding.testPattern(routingKey)`](#bindingtestpatternroutingkey)
  - [`binding.close()`](#bindingclose)
- [Queue](#queue)
  - [`queue.ack(message[, allUpTo])`](#queueackmessage-allupto)
  - [`queue.ackAll()`](#queueackall)
  - [`queue.assertConsumer(onMessage[, consumeOptions, owner])`](#queueassertconsumeronmessage-consumeoptions-owner)
  - [`queue.cancel(consumerTag[, requeue = true])`](#queuecancelconsumertag-requeue-true)
  - [`queue.close()`](#queueclose)
  - [`queue.consume(onMessage[, options, owner])`](#queueconsumeonmessage-options-owner)
  - [`queue.consumeNext()`](#queueconsumenext)
  - [`queue.delete([deleteOptions])`](#queuedeletedeleteoptions)
  - [`queue.dismiss(onMessage[, requeue = true])`](#queuedismissonmessage-requeue-true)
  - [`queue.get([consumeOptions])`](#queuegetconsumeoptions)
  - [`queue.getStats()`](#queuegetstats)
  - [`queue.getState()`](#queuegetstate)
  - [`queue.nack(message[, allUpTo, requeue = true])`](#queuenackmessage-allupto-requeue-true)
  - [`queue.nackAll([requeue = true])`](#queuenackallrequeue-true)
  - [`queue.on(eventName, handler[, consumeOptions])`](#queueoneventname-handler-consumeoptions)
  - [`queue.off(eventName, handler)`](#queueoffeventname-handler)
  - [`queue.peek([ignoreDelivered])`](#queuepeekignoredelivered)
  - [`queue.purge()`](#queuepurge)
  - [`queue.evictExpired()`](#queueevictexpired)
  - [`queue.queueMessage(fields[, content, properties])`](#queuequeuemessagefields-content-properties)
  - [`queue.recover([state])`](#queuerecoverstate)
  - [`queue.reject(message[, requeue = true])`](#queuerejectmessage-requeue-true)
  - [`queue.stop()`](#queuestop)
  - [`queue.unbindConsumer(consumer[, requeue = true])`](#queueunbindconsumerconsumer-requeue-true)
- [Consumer](#consumer)
  - [`consumer.ackAll()`](#consumerackall)
  - [`consumer.nackAll([requeue])`](#consumernackallrequeue)
  - [`consumer.cancel([requeue = true])`](#consumercancelrequeue-true)
  - [`consumer.prefetch(numberOfMessages)`](#consumerprefetchnumberofmessages)
  - [`consumer.on(eventName, handler)`](#consumeroneventname-handler)
- [Message](#message)
  - [`message.ack([allUpTo])`](#messageackallupto)
  - [`message.nack([allUpTo, requeue])`](#messagenackallupto-requeue)
  - [`message.reject([requeue])`](#messagerejectrequeue)
- [`new Shovel(name, source, destination[, options])`](#new-shovelname-source-destination-options)
  - [`shovel.close()`](#shovelclose)
  - [`shovel.on(eventName, callback[, options])`](#shoveloneventname-callback-options)
  - [`shovel.off(eventName, callbackOrObject)`](#shoveloffeventname-callbackorobject)
- [Exchange2Exchange](#exchange2exchange)
  - [`exchange2exchange.on(eventName, handler)`](#exchange2exchangeoneventname-handler)
  - [`exchange2exchange.close()`](#exchange2exchangeclose)
- [SmqpError](#smqperror)
  - [`error.code`](#errorcode)
- [`getRoutingKeyPattern(pattern)`](#getroutingkeypatternpattern)
- [Message eviction](#message-eviction)

<!-- /toc -->

# API reference

## `new Broker([owner])`

Start new broker owned by optional `owner`.

Properties:

- `exchangeCount`: number of exchanges
- `queueCount`: number of queues
- `consumerCount`: number of consumers

### `broker.subscribe(exchangeName, pattern, queueName, onMessage[, options])`

Asserts an exchange, a named queue, and returns [consumer](#consumer) to the named queue. The consumer is asserted into existance as well, i.e. message callback and options are matched.

To make sure the exchange, and or queue has the desired behaviour, please use [`assertExchange()`](#brokerassertexchangeexchangename-type--topic-options) and [`assertQueue()`](#brokerassertqueuequeuename-options)

- `exchangeName`: exchange name
- `pattern`: queue binding pattern, must be a string, an empty string is allowed and matches an empty routing key on topic and direct exchanges. Compared literally by direct exchanges, see [`getRoutingKeyPattern`](#getroutingkeypatternpattern) for topic exchange wildcards. Ignored by fanout exchanges
- `queueName`: queue name
- `onMessage`: message callback
- `options`:
  - `autoDelete`: boolean, defaults to `true`, exchange will be deleted when all bindings are removed; the queue will be removed when all consumers are down
  - `consumerTag`: unique consumer tag
  - `deadLetterExchange`: string, name of dead letter exchange. Will be asserted as topic exchange
  - `deadLetterRoutingKey`: optional string, override routing key when publishing dead-lettered messages
  - `durable`: boolean, defaults to `true`, makes exchange and queue durable, i.e. will be returned when getting state
  - `exclusive`: boolean, queue is exclusively consumed
  - `noAck`: boolean, set to `true` if there is no need to acknowledge message
  - `prefetch`: integer, defaults to `1`, number of messages to consume at a time
  - `priority`: integer, defaults to `0`, higher value gets messages first

The message callback signature:

```javascript
import { Broker } from 'smqp';

const owner = { name: 'me' };
const broker = Broker(owner);

broker.subscribe('events', '#', 'event-queue', onMessage);

broker.publish('events', 'start', { arg: 1 });

function onMessage(routingKey, message, brokerOwner) {
  console.log('received:', routingKey);
  console.log('with message:', message);
  console.log('owned by:', brokerOwner.name);
  message.ack();
}
```

### `broker.subscribeTmp(exchangeName, pattern, onMessage[, options])`

Asserts exchange and creates a temporary queue with random name, i.e. not durable, and returns a new [consumer](#consumer).

- `exchangeName`: exchange name
- `pattern`: queue binding pattern
- `onMessage`: message callback
- `options`:
  - `autoDelete`: boolean, defaults to `true`, exchange will be deleted when all bindings are removed; the queue will be removed when all consumers are down
  - `consumerTag`: unique consumer tag
  - `deadLetterExchange`: string, name of dead letter exchange. Will be asserted as topic exchange
  - `deadLetterRoutingKey`: optional string, override routing key when publishing dead-lettered messages
  - **`durable`**: set to `false` with no option to override
  - `noAck`: boolean, set to `true` if there is no need to acknowledge message
  - `prefetch`: integer, defaults to `1`, number of messages to consume at a time
  - `priority`: integer, defaults to `0`, higher value gets messages first

### `broker.subscribeOnce(exchangeName, pattern, onMessage[, options])`

Same as `subscribeTmp` and will immediately close consumer when first message arrive. Accepts the same option object as [`broker.subscribe`](#brokersubscribeexchangename-pattern-queuename-onmessage-options), but only `consumerTag` and `priority` are honored — `noAck`, `autoDelete`, and `durable` are forced internally, and queue-lifecycle / dead-letter options are ignored because the temporary queue is deleted after the first delivery.

- `exchangeName`: exchange name
- `pattern`: queue binding pattern
- `onMessage`: message callback
- `options`: optional object, see above

### `broker.unsubscribe(queueName, onMessage)`

Remove consumer with message callback from queue.

### `broker.publish(exchangeName, routingKey[, content, options])`

Publish message to exchange.

Arguments:

- `exchangeName`: exchange name
- `routingKey`: routing key
- `content`: message content
- `options`: optional message options
  - `mandatory`: boolean indicating if message is mandatory. Value `true` emits `return` if not routed to any queue
  - `persistent`: boolean indicating if message is persistent, defaults to undef (true). Value `false` ignores the message when queue is recovered from state
  - `expiration`: integer, expire message after milliseconds, [see Message Eviction](#message-eviction)
  - `confirm`: boolean, confirm message delivered, emits `message.nack`, `message.ack`, or `message.undelivered` on broker

### `broker.close()`

Close exchanges, queues, and all consumers

### `broker.assertExchange(exchangeName[, type = topic, options])`

Creates exchange with name.

- `type`: type of exchange, must be one of `topic`, `direct`, or `fanout`, defaults to `topic`.
  - `topic`: routes to every binding whose pattern matches the routing key, `*` matches one word and `#` matches zero or more, see [`getRoutingKeyPattern`](#getroutingkeypatternpattern)
  - `direct`: routes to every binding whose pattern equals the routing key, the pattern is compared literally so wildcards have no meaning
  - `fanout`: routes to every binding regardless of routing key, the binding pattern is ignored
- `options`:
  - `durable`: boolean, defaults to `true`, makes queue durable, i.e. will be returned when getting state
  - `autoDelete`: boolean, defaults to `true`, the exchange will be removed when all bindings are gone

Returns [Exchange](#exchange).

```javascript
import { Broker } from 'smqp';

const broker = new Broker();
broker.assertExchange('broadcast', 'fanout');
broker.assertQueue('audit-q');
broker.assertQueue('mail-q');
broker.bindQueue('audit-q', 'broadcast', '');
broker.bindQueue('mail-q', 'broadcast', 'ignored.pattern');

broker.publish('broadcast', 'user.signup', { id: 1 });

console.log(broker.getQueue('audit-q').messageCount, broker.getQueue('mail-q').messageCount); // 1 1
```

### `broker.deleteExchange(exchangeName[, {ifUnused}])`

Delete exchange by name

Arguments:

- `exchangeName`: exchange name
- `options`: optional options
  - `ifUnused`: delete if no bindings

Returns boolean if exchange was deleted or not.

### `broker.bindExchange(source, destination[, pattern, args])`

Shovel messages between exchanges aka e2e binding.

Arguments:

- `source`: source exchange name
- `destination`: destination exchange name
- `pattern`: optional binding pattern, defaults to all (`#`)
- `args`: Optional options object
  - `priority`: optional binding priority
  - `cloneMessage`: clone message function called with shoveled message

Returns an [Exchange2Exchange](#exchange2exchange) wrapper.

### `broker.unbindExchange(source, destination[, pattern])`

Close e2e binding.

Arguments:

- `source`: source exchange name
- `destination`: destination exchange name
- `pattern`: optional binding pattern, defaults to all (`#`)

### `broker.assertQueue(queueName[, options])`

Assert a queue into existence.

- `queueName`: optional queue name, a name will be genereted if omitted
- `options`: optional queue options
  - `durable`: boolean, defaults to `true`, makes queue durable, i.e. will be returned when getting state
  - `autoDelete`: boolean, defaults to `true`, the queue will be removed when all consumers are down
  - `deadLetterExchange`: string, name of dead letter exchange. Will be asserted as topic exchange if non-existing
  - `deadLetterRoutingKey`: optional string, override routing key when publishing dead-lettered messages
  - `maxLength`: integer, drop the oldest non-pending message when the queue would exceed this length
  - `messageTtl`: integer, expire message after milliseconds, [see Message Eviction](#message-eviction)

Returns [Queue](#queue).

### `broker.bindQueue(queueName, exchangeName, pattern[, options])`

Bind queue to exchange with routing key pattern.

- `queueName`: queue name
- `exchangeName`: exchange name
- `pattern`: queue binding pattern
- `options`: binding options
  - `priority`: integer, defaults to `0`, higher value gets messages first

Returns [Binding](#binding)

### `broker.unbindQueue(queueName, exchangeName, pattern)`

Unbind queue from exchange that match routing key pattern.

- `queueName`: queue name
- `exchangeName`: exchange name
- `pattern`: queue binding pattern

### `broker.consume(queueName, onMessage[, options])`

Consume queue. Returns a [consumer](#consumer). If the message callback is already used for consumption, the existing consumer will be returned.

- `queueName`: queue name
- `onMessage`: message callback
- `options`: optional consume options
  - `consumerTag`: optional consumer tag, one will be generated for you if you don's supply one, if you do supply one it must be unique
  - `exclusive`: boolean, consume queue exclusively, defaults to `false`
  - `noAck`: boolean, defaults to `false`
  - `prefetch`: integer, defaults to `1`, number of messages to consume at a time
  - `priority`: integer, defaults to `0`, higher value gets messages first
  - `capacity`: optional function returning the number of messages the consumer currently accepts, i.e. credit. The consumer receives the lesser of credit and prefetch capacity, and is not ready while the function returns zero or less. Call [`queue.consumeNext()`](#queueconsumenext) when credit is raised

Returns [consumer](#consumer).

### `broker.cancel(consumerTag[, requeue = true])`

Cancel consumption by consumer tag.

- `consumerTag`: consumer tag
- `requeue`: optional boolean to requeue messages consumed by consumer, or [cancel options](#queuecancelconsumertag-requeue-true)

Returns true if consumer tag was found, and consequently false if not.

### `broker.createQueue([queueName, options])`

Create queue with name. Throws if queue already exists.

- `queueName`: optional queue name, a name will be genereted if omitted
- `options`: optional queue options
  - `durable`: boolean, defaults to `true`, makes queue durable, i.e. will be returned when getting state
  - `autoDelete`: boolean, defaults to `true`, the queue will be removed when all consumers are down
  - `deadLetterExchange`: string, name of dead letter exchange. Will be asserted as topic exchange if non-existing
  - `deadLetterRoutingKey`: optional string, override routing key when publishing dead-lettered messages
  - `maxLength`: integer, drop the oldest non-pending message when the queue would exceed this length
  - `messageTtl`: integer, expire message after milliseconds, [see Message Eviction](#message-eviction)

Returns [Queue](#queue).

### `broker.deleteQueue(queueName[, {ifUnused, ifEmpty}])`

Delete queue by name.

Arguments:

- `queueName`: queue name
- `options`: optional options
  - `ifUnused`: delete if no consumers, defaults to false
  - `ifEmpty`: delete if no messages, defaults to false

### `broker.getExchange(exchangeName)`

Get [exchange](#exchange) by name.

### `broker.getQueue(queueName)`

Get [queue](#queue) by name. Returns existing queue or nothing

### `broker.getConsumers()`

Returns a list of consumer properties, i.e. queue name, consumer tag, and options.

### `broker.getConsumer(consumerTag)`

Get [consumer](#consumer) by consumer tag. Returns existing consumer or nothing.

### `broker.getState([onlyWithContent])`

Return serializable object containing durable exchanges, bindings, and durable queues with messages.

- `onlyWithContent`: boolean indicating that only exchanges and queues with undelivered or queued messages will be returned

### `broker.recover([state])`

Recovers exchanges, bindings, and queues with messages. A state may be passed, preferably from [`getState()`](#brokergetstate). With no argument, restarts stopped exchanges and queues in place.

### `broker.getStats()`

Get statistics on demand. Returns totals across all queues and stats per queue:

- `messageCount`: total number of messages in all queues, including delivered but unacked messages
- `unackedCount`: total number of delivered but not yet acked or nacked messages
- `consumerCount`: total number of queue consumers
- `queues`: list of [`queue.getStats()`](#queuegetstats) per queue

```javascript
import { Broker } from 'smqp';

const broker = new Broker();

broker.assertExchange('event');
broker.assertQueue('event-q');
broker.bindQueue('event-q', 'event', '#');

broker.publish('event', 'test.1');
broker.publish('event', 'test.2');
broker.publish('event', 'test.3');

broker.consume('event-q', () => {}, { prefetch: 2 });

console.log(broker.getStats());
// { messageCount: 3, unackedCount: 2, consumerCount: 1, queues: [ { name: 'event-q', messageCount: 3, unackedCount: 2, consumerCount: 1 } ] }
```

### `broker.purgeQueue(queueName)`

Purge queue by name if found. Removes all non consumed messages.

### `broker.evictExpired([queueName])`

Evict expired messages on demand, [see Message Eviction](#message-eviction). Returns the number of evicted messages.

- `queueName`: optional string, queue name. If omitted expired messages are evicted from all queues. Returns 0 if the named queue is not found

```javascript
import { Broker } from 'smqp';

const broker = new Broker();

broker.assertExchange('event');
broker.assertExchange('dead-letter');
broker.assertQueue('event-q', { messageTtl: 100, deadLetterExchange: 'dead-letter' });
broker.bindQueue('event-q', 'event', '#');
broker.assertQueue('dead-letter-q');
broker.bindQueue('dead-letter-q', 'dead-letter', '#');

broker.publish('event', 'test.expired');

setTimeout(() => {
  console.log(broker.evictExpired('event-q')); // 1
  console.log(broker.getQueue('event-q').messageCount); // 0
  console.log(broker.getQueue('dead-letter-q').messageCount); // 1
}, 200);
```

### `broker.sendToQueue(queueName, content[, options])`

Send message directly to queue, bypassing routing key patterns etc. The message routing key is an empty string, so dead-lettered messages are routed with an empty routing key unless the queue has a `deadLetterRoutingKey`.

### `broker.stop()`

No more messages through this broker, i.e. publish will be ignored. Use [`broker.recover()`](#brokerrecoverstate) to resume.

### `broker.get(queueName[, options])`

Get message from queue. Returns false if there are no messages to be retrieved. Returns undefined if the queue is not found.

Arguments:

- `queueName`: name of queue
- `options`: optional object with options
  - `consumerTag`: optional consumer tag to attach to the consumed message
  - `exclusive`: boolean, takes the queue exclusively for this read
  - `noAck`: optional boolean, defaults to `false`
  - `prefetch`: integer, currently passes through but only one message is ever returned
  - `priority`: integer, defaults to `0`

### `broker.ack(message[, allUpTo])`

Ack consumed message.

- `allUpTo`: optional boolean, ack all outstanding messages on owning queue

### `broker.ackAll()`

Acknowledge all outstanding messages.

### `broker.nack(message[, allUpTo, requeue])`

Nack consumed message.

- `allUpTo`: optional boolean, nack all outstanding messages on owning queue
- `requeue`: optional boolean, requeue messages, defaults to true

### `broker.nackAll([requeue])`

Nack all outstanding messages.

### `broker.reject(message[, requeue])`

Same as `broker.nack(message, false, requeue)`

### `broker.createShovel(name, source, destination[, options])`

Shovel messages from exchange to another broker exchange.

> NB! Shovels are not recovered, the source exchange and queue may be recoverable depending on how they were created.
> Messages are ignored if the destination exchange lacks bound queues, to save cpu etc.

Arguments:

- `name`: mandatory name of shovel
- `source`: source options
  - `exchange`: source exchange name
  - `pattern`: optional binding pattern, defaults to all (`#`)
  - `queue`: optional queue name, defaults to temporary autodeleted queue
  - `priority`: optional binding priority
  - `consumerTag`: optional consumer tag, defaults to composed consumer tag
- `destination`: destination broker options
  - `broker`: destination broker instance
  - `exchange`: destination exchange name, must be asserted into existance before shovel is created
  - `exchangeKey`: optional destination exchange key, defaults to original message's routing key
  - `publishProperties`: optional object with message properties to overwrite when shovelling messages, applied after `options.cloneMessage` function
- `options`: Optional options object
  - `cloneMessage(message) => message`: clone message function called with shoveled message, must return new [message](#message), altough fields are ignored completely. Known to be used to clone the message content to make sure no references to the old message is traversed.

Returns [Shovel](#new-shovelname-source-destination-options).

Shovel is closed if either source- or destination exchange is closed, or source consumer is canceled.

A shovel binds its source queue with a single `pattern`. To forward more than one routing key, either widen the pattern with topic wildcards (`order.*`, `#`) or add extra bindings to the shovel's source queue — the queue name is exposed as `shovel.source.queue` and the shovel's consumer drains whatever lands there:

```javascript
import { Broker } from 'smqp';

const source = new Broker();
source.assertExchange('orders', 'topic');

const destination = new Broker();
destination.assertExchange('mirror', 'topic');

const shovel = source.createShovel(
  'orders-mirror',
  { exchange: 'orders', pattern: 'order.created' },
  { broker: destination, exchange: 'mirror' }
);

// add another routing key to the existing shovel
source.bindQueue(shovel.source.queue, 'orders', 'shipment.dispatched');

destination.subscribeTmp('mirror', '#', (routingKey) => console.log({ shovelled: routingKey }), { noAck: true });

source.publish('orders', 'order.created', 'a');
source.publish('orders', 'shipment.dispatched', 'b');
```

### `broker.getShovel(name)`

Get shovel by name.

Returns [Shovel](#new-shovelname-source-destination-options).

### `broker.getShovels()`

List all active shovels owned by this broker. Returns an array of [Shovel](#new-shovelname-source-destination-options) instances.

### `broker.closeShovel(name)`

Close shovel by name.

### `broker.validateConsumerTag(consumerTag)`

Throws [`SmqpError`](#smqperror) with code `ERR_SMQP_CONSUMER_TAG_CONFLICT` if the tag is already taken on this broker, otherwise returns `true`. Mainly useful when constructing a consumer tag manually before calling `subscribe`/`consume`.

### `broker.on(eventName, callback[, options])`

Listen for events from Broker.

Arguments:

- `eventName`: name of event or a "routingKey" pattern
- `callback`: event callback
- `options`: optional consume options
  - `consumerTag`: optional event consumer tag

Returns [consumer](#consumer) - that can be canceled.

Callback is called with the event and the name of the event, in the same object.

```javascript
import { Broker } from 'smqp';

const broker = new Broker();

broker.on(
  'message.*',
  (event) => {
    console.log(event.name, 'fired');
  },
  { consumerTag: 'my-event-consumertag' }
);
```

### `broker.off(eventName, callbackOrObject)`

Turn off event listener(s) associated with event callback.

Arguments:

- `eventName`: name of event
- `callbackOrObject`: event callback function to off or object with basically one property:
  - `consumerTag`: optional event consumer tag to off

```javascript
import { Broker } from 'smqp';

const broker = new Broker();
broker.assertExchange('event', 'topic');

broker.on('return', onMessageEvent, { consumerTag: 'my-event-consumertag' });

function onMessageEvent(event) {
  console.log(event.name, 'fired');
}

broker.publish('event', 'error.1', 'message', { mandatory: true });

/* later */

broker.off('return', onMessageEvent);

broker.publish('event', 'error.2', 'message', { mandatory: true });

/* or */

broker.off('return', { consumerTag: 'my-event-consumertag' });
```

### `broker.prefetch(count)`

Noop, only placeholder — accepts a `count` argument for amqp-shape compatibility but ignores it.

### `broker.reset()`

Reset everything. Deletes exchanges, queues, consumers and bindings.

## Exchange

Exchange

Properties:

- `name`: exchange name
- `type`: exchange type, `topic`, `direct`, or `fanout`
- `options`: exchange options
- `bindingCount`: getter for number of bindings
- `bindings`: getter for list of [bindings](#binding)
- `stopped`: boolean for if the exchange is stopped
- `undeliveredCount`: getter for number of messages held in the exchange's internal delivery queue (not yet routed)

### `exchange.bindQueue(queue, pattern[, bindOptions])`

Bind queue to exchange.

Arguments:

- `queue`: queue instance
- `pattern`: binding pattern
- `bindOptions`: optional binding options
  - `priority`: defaults to 0

### `exchange.close()`

Close exchange and all bindings.

### `exchange.emit(eventName[, content])`

### `exchange.getBinding(queueName, pattern)`

Get binding to queue by name and with pattern.

### `exchange.getState()`

Get recoverable exchange state.

### `exchange.on(pattern, handler[, consumeOptions])`

Listen for exchange events.

Arguments:

- `pattern`: event pattern
- `handler`: event handler function
- `consumeOptions`: optional consume options
  - `consumerTag`: optional event consumer tag

Returns [consumer](#consumer)

### `exchange.off(pattern, handlerOrObject)`

Stop consuming events from exchange.

- `pattern`: event pattern
- `handlerOrObject`: handler function to off or object with basically one property:
  - `consumerTag`: optional event consumer tag to off

### `exchange.publish(routingKey[, content, properties])`

Publish message on exchange.

### `exchange.recover([state, getQueue])`

Recover exchange.

- `state`: optional object with exchange state, preferably from `exchange.getState()`. NB! state name and type is ignored
- `getQueue`: mandatory function if state.binding is passed, to recover bindings a queue is required, this function should return such by name

### `exchange.stop()`

Stop the exchange. Subsequent `publish` calls are silently dropped until [`exchange.recover()`](#exchangerecoverstate-getqueue) is called.

### `exchange.unbindQueue(queue, pattern)`

Unbind queue from exchange.

Arguments:

- `queue`: queue instance
- `pattern`: binding pattern

### `exchange.unbindQueueByName(queueName)`

Remove all bindings to queue by queue name.

### `exchange.closeBinding(binding)`

Close binding.

Arguments:

- `binding`: [Binding](#binding) instance

## Binding

Exchange to queue binding

Properties:

- `id`: exchange binding id
- `options`: binding options
- `pattern`: binding pattern
- `exchange`: exchange instance
- `queue`: queue instance

### `binding.testPattern(routingKey)`

Test routing key against binding pattern

### `binding.close()`

Close binding

## Queue

Queue

Properties:

- `name`: queue name
- `options`: queue options
- `messages`: actual messages array, probably a good idea to not mess with, but it's there
- `messageCount`: message count
- `consumerCount`: consumer count
- `consumers`: snapshot array of [consumer](#consumer) instances currently bound to the queue
- `stopped`: is stopped
- `exclusive`: is exclusively consumed
- `maxLength`: get or set max length of queue
- `capacity`: `maxLength - messageCount`, never below zero
- `messageTtl`: expire messages after milliseconds, [see Message Eviction](#message-eviction)

### `queue.ack(message[, allUpTo])`

Ack message.

### `queue.ackAll()`

Ack all outstanding messages.

### `queue.assertConsumer(onMessage[, consumeOptions, owner])`

Upsert consumer.

### `queue.cancel(consumerTag[, requeue = true])`

Cancel consumer with tag

- `consumerTag`: consumer tag
- `requeue`: optional boolean to requeue messages consumed by consumer, or cancel options:
  - `requeue`: boolean, defaults to `true`. If `false` held messages are rejected, i.e. dead-lettered if configured
  - `keepPending`: boolean, leave held messages pending on the queue as AMQP does on `basic.cancel`. They are not redelivered until acked, nacked, or the queue is recovered. Overrides `requeue`. An `autoDelete` queue is still deleted when its last consumer is cancelled

Returns true if consumer tag was found, and consequently false if not.

```javascript
import { Broker } from 'smqp';

const broker = new Broker();
const queue = broker.assertQueue('held-q', { autoDelete: false });
broker.sendToQueue('held-q', 'payload');

const held = [];
broker.consume('held-q', (routingKey, message) => held.push(message), { consumerTag: 'held' });

queue.cancel('held', { keepPending: true });

console.log(queue.getStats()); // { messageCount: 1, unackedCount: 1, consumerCount: 0 }

held[0].ack();

console.log(queue.messageCount); // 0
```

### `queue.close()`

Closes queue consumers and requeues outstanding messages.

### `queue.consume(onMessage[, options, owner])`

Consume queue messages.

- `onMessage(routingKey, message, owner)`: message callback
  - `routingKey`: message routing key
  - [`message`](#message): the message
  - `owner`: optional owner passed in signature
- `options`: optional consume options, see [`broker.consume`](#brokerconsumequeuename-onmessage-options)
- `owner`: optional owner to be passed to message callback, mainly for internal use when consuming by broker but feel free to pass anything here

Returns [consumer](#consumer).

### `queue.consumeNext()`

Deliver available messages to ready consumers. Messages are delivered automatically when queued and acked, so this is only needed when a consumer [`capacity`](#brokerconsumequeuename-onmessage-options) hook has granted more credit.

Returns the number of delivered messages, or `undefined` if the queue is stopped or has no available messages.

```javascript
import { Broker } from 'smqp';

const broker = new Broker();
broker.assertQueue('credit-q');
broker.sendToQueue('credit-q', 'first');
broker.sendToQueue('credit-q', 'second');

let credit = 1;
broker.consume('credit-q', onMessage, { prefetch: 10, capacity: () => credit });

console.log(broker.getQueue('credit-q').messageCount); // 2, one delivered and pending

credit = 5;
broker.getQueue('credit-q').consumeNext();

function onMessage(routingKey, message) {
  credit--;
  console.log(message.content, 'credit left', credit);
  message.ack();
}
```

### `queue.delete([deleteOptions])`

Delete queue.

Arguments:

- `deleteOptions`: Object with options
  - `ifUnused`: boolean, delete if unused
  - `ifEmpty`: boolean, delete if empty

Returns:

- `messageCount`: number of messages deleted

### `queue.dismiss(onMessage[, requeue = true])`

Dismiss first consumer with matching `onMessage` handler.

- `onMessage`: message handler function
- `requeue`: optional boolean to requeue messages consumed by consumer, or [cancel options](#queuecancelconsumertag-requeue-true)

### `queue.get([consumeOptions])`

Same as [`broker.get`](#brokergetqueuename-options) but you don't have to supply a queue name.

### `queue.getStats()`

Get queue statistics on demand:

- `name`: queue name
- `messageCount`: number of messages in queue, including delivered but unacked messages
- `unackedCount`: number of delivered but not yet acked or nacked messages
- `consumerCount`: number of consumers

### `queue.getState()`

Get queue state.

Will throw a TypeError if messages contains circular JSON. The error will be decorated with code `EQUEUE_STATE` and the name of the queue as `queue`.

### `queue.nack(message[, allUpTo, requeue = true])`

### `queue.nackAll([requeue = true])`

### `queue.on(eventName, handler[, consumeOptions])`

Listen for events from queue.

Events:

- `queue.consumer.cancel`: consumer was cancelled
- `queue.consume`: consumer was added
- `queue.dead-letter`: message was dead-lettered, sends `deadLetterExchange` name and message
- `queue.delete`: queue was deleted
- `queue.depleted`: queue is depleted
- `queue.message`: message was queued
- `queue.ready`: queue is ready to receive new messages
- `queue.saturated`: queue is saturated, i.e. max capacity was reached

Arguments:

- `eventName`: event pattern
- `handler`: event handler function
- `consumeOptions`: optional consume options
  - `consumerTag`: optional event consumer tag

Returns [consumer](#consumer)

### `queue.off(eventName, handler)`

Stop listening for events from queue.

### `queue.peek([ignoreDelivered])`

Peek into queue.

- `ignoreDelivered`: ignore if message was delivered or not

### `queue.purge()`

Removes all non consumed messages from queue.

### `queue.evictExpired()`

Evict expired undelivered messages, [see Message Eviction](#message-eviction). Evicted messages are dead-lettered if the queue has a `deadLetterExchange`. Returns the number of evicted messages.

### `queue.queueMessage(fields[, content, properties])`

Queue message.

- `fields`: object with fields, proposal:
  - `exchangeName`: exchange name
  - `routingKey`: routing key
- `content`: message content
- `properties`: message properties, basic properties are:
  - `persistent`: boolean indicating if message is persistent, defaults to undef (true). Value `false` ignores the message when queue is recovered from state

### `queue.recover([state])`

Recover queue, optionally from a previous [`queue.getState()`](#queuegetstate). With no argument, requeues messages held by current consumers and resumes consumption.

### `queue.reject(message[, requeue = true])`

### `queue.stop()`

### `queue.unbindConsumer(consumer[, requeue = true])`

Unbind consumer instance.

- `consumer`: consumer instance
- `requeue`: optional boolean to requeue messages consumed by consumer, or [cancel options](#queuecancelconsumertag-requeue-true)

## Consumer

Queue consumer

**Properties**:

- `options`: returns passed options
- `capacity`: consumer message capacity, limited by the `capacity` option if supplied
- `consumerTag`: consumer tag
- `messageCount`: current amount of messages handled by consumer
- `onMessage`: message callback
- `queueName`: consuming queue with name
- `ready`: boolean indicating if the consumer is ready for messages
- `stopped`: is the consumer stopped

### `consumer.ackAll()`

Ack all messages currently held by consumer

### `consumer.nackAll([requeue])`

Nack all messages currently held by consumer

### `consumer.cancel([requeue = true])`

Cancel consumption and unsubscribe from queue

- `requeue`: optional boolean to requeue messages consumed by consumer, or [cancel options](#queuecancelconsumertag-requeue-true)

### `consumer.prefetch(numberOfMessages)`

Set prefetch count. Takes effect immediately, lowering it below the number of held messages stops delivery until enough messages are acked, raising it resumes delivery.

### `consumer.on(eventName, handler)`

Subscribe to an event about this consumer. The handler is only called for events concerning this consumer, not for other consumers on the same queue.

- `eventName`: event name without the `consumer.` prefix, currently only `cancel` is emitted
- `handler(routingKey, message)`: event handler, `message.content` is the consumer

Returns an event consumer, cancel it to unsubscribe.

```javascript
import { Broker } from 'smqp';

const broker = new Broker();
broker.assertQueue('event-q', { autoDelete: false });
const consumer = broker.consume('event-q', () => {}, { consumerTag: 'mine' });
broker.consume('event-q', () => {}, { consumerTag: 'other' });

consumer.on('cancel', (routingKey, message) => {
  console.log('cancelled', message.content.consumerTag);
});

broker.cancel('other'); // nothing logged
broker.cancel('mine'); // cancelled mine
```

## Message

What it is all about - convey messages.

**Properties**:

- `fields`: message fields
  - `routingKey`: routing key if any
  - `redelivered`: message is redelivered
  - `exchange`: published through exchange
  - `consumerTag`: consumer tag when consumed
- `content`: message content
- `properties`: message properties, any number of properties can be set, known:
  - `messageId`: unique message id
  - `persistent`: persist message, if unset queue option durable prevails
  - `timestamp`: `Date.now()`
  - `expiration`: expire message after milliseconds
  - `ttl`: absolute expiry timestamp (`timestamp + expiration`), set automatically when `expiration` is provided
  - `mandatory`: boolean, if `true` the publishing exchange emits `return` when the message isn't routed to any queue
  - `source-exchange`: present on shovelled / e2e-routed messages, names the originating exchange
  - `shovel-name`: present on cross-broker shovelled messages, names the shovel
- `get pending()`: boolean indicating that the message is awaiting ack (true) or is acked/nacked (false)

### `message.ack([allUpTo])`

Acknowledge message

- `allUpTo`: boolean, consider all messages prior to this one to be acknowledged as well

### `message.nack([allUpTo, requeue])`

Reject message.

- `allUpTo`: optional boolean, consider all messages prior to this one to be rejected as well
- `requeue`: optional boolean, requeue messages, defaults to true

> NB! Beware of `requeue` argument since the message will immmediately be returned to queue and consumed, ergo an infinite loop and maximum call stack size exceeded error. Unless! some precautions are taken.

### `message.reject([requeue])`

Same as `nack(false, requeu)`

- `requeue`: optional boolean, requeue message, defaults to true

## `new Shovel(name, source, destination[, options])`

Create a shovel between brokers.

**Arguments**:

- `name`: shovel name
- `source`: source broker options
  - `broker`: source [broker](#new-brokerowner)
  - `exchange`: source exchange name
  - `pattern`: optional shovel message routing key pattern, defaults to `#`
  - `priority`: optional binding priority
  - `queue`: optional source binding queue name, must be asserted if used
  - `consumerTag`: optional source binding queue consumer tag name
- `destination`: destination broker options
  - `broker`: destination [broker](#new-brokerowner)
  - `exchange`: destination exchange name
  - `exchangeKey`: optional destination exchange routing key, defaults to original message's routing key
  - `publishProperties`: optional object with message properties to overwrite when shovelling messages
- `options`: optional shovel options
  - `cloneMessage`: optional function to handle message before shoveling, should return message, e.g `(message) => JSON.parse(JSON.stringify(message))`

**Properties**:

- `name`: readonly shovel name
- `source`: source broker options
  - `queue`: name of queue, added if not provided when creating shovel
- `destination`: destination broker options
- `closed`: readonly boolean if the shovel is closed or not
- `consumerTag`: readonly source queue consumer tag name

```javascript
import { Shovel, Broker } from 'smqp';

const sourceBroker = new Broker();

const sourceExchange = sourceBroker.assertExchange('events', 'topic');

const destinationBroker = new Broker();

const destinationExchange = destinationBroker.assertExchange('events', 'topic');

const shovel = new Shovel(
  'event2event',
  {
    broker: sourceBroker,
    exchange: sourceExchange.name,
  },
  {
    broker: destinationBroker,
    exchange: destinationExchange.name,
  }
);

destinationBroker.subscribeTmp(
  'events',
  'event.*',
  (_, msg) => {
    console.log({ shovelled: msg });
  },
  { noAck: true }
);

sourceBroker.publish('events', 'event.1', 'SHOVELME1');
```

Shoveled message properties will contain two extra properties:

- `source-exchange`: source exchange name
- `shovel-name`: shovel name

### `shovel.close()`

Close shovel.

### `shovel.on(eventName, callback[, options])`

Listen for events from Shovel.

Arguments:

- `eventName`: name of event or a "routingKey" pattern
- `callback`: event callback
- `options`: optional consume options
  - `consumerTag`: optional event consumer tag

Returns [consumer](#consumer) - that can be canceled.

### `shovel.off(eventName, callbackOrObject)`

Turn off event listener(s) associated with event callback.

Arguments:

- `eventName`: name of event
- `callbackOrObject`: event callback function to off or object with basically one property:
  - `consumerTag`: optional event consumer tag to off

## Exchange2Exchange

In-broker exchange-to-exchange shovel wrapper returned by [`broker.bindExchange`](#brokerbindexchangesource-destination-pattern-args). Thin facade over an internal [Shovel](#new-shovelname-source-destination-options).

**Properties** (all readonly):

- `name`: e2e binding name
- `source`: source exchange name
- `destination`: destination exchange name
- `pattern`: binding pattern
- `queue`: name of the source e2e queue
- `consumerTag`: consumer tag of the source e2e consumer

### `exchange2exchange.on(eventName, handler)`

Listen for events from the underlying shovel. Returns the event [consumer](#consumer).

### `exchange2exchange.close()`

Close the e2e binding (closes the underlying shovel).

## SmqpError

`throw SmqpError(message, code)` inherited from Error, it is thrown when package specific errors occur.

### `error.code`

- `ERR_SMQP_CONSUMER_TAG_CONFLICT`: consumer tag is already taken, must be unique within the broker
- `ERR_SMQP_EXCHANGE_TYPE_MISMATCH`: asserting an exchange with different type than existing exchange is not allowed
- `ERR_SMQP_EXCLUSIVE_CONFLICT`: consuming a queue that is exclusively consumed by someone else is not exclusive
- `ERR_SMQP_EXCLUSIVE_NOT_ALLOWED`: attempting to exclusively consume a queue that already has consumers is not allowed
- `ERR_SMQP_QUEUE_DURABLE_MISMATCH`: asserting a queue that has different durable option than existing queue is not allowed
- `ERR_SMQP_QUEUE_NAME_CONFLICT`: creating a queue with the same name as existing queue throws this code
- `ERR_SMQP_QUEUE_NOT_FOUND`: attempting to send a message to or consume a non-existing queue - KABLAM!
- `ERR_SMQP_SHOVEL_DESTINATION_EXCHANGE_NOT_FOUND`: shovel destination exchange was not found
- `ERR_SMQP_SHOVEL_NAME_CONFLICT`: a shovel with the same name already exists, suffix something, e.g. `_new` or come up with another name
- `ERR_SMQP_SHOVEL_SOURCE_EXCHANGE_NOT_FOUND`: shovel source exchange was not found, a bit self-explanatory
- `EQUEUE_STATE`: legacy code and acually a `TypeError`, will pop if queue messages has circular JSON when getting state. The queue culprit name is added to error as property `err.queue`

## `getRoutingKeyPattern(pattern)`

Get routing key pattern tester. Test routing key pattern against routing key.

Topic exchange patterns follow AMQP semantics. The pattern and the routing key are split into words on `.`, a `*` word matches exactly one word, which may be empty, and a `#` word matches zero or more words. Any other word, including `#` or `*` glued to other characters, is compared literally. An empty routing key has no words so it only matches an empty pattern or a pattern made up of `#` words.

```javascript
import { getRoutingKeyPattern } from 'smqp';

const pattern = getRoutingKeyPattern('activity.*');

console.log(pattern.test('activity.start')); // true
console.log(pattern.test('activity.execution.completed')); // false

const anyDepth = getRoutingKeyPattern('activity.#');

console.log(anyDepth.test('activity')); // true
console.log(anyDepth.test('activity.execution.completed')); // true

const inner = getRoutingKeyPattern('activity.#.completed');

console.log(inner.test('activity.completed')); // true
console.log(inner.test('activity.execution.completed')); // true
console.log(inner.test('activity.execution')); // false
```

## Message eviction

About message eviction: There are no timeouts that will automatically evict expired messages. Expired messages will simply not be returned in the message callback when the queue is consumed. Use a dead letter exchange to pick them up.

Expired messages that are never consumed stay in the queue until they are evicted. To evict them on demand, e.g. from your own interval or when a queue is inspected, call [`broker.evictExpired([queueName])`](#brokerevictexpiredqueuename) or [`queue.evictExpired()`](#queueevictexpired). Messages that are delivered but not yet acknowledged are never evicted.
