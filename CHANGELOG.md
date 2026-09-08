# Changelog

## v14.0.0

### Breaking

- `consumer.cancel()` no longer emits `cancel` through the consumer. The queue unbinds the consumer directly and emits `queue.consumer.cancel` as before, so `consumer.on('cancel')` and `queue.on('consumer.cancel')` still fire. Emitting `cancel` on a consumer yourself no longer unbinds it, use `consumer.cancel()`

### Additions

- add consume option `capacity`, a function returning the credit the consumer currently accepts. The consumer gets the lesser of credit and prefetch capacity and is not ready while credit is zero
- add `queue.consumeNext()` to deliver available messages when credit is raised. Replaces the private `_consumeNext()`
- add `fanout` exchange type, routes to every bound queue regardless of routing key. Binding patterns are ignored but must still be strings
- cancel accepts options, `{ keepPending: true }` leaves messages held by the consumer pending on the queue as AMQP does on `basic.cancel`. Applies to `broker.cancel`, `queue.cancel`, `queue.dismiss`, `queue.unbindConsumer`, and `consumer.cancel`. Type `CancelOptions` is exported

## v13.2.0 - 2026-09-05

- add `queue.evictExpired()` and `broker.evictExpired([queueName])` to evict expired messages on demand. There are still no timers; call it when it suits you and expired messages are dead-lettered as usual
- add `queue.getStats()` and `broker.getStats()` returning `messageCount`, `unackedCount`, and `consumerCount` on demand. Types `QueueStats` and `BrokerStats` are exported
- fix dead-lettering a message without routing key, e.g. sent with `broker.sendToQueue` or queued with `queue.queueMessage({})`, throwing `TypeError` when routed. Messages sent with `sendToQueue` now carry an empty string routing key, as AMQP prescribes, and dead-lettered messages default to an empty string routing key
- fix queue available message count drifting after expired messages were evicted during consume

## v13.1.0 - 2026-07-22

- attempt to improve types

## v13.0.1 - 2026-05-28

- fix some type declarations

## v13.0.0 - 2026-05-10

### Breaking

- drop default export of `Broker` — use `import { Broker } from 'smqp'`. For the ts-script-kids out there squinting at `Broker_1` in the `.d.ts`: that was the dual default+named export forcing tsc to disambiguate. Now it's just `Broker`.
- drop the CJS footer that made `module.exports` the bare `Broker` callable. Use `const { Broker } = require('smqp')`; `const Broker = require('smqp')` no longer returns a callable.

## v12.0.0 - 2026-05-05

- fix `broker.createShovel` typings: source no longer requires `broker`
- expose shared types (`MessageEnvelope`, `MessageProperties`, `ConsumeOptions`, `ShovelSource`, etc.) as importable members of `smqp` — previously they were bundled as private declarations
- type ~~`MessageMessage`~~ is renamed to `MessageEnvelope`

## v12.0.0 - 2026-05-01

- build commonjs with rollup into one file, namely dist/index.cjs
- refactor types by using jsdoc typing and dts-buddy, should probably be closer to the truth but be aware
- development is now performed in node 22 since eslint dropped support for previous versions

## v11.0.1 - 2025-12-02

- mitigate degraded performance as a result of refactoring consumer tag uniqueness

## v11.0.0 - 2025-11-27

### Breaking

- calling `queue.consume(onMessage, {consumerTag})` with existing consumer tag throws `SmqpError`. The previous behaviour effectively bypassed the unique consumer tag check leaving a lingering consumer munching messages.

## v10.0.2 - 2025-11-13

- prove provenance and get green-outlined-cake-checkbox-badge by publishing with github actions

## v10.0.1 - 2025-07-23

Belt and suspenders release.

- allow recover messages without properties
- make sure recovered message without fields is ok

## v10.0.0 - 2025-07-21

- small breaking change when it comes to instantiate a new message - fields object is required
- use optional chaining (?) and nullish coalescing (??) where feasible since it's widely available, in nodejs since v14
- shovel on event listener function takes consumer options
- export Message type as class
- export Consumer type as class
- document shovel

## v9.0.6 - 2025-02-04

- some ticks saved by letting the queue queue a published message rather than handing it over to internal `exchange._publishToQueue` to queue the published message
- es5 trailing commas touched all files

