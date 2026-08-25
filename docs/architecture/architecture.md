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
- Labels (addedLabels)
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
The sequence as it exists today is declared as a pipeline — see [generation-pipeline.md](./generation-pipeline.md).

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
- Draw labels and geometry into the layer group it is given (ordering and visibility are owned by the layers registry)
- Apply visual styling from serialized style state
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

# Map Styling

Map styling is map state. The desired model is one plain, JSON-compatible `style`
object that contains everything needed to reproduce the map appearance. SVG attributes
and other rendered output are projections of that object, never the source of truth.

Layer visibility, layer presets, and stacking order are separate concerns and are not part of the style model described here — they belong to the layers registry.

## Problems with the current approach

The current style preset files are close to the desired serializable form, but their
structure mirrors the rendered SVG:

- Most style values live as attributes on SVG elements and are read back from the DOM.
- Presets are keyed by selectors such as `#stateBorders` and `#labels > #states`.
- SVG attributes, custom `data-*` attributes, and application options are mixed together.
- The global `style` object covers only selected subsystems: Label Groups, Burg icon
  groups, and anchor groups. Other styles remain attached to SVG nodes.
- The Style UI changes the rendered SVG directly and calls drawing functions when an
  attribute affects geometry.

This makes the DOM part state container and part renderer output. It also couples preset
files, saving, loading, and migration to the current SVG structure. Renaming or nesting an
SVG group can become a data-format change even when the visible feature did not change.

## Desired style object

The `style` object is organized by map feature rather than by DOM selector. Related
parts are nested, while repeated user-defined styles are stored in keyed `groups`
objects. The following is illustrative schema:

```ts
const style = {
  borders: {
    state: { opacity: 0.8, stroke: "#56566d", "stroke-width": 1, "line-cap": "butt", filter: null },
    province: { opacity: 0.8, stroke: "#56566d", "stroke-width": 0.5, "line-cap": "round", filter: null }
  }
};
```

Existing selector fragments become
nested parts, for example:

- `#statesBody` and `#statesHalo` become `style.states.body` and `style.states.halo`.
- `#freshwater`, `#salt`, and the other lake types become entries in `style.lakes.groups`.
- `#rural` and `#urban` become `style.population.rural` and `style.population.urban`.
- `#stateEmblems`, `#provinceEmblems`, and `#burgEmblems` become nested emblem styles.
- `#goodsCells`, `#goodsIcons`, and `#goodsBurgs` become nested parts of `style.goods`.
- `#legendBox`, `#scaleBarBack`, and the compass rose become nested parts of their owning feature.

The grouping is organizational only. It does not introduce a generic style framework,
CSS cascade, or inheritance system. Each renderer owns the small typed style shape for
its feature.

## Naming and values

- Use html snake case attributes names such as `stroke-width`, `font-size`, `data-dx`.
- Preserve every styling capability users have today, including colors, opacity,
  strokes, typography, filters, masks, textures, patterns, sizes, offsets, and
  feature-specific rendering options.

## Ownership and data flow

The Style controller edits the serialized object and then asks the affected renderer to
redraw:

```text
User changes a style
        ↓
Style controller mutates style.<feature>
        ↓
Feature renderer reads world data + style.<feature>
        ↓
SVG / WebGL / canvas output
```

The renderer translates the feature style into its output format. It may write SVG
attributes, but it must not read those attributes back as current style. Re-rendering
from the same world data and style must produce the same result.

Reusable styles belong in the global `style` object. Existing entity-specific visual
overrides, such as one label's size or offset, may remain with that entity's data. They
are exceptions to a reusable group style, not another global styling system.

## Presets and persistence

Built-in presets, custom presets, and the style stored in a `.map` file use the same
complete object schema.

- Applying a preset replaces the current `style` object and redraws affected features.
- Saving stores the resolved object, not only a preset name, so the map looks the same
  when opened without access to the original preset.
- Custom preset storage may remain an app preference, but its contents use the same
  schema as map style state.
- Selector-based preset files are migrated by mapping each selector and attribute to a
  semantic object path and field.

