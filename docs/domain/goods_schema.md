# Goods Schema

Goods are the tradable resources and products that flow through the economy. Every good is an element of `pack.goods: Good[]`. The canonical default catalogue lives in `GOODS_DATA` and is loaded once when goods are first generated or restored.

## Good Types

A good is classified by which generation fields it carries:

| Type             | Has `distribution` | Has `recipes` | Source of production                      |
| ---------------- | ------------------ | ------------- | ----------------------------------------- |
| **Raw**          | yes                | no            | Rural biome output + bonus resource cells |
| **Manufactured** | no                 | yes           | Burg worker loop only                     |
| **Hybrid**       | yes                | yes           | All three channels                        |

`chance` applies only to placement of raw/hybrid goods on the map; manufactured-only goods always have `chance: 0`.

## Raw Good Generation

`GoodsModule.generate()` walks every land cell in a shuffled order. For each cell it tries each eligible good in turn:

1. Skip if `resources[good.i] >= resourceMaxCells` (cap = `⌈200 × totalCells / 5000⌉`).
2. Skip if `Math.random() × 100 > good.chance`.
3. Evaluate `good.distribution` as a JS expression using the cell methods table below. If falsy, skip.
4. Set `pack.cells.good[cellId] = good.i` and break (one bonus resource per cell).

### Distribution Expression Methods

| Method                          | Meaning                                               |
| ------------------------------- | ----------------------------------------------------- |
| `biome(...ids)`                 | Cell biome is one of the given ids                    |
| `minHeight(h)` / `maxHeight(h)` | Cell elevation `h` threshold                          |
| `minTemp(t)` / `maxTemp(t)`     | Grid temperature at cell                              |
| `shore(...rings)`               | Cell shore ring (`-1` = shallow ocean, `1` = coastal) |
| `type(...types)`                | Feature type (`"ocean"`, `"freshwater"`, `"salt"`, …) |
| `river()`                       | Cell has a river                                      |
| `minHabitability(n)`            | Biome habitability ≥ n                                |
| `habitability()`                | Probabilistic — more habitable → more likely          |
| `elevation()`                   | Probabilistic — higher → more likely                  |
| `nth(n)`                        | True for 1 in every n cells (deterministic thinning)  |
| `random(n)`                     | True n% of the time                                   |

Methods combine with `&&`, `||`, `!`.

## Biome Output (Rural Production Channel)

`good.biomeOutput` maps biome id → units produced per 1 rural population point per production cycle.

`GoodsModule.getBiomesProduction()` inverts this into a biome → `[{goodId, production}]` lookup, consumed by:

- `Markets.collectRuralProduction()` — seeds market stock from all rural cells.
- `Production.getCellProduction(cellId, biomeProduction)` — computes a single cell's output for the Goods Editor display.

Biome output is separate from biome multipliers (`multipliers.biome`): the former is the baseline amount; the latter scales it.

## Bonus Resource Channel

When `pack.cells.good[cellId]` is set, that cell yields a population-scaled bonus of its good, capped at `MAX_BONUS_PRODUCTION = 5` units:

- **Rural seeding** — `min(population × BONUS_RURAL_PRODUCTION, MAX_BONUS_PRODUCTION)` (`BONUS_RURAL_PRODUCTION = 0.25`).
- **Burg pre-seed** — a burg sitting on such a cell pre-seeds `minmax(population × BONUS_URBAN_PRODUCTION, MIN_BONUS_PRODUCTION, MAX_BONUS_PRODUCTION)` units into inventory before the worker loop (`BONUS_URBAN_PRODUCTION = 1`, `MIN_BONUS_PRODUCTION = 1`).

The full multiplier stack (`getModifiers`) is applied to bonus-resource production just as for biome output.

## Recipes (Manufactured Goods)

`good.recipes` is an array of alternative recipes. Each recipe is a sparse `Record<goodId, amount>` specifying how many units of each input good are consumed to produce 1 unit of the output good.

During the burg worker loop, the production planner evaluates each recipe against available inventory and market stock, choosing the most profitable option. Input goods are sourced from inventory first, then bought from the local market. If any market buy fails, the step is aborted.

Recipes use `number` keys (good ids) at runtime. In `GOODS_DATA` the recipes are written with string-name keys (`{ Wood: 1 }`) and resolved to ids when `defaultGoods` is built.

## Multipliers

Multipliers allow per-dimension scaling of a good's production. All five dimensions are independent and combine multiplicatively at `getModifiers(good, cellId)`:

```
result = cultureType × culture × state × religion × biome
```

Each factor defaults to 1 if the corresponding dimension is absent from `good.multipliers` or if the cell's value for that dimension has no entry in the map.

### Dimension Resolution