## v9.0.5 - 2025-01-02

- get returns false if there is no consumable message on queue, as stated in doc
- make sure api is exposed as expected

## v9.0.4 - 2024-12-17

- export MessageMessage and ShovelOptions from fussy type declarations

## v9.0.3 - 2024-11-08

- attempt to fix whiny type declarations

## v9.0.2 - 2024-06-14

- no need to sort single binding or consumer by priority or if priority is not supplied

## v9.0.1 - 2024-06-10

- stop emitting queue `message` event when message is queued, no listeners AFAIK

## v9.0.0 - 2024-06-08

### Breaking

- exchange-, shovel-, and queue name are read-only
- stop emitting exchange `bind` and `unbind` events, no listeners AFAIK
- `broker.getConsumer(consumerTag)` requires consumer tag to be a string

### Fixes

- replace entities arrays with `new Map()` to gain some performance
- fix API.md `getRoutingKeyPattern` example, destructing a method from an prototyped instance doesn't work
- run through markdown examples with [texample](https://www.npmjs.com/package/texample)

## v8.2.4 - 2024-04-19

- using prettier for formatting rules was mistakenly considered a production dependency. Now it is back where it belong.

## v8.2.3 - 2024-04-08

- major update of eslint
- use prettier for formatting rules, touched basically ALL files

## v8.2.2 - 2024-02-03

- `broker.getConsumers()` now also returns if the consumer is ready or not. Cannot remember why, but the info is there

## v8.2.1 - 2023-10-21

- export Message, Queue, Consumer, and Exchange
- allow queue event options `queue.on(event, handler[, options])`
- cancelling a consumer returns true if consumer was found and false if not
- `broker.get(queueName, { noAck: true })` not only dequeues message it also marks the actual message as consumed on the, until now, undocumented `message.pending` flag
- fix other inconsistent message pending stuff

## v8.2.0 - 2023-09-03

- introduce `SmqpError(message, code)` inherited from Error, it is thrown when package specific errors occur. It is also exported so that instance can be checked
- no more general errors, either it is a `TypeError` or `SmqpError`
- fix inconsistent cancel consumer implementations in queue, add requeue argument when applicable

## v8.1.0 - 2023-08-26

- noAck consumer continues consuming if error is thrown in message callback, the error is, hopefully, caught somewhere else
- ack consumer continues consuming if error is thrown in message callback after message was acked
- add some Broker, Queue, Exchange, Shovel, and Consumer argument constraints
- fix exchange to exchange binding type

## v8.0.0 - 2023-06-22

- shovel ignores shoveling if destination exchange lacks bindings, could be breaking if cloneMessage function option was used to make things happen
- abide to new lint rules
- bump all dev dependencies

## v7.1.4 - 2023-04-05

- type declare broker state from `getState()`

## 7.1.3

- no need to type declare that a function can return undefined, prevents assigning a typed variable
- return undefined instead of false if deleting non-existing queue
- return undefined instead of false if no message on queue.get

## 7.1.2

- Fix queue recover not returning instance of Queue when recovering without state
- and some typing blunders

## 7.1.1

- Fix type declaration forbidden override and boolean typo. Introduce circular type import in Shovel, which apparently is ok!?

## 7.1.0

- Add type declarations

## 7.0.0

- Turn into module with exports for node
- Rename symbol declarations for no reason at all

## 6.1.0

- Minor performance tweek by prototyping routing key patterns
- Stop building node 12
- Lint some

## 6.0.0

### Breaking

- Message functions `ack`, `nack`, and `reject`, if deconstructed, must be called with call or apply since they are no longer bound to instance. Sacrificed in the name of performance, sorry about that
- Internal Message function `consume` is renamed to `_consume`
- Internal and/or undocumented functions are renamed and decorated with underscore, some where even - highly unnecessary - Symbols
- `exchange.bind` renamed to `exchange.bindQueue` to mitigate JavaScript confusion
- consequentely the `exchange.unbind` function is renamed to `exchange.unbindQueue`
- `broker.cancel(consumerTag)` signature changed to `broker.cancel(consumerTag[, requeue = true])`. This breaks current behaviour for ack consumers, i.e. messages waiting for ack will be requeued by default if the consumer is cancelled. For some reason they were requeued in the previous version, even though nackAll was called? For no-ack consumers this won't have an affect at all

### Additions

- `*.get()` returns `false` if no message was retrieved

### Fixes

- Fix inconsistent cancel consumer behaviour between broker, queue, and consumer

## 5.1.3

- minor, probably futile, tweaks

## 5.1.2

- give a hint of which Queue throws circular JSON when getting state

## 5.1.1

- no side effects

## 5.1.0

Slimmer state

- Add argument to `getState` that tells the broker to only return stuff that actually has content, i.e. messages and undelivered exchange messages

## 5.0.0

Attempt to tweak performance by removing stuff. Consequently some things broke.

### Breaking

- Remove support for node 10 (mochas fault)
- Message property `consumerTag` is removed, can be found by `message.fields.consumerTag`
- Message property `messageId` is removed, can be found by `message.properties.messageId`
- Remove `onMessageQueued` argument from `queue.queueMessage` function
- Remove `queue.dequeueMessage(message)` function
- Change routing key pattern hash (#) handling to `/.*?/` from `/.+?/`

### Fixes

- Fix pattern matching bug if more than one wildcard

## 4.0.0

For performance reasons the Broker has been prototyped. Thank you @roberto-naharro and co for discovering and resolving this (#5). This means that functions cannot be deconstructed and called without binding or using call/apply.

## 3.2.0

Slimmer and swifter state.

- `getState`: Only use JSON-fns when really necessary (= messages)
- Stop dead lettering messages when queue is deleted. Did some deep forrest coverage hunting and found no scenario when this has ever worked, maybe since it isn't part of RabbitMQ behaviour

## 3.1.0

Coverage hunting.

- Stop consumers when queue is stopped
- Remove setter for message consumerTag

## 3.0.1

- Sometimes you need the name of the event, especially if you listen with wildcards. The name is an exact match of the emitted message routing key.

## 3.0.0

Confirm messages and node 10 and above.

### Breaking changes

- Drop nodejs 8 support, or at least for tests due to mocha

### Additions

- New message confirm option, will emit `message.nack`, `message.ack`, or `message.undelivered` on broker
- Support offing broker events by consumerTag
- Support offing exchange events by consumerTag

## 2.2.0

- Add broker function `getConsumers()` to get the list of consumer properties

## 2.1.1

- Ignore published message if no one is listening, unless it is mandatory

## 2.1.0

- Support changing destination exchange key in shovel
- Support overwriting shoveled message properties

## 2.0.1

- Support passing source binding priority to shovel or bound exchange

## 2.0.0

### Breaking changes

- `createShovel` has changed signature: last argument `cloneMessage` is converted to an `args` object, and `cloneMessage` moved to a property of `args`

### Additions

- Introduce e2e by `bindExchange` and consequentaly `unbindExchange`, shoveling messages between exchanges

## 1.11.1

- Fix consumer eventlistener not working at all due to messed up binary code
- Close shovel if source consumer is closed

## 1.11.0

### Additions

- Introduce shovel, shoveling messages between brokers

## 1.10.0

### Additions

- Support message expiration and queue `messageTtl`

### Fixes

- Acked messages were sent to dead letter exchange, they shouldn't, and are not anymore

## 1.9.0

- Add ability to reset everything, i.e. queues, exchanges, consumers you name it

## 1.8.0

- Support turning off queue event listener - `queue.off(eventName, handler)`

## 1.7.0

- `subscribeOnce` also takes priority option, as it should've from the beginning

## 1.6.0

- Support turning off event listener with `off(eventName, handler)`

## 1.5.0

- Non-persistent message, message option `persistent = false`, will not be recovered when recovering from state

## 1.4.1

- A recovered queue with messages always considers messages redelivered, regardless if queue was stopped or not

## 1.4.0

- Export `getRoutingKeyPattern`

## 1.3.0

- Expose broker owner

## 1.0.0

### Breaking changes

- `sendToQueue` has changed signature: argument `routingKey` is omitted, since it had nothing to do there anyhow
- Message in message callback has changed:
  - introduced new property named `fields`
  - `.routingKey` is moved to `fields.routingKey` along with new and fresh `exchange` and `consumerTag` properties
  - `.options` is renamed to `.properties`
