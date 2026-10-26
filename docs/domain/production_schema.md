# Production Schema

Production models the transformation of rural resources into manufactured goods via burgs, with all flows mediated by markets. The hot path is array-based and avoids `Map` / `Set` / `Record` lookups.

- Rural cells seed raw goods into market stock (not directly into burgs).
- Burgs start each production cycle with no inventory; they manufacture goods using free local resource bonuses and market inputs, then sell all output back to the local market.
- After every burg finishes producing, surpluses are reshuffled between markets and each burg buys goods to cover personal demand.
- Production is a single-pass simulation: there is no recurring tick. The persisted per-burg output is `burg.production` (units made by good) and the burg's deals in `pack.deals`; there is no carried-over inventory between runs.

## Run order

`Production.produce()` is the single entrypoint, called after `Markets.generate()` has created markets and assigned every burg to one. It runs the following sequence:

1. `Markets.collectRuralProduction()` — seeds every market's stock with the rural output of its cells (cell resource bonus plus biome output scaled by population, with the full multiplier stack applied via `getModifiers`, all × `RURAL_OUTPUT_FACTOR = 3`).
2. `Markets.initializeMarketPrices()` — sets the starting `price` for every (market, good) pair, in two passes (raw goods first, then manufactured).
3. Every burg pre-seeds its local resource bonus (if any) into inventory. Then burgs take turns in descending population order, each turn spending up to `WORKERS_PER_TURN = 5` workers:
   - Runs the worker loop for the turn, planning and executing one manufacturing step per fractional worker tick.
   - Sells the turn's inventory to the local market, adding the revenue to `burg.treasury`.
   - Drops out once its workers are spent or nothing is worth making.

   The largest burgs move first and take the best offers, but a turn is too small for one burg to drain a market. 4. For each burg, `fillDemand` buys goods to cover personal demand, from the local market or imported when it lacks them, capped by treasury and stock.
5. `burg.production`, `burg.product` and, in debug mode, `burg.productionLog` are stored.

## Inputs and Data Structures

All planning and execution use array-based structures for speed:

- `inventory`: burg's inventory under construction during the worker loop (sparse number array keyed by `good.i`)
- Local resource bonus: free units of the cell's resource good, if present
- Market state: per-good `{ stock, price }`; `buyPrice` / `sellPrice` are derived on demand via `MARKET_MARGIN`
- `productiveGoods`: **dense array** of goods with at least one recipe
- `recipesByOutput`: **array of arrays** of recipes, indexed by `good.i`
- Planning stock: scratch inventory and market-stock arrays, reserved per recipe branch without changing the live stocks
- `demandGoodsByCategory`: per-category candidate list for the demand fill, sorted by coverage weight then value
- `path`: boolean array used as a visited set during recursive recipe planning

## Local resource bonus

If `pack.cells.good[burg.cell]` is set, the burg receives a free pre-production stock of that good:

    localBonus = minmax(population × BONUS_URBAN_PRODUCTION, MIN_BONUS_PRODUCTION, MAX_BONUS_PRODUCTION) × getModifiers(good, burg.cell)

(`BONUS_URBAN_PRODUCTION = 1`, `MIN_BONUS_PRODUCTION = 1`, `MAX_BONUS_PRODUCTION = 5`.) These units go directly into `inventory` (no market transaction, no cost). There is no special buy-price discount on the local good — its attractiveness comes purely from being already in inventory at zero cost.

## Worker loop

Workers are consumed one fractional tick at a time until the turn's workers or the population are exhausted, or no profitable step is feasible. The active goal carries over between turns. Each tick:

1. Iterates every productive good as a candidate goal.
2. For each goal, recursively plans the best next manufacturing action (`planGoodAction`).
3. Selects the candidate with the highest normalized projected gain (gain per worker).
4. Applies **goal stickiness**: if the previously active goal is still feasible and within `GOAL_STICKINESS_FACTOR` (0.85) of the new best, keep it to avoid oscillation.
5. Executes one manufacturing step toward the chosen goal.

Production is driven by profit alone: the burg's own demand plays no part, since all output is sold and demand is filled from the market afterwards, where prices already reflect it.

## Goal planning

There is no split between raw and manufactured logic — planning is unified and recursive:

For a target good:

1. Try an immediate manufacture: every recipe is evaluated against inventory + market stock. If feasible within remaining workers, the immediate candidate's score is `sellPrice × modifier − ingredientCost`, where `modifier = getModifiers(good, burg.cell)` is the full production multiplier stack.
2. Reserve inputs for the full requested quantity. If ingredients are missing, recursively plan their manufacture against the remaining stock, using `path[good.i]` as a cycle guard. Alternative recipes get independent reservations.
3. Add the workers required by the missing-component plans to the current manufacture. Stocked inputs cost no manufacturing workers; their purchase prices still count. Reject a chain when inputs are unavailable or the accumulated work exceeds the remaining workers.
4. Score the chosen plan by `projectedGain / workersNeeded`, with stickiness applied at the outer decision step.

Raw goods (no recipes) are terminal dependencies and are never produced by workers.

### Input sourcing

