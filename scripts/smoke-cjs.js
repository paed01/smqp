/* eslint-disable no-console */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const cjsPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist/index.cjs');

const m = require(cjsPath);

const checks = [
  ['module.exports.Broker is the constructor', typeof m.Broker === 'function'],
  ['module.exports.Queue is exposed', typeof m.Queue === 'function'],
  ['module.exports.Message is exposed', typeof m.Message === 'function'],
  ['module.exports.Exchange is exposed', typeof m.Exchange === 'function'],
  ['module.exports.Shovel is exposed', typeof m.Shovel === 'function'],
  ['module.exports.SmqpError is exposed', typeof m.SmqpError === 'function'],
  ['module.exports.getRoutingKeyPattern is exposed', typeof m.getRoutingKeyPattern === 'function'],
  ['no .default leaks into the cjs namespace', !('default' in m)],
];

const failures = checks.filter(([, ok]) => !ok).map(([label]) => label);
if (failures.length) {
  console.error('CJS smoke test failed:');
  for (const f of failures) console.error('  -', f);
  process.exit(1);
}

const broker = m.Broker('owner-sentinel');
if (broker.owner !== 'owner-sentinel') {
  console.error('CJS smoke test failed: Broker(owner) returned an instance with the wrong owner');
  process.exit(1);
}

console.log('CJS smoke test ok');
