import {Queue} from '../../src/Queue';

describe('Queue', () => {
  describe('ctor', () => {
    it('takes name', () => {
      const queue = new Queue('test-q');
      expect(queue).to.have.property('name', 'test-q');
    });

    it('receives random name if not passed', () => {
      const queue = new Queue();
      expect(queue).to.have.property('name').that.is.ok;
    });

    it('takes options', () => {
      const queue = new Queue(null, {autoDelete: false, durable: true});
      expect(queue).to.have.property('options').that.eql({autoDelete: false, durable: true});
    });

    it('defaults to option autoDelete if not passed', () => {
      const queue = new Queue();
      expect(queue).to.have.property('options').that.eql({autoDelete: true});
    });
  });

  describe('queue options', () => {
    describe('maxLength', () => {
      it('maxLength evicts old messages', () => {
        const queue = new Queue(null, {maxLength: 2});

        expect(queue.options.maxLength).to.equal(2);

        queue.queueMessage({routingKey: 'test.1'});
        queue.queueMessage({routingKey: 'test.2'});
        queue.queueMessage({routingKey: 'test.3'});

        expect(queue.messageCount).to.equal(2);
        expect(queue.peek().fields.routingKey).to.equal('test.2');
      });

      it('maxLength property can be set', () => {
        const queue = new Queue();

        queue.options.maxLength = 2;

        queue.queueMessage({routingKey: 'test.1'});
        queue.queueMessage({routingKey: 'test.2'});
        queue.queueMessage({routingKey: 'test.3'});

        expect(queue.messageCount).to.equal(2);
        expect(queue.peek().fields.routingKey).to.equal('test.2');
      });

      it('maxLength property can be changed', () => {
        const queue = new Queue(null, {maxLength: 2});

        queue.queueMessage({routingKey: 'test.1'});
        queue.queueMessage({routingKey: 'test.2'});
        queue.queueMessage({routingKey: 'test.3'});

        expect(queue.messageCount).to.equal(2);
        expect(queue.peek().fields.routingKey).to.equal('test.2');

        queue.options.maxLength = 3;

        queue.queueMessage({routingKey: 'test.4'});
        queue.queueMessage({routingKey: 'test.5'});

        expect(queue.messageCount).to.equal(3);
      });

      it('emits saturated when maxLength is reached', () => {
        let triggered;
        const queue = new Queue(null, {maxLength: 2}, {emit});

        queue.queueMessage({routingKey: 'test.1'});
        queue.queueMessage({routingKey: 'test.2'});

        expect(queue.messageCount).to.equal(2);
        expect(triggered).to.be.true;

        function emit(eventName) {
          if (eventName === 'queue.saturated') triggered = true;
        }
      });

      it('maxLength = 1 evicts old messages', () => {
        const queue = new Queue(null, {maxLength: 1});
        queue.queueMessage({routingKey: 'test.1'});
        queue.queueMessage({routingKey: 'test.2'});
        queue.queueMessage({routingKey: 'test.3'});

        expect(queue.messageCount).to.equal(1);
        expect(queue.peek().fields.routingKey).to.equal('test.3');
      });

      it('emits saturated when maxLength = 1 is reached', () => {
        let triggered;
        const queue = new Queue(null, {maxLength: 1}, {emit});

        queue.queueMessage({routingKey: 'test.1'});

        expect(queue.messageCount).to.equal(1);
        expect(triggered).to.be.true;

        function emit(eventName) {
          if (eventName === 'queue.saturated') triggered = true;
        }
      });

      it('maxLength evicts old non-pending messages', () => {
        const queue = new Queue(null, {maxLength: 2});
        queue.queueMessage({routingKey: 'test.1'});

        queue.get();

        queue.queueMessage({routingKey: 'test.2'});
        queue.queueMessage({routingKey: 'test.3'});

        expect(queue.messageCount).to.equal(2);
        expect(queue.peek(true).fields.routingKey).to.equal('test.3');
      });

      it('if maxLength is reached and all messages are pending then new message is discarded', () => {
        const queue = new Queue(null, {maxLength: 1});
        queue.queueMessage({routingKey: 'test.1'});

        queue.get();

        queue.queueMessage({routingKey: 'test.2'});
        queue.queueMessage({routingKey: 'test.3'});

        expect(queue.messageCount).to.equal(1);
        expect(queue.peek().fields.routingKey).to.equal('test.1');
      });
    });

    describe('deadLetterExchange', () => {
      it('deadLetterExchange emits event with message when message is nacked', () => {
        let triggered;
        const queue = new Queue(null, {deadLetterExchange: 'evict'}, {emit});
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
        const queue = new Queue(null, {deadLetterExchange: 'evict', deadLetterRoutingKey: 'evicted.message'}, {emit});
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
        const queue = new Queue(null, {maxLength: 1, deadLetterExchange: 'evict'}, {emit});
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
        const queue = new Queue(null, {maxLength: 1}, {emit});
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
        const queue = new Queue();
        queue.consume(() => {}, {exclusive: true});

        expect(() => {
          queue.consume(() => {});
        }).to.throw(/is exclusively consumed/);
      });

      it('exclusively consume on queue with consumer throws error', () => {
        const queue = new Queue();
        queue.consume(() => {});

        expect(() => {
          queue.consume(() => {}, {exclusive: true});
        }).to.throw(/already has consumers/);
      });

      it('releases exclusive consumed queue when consumer is canceled', () => {
        const queue = new Queue(null, {autoDelete: false});
        const consumer = queue.consume(() => {}, {exclusive: true});
        queue.cancel(consumer.consumerTag);
        queue.consume(() => {});
      });
    });
  });

  describe('queueMessage()', () => {
    it('queues message', () => {
      const queue = new Queue();
      queue.queueMessage();

      expect(queue.messageCount).to.equal(1);
    });

    it('queues second message', () => {
      const queue = new Queue();
      queue.queueMessage();
      queue.queueMessage();

      expect(queue.messageCount).to.equal(2);
    });
  });

  describe('consume(onMessage[, options])', () => {
    it('returns consumer', () => {
      const queue = new Queue();
      const consumer = queue.consume(() => {});
      expect(consumer.options).to.have.property('consumerTag');
    });

    it('ups consumerCount', () => {
      const queue = new Queue();
      queue.consume(() => {});
      expect(queue.consumerCount).to.equal(1);
    });

    it('passes options to consumer', () => {
      const queue = new Queue();
      const consumer = queue.consume(() => {}, {prefetch: 42});
      expect(consumer.options).to.have.property('prefetch', 42);
    });

    it('emits consume with consumer', () => {
      let triggered;
      const queue = new Queue(null, {}, {emit});
      queue.consume(() => {});

      expect(triggered).to.be.true;

      function emit(eventName, content) {
        triggered = true;
        expect(eventName).to.equal('queue.consume');
        expect(content).to.have.property('consumerTag');
      }
    });

    it('calls onMessage callback with already queued message', () => {
      const queue = new Queue();
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

    it('calls onMessage callback with already queued messages', () => {
      const queue = new Queue();
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
      const queue = new Queue();
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
      const queue = new Queue();
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
      const queue = new Queue();
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
      const queue = new Queue();
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
      const queue = new Queue();
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

    it('cancel consumer after ack in message callback stops consumption', () => {
      const queue = new Queue(null, {autoDelete: false});
      const messages = [];

      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});

      queue.consume(onMessage, {consumerTag: 'meme'});

      expect(messages.length).to.equal(1);
      expect(messages[0].fields).to.have.property('routingKey', 'test.1');

      expect(queue.messageCount).to.equal(1);

      function onMessage(routingKey, message) {
        messages.push(message);
        message.ack();
        queue.dismiss(onMessage);
      }
    });
  });

  describe('assertConsumer(onMessage[, options])', () => {
    it('returns consumer', () => {
      const queue = new Queue();
      const consumer = queue.assertConsumer(() => {});
      expect(consumer.options).to.have.property('consumerTag');
    });

    it('ups consumerCount', () => {
      const queue = new Queue();
      queue.assertConsumer(() => {});
      expect(queue.consumerCount).to.equal(1);
    });

    it('returns the same consumer if message callback match', () => {
      const queue = new Queue();
      const consumer = queue.consume(onMessage);
      expect(queue.assertConsumer(onMessage) === consumer).to.be.true;
      function onMessage() {}
    });

    it('returns the same consumer if message callback and consumer tag match', () => {
      const queue = new Queue();
      const consumer = queue.consume(onMessage, {consumerTag: 'test-consumer'});
      expect(queue.assertConsumer(onMessage, {consumerTag: 'test-consumer-2'}) === consumer).to.be.false;
      expect(queue.assertConsumer(onMessage, {consumerTag: 'test-consumer'}) === consumer).to.be.true;
      function onMessage() {}
    });

    it('returns the same consumer if message callback, consumer tag and exclusive match', () => {
      const queue = new Queue();
      const consumer = queue.consume(onMessage, {consumerTag: 'test-consumer', exclusive: true});

      expect(() => {
        queue.assertConsumer(onMessage, {consumerTag: 'test-consumer', exclusive: false});
      }).to.throw(Error);

      expect(queue.assertConsumer(onMessage, {consumerTag: 'test-consumer', exclusive: true}) === consumer).to.be.true;

      function onMessage() {}
    });
  });

  describe('dismiss(onMessage)', () => {
    it('downs consumerCount', () => {
      const queue = new Queue();
      queue.consume(onMessage);
      queue.dismiss(onMessage);

      expect(queue.consumerCount).to.equal(0);

      function onMessage() {}
    });

    it('requeues non acknowledge message', () => {
      const queue = new Queue(null, {autoDelete: false});
      queue.consume(onMessage);
      queue.queueMessage({routingKey: 'test.1'});

      queue.dismiss(onMessage);

      expect(queue.messageCount).to.equal(1);

      function onMessage() {}
    });

    it('ignored if onMessage is not registered', () => {
      const queue = new Queue(null, {autoDelete: false});
      queue.consume(onMessage);
      queue.queueMessage({routingKey: 'test.1'});

      queue.dismiss(onMessage);
      queue.dismiss(onMessage);

      expect(queue.messageCount).to.equal(1);

      function onMessage() {}
    });
  });

  describe('get()', () => {
    it('returns first pending message', () => {
      const queue = new Queue();
      queue.queueMessage({routingKey: 'test.1'});

      const msg = queue.get();
      expect(msg).to.have.property('fields').with.property('routingKey', 'test.1');
      expect(msg).to.have.property('pending', true);
    });
  });

  describe('ack()', () => {
    it('consumes message', () => {
      const queue = new Queue();
      queue.queueMessage({routingKey: 'test.1'});

      const msg = queue.get();
      queue.ack(msg);
      expect(queue.messageCount).to.equal(0);
    });

    it('with allUpTo consumes messages prior to current', () => {
      const queue = new Queue();
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});
      queue.queueMessage({routingKey: 'test.3'});

      queue.get();
      const msg = queue.get();
      expect(msg).to.have.property('fields').with.property('routingKey', 'test.2');
      queue.ack(msg, true);
      expect(queue.messageCount).to.equal(1);

      expect(queue.get()).to.have.property('fields').with.property('routingKey', 'test.3');
    });

    it('same message twice is ignored', () => {
      const queue = new Queue();
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
      const queue = new Queue();
      queue.queueMessage({routingKey: 'test.1'});

      const msg = queue.get();
      queue.nack(msg);
      expect(queue.messageCount).to.equal(1);
    });

    it('consumes message if requeue is false', () => {
      const queue = new Queue();
      queue.queueMessage({routingKey: 'test.1'});

      const msg = queue.get();
      queue.nack(msg, null, false);
      expect(queue.messageCount).to.equal(0);
    });

    it('with allUpTo requeues messages prior to current', () => {
      const queue = new Queue();
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
      const queue = new Queue();
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
      const queue = new Queue();
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});
      queue.queueMessage({routingKey: 'test.3'});

      const msg = queue.get();
      queue.nack(msg, null, true);
      queue.nack(msg, null, false);
      expect(queue.messageCount).to.equal(3);
    });

    it('requeued message is put back in the same position but are not reference equals', () => {
      const queue = new Queue();
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});
      queue.queueMessage({routingKey: 'test.3'});

      const msg = queue.get({consumerTag: 'my-consumer'});
      queue.nack(msg);

      const msg2 = queue.get();
      expect(msg.properties.messageId).to.be.ok.and.to.equal(msg2.properties.messageId);
      expect(queue.messageCount).to.equal(3);
    });

    it('requeued message resets consumerTag', () => {
      const queue = new Queue();
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});
      queue.queueMessage({routingKey: 'test.3'});

      queue.consume(() => {}, {consumerTag: 'my-consumer'});

      const msg = queue.peek();
      expect(msg.fields.consumerTag).to.equal('my-consumer');
      queue.nack(msg);

      const msg2 = queue.get();
      expect(msg.properties.messageId).to.be.ok.and.equal(msg2.properties.messageId);
      expect(msg2.consumerTag).to.be.undefined;
    });
  });

  describe('reject()', () => {
    it('requeues message by default', () => {
      const queue = new Queue();
      queue.queueMessage({routingKey: 'test.1'});

      const msg = queue.get();
      queue.reject(msg);
      expect(queue.messageCount).to.equal(1);
    });

    it('discards message if requeue is false', () => {
      const queue = new Queue();
      queue.queueMessage({routingKey: 'test.1'});

      const msg = queue.get();
      queue.reject(msg, false);
      expect(queue.messageCount).to.equal(0);
    });

    it('same message twice is ignored', () => {
      const queue = new Queue();
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
      const queue = new Queue();
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});
      queue.queueMessage({routingKey: 'test.3'});
      expect(queue.messageCount).to.equal(3);
      queue.purge();
      expect(queue.messageCount).to.equal(0);
    });

    it('removes all undelivered messages', () => {
      const queue = new Queue();
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});
      queue.queueMessage({routingKey: 'test.3'});

      queue.get();

      expect(queue.messageCount).to.equal(3);
      queue.purge();
      expect(queue.messageCount).to.equal(1);
    });

    it('emits depleted if no undelivered messages remain', () => {
      let triggered;
      const queue = new Queue(null, {}, {emit});
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});
      queue.queueMessage({routingKey: 'test.3'});

      expect(queue.messageCount).to.equal(3);
      queue.purge();

      expect(queue.messageCount).to.equal(0);
      expect(triggered, 'depleted').to.be.true;

      function emit(eventName, msg) {
        if (eventName === 'queue.depleted') {
          triggered = true;
          expect(queue === msg).to.be.true;
        }
      }
    });

    it('consumes next message in queue after consumer nackAll and queue purge', () => {
      const messages = [];

      const queue = new Queue();
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});

      const consumer = queue.consume(onMessage, {prefetch: 2});

      expect(consumer.messageCount).to.equal(2);

      consumer.nackAll(false);
      queue.purge();

      queue.queueMessage({routingKey: 'test.3'});

      expect(messages).to.eql(['test.1', 'test.2', 'test.3']);

      function onMessage(routingKey) {
        messages.push(routingKey);
      }
    });
  });

  describe('peek([ignoreDelivered])', () => {
    it('returns first message', () => {
      const queue = new Queue();
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});

      const msg = queue.peek();
      expect(msg).to.have.property('fields').with.property('routingKey', 'test.1');
      expect(msg).to.have.property('pending', false);
    });

    it('returns first message even if delivered', () => {
      const queue = new Queue();
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});

      expect(queue.get().fields).to.have.property('routingKey', 'test.1');

      const msg = queue.peek();
      expect(msg).to.have.property('fields').with.property('routingKey', 'test.1');
      expect(msg).to.have.property('pending', true);
    });

    it('with ignore delivered argument true returns first message when all are undelivered', () => {
      const queue = new Queue();
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});

      const msg = queue.peek(true);
      expect(msg).to.have.property('fields').with.property('routingKey', 'test.1');
      expect(msg).to.have.property('pending', false);
    });

    it('with ignore delivered argument returns first undelivered message', () => {
      const queue = new Queue();
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});

      queue.get();

      const msg = queue.peek(true);
      expect(msg).to.have.property('fields').with.property('routingKey', 'test.2');
      expect(msg).to.have.property('pending', false);
    });

    it('with ignore delivered argument returns nothing if all are delivered', () => {
      const queue = new Queue();
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});

      queue.get();
      queue.get();

      expect(queue.peek(true)).to.be.undefined;
    });
  });

  describe('queued message', () => {
    describe('message.ack()', () => {
      it('consumes message', () => {
        const queue = new Queue();
        queue.queueMessage({routingKey: 'test.1'});

        const msg = queue.get();
        msg.ack();
        expect(queue.messageCount).to.equal(0);
      });

      it('with allUpTo consumes messages prior to current', () => {
        const queue = new Queue();
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
        const queue = new Queue();
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
        const queue = new Queue();
        queue.queueMessage({routingKey: 'test.1'});

        const msg = queue.get();
        msg.nack();
        expect(queue.messageCount).to.equal(1);
      });

      it('consumes message if requeue is false', () => {
        const queue = new Queue();
        queue.queueMessage({routingKey: 'test.1'});

        const msg = queue.get();
        msg.nack(null, false);
        expect(queue.messageCount).to.equal(0);
      });

      it('with allUpTo requeues messages prior to current', () => {
        const queue = new Queue();
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
        const queue = new Queue();
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
        const queue = new Queue();
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
        const queue = new Queue();
        queue.queueMessage({routingKey: 'test.1'});

        const msg = queue.get();
        msg.reject();
        expect(queue.messageCount).to.equal(1);
      });

      it('discards message if requeue is false', () => {
        const queue = new Queue();
        queue.queueMessage({routingKey: 'test.1'});

        const msg = queue.get();
        msg.reject(false);
        expect(queue.messageCount).to.equal(0);
      });

      it('same message twice is ignored', () => {
        const queue = new Queue();
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
      const queue = new Queue('test-q');
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});

      const state = queue.getState();
      expect(state).to.have.property('name', 'test-q');
      expect(state).to.have.property('options').that.eql({
        autoDelete: true
      });
      expect(state).to.have.property('messages').have.length(2);
    });

    it('returns state of without messages if empty', () => {
      const queue = new Queue('test-q');
      const state = queue.getState();
      expect(state).to.not.have.property('messages');
    });

    it('throws if circular json', () => {
      const queue = new Queue('test-q');
      queue.queueMessage({routingKey: 'test.1', queue});

      try {
        queue.getState();
      } catch (e) {
        var err = e; // eslint-disable-line no-var
      }
      expect(err).to.be.instanceof(TypeError);

      expect(err.code).to.equal('EQUEUE_STATE');
      expect(err.queue).to.equal('test-q');
    });
  });

  describe('delete()', () => {
    it('emits delete', () => {
      let triggered;
      const queue = new Queue('test-q', {}, {emit});
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
      const queue = new Queue('test-q', {}, {emit});
      queue.queueMessage({routingKey: 'test.1'});
      queue.consume(() => {});
      queue.consume(() => {});

      queue.delete();

      expect(triggered).to.eql([
        'queue.message',
        'queue.consume',
        'queue.consume',
        'queue.consumer.cancel',
        'queue.consumer.cancel',
        'queue.delete'
      ]);
      expect(triggered).to.have.length(6);

      function emit(eventName) {
        triggered.push(eventName);
      }
    });

    it('ifUnused option only deletes queue if no consumers', () => {
      let triggered = false;
      const queue = new Queue('test-q', {}, {emit});
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
      const queue = new Queue('test-q', {}, {emit});
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
      const queue = new Queue('test-q', {}, {emit});
      queue.queueMessage({routingKey: 'test.1'});

      expect(triggered).to.be.true;

      function emit(eventName) {
        if (eventName === 'queue.message') triggered = true;
      }
    });

    it('emits depleted when queue is emptied by message ack', () => {
      let triggered;
      const queue = new Queue('test-q', {}, {emit});
      queue.queueMessage({routingKey: 'test.1'});

      queue.get().ack();

      expect(triggered).to.be.true;

      function emit(eventName) {
        if (eventName === 'queue.depleted') triggered = true;
      }
    });

    it('emits depleted when queue is emptied by message nack', () => {
      let triggered;
      const queue = new Queue('test-q', {}, {emit});
      queue.queueMessage({routingKey: 'test.1'});

      queue.get().nack(false, false);

      expect(triggered).to.be.true;

      function emit(eventName) {
        if (eventName === 'queue.depleted') triggered = true;
      }
    });

    it('emits ready when queue maxLength was reached and then released one message', () => {
      let triggered;
      const queue = new Queue('test-q', {maxLength: 2}, {emit});
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});

      queue.get().nack(false, false);

      expect(triggered).to.be.true;

      function emit(eventName) {
        if (eventName === 'queue.ready') triggered = true;
      }
    });

    it('forwards events from consumer', () => {
      let triggered;
      const queue = new Queue('test-q', {maxLength: 2}, {emit});
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});

      queue.get().nack(false, false);

      const consumer = queue.consume(() => {});
      consumer.emit('madeup');

      expect(triggered).to.be.true;

      function emit(eventName) {
        if (eventName === 'queue.consumer.madeup') triggered = true;
      }
    });
  });

  describe('stop()', () => {
    it('stops new messages', () => {
      const queue = new Queue('test-q');
      queue.queueMessage({routingKey: 'test.1'});
      queue.stop();
      queue.queueMessage({routingKey: 'test.2'});

      expect(queue.messageCount).to.equal(1);
    });

    it('stops consumption', () => {
      const queue = new Queue('test-q');
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});

      queue.stop();

      queue.queueMessage({routingKey: 'test.3'});

      expect(queue.get()).to.be.false;
      const consumer = queue.consume(() => {});

      expect(queue.messageCount).to.equal(2);
      expect(consumer.messageCount).to.equal(0);
    });

    it('stopped ignores ack()', () => {
      const queue = new Queue('test-q');
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});

      const msg = queue.get();

      queue.stop();

      queue.ack(msg);

      expect(queue.messageCount).to.equal(2);
    });

    it('stopped ignores nack()', () => {
      const queue = new Queue('test-q');
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});

      const msg = queue.get();

      queue.stop();

      queue.nack(msg, null, false);

      expect(queue.messageCount).to.equal(2);
    });

    it('stopped ignores reject()', () => {
      const queue = new Queue('test-q');
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});

      const msg = queue.get();

      queue.stop();

      queue.reject(msg, false);

      expect(queue.messageCount).to.equal(2);
    });
  });

  describe('recover([state])', () => {
    it('recovers stopped without state', () => {
      const queue = new Queue('test-q');
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});

      queue.stop();

      queue.queueMessage({routingKey: 'test.3'});

      expect(queue.messageCount).to.equal(2);

      queue.recover();

      queue.queueMessage({routingKey: 'test.3'});

      expect(queue.messageCount).to.equal(3);
    });

    it('with state resets pending messages', () => {
      const queue = new Queue('test-q');
      queue.queueMessage({routingKey: 'test.1', exchange: 'event'}, 'data', {contentType: 'text/plain'});
      queue.queueMessage({routingKey: 'test.2', exchange: 'event'}, {data: 1}, {contentType: 'application/json'});

      let msg = queue.get();
      expect(msg).to.have.property('fields').that.include({routingKey: 'test.1', exchange: 'event'});

      queue.stop();

      const state = queue.getState();

      queue.recover(state);

      expect(queue.messageCount).to.equal(2);

      msg = queue.get({consumerTag: 'me-again'});
      expect(msg).to.have.property('fields').that.include({routingKey: 'test.1', exchange: 'event'});
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

    it('without state preserves pending messages', () => {
      const queue = new Queue('test-q');
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});

      let msg = queue.get();
      expect(msg).to.have.property('fields').that.include({routingKey: 'test.1'});

      queue.stop();
      queue.recover();

      expect(queue.messageCount).to.equal(2);

      expect(queue.peek()).to.have.property('fields').that.include({routingKey: 'test.1'});
      expect(queue.peek()).to.have.property('pending', true);

      msg = queue.get();
      expect(msg).to.have.property('fields').that.include({routingKey: 'test.2'});
    });

    it('recovers stopped with state', () => {
      const queue = new Queue('test-q');
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

    it('with state recovers messages', () => {
      const queue = new Queue('test-q');
      queue.queueMessage({routingKey: 'test.1', exchange: 'event'}, 'data', {contentType: 'text/plain'});
      queue.queueMessage({routingKey: 'test.2', exchange: 'event'}, {data: 1}, {contentType: 'application/json'});

      queue.stop();

      const state = queue.getState();

      queue.recover(state);

      expect(queue.messageCount).to.equal(2);

      let msg = queue.get({consumerTag: 'me-again'});
      expect(msg).to.have.property('fields').that.include({routingKey: 'test.1', exchange: 'event', redelivered: true});
      expect(msg).to.have.property('properties').that.have.property('contentType', 'text/plain');
      expect(msg).to.have.property('content').that.equal('data');

      msg.ack();
      expect(queue.messageCount).to.equal(1);

      msg = queue.get();
      expect(msg).to.have.property('fields').that.include({routingKey: 'test.2', exchange: 'event', redelivered: true});
      expect(msg).to.have.property('properties').that.have.property('contentType', 'application/json');
      expect(msg).to.have.property('content').that.eql({data: 1});

      msg.ack();

      expect(queue.messageCount).to.equal(0);
    });

    it('with unstopped state recovers messages', () => {
      const originalQueue = new Queue('test-q');
      originalQueue.queueMessage({routingKey: 'test.1', exchange: 'event'}, 'data', {contentType: 'text/plain'});
      originalQueue.queueMessage({routingKey: 'test.2', exchange: 'event'}, {data: 1}, {contentType: 'application/json'});

      const state = originalQueue.getState();

      const queue = new Queue('recover-q');

      queue.recover(state);

      expect(queue.messageCount).to.equal(2);

      let msg = queue.get({consumerTag: 'me-again'});
      expect(msg).to.have.property('fields').that.include({routingKey: 'test.1', exchange: 'event', redelivered: true});
      expect(msg).to.have.property('properties').that.have.property('contentType', 'text/plain');
      expect(msg).to.have.property('content').that.equal('data');

      msg.ack();
      expect(queue.messageCount).to.equal(1);

      msg = queue.get();
      expect(msg).to.have.property('fields').that.include({routingKey: 'test.2', exchange: 'event', redelivered: true});
      expect(msg).to.have.property('properties').that.have.property('contentType', 'application/json');
      expect(msg).to.have.property('content').that.eql({data: 1});

      msg.ack();

      expect(queue.messageCount).to.equal(0);
    });

    it('with unstopped and consumed unacked message recovers messages', () => {
      const originalQueue = new Queue('test-q');
      originalQueue.queueMessage({routingKey: 'test.1', exchange: 'event'}, 'data', {contentType: 'text/plain'});
      originalQueue.queueMessage({routingKey: 'test.2', exchange: 'event'}, {data: 1}, {contentType: 'application/json'});

      originalQueue.consume(() => {}, {consumerTag: 'me'});

      const state = originalQueue.getState();

      const queue = new Queue('recover-q');

      queue.recover(state);

      expect(queue.messageCount).to.equal(2);

      let msg = queue.get({consumerTag: 'me-again'});
      expect(msg).to.have.property('fields').that.include({routingKey: 'test.1', exchange: 'event', redelivered: true, consumerTag: 'me-again'});
      expect(msg).to.have.property('properties').that.have.property('contentType', 'text/plain');
      expect(msg).to.have.property('content').that.equal('data');

      msg.ack();
      expect(queue.messageCount).to.equal(1);

      msg = queue.get();
      expect(msg).to.have.property('fields').that.include({routingKey: 'test.2', exchange: 'event', redelivered: true});
      expect(msg).to.have.property('properties').that.have.property('contentType', 'application/json');
      expect(msg).to.have.property('content').that.eql({data: 1});

      msg.ack();

      expect(queue.messageCount).to.equal(0);
    });

    it('with state resumes consumers', () => {
      const queue = new Queue('test-q');
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});

      const consumer = queue.consume(() => {});

      queue.stop();

      const state = queue.getState();

      queue.recover(state);

      expect(consumer.messageCount).to.equal(1);

      consumer.ackAll();

      expect(queue.consumerCount).to.equal(1);
      expect(queue.messageCount).to.equal(1);
    });

    it('without state resumes consumers', () => {
      const messages = [];

      const queue = new Queue('test-q');
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});

      queue.consume((routingKey, message) => {
        messages.push(message);
      });

      queue.stop();
      expect(queue.consumerCount).to.equal(1);

      queue.recover();

      messages[0].ack();

      expect(queue.messageCount).to.equal(1);

      messages[1].ack();

      expect(queue.messageCount).to.equal(0);
    });
  });

  describe('evictFirst(compareMessage)', () => {
    it('returns undefined if called without messages in queue', () => {
      const queue = new Queue();
      expect(queue.evictFirst()).to.be.undefined;
    });
  });

  describe('_consumeNext()', () => {
    it('returns undefined if called when stopped ', () => {
      const queue = new Queue();
      queue.stop();
      expect(queue._consumeNext()).to.be.undefined;
    });
  });

  describe('persistent message', () => {
    it('ignores non-persistent message when recovered with state', () => {
      const originalQueue = new Queue('test-q', {durable: true});
      originalQueue.queueMessage({routingKey: 'test.ethereal'}, 'data', {persistent: false});
      originalQueue.queueMessage({routingKey: 'test.persisted'}, 'data');

      originalQueue.stop();

      const queue = new Queue('test-q');
      queue.recover(originalQueue.getState());

      const msg = queue.get();
      expect(msg).to.have.property('fields').with.property('routingKey', 'test.persisted');
    });

    it('ignores redelivered non-persistent message when stopped and recovered without state', () => {
      const queue = new Queue('test-q', {durable: true});
      queue.queueMessage({routingKey: 'test.ethereal'}, 'data', {persistent: false});
      queue.queueMessage({routingKey: 'test.persisted'}, 'data');

      queue.consume(() => {});
      queue.stop();
      queue.recover();

      const msg = queue.get();
      expect(msg).to.have.property('fields').with.property('routingKey', 'test.persisted');
    });

    it('returns redelivered non-persistent message if requeued', () => {
      const queue = new Queue('test-q', {durable: true});
      queue.queueMessage({routingKey: 'test.ethereal'}, 'data', {persistent: false});
      queue.queueMessage({routingKey: 'test.persisted'}, 'data');

      const consumer = queue.consume(() => {});

      const msg = queue.get();
      expect(msg).to.have.property('fields').with.property('routingKey', 'test.persisted');

      queue.cancel(consumer.consumerTag);

      const etherealMsg = queue.get();
      expect(etherealMsg).to.have.property('fields').with.property('routingKey', 'test.ethereal');
    });
  });

  describe('eventEmitter', () => {
    it('emitter functions works without eventEmitter', () => {
      const queue = new Queue();
      expect(() => queue.emit()).to.not.throw();
      expect(() => queue.on()).to.not.throw();
      expect(() => queue.off()).to.not.throw();
    });
  });
});

