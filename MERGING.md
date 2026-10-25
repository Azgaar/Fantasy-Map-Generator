# Merging Upstream — Touch-Points Checklist

This document tracks all intentional touch-points where this fork modifies stock FMG files.
When rebasing or merging `upstream/master`, consult this checklist to ensure fork-specific additions remain intact and upstream changes integrate smoothly.

The `upstream` remote points at Azgaar's repository:

```sh
git fetch upstream && git merge upstream/master
```

## Touch-Points by Feature

### History generator & Legends browser

- **`src/types/PackedGraph.ts`**: `pack.history` added to the pack interface.
- **`src/types/history.ts`**: new file — the chronicle's data model (`HistoryEvent`, `Realm`, `Era`, `HistRef`).
- **`src/generators/history-generator.ts`**: new file — the `Chronicle` model; runs as the last pipeline step.
- **`src/generators/generation-pipeline.ts`**: one step appended to the generation and erase pipelines (`{ id: "history", run: () => Chronicle.generate() }`).
- **`src/generators/index.ts`**: one import appended (`./history-generator`).
- **`src/generators/states-generator.ts`**: `getChronicle()` made defensive about a missing state 0.
- **`src/generators/markers-generator.ts`**: `generateTypes()` skips the random `ruins` and `battlefields` rolls when the chronicle's echoes are on.
- **`src/generators/lore.ts`**: `Lore.setHistory(config)` — the chronicle's settings, validated.
- **`src/components/options-schema.ts`**: `lore.history` added to the lore schema (`span`, `realms`, `density`, `echoes`, `renames`).
- **`src/components/options-model.ts`**: the same defaults added to `getDefaultOptions()`.
- **`src/controllers/lore-editor.ts`**: a history section in the Lore dialog.
- **`src/controllers/history-overview.ts`**: new file — the Legends browser.
- **`src/controllers/index.ts`**: one registry entry (`LegendsOverview`).
- **`src/components/map-commands.ts`**: one command appended (`openLegendsBrowser`).
- **`src/components/options/tabs/tools-tab.ts`**: one button appended (`openLegendsBrowser`).
- **`src/services/io/save.ts` / `load.ts`**: `.map` record **53** carries the chronicle; older files load with an empty one.
- **`src/services/io/export-json.ts`**: the chronicle added to both JSON exports.
- *Conflict resolution strategy*: keep the record index — upstream may claim 53 for its own feature, in which case the chronicle moves to 54 and the load path must read the new index.

### OpenConquest: Atlas Invictus (the campaign game)

