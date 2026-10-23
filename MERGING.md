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

- **`src/components/layers.ts`**: `LayersRegistry.register(...)` added and `LayerParams` exported, so a feature module can register its own layers; `LayerId` widened to accept registered string ids.
- **`src/data/layer-labels.ts`**: `LAYER_TOGGLES` published on `window` (the conquest layers' tab buttons and hotkeys).
- **`src/components/map-commands.ts`**: `MAP_COMMANDS` published on `window` (the campaign's omnibar entries).
- **`src/main.ts`**: one import appended (`@/conquest/entry`) — the layers must be registered before a map loads, or `Layers.restore()` would not see them.
- **`src/conquest/**`**: new file tree — the campaign engine, world compiler, content packs, session store and UI. Self-contained; it touches stock files only through the three seams above.
- *Conflict resolution strategy*: if upstream grows its own `register()` or publishes the same globals, reconcile rather than duplicate — the conquest code only needs `Layers.register`, `LAYER_TOGGLES` and `MAP_COMMANDS`.

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
- **`src/components/viewbox-events.ts`**: a `systems` entry opens the Burg Editor for the marker's
  burg.
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

### Toolchain & Windows Environment Compatibility

- **`package.json`**:
  - Replaced upstream `vite: ^8.0.16` (which requires native Rolldown `.node` bindings blocked by Windows security policies in user directories) with `vite: ^6.0.0`.
  - Added package overrides mapping `rollup` to `@rollup/wasm-node` and `esbuild` to `esbuild-wasm` (pure WebAssembly, zero native C++ DLL bindings).
  - Added `scripts/patch-esbuild.mjs` running on `postinstall` to adapt Go WASM runtime process spawning for Windows `cmd.exe`.
  - Provided `dev.cmd` and `dev.ps1` dev server launchers.
