<!-- version -->
# 1.5.0 API Reference
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
    - [`broker.bindExchange()`](#brokerbindexchange)
    - [`broker.unbindExchange()`](#brokerunbindexchange)
    - [`broker.assertQueue(queueName[, options])`](#brokerassertqueuequeuename-options)
    - [`broker.bindQueue(queueName, exchangeName, pattern[, options])`](#brokerbindqueuequeuename-exchangename-pattern-options)
    - [`broker.unbindQueue(queueName, exchangeName, pattern)`](#brokerunbindqueuequeuename-exchangename-pattern)
    - [`broker.consume(queueName, onMessage[, options])`](#brokerconsumequeuename-onmessage-options)
    - [`broker.cancel(consumerTag)`](#brokercancelconsumertag)
    - [`broker.createQueue()`](#brokercreatequeue)
    - [`broker.deleteQueue(queueName[, {ifUnused, ifEmpty}])`](#brokerdeletequeuequeuename-ifunused-ifempty)
    - [`broker.getExchange(exchangeName)`](#brokergetexchangeexchangename)
    - [`broker.getQueue(queueName)`](#brokergetqueuequeuename)
    - [`broker.getState()`](#brokergetstate)
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
    - [`broker.on(eventName, callback)`](#brokeroneventname-callback)
    - [`broker.prefetch(count)`](#brokerprefetchcount)
  - [Queue](#queue)
    - [`ack(message)`](#ackmessage)
    - [`ackAll()`](#ackall)
    - [`assertConsumer(onMessage[, consumeOptions, owner])`](#assertconsumeronmessage-consumeoptions-owner)
    - [`cancel(consumerTag)`](#cancelconsumertag)
    - [`close()`](#close)
    - [`consume(onMessage[, consumeOptions, owner])`](#consumeonmessage-consumeoptions-owner)
    - [`delete([deleteOptions])`](#deletedeleteoptions)
    - [`dequeueMessage(message)`](#dequeuemessagemessage)
    - [`dismiss(onMessage)`](#dismissonmessage)
    - [`get([consumeOptions])`](#getconsumeoptions)
    - [`getState()`](#getstate)
    - [`nack(message[, allUpTo, requeue = true])`](#nackmessage-allupto-requeue--true)
    - [`nackAll([requeue = true])`](#nackallrequeue--true)
    - [`on(eventName, handler)`](#oneventname-handler)
    - [`peek([ignoreDelivered])`](#peekignoredelivered)
    - [`purge()`](#purge)
    - [`queueMessage(fields[, content, properties, onMessageQueued])`](#queuemessagefields-content-properties-onmessagequeued)
    - [`recover([state])`](#recoverstate)
    - [`reject(message[, requeue = true])`](#rejectmessage-requeue--true)
    - [`stop()`](#stop)
    - [`unbindConsumer()`](#unbindconsumer)
  - [Consumer](#consumer)
    - [`consumer.ackAll()`](#consumerackall)
    - [`consumer.nackAll([requeue])`](#consumernackallrequeue)
    - [`consumer.cancel()`](#consumercancel)
  - [Message](#message)
    - [`ack([allUpTo])`](#ackallupto)
    - [`nack([allUpTo, requeue])`](#nackallupto-requeue)
    - [`reject([requeue])`](#rejectrequeue)
  - [`getRoutingKeyPattern(pattern)`](#getroutingkeypatternpattern)

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

function onMessage(routingKey, message, brokerOwner) {
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

Oh, btw, option `noAck` will be set to `true` so there is no need to ack message in message callback.

### `broker.unsubscribe(queueName, onMessage)`
Remove consumer with message callback from queue.

### `broker.publish(exchangeName, routingKey[, content, options])`
Publish message to exchange.

- `exchangeName`: exchange name
- `routingKey`: routing key
- `content`: message content
- `options`: Message options
  - `mandatory`: boolean indicating if message is mandatory. Value `true` emits `return` if not routed to any queue
  - `persistant`: boolean indicating if message is persistant, defaults to undef (true). Value `false` ignores the message when queue is recovered from state

### `broker.close()`
Close exchanges, queues, and all consumers

### `broker.assertExchange(exchangeName[, type = topic, options])`
Creates exchange with name.

- `type`: type of exchange, must be one of `topic` or `direct`, defaults to `topic`.
- `options`:
  - `durable`: boolean, defaults to `true`, makes queue durable, i.e. will be returned when getting state
  - `autoDelete`: boolean, defaults to `true`, the exchange will be removed when all consumers are down

### `broker.deleteExchange(exchangeName[, ifUnused])`

### `broker.bindExchange()`
Not yet implemented

### `broker.unbindExchange()`
Not yet implemented

### `broker.assertQueue(queueName[, options])`
Assert a queue into existence.

- `options`:
  - `durable`: boolean, defaults to `true`, makes queue durable, i.e. will be returned when getting state
  - `autoDelete`: boolean, defaults to `true`, the queue will be removed when all consumers are down
  - `deadLetterExchange`: string, name of dead letter exchange. Will be asserted as topic exchange if non-existing

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
### `broker.getQueue(queueName)`
Get queue by name. Returns existing queue or nothing

### `broker.getState()`
Return serializable object containing durable exchanges, bindings, and durable queues with messages.

### `broker.recover([state])`
Recovers exchanges, bindings, and queues with messages. A state can be passed, preferably from [`getState()`](#brokergetstate).

### `broker.purgeQueue(queueName)`
Purge queue by name if found

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

### `broker.on(eventName, callback)`

Listen for events from Broker. Returns consumer - that can be canceled.

- `eventName`: name of event
- `callback`: event callback

### `broker.prefetch(count)`

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

### `ack(message)`
### `ackAll()`
### `assertConsumer(onMessage[, consumeOptions, owner])`
### `cancel(consumerTag)`
Cancel consumer with tag

### `close()`
### `consume(onMessage[, consumeOptions, owner])`
### `delete([deleteOptions])`
Delete queue.

- `deleteOptions`: Object with options
  - `ifUnused`: boolean, delete if unused
  - `ifEmpty`: boolean, delete if empty

### `dequeueMessage(message)`
Remove message from queue without redelivery.

### `dismiss(onMessage)`
Dismiss first consumer with `onMessage` handler.

### `get([consumeOptions])`
### `getState()`
### `nack(message[, allUpTo, requeue = true])`
### `nackAll([requeue = true])`
### `on(eventName, handler)`
Listen for events from queue.

Events:
- `cancel`: consumer was cancelled
- `consume`: consumer was added
- `dead-letter`: message was dead-lettered, sends `deadLetterExhange` name and message
- `delete`: queue was deleted
- `depleted`: queue is depleted
- `message`: message was queued
- `ready`: queue is ready to ready to receive new messages
- `saturated`: queue is saturated, i.e. max capacity was reached

### `peek([ignoreDelivered])`
Peek into queue.

- `ignoreDelivered`: ignore if message was delivered or not

### `purge()`
### `queueMessage(fields[, content, properties, onMessageQueued])`
Queue message.

- `fields`: object with fields, proposal:
  - `exchangeName`: exchange name
  - `routingKey`: routing key
- `content`: message content
- `properties`: message properties, basic properties are:
  - `persistant`: boolean indicating if message is persistant, defaults to undef (true). Value `false` ignores the message when queue is recovered from state
- `onMessageQueued`: optional function mainly used for interal purposes. Called when message was queued

### `recover([state])`
### `reject(message[, requeue = true])`
### `stop()`
### `unbindConsumer()`

## Consumer
Queue consumer

**Properties**:
- `consumerTag`: random tag
- `noAck`: getter, returns value of option with the same name
- `onMessage`: message callback
- `options`: returns passed options
- `priority`: priority option value
- `queueName`: consuming queue with name

### `consumer.ackAll()`
### `consumer.nackAll([requeue])`
### `consumer.cancel()`
Cancel consumption and unsubscribe from queue

## Message

### `ack([allUpTo])`
Acknowledge message

- `allUpTo`: boolean, consider all messages above this one to be acknowledged as well

### `nack([allUpTo, requeue])`
Reject message.

NB! Beware of `requeue` argument since the message will immmediately be returned to queue and consumed, ergo an infinit loop and maximum call stack size exceeded error unless some precautions are made.

- `allUpTo`: boolean, consider all messages above this one to be rejected as well
- `requeue`: boolean, requeue messages

### `reject([requeue])`
Same as `nack(false, true)`


## `getRoutingKeyPattern(pattern)`
Test routing key pattern against routing key.

```js
import {getRoutingKeyPattern} from 'smqp';

const {test} = getRoutingKeyPattern('activity.*');

console.log(test('activity.start')); // true
console.log(test('activity.execution.completed')); // false
```
