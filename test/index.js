import {Broker} from '../index';

describe('Smqp', () => {
  describe('exchange', () => {
    describe('asserExchange()', () => {
      it('creates exchange if it doesn´t exist', () => {
        const broker = Broker();

        const exchange = broker.assertExchange('test');
        expect(exchange).to.be.ok;
      });

      it('throws if type is not topic or direct', () => {
        const broker = Broker();

        expect(() => {
          broker.assertExchange('test', 'fanout');
        }).to.throw(/topic or direct/);
        expect(() => {
          broker.assertExchange('test', new Date());
        }).to.throw(/topic or direct/);
        expect(() => {
          broker.assertExchange('test', {});
        }).to.throw(/topic or direct/);
        expect(() => {
          broker.assertExchange('test', () => {});
        }).to.throw(/topic or direct/);
      });

      it('returns the same exchange if it exists', () => {
        const broker = Broker();

        const exchange1 = broker.assertExchange('test');
        const exchange2 = broker.assertExchange('test');
        expect(exchange1 === exchange2).to.be.true;
      });

      it('throws if exchange type is not the same as existing type', () => {
        const broker = Broker();
        broker.assertExchange('test', 'direct');
        expect(() => {
          broker.assertExchange('test', 'fanout');
        }).to.throw(/match/);
      });

      it('asserExchange() throws if exchange type is not the same as existing type', () => {
        const broker = Broker();

        broker.assertExchange('test', 'direct');
        expect(() => {
          broker.assertExchange('test', 'fanout');
        }).to.throw(/match/);
      });
    });

    describe('direct exchange', () => {
      it('delivers message to a single queue', () => {
        const broker = Broker();
        broker.assertExchange('test', 'direct');

        broker.assertQueue('testq');
        broker.bindQueue('testq', 'test', 'test.#');

        const messages = [];

        broker.publish('test', 'live');
        broker.publish('test', 'test.1');
        broker.publish('test', 'test.2');
        broker.publish('test', 'test.3');

        broker.consume('testq', onMessage);

        expect(messages).to.eql([
          'test.1',
          'test.2',
          'test.3',
          'test.4',
        ]);

        function onMessage(routingKey, {ack}) {
          messages.push(routingKey);
          if (routingKey === 'test.1') broker.publish('test', 'test.4');
          ack();
        }
      });

      it('load balances messages in sequence to multiple queues', () => {
        const broker = Broker();
        broker.assertExchange('test', 'direct');

        broker.assertQueue('testq1');
        broker.assertQueue('testq2');
        broker.bindQueue('testq1', 'test', 'test.#');
        broker.bindQueue('testq2', 'test', 'test.#');

        const messages1 = [];
        const messages2 = [];

        broker.consume('testq1', onMessage1);
        broker.consume('testq2', onMessage2);

        broker.publish('test', 'test.1.1');
        broker.publish('test', 'test.1.2');
        broker.publish('test', 'test.2.1');
        broker.publish('test', 'test.2.2');

        expect(messages1.map(({routingKey}) => routingKey)).to.eql([
          'test.1.1',
          'test.2.1',
        ]);

        expect(messages2.map(({routingKey}) => routingKey)).to.eql([
          'test.1.2',
          'test.2.2',
        ]);

        function onMessage1(routingKey, message) {
          messages1.push(message);
          message.ack();
        }

        function onMessage2(routingKey, message) {
          messages2.push(message);
          message.ack();
        }
      });
    });

    describe('topic exchange', () => {
      it('delivers message to a single queue', () => {
        const broker = Broker();
        broker.assertExchange('test', 'topic');

        broker.assertQueue('testq');
        broker.bindQueue('testq', 'test', 'test.#');

        const messages = [];

        broker.publish('test', 'live');
        broker.publish('test', 'test.1');
        broker.publish('test', 'test.2');
        broker.publish('test', 'test.3');

        broker.consume('testq', onMessage);

        expect(messages).to.eql([
          'test.1',
          'test.2',
          'test.3',
          'test.4',
        ]);

        function onMessage(routingKey, {ack}) {
          messages.push(routingKey);
          if (routingKey === 'test.1') broker.publish('test', 'test.4');
          ack();
        }
      });

      it('sends copy of messages each in multiple queues', () => {
        const broker = Broker();
        broker.assertExchange('test', 'topic');

        broker.assertQueue('testq1');
        broker.assertQueue('testq2');
        broker.bindQueue('testq1', 'test', 'test.#');
        broker.bindQueue('testq2', 'test', 'test.#');

        const messages1 = [];
        const messages2 = [];

        broker.consume('testq1', onMessage1);
        broker.consume('testq2', onMessage2);

        broker.publish('test', 'test.1.1');
        broker.publish('test', 'test.1.2');
        broker.publish('test', 'test.2.1');
        broker.publish('test', 'test.2.2');

        expect(messages1.map(({routingKey}) => routingKey)).to.eql([
          'test.1.1',
          'test.1.2',
          'test.2.1',
          'test.2.2',
        ]);

        expect(messages2.map(({routingKey}) => routingKey)).to.eql([
          'test.1.1',
          'test.1.2',
          'test.2.1',
          'test.2.2',
        ]);

        function onMessage1(routingKey, message) {
          messages1.push(message);
          message.ack();
        }
        function onMessage2(routingKey, message) {
          messages2.push(message);
          message.ack();
        }
      });
    });

    describe('autoDelete', () => {
      it('removes exchange when number of queues drops to zero', () => {
        const broker = Broker();

        broker.assertExchange('test', 'topic', {autoDelete: true});
        broker.assertQueue('test1');
        broker.assertQueue('test2');

        broker.bindQueue('test1', 'test', 'test.*');
        broker.bindQueue('test2', 'test', 'test.#');

        broker.unbindQueue('test1', 'test', 'test.*');
        broker.unbindQueue('test2', 'test', 'test.#');

        expect(broker.getExchange('test')).to.not.be.ok;
      });

      it('falsey keeps exchange when number of queues drops to zero', () => {
        const broker = Broker();

        broker.assertExchange('test', 'topic', {autoDelete: false});
        broker.assertQueue('test1');
        broker.assertQueue('test2');

        broker.bindQueue('test1', 'test', 'test.*');
        broker.bindQueue('test2', 'test', 'test.#');

        broker.unbindQueue('test1', 'test', 'test.*');
        broker.unbindQueue('test2', 'test', 'test.#');

        expect(broker.getExchange('test')).to.be.ok;
      });
    });

    describe('durable', () => {
      it('falsey doesn´t recover exchange', () => {
        const broker1 = Broker();

        broker1.assertExchange('test', 'topic', {durable: false});

        const broker2 = Broker().recover(broker1.getState());

        expect(broker2.getExchange('test')).to.not.be.ok;
      });
    });
  });

  describe('queues', () => {
    it('sendToQueue() publish message on queue', () => {
      const broker = Broker();

      broker.assertQueue('persist', {durable: true});
      broker.sendToQueue('persist', 'test.1', {msg: 1});
      broker.sendToQueue('persist', 'test.2', {msg: 2});

      const queueState = broker.assertQueue('persist').getState();

      expect(queueState).to.have.property('messages').with.length(2);
      expect(queueState.messages[0]).to.have.property('routingKey', 'test.1');
      expect(queueState.messages[1]).to.have.property('routingKey', 'test.2');
    });

    it('message in durable queue is consumed', () => {
      const broker = Broker();

      broker.assertQueue('persist', {durable: true});
      broker.sendToQueue('persist', 'test.1', {msg: 1});

      const messages = [];
      broker.consume('persist', onMessage);

      expect(messages).to.have.length(1);
      expect(messages[0]).to.have.property('routingKey', 'test.1');

      function onMessage(routingKey, message) {
        messages.push(message);
        message.ack();
      }
    });

    it('multiple messages in durable queue are consumed', () => {
      const broker = Broker();

      broker.assertQueue('persist', {durable: true});
      broker.sendToQueue('persist', 'test.1', {msg: 1});
      broker.sendToQueue('persist', 'test.2', {msg: 2});

      const messages = [];
      broker.consume('persist', onMessage, {durable: true});

      expect(messages).to.have.length(2);
      expect(messages[0]).to.have.property('routingKey', 'test.1');
      expect(messages[1]).to.have.property('routingKey', 'test.2');

      function onMessage(routingKey, message) {
        messages.push(message);
        message.ack();
      }
    });

    it('messages are consumed when sent to durable queue after consume', () => {
      const broker = Broker();

      broker.assertQueue('persist', {durable: true});
      broker.sendToQueue('persist', 'test.1', {msg: 1});

      const messages = [];

      broker.consume('persist', onMessage, {durable: true});
      broker.sendToQueue('persist', 'test.2', {msg: 2});

      expect(messages[0]).to.have.property('routingKey', 'test.1');

      expect(messages).to.have.length(2);

      expect(messages[1]).to.have.property('routingKey', 'test.2');

      function onMessage(routingKey, message) {
        messages.push(message);
        message.ack();
      }
    });

    it('purgeQueue() removes all messages', () => {
      const broker = Broker();

      broker.assertQueue('purge-me');
      broker.sendToQueue('purge-me', 'test.1', {msg: 1});
      broker.sendToQueue('purge-me', 'test.2', {msg: 2});

      const messages = [];

      broker.consume('purge-me', onMessage);

      expect(messages[0]).to.have.property('routingKey', 'test.1');
      expect(messages).to.have.length(1);

      function onMessage(routingKey, message) {
        messages.push(message);
        broker.purgeQueue('purge-me');
        message.ack();
      }
    });

    it('noAck option consumes message immediately', () => {
      const broker = Broker();

      broker.assertExchange('test', 'topic');

      broker.subscribe('test', 'test.#', 'persist', onMessageAck);
      broker.subscribeTmp('test', '#', onMessage, {noAck: true});

      const ackMessages = [];
      const messages = [];

      broker.publish('test', 'tst', {msg: 1});
      broker.publish('test', 'test.1', {msg: 2});
      broker.publish('test', 'test.2', {msg: 3});

      expect(messages).to.have.length(3);
      expect(messages[0]).to.have.property('routingKey', 'tst');
      expect(messages[1]).to.have.property('routingKey', 'test.1');
      expect(messages[2]).to.have.property('routingKey', 'test.2');

      expect(ackMessages).to.have.length(1);
      expect(ackMessages[0]).to.have.property('routingKey', 'test.1');

      function onMessage(routingKey, message) {
        messages.push(message);
      }

      function onMessageAck(routingKey, message) {
        ackMessages.push(message);
      }
    });

    it('subscription with durable queue is autoDelete by default', () => {
      const broker = Broker();

      broker.subscribe('test', 'test.#', 'persist', onMessage, {durable: true});
      expect(broker.getQueue('persist').options).to.have.property('autoDelete', true);

      function onMessage() {}
    });

    it('subscription can pass autoDelete', () => {
      const broker = Broker();

      broker.subscribe('test', 'test.#', 'persist', onMessage, {durable: true, autoDelete: false});
      expect(broker.getQueue('persist').options).to.have.property('autoDelete', false);

      function onMessage() {}
    });

    it('durable autoDelete queue is deleted when last consumer is unsubscribed', () => {
      const broker = Broker();

      const consumer1 = broker.subscribe('test', 'test.1', 'persist', onMessage1, {durable: true});
      const consumer2 = broker.subscribe('test', 'test.2', 'persist', onMessage2, {durable: true});

      broker.sendToQueue('persist', 'test.1');

      const queue = broker.getQueue('persist');
      expect(queue.options).to.have.property('autoDelete', true);
      expect(queue.options).to.have.property('durable', true);

      consumer1.close();
      consumer2.close();

      expect(broker.getQueue('persist')).to.be.undefined;

      function onMessage1() {}
      function onMessage2() {}
    });

    it('sendToQueue() where consumer is active consumes messages after current is acked', () => {
      const broker = Broker();

      const queue = broker.assertQueue('persist');
      broker.sendToQueue('persist', 'test.1', {msg: 1});

      const messages = [];

      queue.addConsumer(onMessage, {durable: true});
      broker.sendToQueue('persist', 'test.2', {msg: 2});
      broker.sendToQueue('persist', 'test.3', {msg: 3});

      expect(messages.length).to.equal(1);

      messages[0].ack();

      expect(messages.length).to.equal(2);

      messages[1].ack();

      expect(messages.length).to.equal(3);

      messages[2].ack();

      expect(messages.length).to.equal(3);

      function onMessage(routingKey, message) {
        messages.push(message);
      }
    });

    it('messages are distributed by descending priority', () => {
      const broker = Broker();
      const messages = [];

      broker.assertExchange('test', 'topic');

      broker.subscribe('test', 'test.#', 'testq', onMessageFirst, {priority: 1});
      broker.subscribe('test', 'test.#', 'testq', onMessageThird, {priority: 0});
      broker.subscribe('test', 'test.#', 'testq', onMessageVip, {priority: 2});

      broker.publish('test', 'test.1');
      broker.publish('test', 'test.2');
      broker.publish('test', 'test.3');

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
  });

  describe('messages', () => {
    it('takes content', (done) => {
      const broker = Broker();

      broker.subscribeTmp('test', '#', onMessage);

      broker.publish('test', 'test.1', {
        num: 1
      });

      function onMessage(routingKey, message) {
        expect(message).to.have.property('content').that.eql({num: 1});
        done();
      }
    });

    it('releases next message when acked', () => {
      const broker = Broker();

      broker.subscribeTmp('test', '#', onMessage);

      let firstMessage, secondMessage;

      broker.publish('test', 'test1');
      broker.publish('test', 'test2');

      expect(firstMessage, 'message #1').to.be.ok;
      expect(secondMessage, 'message #2').to.not.be.ok;

      firstMessage.ack();

      expect(secondMessage, 'message #2').to.be.ok;

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
      const broker = Broker();

      broker.subscribeTmp('test', '#', onMessage);

      const messages = [];

      broker.publish('test', 'test1');
      broker.publish('test', 'test2');

      expect(messages).to.have.length(1);

      const [message1] = messages;

      message1.nack();

      expect(messages).to.have.length(2);

      function onMessage(routingKey, message) {
        messages.push(message);
      }
    });

    it('releases message back to original position if nacked with requeue', () => {
      const broker = Broker();

      broker.subscribe('test', '#', 'testq', onMessage, {autoDelete: false});

      const messages = [];

      broker.publish('test', 'test1');
      broker.publish('test', 'test2');

      expect(messages).to.have.length(1);

      const [message1] = messages;

      broker.unsubscribe('#', onMessage);

      message1.nack(null, true);

      expect(broker.getQueue('testq').length).to.equal(2);

      function onMessage(routingKey, message) {
        messages.push(message);
      }
    });
  });

  describe('consume()', () => {
    it('returns consumer', () => {
      const broker = Broker();

      broker.assertQueue('test');
      const consumer = broker.consume('test', () => {});
      expect(consumer).to.be.ok;
      expect(consumer).to.have.property('close').that.is.a('function');
    });
  });

  describe('getState()', () => {
    it('returns durable exchange', () => {
      const broker = Broker();

      broker.assertExchange('test', 'topic', {durable: true});

      const state = broker.getState();
      expect(state).to.have.property('exchanges').with.length(1);
      expect(state.exchanges[0]).to.have.property('options').with.property('durable', true);
    });

    it('doesn´t return non-durable exchange', () => {
      const broker = Broker();

      broker.assertExchange('durable', 'topic');
      broker.assertExchange('non-durable', 'topic', {durable: false});

      const state = broker.getState();

      expect(state).to.have.property('exchanges').with.length(1);
      expect(state.exchanges[0]).to.have.property('name', 'durable');
    });

    it('returns durable queue', () => {
      const broker = Broker();

      broker.assertQueue('test', {durable: true});

      const state = broker.getState();
      expect(state).to.have.property('queues').with.length(1);
      expect(state.queues[0]).to.have.property('options').with.property('durable', true);
    });

    it('doesn´t return non-durable exchange', () => {
      const broker = Broker();

      broker.assertQueue('durable');
      broker.assertQueue('non-durable', {durable: false});

      const state = broker.getState();

      expect(state).to.have.property('queues').with.length(1);
      expect(state.queues[0]).to.have.property('name', 'durable');
    });
  });

  describe('stop()', () => {
    let broker;
    beforeEach('setup exchanges and queues', () => {
      broker = Broker();
      broker.assertExchange('event', 'topic', {autoDelete: false});
      broker.assertExchange('load', 'direct', {autoDelete: false});

      broker.assertQueue('events', {autoDelete: false});
      broker.assertQueue('loads', {autoDelete: false});

      broker.bindQueue('events', 'event', '#');
      broker.bindQueue('loads', 'load', '#');
    });

    it('stops publishing messages and consumption', () => {
      const messages = [];

      broker.consume('events', onMessage);
      broker.consume('loads', onMessage);

      broker.publish('event', 'event.1');
      broker.publish('load', 'load.1');

      broker.stop();

      broker.publish('event', 'event.2');
      broker.publish('load', 'load.2');

      broker.getQueue('events').queueMessage('event.stopped');
      broker.getQueue('loads').queueMessage('load.stopped');

      expect(messages).to.eql([
        'event.1',
        'load.1',
      ]);

      function onMessage(routingKey, message) {
        messages.push(routingKey);
        message.ack();
      }
    });

    it('keeps consumers', () => {
      const messages = [];

      const consumer = broker.subscribeTmp('event', '#', onMessage);

      broker.publish('event', 'event.1');
      broker.publish('event', 'event.2');

      broker.stop();

      broker.publish('event', 'event.3');

      const tmpQueue = broker.getQueue(consumer.queueName);
      expect(tmpQueue).to.be.ok;
      expect(tmpQueue).to.have.property('consumersCount', 1);

      tmpQueue.queueMessage('event.queued');

      expect(messages).to.eql([
        'event.1',
        'event.2',
      ]);

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

      function onMessage(routingKey, message) {
        messages.push(routingKey);
        message.ack();
      }
    });
  });

  describe('recover()', () => {
    let broker;
    beforeEach('setup exchanges and queues', () => {
      broker = Broker();
      broker.assertExchange('event', 'topic', {autoDelete: false});
      broker.assertExchange('load', 'direct', {autoDelete: false});

      broker.assertQueue('events', {autoDelete: false});
      broker.assertQueue('loads', {autoDelete: false});

      broker.bindQueue('events', 'event', '#');
      broker.bindQueue('loads', 'load', 'load.#');
    });

    it('recovers topic exchange', () => {
      const recoveredBroker = Broker().recover(broker.getState());

      const recoveredExchange = recoveredBroker.getExchange('event');
      expect(recoveredExchange).to.be.ok;
      expect(recoveredExchange).to.have.property('type', 'topic');
      expect(recoveredExchange).to.have.property('bindingsCount', 1);
    });

    it('peek returns first recovered message', () => {
      broker.publish('event', 'event.0', {data: 1});
      broker.publish('event', 'event.1', {data: 2});

      broker.consume('events', onMessage);

      const recoveredBroker = Broker();
      recoveredBroker.recover(broker.getState());

      recoveredBroker.consume('events', onMessage);

      const recoveredMessage = recoveredBroker.getQueue('events').peek();

      expect(recoveredMessage).to.have.property('routingKey', 'event.0');
      expect(recoveredMessage).to.have.property('content').that.eql({data: 1});

      function onMessage() {}
    });

    it('recovers topic exchange in stopped broker', (done) => {
      const messages = [];

      broker.consume('events', onMessage);
      broker.subscribeTmp('event', 'event.1', stop);

      broker.publish('event', 'event.0');
      broker.publish('event', 'event.1');
      broker.publish('event', 'event.2');

      function onMessage(routingKey) {
        messages.push(routingKey);
      }

      function onRecoveredMessage(routingKey, message) {
        messages.push(routingKey);
        message.ack();
      }

      function stop() {
        broker.stop();
        broker.publish('event', 'event.ignored');

        broker.recover();

        broker.publish('event', 'event.2');

        broker.consume('events', onRecoveredMessage);

        expect(messages).to.eql([
          'event.0',
          'event.1',
          'event.2',
        ]);

        done();
      }
    });

    it('recovers direct exchange in stopped broker', (done) => {
      const messages = [];

      broker.subscribeTmp('load', 'stop', stop);
      broker.consume('loads', onMessage);

      broker.publish('load', 'load.0');
      broker.publish('load', 'load.1');
      broker.publish('load', 'stop');

      function onMessage(routingKey) {
        messages.push(routingKey);
      }

      function onRecoveredMessage(routingKey, message) {
        messages.push(routingKey);
        message.ack();
      }

      function stop() {
        broker.stop();
        broker.publish('load', 'load.ignored');

        broker.recover();

        broker.publish('load', 'load.2');

        broker.consume('loads', onRecoveredMessage);

        expect(messages).to.eql([
          'load.0',
          'load.1',
          'load.2',
        ]);

        done();
      }
    });

    it('continues consumption', () => {
      const messages = [];

      const consumer = broker.subscribeTmp('event', '#', onMessage);

      broker.publish('event', 'event.1');
      broker.publish('event', 'event.2');

      broker.stop();

      broker.publish('event', 'event.3');

      const tmpQueue = broker.getQueue(consumer.queueName);
      expect(tmpQueue).to.be.ok;
      expect(tmpQueue).to.have.property('consumersCount', 1);

      broker.recover();

      broker.publish('event', 'event.4');

      expect(messages).to.eql([
        'event.1',
        'event.2',
        'event.4',
      ]);

      function onMessage(routingKey, message) {
        messages.push(routingKey);
        message.ack();
      }
    });
  });

  describe('multiple exchanges and queues', () => {
    let broker;
    beforeEach('setup exchanges and queues', () => {
      broker = Broker();

      broker.assertExchange('load', 'direct');
      broker.assertQueue('loadq1', {autoDelete: false});
      broker.assertQueue('loadq2', {autoDelete: false});

      broker.assertExchange('event', 'topic');
      broker.assertQueue('events', {autoDelete: false});

      broker.bindQueue('events', 'event', '#');
      broker.bindQueue('loadq1', 'load', '#');
      broker.bindQueue('loadq2', 'load', '#');
    });

    it('are recovered with bindings', () => {
      const state = broker.getState();
      const newBroker = Broker().recover(state);

      newBroker.publish('event', 'event.1');
      newBroker.publish('load', 'heavy.1');
      newBroker.publish('load', 'heavy.1');

      expect(newBroker.getQueue('events').length).to.equal(1);
      expect(newBroker.getQueue('loadq1').length).to.equal(1);
      expect(newBroker.getQueue('loadq2').length).to.equal(1);
    });

    it('are recovered with messages', () => {
      broker.publish('event', 'event.1');
      broker.publish('load', 'heavy.1');
      broker.publish('load', 'heavy.1');

      const state = broker.getState();
      const newBroker = Broker().recover(state);

      expect(newBroker.getQueue('events').length).to.equal(1);
      expect(newBroker.getQueue('loadq1').length).to.equal(1);
      expect(newBroker.getQueue('loadq2').length).to.equal(1);
    });

    it('recovers the same broker with bindings', () => {
      const state = broker.getState();
      broker.recover(state);

      broker.publish('event', 'event.1');
      broker.publish('load', 'heavy.1');
      broker.publish('load', 'heavy.1');

      expect(broker.getQueue('events').length).to.equal(1);
      expect(broker.getQueue('loadq1').length).to.equal(1);
      expect(broker.getQueue('loadq2').length).to.equal(1);
    });

    it('recovers the same broker with messages', () => {
      broker.publish('event', 'event.1');
      broker.publish('load', 'heavy.1');
      broker.publish('load', 'heavy.1');

      const state = broker.getState();
      broker.recover(state);

      expect(broker.getQueue('events').length).to.equal(1);
      expect(broker.getQueue('loadq1').length).to.equal(1);
      expect(broker.getQueue('loadq2').length).to.equal(1);
    });

    it('recoveres multiple direct exchange messages', (done) => {
      const messages = [];

      broker.consume('loadq1', onLoad1);
      broker.consume('loadq2', onLoad2);
      broker.consume('events', onEvent);

      broker.subscribeTmp('event', 'event.start', onStart, {noAck: true});

      broker.publish('load', 'start');
      broker.publish('load', 'complete');
      broker.publish('load', 'end');

      function onStart() {
        messages.push('-stop');
        broker.stop();
        const state = broker.getState();
        recover(state);
      }

      function onLoad1(routingKey, message) {
        messages.push(routingKey);
        broker.publish('event', `event.${routingKey}`);
        message.ack();
      }

      function onLoad2(routingKey, message) {
        messages.push(routingKey);
        broker.publish('event', `event.${routingKey}`);
        message.ack();
      }

      function onEvent(routingKey, message) {
        messages.push(routingKey);
        message.ack();
      }

      function recover(state) {
        broker = Broker().recover(state);

        broker.consume('loadq1', onLoad1);
        broker.consume('loadq2', onLoad2);

        setImmediate(() => {
          expect(messages).to.eql([
            'start',
            'event.start',
            '-stop',
            'start',
            'complete',
            'end',
          ]);

          done();
        });
      }
    });
  });

  describe('subscribe', () => {
    it('supports subscribe with the same function and different pattern', (done) => {
      const broker = Broker();

      broker.assertExchange('test');
      broker.subscribeTmp('test', 'test1', onMessage);
      broker.subscribeTmp('test', 'test', onMessage);

      let messageCount = 0;

      broker.publish('test', 'test');
      broker.publish('test', 'test1');

      function onMessage(routingKey, message) {
        ++messageCount;
        if (routingKey === 'test1') {
          expect(messageCount).to.equal(2);
          done();
        } else {
          message.ack();
        }
      }
    });

    it('returns owner in message callback', (done) => {
      const owner = {};
      const broker = Broker(owner);

      broker.assertExchange('test');
      broker.subscribeTmp('test', 'test.*', onMessage);

      broker.publish('test', 'test.1');

      function onMessage(routingKey, message, brokerOwner) {
        expect(brokerOwner).to.equal(owner);
        done();
      }
    });

    it('supports subscribe with general wildcard hash (#)', (done) => {
      const broker = Broker();

      broker.assertExchange('test');
      broker.subscribeTmp('test', '#', onMessage);

      let messageCount = 0;

      broker.publish('test', 'test');
      broker.publish('test', 'test1');

      function onMessage(routingKey, message) {
        ++messageCount;
        if (routingKey === 'test1') {
          expect(messageCount).to.equal(2);
          done();
        } else {
          message.ack();
        }
      }
    });

    it('supports subscribe with suffixed wildcard hash (test.#)', (done) => {
      const broker = Broker();

      broker.assertExchange('test');
      broker.subscribeTmp('test', 'test.#', onMessage);

      let messageCount = 0;

      broker.publish('test', 'test.0');
      broker.publish('test', 'test.1');

      function onMessage(routingKey, message) {
        ++messageCount;
        if (routingKey === 'test.1') {
          expect(messageCount).to.equal(2);
          done();
        } else {
          message.ack();
        }
      }
    });

    it('returns existing consumer if the same queue, function, and pattern is used when subscribing', (done) => {
      const broker = Broker();

      broker.assertExchange('test');
      const consumer1 = broker.subscribe('test', 'test.*', 'testq', onMessage);
      const consumer2 = broker.subscribe('test', 'test.*', 'testq', onMessage);

      expect(consumer1 === consumer2).to.be.true;

      broker.publish('test', 'test.1');

      function onMessage() {
        done();
      }
    });

    it('creates topic exchange with passed exchange name if not exists', () => {
      const broker = Broker();

      broker.subscribe('test', 'test.#', 'persist', () => {});

      const exchange = broker.getExchange('test');
      expect(exchange).to.be.ok;
      expect(exchange).to.have.property('type', 'topic');
    });

    it('throws if subscribe without onMessage callback', () => {
      const broker = Broker();

      expect(() => broker.subscribe('test', 'test.#', 'persist')).to.throw(Error);
    });

    it('throws if subscribe without routingKey pattern', () => {
      const broker = Broker();
      broker.assertExchange('test');

      expect(() => broker.subscribe('test', '', 'persist', () => {})).to.throw(Error);
    });

    it('throws if subscribing with NOT durable to durable queue', () => {
      const broker = Broker();
      broker.subscribe('test', 'test.#', 'durableQueue', onMessage1, {durable: true});

      expect(() => {
        broker.subscribe('test', 'test.#', 'durableQueue', onMessage2, {durable: false, memem: 1});
      }).to.throw(/durable/i);

      function onMessage1() {}
      function onMessage2() {}
    });

    it('throws if subscribing to exclusively consumed queue', () => {
      const broker = Broker();

      broker.subscribe('test', 'test.#', 'exclusiveQueue', onMessage1, {exclusive: true});

      expect(() => {
        broker.subscribe('test', 'test.#', 'exclusiveQueue', onMessage2);
      }).to.throw(/exclusively/i);

      function onMessage1() {}
      function onMessage2() {}
    });

    it('cannot exclusively subscribe if already consumed', () => {
      const broker = Broker();

      broker.subscribe('test', 'test.#', 'exclusiveQueue', onMessage1);

      expect(() => {
        broker.subscribe('test', 'test.#', 'exclusiveQueue', onMessage2, {exclusive: true});
      }).to.throw(/cannot exclusively/i);

      function onMessage1() {}
      function onMessage2() {}
    });

    it('releases exclusive consumption if unsubscribed', () => {
      const broker = Broker();

      const queue = broker.assertQueue('exclusiveQueue', {autoDelete: false});
      broker.subscribe('test', 'test.#', 'exclusiveQueue', onMessage1, {exclusive: true});

      expect(queue).to.have.property('exclusive', true);

      broker.unsubscribe('exclusiveQueue', onMessage1);
      expect(queue).to.have.property('exclusive', false);

      broker.subscribe('test', 'test.#', 'exclusiveQueue', onMessage2);

      function onMessage1() {}
      function onMessage2() {}
    });

    it('subscribeOnce() closes consumer immediately after message is received', () => {
      const broker = Broker();

      const exchange = broker.assertExchange('event');
      const onceConsumer = broker.subscribeOnce('event', '#', onMessage);
      expect(onceConsumer).to.be.ok;
      expect(onceConsumer.options).to.have.property('noAck', true);

      const onceQueue = broker.getQueue(onceConsumer.queueName);
      expect(onceQueue).to.be.ok;
      expect(onceQueue.options).to.have.property('durable', false);
      expect(onceQueue.options).to.have.property('autoDelete', true);

      expect(exchange).to.have.property('bindingsCount', 1);

      const messages = [];

      broker.publish('event', 'once');
      broker.publish('event', 'twice');

      expect(exchange).to.have.property('bindingsCount', 0);

      expect(messages).to.eql(['once']);

      function onMessage(routingKey) {
        messages.push(routingKey);
      }
    });

    describe('prefetch', () => {
      it('prefetch 2 consumes two messages at a time', () => {
        const broker = Broker();

        broker.assertQueue('test');
        broker.sendToQueue('test', 'test.1.1');
        broker.sendToQueue('test', 'test.2.1');
        broker.sendToQueue('test', 'test.1.2');
        broker.sendToQueue('test', 'test.2.2');

        const messages = [];
        broker.subscribe('test', 'test.#', 'test', onMessage, {prefetch: 2});

        broker.publish('test', 'test.1.3');

        expect(messages).to.have.length(5);
        expect(messages.map(({routingKey}) => routingKey)).to.eql(['test.1.1', 'test.2.1', 'test.1.2', 'test.2.2', 'test.1.3']);

        function onMessage(_, message) {
          messages.push(message);

          if (!(messages.length % 2)) {
            messages.slice(-2).forEach((msg) => msg.ack());
          }
        }
      });

      it('prefetch 2 consumes takes two published messages at a time', (done) => {
        const broker = Broker();

        broker.assertQueue('test');

        const messages = [];
        broker.subscribe('test', 'test.#', 'testq', onMessage, {prefetch: 2});

        broker.publish('test', 'test.1.1', null, {correlationId: 1});
        broker.publish('test', 'test.2.1', null, {correlationId: 1});
        broker.publish('test', 'test.1.2', null, {correlationId: 2});
        broker.publish('test', 'test.2.2', null, {correlationId: 2});
        broker.publish('test', 'test.1.3', null, {correlationId: 3});

        function cb() {
          expect(messages).to.have.length(5);
          expect(messages.map(({routingKey}) => routingKey)).to.eql(['test.1.1', 'test.2.1', 'test.1.2', 'test.2.2', 'test.1.3']);
          done();
        }

        function onMessage(_, message) {
          messages.push(message);

          if (!(messages.length % 2)) {
            messages.slice(-2).forEach((msg) => msg.ack());
          }

          if (messages.length === 5) cb();
        }
      });
    });
  });

  describe('unsubscribe', () => {
    it('unsubscribe in message callback remove consumer based on pattern', () => {
      const broker = Broker();

      const queue = broker.assertQueue('testq');
      broker.subscribe('test', 'test.*', 'testq', onMessage1);
      broker.subscribe('test', 'test.#', 'testq', onMessage2);

      expect(queue.consumersCount).to.equal(2);

      broker.publish('test', 'test.1');
      broker.publish('test', 'test.1');
      broker.publish('test', 'test.1');

      expect(queue.consumersCount).to.equal(1);

      function onMessage1() {
        broker.unsubscribe('testq', onMessage2);
      }

      function onMessage2() {}
    });

    it('unsubscribe from exclusive consumer with autoDelete queue removes queue', () => {
      const broker = Broker();
      broker.assertQueue('testq', {durable: true, autoDelete: true});
      broker.sendToQueue('testq', 'test.1');
      broker.sendToQueue('testq', 'test.2');
      broker.sendToQueue('testq', 'test.3');
      broker.sendToQueue('testq', 'test.4');

      broker.subscribe('test', 'test.*', 'testq', onMessage, {exclusive: true});

      expect(broker.getQueue('testq')).to.be.undefined;

      function onMessage(routingKey, message) {
        if (routingKey === 'test.4') broker.unsubscribe('testq', onMessage);
        message.ack();
      }
    });

    it('unsubscribe from durable, keep queue nacks all messages', () => {
      const broker = Broker();
      const queue = broker.assertQueue('testq', {durable: true, autoDelete: false});
      broker.sendToQueue('testq', 'test.1');
      broker.sendToQueue('testq', 'test.2');
      broker.sendToQueue('testq', 'test.3');
      broker.sendToQueue('testq', 'test.4');

      broker.subscribe('test', 'test.*', 'testq', onMessage, {exclusive: true});

      expect(queue.length).to.equal(3);
      const peekMessage = queue.peek();
      expect(peekMessage.routingKey).to.equal('test.2');
      expect(peekMessage.pending).to.be.false;

      function onMessage(routingKey, message) {
        if (routingKey === 'test.2') return broker.unsubscribe('testq', onMessage);
        message.ack();
      }
    });
  });

  describe('peek', () => {
    it('returns undefined if no messages', () => {
      const broker = Broker();

      const consumer = broker.subscribeTmp('test', '#', onMessage);

      expect(broker.getQueue(consumer.queueName).peek()).to.be.undefined;

      function onMessage() {}
    });

    it('returns first message', () => {
      const broker = Broker();

      const consumer = broker.subscribeTmp('test', 'test.#', onMessage);

      broker.publish('test', 'test.0');
      broker.publish('test', 'test.1');
      broker.publish('test', 'test.2');

      expect(broker.getQueue(consumer.queueName).peek()).to.have.property('routingKey', 'test.0');

      function onMessage() {}
    });

    it('with ignore pending argument true returns message that is not pending ack', () => {
      const broker = Broker();

      const consumer = broker.subscribeTmp('test', 'test.#', onMessage);

      broker.publish('test', 'test.0');
      broker.publish('test', 'test.1');
      broker.publish('test', 'test.2');

      expect(broker.getQueue(consumer.queueName).peek(true)).to.have.property('routingKey', 'test.1');

      function onMessage() {}
    });

    it('with ignore pending argument true returns undefined if no queued messages beyond pending', () => {
      const broker = Broker();

      const consumer = broker.subscribeTmp('test', 'test.#', onMessage);

      broker.publish('test', 'test.0');

      expect(broker.getQueue(consumer.queueName).peek(true)).to.be.undefined;

      function onMessage() {}
    });
  });

  describe('routingKey pattern', () => {
    let broker, exchange, queue;
    before(() => {
      broker = Broker();
      exchange = broker.assertExchange('test-pattern');
      queue = broker.assertQueue('test-pattern-queue');
    });

    it('# matches all', () => {
      const binding = exchange.bind(queue, '#');
      expect(binding.testPattern('a.b.c')).to.be.true;
      expect(binding.testPattern('abc')).to.be.true;
      expect(binding.testPattern('a')).to.be.true;
    });

    it('* matches one', () => {
      const binding = exchange.bind(queue, '*');
      expect(binding.testPattern('a')).to.be.true;
      expect(binding.testPattern('a.b.c')).to.be.false;
      expect(binding.testPattern('abc')).to.be.true;
    });

    it('prefix.# matches all that start with prefix', () => {
      const binding = exchange.bind(queue, 'prefix.#');
      expect(binding.testPattern('prefix.a.b.c')).to.be.true;
      expect(binding.testPattern('prefix')).to.be.false;
      expect(binding.testPattern('abc')).to.be.false;
    });

    it('prefix.* matches one that start with prefix', () => {
      const binding = exchange.bind(queue, 'prefix.*');
      expect(binding.testPattern('prefix.a')).to.be.true;
      expect(binding.testPattern('prefix.a.b.c')).to.be.false;
      expect(binding.testPattern('prefix')).to.be.false;
      expect(binding.testPattern('abc')).to.be.false;
    });

    it('prefix.#.suffix matches all that start with prefix and ends with suffix', () => {
      const binding = exchange.bind(queue, 'prefix.#.b');
      expect(binding.testPattern('prefix.a.b')).to.be.true;
      expect(binding.testPattern('prefix.a.o.u.b')).to.be.true;
      expect(binding.testPattern('prefix.a')).to.be.false;
      expect(binding.testPattern('prefix')).to.be.false;
      expect(binding.testPattern('abc')).to.be.false;
    });

    it('prefix.*.suffix matches one that start with prefix and ends with suffix', () => {
      const binding = exchange.bind(queue, 'prefix.*.b');
      expect(binding.testPattern('prefix.a.b')).to.be.true;
      expect(binding.testPattern('prefix.a')).to.be.false;
      expect(binding.testPattern('prefix.a.b.c')).to.be.false;
      expect(binding.testPattern('prefix')).to.be.false;
      expect(binding.testPattern('abc')).to.be.false;
    });

    it('special characters match', () => {
      const binding = exchange.bind(queue, 'prefix-a.*.b');
      expect(binding.testPattern('prefix-a.a.b')).to.be.true;
      expect(binding.testPattern('prefix-a.a')).to.be.false;
    });
  });
});
