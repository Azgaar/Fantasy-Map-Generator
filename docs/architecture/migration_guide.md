# Migration Guide: legacy `public/**/*.js` → bundled `src/**/*.ts`

How to port a classic, un-bundled module (served as-is from `public/`, leaning on
runtime globals) into a typed module inside Vite's graph. See also [lazy_loading.md](./lazy_loading.md),
[architecture.md](./architecture.md), and [data_model.md](./data_model.md).

## Where the file goes

Pick the layer by responsibility, name the file `kebab-case.ts`:

| Layer              | Holds                                                 |
| ------------------ | ----------------------------------------------------- |
| `src/utils/`       | pure, dependency-free helpers                         |
| `src/modules/`     | domain generators / data logic (`Goods`, …)           |
| `src/renderers/`   | code that draws SVG layers                            |
| `src/controllers/` | dialogs, panels, UI flows, overviews                  |
| `src/io/`          | save / load / export / serialization                  |
| `src/services/`    | app-shell & platform lifecycle (PWA install, …)       |
| `src/data/`        | static content / reference data (supporters, …)       |

Not everything is Model/View/Controller. If a file is **static content** (a constant
list, a template table) it goes in `data/`, not `controllers/`. If it manages
**browser/app lifecycle** (PWA install, auto-update, analytics) it goes in `services/`.
If it **serializes or persists** state it goes in `io/`. See
[architecture.md](./architecture.md) "Project Structure" for the full decision guide.

## TypeScript — avoid `any`

- **No `any`.** Use precise types; reach for `unknown` (then narrow) when a type
  is genuinely open. `any` silently disables checking and spreads.
- Prefer **module getters over re-implementing lookups**: `Markets.get(id)`,
  `Goods.get(id)` (both `=> T | undefined`) instead of `pack.markets.find(...)`.
- Import shared helpers from [`../utils`](../../src/utils/index.ts)
  (`ensureEl`, `rn`, `si`, `capitalize`, `convertTemperature`, …). Note
  `isWater(cellId, pack)` is the 2-arg util — distinct from the 1-arg
  `window.isWater`. `element.on("click", fn)` is typed via the
  `Node.prototype.on` augmentation in utils — keep using `.on`.

## Globals: import what's migrated, declare the rest in `global.ts`

A classic module reaches dozens of runtime globals. Resolve each by **origin**,
and **never** use module-local `declare const` or `as any` to paper over one.

1. **It lives in `src/` (migrated)** → **import it.** Utils
   (`src/utils`, e.g. `getPackPolygon`, `isLand`, `generateGrid`, `formatPrice`)
   and generators that self-register a global type (`Names`, `Cultures`, `States`,
   `COA`, …) are already typed; import the util, or use the global directly.
   Watch the signature: the `window.X` wrapper is often re-bound to fewer args
   than the underlying export — call the **real** util with its full arg list
   (`getPackPolygon(i, pack)`, not the 1-arg `window.getPackPolygon`). A global
   only declared on `interface Window` (e.g. `NamesbaseEditor`) is reached as
   `window.NamesbaseEditor`, not bare.
2. **It lives only in classic `public/` code** → **declare it once in
   [`src/types/global.ts`](../../src/types/global.ts)** as `var X: …`, beside the
   existing ones. Do not redeclare a name `global.ts` (or a generator/util
   module) already types — duplicate `var` declarations are a compile error.
3. **It's a DOM element** (an `id`'d node the browser exposes as a global) →
   **don't declare it at all.** Use `ensureEl<HTMLInputElement>("brushSize")` (or
   `document.getElementById`). For an element used several times in a function —
   especially one built from a just-assigned `innerHTML` — grab it once into a
   local `const el = ensureEl(...)`.

## D3: v7 named imports only

The project depends on **d3 `^7.9.0`** with `@types/d3`. Migrate to it.

- **Import named symbols from `"d3"`** — never the `window.d3` global, and prefer
  named imports over a `* as d3` namespace (better tree-shaking, explicit deps):
  ```ts
  import { select, scaleLinear, max } from "d3";
  import type { Selection } from "d3";
  ```
  The page still loads a legacy global D3 (v5) via `<script src="libs/d3.min.js">`
  for the old classic code; bundled TS must not depend on it.
- **Two v5→v7 breaks to fix while porting:**
  1. Selection `.on(type, listener)` now passes `(event, datum)` — the datum is
     the **second** arg (v5 passed it first): rewrite
     `.on("mouseover", d => …)` → `.on("mouseover", (_event, d) => …)`.
     Value accessors (`.attr`, `.text`, `.style`) still take the datum first.
  2. `mean` / `max` / `min` / `extent` return `T | undefined` — handle it
     (`?? 0`, or `!` only when truly guaranteed).
- **`d3.event` is gone in v7.** Old drag/zoom handlers that read `d3.event`
  must move to the event-arg style: take `event` as the listener's first
  param, use `event.transform`, `event.x/y`, and `pointer(event)`.

## File structure & exports

- **Named exports only — no `default` export.** A controller exposes what it
  does: `export const supporters = …`, `export function open() {}`.
- **Function over class** unless you genuinely need instances with shared
  state. Most controllers are a few exported functions over module-scoped
  `let` state.
- **Two ways a module reaches the legacy UI**, pick by usage frequency:
  - _Eager_ (used by most sessions, e.g. overviews): self-register at the
    bottom and type it on `Window`:
    ```ts
    declare global {
      interface Window {
        MarketOverview: { open: typeof open };
      }
    }
    window.MarketOverview = { open };
    ```
    and add `import "./market-overview";` to the layer's `index.ts` barrel.
  - _Rarely used_ (a tiny fraction of sessions): do **not** add it to any
    eager barrel. Register it in the `lazyLoaders` registry so it ships as its
    own on-demand chunk — see [lazy_loading.md](./lazy_loading.md).

## The eval-order gotcha (read this)

`<script type="module" src="controllers/index.ts">` evaluates **before** the
deferred `main.js`, where `let mapId` and many globals are declared. So a
bundled module must **not read a mutable/late global at module top level** —
that throws `ReferenceError` and your `window.X` registration silently never
runs. Read such globals lazily _inside_ the function, and gate first-run DOM
setup behind an `isInitialized` flag. (A `import { … } from "d3"` at top level
is safe — it's part of the module graph, not a runtime global.)

## Finish the port

1. Update each call site (one line): `await import("../dynamic/x.js?v=…")` →
   the eager global or `window.lazy.x()`.
2. `git rm` the old `public/**/x.js` — don't leave a duplicate.
3. Verify: `npx tsc --noEmit` (0 errors) → `npm run lint` → `npm run build`,
   then load the app and confirm `window.X` is registered and the feature
   renders.
