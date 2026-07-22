# AGENTS.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`smqp` is a synchronous in-process message broker for JavaScript whose API is modeled on `amqplib`. There is no network or transport layer — `broker.publish(...)` triggers consumer callbacks synchronously on the same call stack. Treat behavior parity with AMQP semantics (exchanges, bindings, queues, consumers, ack/nack, prefetch, durable/exclusive flags, topic/direct routing, shovels) as a primary design constraint. The public API surface is documented in `API.md`; that file is the spec.

## Commands

- `npm test` — run the Mocha suite (`.mocharc.json` enables `recursive`, registers `chai/register-expect.js` so `expect` is a global, and sets a 1s timeout).
- `npx mocha test/queue-test.js` — run a single test file.
- `npx mocha --grep "<pattern>"` — run a single `describe`/`it` by name.
- `npm run lint` — ESLint (cached) + Prettier check. Always run before declaring work done.
- `npm run dist` — runs `scripts/build-types.js` (regenerates `types/index.d.ts`), then Babel-compiles `src/` → `dist/` (CommonJS build for the `require` export).
- `npm run build:types` — runs `scripts/build-types.js`, which invokes `dts-buddy` against the hand-written entry `types/bundle.d.ts`. That entry re-exports runtime classes from `src/*.js` and shared interfaces from `types/interfaces.d.ts`, so each name is single-declared and the bundle is free of `Foo_1` aliases. Re-run whenever you change a public API shape, add a JSDoc type, or edit `types/interfaces.d.ts` / `types/bundle.d.ts`. (`dist` and `prepack` already run it.)
- `npm run toc` — regenerate the TOC and version banner in `API.md` / `README.md` via `scripts/generate-api-toc.js`. Run this whenever you add, rename, or remove a documented API heading.
- `npm run test:md` — execute the code blocks in `README.md` and `API.md` via `texample`. Doc examples are real tests; broken examples fail this step.
- `npm run posttest` runs `dist`, `lint`, `toc`, and `test:md` in sequence — the same chain CI enforces.
- `npm run cov:html` — coverage report under `coverage/`.

Node 22 is the development target (`.nvmrc`). Source uses native ESM (`"type": "module"`); the `dist/` CJS build is generated, not edited. ESLint 10 requires `^20.19.0 || ^22.13.0 || >=24` — older Node 20.x crashes the stylish formatter (`util.styleText` was unstable before 20.19 and stable from 22.13). The `engines` field in `package.json` enforces this.

## How to work in this repo

