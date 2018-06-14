API
===

# Utility

## `subscribe(exchangeName, pattern, queueName, onMessage[, options])`
- returns consumer

## `subscribeOnce(exchangeName, pattern, onMessage)`
- returns consumer

## `subscribeTmp(exchangeName, pattern, onMessage)`
- returns consumer

## `unsubscribe(queueName, onMessage)`

## `publish(exchangeName, routingKey[, content, options])`

## `close()`
Close exchanges and queues. Will close consumers and purge all messages

## `assertExchange(exchangeName, type[, options])`
Creates exchange with name.

Type must be one of `topic` or `direct`, defaults to `topic`.

## `deleteExchange(exchangeName[, ifUnused])`

## `bindExchange()`
Not implemented, yet

## `unbindExchange()`
Not implemented, yet

## `bindQueue(queueName, exchangeName, pattern)`
## `unbindQueue()`

## `assertQueue()`
## `consume()`
## `createQueue()`
## `deleteQueue()`
## `getExchange()`
## `getQueue()`
## `getState()`
## `purgeQueue()`
## `recover()`
## `sendToQueue()`
## `stop()`

# Message

## `nack([allUpTo, requeue])`
