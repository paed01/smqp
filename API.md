<!-- version -->
# 8.2.2 API Reference
<!-- versionstop -->

The api is inspired by the amusing [`amqplib`](https://github.com/squaremo/amqp.node) api reference.

<!-- toc -->

- [API reference](#api-reference)
  - [`new Broker([owner])`](#new-brokerowner)
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
    - [`broker.cancel(consumerTag[, requeue = true])`](#brokercancelconsumertag-requeue--true)
    - [`broker.createQueue(queueName[, options])`](#brokercreatequeuequeuename-options)
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
  - [Binding](#binding)
    - [`binding.testPattern(routingKey)`](#bindingtestpatternroutingkey)
    - [`binding.close()`](#bindingclose)
  - [Queue](#queue)
    - [`queue.ack(message[, allUpTo])`](#queueackmessage-allupto)
    - [`queue.ackAll()`](#queueackall)
    - [`queue.assertConsumer(onMessage[, consumeOptions, owner])`](#queueassertconsumeronmessage-consumeoptions-owner)
    - [`queue.cancel(consumerTag[, requeue = true])`](#queuecancelconsumertag-requeue--true)
    - [`queue.close()`](#queueclose)
    - [`queue.consume(onMessage[, options, owner])`](#queueconsumeonmessage-options-owner)
    - [`queue.delete([deleteOptions])`](#queuedeletedeleteoptions)
    - [`queue.dismiss(onMessage[, requeue = true])`](#queuedismissonmessage-requeue--true)
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
    - [`queue.unbindConsumer(consumer[, requeue = true])`](#queueunbindconsumerconsumer-requeue--true)
  - [Consumer](#consumer)
    - [`consumer.ackAll()`](#consumerackall)
    - [`consumer.nackAll([requeue])`](#consumernackallrequeue)
    - [`consumer.cancel([requeue = true])`](#consumercancelrequeue--true)
    - [`consumer.prefetch(numberOfMessages)`](#consumerprefetchnumberofmessages)
  - [Message](#message)
    - [`message.ack([allUpTo])`](#messageackallupto)
    - [`message.nack([allUpTo, requeue])`](#messagenackallupto-requeue)
    - [`message.reject([requeue])`](#messagerejectrequeue)
  - [SmqpError](#smqperror)
    - [`error.code`](#errorcode)
  - [`getRoutingKeyPattern(pattern)`](#getroutingkeypatternpattern)
  - [Message eviction](#message-eviction)

<!-- tocstop -->

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

- `type`: type of exchange, must be one of `topic` or `direct`, defaults to `topic`.
- `options`:
  - `durable`: boolean, defaults to `true`, makes queue durable, i.e. will be returned when getting state
  - `autoDelete`: boolean, defaults to `true`, the exchange will be removed when all consumers are down

Returns [Exchange](#exchange).

### `broker.deleteExchange(exchangeName[, ifUnused])`

Delete exchange by name

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

Returns [consumer](#consumer).

### `broker.cancel(consumerTag[, requeue = true])`

Cancel consumption by consumer tag.

- `consumerTag`: consumer tag
- `requeue`: optional boolean to requeue messages consumed by consumer

Returns true if consumer tag was found, and consequently false if not.

### `broker.createQueue(queueName[, options])`

Create queue with name. Throws if queue already exists.

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
Recovers exchanges, bindings, and queues with messages. A state may be passed, preferably from [`getState()`](#brokergetstate).

### `broker.purgeQueue(queueName)`
Purge queue by name if found. Removes all non consumed messages.

### `broker.sendToQueue(queueName, content[, options])`
Send message directly to queue, bypassing routing key patterns etc.

### `broker.stop()`
No more messages through this broker, i.e. publish will be ignored. Use [`broker.recover()`](#brokerrecoverstate) to resume.

### `broker.get(queueName[, options])`

Get message from queue. Returns false if there are no messages to be retrieved. Returns undefined if the queue is not found.

Arguments:
- `queueName`: name of queue
- `options`: optional object with options
  - `noAck`: optional boolean, defaults to `false`

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
- `bindings`: getter for list of [bindings](#binding)
- `stopped`: boolean for if the exchange is stopped

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
### `exchange.unbindQueue(queue, pattern)`
Unbind queue from exchange.

Arguments:
- `queue`: queue instance
- `pattern`: binding pattern

### `exchange.unbindQueueByName(queueName)`
Remove all bindings to queue by queue name.

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
- `stopped`: is stopped
- `exclusive`: is exclusively consumed
- `maxLength`: get or set max length of queue
- `capacity`: `maxLength - messageCount`
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
- `requeue`: optional boolean to requeue messages consumed by consumer

Returns true if consumer tag was found, and consequently false if not.

### `queue.close()`

Closes queue consumers and requeues outstanding messages.

### `queue.consume(onMessage[, options, owner])`

Consume queue messages.

- `onMessage(routingKey, message, owner)`: message callback
  * `routingKey`: message routing key
  * [`message`](#message): the message
  * `owner`: optional owner passed in signature
- `options`: optional consume options, see [`broker.consume`](#brokerconsumequeuename-onmessage-options)
- `owner`: optional owner to be passed to message callback, mainly for internal use when consuming by broker but feel free to pass anything here

Returns [consumer](#consumer).

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
- `requeue`: optional boolean to requeue messages consumed by consumer

### `queue.get([consumeOptions])`

Same as [`broker.get`](#brokergetqueuename-options) but you don't have to supply a queue name.

### `queue.getState()`

Get queue state.

Will throw a TypeError if messages contains circular JSON. The error will be decorated with code `EQUEUE_STATE` and the name of the queue as `queue`.

### `queue.nack(message[, allUpTo, requeue = true])`
### `queue.nackAll([requeue = true])`
### `queue.off(eventName, handler)`
Stop listening for events from queue.

### `queue.on(eventName, handler)`
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
### `queue.unbindConsumer(consumer[, requeue = true])`

Unbind consumer instance.

- `consumer`: consumer instance
- `requeue`: optional boolean to requeue messages consumed by consumer

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

Ack all messages currently held by consumer

### `consumer.nackAll([requeue])`

Nack all messages currently held by consumer

### `consumer.cancel([requeue = true])`

Cancel consumption and unsubscribe from queue

- `requeue`: optional boolean to requeue messages consumed by consumer

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

```js
import { getRoutingKeyPattern } from 'smqp';

const { test } = getRoutingKeyPattern('activity.*');

console.log(test('activity.start')); // true
console.log(test('activity.execution.completed')); // false
```

## Message eviction

About message eviction: There are no timeouts that will automatically evict expired messages. Expired messages will simply not be returned in the message callback when the queue is consumed. Use a dead letter exchange to pick them up.