Every input is quoted from the burg's own market while that market stocks it (`stock > 0.01`), even when importing would be cheaper. Otherwise it is quoted as an import: `Markets.quoteImport` picks the market that delivers to the burg cheapest (price + exporter sales tax + importer tariff with the margin, plus the carriage along routes; embargoed and unreachable sources are skipped). Local quotes also carry the carriage between the market's center and the burg, added to buying and taken from selling (see the trade schema's Carriage). Imports therefore win only where a market lacks the good, and only when the sale still beats their cost.

Import quotes are cached per good for the burg's turn: other markets change only through this burg's own imports until the turn ends, so the cache is exact. A good's entry is dropped after the burg imports it.

## Manufacturing execution

When a step runs (`executeManufacture`):

1. For each ingredient: take what's available from inventory first.
2. Missing inputs are bought via `Markets.buy({ burg, good, units })`, or imported via `Markets.importForBurg` when the market lacks them. An import is the burg's deal with the source market at the delivered price (with the exporter's tax and the importer's tariff); the burg's market stock is untouched. Either way the trade is an input purchase. The cost reduces `burg.treasury` and the per-burg `ingredientCosts` accumulator (local to the worker loop). If any market buy fails, the manufacturing step is skipped without mutating inventory.
3. Inventory is updated.
4. Output amount = `actualYield × getModifiers(good, burg.cell)`; added to `inventory[good.i]` and `produced[good.i]`. (In debug mode the applied factor is logged as `cultureModifier` when it is not 1 — the field name predates the multi-dimension multiplier system but now carries the full stack.)

## Sell all

After each turn, the entire `inventory` is sold to the local market via `Markets.sell({ burg, good, units })`, so later turns see the lowered prices:

- Increases market stock; lowers market price under sell pressure.
- Gross revenue = `units × price`.
- Sales tax rate comes from `States.getSalesTax(burg)`; `Markets.sell` returns the absolute amount `tax = units × price × rate` and adds it to the sale deal. The post-tax revenue (`grossRevenue − tax`) is added to `burg.treasury` and the burg's running `revenue`, and `States.collectTaxes()` later credits the deal's tax to the seller's state treasury (see [taxes.md](taxes.md)).

`burg.product = max(0, revenue − ingredientCosts)`, summed over all turns

## Demand fill

After every burg finishes producing:

`fillDemand` walks the burgs in the same descending population order. There is no separate market-to-market trade step: a burg imports what its market lacks, as in production. For each burg and each demand category (in `DEMAND_PRIORITY` order):

- Quotes the candidate goods from `demandGoodsByCategory` with the same input sourcing as production (local while stocked, else the cheapest import), dropping those with no stock anywhere.
- A good the burg sold to its own market earlier in the run is quoted at what the sale earned it per unit, after tax and carriage, for up to the units sold and still in stock. Keeping its own goods is then cheaper than buying them at the market's buy price, but it is just another quote: the burg takes whatever covers demand cheapest. Kept goods undo that much of the sale (`Markets.keep`), so no sales tax is owed on them.
- Sorts candidates by **cost per coverage** (`buyPrice / coverageWeight`).
- Buys one good at a time, with the remaining treasury as `budget`, until the category shortage is covered, the treasury is empty, or the stock is exhausted.
- Adds every purchase to the burg's demand deal with the seller market.

## Stored burg snapshot

After the full cycle:

- `burg.production`: `[good, units][]` — the units of each good made in the cycle, local bonus included.
- The burg's deals in `pack.deals` — its sales and its input and demand purchases, summed by market and good. As a burg sells or uses up all it makes and buys for production, its demand purchases are what it holds after the run.
- `burg.productionLog`: written only when `log.debug.production` is on — every step in order: local bonus `{goodId, units}`, manufacture `{goodId, units, recipe, candidates, cultureModifier?}` and trade `{goodId, market, kind, units, price, tax}`.
- `burg.treasury`: updated by ingredient purchases, sales revenue (post-tax), and demand-fill purchases
- `burg.product`: net revenue from the sell phase minus ingredient costs

The worker loop's `inventory` is local scratch state that is fully sold to the market and never persisted. The Production Overview shows `burg.production`, the burg's deals and, when present, the step log.

## Architectural intent

- Raw extraction is handled by rural cells (market seeding) and the local resource bonus (never by burgs directly).
- Worker-constrained production is exclusive to burg manufacturing.
- All produced goods are sold immediately; burgs never hoard output.
- Personal demand is satisfied only after production, not during it.
- Markets are the only bridge between rural supply, burg production, and inter-regional trade: a burg imports an input through its own market.

## Implementation notes

- No `Map` / `Set` / `Record` lookups in the hot path; planning state is dense / sparse number arrays.
- There is no legacy split between raw and manufactured logic; one recursive planner handles both.
- All flows (goods, money) are mediated by the market layer through `Markets.buy` / `Markets.sell`.
- Sources: [src/model/economy/production-generator.ts](../../src/model/economy/production-generator.ts), [src/model/economy/markets-generator.ts](../../src/model/economy/markets-generator.ts), [src/model/economy/goods-generator.ts](../../src/model/economy/goods-generator.ts).
