# Economy

How goods, markets, production, trade and taxes work together: the logic, the order things happen in and the traps. The user guide is the [Economy wiki page](../wiki/Economy.md); the economy's KPIs are [below](#kpis), and its design history is in the [economy rework PRD](../prd/economy-rework.md).

The economy is **one frozen cycle: a typical day**, not a simulation over time. Rural cells fill regional **markets** with raw **goods**. **Burgs** take turns putting their workers to work, selling what they make where it fetches most, and buying what their people need and want with what they earned. Rural people are paid for their produce as it sells and spend it too. Every exchange between a burg and a market is a **deal**, priced at the burg's door: the market's price with a margin, the **carriage** along the route network, the seller state's **sales tax** and, across a border, the importer's **tariff**. States collect their taxes from the deals afterwards. Nothing ticks: the numbers change only when the economy is regenerated.

## Elements

| Element                                    | Model                                                                                     | Persisted state                                                      |
| ------------------------------------------ | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Goods: the catalogue and deposits on cells | `Goods` ([goods-generator.ts](../../src/model/economy/goods-generator.ts))                | `pack.goods`, `pack.cells.good`                                      |
| Markets: regions, stock and prices         | `Markets` ([markets-generator.ts](../../src/model/economy/markets-generator.ts))          | `pack.markets`, `pack.cells.market`, `burg.market`                   |
| Production, buying and the run             | `Production` ([production-generator.ts](../../src/model/economy/production-generator.ts)) | `burg.production`, `burg.product`, `burg.treasury`                   |
| Travel cost over routes                    | `TradeRoutes` ([trade-routes.ts](../../src/model/economy/trade-routes.ts))                | nothing: measured per run                                            |
| The deal log                               | `Markets.recordDeal`                                                                      | `pack.deals`                                                         |
| Taxes and treasuries                       | `States` ([states-generator.ts](../../src/model/political/states-generator.ts))           | `state.salesTax`, `state.pollTax`, `state.tariffs`, `state.treasury` |
| Trade animation                            | `TradeAnimation` ([trade-animation.ts](../../src/renderers/trade-animation.ts))           | nothing: a read-only view of the deals                               |

## When it runs

Generation runs `Goods.generate()` early, before population ranking, which reads good values and deposits. Near the end it runs `Markets.generate()` → `Production.produce()` → `States.collectTaxes()`.

The user reruns parts from Tools → Regenerate, the goods and markets editors and the omnibar:

| Command    | Does                                                                                     |
| ---------- | ---------------------------------------------------------------------------------------- |
| Goods      | Re-places deposits (`Goods.regenerate`). The economy is not rerun                        |
| Markets    | Rebuilds markets and their territories (`Markets.regenerate`). The economy is not rerun  |
| Production | `Production.regenerate()`: clears deals and stock, runs the day, collects taxes          |
| Economy    | `Production.regenerateEconomy()`: re-floods the markets' territories, then as Production |

Loading a map does not rerun the economy, unless `auto-update.ts` migrates a save that needs it. A submap or resample reruns it for the new land (`map-restoration.ts`). The run uses no randomness: the same goods, markets and burgs give the same deals.

## Goods

| Type         | `distribution` | `recipes` | Made by                  |
| ------------ | -------------- | --------- | ------------------------ |
| Raw          | yes            | no        | rural cells and deposits |
| Manufactured | no             | yes       | burg workers             |
| Hybrid       | yes            | yes       | both                     |

The fields that drive the economy:

- **`value`**: the base price. Prices move within 0.02–5× of it. A made good is worth its inputs at base value plus 10, a worker-day's income, so making anything pays about the same at base prices. Values also feed cell suitability, so **changing default values changes generated maps**.
- **`biomeOutput`**: units per rural population point, by biome.
- **`deposits` and `distribution`**: how many deposits the map gets, a whole `[min, max]` range the same on any map size, and where they may land (see [Goods spread functions](../wiki/Goods-spread-functions.md)). Each next deposit lands beside the previous one with a 50% chance (`DEPOSIT_CLUSTERING`), so deposits form loose clusters. A cell holds at most one. `Goods.placeOutput` re-places a good's deposits until they yield a set amount, for the editor.
- **`recipes`**: alternative input sets, each making one unit. Written with good names in `GOODS_DATA`, resolved to ids at load.
- **`demandCoverage`**: how much of each need one unit covers. Defaults make a good's value buy its main need at a reference price per unit of need (food 1, utilities 2, construction 1, military 5, luxury 5). Exceptions: military equipment covers what a unit really equips (ships 4, artillery 2, arms 1, harnesses 0.5), and pure ingredients (leather, cloth, ropes, tar, barrels, sails, paper, ink, bronze) cover no need, so only the trades that use them buy them.
- **`carriage`**: the price of carrying one unit one decima. Bulky cheap goods pay about half their value per decima and stay local; dear goods (value 10 or more) pay double for guards and insurance, but still travel.
- **`multipliers`**: production factors by culture type, culture, state, religion, biome and zone, multiplied together (`getModifiers`). They apply to rural output, deposits and burg manufacture; for a burg the culture type is the burg's own.

The catalogue (71 default goods) is map data: users add, remove and edit goods per map. A save missing a newer field gets it from the default good of the same name, or a derived value.

### Needs and wants

Five categories in priority order: 🍖 food, 🛠️ utilities, 🧱 construction, 🛡️ military, 💎 luxury. A burg's **needs** are its population × a per-category factor (0.2, 0.15, 0.1, 0.08, 0.07) a day. **Wants** are what it buys beyond them out of income, from up to 85% of it (`SAVINGS_RATE` 15%), split by `WANT_SHARES`. Staples are capped at one more day of each need (`WANT_LIMITS`), since people eat only so much more; luxury grows with **affluence**, the days of needs a person earns (`getAffluence`: income so far per person ÷ a day's needs at the cheapest coverage at base prices): 4 × √affluence more days (`WEALTH_WANTS`). What the capped wants leave goes to luxury, so a rich burg spends on luxury, not on more bread. Rural people's needs come from their own fields; they buy only wants.

Buyers **spread their spending** over every good covering a need (`getVarietyShares`): a good gets a share by (price per coverage)^−variety, so cheaper coverage gets more but every good gets some. Variety follows affluence (`getVariety`): 3 (`VARIETY`) for a burg earning just its needs, 2 less for each tenfold of affluence (`PRESTIGE`), down to −1 (`MIN_VARIETY`): the poor buy the cheapest, the rich spread over all goods, and the richest favor dear ones. A good nobody stocks turns its share away and gets dearer (`signalShortage`); the rest goes to the cheapest good in stock, or for wants to the goods the buyer favors most. Demand does not steer production directly: burgs make what pays, and prices carry the signal.

## Markets

### Placement and territory

Burgs are scored by population (capital ×2.5, port ×1.2, then random noise ×0.5–2.5) and walked best first. A burg becomes a market center when no other center on its landmass is within a spacing radius that grows with each market, and none on another landmass within half of it (`OTHER_LANDMASS_SPACING`), so most inhabited islands get a market. A landmass with burgs but no port always gets one. Each market floods out from its center over cells by cost: entering another state's land or another landmass costs extra, water much more. Water cells join only when they hold a good. Every burg belongs to its cell's market, and the center burg gets a plaza. Users can add, relocate and remove markets and paint territories; cells with no market (id 0) supply nothing, and their burgs sit out the run. The `burg-markets` integrity rule reports burgs that do not belong to the living market of their cell.

### Stock and price

A market holds no money, only per-good `{ stock, price }`. `price` is a midpoint: burgs buy at +10% (`MARKET_MARGIN`) and sell at −10%. The **margin** goes to the market's center burg as each trade happens (`payMargin`): its merchants. It is trade income, kept out of `burg.product` and untaxed.

