# Production Schema

Production runs once for all valid burgs. Each burg goes through the same loop:

1. Flood-fill nearby cells to gather accessible raw resources.
2. Spend workers one tick at a time, greedily choosing the best action each tick.
3. Split the final inventory into retained (covers own demand) and excess (sold to market).
4. Sell excess to the burg's assigned market.

After all burgs finish, the trade layer runs global redistribution and final demand-fill.

## The four layers of the simulation

### 1. Local resources (cell pool)

Raw materials come from `cellPool[cellId][goodId]`.

- Built once from `cells.good` and biome production.
- Shared by all burgs during the run.
- Once a burg collects resources from a cell, that cell's amount is zeroed out in the pool.

This is the primary local-scarcity mechanic.

### 2. Burg inventory

Each burg has a temporary `inventory[goodId]` during its turn.

- Extraction adds goods to inventory.
- Manufacturing consumes ingredients from inventory and from the market.
- At the end of the worker loop, inventory is split into retained and excess.
- Retained inventory stays with the burg (`finalInventory`).
- Excess is sold to the burg's market.

### 3. Market per region

There is no single global market. Each burg belongs to one market (`burg.marketId`).

Each market has per-good state: `{stock, buyPrice, sellPrice}`.

- Burgs buy ingredients from their market during manufacture (at `marketBuyPrice`).
- Burgs sell excess to their market after production (at `marketSellPrice`).
- After all local production, markets trade with each other (global redistribution).
- After redistribution, burgs buy to fill remaining demand from their market.

See `trade_schema.md` for the full market and pricing model.

### 4. Live prices

Each market tracks two live prices per good:

- `buyPrice` — what buyers pay (rises when goods are bought)
- `sellPrice` — what sellers receive (falls when goods are sold)

Both start at `good.value` and are clamped to `[good.value × 0.5, good.value × 3.0]`.

Price pressure in the production phase:

- buying ingredients from market → **raises** `buyPrice`
- selling excess to market → **lowers** `sellPrice`
- extraction itself does **not** change prices

## Burg processing order

Burgs are processed in ascending population order (smallest first).

That matters because:

- smaller burgs claim nearby map resources earlier,
- they sell into the market earlier and lower sell prices before large burgs act,
- large burgs see live prices shaped by earlier burgs.

## Phase A: one-time setup

Before iterating burgs, the generator builds:

1. `goodById` map
2. `cellPool` (cell → good → amount)
3. `chainValueByWorkers` (static chain-value heuristic, up to 5 workers)
4. `buyPressure`, `sellPressure`, `priceFloor`, `priceCeiling` arrays (all indexed by `good.i`)
5. `recipeOptions` for manufactured goods
6. `Trade.initialize(goods, validBurgs)` — places markets, initializes all `market.goods` at base price

### Price pressure arrays

```ts
buyPressure[i]  = good.value × 0.002
sellPressure[i] = good.value × 0.001
priceFloor[i]   = good.value × 0.5
priceCeiling[i] = good.value × 3.0
```

### Demand constants

Demand targets depend only on population:

```ts
demandTargets[category] = population × DEMAND_TARGET_FACTORS[category]
```

Default factors (from `goods-generator.ts`): food `0.2`, utilities `0.05`, construction `0.1`, military `0.05`, luxury `0.05`.

### Good demand coverage

Each good has explicit authored data:

```ts
good.demandCoverage = {
  food?: number,
  utilities?: number,
  construction?: number,
  military?: number,
  luxury?: number
}
```

Meaning: 1 unit of the good contributes the listed amount toward those demand categories.

## Phase B: resource access (flood-fill)

Each burg gathers nearby resources using a Dijkstra-style flood fill.

### Reach budget

```ts
budget = max(1, floor(population));
```

### Travel costs

- base: 1 per step
- crossing a province border on land: +3
- crossing a state border on land: +15
- water cells: 1, no border penalties

### Collection behavior

When a visited cell contains a good, it is added into `goodsPull[goodId]`.

Diminishing returns when the same good appears in multiple cells:

```ts
if first source: goodsPull[goodId] = amount
else if amount > current: goodsPull[goodId] = amount + current / COLLECTION_DIVISOR
else: goodsPull[goodId] = current + amount / COLLECTION_DIVISOR
```

`COLLECTION_DIVISOR = 3`

After collection, the cell's amount is zeroed in `cellPool`.

The burg then copies `goodsPull` into `remainingPool` for actual worker consumption.

## Phase C: worker loop

Each burg gets up to `ceil(population)` worker ticks. The last tick may be fractional:

```ts
fraction = min(1, population - workersUsed);
```

The loop ends early if no feasible action remains.

## The two action kinds

### Extract

Feasible when `remainingPool[goodId] > 0`.

Execution:

1. Take `min(fraction, remainingPool[goodId])` units.
2. Apply culture modifier to output.
3. Add result to `inventory[goodId]`.
4. Reduce `remainingPool[goodId]`.

