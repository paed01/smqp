import { Broker } from 'smqp';

describe('misc test', () => {
  /** @type {import('smqp').Broker} */
  let broker;
  describe('message order when publishing to other exchange in message handler (format functionality in bpmn-engine)', () => {
    beforeEach(() => {
      broker = new Broker();

      broker.assertExchange('run', 'topic', { autoDelete: false });
      broker.assertExchange('format', 'topic', { autoDelete: false });

      broker.assertQueue('run-q', { durable: true, autoDelete: false });
      broker.assertQueue('format-run-q', { durable: true, autoDelete: false });

      broker.bindQueue('run-q', 'run', 'run.#');
      broker.bindQueue('format-run-q', 'format', 'run.#');
    });

    it('publish on second exchange in message handler consumes message in expected order', () => {
      broker.publish('run', 'run.enter', 'MSG');
      broker.publish('run', 'run.start', 'MSG');

      const msgs = [];

      broker.consume('format-run-q', formatConsumer);
      broker.consume('run-q', runConsumer);

      expect(msgs).to.deep.equal(['run.enter', 'run.enter.format', 'run.start', 'run.start.format']);

      function runConsumer(routingKey, msg) {
        msgs.push(routingKey);
        broker.publish('format', routingKey + '.format');
        msg.ack();
      }

      function formatConsumer(routingKey, msg) {
        msgs.push(routingKey);
        msg.ack();
      }
    });

    it('publish to second exchange in third exchange listening for messages on first', () => {
      broker.assertExchange('event', 'topic', { autoDelete: false });

      broker.publish('run', 'run.enter', 'MSG');
      broker.publish('run', 'run.start', 'MSG');

      const msgs = [];

      broker.subscribeTmp(
        'event',
        'activity.#',
        (_routingKey, msg) => {
          broker.publish('format', msg.properties.type + '.format');
        },
        {
          noAck: true,
        }
      );

      broker.consume('format-run-q', formatConsumer);
      broker.consume('run-q', runConsumer);

      expect(msgs).to.deep.equal(['run.enter', 'run.enter.format', 'run.start', 'run.start.format']);

      function runConsumer(routingKey, msg) {
        msgs.push(routingKey);
        broker.publish('event', 'activity.' + routingKey, 'MSG', { type: routingKey });
        msg.ack();
      }

      function formatConsumer(routingKey, msg) {
        msgs.push(routingKey);
        msg.ack();
      }
    });

    it('intricate system where first consumer waits for second exchange before acking', () => {
      const formatQ = broker.getQueue('format-run-q');

      broker.assertExchange('event', 'topic', { autoDelete: false });

      broker.publish('run', 'run.enter', 'MSG');
      broker.publish('run', 'run.start', 'MSG');

      const msgs = [];

      broker.subscribeTmp(
        'event',
        'activity.#',
        (_routingKey, msg) => {
          broker.publish('format', msg.properties.type + '.format');
        },
        {
          noAck: true,
        }
      );

      broker.consume('run-q', runConsumer);

      expect(msgs).to.deep.equal(['run.enter', 'run.enter.format', 'run.start', 'run.start.format']);

      function runConsumer(routingKey, msg) {
        msgs.push(routingKey);
        broker.publish('event', 'activity.' + routingKey, 'MSG', { type: routingKey });
        continueRun(msg);
      }

      function continueRun(runMsg) {
        formatQ.consume((routingKey, msg) => {
          msgs.push(routingKey);
          msg.ack();

          broker.cancel(msg.fields.consumerTag);

          runMsg.ack();
        });
      }
    });

    it('intricate async prefetch system where first consumer waits for second exchange before acking', () => {
      const formatQ = broker.getQueue('format-run-q');

      broker.assertExchange('event', 'topic', { autoDelete: false });

      broker.publish('run', 'run.enter', 'MSG');
      broker.publish('run', 'run.start', 'MSG');

      const msgs = [];

      broker.subscribeTmp(
        'event',
        'activity.#',
        (_routingKey, msg) => {
          broker.publish('format', msg.properties.type + '.format');
        },
        {
          noAck: true,
        }
      );

      broker.consume('run-q', consumeRun);

      expect(msgs).to.deep.equal(['run.enter', 'run.enter.format', 'run.start', 'run.start.format']);

      function consumeRun(routingKey, msg) {
        msgs.push(routingKey);
        broker.publish('event', 'activity.' + routingKey, 'MSG', { type: routingKey });
        continueRun(msg);
      }

      function continueRun(runMsg) {
        formatQ.consume((routingKey, msg) => {
          msgs.push(routingKey);
          msg.ack();

          broker.cancel(msg.fields.consumerTag);

          runMsg.ack();
        });
      }
    });
  });
});