- **`src/controllers/conquest-mode.ts`**: new controller (`Controllers.ConquestMode`) managing Conquest as a native view mode.
- **`src/components/options/view-mode.ts`**: view mode toggle added (`viewConquest`) switching between Standard, 3D, Astral, and Conquest modes.
- **`src/controllers/battle-screen.ts`**: steppable Lanchester combat simulator with round-by-round tactical commands, odds calculations, and map troop loss sync.
- **`src/generators/military-generator.ts`**: roster-native unit allocation (`ArmyUnit[]`) and composition calculation for state military forces.
- **`src/generators/states-generator.ts`**: deterministic roster assignment (`state.rosterId`) with culture/state auto-inference.
- **`src/renderers/draw-burg-icons.ts`**: renders circled stars for state capitals and smaller stars for province capitals.
- **`src/components/map-commands.ts`**: `MAP_COMMANDS` published on `window` (the campaign's omnibar entries).
- **`src/main.ts`**: one import appended (`@/conquest/entry`) — registers Conquest commands and boot lifecycle.
- **`src/conquest/**`**: self-contained campaign engine, Web Worker compiler, content packs (9 fantasy & historical rosters), session store and UI rail.
- *Conflict resolution strategy*: reconcile imports and registry additions; the Conquest engine itself is fully self-contained in `src/conquest/`.

### Phase A: Astral Cartographer Content in Core (Bases + Culture Sets)

- **`src/data/name-bases.ts`**
  - **Interface extension**: `NameBase` interface includes optional `groups?: Record<string, string[]>`.
  - **Appended array entries**: Appended 12 Astral name bases (indices 43..54) at the end of `getDefaultNameBases()`.
    - AstralTrek (Trek Core, Trek Terran, Trek Continental, Trek Synthetic)
    - AstralJammer (Jammer Deep, Jammer Ethereal, Jammer Stoneborn, Jammer Wild)
    - Grimdark (Grimdark Core, Grimdark Gothic, Grimdark Iron, Grimdark Machine)
  - *Conflict resolution strategy*: If upstream adds new name bases, ensure Astral bases remain appended after upstream bases and culture generator base lookups continue resolving by name.

- **`src/generators/cultures-generator.ts`**
  - **`CULTURE_SETS` additions**: Appended `astralTrek`, `astralJammer`, and `grimdark` to `CULTURE_SETS` with `max: 8`.
  - **`CulturesGenerator.getDefault()`**: Added `case "astralTrek"`, `case "astralJammer"`, and `case "grimdark"` branches returning each set's 8 cultures with habitat scoring callbacks.
  - *Conflict resolution strategy*: Preserve these three case branches and `CULTURE_SETS` entries.

- **`src/components/options-schema.ts`**
  - Uses dynamic enumeration from `Object.keys(CULTURE_SETS)`. No direct stock modifications needed; automatically validates and pins the Astral sets.

- **`src/components/options/tabs/options-tab.ts`**
  - `<select id="culturesSet">` renders options dynamically from `CULTURE_SETS` so all core and mod culture sets appear in the Options tab dropdown automatically.

- **`src/components/configuration-schema.test.ts`**
  - Added unit test: validates astral culture-set ids and accepts them in schema and pins.

- **`src/data/name-bases.test.ts`**
  - Dedicated test suite for content rules, culture set generation, placement scoring, and Phase A acceptance.

### Phase D: Astral mapping (polities, sectors, star systems)

- **`src/data/name-bases.ts`**
  - **Interface extension**: `NameBase` includes optional `groups?: Record<string, string[]>`.
  - **New helper**: `isAstralBase(base)` — the bases that carry name groups, and so are ours.
  - *Conflict resolution strategy*: the Astral bases stay appended after upstream bases; the helper
    reads the live array, so a user-edited base without groups is treated as a stock one.

- **`src/generators/astral-naming.ts`** (new)
  - The mapping: the polity words, the sector words, the star classes, the traits, and
    `applyNaming()` — the action the tool button runs.

- **`src/controllers/astral-names.ts`** (new) — the action: a confirmation, the apply, and a tip.
- **`src/controllers/astral-systems.ts`** (new) — the read-only Star Systems overview.
- **`src/controllers/index.ts`**: two registry entries (`AstralNames`, `AstralSystems`).
- **`src/components/map-commands.ts`**: two commands appended (`applyAstralNaming`, `openStarSystems`).
- **`src/components/options/tabs/tools-tab.ts`**: two buttons appended.
- **`src/generators/index.ts`**: one import appended (`./astral-naming`).
- *Note*: the mapping is **not** a generation step. A world stays a fantasy world until the author
  applies the naming, so the pipeline is untouched by it.

### Astral visual overhaul — Phase 1 (Astral view)

- **`src/components/options/tabs/layers-tab.ts`**: fourth `#viewMode` button (`viewAstral`), the
  mode-aware layer toggle map, and the standard/Astral preset options in one select.
- **`src/components/options/view-mode.ts`**: the Astral flag, its subscription, and the
  `viewAstral` branch; standard/3D leave the mode first.
- **`src/components/layers.ts`**: three placeholder layer ids — `nebulae`, `starDensity`, `systems`
  — at their z-positions. Their renderers land in Phase 3/4.
- **`src/components/options-schema.ts`** / **`src/components/options-model.ts`**: `map.astral`
  (default `false`, carried across regeneration).
- **`src/components/lifecycle.ts`**: `AstralMode.hydrate()` after the options are restored.
- **`src/controllers/astral-mode.ts`** (new): enter/exit/toggle/hydrate, the layer snapshot and the
  cross-reload fallback.
- **`src/controllers/index.ts`**: one registry entry (`AstralMode`).
- **`src/components/map-commands.ts`**: `viewAstral`, and the 3D commands leave Astral first.
- **`src/data/astral-layers.ts`** / **`src/data/astral-layer-labels.ts`** (new): presets and the
  Astral button table.
- **`src/data/layer-labels.ts`**: `layerLabel` falls back to the Astral table for Astral-only ids.
- *Conflict resolution strategy*: the three layer entries are append-only at fixed z-positions; the
  new option has a schema default, so older maps load as Standard.

### Astral visual overhaul — Phase 2 (style)

- **`src/generators/styles-schema.ts`**: `nebulae`, `starDensity` and `systems` elements, with their
  grouped children and field meta.
- **`src/generators/default-styles.json`**: the same three sections' defaults.
- **`public/styles/astral.json`** (new): the complete sector-chart preset. The other shipped presets
  gain the three new sections through the converter.
- **`src/data/textures.ts`** / **`src/data/ocean-patterns.ts`**: the starfield image in the texture
  and ocean-pattern choices.
- **`public/images/textures/starfield.png`** (new): the tiled starfield used by sector dust and the
  void.
- **`src/services/style-presets.ts`** / **`scripts/render-style-thumbnails.mjs`**: `astral` in the
  system preset list.
- **`public/images/style-presets/astral.avif`** (new): the preset card thumbnail.
- *Conflict resolution strategy*: the schema additions are one contiguous block; old maps and
  presets repair the missing sections from defaults.

### Astral visual overhaul — Phase 3 (nebulae and density)

- **`src/components/layers.ts`**: the `nebulae` and `starDensity` placeholder layers gain their
  renderers (`draw-nebulae`, `draw-star-density`); the `systems` layer stays a placeholder until
  Phase 4.
- **`src/renderers/astral/draw-nebulae.ts`** / **`nebula-shapes.ts`** (new): seeded ellipse
  clusters, one turbulence filter per cluster, fade gradients in the `speed` performance preset.
- **`src/renderers/astral/draw-star-density.ts`** / **`star-density-field.ts`** (new): a
  population-weighted sparse kernel banded through `getIsolines` into the six `bandN` groups.
- *Conflict resolution strategy*: the renderers are new files; the registry edits stay inside the
  appended Astral layer entries.

### Astral visual overhaul — Phase 4 (systems and interaction)

- **`src/renderers/astral/draw-systems.ts`** (new): the star markers — one per live burg, recreated
  per reconcile as one `data-group` per spectral class, sized on a log population ladder, with
  capital rings, port orbit ticks and a style-gated halo. A `ViewportLayers` layer, so it culls and
  follows zoom like `burgIcons`.
- **`src/renderers/astral/system-markers.ts`** (new): the pure geometry — class grouping and the
  size ladder.
- **`src/generators/astral-naming.ts`**: `StarSystem` gains `x`/`y` (the renderer places markers by
  them); new `systemTip()` writes the class/traits tooltip line.
- **`src/components/layers.ts`**: the `systems` layer entry gains its renderer.
- **`src/components/viewport.ts`**: `systems` added to `ZOOM_CURVES` (the burgIcons near-natural
  curve) — a second stock touch point in the zoomed-layer list.
- **`src/components/map-tooltip.ts`**: `#systems [data-id]` joins the burg tooltip targets; in
  Astral the tooltip names the class and traits.
- **`src/components/map-entities.ts`**: `/^system(\d+)$/` maps to the burg ref, the
  `#burgIcons` target special case extends to `#systems`, the burg reveal layers are mode-aware
  (`systems` in Astral), and the burg highlight covers `#burg{id}` and `#system{id}`.
- **`src/components/viewbox-events.ts`**: a `systems` entry opens the System Editor for the
  marker's burg (the Burg Editor at the time; the routing since became the System Editor's — see
  _The system dialog_ below).