- **TDD is the workflow.** For every change — bug fix or new feature — write the failing Mocha test in `test/` first, watch it fail, then make it pass with the smallest change in `src/`. Don't write production code without a test that drives it. When fixing a bug, the regression test must fail on the unchanged source before you start editing.
- **Performance is a USP.** This broker exists to be a fast, synchronous, in-process alternative to AMQP. Hot paths — `getRoutingKeyPattern`, exchange routing in `Exchange.js`, queue dispatch and `sortByPriority` in `Queue.js`, `Message` construction — must stay allocation-light and branch-cheap. Before changing them, justify the change against this constraint. Avoid: extra closures per message, `Array.prototype` chains where a `for` loop suffices, regex when a string compare works (see the three-tier `getRoutingKeyPattern` fast paths), defensive copies, and anything that turns a synchronous call into a microtask. If you suspect a regression, benchmark before and after.

  **Hot-path lessons learned (do not re-attempt without a fundamentally different approach).** Five hand-optimizations were attempted on the publish hot path and all regressed against `tmp/broker-publish-perf.js` (3M-iteration steady state, baseline ~6.6s, within-run variance ~1%):

  | Attempt                                                                                                        | Result                          | Reason                                                                                                                                                                                                                                                                                                                                                                     |
  | -------------------------------------------------------------------------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | Skip `{ ...properties }` spread in `Queue.queueMessage` when no TTL                                            | +64% regression                 | Branchy `let messageProperties = properties; if (ttl) messageProperties = {...}` introduces shape variance → megamorphic dispatch                                                                                                                                                                                                                                          |
  | Skip `{ consumerTag, ...mfields } = fields` destructure in `Message` ctor                                      | Test break                      | `new Message(fields).fields !== fields` is a public contract                                                                                                                                                                                                                                                                                                               |
  | Replace `this[kBindings].slice()` with index loop in `_onTopicMessage`                                         | 5 test failures                 | Defensive snapshot is load-bearing — bindings can mutate mid-iteration when user-handlers trigger `binding.close()`                                                                                                                                                                                                                                                        |
  | Hoist `Date.now()` outside `_consumeMessages` for-loop                                                         | Regression                      | Forces `Date.now()` on every call; original short-circuits on `expiration`                                                                                                                                                                                                                                                                                                 |
  | Hoist `this.options.noAck` / `this.onMessage` / `this.owner` to locals before `Consumer._consume`'s while-loop | ~1.5% regression                | V8's polymorphic IC for `this.X` lookups beats explicit local hoisting in tight loops                                                                                                                                                                                                                                                                                      |
  | Lazy-allocate `Consumer`'s internal prefetch `Queue` (init in `_push` instead of constructor)                  | +2% on fanout, +3–7% on publish | Making `kInternalQueue` `null \| Queue` introduces shape variance for every method that touches it (`_push`, `nackAll`, `ackAll`, `prefetch`, `capacity`/`messageCount` getters)                                                                                                                                                                                           |
  | Convert `Message` from `export function Message(...)` constructor to `export class Message`                    | +1.1% regression, 8/8 rounds    | Re-tested 2026-05-05 (interleaved fn vs class, mean fn 6.21s vs class 6.28s). Magnitude is sub-noise but direction is consistent. Motivator was getting `class Message implements MessageEnvelope` into the bundle, but tsc/dts-buddy don't synthesize an `implements` clause from `@implements` on a function-constructor anyway, so there is no consumer-visible upside. |

  In `Queue.js` / `Message.js` / `Exchange.js` hot paths, V8's hidden-class predictability and IC inlining dominate raw allocation cost — the "obvious" allocation savings consistently lose. Validate any proposed micro-optimization with `time node tmp/broker-publish-perf.js` over 5 runs; changes <2% are noise. Reject changes that add branchiness, break defensive snapshots, or move work from "sometimes called" to "always called".

  **Where real wins likely exist (architectural, multi-week scope, not drive-by tweaks):** removing the per-exchange `delivery-q` indirection (every publish currently traverses 3 queues for what is logically 1 routing decision; `delivery-q` exists for stop/recover semantics and would need careful redesign); eliminating `Consumer`'s internal prefetch `Queue` for default-prefetch consumers; pooling `Message` instances.

## Architecture

Everything is wired through a single `Broker` instance that owns four entity maps (`exchanges`, `queues`, `consumers`, `shovels`). The flow:

1. **Publish** — `broker.publish(exchangeName, routingKey, content, properties)` enqueues a delivery message on the exchange's internal `delivery-q`.
2. **Route** — the exchange's exclusive consumer (`_exchange-tag`) drains `delivery-q` and, depending on `type` (`topic` vs `direct`), copies the message to each matching bound queue. Topic patterns are compiled by `getRoutingKeyPattern` in `src/shared.js` into one of three matchers (direct equality, `prefix#`, or a regex) — preserve those fast paths when touching routing.
3. **Consume** — each queue pushes to its consumers in priority order (`sortByPriority`). Consumers honor `prefetch`, `noAck`, `exclusive`, and `consumerTag` semantics. Pending messages live on the queue until `ack`/`nack`/`reject`; `nack` with `requeue` re-inserts them at the head.

Because delivery is synchronous, a publish call returns only after every downstream consumer callback (and any republish they trigger) has run. Avoid introducing `await`, `process.nextTick`, microtask hops, or anything that breaks that contract — many consumers of this library rely on ordered, completed-before-return semantics.

### Module layout (`src/`)

