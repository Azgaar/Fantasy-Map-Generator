# Trade Schema

Trade is split into two scopes:

- **local trade**: burg ↔ assigned market
- **global trade**: market ↔ market (redistribution)

The production generator owns burg-level extraction and manufacture.
The trade generator owns market state, deal logging, price mechanics, and global redistribution.

## Main concepts

### Markets

- Every active burg belongs to exactly one market (`burg.marketId`).
- Burgs never trade directly with other burgs.
- Markets are the only bridge between local burg economies and inter-regional trade.
- Market membership is derived at runtime by filtering `pack.burgs` where `burg.marketId === market.i`. There is no stored burgs list on the market.
- Market position (for rendering) is derived from `pack.burgs[market.centerBurgId].x/y`.

### Market placement

Markets are placed once during `Trade.initialize`:

1. All valid burgs are scored: `population × (×2 if capital) × (×2 if port)`, sorted descending.
2. Initial spacing: `minSpacing = floor((graphWidth + graphHeight) × 4 / burgCount^0.7)`.
3. A d3-quadtree is walked in score order. If the nearest existing market is within `minSpacing`, the burg is assigned to it. Otherwise a new market is created anchored at this burg, and `minSpacing` is incremented by 1 for the next burg.

This produces 8–15 markets per typical world, each anchored at the highest-scoring burg in its region.

### Three price levels

Every good has three price concepts at runtime:

#### 1. Base price

- Source: `good.value` (authored, fixed)
- Never modified at runtime
- Used as: initial market price, pressure magnitude reference, floor/ceiling anchor

#### 2. Market price (two sides)

Each market stores two independent prices per good:

- `market.goods[goodId].buyPrice` — price the market charges buyers (burgs buying from market)
- `market.goods[goodId].sellPrice` — price the market pays sellers (burgs selling to market)

Both start at `good.value` and are clamped to `[good.value × 0.5, good.value × 3.0]`.

The buy–sell spread emerges naturally: buy pressure pushes `buyPrice` up, sell pressure pushes `sellPrice` down.

#### 3. Consumer price

- Price actually paid by a burg when buying from its market
- `consumerPrice = marketBuyPrice`
- Local buyers do not pay sales tax; sales tax is collected from the seller on local sales

### Price pressure

Pressure magnitudes are proportional to `good.value`:

- `buyPressure[i]  = good.value × 0.002` per unit bought
- `sellPressure[i] = good.value × 0.001` per unit sold

| Event                                         | Price changed        | Direction |
| --------------------------------------------- | -------------------- | --------- |
| Burg buys ingredient from market (production) | market `buyPrice`    | ↑         |
| Burg sells excess to market                   | market `sellPrice`   | ↓         |
| Market exports stock to another market        | exporter `sellPrice` | ↑         |
| Market receives stock from another market     | importer `buyPrice`  | ↓         |
| Burg fills demand from market                 | market `buyPrice`    | ↑         |

Both prices are clamped to `[good.value × 0.5, good.value × 3.0]` after every change.

Note: in the redistribution phase, pressure is applied with a **negative** unit delta, which inverts the direction — this correctly raises the exporter's `sellPrice` (scarcity) and lowers the importer's `buyPrice` (surplus).

### Sales tax

- Defined per state as `state.salesTax`
- Default rate: `0.2`
- Applied when a burg sells to its market (`phase: "local-sale"`)
- The taxed portion is accumulated in `stateTaxes[stateId]`
- Center-to-center redistribution deals carry no tax

## Simulation order

### Phase 1: Initialize trade state (`Trade.initialize`)

1. Build markets via quadtree placement
2. Assign `burg.marketId` for all burgs
3. Initialize `market.goods[goodId]` for all goods with `{stock: 0, buyPrice: good.value, sellPrice: good.value}`
4. Reset `deals` array
5. Reset `stateTaxes` ledger

### Phase 2: Per-burg production (owned by `Production.produce`)

Burgs processed in ascending population order (smallest first, so they seed prices for larger burgs).

For each burg:

