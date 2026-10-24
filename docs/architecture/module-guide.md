# Module Guide

How to write a module in `src/`: where it goes, how it reaches other code, and the shape each kind of
module takes. See also [architecture.md](./architecture.md), [lazy-loading.md](./lazy-loading.md) and
[data-model.md](./data-model.md).

## Where the file goes

Pick the layer by responsibility, then the domain folder inside it ([architecture.md](./architecture.md#domains-inside-a-role)), name the file `kebab-case.ts`:

| Layer                     | Holds                                                          |
| ------------------------- | -------------------------------------------------------------- |
| `src/model/`              | world data definitions, generators, model classes, options     |
| `src/renderers/`          | code that draws SVG layers, the layers registry                |
| `src/renderers/overlays/` | transient feedback that removes itself (highlight, fog)        |
| `src/ui/`                 | shared UI: dialog toolkit, tooltips, elements, map interaction |
| `src/controllers/`        | map UI you open and close: editors, tools, overviews           |
| `src/app/`                | boot, lifecycle, shell; always-on chrome in `app/chrome/`      |
| `src/services/`           | app-shell & platform infra, incl. preferences                  |
| `src/data/`               | static content / reference lists                               |
| `src/utils/`              | pure helpers — no ambient state, ≥2 consumers                  |

Not everything is Model/View/Controller. Before reaching for `controllers/` or `utils/`, apply
these three tests — a large feature usually splits across four or five folders:

- **Does the user open and close it, _and_ is it about the map?** Both yes → `controllers/`.
  Always on screen, or opened but not about the map and loaded with the shell (an About
  dialog) → `app/chrome/`. Shared by several editors → `ui/`. Transient UI loaded only when first opened (such as
  the colour picker) → `controllers/`.
- **Does it read `pack`/`grid`?** Then it is not a `service`, whatever else it is.
- **Does it read an ambient global, or have only one consumer?** Then it is not a `util` —
  put it in the module that uses it, or pass the state in as an argument. Values in the map's own
  units read `options.map.units`, so they are model code (`model/units.ts`); speech and browser storage
  are platform services (`services/speech.ts`, `services/local-db.ts`); the name a download is saved
  under belongs to io (`services/io/file-name.ts`).

If a file is **static content** (a constant list, a template table) it goes in `data/`. If it
manages **browser/app lifecycle** (PWA install, auto-update, io, preferences) it goes in
`services/`. See [architecture.md](./architecture.md#project-structure) for the full rationale.

## TypeScript — avoid `any`

- **No `any`.** Use precise types; reach for `unknown` (then narrow) when a type
  is genuinely open. `any` silently disables checking and spreads.
- Prefer **module getters over re-implementing lookups**: `Markets.get(id)`,
  `Goods.get(id)` (both `=> T | undefined`) instead of `pack.markets.find(...)`.
- **Path alias**: `@/*` resolves to `src/*` (configured in `vite.config.ts` and
  `tsconfig.json`). Prefer it to deep `../../` chains — e.g. `@/utils/number-utils`,
  `@/model/economy/markets-generator`. Sibling imports stay relative (`./box`).

## Imports, not globals

- **Import what you call.** A module reaches another module's functions, singletons and
  constants through an `import`, and only downhill (app → controllers/services → ui → renderers →
  model → utils). Never through `window`, and never with a `declare global` for app code.
- **Import from the file that defines it.** There are no barrel `index.ts` files that re-export a
  folder: `import { rn } from "@/utils/number-utils"`, not from `@/utils`. A barrel makes every importer
  load the whole folder and its own imports, which drags unrelated modules into import cycles. The
  `index.ts` of `controllers/` and `services/` are registries, not barrels.
- **App commands go through `App`.** A controller or service that has to regenerate the map, sync the
  options panel or open a tab calls `App.…` from `ui/app-commands.ts`, which `app/index.ts` binds at
  start-up; a model or renderer message for the user goes through `notify` in `utils/notices.ts`.
- **The world state is the exception.** `pack`, `grid`, `options` and `styles` are
  read bare; they are declared beside their owners ([`model/globals.ts`](../../src/model/globals.ts),
  [`options-model.ts`](../../src/model/options/options-model.ts), [`styles.ts`](../../src/model/styles/styles.ts)).
  Read them inside functions, never at module top level.
- **`declare global` is for the platform only:** a browser API the DOM typings lack (`showSaveFilePicker`),
  the Electron bridge.
- **The console and the Assistant** reach the app through `window.FMG` ([architecture.md](./architecture.md#scripting-surface)).
  A new public singleton or command is one line in [`src/app/fmg.ts`](../../src/app/fmg.ts).
- **DOM elements** are never globals: `ensureEl<HTMLInputElement>("brushSize")` when the element must
  exist, `findEl` when it may be missing (`findEl("preview")?.remove()`). Never raw
  `document.getElementById` outside tests. For an element used several times in a function —
  especially one built from a just-assigned `innerHTML` — grab it once into a local `const el = ensureEl(...)`.
- **Markup never calls code.** No `onclick=` or other inline handler in a template: give the element an id
  or a `data-` attribute and wire the listener in the module that renders it.

## D3: v7 named imports only

The project depends on **d3 `^7.9.0`** with `@types/d3`.

- **Import named symbols from `"d3"`**, and prefer named imports over a `* as d3` namespace
  (better tree-shaking, explicit deps):
  ```ts
  import { type Selection, select, scaleLinear, max } from "d3";
  ```
- Selection `.on(type, listener)` passes `(event, datum)`: the datum is the **second** arg.
  Value accessors (`.attr`, `.text`, `.style`) still take the datum first.
- `mean` / `max` / `min` / `extent` return `T | undefined` — handle it (`?? 0`, or `!` only when truly
  guaranteed).
- There is no `d3.event`: drag and zoom handlers take `event` as the listener's first param and use
  `event.transform`, `event.x/y`; read pointers with the touch-safe `getPointer()` from `@/utils`.
- **Select at the point of use.** Never cache a selection at module top level: a map load replaces
  the whole SVG.

## File structure & exports

- **Named exports only — no `default` export.** A module exposes what it does:
  `export const Markets = …`, `export function open() {}`.
- **Export only what another module imports.** Types, helpers and constants used within one module
  stay unexported.
- **Function over class** unless you genuinely need instances with shared state. Most controllers
  are a few exported functions over module-scoped `let` state.

## Canonical module skeletons

Each skeleton below is the shape to aim for — small, explicit, and testable — embodying the principles in [architecture.md](./architecture.md).
Write the real work as plain functions that take their inputs as arguments, so a unit test can call
them without the app.

### Generator

```ts
// src/model/<domain>/module-generator.ts
import Alea from "alea";

export interface Module {
  i: number;
  name: string; /* serializable fields only */
}

// explicit inputs → data out. Deterministic, no DOM, trivially unit-tested
function generate(seed: string): Module[] {
  Math.random = Alea(seed); // seed once; same seed - same world
  return [];
}

export const Modules = { generate };
```

Reach for a `class` (exported as one singleton instance) if the subsystem owns mutable runtime state.

### Data

```ts
// co-located: a const at the top of the generator that consumes it
const MODULE_DATA = [{ name: "Cog", value: 1 } /* … */] as const;

// src/data/<name>.ts once large, or once another layer needs it
export const CULTURE_SETS = {/* … */};
```

No logic here — the data says _what_, the generator decides _how_. Static data that a schema or
another module reads at load time belongs in `data/`: a generator imports half the model, and a
constant read through it at module top level can be caught mid-way through a circular import.

### Renderer

```ts
// src/renderers/draw-module.ts
// a pure projection of state → markup. Same state ⇒ same output; reads only
export function drawModule(): void {
  ensureEl("moduleLayer").innerHTML = buildModule(pack);
}
```

The layer itself is declared in the registry in `renderers/layers.ts`, which calls the draw function.

### Controller

```ts
// src/controllers/<domain>/module-editor.ts
// thin: intent → state change/redraw
import { Dialog } from "@/ui/dialog/dialog";
import { ensureEl } from "@/utils/node-utils";

let controllerState: unknown; // optional, for a panel that preserves some UI state across opens

function open(id: number): void {
  render();
  addListeners();

  Dialog.open("moduleEditor", { title: "Module Editor", onClose: cleanup });
}

function render(): void {
  /* insert the dialog markup into #dialogs, set values from pack */
}

function addListeners(): void {
  /* wire event handlers to update pack, redraw, etc. */
}

function cleanup(): void {
  /* remove any DOM this module created, drop listeners, reset module-scoped state */
}

export const ModuleEditor = { open };
```

All controllers are reached through the [`Controllers`](../../src/controllers/index.ts) registry and
lazy-loaded, unless they are needed immediately on app start.

### Own your HTML — create it on open, remove it on close

A module is responsible for the full lifecycle of any DOM it introduces:

- **Create its own markup.** Don't rely on a node hand-authored in
  [`index.html`](../../src/index.html) being present. If the module needs a dialog,
  panel, overlay, or SVG layer, build it (via `innerHTML`, `createElement`, or a
  `Dialog` helper) when `open()` runs — and guard against duplicating it if
  `open()` is called twice.
- **Remove it on close.** The `onClose`/`cleanup` path must delete every node the
  module added (`el.remove()`, `select("#moduleLayer").remove()`), detach event
  listeners it attached to shared/global targets (`window`, `document`, `svg`,
  `body`), and reset module-scoped `let` state. Leave the DOM exactly as the
  module found it — no orphaned nodes, no leaked handlers.

Wiring `cleanup` through the dialog's `onClose` (as above) is the seam that makes
this automatic: opening builds the UI, closing tears it down. A module that only
ever toggles visibility of a pre-existing node is a smell to fix, not preserve.

### Service (app-shell lifecycle)

```ts
// src/services/something.ts — app/browser lifecycle only; never reads or writes pack/grid
function init(event: Event): void {
  /* PWA install, fonts, tour, auto-update … */
}

export const Something = { init };
```

## Load order

[`src/main.ts`](../../src/main.ts) loads the interface strings, then imports
[`app/index.ts`](../../src/app/index.ts), the composition root, and boots on `DOMContentLoaded`.

- **Nothing runs at import time that reaches another module.** A module's top level may declare,
  build its own singleton and wire its own static DOM, but must not call into another module's
  singleton or read the world state: the import graph has cycles, and a module caught mid-way through
  one is not initialized yet (`Cannot access 'X' before initialization`). Do that work in a function
  the boot sequence calls.
- **The world state is filled in order.** `model/globals.ts` and `model/options/options-defaults.ts`
  come first, so `pack`, `grid` and `options` exist from the start, holding placeholders until the boot
  restores the options and the first generation fills the map.

(An `import { … } from "d3"` at top level is always safe — it's a package, outside the app's cycles.)

## Verify

`npx tsc --noEmit` (0 errors) → `npm run lint` → `npm run test` → `npm run build`, then load the app
and use the feature.