- *Conflict resolution strategy*: the renderer seams mirror the `burgIcons` paths — if upstream
  changes how burgs resolve, click or highlight, re-apply the same change to the `system{id}`
  element path.

### Astral visual overhaul — Phase 5 (polish and docs)

- **`src/controllers/astral-mode.ts`**: `hintNaming()` — a one-per-session "apply Astral naming" tip
  shown on entering the mode, gated on the map having Astral peoples (`groupsOf`). Purely additive.
- **`src/services/style-presets.ts`** / **`scripts/render-style-thumbnails.mjs`**: `astralSchematic`
  added to the system preset list (the second Astral style, a cyan/green phosphor blueprint).
- **`public/styles/astralSchematic.json`** (new): the complete schematic preset, authored from
  `astral.json`.
- **`public/images/style-presets/astralSchematic.avif`** (new): the preset card thumbnail.
- **`tests/e2e/astral-mode.spec.ts`** / **`astral-systems.spec.ts`** / **`astral-round-trip.spec.ts`**
  (new): the mode enter/exit/3D-exclusivity and export smoke, the systems hit-testing parity
  (tooltip, click, reveal, zoom culling) and the save/reload/exit round trip.
- **`src/generators/styles-legacy.test.ts`**: the shipped-preset count (15→16 presets, 16→17 files).
- **`docs/wiki/User-Interface.md`** / **`docs/astral/README.md`** / **`README.md`** /
  **`docs/plans/astral-ui-overhaul.md`**: the Astral view section, the preset list and the roadmap.
