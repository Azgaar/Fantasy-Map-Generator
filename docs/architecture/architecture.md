This document outlines the future architecture of the Fantasy Map Generator. It is intended to guide the development of a new, more consistent and maintainable codebase. The current architecture is a mix of different patterns and styles, which makes it difficult to understand and maintain. The future architecture will be based on clear separation of concerns, modularity and type safety.

## Goals

The proposed FMG 2.0 architecture aims to gradually transform the project from a large, tightly-coupled vanilla JavaScript application into a modular, maintainable, and testable system.

Main goals:

- Stay fast and responsive in the browser, even on large maps (100k cells)
- Keep memory bounded — build UI on demand and release it on close, so a long session does not grow without limit
- Separate procedural generation from rendering and UI logic
- Make world data independent from SVG / DOM manipulation
- Reduce hidden global state and implicit side effects
- Enable easier contribution and onboarding
- Support gradual migration from JavaScript to TypeScript
- Improve long-term maintainability without breaking existing `.map` files
- Allow alternative renderers in the future (e.g. WebGL)

---

# Core Architectural Vision

The overall desired architecture model is as below:

````
                 settings
                    │
                    ▼
                GENERATORS
                    │
                    ▼
                  WORLD
           (state: data + style)
                    │
      ┌─────────────┴─────────────┐
      ▼                           ▼
   EDITORS                    RENDERERS
      │                           │
      ▼                           ▼
data mutations            SVG or WebGL Canvas

The architecture is conceptually divided into four major layers:

Or more formally:

```text
world data + styles (state)
        ↑↓
generators (model)
        ↑↓
editors (controllers)
        ↓
renderers (view)
````

All the map-related state should be represented by a single gigantic `map` object. When the `.map` file is saved, the object is transformed into a single json file.

---

# Layer Responsibilities

## 1. World Data Layer (State)

The world data layer is intended to become the central source of truth.

Responsibilities:

- Store all generated world information
- Store rendering style configuration
- Keep normalized data structures
- Provide serialization compatibility with `.map` files
- Remain renderer-agnostic

Important constraints:

- No rendering code (even included style config says what to render, not how to render)
- No DOM elements
- No SVG
- Minimal or no business logic
- Pure data containers

Example stored entities:

- Cells
- Burgs
- States
- Cultures
- Religions
- Rivers
- Biomes
- Routes
- Military
- Zones
- Labels
- Style configuration

The intent is for generators and editors to mutate this state in controlled ways.

---

## 2. Generators Layer (Model)

Generators are responsible for procedural simulation and content creation.

Responsibilities:

- Terrain generation
- Climate simulation
- River generation
- State expansion
- Culture placement
- Burg generation
- Route generation
- Economy simulation
- Military calculations

Key design ideas:

- Generators operate on pure world data
- Inputs and outputs should be deterministic (seeded)
- Generators must not directly manipulate SVG or UI
- Systems should be independently runnable (ideally)
- Pipeline stages should be a composable as possible

Long-term vision:

```text
seed → terrain → climate → hydrology → cultures → states → burgs → routes → economy
```

This creates a clearer simulation pipeline and enables partial regeneration.

---

## 3. Editors Layer (Controllers)

Editors are treated as interactive generators.

Responsibilities:

- User-driven mutations
- Validation and constraints
- Editing workflows
- Tool interactions
- Controlled state updates

Examples:

- River editor
- States editor
- Burg editor
- Religion editor
- Province editor
- Heightmap editor

Important concept: editors should not directly own rendering.

Instead:

```text
User action
    ↓
Editor mutates world state
    ↓
