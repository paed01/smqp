import {Broker, Shovel} from '../index';

describe('Shovel', () => {
  describe('api', () => {
    it('exposes on, off and close', () => {
      const broker1 = Broker();
      broker1.assertExchange('source-events', 'topic');

      const broker2 = Broker();
      broker2.assertExchange('dest-events', 'topic');

      const shovel = new Shovel('my-shovel', {broker: broker1, exchange: 'source-events'}, {broker: broker2, exchange: 'dest-events'});
      expect(shovel).to.have.property('on').that.is.a('function');
      expect(shovel).to.have.property('off').that.is.a('function');
      expect(shovel).to.have.property('close').that.is.a('function');
    });

    it('off turns off event handler', () => {
      const broker1 = Broker();
      broker1.assertExchange('source-events', 'topic');

      const broker2 = Broker();
      broker2.assertExchange('dest-events', 'topic');

      const shovel = new Shovel('my-shovel', {broker: broker1, exchange: 'source-events'}, {broker: broker2, exchange: 'dest-events'});
      shovel.on('close', onClose);
      shovel.on('#', () => {});

      expect(shovel.events.bindingCount).to.equal(2);

      shovel.off('close', onClose);

      expect(shovel.events.bindingCount).to.equal(1);

      function onClose() {}
    });
  });

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
        exchange: 'dest-events',
      }, {
        cloneMessage(message) {
          expect(message).to.not.have.property('ack');
          expect(message).to.have.property('fields');
          expect(message).to.have.property('content');
          expect(message).to.have.property('properties');

          return {
            content: JSON.parse(JSON.stringify(message.content)),
            properties: {mandatory: false},
          };
        },
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

    it('destination publish properties option overwrites properties before shoveling message', () => {
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
        exchange: 'dest-events',
        publishProperties: {
          mandatory: false,
          type: 'shoveled',
          'source-exchange': 'overwrite',
        },
      }, {
        cloneMessage(message) {
          expect(message).to.not.have.property('ack');
          expect(message).to.have.property('fields');
          expect(message).to.have.property('content');
          expect(message).to.have.property('properties');

          return {
            content: JSON.parse(JSON.stringify(message.content)),
          };
        },
      });
      const content = {
        data: 1,
      };

      broker1.publish('source-events', 'event.1', content, {mandatory: true});

      expect(messages).to.have.length(1);

      const [message] = messages;

      expect(message).to.have.property('fields').with.property('routingKey', 'event.1');
      expect(message).to.have.property('properties').with.property('mandatory', false);
      expect(message.properties).to.have.property('type', 'shoveled');
      expect(message.properties).to.have.property('source-exchange', 'source-events');

      function onMessage(routingKey, msg) {
        messages.push(msg);
      }
    });

    it('destination exchangeKey option publishes message with exchange routing key', () => {
      const broker1 = Broker();
      broker1.assertExchange('source-events', 'topic');
      broker1.assertQueue('events-q', {autoDelete: false});

      const broker2 = Broker();
      broker2.assertExchange('dest-events', 'topic');

      const messages = [];
      broker2.subscribeTmp('dest-events', 'shoveled', onMessage, {noAck: true});

      Shovel('my-shovel', {
        broker: broker1,
        exchange: 'source-events',
        pattern: 'event.#',
        queue: 'events-q',
      }, {
        broker: broker2,
        exchange: 'dest-events',
        exchangeKey: 'shoveled',
      });

      broker1.publish('source-events', 'event.1');
      broker1.publish('source-events', 'event.2');

      expect(messages).to.have.length(2);
      expect(messages[0]).to.have.property('fields').with.property('routingKey', 'shoveled');
      expect(messages[1]).to.have.property('fields').with.property('routingKey', 'shoveled');

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
        exchange: 'dest-events',
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
          exchange: 'dest-events',
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
          exchange: 'dest-events',
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
        exchange: 'dest-events',
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

    it('source broker.close() closes shovel', () => {
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
        exchange: 'dest-events',
      });

      broker1.publish('source-events', 'event.1');
      broker1.publish('source-events', 'test.1');

      expect(messages).to.have.length(1);

      broker1.close();

      expect(shovel.closed).to.be.true;

      function onMessage(routingKey) {
        messages.push(routingKey);
      }
    });

    it('destination broker.close() closes shovel', () => {
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
        exchange: 'dest-events',
      });

      broker1.publish('source-events', 'event.1');
      broker1.publish('source-events', 'test.1');

      expect(messages).to.have.length(1);

      broker2.close();

      expect(shovel.closed).to.be.true;

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
        exchange: 'dest-events',
      });

      shovel.close();
      shovel.close();

      expect(shovel).to.have.property('closed', true);
    });

    it('accumulates messages if source queue is passed', () => {
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
        exchange: 'dest-events',
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
        exchange: 'dest-events',
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

    it('shovel with same broker shovels messages between exchanges', () => {
      const broker = Broker();
      broker.assertExchange('source-events', 'topic');
      broker.assertExchange('dest-events', 'topic');

      broker.assertQueue('events-q', {autoDelete: false});

      const messages = [];
      broker.subscribeTmp('dest-events', '#', onMessage, {noAck: true});

      const args = ['my-shovel', {
        broker,
        exchange: 'source-events',
        pattern: 'event.#',
        queue: 'events-q',
      }, {
        broker,
        exchange: 'dest-events',
      }];

      const shovel = Shovel(...args);

      broker.publish('source-events', 'event.1');

      expect(messages).to.have.length(1);

      shovel.close();

      broker.publish('source-events', 'event.2');

      expect(messages).to.have.length(1);

      Shovel(...args);

      expect(messages).to.have.length(2);

      broker.publish('source-events', 'event.3');
      broker.publish('source-events', 'test.1');

      expect(messages).to.eql(['event.1', 'event.2', 'event.3']);

      function onMessage(routingKey) {
        messages.push(routingKey);
      }
    });

    it('takes source binding priority as source option', () => {
      const broker1 = Broker();
      broker1.assertExchange('source-events', 'topic');
      broker1.assertQueue('events-q', {autoDelete: false});

      const broker2 = Broker();
      broker2.assertExchange('dest-events', 'topic');

      const messages = [];
      broker1.subscribeTmp('source-events', '#', (_, msg) => {
        messages.push(msg);
      }, {noAck: true});

      const args = ['my-shovel', {
        broker: broker1,
        exchange: 'source-events',
        pattern: 'event.#',
        queue: 'events-q',
        priority: 1000,
      }, {
        broker: broker2,
        exchange: 'dest-events',
      }];

      Shovel(...args);

      broker2.subscribeTmp('dest-events', '#', (_, msg) => {
        messages.push(msg);
      }, {noAck: true});

      broker1.publish('source-events', 'event.1');
      broker1.publish('source-events', 'event.2');

      expect(messages).to.have.length(4);
      expect(messages[0].fields).to.have.property('exchange', 'dest-events');
      expect(messages[1].fields).to.have.property('exchange', 'source-events');
      expect(messages[2].fields).to.have.property('exchange', 'dest-events');
      expect(messages[3].fields).to.have.property('exchange', 'source-events');
    });
  });

  describe('broker', () => {
    it('broker.createShovel(name, source, destination[, options]) creates shovel', () => {
      const broker = Broker();
      broker.assertExchange('events', 'topic');

      const destinationBroker = Broker();
      destinationBroker.assertExchange('events', 'topic');

      const messages = [];
      destinationBroker.subscribeTmp('events', '#', onMessage, {noAck: true});

      broker.createShovel('events-shovel', {
        exchange: 'events',
      }, {
        broker: destinationBroker,
        exchange: 'events',
        publishProperties: {
          mandatory: false,
          type: 'shoveled',
        },
      }, {
        cloneMessage(message) {
          expect(message).to.not.have.property('ack');
          expect(message).to.have.property('fields');
          expect(message).to.have.property('content');
          expect(message).to.have.property('properties');

          return {
            content: JSON.parse(JSON.stringify(message.content)),
            properties: {
              type: undefined,
            },
          };
        },
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
      expect(message).to.have.property('properties').with.property('type', 'shoveled');

      function onMessage(routingKey, msg) {
        messages.push(msg);
      }
    });

    it('double shovel from source exchange to different destination exchanges', () => {
      const broker = Broker();
      broker.assertExchange('events', 'topic');

      const destinationBroker = Broker();
      destinationBroker.assertExchange('events-0', 'topic');
      destinationBroker.assertExchange('events-1', 'direct');

      const messages = [];
      destinationBroker.subscribeTmp('events-0', '#', onMessage, {noAck: true});
      destinationBroker.subscribeTmp('events-1', '#', onMessage, {noAck: true});

      broker.createShovel('events-shovel-0', {exchange: 'events'}, {broker: destinationBroker, exchange: 'events-0'});
      broker.createShovel('events-shovel-1', {exchange: 'events'}, {broker: destinationBroker, exchange: 'events-1'});

      broker.publish('events', 'event.1');

      expect(messages).to.have.length(2);

      function onMessage(routingKey, msg) {
        messages.push(msg);
      }
    });

    it('double shovel from source exchange to different same destination exchanges but different patterns', () => {
      const broker = Broker();
      broker.assertExchange('events', 'topic');

      const destinationBroker = Broker();
      destinationBroker.assertExchange('events', 'topic');

      const messages = [];
      destinationBroker.subscribeTmp('events', '#', onMessage, {noAck: true});

      broker.createShovel('events-shovel-0', {exchange: 'events', pattern: '#'}, {broker: destinationBroker, exchange: 'events'});
      broker.createShovel('events-shovel-1', {exchange: 'events', pattern: 'test.#'}, {broker: destinationBroker, exchange: 'events'});

      broker.publish('events', 'event.1');
      broker.publish('events', 'test.1');

      expect(messages).to.have.length(3);

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

    it('closes shovel if source consumer is canceled', () => {
      const broker = Broker();
      broker.assertExchange('events', 'topic', {autoDelete: false});

      const destinationBroker = Broker();
      destinationBroker.assertExchange('dest-events', 'topic');

      const messages = [];
      destinationBroker.subscribeTmp('dest-events', '#', onMessage, {noAck: true});

      const shovel = broker.createShovel('events-shovel', {exchange: 'events'}, {broker: destinationBroker, exchange: 'dest-events'});
      broker.publish('events', 'test.1');

      expect(messages).to.have.length(1);

      function onMessage(routingKey) {
        messages.push(routingKey);
        broker.cancel(shovel.consumerTag);
        expect(shovel).to.have.property('closed', true);
        expect(broker.getShovel('events-shovel')).to.not.be.ok;
      }
    });

    it('closes shovel if source queue is closed', () => {
      const broker = Broker();
      broker.assertExchange('events', 'topic', {autoDelete: false});
      const queue = broker.assertQueue('events-q', {autoDelete: false});

      const destinationBroker = Broker();
      destinationBroker.assertExchange('dest-events', 'topic');

      const messages = [];
      destinationBroker.subscribeTmp('dest-events', '#', onMessage, {noAck: true});

      const shovel = broker.createShovel('events-shovel', {
        exchange: 'events',
        queue: queue.name,
      }, {broker: destinationBroker, exchange: 'dest-events'});
      broker.publish('events', 'test.1');

      expect(messages).to.have.length(1);

      function onMessage(routingKey) {
        messages.push(routingKey);
        queue.close();
        expect(shovel).to.have.property('closed', true);
        expect(broker.getShovel('events-shovel')).to.not.be.ok;
      }
    });

    it('closes shovel if source queue is deleted', () => {
      const broker = Broker();
      broker.assertExchange('events', 'topic', {autoDelete: false});
      const queue = broker.assertQueue('events-q', {autoDelete: false});

      const destinationBroker = Broker();
      destinationBroker.assertExchange('dest-events', 'topic');

      const messages = [];
      destinationBroker.subscribeTmp('dest-events', '#', onMessage, {noAck: true});

      const shovel = broker.createShovel('events-shovel', {
        exchange: 'events',
        queue: queue.name,
      }, {
        broker: destinationBroker,
        exchange: 'dest-events',
      });
      broker.publish('events', 'test.1');

      expect(messages).to.have.length(1);

      function onMessage(routingKey) {
        messages.push(routingKey);
        broker.deleteQueue(queue.name);
        expect(shovel).to.have.property('closed', true);
        expect(broker.getShovel('events-shovel')).to.not.be.ok;
      }
    });

    it('closes shovel if broker is closed', () => {
      const broker = Broker();
      broker.assertExchange('events', 'topic', {autoDelete: false});
      const queue = broker.assertQueue('events-q', {autoDelete: false});

      const destinationBroker = Broker();
      destinationBroker.assertExchange('dest-events', 'topic');

      const messages = [];
      destinationBroker.subscribeTmp('dest-events', '#', onMessage, {noAck: true});

      const shovel = broker.createShovel('events-shovel', {
        exchange: 'events',
        queue: queue.name,
      }, {broker: destinationBroker, exchange: 'dest-events'});
      broker.publish('events', 'test.1');

      expect(messages).to.have.length(1);

      function onMessage(routingKey) {
        messages.push(routingKey);
        broker.close();
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

    it('shovel.close() closes shovel once', () => {
      const broker = Broker();
      broker.assertExchange('events', 'topic', {autoDelete: false});
      const queue = broker.assertQueue('events-q', {autoDelete: false});

      const destinationBroker = Broker();
      destinationBroker.assertExchange('dest-events', 'topic');

      const shovel = broker.createShovel('events-shovel', {
        exchange: 'events',
        queue: queue.name,
      }, {
        broker: destinationBroker,
        exchange: 'dest-events',
      });

      broker.publish('events', 'test.1');

      shovel.close();

      expect(broker.getShovels()).to.have.length(0);

      shovel.close();

      expect(broker.getShovels()).to.have.length(0);
    });
  });
});
