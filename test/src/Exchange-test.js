import {Consumer} from '../../src/Consumer';
import {Exchange} from '../../src/Exchange';
import {Queue} from '../../src/Queue';

describe('Exchange', () => {
  describe('ctorish', () => {
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
  });

  describe('direct exchange', () => {
    it('delivers message to a single queue', () => {
      const exchange = Exchange('test', 'direct');
      const queue = Queue('test-q');
      exchange.bind(queue, 'test.#');

      const messages = [];

      exchange.publish('live');
      exchange.publish('test.1');
      exchange.publish('test.2');
      exchange.publish('test.3');

      Consumer(queue, onMessage).consume();

      expect(messages).to.eql([
        'test.1',
        'test.2',
        'test.3',
        'test.4',
      ]);

      function onMessage(routingKey, {ack}) {
        messages.push(routingKey);
        if (routingKey === 'test.1') exchange.publish('test.4');
        ack();
      }
    });

    it('load balances messages in sequence to multiple queues', () => {
      const exchange = Exchange('test', 'direct');

      const queue1 = Queue('test1-q');
      const queue2 = Queue('test2-q');

      exchange.bind(queue1, 'test.#');
      exchange.bind(queue2, 'test.#');

      const messages1 = [];
      const messages2 = [];

      Consumer(queue1, onMessage1);
      Consumer(queue2, onMessage2);

      exchange.publish('test.1.1');
      exchange.publish('test.1.2');
      exchange.publish('test.2.1');
      exchange.publish('test.2.2');

      expect(messages1.map(({fields}) => fields.routingKey)).to.eql([
        'test.1.1',
        'test.2.1',
      ]);

      expect(messages2.map(({fields}) => fields.routingKey)).to.eql([
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

      const queue = Queue('event-q');
      exchange.bind(queue, 'test.#');

      const messages = [];

      exchange.publish('live');
      exchange.publish('test.1');
      exchange.publish('test.2');
      exchange.publish('test.3');

      Consumer(queue, onMessage).consume();

      expect(messages).to.eql([
        'test.1',
        'test.2',
        'test.3',
        'test.4',
      ]);

      function onMessage(routingKey, {ack}) {
        messages.push(routingKey);
        if (routingKey === 'test.1') exchange.publish('test.4');
        ack();
      }
    });

    it('sends copy of message to each queue', () => {
      const exchange = Exchange('event', 'topic');

      const queue1 = Queue('event1-q');
      const queue2 = Queue('event2-q');
      exchange.bind(queue1, 'test.#');
      exchange.bind(queue2, 'test.#');

      const messages1 = [];
      const messages2 = [];

      Consumer(queue1, onMessage1).consume();
      Consumer(queue2, onMessage2).consume();

      exchange.publish('test.1.1');
      exchange.publish('test.1.2');
      exchange.publish('test.2.1');
      exchange.publish('test.2.2');

      expect(messages1.map(({fields}) => fields.routingKey)).to.eql([
        'test.1.1',
        'test.1.2',
        'test.2.1',
        'test.2.2',
      ]);

      expect(messages2.map(({fields}) => fields.routingKey)).to.eql([
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

      const queue1 = Queue('event1-q');
      const queue2 = Queue('event2-q');
      const doneQueue = Queue('done-q');
      exchange.bind(queue1, 'test.#');
      exchange.bind(queue2, 'test.#');
      exchange.bind(doneQueue, '#');

      const messages1 = [];
      const messages2 = [];

      Consumer(queue1, onMessage1).consume();
      Consumer(queue2, onMessage2).consume();
      Consumer(doneQueue, assertMessages).consume();

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

        expect(messages1.map(({fields}) => fields.routingKey)).to.eql([
          'test.1',
          'test.2',
        ]);

        expect(messages2.map(({fields}) => fields.routingKey)).to.eql([
          'test.1',
          'test.2',
        ]);

        done();
      }
    });
  });

  describe('getState()', () => {
    it('returns name, type, and options', () => {
      const exchange = Exchange('event', 'topic', {durable: true});
      const state = exchange.getState();
      expect(state).to.have.property('name', 'event');
      expect(state).to.have.property('type', 'topic');
      expect(state).to.have.property('options').that.eql({durable: true, autoDelete: true});
    });

    it('returns bindings with queue name and pattern', () => {
      const exchange = Exchange('event', 'topic');
      exchange.bind(Queue('event-q', {durable: true}), 'test.#');

      const state = exchange.getState();
      expect(state).to.have.property('bindings');
      expect(state.bindings).to.have.length(1);
      expect(state.bindings[0]).to.have.property('queueName', 'event-q');
      expect(state.bindings[0]).to.have.property('pattern', 'test.#');
    });

    it('returns only bindings with durables queues', () => {
      const exchange = Exchange('event', 'topic');
      exchange.bind(Queue('event-q', {durable: true}), 'test.#');
      exchange.bind(Queue('tmp-q', {durable: false}), 'test.#');

      const state = exchange.getState();
      expect(state).to.have.property('bindings');
      expect(state.bindings).to.have.length(1);
      expect(state.bindings[0]).to.have.property('queueName', 'event-q');
      expect(state.bindings[0]).to.have.property('pattern', 'test.#');
    });
  });

  describe('stop()', () => {
    it('stops publishing messages', () => {
      const exchange = Exchange('event', 'topic');
      const queue = Queue('event-q', {durable: true});
      exchange.bind(queue, 'test.#');
      exchange.publish('test.1');
      exchange.stop();
      exchange.publish('test.2');

      expect(queue.messageCount).to.equal(1);
    });
  });

  describe('recover()', () => {
    it('recovers stopped without state', () => {
      const exchange = Exchange('event', 'topic');
      const queue = Queue('event-q', {durable: true});
      exchange.bind(queue, 'test.#');

      exchange.publish('test.1');
      exchange.publish('test.2');

      exchange.stop();

      exchange.publish('test.3');

      expect(queue.messageCount).to.equal(2);

      exchange.recover();

      exchange.publish('test.3');

      expect(queue.messageCount).to.equal(3);
    });

    it('recovers stopped with state', () => {
      const exchange = Exchange('event', 'topic');
      const queue = Queue('event-q', {durable: true});
      exchange.bind(queue, 'test.#');

      exchange.publish('test.1', 'data', {contentType: 'text/plain'});
      exchange.publish('test.2', {data: 1}, {contentType: 'application/json'});

      exchange.stop();

      const state = exchange.getState();
      state.name = 'event-recovered';

      exchange.recover(state, () => queue);

      exchange.publish('test.3');

      expect(exchange.name).to.equal('event-recovered');
      expect(queue.messageCount).to.equal(3);
    });
  });
});
