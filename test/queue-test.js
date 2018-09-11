import {Broker} from '../index';

describe('queue', () => {
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

  describe('.bindings', () => {
    it('keeps reference to exchange binding', () => {
      const broker = Broker();
      broker.assertExchange('event');
      const topic = broker.assertExchange('topic');

      const queue = broker.assertQueue('q');

      broker.bindQueue(queue.name, 'topic', '#');

      expect(queue.bindings).to.have.length(1);
      expect(queue.bindings[0].exchange === topic).to.be.true;
    });

    it('keeps reference to multiple exchange bindings', () => {
      const broker = Broker();
      broker.assertExchange('event');
      const topic = broker.assertExchange('topic');
      const direct = broker.assertExchange('direct', 'direct');

      const queue = broker.assertQueue('multi');

      broker.bindQueue(queue.name, 'topic', '#');
      broker.bindQueue(queue.name, 'direct', '#');

      expect(queue.bindings).to.have.length(2);
      expect(queue.bindings[0].exchange === topic).to.be.true;
      expect(queue.bindings[1].exchange === direct).to.be.true;
    });

    it('keeps reference to different pattern bindings exchange', () => {
      const broker = Broker();
      broker.assertExchange('topic');

      const queue = broker.assertQueue('multi');

      broker.bindQueue(queue.name, 'topic', 'event.#');
      broker.bindQueue(queue.name, 'topic', 'load.#');

      expect(queue.bindings).to.have.length(2);
    });

    it('close referenced binding removes binding from queue and exchange', () => {
      const broker = Broker();
      const topic = broker.assertExchange('topic');
      const queue = broker.assertQueue('multi');

      broker.bindQueue(queue.name, 'topic', 'event.#');
      broker.bindQueue(queue.name, 'topic', 'load.#');

      expect(queue.bindings).to.have.length(2);
      queue.bindings[0].close();

      expect(topic.bindings).to.have.length(1);
      expect(queue.bindings).to.have.length(1);
    });

    it('removes bindings if exchange is deleted', () => {
      const broker = Broker();
      const topic = broker.assertExchange('topic');
      const queue = broker.assertQueue('multi');

      broker.bindQueue(queue.name, 'topic', 'event.#');
      broker.bindQueue(queue.name, 'topic', 'load.#');

      expect(queue.bindings).to.have.length(2);

      broker.deleteExchange(topic.name);

      expect(queue.bindings).to.have.length(0);
    });

    it('close all referenced bindings removes bindings from queue and exchange', () => {
      const broker = Broker();
      const topic = broker.assertExchange('topic');
      const queue = broker.assertQueue('multi');

      broker.bindQueue(queue.name, 'topic', 'event.#');
      broker.bindQueue(queue.name, 'topic', 'load.#');

      expect(queue.bindings).to.have.length(2);
      queue.bindings[0].close();
      queue.bindings[0].close();

      expect(topic.bindings).to.have.length(0);
      expect(queue.bindings).to.have.length(0);
    });

    it('add binding from different queue throws', () => {
      const broker = Broker();
      broker.assertExchange('topic');
      const queue1 = broker.assertQueue('q1');
      const queue2 = broker.assertQueue('q2');

      broker.bindQueue(queue1.name, 'topic', 'event.#');
      broker.bindQueue(queue2.name, 'topic', 'load.#');

      expect(() => {
        queue1.addBinding(queue2.bindings[0]);
      }).to.throw(Error, /bindings are exclusive/);
    });

    it('can be bound to multiple exchanges', () => {
      const broker = Broker();
      broker.assertExchange('topic');
      broker.assertExchange('direct', 'direct');

      const queue = broker.assertQueue('multi');

      broker.bindQueue(queue.name, 'topic', '#');
      broker.bindQueue(queue.name, 'direct', '#');

      broker.publish('topic', 'event.1');
      broker.publish('direct', 'load.1');

      expect(queue.length).to.equal(2);
    });
  });

  describe('sendToQueue()', () => {
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

      queue.addConsumer(onMessage, {durable: true});
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

  describe('purgeQueue()', () => {
    it('purge in message callback removes all messages', () => {
      const broker = Broker();

      const queue = broker.assertQueue('purge-me');
      broker.sendToQueue('purge-me', {msg: 1});
      broker.sendToQueue('purge-me', {msg: 2});

      const messages = [];

      broker.consume('purge-me', onMessage);

      expect(queue.length).to.equal(0);
      expect(messages).to.have.length(1);

      function onMessage(routingKey, message) {
        messages.push(message);
        broker.purgeQueue('purge-me');
        message.ack();
      }
    });
  });

  describe('peek()', () => {
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

      expect(broker.getQueue(consumer.queueName).peek()).to.have.property('fields').with.property('routingKey', 'test.0');

      function onMessage() {}
    });

    it('with ignore pending argument true returns message that is not pending ack', () => {
      const broker = Broker();

      const consumer = broker.subscribeTmp('test', 'test.#', onMessage);

      broker.publish('test', 'test.0');
      broker.publish('test', 'test.1');
      broker.publish('test', 'test.2');

      expect(broker.getQueue(consumer.queueName).peek(true)).to.have.property('fields').with.property('routingKey', 'test.1');

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

  describe('behaviour', () => {
    it('can be bound to same exchange with different pattern', () => {
      const broker = Broker();
      const topic = broker.assertExchange('topic');

      const queue = broker.assertQueue('multi');

      broker.bindQueue(queue.name, 'topic', 'event.*');
      broker.bindQueue(queue.name, 'topic', 'load.*');

      expect(topic.bindingsCount).to.equal(2);

      broker.publish('topic', 'event.1');
      broker.publish('topic', 'load.1');

      expect(queue.length).to.equal(2);
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

      expect(queue.length).to.equal(2);

      broker.unbindQueue(queue.name, 'topic', '#');

      expect(topic.bindingsCount).to.equal(0);
      expect(direct.bindingsCount).to.equal(1);
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

      expect(queue.length).to.equal(2);

      broker.deleteQueue(queue.name);

      expect(topic.bindingsCount).to.equal(0);
      expect(direct.bindingsCount).to.equal(0);
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
      expect(topic.bindingsCount).to.equal(1);

      broker.publish('topic', 'event.2');
      broker.publish('topic', 'load.2');

      expect(queue.length).to.equal(3);
    });

    it('deleted queue is unbound from same exchange different pattern', () => {
      const broker = Broker();
      const topic = broker.assertExchange('topic', 'topic', {autoDelete: false});

      const queue = broker.assertQueue('multi');

      broker.bindQueue(queue.name, 'topic', 'event.#');
      broker.bindQueue(queue.name, 'topic', 'load.#');

      broker.publish('topic', 'event.1');
      broker.publish('topic', 'load.1');

      expect(queue.length).to.equal(2);

      broker.deleteQueue(queue.name);

      expect(topic.bindingsCount).to.equal(0);
    });

    it('returns consumer before consuming message', () => {
      const broker = Broker();
      const queue = broker.assertQueue('test-q');

      queue.queueMessage(undefined, 'test.1');

      const consumer = queue.addConsumer(() => {
        expect(consumer).to.be.ok;
      });

    });
  });
});
