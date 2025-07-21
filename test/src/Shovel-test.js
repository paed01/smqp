import { Broker, Shovel } from 'smqp';

describe('Shovel', () => {
  describe('ctor', () => {
    it('throws if name is not passed', () => {
      expect(() => new Shovel()).to.throw(TypeError, /name/);
    });

    it('throws if name is not a string', () => {
      expect(() => new Shovel({})).to.throw(TypeError, /name/);
    });
  });

  describe('.name', () => {
    it('name cannot be changed', () => {
      const source = new Broker();
      source.assertExchange('events', 'topic');

      const dest = new Broker();
      dest.assertExchange('events', 'topic');

      const shovel = new Shovel('spade', { broker: source, exchange: 'events' }, { broker: dest, exchange: 'events' });

      expect(() => (shovel.name = 'my-name')).to.throw(TypeError);
    });
  });
});
