<!-- version -->
# 0.3.0 API Reference
<!-- versionstop -->

The api is inspired by the amusing [`amqplib`](https://github.com/squaremo/amqp.node) api reference.

<!-- toc -->

- [Utility](#utility)
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
  - [`bindQueue(queueName, exchangeName, pattern[, options])`](#bindqueuequeuename-exchangename-pattern-options)
  - [`unbindQueue(queueName, exchangeName, pattern)`](#unbindqueuequeuename-exchangename-pattern)
  - [`assertQueue()`](#assertqueue)
  - [`consume(queueName, onMessage[, options])`](#consumequeuename-onmessage-options)
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

## `subscribe(exchangeName, pattern, queueName, onMessage[, options])`
Asserts an exchange, a named queue and returns a new [consumer](#consumer) to that queue.

- `exchangeName`: exchange name
- `pattern`: queue binding pattern
- `queueName`: queue name
- `onMessage`: message callback
- `options`:
  - `noAck`: boolean, defaults to `true`
  - `durable`: boolean, defaults to `false`, makes exchange and queue durable, i.e. will be returned when getting state
  - `autoDelete`: boolean, defaults to `true`, exchange will be deleted when all bindings are removed; the queue will be removed when all consumers are down
  - `prefetch`: integer, defaults to `1`, number of messages to consume at a time
  - `deadLetterExchange`: string, name of dead letter exchange. Will be asserted as topic exchange

## `subscribeTmp(exchangeName, pattern, onMessage[, options])`
Asserts exchange and creates a temporary queue with random name, i.e. not durable, and returns a new [consumer](#consumer).

## `subscribeOnce(exchangeName, pattern, onMessage)`
Same as `subscribeTmp` and will immediately close consumer when first message arrive.

## `unsubscribe(queueName, onMessage)`
Removes consumer from queue

## `publish(exchangeName, routingKey[, content, options])`

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

## `bindQueue(queueName, exchangeName, pattern[, options])`
## `unbindQueue(queueName, exchangeName, pattern)`

## `assertQueue(queueName[, options])`

Assert a queue into existence.

Options:
- `durable`: boolean, defaults to `false`, makes exchange and queue durable, i.e. will be returned when getting state
- `autoDelete`: boolean, defaults to `true`, exchange will be deleted when all bindings are removed; the queue will be removed when all consumers are down
- `deadLetterExchange`: string, name of dead letter exchange. Will be asserted as topic exchange if not exists

## `consume(queueName, onMessage[, options])`
## `createQueue()`
## `deleteQueue()`

## `getExchange()`
## `getQueue()`

## `getState()`
Return serializable object containg durable exchanges, bindings, and durable queues with messages

## `recover(state)`
Recovers exchanges, bindings, and queues with messages. Preferably from `getState()`

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