describe('Consumer', () => {
  describe('options', () => {
    const queue = new Queue();

    it('generates tag if not passed', () => {
      const consumer = queue.consume(() => {});
      expect(consumer).to.have.property('consumerTag').that.is.ok;
    });

    it('default prefetch to 1', () => {
      const consumer = queue.consume(() => {});
      expect(consumer).to.have.property('options');
      expect(consumer.options).to.have.property('prefetch', 1);
    });

    it('default noAck to false', () => {
      const consumer = queue.consume(() => {});
      expect(consumer).to.have.property('options');
      expect(consumer.options).to.have.property('noAck', false);
    });

    it('extends options with consumerTag', () => {
      const consumer = queue.consume(() => {}, {prefetch: 2});
      expect(consumer).to.have.property('options');
      expect(consumer.options).to.have.property('consumerTag').that.is.ok;
      expect(consumer.options).to.have.property('prefetch', 2);
    });
  });

  it('waits for ack before consuming next message', () => {
    const queue = new Queue('event-q');
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

  it('indicates ready when available for new messages', () => {
    const queue = new Queue('event-q');
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

  it('ack queued pending message removes message from consumer', () => {
    const queue = new Queue();
    queue.queueMessage({routingKey: 'test.1'});
    queue.queueMessage({routingKey: 'test.2'});

    const consumer = queue.consume(onMessage, {prefetch: 2});

    expect(consumer.messageCount).to.equal(2);
    expect(queue.messageCount).to.equal(2);

    queue.peek(false).ack();

    expect(queue.messageCount, 'queue messageCount').to.equal(1);
    expect(consumer.messageCount, 'consumer messageCount').to.equal(1);

    function onMessage() {}
  });

  it('returns owner in message callback', () => {
    const messages = [];

    const queue = new Queue();
    queue.queueMessage({routingKey: 'test.1'});

    const owner = {};
    queue.consume(onMessage, undefined, owner);

    expect(messages).to.have.length(1);
    expect(messages[0] === owner).to.be.true;

    function onMessage(routingKey, msg, ownedBy) {
      messages.push(ownedBy);
    }
  });

  describe('prefetch n', () => {
    it('prefetch 2 consumes 2 messages', () => {
      const messages = [];

      const queue = new Queue();
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});

      queue.consume(onMessage, {prefetch: 2});

      expect(messages).to.have.length(2);

      function onMessage(routingKey, msg) {
        messages.push(msg);
      }
    });

    it('prefetch 10 is available for new messages when one is acked', () => {
      const messages = [];

      const queue = new Queue('max-q');
      Array(11).fill().map((_, idx) => queue.queueMessage({routingKey: `test.${idx}`}));

      queue.consume(onMessage, {prefetch: 10});

      expect(messages).to.have.length(10);

      messages[0].ack();

      expect(messages).to.have.length(11);

      function onMessage(routingKey, msg) {
        messages.push(msg);
      }
    });

    it('prefetch 2 consumes no more than 2 messages at a time', () => {
      const messages = [];

      const queue = new Queue();
      const consumer = queue.consume(onMessage, {prefetch: 2});

      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});
      queue.queueMessage({routingKey: 'test.3'});
      queue.queueMessage({routingKey: 'test.4'});

      messages[0].ack();

      function onMessage(routingKey, msg) {
        messages.push(msg);
        expect(consumer.messageCount).to.not.be.above(2);
      }
    });
  });

  describe('ack', () => {
    it('consumes new messages when messages are acked', () => {
      const messages = [];

      const queue = new Queue();
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});
      queue.queueMessage({routingKey: 'test.3'});
      queue.queueMessage({routingKey: 'test.4'});

      queue.consume(onMessage, {prefetch: 2});

      expect(messages).to.have.length(2);

      messages[0].ack();
      messages[1].ack();

      expect(messages).to.have.length(4);

      function onMessage(routingKey, msg) {
        messages.push(msg);
      }
    });

    it('allUpTo = true acks all outstanding messages', () => {
      const queue = new Queue('event-q');
      const messages = [];

      queue.queueMessage({routingKey: 'test1'});
      queue.queueMessage({routingKey: 'test2'});
      queue.queueMessage({routingKey: 'test3'});

      queue.consume(onMessage, {prefetch: 2});

      expect(queue.messageCount).to.equal(0);

      expect(messages).to.eql(['test2', 'test3']);

      function onMessage(routingKey, message) {
        if (routingKey === 'test1') return;
        messages.push(routingKey);
        message.ack(true);
      }
    });

    it('allUpTo = true only acks messages above message', () => {
      const queue = new Queue('event-q');
      const messages1 = [], messages2 = [];

      queue.queueMessage({routingKey: 'test1'});
      queue.queueMessage({routingKey: 'test2'});
      queue.queueMessage({routingKey: 'test3'});
      queue.queueMessage({routingKey: 'test4'});
      queue.queueMessage({routingKey: 'test5'});

      queue.consume(onMessage1);
      queue.consume(onMessage2, {prefetch: 2});

      expect(messages1, '#1 consumer').to.eql(['test1', 'test4']);
      expect(messages2, '#2 consumer').to.eql(['test2', 'test3', 'test5']);

      function onMessage1(routingKey) {
        messages1.push(routingKey);
      }

      function onMessage2(routingKey, message) {
        messages2.push(routingKey);
        if (routingKey === 'test3') message.ack(true);
      }
    });

    it('allUpTo = true only acks messages above message', () => {
      const queue = new Queue('event-q');
      const messages1 = [], messages2 = [];

      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});
      queue.queueMessage({routingKey: 'test.3'});
      queue.queueMessage({routingKey: 'test.4'});
      queue.queueMessage({routingKey: 'test.5'});

      queue.consume(onMessage1, {prefetch: 2});
      queue.consume(onMessage2);

      expect(messages1).to.have.length(2);
      expect(messages2).to.have.length(1);

      messages1[1].ack(true);

      expect(messages2).to.have.length(1);
      expect(messages1).to.have.length(4);

      expect(messages1.map(({fields}) => fields.routingKey), '#1 consumer').to.eql(['test.1', 'test.2', 'test.4', 'test.5']);
      expect(messages2.map(({fields}) => fields.routingKey), '#2 consumer').to.eql(['test.3']);

      function onMessage1(routingKey, message) {
        messages1.push(message);
      }

      function onMessage2(routingKey, message) {
        messages2.push(message);
      }
    });
  });

  describe('noAck', () => {
    it('defaults to false', () => {
      const queue = new Queue();
      queue.queueMessage({routingKey: 'test.1'});

      const consumer = queue.consume(() => {});
      expect(consumer.options).to.have.property('noAck', false);
    });

    it('consumes pending message in queue', () => {
      const messages = [];

      const queue = new Queue();
      queue.queueMessage({routingKey: 'test.1'});

      queue.consume(onMessage, {noAck: true});

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

      const queue = new Queue();
      queue.queueMessage({routingKey: 'test.1'});

      queue.consume(onMessage, {noAck: true});

      queue.queueMessage({routingKey: 'test.2'});
      queue.queueMessage({routingKey: 'test.3'});

      expect(messages).to.have.length(3);
      expect(messages[0].fields).to.have.property('routingKey', 'test.1');
      expect(messages[1].fields).to.have.property('routingKey', 'test.2');
      expect(messages[2].fields).to.have.property('routingKey', 'test.3');

      expect(queue).to.have.property('messageCount', 0);

      function onMessage(routingKey, msg) {
        if (messages.find((m) => m.fields.routingKey === msg.fields.routingKey)) throw new Error('Circuitbreaker');
        messages.push(msg);
        msg.ack();
      }
    });

    it('cancel consumer in message callback stops consuming messages', () => {
      const messages = [];

      const queue = new Queue();
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});
      queue.queueMessage({routingKey: 'test.3'});
      queue.queueMessage({routingKey: 'test.4'});

      queue.consume(onMessage, {noAck: true});

      queue.queueMessage({routingKey: 'test.5'});

      expect(messages).to.have.length(2);

      function onMessage(routingKey, msg) {
        messages.push(msg);
        if (routingKey === 'test.2') queue.cancel(msg.fields.consumerTag);
      }
    });

    it('prefetch is pretty pointless', () => {
      const messages = [];

      const queue = new Queue();
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});
      queue.queueMessage({routingKey: 'test.3'});
      queue.queueMessage({routingKey: 'test.4'});

      queue.consume(onMessage, {noAck: true});

      queue.queueMessage({routingKey: 'test.5'});

      expect(messages).to.have.length(5);

      function onMessage(routingKey, msg) {
        messages.push(msg);
        if (routingKey === 'test.2') expect(messages.length).to.equal(2);
      }
    });
  });

  describe('ackAll()', () => {
    it('acks all consumed messages', () => {
      const queue = new Queue();
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});

      const consumer = queue.consume(onMessage, {prefetch: 2});

      expect(consumer.messageCount).to.equal(2);

      consumer.ackAll();

      expect(consumer.messageCount).to.equal(0);
      expect(queue.messageCount).to.equal(0);

      function onMessage() {}
    });
  });

  describe('nackAll()', () => {
    it('requeues all consumed messages', () => {
      const queue = new Queue();
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});

      const consumer = queue.consume(onMessage, {prefetch: 2});

      expect(consumer.messageCount).to.equal(2);

      consumer.nackAll();

      expect(queue.messageCount, 'queue messageCount').to.equal(2);

      function onMessage() {}
    });

    it('removes all consumed messages if called with falsey requeue', () => {
      const queue = new Queue();
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});

      const consumer = queue.consume(onMessage, {prefetch: 2});

      expect(consumer.messageCount).to.equal(2);

      consumer.nackAll(false);

      expect(queue.messageCount, 'queue messageCount').to.equal(0);

      function onMessage() {}
    });

    it('consumes next message in queue after nackAll with falsey requeue', () => {
      const messages = [];

      const queue = new Queue();
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});

      const consumer = queue.consume(onMessage, {prefetch: 2});

      expect(consumer.messageCount).to.equal(2);

      consumer.nackAll(false);

      queue.queueMessage({routingKey: 'test.3'});

      expect(messages).to.eql(['test.1', 'test.2', 'test.3']);

      function onMessage(routingKey) {
        messages.push(routingKey);
      }
    });
  });

  describe('cancel()', () => {
    it('stops consuming messages from queue', () => {
      const messages = [];

      const queue = new Queue();
      queue.queueMessage({routingKey: 'test.1'});

      const consumer = queue.consume(onMessage);

      consumer.cancel();

      queue.queueMessage({routingKey: 'test.2'});

      expect(messages).to.have.length(1);
      expect(messages[0].fields).to.have.property('routingKey', 'test.1');

      function onMessage(routingKey, msg) {
        messages.push(msg);
      }
    });

    it('returns message to queue', () => {
      const messages = [];

      const queue = new Queue(null, {autoDelete: false});
      queue.queueMessage({routingKey: 'test.1'});

      const consumer = queue.consume(onMessage, {consumerTag: 'test-consumer'});

      consumer.cancel();

      queue.queueMessage({routingKey: 'test.2'});

      expect(queue).to.have.property('messageCount', 2);

      function onMessage(routingKey, msg) {
        messages.push(msg);
      }
    });

    it('resets message consumerTag', () => {
      const queue = new Queue(null, {autoDelete: false});
      queue.queueMessage({routingKey: 'test.1'});

      const consumer = queue.consume(onMessage, {consumerTag: 'test-consumer'});

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
});
