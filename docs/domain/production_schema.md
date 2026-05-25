# Production Schema

Production models the transformation of rural resources into manufactured goods via burgs, with all flows mediated by markets. The hot path is array-based and avoids `Map` / `Set` / `Record` lookups.

- Rural cells seed raw goods into market stock (not directly into burgs).
- Burgs manufacture goods using their starting inventory and market inputs, then sell all output back to the local market.
- After every burg finishes producing, surpluses are reshuffled between markets and each burg buys goods to cover personal demand.

## Run order

`Production.produce()` is the single entrypoint, called after `Markets.generate()` has created markets and assigned every burg to one. It runs the following sequence:

1. `Markets.collectRuralProduction()` — seeds every market's stock with the rural output of its cells (cell resource bonus plus biome production scaled by population and culture modifier).
2. `Markets.initializeMarketPrices()` — sets the starting `price` for every (market, good) pair, in two passes (raw goods first, then manufactured).
3. For each burg in ascending population order:
   - Pre-seeds the local resource bonus (if any) into burg inventory.
   - Runs a worker loop, planning and executing one manufacturing step per fractional worker tick.
   - Sells the resulting inventory to the local market.
   - Stores `burg.produced`, updates `burg.treasury`, sets `burg.product`.
4. `Markets.runGlobalTrade()` — moves surpluses between markets according to per-good profitability (see Markets schema).
5. For each burg, `fillBurgsDemand` buys goods from the local market to cover personal demand, capped by treasury and stock; results are written to `burg.inventory`.

## Inputs and Data Structures

All planning and execution use array-based structures for speed:

- `inventory`: burg's inventory under construction during the worker loop (sparse number array keyed by `good.i`)
- Local resource bonus: free units of the cell's resource good, if present
- `demandTargets`: per-category demand target array (from `getDemandTargets(population)`)
- `demandCoverage`: per-category running coverage array updated as inventory changes
- Market state: per-good `{ stock, price }`; `buyPrice` / `sellPrice` are derived on demand via `MARKET_MARGIN`
- `goodById`: **sparse array** of all goods, indexed by `good.i`
- `productiveGoods`: **dense array** of goods with at least one recipe
- `recipesByOutput`: **array of arrays** of recipes, indexed by `good.i`
- `minWorkersByGood`: per-good lower bound on workers needed to produce one unit through the cheapest recipe chain
- `demandGoodsByCategory`: per-category candidate list, sorted by coverage weight then value
- `path`: boolean array used as a visited set during recursive recipe planning

## Local resource bonus

If `pack.cells.good[burg.cell]` is set, the burg receives a free pre-production stock of that good:

    localBonus = Math.min(population, BONUS_RESOURCE_PRODUCTION)

These units go directly into `inventory` (no market transaction, no cost). There is no special buy-price discount on the local good — its attractiveness comes purely from being already in inventory at zero cost.

## Worker loop

Workers are consumed one fractional tick at a time until population is exhausted or no profitable step is feasible. Each tick:

1. Identifies the highest-priority unmet demand category from current coverage.
2. Iterates every productive good as a candidate goal.
3. For each goal, recursively plans the best next manufacturing action (`planGoodAction`), using `recipesByOutput`, `goodById`, and inventory + market quotes.
4. Selects the candidate with the highest normalized projected gain (gain per worker).
5. Applies **goal stickiness**: if the previously active goal is still feasible and within `GOAL_STICKINESS_FACTOR` (0.85) of the new best, keep it to avoid oscillation.
6. Executes one manufacturing step toward the chosen goal.

## Goal planning

There is no split between raw and manufactured logic — planning is unified and recursive:

For a target good:

1. Try an immediate manufacture: every recipe is evaluated against inventory + market stock. If feasible within remaining workers, the immediate candidate's score is `(sellPrice × cultureModifier − ingredientCost) × demandMultiplier`.
2. If ingredients are missing, recursively plan one upstream manufactured ingredient. The recursion uses `path[good.i]` as a cycle guard.
3. Reject any plan whose `workersNeeded` (current step plus lower-bound upstream chain) exceeds remaining workers.
4. Score the chosen plan by `projectedGain / workersNeeded`, with stickiness applied at the outer decision step.

Raw goods (no recipes) are terminal dependencies and are never produced by workers.

## Manufacturing execution

When a step runs (`executeManufacture`):

1. For each ingredient: take what's available from inventory first.
2. Missing inputs are bought via `Markets.buy({ burg, good, units })`. The cost reduces `burg.treasury` and `state.ingredientCosts`; the deal is recorded and pushed onto the burg's `productionData` history.
3. Inventory and demand coverage are updated.
4. Output amount = `actualYield × cultureModifier`; added to `inventory[good.i]` and `produced[good.i]`.

## Sell all

After the worker loop, the entire `inventory` is sold to the local market via `Markets.sell({ burg, good, units })`:

- Increases market stock; lowers market price under sell pressure.
- Gross revenue = `deal.units × deal.price`.
- Sales tax = `grossRevenue × getSalesTaxRateForBurg(burg)`; the post-tax revenue is added to `burg.treasury` and `phaseRevenue`. The tax amount is subtracted from revenue but not currently recorded to a separate ledger.

`burg.product = max(0, phaseRevenue − ingredientCosts)`

## Post-production trade and demand fill

After every burg finishes producing:

1. `Markets.runGlobalTrade()` runs market-to-market arbitrage on every good (see Markets schema).
2. `fillBurgsDemand` walks the sorted burg list. For each burg and each demand category (in `DEMAND_PRIORITY` order):
   - Builds candidate goods from `demandGoodsByCategory`, filtered to those with stock in the burg's market.
   - Sorts candidates by **cost per coverage** (`buyPrice / coverageWeight`).
   - Buys one good at a time via `Markets.buy({ burg, good, units, budget })` until the category shortage is covered, the treasury is empty, or the stock is exhausted.
   - Records every deal in `productionData` and accumulates bought units into `demandInventory`.
3. `burg.inventory` is written from `demandInventory`, carrying these goods into the next cycle's pre-production inventory.

## Stored burg snapshot

After the full cycle:

- `burg.inventory`: goods bought in the demand-fill phase (becomes next cycle's starting inventory)
- `burg.produced`: units of each good manufactured this cycle (sparse `Record<goodId, units>`)
- `burg.treasury`: updated by ingredient purchases, sales revenue (post-tax), and demand-fill purchases
- `burg.product`: net revenue from the sell phase minus ingredient costs

`Production.getProductionData(burgId)` returns the recorded history of `local`, `mfg`, and `deal` entries for that burg's most recent cycle (used by the production overview UI and chains viewer).

## Architectural intent

- Raw extraction is handled by rural cells (market seeding) and the local resource bonus (never by burgs directly).
- Worker-constrained production is exclusive to burg manufacturing.
- All produced goods are sold immediately; burgs never hoard output.
- Personal demand is satisfied only after global redistribution, not during production.
- Markets are the only bridge between rural supply, burg production, and inter-regional trade.

## Implementation notes

- No `Map` / `Set` / `Record` lookups in the hot path; planning state is dense / sparse number arrays.
- There is no legacy split between raw and manufactured logic; one recursive planner handles both.
- All flows (goods, money) are mediated by the market layer through `Markets.buy` / `Markets.sell`.
- Sources: [src/modules/production-generator.ts](../../src/modules/production-generator.ts), [src/modules/markets-generator.ts](../../src/modules/markets-generator.ts), [src/modules/goods-generator.ts](../../src/modules/goods-generator.ts).
