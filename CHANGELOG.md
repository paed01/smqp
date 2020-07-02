Changelog
=========

# 3.0.0

Confirm messages and node 10 and above.

## Breaking changes
- Drop nodejs 8 support, or at least for tests due to mocha

## Additions
- New message confirm option, will emit `message.nack`, `message.ack`, or `message.undelivered` on broker
- Support offing broker events by consumerTag
- Support offing exchange events by consumerTag

# 2.2.0

- Add broker function `getConsumers()` to get the list of consumer properties

# 2.1.1

- Ignore published message if no one is listening, unless it is mandatory

# 2.1.0

- Support changing destination exchange key in shovel
- Support overwriting shoveled message properties

# 2.0.1
- Support passing source binding priority to shovel or bound exchange

# 2.0.0

## Breaking changes
- `createShovel` has changed signature: last argument `cloneMessage` is converted to an `args` object, and `cloneMessage` moved to a property of `args`

## Additions
- Introduce e2e by `bindExchange` and consequentaly `unbindExchange`, shoveling messages between exchanges

# 1.11.1

- Fix consumer eventlistener not working at all due to messed up binary code
- Close shovel if source consumer is closed

# 1.11.0

## Additions
- Introduce shovel, shoveling messages between brokers

# 1.10.0

## Additions
- Support message expiration and queue `messageTtl`

## Fixes
- Acked messages were sent to dead letter exchange, they shouldn't, and are not anymore

# 1.9.0

- Add ability to reset everything, i.e. queues, exchanges, consumers you name it

# 1.8.0

- Support turning off queue event listener - `queue.off(eventName, handler)`

# 1.7.0

- `subscribeOnce` also takes priority option, as it should've from the beginning

# 1.6.0

- Support turning off event listener with `off(eventName, handler)`

# 1.5.0

- Non-persistent message, message option `persistent = false`, will not be recovered when recovering from state

# 1.4.1

- A recovered queue with messages always considers messages redelivered, regardless if queue was stopped or not

# 1.4.0

- Export `getRoutingKeyPattern`

# 1.3.0

- Expose broker owner

# 1.0.0

## Breaking changes
- `sendToQueue` has changed signature: argument `routingKey` is omitted, since it had nothing to do there anyhow
- Message in message callback has changed:
  - introduced new property named `fields`
  - `.routingKey` is moved to `fields.routingKey` along with new and fresh `exchange` and `consumerTag` properties
  - `.options` is renamed to `.properties`

