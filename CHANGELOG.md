Changelog
=========

# 8.1.0

- noAck consumer continues consuming if error is thrown in message callback, the error is, hopefully, caught somewhere else
- ack consumer continues consuming if error is thrown in message callback after message was acked
- add some Broker, Queue, Exchange, Shovel, and Consumer argument constraints
- fix exchange to exchange binding type

# 8.0.0

- shovel ignores shoveling if destination exchange lacks bindings, could be breaking if cloneMessage function option was used to make things happen
- abide to new lint rules
- bump all dev dependencies

# 7.1.4

- type declare broker state from `getState()`

# 7.1.3

- no need to type declare that a function can return undefined, prevents assigning a typed variable
- return undefined instead of false if deleting non-existing queue
- return undefined instead of false if no message on queue.get

# 7.1.2

- Fix queue recover not returning instance of Queue when recovering without state
- and some typing blunders

# 7.1.1

- Fix type declaration forbidden override and boolean typo. Introduce circular type import in Shovel, which apparently is ok!?

# 7.1.0

- Add type declarations

# 7.0.0

- Turn into module with exports for node
- Rename symbol declarations for no reason at all

# 6.1.0

- Minor performance tweek by prototyping routing key patterns
- Stop building node 12
- Lint some

# 6.0.0

## Breaking

- Message functions `ack`, `nack`, and `reject`, if deconstructed, must be called with call or apply since they are no longer bound to instance. Sacrificed in the name of performance, sorry about that
- Internal Message function `consume` is renamed to `_consume`
- Internal and/or undocumented functions are renamed and decorated with underscore, some where even - highly unnecessary - Symbols
- `exchange.bind` renamed to `exchange.bindQueue` to mitigate JavaScript confusion
- consequentely the `exchange.unbind` function is renamed to `exchange.unbindQueue`
- `broker.cancel(consumerTag)` signature changed to `broker.cancel(consumerTag[, requeue = true])`. This breaks current behaviour for ack consumers, i.e. messages waiting for ack will be requeued by default if the consumer is cancelled. For some reason they were requeued in the previous version, even though nackAll was called? For no-ack consumers this won't have an affect at all

## Additions
- `*.get()` returns `false` if no message was retrieved

## Fixes
- Fix inconsistent cancel consumer behaviour between broker, queue, and consumer

# 5.1.3

- minor, probably futile, tweaks

# 5.1.2

- give a hint of which Queue throws circular JSON when getting state

# 5.1.1

- no side effects

# 5.1.0

Slimmer state

- Add argument to `getState` that tells the broker to only return stuff that actually has content, i.e. messages and undelivered exchange messages

# 5.0.0

Attempt to tweak performance by removing stuff. Consequently some things broke.

## Breaking

- Remove support for node 10 (mochas fault)
- Message property `consumerTag` is removed, can be found by `message.fields.consumerTag`
- Message property `messageId` is removed, can be found by `message.properties.messageId`
- Remove `onMessageQueued` argument from `queue.queueMessage` function
- Remove `queue.dequeueMessage(message)` function
- Change routing key pattern hash (#) handling to `/.*?/` from `/.+?/`

## Fixes

- Fix pattern matching bug if more than one wildcard

# 4.0.0

For performance reasons the Broker has been prototyped. Thank you @roberto-naharro and co for discovering and resolving this (#5). This means that functions cannot be deconstructed and called without binding or using call/apply.

# 3.2.0

Slimmer and swifter state.

- `getState`: Only use JSON-fns when really necessary (= messages)
- Stop dead lettering messages when queue is deleted. Did some deep forrest coverage hunting and found no scenario when this has ever worked, maybe since it isn't part of RabbitMQ behaviour

# 3.1.0

Coverage hunting.

- Stop consumers when queue is stopped
- Remove setter for message consumerTag

# 3.0.1

- Sometimes you need the name of the event, especially if you listen with wildcards. The name is an exact match of the emitted message routing key.

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
