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
    await buildTypes(output);
    dts = await fs.readFile(output, 'utf8');
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
    Broker_1: ['exchangeCount: number', 'queueCount: number', 'consumerCount: number'],
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
    it('re-exports Broker as a named export (build-types.js patch)', () => {
      expect(dts).to.include('export { Broker_1 as Broker };');
    });

    it('exports Broker as default', () => {
      expect(dts).to.match(/export default (function|class) Broker_1/);
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

    it('createShovel carries typed params', () => {
      expect(dts).to.match(/createShovel\(name: string, source: ShovelSource, destination: ShovelDestination, options\?: ShovelOptions\)/);
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
});
