# Markets Schema

Markets are the centralized economic layer. Every flow of goods or money passes through a market: rural cells seed stock, burgs buy ingredients and sell output, and a burg imports what its market lacks through that market. The hot path is array-based and avoids `Map` / `Set` / `Record` lookups.

## Market creation

`Markets.generate()`:

1. Scores every active burg by `population`, with `×2` for capitals and `×2` for ports.
2. Walks burgs in descending score and places a new market whenever no existing market is within an adaptive spacing radius (a quadtree-based spatial check). Each accepted market gets an `i`, a `centerBurgId`, and a random color.
3. Expands markets out from each center using a cost-aware flood fill (`expandMarkets`). Travel cost favors connected routes, same waterbody for ports, same river, and same state/province; mountains and crossing state borders are penalized. Deep water cells without a good are excluded from market assignment. The result is written to `pack.cells.market` (a `Uint16Array`).
4. Sets `burg.market` for every active burg from the resulting cell-to-market map.
5. Resets `pack.deals = []`.

Note: market stock and prices are not initialized during `generate()`. They are seeded and priced inside `Production.produce()` via `Markets.collectRuralProduction()` and `Markets.initializeMarketPrices()`.

## Rural seeding

`Markets.collectRuralProduction()` runs before any burg produces. For each cell whose market is set, it calls `Production.getCellProduction(cellId, biomeProduction)` and adds the returned per-good amounts to that market's stock. `getCellProduction` computes, for the cell's population (summed from land neighbours for water cells):

- **Biome output** — for every good with `good.biomeOutput[biomeId] > 0`, `population × biomeOutput × getModifiers(good, cellId)` units.
- **Bonus resource** — if `pack.cells.good[cellId]` is set, `min(population × BONUS_RURAL_PRODUCTION, MAX_BONUS_PRODUCTION) × getModifiers(good, cellId)` units (`BONUS_RURAL_PRODUCTION = 0.25`, `MAX_BONUS_PRODUCTION = 5`).

`getModifiers` is the full five-dimension multiplier stack (cultureType × culture × state × religion × biome), each factor defaulting to `1`. All stock goes to the market that owns the cell.

## Initial pricing

`Markets.initializeMarketPrices()` sets each market good's `price` from its `good.value`, then adjusts in two passes:

**Raw goods** (those with a `distribution`) — demand/supply ratio:

    demand = population × (consumerDemandFactor + industrialDemandFactor)
    ratio  = (demand + LAPLACE_PRICE_SMOOTHING) / (stock + LAPLACE_PRICE_SMOOTHING)
    price  = good.value × clamp(ratio, PRICE_FLOOR_FACTOR, PRICE_CEILING_FACTOR)

`consumerDemandFactor` derives from each good's share of its category's total `demandCoverage`, scaled by `DEMAND_TARGET_FACTORS`. `industrialDemandFactor` accumulates per-capita ingredient demand from recipes that consume the good.

**Manufactured goods** (those with `recipes`) — local ingredient cost plus base value-add:

    avgMarketCost = mean over recipes of (Σ ingredient.amount × market ingredient price)
    avgBaseCost   = mean over recipes of (Σ ingredient.amount × ingredient.value)
    price         = clamp(avgMarketCost + max(0, good.value − avgBaseCost), floor, ceiling)

All prices are clamped to `[good.value × PRICE_FLOOR_FACTOR, good.value × PRICE_CEILING_FACTOR]`.

## Quoted buy/sell prices

Each market good stores a single midpoint `price`. Customer-facing prices are derived per call:

    buyPrice  = price × (1 + MARKET_MARGIN) + salesTax + carriage
    sellPrice = max(0, price × (1 − MARKET_MARGIN) − carriage)

`MARKET_MARGIN` is 5%. `salesTax = marketState.salesTax × price` is what the market's state levies on the sale (see [taxes.md](taxes.md)); a burg's own sales tax on what it sells comes off its revenue instead. `carriage` is the cost of moving one unit between the market's center and the burg (see Carriage); it is 0 at the center burg. `Markets.quoteMarket(market, goodId, burg?)` returns `{ stock, buyPrice, sellPrice }` for planning, at the burg's door when a burg is given.

## Carriage

Goods pay for the path they travel, the same path the trade animation draws:

- `TradeRoutes.search(startCell, endCell?)` is a Dijkstra over the route network (`pack.cells.routes`). States are `cell × 2 + (isWater ? 1 : 0)`, so land and water arrivals at one cell are tracked apart. An edge costs its length (between burg positions, otherwise cell centers) × 1 on land routes or × `WATER_COST` (0.2) on sea routes, plus `SWITCH_SPACINGS` (4) cell spacings for loading when the path switches between land and water.
- `Markets.measureRoutes()` runs it once per economy run from every market's center (`TradeRoutes.measure()`), keeping the cost to every burg.
- `carriage = min(routeCost / decima, MAX_DECIMAS) × good.carriage` per unit (`Markets.getTransport`), where a decima is a tenth of the map's diagonal (`getDecima`) and `good.carriage` the good's price per unit and decima (see the goods schema). The cap, `MAX_DECIMAS` = 10, is the whole diagonal.
- A burg with no route to its own market pays the cap. Another market with no route to the burg cannot sell to it.