## Incremental migration

Move one feature at a time:

1. Define its typed style subtree and defaults.
2. Map the corresponding bundled preset values into that subtree.
3. Make its Style controller edit the object rather than SVG attributes.
4. Make its renderer accept the subtree and write the resulting output.
5. Read legacy SVG attributes only in map compatibility code, then store the converted
   values in the style object.

During migration the object can contain both modern feature subtrees and the existing
group-style entries. Once a feature is migrated, its normal editor, renderer, save, and
load paths must not reconstruct its style from the DOM. Existing maps and presets should
retain their appearance throughout the conversion.

---

# Project Structure

The four-layer model above (state → generators → editors → renderers) is the _conceptual_
core, but a real application also needs code that is none of those: persistence,
app-shell lifecycle, static content, and shared helpers.

| Folder             | Layer       | Holds                                                |
| ------------------ | ----------- | ---------------------------------------------------- |
| `src/generators/`  | Model       | procedural generators & domain logic                 |
| `src/renderers/`   | View        | code that draws SVG / WebGL layers                   |
| `src/controllers/` | Controller  | transient editors, tools, dialogs, panels, overviews |
| `src/components/`  | Application | application state and reusable UI                    |
| `src/data/`        | —           | static content / reference data                      |
| `src/services/`    | —           | app-shell & platform infra                           |
| `src/utils/`       | —           | pure helpers: no ambient state, min 2 consumers      |
| `src/types/`       | Shape       | shared TypeScript interfaces / domain models         |

## What a "controller" is

`src/controllers/` is the **UI / interaction layer** broader than the
textbook MVC "controller." It holds three kinds of UI:

- **Editors** — user-driven mutations of world data (`coastline-editor`,
  `cultures-editor`, `states-editor`). These are the "C" of the conceptual model.
- **Tools** — interactive map tools and workflows.
- **Overviews / visualizations** — read-only views that _present_ map state without
  mutating it (`market-overview`, `charts-overview`, `production-chains`,
  `elevation-profile`).

The unifying rule: _UI that is **opened and closed**, and that **mutates or presents map
state**._ A controller does **not** hold pure static data, services, or serialization
— those have their own folders.

## What a "component" is

`src/components/` holds Application state and UI that is **not owned by one editor**. Four kinds:

- **Application state** — statefull application-level modules, active layers and their order,
  viewport zoom and position.
- **Web components** — reusable custom elements with no map knowledge (`fill-box`,
  `slider-input`).
- **App-level UI** — dialogs and widgets that are opened over the map but say nothing about it:
  the About dialog (`app-info`). They have a controller's lifecycle but not a controller's
  subject, so they live here and load with the shell.

Widgets like `hierarchy-tree` and `minimap` may move to `components/` if they generalize.

## Cross-layer subsystems

Most folders are flat. When a feature spans layers, each part stays under the folder for
its role. Heraldry is the current example:

- `src/data/emblems/` — static heraldry catalogs
- `src/generators/emblems-generator.ts` — emblem generation (registers `window.Emblems`)
- `src/renderers/emblems/` — SVG drawing of emblems (registers `window.EmblemRenderer`)

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

## Where does my file go?

- Mutates world state from user input → **editor** in `controllers/`
- Presents map state read-only in a dialog the user opens and closes → **overview** in `controllers/`
- Presents map state but is _always_ on screen → **chrome** in `components/`
- A dialog or widget that knows nothing about the map and loads with the shell (About) → `components/`
- Transient UI loaded only when opened (for example, the color picker) → `controllers/`
- Draws an SVG / WebGL layer (incl. stateful animation engines like `trade-animation`) → `renderers/`
  — and the layer itself is declared in the registry in `components/layers.ts`
- Draws transient feedback that removes itself (highlight, brush circle, fog) → `renderers/overlays/`
- Generates or simulates world data → `generators/`
- Serializes, saves, loads, or exports state → `services/io/`
- Manages browser/app lifecycle, a platform asset, or app preferences → `services/`
- A constant list or template, no behavior → `data/`
- A helper that reads no ambient state and has ≥2 consumers → `utils/`
- A shared type / interface → `types/`

