# Trade Schema

Trade is split into two scopes:

- local trade: burg <-> assigned trade center
- global trade: trade center <-> trade center

The current production generator still owns burg-level extraction and manufacture.
The new trade generator owns trade-center state, deal logging, price helpers, and the later
global redistribution phase.

## Main concepts

### Trade centers

- Every active burg belongs to exactly one trade center.
- Burgs never trade directly with other burgs.
- Burgs never buy from or sell to a world-global inventory pool.
- Trade centers are the only bridge between local burg economies and external trade.

### Three price levels

Every good has three price concepts:

1. base price

- Source: `good.value` from `GOODS_DATA`
- Stable authored reference value

2. market price

- Current trade-center buy / sell price
- Untaxed
- Used for center inventory valuation and center-to-center trade

3. consumer price

- Price paid by a burg when buying from its own local trade center
- `consumerPrice = marketPrice * (1 + salesTaxRate)`
- Only applies to local buy deals

### Sales tax

- `SALES_TAX` is defined on the state level
- Default rate is `0.2`
- Buyer pays the tax on local burg purchases
- Seller does not pay tax
- Tax applies to local deals only
- Tax does not apply to extraction, manufacture, or global trade-center deals
- Burgs in neutral lands use `0`

## Simulation order

### Phase 1: initialize trade state

- Build trade centers
- Assign burgs to centers
- Initialize center inventories
- Initialize center market prices from base prices
- Reset the global `deals` array
- Reset the per-state tax ledger

### Phase 2: burg production

For each burg, in burg-processing order:

1. gather local resources from map cells
2. spend workers on extract or manufacture actions
3. if manufacturing needs ingredients, the burg may buy only from its own local trade center
4. local ingredient scoring must use consumer price, not untaxed market price

Result:

- the burg ends with a local inventory snapshot
- the burg treasury may increase or decrease during the phase

### Phase 3: local sale to trade center

After a burg finishes production:

1. compute burg demand targets
2. compute current demand coverage from burg inventory
3. keep goods needed to satisfy burg demand
4. sell excess goods to the assigned trade center

Excess goods are:

- goods that do not help the burg's current uncovered demand
- goods above the amount needed to cover the burg's own demand targets

Effects:

- local center inventory increases
- burg treasury receives local sell value
- one or more local `TradeDeal` records are written

### Phase 4: global trade-center redistribution

After all burgs finish local production and local selling:

1. each trade center computes center-level uncovered demand
2. center demand is the sum of uncovered demand of all assigned burgs plus reserve stock
3. reserve stock is `20%` of uncovered demand target
4. centers export excess goods and import missing goods

Effects:

- only trade center inventories change
- deals are logged as global deals
- no local sales tax applies

### Phase 5: final burg demand fill

After the global redistribution pass:

1. each burg recalculates uncovered demand
2. the burg buys needed goods from its own local trade center
3. the goal is to reduce uncovered demand as much as local availability allows

Effects:

- burg treasury decreases by consumer price
- state tax ledger increases by the tax part of the consumer price
- local center inventory decreases
- one or more local `TradeDeal` records are written

## Demand model

The trade simulation reuses the existing demand model from goods and production:

- `DEMAND_PRIORITY`
- `DEMAND_TARGET_FACTORS`
- `good.demandCoverage`

This same model should drive:

- burg keep-versus-sell decisions
- trade-center shortage calculations
- final burg demand-fill decisions

## Deal log

Every trade transaction is stored in a single `deals` array.

Each `TradeDeal` should contain enough data for:

- state tax calculation
- debugging
- overview dialogs
- future trade visualization

Minimum fields:

- `id`
- `phase`
- `scope`
- `goodId`
- `units`
- `buyerType`
- `buyerId`
- `sellerType`
- `sellerId`
- `centerId`
- `fromCenterId`
- `toCenterId`
- `stateId`
- `basePrice`
- `marketPrice`
- `consumerPrice`
- `grossValue`
- `taxRate`
- `taxAmount`
- `sellerProceeds`

## Initial data model

### Burg

Trade-related fields that may exist on a burg:

- `tradeCenterId?: number`
- `wealth?: number`

### State

Trade-related fields that may exist on a state:

- `salesTax?: number`

### Trade center

Each center should hold:

- `i`
- `name`
- `burgs`
- `inventory`
- `demandTargets`
- `demandCoverage`
- `uncoveredDemand`
- `reserveFactor`
- `buyPrice`
- `sellPrice`

## Placeholder extensions

These are intentionally out of scope for the first implementation, but the schema keeps space for them.

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
- state sales tax on local buys
- tax ledger derived from deals

Not included yet:

- transport costs
- tariffs
- route-based logistics
- UI visualization of trade flows
