# Production Schema

Production models the transformation of rural resources into manufactured goods via burgs, with all flows mediated by markets. The system is optimized for speed and clarity, using dense and sparse arrays, and avoids object/Map/Set structures in the hot path.

- Rural cells extract raw goods into local markets (not directly to burgs).
- Burgs manufacture goods using inventory and market inputs, then sell all output to the market.
- Markets hold all stock, set prices, redistribute surpluses, and serve as the only bridge between rural, burg, and inter-regional flows.

## Run order

1. `Trade.initialize()` runs first:
   - Resets and creates markets, assigns burgs to markets, seeds rural raw production into market stock, and sets initial prices based on local supply/demand.
2. `Production.produce()` runs for each burg (in ascending population order):
   - Pre-seeds local resource bonus (if any) into burg inventory.
   - Executes a worker loop: each tick, plans and performs the best manufacturing step using unified, array-based planning (no split between raw/manufactured logic).
   - Sells the entire resulting inventory to the local market (no hoarding or retain/sell split).
3. After all burgs finish:
   - Trade redistributes market surpluses between regions.
   - Each burg buys demand goods from its local market to fill personal needs (capped by treasury and market stock).

## Inputs and Data Structures

All planning and execution use array-based structures for speed:

- `inventory`: burg's inventory at start of turn (carry-over from previous cycle)
- Local resource bonus: free units of the cell's resource, if present
- `demandTargets`: per-category demand, derived from population
- Market state: arrays for `stock`, `buyPrice`, `sellPrice` (per good)
- `goodById`: **sparse array** of all goods, indexed by `good.i`
- `productiveGoods`: **dense array** of manufacturable goods (with recipes)
- `recipesByOutput`: **array of arrays** of recipes, indexed by `good.i`
- `minWorkersByGood`: array of minimum workers per good
- `path`: boolean array for cycle detection in recursive planning

## Local resource bonus

If a burg is located on a resource cell, it receives a free bonus of that good at the start of its turn:

    localBonus = Math.min(Math.ceil(population), BONUS_RESOURCE_PRODUCTION)

This bonus is added directly to inventory (no market transaction or cost). The same good gets a 50% buy-price discount in the burg's market view, making it highly preferred in planning.

## Worker loop

Workers are consumed one fractional tick at a time until population is exhausted or no profitable step is feasible. Each tick:

1. Measures current demand coverage from inventory-in-progress.
2. Identifies the highest-priority unmet demand category.
3. Evaluates every **productive good** as a potential goal (using `productiveGoods`).
4. Recursively plans the best next manufacturing action for that goal (using `recipesByOutput` and `goodById`).
5. Chooses the candidate with the highest normalized projected gain (with goal stickiness to avoid oscillation).
6. Executes one manufacturing step.

## Unified goal planning

There is no split between raw and manufactured logic. All planning is unified and array-based:

For a target good:

1. Try immediate manufacture from inventory plus market stock.
2. If ingredients are missing, recursively plan one upstream manufactured ingredient.
3. Reject plans that exceed remaining workers.
4. Score the next action by projected downstream gain per worker.

Raw goods are terminal dependencies (not produced by workers).

## Manufacturing execution

When a manufacturing step is executed:

1. Ingredients are taken from inventory first.
2. Missing inputs are bought from the market (`Trade.buyFromMarket()`), costing treasury and raising market price.
3. Output is multiplied by the culture modifier and added to inventory.

## Sell all

After production, the entire inventory is sold to the local market (`Trade.sellToMarket()`):

- Increases market stock
- Adds post-tax revenue to `burg.treasury`
- Records seller-side tax to the state ledger
- Lowers market price under sell pressure

`burg.product` = max(0, phaseRevenue - ingredientCosts)

## Post-production trade

After all burgs finish:

1. `Trade.redistributeAcrossMarkets(...)` moves market surpluses to markets with uncovered demand.
2. Each burg buys demand goods from its local market (capped by treasury and market stock), storing them in `demandInventory` for the next cycle.
3. `Trade.updateMarketDemand(...)` refreshes market demand state.

## Stored burg snapshot

After the full cycle:

- `burg.inventory`: goods bought in the demand-fill phase (carried into next cycle)
- `burg.produced`: units of each good manufactured
- `burg.treasury`: updated by ingredient purchases, sales revenue, taxes, and demand purchases
- `burg.product`: net revenue from the sell phase minus ingredient costs

## Architectural intent

- Raw extraction is handled by rural cells and the local resource bonus (never by burgs directly).
- Worker-constrained production is exclusive to burg manufacturing.
- All produced goods are sold immediately; burgs never hoard output.
- Demand is satisfied only after redistribution, not during production.
- Markets are the only bridge between rural supply, burg production, and inter-regional trade.

## Implementation notes

- The system is fully array-based for performance; no Map/Set/object/Record in the hot path.
- There is no legacy split between raw and manufactured logic; all planning is unified.
- All flows (resource, goods, money) are mediated by the market layer.
