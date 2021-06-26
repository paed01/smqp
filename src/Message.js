import { generateId } from './shared';

export { Message };

const messageIdSymbol = Symbol.for('messageId');
const ttlSymbol = Symbol.for('ttl');
const pendingSymbol = Symbol.for('pending');
const consumedCallbackSymbol = Symbol.for('consumedCallback');
const consumedSymbol = Symbol.for('consumed');
const onConsumedSymbol = Symbol.for('onConsumed');

const publicMethods = ['consume', 'ack', 'nack', 'reject'];

function Message(fields = {}, content, properties = {}, onConsumed) {
  if (!(this instanceof Message)) {
    return new Message(fields, content, properties, onConsumed);
  }

  this[onConsumedSymbol] = onConsumed;
  this[pendingSymbol] = false;
  this[messageIdSymbol] = properties.messageId || `smq.mid-${generateId()}`;

  const messageProperties = { ...properties, messageId: this[messageIdSymbol] };
  const timestamp = (messageProperties.timestamp =
    properties.timestamp || Date.now());
  if (properties.expiration) {
    this[ttlSymbol] = messageProperties.ttl =
      timestamp + parseInt(properties.expiration);
  }

  this.fields = { ...fields, consumerTag: undefined };
  this.content = content;
  this.properties = messageProperties;
  for (let i = 0; i < publicMethods.length; i++) {
    const fn = publicMethods[i];
    this[fn] = Message.prototype[fn].bind(this);
  }
}

// These assignations are called only once
Object.defineProperty(Message.prototype, 'messageId', {
  get() {
    return this[messageIdSymbol];
  },
});

Object.defineProperty(Message.prototype, 'ttl', {
  get() {
    return this[ttlSymbol];
  },
});

Object.defineProperty(Message.prototype, 'consumerTag', {
  get() {
    return this.fields.consumerTag;
  },
});

Object.defineProperty(Message.prototype, 'pending', {
  get() {
    return this[pendingSymbol];
  },
});

Message.prototype.consume = function({ consumerTag } = {}, consumedCb) {
  this[pendingSymbol] = true;
  this.fields.consumerTag = consumerTag;
  this[consumedCallbackSymbol] = consumedCb;
};

Message.prototype.reset = function() {
  this[pendingSymbol] = false;
};

Message.prototype.ack = function(allUpTo) {
  if (!this[pendingSymbol]) return;
  this[consumedSymbol]('ack', allUpTo);
};

Message.prototype.nack = function(allUpTo, requeue = true) {
  if (!this[pendingSymbol]) return;
  this[consumedSymbol]('nack', allUpTo, requeue);
};

Message.prototype.reject = function(requeue = true) {
  this.nack(false, requeue);
};

Message.prototype[consumedSymbol] = function(operation, allUpTo, requeue) {
  [
    this[consumedCallbackSymbol],
    this[onConsumedSymbol],
    this.reset.bind(this),
  ].forEach((fn) => {
    if (fn) fn(this, operation, allUpTo, requeue);
  });
};
