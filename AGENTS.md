# AGENTS.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`smqp` is a synchronous in-process message broker for JavaScript whose API is modeled on `amqplib`. There is no network or transport layer — `broker.publish(...)` triggers consumer callbacks synchronously on the same call stack. Treat behavior parity with AMQP semantics (exchanges, bindings, queues, consumers, ack/nack, prefetch, durable/exclusive flags, topic/direct routing, shovels) as a primary design constraint. The public API surface is documented in `API.md`; that file is the spec.

## Commands

- `npm test` — run the Mocha suite (`.mocharc.json` enables `recursive`, registers `chai/register-expect.js` so `expect` is a global, and sets a 1s timeout).
- `npm run lint` — ESLint (cached) + Prettier check. Always run before declaring work done.
- `npm run dist` — builds the CommonJS `dist/` bundle with Rollup, regenerates the types, smoke-tests the CJS `require` export, and regenerates the TOC. `dist/` is generated, never edited.
- `npm run build:types` — runs `scripts/build-types.js`, which invokes `dts-buddy` against the hand-written entry `types/bundle.d.ts`. That entry re-exports runtime classes from `src/*.js` and shared interfaces from `types/interfaces.d.ts`, so each name is single-declared and the bundle is free of `Foo_1` aliases. Re-run whenever you change a public API shape, add a JSDoc type, or edit `types/interfaces.d.ts` / `types/bundle.d.ts`. (`dist` and `prepack` already run it.)
- `npm run toc` — regenerate the TOC and version banner in `API.md` via `scripts/toc.js`. Run this whenever you add, rename, or remove a documented API heading.
- `npm run test:md` — execute the code blocks in `README.md` and `API.md` via `texample`. Doc examples are real tests; broken examples fail this step.

Node 22 is the development target (`.nvmrc`). Source uses native ESM (`"type": "module"`); the `dist/` CJS build is generated, not edited. ESLint 10 requires `^20.19.0 || ^22.13.0 || >=24` — older Node 20.x crashes the stylish formatter (`util.styleText` was unstable before 20.19 and stable from 22.13). The `engines` field in `package.json` enforces this.

## How to work in this repo

- **TDD is the workflow.** For every change — bug fix or new feature — write the failing Mocha test in `test/` first, watch it fail, then make it pass with the smallest change in `src/`. Don't write production code without a test that drives it. When fixing a bug, the regression test must fail on the unchanged source before you start editing.
- **Performance is a USP.** This broker exists to be a fast, synchronous, in-process alternative to AMQP. Hot paths — `getRoutingKeyPattern`, exchange routing in `Exchange.js`, queue dispatch and `sortByPriority` in `Queue.js`, `Message` construction — must stay allocation-light and branch-cheap. Before changing them, justify the change against this constraint. Avoid: extra closures per message, `Array.prototype` chains where a `for` loop suffices, regex when a string compare works (see the three-tier `getRoutingKeyPattern` fast paths), defensive copies, and anything that turns a synchronous call into a microtask. If you suspect a regression, benchmark before and after.

  Several "obvious" hand-optimizations of the publish hot path have already been tried and measured as regressions. Before touching `Queue.js`, `Message.js`, `Exchange.js`, or `shared.js` for performance, invoke the `hot-path-perf` skill for the rejected-attempts table, the benchmark protocol (`time node tmp/broker-publish-perf.js`, 5 runs, <2% is noise), and where real architectural wins remain. Reject changes that add branchiness, break defensive snapshots, or move work from "sometimes called" to "always called".

## Architecture

Everything is wired through a single `Broker` instance that owns four entity maps (`exchanges`, `queues`, `consumers`, `shovels`). The flow:

1. **Publish** — `broker.publish(exchangeName, routingKey, content, properties)` enqueues a delivery message on the exchange's internal `delivery-q`.
2. **Route** — the exchange's exclusive consumer (`_exchange-tag`) drains `delivery-q` and, depending on `type` (`topic` vs `direct`), copies the message to each matching bound queue. Topic patterns are compiled by `getRoutingKeyPattern` in `src/shared.js` into one of three matchers (direct equality, `prefix#`, or a regex) — preserve those fast paths when touching routing.
3. **Consume** — each queue pushes to its consumers in priority order (`sortByPriority`). Consumers honor `prefetch`, `noAck`, `exclusive`, and `consumerTag` semantics. Pending messages live on the queue until `ack`/`nack`/`reject`; `nack` with `requeue` re-inserts them at the head.

Because delivery is synchronous, a publish call returns only after every downstream consumer callback (and any republish they trigger) has run. Avoid introducing `await`, `process.nextTick`, microtask hops, or anything that breaks that contract — many consumers of this library rely on ordered, completed-before-return semantics.

### Conventions worth preserving

- Internal state lives on instances under `Symbol.for('...')` keys named `K_<SNAKE_CASE>` (e.g. `K_ENTITIES`, `K_BINDINGS`, `K_CONSUMERS`). Symbols used by more than one module (`K_NAME`, `K_STOPPED`) are declared once in `src/constants.js`; module-local symbols stay `const` in their own module. This keeps state non-enumerable while still letting tests reach in via the same well-known symbol. Prefer this pattern over closure-captured state when adding new fields — and only ever touch another module's symbol-keyed state through that module's methods, never directly.
- Constructors are callable with or without `new` (see `Broker`, `Shovel`) — keep that idiom if you add new entity types.
- `assert*` methods (`assertExchange`, `assertQueue`) are idempotent and validate that an existing entity matches the requested type/durability — mismatches throw `ERR_SMQP_*`. Don't change them to silently coerce.
- `getState()` / `recover()` on broker, exchange, and queue form the persistence contract. Any new field that must survive a restart needs to round-trip through both.
- Events are published through `EventExchange` instances, not Node `EventEmitter`. The `on`/`off` methods on `Broker`/`Exchange`/`Queue`/`Shovel` create real (auto-delete, non-durable) bindings, so they participate in the same routing machinery as regular messages.
- Throw `SmqpError` with an `ERR_SMQP_*` code (see `src/Errors.js`), not a generic `Error`, for AMQP-style failures so callers can branch on `err.code`.

### Types

Public types are bundled into `types/index.d.ts` by `dts-buddy` (`npm run build:types`) from JSDoc in `src/*.js` plus the hand-maintained `types/interfaces.d.ts` / `types/bundle.d.ts`. When you add or change a public API in `src/`, update `API.md`, then run `npm run toc` and `npm run build:types`; `npx tsc --noEmit` is the standalone type check. Before editing `types/*.d.ts` or JSDoc that feeds the bundle, invoke the `types-bundle` skill — it documents the `Object.defineProperties` augmentation rule, the `@returns` policy, the `#types` alias, and several tsc/dts-buddy traps.

**Never pair an `export function Foo(...)` constructor (with `this.X = X` assignments + JSDoc-typed params) with a `declare module '<that-file>' { interface Foo { ... } }` augmentation.** The combination crashes the TypeScript compiler silently (`Debug Failure. False expression.`). Details in the `types-bundle` skill.

## Tests

- Tests live in `test/`. Mocha is configured to recurse, so `test/src/*-test.js` (per-module unit tests) and the top-level scenario tests both run.
- `chai` is loaded via `chai/register-expect.js` — use `expect(...)` directly, do not `import` it.
- `test/api-test.js` imports the package by name (`from 'smqp'`) and is the smoke test for the public export surface in `src/index.js`. Add new top-level exports there.
- Doc examples in `README.md` / `API.md` are executed by `texample` during `posttest`. When you change an API, update its example block and re-run `npm run test:md`.
