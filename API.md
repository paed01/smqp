<!-- version -->
# 0.7.1 API Reference
<!-- versionstop -->

The api is inspired by the amusing [`amqplib`](https://github.com/squaremo/amqp.node) api reference.

<!-- toc -->

- [API reference](#api-reference)
  - [`Broker([owner])`](#brokerowner)
    - [`broker.subscribe(exchangeName, pattern, queueName, onMessage[, options])`](#brokersubscribeexchangename-pattern-queuename-onmessage-options)
    - [`broker.subscribeTmp(exchangeName, pattern, onMessage[, options])`](#brokersubscribetmpexchangename-pattern-onmessage-options)
    - [`broker.subscribeOnce(exchangeName, pattern, onMessage[, options])`](#brokersubscribeonceexchangename-pattern-onmessage-options)
    - [`broker.unsubscribe(queueName, onMessage)`](#brokerunsubscribequeuename-onmessage)
    - [`broker.publish(exchangeName, routingKey[, content, options])`](#brokerpublishexchangename-routingkey-content-options)
    - [`broker.close()`](#brokerclose)
    - [`broker.assertExchange(exchangeName[, type = topic, options])`](#brokerassertexchangeexchangename-type--topic-options)
    - [`broker.deleteExchange(exchangeName[, ifUnused])`](#brokerdeleteexchangeexchangename-ifunused)
    - [`broker.bindExchange()`](#brokerbindexchange)
    - [`broker.unbindExchange()`](#brokerunbindexchange)
    - [`broker.assertQueue(queueName[, options])`](#brokerassertqueuequeuename-options)
    - [`broker.bindQueue(queueName, exchangeName, pattern[, options])`](#brokerbindqueuequeuename-exchangename-pattern-options)
    - [`broker.unbindQueue(queueName, exchangeName, pattern)`](#brokerunbindqueuequeuename-exchangename-pattern)
    - [`broker.consume(queueName, onMessage[, options])`](#brokerconsumequeuename-onmessage-options)
    - [`broker.cancel(consumerTag)`](#brokercancelconsumertag)
    - [`broker.createQueue()`](#brokercreatequeue)
    - [`broker.deleteQueue(queueName)`](#brokerdeletequeuequeuename)
    - [`broker.getExchange(exchangeName)`](#brokergetexchangeexchangename)
    - [`broker.getQueue(queueName)`](#brokergetqueuequeuename)
    - [`broker.getState()`](#brokergetstate)
    - [`broker.recover([state])`](#brokerrecoverstate)
    - [`broker.purgeQueue(queueName)`](#brokerpurgequeuequeuename)
    - [`broker.sendToQueue(queueName, routingKey[, content, options])`](#brokersendtoqueuequeuename-routingkey-content-options)
    - [`broker.stop()`](#brokerstop)
  - [Consumer](#consumer)
    - [`consumer.ack([allUpTo])`](#consumerackallupto)
    - [`consumer.ackAll()`](#consumerackall)
    - [`consumer.nack([allUpTo, requeue])`](#consumernackallupto-requeue)
    - [`consumer.nackAll([requeue])`](#consumernackallrequeue)
    - [`consumer.cancel()`](#consumercancel)
  - [Message](#message)
    - [`ack([allUpTo])`](#ackallupto)
    - [`nack([allUpTo, requeue])`](#nackallupto-requeue)
    - [`reject([requeue])`](#rejectrequeue)

<!-- tocstop -->

# API reference

## `Broker([owner])`
Start new broker owned by optional `owner`.

### `broker.subscribe(exchangeName, pattern, queueName, onMessage[, options])`
Asserts an exvhange, a named queue and returns a new [consumer](#consumer) to that queue.

To make sure the exchange, and or queue has the desired behaviour, please use [`assertExchange()`](#brokerassertexchangeexchangename-type--topic-options) and [`assertQueue()`](#brokerassertqueuequeuename-options)

- `exchangeName`: exchange name
- `pattern`: queue binding pattern
- `queueName`: queue name
- `onMessage`: message callback
- `options`:
  - `autoDelete`: boolean, defaults to `true`, exchange will be deleted when all bindings are removed; the queue will be removed when all consumers are down
  - `consumerTag`: unique consumer tag
  - `deadLetterExchange`: string, name of dead letter exchange. Will be asserted as topic exchange
  - `durable`: boolean, defaults to `true`, makes exchange and queue durable, i.e. will be returned when getting state
  - `exclusive`: boolean, queue is exclusively consumed
  - `noAck`: boolean, set to `true` if there is no need to acknowledge message
  - `prefetch`: integer, defaults to `1`, number of messages to consume at a time
  - `priority`: integer, defaults to `0`, higher value gets messages first

The message callback signature:
```javascript
import {Broker} from 'smqp';

const owner = {name: 'me'};
const broker = Broker(owner);

broker.subscribe('events', '#', 'event-queue', onMessage);

broker.publish('events', 'start', {arg: 1});

function onMessage(routingKey, message, brokerOwner) {
  console.log('received:', routingKey);
  console.log('with message:', message);
  console.log('owned by:', brokerOwner.name);
  message.ack();
}
```

### `broker.subscribeTmp(exchangeName, pattern, onMessage[, options])`
Asserts exchange and creates a temporary queue with random name, i.e. not durable, and returns a new [consumer](#consumer).

- `exchangeName`: exchange name
- `pattern`: queue binding pattern
- `onMessage`: message callback
- `options`:
  - `autoDelete`: boolean, defaults to `true`, exchange will be deleted when all bindings are removed; the queue will be removed when all consumers are down
  - `consumerTag`: unique consumer tag
  - `deadLetterExchange`: string, name of dead letter exchange. Will be asserted as topic exchange
  - **`durable`**: set to `false` with no option to override
  - `noAck`: boolean, set to `true` if there is no need to acknowledge message
  - `prefetch`: integer, defaults to `1`, number of messages to consume at a time
  - `priority`: integer, defaults to `0`, higher value gets messages first

### `broker.subscribeOnce(exchangeName, pattern, onMessage[, options])`
Same as `subscribeTmp` and will immediately close consumer when first message arrive.

- `exchangeName`: exchange name
- `pattern`: queue binding pattern
- `onMessage`: message callback
- `options`:
  - `consumerTag`: unique consumer tag

Oh, btw, option `noAck` will be set to `true` so there is no need to ack message in message callback.

### `broker.unsubscribe(queueName, onMessage)`
Remove consumer with message callback from queue.

### `broker.publish(exchangeName, routingKey[, content, options])`
Publish message to exchange.

- `exchangeName`: exchange name
- `routingKey`: routing key
- `content`: object containing message content
- `options`: Message options, actually not used at the moment but will be accessible with the message

### `broker.close()`
Close exchanges, queues, and all consumers

### `broker.assertExchange(exchangeName[, type = topic, options])`
Creates exchange with name.

- `type`: type of exchange, must be one of `topic` or `direct`, defaults to `topic`.
- `options`:
  - `durable`: boolean, defaults to `true`, makes queue durable, i.e. will be returned when getting state
  - `autoDelete`: boolean, defaults to `true`, the exchange will be removed when all consumers are down

### `broker.deleteExchange(exchangeName[, ifUnused])`

### `broker.bindExchange()`
Not yet implemented

### `broker.unbindExchange()`
Not yet implemented

### `broker.assertQueue(queueName[, options])`
Assert a queue into existence.

- `options`:
  - `durable`: boolean, defaults to `true`, makes queue durable, i.e. will be returned when getting state
  - `autoDelete`: boolean, defaults to `true`, the queue will be removed when all consumers are down
  - `deadLetterExchange`: string, name of dead letter exchange. Will be asserted as topic exchange if non-existing

### `broker.bindQueue(queueName, exchangeName, pattern[, options])`
### `broker.unbindQueue(queueName, exchangeName, pattern)`

### `broker.consume(queueName, onMessage[, options])`
Consume queue. Returns a [consumer](#consumer). If the message callback is already used for consumption, the existing consumer will be returned.

- `queueName`: queue name
- `onMessage`: message callback
- `options`:
  - `exclusive`: boolean, defaults to `false`, queue is exclusively consumed
  - `noAck`: boolean, defaults to `false`
  - `prefetch`: integer, defaults to `1`, number of messages to consume at a time
  - `priority`: integer, defaults to `0`, higher value gets messages first

### `broker.cancel(consumerTag)`
Cancel consumption by consumer tag.

### `broker.createQueue()`
### `broker.deleteQueue(queueName)`

### `broker.getExchange(exchangeName)`
### `broker.getQueue(queueName)`
Get queue by name. Returns existing queue or nothing

### `broker.getState()`
Return serializable object containing durable exchanges, bindings, and durable queues with messages.

### `broker.recover([state])`
Recovers exchanges, bindings, and queues with messages. A state can be passed, preferably from [`getState()`](#brokergetstate).

### `broker.purgeQueue(queueName)`
Purge queue by name if found

### `broker.sendToQueue(queueName, routingKey[, content, options])`
Send message directly to queue, bypassing routing key patterns etc.

### `broker.stop()`
No more messages through this broker, i.e. publish will be ignored. Use [`broker.recover()`](#brokerrecoverstate) to resume.

## Consumer
Queue consumer

**Properties**:
- `consumerTag`: random tag
- `noAck`: getter, returns value of option with the same name
- `onMessage`: message callback
- `options`: returns passed options
- `priority`: priority option value
- `queueName`: consuming queue with name

### `consumer.ack([allUpTo])`
### `consumer.ackAll()`
### `consumer.nack([allUpTo, requeue])`
### `consumer.nackAll([requeue])`
### `consumer.cancel()`
Cancel consumption and unsubscribe from queue

## Message

### `ack([allUpTo])`
Acknowledge message

- `allUpTo`: boolean, consider all messages above this one to be acknowledged as well

### `nack([allUpTo, requeue])`
Reject message.

NB! Beware of `requeue` argument since the message will immmediately be returned to queue and consumed, ergo an infinit loop and maximum call stack size exceeded error unless some precautions are made.

- `allUpTo`: boolean, consider all messages above this one to be rejected as well
- `requeue`: boolean, requeue messages

### `reject([requeue])`
Same as `nack(false, true)`
