<!-- version -->
# 5.1.3 API Reference
<!-- versionstop -->

The api is inspired by the amusing [`amqplib`](https://github.com/squaremo/amqp.node) api reference.

<!-- toc -->

- [API reference](#api-reference)
  - [`Broker([owner])`](#brokerowner)
    - [`broker.subscribe(exchangeName, pattern, queueName, onMessage[, options])`](#brokersubscribeexchangename-pattern-queuename-onmessage-options)
    - [`broker.subscribeTmp(exchangeName, pattern, onMessage[, options])`](#brokersubscribetmpexchangename-pattern-onmessage-options)
    - [`broker.subscribeOnce(exchangeName, pattern, onMessage[, options])`](#brokersubscribeonceexchangename-pattern-onmessage-options)
    - [`broker.unsubscribe(queueName, onMessage)`](#brokerunsubscribequeuename-onmessage)
    - [`broker.publish(exchangeName, routingKey[, content, options])`](#brokerpublishexchangename-routingkey-content-options)
    - [`broker.close()`](#brokerclose)
    - [`broker.assertExchange(exchangeName[, type = topic, options])`](#brokerassertexchangeexchangename-type--topic-options)
    - [`broker.deleteExchange(exchangeName[, ifUnused])`](#brokerdeleteexchangeexchangename-ifunused)
    - [`broker.bindExchange(source, destination[, pattern, args])`](#brokerbindexchangesource-destination-pattern-args)
    - [`broker.unbindExchange(source, destination[, pattern])`](#brokerunbindexchangesource-destination-pattern)
    - [`broker.assertQueue(queueName[, options])`](#brokerassertqueuequeuename-options)
    - [`broker.bindQueue(queueName, exchangeName, pattern[, options])`](#brokerbindqueuequeuename-exchangename-pattern-options)
    - [`broker.unbindQueue(queueName, exchangeName, pattern)`](#brokerunbindqueuequeuename-exchangename-pattern)
    - [`broker.consume(queueName, onMessage[, options])`](#brokerconsumequeuename-onmessage-options)
    - [`broker.cancel(consumerTag)`](#brokercancelconsumertag)
    - [`broker.createQueue()`](#brokercreatequeue)
    - [`broker.deleteQueue(queueName[, {ifUnused, ifEmpty}])`](#brokerdeletequeuequeuename-ifunused-ifempty)
    - [`broker.getExchange(exchangeName)`](#brokergetexchangeexchangename)
    - [`broker.getQueue(queueName)`](#brokergetqueuequeuename)
    - [`broker.getConsumers()`](#brokergetconsumers)
    - [`broker.getConsumer(consumerTag)`](#brokergetconsumerconsumertag)
    - [`broker.getState([onlyWithContent])`](#brokergetstateonlywithcontent)
    - [`broker.recover([state])`](#brokerrecoverstate)
    - [`broker.purgeQueue(queueName)`](#brokerpurgequeuequeuename)
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
    - [`broker.closeShovel(name)`](#brokercloseshovelname)
    - [`broker.on(eventName, callback[, options])`](#brokeroneventname-callback-options)
    - [`broker.off(eventName, callbackOrObject)`](#brokeroffeventname-callbackorobject)
    - [`broker.prefetch(count)`](#brokerprefetchcount)
    - [`broker.reset()`](#brokerreset)
  - [Exchange](#exchange)
    - [`exchange.bind(queue, pattern[, bindOptions])`](#exchangebindqueue-pattern-bindoptions)
    - [`exchange.close()`](#exchangeclose)
    - [`exchange.emit(eventName[, content])`](#exchangeemiteventname-content)
    - [`exchange.getBinding(queueName, pattern)`](#exchangegetbindingqueuename-pattern)
    - [`exchange.getState()`](#exchangegetstate)
    - [`exchange.on(pattern, handler[, consumeOptions])`](#exchangeonpattern-handler-consumeoptions)
    - [`exchange.off(pattern, handlerOrObject)`](#exchangeoffpattern-handlerorobject)
    - [`exchange.publish(routingKey[, content, properties])`](#exchangepublishroutingkey-content-properties)
    - [`exchange.recover(state, getQueue)`](#exchangerecoverstate-getqueue)
    - [`exchange.stop()`](#exchangestop)
    - [`exchange.unbind(queue, pattern)`](#exchangeunbindqueue-pattern)
    - [`exchange.unbindQueueByName(queueName)`](#exchangeunbindqueuebynamequeuename)
  - [Queue](#queue)
    - [`queue.ack(message)`](#queueackmessage)
    - [`queue.ackAll()`](#queueackall)
    - [`queue.assertConsumer(onMessage[, consumeOptions, owner])`](#queueassertconsumeronmessage-consumeoptions-owner)
    - [`queue.cancel(consumerTag)`](#queuecancelconsumertag)
    - [`queue.close()`](#queueclose)
    - [`queue.consume(onMessage[, consumeOptions, owner])`](#queueconsumeonmessage-consumeoptions-owner)
    - [`queue.delete([deleteOptions])`](#queuedeletedeleteoptions)
    - [`queue.dismiss(onMessage)`](#queuedismissonmessage)
    - [`queue.get([consumeOptions])`](#queuegetconsumeoptions)
    - [`queue.getState()`](#queuegetstate)
    - [`queue.nack(message[, allUpTo, requeue = true])`](#queuenackmessage-allupto-requeue--true)
    - [`queue.nackAll([requeue = true])`](#queuenackallrequeue--true)
    - [`queue.off(eventName, handler)`](#queueoffeventname-handler)
    - [`queue.on(eventName, handler)`](#queueoneventname-handler)
    - [`queue.peek([ignoreDelivered])`](#queuepeekignoredelivered)
    - [`queue.purge()`](#queuepurge)
    - [`queue.queueMessage(fields[, content, properties])`](#queuequeuemessagefields-content-properties)
    - [`queue.recover([state])`](#queuerecoverstate)
    - [`queue.reject(message[, requeue = true])`](#queuerejectmessage-requeue--true)
    - [`queue.stop()`](#queuestop)
    - [`queue.unbindConsumer()`](#queueunbindconsumer)
  - [Consumer](#consumer)
    - [`consumer.ackAll()`](#consumerackall)
    - [`consumer.nackAll([requeue])`](#consumernackallrequeue)
    - [`consumer.cancel()`](#consumercancel)
    - [`consumer.prefetch(numberOfMessages)`](#consumerprefetchnumberofmessages)
  - [Message](#message)
    - [`message.ack([allUpTo])`](#messageackallupto)
    - [`message.nack([allUpTo, requeue])`](#messagenackallupto-requeue)
    - [`message.reject([requeue])`](#messagerejectrequeue)
  - [`getRoutingKeyPattern(pattern)`](#getroutingkeypatternpattern)
  - [Message eviction](#message-eviction)

<!-- tocstop -->

# API reference

## `Broker([owner])`
Start new broker owned by optional `owner`.

### `broker.subscribe(exchangeName, pattern, queueName, onMessage[, options])`
Asserts an exchange, a named queue, and returns [consumer](#consumer) to the named queue. The consumer is asserted into existance as well, i.e. message callback and options are matched.

To make sure the exchange, and or queue has the desired behaviour, please use [`assertExchange()`](#brokerassertexchangeexchangename-type--topic-options) and [`assertQueue()`](#brokerassertqueuequeuename-options)

- `exchangeName`: exchange name
- `pattern`: queue binding pattern
- `queueName`: queue name
- `onMessage`: message callback
- `options`:
  - `autoDelete`: boolean, defaults to `true`, exchange will be deleted when all bindings are removed; the queue will be removed when all consumers are down
  - `consumerTag`: unique consumer tag
  - `deadLetterExchange`: string, name of dead letter exchange. Will be asserted as topic exchange
  - `durable`: boolean, defaults to `true`, makes exchange and queue durable, i.e. will be returned when getting state
  - `exclusive`: boolean, queue is exclusively consumed
  - `noAck`: boolean, set to `true` if there is no need to acknowledge message
  - `prefetch`: integer, defaults to `1`, number of messages to consume at a time
  - `priority`: integer, defaults to `0`, higher value gets messages first

The message callback signature:
```javascript
import {Broker} from 'smqp';

const owner = {name: 'me'};
const broker = Broker(owner);

broker.subscribe('events', '#', 'event-queue', onMessage);

broker.publish('events', 'start', {arg: 1});

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
  - **`durable`**: set to `false` with no option to override
  - `noAck`: boolean, set to `true` if there is no need to acknowledge message
  - `prefetch`: integer, defaults to `1`, number of messages to consume at a time
  - `priority`: integer, defaults to `0`, higher value gets messages first

### `broker.subscribeOnce(exchangeName, pattern, onMessage[, options])`
Same as `subscribeTmp` and will immediately close consumer when first message arrive.

- `exchangeName`: exchange name
- `pattern`: queue binding pattern
- `onMessage`: message callback
- `options`:
  - `consumerTag`: unique consumer tag
  - `priority`: integer, defaults to `0`, higher value gets messages first

Oh, btw, option `noAck` will be set to `true` so there is no need to ack message in message callback.

### `broker.unsubscribe(queueName, onMessage)`
Remove consumer with message callback from queue.

### `broker.publish(exchangeName, routingKey[, content, options])`
Publish message to exchange.

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

- `type`: type of exchange, must be one of `topic` or `direct`, defaults to `topic`.
- `options`:
  - `durable`: boolean, defaults to `true`, makes queue durable, i.e. will be returned when getting state
  - `autoDelete`: boolean, defaults to `true`, the exchange will be removed when all consumers are down

Returns [Exchange](#exchange).

### `broker.deleteExchange(exchangeName[, ifUnused])`

### `broker.bindExchange(source, destination[, pattern, args])`

Shovel messages between exchanges aka e2e binding.

Arguments:
- `source`: source exchange name
- `destination`: destination exchange name
- `pattern`: optional binding pattern, defaults to all (`#`)
- `args`: Optional options object
  - `priority`: optional binding priority
  - `cloneMessage`: clone message function called with shoveled message

Returns:
- `name`: name of e2e binding
- `source`: source exchange name
- `destination`: destination exchange name
- `pattern`: pattern
- `queue`: name of source e2e queue
- `consumerTag`: consumer tag for temporary source e2e queue
- `on(eventName, handler)`: listen for shovel events, returns event consumer
- `close()`: close e2e binding

### `broker.unbindExchange(source, destination[, pattern])`

Close e2e binding.

Arguments:
- `source`: source exchange name
- `destination`: destination exchange name
- `pattern`: optional binding pattern, defaults to all (`#`)

### `broker.assertQueue(queueName[, options])`
Assert a queue into existence.

- `options`: optional queue options
  - `durable`: boolean, defaults to `true`, makes queue durable, i.e. will be returned when getting state
  - `autoDelete`: boolean, defaults to `true`, the queue will be removed when all consumers are down
  - `deadLetterExchange`: string, name of dead letter exchange. Will be asserted as topic exchange if non-existing
  - `messageTtl`: integer, expire message after milliseconds, [see Message Eviction](#message-eviction)

### `broker.bindQueue(queueName, exchangeName, pattern[, options])`
### `broker.unbindQueue(queueName, exchangeName, pattern)`

### `broker.consume(queueName, onMessage[, options])`
Consume queue. Returns a [consumer](#consumer). If the message callback is already used for consumption, the existing consumer will be returned.

- `queueName`: queue name
- `onMessage`: message callback
- `options`:
  - `exclusive`: boolean, defaults to `false`, queue is exclusively consumed
  - `noAck`: boolean, defaults to `false`
  - `prefetch`: integer, defaults to `1`, number of messages to consume at a time
  - `priority`: integer, defaults to `0`, higher value gets messages first

### `broker.cancel(consumerTag)`
Cancel consumption by consumer tag.

### `broker.createQueue()`
### `broker.deleteQueue(queueName[, {ifUnused, ifEmpty}])`
Delete queue by name.

- options
  - `ifUnused`: delete if no consumers, defaults to false
  - `ifEmpty`: delete if no messages, defaults to false

### `broker.getExchange(exchangeName)`
Get [exchange](#exchange) by name.

### `broker.getQueue(queueName)`
Get [queue](#queue) by name. Returns existing queue or nothing

### `broker.getConsumers()`
Returns a list of consumer properties, i.e. queue name, consumer tag, and options.

### `broker.getConsumer(consumerTag)`
Get [consumer](#consumer) by consumer tag. Returns existing consumer or nothing

### `broker.getState([onlyWithContent])`

Return serializable object containing durable exchanges, bindings, and durable queues with messages.

- `onlyWithContent`: boolean indicating that only exchanges and queues with undelivered or queued messages will be returned

### `broker.recover([state])`
Recovers exchanges, bindings, and queues with messages. A state can be passed, preferably from [`getState()`](#brokergetstate).

### `broker.purgeQueue(queueName)`
Purge queue by name if found. Removes all non consumed messages.

### `broker.sendToQueue(queueName, content[, options])`
Send message directly to queue, bypassing routing key patterns etc.

### `broker.stop()`
No more messages through this broker, i.e. publish will be ignored. Use [`broker.recover()`](#brokerrecoverstate) to resume.

### `broker.get(queueName[, options])`
Get message from queue.

### `broker.ack(message[, allUpTo])`
### `broker.ackAll()`
### `broker.nack(message[, allUpTo, requeue])`
### `broker.nackAll([requeue])`
### `broker.reject(message[, requeue])`

### `broker.createShovel(name, source, destination[, options])`

Shovel messages from exchange to another broker exchange.

> NB! Shovels are not recovered, the source exchange and queue may be recoverable depending on how they were created.

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
  - `publishProperties`: optional object with properties to overwrite when shovelling messages, applied after `cloneMessage` function
- `options`: Optional options object
  - `cloneMessage`: clone message function called with shoveled message, should return new message

Returns Shovel:
- `name`: name of shovel
- `source`: input source options
- `destination`: input destination broker options
  - `queue`: name of queue, added if not provided when creating shovel
- `consumerTag`: consumer tag for source shovel queue
- `on(eventName, handler)`: listen for shovel events, returns event consumer
- `close()`: close shovel and cancel source consumer tag

Shovel is closed if either source- or destination exchange is closed, or source consumer is canceled.

### `broker.getShovel(name)`

Get shovel by name.

### `broker.closeShovel(name)`

Close shovel by name.

### `broker.on(eventName, callback[, options])`

Listen for events from Broker.

Arguments:
- `eventName`: name of event or a "routingKey" pattern
- `callback`: event callback
- `options`: optional consume options
  - `consumerTag`: optional event consumer tag

Returns [consumer](#consumer) - that can be canceled.

Callback is called with the event and the name of the event, in the same object.

```js
broker.on('message.*', (event) => {
  console.log(event.name, 'fired');
}, {consumerTag: 'my-event-consumertag'});
```

### `broker.off(eventName, callbackOrObject)`

Turn off event listener(s) associated with event callback.

Arguments:
- `eventName`: name of event
- `callbackOrObject`: event callback function to off or object with basically one property:
  - `consumerTag`: optional event consumer tag to off

```js
broker.on('return', onMessageEvent, {consumerTag: 'my-event-consumertag'});

function onMessageEvent(event) {
  console.log(event.name, 'fired');
}

/* later */

broker.off('return', onMessageEvent);

/* or */

broker.off('return', {consumerTag: 'my-event-consumertag'});
```

### `broker.prefetch(count)`

Noop, only placeholder.

### `broker.reset()`

Reset everything. Deletes exchanges, queues, consumers, and bindings.

## Exchange
Exchange

Properties:
- `name`: exchange name
- `type`: exchange type, topic or direct
- `options`: exchange options
- `bindingCount`: getter for number of bindings
- `bindings`: getter for list of bindings
- `stopped`: boolean for if the exchange is stopped

### `exchange.bind(queue, pattern[, bindOptions])`
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

### `exchange.off(pattern, handlerOrObject)`

Stop consuming events from exchange.

- `pattern`: event pattern
- `handlerOrObject`: handler function to off or object with basically one property:
  - `consumerTag`: optional event consumer tag to off

### `exchange.publish(routingKey[, content, properties])`
Publish message on exchange.

### `exchange.recover(state, getQueue)`
### `exchange.stop()`
### `exchange.unbind(queue, pattern)`
Unbind queue from exchange.

Arguments:
- `queue`: queue instance
- `pattern`: binding pattern

### `exchange.unbindQueueByName(queueName)`
Remove all bindings to queue by queue name.

## Queue
Queue

Properties:
- `name`: queue name
- `options`: queue options
- `messages`: actual messages array, probably a good idea to not mess with, but it's there
- `messageCount`: message count
- `consumerCount`: consumer count
- `stopped`: is stopped
- `exclusive`: is exclusively consumed
- `maxLength`: get or set max length of queue
- `capacity`: `maxLength - messageCount`
- `messageTtl`: expire messages after milliseconds, [see Message Eviction](#message-eviction)

### `queue.ack(message)`
### `queue.ackAll()`
### `queue.assertConsumer(onMessage[, consumeOptions, owner])`
### `queue.cancel(consumerTag)`

Cancel consumer with tag

### `queue.close()`
### `queue.consume(onMessage[, consumeOptions, owner])`
### `queue.delete([deleteOptions])`

Delete queue.

Arguments:
- `deleteOptions`: Object with options
  - `ifUnused`: boolean, delete if unused
  - `ifEmpty`: boolean, delete if empty

Returns:
- `messageCount`: number of messages deleted

### `queue.dismiss(onMessage)`

Dismiss first consumer with `onMessage` handler.

### `queue.get([consumeOptions])`
### `queue.getState()`

Get queue state.

Will throw a TypeError of messages contains circular JSON. The error will be decorated with code `EQUEUE_STATE` and the name of the queue as `queue`.

### `queue.nack(message[, allUpTo, requeue = true])`
### `queue.nackAll([requeue = true])`
### `queue.off(eventName, handler)`
Stop listening for events from queue.

### `queue.on(eventName, handler)`
Listen for events from queue.

Events:
- `cancel`: consumer was cancelled
- `consume`: consumer was added
- `dead-letter`: message was dead-lettered, sends `deadLetterExchange` name and message
- `delete`: queue was deleted
- `depleted`: queue is depleted
- `message`: message was queued
- `ready`: queue is ready to ready to receive new messages
- `saturated`: queue is saturated, i.e. max capacity was reached

### `queue.peek([ignoreDelivered])`
Peek into queue.

- `ignoreDelivered`: ignore if message was delivered or not

### `queue.purge()`
Removes all non consumed messages from queue.

### `queue.queueMessage(fields[, content, properties])`
Queue message.

- `fields`: object with fields, proposal:
  - `exchangeName`: exchange name
  - `routingKey`: routing key
- `content`: message content
- `properties`: message properties, basic properties are:
  - `persistent`: boolean indicating if message is persistent, defaults to undef (true). Value `false` ignores the message when queue is recovered from state

### `queue.recover([state])`
### `queue.reject(message[, requeue = true])`
### `queue.stop()`
### `queue.unbindConsumer()`

## Consumer
Queue consumer

**Properties**:
- `options`: returns passed options
- `capacity`: consumer message capacity
- `consumerTag`: consumer tag
- `messageCount`: current amount of messages handled by consumer
- `onMessage`: message callback
- `queueName`: consuming queue with name
- `ready`: boolean indicating if the consumer is ready for messages
- `stopped`: is the consumer stopped

### `consumer.ackAll()`
### `consumer.nackAll([requeue])`
### `consumer.cancel()`

Cancel consumption and unsubscribe from queue

### `consumer.prefetch(numberOfMessages)`

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
  - `expiration`: Expire message after milliseconds

### `message.ack([allUpTo])`
Acknowledge message

- `allUpTo`: boolean, consider all messages above this one to be acknowledged as well

### `message.nack([allUpTo, requeue])`
Reject message.

NB! Beware of `requeue` argument since the message will immmediately be returned to queue and consumed, ergo an infinit loop and maximum call stack size exceeded error unless some precautions are made.

- `allUpTo`: boolean, consider all messages above this one to be rejected as well
- `requeue`: boolean, requeue messages

### `message.reject([requeue])`
Same as `nack(false, true)`


## `getRoutingKeyPattern(pattern)`
Test routing key pattern against routing key.

```js
import {getRoutingKeyPattern} from 'smqp';

const {test} = getRoutingKeyPattern('activity.*');

console.log(test('activity.start')); // true
console.log(test('activity.execution.completed')); // false
```

## Message eviction

A little about message eviction. There are no timeouts that will automatically evict expired messages. Expired messages will simply not be returned in the message callback when the queue is consumed. Use a dead letter exchange to pick them up.
