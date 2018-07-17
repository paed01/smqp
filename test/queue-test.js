import {Broker} from '../index';

describe('queue', () => {
  describe('.bindings', () => {
    it('keeps reference to exchange binding', () => {
      const broker = Broker();
      broker.assertExchange('event');
      const topic = broker.assertExchange('topic');

      const queue = broker.assertQueue('q');

      broker.bindQueue(queue.name, 'topic', '#');

      expect(queue.bindings).to.have.length(1);
      expect(queue.bindings[0].exchange === topic).to.be.true;
    });

    it('keeps reference to multiple exchange bindings', () => {
      const broker = Broker();
      broker.assertExchange('event');
      const topic = broker.assertExchange('topic');
      const direct = broker.assertExchange('direct', 'direct');

      const queue = broker.assertQueue('multi');

      broker.bindQueue(queue.name, 'topic', '#');
      broker.bindQueue(queue.name, 'direct', '#');

      expect(queue.bindings).to.have.length(2);
      expect(queue.bindings[0].exchange === topic).to.be.true;
      expect(queue.bindings[1].exchange === direct).to.be.true;
    });

    it('keeps reference to different pattern bindings exchange', () => {
      const broker = Broker();
      broker.assertExchange('topic');

      const queue = broker.assertQueue('multi');

      broker.bindQueue(queue.name, 'topic', 'event.#');
      broker.bindQueue(queue.name, 'topic', 'load.#');

      expect(queue.bindings).to.have.length(2);
    });

    it('close referenced binding removes binding from queue and exchange', () => {
      const broker = Broker();
      const topic = broker.assertExchange('topic');
      const queue = broker.assertQueue('multi');

      broker.bindQueue(queue.name, 'topic', 'event.#');
      broker.bindQueue(queue.name, 'topic', 'load.#');

      expect(queue.bindings).to.have.length(2);
      queue.bindings[0].close();

      expect(topic.bindings).to.have.length(1);
      expect(queue.bindings).to.have.length(1);
    });

    it('removes bindings if exchange is deleted', () => {
      const broker = Broker();
      const topic = broker.assertExchange('topic');
      const queue = broker.assertQueue('multi');

      broker.bindQueue(queue.name, 'topic', 'event.#');
      broker.bindQueue(queue.name, 'topic', 'load.#');

      expect(queue.bindings).to.have.length(2);

      broker.deleteExchange(topic.name);

      expect(queue.bindings).to.have.length(0);
    });

    it('close all referenced bindings removes bindings from queue and exchange', () => {
      const broker = Broker();
      const topic = broker.assertExchange('topic');
      const queue = broker.assertQueue('multi');

      broker.bindQueue(queue.name, 'topic', 'event.#');
      broker.bindQueue(queue.name, 'topic', 'load.#');

      expect(queue.bindings).to.have.length(2);
      queue.bindings[0].close();
      queue.bindings[0].close();

      expect(topic.bindings).to.have.length(0);
      expect(queue.bindings).to.have.length(0);
    });

    it('add binding from different queue throws', () => {
      const broker = Broker();
      broker.assertExchange('topic');
      const queue1 = broker.assertQueue('q1');
      const queue2 = broker.assertQueue('q2');

      broker.bindQueue(queue1.name, 'topic', 'event.#');
      broker.bindQueue(queue2.name, 'topic', 'load.#');

      expect(() => {
        queue1.addBinding(queue2.bindings[0]);
      }).to.throw(Error, /bindings are exclusive/);
    });
  });

  describe('behaviour', () => {
    it('can be bound to multiple exchanges', () => {
      const broker = Broker();
      broker.assertExchange('topic');
      broker.assertExchange('direct', 'direct');

      const queue = broker.assertQueue('multi');

      broker.bindQueue(queue.name, 'topic', '#');
      broker.bindQueue(queue.name, 'direct', '#');

      broker.publish('topic', 'event.1');
      broker.publish('direct', 'load.1');

      expect(queue.length).to.equal(2);
    });

    it('can be bound to same exchange with different pattern', () => {
      const broker = Broker();
      const topic = broker.assertExchange('topic');

      const queue = broker.assertQueue('multi');

      broker.bindQueue(queue.name, 'topic', 'event.*');
      broker.bindQueue(queue.name, 'topic', 'load.*');

      expect(topic.bindingsCount).to.equal(2);

      broker.publish('topic', 'event.1');
      broker.publish('topic', 'load.1');

      expect(queue.length).to.equal(2);
    });

    it('can be unbound from multiple exchanges', () => {
      const broker = Broker();
      const topic = broker.assertExchange('topic', 'topic', {autoDelete: false});
      const direct = broker.assertExchange('direct', 'direct', {autoDelete: true});

      const queue = broker.assertQueue('multi');

      broker.bindQueue(queue.name, 'topic', '#');
      broker.bindQueue(queue.name, 'direct', '#');

      broker.publish('topic', 'event.1');
      broker.publish('direct', 'load.1');

      expect(queue.length).to.equal(2);

      broker.unbindQueue(queue.name, 'topic', '#');

      expect(topic.bindingsCount).to.equal(0);
      expect(direct.bindingsCount).to.equal(1);
    });

    it('deleted queue is unbound from multiple exchanges', () => {
      const broker = Broker();
      const topic = broker.assertExchange('topic', 'topic', {autoDelete: false});
      const direct = broker.assertExchange('direct', 'direct', {autoDelete: true});

      const queue = broker.assertQueue('multi');

      broker.bindQueue(queue.name, 'topic', '#');
      broker.bindQueue(queue.name, 'direct', '#');

      broker.publish('topic', 'event.1');
      broker.publish('direct', 'load.1');

      expect(queue.length).to.equal(2);

      broker.deleteQueue(queue.name);

      expect(topic.bindingsCount).to.equal(0);
      expect(direct.bindingsCount).to.equal(0);
    });

    it('can be unbound from same exchange with different pattern', () => {
      const broker = Broker();
      const topic = broker.assertExchange('topic');

      const queue = broker.assertQueue('multi');

      broker.bindQueue(queue.name, 'topic', 'event.*');
      broker.bindQueue(queue.name, 'topic', 'load.*');

      broker.publish('topic', 'event.1');
      broker.publish('topic', 'load.1');

      broker.unbindQueue(queue.name, 'topic', 'load.*');
      expect(topic.bindingsCount).to.equal(1);

      broker.publish('topic', 'event.2');
      broker.publish('topic', 'load.2');

      expect(queue.length).to.equal(3);
    });

    it('deleted queue is unbound from same exchange different pattern', () => {
      const broker = Broker();
      const topic = broker.assertExchange('topic', 'topic', {autoDelete: false});

      const queue = broker.assertQueue('multi');

      broker.bindQueue(queue.name, 'topic', 'event.#');
      broker.bindQueue(queue.name, 'topic', 'load.#');

      broker.publish('topic', 'event.1');
      broker.publish('topic', 'load.1');

      expect(queue.length).to.equal(2);

      broker.deleteQueue(queue.name);

      expect(topic.bindingsCount).to.equal(0);
    });
  });
});
