# Legacy Code and Compatibility Policy

In this repository, **legacy** does not mean "unused". It describes several different
parts of the gradual Fantasia 2.0 migration, and each part has a different removal policy.
Deleting code merely because it is marked legacy can break the running application,
the public browser API, or users' saved `.map` files.

## The four meanings of legacy

| Category | What it contains | Removal policy |
| --- | --- | --- |
| Classic runtime | Unbundled JavaScript in `public/`, global state, global libraries, inline handlers, and static UI | Port incrementally, then remove the replaced file and dependency |
| Compatibility bridges | `window.*` registrations that connect bundled TypeScript to classic code or supported browser APIs | Remove one symbol at a time after every caller and compatibility requirement is gone |
| Saved-map compatibility | Versioned migrations, deprecated fields, and reserved positions in the `.map` format | Keep while the corresponding map versions remain supported |
| Vendored-library internals | Deprecation warnings or compatibility aliases inside `public/libs/` | Do not edit individually; upgrade, migrate, or remove the library as a unit |

The target is less classic runtime and fewer bridges, **not** the blanket deletion of
everything described as legacy.

## 1. Classic runtime

The former application scripts `public/main.js`, `public/modules/ui/layers.js`,
`options.js`, `style-presets.js`, and `style.js` have been ported to bundled TypeScript and
deleted. The editor bootstrap is now `src/application/main-runtime.ts`; it initializes the
typed application state and the small SVG viewport surface while Pixi owns persistent map
content. The page no longer loads a global D3 build.

The remaining classic-runtime concerns are narrower:

- typed compatibility accessors for ambient state such as `pack`, `grid`, and `options`;
- explicit `window.*` aliases retained for existing integrations and older migrated modules;
- static UI markup in `src/index.html` that is shown or hidden rather than lifecycle-owned;
- vendored third-party libraries and the service worker under `public/`;
- saved-map migrations that intentionally understand historical SVG data.

These are active compatibility surfaces, not a second renderer. Follow
[migration_guide.md](./migration_guide.md) when porting a feature, and remove an alias only
with its final caller and corresponding global type.

### Global libraries

New bundled code should import dependencies from npm. D3 uses named v7 imports throughout;
`public/libs/d3.min.js`, `window.d3`, `d3.event`, and shared global D3 selections are gone.
Dialogs and interactions likewise use the shared React/native modules rather than jQuery.
Other vendored libraries may remain for features that have not yet moved to npm.

Other vendored libraries may be loaded at startup or on demand. Remove one only after a
repository-wide caller audit and a runtime test of the affected feature.

### Static UI monolith

The legacy UI model keeps dialogs and panels in `src/index.html` for the entire session. Hidden
DOM still retains nodes, listeners, and closures. The target controller lifecycle is:

1. Build the UI when the controller opens.
2. Attach listeners owned by that UI.
3. Remove the generated subtree, listeners, timers, observers, and references on close.
4. Delete the old static markup as part of the port.

Do this per controller. A large one-shot rewrite of `src/index.html` is too risky.

## 2. Compatibility bridges and globals

Bundled modules expose selected APIs to classic code through several mechanisms:

- `src/utils/legacy-globals-bridge.ts` publishes migrated utilities such as `rn`, `gauss`,
  `ensureEl`, and graph helpers.
- `src/controllers/index.ts` and `src/services/index.ts` publish the typed lazy registries as
  `window.Controllers` and `window.Services`.
- `src/application/application-state.ts` owns mutable bootstrap/world state and publishes
  typed compatibility accessors for modules that still use the historical bare names.
- The application, world-generation, layer-controls, style-presets, options, and renderer
  facades provide typed module entry points; selected `window.*` aliases remain compatibility
  handles rather than primary bundled call paths.
- Generators, renderers, and shared components register feature-specific globals such as
  `window.Markets`, `window.drawRoutes`, and `window.tip`.
- `src/types/global.ts` describes ambient state from classic scripts and the `Window` surface
  owned by migrated modules.

Bundled TypeScript should normally import migrated functions directly. A `window.*` bridge is
for classic or explicitly supported external callers, not a substitute for a module import.
Layering can create temporary exceptions: for example, a generator must not import a renderer
or UI module merely to avoid a global call.

### Workspace mode compatibility boundary

`src/application/workspace-mode.ts` is intentionally **not** exposed as a new `window.*` API. Bundled UI adapters
use its capability checks before invoking legacy controls: the tool executor, legacy-command adapter, hotkeys,
options runtime, layer controls, and map input all enforce the same View/Edit policy. Existing classic controls stay
available in Edit mode while they are incrementally migrated; any newly discovered classic mutation entry point must
call `requireWorkspaceCapability` before opening its workflow or committing its mutation.

### When a bridge can be deleted

Remove a global bridge only when all of the following are true:

1. Search `public/`, `src/index.html`, and dynamically constructed markup for classic or
   inline callers.
2. Search bundled code and replace inappropriate `window.*` calls with legal downward imports.
3. Check tests and documentation for an intentionally supported browser API.
4. Decide whether integrations, plugins, user scripts, or console workflows treat the symbol
   as public.
5. Remove the registration and its corresponding `Window`/global type together.
6. Run type checking, linting, building, and the relevant unit or end-to-end tests.

No static in-repository caller does **not** prove that a global is dead. The label and zoom
functions `drawStateLabels`, `drawBurgLabels`, `drawBurgLabel`, `removeBurgLabel`, `panMap`,
`setMapZoom`, and `changeMapZoom`, for example, are explicitly covered by an end-to-end
compatibility test.

### Audit candidates

At version 1.143.2, a static scan found no classic or inline callers for several utility
exports from `legacy-globals-bridge.ts`, including `getNextId`, `generateGrid`, `findCell`,
`drawCellsValue`, `drawPolygons`, `drawRouteConnections`, `drawPoint`, and `drawPath`.
They are candidates for a focused API audit, **not pre-approved deletions**. Confirm that they
are not supported external/debug APIs and add or adjust tests before removing them.

## 3. Saved `.map` compatibility

The `.map` format is a public API. Current loading accepts versions back to `0.70.0`; maps older
than that are rejected as ancient. Every migration for an accepted version remains reachable.

Compatibility lives in several places:

- `src/services/io/data-migrations.ts` performs state-only normalization before other
  migrations consume the state.
- `src/services/io/auto-update.ts` upgrades old SVG, DOM, style, and data representations.
- `src/services/io/map-migrations.ts` enforces the migration order.
- `src/services/io/load.ts` reads both current and historical fields.
- `src/services/io/save.ts` preserves the positional serialization contract.
- `tests/e2e/load-map.spec.ts` verifies representative migrations such as legacy rulers,
  added labels, label settings, lake shorelines, and relief icons.

Do not remove old migration branches while their input versions remain accepted. Valid ways
to retire them are:

- deliberately raise the minimum supported map version and document the breaking change;
- provide a separate conversion path for older maps; or
- introduce a new versioned format while retaining a reader/converter for the old format.

### Positional placeholders

The current text format is position-based. Empty entries in `save.ts` for old fields such as
`pack.cells.road`, `pack.cells.crossroad`, old rulers, scale-bar settings, temperature settings,
and other moved options preserve the indexes of every field that follows. Removing an empty
slot without changing both the format and loader shifts later data and corrupts saves.

Treat these placeholders as schema, not dead values. They can disappear only as part of an
explicit, versioned serialization redesign with matching readers and migration tests.

### Deprecated fields still serialized

`NameBase.m`, the old multi-word-name rate, is marked deprecated and is not active generation
logic, but it is still present in default data, editor import/export, and `.map` serialization.
It can be removed from active domain behavior independently, but removing it from stored data
requires a compatible parser/migration or a new format version.

## 4. Vendored-library deprecations

Searches for `legacy`, `deprecated`, or `obsolete` often match minified libraries such as
TinyMCE, Three.js, or Dropbox. These messages describe the third-party package's own aliases
and migration paths. Editing generated/minified vendor files to remove individual warnings
creates an unmaintainable fork and does not modernize Fantasia.

Instead:

1. Identify whether Fantasia calls the deprecated vendor API.
2. Migrate the Fantasia caller if necessary.
3. Upgrade or replace the dependency as a reviewed unit.
4. Remove the vendored file only when no supported feature loads it.

## Removal priority

The renderer/bootstrap migration has removed the classic application scripts, D3 v5, and the
jQuery UI layer. Future cleanup should proceed independently of that completed cutover:

1. Move static panels to controller-owned lifecycle when those panels are otherwise changed.
2. Prune typed compatibility accessors and `window.*` aliases as their final callers disappear.
3. Move remaining vendored libraries to npm only with focused runtime coverage.
4. Redesign serialization separately if the benefit justifies a versioned format transition.

Map migrations and runtime modernization are separate concerns: finishing the JavaScript to
TypeScript migration does not make old-map conversion code obsolete.

## Verification checklist

For a legacy-runtime or bridge removal:

1. Search all classic, inline, bundled, test, and documented callers.
2. Run `npx tsc --noEmit`.
3. Run `npm run lint`.
4. Run `npm run build`.
5. Run focused unit tests and the relevant Playwright scenario.
6. Load a current map and representative old fixtures.
7. Confirm generation remains deterministic where the migrated code uses seeded randomness.

For a saved-map compatibility change, also verify save/load round trips and require an explicit
decision about the minimum supported version. Never infer authorization to break old maps from
the presence of a `legacy` or `deprecated` comment.
