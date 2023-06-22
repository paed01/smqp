import { Exchange, EventExchange } from '../../src/Exchange.js';
import { Queue } from '../../src/Queue.js';

describe('Exchange', () => {
  describe('ctor', () => {
    it('requires name', () => {
      const exchange = Exchange('event');
      expect(exchange).to.have.property('name', 'event');
    });

    it('throws if name is not passed', () => {
      expect(() => {
        Exchange();
      }).to.throw();
    });

    it('defaults to topic', () => {
      const exchange = Exchange('event');
      expect(exchange).to.have.property('type', 'topic');
    });

    it('throws if type is not topic or direct', () => {
      expect(() => {
        Exchange('event', 'mopic');
      }).to.throw();
      expect(() => {
        Exchange('event', {});
      }).to.throw();
    });

    it('event exchange generates name if missing', () => {
      expect(EventExchange().name).to.be.ok;
    });
  });

  describe('direct exchange', () => {
    it('delivers message to a single queue', () => {
      const exchange = new Exchange('test', 'direct');
      const queue = new Queue('test-q');
      exchange.bindQueue(queue, 'test.#');

      const messages = [];

      exchange.publish('live');
      exchange.publish('test.1');
      exchange.publish('test.2');
      exchange.publish('test.3');

      queue.consume(onMessage);

      expect(messages).to.eql([
        'test.1',
        'test.2',
        'test.3',
        'test.4',
      ]);

      function onMessage(routingKey, msg) {
        messages.push(routingKey);
        if (routingKey === 'test.1') exchange.publish('test.4');
        msg.ack();
      }
    });

    it('load balances messages in sequence to multiple queues', () => {
      const exchange = Exchange('test', 'direct');

      const queue1 = new Queue('test1-q');
      const queue2 = new Queue('test2-q');

      exchange.bindQueue(queue1, 'test.#');
      exchange.bindQueue(queue2, 'test.#');

      const messages1 = [];
      const messages2 = [];

      queue1.consume(onMessage1);
      queue2.consume(onMessage2);

      exchange.publish('test.1.1');
      exchange.publish('test.1.2');
      exchange.publish('test.2.1');
      exchange.publish('test.2.2');

      expect(messages1.map(({ fields }) => fields.routingKey)).to.eql([
        'test.1.1',
        'test.2.1',
      ]);

      expect(messages2.map(({ fields }) => fields.routingKey)).to.eql([
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
      const exchange = Exchange('event', 'topic');

      const queue = new Queue('event-q');
      exchange.bindQueue(queue, 'test.#');

      const messages = [];

      exchange.publish('live');
      exchange.publish('test.1');
      exchange.publish('test.2');
      exchange.publish('test.3');

      queue.consume(onMessage);

      expect(messages).to.eql([
        'test.1',
        'test.2',
        'test.3',
        'test.4',
      ]);

      function onMessage(routingKey, msg) {
        messages.push(routingKey);
        if (routingKey === 'test.1') exchange.publish('test.4');
        msg.ack();
      }
    });

    it('sends copy of message to each queue', () => {
      const exchange = Exchange('event', 'topic');

      const queue1 = new Queue('event1-q');
      const queue2 = new Queue('event2-q');
      exchange.bindQueue(queue1, 'test.#');
      exchange.bindQueue(queue2, 'test.#');

      const messages1 = [];
      const messages2 = [];

      queue1.consume(onMessage1);
      queue2.consume(onMessage2);

      exchange.publish('test.1.1');
      exchange.publish('test.1.2');
      exchange.publish('test.2.1');
      exchange.publish('test.2.2');

      expect(messages1.map(({ fields }) => fields.routingKey)).to.eql([
        'test.1.1',
        'test.1.2',
        'test.2.1',
        'test.2.2',
      ]);

      expect(messages2.map(({ fields }) => fields.routingKey)).to.eql([
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

    it('sends copy of message to each queue in sequence', (done) => {
      const exchange = Exchange('event', 'topic');

      const queue1 = new Queue('event1-q');
      const queue2 = new Queue('event2-q');
      const doneQueue = new Queue('done-q');
      exchange.bindQueue(queue1, 'test.#');
      exchange.bindQueue(queue2, 'test.#');
      exchange.bindQueue(doneQueue, '#');

      const messages1 = [];
      const messages2 = [];

      queue1.consume(onMessage1);
      queue2.consume(onMessage2);
      doneQueue.consume(assertMessages);

      exchange.publish('test.1');

      function onMessage1(routingKey, message) {
        messages1.push(message);
        message.ack();
        if (routingKey === 'test.1') {
          exchange.publish('test.2');
        }
      }

      function onMessage2(routingKey, message) {
        messages2.push(message);
        message.ack();
        if (routingKey === 'test.2') {
          exchange.publish('done');
        }
      }

      function assertMessages(key, message) {
        if (key !== 'done') return message.ack();
        expect(messages1.map(({ fields }) => fields.routingKey)).to.eql([
          'test.1',
          'test.2',
        ]);

        expect(messages2.map(({ fields }) => fields.routingKey)).to.eql([
          'test.1',
          'test.2',
        ]);

        done();
      }
    });
  });

  describe('bindQueue(queue, pattern)', () => {
    it('ups bindingCount', () => {
      const exchange = Exchange('event', 'topic');
      exchange.bindQueue(new Queue('event-q', { durable: true }), 'test.#');
      expect(exchange.bindingCount).to.equal(1);
    });

    it('same queue and pattern is ignored', () => {
      const exchange = Exchange('event', 'topic');
      const queue = new Queue('event-q', { durable: true });
      exchange.bindQueue(queue, 'test.#');
      exchange.bindQueue(queue, 'test.#');
      expect(exchange.bindingCount).to.equal(1);
    });

    it('same queue and different pattern is honored', () => {
      const exchange = Exchange('event', 'topic');
      const queue = new Queue('event-q', { durable: true });
      exchange.bindQueue(queue, 'test.#');
      exchange.bindQueue(queue, 'test.*');
      expect(exchange.bindingCount).to.equal(2);
    });

    it('emits event with binding', () => {
      let event;
      const exchange = Exchange('event', 'topic');

      exchange.on('*', onEvent);

      const queue = new Queue();
      const binding = exchange.bindQueue(queue, 'test.#');

      expect(event).to.be.ok;
      expect(event.fields).to.have.property('routingKey', 'exchange.bind');
      expect(event.content === binding, 'content is binding').to.be.true;

      function onEvent(_, message) {
        event = message;
      }
    });
  });

  describe('unbindQueue(queue, pattern)', () => {
    it('reduce bindingCount', () => {
      const exchange = Exchange('event', 'topic');
      const queue = new Queue('event-q', { durable: true });
      exchange.bindQueue(queue, 'test.#');
      exchange.unbindQueue(queue, 'test.#');
      expect(exchange.bindingCount).to.equal(0);
    });

    it('same queue and different pattern is kept', () => {
      const exchange = Exchange('event', 'topic');
      const queue = new Queue('event-q', { durable: true });
      exchange.bindQueue(queue, 'test.#');
      exchange.bindQueue(queue, 'test.*');
      exchange.unbindQueue(queue, 'test.#');
      expect(exchange.bindingCount).to.equal(1);
    });

    it('twice is ignored', () => {
      const exchange = Exchange('event', 'topic');
      const queue = new Queue('event-q', { durable: true });
      exchange.bindQueue(queue, 'test.#');
      exchange.unbindQueue(queue, 'test.#');
      exchange.unbindQueue(queue, 'test.#');
      expect(exchange.bindingCount).to.equal(0);
    });

    it('emits event with binding', () => {
      let event;
      const exchange = Exchange('event', 'topic');

      exchange.on('unbind', onEvent);

      const queue = new Queue();
      const binding = exchange.bindQueue(queue, 'test.#');

      exchange.unbindQueue(queue, 'test.#');

      expect(event).to.be.ok;
      expect(event.fields).to.have.property('routingKey', 'exchange.unbind');
      expect(event.content === binding, 'content is binding').to.be.true;

      function onEvent(_, message) {
        event = message;
      }
    });

    it('unbind in message callback', () => {
      let event;
      const exchange = Exchange('event', 'topic');

      exchange.on('unbind', onEvent);

      const queue = new Queue();
      const binding = exchange.bindQueue(queue, 'test.#');
      queue.consume(() => {
        binding.close();
      });

      exchange.publish('test.1');

      expect(event).to.be.ok;
      expect(event.fields).to.have.property('routingKey', 'exchange.unbind');
      expect(event.content === binding, 'content is binding').to.be.true;

      function onEvent(_, message) {
        event = message;
      }
    });

    it('unbind in bind event', () => {
      let event;
      const exchange = Exchange('event', 'topic');
      const queue = new Queue();

      exchange.on('unbind', onEvent);
      exchange.on('bind', () => {
        exchange.unbindQueue(queue, 'test.#');
      });

      const binding = exchange.bindQueue(queue, 'test.#');
      queue.consume(() => {
        binding.close();
      });

      exchange.publish('test.1');

      expect(event).to.be.ok;
      expect(event.fields).to.have.property('routingKey', 'exchange.unbind');
      expect(event.content === binding, 'content is binding').to.be.true;

      function onEvent(_, message) {
        event = message;
      }
    });
  });

  describe('publish', () => {
    it('topic mandatory message emits "return" if not routed to any queue', () => {
      const exchange = Exchange('event', 'topic');
      let returnMsg;
      exchange.on('return', (_, { content }) => {
        returnMsg = content;
      });

      exchange.publish('test.1', 'important', { mandatory: true });

      expect(returnMsg).to.be.ok;
      expect(returnMsg).to.have.property('fields').that.include({
        routingKey: 'test.1',
        exchange: 'event',
      });
      expect(returnMsg).to.have.property('content', 'important');
    });

    it('direct mandatory message emits "return" if not routed to any queue', () => {
      const exchange = Exchange('balance', 'direct');
      let returnMsg;
      exchange.on('return', (_, { content }) => {
        returnMsg = content;
      });

      exchange.publish('test.1', 'important', { mandatory: true });

      expect(returnMsg).to.be.ok;
      expect(returnMsg).to.have.property('fields').that.include({
        routingKey: 'test.1',
        exchange: 'balance',
      });
      expect(returnMsg).to.have.property('content', 'important');
    });
  });

  describe('getState()', () => {
    it('returns name, type, and options', () => {
      const exchange = Exchange('event', 'topic', { durable: true });
      const state = exchange.getState();
      expect(state).to.have.property('name', 'event');
      expect(state).to.have.property('type', 'topic');
      expect(state).to.have.property('options').that.eql({ durable: true, autoDelete: true });
    });

    it('returns bindings with queue name and pattern', () => {
      const exchange = Exchange('event', 'topic');
      exchange.bindQueue(new Queue('event-q', { durable: true }), 'test.#');

      const state = exchange.getState();
      expect(state).to.have.property('bindings');
      expect(state.bindings).to.have.length(1);
      expect(state.bindings[0]).to.have.property('queueName', 'event-q');
      expect(state.bindings[0]).to.have.property('pattern', 'test.#');
    });

    it('returns only bindings with durables queues', () => {
      const exchange = Exchange('event', 'topic');
      exchange.bindQueue(new Queue('event-q', { durable: true }), 'test.#');
      exchange.bindQueue(new Queue('tmp-q', { durable: false }), 'test.#');

      const state = exchange.getState();
      expect(state).to.have.property('bindings');
      expect(state.bindings).to.have.length(1);
      expect(state.bindings[0]).to.have.property('queueName', 'event-q');
      expect(state.bindings[0]).to.have.property('pattern', 'test.#');
    });
  });

  describe('stop()', () => {
    it('stops publishing messages to topic exchange', () => {
      const exchange = Exchange('event', 'topic');
      const queue = new Queue('event-q', { durable: true });
      exchange.bindQueue(queue, 'test.#');
      exchange.publish('test.1');
      exchange.stop();
      exchange.publish('test.2');

      expect(queue.messageCount).to.equal(1);
    });

    it('stop in message callback stops publishing messages to topic exchange', () => {
      const exchange = Exchange('event', 'topic');
      const queue = new Queue('event-q', { durable: true });
      exchange.bindQueue(queue, 'test.#');

      queue.consume(() => {
        exchange.stop();
      });

      exchange.publish('test.1');
      exchange.publish('test.2');

      expect(queue.messageCount).to.equal(1);
    });

    it('stops publishing messages to direct exchange', () => {
      const exchange = Exchange('balance', 'direct');
      const queue = new Queue('balance-q', { durable: true });
      exchange.bindQueue(queue, 'test.#');
      exchange.publish('test.1');
      exchange.stop();
      exchange.publish('test.2');

      expect(queue.messageCount).to.equal(1);
    });

    it('stop in message callback stops publishing messages to direct exchange', () => {
      const exchange = Exchange('balance', 'direct');
      const queue = new Queue('balance-q', { durable: true });
      exchange.bindQueue(queue, 'test.#');

      queue.consume(() => {
        exchange.stop();
      });

      exchange.publish('test.1');
      exchange.publish('test.2');

      expect(queue.messageCount).to.equal(1);
    });
  });

  describe('recover()', () => {
    it('recovers stopped topic exchange without state', () => {
      const exchange = Exchange('event', 'topic');
      const queue = new Queue('event-q', { durable: true });
      exchange.bindQueue(queue, 'test.#');

      exchange.publish('test.1');
      exchange.publish('test.2');

      exchange.stop();

      exchange.publish('test.3');

      expect(queue.messageCount).to.equal(2);

      exchange.recover();

      exchange.publish('test.3');

      expect(queue.messageCount).to.equal(3);
    });

    it('recovers stopped topic exchange with state', () => {
      const exchange = Exchange('event', 'topic');
      const queue = new Queue('event-q', { durable: true });
      exchange.bindQueue(queue, 'test.#');

      exchange.publish('test.1', 'data', { contentType: 'text/plain' });
      exchange.publish('test.2', { data: 1 }, { contentType: 'application/json' });

      exchange.stop();

      const state = exchange.getState();
      const recovered = Exchange('event-recovered').recover(state, () => queue);

      recovered.publish('test.3');

      expect(recovered.name).to.equal('event-recovered');
      expect(queue.messageCount).to.equal(3);
    });

    it('recovers stopped direct exchange without state', () => {
      const exchange = Exchange('balance', 'direct');
      const queue = new Queue('balance-q', { durable: true });
      exchange.bindQueue(queue, 'test.#');

      exchange.publish('test.1');
      exchange.publish('test.2');

      exchange.stop();

      exchange.publish('test.3');

      expect(queue.messageCount).to.equal(2);

      exchange.recover();

      exchange.publish('test.3');

      expect(queue.messageCount).to.equal(3);
    });

    it('recovers stopped direct exchange with state', () => {
      const exchange = Exchange('balance', 'direct');
      const queue = new Queue('balance-q', { durable: true });
      exchange.bindQueue(queue, 'test.#');

      exchange.publish('test.1', 'data', { contentType: 'text/plain' });
      exchange.publish('test.2', { data: 1 }, { contentType: 'application/json' });

      exchange.stop();

      const state = exchange.getState();
      state.name = 'balance-recovered';

      exchange.recover(state, () => queue);

      exchange.publish('test.3');

      expect(exchange.name).to.equal('balance');
      expect(queue.messageCount).to.equal(3);
    });

    it('recover in message callback continues publishing messages to topic exchange', () => {
      const exchange = Exchange('event', 'topic');
      const queue = new Queue('event-q', { durable: true });
      exchange.bindQueue(queue, 'test.#');

      queue.consume(() => {
        exchange.stop();

        exchange.publish('test.ignored');

        exchange.recover();
        exchange.publish('test.2');
      });

      exchange.publish('test.1');

      expect(queue.messages.map(({ fields }) => fields.routingKey)).to.eql([ 'test.1', 'test.2' ]);
    });

    it('recover multiple bindings in message callback continues publishing messages to topic exchange', () => {
      const exchange = Exchange('event', 'topic');
      const queue1 = new Queue('event1-q', { durable: true });
      const queue2 = new Queue('event2-q', { durable: true });
      exchange.bindQueue(queue1, 'test.#');
      exchange.bindQueue(queue2, 'test.#');

      queue1.consume(() => {
        exchange.stop();

        exchange.publish('test.ignored');

        exchange.recover();
        exchange.publish('test.2');
      });

      exchange.publish('test.1');

      expect(queue1.messages.map(({ fields }) => fields.routingKey)).to.eql([ 'test.1', 'test.2' ]);
      expect(queue2.messages.map(({ fields }) => fields.routingKey)).to.eql([ 'test.1', 'test.2' ]);
    });

    it('recover in message callback continues publishing messages to direct exchange', () => {
      const exchange = Exchange('balance', 'direct');
      const queue = new Queue('balance-q', { durable: true });
      exchange.bindQueue(queue, 'test.#');

      queue.consume(() => {
        exchange.stop();

        exchange.publish('test.ignored');

        exchange.recover();
        exchange.publish('test.2');
      });

      exchange.publish('test.1');
      expect(queue.messages.map(({ fields }) => fields.routingKey)).to.eql([ 'test.1', 'test.2' ]);
    });

    it('recover multiple bindings in message callback continues publishing messages to direct exchange', () => {
      const exchange = Exchange('balance', 'direct');
      const queue1 = new Queue('balance1-q', { durable: true });
      const queue2 = new Queue('balance2-q', { durable: true });
      exchange.bindQueue(queue1, 'test.#');
      exchange.bindQueue(queue2, 'test.#');

      queue1.consume(() => {
        exchange.stop();

        exchange.publish('test.ignored');

        exchange.recover();
        exchange.publish('test.2');
        exchange.publish('test.3');
        exchange.publish('test.4');
      });

      exchange.publish('test.1');

      expect(queue1.messages.map(({ fields }) => fields.routingKey)).to.eql([ 'test.1', 'test.3' ]);
      expect(queue2.messages.map(({ fields }) => fields.routingKey)).to.eql([ 'test.2', 'test.4' ]);
    });

    it('recovers closed direct exchange with state', () => {
      const exchange = Exchange('balance', 'direct');
      const queue = new Queue('balance-q', { durable: true });
      exchange.bindQueue(queue, 'test.#');

      exchange.publish('test.1');
      exchange.publish('test.2');

      const state = exchange.getState();
      exchange.close();

      exchange.publish('test.3');

      expect(queue.messageCount).to.equal(2);

      exchange.recover(state, () => queue);
      expect(exchange).to.have.property('name', 'balance');
      expect(exchange).to.have.property('type', 'direct');
      expect(exchange).to.have.property('bindingCount', 1);

      exchange.publish('test.3');

      expect(queue.messageCount).to.equal(3);
    });

    it('recovers closed topic exchange with state', () => {
      const exchange = Exchange('balance', 'topic');
      const queue = new Queue('balance-q', { durable: true });
      exchange.bindQueue(queue, 'test.#');

      exchange.publish('test.1');
      exchange.publish('test.2');

      const state = exchange.getState();
      exchange.close();

      exchange.publish('test.3');

      expect(queue.messageCount).to.equal(2);

      exchange.recover(state, () => queue);
      expect(exchange).to.have.property('name', 'balance');
      expect(exchange).to.have.property('type', 'topic');
      expect(exchange).to.have.property('bindingCount', 1);

      exchange.publish('test.3');

      expect(queue.messageCount).to.equal(3);
    });
  });

  describe('events', () => {
    it('emits event when binding is unbound with binding and exchange', () => {
      let event;
      const exchange = Exchange('event', 'topic');

      exchange.on('unbind', onEvent);

      const queue = new Queue('event-q');
      exchange.bindQueue(queue, 'test.#');
      exchange.unbindQueue(queue, 'test.#');

      expect(event).to.be.ok;
      expect(event.fields).to.have.property('routingKey', 'exchange.unbind');
      expect(event.content.queue).to.have.property('name', 'event-q');

      function onEvent(_, message) {
        event = message;
      }
    });

    it('autoDelete emits delete when bindings drops to zero', () => {
      let event;
      const exchange = Exchange('event', 'topic', { autoDelete: true });

      exchange.on('delete', onEvent);

      const queue = new Queue('event-q');
      exchange.bindQueue(queue, 'test.#');
      exchange.unbindQueue(queue, 'test.#');

      expect(event).to.be.ok;
      expect(event.fields).to.have.property('routingKey', 'exchange.delete');
      expect(event.content).to.have.property('name', 'event');

      function onEvent(eventName, message) {
        event = message;
      }
    });

    it('events can be offed', () => {
      let event;
      const exchange = Exchange('event', 'topic', { autoDelete: true });

      exchange.on('delete', onEvent);
      exchange.off('delete', onEvent);

      const queue = new Queue('event-q');
      exchange.bindQueue(queue, 'test.#');
      exchange.unbindQueue(queue, 'test.#');

      expect(event).to.not.be.ok;

      function onEvent(eventName, message) {
        event = message;
      }
    });

    it('events can be offed by consumerTag', () => {
      let event;
      const exchange = Exchange('event', 'topic', { autoDelete: true });

      exchange.on('delete', onEvent, { consumerTag: 'off-tag' });
      exchange.off('delete', { consumerTag: 'off-tag' });

      const queue = new Queue('event-q');
      exchange.bindQueue(queue, 'test.#');
      exchange.unbindQueue(queue, 'test.#');

      expect(event).to.not.be.ok;

      function onEvent(eventName, message) {
        event = message;
      }
    });

    it('events can be offed even if they are not on', () => {
      let event;
      const exchange = Exchange('event', 'topic', { autoDelete: true });
      exchange.off('delete', onEvent);

      const queue = new Queue('event-q');
      exchange.bindQueue(queue, 'test.#');
      exchange.unbindQueue(queue, 'test.#');

      expect(event).to.not.be.ok;

      function onEvent(eventName, message) {
        event = message;
      }
    });
  });

  describe('getBinding(queueName, pattern)', () => {
    it('finds binding matching queue and pattern', () => {
      const exchange = Exchange('event', 'topic', { autoDelete: true });
      const queue = new Queue('event-q');
      exchange.bindQueue(queue, 'event.#');

      const binding = exchange.getBinding('event-q', 'event.#');
      expect(binding).to.be.ok;
    });

    it('return nothing if no binding was found', () => {
      const exchange = Exchange('event', 'topic', { autoDelete: true });

      expect(exchange.getBinding('event-q', 'event.#')).to.not.be.ok;

      const queue = new Queue('event-q');
      exchange.bindQueue(queue, 'event.#');

      expect(exchange.getBinding('other-q', 'event.#')).to.not.be.ok;
    });
  });
});