Renderer reacts to updated state
```

This reduces coupling between UI tools and rendering implementation.

---

## 4. Renderer Layer (View)

The renderer becomes a pure visualization step.

Responsibilities:

- Convert world data into SVG / WebGL / canvas output
- Handle layer ordering
- Draw labels and geometry
- Visual styling
- Visual optimizations

Important restrictions:

- Renderer must not modify world state
- Renderer should be idempotent
- Rendering should ideally be stateless

The same world state could theoretically support:

- SVG renderer
- WebGL renderer
- 3D renderer
- External engine export
- Server-side rendering

---

# Project Structure

The four-layer model above (state → generators → editors → renderers) is the _conceptual_
core, but a real application also needs code that is none of those: persistence,
app-shell lifecycle, static content, and shared helpers. The `src/` tree therefore has a
few more folders than the model has layers. This is the **real, intended layout** — not
an aspiration. Each top-level folder is named by **role**, so every file has an obvious
home.

| Folder             | Layer (model)      | Holds                                                              |
| ------------------ | ------------------ | ------------------------------------------------------------------ |
| `src/types/`       | State (shape)      | shared TypeScript interfaces / domain models                       |
| `src/utils/`       | —                  | pure, dependency-free helpers                                      |
| `src/generators/`  | Generators (Model) | procedural generators & domain logic (`Goods`, `Markets`, …)       |
| `src/renderers/`   | View               | code that draws SVG / WebGL layers                                 |
| `src/controllers/` | Editors / UI       | editors, tools, dialogs, panels, overviews                         |
| `src/services/`    | —                  | app-shell & platform/asset infra (install, auto-update, fonts, io) |
| `src/data/`        | —                  | static content / reference data (supporters, templates)            |

## What a "controller" is

`src/controllers/` is the **UI / interaction layer**, deliberately broader than the
textbook MVC "controller." It holds three kinds of UI:

- **Editors** — user-driven mutations of world data (`coastline-editor`,
  `cultures-editor`, `states-editor`). These are the "C" of the conceptual model.
- **Tools** — interactive map tools and workflows.
- **Overviews / visualizations** — read-only views that _present_ map state without
  mutating it (`market-overview`, `charts-overview`, `production-chains`,
  `elevation-profile`).

The unifying rule: _UI that wraps the map and either routes user interaction or presents
map state in a dialog/panel._ A controller does **not** hold pure static data, app-shell
services, or serialization — those have their own folders. (A 3D viewer such as
`view-3d` is a controller that launches an alternate WebGL renderer; like any controller it
exposes an object reached through the registry, while its configuration lives on the global
`options.threeD` rather than inside the controller. Reusable UI building blocks like
`hierarchy-tree` and `minimap` may later move to a `controllers/components/` subfolder if they
multiply.)

## Cross-layer subsystems

Most folders are flat. A tightly-coupled subsystem that genuinely spans layers appears as
a **same-named subfolder inside each layer it touches**, rather than one mixed folder.
Heraldry is the current example:

- `src/generators/emblems/` — emblem generation + heraldry data (registers `window.COA`)
- `src/renderers/emblems/` — SVG drawing of emblems (registers `window.COArenderer`)

This keeps each half under the correct layer (generation vs view) while the shared
`emblems/` name signals they form one feature.

## Why no `core/`

Folders are named by **role**, never by vague importance. A generic `core/` becomes a
junk drawer — everything feels "core," so unrelated code accretes there and the name
stops meaning anything. If a genuinely foundational bucket is ever needed, prefer a
meaningful name like `src/state/` (the `pack`/`grid` container and the serialization
contract) over `core/`.

## Libraries

New bundled code imports third-party dependencies from **npm**; Vite tree-shakes them
into the graph (e.g. d3 v7 via `import { select } from "d3"`). There is **no vendored
`libs/` under `src/`**.

`public/libs/*.min.js` (d3 v5, jQuery, three, …) is loaded via `<script>` tags **only**
for classic `public/**/*.js` that still depend on runtime globals. It is legacy-only and
shrinks as modules migrate: when a feature ports to `src/`, its dependency flips from a
vendored global script to an npm import, and the vendored script is dropped once nothing
classic needs it.

## Legacy → target mapping

As classic code migrates out of `public/`, it lands in the matching `src/` folder:

| Legacy                                  | Target             |
| --------------------------------------- | ------------------ |
| `public/modules/ui/`                    | `src/controllers/` |
| `public/modules/io/`                    | `src/services/io/` |
| `public/config/`                        | `src/data/`        |
| `public/modules/dynamic/` (auto-update) | `src/services/`    |
| `public/libs/`                          | npm imports        |

## Where does my file go?

- Mutates world state from user input → **editor** in `controllers/`
- Presents map state read-only (dialog, chart, list) → **overview** in `controllers/`
- Draws an SVG / WebGL layer (incl. stateful animation engines like `trade-animation`) → `renderers/`
- Generates or simulates world data → `generators/`
- Serializes, saves, loads, or exports state → `services/io/`
- Manages browser/app lifecycle or a platform asset (install, update, fonts) → `services/`
- A constant list or template, no behavior → `data/`
- A pure, reusable helper with no domain knowledge → `utils/`
- A shared type / interface → `types/`

---

# Module Design

The four layers say _where_ responsibility lives. This section says what _shape_ a good module of each type should take.

- **Simple and concise.** The shortest code that reads clearly. Fewer moving parts beat a clever framework.
- **Expressive.** Names and structure state intent; a reader should not have to run the code in their head.
- **Unsophisticated abstractions.** Introduce an abstraction to remove real duplication or to name a real concept.
- **Clean.** Side effects pushed to the edges, a single clear responsibility per module, explicit inputs and outputs.

## Generators (Model)

A generator turns inputs into world data.

- **Explicit in, explicit out.** Take the state to read plus a seed/options; produce the
  data to write. The fewer hidden inputs (ambient globals) it reads, the easier it is to
  reason about and to test. New generators ship with unit tests (`*-generator.test.ts`) —
  design for that from line one.
- **Deterministic.** The same seed reproduces the same world. Seed the RNG once, up front;
  never depend on wall-clock time or unspecified iteration order.
- **No view, no UI.** A generator never reads the DOM, builds SVG, or opens a dialog. If it
  needs to _show_ something, that is a renderer's or controller's job.
- **Keep the data out.** Lookup tables, recipes, and tuning constants are _data_, not
  algorithm. Fixed properties of the domain stay co-located reference data
  ([Configurations and data](#configurations-and-data)); any parameter a user might want to
  change belongs in the map config rather than as a magic number — see
  [Generation is configuration-driven](#generation-is-configuration-driven).

## Renderers (View)

A renderer is a pure projection of state into visuals.

- **Idempotent and stateless.** Drawing the same state twice yields the same output;
  re-running never accumulates. Build the layer from the current state, replace it, done.
- **Read-only.** A renderer never mutates world data. If drawing needs a value that is not
  in the state, that value belongs _in_ the state — compute it in a generator, not the view.
- **No business logic.** Geometry, layout, and styling only. A renderer that decides what is
  _true_ about the world is doing a generator's job.
- **Isolate the rare stateful case.** An animation engine that owns frames or caches is the
  exception: encapsulate its runtime state and give it an explicit reset, so the rest of the
  renderer stays a plain function of state.
- **Framework-free, direct injection.** Rendering is plain markup written straight into the
  DOM — assemble an HTML/SVG string and inject it in one write. No virtual DOM, no component
  runtime, no diffing layer: the renderer keeps full, granular control over exactly what is
  emitted.
- **Vanilla JS first.** d3.js carries a real memory cost and is
  easy to over-reach for. Reserve it for what it is genuinely good at — geometry, paths,
  scales, projections, quadtrees — and use plain strings / `createElement` for node creation,
  attributes, and event wiring. Rerouting simple DOM work through d3 selections is a common,
  avoidable source of bloat.

## Controllers (Editors)

A controller is the thin seam between a user action and the state.

- **Thin.** Translate intent into one explicit state mutation, then ask the renderer to
  redraw. Validation and constraints live here; simulation and drawing do not.
- **Editors mutate, overviews don't.** An editor changes world data and triggers a redraw;
  an overview presents state read-only. Keep the two honest.
- **Safe to re-enter.** Opening a panel twice must be harmless: wire one-time handlers once
  and keep per-session state minimal and local.
- **One object, lazily reached.** A controller exports a single named object —
  `export const StatesEditor = { open }` — and is reached through the `Controllers` registry
  (`Controllers.StatesEditor.open()`), never imported eagerly. See [Lazy module registry](#lazy-module-registry).

## Configurations and data

Static content: lookup tables, templates, tuning constants, reference lists.

- **Data, not behaviour.** Export plain values; no logic, no side effects. This is
  data-driven design: a small generic algorithm reads the data, and the data describes the
  world.
- **Co-locate, then extract.** A table serving one generator can live as a `const` at the
  top of that file. Split it into its own module only once it grows large enough to obscure
  the logic, or once it is shared.

## IO (serialization)

- **The serialized shape is a contract.** A saved `.map` must reload identically, so every
  field written must be a field read back. Keep (de)serialization explicit and symmetric — a
  silently dropped field corrupts saves.
- **Pure functions.** Serialization reads state and returns bytes; it owns no state of its
  own.

## Services

- **No world state.** Services handle app-shell and platform concerns (install, fonts,
  lifecycle) and must never read or write `pack`/`grid`. A service that touches world data is
  mis-filed — it is really a generator, editor, or io module.
- **IO is a service.** Save/load/export live in `src/services/io/`. Like controllers, each
  service/io module exports a single named object (`Save`, `Load`, `ExportMap`, …) reached
  through the `Services` registry (`Services.Save.saveMap(...)`).

## Lazy module registry

Controllers and services are never imported eagerly by their callers; they are reached through
two typed registries — `Controllers` (built in `src/controllers/index.ts`) and `Services` (in
`src/services/index.ts`) — backed by one factory in `src/utils/registry.ts`.

- **One export per module (the convention).** Each registered module exports a single named
  object whose properties are its public methods — `export const StatesEditor = { open }`,
  `export const Save = { saveMap, prepareMapData, saveToStorage }`. The registry key matches
  that export name. A module exposing data or a nested object wraps it in a method facade (e.g.
  `CloudStorage` flattens `Cloud.providers.dropbox`) so it fits the dispatch contract.
- **Lazy by default, async at the call site.** `Controllers.X.method(...)` dynamically imports
  the module on first use (its own code-split chunk, evaluated once) and then dispatches — so
  every call returns a Promise. The factory infers each module's real signatures, so callers
  get precise, type-checked contracts rather than `any`.
- **Same handle everywhere.** Migrated TS imports `{ Controllers }` / `{ Services }`; legacy
  `public/**/*.js` and inline handlers use the `window.Controllers` / `window.Services` globals.

Generators and renderers are different: they are **eager** and self-register their own globals
(`window.Markets`, `window.drawRoutes`) because classic code calls them directly. See
[lazy_loading.md](./lazy_loading.md) for the full pattern and how to add a module.

---

# Performance & Resource Discipline

The whole tool runs in the browser — no server does the heavy lifting — on maps of
hundreds of thousands of cells. Speed and a low memory footprint are therefore
**architectural constraints, not a polish step**. Each layer earns its keep by doing the
least work and holding the least state; the rule of thumb is _touch fewer things_ — fewer
objects, fewer DOM nodes, fewer redraws, fewer listeners.

## State & memory

- **Structure-of-arrays with typed arrays.** Per-cell data lives in parallel typed arrays
  (`pack.cells.h`, `cells.biome`, …), not an array of cell objects.
- **Canonical data only; derived data is disposable.** Store the source of truth; rebuild
  lookups on demand instead of holding and serializing them. Smaller saves, no stale duplicates.
- **Don't copy the world.** Mutate in place through the owning generator; reserve
  `structuredClone`/spread of large arrays for genuine snapshots (e.g. restoring defaults).

## Generators (compute)

- **Work once, at the right granularity.** Full `generate()` for the first build; targeted
  re-runs (`regeneratePlacement(id)`) for an edit — never regenerate the world to change one
  thing.
- **Right structure for the query.** Spatial lookups use a quadtree; cheapest-path growth
  uses a priority queue (`FlatQueue`). An O(n²) scan over cells is a bug at map scale.
- **Iterate arrays, don't materialize objects.** Loop `cells.i` and index the parallel
  arrays; avoid building throwaway object arrays just to walk them.
- **Keep heavy bakes off the interaction path** so a long computation never freezes input.

## Renderers (DOM / SVG — the usual bottleneck)

Every SVG node is a live DOM element; thousands of them slow styling, hit-testing, and
reflow. **Minimising element count is the single biggest rendering lever.**

- **Build once, attach once.** Assemble a layer as one string and write it with a single
  injection, rather than appending nodes in a loop — one parse, one reflow.
- **Don't build DOM with d3.** One cached selection doing a single `.html(str)` write is fine;
  per-node `selectAll().data().enter().append()` chains retain data joins and closures at a
  real per-element cost. Create nodes from strings / `createElement` and reserve d3 for
  geometry, scales, and projections.
- **Fewer, bigger paths.** Merge adjacent same-valued cells into a few region polygons /
  isolines instead of one path per cell.
- **Reuse, don't duplicate.** Define a glyph once in `<defs>` and stamp it with
  `<use href>`; share gradients, filters, and clip-paths by id. The DOM keeps one
  definition, not N copies.
- **Off costs nothing.** A hidden layer should be _cleared_ (`group.html("")`), not left as
  thousands of `display:none` nodes. Re-render only the layers a change actually touches.
- **Round coordinates** (`rn`) in path data — shorter strings parse and paint faster and
  shrink saved SVG.

## Controllers (listeners & cleanup)

The biggest leak risk in a long-lived single-page session is handlers and detached nodes
that are never released.

- **Wire handlers once.** Gate one-time `.on(...)` setup behind an init flag, so reopening a
  panel never stacks duplicate listeners (each duplicate also re-does the work).
- **Clean up on close.** A dialog's `close` handler clears the `innerHTML` it generated and
  tears down what it started — timers, animation loops, listeners — so no large
  detached subtree stays referenced.
- **Delegate for many similar targets.** One listener on a parent that reads
  `event.target`/`dataset` beats one listener per row or cell: fewer retained closures, less
  to remove.
- **Cancel async on teardown.** An in-flight animation or timer checks a generation token
  (or is cleared) so it stops touching the DOM after the user has moved on.

## Load time

Split rarely-used features into on-demand chunks so the initial bundle stays small — see
[lazy_loading.md](./lazy_loading.md).

## Measure, don't guess

Guard hot paths with `TIME && console.time(…)` / `console.timeEnd(…)` and keep the guards.
Profile real maps at large cell counts and optimise the measured bottleneck.

---

# Settings, Options & UI Lifecycle

Settings, options, and style panels are a large share of the app's surface — and a
large share of its memory cost. The configuration _data_
is **State**, and the panels that edit it are **Controllers** (a settings subtype beside
editors and overviews).

## Configuration is state, not the DOM

- **Every option is a field in an explicit, typed config object** held in state. The panel is
  a _view/editor_ over that object; reading or writing a setting never requires the panel to
  be open.
- **The DOM is not the source of truth, any panel can be destroyed on close** without
  losing a value.

## Two scopes of configuration

| Scope              | Source of truth              | Persisted to                 | Examples                                                                |
| ------------------ | ---------------------------- | ---------------------------- | ----------------------------------------------------------------------- |
| **Map config**     | the serialized map state     | the `.map` file              | generation parameters, units, style preset, per-layer style, biome data |
| **App preference** | an app/session config object | `localStorage` (per browser) | UI prefs, panel positions, theme, "don't ask again" flags               |

- **Map config travels with the map** and must round-trip through [IO](#io-serialization); a
  map opened on another machine must look identical.
- **App preferences never enter the `.map`** — they are this browser's choices, not the
  map's. Keep the two apart so one user's UI tweaks don't ride along inside a shared map.

## Generation is configuration-driven

A generator reads its tunable parameters from the **map config object**, not from magic
numbers buried in the algorithm. The goal is that every significant lever of generation —
counts, rates, thresholds, spacing, weights — can be changed by the end user **without
editing code**. Many advanced users treat the tool as a sandbox, so configurability is a
feature in its own right, not just a developer convenience.

- **Promote meaningful constants to config.** The test is _would a user plausibly want to
  change this?_ If yes, it becomes a named field on the config object. If it is a fixed
  property of the domain (the number of biome rings, a recipe ratio), it stays a
  [reference constant](#configurations-and-data).
- **One unified config — no basic/advanced split.** All generation settings live in a single
  flat namespace. "Advanced" is at most a presentation hint for the editor, never a separate
  data structure: splitting the schema fragments serialization and forces arbitrary calls
  about where each value lives.
- **Built for a generic editor.** Because every parameter is a named, plainly-typed field on
  one object, a single planned controller can let users edit _any_ value — basic and advanced
  alike — with no bespoke UI per setting. Keep fields self-describing so that editor stays
  simple.
- **Defaults are part of the schema.** A new map starts from the config defaults; a loaded
  `.map` restores its saved config, so a value the user changed reproduces exactly on reload.

## The editing UI are controllers

Options, Style, Units, and the per-entity editors are all **controllers**. A style/options
panel follows the same data flow as any editor: **mutate config state, then ask the affected
renderer to re-render** — a style change redraws that one layer; a generator-parameter change
re-runs that generator. The panel never paints the map itself.

## Transient UI: build on open, destroy on close

This is the memory design, and it applies to **every** controller — settings panels most of
all, because they are large and numerous. The legacy monolith bakes every dialog, panel, and
list into `index.html` and merely shows/hides them; with big per-entity lists (a row per
state, culture, burg…) that retained DOM — with its listeners and closures — is the main
reason a session can climb toward gigabytes. The target:

- **Minimal static DOM.** `index.html` holds only the always-present shell — map, toolbars,
  layer buttons. Panels are not pre-baked into it.
- **Build on open.** A controller constructs its DOM when opened, wires its listeners, and
  mounts it.
- **Destroy on close — always.** `close()` removes the generated subtree (`element.remove()`),
  drops its listeners, cancels timers/observers/animation loops, and releases references.
  **Hiding is not closing**: a hidden panel still costs its full DOM, listeners, and retained
  closures.
- **Symmetric ownership.** Every `build` has a matching `teardown` in the same controller. If
  `open` created it, `close` destroys it — no orphaned subtrees, no half-freed state.
- **Bound large lists.** A panel over N entities must not materialize N rows when N is large:
  render only the visible window (windowing — not a virtual DOM) or page, and rebuild on scroll.
- **Wire on build, not "once forever."** The legacy `isInitialized` wire-once flag only makes
  sense because the DOM is permanent. In the target, listeners are born with the DOM and die
  with it; re-wiring on each open is cheap and leak-free, whereas keeping the DOM alive just to
  avoid re-wiring _is_ the bug.

The net effect: at rest the app holds the map plus a thin shell; the only heavy UI in memory
is what is **currently on screen**, and closing a panel returns its memory. Footprint tracks
what the user is looking at now — not everything they have opened this session.

---

# Migration Strategy

The refactor is explicitly incremental and is already in progress. The project is too large for a full rewrite, so the architecture aims for:

- Progressive extraction
- Compatibility bridges
- Mixed JS/TS operation
- Gradual module isolation
- Step-by-step modernization

Key strategy: old code continues working, while new subsystems adopt cleaner architecture.

---

# TypeScript Adoption

A major direction of the modernization is gradual TypeScript migration.

Goals:

- Strong typing
- Better editor tooling
- Safer refactors
- Explicit contracts between systems
- Better discoverability for contributors

For the concrete `src/` layout the code actually uses — and a guide to where each new
file belongs — see [Project Structure](#project-structure) below. The transition is
designed to coexist with legacy JavaScript.