- `Broker.js` — façade; manages entity maps, exposes the `amqplib`-shaped API, and owns the internal `broker__events` `EventExchange` used to emit `exchange.delete`, `queue.delete`, `consumer.cancel`, etc.
- `Exchange.js` — `Exchange` (topic/direct) plus `EventExchange` (a non-durable, auto-deleting topic exchange used internally for lifecycle events). Each exchange has its own `delivery-q` and an `events` sub-exchange named `${name}__events`.
- `Queue.js` — message storage, consumer scheduling, prefetch accounting, `getState`/`recover` for persistence handoff, plus the `Consumer` constructor.
- `Message.js` — message envelope with `ack`/`nack`/`reject`. The `K_PENDING` symbol guards against double-acking.
- `Shovel.js` — pipes messages from a source exchange (any broker) to a destination exchange. `Exchange2Exchange` is the in-broker variant used by `broker.bindExchange`.
- `Errors.js` — `SmqpError` and the `ERR_SMQP_*` code constants. Throw these (not generic `Error`) for AMQP-style failures so callers can branch on `err.code`.
- `shared.js` — `generateId`, `sortByPriority`, and `getRoutingKeyPattern`. The last is hot-path; benchmark before regressing.

### Conventions worth preserving

- Internal state lives on instances under `Symbol.for('...')` keys named `K_<SNAKE_CASE>` (e.g. `K_ENTITIES`, `K_BINDINGS`, `K_CONSUMERS`). Symbols used by more than one module (`K_NAME`, `K_STOPPED`) are declared once in `src/constants.js`; module-local symbols stay `const` in their own module. This keeps state non-enumerable while still letting tests reach in via the same well-known symbol. Prefer this pattern over closure-captured state when adding new fields — and only ever touch another module's symbol-keyed state through that module's methods, never directly.
- Constructors are callable with or without `new` (see `Broker`, `Shovel`) — keep that idiom if you add new entity types.
- `assert*` methods (`assertExchange`, `assertQueue`) are idempotent and validate that an existing entity matches the requested type/durability — mismatches throw `ERR_SMQP_*`. Don't change them to silently coerce.
- `getState()` / `recover()` on broker, exchange, and queue form the persistence contract. Any new field that must survive a restart needs to round-trip through both.
- Events are published through `EventExchange` instances, not Node `EventEmitter`. The `on`/`off` methods on `Broker`/`Exchange`/`Queue`/`Shovel` create real (auto-delete, non-durable) bindings, so they participate in the same routing machinery as regular messages.

### Types

Public types are bundled into `types/index.d.ts` by `dts-buddy` (run via `npm run build:types`). The pipeline has two inputs:

1. **JSDoc inference from `src/*.js`** — TypeScript reads JSDoc on functions, classes, and prototype assignments and infers declarations. This handles methods, parameters, and return types.
2. **`types/interfaces.d.ts`** — the only hand-maintained types file (paired with the small `types/bundle.d.ts` entry). It contains:
   - Shared interfaces consumed across the API (`SubscribeOptions`, `ConsumeOptions`, `QueueOptions`, `MessageProperties`, `MessageEnvelope`, `ShovelSource`, `BrokerState`, etc.). They become importable from `smqp` because `types/bundle.d.ts` does `export * from './interfaces.js'` — anything declared with `export interface` / `export type` in `interfaces.d.ts` is automatically picked up. No further wiring needed when you add a new shared type; just `export interface Foo` and consumers can `import type { Foo } from 'smqp'`.
   - `declare module '../src/<File>.js' { interface <Class> { ... } }` augmentations that add the getters defined via `Object.defineProperties` to each prototype. **TypeScript JSDoc inference does NOT see properties added via `Object.defineProperties` (plural)** — only the singular `Object.defineProperty(target, 'name', desc)` form. Splitting the call sites would regress hot-path performance, so the augmentations are the workaround. When you add a getter via `Object.defineProperties`, add the matching `readonly <name>: <type>` to the corresponding interface in `types/interfaces.d.ts` or the bundle will be incomplete.

`tsconfig.json` exposes the alias `#types` → `./types/interfaces.d.ts`. When you add JSDoc that references a shared type, use the path-alias form so dts-buddy resolves and inlines it: `@param {import('#types').SubscribeOptions} options` rather than a relative path. dts-buddy rewrites these aliases when bundling.

