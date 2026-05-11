# Trade Schema

Trade is centered on regional markets.

- Rural cells seed raw stock into markets.
- Burgs buy manufacturing inputs from markets and sell excess output back to them.
- Markets redistribute surpluses between each other.
- Burgs finally buy remaining demand goods from their own market.

## Market creation

`Trade.initialize(goods, burgs)`:

1. Resets markets, deals, and tax ledgers.
2. Places markets by scoring burgs by population, capital status, and port status.
3. Assigns every active burg to the nearest accepted market center.
4. Creates per-good market state with `stock`, `buyPrice`, and `sellPrice`.
5. Seeds rural production into market stock.
6. Sets initial prices from local supply and expected demand.

## Rural seeding

Rural production is assigned to markets before any burg works.

For each cell:

- `cells.good[cellId]` adds the fixed bonus raw output for that specific resource.
- `cells.pop[cellId] * good.biome[biomeId]` adds biome-based output for every good that can be produced in that biome.
- The cell stock is sent to the nearest market center.

This makes raw goods a market-level input instead of a burg-local extraction pool.

## Initial pricing

Every market good starts from authored `good.value`, then is adjusted using:

- local rural stock already seeded into the market
- consumer demand implied by market population and `good.demandCoverage`
- industrial pull implied by recipes that consume the good

Both `buyPrice` and `sellPrice` remain clamped to `[good.value × 0.5, good.value × 3.0]`.

## Local trade phases

### `local-production-buy`

Used when a burg buys recipe inputs during manufacturing.

- market stock decreases
- burg wealth decreases
- market `buyPrice` rises
- no sales tax is charged to the buyer

### `local-sale`

Used when a burg sells excess goods after local production.

- market stock increases
- burg receives post-tax revenue
- seller-side state sales tax is recorded
- market `sellPrice` falls

### `local-demand-buy`

Used after redistribution when a burg buys goods to cover remaining personal demand.

- market stock decreases
- burg wealth decreases
- market `buyPrice` rises

## Global redistribution

`Trade.redistributeAcrossMarkets(goods, productionData)`:

1. Computes uncovered demand per market from the final inventories of its burgs.
2. Keeps a local reserve and treats remaining stock as exportable surplus.
3. Transfers surplus goods from exporter markets to importer markets by demand coverage priority.
4. Records `global` deals between markets.
5. Raises exporter `sellPrice` and lowers importer `buyPrice` to reflect scarcity and surplus.

No sales tax is applied to global redistribution.

## Demand model

Demand is population-driven and category-based:

- `DEMAND_PRIORITY` defines evaluation order.
- `DEMAND_TARGET_FACTORS` converts burg population into target demand per category.
- `good.demandCoverage` defines how much one unit contributes to each category.

The same demand model drives:

- local retain-vs-sell decisions
- market redistribution priorities
- final burg demand-fill purchases

## Market data model

Each market stores:

- `i`: market id
- `centerBurgId`: anchor burg
- `goods[goodId].stock`
- `goods[goodId].buyPrice`
- `goods[goodId].sellPrice`

Member burgs are derived from `pack.burgs` by matching `burg.market`.

Cell-to-market assignment is stored in `pack.cells.market` as a `Uint16Array`, where each index is `cellId` and value is `marketId`.

## Deal log

Every transaction is recorded in `pack.deals` with:

- trade phase
- market id
- good id
- units
- buyer id
- seller id
- snapshot of base, buy, sell, and consumer prices

State sales tax collected from `local-sale` deals is accumulated in `stateTaxes[stateId]`.

## Architectural intent

- Rural production should shape local market conditions before burg production begins.
- Burgs should specialize in manufacturing and local demand fulfillment.
- Markets should be the only mechanism for moving goods between rural producers, burg workshops, and other regions.
