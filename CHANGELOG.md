Changelog
=========

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