- *Conflict resolution strategy*: the preset entries are two one-line additions in the existing
  lists; the e2e specs are new files and carry no upstream conflict surface.

### Astral terrain layers — Dust Density, Composition, Remnants, Core–Rim, Currents

- **`src/components/layers.ts`**: four Astral layer ids at their z-positions — `coreRim` (after
  `landmass`), `composition` (after `texture`), `dustDensity` (after `starDensity`) and `remnants`
  (after `systems`) — plus their renderer imports.
- **`src/renderers/draw-routes.ts`**: `drawRoutes` calls `drawCurrents()` (Astral-only; it creates
  or drops the `#currents` group inside `#routes`), and the reconcile loop skips that group — the
  route scene owns trails/roads/searoutes, not the currents.
- **`src/components/viewport.ts`**: the `remnants` zoom curve in `ZOOM_CURVES` (near-natural, like
  `systems`).
- **`src/components/map-tooltip.ts`**: the path-depth guard runs before `tip("")`, so stale detached
  targets no longer blank the tooltip.
- **`src/components/tooltips.ts`**: a timed tip expiry clears only its own message, so a hover tip
  that replaced it stays up.
- **`src/utils/registry.ts`**: `trackLoad` clears only its own "Loading…" message (the load-vs-hover
  race that blanked tooltips after a load).
- **`src/generators/styles-schema.ts`**: four elements — `coreRim`, `composition`, `dustDensity`,
  `remnants`. `routes.groups` stays an open record, so the `currents` group is plain data.
- **`src/generators/default-styles.json`**: the same four elements' defaults — no `currents`
  section, the group ships only in the Astral presets.
- **`public/styles/*.json`**: the converter injects the four elements into every shipped preset;
  `astral.json` and `astralSchematic.json` additionally carry the `currents` group in
  `routes.groups` (gold / acid flow, long dash).
- **`scripts/convert-style-presets.mjs`**: the icon-owning models (relief, burgs, goods) are
  imported before `normalizeStyles` runs, so references resolve during conversion.
