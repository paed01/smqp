import {Consumer} from '../../src/Consumer';
import {EventExchange} from '../../src/Exchange';
import {Queue} from '../../src/Queue';

describe('Consumer', () => {
  describe('options', () => {
    const queue = Queue();

    it('generates tag if not passed', () => {
      const consumer = Consumer(queue);
      expect(consumer).to.have.property('consumerTag').that.is.ok;
    });

    it('default prefetch to 1', () => {
      const consumer = Consumer(queue);
      expect(consumer).to.have.property('options');
      expect(consumer.options).to.have.property('prefetch', 1);
    });

    it('default noAck to false', () => {
      const consumer = Consumer(queue);
      expect(consumer).to.have.property('options');
      expect(consumer.options).to.have.property('noAck', false);
    });

    it('extends options with consumerTag', () => {
      const consumer = Consumer(queue, null, {prefetch: 2});
      expect(consumer).to.have.property('options');
      expect(consumer.options).to.have.property('consumerTag').that.is.ok;
      expect(consumer.options).to.have.property('prefetch', 2);
    });
  });

  describe('consume()', () => {
    it('consumes pending message in queue', () => {
      const messages = [];

      const queue = Queue(null, {}, EventExchange());
      queue.queueMessage({routingKey: 'test.1'});

      const consumer = Consumer(queue, onMessage);
      consumer.consume();

      expect(messages).to.have.length(1);
      expect(messages[0].fields).to.have.property('routingKey', 'test.1');

      function onMessage(routingKey, msg) {
        expect(routingKey).to.equal('test.1');
        messages.push(msg);
      }
    });

    it('consumes queued messages in queue', () => {
      const messages = [];

      const queue = Queue(null, {}, EventExchange());
      queue.queueMessage({routingKey: 'test.1'});

      const consumer = Consumer(queue, onMessage);
      consumer.consume();

      queue.queueMessage({routingKey: 'test.2'});

      expect(messages).to.have.length(2);
      expect(messages[0].fields).to.have.property('routingKey', 'test.1');
      expect(messages[1].fields).to.have.property('routingKey', 'test.2');

      expect(queue).to.have.property('messageCount', 0);

      function onMessage(routingKey, msg) {
        if (messages.find((m) => m.fields.routingKey === msg.fields.routingKey)) throw new Error('Circuitbreaker');
        messages.push(msg);
        msg.ack();
      }
    });

    it('returns owner in message callback', () => {
      const messages = [];

      const queue = Queue();
      queue.queueMessage({routingKey: 'test.1'});

      const owner = {};
      const consumer = Consumer(queue, onMessage, null, owner);
      consumer.consume();

      expect(messages).to.have.length(1);
      expect(messages[0] === owner).to.be.true;

      function onMessage(routingKey, msg, ownedBy) {
        messages.push(ownedBy);
      }
    });

    it('prefetch n consumes n messages', () => {
      const messages = [];

      const queue = Queue();
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});

      const consumer = Consumer(queue, onMessage, {prefetch: 2});
      consumer.consume();

      expect(messages).to.have.length(2);

      function onMessage(routingKey, msg) {
        messages.push(msg);
      }
    });

    it('prefetch n consumes no more than n messages at a time', () => {
      const messages = [];

      const queue = Queue();
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});
      queue.queueMessage({routingKey: 'test.3'});
      queue.queueMessage({routingKey: 'test.4'});

      const consumer = Consumer(queue, onMessage, {prefetch: 2});
      consumer.consume();

      expect(messages).to.have.length(2);

      messages[0].ack();

      expect(messages).to.have.length(2);

      function onMessage(routingKey, msg) {
        messages.push(msg);
      }
    });

    it('consumes new messages when all has been acked', () => {
      const messages = [];

      const queue = Queue();
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});
      queue.queueMessage({routingKey: 'test.3'});
      queue.queueMessage({routingKey: 'test.4'});

      const consumer = Consumer(queue, onMessage, {prefetch: 2});
      consumer.consume();

      expect(messages).to.have.length(2);

      messages[0].ack();
      messages[1].ack();

      expect(messages).to.have.length(4);

      function onMessage(routingKey, msg) {
        messages.push(msg);
      }
    });
  });

  describe('noAck', () => {
    it('defaults to false', () => {
      const queue = Queue();
      queue.queueMessage({routingKey: 'test.1'});

      const consumer = Consumer(queue, () => {});
      expect(consumer.options).to.have.property('noAck', false);
    });

    it('consumes pending message in queue', () => {
      const messages = [];

      const queue = Queue();
      queue.queueMessage({routingKey: 'test.1'});

      const consumer = Consumer(queue, onMessage, {noAck: true});
      consumer.consume();

      expect(messages).to.have.length(1);
      expect(messages[0].fields).to.have.property('routingKey', 'test.1');
      expect(queue.messageCount, 'queue messages').to.equal(0);

      function onMessage(routingKey, msg) {
        expect(routingKey).to.equal('test.1');
        messages.push(msg);
      }
    });

    it('consumes queued messages in queue', () => {
      const messages = [];

      const queue = Queue();
      queue.queueMessage({routingKey: 'test.1'});

      const consumer = Consumer(queue, onMessage, {noAck: true});
      consumer.consume();

      queue.queueMessage({routingKey: 'test.2'});

      expect(messages).to.have.length(2);
      expect(messages[0].fields).to.have.property('routingKey', 'test.1');
      expect(messages[1].fields).to.have.property('routingKey', 'test.2');

      expect(queue).to.have.property('messageCount', 0);

      function onMessage(routingKey, msg) {
        if (messages.find((m) => m.fields.routingKey === msg.fields.routingKey)) throw new Error('Circuitbreaker');
        messages.push(msg);
        msg.ack();
      }
    });

    it('prefetch n consumes max n messages at a time', () => {
      const messages = [];

      const queue = Queue();
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});
      queue.queueMessage({routingKey: 'test.3'});
      queue.queueMessage({routingKey: 'test.4'});

      const consumer = Consumer(queue, onMessage, {prefetch: 2, noAck: true});
      consumer.consume();

      queue.queueMessage({routingKey: 'test.5'});

      expect(messages).to.have.length(5);

      function onMessage(routingKey, msg) {
        if (routingKey === 'test.2') expect(messages.length).to.equal(2);
        messages.push(msg);
      }
    });
  });

  describe('cancel()', () => {
    it('stops consuming messages from queue', () => {
      const messages = [];

      const queue = Queue();
      queue.queueMessage({routingKey: 'test.1'});

      const consumer = Consumer(queue, onMessage);
      consumer.consume();

      consumer.cancel();

      queue.queueMessage({routingKey: 'test.2'});

      expect(messages).to.have.length(1);
      expect(messages[0].fields).to.have.property('routingKey', 'test.1');

      function onMessage(routingKey, msg) {
        expect(routingKey).to.equal('test.1');
        messages.push(msg);
      }
    });

    it('returns message to queue', () => {
      const messages = [];

      const queue = Queue();
      queue.queueMessage({routingKey: 'test.1'});

      const consumer = Consumer(queue, onMessage, {consumerTag: 'test-consumer'});
      consumer.consume();

      consumer.cancel();

      queue.queueMessage({routingKey: 'test.2'});

      expect(queue).to.have.property('messageCount', 2);

      function onMessage(routingKey, msg) {
        messages.push(msg);
      }
    });

    it('resets message consumerTag', () => {
      const queue = Queue();
      queue.queueMessage({routingKey: 'test.1'});

      const consumer = Consumer(queue, onMessage, {consumerTag: 'test-consumer'});
      consumer.consume();

      consumer.cancel();

      const msg = queue.peek();
      expect(msg).to.have.property('fields');
      expect(msg.fields.consumerTag).to.be.undefined;

      function onMessage(_, message) {
        expect(message).to.have.property('fields');
        expect(message.fields.consumerTag).to.equal('test-consumer');
      }
    });
  });

  describe('ackAll()', () => {
    it('acks all consumed messages', () => {
      const queue = Queue();
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});

      const consumer = Consumer(queue, onMessage, {prefetch: 2});
      consumer.consume();

      expect(consumer.messageCount).to.equal(2);

      consumer.ackAll();

      expect(consumer.messageCount).to.equal(0);
      expect(queue.messageCount).to.equal(0);

      function onMessage() {}
    });
  });

  describe('nackAll()', () => {
    it('requeues all consumed messages', () => {
      const queue = Queue();
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});

      const consumer = Consumer(queue, onMessage, {prefetch: 2});
      consumer.consume();

      expect(consumer.messageCount).to.equal(2);

      consumer.nackAll();

      expect(queue.messageCount, 'queue messageCount').to.equal(2);

      function onMessage() {}
    });

    it('removes all consumed messages if called with falsey requeue', () => {
      const queue = Queue();
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});

      const consumer = Consumer(queue, onMessage, {prefetch: 2});
      consumer.consume();

      expect(consumer.messageCount).to.equal(2);

      consumer.nackAll(false);

      expect(queue.messageCount, 'queue messageCount').to.equal(0);

      function onMessage() {}
    });
  });

  describe('queue', () => {
    it('ack queued pending message removes message from consumer', () => {
      const queue = Queue();
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});

      const consumer = Consumer(queue, onMessage, {prefetch: 2});
      consumer.consume();

      expect(consumer.messageCount).to.equal(2);
      expect(queue.messageCount).to.equal(2);

      queue.peek(false).ack();

      expect(queue.messageCount, 'queue messageCount').to.equal(1);
      expect(consumer.messageCount, 'consumer messageCount').to.equal(1);

      function onMessage() {}
    });
  });
});
