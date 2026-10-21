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

### Toolchain & Windows Environment Compatibility

- **`package.json`**:
  - Replaced upstream `vite: ^8.0.16` (which requires native Rolldown `.node` bindings blocked by Windows security policies in user directories) with `vite: ^6.0.0`.
  - Added package overrides mapping `rollup` to `@rollup/wasm-node` and `esbuild` to `esbuild-wasm` (pure WebAssembly, zero native C++ DLL bindings).
  - Added `scripts/patch-esbuild.mjs` running on `postinstall` to adapt Go WASM runtime process spawning for Windows `cmd.exe`.
  - Provided `dev.cmd` and `dev.ps1` dev server launchers.
