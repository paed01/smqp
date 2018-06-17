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
  - [`nack([allUpTo, requeue])`](#nackallupto-requeue)
  - [`ack([allUpTo])`](#ackallupto)
  - [`reject([requeue])`](#rejectrequeue)

<!-- tocstop -->

# Utility

## `subscribe(exchangeName, pattern, queueName, onMessage[, options])`
Asserts a topic exchange and a named queue and returns a new [consumer](#consumer) to that queue.

Options:
- `noAck`: boolean, defaults to `true`
- `durable`: boolean, defaults to `false`, makes exchange and queue durable, i.e. will be returned when getting state
- `autoDelete`: boolean, defaults to `true`, exchange will be deleted when all bindings are removed; the queue will be removed when all consumers are down
- `prefetch`: integer, defaults to `1`, number of messages to consume at a time

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

## `assertQueue()`
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

## `nack([allUpTo, requeue])`
## `ack([allUpTo])`
## `reject([requeue])`

