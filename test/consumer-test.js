import {Broker} from '../index';

describe('consumer', () => {
  describe('noAck', () => {
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
      expect(messages[0].fields).to.have.property('routingKey', 'tst');
      expect(messages[1].fields).to.have.property('routingKey', 'test.1');
      expect(messages[2].fields).to.have.property('routingKey', 'test.2');

      expect(ackMessages).to.have.length(1);
      expect(ackMessages[0].fields).to.have.property('routingKey', 'test.1');

      function onMessage(routingKey, message) {
        messages.push(message);
      }

      function onMessageAck(routingKey, message) {
        ackMessages.push(message);
      }
    });

    it('noAck option consumes removes message from queue before message callback', () => {
      const broker = Broker();

      const queue = broker.assertQueue('event-q');
      broker.consume(queue.name, onMessage, {noAck: true});

      queue.queueMessage('test');

      expect(queue.messageCount).to.equal(0);

      function onMessage() {
        expect(queue.messageCount).to.equal(0);
      }
    });
  });

  describe('events', () => {
    it('emits cancel when canceled', (done) => {
      const broker = Broker();

      const queue = broker.assertQueue('event-q');
      const consumer = broker.consume(queue.name, onMessage, {noAck: true});

      queue.queueMessage('test');

      consumer.on('cancel', () => {
        expect(queue.messageCount).to.equal(0);
        done();
      });

      consumer.cancel();

      function onMessage() {
        expect(queue.messageCount).to.equal(0);
      }
    });
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

      broker.publish('test', 'test.message', 'test.1.3');

      expect(messages).to.have.length(5);
      expect(messages.map(({content}) => content)).to.eql(['test.1.1', 'test.2.1', 'test.1.2', 'test.2.2', 'test.1.3']);

      function onMessage(_, message) {
        messages.push(message);

        if (!(messages.length % 2)) {
          messages.slice(-2).forEach((msg) => msg.ack());
        }
      }
    });

    it('prefetch 2 takes two published messages at a time', (done) => {
      const broker = Broker();

      broker.assertQueue('test');

      const messages = [];
      broker.subscribe('test', 'test.#', 'test-q', onMessage, {prefetch: 2});

      broker.publish('test', 'test.1.1', null, {correlationId: 1});
      broker.publish('test', 'test.2.1', null, {correlationId: 1});
      broker.publish('test', 'test.1.2', null, {correlationId: 2});
      broker.publish('test', 'test.2.2', null, {correlationId: 2});
      broker.publish('test', 'test.1.3', null, {correlationId: 3});

      function cb() {
        expect(messages).to.have.length(5);
        expect(messages.map(({fields}) => fields.routingKey)).to.eql(['test.1.1', 'test.2.1', 'test.1.2', 'test.2.2', 'test.1.3']);
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

    it('consumer.prefetch(2) takes two published messages at a time', (done) => {
      const broker = Broker();

      broker.assertQueue('test');

      const messages = [];
      const consumer = broker.subscribe('test', 'test.#', 'test-q', onMessage);
      consumer.prefetch(2);

      broker.publish('test', 'test.1.1', null, {correlationId: 1});
      broker.publish('test', 'test.2.1', null, {correlationId: 1});
      broker.publish('test', 'test.1.2', null, {correlationId: 2});
      broker.publish('test', 'test.2.2', null, {correlationId: 2});
      broker.publish('test', 'test.1.3', null, {correlationId: 3});

      function cb() {
        expect(messages).to.have.length(5);
        expect(messages.map(({fields}) => fields.routingKey)).to.eql(['test.1.1', 'test.2.1', 'test.1.2', 'test.2.2', 'test.1.3']);
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

    it('high prefetch consumes messages in sequence even if new message is published in message callback', () => {
      const broker = Broker();

      broker.assertExchange('event');
      broker.assertQueue('event-q');
      broker.bindQueue('event-q', 'event', '#');

      broker.publish('event', 'event.1');
      broker.publish('event', 'event.2');

      const messages = [];
      broker.consume('event-q', onMessage, {prefetch: 10, consumerTag: 'test-prefetch'});

      expect(messages).to.eql([
        'event.1',
        'event.2',
        'event.3',
      ]);

      function onMessage(routingKey, message) {
        messages.push(routingKey);

        switch (routingKey) {
          case 'event.1':
            broker.publish('event', 'event.3');
            break;
        }

        message.ack();
      }
    });
  });

  describe('ackAll()', () => {
    it('removes non-acked messages from queue', () => {
      const broker = new Broker();
      const queue = broker.assertQueue('event-q');

      broker.sendToQueue('event-q', {});
      broker.sendToQueue('event-q', {});
      broker.sendToQueue('event-q', {});
      broker.sendToQueue('event-q', {});

      const consumer = queue.consume(() => {}, {consumerTag: 'test-tag', prefetch: 2});
      consumer.ackAll();

      expect(queue.messageCount).to.equal(2);
    });
  });

  describe('nackAll([requeue])', () => {
    it('with falsy requeue removes non-acked messages from queue', () => {
      const broker = new Broker();
      const queue = broker.assertQueue('event-q');

      broker.sendToQueue('event-q', {});
      broker.sendToQueue('event-q', {});
      broker.sendToQueue('event-q', {});
      broker.sendToQueue('event-q', {});

      const consumer = queue.consume(() => {}, {consumerTag: 'test-tag', prefetch: 2});
      consumer.nackAll(false);

      expect(queue.messageCount).to.equal(2);
    });

    it('with truthy requeue removes non-acked messages from queue', () => {
      const broker = new Broker();
      const queue = broker.assertQueue('event-q');

      broker.sendToQueue('event-q', {});
      broker.sendToQueue('event-q', {});
      broker.sendToQueue('event-q', {});
      broker.sendToQueue('event-q', {});

      const consumer = queue.consume(() => {}, {consumerTag: 'test-tag', prefetch: 2});
      consumer.nackAll(true);

      expect(queue.messageCount).to.equal(4);
    });
  });
});
