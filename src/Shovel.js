import { EventExchange } from './Exchange';


const prv = Symbol('private');

const shovelPublicMethods = [
  'close',
];

class _Shovel {
  constructor(name, source, destination, options = {}) {
    const { broker: sourceBroker, exchange: sourceExchangeName, pattern, queue, priority } = source;
    const { broker: destinationBroker, exchange: destinationExchangeName, publishProperties, exchangeKey } = destination;
    const { cloneMessage } = options;

    const sourceExchange = sourceBroker.getExchange(sourceExchangeName);
    if (!sourceExchange) {
      throw new Error(`shovel ${name} source exchange <${sourceExchangeName}> not found`);
    }

    const destinationExchange = destinationBroker.getExchange(destinationExchangeName);
    if (!destinationExchange) {
      throw new Error(`shovel ${name} destination exchange <${destinationExchangeName}> not found`);
    }

    shovelPublicMethods.forEach((fn) => {
      this[fn] = _Shovel.prototype[fn].bind(this);
    });

    const eventHandlers = [
      sourceExchange.on('delete', this.close),
      destinationExchange.on('delete', this.close),
    ];

    const consumerTag = source.consumerTag || `smq.shoveltag-${name}`;
    const routingKeyPattern = pattern || '#';

    this[prv] = {
      sameBroker: sourceBroker === destinationBroker,
      events: EventExchange(),
      closed: false,
      cloneMessage,
      destination,
      destinationExchange,
      eventHandlers,
      exchangeKey,
      publishProperties,
      sourceBroker,
      sourceExchangeName,
    };

    this.name = name;
    this.source = { ...source, pattern: routingKeyPattern };
    this.destination = { ...destination };
    this.consumerTag = consumerTag;
    this.on = this[prv].events.on;

    const onShovelMessage = _Shovel.prototype.onShovelMessage.bind(this);
    let consumer;
    if (queue) {
      consumer = sourceBroker.subscribe(sourceExchangeName, routingKeyPattern, queue, onShovelMessage, { consumerTag, priority });
    } else {
      consumer = sourceBroker.subscribeTmp(sourceExchangeName, routingKeyPattern, onShovelMessage, { consumerTag, priority });
      this.source.queue = consumer.queue.name;
    }
    eventHandlers.push(consumer.on('cancel', this.close));
  }

  get closed() {
    return this[prv].closed;
  }

  onShovelMessage(routingKey, message) {
    const { content, properties } = this.messageHandler(message);
    const props = { ...properties, ...this[prv].publishProperties, 'source-exchange': this[prv].sourceExchangeName };
    if (!this[prv].sameBroker) props['shovel-name'] = this.name;
    this[prv].destinationExchange.publish(this[prv].exchangeKey || routingKey, content, props);
    message.ack();
  }

  close() {
    if (this[prv].closed) return;
    this[prv].closed = true;
    this[prv].eventHandlers.splice(0).forEach((e) => e.cancel());
    this[prv].events.emit('close', this);
    this[prv].events.close();
    this[prv].sourceBroker.cancel(this.consumerTag);
  }

  messageHandler(message) {
    if (!this[prv].cloneMessage) return message;

    const { fields, content, properties } = message;
    const { content: newContent, properties: newProperties } = this[prv].cloneMessage({
      fields: { ...fields },
      content,
      properties: { ...properties },
    });

    return {
      fields,
      content: newContent,
      properties: { ...properties, ...newProperties },
    };
  }
}

export function Shovel(name, source, destination, options = {}) {
  return new _Shovel(name, source, destination, options);
}
