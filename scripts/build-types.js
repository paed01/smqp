import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createBundle } from 'dts-buddy';

export async function buildTypes(output = 'types/index.d.ts') {
  await createBundle({
    project: 'tsconfig.json',
    output,
    modules: { smqp: 'src/index.js' },
  });

  // dts-buddy renames the default export to `Broker_1` and drops the named `Broker` export
  // (the runtime exports both via `export { Broker }; export default Broker;`).
  // Re-add the named export so `import { Broker } from 'smqp'` typechecks.
  const dts = fs.readFileSync(output, 'utf8');
  const patched = dts.replace(/(\n)(}\n+\/\/# sourceMappingURL=)/, '$1\n\texport { Broker_1 as Broker };\n$2');
  if (patched === dts) throw new Error('build-types: failed to inject named Broker export');
  fs.writeFileSync(output, patched);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  buildTypes();
}