| Dimension     | Cell value read from                                                                                          | Key used             |
| ------------- | ------------------------------------------------------------------------------------------------------------- | -------------------- |
| `cultureType` | `pack.cells.burg[cellId]` → `pack.burgs[burgId].type` (if burg present), else `pack.cultures[cultureId].type` | `CultureType` string |
| `culture`     | `pack.cells.culture[cellId]`                                                                                  | culture id           |
| `state`       | `pack.cells.state[cellId]`                                                                                    | state id             |
| `religion`    | `pack.cells.religion[cellId]`                                                                                 | religion id          |
| `biome`       | `pack.cells.biome[cellId]`                                                                                    | biome id             |

For burg manufacture, `burg.cell` is passed as `cellId`, so all five dimensions resolve from the burg's home cell.

### Storage Rules

- Only values `!== 1` are persisted. If all values in a dimension are 1 (or removed), the dimension key is omitted.
- If the entire `multipliers` object would be empty, it is omitted from the serialized good.
- `GOODS_DATA` carries only `multipliers.cultureType`; entity-specific dimensions (`culture`, `state`, `religion`) are never present in the default catalogue — they are map-specific and set through the editor.

## Demand Coverage

`good.demandCoverage` maps demand category → coverage weight per unit. The five categories, evaluated in priority order, are:

```
food | utilities | construction | military | luxury
```

Coverage is used during the burg worker loop to calculate demand effects (boosting production of goods that fill unmet high-priority demand), and during the demand-fill phase after global trade (where burgs buy goods from the market to cover personal needs).

## The `GoodsModule` Class

`window.Goods` (singleton) provides:

| Method / property       | Purpose                                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| `generate({ randomSeed? })` | Place bonus resources on the map from the current catalogue; seeds the RNG from the map `seed` for deterministic output, or from `randomSeed` for manual rerolls. Never resets the catalogue; initialises `pack.goods` from `defaultGoods` only when none exists yet |
| `restoreDefaults()`     | Replace `pack.goods` with a deep clone of `defaultGoods`, discarding customisations. The only method that resets the catalogue; callers re-place goods afterwards |
| `regeneratePlacement(goodId)` | Reroll bonus-resource placement for a single good without touching the rest of the catalogue              |
| `getBiomesProduction()` | Build biome→production index from current `pack.goods`                                                      |
| `get(i)`                | Fast id→Good lookup (uses `goodById` sparse array)                                                          |
| `sync()`                | Rebuild `goodById` after `pack.goods` is mutated                                                            |
| `getMethods()`          | Return the distribution expression method table for the current cell                                        |
| `getStroke(color)`      | Darken a hex color for the good's map icon stroke                                                           |

`defaultGoods` is a getter that maps `GOODS_DATA` to `Good` objects with numeric ids and resolved recipe ingredient ids.

## Key Constants

| Constant                  | Value                                                     | Meaning                                                       |
| ------------------------- | --------------------------------------------------------- | ------------------------------------------------------------ |
| `BONUS_RURAL_PRODUCTION`  | `0.25`                                                    | Bonus-resource units per rural population point (pre-cap)    |
| `BONUS_URBAN_PRODUCTION`  | `1`                                                       | Bonus-resource units per burg population point (pre-clamp)   |
| `MIN_BONUS_PRODUCTION`    | `1`                                                       | Lower clamp on a burg's bonus-resource pre-seed              |
| `MAX_BONUS_PRODUCTION`    | `5`                                                       | Upper cap on bonus-resource output (rural and burg)         |
| `DEMAND_PRIORITY`         | `["food","utilities","construction","military","luxury"]` | Order of demand evaluation                                   |
| `DEMAND_TARGET_FACTORS`   | per-category scalars                                      | Target coverage per population point                         |

## Source Files

- [`src/generators/goods-generator.ts`](../../src/generators/goods-generator.ts) — `Good` interface, `GOODS_DATA`, `GoodsModule`
- [`src/generators/production-generator.ts`](../../src/generators/production-generator.ts) — `getModifiers`, production channels, `getCellProduction`
- [`src/controllers/goods-editor.ts`](../../src/controllers/goods-editor.ts) — Goods Editor (the catalogue list UI)
- [`src/controllers/good-editor.ts`](../../src/controllers/good-editor.ts) — single-good editor: multiplier popups, biome output, demand coverage
- [`src/controllers/goods-distribution-editor.ts`](../../src/controllers/goods-distribution-editor.ts) — visual builder for a good's `distribution` expression
- [`docs/domain/production_schema.md`](production_schema.md) — production pipeline in detail
- [`docs/prd/good-multipliers.md`](../prd/good-multipliers.md) — multiplier design decisions