**Default to inferred return types; reach for `@returns` only when inference can't reach the right type without runtime cost.** TS infers most return types accurately from JSDoc-typed parameters and the function body — duplicating the inferred type with `@returns` adds noise. Use `@returns` only in cases where inference is blocked (e.g., reading from a `Map<string, any>` whose values you know but TS doesn't), and prefer it over introducing a local `/** @type {...} */ const x = ...; return x;` cast: the JSDoc-only form keeps the implementation a one-liner with no extra allocation. The four `Broker.get<Entity>` methods are the canonical example — they sit on the broker's lookup hot path and the entities Map is `Map<string, Map<any, any>>`, so an explicit `@returns {Queue | undefined}` is both leaner at runtime and clearer than a local-cast wrapper.

`tsconfig.json` is also strict (`strict: true`, `noImplicitThis: true`); `npx tsc --noEmit` is the standalone type check. When you add or change a public API in `src/`, update `API.md`, then run `npm run toc` and `npm run build:types`.

The `interfaces.d.ts` file must NOT carry side-effect imports (`import '../src/Foo.js'`) at the top — doing so causes dts-buddy to treat the augmented source files as ambient and append their full per-file `.d.ts` after the bundled `declare module 'smqp'` block, which produces invalid duplicate declarations for consumers. Reference cross-module types via `import('../src/Foo.js').Bar` inside type positions instead.

In `types/bundle.d.ts`, never re-export the same identifier as both `default` and named in the same module (e.g. `export default Broker; export { Broker };`). dts-buddy/tsc can only emit one declaration per name in the bundled `declare module 'smqp' { ... }` block, so the second is renamed to `Foo_1` with a trailing `export { Foo_1 as Foo };` alias — leaking the suffix into the public types. Pick one form. v13 dropped the `Broker` default export for this reason; the rest of the public surface (`Message`, `Queue`, `Exchange`, `Shovel`, `Consumer`, `getRoutingKeyPattern`, `SmqpError`) has always been named-only.

**Never pair an `export function Foo(...)` constructor (with `this.X = X` assignments + JSDoc-typed params) with a `declare module '<that-file>' { interface Foo { ... } }` augmentation.** The combination crashes the TypeScript compiler with `Debug Failure. False expression.` in `getConstructorDefinedThisAssignmentTypes` — tsc and dts-buddy abort, and the crash isn't reported as a normal error. Augment getters defined via `Object.defineProperties` on the prototype, but let TS infer constructor-assigned fields from the JSDoc on the function's parameters. If a class's _entire_ shape comes from `this.X = X` assignments (e.g., `Binding`), do not add a `interface <Class>` augmentation for it at all.

**`@internal` does NOT strip prototype-assigned methods.** For the `Foo.prototype.method = function () { ... }` style this codebase uses, `/** @internal */` on the assignment is silently ignored by tsc — the method emits unchanged, neither stripped nor flagged `private`, even with `stripInternal: true` in `tsconfig`. Use `/** @private */` instead; the bundle will emit `private foo;` which TS-using consumers can't access. (`stripInternal` operates on declaration nodes the tag is _attached to_; inferred-from-prototype-assignment members don't carry the JSDoc that way.)

**`Symbol.for(...)`-keyed instance state stays out of the published types.** dts-buddy 0.8.x strips `@internal`-decorated properties and emits no symbol-keyed class members, so no `/** @type {symbol} */` casts are needed on the symbol declarations — after `npm run build:types`, confirm the bundle has no `[K_...]`/`[Symbol...]` members. Independently: never mutate another module's symbol-keyed state from outside (e.g. `message[K_PENDING] = false` from `Queue.js`); add a `_clearPending()`-style internal method instead — cross-module symbol mutation is a sign of leaky encapsulation.

## Tests

- Tests live in `test/`. Mocha is configured to recurse, so `test/src/*-test.js` (per-module unit tests) and the top-level scenario tests both run.
- `chai` is loaded via `chai/register-expect.js` — use `expect(...)` directly, do not `import` it.
- `test/api-test.js` imports the package by name (`from 'smqp'`) and is the smoke test for the public export surface in `src/index.js`. Add new top-level exports there.
- Doc examples in `README.md` / `API.md` are executed by `texample` during `posttest`. When you change an API, update its example block and re-run `npm run test:md`.
