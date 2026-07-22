import { generateId } from './shared.js';

const K_PENDING = Symbol.for('pending');
const K_ON_CONSUMED = Symbol.for('onConsumed');

/**
 * What it is all about - message
 * @param {import('#types').MessageFields} fields
 * @param {any} [content]
 * @param {import('#types').MessageProperties} [properties]
 * @param {CallableFunction} [onConsumed]
 */
export function Message(fields, content, properties, onConsumed) {
  /** @internal */
  this[K_ON_CONSUMED] = [null, onConsumed];
  /** @internal */
  this[K_PENDING] = false;

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
  /** @returns {boolean} */
  get() {
    return this[K_PENDING];
  },
});

/**
 * Acknowledge message
 * @param {boolean} [allUpTo] all outstanding messages prior to and including the given message shall be considered acknowledged. If false, or omitted, only the message supplied is acknowledged. Defaults to false
 */
Message.prototype.ack = function ack(allUpTo) {
  if (!this[K_PENDING]) return;
  for (const fn of this[K_ON_CONSUMED]) {
    if (fn) fn(this, 'ack', allUpTo);
  }
  this[K_PENDING] = false;
};

/**
 * Reject message
 * @param {boolean} [allUpTo] all outstanding messages prior to and including the given message shall be considered rejected. If false, or omitted, only the message supplied is rejected. Defaults to false
 * @param {boolean} [requeue] put the message or messages back on the queue, defaults to true
 */
Message.prototype.nack = function nack(allUpTo, requeue = true) {
  if (!this[K_PENDING]) return;
  for (const fn of this[K_ON_CONSUMED]) {
    if (fn) fn(this, 'nack', allUpTo, requeue);
  }
  this[K_PENDING] = false;
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
  this[K_PENDING] = true;
  this.fields.consumerTag = consumerTag;
  this[K_ON_CONSUMED][0] = consumedCb;
};

/** @private */
Message.prototype._clearPending = function clearPending() {
  this[K_PENDING] = false;
};