## Buy phase (production)

`Markets.buy({ burg, good, units, kind, budget? })` is called when a burg needs recipe ingredients (`kind` input):

- Caps the order at `min(units, marketStock, budget / buyPrice)`, the affordable part rounded down to the hundredth so the cost stays within the budget.
- If the resulting amount is < 0.01, returns `null`.
- Adds the trade to the burg's deal with its market in the good and kind (see Deal log) and returns the trade `{ units, price, tax }`.
- Records the market's state sales tax as the trade's `tax` (`taxPerUnit × units`), already in the price.
- Reduces market stock; raises market price under buy pressure.

The production module subtracts `units × price` from `burg.treasury` and accumulates it into a local `ingredientCosts` accumulator (per-burg, used to compute that burg's `product` at the end of the worker loop).

When the burg's market has no stock of an ingredient, the burg imports it through that market:

- `Markets.getTradeTerms()` returns the per-unit taxes on a good moving between two markets — `taxPerUnit` (exporter's sales tax) and `tariffPerUnit` (importer's tariff) — or `null` under an embargo (see Foreign trade).
- `Markets.quoteImport(burg, good, terms)` picks the source that delivers to the burg cheapest and quotes its delivered price.
- `Markets.importForBurg({ burg, source, good, units, kind, terms })` adds the trade to the burg's deal with the source market at the delivered price, with the exporter's `tax` and the importer's `tariff`; the source's stock falls and its price rises, and the burg's own market is untouched.

## Sell phase (production)

`Markets.sell({ burg, good, units, taxRate? })` is called once per good when a burg sells its inventory after production:

- Adds the trade to the burg's sale deal with its market, with the absolute sales tax `units × price × rate` (the rate is the burg's `state.salesTax`, 0 for neutral burgs).
- Increases market stock; lowers market price under sell pressure.
- Returns the trade; the production module deducts its `tax` from gross revenue and adds the post-tax amount to `burg.treasury`. `States.collectTaxes()` later credits the deal's tax to the seller's state treasury.

## Demand-fill buy phase

After production, each burg fills personal demand within its remaining `burg.treasury`, as the `budget`:

- Quotes every candidate good of a category like production does: the local buy price while its market stocks the good, otherwise the cheapest import's delivered price.
- Sorts the candidates by `buyPrice / coverageWeight` and buys the cheapest first, via `Markets.buy` or `Markets.importForBurg`.
- Each purchase decreases the seller market's stock, raises its price, and reduces treasury.
- Each purchase goes into the burg's demand deal with the seller market (there is no carried-over inventory between cycles).

## Foreign trade

Markets do not trade with each other on their own. Every foreign deal starts with a burg that needs a good its market lacks — an ingredient during production or a demand good in the demand fill — and buys it from another market. The delivered price:

- `carriage` from the source market's center to the burg (see Carriage).
- `taxPerUnit = exporterState.salesTax × exporterPrice` (0 for neutral exporters).
- `tariffPerUnit = tariffRate × exporterPrice`, where `tariffRate` is the importer state's most specific rule (0 fallback). Markets of one state trade with no tariff and are never embargoed.
- An embargo by either state (`resolve(importerState, exporterState, good)` or `resolve(exporterState, importerState, good)`) rules the source out.
- `deliveredPrice = exporterPrice × (1 + MARKET_MARGIN) + taxPerUnit + tariffPerUnit + carriage`: the taxes come after the margin, as on a local buy.

`getTradeTerms()` compiles the tariff and embargo rules once and caches each market pair's tax rate and per-good tariff on first use, as none of them change during a run. An import deal's `tax` flows to the exporter state's treasury and its `tariff` to the state of the burg's own market via `States.collectTaxes()`.

## Demand model

Demand is population-driven and category-based:

- `DEMAND_PRIORITY` defines evaluation order: `food → utilities → construction → military → luxury`.
- `DEMAND_TARGET_FACTORS` converts burg population into a per-category target via `getDemandTargets(population)`.
- `good.demandCoverage[category]` defines how much one unit of the good contributes to each category.

The same demand model drives:

- initial price computation (consumer + industrial demand factors),
- final burg demand-fill prioritization (`cost per coverage`).

There is no separate `updateMarketDemand` step; demand factors are recomputed per phase from `pack.goods` and burg population.

## Data model

`pack.markets: Market[]` where each `Market` is:

- `i: number` — market id
- `centerBurgId: number` — anchor burg
- `color: string` — UI color
- `goods: Record<number, { stock: number; price: number }>` — per-good state (`buyPrice` / `sellPrice` derived from `price ± MARKET_MARGIN`)

