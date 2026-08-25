# Legacy Runtime and `index.html` Modernization Plan

## Purpose

Finish the transition from classic runtime seams and permanently mounted UI to bundled,
typed modules with owned lifecycle. This is an incremental maintenance plan, not a rewrite.

The outcome is:

- map logic remains in the existing `src/` architectural layers;
- new code imports its dependencies rather than reaching them through globals;
- dialogs are created when opened and removed when closed;
- `src/index.html` becomes an application shell, the map SVG, and only genuinely persistent
  browser infrastructure;
- current `.map` files, supported historical map versions, and intended browser APIs keep
  working.

## Current baseline

The original `public/modules/` target no longer exists. Most application code has already moved
into `src/` (including generators, controllers, renderers, services, components, and utilities).
The remaining JavaScript served from `public/` is primarily vendored code and the service worker.

Important remaining seams are:

| Area | Current state | Plan direction |
| --- | --- | --- |
| `libs/alea.min.js` | Loaded globally although `alea` is already an npm dependency | Convert bare callers to imports, then remove the script/global bridge |
| `libs/flatqueue.js` | Global queue used by generators, a util, and a renderer | Select and approve an npm/package or local typed implementation before migrating callers |
| `libs/simplify.js` | Legacy global used by geometry rendering | Make the existing typed utility the single API, then remove the global load |
| `libs/indexedDB.js` | Compatibility wrapper around local-map persistence | Isolate behind a typed `services/io` adapter; keep the browser storage behavior unchanged |
| `JSZip`, Dropbox, RGBQuant, TinyMCE | Optional or on-demand integrations | Modernize independently, with feature coverage and an explicit dependency decision |
| `src/index.html` | 5,267 lines: persistent workspace, option panels, static dialogs, file inputs, and SVG definitions | Extract controller-owned dialogs first; leave the shell and SVG definitions until their dependencies are ready |

`public/sw.js` remains a public service-worker asset. It is not an application module and is out
of scope unless the PWA lifecycle itself is being changed.

## Guardrails

Every slice must follow these constraints:

1. Do not change the saved-map format, version support, positional save placeholders, or migration
   ordering as incidental refactoring.
2. A migrated generator must not import a controller, component, or renderer. Renderers must not
   mutate world state.
3. Keep a `window.*` bridge only when a classic caller or supported external API still needs it.
   Audit `public/`, `src/index.html`, dynamic markup, tests, docs, and the intended browser API
   before removing one.
4. Do not add a production dependency without explicit approval. In particular, choosing a
   replacement for FlatQueue, JSZip, Dropbox, RGBQuant, or TinyMCE is a separate decision.
5. Each pull request moves one coherent capability and deletes its replaced static markup or
   legacy load in the same change. Do not leave duplicate UI as a fallback.
6. Do not broadly rewrite `src/index.html`. Preserve its structure and move small, independently
   testable regions only.

## Workstream A: remaining public runtime dependencies

### A0. Establish the compatibility inventory

Before changing a library, record in the pull request:

- its load site(s) in `src/index.html` or dynamic loader;
- every application caller and whether it uses a global or an import;
- whether it is startup-critical, lazy-loaded, or used only by an optional feature;
- the associated user workflow and focused test;
- the global type and bridge that can be deleted at the end.

This inventory prevents a minified file from being mistaken for dead code.

### A1. Remove the redundant Alea global first

This is the lowest-risk runtime slice because `alea` is already installed from npm and multiple
bundled modules use it.

1. Replace bare `Alea(...)` calls in `src/` with `import Alea from "alea"`.
2. Preserve seeded call order and inputs exactly; determinism is behavior, not implementation
   detail.
3. Update tests that currently rely on the global binding.
4. Search for every remaining `Alea` reference, including classic files and inline code.
5. Remove the `libs/alea.min.js` script tag and its global declaration only when no supported
   caller remains.
6. Run deterministic-generation tests for the affected generators and the map-generation E2E
   coverage.

### A2. Make FlatQueue an explicit dependency

FlatQueue is used by state expansion, routes, cultures, religions, provinces, zones, markets,
path utilities, and trade animation. It crosses layers, so this is a dependency migration rather
than a file move.

1. Decide whether to add the maintained npm package or adopt a small local typed implementation.
   Obtain explicit dependency approval for the npm option.
2. Add a typed adapter with the small queue API the app actually uses.
3. Migrate one subsystem family at a time: generators first, then utility/renderer callers.
4. Replace global test polyfills with unit tests against the adapter where appropriate.
5. Remove `window.FlatQueue`, the global type, and `libs/flatqueue.js` only after the final caller
   and compatibility audit.

### A3. Move the simple geometry and storage seams

Do these as separate pull requests:

- **Simplify:** route all callers through the typed simplification utility; then remove the script
  tag and global type. Verify coastline and feature geometry output.
