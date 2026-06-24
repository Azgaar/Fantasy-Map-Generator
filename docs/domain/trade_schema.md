# Markets Schema

Markets are the centralized economic layer. Every flow of goods or money passes through a market: rural cells seed stock, burgs buy ingredients and sell output, and surpluses move between markets via global trade. The hot path is array-based and avoids `Map` / `Set` / `Record` lookups.

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

    buyPrice  = price × (1 + MARKET_MARGIN)
    sellPrice = price × (1 − MARKET_MARGIN)

`Markets.quoteMarket(market, goodId)` returns `{ stock, buyPrice, sellPrice }` for planning.

## Buy phase (production)

`Markets.buy({ burg, good, units, budget? })` is called when a burg needs recipe ingredients:

- Caps the order at `min(units, marketStock, budget / buyPrice)` and rounds to 2 decimals.
- If the resulting amount is < 0.01, returns `null`.
- Records a deal with `seller = market.i / sellerType = "market"` and `buyer = burg.i / buyerType = "burg"`.
- Reduces market stock; raises market price under buy pressure. No sales tax.

The production module subtracts `deal.units × deal.price` from `burg.treasury` and accumulates it into a local `ingredientCosts` accumulator (per-burg, used to compute that burg's `product` at the end of the worker loop).

## Sell phase (production)

`Markets.sell({ burg, good, units, taxRate? })` is called once per good when a burg sells its inventory after production:

- Records a deal with `seller = burg.i / sellerType = "burg"` and `buyer = market.i / buyerType = "market"`.
- Resolves the seller's sales tax (`taxRate` if passed, otherwise `state.salesTax` via `States.getSalesTax(burg)`) and persists the absolute tax amount on `deal.tax = units × price × rate`. `deal.tax` is always set (0 when the rate is zero, e.g. neutral burgs).
- Increases market stock; lowers market price under sell pressure.
- Returns the deal; the production module deducts `deal.tax` from gross revenue and adds the post-tax amount to `burg.treasury`. `States.collectTaxes()` later reads `deal.tax` to credit the seller's state treasury.

## Demand-fill buy phase

After global trade, each burg fills personal demand via `Markets.buy(...)` with a `budget` argument equal to the remaining `burg.treasury`:

- Sorts candidate goods per category by `buyPrice / coverageWeight` and buys the cheapest first.
- Each purchase decreases stock, raises price, and reduces treasury.
- Each purchase is recorded as a deal-reference record on `burg.production` (there is no carried-over inventory between cycles).

## Global redistribution

`Markets.runGlobalTrade()` runs after every burg has produced and sold. For each good:

1. Computes a per-market safety reserve = `population × (consumerDemand + industrialDemand) × (1 + TRADE_RESERVE_FACTOR)`.
2. Splits markets into **exporters** (stock above reserve) and **importers** (stock below reserve). Skips the good entirely if either side is empty.
3. For each (exporter, importer) pair, builds an opportunity with:
   - `transportCost = (octileDistance / mapDiagonal) × DISTANCE_COST_FACTOR × good.value` (a precomputed Chebyshev-octile straight-line cost between market center burgs).
   - `exporterTaxPerUnit = exporterState.salesTax × exporterPrice` (0 for neutral exporters).
   - `unitProfit = importerPrice − (exporterPrice + transportCost + exporterTaxPerUnit)`
   - `units = min(exporterAvailable, importerNeeded)`
   - Skips if `unitProfit × units < MIN_PROFIT` or `units < MIN_UNIT`. High-tax exporters drop out of opportunities they would otherwise win.
4. Sorts opportunities by total profit descending and executes them greedily, recomputing available / needed at execution time.
5. Each executed transfer records a market-to-market deal at `price = exporterPrice + transportCost + exporterTaxPerUnit` (the importer's landed cost) with `tax = exporterTaxPerUnit × units`, moves stock, and applies market pressure:
   - **Exporter price rises** (lost stock → applyMarketPressure with positive `units`).
   - **Importer price falls** (gained stock → applyMarketPressure with negative `units`).

The recorded `deal.tax` flows to the exporter state's treasury via `States.collectTaxes()`. Markets have no treasury, so the deal price (gross of exporter tax) is what the importer effectively paid.

## Demand model

Demand is population-driven and category-based:

- `DEMAND_PRIORITY` defines evaluation order: `food → utilities → construction → military → luxury`.
- `DEMAND_TARGET_FACTORS` converts burg population into a per-category target via `getDemandTargets(population)`.
- `good.demandCoverage[category]` defines how much one unit of the good contributes to each category.

The same demand model drives:

- initial price computation (consumer + industrial demand factors),
- the worker loop's demand-focus multiplier,
- per-market safety reserves in `runGlobalTrade`,
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
- `minWorkersByGood`: lower-bound worker count per good through the cheapest recipe chain
- `demandGoodsByCategory`: per-category sorted candidate lists for the demand-fill phase
- `path`: boolean array used as a visited set during recursive recipe planning

## Deal log

Every transaction is recorded in `pack.deals` as:

    Deal = {
      i: number,                      // index in pack.deals
      seller: number,                 // burg id or market id
      sellerType: "burg" | "market",
      buyer: number,                  // burg id or market id
      buyerType: "burg" | "market",
      good: number,                   // good id
      units: number,                  // rounded to 2 decimals
      price: number,                  // price per unit at time of deal, rounded to 2 decimals
      tax: number                     // absolute sales-tax amount in currency units; 0 when the seller's state has no salesTax or the deal is a market→burg buy
    }

Deals are produced by three call sites: `Markets.buy` (market → burg), `Markets.sell` (burg → market), and `Markets.runGlobalTrade` (market → market). The deal log is the input for the trade animation layer, the trade details dialog, and `States.collectTaxes()` which sums `deal.tax` into the seller state's treasury.

## Trade animation

A read-only visualization layer that turns the deal log into moving markers on the map. It does not mutate any market or burg state.

- **Batching**: deals are grouped by ordered `(seller burg, buyer burg)`. Market parties resolve to their `centerBurgId`, so opposite-direction flows form separate batches.
- **Pathfinding**: `findRoutePath(startCell, endCell)` runs a state-encoded Dijkstra over `pack.cells.routes`. State is encoded as `cell × 2 + (isWater ? 1 : 0)` so land and water arrivals at the same cell are tracked separately. Edge costs: water = 1, land = 5, land↔sea switch = 20; switches are only permitted at port burg cells. The resulting cell sequence is split into `"land"` / `"water"` segments.
- **Rendering**: each segment animates one marker — wagon on land (rendered at `markerSize / 2`), ship on water (`markerSize`).
- **Lifecycle**: `start / stop / restart / sync` follow the `toggleTrade` layer flag. Batches are computed once per `start()` and cached. A `concurrent`-sized pool of active animations is maintained via `topUp()`; each animation calls back on completion to immediately spawn a replacement. `trigger(batches)` is a one-shot variant that draws a specific set of batches without the pool lifecycle. `clear()` removes every animation SVG, and the cloned `tradeAnimation` group is wiped before `.map` save.
- **Interaction**: clicking a marker opens `TradeDetails.open(batch)` — a dialog that groups the batch's deals by good, shows units / unit price / total value, and highlights the route in red. Endpoint zoom buttons recenter on the seller or buyer burg.
- **Style controls**: `TradeAnimationEditor` exposes display type, concurrency, timing and size — `displayType` (`"both"` / `"local"` / `"global"`), `concurrent`, `duration`, `landDurationModifier`, `segmentChangePause`, `markerSize`. Path stroke color / dash live in the layer style editor.
- **Sources**: [src/renderers/trade-animation.ts](../../src/renderers/trade-animation.ts), [src/renderers/draw-trade-animation.ts](../../src/renderers/draw-trade-animation.ts), [src/controllers/trade-details.ts](../../src/controllers/trade-details.ts), [src/controllers/trade-animation-editor.ts](../../src/controllers/trade-animation-editor.ts).

## Architectural intent

- Rural production shapes local market conditions before any burg produces.
- Burgs sell everything they produce and buy demand goods separately after global redistribution.
- The local resource bonus gives burgs on resource cells a free supply advantage but does not bypass the market price signal.
- Markets are the only mechanism for moving goods between rural producers, burg workshops, and other regions.

## Implementation notes

- No `Map` / `Set` / `Record` lookups in the hot path; market state is keyed by integer good id.
- A single midpoint `price` is stored per market good; `buyPrice` and `sellPrice` are derived via `MARKET_MARGIN`.
- Sources: [src/generators/markets-generator.ts](../../src/generators/markets-generator.ts), [src/generators/goods-generator.ts](../../src/generators/goods-generator.ts).