`pack.cells.market: Uint16Array` — cell-to-market assignment.
`burg.market: number` — derived from `cells.market[burg.cell]` during `expandMarkets`.

### Planning structures (used by Production and Trade)

- `productiveGoods`: dense array of manufacturable goods
- `recipesByOutput`: array of arrays of recipes, indexed by `good.i`
- Planning stock: scratch inventory and market-stock arrays, reserved per recipe branch without changing the live stocks
- `demandGoodsByCategory`: per-category sorted candidate lists for the demand-fill phase
- `path`: boolean array used as a visited set during recursive recipe planning

## Deal log

Every deal is between a burg and a market, and `pack.deals` keeps one per burg, market, good and kind, summing the run's trades as they happen (`Markets.recordDeal`). A deal is a tuple, its id is its index:

    Deal = [
      burg: number,
      market: number,                 // the burg's own market, or the source of an import
      good: number,
      kind: 0 | 1 | 2,                // DEAL_KINDS: sale, input purchase, demand purchase
      units: number,                  // summed, rounded to 2 decimals
      price: number,                  // volume-weighted average per unit
      tax: number,                    // sales tax: the burg's on a sale, the exporter's on an import
      tariff: number,                 // the importer's, on an import
      carriage: number                // average per unit, as price: carrying the goods between the market's center and the burg
    ]

A deal with a market other than the burg's own is an import (`Markets.isImport`). `Markets.buy`, `Markets.sell` and `Markets.importForBurg` record deals; the step-by-step trades are kept only in `burg.productionLog`, in debug mode. The deal log is the input for the trade animation layer, the trade details dialog, the market views and `States.collectTaxes()`, which credits taxes to the states `Markets.getTaxStates(deal)` names.

## Trade animation

A read-only visualization layer that turns the deal log into moving markers on the map. It does not mutate any market or burg state.

- **Flows**: each deal is one flow, between the burg and its market's center burg (`getEnds`): a sale runs to the market, a purchase from it. `displayType` "global" shows imports, "local" the rest.
- **Pathfinding**: `findRoutePath(startCell, endCell)` takes the cheapest path from `TradeRoutes.search`, the same search that prices carriage (see Carriage), and splits its cells into `"land"` / `"water"` segments. A deal with no route is not animated.
- **Rendering**: each segment animates one marker — wagon on land (rendered at `markerSize / 2`), ship on water (`markerSize`).
- **Lifecycle**: `start / stop / restart / sync` follow the `toggleTrade` layer flag. The deals are filtered once per `start()` and cached. A `concurrent`-sized pool of active animations is maintained via `topUp()`; each animation calls back on completion to immediately spawn a replacement. `trigger(deals)` is a one-shot variant that draws specific deals without the pool lifecycle. `clear()` removes every animation SVG, and the cloned `tradeAnimation` group is wiped before `.map` save.
- **Interaction**: clicking a marker opens `TradeDetails.open(deal)` — a dialog that lists the goods the deal's burg sells to its market or buys from a market, always from the burg's side ("Trade: burg sells to market" or "buys from market"), and highlights the route in red. Like the Production Overview, each good shows its net price per unit (the goods alone), the carriage, sales tax and tariff per unit (each tax naming the state it goes to), units, and the income to the burg: positive on a sale, negative on a purchase. Zoom buttons recenter on the burg or the market's center.
- **Style controls**: `TradeAnimationEditor` exposes display type, concurrency, timing and size — `displayType` (`"both"` / `"local"` / `"global"`), `concurrent`, `duration`, `landDurationModifier`, `segmentChangePause`, `markerSize`. Path stroke color / dash live in the layer style editor.
- **Sources**: [src/renderers/trade-animation.ts](../../src/renderers/trade-animation.ts), [src/renderers/draw-trade-animation.ts](../../src/renderers/draw-trade-animation.ts), [src/controllers/economy/trade/trade-details.ts](../../src/controllers/economy/trade/trade-details.ts), [src/controllers/economy/trade/trade-animation-editor.ts](../../src/controllers/economy/trade/trade-animation-editor.ts).

## Architectural intent

- Rural production shapes local market conditions before any burg produces.
- Burgs sell everything they produce and buy demand goods separately after production.
- The local resource bonus gives burgs on resource cells a free supply advantage but does not bypass the market price signal.
- Markets are the only mechanism for moving goods between rural producers, burg workshops, and other regions.

## Implementation notes

- No `Map` / `Set` / `Record` lookups in the hot path; market state is keyed by integer good id.
- A single midpoint `price` is stored per market good; `buyPrice` and `sellPrice` are derived via `MARKET_MARGIN`.
- Sources: [src/model/economy/markets-generator.ts](../../src/model/economy/markets-generator.ts), [src/model/economy/goods-generator.ts](../../src/model/economy/goods-generator.ts).
