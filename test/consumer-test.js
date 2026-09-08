import { Broker, Queue, Consumer } from 'smqp';

describe('consumer', () => {
  describe('noAck', () => {
    it('noAck option consumes message immediately', () => {
      const broker = Broker();

      broker.assertExchange('test', 'topic');

      broker.subscribe('test', 'test.#', 'persist', onMessageAck);
      broker.subscribeTmp('test', '#', onMessage, { noAck: true });

      const ackMessages = [];
      const messages = [];

      broker.publish('test', 'tst', { msg: 1 });
      broker.publish('test', 'test.1', { msg: 2 });
      broker.publish('test', 'test.2', { msg: 3 });

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

    it('noAck removes message from queue before message callback', () => {
      const broker = Broker();

      const queue = broker.assertQueue('event-q');
      broker.consume(queue.name, onMessage, { noAck: true });

      queue.queueMessage({ routingKey: 'test' });

      expect(queue.messageCount).to.equal(0);

      function onMessage() {
        expect(queue.messageCount).to.equal(0);
      }
    });

    it('noAck removes message from queue if error is thrown in message callback', () => {
      const broker = Broker();

      const queue = broker.assertQueue('event-q');

      const consumer = broker.consume(queue.name, onMessage, { noAck: true });

      expect(() => queue.queueMessage({ routingKey: 'test' })).to.throw('Provoke');

      expect(queue.messageCount, 'message count').to.equal(0);
      expect(queue.consumerCount, 'consumer count').to.equal(1);
      expect(consumer.ready, 'consumer ready').to.be.true;

      expect(() => queue.queueMessage({ routingKey: 'test' })).to.throw('Provoke');

      expect(queue.messageCount, 'message count').to.equal(0);
      expect(queue.consumerCount, 'consumer count').to.equal(1);
      expect(consumer.ready, 'consumer ready').to.be.true;

      expect(() => queue.queueMessage({ routingKey: 'test' })).to.throw('Provoke');

      expect(queue.messageCount, 'message count').to.equal(0);
      expect(queue.consumerCount, 'consumer count').to.equal(1);
      expect(consumer.ready, 'consumer ready').to.be.true;

      function onMessage() {
        throw new Error('Provoke');
      }
    });

    it('noAck option removes message from queue if error is thrown in message callback', () => {
      const broker = Broker();

      const queue = broker.assertQueue('event-q');

      const consumer = broker.consume(queue.name, onMessage, { noAck: true });

      expect(() => queue.queueMessage({ routingKey: 'test' })).to.throw('Provoke');

      expect(queue.messageCount, 'message count').to.equal(0);
      expect(queue.consumerCount, 'consumer count').to.equal(1);
      expect(consumer.ready, 'consumer ready').to.be.true;

      expect(() => queue.queueMessage({ routingKey: 'test' })).to.throw('Provoke');

      expect(queue.messageCount, 'message count').to.equal(0);
      expect(queue.consumerCount, 'consumer count').to.equal(1);
      expect(consumer.ready, 'consumer ready').to.be.true;

      expect(() => queue.queueMessage({ routingKey: 'test' })).to.throw('Provoke');

      expect(queue.messageCount, 'message count').to.equal(0);
      expect(queue.consumerCount, 'consumer count').to.equal(1);
      expect(consumer.ready, 'consumer ready').to.be.true;

      function onMessage() {
        throw new Error('Provoke');
      }
    });

    it('noAck removes message from queue if error is thrown in second message callback', () => {
      const broker = Broker();
      const messages = [];

      const queue = broker.assertQueue('event-q');

      const consumer = broker.consume(queue.name, onMessage, { noAck: true });

      queue.queueMessage({ routingKey: 'test' });

      expect(messages, 'recieved count').to.have.length(1);
      expect(queue.messageCount, 'message count').to.equal(0);
      expect(queue.consumerCount, 'consumer count').to.equal(1);
      expect(consumer.ready, 'consumer ready').to.be.true;

      expect(() => queue.queueMessage({ routingKey: 'test' })).to.throw('Provoke');

      expect(messages, 'recieved count').to.have.length(2);
      expect(queue.messageCount, 'message count').to.equal(0);
      expect(queue.consumerCount, 'consumer count').to.equal(1);
      expect(consumer.ready, 'consumer ready').to.be.true;

      queue.queueMessage({ routingKey: 'test' });

      expect(messages, 'recieved count').to.have.length(3);
      expect(queue.messageCount, 'message count').to.equal(0);
      expect(queue.consumerCount, 'consumer count').to.equal(1);
      expect(consumer.ready, 'consumer ready').to.be.true;

      function onMessage(_, msg) {
        const count = messages.push(msg);
        if (count === 2) throw new Error('Provoke');
      }
    });
  });

  describe('ack', () => {
    it('consumer stops consuming if error is thrown in message callback before message was acked', () => {
      const broker = Broker();

      const queue = broker.assertQueue('event-q');

      const consumer = broker.consume(queue.name, onMessage);

      expect(() => queue.queueMessage({ routingKey: 'test' })).to.throw('Provoke');

      expect(queue.messageCount, 'message count').to.equal(1);
      expect(queue.consumerCount, 'consumer count').to.equal(1);
      expect(consumer.ready, 'consumer ready').to.be.false;

      function onMessage() {
        throw new Error('Provoke');
      }
    });

    it('consumer continues consuming if error is thrown in message callback after message was acked', () => {
      const broker = Broker();
      const messages = [];

      const queue = broker.assertQueue('event-q');

      const consumer = broker.consume(queue.name, onMessage);

      queue.queueMessage({ routingKey: 'test' });

      expect(messages, 'recieved count').to.have.length(1);
      expect(queue.messageCount, 'message count').to.equal(0);
      expect(queue.consumerCount, 'consumer count').to.equal(1);
      expect(consumer.ready, 'consumer ready').to.be.true;

      expect(() => queue.queueMessage({ routingKey: 'test' })).to.throw('Provoke');

      expect(messages, 'recieved count').to.have.length(2);
      expect(queue.messageCount, 'message count').to.equal(0);
      expect(queue.consumerCount, 'consumer count').to.equal(1);
      expect(consumer.ready, 'consumer ready').to.be.true;

      queue.queueMessage({ routingKey: 'test' });

      expect(messages, 'recieved count').to.have.length(3);
      expect(queue.messageCount, 'message count').to.equal(0);
      expect(queue.consumerCount, 'consumer count').to.equal(1);
      expect(consumer.ready, 'consumer ready').to.be.true;

      function onMessage(_, msg) {
        const count = messages.push(msg);
        msg.ack();
        if (count === 2) throw new Error('Provoke');
      }
    });
  });

  describe('events', () => {
    it('emits cancel when canceled by self', (done) => {
      const broker = Broker();

      const queue = broker.assertQueue('event-q');
      const consumer = broker.consume(queue.name, onMessage, { noAck: true });

      queue.queueMessage({ routingKey: 'test' });

      consumer.on('cancel', () => {
        expect(queue.messageCount).to.equal(0);
        done();
      });

      consumer.cancel();

      function onMessage() {
        expect(queue.messageCount).to.equal(0);
      }
    });

    it('emits cancel when canceled by queue', (done) => {
      const broker = Broker();

      const queue = broker.assertQueue('event-q');
      const consumer = broker.consume(queue.name, onMessage, { noAck: true, consumerTag: '_test-tag' });

      queue.queueMessage({ routingKey: 'test' });

      consumer.on('cancel', () => {
        expect(queue.messageCount).to.equal(0);
        done();
      });

      queue.cancel('_test-tag');

      function onMessage() {
        expect(queue.messageCount).to.equal(0);
      }
    });

    it('cancel of another consumer on the same queue does not trigger handler', () => {
      const broker = Broker();
      const queue = broker.assertQueue('event-q', { autoDelete: false });

      const mine = broker.consume(queue.name, () => {}, { consumerTag: 'mine' });
      broker.consume(queue.name, () => {}, { consumerTag: 'other' });

      const seen = [];
      mine.on('cancel', (_, msg) => seen.push(msg.content.consumerTag));

      broker.cancel('other');
      expect(seen).to.deep.equal([]);

      broker.cancel('mine');
      expect(seen).to.deep.equal(['mine']);
    });

    it('on returns event consumer that can be cancelled to unsubscribe', () => {
      const broker = Broker();
      const queue = broker.assertQueue('event-q', { autoDelete: false });
      const consumer = broker.consume(queue.name, () => {}, { consumerTag: 'mine' });

      const seen = [];
      const subscription = consumer.on('cancel', () => seen.push('cancel'));
      subscription.cancel();

      consumer.cancel();
      expect(seen).to.deep.equal([]);
    });

    it('consumer has no emit', () => {
      const broker = Broker();
      broker.assertQueue('event-q');
      const consumer = broker.consume('event-q', () => {});
      expect(consumer).to.not.have.property('emit');
    });

    it('emits cancel when unbound by queue', (done) => {
      const broker = Broker();

      const queue = broker.assertQueue('event-q');
      const consumer = broker.consume(queue.name, onMessage, { noAck: true, consumerTag: '_test-tag' });

      queue.queueMessage({ routingKey: 'test' });

      consumer.on('cancel', () => {
        expect(queue.messageCount).to.equal(0);
        done();
      });

      queue.unbindConsumer(consumer);

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
      broker.subscribe('test', 'test.#', 'test', onMessage, { prefetch: 2 });

      broker.publish('test', 'test.message', 'test.1.3');

      expect(messages).to.have.length(5);
      expect(messages.map(({ content }) => content)).to.eql(['test.1.1', 'test.2.1', 'test.1.2', 'test.2.2', 'test.1.3']);

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
      broker.subscribe('test', 'test.#', 'test-q', onMessage, { prefetch: 2 });

      broker.publish('test', 'test.1.1', null, { correlationId: 1 });
      broker.publish('test', 'test.2.1', null, { correlationId: 1 });
      broker.publish('test', 'test.1.2', null, { correlationId: 2 });
      broker.publish('test', 'test.2.2', null, { correlationId: 2 });
      broker.publish('test', 'test.1.3', null, { correlationId: 3 });

      function cb() {
        expect(messages).to.have.length(5);
        expect(messages.map(({ fields }) => fields.routingKey)).to.eql(['test.1.1', 'test.2.1', 'test.1.2', 'test.2.2', 'test.1.3']);
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

      broker.publish('test', 'test.1.1', null, { correlationId: 1 });
      broker.publish('test', 'test.2.1', null, { correlationId: 1 });
      broker.publish('test', 'test.1.2', null, { correlationId: 2 });
      broker.publish('test', 'test.2.2', null, { correlationId: 2 });
      broker.publish('test', 'test.1.3', null, { correlationId: 3 });

      function cb() {
        expect(messages).to.have.length(5);
        expect(messages.map(({ fields }) => fields.routingKey)).to.eql(['test.1.1', 'test.2.1', 'test.1.2', 'test.2.2', 'test.1.3']);
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
      broker.consume('event-q', onMessage, { prefetch: 10, consumerTag: 'test-prefetch' });

      expect(messages).to.eql(['event.1', 'event.2', 'event.3']);

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

  describe('prefetch(value) after messages are held', () => {
    it('lowering prefetch below held count clamps capacity to zero and stops delivery until held drops below it', () => {
      const queue = new Queue('test-q');
      const held = [];
      const consumer = queue.consume((_, msg) => held.push(msg), { prefetch: 5 });

      queue.queueMessage({});
      queue.queueMessage({});
      expect(held).to.have.length(2);

      consumer.prefetch(1);

      expect(consumer).to.have.property('capacity', 0);
      expect(consumer).to.have.property('ready', false);

      for (let i = 0; i < 5; i++) queue.queueMessage({});

      expect(held).to.have.length(2);
      expect(consumer).to.have.property('messageCount', 2);
      expect(queue).to.have.property('messageCount', 7);

      held.shift().ack();
      expect(held).to.have.length(1);
      expect(consumer).to.have.property('messageCount', 1);

      held.shift().ack();
      expect(held).to.have.length(1);
      expect(consumer).to.have.property('messageCount', 1);
      expect(consumer).to.have.property('capacity', 0);
    });

    it('raising prefetch while saturated resumes delivery immediately', () => {
      const queue = new Queue('test-q');
      const held = [];
      const consumer = queue.consume((_, msg) => held.push(msg), { prefetch: 2 });

      for (let i = 0; i < 5; i++) queue.queueMessage({});
      expect(held).to.have.length(2);
      expect(consumer).to.have.property('ready', false);

      consumer.prefetch(4);

      expect(held).to.have.length(4);
      expect(consumer).to.have.property('ready', false);
      expect(consumer).to.have.property('capacity', 0);

      held[0].ack();
      expect(held).to.have.length(5);
      expect(consumer).to.have.property('messageCount', 4);
    });

    it('raising prefetch on a saturated consumer with an empty queue makes it ready', () => {
      const queue = new Queue('test-q');
      const consumer = queue.consume(() => {}, { prefetch: 1 });
      queue.queueMessage({});
      expect(consumer).to.have.property('ready', false);

      consumer.prefetch(2);

      expect(consumer).to.have.property('ready', true);
      expect(consumer).to.have.property('capacity', 1);
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

      const consumer = queue.consume(() => {}, { consumerTag: 'test-tag', prefetch: 2 });
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

      const consumer = queue.consume(() => {}, { consumerTag: 'test-tag', prefetch: 2 });
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

      const consumer = queue.consume(() => {}, { consumerTag: 'test-tag', prefetch: 2 });
      consumer.nackAll(true);

      expect(queue.messageCount).to.equal(4);
    });
  });

  describe('consumer capacity hook', () => {
    it('throws TypeError if capacity option is not a function', () => {
      const queue = new Queue();
      expect(() => queue.consume(() => {}, { capacity: 3 })).to.throw(TypeError, /capacity/);
    });

    it('consumer is still an instance of Consumer', () => {
      const queue = new Queue();
      const consumer = queue.consume(() => {}, { capacity: () => 1 });
      expect(consumer).to.be.instanceof(Consumer);
      expect(consumer.options).to.have.property('prefetch', 1);
    });

    it('limits delivery to the credit returned by the hook', () => {
      const queue = new Queue();
      const messages = [];
      let credit = 2;

      const consumer = queue.consume(onMessage, { prefetch: 10, capacity: () => credit });

      queue.queueMessage({});
      queue.queueMessage({});
      queue.queueMessage({});

      expect(messages).to.have.length(2);
      expect(credit).to.equal(0);
      expect(consumer).to.have.property('messageCount', 2);
      expect(queue).to.have.property('messageCount', 3);

      function onMessage(_, msg) {
        credit--;
        messages.push(msg);
      }
    });

    it('capacity is the lesser of credit and prefetch capacity', () => {
      const queue = new Queue();
      let credit = 5;
      const consumer = queue.consume(() => {}, { prefetch: 2, capacity: () => credit });

      expect(consumer).to.have.property('capacity', 2);

      credit = 1;
      expect(consumer).to.have.property('capacity', 1);

      credit = -1;
      expect(consumer).to.have.property('capacity', 0);
    });

    it('delivers already queued messages up to credit when consumed', () => {
      const queue = new Queue();
      queue.queueMessage({});
      queue.queueMessage({});
      queue.queueMessage({});

      const messages = [];
      queue.consume((_, msg) => messages.push(msg), { prefetch: 10, capacity: () => 1 });

      expect(messages).to.have.length(1);
    });

    it('consumer with zero credit is not ready and other consumers get the messages', () => {
      const queue = new Queue();
      const first = [];
      const second = [];

      const credited = queue.consume((_, msg) => first.push(msg), { priority: 10, prefetch: 10, capacity: () => 0 });
      queue.consume((_, msg) => second.push(msg), { prefetch: 10 });

      queue.queueMessage({});
      queue.queueMessage({});

      expect(credited).to.have.property('ready', false);
      expect(first).to.have.length(0);
      expect(second).to.have.length(2);
    });

    it('queue.consumeNext() delivers pending messages when credit is raised', () => {
      const queue = new Queue();
      const messages = [];
      let credit = 0;

      const consumer = queue.consume(onMessage, { prefetch: 10, capacity: () => credit });

      queue.queueMessage({});
      queue.queueMessage({});
      queue.queueMessage({});

      expect(messages).to.have.length(0);
      expect(consumer).to.have.property('ready', false);

      credit = 2;
      expect(consumer).to.have.property('ready', true);
      expect(queue.consumeNext()).to.equal(2);
      expect(messages).to.have.length(2);

      expect(queue.consumeNext()).to.equal(0);

      messages[0].ack();
      expect(messages).to.have.length(2);

      credit = 10;
      expect(queue.consumeNext()).to.equal(1);
      expect(messages).to.have.length(3);
      expect(credit).to.equal(9);

      function onMessage(_, msg) {
        credit--;
        messages.push(msg);
      }
    });

    it('acking does not deliver more than credit allows', () => {
      const queue = new Queue();
      const messages = [];
      let credit = 1;

      queue.consume(onMessage, { prefetch: 10, capacity: () => credit });

      queue.queueMessage({});
      queue.queueMessage({});

      expect(messages).to.have.length(1);
      expect(credit).to.equal(0);

      messages[0].ack();

      expect(messages).to.have.length(1);

      function onMessage(_, msg) {
        credit--;
        messages.push(msg);
      }
    });

    it('works through broker.consume', () => {
      const broker = new Broker();
      broker.assertQueue('credit-q');
      broker.sendToQueue('credit-q', 'a');
      broker.sendToQueue('credit-q', 'b');

      const messages = [];
      broker.consume('credit-q', (_, msg) => messages.push(msg), { prefetch: 10, capacity: () => 1 });

      expect(messages).to.have.length(1);
      expect(broker.getQueue('credit-q')).to.have.property('messageCount', 2);
    });
  });

  describe('cancel with options', () => {
    describe('keepPending', () => {
      it('queue.cancel(consumerTag, { keepPending: true }) leaves held messages pending on queue', () => {
        const queue = new Queue('test-q');
        const messages = [];
        queue.consume((_, msg) => messages.push(msg), { consumerTag: 'held', prefetch: 2 });

        queue.queueMessage({ routingKey: 'a' });
        queue.queueMessage({ routingKey: 'b' });
        queue.queueMessage({ routingKey: 'c' });

        expect(messages).to.have.length(2);

        expect(queue.cancel('held', { keepPending: true })).to.be.true;

        expect(queue).to.have.property('consumerCount', 0);
        expect(queue).to.have.property('messageCount', 3);
        expect(queue.getStats()).to.have.property('unackedCount', 2);
        expect(messages[0]).to.have.property('pending', true);
        expect(messages[1]).to.have.property('pending', true);
        expect(queue.peek(true)).to.have.property('fields').with.property('routingKey', 'c');
      });

      it('kept messages are not redelivered to a new consumer', () => {
        const queue = new Queue('test-q');
        queue.consume(() => {}, { consumerTag: 'held', prefetch: 2 });
        queue.queueMessage({ routingKey: 'a' });
        queue.queueMessage({ routingKey: 'b' });
        queue.queueMessage({ routingKey: 'c' });

        queue.cancel('held', { keepPending: true });

        const messages = [];
        queue.consume((_, msg) => messages.push(msg), { prefetch: 10 });

        expect(messages.map((m) => m.fields.routingKey)).to.deep.equal(['c']);
      });

      it('kept messages can be acked through queue and message', () => {
        const queue = new Queue('test-q');
        const messages = [];
        queue.consume((_, msg) => messages.push(msg), { consumerTag: 'held', prefetch: 2 });
        queue.queueMessage({ routingKey: 'a' });
        queue.queueMessage({ routingKey: 'b' });

        queue.cancel('held', { keepPending: true });

        queue.ack(messages[0]);
        expect(queue).to.have.property('messageCount', 1);

        messages[1].ack();
        expect(queue).to.have.property('messageCount', 0);
        expect(queue.getStats()).to.have.property('unackedCount', 0);
      });

      it('kept message nacked with requeue is delivered to next consumer', () => {
        const queue = new Queue('test-q');
        const held = [];
        queue.consume((_, msg) => held.push(msg), { consumerTag: 'held' });
        queue.queueMessage({ routingKey: 'a' });

        queue.cancel('held', { keepPending: true });

        const messages = [];
        queue.consume((_, msg) => messages.push(msg));
        expect(messages).to.have.length(0);

        held[0].nack(false, true);

        expect(messages).to.have.length(1);
        expect(messages[0].fields).to.have.property('redelivered', true);
      });

      it('kept message nacked without requeue is dead lettered', () => {
        const broker = new Broker();
        broker.assertExchange('dlx');
        const dlq = broker.assertQueue('dlq');
        broker.bindQueue('dlq', 'dlx', '#');
        broker.assertQueue('test-q', { deadLetterExchange: 'dlx', autoDelete: false });
        broker.sendToQueue('test-q', 'payload');

        const held = [];
        broker.consume('test-q', (_, msg) => held.push(msg), { consumerTag: 'held' });
        broker.cancel('held', { keepPending: true });

        held[0].nack(false, false);

        expect(dlq).to.have.property('messageCount', 1);
        expect(broker.getQueue('test-q')).to.have.property('messageCount', 0);
      });

      it('consumer.cancel({ keepPending: true }) keeps messages pending and emits consumer.cancel', () => {
        const broker = new Broker();
        const queue = broker.assertQueue('test-q', { autoDelete: false });
        const cancelled = [];
        queue.on('consumer.cancel', (_, msg) => cancelled.push(msg.content));

        const consumer = queue.consume(() => {}, { consumerTag: 'held' });
        queue.queueMessage({});

        consumer.cancel({ keepPending: true });

        expect(cancelled).to.have.length(1);
        expect(queue).to.have.property('consumerCount', 0);
        expect(queue.getStats()).to.have.property('unackedCount', 1);
      });

      it('broker.cancel(consumerTag, { keepPending: true }) removes consumer and keeps messages pending', () => {
        const broker = new Broker();
        broker.assertQueue('test-q', { autoDelete: false });
        broker.sendToQueue('test-q', 'a');

        broker.consume('test-q', () => {}, { consumerTag: 'held' });
        expect(broker.cancel('held', { keepPending: true })).to.be.true;

        expect(broker.getConsumer('held')).to.be.undefined;
        expect(broker.getQueue('test-q').getStats()).to.deep.include({ messageCount: 1, unackedCount: 1 });
      });

      it('queue.dismiss(onMessage, { keepPending: true }) keeps messages pending', () => {
        const queue = new Queue('test-q');
        queue.consume(onMessage);
        queue.queueMessage({});

        queue.dismiss(onMessage, { keepPending: true });

        expect(queue).to.have.property('consumerCount', 0);
        expect(queue.getStats()).to.have.property('unackedCount', 1);

        function onMessage() {}
      });

      it('queue.unbindConsumer(consumer, { keepPending: true }) keeps messages pending', () => {
        const queue = new Queue('test-q');
        const consumer = queue.consume(() => {});
        queue.queueMessage({});

        queue.unbindConsumer(consumer, { keepPending: true });

        expect(queue).to.have.property('consumerCount', 0);
        expect(queue.getStats()).to.have.property('unackedCount', 1);
      });

      it('autoDelete queue is still deleted when last consumer is cancelled with keepPending', () => {
        const broker = new Broker();
        broker.assertQueue('test-q');
        broker.sendToQueue('test-q', 'a');
        broker.consume('test-q', () => {}, { consumerTag: 'held' });

        broker.cancel('held', { keepPending: true });

        expect(broker.getQueue('test-q')).to.be.undefined;
      });

      it('keepPending: false with requeue: false nacks held messages', () => {
        const queue = new Queue('test-q');
        queue.consume(() => {}, { consumerTag: 'held' });
        queue.queueMessage({});

        queue.cancel('held', { keepPending: false, requeue: false });

        expect(queue).to.have.property('messageCount', 0);
      });
    });

    describe('requeue', () => {
      it('{ requeue: true } requeues held messages', () => {
        const queue = new Queue('test-q');
        queue.consume(() => {}, { consumerTag: 'held' });
        queue.queueMessage({});

        queue.cancel('held', { requeue: true });

        expect(queue.getStats()).to.deep.include({ messageCount: 1, unackedCount: 0 });
      });

      it('{ requeue: false } nacks held messages without requeue', () => {
        const queue = new Queue('test-q');
        queue.consume(() => {}, { consumerTag: 'held' });
        queue.queueMessage({});

        queue.cancel('held', { requeue: false });

        expect(queue).to.have.property('messageCount', 0);
      });

      it('empty options object defaults to requeue', () => {
        const queue = new Queue('test-q');
        const consumer = queue.consume(() => {});
        queue.queueMessage({});

        consumer.cancel({});

        expect(queue.getStats()).to.deep.include({ messageCount: 1, unackedCount: 0 });
      });
    });
  });
});
