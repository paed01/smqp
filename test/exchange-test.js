import {Broker} from '../index';

describe('exchange', () => {
  describe('delete()', () => {
    it('deletes exchange from broker', () => {
      const broker = Broker();
      broker.assertExchange('topic');
      const queue = broker.assertQueue('multi');

      broker.bindQueue(queue.name, 'topic', 'event.#');
      broker.bindQueue(queue.name, 'topic', 'load.#');

      broker.deleteExchange('topic');

      expect(broker.getExchange('topic')).to.not.be.ok;
    });
  });

  describe('direct exchange', () => {
    it('delivers message to a single queue', () => {
      const broker = Broker();
      broker.assertExchange('test', 'direct');

      broker.assertQueue('testq');
      broker.bindQueue('testq', 'test', 'test.#');

      const messages = [];

      broker.publish('test', 'live');
      broker.publish('test', 'test.1');
      broker.publish('test', 'test.2');
      broker.publish('test', 'test.3');

      broker.consume('testq', onMessage);

      expect(messages).to.eql([
        'test.1',
        'test.2',
        'test.3',
        'test.4',
      ]);

      function onMessage(routingKey, {ack}) {
        messages.push(routingKey);
        if (routingKey === 'test.1') broker.publish('test', 'test.4');
        ack();
      }
    });

    it('load balances messages in sequence to multiple queues', () => {
      const broker = Broker();
      broker.assertExchange('test', 'direct');

      broker.assertQueue('testq1');
      broker.assertQueue('testq2');
      broker.bindQueue('testq1', 'test', 'test.#');
      broker.bindQueue('testq2', 'test', 'test.#');

      const messages1 = [];
      const messages2 = [];

      broker.consume('testq1', onMessage1);
      broker.consume('testq2', onMessage2);

      broker.publish('test', 'test.1.1');
      broker.publish('test', 'test.1.2');
      broker.publish('test', 'test.2.1');
      broker.publish('test', 'test.2.2');

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
      const broker = Broker();
      broker.assertExchange('test', 'topic');

      broker.assertQueue('testq');
      broker.bindQueue('testq', 'test', 'test.#');

      const messages = [];

      broker.publish('test', 'live');
      broker.publish('test', 'test.1');
      broker.publish('test', 'test.2');
      broker.publish('test', 'test.3');

      broker.consume('testq', onMessage);

      expect(messages).to.eql([
        'test.1',
        'test.2',
        'test.3',
        'test.4',
      ]);

      function onMessage(routingKey, {ack}) {
        messages.push(routingKey);
        if (routingKey === 'test.1') broker.publish('test', 'test.4');
        ack();
      }
    });

    it('sends copy of message to each queue', () => {
      const broker = Broker();
      broker.assertExchange('event', 'topic');

      broker.assertQueue('eventq1');
      broker.assertQueue('eventq2');
      broker.bindQueue('eventq1', 'event', 'test.#');
      broker.bindQueue('eventq2', 'event', 'test.#');

      const messages1 = [];
      const messages2 = [];

      broker.consume('eventq1', onMessage1);
      broker.consume('eventq2', onMessage2);

      broker.publish('event', 'test.1.1');
      broker.publish('event', 'test.1.2');
      broker.publish('event', 'test.2.1');
      broker.publish('event', 'test.2.2');

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
      const broker = Broker();
      broker.assertExchange('event', 'topic');

      broker.assertQueue('eventq1');
      broker.assertQueue('eventq2');
      broker.bindQueue('eventq1', 'event', 'test.*');
      broker.bindQueue('eventq2', 'event', 'test.#');

      broker.assertQueue('done');
      broker.bindQueue('done', 'event', '#');

      const messages1 = [];
      const messages2 = [];

      broker.consume('eventq1', onMessage1);
      broker.consume('eventq2', onMessage2);

      broker.consume('done', assertMessages);

      broker.publish('event', 'test.1');

      function onMessage1(routingKey, message) {
        messages1.push(message);
        message.ack();
        if (routingKey === 'test.1') {
          broker.publish('event', 'test.2');
        }
      }

      function onMessage2(routingKey, message) {
        messages2.push(message);
        message.ack();
        if (routingKey === 'test.2') {
          broker.publish('event', 'done');
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

  describe('autoDelete', () => {
    it('removes exchange when number of bindings drops to zero', () => {
      const broker = Broker();

      broker.assertExchange('test', 'topic', {autoDelete: true});
      broker.assertQueue('test1');
      broker.assertQueue('test2');

      broker.bindQueue('test1', 'test', 'test.*');
      broker.bindQueue('test2', 'test', 'test.#');

      broker.unbindQueue('test1', 'test', 'test.*');
      broker.unbindQueue('test2', 'test', 'test.#');

      expect(broker.getExchange('test')).to.not.be.ok;
    });

    it('removes exchange if deleted queue results in number of bindings drop to zero', () => {
      const broker = Broker();

      broker.assertExchange('test', 'topic', {autoDelete: true});
      broker.assertQueue('test1');

      broker.bindQueue('test1', 'test', 'test.*');
      broker.bindQueue('test1', 'test', 'test.#');

      broker.deleteQueue('test1');

      expect(broker.getExchange('test')).to.not.be.ok;
    });

    it('falsey keeps exchange when number of bindings drops to zero', () => {
      const broker = Broker();

      broker.assertExchange('test', 'topic', {autoDelete: false});
      broker.assertQueue('test1');
      broker.assertQueue('test2');

      broker.bindQueue('test1', 'test', 'test.*');
      broker.bindQueue('test2', 'test', 'test.#');

      broker.unbindQueue('test1', 'test', 'test.*');
      broker.unbindQueue('test2', 'test', 'test.#');

      expect(broker.getExchange('test')).to.be.ok;
    });
  });

  describe('durable', () => {
    it('falsey doesn´t recover exchange', () => {
      const broker1 = Broker();

      broker1.assertExchange('test', 'topic', {durable: false});

      const broker2 = Broker().recover(broker1.getState());

      expect(broker2.getExchange('test')).to.not.be.ok;
    });
  });

  describe('unbindQueueByName(queueName)', () => {
    it('unbinds queue from exchange', () => {
      const broker = Broker();
      const exchange = broker.assertExchange('event', 'topic', {autoDelete: true});

      const consumer = broker.subscribeTmp('event', 'event.#', () => {});

      expect(exchange.bindingCount).to.equal(1);

      exchange.unbindQueueByName(consumer.queueName);

      expect(exchange.bindingCount).to.equal(0);

      expect(broker.exchangeCount).to.equal(0);
    });

    it('ignored if queue not in bound to exchange', () => {
      const broker = Broker();
      const exchange = broker.assertExchange('event', 'topic', {autoDelete: true});

      broker.assertQueue('event-q');
      broker.subscribe('event', 'event-q', 'event.#', () => {});

      expect(exchange.bindingCount).to.equal(1);

      exchange.unbindQueueByName('other-q');

      expect(exchange.bindingCount).to.equal(1);

      expect(broker.exchangeCount).to.equal(1);
    });
  });
});