1. Flood-fill nearby cells → build `goodsPull` (raw resource availability)
2. Greedy worker loop: score and execute extract or manufacture actions each tick
3. Manufacture may buy missing ingredients from the burg's market at **current `marketBuyPrice`**; local buy has no sales-tax surcharge; `buyPrice` rises after each purchase
4. At end of loop: split inventory into **retained** (covers burg's own demand) and **excess**
5. Sell excess to market at **current `marketSellPrice`**; seller pays state sales tax from gross sale value, receives net revenue, and `sellPrice` falls after each sale

### Phase 3: Global redistribution (`Trade.redistributeAcrossMarkets`)

After all burgs have produced and sold locally:

1. Per market, sum uncovered demand across all assigned burgs (from their `finalInventory`)
2. Build export pool per market: market stock beyond its aggregated demand (+ 20% reserve)
3. For each importer market with shortage per demand category, find exporter markets with export-pool surplus, sorted by coverage weight then cheapest good
4. Transfer stock; record deal (`phase: "global"`, `buyerId = importer.i`, `sellerId = exporter.i`)
5. Apply pressure: exporter `sellPrice` rises (negative unit delta), importer `buyPrice` falls (negative unit delta)

No sales tax applies to redistribution deals.

### Phase 4: Final burg demand fill (`fillBurgDemandFromCenter`)

After redistribution:

1. Each burg re-checks demand coverage against its `finalInventory`
2. For each uncovered demand category, buy goods from its market (best coverage-weight-per-good first)
3. Uses `phase: "local-demand-buy"`
4. Burg pays **consumer price** (= market buy price); market `buyPrice` rises

## Demand model

The same model is used throughout:

- `DEMAND_PRIORITY` — ordered list of categories
- `DEMAND_TARGET_FACTORS` — per-category multiplier on population (e.g. food: 0.2)
- `good.demandCoverage` — authored per-good per-category coverage weights

Used to drive:

- burg retain-vs-sell split (Phase 2)
- market export-pool calculation (Phase 3)
- final demand-fill buying (Phase 4)

## Deal log

Every trade transaction is stored in the `deals` array on `pack`.

```ts
type Deal = {
  id: number;
  market: number; // market where the deal was brokered
  phase: TradePhase; // "local-production-buy" | "local-sale" | "global" | "local-demand-buy"
  goodId: number;
  units: number; // rounded to 2 decimal places on record
  buyerId: number; // burg id for local deals; market id for redistribution
  sellerId: number; // market id for local buys; burg id for local sales; market id for redistribution
  prices: DealPrice;
};

type DealPrice = {
  base: number; // good.value at time of deal (static reference)
  marketBuy: number; // market buyPrice used in this deal
  marketSell: number; // market sellPrice used in this deal
  consumerBuy: number; // what the buyer actually paid (currently equals marketBuy)
};
```

Tax collected per local-sale deal: `units × marketSell × sellerStateTaxRate`, accumulated in `stateTaxes[stateId]` for the seller's state.

## Data model

### Burg

Trade-related fields:

- `marketId?: number` — which market this burg belongs to
- `wealth?: number` — current burg treasury

### State

Trade-related fields:

- `salesTax?: number` — local sales tax rate (default `0.2` if absent)

### Market

```ts
type Market = {
  i: number;
  centerBurgId: number; // burg that anchors this market (used for position)
  goods: Record<
    number,
    {
      // keyed by good.i
      stock: number;
      buyPrice: number;
      sellPrice: number;
    }
  >;
};
```

Member burgs are not stored. Derived at read-time as `pack.burgs.filter(b => b.marketId === market.i)`.

### Transport cost

- local transport cost: burg <-> own center
- global transport cost: center <-> center
- likely future dependency: routes, ports, terrain, state borders

### State tariffs

- tariffs apply on foreign center-to-center deals
- separate from local state sales tax

### Alternate price formula

Potential future formula:

`marketPrice = basePrice * (totalUncoveredDemand / totalAvailableSupply)`

with clamp range:

- minimum: `0.25`
- maximum: `4`

## Scope boundaries for the first implementation

Included now:

- trade-center state
- local trade deals
- global trade deals
- state sales tax on local sales (paid by seller)
- tax ledger derived from deals

Not included yet:

- transport costs
- tariffs
- route-based logistics
- UI visualization of trade flows
