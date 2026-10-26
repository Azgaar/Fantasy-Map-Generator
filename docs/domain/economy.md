# Economy

How goods, markets, production, trade and taxes work together. This is the system view: the logic, the order things happen in and the traps. The user guide is the [Economy wiki page](../wiki/Economy.md).

The economy is **one frozen cycle: a typical day**, not a simulation over time. Each run, rural cells fill regional **markets** with raw **goods**; **burgs** take turns spending their population as workers to turn market goods into more valuable ones, selling everything they make back to their market; then every burg spends its cash on what its people need. Every exchange is a **deal** between one burg and one market, priced at the burg's door: the market's price with a margin, the **carriage** along the route network, the seller state's **sales tax** and, across a border, the importer's **tariff**. States collect their taxes from the deals afterwards. Nothing else moves money, and nothing ticks: the numbers change only when the economy is regenerated.

## Elements

| Element                                           | Model                                                                                     | Persisted state                                                                       |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Goods: the catalogue and bonus resources on cells | `Goods` ([goods-generator.ts](../../src/model/economy/goods-generator.ts))                | `pack.goods`, `pack.cells.good`                                                       |
| Markets: regions, stock and prices                | `Markets` ([markets-generator.ts](../../src/model/economy/markets-generator.ts))          | `pack.markets`, `pack.cells.market`, `burg.market`                                    |
| Production and the demand fill                    | `Production` ([production-generator.ts](../../src/model/economy/production-generator.ts)) | `burg.production`, `burg.product`, `burg.treasury`, `burg.productionLog` (debug only) |
| Travel cost over routes                           | `TradeRoutes` ([trade-routes.ts](../../src/model/economy/trade-routes.ts))                | nothing: measured per run                                                             |
| The deal log                                      | `Markets.recordDeal`                                                                      | `pack.deals`                                                                          |
| Taxes and treasuries                              | `States` ([states-generator.ts](../../src/model/political/states-generator.ts))           | `state.salesTax`, `state.pollTax`, `state.tariffs`, `state.treasury`                  |
| Trade animation                                   | `TradeAnimation` ([trade-animation.ts](../../src/renderers/trade-animation.ts))           | nothing: read-only view of the deals                                                  |

## When it runs

The generation pipeline runs `Goods.generate()` early (before population ranking, which reads good values) and, near the end, `Markets.generate()` → `Production.produce()` → `States.collectTaxes()`.

The user reruns parts from Tools → Regenerate, the goods and markets editors, and the omnibar:

| Command    | Does                                                                                               |
| ---------- | -------------------------------------------------------------------------------------------------- |
| Goods      | Re-places bonus resources on cells (`Goods.regenerate`). The economy is not rerun                  |
| Markets    | Rebuilds markets and their territories (`Markets.regenerate`). The economy is not rerun            |
| Production | `Production.regenerate()`: clears deals and market stock, runs production, collects taxes          |
| Economy    | `Production.regenerateEconomy()`: re-expands the existing markets' territories, then as Production |

Loading a map does not rerun the economy, except when `auto-update.ts` migrates a save from before a change that needs it. A submap or resample reruns it for the new land (`map-restoration.ts`).

The run is deterministic: production uses no randomness, so the same goods, markets and burgs give the same deals.

## Goods

A good is classified by what it carries:

| Type         | `distribution` | `recipes` | Made by                         |
| ------------ | -------------- | --------- | ------------------------------- |
| Raw          | yes            | no        | rural cells and bonus resources |
| Manufactured | no             | yes       | burg workers only               |
| Hybrid       | yes            | yes       | both                            |

The fields that drive the economy:

- **`value`**: the base price. Market prices float around it, clamped to 0.1×–5× of it. It also feeds cell suitability for population, so **changing default good values changes generated maps**.
- **`biomeOutput`**: units per rural population point, by biome: the bulk of raw supply.
- **`chance` and `distribution`**: where bonus resources are placed (see [Goods spread functions](../wiki/Goods-spread-functions.md)). A cell holds at most one; each good is capped at about 200 cells per 5,000.
- **`recipes`**: alternative input sets, each making one unit. Written with good names in `GOODS_DATA`, resolved to ids at load.
- **`demandCoverage`**: how much one unit covers of each demand category.
- **`carriage`**: the price of carrying one unit one decima (see Carriage). The default is the good's bulk by how it is packed. Bulky cheap goods pay about their value per decima and stay home; dear goods pay a few percent and travel.
- **`multipliers`**: production factors by culture type, culture, state, religion, biome and zone, multiplied together (`getModifiers`). They apply to rural output, bonus resources and burg manufacture alike; for a burg the culture type is the burg's own type.