No price change occurs on extraction.

### Manufacture

Feasible when one recipe can be satisfied from local inventory and/or current market stock.

Execution:

1. Consume ingredients from inventory first.
2. For any shortfall, call `Trade.buyFromMarket({phase: "local-production-buy"})`:
   - Market stock decreases (capped at available stock).
   - Burg pays consumer price: `marketBuyPrice` (no buyer-side sales tax).
   - `marketGood.buyPrice` is raised: `buyPrice += actualBuy × buyPressure[ingId]` (capped at ceiling).
3. Subtract purchase cost from `burg.wealth`.
4. Add manufactured output to `inventory[goodId]` with culture modifier.

Sell-price pressure happens later when final inventory is sold.

## How the burg chooses actions

Greedy: every tick scores all feasible extract and manufacture actions, picks the single best score.

### Extract scoring

```ts
actualUnits = min(fraction, remainingPool[goodId])
chainValue  = chainValueByWorkers[workerBucket][goodId]   // static chain heuristic
score       = chainValue × cultureModifier × demandEffect.multiplier × actualUnits
```

`workerBucket` = `min(maxWorkers, ceil(workersLeft))`.

### Manufacture scoring

```ts
revenue        = currentSellPrice[outputGood] × units × cultureModifier
ingredientCost = sum(recipeAmount × consumerPrice[ingredient])   // consumerPrice = marketBuyPrice
score          = (revenue - ingredientCost) × demandEffect.multiplier × units
```

Both actions use **current live market prices**, not base prices.

### Demand multiplier (`demandEffect`)

Driven by the most-urgently-needed demand category:

1. Find the first category where `demandTargets[c] - currentCoverage[c] > 0.001`.
2. If the candidate good covers that category:
   ```ts
   demandEffect.multiplier = 1 + coverageWeight × (2.0 + shortage)
   ```
3. Otherwise `multiplier = 1`.

### Chain value heuristic

`chainValueByWorkers[w][goodId]` is a static table built once, independent of live prices.

It starts at `good.value` and iteratively back-propagates downstream recipe profit into ingredient values for up to 5 worker buckets. It estimates how valuable a raw good is when there are still enough workers to convert it downstream.

## Phase D: split and sell

After the worker loop, inventory is split into retained and excess:

### Split: `splitInventoryByDemand`

For each demand category in priority order:

1. Find all goods in inventory that cover this category, sorted by coverage weight descending.
2. Retain just enough of each to satisfy remaining demand shortage.
3. Everything else stays in the excess pool.

Retained goods are set aside as `finalInventory`. Excess is sold.

### Sell excess to market

For each good in `excessInventory`:

1. Call `Trade.sellToMarket({phase: "local-sale"})` at **current `marketSellPrice`**.
2. `market.goods[goodId].stock` increases.
3. Burg pays sales tax from gross sale value and receives net revenue: `units × marketSellPrice × (1 - salesTaxRate)`.
4. After the sale: `marketGood.sellPrice -= amount × sellPressure[goodId]` (floored at floor).

## Stored production metrics

Each burg snapshot (`BurgProductionData`) stores:

| Field              | Meaning                                               |
| ------------------ | ----------------------------------------------------- |
| `population`       | burg population at time of run                        |
| `processRank`      | burg's processing order index                         |
| `totalBurgs`       | total valid burgs processed                           |
| `cellsBudget`      | flood-fill reach budget                               |
| `cellsReached`     | cells actually visited                                |
| `cultureType`      | burg's culture type                                   |
| `goodsPull`        | sorted list of `{goodId, pull, chainValue}`           |
| `jobs`             | executed worker actions with logs                     |
| `finalInventory`   | retained inventory after split (demand-covered goods) |
| `phaseRevenue`     | total sale value of excess inventory                  |
| `grossProduct`     | `phaseRevenue - purchasedIngredientCosts`             |
| `productPerCapita` | `grossProduct / population`                           |
| `wealthAfter`      | `burg.wealth` after local sales and purchases         |

`finalInventory` does **not** include excess goods. It is the burg's retained stock: enough to cover its own demand. The Production Overview's "Retained Inventory" section reflects this.

After `fillBurgDemandFromCenter` (Phase 4), demand-fill purchases are added to `finalInventory` and `wealthAfter` is updated in the snapshot.

## Price pressure summary

| Event                                                | Price changed        | Direction |
| ---------------------------------------------------- | -------------------- | --------- |
| Buy ingredients from market (production)             | market `buyPrice`    | ↑         |
| Sell excess to market                                | market `sellPrice`   | ↓         |
| Market exports to another market (redistribution)    | exporter `sellPrice` | ↑         |
| Market receives from another market (redistribution) | importer `buyPrice`  | ↓         |
| Burg fills demand from market (Phase 4)              | market `buyPrice`    | ↑         |
| Extract raw locally                                  | no price change      | —         |
| Manufacture itself                                   | no price change      | —         |
