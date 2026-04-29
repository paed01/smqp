"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Binding = Binding;
var _shared = require("./shared.js");
/**
 *
 * @param {import('./Exchange.js').ExchangeBase} exchange
 * @param {import('./Queue.js').Queue} queue
 * @param {string} pattern message routing key pattern
 * @param {import('#types').BindingOptions} [bindOptions]
 */
function Binding(exchange, queue, pattern, bindOptions) {
  this.id = `${queue.name}/${pattern}`;
  this.options = {
    priority: 0,
    ...bindOptions
  };
  this.pattern = pattern;
  this.exchange = exchange;
  this.queue = queue;
  /** @type {{ test(routingKey: string): boolean }} */
  this._compiledPattern = (0, _shared.getRoutingKeyPattern)(pattern);
  queue.on('delete', () => {
    this.close();
  });
}

/**
 * Test routing key against pattern
 * @param {string} routingKey message routing key
 */
Binding.prototype.testPattern = function testPattern(routingKey) {
  return this._compiledPattern.test(routingKey);
};

/**
 * Close binding
 */
Binding.prototype.close = function closeBinding() {
  this.exchange.unbindQueue(this.queue, this.pattern);
};

/**
 * Get binding state
 */
Binding.prototype.getState = function getBindingState() {
  return {
    id: this.id,
    options: {
      ...this.options
    },
    queueName: this.queue.name,
    pattern: this.pattern
  };
};