import { generateId } from './shared.js';

/** @type {symbol} */
const kPending = Symbol.for('pending');
/** @type {symbol} */
const kOnConsumed = Symbol.for('onConsumed');

/** @typedef {Pick<Message, 'fields' | 'content' | 'properties'>} MessageEnvelope */

/**
 * What it is all about - message
 * @param {import('#types').MessageFields} fields
 * @param {any} [content]
 * @param {import('#types').MessageProperties} [properties]
 * @param {CallableFunction} [onConsumed]
 */
export function Message(fields, content, properties, onConsumed) {
  /** @private */
  this[kOnConsumed] = [null, onConsumed];
  this[kPending] = false;

  const mproperties = {
    ...properties,
    messageId: properties?.messageId || `smq.mid-${generateId()}`,
  };
  const timestamp = (mproperties.timestamp = mproperties.timestamp || Date.now());
  if (mproperties.expiration) {
    mproperties.ttl = timestamp + parseInt(mproperties.expiration);
  }

  const { consumerTag, ...mfields } = fields;

  /**
   * Message fields
   * @type {import('#types').MessageFields}
   */
  this.fields = mfields;
  /**
   * Message content
   * @type {any}
   */
  this.content = content;
  /**
   * Message properties
   * @type {import('#types').MessageProperties}
   */
  this.properties = mproperties;
}

Object.defineProperty(Message.prototype, 'pending', {
  get() {
    return this[kPending];
  },
});

/**
 * Acknowledge message
 * @param {boolean} [allUpTo] all outstanding messages prior to and including the given message shall be considered acknowledged. If false, or omitted, only the message supplied is acknowledged. Defaults to false
 */
Message.prototype.ack = function ack(allUpTo) {
  if (!this[kPending]) return;
  for (const fn of this[kOnConsumed]) {
    if (fn) fn(this, 'ack', allUpTo);
  }
  this[kPending] = false;
};

/**
 * Reject message
 * @param {boolean} [allUpTo] all outstanding messages prior to and including the given message shall be considered rejected. If false, or omitted, only the message supplied is rejected. Defaults to false
 * @param {boolean} [requeue] put the message or messages back on the queue, defaults to true
 */
Message.prototype.nack = function nack(allUpTo, requeue = true) {
  if (!this[kPending]) return;
  for (const fn of this[kOnConsumed]) {
    if (fn) fn(this, 'nack', allUpTo, requeue);
  }
  this[kPending] = false;
};

/**
 * Reject message
 * @param {boolean} [requeue] put the message back on the queue, defaults to true
 */
Message.prototype.reject = function reject(requeue = true) {
  this.nack(false, requeue);
};

/** @private */
Message.prototype._consume = function consume(consumerTag, consumedCb) {
  this[kPending] = true;
  this.fields.consumerTag = consumerTag;
  this[kOnConsumed][0] = consumedCb;
};

/** @private */
Message.prototype._clearPending = function clearPending() {
  this[kPending] = false;
};
