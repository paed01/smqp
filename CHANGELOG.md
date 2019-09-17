Changelog
=========

# 1.10.0

## Additions
- Support message expiration and queue `messageTtl`

## Fixes
- Acked messages where sent to dead letter exchange, they shouldn't, and are not anymore

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

