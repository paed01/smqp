import {Broker} from '../index';

describe('Broker queue', () => {
  describe('options', () => {
    it('durable autoDelete queue is deleted when last consumer is unsubscribed', () => {
      const broker = Broker();

      const consumer1 = broker.subscribe('test', 'test.1', 'persist', onMessage1, {durable: true});
      const consumer2 = broker.subscribe('test', 'test.2', 'persist', onMessage2, {durable: true});

      broker.sendToQueue('persist', 'test.1');

      const queue = broker.getQueue('persist');
      expect(queue.options).to.have.property('autoDelete', true);
      expect(queue.options).to.have.property('durable', true);

      consumer1.cancel();
      consumer2.cancel();

      expect(broker.getQueue('persist')).to.be.undefined;

      function onMessage1() {}
      function onMessage2() {}
    });
  });

  describe('broker.get()', () => {
    it('returns message from queue', () => {
      const broker = Broker();
      broker.assertQueue('test-q');
      broker.sendToQueue('test-q', {msg: 1});

      const msg = broker.get('test-q');
      expect(msg).to.have.property('content').that.eql({msg: 1});
    });

    it('returns falsey if no message', () => {
      const broker = Broker();
      broker.assertQueue('test-q');
      expect(broker.get('test-q')).to.not.be.ok;
    });

    it('expects to be acked', () => {
      const broker = Broker();
      broker.assertQueue('test-q');
      broker.sendToQueue('test-q', {msg: 1});
      broker.sendToQueue('test-q', {msg: 2});

      const msg = broker.get('test-q');
      expect(msg).to.have.property('content').that.eql({msg: 1});
      expect(msg.pending).to.be.true;
    });

    it('noAck option acks message immediately and leaves the rest of the messages in the queue', () => {
      const broker = Broker();
      const queue = broker.assertQueue('test-q');
      broker.sendToQueue('test-q', {msg: 1});
      broker.sendToQueue('test-q', {msg: 2});

      const msg = broker.get('test-q', {noAck: true});
      expect(msg).to.have.property('content').that.eql({msg: 1});
      expect(msg.pending).to.be.true;

      expect(queue.messageCount).to.equal(1);
    });
  });

  describe('broker.ack(message[, allUpTo])', () => {
    it('acks message', () => {
      const broker = Broker();
      const queue = broker.assertQueue('test-q');
      broker.sendToQueue('test-q', {msg: 1});
      expect(queue.messageCount).to.equal(1);

      broker.ack(broker.get('test-q'));

      expect(queue.messageCount).to.equal(0);
    });

    it('with allUpTo = true acks all up to outstanding messages', () => {
      const broker = Broker();
      const queue = broker.assertQueue('test-q');
      broker.sendToQueue('test-q', {msg: 1});
      broker.sendToQueue('test-q', {msg: 2});
      broker.sendToQueue('test-q', {msg: 3});
      expect(queue.messageCount).to.equal(3);

      broker.get('test-q');
      broker.ack(broker.get('test-q'), true);

      expect(queue.messageCount).to.equal(1);
    });
  });

  describe('broker.ackAll()', () => {
    it('acks all outstanding messages in queues', () => {
      const broker = Broker();
      const queue1 = broker.assertQueue('test1-q');
      const queue2 = broker.assertQueue('test2-q');
      broker.sendToQueue('test1-q', {msg: 1});
      broker.sendToQueue('test1-q', {msg: 2});
      broker.sendToQueue('test2-q', {msg: 3});
      expect(queue1.messageCount).to.equal(2);
      expect(queue2.messageCount).to.equal(1);

      broker.get('test1-q');
      broker.get('test2-q');

      broker.ackAll();

      expect(queue1.messageCount).to.equal(1);
      expect(queue2.messageCount).to.equal(0);
    });
  });

  describe('broker.nack(message[, allUpTo, requeue])', () => {
    it('nacks and requeues message', () => {
      const broker = Broker();
      const queue = broker.assertQueue('test-q');
      broker.sendToQueue('test-q', {msg: 1});
      expect(queue.messageCount).to.equal(1);

      broker.nack(broker.get('test-q'));

      expect(queue.messageCount).to.equal(1);
    });

    it('with allUpTo = true nacks and requeues all up to outstanding messages', () => {
      const broker = Broker();
      const queue = broker.assertQueue('test-q');
      broker.sendToQueue('test-q', {msg: 1});
      broker.sendToQueue('test-q', {msg: 2});
      broker.sendToQueue('test-q', {msg: 3});
      expect(queue.messageCount).to.equal(3);

      broker.get('test-q');
      broker.nack(broker.get('test-q'), true);

      expect(queue.messageCount).to.equal(3);
    });

    it('with falsey requeue dequeues message', () => {
      const broker = Broker();
      const queue = broker.assertQueue('test-q');
      broker.sendToQueue('test-q', {msg: 1});
      expect(queue.messageCount).to.equal(1);

      broker.nack(broker.get('test-q'), false, false);

      expect(queue.messageCount).to.equal(0);
    });

    it('with allUpTo = true and no requeue nacks and requeues all up to outstanding messages', () => {
      const broker = Broker();
      const queue = broker.assertQueue('test-q');
      broker.sendToQueue('test-q', {msg: 1});
      broker.sendToQueue('test-q', {msg: 2});
      broker.sendToQueue('test-q', {msg: 3});
      expect(queue.messageCount).to.equal(3);

      broker.get('test-q');
      broker.nack(broker.get('test-q'), true, false);

      expect(queue.messageCount).to.equal(1);
    });
  });

  describe('broker.nackAll([requeue])', () => {
    it('nacks and requeues all outstanding message', () => {
      const broker = Broker();
      const queue1 = broker.assertQueue('test1-q');
      const queue2 = broker.assertQueue('test2-q');
      broker.sendToQueue('test1-q', {msg: 1});
      broker.sendToQueue('test1-q', {msg: 2});
      broker.sendToQueue('test2-q', {msg: 3});
      expect(queue1.messageCount).to.equal(2);
      expect(queue2.messageCount).to.equal(1);

      broker.get('test1-q');
      broker.get('test2-q');

      broker.nackAll();

      expect(queue1.messageCount).to.equal(2);
      expect(queue2.messageCount).to.equal(1);
    });

    it('with falsey requeue nacks and dequeues all outstanding message', () => {
      const broker = Broker();
      const queue1 = broker.assertQueue('test1-q');
      const queue2 = broker.assertQueue('test2-q');
      broker.sendToQueue('test1-q', {msg: 1});
      broker.sendToQueue('test1-q', {msg: 2});
      broker.sendToQueue('test2-q', {msg: 3});
      expect(queue1.messageCount).to.equal(2);
      expect(queue2.messageCount).to.equal(1);

      broker.get('test1-q');
      broker.get('test2-q');

      broker.nackAll(false);

      expect(queue1.messageCount).to.equal(1);
      expect(queue2.messageCount).to.equal(0);
    });
  });

  describe('broker.reject(message[, requeue])', () => {
    it('nacks and requeues message', () => {
      const broker = Broker();
      const queue = broker.assertQueue('test-q');
      broker.sendToQueue('test-q', {msg: 1});
      expect(queue.messageCount).to.equal(1);

      broker.reject(broker.get('test-q'));

      expect(queue.messageCount).to.equal(1);
    });

    it('with falsey requeue dequeues message', () => {
      const broker = Broker();
      const queue = broker.assertQueue('test-q');
      broker.sendToQueue('test-q', {msg: 1});
      expect(queue.messageCount).to.equal(1);

      broker.reject(broker.get('test-q'), false, false);

      expect(queue.messageCount).to.equal(0);
    });
  });

  describe('broker.sendToQueue()', () => {
    it('sendToQueue() publish message on queue', () => {
      const broker = Broker();

      broker.assertQueue('persist', {durable: true});
      broker.sendToQueue('persist', {msg: 1});
      broker.sendToQueue('persist', {msg: 2});

      const queueState = broker.assertQueue('persist').getState();

      expect(queueState).to.have.property('messages').with.length(2);
      expect(queueState.messages[0]).to.have.property('content').that.eql({msg: 1});
      expect(queueState.messages[1]).to.have.property('content').that.eql({msg: 2});
    });

    it('message in durable queue is consumed', () => {
      const broker = Broker();

      broker.assertQueue('persist', {durable: true});
      broker.sendToQueue('persist', {msg: 1});

      const messages = [];
      broker.consume('persist', onMessage);

      expect(messages).to.have.length(1);
      expect(messages[0]).to.have.property('content').that.eql({msg: 1});

      function onMessage(routingKey, message) {
        messages.push(message);
        message.ack();
      }
    });

    it('multiple messages in durable queue are consumed', () => {
      const broker = Broker();

      broker.assertQueue('persist', {durable: true});
      broker.sendToQueue('persist', {msg: 1});
      broker.sendToQueue('persist', {msg: 2});

      const messages = [];
      broker.consume('persist', onMessage, {durable: true});

      expect(messages).to.have.length(2);
      expect(messages[0]).to.have.property('content').that.eql({msg: 1});
      expect(messages[1]).to.have.property('content').that.eql({msg: 2});

      function onMessage(routingKey, message) {
        messages.push(message);
        message.ack();
      }
    });

    it('messages are consumed when sent to durable queue after consume', () => {
      const broker = Broker();

      broker.assertQueue('persist', {durable: true});
      broker.sendToQueue('persist', {msg: 1});

      const messages = [];

      broker.consume('persist', onMessage, {durable: true});
      broker.sendToQueue('persist', {msg: 2});

      expect(messages[0]).to.have.property('content').that.eql({msg: 1});
      expect(messages[1]).to.have.property('content').that.eql({msg: 2});
      expect(messages).to.have.length(2);

      function onMessage(routingKey, message) {
        messages.push(message);
        message.ack();
      }
    });

    it('consumes messages after current is acked', () => {
      const broker = Broker();

      const queue = broker.assertQueue('persist');
      broker.sendToQueue('persist', 'test.1');

      const messages = [];

      queue.consume(onMessage);
      broker.sendToQueue('persist', 'test.2');
      broker.sendToQueue('persist', 'test.3');

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
  });

  describe('broker.purgeQueue()', () => {
    it('purge in message callback removes all messages', () => {
      const broker = Broker();

      const queue = broker.assertQueue('test-q');
      broker.sendToQueue('test-q', {msg: 1});
      broker.sendToQueue('test-q', {msg: 2});

      const messages = [];

      broker.consume('test-q', onMessage);

      expect(queue.messageCount).to.equal(0);
      expect(messages).to.have.length(1);

      function onMessage(routingKey, message) {
        messages.push(message);
        broker.purgeQueue('test-q');
        message.ack();
      }
    });
  });

  describe('broker.deleteQueue(queueName[, {ifUnused, ifEmpty}])', () => {
    it('deletes queue from broker', () => {
      const broker = Broker();

      broker.assertQueue('test-q');
      broker.sendToQueue('test-q', {msg: 1});
      broker.sendToQueue('test-q', {msg: 2});

      broker.consume('test-q', onMessage);

      broker.deleteQueue('test-q');

      expect(broker.getQueue('test-q')).to.be.undefined;

      expect(broker.queueCount).to.equal(0);

      function onMessage() {}
    });

    it('keeps queue if in use if that option is passed', () => {
      const broker = Broker();

      broker.assertQueue('test-q');
      broker.sendToQueue('test-q', {msg: 1});
      broker.sendToQueue('test-q', {msg: 2});

      broker.consume('test-q', onMessage);
      expect(broker.consumerCount).to.equal(1);

      broker.deleteQueue('test-q', {ifUnused: true});

      expect(broker.getQueue('test-q')).to.be.ok;

      expect(broker.queueCount).to.equal(1);
      expect(broker.consumerCount).to.equal(1);

      function onMessage() {}
    });

    it('keeps queue if not empty if that option is passed', () => {
      const broker = Broker();

      broker.assertQueue('test-q');
      broker.sendToQueue('test-q', {msg: 1});
      broker.sendToQueue('test-q', {msg: 2});

      broker.deleteQueue('test-q', {ifEmpty: true});

      expect(broker.getQueue('test-q')).to.be.ok;

      expect(broker.queueCount).to.equal(1);
    });
  });

  describe('maxLength', () => {
    it('maxLength = 0 evicts all messages', () => {
      const broker = Broker();

      const queue = broker.assertQueue('test-q', {maxLength: 0});

      broker.sendToQueue('test-q', {msg: 1});
      broker.sendToQueue('test-q', {msg: 2});
      broker.sendToQueue('test-q', {msg: 3});

      expect(queue.messageCount).to.equal(0);
    });

    it('maxLength = 0 evicts all messages and leaves nothing to consumer', () => {
      const broker = Broker();

      const queue = broker.assertQueue('test-q', {maxLength: 0});
      const messages = [];
      broker.consume('test-q', onMessage);

      broker.sendToQueue('test-q', {msg: 1});
      broker.sendToQueue('test-q', {msg: 2});

      expect(queue.messageCount).to.equal(0);
      expect(messages).to.have.length(0);

      function onMessage(routingKey, message) {
        messages.push(message);
        message.ack();
      }
    });

    it('maxLength = 1 evicts old messages', () => {
      const broker = Broker();

      const queue = broker.assertQueue('test-q', {maxLength: 1});
      const messages = [];

      broker.sendToQueue('test-q', {msg: 1});
      broker.sendToQueue('test-q', {msg: 2});
      broker.sendToQueue('test-q', {msg: 3});

      expect(queue.messageCount).to.equal(1);

      broker.consume('test-q', onMessage);
      expect(messages).to.have.length(1);
      expect(messages[0].content.msg).to.equal(3);

      function onMessage(routingKey, message) {
        messages.push(message);
        message.ack();
      }
    });

    it('maxLength = 1 keeps unacked message', () => {
      const broker = Broker();

      const queue = broker.assertQueue('test-q', {maxLength: 1});
      const messages = [];

      broker.sendToQueue('test-q', {msg: 1});
      broker.sendToQueue('test-q', {msg: 2});
      broker.sendToQueue('test-q', {msg: 3});

      expect(queue.messageCount).to.equal(1);

      broker.consume('test-q', onMessage);
      expect(messages).to.have.length(1);

      let msg = messages.pop();
      expect(msg.content.msg).to.equal(3);

      broker.sendToQueue('test-q', {msg: 4});

      expect(queue.messageCount).to.equal(1);

      msg.nack(false, true);
      expect(messages).to.have.length(1);

      msg = messages.pop();
      expect(msg.content.msg).to.equal(3);

      function onMessage(routingKey, message) {
        messages.push(message);
      }
    });
  });

  describe('behaviour', () => {
    it('can be bound to same exchange with different pattern', () => {
      const broker = Broker();
      const topic = broker.assertExchange('topic');

      const queue = broker.assertQueue('multi');

      broker.bindQueue(queue.name, 'topic', 'event.*');
      broker.bindQueue(queue.name, 'topic', 'load.*');

      expect(topic.bindingCount).to.equal(2);

      broker.publish('topic', 'event.1');
      broker.publish('topic', 'load.1');

      expect(queue.messageCount).to.equal(2);
    });

    it('can be unbound from multiple exchanges', () => {
      const broker = Broker();
      const topic = broker.assertExchange('topic', 'topic', {autoDelete: false});
      const direct = broker.assertExchange('direct', 'direct', {autoDelete: true});

      const queue = broker.assertQueue('multi');

      broker.bindQueue(queue.name, 'topic', '#');
      broker.bindQueue(queue.name, 'direct', '#');

      broker.publish('topic', 'event.1');
      broker.publish('direct', 'load.1');

      expect(queue.messageCount).to.equal(2);

      broker.unbindQueue(queue.name, 'topic', '#');

      expect(topic.bindingCount).to.equal(0);
      expect(direct.bindingCount).to.equal(1);
    });

    it('deleted queue is unbound from multiple exchanges', () => {
      const broker = Broker();
      const topic = broker.assertExchange('topic', 'topic', {autoDelete: false});
      const direct = broker.assertExchange('direct', 'direct', {autoDelete: true});

      const queue = broker.assertQueue('multi');

      broker.bindQueue(queue.name, 'topic', '#');
      broker.bindQueue(queue.name, 'direct', '#');

      broker.publish('topic', 'event.1');
      broker.publish('direct', 'load.1');

      expect(queue.messageCount).to.equal(2);

      broker.deleteQueue(queue.name);

      expect(topic.bindingCount).to.equal(0);
      expect(direct.bindingCount).to.equal(0);
    });

    it('can be unbound from same exchange with different pattern', () => {
      const broker = Broker();
      const topic = broker.assertExchange('topic');

      const queue = broker.assertQueue('multi');

      broker.bindQueue(queue.name, 'topic', 'event.*');
      broker.bindQueue(queue.name, 'topic', 'load.*');

      broker.publish('topic', 'event.1');
      broker.publish('topic', 'load.1');

      broker.unbindQueue(queue.name, 'topic', 'load.*');
      expect(topic.bindingCount).to.equal(1);

      broker.publish('topic', 'event.2');
      broker.publish('topic', 'load.2');

      expect(queue.messageCount).to.equal(3);
    });

    it('deleted queue is unbound from same exchange different pattern', () => {
      const broker = Broker();
      const topic = broker.assertExchange('topic', 'topic', {autoDelete: false});

      const queue = broker.assertQueue('multi');

      broker.bindQueue(queue.name, 'topic', 'event.#');
      broker.bindQueue(queue.name, 'topic', 'load.#');

      broker.publish('topic', 'event.1');
      broker.publish('topic', 'load.1');

      expect(queue.messageCount).to.equal(2);

      broker.deleteQueue(queue.name);

      expect(topic.bindingCount).to.equal(0);
    });
  });

  describe('events', () => {
    it('emits depleted when all messages were consumed', (done) => {
      const broker = Broker();
      const queue = broker.assertQueue('test-q');

      queue.on('depleted', () => done());
      queue.queueMessage({}, {});

      queue.get().ack();
    });

    it('off() turns off event handler', (done) => {
      const broker = Broker();
      const queue = broker.assertQueue('test-q');

      queue.on('depleted', onDepleted);
      queue.queueMessage({}, {});

      queue.off('depleted', onDepleted);

      queue.get().ack();

      done();

      function onDepleted() {
        done();
      }
    });

    it('emits depleted more than once', () => {
      const broker = Broker();
      const exchange = broker.assertExchange('event');
      const queue = broker.assertQueue('event-q');

      broker.bindQueue(queue.name, exchange.name, 'event.*');

      const depletes = [];

      queue.on('depleted', () => {
        depletes.push(1);
      });

      broker.publish('event', 'event.1');

      queue.get().ack();
      expect(depletes).to.have.length(1);

      broker.publish('event', 'event.2');

      queue.get().ack();
      expect(depletes).to.have.length(2);
    });

    it('emits depleted when message is acked', () => {
      const broker = Broker();
      const exchange = broker.assertExchange('event');
      const queue = broker.assertQueue('event-q');

      broker.bindQueue(queue.name, exchange.name, 'event.*');

      const depletes = [];

      queue.on('depleted', () => {
        depletes.push(1);
      });

      broker.publish('event', 'event.1');

      const msg = queue.get();
      expect(depletes).to.have.length(0);

      msg.ack();
      expect(depletes).to.have.length(1);
    });

    it('emits depleted when all messages have been consumed', () => {
      const broker = Broker();
      const exchange = broker.assertExchange('event');
      const queue = broker.assertQueue('event-q');

      broker.bindQueue(queue.name, exchange.name, 'event.*');

      const depletes = [];

      queue.on('depleted', () => {
        depletes.push(1);
      });

      broker.publish('event', 'event.1');
      broker.publish('event', 'event.2');
      broker.publish('event', 'event.3');

      queue.get().ack();
      expect(depletes).to.have.length(0);

      queue.get().ack();
      expect(depletes).to.have.length(0);

      queue.get().ack();
      expect(depletes).to.have.length(1);
    });

    it('depleted listener can be canceled inside handler', () => {
      const broker = Broker();
      const exchange = broker.assertExchange('event');
      const queue = broker.assertQueue('event-q');

      broker.bindQueue(queue.name, exchange.name, 'event.*');

      const depletes = [];

      const depleteListener = queue.on('depleted', () => {
        depletes.push(1);
        depleteListener.cancel();
      });

      broker.publish('event', 'event.1');

      queue.get().ack();
      expect(depletes).to.have.length(1);

      broker.publish('event', 'event.2');

      queue.get().ack();
      expect(depletes).to.have.length(1);
    });
  });

  describe('peek', () => {
    it('returns nothing if no messages', () => {
      const broker = Broker();
      const queue = broker.assertQueue('test-q');

      expect(queue.peek()).to.be.undefined;
    });

    it('returns first message in queue', () => {
      const broker = Broker();
      const queue = broker.assertQueue('test-q');
      queue.queueMessage({routingKey: 'test.1'});

      expect(queue.peek()).to.have.property('fields').with.property('routingKey', 'test.1');
    });
  });

  describe('cancel', () => {
    it('cancels consumer by tag', () => {
      const broker = Broker();
      const queue = broker.assertQueue('test-q');
      queue.consume(() => {}, {consumerTag: 'c-tag'});
      expect(queue.consumerCount).to.equal(1);

      queue.cancel('c-tag');

      expect(queue.consumerCount).to.equal(0);
    });

    it('keeps consumers if cancel unknown tag', () => {
      const broker = Broker();
      const queue = broker.assertQueue('test-q');
      queue.consume(() => {}, {consumerTag: 'c-tag'});
      expect(queue.consumerCount).to.equal(1);

      queue.cancel('b-tag');

      expect(queue.consumerCount).to.equal(1);
    });
  });

  describe('getState', () => {
    it('returns only name and options if no messages', () => {
      const broker = Broker();
      const queue = broker.assertQueue('test-q');

      expect(queue.getState()).to.deep.equal({
        name: 'test-q',
        options: { autoDelete: true, durable: true, maxLength: Infinity },
      });
    });

    it('returns messages if any', () => {
      const broker = Broker();
      const queue = broker.assertQueue('test-q');
      queue.queueMessage({routingKey: 'test.1'});

      expect(queue.getState()).to.have.property('messages').with.length(1);
    });
  });
});
