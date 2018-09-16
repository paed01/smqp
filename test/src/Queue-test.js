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

  describe('consume()', () => {
    it('returns non-pending messages', () => {
      const queue = Queue();
      queue.queueMessage({routingKey: 'test.1'});

      const msgs = queue.consume();
      expect(msgs[0]).to.have.property('fields').with.property('routingKey', 'test.1');
      expect(msgs[0]).to.have.property('pending', false);
    });

    it('returns first non-pending messages', () => {
      const queue = Queue();
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});

      queue.get();

      const msgs = queue.consume();
      expect(msgs[0]).to.have.property('fields').with.property('routingKey', 'test.2');
      expect(msgs[0]).to.have.property('pending', false);
    });

    it('prefetch option returns messages', () => {
      const queue = Queue();
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});
      queue.queueMessage({routingKey: 'test.3'});
      queue.queueMessage({routingKey: 'test.4'});

      const msgs = queue.consume({prefetch: 2});
      expect(msgs).to.have.length(2);

      expect(msgs[0]).to.have.property('fields').with.property('routingKey', 'test.1');
      expect(msgs[1]).to.have.property('fields').with.property('routingKey', 'test.2');
    });

    it('second consume returns non-pending messages', () => {
      const queue = Queue();
      queue.queueMessage({routingKey: 'test.1'});
      queue.queueMessage({routingKey: 'test.2'});
      queue.queueMessage({routingKey: 'test.3'});
      queue.queueMessage({routingKey: 'test.4'});
      queue.queueMessage({routingKey: 'test.5'});

      const msgs1 = queue.consume({prefetch: 2});
      expect(msgs1).to.have.length(2);
      msgs1.forEach((msg) => msg.consume());

      const msgs2 = queue.consume({prefetch: 3});
      expect(msgs2).to.have.length(3);

      expect(msgs2[0]).to.have.property('fields').with.property('routingKey', 'test.3');
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
      expect(queue.consume()).to.eql([]);
      expect(queue.messageCount).to.equal(2);
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

  describe('empty', () => {
    it('calls onEmpty callback when queue is emptied by message ack', () => {
      let emptied;
      const queue = Queue('test-q', {}, {onEmpty});
      queue.queueMessage({routingKey: 'test.1'});

      queue.get().ack();

      expect(emptied).to.be.true;

      function onEmpty() {
        emptied = true;
      }
    });

    it('calls onEmpty callback when queue is emptied by message nack', () => {
      let emptied;
      const queue = Queue('test-q', {}, {onEmpty});
      queue.queueMessage({routingKey: 'test.1'});

      queue.get().nack(false, false);

      expect(emptied).to.be.true;

      function onEmpty() {
        emptied = true;
      }
    });
  });
});
