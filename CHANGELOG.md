Changelog
=========

# 1.3.1

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

