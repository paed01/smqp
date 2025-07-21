import { Broker } from 'smqp';

describe('Broker', () => {
  describe('coverage', () => {
    it('cancels consumer once', () => {
      const broker = Broker();
      const queue = broker.assertQueue('test-q', { autoDelete: false });
      const consumer = broker.consume('test-q', () => {});

      queue.emit('consumer.cancel', consumer);
      expect(broker.consumerCount).to.equal(0);

      consumer.cancel();

      expect(broker.consumerCount).to.equal(0);
    });

    it('closes shovel once', () => {
      const broker = Broker();
      broker.assertExchange('event', 'topic');

      const destination = new Broker();
      destination.assertExchange('event', 'topic');

      const shovel = broker.createShovel(
        'shovel-1',
        { exchange: 'event' },
        {
          broker: destination,
          exchange: 'event',
        }
      );

      shovel.emit('close', shovel);

      expect(broker.getShovels()).to.have.length(0);

      shovel.close();

      expect(broker.getShovels()).to.have.length(0);
    });

    it('assertExchange without string name throws', () => {
      const broker = Broker();
      expect(() => broker.assertExchange(null, 'topic')).to.throw(TypeError);
      expect(() => broker.assertExchange(undefined, 'topic')).to.throw(TypeError);
      expect(() => broker.assertExchange({}, 'topic')).to.throw(TypeError);
    });

    it('getExchange without string name throws', () => {
      const broker = Broker();
      expect(() => broker.getExchange(null)).to.throw(TypeError);
      expect(() => broker.getExchange(undefined)).to.throw(TypeError);
      expect(() => broker.getExchange({})).to.throw(TypeError);
    });

    it('deleteExchange without string name throws', () => {
      const broker = Broker();
      expect(() => broker.deleteExchange(null)).to.throw(TypeError);
      expect(() => broker.deleteExchange(undefined)).to.throw(TypeError);
      expect(() => broker.deleteExchange({})).to.throw(TypeError);
    });

    it('assertQueue without string name throws', () => {
      const broker = Broker();
      expect(() => broker.assertQueue({})).to.throw(TypeError);
    });

    it('falsy validateConsumerTag returns true', () => {
      const broker = Broker();
      expect(broker.validateConsumerTag('')).to.be.true;
      expect(broker.validateConsumerTag(false)).to.be.true;
      expect(broker.validateConsumerTag(0)).to.be.true;
      expect(broker.validateConsumerTag(null)).to.be.true;
      expect(broker.validateConsumerTag(undefined)).to.be.true;
    });
  });
});
