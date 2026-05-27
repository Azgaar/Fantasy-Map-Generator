# Generation Pipeline

The canonical "build a world from scratch" routine lives in [`public/main.js`](../../public/main.js) → `async function generate(options)`. Several other code paths rebuild large portions of `grid` and `pack`, and each must replicate the relevant slice of that pipeline. When a new global generator step is added (e.g. `Goods.generate` / `Production.produce`), every replication site that reaches the same lifecycle phase has to be updated as well, or features will silently fail when entered through that path.

## Canonical sequence

`generate()` is the single source of truth. Conceptually it is split into phases; downstream replications differ in **which phases they re-run** and **which artefacts they restore from the previous map**.

| #   | Phase                                | Calls                                                                                                       | Outputs (selection)                                                 |
| --- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1   | **Seed & sizing**                    | `setSeed`, `applyGraphSize`, `randomizeOptions`                                                             | `seed`, graph dimensions, randomized inputs                         |
| 2   | **Grid + heightmap**                 | `shouldRegenerateGrid`, `generateGrid`, `HeightmapGenerator.generate`                                       | `grid.cells.h`                                                      |
| 3   | **Hydrology base**                   | `Features.markupGrid`, `addLakesInDeepDepressions`, `openNearSeaLakes`                                      | grid features, lake/ocean topology                                  |
| 4   | **World position & climate**         | `OceanLayers`, `defineMapSize`, `calculateMapCoordinates`, `calculateTemperatures`, `generatePrecipitation` | `mapCoordinates`, `cells.temp`, `cells.prec`                        |
| 5   | **Repack**                           | `reGraph`, `Features.markupPack`, `createDefaultRuler`                                                      | `pack.cells.*`, default ruler                                       |
| 6   | **Rivers + biomes**                  | `Rivers.generate`, `Biomes.define`, `Features.defineGroups`                                                 | `pack.rivers`, `cells.biome`, feature groups                        |
| 7   | **Climate art**                      | `Ice.generate`                                                                                              | ice layer                                                           |
| 8   | **Goods catalogue**                  | `Goods.generate`                                                                                            | `pack.goods` (raw + manufactured definitions)                       |
| 9   | **Cells ranking & cultures**         | `rankCells`, `Cultures.generate`, `Cultures.expand`                                                         | `cells.s`, `cells.pop`, `pack.cultures`                             |
| 10  | **Settlement & political layer**     | `Burgs.generate`, `States.generate`, `Routes.generate`, `Religions.generate`                                | `pack.burgs`, `pack.states`, `pack.routes`, `pack.religions`        |
| 11  | **Settlement / state specification** | `Burgs.specify`, `States.collectStatistics`, `States.defineStateForms`                                      | burg types, state stats, state forms                                |
| 12  | **Provinces**                        | `Provinces.generate`, `Provinces.getPoles`                                                                  | `pack.provinces`                                                    |
| 13  | **Naming polish**                    | `Rivers.specify`, `Lakes.defineNames`                                                                       | river/lake names                                                    |
| 14  | **Economy**                          | `Markets.generate`, `Production.produce`, `States.collectTaxes`                                             | `pack.markets`, `cells.market`, `state.inventory`, `state.treasury` |
| 15  | **Military & overlays**              | `Military.generate`, `Markers.generate`, `Zones.generate`                                                   | regiments, markers, zones                                           |
| 16  | **Finalise**                         | `drawScaleBar`, `Names.getMapName`, `showStatistics`                                                        | scale bar, map name, stats                                          |

Two ordering constraints matter for replication:

- **Goods depend on nothing pack-side** but must exist before `Markets.generate`. `Goods.generate` is called once per map and idempotent for an existing `pack.goods`; pass `regenerate=true` only to force a fresh catalogue.
- **Economy depends on the whole settlement chain** — markets are seeded from burgs, production reads `state.culture`, `state.provinces`, `cells.biome`, `cells.pop`, `cells.market`, `pack.routes`. Replicators that rebuild burgs/states/provinces must also rebuild the economy, or `pack.markets`, `cells.market`, `state.inventory`, `state.treasury` will reference stale or removed entities.

See [`production_schema.md`](production_schema.md) and [`trade_schema.md`](trade_schema.md) for the internal ordering of phase 14.

## Replication sites

The codebase has three places that re-run a large slice of the canonical pipeline. They differ in what they preserve and what they regenerate.

### 1. Heightmap edit exit — full settlement regeneration

**File:** [`public/modules/ui/heightmap-editor.js`](../../public/modules/ui/heightmap-editor.js) → `regenerateErasedData()`

