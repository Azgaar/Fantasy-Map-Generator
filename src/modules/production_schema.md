# Production Schema

Production starts after rural cells have already seeded raw goods into local markets.

- Rural cells extract raw goods into local markets.
- Burgs convert inventory and market inputs into manufactured goods.
- Markets hold stock, prices, redistribution, and later consumer sales.

## Run order

`Trade.initialize(goods, burgs)` runs before `Production.produce()`.

That setup phase creates markets, assigns each burg to a market, seeds rural raw production into market stock, and sets initial market prices from local supply and expected demand.

`Production.produce()` then:

1. Processes valid burgs in ascending population order.
2. Uses worker ticks to execute the best manufacturing step available.
3. Retains enough finished inventory to cover local demand.
4. Sells excess goods back to the local market.
5. Lets trade redistribute market surpluses between regions.
6. Buys remaining demand goods from the local market.

## Inputs for each burg

Each burg turn starts with:

- empty temporary `inventory`
- `demandTargets` derived from population
- live local market state: `stock`, `buyPrice`, `sellPrice`

There is no burg-side raw extraction pool anymore.
If a recipe needs a raw good, it must already exist in the burg inventory or be available on the market.

## Worker loop

Workers are consumed one fractional tick at a time until population is exhausted or no profitable step is feasible.

Per tick:

1. Measure current demand coverage from retained inventory-in-progress.
2. Identify the highest-priority unmet demand category.
3. Evaluate every good as a potential production goal.
4. Recursively plan the best next manufacturing action for that goal.
5. Choose the candidate with the highest normalized projected gain, with goal stickiness to avoid oscillation.
6. Execute one manufacturing step.

## Unified goal planning

The planner does not split raw and manufactured logic.

For a target good:

1. Try immediate manufacture from inventory plus market stock.
2. If ingredients are missing, recursively plan one upstream manufactured ingredient.
3. Reject plans that exceed remaining workers.
4. Score the next action by projected downstream gain per worker.

Raw goods are terminal dependencies, not worker actions.

## Manufacturing execution

When a manufacturing step is executed:

1. Ingredients are taken from inventory first.
2. Missing inputs are bought from the market with `Trade.buyFromMarket({phase: "local-production-buy"})`.
3. Purchase cost is subtracted from `burg.wealth`.
4. Market `buyPrice` rises under buy pressure.
5. Output is multiplied by the culture modifier and added to inventory.

## Retain vs sell

After local production, `splitInventoryByDemand` keeps enough goods to cover the burg's own demand in `DEMAND_PRIORITY` order.

- `retainedInventory` becomes `finalInventory`
- `excessInventory` is sold to the local market

Selling excess with `Trade.sellToMarket({phase: "local-sale"})`:

- increases market stock
- adds post-tax revenue to `burg.wealth`
- records seller-side tax to the state ledger
- lowers market `sellPrice` under sell pressure

## Post-production trade

After all burgs finish:

1. `Trade.redistributeAcrossMarkets(...)` moves market surpluses toward markets with uncovered demand.
2. `fillBurgDemandFromCenter(...)` lets each burg buy remaining demand goods from its local market.
3. `Trade.updateMarketDemand(...)` refreshes market demand state.

## Stored burg snapshot

`BurgProductionData` stores:

- `jobs`: executed manufacturing jobs with recipe sourcing detail
- `finalInventory`: goods retained after local production and later demand-fill purchases

## Architectural intent

- Raw extraction belongs to rural cells.
- Worker-constrained production belongs to burg manufacturing.
- Markets are the only bridge between rural supply, burg production, and inter-regional trade.