- **New**: `src/renderers/astral/{dust-bands, draw-dust-density, biome-classes, draw-composition,
  remnants, draw-remnants, core-rim, draw-core-rim, currents, draw-currents}.ts`, the Astral button
  and preset rows in `src/data/astral-layer-labels.ts` / `astral-layers.ts`, and the plan at
  `docs/plans/astral-terrain-layers.md`.
- *Conflict resolution strategy*: the four layer entries sit at fixed z-positions between stock
  entries — re-place them if upstream reorders the registry; the `draw-routes.ts` seam is two lines
  (the hook and the reconcile skip) — re-apply both; the tooltip fixes are small guards, keep them
  even if upstream rewrites the functions.

### Sector colors (provinces/sectors hue rotation)

- **`src/utils/colorUtils.ts`**: `getSectorColor(polityColor, index)` — a sector keeps the polity's
  chroma and lightness but the hue spins 75°–285° away, sequenced by the sector's index within its
  polity (with a lightness ladder and a small deterministic jitter); achromatic polities fall back
  to `getMixedColor`.
- **`src/generators/provinces-generator.ts`** / **`src/generators/states-generator.ts`**: all five
  province color sites use the rotation instead of `getMixedColor(state.color)` — the old mix sat
  within ~20% of the state color, so every sector read as its polity.
- **`public/styles/astral.json` / `astralSchematic.json`**: `provinces` opacity 0.2 → 0.5 and
  0.06 → 0.15, so the rotation reads over the chart (standard presets keep 0.7).
- *Conflict resolution strategy*: keep the rotation at every site where upstream assigns a province
  color from its state; the index is the state's province count at assignment time.

### Name bases by stable id

A base is identified by a five-letter `id` instead of its array position, so new bases never re-point
saved cultures and a rename keeps its corpus.

- **`src/data/name-bases.ts`**: `NameBase.id`, `BASE_ID_PATTERN`, `deriveBaseId()`; every shipped
  entry gains its permanent id.
- **`src/generators/names-generator.ts`**: chains keyed by id; `getBase`/`getBaseShort`/`updateChain`
  take an id; `getNameBase()` and `reindex()` added; the state suffix and fantasy rules compare ids.
- **`src/generators/cultures-generator.ts`**: `Culture.base` is a string; every set branch uses id
  literals (no name lookup); `setBase` takes an id.
- **`src/generators/states-generator.ts`**, **`src/generators/astral-naming.ts`**: id comparisons and
  id lookups.
- **`src/controllers/*`**: editors read, write and import ids; new bases get a generated id.
- **`src/services/io/name-bases-format.ts`** (new): the slot-31 row format and the legacy migration;
  **`save.ts`** and **`load.ts`** call it.
- **`src/conquest/engine/compiler/*`**: name pools are keyed by id, `AzgaarCulture.base` is a string,
  `COMPILER_VERSION` is 0.2.0.
- *Conflict resolution strategy*: if upstream adds bases, give them ids and append them; existing ids
  are permanent and must never be reassigned. If upstream changes the slot-31 format, reconcile in
  `name-bases-format.ts` — the loader also accepts the six-column legacy layout.

### RPG Fantasy culture set & polity naming

- **`src/data/name-bases.ts`**:
  - Appended 11 RPG Fantasy name bases (indices 55..65, permanent ids `HALFL`..`TRIBA`): Halfling (`HALFL`), Fey (`FEYFO`), Infernal (`INFER`), Celestial (`CELES`), Grave (`GRAVE`), Merfolk (`MERFO`), Beastfolk (`BEAST`), Elemental (`ELEME`), Construct (`CONST`), Eldritch (`ELDRI`), Tribal (`TRIBA`).
  - Added `polities` and `provinces` groups to all 11 bases for state government and province territorial titles.
- **`src/generators/cultures-generator.ts`**:
  - Appended `rpgFantasy: { name: "RPG Fantasy", max: 24, probability: 4 }` to `CULTURE_SETS`.
  - Added `case "rpgFantasy"` branch to `CulturesGenerator.getDefault()` defining 43 cultures across 7 thematic groups with habitat scoring callbacks (`forest`, `highland`, `arid`, `polar`, `coastal`, `underworld`, `open`).
