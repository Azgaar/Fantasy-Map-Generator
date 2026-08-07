# PRD: Unified Module Registry (Controllers & Services)

## Problem Statement

Reaching a lazy-loaded module today is noisy and easy to get wrong. A caller has to know three
separate things: the registry key, the export name inside the module, and the dynamic-import
dance to glue them together. The result is call sites like "load the markets-overview module, then
reach into its `MarketsOverview` export, then call `open`" — repeated, by hand, in ~40 places
across both migrated TypeScript and legacy JavaScript.

Because the loader registry and the export-shape knowledge are split, the two drift: some call
sites already assume the new `ModuleType.open()` shape while the registry still hands back a whole
module namespace, producing latent breakage. There is also no uniform way to call a Controller —
some sites destructure (`const { X } = await ...`), some chain (`...then(m => m.X.open())`), and a
few sub-dialogs bypass lazy loading entirely with static imports.

Finally, whether a module is lazy-loaded or eagerly bundled is a decision that leaks into every
caller: changing it means touching every call site. Contributors should not have to think about
loading strategy when they just want to open a dialog or save a map.

## Solution

A single, typed module **registry** that lets any caller invoke a module's method uniformly —
`Controllers.MarketOverview.open(id)` or `Services.Save.saveMap("machine")` — without ever writing
a dynamic `import()` or knowing the export name. The registry resolves the module on first use,
caches it, and calls the method, returning a Promise.

The same registry mechanism transparently supports both **lazy** and **eager** modules: a caller's
code is identical either way, so the loading strategy of any module can be flipped in one place
without touching a single consumer. Controllers and Services are kept as two clearly named buckets
so "open a dialog" and "persist the map" read differently at the call site, even though they share
one mechanism. The old layer-agnostic loader file is removed; the registry lives with the
Controllers it primarily serves and is exposed on `window` for legacy JavaScript.

## User Stories

1. As a contributor opening a dialog, I want to call `Controllers.<Name>.open(...)` directly, so that I don't have to write a dynamic import or remember the module's export name.
2. As a contributor, I want the same uniform call shape for every Controller, so that I don't have to recall whether a given dialog wants destructuring or `.then()` chaining.
3. As a contributor performing IO, I want to call `Services.<Name>.<fn>(...)`, so that saving, loading, and exporting follow the same ergonomic pattern as Controllers.
4. As a contributor, I want a single source of truth mapping a friendly name to its module, so that I don't juggle a registry key and an export name separately.
5. As a contributor, I want the registry to be fully typed, so that calling a method with the wrong arguments is a compile error and autocomplete lists the available methods.
6. As a contributor, I want `open()` with a required argument to fail to compile when I omit it, so that argument mistakes are caught before runtime.
7. As a maintainer, I want loading strategy (lazy vs eager) to be a one-line change in the registry, so that I can tune the bundle without editing any call sites.
8. As a maintainer, I want consumers to behave identically whether a module is lazy or eager, so that switching strategies never introduces a behavioral regression at a call site.
9. As a legacy JavaScript module, I want to reach the registry through `window.Controllers` / `window.Services`, so that `public/modules/**/*.js` can use the same uniform pattern as TypeScript.
10. As a build, I want each lazy module to remain in its own code-split chunk, so that startup bundle size is unaffected by the migration.
11. As a maintainer, I want a single deep registry factory that encapsulates the import + dispatch logic, so that the behavior is implemented and tested once rather than per module.
12. As a contributor, I want a new Controller to be added with one registry line, so that wiring a dialog stays as cheap as it is today.
13. As a contributor, I want the registry to ignore unknown names and non-string property access gracefully, so that inspecting or accidentally awaiting the registry never throws or misbehaves.
14. As a maintainer, I want the previously static sub-dialogs (good editor, production chains, distribution editor) to go through the registry, so that the whole Controller surface is uniform and they too can be lazy-loaded.
15. As a maintainer, I want the old `lazy-loaders.ts` file and its `window.lazy` global removed, so that there is exactly one registry concept in the codebase.
16. As a contributor reading the architecture docs, I want the lazy-loading doc updated to describe the registry, so that the documentation matches the code.
17. As a maintainer, I want the registry factory unit-tested in isolation, so that its dispatch and lazy/eager transparency are guaranteed independent of any real module.
18. As a contributor, I want each registry method call to resolve to a Promise even for eager modules, so that the contract is uniform and predictable.
19. As a maintainer, I want repeat calls to reuse the already-loaded module, so that opening a dialog twice does not re-download or re-execute its chunk.
20. As a contributor, I want the two overview Controllers that expose `refresh` to be callable the same way as `open`, so that secondary methods are not a special case.
21. As a maintainer, I want the registry to live in `controllers/index.ts`, which is already an eager entry script, so that no new bootstrap wiring is needed and the globals are set at startup.
22. As a contributor, I want IO modules (which export free functions, not an `open`) to work through the same registry, so that the mechanism does not need a second implementation.

## Implementation Decisions

- **Deep module: a registry factory.** A single `createRegistry(loaders)` function is the only place that knows how to turn a map of loader thunks into a callable, typed object. Everything else (Controllers, Services) is just data passed to it. This is the unit under test.
- **Registry contract (from prototype):** a loader is always `() => Promise<callable>`; the factory returns an object whose every method is async. Expressed as types:
  ```ts
  type Loader<T> = () => Promise<T>;
  type AsyncMethods<T> = {
    [K in keyof T]: T[K] extends (...a: infer A) => infer R ? (...a: A) => Promise<Awaited<R>> : T[K];
  };
  // createRegistry<L extends Record<string, Loader<object>>>(loaders: L):
  //   { [K in keyof L]: AsyncMethods<Awaited<ReturnType<L[K]>>> }
  ```
