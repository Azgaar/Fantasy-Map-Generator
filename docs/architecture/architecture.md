This document outlines the future architecture of the Fantasy Map Generator. It is intended to guide the development of a new, more consistent and maintainable codebase. The current architecture is a mix of different patterns and styles, which makes it difficult to understand and maintain. The future architecture will be based on clear separation of concerns, modularity and type safety.

## Goals

The FMG 2.0 architecture gradually transforms the project from a large, tightly-coupled application into a modular, maintainable, and testable system.

Main goals:

- Stay fast and responsive in the browser, even on large maps (100k cells)
- Keep memory bounded — build UI on demand and release it on close, so a long session does not grow without limit
- Separate procedural generation from rendering and UI logic
- Make world data independent from SVG / DOM manipulation
- Reduce hidden global state and implicit side effects
- Enable easier contribution and onboarding
- Keep every module typed, imported and explicit: no ambient state beyond the world data
- Improve long-term maintainability without breaking existing `.map` files
- Allow alternative renderers in the future (e.g. WebGL)

---

# Core Architectural Vision

The overall desired architecture model is as below:

```
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
```

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

Map appearance is map state. One plain, JSON-compatible `styles` object holds everything needed to
reproduce how the map looks; the SVG is a projection of it and never the source of truth. Nothing
reads a style value back from the DOM.

The record is keyed by **style element** — a map layer, or `map` for the whole-map filter — and each
element is a tree of three kinds of node:

- `attrs` — SVG attributes, written to the element as they are (`null` means "not set")
- `options` — renderer inputs (`scheme`, `icon`, …), read from the store, never written to the DOM
- `groups` — a record of user-named entries (label groups, lake types, …) sharing one shape

The record is declared once, as a zod schema (`src/model/styles/styles-schema.ts`). The TypeScript
type, the defaults, validation on load and the Style tab's form are all derived from that one
declaration: a style field cannot exist without a type, a default and a control.

Roles, by layer:

- **State** — the `styles` global, complete by construction: `Styles.parse` repairs an invalid or
  missing section from the defaults, so no read site carries a fallback. Serialized whole into the `.map`.
- **Renderers** — read `styles.<element>.options` when drawing; `Styles.write` puts `attrs` onto the
  elements they drew, addressed by `data-layer` / `data-group`, never by element id.
- **Controllers** — `Controllers.StyleEditor` is a form built from the schema at open time: it
  mutates the store and runs the change's effect (write the one attr, or redraw the layer).
  `Controllers.StylePresetsEditor` swaps the whole record for a preset.
- **Services** — `services/style-presets.ts` is the preset source (bundled default, fetched system
  presets, `localStorage` customs); it reads no map state.

