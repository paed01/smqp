import {Queue} from '../../src/Queue';

describe('Consumer', () => {
  describe('internal queue', () => {
    it('removes messages from internal queue when acked', () => {
      const queue = new Queue();

      const messages = [];
      const consumer = queue.consume(onMessage, {consumerTag: 'test-tag'});

      queue.queueMessage({});
      queue.queueMessage({});

      expect(messages.length).to.equal(1);

      expect(consumer).to.have.property('messageCount', 1);

      messages.pop().ack();

      expect(consumer).to.have.property('messageCount', 1);

      messages.pop().ack();

      expect(consumer).to.have.property('messageCount', 0);

      function onMessage(_, message) {
        messages.push(message);
      }
    });

    it('no ack consumer removes messages from internal queue when acked', () => {
      const queue = new Queue();

      const messages = [];
      const consumer = queue.consume(onMessage, {consumerTag: 'test-tag', noAck: true});

      queue.queueMessage({});
      queue.queueMessage({});

      expect(messages.length).to.equal(2);
      expect(consumer).to.have.property('messageCount', 0);

      function onMessage(_, message) {
        messages.push(message);
      }
    });

    it('multiple prefetch consumer removes messages from internal queue when acked', () => {
      const queue = new Queue();

      const messages = [];
      const consumer = queue.consume(onMessage, {consumerTag: 'test-tag', prefetch: 10});

      queue.queueMessage({});
      queue.queueMessage({});

      expect(messages.length).to.equal(2);

      expect(consumer).to.have.property('messageCount', 2);

      messages.pop().ack();

      expect(consumer).to.have.property('messageCount', 1);

      messages.pop().ack();

      expect(consumer).to.have.property('messageCount', 0);

      function onMessage(_, message) {
        messages.push(message);
      }
    });

    it('removes messages from internal queue when nacked', () => {
      const queue = new Queue();

      const messages = [];
      const consumer = queue.consume(onMessage, {consumerTag: 'test-tag'});

      queue.queueMessage({});

      expect(messages.length).to.equal(1);
      expect(consumer).to.have.property('messageCount', 1);

      messages.pop().nack(false, false);

      expect(consumer).to.have.property('messageCount', 0);

      function onMessage(_, message) {
        messages.push(message);
      }
    });

    it('removes messages from internal queue when rejected', () => {
      const queue = new Queue();

      const messages = [];
      const consumer = queue.consume(onMessage, {consumerTag: 'test-tag'});

      queue.queueMessage({});

      expect(messages.length).to.equal(1);
      expect(consumer).to.have.property('messageCount', 1);

      messages.pop().reject(false);

      expect(consumer).to.have.property('messageCount', 0);

      function onMessage(_, message) {
        messages.push(message);
      }
    });
  });
});
