import { generateId } from './shared';

export { Message };

const kPending = Symbol.for('pending');
const kOnConsumed = Symbol.for('onConsumed');

function Message(fields, content, properties, onConsumed) {
  this[kOnConsumed] = [null, onConsumed];
  this[kPending] = false;

  const mproperties = {
    ...properties,
    messageId: properties && properties.messageId || `smq.mid-${generateId()}`,
  };
  const timestamp = (mproperties.timestamp = mproperties.timestamp || Date.now());
  if (mproperties.expiration) {
    mproperties.ttl = timestamp + parseInt(mproperties.expiration);
  }

  this.fields = {...fields, consumerTag: undefined};
  this.content = content;
  this.properties = mproperties;
}

Object.defineProperty(Message.prototype, 'pending', {
  get() {
    return this[kPending];
  },
});

Message.prototype._consume = function consume({consumerTag}, consumedCb) {
  this[kPending] = true;
  this.fields.consumerTag = consumerTag;
  this[kOnConsumed][0] = consumedCb;
};

Message.prototype.ack = function ack(allUpTo) {
  if (!this[kPending]) return;
  for (const fn of this[kOnConsumed]) {
    if (fn) fn(this, 'ack', allUpTo);
  }
  this[kPending] = false;
};

Message.prototype.nack = function nack(allUpTo, requeue = true) {
  if (!this[kPending]) return;
  for (const fn of this[kOnConsumed]) {
    if (fn) fn(this, 'nack', allUpTo, requeue);
  }
  this[kPending] = false;
};

Message.prototype.reject = function reject(requeue = true) {
  this.nack(false, requeue);
};
