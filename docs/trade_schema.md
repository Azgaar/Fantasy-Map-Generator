# Trade Schema

Trade is centered on regional market objects. All flows of goods and money are mediated by the market layer, with no object/Map/Set structures in the hot path.

- Rural cells seed raw stock into markets (not directly to burgs).
- Burgs manufacture goods using inventory and market inputs, then sell all output to the market.
- Markets redistribute surpluses between each other after production.
- Burgs finally buy demand goods from their own market to fill needs.

## Market creation

`Trade.initialize()`:

1. Resets and creates markets, deals, and tax ledgers.
2. Places markets by scoring burgs by population, capital status, and port status.
3. Assigns every active burg to the nearest accepted market center.
4. Creates per-good market state with `stock` and `price` arrays.
5. Seeds rural production into market stock.
6. Sets initial prices from local supply and expected demand.

## Rural seeding

Rural production is assigned to markets before any burg works.

For each cell:

- `cells.good[cellId]` adds a fixed bonus (`BONUS_RESOURCE_PRODUCTION`) of raw stock for that specific resource.
- `cells.pop[cellId] * good.biome[biomeId]` adds biome-based output for every good producible in that biome.
- All stock goes to the market that owns the cell (`cells.market[cellId]`).

This makes raw goods a market-level input instead of a burg-local extraction pool.

## Local resource bonus (burg side)

Separately from market seeding, each burg whose `pack.cells.good[burg.cell]` is set receives a free pre-production stock:

    localBonus = Math.min(Math.ceil(population), BONUS_RESOURCE_PRODUCTION)

These units go directly into the burg's starting inventory, bypassing the market entirely. Additionally, that good receives a 50% discount on its `buyPrice` in the burg's market view, making recipes that use it score significantly higher.

## Initial pricing

Every market good starts from authored `good.value`, then is adjusted in two passes:

**Raw goods** — demand/supply ratio:

    ratio = (population × (consumerDemand + industrialDemand) + smoothing) / (stock + smoothing)
    price = good.value × clamp(ratio, PRICE_FLOOR_FACTOR, PRICE_CEILING_FACTOR)

**Manufactured goods** — average local ingredient cost plus value-add:

    avgLocalCost = average across recipes of (Σ ingredient.amount × market ingredient price)
    price = clamp(avgLocalCost + max(0, good.value − avgBaseCost), floor, ceiling)

Prices are clamped to `[good.value × PRICE_FLOOR_FACTOR, good.value × PRICE_CEILING_FACTOR]`.

## Production buy phase

Used when a burg buys recipe inputs during manufacturing:

- Market stock decreases.
- `burg.treasury` decreases.
- Market price rises under buy pressure.
- No sales tax is charged.

## Sale phase

Used when a burg sells its entire inventory after manufacturing:

- Market stock increases.
- `burg.treasury` receives post-tax revenue.
- Market price falls under sell pressure.

## Demand-fill buy phase

Used after redistribution when a burg buys goods to cover personal demand:

- Market stock decreases.
- `burg.treasury` decreases, capped by available wealth.
- Market price rises under buy pressure.
- Purchased goods are stored in `demandInventory` and written to `burg.inventory` for the next cycle.

## Global redistribution

`Trade.redistributeAcrossMarkets(productionData, demandInventory)`:

1. Computes uncovered demand per market from the (empty) post-production burg inventories and demand targets.
2. Builds export pools from each market's stock exceeding its local reserve (`TRADE_RESERVE_FACTOR`).
3. Transfers surplus goods from exporter markets to importer markets by demand coverage priority.
4. Records inter-market deals.
5. Adjusts prices: exporter price rises (scarcity), importer price rises (demand pressure).

No sales tax is applied to global redistribution.

## Demand model

Demand is population-driven and category-based:

- `DEMAND_PRIORITY` defines evaluation order: food → utilities → construction → military → luxury.
- `DEMAND_TARGET_FACTORS` converts burg population into target demand per category.
- `good.demandCoverage` defines how much one unit contributes to each category.

The same demand model drives:

- market redistribution priorities
- final burg demand-fill purchases
- market demand tracking via `updateMarketDemand`

## Market and Planning Data Model

Each market stores:

- `i`: market id
- `centerBurgId`: anchor burg
- `goods[goodId].stock`
- `goods[goodId].price` (single price; buy/sell are derived by adding/subtracting `MARKET_MARGIN`)

Member burgs are derived from `pack.burgs` by matching `burg.market`.
Cell-to-market assignment is stored in `pack.cells.market` as a `Uint16Array`.

### Planning Structures (used by Production and Trade)

- `goodById`: **sparse array** of all goods, indexed by `good.i`
- `productiveGoods`: **dense array** of manufacturable goods
- `recipesByOutput`: **array of arrays** of recipes, indexed by `good.i`
- `minWorkersByGood`: array of minimum workers required per good
- `path`: boolean array for cycle detection in recursive planning

## Deal log

Every transaction is recorded in `pack.deals` with:

- trade phase
- market id
- good id
- units
- buyer id
- seller id
- price per unit at time of deal

## Architectural intent

- Rural production shapes local market conditions before burg production begins.
- Burgs sell everything they produce and buy demand goods separately after redistribution.
- The local resource bonus gives burgs on resource cells a supply advantage without bypassing the market price signal.
- Markets are the only mechanism for moving goods between rural producers, burg workshops, and other regions.

## Implementation notes

- The system is fully array-based for performance; no Map/Set/object/Record in the hot path.
- All flows (resource, goods, money) are mediated by the market layer.