Each market expects to sell a day's demand of each good, its **depth** (`initializeMarketPrices`): its urban and rural people × what a person buys of the good a day, at least one unit. What a person buys counts consumers, spread over a need's goods as buyers spread it at base prices and doubled for wants (`WANTS_ESTIMATE`), plus what the trades making its products need, down whole production chains, split over alternative recipes (`collectDemand`).

- **Opening.** Goods covering a need open at their value: some consumer always buys them once they are cheap enough. A pure ingredient opens at value × √(expected units) where its trades need less than a unit a day (`OPENING_ELASTICITY`), so a market with no use for it does not pay full price for the first units.
- **Moving.** A trade of a day's expected sales moves the price e^2 times (`PRICE_RESPONSE`, `movePrice`): down on selling, up on buying, and up when buyers are turned away. The low floor (2%) lets an overstocked good stop paying, so its makers move on.

Stock and prices are rebuilt by every run; what is saved is the state after the last run.

## The run

`Production.produce()`:

1. **Rural supply** (`collectRuralProduction`). Every cell delivers to its market: population × biome output × multipliers × `RURAL_OUTPUT_FACTOR`, plus its deposit (`getDepositOutput`: population up to 10 × `DEPOSIT_RICHNESS` × the map's cells ÷ 5,000 × multipliers, so deposits yield more on bigger maps). A water cell counts its land neighbours' population. The market remembers which stock is rural.
2. **Opening prices and depth**, per market, as above.
3. **Routes.** One route search from every market center prices carriage for the run; each burg's carriage from every market is measured once and kept until the run ends (`endRun`).
4. **Burg turns.** Burgs go largest first. A burg on a deposit starts with free units of it (population clamped to 1–5 × multipliers). Round after round, each burg:
   - puts up to 5 workers to work (`WORKERS_PER_TURN`), out of 35% of its population (`WORKFORCE_SHARE`, at most 1,000), selling each finished good as soon as a worker makes it, so the next worker sees the moved price;
   - sells what is left where it fetches most at its door (`getOutlet`: any market it reaches, after carriage);
   - buys the share of its needs matching the work done so far (`fillDemand`);
   - spends what it can spare on wants (`spendOnWants`).

   It stops when its workers are spent or nothing is worth making. After each round, every market's rural people spend their earnings (`spendRural`). At the end, each market keeps its rural people's day (`market.rural`: earned, rent paid, spent and goods bought; `endRun`), as it is not in the deals.

5. **Rural income.** When rural stock is bought, rural people are paid the price less the margin (`takeStock`), and 40% goes to the state's capital burg as rent (`CAPITAL_RENT`). Their purchases make no deals and pay no tax.
6. **Store.** `burg.production` (units made, deposit bonus included), `burg.product` (sales less input costs) and, in debug mode, the step log in memory. Sales kept back in full are dropped from the deals.

### What a burg makes

For each fraction of a worker, the burg plans every manufacturable good as a goal and takes the best **gain per worker**: the sale value at its door (the better of its own market and its best outlet) × output per worker, less its own sales tax, minus the inputs' cost (their prices hold their taxes), divided by the workers the whole chain needs. An input it can neither find in inventory nor buy is planned as its own step, recursively, with a cycle guard; a step makes only what the chain lacks. The current goal wins ties, so burgs finish chains. A step that pays nothing after tax is not taken, so a heavy sales tax idles workers.

**Output per worker** = multipliers × (1 + the burg's share of its workers in the good, up to 1, + how far its market's share of workers in the good exceeds the world's, up to twice it) (`BURG_SPECIALIZATION`, `MARKET_SPECIALIZATION`, `getSpecialization`). Burgs settle on a trade, and a good a region makes more of than the world pays better there. The shares are counted during the run only.

Inputs are bought as needed, without a budget: a treasury can dip below zero mid-run and recover on the sale. A step that cannot buy every input is skipped whole.

### Where a burg buys

1. Its **own market**, whenever it stocks the good, even if another would be cheaper.
2. Otherwise the market that delivers cheapest to its door (`quoteSource`), counting price, margin, that market's sales tax, the tariff and carriage. Quotes are cached per good for the burg's turn, which is exact since only that burg trades in it.

A burg's own output in its own market is taken back for its people when that is cheaper than buying (`Markets.keep`): the sale and its tax shrink and a **kept** deal records the units at price 0. Markets never trade with each other: every flow between regions is a burg buying or selling.

## Carriage and routes

Goods pay for the path they travel, the one the trade animation draws.

- **The network** is `pack.cells.routes`: roads, trails and sea routes. `TradeRoutes.search` is a Dijkstra with a land and a water state per cell. A link costs its length; sea links a fifth (`WATER_COST` 0.2). Switching between land and water costs 4 cell spacings at a port burg and 40 elsewhere.
- **A decima** is a tenth of the map's diagonal, so carriage feels the same on any map size.
- **Carriage per unit** = min(route cost in decimas, 10) × `good.carriage`, × 1.5 from another state's market (`IMPORT_CARRIAGE_FACTOR`).
- **Who pays**: every deal carries the carriage between the market's center and the burg, added to what the burg pays and taken off what it gets. A burg with no route to its own market pays the cap; another market with no route to the burg cannot trade with it.

## Money and taxes

Money exists only in `burg.treasury` and `state.treasury`. Markets hold none; burgs pay every tax inside the prices they pay or get.

**Units.** Every amount is per day. A worker point (1,000 workers at the default population scale) works one recipe a day, making one unit before multipliers. Money is 🟡 (`formatPrice`), the **uncia** by default (`options.map.units.money.unit`): a gold coin of one troy ounce, anchored to Gold (a 15-ounce bullion is 🟡 15), so 🟡 1 ≈ a pound of silver ≈ a wain of grain. The name is words only.

**The seller's state levies sales tax.** A market's state is its center burg's state.

| Deal                                             | Sales tax goes to   | Tariff goes to                     | Paid by the burg   |
| ------------------------------------------------ | ------------------- | ---------------------------------- | ------------------ |
| Sale, to any market                              | the burg's state    | —                                  | out of its revenue |
| Purchase from a market of its own market's state | the market's state  | —                                  | inside its price   |
| Import: purchase from a market of another state  | that market's state | the state of the burg's own market | inside its price   |
| Kept                                             | —                   | —                                  | nothing            |
| Poll tax                                         | the state, outright | —                                  | nobody is charged  |

Per unit, at the burg's door:

```
sale:     price = market price × 0.9 − carriage;           tax = price × the burg's state sales tax, off the revenue
purchase: price = market price × 1.1 + tax + tariff + carriage
          tax    = market price × the seller state's sales tax
          tariff = market price × the importer's tariff rate   (imports only)
```

**Tariffs** (`state.tariffs`) are rules by state and good, most specific first: this state and good, this state and all goods, all states and this good, all states and all goods (0 by default). They are seeded from diplomacy: allies, friends, vassals and suzerains 0%, suspicion 20%, rivals 30%, enemies an embargo. An embargo by either side rules a source out. The tariff follows the burg's own market, not the burg.

**Rates** come from the state form, jittered per state within ¼× to 2× of the base: Monarchy 6% sales / 0.08 poll, Theocracy 10% / 0.04, Union 3% / 0.05, Republic 2% / 0.06, Anarchy nothing. Neutrals never tax. States take about an eighth of all income.

**Collection** (`States.collectTaxes`) resets every state treasury, adds each deal's tax and tariff to the states `Markets.getTaxStates` names, then poll tax × the state's population.

**Example.** States A and B tax sales at 15%; A's tariff on B is 20%. Ten units of a good priced 10 at the market, carried for 0.5 each:

| Trade                            | Per unit                | Burg                    | State A | State B |
| -------------------------------- | ----------------------- | ----------------------- | ------- | ------- |
| A's burg buys at its A market    | 11 + 1.5 + 0.5 = 13     | pays 130                | 15      | —       |
| A's burg imports from a B market | 11 + 1.5 + 2 + 0.5 = 15 | pays 150                | 20      | 15      |
| A's burg sells to an A market    | 9 − 0.5 = 8.5           | gets 85 − 12.75 = 72.25 | 12.75   | —       |

## The deal log

`pack.deals` is the only record of trade. One deal per burg, market, good and kind sums the run's trades: units and taxes summed, price and carriage averaged by volume. Its id is its array index.

| Kind     | Meaning                                        | Market                               |
| -------- | ---------------------------------------------- | ------------------------------------ |
| `sale`   | the burg sold its output                       | where it fetched most, often its own |
| `input`  | bought as a production input                   | its own, or a source market          |
| `demand` | bought for its people's needs or wants         | its own, or a source market          |
| `kept`   | its own output taken back for its people, free | its own                              |

Invariants:

- A burg's treasury change equals its deals: sales (price × units − tax) minus purchases, plus, for a market's center, the margin on every deal at its market (`Markets.getMargin`), plus, for a state capital, the rural rent.
- An **import** is a purchase from a market of another state (`Markets.isImport`); only an import may carry a tariff. A sale is never an import.
- A deal's money to its market (`Markets.getMarketIncome`) is what the burg paid less the taxes passed to the states when the market sells, and minus price × units when it buys; 0 when kept. The Markets overview sums it into Sales and Buys; Value adds the stock at its prices. It only reports.
- Rural purchases make no deals, so a market's stock falls by more than its deals explain.
- With Economy checked under Debugging in the Advanced options (`options.app.debug`), the run records each burg's steps in memory (`EconomyDebug`, never saved): candidates weighed, every trade with all the sources it could have used, and each need's shortage. The Economy Overview shows that log instead of the deal summary.

## Prosperity and state accounts

Shown, not used by the run. Both are worked out on demand from the deals, burgs and markets, and cached per set of deals.

**Consumption** is what a burg's people bought or kept for themselves (`demand` and `kept` deals). **Prosperity** (`Prosperity`, [prosperity.ts](../../src/model/economy/prosperity.ts)), from 0 to 100%, is how well a people live, from their consumption:

- **Needs met** (0–1): each need's share covered, counted by its size. It multiplies the rest, so a people short of food are never prosperous.
- **Comfort**: their consumption at base prices, in days of bare needs (a day's needs at the cheapest coverage, `getNeedsCost`). It counts both how much and how fine their goods are, and not local prices.
- **Variety**: the effective number of goods they consume (the exponent of the entropy of their consumption by value).

Prosperity = needs met × (0.2 + 0.4 × comfort score + 0.4 × variety score); the comfort score reaches 1 at 15 days of bare needs (log scale) and the variety score at 14 goods. Living on bare needs is about 20%, Poor. Ten levels of a tenth each (`PROSPERITY_LEVELS`): Desolate, Destitute, Poor, Modest, Comfortable, Thriving, Affluent, Opulent, Splendid and Peerless. On default maps the typical burg is Thriving and the richest reach Peerless, while most rural cells are Poor. Rural people's needs come from their fields: their needs met are 1 and their fields count as one good worth bare needs. A market's rural earnings and purchases (`market.rural`) go to its peopled cells by the value of their produce at base prices (`getRuralCell`), so a cell on a rich deposit lives better than its neighbours. At the end of the run each cell keeps its rural prosperity in percent (`pack.cells.prosperity`, 0 where no one lives). Prosperity is not happiness: FMG has no data on health, safety or freedom, so it measures living standards only.

**State accounts** (`StateEconomy`, [state-economy.ts](../../src/model/economy/state-economy.ts)) sum a state's economy. Its **product** has three sectors: rural (its cells' rural earnings), manufacturing (its burgs' product) and trade (the margins its market centers took). Its **economy type** is the sector whose share of its product most exceeds that sector's share of the world's: Agrarian, Artisan or Mercantile. Wealth is product per person, prosperity is its townspeople's and rural people's by their numbers (each group's needs met, comfort and variety averaged the same way, and its people counted by level), and the treasury's share of the product is its tax burden. Its trade with other states counts goods at market prices without carriage and taxes: a sale of its burg to a foreign market, or a foreign burg buying at its market, is an export; its burg buying at a foreign market is an import.

## What the user sees

- **Layers**: Goods (deposits and burg production), Markets (territories), Trade (animated deals along the priced route).
- **Goods editor and good editor**: the catalogue, values, carriage, coverage, recipes, multipliers, distribution and deposits, deposit output, painting goods on cells, production chains, stock by location.
- **Markets overview and market dialogs**: stock and prices, prices compared across markets, a market's deals, adding, relocating and removing markets.
- **Economy Overview** (per burg): production, consumption, each need's coverage and wants, prosperity with its parts, product, wealth and the treasury, which the user may overwrite; then the day summarised from the deals (or the step log in debug mode).
- **Burgs overview**: prosperity and wealth (product and treasury on demand); a click on any of them opens the burg's Economy Overview. **Burg editor**: prosperity and wealth, with a button to the Economy Overview.
- **State Economy Overview**: one dialog per state, or for the neutral lands (no ranks, no taxes), opened from any economy column of the States editor. Cards: economy type (with how far it leans on its sector against the world and the good it is known for: the largest lean of its output against the world's, among goods of at least 3% of it), population, inequality (the most equal ranks first) and trade balance; treasury, prosperity, product and wealth, each with its world rank or figure. Then the sectors; taxes and prosperity (urban and rural, each with a bar of its people by level); main exports and imports; the most valuable goods made and foreign trade with the five main partners. Goods and partners each open a full table to download as CSV.
- **Trade Details**: the goods one burg trades with one market, from an animated flow.
- **States editor**: treasury and prosperity by default, product and wealth on demand, averages of treasury and prosperity in the total line; in percent mode product is a share of the world's, wealth and prosperity a share of the world average. Tax rates and tariffs open from the State Economy Overview.

## KPIs

What the economy should achieve, scored on six default maps (seeds 431087220, 98765, 55555, 123456789, 4242, 31337), averaged, against master (v1.156.0). Re-measure after any change to the economy and update the table.

Terms, as the burg's Economy Overview shows them:

- **Product**: what a burg's trades add in a day: its sales, less their sales tax and the ingredients it bought.
- **Wealth**: a burg's product per person. A state's wealth is its burgs' product per townsperson.
- **Treasury**: the money a burg holds at the end of the day.
- **The economy's product**: all burgs' product, plus market margins and rural people's earnings.

From most to least important:

| #   | KPI                      | What it means                                                                                                                                            | How it is measured                                                                                                            | Target    | Master (v1.156.0) | Now      |
| --- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------- | ----------------- | -------- |
| 1   | All goods produced       | Every good appears on a typical map. A single map may miss some: a map with no hot climate has no spices                                                 | Share of the catalogue, raw and made, produced on a map                                                                       | ≥ 95%     | 93.4%             | 94.4% ✗  |
| 2   | Balanced volumes         | Made goods are made in proportion: the commonest are made about ten times as much as the rarest, not a hundred. A map does not make 300 ships and 5 arms | Daily units of the tenth of made goods made most ÷ those of the tenth made least, among made goods produced on the map        | 10–20×    | 26×               | 15× ✓    |
| 3   | Burgs in profit          | Burgs earn more than they spend                                                                                                                          | Share of burgs ending the day with a positive treasury                                                                        | ≥ 90%     | 96.5%             | 99.0% ✓  |
| 4   | Fast                     | Regenerating the economy feels instant                                                                                                                   | Economy run on a default map, best of five runs per map                                                                       | ≤ 200 ms  | 121 ms            | 175 ms ✓ |
| 5   | Rich and poor regions    | Some regions' towns are rich and some poor                                                                                                               | A market's wealth is the average wealth of the burgs in its area. The richest tenth of markets ÷ the poorest tenth            | ≥ 5×      | 2.9×              | 3.8× ✗   |
| 6   | Output apart from people | A region's output is not just its headcount: a market with 10% of the people may hold 30% of the output, or 5%                                           | Share of markets whose share of the world's output is more than 50% above or below their share of its people                  | ≥ 50%     | 2%                | 19% ✗    |
| 7   | Specialization           | Markets differ in what they offer: 0% would be every market making the world's average mix, 100% no two markets sharing a good                           | The share of a typical market's output, by value, that would have to change to match the world's mix                          | ≥ 60%     | 47%               | 71% ✓    |
| 8   | States' cut              | Taxes take a moderate share of what the economy makes                                                                                                    | States' taxes ÷ the economy's product                                                                                         | 10–20%    | 64%               | 13% ✓    |
| 9   | States benefit           | A state whose people are wealthier collects more per head: a developed economy pays its state                                                            | Rank correlation across states between wealth and taxes per person (1: the wealthiest states always collect most; 0: no link) | ≥ 0.5     | 0.19              | 0.14 ✗   |
| 10  | Wealth spread            | Burgs differ in wealth, some far richer per person than others, without a few owning everything                                                          | Gini coefficient of burg wealth across burgs (0: all equal; 1: one burg has it all)                                           | 0.35–0.55 | 0.28              | 0.39 ✓   |
| 11  | Treasury concentration   | Money is not hoarded by a handful of burgs                                                                                                               | Share of all burg treasuries held by the tenth of burgs with the largest ones                                                 | ≤ 50%     | 30%               | 76% ✗    |
| 12  | Employment               | Workers find something worth making; they stay idle only when nothing pays                                                                               | Share of workers who found work                                                                                               | ≥ 90%     | 100%              | 100% ✓   |
| 13  | Goods sold               | What is made finds a buyer the same day rather than piling up in a market                                                                                | Share of made goods, by value, bought the same day by burgs or rural people                                                   | ≥ 50%     | 29%               | 82% ✓    |

## Gotchas

- **No time.** A treasury is one day's net cash. There is no upkeep, interest or growth.
- **Every run starts from zero.** Burg and state treasuries are reset each run, so a typed treasury lasts until the next one. A submap rerun restores burgs' previous balances.
- **Order matters.** Largest burgs move first; later burgs see the prices they moved.
- **Local first.** A burg buys from other markets only what its own market has run out of, so a trickle of local stock blocks cheaper sources until it is gone.
- **The surplus is real.** Markets buy every unit offered, at a price that falls as stock piles up, so part of what is made stays unsold. About a fifth of made goods' value does on default maps.
- **No route, no trade.** Missing roads cut markets off; the Routes layer explains most odd trade patterns.
- **Economy regeneration redraws territories**, discarding hand-painted market cells; Production keeps them.
- **Edits apply on the next run.** Changing goods, taxes, tariffs, markets or burgs updates nothing until Production or Economy is regenerated.
- **Good values and deposits shape the map.** They feed suitability during population ranking, so retuning defaults changes where people live and can break seed-pinned tests.

## Further reading

- [Goods spread functions](../wiki/Goods-spread-functions.md): the distribution expression language.
- [economy-rework.md](../prd/economy-rework.md), [good-multipliers.md](../prd/good-multipliers.md) and [state-taxes-and-treasury.md](../prd/state-taxes-and-treasury.md): design records.
- [generation-pipeline.md](../architecture/generation-pipeline.md): where the economy sits in map generation.