- **IndexedDB:** define a small storage interface in `services/io`, provide the browser adapter,
  and keep save/load behavior and failure messages stable. Verify local-map restore and clear.
- **Optional integrations:** retain lazy loading for JSZip, Dropbox, RGBQuant, and TinyMCE until
  a feature-specific proposal covers bundle size, licenses, authentication, and fallback UX.

## Workstream B: controller-owned UI extraction

### B0. Build the reusable lifecycle seam first

The shared dialog toolkit in `src/components/dialog/` is the required foundation. Before
extracting a dialog, make sure it can:

- mount a typed `HTMLElement` into the dialog host;
- own and clean up event listeners, timers, observers, and object URLs;
- support existing focus, Escape, dragging, close, and sizing behavior;
- return a promise or callbacks only when the dialog’s workflow needs a result;
- coexist with legacy static dialogs during the migration.

Prefer a small `create…Dialog()` factory that returns the root element and a cleanup function.
Do not introduce a second generic UI framework beside the existing React/dialog toolkit.

### B1. Extract generic dialogs

These have little map knowledge and should move first:

1. `#alert` and `#prompt` → `src/components/dialog/`.
2. `#addFontDialog` → the style component subsystem.
3. `#styleSaver` → `src/components/style/`.

For each dialog, migrate its opener and listeners, remove the static element from
`src/index.html`, and add a focused browser test for open → interaction → close → reopen. The
reopen check catches retained listeners and stale DOM references.

### B2. Extract map-specific editors and IO dialogs

Move only the dialog that is being changed for product work:

| Static region | Owning module after extraction | Notes |
| --- | --- | --- |
| `#unitsEditor` | `controllers/units-editor.ts` | Existing controller already owns its behavior; make its DOM lifecycle-owned |
| `#exportMapData` and `#exportToPngTilesScreen` | an IO-facing controller calling `services/io` | UI owns selection; service owns serialization/export |
| `#saveMapData` and `#loadMapData` | an IO-facing controller calling `services/io` | Preserve Dropbox and local-storage flows while their services remain separate |
| Other editor dialogs | their existing controller | Migrate with the editor, never as a markup-only sweep |

`services/io` must remain free of map-editing UI. It exposes persistence operations; a controller
or component presents the dialog and invokes them.

### B3. Split persistent workspace markup only after dialogs

The options side panel (`#optionsContainer`) is persistent application chrome, not an
open-and-close controller. After B1 and B2 have reduced the blast radius, split it by tab:

1. layers panel;
2. tools panel;
3. generation/preferences panel;
4. style editor, last because it has the densest control surface.

Each tab must retain its IDs during its first extraction so existing event bindings keep working.
Only after a tab is mounted through a typed component should its event binding move to local
references and its legacy ID-based access shrink. This makes the first move structural but not
behavioral.

### B4. Keep the shell and SVG definitions stable

Leave these in `src/index.html` during the dialog work:

- the root map SVG and layer ordering;
- the loading shell, persistent preview/workspace chrome, file-input host, and drag/drop overlay;
- `#defElements`.

The Vite plugin currently reads `#defElements` directly from `src/index.html` to emit
`def-elements.svg`. Moving it requires a separate build-pipeline change with generated-asset and
visual rendering coverage. It is not a suitable early extraction.

## Delivery sequence

The recommended order keeps every change small and independently releasable:

1. **Baseline:** document global/runtime ownership and add or confirm focused test coverage for
   seeded generation, dialog reopen/cleanup, save/load, and map rendering.
2. **Alea:** convert to imports and delete its startup global.
3. **Generic dialogs:** alert/prompt, then add-font and style saver.
4. **Units editor:** first map-specific lifecycle extraction.
5. **IO dialogs:** export, then save/load, with focused current-map and historical-map fixtures.
6. **FlatQueue decision and migration:** only after explicit approval.
7. **Persistent workspace tabs:** one tab per pull request, starting with layers.
8. **Optional library proposals:** one vendor integration at a time.
9. **SVG definitions/build pipeline:** only once the above work has stabilized.

## Pull request template and completion criteria

Every migration pull request should state:

- capability moved and its source/destination ownership;
- globals, static elements, scripts, and types removed or intentionally retained;
- `.map` compatibility assessment;
- before/after bundle-size impact when a library or build entry changes;
- focused tests and manual workflow exercised.

Minimum checks are `npx tsc --noEmit`, `npm run build`, focused unit tests, and the relevant
Playwright scenario. Run `npm run lint` only when the changed files are inside its configured
scope. For any save/load path, verify a current map and representative historical fixtures;
for seeded generation, verify reproducibility with a fixed seed.

The modernization is complete only when the remaining root HTML contains intentional shell and
SVG infrastructure, public JavaScript is limited to deliberate vendor/service-worker assets,
and each retained global has a documented compatibility owner.