The catalogue (71 default goods) is map data: users add, remove and edit goods per map. A save from before a field existed gets it from the default good of the same name, otherwise a derived value: a good saved without `carriage` gets a tenth of its value.

### Demand

Five categories in priority order: 🍖 food, 🛠️ utilities, 🧱 construction, 🛡️ military, 💎 luxury. A burg's target in each is its population × a per-category factor (0.2, 0.15, 0.1, 0.08, 0.07). Demand plays two roles: it sets initial market prices, and it drives the demand fill. It does **not** steer production; burgs make whatever pays best, and market prices carry the demand signal.

## Markets

### Placement and territory

Burgs are scored by population (capital ×2.5, port ×1.2, then random noise ×0.5–2.5) and walked best first; a burg becomes a market center when no other center on its landmass is within a spacing radius that grows with each market, and none on another landmass is within half of it (`OTHER_LANDMASS_SPACING`), so most inhabited islands get a market of their own. A landmass with burgs but no port, which has no sea route to anywhere, always gets one, at its best-scored burg. Each market then floods out from its center over cells by cost: crossing into another state's land and changing landmass cost extra, water costs much more (more again outside the center's own water body). Water cells only join a market when they hold a good. Every burg belongs to the market of its cell; the center burg gets a plaza. Users can also add, relocate and remove markets and paint territories by hand; cells left with no market (id 0) supply nothing, and their burgs are skipped by production entirely. The `burg-markets` integrity rule reports every burg that does not belong to the living market of its cell when a map loads.

### Stock and price

A market holds no money, only per-good `{ stock, price }`. `price` is a midpoint: burgs buy at +5% (`MARKET_MARGIN`) and sell at −5%. Each trade moves the price linearly by 1% of the good's base value per unit (up on buying, down on selling), clamped to 0.1–5 x of the value. Stock and prices are rebuilt from scratch by every run; what is saved is the state after the last run.

## The run

`Production.produce()`:

1. **Rural supply.** Every cell delivers its output to its market's stock: population × biome output, plus its bonus resource (population × 0.25, at most 5), all × multipliers × `RURAL_OUTPUT_FACTOR` (3). A water cell counts its land neighbours' population, so fish and other sea goods have producers. Rural goods enter untaxed and cost nothing.
2. **Initial prices**, per market. Raw goods: value × (demand + 5) / (stock + 5), where demand is the market's urban population × the good's consumer demand (its share of each category's coverage) plus industrial demand (from recipes that use it). Manufactured goods: the average recipe cost at this market's prices plus the good's value added over its inputs' base values.
3. **Route measurement.** One route search from every market center prices all carriage for the run.
4. **Burg turns.** Burgs are sorted by population, largest first. Each burg with a bonus resource on its cell starts with free units of it (population × 1, clamped to 1–5, × multipliers). Then, round after round, each burg spends up to 5 workers (`WORKERS_PER_TURN`) and sells the round's output to its market, until its workers (its population, at most 1,000) are spent or nothing is worth making. Small turns let big burgs pick first without draining a market in one go; later burgs see the prices the earlier ones moved.
5. **Demand fill.** Every burg, in the same order, spends its treasury on its demand.
6. **Store.** `burg.production` (units made, bonus included), `burg.product` (sale revenue minus input costs) and, in debug mode, the step log. Sales a burg kept back in full are dropped from the deals.

### How a burg decides what to make

Each fraction of a worker, the burg plans every manufacturable good as a goal and takes the one with the best **gain per worker**: the sale price at its door × multipliers − the cost of inputs, divided by the workers the whole chain needs. Planning is recursive: an input that is neither in the burg's inventory nor buyable is planned as its own manufacture, with a cycle guard, and its workers add to the chain. Raw goods are never made by workers. The current goal is kept on ties, so a burg finishes chains instead of flickering between them.

Consequences worth knowing:

- Goods compete on gain per worker, so a good whose price barely beats its inputs loses to better options and is rarely or never made; long chains need a bigger margin because they take more workers. Default prices are tuned so most goods appear somewhere (checked by generating many maps); a good that never appears usually needs a higher value.
- Inputs are bought as needed with **no budget cap**: a burg buys on credit within a round and is paid when it sells. The treasury can dip below zero mid-run and it's fine.
- Burgs never hoard: all output is sold after every round, and a step that cannot buy every input is skipped whole.

### Sourcing an input or a demand good

1. The burg's **own market**, whenever it stocks the good, even if importing would be cheaper.
2. Otherwise **another market**: the one that delivers cheapest to the burg's door, if any can (`Markets.quoteSource`). The burg deals with that market directly; its own market's stock is untouched. It is an **import** only when that market belongs to another state (see Money and taxes). Quotes from other markets are cached per good for one burg turn, which is exact because only that burg trades during its turn.

There is no market-to-market trade: every flow between regions is a burg buying something its own market lacks.

### Demand fill

For each category in priority order, the burg quotes every good that covers it and buys the cheapest coverage first (price ÷ coverage per unit), within its treasury, until the category is met, the money runs out or the stock does. Goods the burg itself sold to its own market this run are quoted at what that sale earned it and taken back first when cheaper (`Markets.keep`): the sale and its tax shrink, the burg pays back what it earned, and a **kept** deal at price 0 records the units. So a burg covers its own needs from its own output without a round trip through the market and without paying sales tax on goods that never left. Only goods the burg produced can be kept.

## Carriage and routes

Goods pay for the path they actually travel, and it is the same path the trade animation draws.

- **The network** is `pack.cells.routes`: roads, trails and sea routes. A route search (`TradeRoutes.search`) is a Dijkstra where each cell has a land and a water state, so arriving by ship and by wagon are tracked apart. A link costs its length (from burg positions where there are burgs, otherwise cell centers); sea links cost a fifth of that (`WATER_COST` 0.2). Switching between land and water costs 4 cell spacings at a port burg, and 40 anywhere else a road meets a river route, so landings happen only where there is no other way.
- **A decima** is a tenth of the map's diagonal: a distance that scales with the map, so carriage costs feel the same on any map size. The good's editor shows it in the user's distance units.
- **Carriage per unit** = min(route cost in decimas, 10) × `good.carriage`. Ten decimas, the whole diagonal, is the cap.
- **Who pays**: every deal carries the carriage between the market's center and the burg, added to what a burg pays and taken off what it gets. A burg with no route to its own market pays the cap; another market with no route to the burg cannot sell to it at all.

The search runs once per market center per run (`TradeRoutes.measure`); the animation searches single paths on demand.

## Money and taxes

Money exists only in `burg.treasury` and `state.treasury`. Markets hold none; burgs pay every tax, inside the prices they pay or get.

**Units.** Every amount is per day: rural output, worker output (a worker point, 1,000 people at the default population scale, makes up to one unit a day), demand targets, deals and treasuries. Money is 🟡 (`formatPrice`), named the **uncia** by default (`options.map.units.money.unit`, editable in the Units editor; `getMoneyUnit` adds an "s" for the plural). 🟡 1 is a gold coin of one troy ounce (31.1 g), anchored to the Gold good: a gold bullion of 15 troy ounces is 🟡 15, so 🟡 1 ≈ a pound of silver ≈ a wain of grain. The name is words only: no value depends on it. The defaults land near a medieval day: town food demand and marketed rural surplus within 2–3× of historical figures, value added about a penny per townsperson. Taxes are the outlier: at default rates states take about half of what towns produce, far above any medieval state.

**The rule: the seller's state levies sales tax.** A market's state is its center burg's state.

| Deal                                                       | Seller     | Sales tax goes to   | Tariff goes to                     | Paid by the burg   |
| ---------------------------------------------------------- | ---------- | ------------------- | ---------------------------------- | ------------------ |
| Sale                                                       | the burg   | the burg's state    | —                                  | out of its revenue |
| Purchase from a market of the same state as its own market | the market | the market's state  | —                                  | inside its price   |
| Import: purchase from a market of another state            | the market | that market's state | the state of the burg's own market | inside its price   |
| Kept                                                       | nobody     | —                   | —                                  | nothing            |
| Poll tax                                                   | —          | the state, outright | —                                  | nobody is charged  |

Prices at the burg's door, per unit:

```
sale:     price = market price × 0.95 − carriage;           tax = price × burg's state sales tax, off the revenue
purchase: price = market price × 1.05 + tax + tariff + carriage
          tax    = market price × seller state's sales tax
          tariff = market price × importer's tariff rate      (imports only)
```

A good is taxed at every sale: once when its maker sells it to the market, again when a burg buys it. A high-tax state's markets lose buyers from other markets, since a burg picks the cheapest delivered price.

**Tariffs** (`state.tariffs`) are rules by state and good, from most to least specific: this state and this good, this state and all goods, all states and this good, all states and all goods (0 by default). They are seeded from diplomacy: allies, friends, vassals and suzerains 0%, suspicion 20%, rivals 30%, enemies an embargo. An embargo by either side rules a source out. Markets of one state never pay tariffs to each other. The tariff follows the burg's own market, not the burg: a burg whose market is centered across a border pays that state's tariffs and counts as importing only from markets outside that state.

**Rates** are seeded from the state form and jittered about ±15% per state: Monarchy 15% sales / 0.2 poll, Theocracy 25% / 0.1, Union 7% / 0.13, Republic 5% / 0.15, Anarchy nothing. Neutrals never tax.

**Collection** (`States.collectTaxes`) resets every state treasury, adds each deal's tax and tariff to the states `Markets.getTaxStates` names, then adds poll tax × the state's population. It is the only writer of state treasuries besides the user.

**Example.** States A and B tax sales at 15%; A's tariff on B is 20%. Ten units of a good priced 10 at the selling market, carried for 0.5 each:

| Trade                            | Per unit                    | Burg                  | State A | State B |
| -------------------------------- | --------------------------- | --------------------- | ------- | ------- |
| A's burg buys at its A market    | 10.5 + 1.5 + 0.5 = 12.5     | pays 125              | 15      | —       |
| A's burg imports from a B market | 10.5 + 1.5 + 2 + 0.5 = 14.5 | pays 145              | 20      | 15      |
| A's burg sells to its A market   | 9.5 − 0.5 = 9               | gets 90 − 13.5 = 76.5 | 13.5    | —       |

## The deal log

`pack.deals` is the economy's ledger and the only record of trade. One deal per burg, market, good and kind sums the run's trades (units summed, price and carriage averaged by volume, taxes summed). Its id is its array index.

| Kind     | Meaning                                           | Market                      |
| -------- | ------------------------------------------------- | --------------------------- |
| `sale`   | the burg sold its output                          | always its own              |
| `input`  | bought as a production input                      | its own, or a source market |
| `demand` | bought for its people                             | its own, or a source market |
| `kept`   | its own output taken back for its people, price 0 | its own                     |

Invariants:

- A burg's treasury change over a run equals its deals: sale revenue (price × units − tax) minus purchases (price × units). Kept deals are free because the sale was reduced instead.
- An **import** is a purchase from a market of another state (`Markets.isImport`); only an import may carry a tariff. A purchase from a different market of the same state is not an import.
- Deals are the input for state taxes, the trade animation, Trade Details, the Production Overview, market views and the goods editor's stock view. Kept deals count as covered demand but are skipped wherever goods are shown moving: the animation, Trade Details and a market's deals.
- Step-by-step trades are not stored, except in the debug-only `burg.productionLog`.

## What the user sees

- **Layers**: Goods (bonus resources and burg production plates), Markets (territories), Trade (animated deals, wagons on land and ships on sea, along the priced route).
- **Goods editor and good editor**: the catalogue, value, carriage, demand, recipes, multipliers, distribution, painting goods on cells, production chains, stock by location.
- **Markets overview and market dialogs**: stock and prices, compare prices across markets, a market's deals, relocating or removing markets.
- **Production Overview** (per burg): demand targets and what stayed uncovered, the run summarised from the deals (or the full step log in debug mode), each trade's net price, carriage, tax, tariff and income.
- **Trade Details**: opened from an animated flow; the goods one burg sells to or buys from one market, with the route highlighted.
- **States editor**: treasury, tax rates and tariff rules. **Burg editor**: the burg's treasury, which the user may overwrite.

## Gotchas

- **No time.** A treasury is one day's net cash, not savings over years. There is no spending, upkeep, interest or growth.
- **Every run starts from zero.** Production resets every burg's treasury before it runs, and tax collection resets every state's, so a treasury the user typed lasts only until the next run (keeping it would need a lock, which does not exist yet). A submap rerun restores the burgs' previous balances.
- **Order matters.** Largest burgs move first and later burgs see moved prices; changing populations reshuffles who gets the cheap inputs.
- **Local first.** A burg buys from other markets only what its own market has run out of, so a market with a trickle of stock blocks cheaper sources until it is empty.
- **Initial prices count only urban population** for demand; rural people supply but do not consume.
- **Prices stay in 0.1×–5× of the base value**, so a scarce good's price hits the ceiling instead of exploding, and a glut bottoms out at a tenth.
- **No route, no sale.** Missing roads cut markets off from the burgs of other markets, and a burg with no road to its own market pays the full ten decimas. The Routes layer explains most odd trade patterns.
- **Economy regeneration redraws territories.** `regenerateEconomy` re-floods every market's territory, discarding cells the user painted by hand; Production keeps them.
- **Edits apply on the next run.** Changing goods, taxes, tariffs, markets or burgs does not update deals or treasuries until Production or Economy is regenerated.
- **Good values shape the map.** They feed cell suitability during population ranking, so retuning default prices changes where people live on newly generated maps and can break tests pinned to seeds.

## Further reading

- [Goods spread functions](../wiki/Goods-spread-functions.md): the distribution expression language.
- [good-multipliers.md](../prd/good-multipliers.md) and [state-taxes-and-treasury.md](../prd/state-taxes-and-treasury.md): design records.
- [generation-pipeline.md](../architecture/generation-pipeline.md): where the economy sits in map generation.
