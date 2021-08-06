import { generateId } from './shared';

export { Message };

const ttlSymbol = Symbol.for('ttl');
const pendingSymbol = Symbol.for('pending');
const consumedCallbackSymbol = Symbol.for('consumedCallback');
const consumedSymbol = Symbol.for('consumed');
const onConsumedSymbol = Symbol.for('onConsumed');

const publicMethods = ['consume', 'ack', 'nack', 'reject'];

function Message(fields = {}, content, properties = {}, onConsumed) {
  this[onConsumedSymbol] = onConsumed;
  this[pendingSymbol] = false;

  const messageProperties = {
    ...properties,
    messageId: properties.messageId || `smq.mid-${generateId()}`
  };
  const timestamp = (messageProperties.timestamp = properties.timestamp || Date.now());
  if (properties.expiration) {
    this[ttlSymbol] = messageProperties.ttl = timestamp + parseInt(properties.expiration);
  }

  this.fields = { ...fields, consumerTag: undefined };
  this.content = content;
  this.properties = messageProperties;
  for (let i = 0; i < publicMethods.length; i++) {
    const fn = publicMethods[i];
    this[fn] = Message.prototype[fn].bind(this);
  }
}

Object.defineProperty(Message.prototype, 'ttl', {
  get() {
    return this[ttlSymbol];
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
  ].forEach((fn) => {
    if (fn) fn(this, operation, allUpTo, requeue);
  });
  this[pendingSymbol] = false;
};
