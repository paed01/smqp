"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Message = Message;

var _shared = require("./shared");

const pendingSymbol = Symbol.for('pending');
const onConsumedSymbol = Symbol.for('onConsumed');
const publicMethods = ['ack', 'nack', 'reject'];

function Message(fields, content, properties, onConsumed) {
  this[onConsumedSymbol] = [null, onConsumed];
  this[pendingSymbol] = false;
  const mproperties = { ...properties,
    messageId: properties && properties.messageId || `smq.mid-${(0, _shared.generateId)()}`
  };
  const timestamp = mproperties.timestamp = mproperties.timestamp || Date.now();

  if (mproperties.expiration) {
    mproperties.ttl = timestamp + parseInt(mproperties.expiration);
  }

  this.fields = { ...fields,
    consumerTag: undefined
  };
  this.content = content;
  this.properties = mproperties;

  for (let i = 0; i < publicMethods.length; i++) {
    const fn = publicMethods[i];
    this[fn] = Message.prototype[fn].bind(this);
  }
}

Object.defineProperty(Message.prototype, 'pending', {
  get() {
    return this[pendingSymbol];
  }

});

Message.prototype.consume = function ({
  consumerTag
} = {}, consumedCb) {
  this[pendingSymbol] = true;
  this.fields.consumerTag = consumerTag;
  this[onConsumedSymbol][0] = consumedCb;
};

Message.prototype.ack = function (allUpTo) {
  if (!this[pendingSymbol]) return;
  this[onConsumedSymbol].forEach(fn => {
    if (fn) fn(this, 'ack', allUpTo);
  });
  this[pendingSymbol] = false;
};

Message.prototype.nack = function (allUpTo, requeue = true) {
  if (!this[pendingSymbol]) return;
  this[onConsumedSymbol].forEach(fn => {
    if (fn) fn(this, 'nack', allUpTo, requeue);
  });
  this[pendingSymbol] = false;
};

Message.prototype.reject = function (requeue = true) {
  this.nack(false, requeue);
};