- **`src/generators/polity-naming.ts`** (new):
  - Extracted shared group reading and word picking (`readGroup`, `pickFor`, `polityWordFor`, `provinceWordFor`) from `astral-naming.ts`.
- **`src/generators/astral-naming.ts`**:
  - Re-exports shared polity naming functions from `polity-naming.ts`.
- **`src/controllers/astral-names.ts`**:
  - Made register-aware: adjusts modal confirmation, alert messaging, and fallback vocabulary based on the active culture set ("Apply RPG naming" vs "Apply Astral naming").
- **`src/components/configuration-schema.test.ts`**, **`src/data/name-bases.test.ts`**, **`src/generators/polity-naming.test.ts`**, **`src/controllers/astral-names.test.ts`**:
  - Dedicated unit tests for schema validation, RPG namebase content rules, habitat scoring, acceptance, polity naming, and controller register selection.
- *Conflict resolution strategy*: keep the 11 bases appended with their permanent ids; keep the `case "rpgFantasy"` in `cultures-generator.ts` and the `rpgFantasy` entry in `CULTURE_SETS`.

### The system dialog (Astral System Editor)

- **`src/controllers/astral-system-editor.ts`** (new): the System Editor — a burg read as a star
  system, edited in the astral vocabulary. Every write goes through the `Burgs` model (rename,
  population, culture, installations, capital, treasury, lock, move, remove); the spectral class
  stays a readout derived from population; the star preview is emitted by the same shape code as
  the layer. In Astral it is the only dialog a system has.
- **`src/renderers/astral/system-markers.ts`**: `starShape()` and `writeAttrs()` moved here from
  `draw-systems.ts`, so the layer and the dialog emit identical markers.
- **`src/renderers/astral/draw-systems.ts`**: imports the shape emission from `system-markers.ts`.
- **`src/components/viewbox-events.ts`**: `#systems` marker clicks always open the System Editor;
  burg label and `#burgIcons` clicks open it in Astral (`isAstralView()`) and the Burg Editor in
  Standard; the label re-open trick (an editor already open for the same burg → LabelsEditor)
  covers both dialogs.
- **`src/controllers/index.ts`**: one registry entry (`AstralSystemEditor`).
- **`tests/e2e/astral-systems.spec.ts`**: the click seam expects the System Editor; editing
  coverage — label routing, rename, a class-threshold crossing, a capital toggle, removal.
- **`src/services/assistant/provider/context.generated.ts`**: regenerated (the snapshot carries the
  new controller).
- **`docs/astral/README.md`** / **`docs/plans/astral-system-dialog.md`**: the editor section and
  the plan.
- *Conflict resolution strategy*: the routing seams stay mode-aware — if upstream reshapes the click
  dispatch, keep the Astral branch beside the stock Burg Editor branch; the marker emission must
  stay shared between the layer and the dialog; the class remains derived (no per-system state).

### Toolchain & Windows Environment Compatibility

- **`package.json`**:
  - Replaced upstream `vite: ^8.0.16` (which requires native Rolldown `.node` bindings blocked by Windows security policies in user directories) with `vite: ^6.0.0`.
  - Added package overrides mapping `rollup` to `@rollup/wasm-node` and `esbuild` to `esbuild-wasm` (pure WebAssembly, zero native C++ DLL bindings).
  - Added `scripts/patch-esbuild.mjs` running on `postinstall` to adapt Go WASM runtime process spawning for Windows `cmd.exe`.
  - Provided `dev.cmd` and `dev.ps1` dev server launchers.
  - **`scripts/generate-assistant-context.mjs`**: `read()` normalizes CRLF to LF, so a CRLF checkout
    (`git autocrlf`) matches the script's LF-only regexes instead of failing the `METHODS` lookup.
