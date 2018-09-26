import {Queue} from '../../src/Queue';

describe('Queue', () => {
  describe('ctorish', () => {
    it('takes name', () => {
      const queue = Queue('test-q');
      expect(queue).to.have.property('name', 'test-q');
    });

    it('receives random name if not passed', () => {
      const queue = Queue();
      expect(queue).to.have.property('name').that.is.ok;
    });

    it('takes options', () => {
      const queue = Queue(null, {autoDelete: false, durable: true});
      expect(queue).to.have.property('options').that.eql({autoDelete: false, durable: true});
    });

    it('defaults to option autoDelete if not passed', () => {
      const queue = Queue();
      expect(queue).to.have.property('options').that.eql({autoDelete: true});
    });
  });

  describe('queue options', () => {
    describe('maxLength', () => {

      it('maxLength evicts old messages', () => {
        const queue = Queue(null, {maxLength: 2});
        queue.queueMessage({routingKey: 'test.1'});
        queue.queueMessage({routingKey: 'test.2'});
        queue.queueMessage({routingKey: 'test.3'});

        expect(queue.messageCount).to.equal(2);
        expect(queue.peek().fields.routingKey).to.equal('test.2');
      });

      it('emits saturated when maxLength is reached', () => {
        let triggered;
        const queue = Queue(null, {maxLength: 2}, {emit});

        queue.queueMessage({routingKey: 'test.1'});
        queue.queueMessage({routingKey: 'test.2'});

        expect(queue.messageCount).to.equal(2);
        expect(triggered).to.be.true;

        function emit(eventName) {
          if (eventName === 'queue.saturated') triggered = true;
        }
      });

      it('maxLength = 1 evicts old messages', () => {
        const queue = Queue(null, {maxLength: 1});
        queue.queueMessage({routingKey: 'test.1'});
        queue.queueMessage({routingKey: 'test.2'});
        queue.queueMessage({routingKey: 'test.3'});

        expect(queue.messageCount).to.equal(1);
        expect(queue.peek().fields.routingKey).to.equal('test.3');
      });

      it('emits saturated when maxLength = 1 is reached', () => {
        let triggered;
        const queue = Queue(null, {maxLength: 1}, {emit});

        queue.queueMessage({routingKey: 'test.1'});

        expect(queue.messageCount).to.equal(1);
        expect(triggered).to.be.true;

        function emit(eventName) {
          if (eventName === 'queue.saturated') triggered = true;
        }
      });

      it('maxLength evicts old non-pending messages', () => {
        const queue = Queue(null, {maxLength: 2});
        queue.queueMessage({routingKey: 'test.1'});

        queue.get();

        queue.queueMessage({routingKey: 'test.2'});
        queue.queueMessage({routingKey: 'test.3'});

        expect(queue.messageCount).to.equal(2);
        expect(queue.peek(true).fields.routingKey).to.equal('test.3');
      });

      it('if maxLength is reached and all messages are pending then new message is discarded', () => {
        const queue = Queue(null, {maxLength: 1});
        queue.queueMessage({routingKey: 'test.1'});

        queue.get();

        queue.queueMessage({routingKey: 'test.2'});

        expect(queue.messageCount).to.equal(1);
        expect(queue.peek().fields.routingKey).to.equal('test.1');
      });
    });

    describe('deadLetterExchange', () => {
      it('deadLetterExchange emits event with message when message is nacked', () => {
        let triggered;
        const queue = Queue(null, {deadLetterExchange: 'evict'}, {emit});
        queue.queueMessage({routingKey: 'test.1'});

        queue.get().nack(false, false);

        expect(triggered).to.be.ok;
        expect(triggered).to.have.property('deadLetterExchange', 'evict');
        expect(triggered).to.have.property('message').with.property('fields').with.property('routingKey', 'test.1');

        function emit(eventName, event) {
          if (eventName === 'queue.dead-letter') triggered = event;
        }
      });

      it('deadLetterExchange with deadLetterRoutingKey emits event with message with deadLetterRoutingKey when message is nacked', () => {
        let triggered;
        const queue = Queue(null, {deadLetterExchange: 'evict', deadLetterRoutingKey: 'evicted.message'}, {emit});
        queue.queueMessage({routingKey: 'test.1'});

        queue.get().nack(false, false);

        expect(triggered).to.be.ok;
        expect(triggered).to.have.property('deadLetterExchange', 'evict');
        expect(triggered).to.have.property('message').with.property('fields').with.property('routingKey', 'evicted.message');

        function emit(eventName, event) {
          if (eventName === 'queue.dead-letter') triggered = event;
        }
      });

      it('deadLetterExchange emits event with message when messages are evicted due to maxLength', () => {
        const triggered = [];
        const queue = Queue(null, {maxLength: 1, deadLetterExchange: 'evict'}, {emit});
        queue.queueMessage({routingKey: 'test.1'});
        queue.queueMessage({routingKey: 'test.2'});
        queue.queueMessage({routingKey: 'test.3'});

        expect(triggered).to.have.length(2);
        expect(triggered[0]).to.have.property('deadLetterExchange', 'evict');
        expect(triggered[0]).to.have.property('message').with.property('fields').with.property('routingKey', 'test.1');
        expect(triggered[1]).to.have.property('deadLetterExchange', 'evict');
        expect(triggered[1]).to.have.property('message').with.property('fields').with.property('routingKey', 'test.2');

        function emit(eventName, event) {
          if (eventName === 'queue.dead-letter') triggered.push(event);
        }
      });

      it('no deadLetterExchange emits no dead letter event', () => {
        let triggered;
        const queue = Queue(null, {maxLength: 1}, {emit});
        queue.queueMessage({routingKey: 'test.1'});

        queue.get().nack(false, true);

        expect(triggered).to.not.be.ok;

        function emit(eventName, event) {
          if (eventName === 'queue.dead-letter') triggered = event;
        }
      });
    });

    describe('exclusive', () => {
      it('consume exclusively consumed queue throws error', () => {
        const queue = Queue();
        queue.consume(() => {}, {exclusive: true});

        expect(() => {
          queue.consume(() => {});
        }).to.throw(/is exclusively consumed/);
      });

      it('releases exclusive consumed queue when consumer is canceled', () => {
        const queue = Queue(null, {autoDelete: false});
        const consumer = queue.consume(() => {}, {exclusive: true});
        queue.cancel(consumer.consumerTag);
        queue.consume(() => {});
      });
    });
  });

  describe('queueMessage()', () => {
    it('queues message', () => {
      const queue = Queue();
      queue.queueMessage();

      expect(queue.messageCount).to.equal(1);
    });

    it('queues second message', () => {
      const queue = Queue();
      queue.queueMessage();
      queue.queueMessage();

      expect(queue.messageCount).to.equal(2);
    });
  });

  describe('consume(onMessage[, options])', () => {
    it('returns consumer', () => {
      const queue = Queue();
      const consumer = queue.consume(() => {});
      expect(consumer.options).to.have.property('consumerTag');
    });

    it('ups consumerCount', () => {
      const queue = Queue();
      queue.consume(() => {});
      expect(queue.consumerCount).to.equal(1);
    });

    it('passes options to consumer', () => {
      const queue = Queue();
      const consumer = queue.consume(() => {}, {prefetch: 42});
      expect(consumer.options).to.have.property('prefetch', 42);
    });

    it('emits consume with consumer', () => {
      let triggered;
      const queue = Queue(null, {}, {emit});
      queue.consume(() => {});

      expect(triggered).to.be.true;

      function emit(eventName, content) {
        triggered = true;
        expect(eventName).to.equal('queue.consume');
        expect(content).to.have.property('consumerTag');
      }
    });

    it('calls onMessage callback with queued message', () => {
      const queue = Queue();
      queue.queueMessage({routingKey: 'test.1'}, {data: 1});
      const messages = [];

      queue.consume(onMessage);

      expect(messages.length).to.equal(1);
      expect(messages[0].fields).to.have.property('routingKey', 'test.1');
      expect(messages[0].content).to.eql({data: 1});

      function onMessage(routingKey, message) {
        messages.push(message);
      }
    });

    it('calls onMessage callback with queued messages', () => {
      const queue = Queue();
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});
      const messages = [];

      queue.consume(onMessage, {prefetch: 2});

      expect(messages.length).to.equal(2);
      expect(messages[0].fields).to.have.property('routingKey', 'test.1');
      expect(messages[1].fields).to.have.property('routingKey', 'test.2');

      function onMessage(routingKey, message) {
        messages.push(message);
      }
    });

    it('calls onMessage callback on new message', () => {
      const queue = Queue();
      const messages = [];

      queue.consume(onMessage, {prefetch: 2});

      queue.queueMessage({routingKey: 'test.1'});

      expect(messages.length).to.equal(1);
      expect(messages[0].fields).to.have.property('routingKey', 'test.1');

      function onMessage(routingKey, message) {
        messages.push(message);
      }
    });

    it('calls onMessage callback on new messages', () => {
      const queue = Queue();
      const messages = [];

      queue.consume(onMessage, {prefetch: 2});

      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});

      expect(messages.length).to.equal(2);
      expect(messages[0].fields).to.have.property('routingKey', 'test.1');
      expect(messages[1].fields).to.have.property('routingKey', 'test.2');

      function onMessage(routingKey, message) {
        messages.push(message);
      }
    });

    it('new message queued in onMessage callback is handled in sequence', () => {
      const queue = Queue();
      const messages = [];

      queue.consume(onMessage);

      queue.queueMessage({routingKey: 'test.1'});

      expect(messages.length).to.equal(2);
      expect(messages[0].fields).to.have.property('routingKey', 'test.1');
      expect(messages[1].fields).to.have.property('routingKey', 'test.2');

      function onMessage(routingKey, message) {
        messages.push(message);
        if (routingKey === 'test.1') queue.queueMessage({routingKey: 'test.2'});
        message.ack();
      }
    });

    it('new messages queued in onMessage callback are handled in sequence', () => {
      const queue = Queue();
      const messages = [];

      queue.consume(onMessage, {prefetch: 2});

      queue.queueMessage({routingKey: 'test.1'});

      expect(messages.length).to.equal(3);
      expect(messages[0].fields).to.have.property('routingKey', 'test.1');
      expect(messages[1].fields).to.have.property('routingKey', 'test.2');
      expect(messages[2].fields).to.have.property('routingKey', 'test.3');

      function onMessage(routingKey, message) {
        messages.push(message);
        if (routingKey === 'test.1') {
          queue.queueMessage({routingKey: 'test.2'});
        } else if (routingKey === 'test.2') {
          queue.queueMessage({routingKey: 'test.3'});
        }
        message.ack();
      }
    });

    it('new message queued in onMessage callback is queued', () => {
      const queue = Queue();
      const messages = [];

      queue.consume(onMessage, {consumerTag: 'meme'});

      queue.queueMessage({routingKey: 'test.1'});

      expect(queue.messageCount).to.equal(2);

      expect(messages.length).to.equal(1);
      expect(messages[0].fields).to.have.property('routingKey', 'test.1');

      function onMessage(routingKey, message) {
        messages.push(message);
        if (routingKey === 'test.1') queue.queueMessage({routingKey: 'test.2'});
      }
    });
  });

  describe('dismiss(onMessage)', () => {
    it('downs consumerCount', () => {
      const queue = Queue();
      queue.consume(onMessage);
      queue.dismiss(onMessage);

      expect(queue.consumerCount).to.equal(0);

      function onMessage() {}
    });

    it('requeues non acknowledge message', () => {
      const queue = Queue(null, {autoDelete: false});
      queue.consume(onMessage);
      queue.queueMessage({routingKey: 'test.1'});

      queue.dismiss(onMessage);

      expect(queue.messageCount).to.equal(1);

      function onMessage() {}
    });
  });

  describe('get()', () => {
    it('returns first pending message', () => {
      const queue = Queue();
      queue.queueMessage({routingKey: 'test.1'});

      const msg = queue.get();
      expect(msg).to.have.property('fields').with.property('routingKey', 'test.1');
      expect(msg).to.have.property('pending', true);
    });

    it('with options consumerTag sets message field', () => {
      const queue = Queue();
      queue.queueMessage({routingKey: 'test.1'});

      const msg = queue.get({consumerTag: 'smq.ctag-1'});
      expect(msg).to.have.property('fields').with.property('routingKey', 'test.1');
      expect(msg).to.have.property('fields').with.property('consumerTag', 'smq.ctag-1');
    });
  });

  describe('ack()', () => {
    it('consumes message', () => {
      const queue = Queue();
      queue.queueMessage({routingKey: 'test.1'});

      const msg = queue.get();
      queue.ack(msg);
      expect(queue.messageCount).to.equal(0);
    });

    it('with allUpTo consumes messages prior to current', () => {
      const queue = Queue();
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});
      queue.queueMessage({routingKey: 'test.3'});

      queue.get();
      const msg = queue.get();
      expect(msg).to.have.property('fields').with.property('routingKey', 'test.2');
      queue.ack(msg, true);
      expect(queue.messageCount).to.equal(1);
    });

    it('same message twice is ignored', () => {
      const queue = Queue();
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});
      queue.queueMessage({routingKey: 'test.3'});

      const msg = queue.get();
      queue.ack(msg);
      queue.ack(msg);
      expect(queue.messageCount).to.equal(2);
    });
  });

  describe('nack()', () => {
    it('requeues message by default', () => {
      const queue = Queue();
      queue.queueMessage({routingKey: 'test.1'});

      const msg = queue.get();
      queue.nack(msg);
      expect(queue.messageCount).to.equal(1);
    });

    it('consumes message if requeue is false', () => {
      const queue = Queue();
      queue.queueMessage({routingKey: 'test.1'});

      const msg = queue.get();
      queue.nack(msg, null, false);
      expect(queue.messageCount).to.equal(0);
    });

    it('with allUpTo requeues messages prior to current', () => {
      const queue = Queue();
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});
      queue.queueMessage({routingKey: 'test.3'});

      queue.get();
      const msg = queue.get();
      expect(msg).to.have.property('fields').with.property('routingKey', 'test.2');
      queue.nack(msg, true);
      expect(queue.messageCount).to.equal(3);
    });

    it('with allUpTo and requeue false discards messages prior to current', () => {
      const queue = Queue();
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});
      queue.queueMessage({routingKey: 'test.3'});

      queue.get();
      const msg = queue.get();
      expect(msg).to.have.property('fields').with.property('routingKey', 'test.2');
      queue.nack(msg, true, false);
      expect(queue.messageCount).to.equal(1);
    });

    it('same message twice with different arguments is ignored', () => {
      const queue = Queue();
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});
      queue.queueMessage({routingKey: 'test.3'});

      const msg = queue.get();
      queue.nack(msg, null, true);
      queue.nack(msg, null, false);
      expect(queue.messageCount).to.equal(3);
    });

    it('requeued message is put back in the same position but are not reference equals', () => {
      const queue = Queue();
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});
      queue.queueMessage({routingKey: 'test.3'});

      const msg = queue.get({consumerTag: 'my-consumer'});
      queue.nack(msg);

      const msg2 = queue.get();
      expect(msg.messageId).to.equal(msg2.messageId);
      expect(queue.messageCount).to.equal(3);
    });

    it('requeued message resets consumerTag', () => {
      const queue = Queue();
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});
      queue.queueMessage({routingKey: 'test.3'});

      const msg = queue.get({consumerTag: 'my-consumer'});
      expect(msg.consumerTag).to.equal('my-consumer');
      queue.nack(msg);

      const msg2 = queue.get();
      expect(msg.messageId).to.equal(msg2.messageId);
      expect(msg2.consumerTag).to.be.undefined;
    });
  });

  describe('reject()', () => {
    it('requeues message by default', () => {
      const queue = Queue();
      queue.queueMessage({routingKey: 'test.1'});

      const msg = queue.get();
      queue.reject(msg);
      expect(queue.messageCount).to.equal(1);
    });

    it('discards message if requeue is false', () => {
      const queue = Queue();
      queue.queueMessage({routingKey: 'test.1'});

      const msg = queue.get();
      queue.reject(msg, false);
      expect(queue.messageCount).to.equal(0);
    });

    it('same message twice is ignored', () => {
      const queue = Queue();
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});
      queue.queueMessage({routingKey: 'test.3'});

      const msg = queue.get();
      queue.reject(msg);
      queue.reject(msg);
      expect(queue.messageCount).to.equal(3);
    });
  });

  describe('purge()', () => {
    it('removes all messages', () => {
      const queue = Queue();
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});
      queue.queueMessage({routingKey: 'test.3'});
      expect(queue.messageCount).to.equal(3);
      queue.purge();
      expect(queue.messageCount).to.equal(0);
    });
  });

  describe('peek()', () => {
    it('returns first message', () => {
      const queue = Queue();
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});

      const msg = queue.peek();
      expect(msg).to.have.property('fields').with.property('routingKey', 'test.1');
      expect(msg).to.have.property('pending', false);
    });

    it('returns first message even if pending', () => {
      const queue = Queue();
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});

      expect(queue.get().fields).to.have.property('routingKey', 'test.1');

      const msg = queue.peek();
      expect(msg).to.have.property('fields').with.property('routingKey', 'test.1');
      expect(msg).to.have.property('pending', true);
    });

    it('with ignore pending flag and no pending messages in queue returns first message', () => {
      const queue = Queue();
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});

      const msg = queue.peek(true);
      expect(msg).to.have.property('fields').with.property('routingKey', 'test.1');
      expect(msg).to.have.property('pending', false);
    });

    it('with ignore pending flag and pending messages in queue returns first non-pending message', () => {
      const queue = Queue();
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});

      queue.get();

      const msg = queue.peek(true);
      expect(msg).to.have.property('fields').with.property('routingKey', 'test.2');
      expect(msg).to.have.property('pending', false);
    });
  });

  describe('Consumer', () => {
    it('waits for ack before consuming next message', () => {
      const queue = Queue('event-q');
      const messages = [];
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});

      queue.consume(onMessage);
      expect(messages.length).to.equal(1);

      messages[0].ack();
      expect(messages.length).to.equal(2);

      messages[1].ack();
      expect(queue.messageCount).to.equal(0);

      function onMessage(routingKey, message) {
        messages.push(message);
      }
    });

    it('noAck acks messages in queue immediately', () => {
      const queue = Queue();
      const messages = [];
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});

      queue.consume(onMessage, {noAck: true});

      expect(messages.length).to.equal(2);

      expect(queue.messageCount).to.equal(0);

      function onMessage(routingKey, message) {
        messages.push(message);
      }
    });

    it('noAck acks queued messages immediately', () => {
      const queue = Queue();
      const messages = [];

      queue.queueMessage({routingKey: 'test.1'});

      queue.consume(onMessage, {noAck: true});

      queue.queueMessage({routingKey: 'test.2'});
      queue.queueMessage({routingKey: 'test.3'});

      expect(messages.length).to.equal(3);

      expect(queue.messageCount).to.equal(0);

      function onMessage(routingKey, message) {
        messages.push(message);
      }
    });

    it('noAck with prefetch above 1 acks messages immediately', () => {
      const queue = Queue();
      const messages = [];

      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});

      queue.consume(onMessage, {noAck: true, prefetch: 2});

      queue.queueMessage({routingKey: 'test.3'});
      queue.queueMessage({routingKey: 'test.4'});

      expect(messages.length).to.equal(4);

      expect(queue.messageCount).to.equal(0);

      function onMessage(routingKey, message) {
        messages.push(message);
      }
    });

    it('indicates ready when available for new messages', () => {
      const queue = Queue('event-q');
      const messages = [];
      queue.queueMessage({routingKey: 'test.1'});

      const consumer = queue.consume(onMessage);
      expect(consumer.ready).to.be.false;
      messages[0].ack();

      expect(consumer.ready).to.be.true;

      function onMessage(routingKey, message) {
        messages.push(message);
      }
    });
  });

  describe('queued message', () => {
    describe('message.ack()', () => {
      it('consumes message', () => {
        const queue = Queue();
        queue.queueMessage({routingKey: 'test.1'});

        const msg = queue.get();
        msg.ack();
        expect(queue.messageCount).to.equal(0);
      });

      it('with allUpTo consumes messages prior to current', () => {
        const queue = Queue();
        queue.queueMessage({routingKey: 'test.1'});
        queue.queueMessage({routingKey: 'test.2'});
        queue.queueMessage({routingKey: 'test.3'});

        queue.get();
        const msg = queue.get();
        expect(msg).to.have.property('fields').with.property('routingKey', 'test.2');
        msg.ack(true);
        expect(queue.messageCount).to.equal(1);
      });

      it('same message twice is ignored', () => {
        const queue = Queue();
        queue.queueMessage({routingKey: 'test.1'});
        queue.queueMessage({routingKey: 'test.2'});
        queue.queueMessage({routingKey: 'test.3'});

        const msg = queue.get();
        msg.ack();
        msg.ack();
        expect(queue.messageCount).to.equal(2);
      });
    });

    describe('message.nack()', () => {
      it('requeues message by default', () => {
        const queue = Queue();
        queue.queueMessage({routingKey: 'test.1'});

        const msg = queue.get();
        msg.nack();
        expect(queue.messageCount).to.equal(1);
      });

      it('consumes message if requeue is false', () => {
        const queue = Queue();
        queue.queueMessage({routingKey: 'test.1'});

        const msg = queue.get();
        msg.nack(null, false);
        expect(queue.messageCount).to.equal(0);
      });

      it('with allUpTo requeues messages prior to current', () => {
        const queue = Queue();
        queue.queueMessage({routingKey: 'test.1'});
        queue.queueMessage({routingKey: 'test.2'});
        queue.queueMessage({routingKey: 'test.3'});

        queue.get();
        const msg = queue.get();
        expect(msg).to.have.property('fields').with.property('routingKey', 'test.2');
        msg.nack(true);
        expect(queue.messageCount).to.equal(3);
      });

      it('with allUpTo and requeue false consumes messages prior to current', () => {
        const queue = Queue();
        queue.queueMessage({routingKey: 'test.1'});
        queue.queueMessage({routingKey: 'test.2'});
        queue.queueMessage({routingKey: 'test.3'});

        queue.get();
        const msg = queue.get();
        expect(msg).to.have.property('fields').with.property('routingKey', 'test.2');
        msg.nack(true, false);
        expect(queue.messageCount).to.equal(1);
      });

      it('same message twice is ignored', () => {
        const queue = Queue();
        queue.queueMessage({routingKey: 'test.1'});
        queue.queueMessage({routingKey: 'test.2'});
        queue.queueMessage({routingKey: 'test.3'});

        const msg = queue.get();
        msg.nack(null, false);
        msg.nack(null, false);
        expect(queue.messageCount).to.equal(2);
      });
    });

    describe('message.reject()', () => {
      it('requeues message by default', () => {
        const queue = Queue();
        queue.queueMessage({routingKey: 'test.1'});

        const msg = queue.get();
        msg.reject();
        expect(queue.messageCount).to.equal(1);
      });

      it('discards message if requeue is false', () => {
        const queue = Queue();
        queue.queueMessage({routingKey: 'test.1'});

        const msg = queue.get();
        msg.reject(false);
        expect(queue.messageCount).to.equal(0);
      });

      it('same message twice is ignored', () => {
        const queue = Queue();
        queue.queueMessage({routingKey: 'test.1'});
        queue.queueMessage({routingKey: 'test.2'});
        queue.queueMessage({routingKey: 'test.3'});

        const msg = queue.get();
        msg.reject(false);
        msg.reject(false);
        expect(queue.messageCount).to.equal(2);
      });
    });
  });

  describe('getState()', () => {
    it('returns state of queue with messages', () => {
      const queue = Queue('test-q');
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});

      const state = queue.getState();
      expect(state).to.have.property('name', 'test-q');
      expect(state).to.have.property('options').that.eql({
        autoDelete: true
      });
      expect(state).to.have.property('messages').have.length(2);
    });
  });

  describe('stop()', () => {
    it('stops new messages', () => {
      const queue = Queue('test-q');
      queue.queueMessage({routingKey: 'test.1'});
      queue.stop();
      queue.queueMessage({routingKey: 'test.2'});

      expect(queue.messageCount).to.equal(1);
    });

    it('stops consumption', () => {
      const queue = Queue('test-q');
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});

      queue.stop();

      queue.queueMessage({routingKey: 'test.3'});

      expect(queue.get()).to.be.undefined;
      const consumer = queue.consume(() => {});

      expect(queue.messageCount).to.equal(2);
      expect(consumer.messageCount).to.equal(0);
    });

    it('stopped ignores ack()', () => {
      const queue = Queue('test-q');
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});

      const msg = queue.get();

      queue.stop();

      queue.ack(msg);

      expect(queue.messageCount).to.equal(2);
    });

    it('stopped ignores nack()', () => {
      const queue = Queue('test-q');
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});

      const msg = queue.get();

      queue.stop();

      queue.nack(msg, null, false);

      expect(queue.messageCount).to.equal(2);
    });

    it('stopped ignores reject()', () => {
      const queue = Queue('test-q');
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});

      const msg = queue.get();

      queue.stop();

      queue.reject(msg, false);

      expect(queue.messageCount).to.equal(2);
    });
  });

  describe('recover()', () => {
    it('recovers stopped without state', () => {
      const queue = Queue('test-q');
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});

      queue.stop();

      queue.queueMessage({routingKey: 'test.3'});

      expect(queue.messageCount).to.equal(2);

      queue.recover();

      queue.queueMessage({routingKey: 'test.3'});

      expect(queue.messageCount).to.equal(3);
    });

    it('recovers stopped with state', () => {
      const queue = Queue('test-q');
      queue.queueMessage({routingKey: 'test.1', exchange: 'event'}, 'data', {contentType: 'text/plain'});
      queue.queueMessage({routingKey: 'test.2', exchange: 'event'}, {data: 1}, {contentType: 'application/json'});

      queue.stop();

      const state = queue.getState();
      state.name = 'test-recovered-q';
      state.messages.pop();

      queue.recover(state);

      queue.queueMessage({routingKey: 'test.3'});

      expect(queue.name).to.equal('test-recovered-q');
      expect(queue.messageCount).to.equal(2);
    });

    it('resumes consumption', () => {
      const queue = Queue('test-q');
      queue.queueMessage({routingKey: 'test.1', exchange: 'event'}, 'data', {contentType: 'text/plain'});
      queue.queueMessage({routingKey: 'test.2', exchange: 'event'}, {data: 1}, {contentType: 'application/json'});

      queue.stop();

      const state = queue.getState();

      queue.recover(state);

      expect(queue.messageCount).to.equal(2);

      let msg = queue.get({consumerTag: 'me-again'});
      expect(msg).to.have.property('fields').that.eql({routingKey: 'test.1', exchange: 'event', consumerTag: 'me-again'});
      expect(msg).to.have.property('properties').that.have.property('contentType', 'text/plain');
      expect(msg).to.have.property('content').that.equal('data');

      msg.ack();
      expect(queue.messageCount).to.equal(1);

      msg = queue.get();
      expect(msg).to.have.property('fields').that.include({routingKey: 'test.2', exchange: 'event'});
      expect(msg).to.have.property('properties').that.have.property('contentType', 'application/json');
      expect(msg).to.have.property('content').that.eql({data: 1});

      msg.ack();

      expect(queue.messageCount).to.equal(0);
    });
  });

  describe('delete()', () => {
    it('emits delete', () => {
      let triggered;
      const queue = Queue('test-q', {}, {emit});
      queue.queueMessage({routingKey: 'test.1'});
      queue.consume(() => {});

      queue.delete();

      expect(triggered).to.be.true;

      function emit(eventName) {
        if (eventName !== 'queue.delete') return;
        triggered = true;
      }
    });

    it('emits delete for queue and all consumers', () => {
      const triggered = [];
      const queue = Queue('test-q', {}, {emit});
      queue.queueMessage({routingKey: 'test.1'});
      queue.consume(() => {});
      queue.consume(() => {});

      queue.delete();

      expect(triggered).to.eql([
        'queue.message',
        'queue.consume',
        'queue.consume',
        'consumer.cancel',
        'consumer.cancel',
        'queue.delete'
      ]);
      expect(triggered).to.have.length(6);

      function emit(eventName) {
        triggered.push(eventName);
      }
    });

    it('ifUnused option only deletes queue if no consumers', () => {
      let triggered = false;
      const queue = Queue('test-q', {}, {emit});
      const consumer = queue.consume(() => {});

      queue.delete({ifUnused: true});

      expect(triggered).to.be.false;

      consumer.cancel();

      queue.delete({ifUnused: true});

      expect(triggered).to.be.true;

      function emit(eventName) {
        if (eventName !== 'queue.delete') return;
        triggered = true;
      }
    });

    it('ifEmpty option only deletes queue if no messages', () => {
      let triggered = false;
      const queue = Queue('test-q', {}, {emit});
      queue.queueMessage({routingKey: 'test.1'});

      queue.delete({ifEmpty: true});

      expect(triggered).to.be.false;

      queue.purge();
      queue.delete({ifEmpty: true});

      expect(triggered).to.be.true;

      function emit(eventName) {
        if (eventName !== 'queue.delete') return;
        triggered = true;
      }
    });
  });

  describe('events', () => {
    it('emits message when message is queued', () => {
      let triggered;
      const queue = Queue('test-q', {}, {emit});
      queue.queueMessage({routingKey: 'test.1'});

      expect(triggered).to.be.true;

      function emit(eventName) {
        if (eventName === 'queue.message') triggered = true;
      }
    });

    it('emits depleted when queue is emptied by message ack', () => {
      let triggered;
      const queue = Queue('test-q', {}, {emit});
      queue.queueMessage({routingKey: 'test.1'});

      queue.get().ack();

      expect(triggered).to.be.true;

      function emit(eventName) {
        if (eventName === 'queue.depleted') triggered = true;
      }
    });

    it('emits depleted when queue is emptied by message nack', () => {
      let triggered;
      const queue = Queue('test-q', {}, {emit});
      queue.queueMessage({routingKey: 'test.1'});

      queue.get().nack(false, false);

      expect(triggered).to.be.true;

      function emit(eventName) {
        if (eventName === 'queue.depleted') triggered = true;
      }
    });
  });
});
