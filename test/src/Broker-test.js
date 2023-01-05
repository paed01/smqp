import {Broker} from '../../src/Broker.js';

describe('Broker', () => {
  describe('coverage', () => {
    it('cancels consumer once', () => {
      const broker = Broker();
      const queue = broker.assertQueue('test-q', {autoDelete: false});
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

      const shovel = broker.createShovel('shovel-1', {
        exchange: 'event',
      }, {
        broker: destination,
        exchange: 'event',
      });

      shovel.emit('close', shovel);

      expect(broker.getShovels()).to.have.length(0);

      shovel.close();

      expect(broker.getShovels()).to.have.length(0);
    });
  });
});
