import {Broker, Shovel} from '../index';

describe('Shovel', () => {
  describe('behaviour', () => {
    it('shovels message with properies from one broker to an other', () => {
      const broker1 = Broker();
      broker1.assertExchange('source-events', 'topic');

      const broker2 = Broker();
      broker2.assertExchange('dest-events', 'topic');

      const messages = [];
      broker2.subscribeTmp('dest-events', '#', onMessage, {noAck: true});

      Shovel('my-shovel', {broker: broker1, exchange: 'source-events'}, {broker: broker2, exchange: 'dest-events'});

      broker1.publish('source-events', 'test.1', 'snow', {expiration: 10000});

      expect(messages).to.have.length(1);

      const [message] = messages;

      expect(message).to.have.property('fields').with.property('routingKey', 'test.1');
      expect(message).to.have.property('content', 'snow');
      expect(message).to.have.property('properties').with.property('expiration', 10000);

      function onMessage(routingKey, msg) {
        messages.push(msg);
      }
    });

    it('calls cloneMessage function before shoveling message', () => {
      const broker1 = Broker();
      broker1.assertExchange('source-events', 'topic');
      broker1.assertQueue('events-q', {autoDelete: false});

      const broker2 = Broker();
      broker2.assertExchange('dest-events', 'topic');

      const messages = [];
      broker2.subscribeTmp('dest-events', '#', onMessage, {noAck: true});

      Shovel('my-shovel', {
        broker: broker1,
        exchange: 'source-events',
        pattern: 'event.#',
        queue: 'events-q',
      }, {
        broker: broker2,
        exchange: 'dest-events'
      }, (message) => {
        expect(message).to.not.have.property('ack');
        expect(message).to.have.property('fields');
        expect(message).to.have.property('content');
        expect(message).to.have.property('properties');

        return {
          content: JSON.parse(JSON.stringify(message.content)),
          properties: {mandatory: false},
        };
      });
      const content = {
        data: 1,
      };

      broker1.publish('source-events', 'event.1', content, {mandatory: true});

      expect(messages).to.have.length(1);

      const [message] = messages;
      content.data = 2;

      expect(message).to.have.property('fields').with.property('routingKey', 'event.1');
      expect(message).to.have.property('content').with.property('data', 1);
      expect(message).to.have.property('properties').with.property('mandatory', false);

      function onMessage(routingKey, msg) {
        messages.push(msg);
      }
    });

    it('shovels message meeting pattern from one broker to an other', () => {
      const broker1 = Broker();
      broker1.assertExchange('source-events', 'topic');

      const broker2 = Broker();
      broker2.assertExchange('dest-events', 'topic');

      const messages = [];
      broker2.subscribeTmp('dest-events', '#', onMessage, {noAck: true});

      Shovel('my-shovel', {
        broker: broker1,
        exchange: 'source-events',
        pattern: 'event.#',
      }, {
        broker: broker2,
        exchange: 'dest-events'
      });

      broker1.publish('source-events', 'event.1');
      broker1.publish('source-events', 'test.1');

      expect(messages).to.have.length(1);

      function onMessage(routingKey) {
        messages.push(routingKey);
      }
    });

    it('throws if source exchange is missing', () => {
      const broker1 = Broker();
      const broker2 = Broker();
      broker2.assertExchange('dest-events', 'topic');

      expect(() => {
        Shovel('my-shovel', {
          broker: broker1,
          exchange: 'source-events',
        }, {
          broker: broker2,
          exchange: 'dest-events'
        });
      }).to.throw(/source exchange <source-events> not found/);
    });

    it('throws if destination exchange is missing', () => {
      const broker1 = Broker();
      broker1.assertExchange('source-events', 'topic');

      const broker2 = Broker();

      expect(() => {
        Shovel('my-shovel', {
          broker: broker1,
          exchange: 'source-events',
        }, {
          broker: broker2,
          exchange: 'dest-events'
        });
      }).to.throw(/destination exchange <dest-events> not found/);
    });

    it('close() closes shovel', () => {
      const broker1 = Broker();
      broker1.assertExchange('source-events', 'topic');

      const broker2 = Broker();
      broker2.assertExchange('dest-events', 'topic');

      const messages = [];
      broker2.subscribeTmp('dest-events', '#', onMessage, {noAck: true});

      const shovel = Shovel('my-shovel', {
        broker: broker1,
        exchange: 'source-events',
        pattern: 'event.#',
      }, {
        broker: broker2,
        exchange: 'dest-events'
      });

      broker1.publish('source-events', 'event.1');
      broker1.publish('source-events', 'test.1');

      expect(messages).to.have.length(1);

      shovel.close();

      broker1.publish('source-events', 'event.2');

      expect(messages).to.have.length(1);

      function onMessage(routingKey) {
        messages.push(routingKey);
      }
    });

    it('double close() is ok but has no effect', () => {
      const broker1 = Broker();
      broker1.assertExchange('source-events', 'topic');

      const broker2 = Broker();
      broker2.assertExchange('dest-events', 'topic');

      const shovel = Shovel('my-shovel', {
        broker: broker1,
        exchange: 'source-events',
        pattern: 'event.#',
      }, {
        broker: broker2,
        exchange: 'dest-events'
      });

      shovel.close();
      shovel.close();

      expect(shovel).to.have.property('closed', true);
    });

    it('accumulates messages is source queue is passed', () => {
      const broker1 = Broker();
      broker1.assertExchange('source-events', 'topic');
      const eventsQ = broker1.assertQueue('events-q', {autoDelete: false});

      const broker2 = Broker();
      broker2.assertExchange('dest-events', 'topic');

      const messages = [];
      broker2.subscribeTmp('dest-events', '#', onMessage, {noAck: true});

      const shovel = Shovel('my-shovel', {
        broker: broker1,
        exchange: 'source-events',
        pattern: 'event.#',
        queue: 'events-q',
      }, {
        broker: broker2,
        exchange: 'dest-events'
      });

      broker1.publish('source-events', 'event.1');
      broker1.publish('source-events', 'test.1');

      expect(messages).to.have.length(1);

      shovel.close();

      broker1.publish('source-events', 'event.2');

      expect(messages).to.have.length(1);
      expect(eventsQ).to.have.property('messageCount', 1);

      function onMessage(routingKey) {
        messages.push(routingKey);
      }
    });

    it('reintroduced closed shovel with queue continues shoveling queued messages', () => {
      const broker1 = Broker();
      broker1.assertExchange('source-events', 'topic');
      broker1.assertQueue('events-q', {autoDelete: false});

      const broker2 = Broker();
      broker2.assertExchange('dest-events', 'topic');

      const messages = [];
      broker2.subscribeTmp('dest-events', '#', onMessage, {noAck: true});

      const args = ['my-shovel', {
        broker: broker1,
        exchange: 'source-events',
        pattern: 'event.#',
        queue: 'events-q',
      }, {
        broker: broker2,
        exchange: 'dest-events'
      }];

      const shovel = Shovel(...args);

      broker1.publish('source-events', 'event.1');

      expect(messages).to.have.length(1);

      shovel.close();

      broker1.publish('source-events', 'event.2');

      expect(messages).to.have.length(1);

      Shovel(...args);

      expect(messages).to.have.length(2);

      broker1.publish('source-events', 'event.3');
      broker1.publish('source-events', 'test.1');

      expect(messages).to.eql(['event.1', 'event.2', 'event.3']);

      function onMessage(routingKey) {
        messages.push(routingKey);
      }
    });
  });

  describe('broker', () => {
    it('broker.createShovel() creates shovel', () => {
      const broker = Broker();
      broker.assertExchange('events', 'topic');

      const destinationBroker = Broker();
      destinationBroker.assertExchange('events', 'topic');

      const messages = [];
      destinationBroker.subscribeTmp('events', '#', onMessage);

      broker.createShovel('events-shovel', {exchange: 'events'}, {broker: destinationBroker, exchange: 'events'}, (message) => {
        expect(message).to.not.have.property('ack');
        expect(message).to.have.property('fields');
        expect(message).to.have.property('content');
        expect(message).to.have.property('properties');

        return {
          content: JSON.parse(JSON.stringify(message.content)),
          properties: {mandatory: false},
        };
      });

      const content = {
        data: 1,
      };

      broker.publish('events', 'event.1', content, {mandatory: true});

      expect(messages).to.have.length(1);

      const [message] = messages;
      content.data = 2;

      expect(message).to.have.property('fields').with.property('routingKey', 'event.1');
      expect(message).to.have.property('content').with.property('data', 1);
      expect(message).to.have.property('properties').with.property('mandatory', false);

      function onMessage(routingKey, msg) {
        messages.push(msg);
      }
    });

    it('broker.getShovel(name) gets shovel', () => {
      const broker = Broker();
      broker.assertExchange('events', 'topic');

      const destinationBroker = Broker();
      destinationBroker.assertExchange('events', 'topic');
      broker.createShovel('events-shovel', {exchange: 'events'}, {broker: destinationBroker, exchange: 'events'});

      expect(broker.getShovel('events-shovel')).to.have.property('name', 'events-shovel');
    });

    it('broker.closeShovel(name) closes shovel', () => {
      const broker = Broker();
      broker.assertExchange('events', 'topic');

      const destinationBroker = Broker();
      destinationBroker.assertExchange('events', 'topic');
      broker.createShovel('events-shovel', {exchange: 'events'}, {broker: destinationBroker, exchange: 'events'});

      const shovel = broker.getShovel('events-shovel');

      expect(broker.closeShovel('events-shovel')).to.be.true;
      expect(shovel).to.have.property('closed', true);

      expect(broker.getShovel('events-shovel')).to.not.be.ok;
    });

    it('double broker.closeShovel(name) closes shovel', () => {
      const broker = Broker();
      broker.assertExchange('events', 'topic');

      const destinationBroker = Broker();
      destinationBroker.assertExchange('events', 'topic');
      broker.createShovel('events-shovel', {exchange: 'events'}, {broker: destinationBroker, exchange: 'events'});

      broker.getShovel('events-shovel');

      expect(broker.closeShovel('events-shovel')).to.be.true;
      expect(broker.closeShovel('events-shovel')).to.be.false;

      expect(broker.getShovel('events-shovel')).to.not.be.ok;
    });

    it('closed source exchange closes shovel', () => {
      const broker = Broker();
      const exchange = broker.assertExchange('events', 'topic');

      const destinationBroker = Broker();
      destinationBroker.assertExchange('events', 'topic');
      broker.createShovel('events-shovel', {exchange: 'events'}, {broker: destinationBroker, exchange: 'events'});

      const shovel = broker.getShovel('events-shovel');

      exchange.close();
      expect(shovel).to.have.property('closed', true);

      expect(broker.getShovel('events-shovel')).to.not.be.ok;
    });

    it('closed bound destination exchange closes shovel', () => {
      const broker = Broker();
      broker.assertExchange('events', 'topic');

      const destinationBroker = Broker();
      const destinationExchange = destinationBroker.assertExchange('dest-events', 'topic');

      const shovel = broker.createShovel('events-shovel', {exchange: 'events'}, {broker: destinationBroker, exchange: 'dest-events'});
      const messages = [];
      destinationBroker.subscribeTmp('dest-events', '#', onMessage, {noAck: true});

      expect(broker.getShovel('events-shovel')).to.be.ok;

      destinationExchange.close();

      expect(shovel).to.have.property('closed', true);
      expect(broker.getShovel('events-shovel')).to.not.be.ok;

      function onMessage(routingKey) {
        messages.push(routingKey);
      }
    });

    it('closed shovel in destination consumer closes shovel', () => {
      const broker = Broker();
      broker.assertExchange('events', 'topic');

      const destinationBroker = Broker();
      destinationBroker.assertExchange('dest-events', 'topic');

      const messages = [];
      destinationBroker.subscribeTmp('dest-events', '#', onMessage, {noAck: true});

      const shovel = broker.createShovel('events-shovel', {exchange: 'events'}, {broker: destinationBroker, exchange: 'dest-events'});
      broker.publish('events', 'test.1');

      expect(messages).to.have.length(1);

      function onMessage(routingKey) {
        messages.push(routingKey);
        shovel.close();
        expect(shovel).to.have.property('closed', true);
        expect(broker.getShovel('events-shovel')).to.not.be.ok;
      }
    });

    it('shovel name must be unique', () => {
      const broker = Broker();
      broker.assertExchange('events', 'topic');

      const destinationBroker = Broker();
      destinationBroker.assertExchange('dest-events', 'topic');

      broker.createShovel('events-shovel', {exchange: 'events'}, {broker: destinationBroker, exchange: 'dest-events'});

      expect(() => {
        broker.createShovel('events-shovel', {exchange: 'events', pattern: 'test.*'}, {broker: destinationBroker, exchange: 'dest-events'});
      }).to.throw(/events-shovel is occupied/);
    });
  });
});
