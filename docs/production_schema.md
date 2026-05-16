# Production Schema

Production starts after rural cells have already seeded raw goods into local markets.

- Rural cells extract raw goods into local markets.
- Burgs convert inventory and market inputs into manufactured goods.
- Markets hold stock, prices, redistribution, and later consumer sales.

## Run order

`Trade.initialize()` runs before `Production.produce()`.

That setup phase creates markets, assigns each burg to a market, seeds rural raw production into market stock, and sets initial market prices from local supply and expected demand.

`Production.produce()` then:

1. Processes valid burgs in ascending population order.
2. Pre-seeds local resource bonus into the burg's starting inventory.
3. Uses worker ticks to execute the best manufacturing step available.
4. Sells the entire resulting inventory back to the local market.
5. Lets trade redistribute market surpluses between regions.
6. Buys demand goods from the local market to fill the burg's personal needs.

## Inputs and Data Structures

Each burg turn starts with:

- `inventory`: copied from `burg.inventory` (carry-over from previous cycle)
- local resource bonus added to inventory (see below)
- `demandTargets`: derived from population
- live local market state: `stock`, `buyPrice`, `sellPrice`
- `goodById`: **sparse array** of all goods, indexed by `good.i` (not a dense list)
- `productiveGoods`: **dense array** of only manufacturable goods (those with recipes), used for planning
- `recipesByOutput`: **array of arrays** of recipes, indexed by `good.i`
- `minWorkersByGood`: array of minimum workers required per good
- `path`: boolean array for cycle detection in recursive planning

## Local resource bonus

If `pack.cells.good[burg.cell]` is set, the burg receives free units of that good at the start of its turn:

```
localBonus = Math.min(Math.ceil(population), BONUS_RESOURCE_PRODUCTION)
```

This represents the burg being located directly on top of the resource source. The good is placed straight into inventory without any market transaction or cost.

The same good also receives a 50% buy-price discount in the scoring step (`getMarketView`), so the burg will strongly prefer recipes that use it.

## Worker loop

Workers are consumed one fractional tick at a time until population is exhausted or no profitable step is feasible.

Per tick:

1. Measure current demand coverage from retained inventory-in-progress.
2. Identify the highest-priority unmet demand category.
3. Evaluate every **productive good** (from `productiveGoods`) as a potential production goal.
4. Recursively plan the best next manufacturing action for that goal, using `recipesByOutput` and `goodById`.
5. Choose the candidate with the highest normalized projected gain, with goal stickiness to avoid oscillation.
6. Execute one manufacturing step.

## Unified goal planning

The planner does not split raw and manufactured logic. All planning is done via array-based structures for speed.

For a target good:

1. Try immediate manufacture from inventory plus market stock.
2. If ingredients are missing, recursively plan one upstream manufactured ingredient.
3. Reject plans that exceed remaining workers.
4. Score the next action by projected downstream gain per worker.

Raw goods are terminal dependencies, not worker actions.

## Manufacturing execution

When a manufacturing step is executed:

1. Ingredients are taken from inventory first.
2. Missing inputs are bought from the market with `Trade.buyFromMarket()`.
3. Purchase cost is subtracted from `burg.treasury`.
4. Market price rises under buy pressure.
5. Output is multiplied by the culture modifier and added to inventory.

## Sell all

After local production, the entire inventory is sold to the local market — there is no retain-vs-sell split for burgs.

Selling with `Trade.sellToMarket()`:

- increases market stock
- adds post-tax revenue to `burg.treasury`
- records seller-side tax to the state ledger
- lowers market price under sell pressure

`burg.product` is set to `max(0, phaseRevenue - ingredientCosts)`.

## Post-production trade

After all burgs finish:

1. `Trade.redistributeAcrossMarkets(...)` moves market surpluses toward markets with uncovered demand.
2. `fillBurgDemandFromCenter(...)` lets each burg buy demand goods from its local market, capped by treasury and market stock.
3. The purchased goods are stored in `demandInventory` and later written to `burg.inventory`.
4. `Trade.updateMarketDemand(...)` refreshes market demand state.

## Stored burg snapshot

After the full cycle:

- `burg.inventory`: goods bought in the demand-fill phase (carried into next cycle)
- `burg.produced`: units of each good manufactured
- `burg.treasury`: updated by ingredient purchases, sales revenue, taxes, and demand purchases
- `burg.product`: net revenue from the sell phase minus ingredient costs

## Architectural intent

- Raw extraction belongs to rural cells and the local resource bonus.
- Worker-constrained production belongs to burg manufacturing.
- All produced goods are sold immediately; burgs do not hoard output.
- Demand is satisfied after redistribution, not during production.
- Markets are the only bridge between rural supply, burg production, and inter-regional trade.