Layer visibility and z-order are not style — they belong to the [layers registry](#map-layers).
Per-entity visual overrides (one label's own size) stay with the entity as exceptions to its
group style, not a second style system.

The full model — the record, the store API, presets and persistence, legacy conversion and the
schema-driven editor — is in [style.md](./style.md).

---

# Project Structure

The four-layer model above (state → generators → editors → renderers) is the _conceptual_
core, but a real application also needs code that is none of those: persistence,
app-shell lifecycle, reusable UI, static content, and shared helpers.

| Folder             | Role        | Holds                                                                      |
| ------------------ | ----------- | -------------------------------------------------------------------------- |
| `src/model/`       | Model       | world data definitions, generators, model classes and their edits, options |
| `src/renderers/`   | View (map)  | code that draws SVG / WebGL layers, the layers registry, the viewport      |
| `src/ui/`          | View (UI)   | reusable UI: dialogs, tables, tooltips, web components, map interaction    |
| `src/controllers/` | Controller  | transient editors, tools, dialogs, panels, overviews                       |
| `src/app/`         | Application | composition root: boot, lifecycle, shell, hotkeys, always-on chrome        |
| `src/services/`    | —           | serialization, app-shell & platform infra                                  |
| `src/data/`        | —           | static content / reference data                                            |
| `src/utils/`       | —           | pure helpers: no ambient state, min 2 consumers                            |
| `src/types/`       | Shape       | shared TypeScript interfaces / domain models                               |

Read as MVC: the model is `model/`, the view is `renderers/` (the map) plus `ui/` (widgets), and the
controller is `controllers/`. `app/` wires them together. The fit is loose on purpose — a controller
renders its own dialog markup — so folders are named by role, not by MVC letter.

## Domains inside a role

The role is always the top-level folder, so the layer a file belongs to stays visible in its path.
Inside the two large role folders, `model/` and `controllers/`, files are grouped by **domain**:

| Domain         | Covers                                                                      |
| -------------- | --------------------------------------------------------------------------- |
| `graph/`       | the grid and packed Voronoi graph, and the tools that rebuild it            |
| `physical/`    | heightmap, climate, features, coastline, lakes, rivers, ice, biomes, relief |
| `society/`     | population, cultures, religions, names                                      |
| `political/`   | states, provinces, burgs, diplomacy, military, zones, emblems               |
| `economy/`     | goods, production, markets and trade, state economies, routes               |
| `story/`       | markers, notes, lore, journeys and their transports                         |
| `annotations/` | labels, rulers, the legend: what the map adds on top of the world           |
| `styles/`      | the style record, its schema and formats (`model/` only)                    |
| `style/`       | the Style editor and presets (`controllers/` only)                          |

Inside a domain, an entity gets its own folder once it has **three or more files** there
(`controllers/political/burgs/`); below that the files sit in the domain folder. A domain with many
entities may give each its own folder, so its root holds no loose files (`controllers/economy/`:
goods, markets, production, routes, state economy, trade). A module that serves the whole map rather
than one domain (`map-entities`, `pipeline`, `omnibar`, `context-menu`) stays at the role's root.
`renderers/`, `ui/` and `app/` are small enough to stay flat, with a subject folder only for a cluster
such as `renderers/heightmap/`; what a domain's dialogs share is one file there (`ui/economy-view.ts`).

## What the model is

`src/model/` holds everything that defines the world and its configuration: the generators
(`*-generator.ts`), the model classes that own each entity's edits, styles, the options model and
schema (`model/options/`), icon references (`icons`, `icon-sets`) and the entity registry
(`map-entities`). A model module never opens a dialog or reaches a controller.

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

## What `ui/` is

`src/ui/` holds UI that is **not owned by one editor** and that several callers share rather than copy:

- `ui/dialog/` — the `Dialog` window, dialog helpers, editor tables, sorting, line highlighting, the per-browser dialog state
- `ui/elements/` — reusable custom elements with no map knowledge (`fill-box`, `slider-input`)
- `ui/tooltips.ts` — the tip line
- `ui/map/` — interaction with the map canvas: pan and zoom, the default map events (`viewbox-events`),
  the hover tooltip, the brush (`map-brush`, which owns the size control, radius circle and gestures
  while each tool supplies what a stroke does), placement, `reveal`, and map modes such as `annex-mode`,
  which the States and Provinces editors both drive with their own merge logic

Widgets like `hierarchy-tree` and `minimap` may move to `ui/` if they generalize.

## What `app/` is

`src/app/` is the composition root. `app/index.ts` loads every eager module in order and exports
`boot`; `lifecycle`, `shell`, `canvas`, `seed`, `hotkeys` and `map-commands` drive the application.
`app/chrome/` is the UI that is always there and loads with the shell: the options panel and its
tabs, the load/save/export panes, the Assistant bubble and the About dialog (`app-info`). Nothing
below `app/` imports it.

## Cross-layer subsystems

When a feature spans layers, each part stays under the folder for its role, in the same domain.
Heraldry is the current example:

- `src/data/emblems/` — static heraldry catalogs
- `src/model/political/emblems-generator.ts` — emblem generation
- `src/model/political/armoria.ts` — `Armoria`, reading Armoria's COA format from links, pictures and files
- `src/controllers/political/emblems/` — the Emblems editor and its Armoria editing sessions
- `src/renderers/emblems/` — SVG drawing of emblems. Its shields, lines,
  patterns, templates and diapers are ported from [Armoria](https://github.com/Azgaar/Armoria), and `public/charges/`
  is a verbatim copy of Armoria's charges: sync both from Armoria rather than editing them here

## Why no `core/`

Folders are named by **role**, never by vague importance. A generic `core/` becomes a
junk drawer — everything feels "core," so unrelated code accretes there and the name
stops meaning anything. The same goes for a catch-all `components/`: name the role instead.

## Libraries

New bundled code imports third-party dependencies from **npm**; Vite tree-shakes them
into the graph (e.g. d3 v7 via `import { select } from "d3"`). There is **no vendored
`libs/` under `src/`**.

A large library used by one feature is reached through that feature's dynamic `import()`, so it
lands in a lazy chunk: three.js and its add-ons load with the 3D renderer. A library of a
few dozen lines is kept in `utils/` as typed source (`flat-queue.ts`, `simplify.ts`) rather than added
as a dependency.

## Where does my file go?

- Mutates world state from user input → **editor** in `controllers/<domain>/`
- Presents map state read-only in a dialog the user opens and closes → **overview** in `controllers/<domain>/`
- Transient UI loaded only when opened (for example, the color picker) → `controllers/`
- UI that is always on screen or loads with the shell (options panel, About) → **chrome** in `app/chrome/`
- Boots, regenerates or wires the application together → `app/`
- A dialog helper, widget or custom element several modules share → `ui/`
- Interaction with the map canvas shared by editors (zoom, brush, map modes) → `ui/map/`
- Draws an SVG / WebGL layer (incl. stateful animation engines like `trade-animation`) → `renderers/`
  — and the layer itself is declared in the registry in `renderers/layers.ts`
- Turns coordinates into path data for one layer, or derives data only that drawing needs
  → `renderers/<subject>.ts`, no `draw-` prefix (see [Renderers](#renderers-view))
- Draws transient feedback that removes itself (highlight, brush circle, fog) → `renderers/overlays/`
- Generates, simulates or defines world data → `model/<domain>/`; map options → `model/options/`
- Serializes, saves, loads, or exports state → `services/io/`
- Manages browser/app lifecycle, a platform asset, or app preferences → `services/`
- Talks to the Azgaar server on the user's behalf → `services/assistant/azgaar-server/`
- Talks to the user's own AI provider → `services/assistant/provider/`
- A constant list or template, no behavior → `data/`
- A helper that reads no ambient state and has ≥2 consumers → `utils/`, imported from its own file
- A shared type / interface → `types/`

## Imports point down, never up

Code **imports what it calls** and never reads a module through `window`. The one object the app
puts on `window` is the [scripting surface](#scripting-surface), and the app itself never reads it.

But an import is also a dependency, and dependencies only run **downhill**:

```text
             app                          ← may import anything
              ↑
   controllers / services                 ← ui, renderers, model, below
              ↑
              ui                          ← renderers, model, below
              ↑
          renderers                       ← model, utils, types, data
              ↑
            model                         ← utils, types, data
              ↑
        utils / types / data              ← only each other
```

The `Controllers` and `Services` registries are lazy handles, not eager dependencies: `ui/` may
dispatch through them (`viewbox-events` opens an editor on click), the model and renderers may not.
Type-only imports (`import type { LayerId }`) carry no runtime dependency and may cross.

So `states-editor` imports `tip` from `ui/tooltips`, but a **model or a renderer module that wants
to show a tooltip may not** — that import would point up the stack. Move the message to the
controller that owns the interaction, or let the caller pass the behavior down: `createRegistry` in
`utils/registry.ts` takes its loading feedback from the registry that builds it, and the minimap
follows the camera through `onViewportChange` in `ui/map/zoom.ts` rather than being called by it.

Two seams carry what still has to travel up:

- **`notify`** (`utils/notices.ts`): a model or renderer message for the user; `ui/tooltips` shows it.
- **`App`** (`ui/app-commands.ts`): the composition root's commands — generate or regenerate the map,
  sync the options panel, open a tab, the command catalog — bound by `app/index.ts` at start-up, so a
  controller or a service calls `App.regeneratePrompt()` without importing `app/`.

A few direct upward imports are accepted where a seam would only add indirection: the style store
redraws through the layers registry (`Styles.apply` → `Layers.draw`), the options model keeps custom
icons in `services/local-db`, and the legend positions are stored with the dialog layouts in
`ui/dialog/state`.

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
- **Model classes own their edits.** An edit to an entity (`Burgs.rename`, `States.recolor`,
  `Notes.write`…) is a public method of the class that owns the data. It validates its arguments,
  keeps dependent data consistent (labels, full names, codes, cell ownership) and never redraws. Editors and the
  Assistant call the same method, so there is one implementation of each edit.
- **Keep the data out.** Lookup tables, recipes, and tuning constants are _data_, not
  algorithm. Fixed properties of the domain stay co-located reference data
  ([Configurations and data](#configurations-and-data)); any parameter a user might want to
  change belongs in the map config rather than as a magic number — see
  [Generation is configuration-driven](#generation-is-configuration-driven).

## Renderers (View)

A renderer is a pure projection of state into visuals.

- **Idempotent and stateless.** Drawing the same state twice yields the same output;
  re-running never accumulates. Build the layer from the current state, replace it, done.
- **Read-only.** A renderer never mutates world data. If drawing needs a _fact about the
  world_ that is not in the state, that fact belongs _in_ the state — compute it in a
  generator, not the view.
- Data only the drawing needs — hachure gradients, wave-dash
  placement, how far ripples fade from a shore — is derived per render and never stored on
  `grid`/`pack` or saved.
- **Split the path math from the DOM write.** `draw-*.ts` reads ambient state (`grid`, `pack`,
  `styles`) and writes the layer. Turning coordinates into path data is a sibling module
  without the prefix (`heightmap-contours.ts`, `heightmap-hachures.ts`, `coastal-waves.ts`,
  `lake-ripples.ts`): pure, argument-driven, seeded, unit-tested without a DOM. It stays in
  `renderers/` rather than `utils/` because it has one consumer and emits SVG.
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
- **Vanilla JS first.** Reserve d3 for what it is genuinely good at — geometry, paths, curves,
  colors, scales, projections, quadtrees — and use plain strings / `createElement` for node
  creation, attributes, and event wiring. Never commit a layer to the DOM through d3 selections
  (see [Renderers](#renderers-dom--svg--the-usual-bottleneck) below for why).

### Sizes under zoom

The map zooms as one transform on `#viewbox`, so a size in map units grows with the zoom. That is
the default, and right for most content. Two kinds of drawing should not grow fully, and each has one
mechanism, both driven from `ui/map/zoom.ts`:

- **Content that grows slower than the map**: labels, markers and burg icons. The zoom writes each
  layer's `font-size` along its curve in `ZOOM_CURVES` (`renderers/viewport/viewport.ts`), and the
  content sizes in `%` or `em` under it. It follows the zoom per frame or once the gesture settles, as
  `viewportRedraw` says, because these layers are big. See [the style record](style.md#the-record).
- **UI that keeps its screen size**: editing handles, the regiment base and rotation control, and
  measurer lines and labels. The zoom sets `--px`, one screen pixel in map units (`1 / scale`), on the
  control containers (`CONTROL_CONTAINERS`), and CSS or the renderer sizes them as
  `calc(N * var(--px))`. It updates every frame, since it restyles only those few nodes. Measurer
  dashes stay in map units: stripes that hold still on screen look like they slide while you zoom.

Both values are inherited, so the cost of a change is the subtree under the element it is set on.
Never divide by `viewport.scale` while drawing: the value is out of date after the next zoom. An export
that rescales the map sets both values on its clone for the export scale.

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
- **Transient overlays own their styles.** A palette, popover, or bubble that lives only while
  it is open may render its own `<style>` block next to its markup, scoped under its own id, so
  the rules are created and removed with the element. Keep `src/index.css` for the shell and
  for widgets whose markup is static in `src/index.html`. The omnibar is the reference case: its
  stylesheet is one block in `omnibar.ts`, scoped under `#omnibar`.

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
- **Migrations are isolated and one-time.** Upgrading an older `.map` belongs only in
  `src/services/io/auto-update.ts`, in the `isOlderThan("<version>")` block of the version that
  changed the format. It runs once, on load of an older file; saving writes the current shape, so
  the next load skips it. Code outside `auto-update` (the loader, generators, renderers, editors)
  assumes the current shape: it never back-fills fields older maps lack, nor carries fallbacks for
  them. When a format changes, add the migration block, not a guard in the code that reads the field.

## Services

- **No world state.** Services handle app-shell and platform concerns (install, fonts,
  lifecycle) and must never read or write `pack`/`grid`. A service that touches world data is
  mis-filed — it is really a generator, editor, io module, or (if it merely _presents_ state and
  is always on screen) **chrome**.
- **App preferences are a service.** The `localStorage` scope from
  [Two scopes of configuration](#two-scopes-of-configuration) — UI prefs, pinned requests,
  "don't ask again" flags — is per-browser platform state, never part of the `.map`. Map
  config is not a service; it is state.
- **IO is a service.** Save/load/export live in `src/services/io/`. Like controllers, each
  service/io module exports a single named object (`Save`, `Load`, `ExportMap`, …) reached
  through the `Services` registry (`Services.Save.toMachine()`).
  CSV tables go through `Csv` (`services/io/csv.ts`): downloads quote every value that needs it,
  uploads are parsed and checked there. An editor's upload is `Controllers.CsvUpload.update`
  (`controllers/csv-upload.ts`, lazy like other dialogs) with the editor's column list (shared
  with its download) and one model setter per column. It owns id checks, blank and unchanged cells and population splits,
  runs the setters on a `World` draft for a modal preview the user confirms, then runs them on the
  map; setters must therefore only change data, and the row callback reads its entity by id so it
  gets the draft one. Values another row may change are compared with the map as it was before the
  upload.
  Downloads carry a UTF-8 BOM so spreadsheets keep accented and non-Latin names.
- **Azgaar Assistant** lives in `src/controllers/assistant/`. `index.ts` is its one controller, for the panel, chat list, key sheet and transcript.
  `map.ts` is the open map as the Assistant sees it — one `AssistantMap` object with its id,
  per-question context and its map tools: `read_map`, `propose_change`, `view_emblem`, `view_map` and one `show_*` tool per
  widget (`entities`, `card`, `chart`, `choices`, `inset`). Changes go through
  `operations.ts`, a plain registry of model-class methods, and `proposals.ts`, which dry-runs a
  batch on a draft of the map into a Change and applies, undoes or discards it on the user's click.
  `redraw.ts` derives the layers to redraw from the data a Change touched. Services in
  `src/services/assistant/` do not access world data or the DOM: `chats.ts` persists map-bound chats in IndexedDB;
  `azgaar-server/` answers Guest and Member questions from the documentation and handles Discord sign-in; `provider/`
  serves the Key tier: `connection.ts` stores provider settings and keys in localStorage, `answerer.ts` runs the tool
  loop through `providers.ts` and `openai.ts`, `models.ts` discovers a key's models, `context.ts` builds the system
  prompt, `docs.ts` and `knowledge.ts` serve `read_docs` and `read_help`, and `runtime.ts` runs `read_map` scripts.
  The Azgaar server receives only the question and its server chat id. A connected Provider receives the open-map context
  and tool results directly from the browser. The Assistant never stores chats in `.map` files.
  `read_map` runs model-written JavaScript in page scope with the app's full access, stored keys included. This is an
  accepted, disclosed risk (see the PRD's Further Notes and the Policy wiki page): users load only map files they trust.

## Lazy module registry

Controllers and services are never imported eagerly by their callers; they are reached through
two typed registries — `Controllers` (built in `src/controllers/index.ts`) and `Services` (in
`src/services/index.ts`) — backed by one factory in `src/utils/registry.ts`.

- **One export per module (the convention).** Each registered module exports a single named
  object whose properties are its public methods — `export const StatesEditor = { open }`,
  `export const Save = { toStorage, toMachine, toDropbox, prepareMapData, writeToStorage }`. The registry key matches
  that export name. A module exposing data or a nested object wraps it in a method facade (e.g.
  `CloudStorage` wraps the Dropbox provider) so it fits the dispatch contract.
- **Lazy by default, async at the call site.** `Controllers.X.method(...)` dynamically imports
  the module on first use (its own code-split chunk, evaluated once) and then dispatches — so
  every call returns a Promise. The factory infers each module's real signatures, so callers
  get precise, type-checked contracts rather than `any`.
- **Same handle everywhere.** Every caller imports `{ Controllers }` / `{ Services }`. Markup never
  calls code: a template carries ids or `data-` attributes and its module wires the listeners.

Model, renderers, `ui/` and `app/` modules are different: they are **eager**, imported directly by
their callers, and chrome has no moment at which it would be "opened". See
[lazy-loading.md](./lazy-loading.md) for the full pattern and how to add a module.

## Scripting surface

`window.FMG`, built in `src/app/fmg.ts`, is how a person at the browser console and the Assistant's
`read_map` scripts reach the app: the map state (`pack`, `grid`, `options`, `styles` through getters,
since a regeneration or a load replaces them), the helpers in `utils/`, every model singleton, the
layers registry, `Controllers`, `Services` and a few app commands. `read_map` scripts see each member
by name, so `pack.burgs` works there as `FMG.pack.burgs` does in the console.

- **One-way.** The app never reads `window.FMG`, and TypeScript does not declare it: a module imports
  what it calls. The one reader is the `read_map` runtime, which is the script side: it spreads the
  members into each script's scope at run time.
- **Add, don't bridge.** A new public singleton or command is one line in `fmg.ts`. The Assistant's
  Globals doc is generated from that file (`npm run generate:assistant-context`), so it stays in step.

---

# Map Layers

A map layer is one slot in the map's z-order: an SVG group, the code that draws it, and whether it
is currently on. Layers are the unit the user toggles, reorders and saves, so they are **application
state**, not style and not world data. They live in one registry — `src/renderers/layers.ts` —
which is the single source of truth for layer identity, order and visibility.

Each layer is declared exactly once, as a value in one ordered list. **Registration order is the
z-order, the init order and the draw order**, so the SVG, the Layers tab and the draw sequence
cannot drift apart. A declaration names the layer's id, the SVG group and its parent root, any
permanent child elements and static attributes, and the `draw` / `erase` functions.

The active set and the layer order are serialized with the map (`data[50]`) and re-applied with
`Layers.restore` on load; the load then draws every layer from the map data, as generation does.
`restore` tolerates version skew in both directions: unknown ids are ignored, and layers
the file predates slot in after their registration-order predecessor. A layer id never changes, while
its svg group id is the registry's own: a file carries no groups for the load to adopt.

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
- **Don't build DOM with d3.** A data join (`.data()` / `.datum()`) stores each datum on its node
  as `__data__`, and `.on()` keeps its handlers on `__on`: both live as long as the node, so a
  joined layer holds a second copy of its data in memory. A plain `.append().attr()` chain retains
  nothing, but it is one live-DOM call per node and per attribute plus a throwaway selection per
  step. Assemble the layer's markup as a string and write it once (`el.innerHTML = markup`), as
  `drawBiomes` and `drawHeightmap` do; d3 stays for the pure helpers (`line` and curves, `color`,
  scales, `quadtree`).
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

## Memory management

The app is a long-lived SPA and the world (`grid` / `pack`) is replaced wholesale on every
generation, load, transform and heightmap edit. Almost every leak is one of a few shapes and new code must not add another.

- **A cache must not outlive its world.** Any module-level reference to `pack`, `grid` or a large
  derived copy must be released when the world is replaced. An identity check
  (`sourcePack !== pack`) only rebuilds on the next draw — until then it keeps the whole previous
  world alive. Pair it with a teardown.
- **`clear()` drops.** A module that tracks "the current graph" must null
  that reference on clear; pointing it at the new object while caches still describe the old one
  keeps the old graph reachable.
- **The Layers registry is the teardown seam.** A layer that caches derived data or starts work
  declares an `erase(layer)` that drops both its SVG content and its module state — the registry
  must not know about scenes, and callers must not call per-feature cleanup. At a
  world-replacement point call `Layers.eraseAll()` (or `undraw()`) and let the registry run every
  teardown. Erase **before** the new map is adopted, or you erase what was just loaded.
- **Guard self-perpetuating loops.** A `requestAnimationFrame` / `setTimeout` chain is idempotent
  (a running flag) with a single cancellation point; teardown resets the flag, cancels the handle
  and releases what the loop touched. Async work that can resolve after teardown checks an
  `active` flag before touching the scene.
- **Close dialogs, don't remove them.** `Dialog.close(id)` runs the dialog's `onClose` and removes
  its window with the content; `Dialog.destroy(id)` drops one silently before it is rendered anew.
  Markup built once and reused is opened `persistent`, so closing only hides it.
- **One listener per element, owned by the module.** Bind with property assignment, `.on(...)` or
  an `AbortController` — never `addEventListener` on a page-lifetime element from code that runs
  per open. Create transient inputs in the module that uses them (`createFileInput`) instead of
  parking them in `index.html`.
- **Cap unbounded history.** Undo stacks, session logs and caches store deltas or a fixed-length
  window; nothing on a hot path grows one entry per action, load or map.
- **Release on close.** Editors null their last-viewed entity / detached SVG slots and clear their
  timers when the dialog closes; populated `<select>`s and `document.fonts` are diffed before
  appending, not appended blindly.
- **Dispose resources with a lifetime.** `<script>` tags, object URLs, `FontFace`s, `<defs>` copies,
  and three.js geometry / material / texture / render targets are released by the code that created
  them; a WebGL context is freed with `forceContextLoss()` after `dispose()`.

Review a change against this list: name the owner of every long-lived reference it adds, and the
hook that releases it.

## Load time

Split rarely-used features into on-demand chunks so the initial bundle stays small — see
[lazy-loading.md](./lazy-loading.md).

## Measure, don't guess

Time hot paths with `log.time(…)` / `log.timeEnd(…)` from `utils/logger.ts` and keep the timers.
Profile real maps at large cell counts and optimise the measured bottleneck.

---

# Settings, Options & UI Lifecycle

Settings, options, and style panels are a large share of the app's surface — and a
large share of its memory cost. The configuration _data_
is **State**, and the panels that edit it are **Controllers** (a settings subtype beside
editors and overviews). How configuration is split, stored, persisted, locked, preserved
between maps, validated and migrated is described in
[configuration.md](./configuration.md).

## Configuration is state, not the DOM

- **Every option is a field in an explicit, typed config object** held in state. The panel is
  a _view/editor_ over that object; reading or writing a setting never requires the panel to
  be open.
- **The DOM is not the source of truth, any panel can be destroyed on close** without
  losing a value.

## Two scopes of configuration

Every configurable value is either something true about **this map** or something this
**browser** wants. One object holds both, in sections of different lifetimes:

| Scope              | Section                             | Persisted to                 | Examples                                                            |
| ------------------ | ----------------------------------- | ---------------------------- | ------------------------------------------------------------------- |
| **Map config**     | `options.map`                       | `localStorage` + the `.map`  | seed, extent, world position, climate, units, lore, definition sets |
| **App preference** | `options.generation`, `options.app` | `localStorage` (per browser) | requests for the next map, viewer preferences, UI prefs             |

- **Map config travels with the map** and must round-trip through [IO](#io-serialization); a
  map opened on another machine must look identical. `options.map` _is_ the file's settings
  block — saving writes it and loading replaces it, so there is no second object to keep in step.
- **App preferences never enter the `.map`** — they are this browser's choices, not the
  map's. Keep the sections apart so one user's UI tweaks don't ride along inside a shared map.
- **`options.generation` holds requests; `options.map` holds what happened.** A request and its
  result are different values in different sections with different names, never two copies of one.
- **`options.map` is written by generation, derivation or a file load — and by the editors that
  own its values.** The sliders that ask for the next map write `generation` and change nothing on
  screen. This is what keeps a saved file consistent with the map it describes.

The admission test for each section, and the mechanics of loading, saving, carrying user-authored
sets between maps and validating the object, are in [configuration.md](./configuration.md).

## Generation is configuration-driven

A generator reads its tunable parameters from the **configuration objects**, not from magic
numbers buried in the algorithm: it takes its requests from `options.generation`, and the
parameters that stay true of the map it produced are written into `options.map`. The goal is that every significant
lever of generation — counts, rates, thresholds, spacing, weights — can be changed by the end
user **without editing code**. Many advanced users treat the tool as a sandbox, so
configurability is a feature in its own right, not just a developer convenience.

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
  `.map` restores its saved settings, so a value the user changed reproduces exactly on reload.
- **A count is data, not configuration.** How many states a map has is answered by the world,
  not by the request that produced it; only the rates, ratios and varieties that keep being
  consulted after generation are configuration.

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
  closures. The one exception is the Azgaar Assistant panel: it is built once and hidden on close,
  so an answer in flight, the draft and the scroll survive.
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

# Migration Plan

1. **One world object and its `.map` file.** `pack`, `grid`, `options` and `styles` are still ambient
   globals. They become the single `map` object of [future-data-model.md](./future-data-model.md), and
   the `.map` file becomes that object as JSON instead of today's line-based format. Rendering no
   longer depends on the file's SVG part, so the format can change on its own schedule.
2. **Model code that touches the DOM.** The style store writes attributes to the map's SVG, the icon
   library mounts `#icons-library`, the cultures generator opens a message dialog and the heightmap
   image import draws to a canvas. Each moves to the renderer or controller that owns it.