- **Proxy-based dispatch.** The factory is implemented with a two-level Proxy: the outer level is keyed by module name and returns a per-module proxy; the inner level forwards any method name to `loaders[name]().then(obj => obj[method](...args))`. The Proxy is the deliberate choice here because the Services bucket exposes many varied functions per module; enumerating them by hand would be tedious and drift-prone.
- **Symbol / unknown-key guard.** Both Proxy levels must return `undefined` for symbol keys and unknown names — in particular the inner proxy must not return a function for `then`, so that a registry entry is never accidentally thenable (awaiting or promise-inspecting it must be a no-op, not a method dispatch). This is an explicit correctness requirement, not an optimization.
- **Uniform async contract.** Every registry method returns a Promise, including for eager modules. All Controller dialogs are fire-and-forget, so the change from `void` to `Promise<void>` is acceptable; callers that ignore the return value are unaffected.
- **Lazy/eager transparency via an `eager` adapter.** An `eager(value)` helper produces `() => Promise.resolve(value)` so an already-imported module can be registered without consumers knowing. Switching a module between lazy and eager is a one-line registry edit; no call site changes.
- **Two buckets, one mechanism.** `Controllers` and `Services` are separate typed objects built from `createRegistry`. Controllers entries resolve to the module's `ModuleType` export (the object with `open`/`refresh`); Services entries resolve to the module namespace (free functions like `saveMap`, `getMapURL`).
- **Controllers bucket scope.** All Controllers, including the three currently statically-imported sub-dialogs (good editor, production chains, distribution editor), which become lazy as a result. The 3D view module is excluded: it has no dialog `open`, it installs `ThreeD` globals, and it shares mutable state synchronously with its renderer — it stays statically imported.
- **Services bucket scope.** The non-Controller modules previously in the loader file: save, load, map export, JSON export, cloud, installation, supporters, and the UI tour.
- **Location & bootstrap.** The registry is defined in `controllers/index.ts`, which is already loaded eagerly as an entry module script, so `window.Controllers` and `window.Services` are set at startup with no new wiring. The standalone loader file and its dedicated entry script are removed.
- **Naming.** Registry keys are PascalCase and match the export name they resolve to (Controllers) or a PascalCase module alias (Services), so the key is self-documenting.
- **Code-splitting preserved.** Each lazy loader uses a static string-literal `import(...)`, so the bundler continues to emit one chunk per module; the eager registry file holds only thunks, not module bodies.
- **Caching.** The factory relies on the runtime's native dynamic-import cache: the second access to a module reuses the already-evaluated module, so dialogs reopen without re-downloading or re-executing.
- **Consumer migration.** All ~40 call sites (migrated TS via an imported `Controllers`/`Services`; legacy JS via `window.Controllers`/`window.Services`) are converted, and unused loader-file imports are removed. This is a single cutover; the loader file is deleted in the same change.
- **Docs.** The lazy-loading architecture doc is rewritten to describe the registry, the two buckets, and the lazy/eager adapter, replacing the description of the old loader-file bridge.

## Testing Decisions

- **What makes a good test here:** assert only external behavior of the registry factory — that calling `Registry.Name.method(args)` invokes the resolved object's method with those exact args and resolves to its return value; that the contract is async regardless of lazy vs eager; and that symbol/unknown access yields `undefined` (so the registry is not thenable). Do not assert Proxy internals or call counts of the runtime import cache.
- **Module under test:** the `createRegistry` factory only. The Controllers and Services buckets are configuration (data), and the individual controllers already have their own behavior; they are not re-tested here.
- **Representative cases:** dispatch forwards arguments and propagates the resolved return value; a method that takes a required argument is exercised with it; an `eager(value)` entry resolves without performing a dynamic import; a second call to the same entry reuses the resolved object; accessing an unknown name or a symbol key returns `undefined` and `await`-ing an entry does not dispatch a method.
- **Prior art:** the existing Vitest unit suites under `src/utils/*.test.ts` and `src/generators/*.test.ts` — plain `describe/test/expect`, no DOM. The factory test follows the same style, feeding in fake loaders (e.g. `() => Promise.resolve({ open: vi.fn() })`) rather than real modules.

## Out of Scope

- Restructuring the 3D view module into the registry (it is intentionally excluded and stays statically imported).
- Any change to the controllers' own export shape — they already uniformly export `ModuleType = { open, ... }`.
- Internal refactors of the IO/service modules themselves (only how they are reached changes).
- Removing the `window` globals entirely — legacy `public/modules/**/*.js` still needs them; that cleanup belongs to the broader JS→TS migration.
- Converting eager modules to lazy (or vice versa) as part of this work; the migration only makes that a cheap, consumer-invisible change for the future.
- Eagerly loading any Controller — all remain lazy; the eager path exists for future use and for Services.

## Further Notes

- **Behavioral change to flag in review:** every registry-dispatched method now returns a Promise. This is intentional and required for lazy/eager transparency. Audit for any caller that depended on a synchronous return or a synchronous side effect ordering (none are expected among the fire-and-forget dialogs).
- **Why the Proxy, given the earlier discussion:** for a Controllers-only registry the surface is just `open`/`refresh` and an explicit helper would suffice, but the unified registry must also cover Services modules with many diverse functions. One Proxy-based mechanism covering both buckets is simpler than maintaining two styles.
- **The thenable footgun is the main correctness risk** and is why the symbol/`then` guard is called out as an explicit decision rather than left implicit.
