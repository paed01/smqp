import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildTypes } from '../scripts/build-types.js';

describe('generated types bundle', () => {
  let dts;

  before(async function before() {
    this.timeout(20000);
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'smqp-dts-'));
    const output = path.join(dir, 'index.d.ts');
    dts = await buildTypes(output);
    await fs.rm(dir, { recursive: true, force: true });
  });

  function classBlock(name) {
    const startRe = new RegExp(`(class|interface)\\s+${name}(\\s|<|\\{|_)`);
    const start = dts.split('\n').findIndex((l) => startRe.test(l));
    if (start === -1) throw new Error(`class ${name} not found in bundle`);
    const lines = dts.split('\n').slice(start);
    let depth = 0;
    let end = -1;
    for (let i = 0; i < lines.length; i++) {
      depth += (lines[i].match(/\{/g) || []).length;
      depth -= (lines[i].match(/\}/g) || []).length;
      if (depth === 0 && i > 0) {
        end = i;
        break;
      }
    }
    return lines.slice(0, end + 1).join('\n');
  }

  const expectations = {
    Broker: ['exchangeCount: number', 'queueCount: number', 'consumerCount: number'],
    ExchangeBase: [
      'name: string',
      'bindingCount: number',
      'bindings: Binding[]',
      'type: exchangeType',
      'stopped: boolean',
      'undeliveredCount: number',
    ],
    Queue: [
      'name: string',
      'consumerCount: number',
      'consumers: Consumer[]',
      'exclusive: boolean',
      'messageCount: number',
      'stopped: boolean',
    ],
    Consumer: [
      'consumerTag: string',
      'ready: boolean',
      'stopped: boolean',
      'capacity: number',
      'messageCount: number',
      'queueName: string',
    ],
    Shovel: ['name: string', 'closed: boolean', 'consumerTag: string'],
    Exchange2Exchange: ['name: string', 'source: string', 'destination: string', 'pattern: string', 'queue: string', 'consumerTag: string'],
  };

  for (const [klass, members] of Object.entries(expectations)) {
    describe(klass, () => {
      for (const member of members) {
        it(`exposes ${member}`, () => {
          const block = classBlock(klass);
          expect(block).to.include(member);
        });
      }
    });
  }

  describe('module exports', () => {
    it('exposes Broker as a named export with no _1 alias', () => {
      expect(dts).to.match(/export (function|class) Broker\b/);
      expect(dts).to.not.match(/\bBroker_1\b/);
    });

    it('does not export Broker (or anything else) as default', () => {
      expect(dts).to.not.include('export default');
    });

    const sharedTypes = [
      'MessageEnvelope',
      'MessageFields',
      'MessageProperties',
      'ConsumeOptions',
      'SubscribeOptions',
      'QueueOptions',
      'QueueState',
      'QueueEventNames',
      'DeleteQueueOptions',
      'ExchangeOptions',
      'ExchangeState',
      'ExchangeEventEmitter',
      'exchangeType',
      'BindingOptions',
      'BindingState',
      'BrokerState',
      'ShovelSource',
      'ShovelDestination',
      'ShovelOptions',
      'onMessage',
    ];

    it('exposes each shared type as a public export', () => {
      const missing = sharedTypes.filter((name) => !new RegExp(`export (interface|type) ${name}\\b`).test(dts));
      expect(missing, `not exported: ${missing.join(', ')}`).to.have.lengthOf(0);
    });

    it('does not leak _1-suffixed shared-type aliases', () => {
      const stray = sharedTypes.filter((name) => new RegExp(`\\b${name}_1\\b`).test(dts));
      expect(stray, `unconsolidated aliases: ${stray.join(', ')}`).to.have.lengthOf(0);
    });
  });

  describe('Broker method signatures', () => {
    it('subscribe carries typed params', () => {
      expect(dts).to.match(
        /subscribe\(exchangeName: string, pattern: string, queueName: string, onMessage: onMessage, options\?: SubscribeOptions\)/
      );
    });

    it('publish carries typed params', () => {
      expect(dts).to.match(/publish\(exchangeName: string, routingKey: string, content\?: any, properties\?: MessageProperties\)/);
    });

    it('assertExchange carries typed params', () => {
      expect(dts).to.match(/assertExchange\(exchangeName: string, type\?: exchangeType, options\?: ExchangeOptions\)/);
    });

    it('ack carries typed params', () => {
      expect(dts).to.match(/ack\(message: Message, allUpTo\?: boolean\)/);
    });

    it('createShovel source omits broker (broker is supplied by the caller broker)', () => {
      expect(dts).to.match(
        /createShovel\(name: string, source: Omit<ShovelSource, "broker">, destination: ShovelDestination, options\?: ShovelOptions\)/
      );
    });
  });

  describe('Queue method signatures', () => {
    it('queueMessage carries typed params', () => {
      expect(dts).to.match(/queueMessage\(fields: MessageFields, content\?: any, properties\?: MessageProperties\)/);
    });

    it('consume carries typed params', () => {
      expect(dts).to.match(/consume\(onMessage: onMessage, consumeOptions\?: ConsumeOptions, owner\?: any\)/);
    });

    it('ack carries typed params', () => {
      expect(dts).to.match(/ack\(message: Message, allUpTo\?: boolean\)/);
    });

    it('recover carries typed params', () => {
      expect(dts).to.match(/recover\(state\?: QueueState\)/);
    });

    it('on uses QueueEventNames union', () => {
      expect(dts).to.match(/on\(eventName: QueueEventNames \| string, handler: Function, options\?: ConsumeOptions\)/);
    });

    it('off uses QueueEventNames union', () => {
      expect(dts).to.match(/off\(eventName: QueueEventNames \| string/);
    });

    it('exposes QueueEventNames literal union', () => {
      expect(dts).to.include("'consumer.cancel'");
      expect(dts).to.include("'dead-letter'");
      expect(dts).to.include("'saturated'");
    });
  });

  describe('Consumer method signatures', () => {
    it('cancel carries typed params', () => {
      expect(dts).to.match(/cancel\(requeue\?: boolean\)/);
    });

    it('prefetch carries typed params', () => {
      expect(dts).to.match(/prefetch\(value: number\)/);
    });
  });

  describe('private state does not leak', () => {
    it('Message does not expose [kPending] symbol-keyed property', () => {
      expect(dts).to.not.match(/\[kPending\]:/);
    });

    it('Message does not expose [kOnConsumed] symbol-keyed property', () => {
      expect(dts).to.not.match(/\[kOnConsumed\]:/);
    });

    it('Shovel does not expose Symbol.for-keyed properties', () => {
      expect(dts).to.not.match(/\[kSourceBroker\]:/);
      expect(dts).to.not.match(/\[kEventHandlers\]:/);
      expect(dts).to.not.match(/\[kE2EShovel\]:/);
    });
  });

  describe('Shovel method signatures', () => {
    it('Shovel constructor carries typed params', () => {
      expect(dts).to.match(/constructor\(name: string, source: ShovelSource, destination: ShovelDestination, options\?: ShovelOptions\)/);
    });

    it('Shovel.on carries typed params', () => {
      expect(dts).to.match(/on\(eventName: string, handler: Function, options\?: ConsumeOptions\)/);
    });

    it('Exchange2Exchange.on carries typed params', () => {
      expect(dts).to.match(/on\(eventName: string, handler: Function\)/);
    });
  });

  describe('RoutingKeyPattern.test cannot be destructured', () => {
    it('test signature carries explicit this: RoutingKeyPattern', () => {
      expect(dts).to.match(/test:\s*\(this: RoutingKeyPattern, routingKey: string\) => boolean/);
    });
  });

  describe('underscore-prefixed prototype methods are private', () => {
    it('all internal _-methods are emitted as private', () => {
      const internals = [
        '_onTopicMessage',
        '_onDirectMessage',
        '_emitReturn',
        '_consumeNext',
        '_consumeMessages',
        '_onMessageConsumed',
        '_getPendingMessages',
        '_dequeueMessage',
        '_getCapacity',
        '_push',
        '_messageHandler',
        '_onShovelMessage',
        '_getQueuesState',
        '_getExchangeState',
        '_clearPending',
      ];
      const missing = internals.filter((name) => !dts.includes(`private ${name}`));
      expect(missing, `missing private marker for: ${missing.join(', ')}`).to.have.lengthOf(0);
    });
  });
});