Runs when the user exits the heightmap editor without preserving downstream data. It clears all settlement state (`pack.cultures`, `pack.burgs`, `pack.states`, `pack.provinces`, `pack.religions`) and walks phases **3 → 15** of the canonical pipeline. This is effectively a "second generate" — every global generator that runs in `generate()` after `reGraph()` must also run here.

Note: `Ice.generate()` here is called after `Provinces.getPoles()` rather than after `Features.defineGroups()` (the relative position vs. settlement layer is irrelevant because `Ice` only depends on temperature/features).

### 2. Heightmap edit exit — preserved settlement data

**File:** [`public/modules/ui/heightmap-editor.js`](../../public/modules/ui/heightmap-editor.js) → `restoreRiskedData()`

Runs when the user exits the heightmap editor with "keep data" enabled. Settlement entities (cultures, burgs, states, provinces, religions, zones) are remapped onto the new pack rather than regenerated. This path:

- Re-runs hydrology / climate (phases 3–5).
- Re-runs `Rivers.generate` (phase 6) only if erosion is allowed.
- Re-attaches `cells.biome`, `cells.culture`, `cells.state`, `cells.burg`, etc. by copying from the saved arrays via the `pack.cells.g` (pack→grid) mapping.
- Re-locates each burg, culture centre, and province centre in the new pack.
- Regenerates ice.

Because the entity arrays themselves are preserved (not their derived economic state), the economy must be **rebuilt from scratch** against the new cell topology: cell market assignments, market stock, production output, and tax collection all reference cell ids that no longer exist after the repack.

### 3. Map resample / submap

**File:** [`src/modules/resample.ts`](../../src/modules/resample.ts) → `Resampler.process()`

Used by `transform-tool` (in-place transform) and `submap-tool` (extract sub-region at scale). The flow:

- Generates a fresh `grid` for the target dimensions.
- Resamples height/temp/prec from the parent grid via inverse projection.
- Re-runs hydrology, ocean layers, temperature, repack, ice (phases 3–7) — but skips `Rivers.generate` because rivers are restored from the parent's saved meanders.
- Restores cell data (biome, fl, s, pop, culture, state, religion, province), cultures, burgs, states, routes, religions, provinces, features, markers, zones from the parent map.
- Does **not** call `Goods.generate` — the goods catalogue is preserved in `pack.goods` if it was copied via `structuredClone(pack)`. (Re-running `Goods.generate()` without `regenerate=true` is a no-op, which is the desired behaviour: same catalogue, same recipes.)

Because burgs, states, and `cells.market` are restored from the parent — but population and area are rescaled — markets, production, and treasuries computed against the parent's economy are stale. They must be rebuilt against the resampled pack.

### Other regeneration callers (for reference)

These are partial regenerations triggered from the UI and do **not** replicate the full pipeline. They still belong to the same dependency graph and may need their own economy refresh when they touch upstream data:

- [`public/modules/ui/tools.js`](../../public/modules/ui/tools.js): `regenerateRoutes`, `regenerateRivers`, `recalculatePopulation`, `regenerateStates`, `regenerateProvinces`, `regenerateBurgs`, `regenerateGoods`, `regenerateCultures`, `regenerateMilitary`, `regenerateMarkers`, `regenerateZones`.
- [`public/modules/dynamic/auto-update.js`](../../public/modules/dynamic/auto-update.js): version-bump migrations (e.g. the `1.123.0` block that introduced goods/markets/production/taxes).
- [`public/modules/ui/world-configurator.js`](../../public/modules/ui/world-configurator.js) → `updateWorld`: climate-only refresh; does not touch the settlement / economy layers.

When extending the pipeline, audit each of these for whether their scope reaches the new phase.

## Adding a new global generation step — checklist

1. Add the call in `public/main.js` `generate()` at the correct phase boundary.
2. If the step runs **after phase 5 (`reGraph`)**, add it to `heightmap-editor.js` `regenerateErasedData()` at the matching boundary.
3. If the step's output depends on **cell-indexed data** (anything in `pack.cells.*`) or on entity identities that the restore path re-maps, also add it to `heightmap-editor.js` `restoreRiskedData()`.
4. If the step's output depends on **burgs / states / provinces / cells.market / routes**, add it to `src/modules/resample.ts` `Resampler.process()` after all relevant `restoreXxx` calls.
5. Add or update the version-bump migration block in `public/modules/dynamic/auto-update.js` so older saves gain the new fields on load.
6. Update the canonical sequence table at the top of this file.
