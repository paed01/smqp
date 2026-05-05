/* eslint-disable no-console */
import fs from 'node:fs/promises';
import { createBundle } from 'dts-buddy';

// Point dts-buddy at a hand-written entry .d.ts (`types/bundle.d.ts`) that
// re-exports the runtime classes from `src/*.js` and the shared interfaces
// from `types/interfaces.d.ts`. This keeps each name single-declared in the
// emitted bundle — pointing at `src/index.js` directly would force JSDoc
// `@typedef` redirects there, colliding with the originals and producing
// `Foo_1` aliases.

/**
 * @param {string} output absolute path of the bundle to write
 */
export async function buildTypes(output) {
  await createBundle({
    project: 'tsconfig.json',
    output,
    modules: { smqp: 'types/bundle.d.ts' },
  });
  return fs.readFile(output, 'utf8');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await buildTypes('types/index.d.ts');
  console.log('Wrote types/index.d.ts');
}
