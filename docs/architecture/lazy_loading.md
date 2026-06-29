# Lazy-Loading Pattern

Keep rarely-used modules reachable only through a **dynamic** `import()`, which Rollup always
splits into its own chunk, fetched on demand. Callers reach them through a typed **registry**
that hides the import entirely.

## The registry

`src/utils/registry.ts` exports a layer-agnostic deep module — `createRegistry(loaders)` — that turns
a map of loader thunks into a callable, typed object. Accessing `Registry.Name.method(...args)` loads
the owning module (its own chunk, evaluated at most once), then dispatches the call, **always
returning a Promise**. Callers never write `import()` or `.then(m => …)`. An `eager(value)` helper
registers an already-imported value so lazy vs eager is invisible to callers.

Two buckets are built from the factory, each in its own layer's eager entry, and exposed on `window`
(so legacy `public/modules/**/*.js` and inline `onclick` handlers can reach them, mirroring the old
`window.lazy`):

Both buckets use the **same contract**: every registered module exports a single named object whose
properties are its public methods.

- **`Controllers`** (in `src/controllers/index.ts`) — dialog controllers (editors, overviews, tools).
  Each entry resolves to the module's `ModuleType` export: `Controllers.MarketOverview.open(id)`.
- **`Services`** (in `src/services/index.ts`) — service- and IO-layer app-shell modules. IO lives
  under `src/services/io/`. Each module likewise exports one object (`Save`, `Load`, `ExportMap`,
  `ExportJson`, `Installation`, `CloudStorage`, `UiTour`): `Services.Save.saveMap("machine")`.

The mechanism is **dispatch-only**: callers invoke methods, they don't read properties off the
resolved object. A module that exposes data or a nested object must wrap it in a method facade (e.g.
`CloudStorage` flattens `Cloud.providers.dropbox`), OR be loaded eagerly instead (e.g. the small
credits string is exposed as `window.supporters` via `src/data/index.ts`).

Both `index.ts` files are eager `<script type="module">` entries in `index.html`, so the registries
exist at startup. They hold only loader thunks, so the eager cost is a few bytes, not module bodies.

## Adding a lazy module

1. **Write the module normally.** Plain `.ts` file under the layer it belongs to (`controllers/`,
   `services/`, `services/io/`, `data/`), named exports, fully typed. Controllers export
   `export const <Name> = { open, ... }`.

2. **Never import it statically** from anything in the eager graph reachable from
   `controllers/index.ts` / `generators/index.ts` / `renderers/index.ts` — that graph is the main
   chunk. (The loader thunk's `import()` does not count as static.)

3. **Add one line to the right bucket** — `Controllers` in `controllers/index.ts`, `Services` in
   `services/index.ts`:

   ```ts
   // Controllers: resolve to the module's single exported object
   MarketOverview: () => import("@/controllers/market-overview").then(m => m.MarketOverview),
   // Services: same contract — resolve to the module's single exported object
   Save: () => import("@/services/io/save").then(m => m.Save),
   ```

   Rollup sees the string literal inside `import()` and emits an independent chunk. Each entry keeps
   its exact resolved type, so call sites are fully typed and autocompleted.

4. **Call it uniformly.** Migrated TS imports the bucket; legacy JS uses the `window` global:

   ```ts
   import { Controllers } from "@/controllers";
   Controllers.MarketOverview.open(id); // returns Promise<void>
   ```
   ```js
   window.Controllers.MarketOverview.open(id);
   ```

5. **Delete the old `.js` file** from `public/modules/` once ported.

## Lazy vs eager is invisible to callers

A loader is just `() => Promise<resolved>`. To register an already-imported (eager) module, wrap it
with `eager(value)` from `registry.ts` — it resolves on the next microtask, so callers can't tell it
isn't lazy. Switching a module between lazy and eager is a one-line change in `index.ts`; no call
site changes. (All controllers are currently lazy; `eager` exists for future tuning and Services.)

## Rules

- Named exports only — no module-level `window.X = new Thing()` self-registration for lazy modules
  (that pattern is for eagerly-loaded generators like `markets-generator.ts`).
- The registry buckets in `index.ts` contain only `() => import(...)` thunks — no logic. The moment
  a controller is imported statically there, it stops being lazy.
- An entry must never be made thenable: the factory's per-entry proxy returns `undefined` for `then`
  and for symbol keys, so `await Registry.Name` is a no-op rather than a phantom method call. Keep
  that guard if you touch `registry.ts`.
- If a lazy module needs another not-yet-declared global, add it to `src/types/global.ts` under the
  existing `// Global variables defined in main.js` convention — don't `as any` around it.
- Use **d3 v7 via named imports** (`import { select } from "d3"`), not the `window.d3` global. See
  [migration_guide.md](./migration_guide.md#d3-v7-named-imports-only).

## Verifying a module is actually lazy

```sh
npm run build
ls dist/assets | grep market-overview   # expect market-overview-<hash>.js as its own file
```

If the module's code shows up inside the main entry chunk instead of its own file, something in the
eager graph is importing it statically — check `controllers/index.ts` / `generators/index.ts` and
anything they pull in.
```
