Changelog
=========

# 1.0.0

## Breaking changes
- Message in message callback has changed:
  - introduced new property named `fields`
  - `routingKey` is moved to `fields.routingKey` along with new and fresh exchange (name)
  - `options` is renamed to `properties`

## Additions
- Support for parallel task loop
