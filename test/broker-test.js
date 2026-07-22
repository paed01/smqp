// @ts-check
import * as ck from 'chronokinesis';

import * as smqp from 'smqp';
import { Broker, Queue, Consumer, Exchange, SmqpError, Shovel, Message } from 'smqp';

describe('Broker', () => {
  describe('api', () => {
    it('has the expected export', () => {
      // @ts-ignore
      expect(smqp.default, 'default export').to.be.undefined;
      expect(smqp.Broker === Broker, 'Broker').to.be.true;
      expect(smqp.Queue === Queue, 'Queue').to.be.true;
      expect(smqp.Consumer === Consumer, 'Consumer').to.be.true;
      expect(smqp.Message === Message, 'Message').to.be.true;
      expect(smqp.Exchange === Exchange, 'Exchange').to.be.true;
      expect(smqp.Shovel === Shovel, 'Shovel').to.be.true;
      expect(smqp.SmqpError === SmqpError, 'SmqpError').to.be.true;
      expect(smqp.ERR_CONSUMER_TAG_CONFLICT, 'ERR_CONSUMER_TAG_CONFLICT').to.equal('ERR_SMQP_CONSUMER_TAG_CONFLICT');
    });

    it('exposes owner as owner', () => {
      const owner = {};
      const broker = Broker(owner);

      expect(broker.owner).to.equal(owner);
    });
  });

  describe('subscribe(...)', () => {
    it('creates topic exchange with passed exchange name if not exists', () => {
      const broker = new Broker();

      broker.subscribe('test', 'test.#', 'persist', () => {});

      const exchange = broker.getExchange('test');
      expect(exchange).to.be.ok;
      expect(exchange).to.have.property('type', 'topic');
    });

    it('throws if subscribe without routingKey pattern', () => {
      const broker = new Broker();
      broker.assertExchange('test');

      expect(() => broker.subscribe('test', '', 'persist', () => {})).to.throw(TypeError);
    });

    it('throws if subscribe without onMessage callback', () => {
      const broker = new Broker();

      // @ts-ignore
      expect(() => broker.subscribe('test', 'test.#', 'persist')).to.throw(TypeError);
    });

    it('pass options to exchange and queue', () => {
      const broker = new Broker();

      broker.subscribe('test', 'test.#', 'persist-q', onMessage, { durable: true, autoDelete: false });
      expect(broker.getQueue('persist-q')?.options).to.have.property('autoDelete', false);

      /** @type {import('smqp').onMessage} */
      function onMessage() {}
    });

    it('subscription with durable queue is autoDelete by default', () => {
      const broker = new Broker();

      broker.subscribe('test', 'test.#', 'persist-q', onMessage, { durable: true });
      expect(broker.getQueue('persist-q')?.options).to.have.property('autoDelete', true);

      /** @type {import('smqp').onMessage} */
      function onMessage() {}
    });

    it('returns owner in message callback', (done) => {
      const owner = {};
      const broker = new Broker(owner);

      broker.assertExchange('test');
      broker.subscribe('test', 'test.*', 'test-q', onMessage);

      broker.publish('test', 'test.1');

      /** @type {import('smqp').onMessage} */
      function onMessage(_routingKey, _message, brokerOwner) {
        expect(brokerOwner).to.equal(owner);
        done();
      }
    });

    it('returns existing consumer if the same queue, pattern, and handler are used when subscribing', (done) => {
      const broker = new Broker();

      broker.assertExchange('event');
      const consumer1 = broker.subscribe('event', 'test.*', 'test-q', onMessage);
      const consumer2 = broker.subscribe('event', 'test.*', 'test-q', onMessage);

      expect(consumer1).to.be.ok.and.have.property('consumerTag');
      expect(consumer2).to.be.ok.and.have.property('consumerTag');
      expect(consumer1 === consumer2).to.be.true;

      broker.publish('event', 'test.1');

      /** @type {import('smqp').onMessage} */
      function onMessage() {
        done();
      }
    });

    it('throws if subscribing with NOT durable to durable queue', () => {
      const broker = new Broker();
      broker.subscribe('test', 'test.#', 'durableQueue', onMessage1, { durable: true });

      expect(() => {
        broker.subscribe('test', 'test.#', 'durableQueue', onMessage2, { durable: false, memem: 1 });
      })
        .to.throw(SmqpError)
        .that.have.property('code', 'ERR_SMQP_QUEUE_DURABLE_MISMATCH');

      function onMessage1() {}
      function onMessage2() {}
    });

    it('supports subscribe with general wildcard hash (#)', (done) => {
      const broker = new Broker();

      broker.assertExchange('test');
      broker.subscribeTmp('test', '#', onMessage);

      let messageCount = 0;

      broker.publish('test', 'test');
      broker.publish('test', 'test1');

      /** @type {import('smqp').onMessage} */
      function onMessage(routingKey, message) /** @type {import('smqp').onMessage} */
      {
        ++messageCount;
        if (routingKey === 'test1') {
          expect(messageCount).to.equal(2);
          done();
        } else {
          message.ack();
        }
      }
    });

    it('supports multiple subscribe immediately cancelled in message callback', () => {
      const broker = new Broker();

      broker.assertExchange('event', 'topic');
      broker.assertQueue('event1-q');
      broker.assertQueue('event2-q');
      broker.assertQueue('event3-q');

      broker.subscribe('event', 'test.#', 'event1-q', onMessage.bind({}), { consumerTag: 'tag-1', priority: 1 });
      broker.subscribe('event', 'test.#', 'event2-q', onMessage.bind({}), { consumerTag: 'tag-2', priority: 7 });
      broker.subscribe('event', 'test.#', 'event3-q', onMessage.bind({}), { consumerTag: 'tag-3', priority: 10 });

      let messageCount = 0;

      broker.publish('event', 'test.1');

      expect(messageCount).to.equal(3);

      /** @type {import('smqp').onMessage} */
      function onMessage(_, msg) {
        broker.cancel(msg.fields.consumerTag);
        ++messageCount;
      }
    });

    it('no resources are created if consumer tag is not unique', () => {
      const broker = new Broker();

      broker.assertQueue('test');
      broker.consume('test', () => {}, { consumerTag: 'guid' });

      expect(() => {
        broker.subscribe('event', 'event.#', 'event-q', () => {}, { consumerTag: 'guid' });
      })
        .to.throw(SmqpError, /guid/)
        .with.property('code', 'ERR_SMQP_CONSUMER_TAG_CONFLICT');

      expect(broker.exchangeCount, 'exchanges').to.equal(0);
      expect(broker.queueCount, 'queues').to.equal(1);
      expect(broker.consumerCount, 'consumers').to.equal(1);
    });
  });

  describe('exclusive subscription', () => {
    it('throws if subscribing to exclusively consumed queue', () => {
      const broker = new Broker();

      broker.subscribe('test', 'test.#', 'exclusive-q', onMessage1, { exclusive: true });

      expect(() => {
        broker.subscribe('test', 'test.#', 'exclusive-q', onMessage2);
      })
        .to.throw(SmqpError)
        .with.property('code', 'ERR_SMQP_EXCLUSIVE_CONFLICT');

      function onMessage1() {}
      function onMessage2() {}
    });

    it('cannot exclusively subscribe if already consumed', () => {
      const broker = new Broker();

      broker.subscribe('test', 'test.#', 'exclusive-q', onMessage1);

      expect(() => {
        broker.subscribe('test', 'test.#', 'exclusive-q', onMessage2, { exclusive: true });
      })
        .to.throw(SmqpError)
        .with.property('code', 'ERR_SMQP_EXCLUSIVE_NOT_ALLOWED');

      function onMessage1() {}
      function onMessage2() {}
    });

    it('releases exclusive consumption if unsubscribed', () => {
      const broker = new Broker();

      const queue = broker.assertQueue('exclusive-q', { autoDelete: false });
      broker.subscribe('test', 'test.#', 'exclusive-q', onMessage1, { exclusive: true });

      expect(queue).to.have.property('exclusive', true);

      broker.unsubscribe('exclusive-q', onMessage1);
      expect(queue).to.have.property('exclusive', false);

      broker.subscribe('test', 'test.#', 'exclusive-q', onMessage2);

      function onMessage1() {}
      function onMessage2() {}
    });
  });

  describe('subscribeTmp(...)', () => {
    it('supports subscribe with suffixed wildcard hash (test.#)', (done) => {
      const broker = new Broker();

      broker.assertExchange('test');
      broker.subscribeTmp('test', 'test.#', onMessage);

      let messageCount = 0;

      broker.publish('test', 'test.0');
      broker.publish('test', 'test.1');

      /** @type {import('smqp').onMessage} */
      function onMessage(routingKey, message) /** @type {import('smqp').onMessage} */
      {
        ++messageCount;
        if (routingKey === 'test.1') {
          expect(messageCount).to.equal(2);
          done();
        } else {
          message.ack();
        }
      }
    });

    it('supports subscribe with the same function and different pattern', (done) => {
      const broker = new Broker();

      broker.assertExchange('test');
      broker.subscribeTmp('test', 'test1', onMessage);
      broker.subscribeTmp('test', 'test', onMessage);

      let messageCount = 0;

      broker.publish('test', 'test');
      broker.publish('test', 'test1');

      /** @type {import('smqp').onMessage} */
      function onMessage(routingKey, message) /** @type {import('smqp').onMessage} */
      {
        ++messageCount;
        if (routingKey === 'test1') {
          expect(messageCount).to.equal(2);
          done();
        } else {
          message.ack();
        }
      }
    });

    it('with consumer tag passes tag to consumer', () => {
      const broker = new Broker();

      broker.assertExchange('event');
      const consumer = broker.subscribeTmp('event', '#', onMessage, { consumerTag: 'guid' });

      expect(consumer).to.have.property('consumerTag', 'guid');

      /** @type {import('smqp').onMessage} */
      function onMessage() {}
    });

    it('supports multiple subscribeTmp to different functions and same pattern', () => {
      const broker = new Broker();

      broker.assertExchange('event', 'topic');
      broker.subscribeTmp('event', 'test.*', onMessage1);
      broker.subscribeTmp('event', 'test.*', onMessage2);

      let messageCount = 0;

      broker.publish('event', 'test.1');

      expect(messageCount).to.equal(2);

      /** @type {import('smqp').onMessage} */
      function onMessage1(_, message) {
        ++messageCount;
        message.ack();
      }
      /** @type {import('smqp').onMessage} */
      function onMessage2(_, message) {
        ++messageCount;
        message.ack();
      }
    });

    it('supports multiple subscribeTmp with priority to different functions and same pattern', () => {
      const broker = new Broker();

      broker.assertExchange('event', 'topic');
      broker.subscribeTmp('event', 'test.*', onMessage1, { priority: 100 });
      broker.subscribeTmp('event', 'test.*', onMessage2, { priority: 200 });

      let messageCount = 0;

      broker.publish('event', 'test.1');

      expect(messageCount).to.equal(2);

      /** @type {import('smqp').onMessage} */
      function onMessage1(_, message) {
        ++messageCount;
        message.ack();
      }
      /** @type {import('smqp').onMessage} */
      function onMessage2(_, message) {
        ++messageCount;
        message.ack();
      }
    });

    it('supports multiple subscribeTmp with noAck different functions and same pattern', () => {
      const broker = new Broker();

      broker.assertExchange('event', 'topic');
      broker.subscribeTmp('event', 'test.*', onMessage1, { noAck: true });
      broker.subscribeTmp('event', 'test.*', onMessage2, { noAck: true });
      broker.subscribeTmp('event', 'test.*', onMessage3, { noAck: true });

      let messageCount = 0;

      broker.publish('event', 'test.1');

      expect(messageCount).to.equal(3);

      function onMessage1() {
        ++messageCount;
      }
      function onMessage2() {
        ++messageCount;
      }
      function onMessage3() {
        ++messageCount;
      }
    });

    it('supports multiple subscribeTmp with noAck same functions bound to different objects', () => {
      const broker = new Broker();

      broker.assertExchange('event', 'topic');
      broker.subscribeTmp('event', 'test.#', onMessage.bind({}), { noAck: true, consumerTag: 'tag-1' });
      broker.subscribeTmp('event', 'test.#', onMessage.bind({}), { noAck: true, consumerTag: 'tag-2' });
      broker.subscribeTmp('event', 'test.#', onMessage.bind({}), { noAck: true, consumerTag: 'tag-3' });

      let messageCount = 0;

      broker.publish('event', 'test.1');

      expect(messageCount).to.equal(3);

      /** @type {import('smqp').onMessage} */
      function onMessage() {
        ++messageCount;
      }
    });

    it('supports multiple subscribeTmp with noAck and immediately cancelled in message callback', () => {
      const broker = new Broker();

      broker.assertExchange('event', 'topic');
      broker.subscribeTmp('event', 'test.#', onMessage.bind({}), { consumerTag: 'tag-1', priority: 1 });
      broker.subscribeTmp('event', 'test.#', onMessage.bind({}), { consumerTag: 'tag-2', priority: 7 });
      broker.subscribeTmp('event', 'test.#', onMessage.bind({}), { consumerTag: 'tag-3', priority: 10 });

      let messageCount = 0;

      broker.publish('event', 'test.1');

      expect(messageCount).to.equal(3);

      /** @type {import('smqp').onMessage} */
      function onMessage(_, msg) {
        broker.cancel(msg.fields.consumerTag);
        ++messageCount;
      }
    });

    it('no resources are created if consumer tag is not unique', () => {
      const broker = new Broker();

      broker.assertQueue('test');
      broker.consume('test', () => {}, { consumerTag: 'guid' });

      expect(() => {
        broker.subscribeTmp('event', 'event.#', () => {}, { consumerTag: 'guid' });
      })
        .to.throw(SmqpError, /guid/)
        .with.property('code', 'ERR_SMQP_CONSUMER_TAG_CONFLICT');

      expect(broker.exchangeCount, 'exchanges').to.equal(0);
      expect(broker.queueCount, 'queues').to.equal(1);
      expect(broker.consumerCount, 'consumers').to.equal(1);
    });
  });

  describe('subscribeOnce()', () => {
    it('creates exchange and temporary queue', () => {
      const broker = new Broker();
      const consumer = broker.subscribeOnce('event', 'test.#', onMessage);

      expect(broker.assertExchange('event')).to.be.ok;
      expect(broker.getQueue(consumer.queue.name)).to.be.ok;
      expect(broker.getQueue(consumer.queue.name)?.options).to.include({ durable: false, autoDelete: true });
      function onMessage() {} /** @type {import('smqp').onMessage} */
    });

    it('receives one message and then closes consumer and queue', () => {
      const broker = new Broker();
      const consumer = broker.subscribeOnce('event', 'test.#', onMessage);

      /** @type {import('smqp').ConsumeMessage} */
      let message;

      broker.publish('event', 'test.1');
      broker.publish('event', 'test.2');

      // @ts-ignore
      expect(message).to.be.ok;
      // @ts-ignore
      expect(message?.fields).to.have.property('routingKey', 'test.1');

      expect(broker.getQueue(consumer.queueName)).to.not.be.ok;

      /** @type {import('smqp').onMessage} */
      function onMessage(_, msg) {
        message = msg;
      }
    });

    it('with consumer tag passes tag to consumer', () => {
      const broker = new Broker();

      broker.assertExchange('event');
      const consumer = broker.subscribeOnce('event', '#', onMessage, { consumerTag: 'guid' });

      expect(consumer).to.have.property('consumerTag', 'guid');

      /** @type {import('smqp').onMessage} */
      function onMessage() {}
    });

    it('subscribeOnce with falsey consumer tag sets unique tag to consumer', () => {
      const broker = new Broker();

      broker.assertExchange('event');
      const consumer = broker.subscribeOnce('event', '#', onMessage, { consumerTag: '' });

      expect(consumer).to.have.property('consumerTag').that.is.ok;

      /** @type {import('smqp').onMessage} */
      function onMessage() {}
    });

    it('subscribeOnce with high priority receives messages according to priority', () => {
      const broker = new Broker();

      /** @type {import('smqp').ConsumeMessage[]} */
      const messages = [];

      broker.assertExchange('event');
      broker.subscribeTmp('event', '#', onMessage, { consumerTag: '_tmp', noAck: true, priority: 99 });
      broker.subscribeOnce('event', '#', onMessage, { consumerTag: '_once', priority: 100 });

      broker.publish('event', 'test.priority');

      expect(messages).to.have.length(2);
      expect(messages[0].fields).to.have.property('consumerTag', '_once');
      expect(messages[1].fields).to.have.property('consumerTag', '_tmp');

      /** @type {import('smqp').onMessage} */
      function onMessage(_, msg) {
        messages.push(msg);
      }
    });

    it('subscribeOnce to direct exchange with high priority receives messages according to priority', () => {
      const broker = new Broker();

      /** @type {import('smqp').ConsumeMessage[]} */
      const messages = [];

      broker.assertExchange('balance', 'direct');
      broker.subscribeTmp('event', '#', onMessage, { consumerTag: '_tmp', noAck: true, priority: 99 });
      broker.subscribeOnce('event', '#', onMessage, { consumerTag: '_once', priority: 100 });

      broker.publish('event', 'test.priority');

      expect(messages).to.have.length(2);
      expect(messages[0].fields).to.have.property('consumerTag', '_once');
      expect(messages[1].fields).to.have.property('consumerTag', '_tmp');

      /** @type {import('smqp').onMessage} */
      function onMessage(_, msg) {
        messages.push(msg);
      }
    });

    it('closes consumer immediately after message is received', () => {
      const broker = new Broker();

      const exchange = broker.assertExchange('event');
      const onceConsumer = broker.subscribeOnce('event', '#', onMessage);
      expect(onceConsumer).to.be.ok;
      expect(onceConsumer.options).to.have.property('noAck', true);

      const onceQueue = broker.getQueue(onceConsumer.queueName);
      expect(onceQueue).to.be.ok;
      expect(onceQueue?.options).to.have.property('durable', false);
      expect(onceQueue?.options).to.have.property('autoDelete', true);

      expect(exchange).to.have.property('bindingCount', 1);

      /** @type {string[]} */
      const messages = [];

      broker.publish('event', 'once');
      broker.publish('event', 'twice');

      expect(exchange).to.have.property('bindingCount', 0);

      expect(messages).to.eql(['once']);

      /** @type {import('smqp').onMessage} */
      function onMessage(routingKey) {
        messages.push(routingKey);
      }
    });

    it('throws if message callback is not a function', () => {
      const broker = new Broker();

      broker.assertExchange('event');
      expect(() => {
        // @ts-ignore
        broker.subscribeOnce('event', '#');
      }).to.throw(TypeError, /message callback/);
      expect(() => {
        // @ts-ignore
        broker.subscribeOnce('event', '#', 'not-fn');
      }).to.throw(TypeError, /message callback/);
    });

    it('no resources are created if consumer tag is not unique', () => {
      const broker = new Broker();

      broker.assertQueue('test');
      broker.consume('test', () => {}, { consumerTag: 'guid' });

      expect(() => {
        broker.subscribeOnce('event', 'event.#', () => {}, { consumerTag: 'guid' });
      })
        .to.throw(SmqpError, /guid/)
        .with.property('code', 'ERR_SMQP_CONSUMER_TAG_CONFLICT');

      expect(broker.exchangeCount, 'exchanges').to.equal(0);
      expect(broker.queueCount, 'queues').to.equal(1);
      expect(broker.consumerCount, 'consumers').to.equal(1);
    });
  });

  describe('unsubscribe()', () => {
    it('unsubscribe in message callback removes consumer', () => {
      const broker = new Broker();

      const queue = broker.assertQueue('testq');
      broker.subscribe('test', 'test.*', 'testq', onMessage1);
      broker.subscribe('test', 'test.#', 'testq', onMessage2);

      expect(queue.consumerCount).to.equal(2);

      broker.publish('test', 'test.1');
      broker.publish('test', 'test.1');
      broker.publish('test', 'test.1');

      expect(queue.consumerCount).to.equal(1);

      function onMessage1() {
        broker.unsubscribe('testq', onMessage2);
      }

      function onMessage2() {}
    });

    it('unsubscribe from exclusive consumer with autoDelete queue removes queue', () => {
      const broker = new Broker();
      broker.assertExchange('test');
      broker.assertQueue('test-q', { durable: true, autoDelete: true });
      broker.bindQueue('test-q', 'test', '#');

      broker.publish('test', 'test.1');
      broker.publish('test', 'test.2');
      broker.publish('test', 'test.3');
      broker.publish('test', 'test.4');

      broker.subscribe('test', 'test.*', 'test-q', onMessage, { exclusive: true });

      expect(broker.getQueue('test-q')).to.be.undefined;

      /** @type {import('smqp').onMessage} */
      function onMessage(routingKey, message) {
        if (routingKey === 'test.4') broker.unsubscribe('test-q', onMessage);
        message.ack();
      }
    });

    it('unsubscribe from durable, persistent queue nacks all messages', () => {
      const broker = new Broker();
      const queue = broker.assertQueue('test-q', { durable: true, autoDelete: false });
      broker.sendToQueue('test-q', 'test.1');
      broker.sendToQueue('test-q', 'test.2');
      broker.sendToQueue('test-q', 'test.3');
      broker.sendToQueue('test-q', 'test.4');

      broker.subscribe('test', 'test.*', 'test-q', onMessage, { exclusive: true });

      expect(queue.messageCount).to.equal(3);
      const peekMessage = queue.peek();
      expect(peekMessage?.content).to.equal('test.2');
      expect(peekMessage?.pending).to.be.false;

      /** @type {import('smqp').onMessage} */
      function onMessage(routingKey, message) {
        if (message.content === 'test.2') return broker.unsubscribe('test-q', onMessage);
        message.ack();
      }
    });

    it('unsubscribe in message callback after ack stops receiving messages', () => {
      const broker = new Broker();
      const queue = broker.assertQueue('test-q', { durable: true, autoDelete: false });
      broker.subscribe('test', 'test.*', 'test-q', onMessage);

      /** @type {string[]} */
      const messages = [];

      broker.publish('test', 'test.1');
      broker.publish('test', 'test.2');
      broker.publish('test', 'test.3');

      expect(messages).to.eql(['test.1']);
      expect(queue.messageCount).to.equal(2);

      /** @type {import('smqp').onMessage} */
      function onMessage(routingKey, message) {
        messages.push(routingKey);
        message.ack();
        broker.unsubscribe('test-q', onMessage);
      }
    });

    it('returns undefined', () => {
      const broker = new Broker();

      const queue = broker.assertQueue('test-q');
      broker.subscribe('test', 'test.*', 'test-q', onMessage);

      expect(broker.unsubscribe('test-q', onMessage)).to.be.undefined;
      expect(queue.consumerCount).to.equal(0);

      /** @type {import('smqp').onMessage} */
      function onMessage() {}
    });
  });

  describe('consume(queueName, onMessage[, options])', () => {
    it('returns consumer', () => {
      const broker = new Broker();

      broker.assertQueue('test-q');
      const consumer = broker.consume('test-q', () => {});
      expect(consumer).to.be.ok;
      expect(consumer).to.have.property('cancel').that.is.a('function');
    });

    it('throws if called without message handler', () => {
      const broker = new Broker();

      broker.assertQueue('test');

      expect(() => {
        // @ts-ignore
        broker.consume('test');
      }).to.throw(TypeError, /message callback/);
    });

    it('keeps count of consumers', () => {
      const broker = new Broker();

      broker.assertQueue('test-q');

      const consumer1 = broker.consume('test-q', () => {});
      broker.consume('test-q', () => {});

      expect(broker).to.have.property('consumerCount', 2);

      broker.cancel(consumer1.consumerTag);
      expect(broker).to.have.property('consumerCount', 1);
    });

    it('consume exclusive disallows others to consume same queue', () => {
      const broker = new Broker();

      broker.assertQueue('test-q');
      broker.consume('test-q', () => {}, { exclusive: true });

      expect(() => {
        broker.consume('test-q', () => {});
      })
        .to.throw(SmqpError, /exclusively/)
        .with.property('code', 'ERR_SMQP_EXCLUSIVE_CONFLICT');
    });

    it('exclusive consumption is released when consumer is cancelled', () => {
      const broker = new Broker();

      broker.assertQueue('test-q', { autoDelete: false });
      const exclusive = broker.consume('test-q', () => {}, { exclusive: true });

      expect(() => {
        broker.consume('test-q', () => {});
      })
        .to.throw(SmqpError, /exclusively/)
        .with.property('code', 'ERR_SMQP_EXCLUSIVE_CONFLICT');

      exclusive.cancel();
      broker.consume('test-q', () => {});
    });

    it('consumer tag must be unique', () => {
      const broker = new Broker();

      broker.assertQueue('test');
      broker.consume('test', onMessage, { consumerTag: 'guid' });

      expect(() => {
        broker.consume('test', () => {}, { consumerTag: 'guid' });
      })
        .to.throw(SmqpError, /guid/)
        .with.property('code', 'ERR_SMQP_CONSUMER_TAG_CONFLICT');

      /** @type {import('smqp').onMessage} */
      function onMessage() {}
    });

    it('passes consumerTag option to the consumer', () => {
      const broker = new Broker();
      broker.assertQueue('test');
      const consumer = broker.consume('test', onMessage, { exclusive: true, consumerTag: 'guid' });
      expect(consumer).to.have.property('consumerTag', 'guid');

      /** @type {import('smqp').onMessage} */
      function onMessage() {}
    });

    it('consume non-existing queue throws', () => {
      const broker = new Broker();
      expect(() => {
        broker.consume('non-q', () => {}, { exclusive: true, consumerTag: 'guid' });
      })
        .to.throw(SmqpError, /not found/)
        .with.property('code', 'ERR_SMQP_QUEUE_NOT_FOUND');
    });
  });

  describe('asserExchange()', () => {
    it('creates exchange if it doesn´t exist', () => {
      const broker = new Broker();

      const exchange = broker.assertExchange('test');
      expect(exchange).to.be.ok;
    });

    it('throws if type is not topic or direct', () => {
      const broker = new Broker();

      expect(() => {
        // @ts-ignore
        broker.assertExchange('test', 'fanout');
      }).to.throw(TypeError, /topic or direct/);
      expect(() => {
        // @ts-ignore
        broker.assertExchange('test', new Date());
      }).to.throw(TypeError, /topic or direct/);
      expect(() => {
        // @ts-ignore
        broker.assertExchange('test', {});
      }).to.throw(TypeError, /topic or direct/);
      expect(() => {
        // @ts-ignore
        broker.assertExchange('test', () => {});
      }).to.throw(TypeError, /topic or direct/);
    });

    it('returns the same exchange if it exists', () => {
      const broker = new Broker();

      const exchange1 = broker.assertExchange('test');
      const exchange2 = broker.assertExchange('test');
      expect(exchange1 === exchange2).to.be.true;
    });

    it('asserExchange() throws if exchange type is not the same as existing type', () => {
      const broker = new Broker();
      broker.assertExchange('test', 'direct');
      expect(() => {
        // @ts-ignore
        broker.assertExchange('test', 'fanout');
      })
        .to.throw(SmqpError, /match/)
        .with.property('code', 'ERR_SMQP_EXCHANGE_TYPE_MISMATCH');
    });
  });

  describe('deleteExchange()', () => {
    it('ignored if exchange doesn´t exist', () => {
      const broker = new Broker();
      expect(broker.deleteExchange('none')).to.be.false;
    });

    it('deletes exchange', () => {
      const broker = new Broker();
      broker.assertExchange('event');
      expect(broker.deleteExchange('event')).to.be.true;
      expect(broker.getExchange('event')).to.not.be.ok;
    });

    it('keeps exchange if used and called with ifUnused true', () => {
      const broker = new Broker();
      broker.assertExchange('event');
      broker.subscribeOnce('event', '#', () => {});
      expect(broker.deleteExchange('event', { ifUnused: true })).to.be.false;
      expect(broker.getExchange('event')).to.be.ok;
    });

    it('deletes exchange if unused and called with ifUnused true', () => {
      const broker = new Broker();
      broker.assertExchange('event');
      expect(broker.deleteExchange('event', { ifUnused: true })).to.be.true;
      expect(broker.getExchange('event')).to.not.be.ok;
    });
  });

  describe('getState()', () => {
    it('returns durable exchange', () => {
      const broker = new Broker();

      broker.assertExchange('test', 'topic', { durable: true });

      const state = broker.getState();
      expect(state).to.have.property('exchanges').with.length(1);
      expect(state.exchanges?.[0]).to.have.property('options').with.property('durable', true);
    });

    it('doesn´t return non-durable exchange', () => {
      const broker = new Broker();

      broker.assertExchange('durable', 'topic');
      broker.assertExchange('non-durable', 'topic', { durable: false });

      const state = broker.getState();

      expect(state).to.have.property('exchanges').with.length(1);
      expect(state.exchanges?.[0]).to.have.property('name', 'durable');
    });

    it('returns durable queue', () => {
      const broker = new Broker();

      broker.assertQueue('test', { durable: true });

      const state = broker.getState();
      expect(state).to.have.property('queues').with.length(1);
      expect(state.queues?.[0]).to.have.property('options').with.property('durable', true);
    });

    it('doesn´t return non-durable exchange', () => {
      const broker = new Broker();

      broker.assertQueue('durable');
      broker.assertQueue('non-durable', { durable: false });

      const state = broker.getState();

      expect(state).to.have.property('queues').with.length(1);
      expect(state.queues?.[0]).to.have.property('name', 'durable');
    });

    it('doesn´t return non-durable binding to exchange', () => {
      const broker = new Broker();

      broker.assertExchange('event', 'topic', { durable: true, autoDelete: false });
      broker.assertQueue('durable', { durable: true });
      broker.assertQueue('non-durable', { durable: false });
      broker.bindQueue('durable', 'event', '#');
      broker.bindQueue('non-durable', 'event', '#');

      const state = broker.getState();

      expect(state).to.have.property('queues').with.length(1);
      expect(state).to.have.property('exchanges').with.length(1);
      expect(state.exchanges?.[0]).to.have.property('bindings').with.length(1);
    });

    it('onlyWithContent flag only returns queue with messages', () => {
      const broker = new Broker();

      broker.assertExchange('event', 'topic', { durable: true, autoDelete: false });
      broker.assertExchange('exch', 'topic', { durable: true, autoDelete: false });
      broker.assertQueue('durable-q', { durable: true });
      broker.assertQueue('non-durable-q', { durable: false });
      broker.bindQueue('durable-q', 'event', '#');
      broker.bindQueue('non-durable-q', 'event', '#');

      broker.publish('event', 'test.1', {});

      const slimState = broker.getState(true);

      expect(slimState).to.have.property('queues').with.length(1);
      expect(slimState?.queues?.[0]).to.have.property('name', 'durable-q');
      expect(slimState?.exchanges, 'exchanges').to.not.be.ok;

      broker.get('durable-q', { noAck: true });

      expect(broker.getState(true)).to.be.undefined;
    });
  });

  describe('stop()', () => {
    /** @type {Broker} */
    let broker;
    beforeEach('setup exchanges and queues', () => {
      broker = new Broker();
      broker.assertExchange('event', 'topic', { autoDelete: false });
      broker.assertExchange('load', 'direct', { autoDelete: false });

      broker.assertQueue('events', { autoDelete: false });
      broker.assertQueue('loads', { autoDelete: false });

      broker.bindQueue('events', 'event', '#');
      broker.bindQueue('loads', 'load', '#');
    });

    it('stops publishing messages and consumption', () => {
      /** @type {string[]} */
      const messages = [];

      broker.consume('events', onMessage);
      broker.consume('loads', onMessage);

      broker.publish('event', 'event.1');
      broker.publish('load', 'load.1');

      broker.stop();

      broker.publish('event', 'event.2');
      broker.publish('load', 'load.2');

      broker.getQueue('events')?.queueMessage({ routingKey: 'event.stopped' });
      broker.getQueue('loads')?.queueMessage({ routingKey: 'load.stopped' });

      expect(messages).to.eql(['event.1', 'load.1']);

      /** @type {import('smqp').onMessage} */
      function onMessage(routingKey, message) {
        messages.push(routingKey);
        message.ack();
      }
    });

    it('keeps consumers', () => {
      /** @type {string[]} */
      const messages = [];

      const consumer = broker.subscribeTmp('event', '#', onMessage);

      broker.publish('event', 'event.1');
      broker.publish('event', 'event.2');

      broker.stop();

      broker.publish('event', 'event.3');

      const tmpQueue = broker.getQueue(consumer.queueName);
      expect(tmpQueue).to.be.ok;
      expect(tmpQueue).to.have.property('consumerCount', 1);
      expect(tmpQueue).to.have.property('stopped', true);

      expect(consumer).to.have.property('stopped', true);

      tmpQueue?.queueMessage({ routingKey: 'event.queued' });

      expect(messages).to.eql(['event.1', 'event.2']);

      /** @type {import('smqp').onMessage} */
      function onMessage(routingKey, message) {
        messages.push(routingKey);
        message.ack();
      }
    });

    it('keeps same state before and after stop', () => {
      const messages = [];

      broker.consume('events', onMessage);
      broker.consume('loads', onMessage);

      broker.publish('event', 'event.1');
      broker.publish('load', 'load.1');

      const state = broker.getState();

      broker.stop();

      expect(broker.getState()).to.eql(state);

      /** @type {import('smqp').onMessage} */
      function onMessage(routingKey, message) {
        messages.push(routingKey);
        message.ack();
      }
    });
  });

  describe('close()', () => {
    /** @type {Broker} */
    let broker;
    beforeEach('setup exchanges and queues', () => {
      broker = new Broker();
      broker.assertExchange('event', 'topic', { autoDelete: false });
      broker.assertExchange('load', 'direct', { autoDelete: false });

      broker.assertQueue('events', { autoDelete: false });
      broker.assertQueue('loads', { autoDelete: false });

      broker.bindQueue('events', 'event', '#');
      broker.bindQueue('loads', 'load', '#');
    });

    it('stops publishing messages and consumption', () => {
      /** @type {string[]} */
      const messages = [];

      broker.consume('events', onMessage);
      broker.consume('loads', onMessage);

      broker.publish('event', 'event.1');
      broker.publish('load', 'load.1');

      broker.close();

      broker.publish('event', 'event.2');
      broker.publish('load', 'load.2');

      broker.getQueue('events')?.queueMessage({ routingKey: 'event.stopped' });
      broker.getQueue('loads')?.queueMessage({ routingKey: 'load.stopped' });

      expect(messages).to.eql(['event.1', 'load.1']);

      /** @type {import('smqp').onMessage} */
      function onMessage(routingKey, message) {
        messages.push(routingKey);
        message.ack();
      }
    });

    it('removes consumers', () => {
      /** @type {string[]} */
      const messages = [];

      const consumer = broker.subscribeTmp('event', '#', onMessage);
      const tmpQueue = broker.getQueue(consumer.queueName);

      broker.publish('event', 'event.1');
      broker.publish('event', 'event.2');

      broker.close();

      broker.publish('event', 'event.3');

      expect(broker.consumerCount).to.equal(0);
      expect(tmpQueue).to.have.property('consumerCount', 0);

      tmpQueue?.queueMessage({ routingKey: 'event.queued' });

      expect(messages).to.eql(['event.1', 'event.2']);

      /** @type {import('smqp').onMessage} */
      function onMessage(routingKey, message) {
        messages.push(routingKey);
        message.ack();
      }
    });

    it('keeps same state before and after stop', () => {
      /** @type {string[]} */
      const messages = [];

      broker.consume('events', onMessage);
      broker.consume('loads', onMessage);

      broker.publish('event', 'event.1');
      broker.publish('load', 'load.1');

      const state = broker.getState();

      broker.stop();

      expect(broker.getState()).to.eql(state);

      /** @type {import('smqp').onMessage} */
      function onMessage(routingKey, message) {
        messages.push(routingKey);
        message.ack();
      }
    });
  });

  describe('recover()', () => {
    /** @type {Broker} */
    let broker;
    beforeEach('setup exchanges and queues', () => {
      broker = new Broker();
      broker.assertExchange('event', 'topic', { autoDelete: false });
      broker.assertExchange('load', 'direct', { autoDelete: false });

      broker.assertQueue('event-q', { autoDelete: false });
      broker.assertQueue('load-q', { autoDelete: false });

      broker.bindQueue('event-q', 'event', '#', { priority: 0 });
      broker.bindQueue('load-q', 'load', 'load.#');
    });

    it('recovers topic exchange', () => {
      const recoveredBroker = Broker().recover(broker.getState());

      const recoveredExchange = recoveredBroker.getExchange('event');
      expect(recoveredExchange).to.be.ok;
      expect(recoveredExchange).to.have.property('type', 'topic');
      expect(recoveredExchange).to.have.property('bindingCount', 1);
    });

    it('recovers bindings', () => {
      broker.bindQueue('event-q', 'event', 'event.#', { priority: 30 });

      const recoveredBroker = Broker().recover(broker.getState());

      const { bindingCount, bindings } = recoveredBroker.getExchange('event');
      expect(bindingCount).to.equal(2);
      expect(bindings[0]).to.have.property('pattern', 'event.#');
      expect(bindings[0].options).to.have.property('priority', 30);
      expect(bindings[1]).to.have.property('pattern', '#');
    });

    it('same broker with state keeps consumers', () => {
      broker.consume('event-q', () => {});

      expect(broker.consumerCount).to.equal(1);

      broker.recover(broker.getState());

      expect(broker.consumerCount).to.equal(1);
    });

    it('peek returns first recovered message', () => {
      broker.publish('event', 'event.0', { data: 1 });
      broker.publish('event', 'event.1', { data: 2 });

      broker.consume('event-q', onMessage);

      const recoveredBroker = new Broker();
      recoveredBroker.recover(broker.getState());

      recoveredBroker.consume('event-q', onMessage);

      const recoveredMessage = recoveredBroker.getQueue('event-q')?.peek();

      expect(recoveredMessage?.fields).to.have.property('routingKey', 'event.0');
      expect(recoveredMessage).to.have.property('content').that.eql({ data: 1 });

      /** @type {import('smqp').onMessage} */
      function onMessage() {}
    });

    it('recovers topic exchange in stopped broker', (done) => {
      /** @type {string[]} */
      const messages = [];

      broker.consume('event-q', onMessage);
      broker.subscribeTmp('event', 'event.1', stop);

      broker.publish('event', 'event.0');
      broker.publish('event', 'event.1');
      broker.publish('event', 'event.2');

      /** @type {import('smqp').onMessage} */
      function onMessage(routingKey) {
        messages.push(routingKey);
      }

      function stop() {
        broker.stop();
        broker.publish('event', 'event.ignored');

        broker.recover();

        broker.publish('event', 'event.2');

        broker.consume('event-q', onRecoveredMessage);

        expect(messages).to.eql(['event.0', 'event.1', 'event.2']);
      }

      function onRecoveredMessage() {
        done();
      }
    });

    it('recover with state recovers bindings with descending priority', () => {
      /** @type {string[]} */
      const messages = [];

      broker.assertQueue('event-prio-q');
      broker.assertQueue('event-secondi-q');
      broker.bindQueue('event-prio-q', 'event', '#', { priority: 100 });

      broker.consume('event-q', onMessage);
      broker.consume('event-prio-q', onPrioMessage);

      broker.publish('event', 'event.0');

      broker.stop();
      const recovered = Broker().recover(broker.getState());
      expect(broker.getState()).to.deep.equal(recovered.getState());

      recovered.consume('event-q', onMessage);
      recovered.consume('event-prio-q', onPrioMessage);

      recovered.publish('event', 'event.1');

      expect(messages).to.eql(['prio-event.0', 'event.0', 'prio-event.1', 'event.1']);

      /** @type {import('smqp').onMessage} */
      function onMessage(routingKey, message) {
        messages.push(routingKey);
        message.ack();
      }
      /** @type {import('smqp').onMessage} */
      function onPrioMessage(routingKey, message) {
        messages.push(['prio', routingKey].join('-'));
        message.ack();
      }
    });

    it('recover without state recovers bindings with descending priority', () => {
      /** @type {string[]} */
      const messages = [];

      broker.subscribeOnce('event', '#', (routingKey) => {
        messages.push(['once', routingKey].join('-'));
      });

      broker.assertQueue('event-prio-q');
      broker.assertQueue('event-secondi-q');
      broker.bindQueue('event-prio-q', 'event', '#', { priority: 100 });

      broker.consume('event-q', onMessage);
      broker.consume('event-prio-q', onPrioMessage);

      broker.publish('event', 'event.0');

      broker.stop();

      broker.recover();

      broker.consume('event-q', onMessage);
      broker.consume('event-prio-q', onPrioMessage);

      broker.publish('event', 'event.1');

      expect(messages).to.eql(['prio-event.0', 'event.0', 'once-event.0', 'prio-event.1', 'event.1']);

      /** @type {import('smqp').onMessage} */
      function onMessage(routingKey, message) {
        messages.push(routingKey);
        message.ack();
      }
      /** @type {import('smqp').onMessage} */
      function onPrioMessage(routingKey, message) {
        messages.push(['prio', routingKey].join('-'));
        message.ack();
      }
    });

    it('without state continues consumption', () => {
      /** @type {string[]} */
      const messages = [];

      const consumer = broker.subscribeTmp('event', '#', onMessage);

      broker.publish('event', 'event.1');
      broker.publish('event', 'event.2');

      broker.stop();

      broker.publish('event', 'event.3');

      const tmpQueue = broker.getQueue(consumer.queueName);
      expect(tmpQueue).to.be.ok;
      expect(tmpQueue).to.have.property('consumerCount', 1);

      broker.recover();

      broker.publish('event', 'event.4');

      expect(messages).to.eql(['event.1', 'event.2', 'event.4']);

      /** @type {import('smqp').onMessage} */
      function onMessage(routingKey, message) {
        messages.push(routingKey);
        message.ack();
      }
    });

    it('binding is ignored if queue has disappeared', () => {
      broker.assertQueue('event-prio-q');
      broker.bindQueue('event-prio-q', 'event', '#', { priority: 100 });

      broker.stop();

      const state = broker.getState();

      const qIdx = state?.queues?.findIndex(({ name }) => name === 'event-q');
      state.queues?.splice(qIdx || 0, 1);

      const recovered = Broker().recover(state);

      expect(recovered.getExchange('event')).to.have.property('bindingCount', 1);
    });

    it('recovers only stopped exchange and queue', () => {
      const exchange = broker.assertExchange('event', 'topic');
      broker.assertExchange('test', 'topic');
      broker.assertQueue('event-q');
      broker.bindQueue('event-q', 'event', '#', { priority: 100 });
      const queue = broker.assertQueue('test-q');
      broker.bindQueue('test-q', 'test', '#', { priority: 100 });

      broker.stop();

      exchange.recover();
      queue.recover();

      broker.recover();

      expect(broker.getExchange('event')).to.have.property('bindingCount', 1);
      expect(broker.getExchange('test')).to.have.property('bindingCount', 1);
    });
  });

  describe('bindQueue()', () => {
    it('returns binding', () => {
      const broker = new Broker();
      broker.assertExchange('event');
      broker.assertQueue('event-q');

      const binding = broker.bindQueue('event-q', 'event', '#', { priority: 1337 });
      expect(binding).to.have.property('id', 'event-q/#');
      expect(binding).to.have.property('options').that.deep.equal({ priority: 1337 });
      expect(binding).to.have.property('testPattern').that.is.a('function');
      expect(binding).to.have.property('close').that.is.a('function');
    });

    it('binding.close() closes binding', () => {
      const broker = new Broker();
      const exchange = broker.assertExchange('event');
      broker.assertQueue('event-q');

      const binding = broker.bindQueue('event-q', 'event', '#');
      broker.bindQueue('event-q', 'event', 'test.#');
      expect(exchange).to.have.property('bindingCount', 2);

      expect(binding.close()).to.be.undefined;
      expect(exchange).to.have.property('bindingCount', 1);
    });

    it('binding.testPattern(routingKey) tests binding routing key pattern', () => {
      const broker = new Broker();
      broker.assertExchange('event');
      broker.assertQueue('event-q');

      const binding = broker.bindQueue('event-q', 'event', 'test.#');

      expect(binding.testPattern('test.1.2')).to.be.true;
      expect(binding.testPattern('event.1.2')).to.be.false;
    });
  });

  describe('unbindQueue()', () => {
    it('stops receiving messages from exchange', () => {
      const broker = new Broker();
      broker.assertExchange('event');
      const q = broker.assertQueue('event-q');

      broker.bindQueue('event-q', 'event', '#');

      broker.publish('event', 'test.1');
      expect(q.messageCount).to.equal(1);

      expect(broker.unbindQueue('event-q', 'event', '#')).to.be.undefined;

      broker.publish('event', 'test.1');
      expect(q.messageCount).to.equal(1);
    });

    it('unbind from non-existing exchange is ignored', () => {
      const broker = new Broker();
      broker.assertExchange('event');
      broker.assertQueue('event-q');
      broker.unbindQueue('event-q', 'non-event', '#');
    });

    it('unbind from non-existing queue is ignored', () => {
      const broker = new Broker();
      broker.assertExchange('event');
      broker.assertQueue('event-q');
      broker.unbindQueue('non-q', 'event', '#');
    });
  });

  describe('cancel(consumerTag[, requeue = true])', () => {
    it('stops consuming messages', () => {
      const broker = new Broker();
      broker.assertExchange('event');
      /** @type {string[]} */
      const messages = [];

      broker.subscribeTmp('event', '#', (routingKey) => messages.push(routingKey), { consumerTag: 'cancel-me', noAck: true });

      broker.publish('event', 'test.1');
      expect(messages).to.have.length(1);

      expect(broker.cancel('cancel-me')).to.be.true;

      broker.publish('event', 'test.2');
      expect(messages).to.have.length(1);
    });

    it('stops consuming messages if cancelled in message callback', () => {
      const broker = new Broker();
      broker.assertExchange('event');
      /** @type {string[]} */
      const messages = [];

      broker.subscribeTmp(
        'event',
        '#',
        (routingKey) => {
          messages.push(routingKey);
          broker.cancel('cancel-me');
          broker.publish('event', 'test.3');
        },
        { consumerTag: 'cancel-me', noAck: true }
      );

      broker.publish('event', 'test.1');
      broker.publish('event', 'test.2');
      expect(messages).to.have.length(1);
    });

    it('cancels consumer and requeues messages by default', () => {
      const broker = new Broker();
      broker.assertExchange('event');
      const queue = broker.assertQueue('event-q', { autoDelete: false });
      /** @type {string[]} */
      const messages = [];

      broker.subscribe(
        'event',
        '#',
        'event-q',
        (routingKey) => {
          messages.push(routingKey);
          broker.cancel('cancel-me');
          broker.publish('event', 'test.3');
        },
        { consumerTag: 'cancel-me' }
      );

      broker.publish('event', 'test.1');
      broker.publish('event', 'test.2');

      expect(messages).to.have.length(1);

      expect(queue.messageCount).to.equal(3);
    });

    it('cancels consumer and discards consumed message if requeue is false', () => {
      const broker = new Broker();
      broker.assertExchange('event');
      const queue = broker.assertQueue('event-q', { autoDelete: false });
      /** @type {string[]} */
      const messages = [];

      broker.subscribe(
        'event',
        '#',
        'event-q',
        (routingKey) => {
          messages.push(routingKey);
          broker.cancel('cancel-me', false);
          broker.publish('event', 'test.3');
        },
        { consumerTag: 'cancel-me' }
      );

      broker.publish('event', 'test.1');
      broker.publish('event', 'test.2');

      expect(messages).to.have.length(1);

      expect(queue.messageCount).to.equal(2);
    });

    it('cancels consumer and discards no-ack consumed message by default', () => {
      const broker = new Broker();
      broker.assertExchange('event');
      const queue = broker.assertQueue('event-q', { autoDelete: false });
      /** @type {string[]} */
      const messages = [];

      broker.subscribe(
        'event',
        '#',
        'event-q',
        (routingKey, msg) => {
          messages.push(routingKey);
          broker.cancel(msg.fields.consumerTag, false);
          broker.publish('event', 'test.3');
        },
        { consumerTag: 'cancel-me', noAck: true }
      );

      broker.publish('event', 'test.1');
      broker.publish('event', 'test.2');

      expect(messages).to.have.length(1);

      expect(queue.messageCount).to.equal(2);
    });

    it('is ignored if no consumer tag was found', () => {
      const broker = new Broker();
      expect(broker.cancel('cancel-me')).to.be.false;
    });

    it('throws type error if consumer tag is not a string', () => {
      const broker = new Broker();
      // @ts-ignore
      expect(() => broker.cancel({})).to.throw(TypeError);
    });
  });

  describe('dead letters', () => {
    it('sends nacked message to dead letter exchange', () => {
      const broker = new Broker();

      broker.assertExchange('event');
      broker.assertExchange('dead-letter');
      const deadLetterQueue = broker.assertQueue('dead-letter-q');
      broker.bindQueue('dead-letter-q', 'dead-letter', '#');

      broker.subscribe('event', 'test.#', 'test-q', onMessage, { deadLetterExchange: 'dead-letter' });

      broker.publish('event', 'test.1');
      broker.publish('event', 'test.2');

      expect(deadLetterQueue.messageCount).to.equal(2);

      /** @type {import('smqp').onMessage} */
      function onMessage(_, message) {
        message.nack(false, false);
      }
    });

    it("doesn't send acked message to dead letter exchange", () => {
      const broker = new Broker();

      broker.assertExchange('event');
      broker.assertExchange('dead-letter');
      const deadLetterQueue = broker.assertQueue('dead-letter-q');
      broker.bindQueue('dead-letter-q', 'dead-letter', '#');

      broker.subscribe('event', 'test.#', 'test-q', onMessage, { deadLetterExchange: 'dead-letter' });

      broker.publish('event', 'test.1');
      broker.publish('event', 'test.2');

      expect(deadLetterQueue.messageCount).to.equal(0);

      /** @type {import('smqp').onMessage} */
      function onMessage(_, message) {
        message.ack();
      }
    });

    it('sends rejected message to dead letter exchange', () => {
      const broker = new Broker();

      broker.assertExchange('event');
      broker.assertExchange('dead-letter');

      const deadLetterQueue = broker.assertQueue('dead-letter-q');
      broker.bindQueue('dead-letter-q', 'dead-letter', '#');

      broker.subscribe('event', 'test.#', 'test-q', onMessage, { deadLetterExchange: 'dead-letter' });

      broker.publish('event', 'test.1');

      expect(deadLetterQueue.messageCount).to.equal(1);

      /** @type {import('smqp').onMessage} */
      function onMessage(_, message) {
        message.reject(false);
      }
    });

    it('requeued message is not sent to dead letter exchange', () => {
      const broker = new Broker();

      broker.assertExchange('event');
      broker.assertExchange('dead-letter');
      const deadLetterQueue = broker.assertQueue('dead-letter-q');
      broker.bindQueue('dead-letter-q', 'dead-letter', '#');

      broker.subscribe('event', 'test.#', 'test-q', onMessage, { deadLetterExchange: 'dead-letter' });

      /** @type {import('smqp').ConsumeMessage[]} */
      const messages = [];
      broker.publish('event', 'test.reject');
      broker.publish('event', 'test.nack');

      expect(deadLetterQueue.messageCount).to.equal(0);

      /** @type {import('smqp').onMessage} */
      function onMessage(routingKey, message) {
        if (messages.indexOf(message)) return;
        messages.push(message);
        if (routingKey === 'test.reject') message.reject(true);
        message.nack(false, true);
      }
    });

    it('recovered queue sends nacked message to dead letter exchange', () => {
      const broker = new Broker();

      broker.assertExchange('event');
      broker.assertExchange('dead-letter');
      broker.assertQueue('dead-letter-q');
      broker.bindQueue('dead-letter-q', 'dead-letter', 'deceased.msg', { durable: true });

      broker.assertQueue('event-q', { autoDelete: false, deadLetterExchange: 'dead-letter', deadLetterRoutingKey: 'deceased.msg' });

      const recovered = Broker().recover(broker.getState());

      const deadLetterQueue = recovered.getQueue('dead-letter-q');

      recovered.subscribe('event', 'test.#', 'event-q', onMessage);

      recovered.publish('event', 'test.1');
      recovered.publish('event', 'test.2');

      expect(deadLetterQueue?.messageCount).to.equal(2);

      /** @type {import('smqp').onMessage} */
      function onMessage(_, message) {
        message.nack(false, false);
      }
    });

    it('recovered queue with non-existing dead letter exchange is ok', () => {
      const broker = new Broker();

      broker.assertExchange('event');
      broker.assertExchange('dead-letter', 'topic', { durable: false });
      broker.assertQueue('dead-letter-q');
      broker.bindQueue('dead-letter-q', 'dead-letter', 'deceased.msg', { durable: true });

      broker.assertQueue('event-q', { autoDelete: false, deadLetterExchange: 'dead-letter', deadLetterRoutingKey: 'deceased.msg' });

      const recovered = Broker().recover(broker.getState());

      const deadLetterQueue = recovered.getQueue('dead-letter-q');

      recovered.subscribe('event', 'test.#', 'event-q', onMessage);

      recovered.publish('event', 'test.1');
      recovered.publish('event', 'test.2');

      expect(deadLetterQueue?.messageCount).to.equal(0);

      /** @type {import('smqp').onMessage} */
      function onMessage(_, message) {
        message.nack(false, false);
      }
    });
  });

  describe('expired messages', () => {
    afterEach(ck.reset);

    it('message with expiration and thus expired is not returned in message callback', () => {
      const broker = new Broker();

      broker.assertExchange('event');
      broker.assertQueue('event-q');
      broker.bindQueue('event-q', 'event', '#');

      ck.freeze();
      broker.publish('event', 'test.expired', {}, { expiration: 100 });
      ck.travel(Date.now() + 200);
      broker.publish('event', 'test.1');

      /** @type {import('smqp').ConsumeMessage[]} */
      const messages = [];
      broker.consume('event-q', onMessage);

      expect(messages).to.have.length(1);
      expect(messages[0]).to.have.property('fields').with.property('routingKey', 'test.1');

      /** @type {import('smqp').onMessage} */
      function onMessage(routingKey, message) {
        messages.push(message);
        message.ack();
      }
    });

    it('queue with messageTtl and thus expired message is not returned in message callback', () => {
      const broker = new Broker();

      broker.assertExchange('event');
      broker.assertQueue('event-q', { messageTtl: 100 });
      broker.bindQueue('event-q', 'event', '#');

      ck.freeze();
      broker.publish('event', 'test.expired');
      ck.travel(Date.now() + 200);
      broker.publish('event', 'test.1');

      /** @type {import('smqp').ConsumeMessage[]} */
      const messages = [];
      broker.consume('event-q', onMessage);

      expect(messages).to.have.length(1);
      expect(messages[0]).to.have.property('fields').with.property('routingKey', 'test.1');

      /** @type {import('smqp').onMessage} */
      function onMessage(routingKey, message) {
        messages.push(message);
        message.ack();
      }
    });

    it('message expiration overrides queue messageTtl', () => {
      const broker = new Broker();

      broker.assertExchange('event');
      broker.assertQueue('event-q', { messageTtl: 100 });
      broker.bindQueue('event-q', 'event', '#');

      ck.freeze();
      broker.publish('event', 'test.expired', {}, { expiration: 300 });
      ck.travel(Date.now() + 200);
      broker.publish('event', 'test.1');

      /** @type {import('smqp').ConsumeMessage[]} */
      const messages = [];
      broker.consume('event-q', onMessage);

      expect(messages).to.have.length(2);
      expect(messages[0]).to.have.property('fields').with.property('routingKey', 'test.expired');
      expect(messages[1]).to.have.property('fields').with.property('routingKey', 'test.1');

      /** @type {import('smqp').onMessage} */
      function onMessage(routingKey, message) {
        messages.push(message);
        message.ack();
      }
    });

    it('expired message is sent on dead letter exchange', () => {
      const broker = new Broker();

      broker.assertExchange('event');
      broker.assertExchange('dead-letter');

      broker.assertQueue('event-q', { deadLetterExchange: 'dead-letter' });
      broker.bindQueue('event-q', 'event', '#');

      broker.assertQueue('dead-letter-q');
      broker.bindQueue('dead-letter-q', 'dead-letter', '#');

      ck.freeze();
      broker.publish('event', 'test.expired', {}, { expiration: 100 });
      ck.travel(Date.now() + 200);
      broker.publish('event', 'test.1');

      /** @type {import('smqp').ConsumeMessage[]} */
      const messages = [];
      broker.consume('event-q', onMessage);

      expect(messages).to.have.length(1);

      /** @type {import('smqp').ConsumeMessage[]} */
      const deadMessages = [];
      broker.consume('dead-letter-q', onDeadMessage);

      expect(deadMessages).to.have.length(1);
      expect(deadMessages[0]).to.have.property('fields').with.property('routingKey', 'test.expired');
      expect(deadMessages[0]).to.have.property('properties').with.property('timestamp');
      expect(deadMessages[0].properties).to.not.have.property('expired');
      expect(deadMessages[0].properties).to.have.property('ttl').that.is.ok;

      /** @type {import('smqp').onMessage} */
      function onMessage(routingKey, message) {
        messages.push(message);
        message.ack();
      }

      /** @type {import('smqp').onMessage} */
      function onDeadMessage(routingKey, message) {
        deadMessages.push(message);
        message.ack();
      }
    });
  });

  describe('queues', () => {
    it('keeps count', () => {
      const broker = new Broker();
      expect(broker.queueCount).to.equal(0);
      broker.assertQueue('test-q');
      expect(broker.queueCount).to.equal(1);
      broker.deleteQueue('test-q');
      expect(broker.queueCount).to.equal(0);
    });

    it('createQueue(name) creates queue', () => {
      const broker = new Broker();
      expect(broker.queueCount).to.equal(0);
      broker.createQueue('test-q');
      expect(broker.queueCount).to.equal(1);
    });

    it('createQueue(null) creates queue with random name', () => {
      const broker = new Broker();
      const queue = broker.createQueue(null);
      expect(broker.queueCount).to.equal(1);

      expect(queue.name, 'random name').be.ok.and.not.equal('null');
      expect(queue.events.name, 'queue event exchange name').to.contain(queue.name);
    });

    it('createQueue() creates queue with random name', () => {
      const broker = new Broker();
      const queue = broker.createQueue();
      expect(broker.queueCount).to.equal(1);

      expect(queue.name, 'random name').be.ok.and.not.equal('undefined');
      expect(queue.events.name, 'queue event exchange name').to.contain(queue.name);
    });

    it("createQueue('') creates queue with random name", () => {
      const broker = new Broker();
      const queue = broker.createQueue('');
      expect(broker.queueCount).to.equal(1);

      expect(queue.name, 'random name').be.ok;
      expect(queue.events.name, 'queue event exchange name').to.contain(queue.name);
    });

    it('createQueue with non-string name throws', () => {
      const broker = new Broker();
      // @ts-ignore
      expect(() => broker.createQueue({})).to.throw(TypeError, /name/);
    });

    it('createQueue(name) when queue exists throws', () => {
      const broker = new Broker();
      broker.createQueue('test-q');

      expect(() => {
        broker.createQueue('test-q');
      })
        .to.throw(SmqpError, /test-q already exists/)
        .with.property('code', 'ERR_SMQP_QUEUE_NAME_CONFLICT');
    });

    it('deleteQueue throws if queueName is empty', () => {
      const broker = new Broker();
      // @ts-ignore
      expect(() => broker.deleteQueue()).to.throw(TypeError);
    });

    it('deleteQueue returns false if queueName was not found', () => {
      const broker = new Broker();
      expect(broker.deleteQueue('test-q')).to.be.undefined;
    });

    it('get unknown queue returns nothing', () => {
      const broker = new Broker();
      expect(broker.get('test-q')).to.be.undefined;
    });

    it('get from empty queue returns false', () => {
      const broker = new Broker();
      broker.assertQueue('test-q');
      expect(broker.get('test-q')).to.be.false;
    });

    it('getQueue without name throws', () => {
      const broker = new Broker();
      // @ts-ignore
      expect(() => broker.getQueue()).to.throw(TypeError);
    });
  });

  describe('exchanges', () => {
    it('keeps count', () => {
      const broker = new Broker();
      expect(broker.exchangeCount).to.equal(0);
      broker.assertExchange('event');
      expect(broker.exchangeCount).to.equal(1);
      broker.deleteExchange('event');
      expect(broker.exchangeCount).to.equal(0);
    });
  });

  describe('messages', () => {
    it('messages are distributed by descending priority', () => {
      const broker = new Broker();
      /** @type {string[]} */
      const messages = [];

      broker.assertExchange('event', 'topic');

      broker.subscribe('event', 'test.#', 'test-q', onMessageFirst, { priority: 1 });
      broker.subscribe('event', 'test.#', 'test-q', onMessageThird, { priority: 0 });
      broker.subscribe('event', 'test.#', 'test-q', onMessageVip, { priority: 2 });

      broker.publish('event', 'test.1');
      broker.publish('event', 'test.2');
      broker.publish('event', 'test.3');

      expect(messages).to.eql(['vip', 'first', 'third']);

      function onMessageFirst() {
        messages.push('first');
      }

      function onMessageThird() {
        messages.push('third');
      }

      function onMessageVip() {
        messages.push('vip');
      }
    });

    it('delivers content', (done) => {
      const broker = new Broker();

      broker.subscribeTmp('test', '#', onMessage);

      broker.publish('test', 'test.1', { num: 1 });

      /** @type {import('smqp').onMessage} */
      function onMessage(routingKey, message) {
        expect(message).to.have.property('content').that.eql({ num: 1 });
        done();
      }
    });

    it('releases next message when acked', () => {
      const broker = new Broker();

      broker.subscribeTmp('test', '#', onMessage);

      /** @type {import('smqp').ConsumeMessage} */
      let firstMessage;
      /** @type {import('smqp').ConsumeMessage} */
      let secondMessage;

      broker.publish('test', 'test1');
      broker.publish('test', 'test2');

      // @ts-ignore
      expect(firstMessage, 'message #1').to.be.ok;
      // @ts-ignore
      expect(secondMessage, 'message #2').to.not.be.ok;

      // @ts-ignore
      firstMessage.ack();

      // @ts-ignore
      expect(secondMessage, 'message #2').to.be.ok;

      /** @type {import('smqp').onMessage} */
      function onMessage(routingKey, message) {
        if (routingKey === 'test1') {
          firstMessage = message;
        }
        if (routingKey === 'test2') {
          secondMessage = message;
        }
      }
    });

    it('releases next message when nacked', () => {
      const broker = new Broker();

      broker.subscribeTmp('test', '#', onMessage);

      /** @type {import('smqp').ConsumeMessage[]} */
      const messages = [];

      broker.publish('test', 'test1');
      broker.publish('test', 'test2');

      expect(messages).to.have.length(1);

      const [message1] = messages;

      message1.nack();

      expect(messages).to.have.length(2);

      /** @type {import('smqp').onMessage} */
      function onMessage(routingKey, message) {
        messages.push(message);
      }
    });

    it('releases message back to original position if nacked with requeue', () => {
      const broker = new Broker();

      broker.subscribe('test', '#', 'testq', onMessage, { autoDelete: false });

      /** @type {import('smqp').ConsumeMessage[]} */
      const messages = [];

      broker.publish('test', 'test1');
      broker.publish('test', 'test2');

      expect(messages).to.have.length(1);

      const [message1] = messages;

      broker.unsubscribe('#', onMessage);

      message1.nack(false, true);

      expect(broker.getQueue('testq')?.messageCount).to.equal(2);

      /** @type {import('smqp').onMessage} */
      function onMessage(routingKey, message) {
        messages.push(message);
      }
    });

    it('ack allUpTo argument acknowledges all outstanding messages up to the current one', () => {
      const broker = new Broker();

      broker.subscribe('test', '#', 'testq', onMessage, { prefetch: 2 });

      /** @type {string[]} */
      const messages = [];

      broker.publish('test', 'test1');
      broker.publish('test', 'test2');
      broker.publish('test', 'test3');

      expect(messages).to.eql(['test2', 'test3']);
      expect(broker.getQueue('testq')?.messageCount).to.equal(0);

      /** @type {import('smqp').onMessage} */
      function onMessage(routingKey, message) {
        if (routingKey === 'test1') return;
        messages.push(routingKey);
        message.ack(true);
      }
    });

    it('nack allUpTo argument acknowledges all outstanding messages up to the current one', () => {
      const broker = new Broker();

      broker.subscribe('test', '#', 'test-q', onMessage, { prefetch: 2 });

      /** @type {string[]} */
      const messages = [];

      broker.publish('test', 'test1');
      broker.publish('test', 'test2');
      broker.publish('test', 'test3');

      expect(messages).to.eql(['test2', 'test3']);
      expect(broker.getQueue('test-q')?.messageCount).to.equal(0);

      /** @type {import('smqp').onMessage} */
      function onMessage(routingKey, message) {
        if (routingKey === 'test1') return;
        messages.push(routingKey);
        message.nack(true, false);
      }
    });
  });

  describe('multiple exchanges and queues', () => {
    /** @type {Broker} */
    let broker;
    beforeEach('setup exchanges and queues', () => {
      broker = new Broker();

      broker.assertExchange('load', 'direct');
      broker.assertQueue('load1-q', { autoDelete: false });
      broker.assertQueue('load2-q', { autoDelete: false });

      broker.assertExchange('event', 'topic');
      broker.assertQueue('event-q', { autoDelete: false });

      broker.bindQueue('event-q', 'event', '#');
      broker.bindQueue('load1-q', 'load', '#');
      broker.bindQueue('load2-q', 'load', '#');
    });

    it('are recovered with bindings', () => {
      const state = broker.getState();
      const newBroker = Broker().recover(state);

      newBroker.publish('event', 'event.1');
      newBroker.publish('load', 'heavy.1');
      newBroker.publish('load', 'heavy.1');

      expect(newBroker.getQueue('event-q')?.messageCount).to.equal(1);
      expect(newBroker.getQueue('load1-q')?.messageCount).to.equal(1);
      expect(newBroker.getQueue('load2-q')?.messageCount).to.equal(1);
    });

    it('are recovered with messages', () => {
      broker.publish('event', 'event.1');
      broker.publish('load', 'heavy.1');
      broker.publish('load', 'heavy.1');

      const state = broker.getState();
      const newBroker = Broker().recover(state);

      expect(newBroker.getQueue('event-q')?.messageCount).to.equal(1);
      expect(newBroker.getQueue('load1-q')?.messageCount).to.equal(1);
      expect(newBroker.getQueue('load2-q')?.messageCount).to.equal(1);
    });

    it('recovers the same broker with bindings', () => {
      const state = broker.getState();
      broker.recover(state);

      broker.publish('event', 'event.1');
      broker.publish('load', 'heavy.1');
      broker.publish('load', 'heavy.1');

      expect(broker.getQueue('event-q')?.messageCount).to.equal(1);
      expect(broker.getQueue('load1-q')?.messageCount).to.equal(1);
      expect(broker.getQueue('load2-q')?.messageCount).to.equal(1);
    });

    it('recovers the same broker with messages', () => {
      broker.publish('event', 'event.1');
      broker.publish('load', 'heavy.1');
      broker.publish('load', 'heavy.1');

      const state = broker.getState();
      broker.recover(state);

      expect(broker.getQueue('event-q')?.messageCount).to.equal(1);
      expect(broker.getQueue('load1-q')?.messageCount).to.equal(1);
      expect(broker.getQueue('load2-q')?.messageCount).to.equal(1);
    });
  });

  describe('broker.sendToQueue(queue, message)', () => {
    it('throws if queue is missing', () => {
      const broker = new Broker();
      expect(() => {
        broker.sendToQueue('not-found-q', {});
      })
        .to.throw(SmqpError, /not-found-q/)
        .with.property('code', 'ERR_SMQP_QUEUE_NOT_FOUND');
    });
  });

  describe('broker.prefetch(count)', () => {
    it('has expected placeholder behaviour', () => {
      const broker = new Broker();
      broker.prefetch();
    });
  });

  describe('purgeQueue(queueName)', () => {
    it('has expected behaviour', () => {
      const broker = new Broker();
      const q = broker.assertQueue('test-q');

      broker.sendToQueue('test-q', 'meme');

      expect(q.messageCount).to.equal(1);

      broker.purgeQueue('test-q');

      expect(q.messageCount).to.equal(0);
    });

    it('is ignored if queue is not found', () => {
      const broker = new Broker();
      broker.assertQueue('test-q');
      broker.purgeQueue('nan-q');
    });
  });

  describe('events', () => {
    it('topic exchange emits "return" with message if published mandatory message is not routed to any queue', () => {
      const broker = new Broker();
      broker.assertExchange('event', 'topic');

      let message;
      broker.on('return', (msg) => {
        message = msg;
      });

      broker.publish('event', 'test.1', 'important1', { mandatory: true });

      expect(message).to.be.ok;

      expect(message).to.have.property('fields').that.include({
        exchange: 'event',
        routingKey: 'test.1',
      });
      expect(message).to.have.property('content', 'important1');

      broker.publish('event', 'test.2', 'important2', { mandatory: true });

      expect(message).to.be.ok;

      expect(message).to.have.property('fields').that.include({
        exchange: 'event',
        routingKey: 'test.2',
      });
      expect(message).to.have.property('content', 'important2');

      broker.subscribeTmp('event', 'event.#', () => {});

      broker.publish('event', 'test.3', 'important3', { mandatory: true });

      expect(message).to.have.property('fields').that.include({
        exchange: 'event',
        routingKey: 'test.3',
      });
      expect(message).to.have.property('content', 'important3');
    });

    it('direct exchange emits "return" with message if published mandatory message is not routed to any queue', () => {
      const broker = new Broker();
      broker.assertExchange('balanced', 'direct');

      let message;
      broker.on('return', (msg) => {
        message = msg;
      });

      broker.publish('balanced', 'test.1', 'important', { mandatory: true });

      expect(message).to.be.ok;

      expect(message).to.have.property('fields').that.include({
        exchange: 'balanced',
        routingKey: 'test.1',
      });
      expect(message).to.have.property('content', 'important');

      broker.subscribeTmp('balanced', 'event.#', () => {});

      broker.publish('balanced', 'test.2', 'important', { mandatory: true });

      expect(message).to.have.property('fields').that.include({
        exchange: 'balanced',
        routingKey: 'test.2',
      });
      expect(message).to.have.property('content', 'important');
    });

    it('continues listening if return listener throws', () => {
      const broker = new Broker();
      broker.assertExchange('event', 'topic');

      /** @type {any[]} */
      const messages = [];
      broker.on('return', (msg) => {
        if (!messages.length) broker.publish('event', 'error.1', 'Error', { mandatory: true });
        messages.push(msg);
      });

      broker.publish('event', 'test.1', 'important1', { mandatory: true });

      expect(messages).to.have.length(2);
    });

    it('listen for unknown event is ok and doesn´t throw', () => {
      const broker = new Broker();
      broker.on('me', () => {});
    });

    it('cancels listener if off is called', () => {
      const broker = new Broker();
      /** @type {any[]} */
      const messages = [];
      broker.assertExchange('event');
      broker.on('return', onBrokerReturn);

      broker.publish('event', 'test.1', 'important', { mandatory: true });

      expect(messages).to.have.length(1);

      broker.off('return', onBrokerReturn);

      broker.publish('event', 'test.1', 'important', { mandatory: true });

      expect(messages).to.have.length(1);

      function onBrokerReturn(/** @type {any} */ msg) {
        messages.push(msg);
      }
    });

    it('cancels listener if off is called with consumerTag', () => {
      const broker = new Broker();
      /** @type {any[]} */
      const messages = [];
      broker.assertExchange('event');
      broker.on('return', onBrokerReturn, { consumerTag: 'off-tag' });

      broker.publish('event', 'test.1', 'important', { mandatory: true });

      expect(messages).to.have.length(1);

      broker.off('return', { consumerTag: 'off-tag' });

      broker.publish('event', 'test.1', 'important', { mandatory: true });

      expect(messages).to.have.length(1);

      function onBrokerReturn(/** @type {any} */ msg) {
        messages.push(msg);
      }
    });

    it('off(eventName, handler) cancels only handler listener', () => {
      const broker = new Broker();
      /** @type {any[]} */
      const messages = [];
      broker.assertExchange('event');
      broker.on('return', onBrokerReturn1);
      broker.on('return', onBrokerReturn2);

      broker.publish('event', 'test.1', 'important', { mandatory: true });

      expect(messages).to.have.length(2);

      broker.off('return', onBrokerReturn2);

      broker.publish('event', 'test.1', 'important', { mandatory: true });

      expect(messages).to.have.length(3);

      function onBrokerReturn1(/** @type {any} */ msg) {
        messages.push(msg);
      }
      function onBrokerReturn2(/** @type {any} */ msg) {
        messages.push(msg);
      }
    });

    it('off(eventName, handler) cancels all handler listeners', () => {
      const broker = new Broker();
      /** @type {any[]} */
      const messages = [];
      broker.assertExchange('event');
      broker.on('return', onBrokerReturn);
      broker.on('return', onBrokerReturn);

      broker.publish('event', 'test.1', 'important', { mandatory: true });

      expect(messages).to.have.length(2);

      broker.off('return', onBrokerReturn);

      broker.publish('event', 'test.1', 'important', { mandatory: true });

      expect(messages).to.have.length(2);

      function onBrokerReturn(/** @type {any} */ msg) {
        messages.push(msg);
      }
    });

    it('off(eventName, handler) with non regisered listener is ok', () => {
      const broker = new Broker();
      broker.assertExchange('event');
      broker.on('return', onBrokerReturn);
      broker.off('returns', () => {});

      function onBrokerReturn() {}
    });
  });

  describe('reset()', () => {
    it('stops and clears exchanges, queues, and consumers', () => {
      const broker = new Broker();
      broker.assertExchange('temp');
      const exchange = broker.assertExchange('event');
      const queue = broker.assertQueue('event-q');
      broker.bindQueue('event-q', 'event', '#');
      broker.consume('event-q', () => {});

      expect(broker).to.have.property('exchangeCount', 2);
      expect(broker).to.have.property('queueCount', 1);
      expect(broker).to.have.property('consumerCount', 1);

      expect(exchange).to.have.property('bindingCount', 1);

      broker.reset();

      expect(exchange).to.have.property('stopped', true);

      expect(queue).to.have.property('stopped', true);
      expect(queue).to.have.property('consumerCount', 0);

      expect(broker).to.have.property('consumerCount', 0);
      expect(broker).to.have.property('queueCount', 0);
      expect(broker).to.have.property('exchangeCount', 0);
    });

    it('can be used again after reset', () => {
      const broker = new Broker();
      broker.assertExchange('event');
      broker.assertQueue('event-q');
      broker.bindQueue('event-q', 'event', '#');
      broker.consume('event-q', () => {});
      broker.publish('event', 'test', 12);

      broker.reset();

      broker.assertExchange('event');
      broker.assertQueue('event-q');
      broker.bindQueue('event-q', 'event', '#');

      /** @type {import('smqp').ConsumeMessage[]} */
      const messages = [];
      broker.consume('event-q', (_, msg) => {
        messages.push(msg);
      });

      broker.publish('event', 'test', 13);

      expect(messages).to.have.length(1);
      expect(messages[0]).to.have.property('content', 13);
    });
  });

  describe('bindExchange()', () => {
    it('returns e2e binding with expected properties and functions', () => {
      const broker = new Broker();
      broker.assertExchange('source-events');
      broker.assertExchange('dest-events');

      const e2e = broker.bindExchange('source-events', 'dest-events');
      expect(e2e).to.have.property('name', 'e2e-source-events2dest-events-#');
      expect(e2e).to.have.property('source', 'source-events');
      expect(e2e).to.have.property('destination', 'dest-events');
      expect(e2e).to.have.property('queue').that.is.a('string');
      expect(e2e).to.have.property('pattern', '#');
      expect(e2e).to.have.property('consumerTag', 'smq.ctag-e2e-source-events2dest-events-#');
      expect(e2e).to.have.property('on').that.is.a('function');
      expect(e2e).to.have.property('close').that.is.a('function');
    });

    it('shovels messages from source exchange to destination exchange', () => {
      const broker = new Broker();
      broker.assertExchange('source-events');
      broker.assertExchange('dest-events');

      broker.bindExchange('source-events', 'dest-events');

      /** @type {string[]} */
      const messages = [];
      broker.subscribeTmp(
        'dest-events',
        '#',
        (routingKey) => {
          messages.push(routingKey);
        },
        { noAck: true }
      );

      broker.publish('source-events', 'test.1');
      broker.publish('source-events', 'test.2');

      expect(messages).to.eql(['test.1', 'test.2']);
    });

    it('shovels messages meeting pattern', () => {
      const broker = new Broker();
      broker.assertExchange('source-events');
      broker.assertExchange('dest-events');

      broker.bindExchange('source-events', 'dest-events', 'event.#');

      /** @type {string[]} */
      const messages = [];
      broker.subscribeTmp(
        'dest-events',
        '#',
        (routingKey) => {
          messages.push(routingKey);
        },
        { noAck: true }
      );

      broker.publish('source-events', 'test.1');
      broker.publish('source-events', 'event.1');

      expect(messages).to.eql(['event.1']);
    });

    it('takes cloneMessage function as option', () => {
      const broker = new Broker();
      broker.assertExchange('source-events');
      broker.assertExchange('dest-events');

      broker.bindExchange('source-events', 'dest-events', 'event.#', {
        cloneMessage(msg) {
          return { content: { ...msg.content } };
        },
      });

      /** @type {any[]} */
      const messages = [];
      broker.subscribeTmp(
        'dest-events',
        '#',
        (_, msg) => {
          messages.push(msg.content);
        },
        { noAck: true }
      );

      const content = { data: 1 };
      broker.publish('source-events', 'event.1', content);
      broker.publish('source-events', 'test.1', content);

      content.data = 3;

      expect(messages).to.eql([{ data: 1 }]);
    });

    it('takes binding priority as option', () => {
      const broker = new Broker();
      broker.assertExchange('source-events');
      broker.assertExchange('dest-events');

      /** @type {import('smqp').ConsumeMessage[]} */
      const messages = [];
      broker.subscribeTmp(
        'source-events',
        '#',
        (_, msg) => {
          messages.push(msg);
        },
        { noAck: true }
      );

      broker.bindExchange('source-events', 'dest-events', 'event.#', { priority: 1000 });

      broker.subscribeTmp(
        'dest-events',
        '#',
        (_, msg) => {
          messages.push(msg);
        },
        { noAck: true }
      );

      broker.publish('source-events', 'event.1');
      broker.publish('source-events', 'event.2');

      expect(messages).to.have.length(4);
      expect(messages[0].fields).to.have.property('exchange', 'dest-events');
      expect(messages[1].fields).to.have.property('exchange', 'source-events');
      expect(messages[2].fields).to.have.property('exchange', 'dest-events');
      expect(messages[3].fields).to.have.property('exchange', 'source-events');
    });

    it('forwards message properties', () => {
      const broker = new Broker();
      broker.assertExchange('source-events');
      broker.assertExchange('dest-events');

      broker.bindExchange('source-events', 'dest-events', 'event.#', {
        cloneMessage(msg) {
          return { content: { ...msg.content } };
        },
      });

      /** @type {import('smqp').MessageProperties[]} */
      const messages = [];
      broker.subscribeTmp(
        'dest-events',
        '#',
        (_, msg) => {
          messages.push(msg.properties);
        },
        { noAck: true }
      );

      const content = { data: 1 };
      broker.publish('source-events', 'event.1', content, { type: 'event' });
      broker.publish('source-events', 'test.1', content, { type: 'test' });

      content.data = 3;
      expect(messages).to.have.length(1);
      expect(messages[0]).to.have.property('source-exchange', 'source-events');
      expect(Object.keys(messages[0])).to.have.same.members(['messageId', 'timestamp', 'type', 'source-exchange']);
    });

    it('calling e2e binding close function stops shoveling', () => {
      const broker = new Broker();
      broker.assertExchange('source-events');
      broker.assertExchange('dest-events');

      const e2e = broker.bindExchange('source-events', 'dest-events');

      /** @type {string[]} */
      const messages = [];
      broker.subscribeTmp(
        'dest-events',
        '#',
        (routingKey) => {
          messages.push(routingKey);
        },
        { noAck: true }
      );

      broker.publish('source-events', 'test.1');
      broker.publish('source-events', 'test.2');

      e2e.close();

      broker.publish('source-events', 'test.2');
      broker.publish('source-events', 'test.3');

      expect(messages).to.eql(['test.1', 'test.2']);
    });

    it('emits close if exchange is closed', () => {
      const broker = new Broker();
      const source = broker.assertExchange('source-events');
      broker.assertExchange('dest-events');

      const e2e = broker.bindExchange('source-events', 'dest-events');

      /** @type {string[]} */
      const messages = [];
      const consumer = e2e.on('close', () => {
        messages.push('closed');
      });

      expect(consumer).to.be.instanceof(Consumer);

      broker.subscribeTmp(
        'dest-events',
        '#',
        (routingKey) => {
          messages.push(routingKey);
        },
        { noAck: true }
      );

      broker.publish('source-events', 'test.1');
      broker.publish('source-events', 'test.2');

      source.close();

      broker.publish('source-events', 'test.2');
      broker.publish('source-events', 'test.3');

      expect(messages).to.eql(['test.1', 'test.2', 'closed']);
    });
  });

  describe('unbindExchange()', () => {
    it('stops e2e binding', () => {
      const broker = new Broker();
      broker.assertExchange('source-events');
      broker.assertExchange('dest-events');

      broker.bindExchange('source-events', 'dest-events');

      /** @type {string[]} */
      const messages = [];
      broker.subscribeTmp(
        'dest-events',
        '#',
        (routingKey) => {
          messages.push(routingKey);
        },
        { noAck: true }
      );

      broker.publish('source-events', 'test.1');
      broker.publish('source-events', 'test.2');

      broker.unbindExchange('source-events', 'dest-events');

      broker.publish('source-events', 'test.2');
      broker.publish('source-events', 'test.3');

      expect(messages).to.eql(['test.1', 'test.2']);
    });

    it('shovels messages meeting pattern', () => {
      const broker = new Broker();
      broker.assertExchange('source-events');
      broker.assertExchange('dest-events');

      broker.bindExchange('source-events', 'dest-events', 'event.#');

      /** @type {string[]} */
      const messages = [];
      broker.subscribeTmp(
        'dest-events',
        '#',
        (routingKey) => {
          messages.push(routingKey);
        },
        { noAck: true }
      );

      broker.publish('source-events', 'test.1');
      broker.publish('source-events', 'event.1');

      expect(messages).to.eql(['event.1']);
    });

    it('takes cloneMessage function as option', () => {
      const broker = new Broker();
      broker.assertExchange('source-events');
      broker.assertExchange('dest-events');

      broker.bindExchange('source-events', 'dest-events', 'event.#', {
        cloneMessage(msg) {
          return { content: { ...msg.content } };
        },
      });

      /** @type {string[]} */
      const messages = [];
      broker.subscribeTmp(
        'dest-events',
        '#',
        (_, msg) => {
          messages.push(msg.content);
        },
        { noAck: true }
      );

      const content = { data: 1 };
      broker.publish('source-events', 'event.1', content);
      broker.publish('source-events', 'test.1', content);

      content.data = 3;

      expect(messages).to.eql([{ data: 1 }]);
    });

    it('forwards message properties', () => {
      const broker = new Broker();
      broker.assertExchange('source-events');
      broker.assertExchange('dest-events');

      broker.bindExchange('source-events', 'dest-events', 'event.#', {
        cloneMessage(msg) {
          return { content: { ...msg.content } };
        },
      });

      /** @type {import('smqp').MessageProperties[]} */
      const messages = [];
      broker.subscribeTmp(
        'dest-events',
        '#',
        (_, msg) => {
          messages.push(msg.properties);
        },
        { noAck: true }
      );

      const content = { data: 1 };
      broker.publish('source-events', 'event.1', content, { type: 'event' });
      broker.publish('source-events', 'test.1', content, { type: 'test' });

      content.data = 3;
      expect(messages).to.have.length(1);
      expect(messages[0]).to.have.property('source-exchange', 'source-events');
      expect(Object.keys(messages[0])).to.have.same.members(['messageId', 'timestamp', 'type', 'source-exchange']);
    });
  });

  describe('getConsumer(consumerTag)', () => {
    it('returns consumer by tag', () => {
      const broker = new Broker();
      broker.assertExchange('event');
      broker.assertQueue('event-q');
      broker.bindQueue('event-q', 'event', '#');
      broker.consume('event-q', () => {}, { consumerTag: 'ct-test-1' });

      expect(broker.getConsumer('ct-test-1')).to.be.instanceof(Consumer);
    });

    it('returns nothing if consumer is not found', () => {
      const broker = new Broker();
      expect(broker.getConsumer('my-tag')).to.not.be.ok;
    });

    it('throws if consumer tag is not a string', () => {
      const broker = new Broker();
      // @ts-ignore
      expect(() => broker.getConsumer(null)).to.throw(TypeError);
      // @ts-ignore
      expect(() => broker.getConsumer({})).to.throw(TypeError);
      // @ts-ignore
      expect(() => broker.getConsumer(1)).to.throw(TypeError);
    });
  });

  describe('getConsumers()', () => {
    it('returns as a list of copied consumers with consumerTag, queue, and, options', () => {
      const broker = new Broker();
      broker.assertExchange('event');
      broker.assertQueue('event-q');
      broker.bindQueue('event-q', 'event', '#');
      broker.consume('event-q', () => {}, { consumerTag: 'ct-test-1', channelName: 'my-channel' });
      broker.on('return', () => {});

      let consumers = broker.getConsumers();
      expect(consumers).to.have.length(1);
      expect(consumers[0]).to.have.property('consumerTag', 'ct-test-1');
      expect(consumers[0]).to.have.property('queue', 'event-q');
      expect(consumers[0]).to.have.property('options').that.deep.equal({
        channelName: 'my-channel',
        consumerTag: 'ct-test-1',
        noAck: false,
        prefetch: 1,
        priority: 0,
      });

      consumers[0].queue = 'altered-q';
      consumers[0].options.noAck = true;

      broker.consume('event-q', () => {}, { consumerTag: 'ct-test-2', channelName: 'my-channel' });

      expect(consumers).to.have.length(1);

      consumers = broker.getConsumers();
      expect(consumers).to.have.length(2);
      expect(consumers[0]).to.have.property('consumerTag', 'ct-test-1');
      expect(consumers[0]).to.have.property('queue', 'event-q');
      expect(consumers[0]).to.have.property('options').that.deep.equal({
        channelName: 'my-channel',
        consumerTag: 'ct-test-1',
        noAck: false,
        prefetch: 1,
        priority: 0,
      });
    });
  });

  describe('ack(message[, allUpTo])', () => {
    it('acks message', () => {
      const broker = new Broker();
      broker.assertExchange('event');
      const q = broker.assertQueue('event-q');
      broker.bindQueue('event-q', 'event', '#');

      /** @type {import('smqp').ConsumeMessage[]} */
      const messages = [];
      broker.consume(
        'event-q',
        (_, msg) => {
          messages.push(msg);
          broker.ack(msg);
        },
        { consumerTag: 'ct-test-1' }
      );

      broker.publish('event', 'event.1', 'MSG');

      expect(messages).to.have.length(1);

      expect(q.messageCount).to.equal(0);
    });

    it('double ack is ignored', () => {
      const broker = new Broker();
      broker.assertExchange('event');
      const q = broker.assertQueue('event-q');
      broker.bindQueue('event-q', 'event', '#');

      /** @type {import('smqp').ConsumeMessage[]} */
      const messages = [];
      broker.consume(
        'event-q',
        (_, msg) => {
          messages.push(msg);
          broker.ack(msg);
          broker.ack(msg);
        },
        { consumerTag: 'ct-test-1' }
      );

      broker.publish('event', 'event.1', 'MSG');

      expect(messages).to.have.length(1);

      expect(q.messageCount).to.equal(0);
    });
  });

  describe('get(queueName[, { noAck }])', () => {
    it('get message returns message awaiting ack', () => {
      const broker = new Broker();
      broker.assertExchange('event');
      broker.assertQueue('event-q');
      broker.bindQueue('event-q', 'event', '#');

      broker.publish('event', 'event.1', 'MSG');

      const msg = broker.get('event-q');

      expect(msg.pending).to.be.true;

      broker.ack(msg);

      expect(msg.pending).to.be.false;
    });

    it('get with noAck consumes message immediately', () => {
      const broker = new Broker();
      broker.assertExchange('event');
      broker.assertQueue('event-q');
      broker.bindQueue('event-q', 'event', '#');

      broker.publish('event', 'event.1', 'MSG');

      const msg = broker.get('event-q', { noAck: true });

      expect(msg.pending).to.be.false;
    });
  });
});