## Imports point down, never up

Bundled code **imports what it calls** — a migrated module must not reach a migrated function
through its `window.*` global. The globals exist for classic `public/**/*.js`, not for `src/`.

But an import is also a dependency, and dependencies only run **downhill**:

```text
components / controllers / services      ← may import anything below
              ↑
          renderers                       ← utils, types, data, generators
              ↑
          generators                      ← utils, types, data
              ↑
        utils / types / data              ← only each other
```

So `states-editor` imports `tip` from `components/tooltips`, but a **generator or a
renderer that wants to show a tooltip may not** — that import would point up the stack. Those
few call sites keep the `window` bridge with a comment saying why; the real fix is to move the
message to the controller that owns the interaction, not to import across the layer boundary.
`utils/registry.ts` is the standing example: it shows a loading tip through `window.tip`
because utils must never depend on the UI.

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
- **Overlays are the other exception, and they live in `renderers/overlays/`.** A highlight
  pulse, the brush circle, fogging — these are drawn from what the user is _doing_, not from
  world state, so they are neither idempotent nor derivable. They are still view code (they
  write SVG and return nothing), so they belong under `renderers/`, but quarantined in their
  own folder and required to **clean themselves up**: an overlay ends by removing its own nodes.
  A visual that is a projection of world state is a layer, not an overlay.
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
  mis-filed — it is really a generator, editor, io module, or (if it merely _presents_ state and
  is always on screen) **chrome**.
- **App preferences are a service.** The `localStorage` scope from
  [Two scopes of configuration](#two-scopes-of-configuration) — UI prefs, locked generation
  options, "don't ask again" flags — lives in `services/preferences.ts`. It is per-browser
  platform state, never part of the `.map`. Map config is not a service; it is state.
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

Generators, renderers, and components are different: they are **eager** and self-register their
own globals (`window.Markets`, `window.drawRoutes`, `window.tip`) because classic code calls them
directly and, in chrome's case, because there is no moment at which they would be "opened". See
[lazy_loading.md](./lazy_loading.md) for the full pattern and how to add a module.

---

# Map Layers

A map layer is one slot in the map's z-order: an SVG group, the code that draws it, and whether it
is currently on. Layers are the unit the user toggles, reorders and saves, so they are **application
state**, not style and not world data. They live in one registry — `src/components/layers.ts` —
which is the single source of truth for layer identity, order and visibility.

Each layer is declared exactly once, as a value in one ordered list. **Registration order is the
z-order, the init order and the draw order**, so the SVG, the Layers tab and the draw sequence
cannot drift apart. A declaration names the layer's id, the SVG group and its parent root, any
permanent child elements and static attributes, and the `draw` / `erase` functions.

The active set and the layer order are serialized with the map (`data[50]`) and re-applied with
`Layers.restore` on load, which adopts the state without redrawing content the loaded SVG already
carries. `restore` tolerates version skew in both directions: unknown ids are ignored, and layers
the file predates slot in after their registration-order predecessor.

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
- **Off costs nothing.** A hidden layer is hidden with `display: none` on its group and its content
  is dropped, not kept as thousands of hidden nodes — the registry does both. Only content that is
  expensive to rebuild or holds user edits opts out (`keepContent`). Re-render only the layers a
  change actually touches, through `Layers.draw(...)`.
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

| Scope              | Source of truth              | Persisted to                 | Examples                                                     |
| ------------------ | ---------------------------- | ---------------------------- | ------------------------------------------------------------ |
| **Map config**     | the serialized map state     | the `.map` file              | generation parameters, units, resolved map style, biome data |
| **App preference** | an app/session config object | `localStorage` (per browser) | UI prefs, panel positions, theme, "don't ask again" flags    |

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
renderer to re-render** — a style change redraws the affected visual feature; a generator-parameter change
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
- **Wire on build, not "once forever."** Listeners are born with the DOM and die
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
