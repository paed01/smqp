import { generateId } from './shared';

export { Message };

const prv = Symbol('private');
const publicMethods = ['consume', 'ack', 'nack', 'reject'];

class _Message {
  constructor(fields = {}, content, properties = {}, onConsumed) {
    this[prv] = {};

    this[prv].onConsumed = onConsumed;
    this[prv].pending = false;
    this[prv].messageId = properties.messageId || `smq.mid-${generateId()}`;

    const messageProperties = { ...properties, messageId: this[prv].messageId };
    const timestamp = (messageProperties.timestamp =
      properties.timestamp || Date.now());
    if (properties.expiration) {
      this[prv].ttl = messageProperties.ttl =
        timestamp + parseInt(properties.expiration);
    }

    this.fields = { ...fields, consumerTag: undefined };
    this.content = content;
    this.properties = messageProperties;
    publicMethods.forEach((fn) => {
      this[fn] = _Message.prototype[fn].bind(this);
    });
  }

  get messageId() {
    return this[prv].messageId;
  }

  get ttl() {
    return this[prv].ttl;
  }

  get consumerTag() {
    return this.fields.consumerTag;
  }

  get pending() {
    return this[prv].pending;
  }

  consume({ consumerTag } = {}, consumedCb) {
    this[prv].pending = true;
    this.fields.consumerTag = consumerTag;
    this[prv].consumedCallback = consumedCb;
  }

  reset() {
    this[prv].pending = false;
  }

  ack(allUpTo) {
    if (this[prv].pending) {
      this._consumed('ack', allUpTo);
    }
  }

  nack(allUpTo, requeue = true) {
    if (!this[prv].pending) return;
    this._consumed('nack', allUpTo, requeue);
  }

  reject(requeue = true) {
    this.nack(false, requeue);
  }

  _consumed(operation, allUpTo, requeue) {
    [
      this[prv].consumedCallback,
      this[prv].onConsumed,
      this.reset.bind(this),
    ].forEach((fn) => {
      if (fn) fn(this, operation, allUpTo, requeue);
    });
  }
}

function Message(fields = {}, content, properties = {}, onConsumed) {
  return new _Message(fields, content, properties, onConsumed);
}
