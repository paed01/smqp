<!-- version -->
# 0.5.0 API Reference
<!-- versionstop -->

The api is inspired by the amusing [`amqplib`](https://github.com/squaremo/amqp.node) api reference.

<!-- toc -->

- [API reference](#api-reference)
  - [`Broker([owner])`](#brokerowner)
  - [`subscribe(exchangeName, pattern, queueName, onMessage[, options])`](#subscribeexchangename-pattern-queuename-onmessage-options)
  - [`subscribeTmp(exchangeName, pattern, onMessage[, options])`](#subscribetmpexchangename-pattern-onmessage-options)
  - [`subscribeOnce(exchangeName, pattern, onMessage)`](#subscribeonceexchangename-pattern-onmessage)
  - [`unsubscribe(queueName, onMessage)`](#unsubscribequeuename-onmessage)
  - [`publish(exchangeName, routingKey[, content, options])`](#publishexchangename-routingkey-content-options)
  - [`close()`](#close)
  - [`assertExchange(exchangeName[, type = topic, options])`](#assertexchangeexchangename-type--topic-options)
  - [`deleteExchange(exchangeName[, ifUnused])`](#deleteexchangeexchangename-ifunused)
  - [`bindExchange()`](#bindexchange)
  - [`unbindExchange()`](#unbindexchange)
  - [`assertQueue(queueName[, options])`](#assertqueuequeuename-options)
  - [`bindQueue(queueName, exchangeName, pattern[, options])`](#bindqueuequeuename-exchangename-pattern-options)
  - [`unbindQueue(queueName, exchangeName, pattern)`](#unbindqueuequeuename-exchangename-pattern)
  - [`consume(queueName, onMessage[, options])`](#consumequeuename-onmessage-options)
  - [`cancel(consumerTag)`](#cancelconsumertag)
  - [`createQueue()`](#createqueue)
  - [`deleteQueue()`](#deletequeue)
  - [`getExchange()`](#getexchange)
  - [`getQueue()`](#getqueue)
  - [`getState()`](#getstate)
  - [`recover(state)`](#recoverstate)
  - [`purgeQueue()`](#purgequeue)
  - [`sendToQueue()`](#sendtoqueue)
  - [`stop()`](#stop)
- [Consumer](#consumer)
  - [`ack([allUpTo = false])`](#ackallupto--false)
  - [`ackAll()`](#ackall)
  - [`nack()`](#nack)
  - [`nackAll([requeue])`](#nackallrequeue)
  - [`cancel()`](#cancel)
- [Message](#message)
  - [`nack([allUpTo = false, requeue = false])`](#nackallupto--false-requeue--false)
  - [`ack([allUpTo = false])`](#ackallupto--false)
  - [`reject([requeue = false])`](#rejectrequeue--false)

<!-- tocstop -->

# API reference

## `Broker([owner])`
Start new broker owned by optional `owner`.

## `subscribe(exchangeName, pattern, queueName, onMessage[, options])`
Asserts an exchange, a named queue and returns a new [consumer](#consumer) to that queue.

- `exchangeName`: exchange name
- `pattern`: queue binding pattern
- `queueName`: queue name
- `onMessage`: message callback
- `options`:
  - `autoDelete`: boolean, defaults to `true`, exchange will be deleted when all bindings are removed; the queue will be removed when all consumers are down
  - `deadLetterExchange`: string, name of dead letter exchange. Will be asserted as topic exchange
  - `durable`: boolean, defaults to `false`, makes exchange and queue durable, i.e. will be returned when getting state
  - `noAck`: boolean, defaults to `false`
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

## `subscribeTmp(exchangeName, pattern, onMessage[, options])`
Asserts exchange and creates a temporary queue with random name, i.e. not durable, and returns a new [consumer](#consumer).

- `exchangeName`: exchange name
- `pattern`: queue binding pattern
- `onMessage`: message callback
- `options`:
  - `autoDelete`: boolean, defaults to `true`, exchange will be deleted when all bindings are removed; the queue will be removed when all consumers are down
  - `deadLetterExchange`: string, name of dead letter exchange. Will be asserted as topic exchange
  - **`durable`**: set to `false` with no option to override
  - `noAck`: boolean, defaults to `false`
  - `prefetch`: integer, defaults to `1`, number of messages to consume at a time
  - `priority`: integer, defaults to `0`, higher value gets messages first

## `subscribeOnce(exchangeName, pattern, onMessage)`
Same as `subscribeTmp` and will immediately close consumer when first message arrive.

- `exchangeName`: exchange name
- `pattern`: queue binding pattern
- `onMessage`: message callback

Oh, btw, option `noAck` will be set to `true` so there is no need to ack message in message callback.

## `unsubscribe(queueName, onMessage)`
Remove consumer with message callback from queue.

## `publish(exchangeName, routingKey[, content, options])`
Publish message to exchange.

- `exchangeName`: exchange name
- `routingKey`: routing key
- `content`: object containing message content
- `options`: Message options, actually not used at the moment but will be accessible with the message

## `close()`
Close exchanges, queues, and all consumers

## `assertExchange(exchangeName[, type = topic, options])`
Creates exchange with name.

Type must be one of `topic` or `direct`, defaults to `topic`.

## `deleteExchange(exchangeName[, ifUnused])`

## `bindExchange()`
Not yet implemented

## `unbindExchange()`
Not yet implemented

## `assertQueue(queueName[, options])`
Assert a queue into existence.

- `options`:
  - `durable`: boolean, defaults to `true`, makes queue durable, i.e. will be returned when getting state
  - `autoDelete`: boolean, defaults to `true`, the queue will be removed when all consumers are down
  - `deadLetterExchange`: string, name of dead letter exchange. Will be asserted as topic exchange if not exists

## `bindQueue(queueName, exchangeName, pattern[, options])`
## `unbindQueue(queueName, exchangeName, pattern)`

## `consume(queueName, onMessage[, options])`
Consume queue. Returns a [consumer](#consumer). If the message callback is already used for consumption, the existing consumer will be returned.

- `queueName`: queue name
- `onMessage`: message callback
- `options`:
  - `noAck`: boolean, defaults to `false`
  - `prefetch`: integer, defaults to `1`, number of messages to consume at a time
  - `priority`: integer, defaults to `0`, higher value gets messages first

## `cancel(consumerTag)`
Cancel consumption by consumer tag.

## `createQueue()`
## `deleteQueue()`

## `getExchange()`
## `getQueue()`

## `getState()`
Return serializable object containg durable exchanges, bindings, and durable queues with messages.

## `recover(state)`
Recovers exchanges, bindings, and queues with messages. Preferably from `getState()`.

## `purgeQueue()`
## `sendToQueue()`
## `stop()`

# Consumer
Queue consumer

**Properties**:
- `consumerTag`: random tag
- `noAck`
- `onMessage`: message callback
- `options`
- `priority`
- `queueName`: consuming queue name

## `ack([allUpTo = false])`
## `ackAll()`
## `nack()`
## `nackAll([requeue])`
## `cancel()`
Cancel consumption and unsubscribe from queue

# Message
Beware of `requeue` argument since the message will immmediately be returned to queue and consumed, ergo an infinit loop and maximum call stack size exceeded error unless some precatautions are made.

## `nack([allUpTo = false, requeue = false])`

## `ack([allUpTo = false])`
## `reject([requeue = false])`

