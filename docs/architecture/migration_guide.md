# Migration Guide: legacy `public/**/*.js` → bundled `src/**/*.ts`

How to port a classic, un-bundled module (served as-is from `public/`, leaning on
runtime globals) into a typed module inside Vite's graph. See also [lazy_loading.md](./lazy_loading.md),
[architecture.md](./architecture.md), and [data_model.md](./data_model.md).

## Where the file goes

Pick the layer by responsibility, name the file `kebab-case.ts`:

| Layer              | Holds                                                 |
| ------------------ | ----------------------------------------------------- |
| `src/utils/`       | pure, dependency-free helpers                         |
| `src/generators/`  | domain generators / data logic (`Goods`, …)           |
| `src/renderers/`   | code that draws SVG layers                            |
| `src/controllers/` | dialogs, panels, UI flows, overviews                  |
| `src/services/`    | app-shell & platform/asset infra (install, fonts, io) |
| `src/data/`        | static content / reference data (supporters, …)       |

Not everything is Model/View/Controller. If a file is **static content** (a constant
list, a template table) it goes in `data/`, not `controllers/`. If it manages
**browser/app lifecycle** (PWA install, auto-update, analytics, io) it goes in `services/`.

## TypeScript — avoid `any`

- **No `any`.** Use precise types; reach for `unknown` (then narrow) when a type
  is genuinely open. `any` silently disables checking and spreads.
- Prefer **module getters over re-implementing lookups**: `Markets.get(id)`,
  `Goods.get(id)` (both `=> T | undefined`) instead of `pack.markets.find(...)`.
- **Path alias**: `@/*` resolves to `src/*` (configured in `vite.config.ts` and
  `tsconfig.json`). Prefer it to deep `../../` chains — e.g. `@/utils`,
  `@/generators/markets-generator`. Sibling imports stay relative (`./box`).
- Import shared helpers from [`@/utils`](../../src/utils/index.ts)
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
  import { type Selection, select, scaleLinear, max } from "d3";
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
    eager barrel. Register it in the `lazyLoaders` registry
    ([`src/lazy-loaders.ts`](../../src/lazy-loaders.ts), a top-level
    layer-agnostic file) so it ships as its own on-demand chunk — see
    [lazy_loading.md](./lazy_loading.md).

## Canonical module skeletons

Migrate _toward_ clean code. Each
skeleton below is the shape to aim for — small, explicit, and testable — embodying the principles in [architecture.md](./architecture.md).

The recurring move is **separate the logic from the legacy seam**: write the real work as
plain exported functions that take their inputs as arguments (so a unit test can call them
without the app), then add a thin `window` bridge at the bottom that wires those functions
to the ambient globals classic callers expect. The bridge is a temporary interop
concession — keep it to a few lines and delete it once every caller is TypeScript. Globals
referenced bare (`pack`, `grid`, `seed`, `TIME`, `customization`, `$`, `layerIsOn`, …) come
from `main.js`/legacy and are typed in [`src/types/global.ts`](../../src/types/global.ts) or
by the owning module — import or declare, never `as any`.

### Generator

```ts
// src/generators/module-generator.ts
import Alea from "alea";

export interface Module {
  i: number;
  name: string; /* serializable fields only */
}

// Clean core: explicit inputs → data out. Deterministic, no DOM, trivially unit-tested
function generate(seed: string): Module[] {
  Math.random = Alea(seed); // seed once; same seed - same world
  return [];
}
export const Module = { generate, get };

// Temporary Legacy seam — classic callers reach the generator as a global.
declare global {
  var Module: { generate: typeof generate; get: typeof get };
}
window.Module = {
  generate: () => void (pack[module] = generate(pack, seed)),
  get: i => getWidget(pack.widgets, i)
};
```

Reach for a `class` if the subsystem owns mutable runtime state.

### Data

```ts
// src/data/module-data.ts
// co-located: a const at the top of the generator that consumes it
const MODULE_DATA = [{ name: "Cog", value: 1 } /* … */] as const;

// split out once large
export const charges = {
  types: {
    /* … */
  }
};
```

No logic here — the data says _what_, the generator decides _how_.

### Renderer

```ts
// src/renderers/module-renderer.ts
// Clean core: a pure projection of state → markup. Same state ⇒ same output; reads only.
function draw(): string {
  return (document.getElementById("moduleLayer").innerHTML = buildModule(pack));
}
export const ModuleRenderer = { draw };

// Legacy seam: apply to the layer + a toggle, registered for classic callers
declare global {
  interface Window {
    drawModule: typeof draw;
  }
}
window.drawModule = draw;
```

### Controller (overview / editor)

```ts
// src/controllers/module-editor.ts
// thin: intent → state change/redraw
import { ensureEl } from "../utils";

let controllerState: unknown; // optional, for a panel that preserves some UI state across opens

function open(id: number): void {
  const dialog = render();
  addListeners(dialog);

  dialog.open({ title: "Module Editor", onClose: cleanup });
}

function render(): void {
  /* build innerHTML, set values from pack */
}

function addListeners(dialog): void {
  /* wire event handlers to update pack, redraw, etc. */
}

function cleanup(): void {
  /* clear innerHTML, remove listeners */
}

export const ModuleEditor = { open };

// Legacy seam: registered for classic callers
declare global {
  interface Window {
    ModuleEditor: { open: typeof open };
  }
}
window.WidgetOverview = { open };
```

Most of controllers should be [`lazy-loaded`](../../src/lazy-loaders.ts).

### Service (app-shell lifecycle)

```ts
// src/services/something.ts — app/browser lifecycle only; never reads or writes pack/grid
function init(event: Event): void {
  /* PWA install, fonts, tour, auto-update … */
}

export const Something = { init };
```

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
