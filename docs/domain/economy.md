# Economy

How goods, markets, production, trade and taxes work together. The user guide is the [Economy wiki page](../wiki/Economy.md).

The FMG economy is **one frozen cycle: a typical day**, not a simulation over time. Rural cells fill regional **markets** with raw **goods**. **Burgs** take turns putting their workers to work, selling what they make where it fetches most, and buying what their people need and want with what they earned. Rural people are paid for their produce as it sells and spend it too. Every exchange between a burg and a market is a **deal**, priced at the burg's door: the market's price with a margin, the **carriage** along the route network, the seller state's **sales tax** and, across a border, the importer's **tariff**. States collect taxes as deals happen and spend their **budget** on **state orders** the same day. The numbers change only when the economy is regenerated, and the run uses no randomness.

## Elements

| Element                                                                        | Model                                                                                                                                                          | Persisted state                                                                          |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Goods: the catalogue and deposits on cells                                     | `Goods` ([goods-generator.ts](../../src/model/economy/goods-generator.ts))                                                                                     | `options.map.goods`, `pack.cells.good`                                                   |
| What people need and how they spend                                            | [demand.ts](../../src/model/economy/demand.ts)                                                                                                                 | nothing: constants                                                                       |
| Rural output, deposits and multipliers                                         | `Output` ([output.ts](../../src/model/economy/output.ts))                                                                                                      | nothing: read from the map and good rules                                                |
| Development: each cell's technology, read by the run                           | `Development` ([development-generator.ts](../../src/model/society/development-generator.ts))                                                                   | `pack.cells.development`                                                                 |
| Route network, which carriage travels                                          | `Routes` ([routes-generator.ts](../../src/model/economy/routes-generator.ts))                                                                                  | `pack.routes`, `pack.cells.routes`                                                       |
| Markets: regions, centers and margin rates                                     | `Markets` ([markets-generator.ts](../../src/model/economy/markets-generator.ts))                                                                               | `pack.markets`, `pack.cells.market`, `burg.plaza`                                        |
| The run: workers, what burgs make and buy                                      | `Production` ([production-generator.ts](../../src/model/economy/production-generator.ts))                                                                      | `burg.production`, `burg.product`, `burg.pollTaxPaid`, `burg.treasury`, `market.feePaid` |
| Trading: prices, stock, quotes, carriage, rural spending, writing the deal log | `Trade` ([trade.ts](../../src/model/economy/trade.ts))                                                                                                         | `market.goods`, `market.rural`, `pack.deals`                                             |
| Reading the deal log: margins and values                                       | `Deals` ([deals.ts](../../src/model/economy/deals.ts))                                                                                                         | nothing: reads `pack.deals`                                                              |
| Travel cost over routes                                                        | `TradeRoutes` ([trade-routes.ts](../../src/model/economy/trade-routes.ts))                                                                                     | nothing: measured per run                                                                |
| State orders: spending the budget during the run, and what it provided         | `StateOrders` ([state-orders.ts](../../src/model/economy/state-orders.ts))                                                                                     | `state.economy.spent`, `order` deals                                                     |
| Taxes: rates, tariff rules, each deal's taxes, collection                      | `Taxes` ([taxes.ts](../../src/model/economy/taxes.ts))                                                                                                         | `state.economy.collected`, `.pocketed`, `.treasury`                                      |
| Forms, budgets, adjustments and tariffs set                                    | `States` ([states-generator.ts](../../src/model/political/states-generator.ts))                                                                                | `state.economy`, `state.alert`, `burg.adjustments`                                       |
| Corruption by province                                                         | `Corruption` ([corruption.ts](../../src/model/economy/corruption.ts))                                                                                          | nothing: derived from cells and provinces                                                |
| Prosperity: how well people live                                               | `Prosperity` ([prosperity.ts](../../src/model/economy/prosperity.ts))                                                                                          | `pack.cells.prosperity`, the rest on demand                                              |
| State, province and world accounts                                             | `Accounts` ([accounts.ts](../../src/model/economy/accounts.ts))                                                                                                | nothing: summed on demand                                                                |
| Stability                                                                      | `Stability` ([stability.ts](../../src/model/political/stability.ts))                                                                                           | nothing: worked out on demand                                                            |
| Army upkeep and equipment                                                      | `Military` ([military-generator.ts](../../src/model/political/military-generator.ts))                                                                          | nothing: worked out on demand                                                            |
| Trade animation and traffic                                                    | `TradeAnimation` ([trade-animation.ts](../../src/renderers/trade-animation.ts)), `TradeTraffic` ([trade-traffic.ts](../../src/model/economy/trade-traffic.ts)) | nothing: read-only views of the deals                                                    |
| The run's debug log                                                            | `EconomyDebug` ([economy-debug.ts](../../src/model/economy/economy-debug.ts))                                                                                  | nothing: in memory, in debug mode only                                                   |

From `Prosperity` down, modules only read the last run: the run never reads them. Their sums go stale when burgs or cells change hands, so what moves them calls `Pack.markChanged()`. Shared shapes live in [types/economy.ts](../../src/types/economy.ts). All of these are on `window.FMG` and in the Assistant's scripts. The dialogs live in [controllers/economy](../../src/controllers/economy) (goods, markets, trade, routes, and the burg, state and province overviews), sharing cells and terms from [economy-view.ts](../../src/ui/economy-view.ts). [scripts/economy-tuner](../../scripts/economy-tuner) tunes the catalogue and constants ([below](#tuning)).

## When it runs

Generation runs `Goods.generate()` early, before population ranking, which reads good values and deposits. Near the end it runs `Markets.generate()` → `Production.produce()` → `Taxes.collect()`.

**The run changes only when the user asks for it.** One dialog, `openEconomyRegeneration(preset)`, ticks what to run, always in this order. Tools has one Economy button for it; each button only opens it with its own ticks:

| Part          | Does                                                                                                         | Tools Economy | Goods Editor | Markets Overview |
| ------------- | ------------------------------------------------------------------------------------------------------------ | ------------- | ------------ | ---------------- |
| Restore goods | `Goods.restoreDefaults`, placing all deposits                                                                |               |              |                  |
| Deposits      | `Goods.regenerate`                                                                                           |               | ✓            |                  |
| Markets       | `Markets.regenerate`, drawing their areas                                                                    |               |              | ✓                |
| Market areas  | `Markets.expand`, discarding hand-painted cells                                                              |               |              |                  |
| Production    | `Production.regenerate`: gives new water deposits a market, clears deals and stock, runs the day, pays taxes | ✓             | ✓            | ✓                |

**Burgs** and **States** stay out of it, behind the plain confirmation: Burgs runs burgs, then Markets, then Production; States runs states, then Production, then the military, equipped from the new run.

- **It always asks**, with no "Do not ask again": choosing is the point of it.
- **Without Production**, new deposits or areas leave the run as it was; new markets or restored goods call `Production.clear()`, as the run named what is gone.
- **Water deposits** join a market when production runs (`Markets.claimWaterDeposits`), as the flood skips water without goods. It keeps the land, so hand-painted cells survive.
- **Removing** a good, a burg or a market prunes what names it from the run and reruns nothing, so the rest stays until the next run. A burg left without a market pays its tariffs to its own state until then; painting markets or states moves the taxes of the deals with them. The military roster outlives the map, so it keeps a removed good's id and units ignore it while the map lacks that good.
- **Painting deposits** by hand only changes the cells.
- **Apply** in the good editor and the State budget dialog sets the changes, then opens the same dialog with Production ticked; cancelling leaves them for the next run. The good editor re-places a good whose distribution or deposit count changed either way.
- **Locks** protect a state or burg, not its numbers: its production, prices and treasury are recomputed. A locked state keeps its taxes, license fee, budget, adjustments and tariffs, with rules on dropped states gone, and a locked burg its adjustments. Diplomacy is rebuilt for every state, so a locked state's tariffs may no longer match its relations.

Loading a map does not rerun the economy, and a map saved before v1.157.0 counts its armies as fully kept until its next run (`migrateEconomyRun`). A submap or resample reruns it for the new land (`map-restoration.ts`): those burgs and markets are gone, and the user asked for a new map.

## Development

Each land cell has a technological **development** (`pack.cells.development`, see [Development](development.md)). A good's **tier** (`good.development`) is the least development a cell needs to produce it; past 30 output grows with development ÷ 30; and burgs take their turns by √population × development.

## Goods

| Type         | `distribution` | `recipes` | Made by                  |
| ------------ | -------------- | --------- | ------------------------ |
| Raw          | yes            | no        | rural cells and deposits |
| Manufactured | no             | yes       | burg workers             |
| Hybrid       | yes            | yes       | both                     |

The catalogue (`GOODS_DATA`, [data/goods.ts](../../src/data/goods.ts)) is map data: users add, remove and edit goods. The `.map` and the browser keep them, and the next map starts from them (see [configuration](../architecture/configuration.md#the-definition-sets)). The fields that drive the economy:

- **`value`**: the base price. Prices move within 0.02–5× of it. Values feed cell suitability, so **changing default values changes generated maps**.
- **`biomeOutput`**: units per rural population point, by biome.
- **`deposits` and `distribution`**: how many deposits the map gets, a `[min, max]` range whatever the map size, and where they may land (see [Goods spread functions](../wiki/Goods-spread-functions.md)). Deposits form loose clusters (`DEPOSIT_CLUSTERING`); a cell holds at most one.
- **`recipes`**: alternative input sets, each making one unit.
- **`demandCoverage`**: how much of each need one unit covers, kept low enough that price, not coverage, decides what people buy. The cheapest coverage of each need must stay well below what townspeople earn. Pure ingredients cover no need, so only the trades that use them buy them.
- **`carriage`**: the price of carrying one unit one decima. Bulky cheap goods stay local; dear goods pay more for guards and insurance, but still travel.
- **`multipliers`**: production factors by culture type, culture, state, religion, biome and zone, multiplied together (`getModifiers`), on rural output, deposits and manufacture. For a burg the culture type is its own, so ways of life favor some trades and lack others.

### Needs and wants

Five categories in priority order: 🍖 food, 🛠️ utilities, 🧱 construction, 🛡️ military, 💎 luxury. A burg's **needs** are its population × a per-category factor (`DEMAND_TARGET_FACTORS`) a day. **Wants** are what it buys beyond them from what its income leaves after savings (`SAVINGS_RATE`), split by `WANT_SHARES`. Staples are capped by `WANT_LIMITS`; luxury grows with **affluence**, the days of needs a person earns (`getAffluence`, `WEALTH_WANTS`), so a rich burg spends on luxury, not on more bread. Rural people's needs come from their own fields; they buy only wants.

Buyers **spread their spending** over every good covering a need, cheaper coverage getting more (`getVarietyShares`, `VARIETY`). A purchase has a minimum size (`MIN_PURCHASE`, `getLotShares`), so a village buys a few goods and a city many. Affluence adds a bonus for goods a burg has had none of (`getShares`, `NOVELTY`). A burg earning less than the needs due so far buys its needs cheapest first. A good nobody stocks turns its share away and gets dearer (`signalShortage`). Demand does not steer production directly: burgs make what pays, and prices carry the signal.

## Markets

### Placement and territory

Burgs are scored by population (capitals, ports and crossroads score more, dear licenses less, then random noise) and walked best first. A burg becomes a market center when no other center on its landmass is within its **spacing** (`getSpacing`), and none on another landmass within half of it, so most inhabited islands get a market. Busy land and cheap licenses pack markets closer; steppes, deserts and greedy states spread them out (`MARKET_FEE_DETERRENCE`, `DENSITY_PULL`).

Each market floods out from its center by cost: another state's land or another landmass costs extra, crossing into an enemy's land much more, water much more, and water cells join only when they hold a good. Each market then moves to the best-scored burg it serves and floods again (`recenter`). Every burg belongs to its cell's market (`Markets.ofBurg`). Users can add, relocate and remove markets and paint territories. Cells with no market (id 0) supply nothing, and their burgs sit out the run.

### Stock and price

A market holds no money, only per-good `{ stock, price }`, rebuilt by every run. `price` is a midpoint: burgs buy above it and sell below it by the market's margin rate (`Markets.getMarginRate`), `MARKET_MARGIN` × √(fee factor) of the license its center paid, rounded to a whole percent, at most `MAX_MARKET_MARGIN`: 4% with no license, usually 5% in a monarchy. So a greedy state's markets are dearer and slower. The **margin** goes to the market's center burg as each trade happens (`payMargin`), kept out of `burg.product` and untaxed.

Each market expects to sell a day's demand of each good, its **depth** (`initializeMarketPrices`, `collectDemand`): its people × what a person buys of the good, with `WANTS_ESTIMATE` for wants, plus what the trades making its products need, down whole production chains.

- **List price.** Goods covering a need list at their value. A pure ingredient lists lower where its trades need less than a unit a day (`OPENING_ELASTICITY`).
- **Price** is a pure function of the day's demand and supply there: list price × ((depth + demand) ÷ (depth + supply))^`PRICE_CURVE` (`getBalancePrice`). Supply is rural produce plus what burgs sell there, less what they take back; demand is what is bought there and the buyers turned away. A trade settles at the average price over the change it makes (`getLotPrice`), so a big lot pays its own impact. Prices stay unrounded during the run.
- **Imports.** A purchase from another market is also demand in the markets nearer the buyer that could not meet it (`addNearerDemand`), so a market short of a good reads as short and its makers see the need.

## The run

`Production.produce()`:

1. **Rural supply** (`collectRuralProduction`). Every cell delivers to its market: population × biome output × multipliers × `RURAL_OUTPUT_FACTOR`, plus its deposit (`Output.getDeposit`: population up to `DEPOSIT_MAX_POPULATION` × `DEPOSIT_RICHNESS` × the map's cells ÷ `DEPOSIT_MAP_CELLS` × multipliers). A water cell counts its land neighbours' population.
2. **Opening prices and depth**, as above.
3. **Routes.** One route search from every market center prices carriage for the run.
4. **Burg turns.** Burgs go by √population × development, the most first (`getTurnOrder`). Round after round, each burg:
   - puts up to `WORKERS_PER_TURN` workers to work, out of `WORKFORCE_SHARE` of its population, selling each finished good at once, so the next worker sees the moved price;
   - sells what is left where it fetches most at its door (`getOutlet`, `Trade.sell`), keeping the inputs of a chain under way. What no market wants by the day's end stays unsold;
   - buys the share of its needs matching the work done so far (`fillDemand`);
   - spends what it can spare on wants (`spendOnWants`).

   After each round, rural people spend their earnings (`spendRural`) and states place their orders (`StateOrders.place`). The run ends after a round in which no burg works. Then a burg whose money grew after its last turn, as a market center's, spends it; rural people pay their poll tax; and states spend the rest of their budgets.

5. **Store.** `burg.production`, `burg.product` (sales less input costs) and each market's rural day (`market.rural`, `endRun`). Sales kept back in full are dropped from the deals.

When rural stock is bought, rural people are paid the price less the margin (`takeStock`). Their purchases make no deals and pay no tax.

A burg on a deposit gets nothing free: **working the deposit** is one more thing its workers can make, with no inputs (`getRecipes`), chosen by what it pays. A worker gets `DEPOSIT_OUTPUT` units a day from it, up to `MAX_DEPOSIT_VALUE` a day at base value, so a large burg cannot grind a gemstone mine. While the deposit lasts it replaces the good's recipes; once capped, they apply again at the usual output. A recipe taking the deposit's good is planned both with the good bought and with it worked (`getRecipeStocks`).

### What a burg makes

For each fraction of a worker, the burg plans the goods it can make and takes the best **gain per worker**: the sale value at its door × output per worker, less its sales tax and the inputs' cost, divided by the workers the whole chain needs. Both sides are priced as **lots** (`Trade.atLot`), so a step does not sell at a loss by moving a thin market. A **step** takes the workers that sell part of a day's sales there (`LOT_DEPTH_SHARE`, `MIN_STEP`, `getStep`). Goals are planned best paying first (`rankGoals`), and the burg keeps on its goal while it still beats the last alternative (`continueGoal`). An input it can neither find nor buy is planned as its own step, recursively. A step that pays nothing after tax is not taken, so a heavy sales tax idles workers.

**Output per worker** = multipliers × (1 + `BURG_SPECIALIZATION` × the burg's share of its workers in the good + `MARKET_SPECIALIZATION` × how far its market's share exceeds the world's) (`getSpecialization`). Burgs settle on a trade, and a good a region makes more of pays better there.

Inputs are bought without a budget: a treasury can dip below zero mid-run and recover on the sale. A step that cannot buy every input makes nothing, and what it bought waits in the inventory.

### Where a burg buys

1. Its **own market**, while it stocks at least `MIN_LOCAL_STOCK`, even if another would be cheaper.
2. Otherwise the market that delivers cheapest to its door (`quoteSource`), counting price, margin, sales tax, tariff and carriage. Quotes are cached per good for the burg's turn and dropped when it trades the good.
3. With no other market stocking it, what its own market has left.

A burg's own output in its own market is taken back for its people when that is cheaper than buying (`Trade.keep`): the sale and its tax shrink and a **kept** deal records the units at price 0. Markets never trade with each other.

## Carriage and routes

- **The network** is `pack.cells.routes`. `TradeRoutes.search` is a Dijkstra with a land and a water state per cell; sea links are cheap (`WATER_COST`), and switching between land and water costs more away from a port.
- **A decima** is a tenth of the map's diagonal, so carriage feels the same on any map size.
- **Carriage per unit** = min(route cost in decimas, 10) × `good.carriage`, × `IMPORT_CARRIAGE_FACTOR` from another state's market.
- **Who pays**: every deal carries the carriage between the market's center and the burg. A burg with no route to its own market pays the cap; another market with no route to the burg cannot trade with it.
- **Traffic**: the Goods layer's Traffic group adds each deal's units to every link of the cheapest path. Summed only when drawn, never saved and never read by the model.

## Money and taxes

Money exists only in `burg.treasury` and `state.economy.treasury`. Every amount is per day. A worker point works one recipe a day, making one unit before multipliers. Money is 🟡 (`formatPrice`), the **uncia** by default (`options.map.units.money.unit`); the name is words only. A market's state is its center burg's state.

| Deal                                             | Sales tax goes to   | Tariff goes to                     | Paid by the burg   |
| ------------------------------------------------ | ------------------- | ---------------------------------- | ------------------ |
| Sale to a market of its own market's state       | the burg's state    | —                                  | out of its revenue |
| Import: sale to a market of another state        | the burg's state    | that market's state                | out of its revenue |
| Purchase from a market of its own market's state | the market's state  | —                                  | inside its price   |
| Import: purchase from a market of another state  | that market's state | the state of the burg's own market | inside its price   |
| Kept                                             | —                   | —                                  | nothing            |
| Poll tax                                         | the burg's state    | —                                  | first, from sales  |
| Market license, a market's center only           | the burg's state    | —                                  | from the margin    |

Per unit, at the burg's door:

```
sale:     price = market price × (1 − margin rate) − carriage;          tax = price × the burg's state sales tax, off the revenue
          tariff = market price × the importer's tariff rate, off the revenue   (imports only)
purchase: price = market price × (1 + margin rate) + tax + tariff + carriage
          tax    = market price × the seller state's sales tax
          tariff = market price × the importer's tariff rate   (imports only)
```

**Rates** come from the state form (`DEFAULT_TAX_BY_FORM`), jittered per state. The license fee follows the state's sales tax roll (`States.defineMarketFee`), so the rest of generation keeps its random sequence. Neutrals never tax.

**Tariffs** (`state.economy.tariffs`) are rules by state and good: any matching embargo applies, else the most specific tariff, seeded from diplomacy: a default on all states, none for allies, friends, vassals and suzerains, more for suspicion and rivals, an embargo for enemies. The importer is the state of the market the goods go to: the deal's market on a sale, the burg's own on a purchase. An embargo by either side rules that market out. Neutral lands levy nothing, and no rule reaches them.

**Adjustments** (`burg.adjustments`, `state.economy.adjustments`) are named lines the user sets, income or costs a day besides trade. They come at dawn, count in income and are kept on regeneration.

**Poll tax** is the day's first claim (`Taxes.getPollTaxDue`). A burg starts the day owing it and pays it from its first sales, always in full, so one whose sales fall short ends in debt. Rural people keep it back from their wants and pay what they can (`Trade.settleRuralPollTax`, `market.rural.pollTax`), so a state may collect less than it is owed (`Taxes.getPollTax`).

**Market license** is a fixed fee a day (`state.economy.marketFee`) a market's center owes its state whatever the trade (`market.feePaid`). It is paid from the margin as it comes in (`Trade.payMarginAmount`), and what the margin has not covered by the day's end then (`Trade.settleLicenses`), so a quiet market in a greedy state ends in debt.

**Corruption** (`state.economy.budget.corruption`) is the share of each expense officials would pocket; it leaves the economy. It is set with the forms (`States.defineCorruption`) from the form, the state's size and its diversity, with no random roll.

**Administration curbs corruption** (`Corruption.curb`): officials pocket up to `ADMINISTRATION_CURB` less, in proportion to what administration is paid of what the state's people need (`ADMINISTRATION_NEED`).

**Corruption by province** (`Corruption`). A province's corruption rises with its capital's remoteness and its minorities above the state's average (`Corruption.getTendency`), and administration curbs each with its own. A state's cells outside any province count as one more, governed from the capital. The state's rate is its provinces' by where each expense is spent (`Corruption.ofState`).

**Budget** (`state.economy.budget`) is four expenses, each in whole percents of the taxes collected (`States.setBudget`), set with the forms (`States.defineExpenses`). They need not sum to 100: below it the state saves, above it its treasury goes negative. The **war alert** (`state.alert`, `States.defineAlert`) drives the military share and military generation.

| Expense          | Buys              | Where                                    | Effect ([below](#what-state-spending-does)) |
| ---------------- | ----------------- | ---------------------------------------- | ------------------------------------------- |
| Court and clergy | luxury            | the capital                              | stability                                   |
| Administration   | utilities         | the provinces' capitals, by their people | curbs corruption                            |
| Infrastructure   | construction      | the provinces' capitals, by their people | a share of prosperity                       |
| Military         | military and food | the capital                              | the forces' upkeep                          |

**State orders** (`StateOrders`) spend the budget during the run, so state demand pulls production. Court and military buy at the capital, administration and infrastructure at each province's capital, or at the state's where the province's has no market. After each round, each buyer spends its share of what the state has collected so far (`Trade.getTaxesSoFar`), less what officials pocket, once it has gathered `MIN_ORDER`. It buys like a burg, spreading money over goods as rural people do, and the deal is the state's (kind `order`): it pays margin and carriage, but no tax to itself. The day's last orders spend the rest of each expense. What each expense spent is kept in `state.economy.spent`.

**Collection** (`Taxes.collect`) adds up each deal's tax and tariff (`Taxes.getTaxStates`), the poll tax paid and the license fees, plus the adjustments (`state.economy.collected`). Officials pocket their share (`state.economy.pocketed`), and the treasury is collected − pocketed − spent.

## The deal log

`pack.deals` is the only record of trade. One deal per burg, market, good and kind sums the run's trades, so units × price gives back what was paid.

| Kind     | Meaning                                                  | Market                                    |
| -------- | -------------------------------------------------------- | ----------------------------------------- |
| `sale`   | the burg sold its output                                 | where it fetched most, often its own      |
| `input`  | bought as a production input                             | its own, or a source market               |
| `demand` | bought for its people's needs or wants                   | its own, or a source market               |
| `kept`   | its own output taken back for its people, free           | its own                                   |
| `order`  | a state's purchase for an expense, delivered to the burg | the burg's own market, or a source market |

- A burg's treasury change equals its adjustments and its deals, `order` deals aside, within a cent or two: sales minus purchases, plus, for a market's center, the margin on every deal at its market (`Deals.getMargin`) and on its rural people's trade (`market.rural.margin`).
- An **import** is trade between the burg's own market and a market of another state, either way (`Taxes.isImport`). Trade with the neutral lands never is.
- A deal's money to its market (`Deals.getMarketIncome`) only reports: the Markets overview sums it into Sales and Buys.
- Rural purchases make no deals, so a market's stock falls by more than its deals explain.
- With Economy checked under Debugging (`options.app.debug`), the run records each burg's steps in memory (`EconomyDebug`, never saved), and the Economy Overview shows that log.

## Prosperity and state accounts

Shown, not used by the run, and worked out on demand from the last run.

**Prosperity** (`Prosperity`, [prosperity.ts](../../src/model/economy/prosperity.ts)) is how well a people live, from their consumption (`demand` and `kept` deals):

- **Needs met** (0–1): each need's share covered. It multiplies the rest, so a people short of food are never prosperous.
- **Comfort**: their consumption at base prices, in days of bare needs (`getNeedsCost`).
- **Variety**: the effective number of goods they consume.

Living = needs met × (`NEEDS_SHARE` + `COMFORT_SHARE` × comfort score + `VARIETY_SHARE` × variety score), and prosperity is living with `INFRASTRUCTURE_SHARE` from the infrastructure serving them, named by ten levels (`PROSPERITY_LEVELS`). Rural people's needs come from their fields, and they are measured against village wants (`RURAL_COMFORT_TOP`, `RURAL_VARIETY_TOP`). A market's rural earnings and purchases go to its cells by the value of their produce (`getRuralCell`), and unsold produce meeting a need stays with the cells that grew it. Each cell keeps its rural prosperity (`pack.cells.prosperity`). It measures living standards only, not happiness.

**State accounts** (`Accounts.ofState`, [accounts.ts](../../src/model/economy/accounts.ts)) sum a state's economy. Its **product** has three sectors: rural (rural earnings), manufacturing (its burgs' product) and trade (its centers' margins). Its **economy type** is the sector whose share most exceeds the world's: Agrarian, Artisan or Mercantile. The good it is **known for** has the largest share² of its exports ÷ its share of the world's. Wealth is product per person, and tax burden is its taxes (adjustments aside) over its product. Exports and imports count goods at market prices, without carriage, taxes and the margin: a sale of its burg to a foreign market, or a foreign burg buying at its market, is an export.

**Province accounts** (`Accounts.ofProvince`) sum a province the same way. Taxes count where the state's own taxpayer is or, for a foreigner, at the market where they were paid. A state's provinces and its lands outside any province sum to its accounts, adjustments aside.

## What state spending does

Each expense works after the run, measured by what was spent against the need of a state of that size. All are worked out on demand.

- **Military → upkeep** (`Military.getUpkeep`): spending against its forces' power (`UPKEEP_COST`). Regiments hold population points; `Military.getTroops` shows them as troops at the map's population rate, rounded up, so changing that rate moves no economy or army figure. It scales regiments' power in battle (`Military.getBattleUpkeep`) and the Military overview's power. Army size follows the war alert, and the budget only its root, so warlike states overstretch. It is 1 before the economy has run, and for an anarchy.
- **Goods → equipment** (`Military.getEquipped`): a unit lists the goods that equip it (`unit.goods`). A state's stock of a good, in population points of troops, is its consumption (`Accounts.getConsumption`) × `EQUIPMENT` × the good's military coverage, split between the units needing it. Conscripts beyond it serve as levies, so the army's size stays and its strength falls. What the state has counts, not what it makes.
- **Infrastructure → prosperity**: provision against `PROVISION_NEED`. Each province gets the state's spending by its people, less what its officials pocket (`StateOrders.getInfrastructure`), so far and foreign provinces are served worse.
- **Administration → corruption**: see [Money and taxes](#money-and-taxes).
- **Court and clergy → stability**: provision against a need per person.

**Stability** ([stability.ts](../../src/model/political/stability.ts), 0–1) is how firmly a province holds together, the sum of its parts, clamped; a state's cells outside any province count as one more. A state's is theirs by their people. It is null for the neutral lands and before the economy has run.

| Part             | Adds                                       |
| ---------------- | ------------------------------------------ |
| Base             | 0.5                                        |
| Prosperity       | up to 0.5, reached at 50% prosperity       |
| Court and clergy | up to 0.25, by its provision               |
| Army             | ±0.15 × the army's size × (2 × upkeep − 1) |
| Remoteness       | −0.15 × its remoteness                     |
| Minorities       | −0.2 × its diversity                       |
| Corruption       | −0.2 at 40% curbed corruption or more      |
| Tax burden       | −0.15 at taxes of half the product or more |

Rebel zones rise in a state and province by the square of their instability, as a tax revolt where the tax burden is the largest loss. Battle morale follows each side's stability.

**Story.** Zones and markers are generated after the economy and read its last run. Invasions favour prosperous borders, disease the busiest burgs and ports, and famine land of low rural prosperity. Among markers, brigands, inns and pirates favour busy markets, fairs burgs trading many goods, customs houses roads between states trading under tariffs, merchant houses the richest market centers, bridges the busiest burgs, and mines the most valuable deposits. A guild hall marks a burg famed for a made good (`indexGuilds`): world share × √makers × √state share at least 0.75, the good worth 15 a day and a quarter of what the burg makes.

## KPIs

What the economy should achieve, scored on ten maps with default options, averaged (seeds and templates in `scripts/economy-tuner/export-maps.mjs`). Re-measure after any change to the economy and update the table. The **tuner fee** is what each unit of miss costs in the tuner's objective (`objective.mjs`).

- **Product**: what a burg's trades add in a day: its sales, less their sales tax and the ingredients it bought.
- **Wealth**: a burg's product per person. A state's wealth is its product per person, urban and rural together.
- **Treasury**: the money a burg holds at the end of the day.
- **The economy's product**: all burgs' product, plus market margins and rural people's earnings.

| #   | KPI                      | What it means                                                                                                                  | How it is measured                                                                                                               | Target   | Tuner fee                                          | Master (v1.156.0) | Now      |
| --- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------- | ----------------- | -------- |
| 1   | Made goods in proportion | Each made good is made about as much as its commonness says: beer and cloth by the cartload, jewelry and boats by the piece    | Share of made goods whose share of made units is within ½–2× of its commonness target ([reference](#goods-reference))            | ≥ 80%    | 0.10 per 1%, plus how far goods are off            | 50%               | 72.5% ✗  |
| 2   | Raw goods in proportion  | Each raw good is gathered about as much as its commonness says: grain and wood by the wain, pearls and gold by the handful     | Share of raw goods whose share of raw units is within ½–2× of its commonness target ([reference](#goods-reference))              | ≥ 60%    | 0.02 per 1%, plus how far goods are off            | 39%               | 58% ✗    |
| 3   | Prices make sense        | A good costs what a reader expects: grain and wood cheap, tools dear, jewelry and boats the dearest                            | Typical deviation of goods' values from their reference values: the geometric mean of each ratio ([reference](#goods-reference)) | 0%       | 0.1 per doubling a value lies from its reference   | 0%                | 0% ✓     |
| 4   | Coverage makes sense     | A good meets the needs a reader expects, as much as expected: grain feeds, wood builds and warms, incense is a luxury          | Typical deviation of `demandCoverage` entries from their reference ([reference](#goods-reference))                               | 0%       | 0.05 per doubling an entry lies from its reference | 0%                | 0% ✓     |
| 5   | All goods produced       | Most goods appear on a typical map. A map misses some: one with no hot climate has no spices, a backward one no artillery      | Share of the catalogue, raw and made, produced on a map                                                                          | ≥ 90%    | 0.10 per 1%                                        | 93.4%             | 93.9% ✓  |
| 6   | Burgs in profit          | Burgs earn more than they spend                                                                                                | Share of burgs ending the day with a positive treasury                                                                           | ≥ 70%    | 0.02 per 1%                                        | 96.5%             | 75% ✓    |
| 7   | Fast                     | Regenerating the economy feels instant                                                                                         | Economy run on a default map, best of five runs per map                                                                          | ≤ 200 ms | —                                                  | 121 ms            | 149 ms ✓ |
| 8   | Rich and poor regions    | Some regions' towns are rich and some poor                                                                                     | A market's wealth is the average wealth of the burgs in its area. The richest tenth of markets ÷ the poorest tenth               | ≥ 5×     | 0.5 × log of the shortfall                         | 2.9×              | 6.4× ✓   |
| 9   | Output apart from people | A region's output is not just its headcount: a market with 10% of the people may hold 30% of the output, or 5%                 | Share of markets whose share of the world's output is more than 50% above or below their share of its people                     | ≥ 30%    | 0.01 per 1%                                        | 2%                | 23% ✗    |
| 10  | Specialization           | Markets differ in what they offer: 0% would be every market making the world's average mix, 100% no two markets sharing a good | The share of a typical market's output, by value, that would have to change to match the world's mix                             | ≥ 60%    | 0.02 per 1%                                        | 47%               | 70% ✓    |
| 11  | States' cut              | Taxes take a moderate share of what the economy makes                                                                          | The world's state taxes ÷ its product, as the state accounts sum them                                                            | 10–40%   | 0.01 per 1%                                        | 64%               | 29% ✓    |
| 12  | States benefit           | A state whose people are wealthier collects more per head: a developed economy pays its state                                  | Rank correlation across states between wealth and taxes per person (1: the wealthiest states always collect most; 0: no link)    | ≥ 0.2    | 0.01 per 0.01                                      | 0.19              | 0.26 ✓   |
| 13  | Wealth spread            | Burgs differ in wealth, some far richer per person than others, without a few owning everything                                | Gini coefficient of burg wealth across burgs (0: all equal; 1: one burg has it all)                                              | 0.4–0.6  | 0.03 per 0.01                                      | 0.28              | 0.46 ✓   |
| 14  | Treasury concentration   | Money is not hoarded by a handful of burgs                                                                                     | Share of all burg treasuries held by the tenth of burgs with the largest ones                                                    | ≤ 70%    | 0.01 per 1%                                        | 30%               | 76% ✗    |
| 15  | Employment               | Workers find something worth making; they stay idle only when nothing pays                                                     | Share of workers who found work                                                                                                  | ≥ 90%    | —                                                  | 100%              | 100% ✓   |
| 16  | Goods sold               | What is made finds a buyer the same day rather than piling up in a market                                                      | Share of made goods, by value, bought the same day by burgs, rural people or states                                              | ≥ 50%    | 0.02 per 1%                                        | 29%               | 43% ✗    |
| 17  | Prosperity               | Townspeople live comfortably on average: some burgs thrive, others scrape by                                                   | Average prosperity of burgs, weighted by their people                                                                            | 40–60%   | 0.10 per 1%                                        | —                 | 46% ✓    |

### Goods reference

The catalogue as it should be, the source the tuner (`scripts/economy-tuner/catalogue.mjs`) tunes against, one row per default good. These are judgements of what makes sense, not rules the generator follows.

- **Commonness**: the units of the good a typical economy makes or gathers a day, relative to the other goods of its kind (KPIs 1 and 2). The tuner barely moves raw output: a KPI 2 miss is a cue to edit a good's `deposits`, `distribution` or `biomeOutput`.
- **Value**: the base price that makes sense (KPI 3). A made good is about its recipes' average inputs plus a worker's wage, and each step of a chain adds its wage.
- **Food** to **Luxury**: how much of each need one unit covers (KPI 4): at most 1, or 2 for goods valued 20 or more and for preserved food. An empty cell is no coverage.

| Good           | Kind | Commonness | Value | Food | Utilities | Construction | Military | Luxury |
| -------------- | ---- | ---------- | ----- | ---- | --------- | ------------ | -------- | ------ |
| Wood           | Raw  | 100        | 1     |      | 0.4       | 0.8          |          |        |
| Stone          | Raw  | 10         | 1.5   |      |           | 1            |          |        |
| Marble         | Raw  | 3          | 4.5   |      |           | 0.75         |          | 0.6    |
| Iron           | Raw  | 7          | 3     |      |           |              |          |        |
| Copper         | Raw  | 3          | 4     |      |           |              |          |        |
| Tin            | Raw  | 3          | 4.5   |      |           |              |          |        |
| Silver         | Raw  | 2          | 7     |      |           |              |          |        |
| Gold           | Raw  | 1          | 13    |      |           |              |          |        |
| Grain          | Raw  | 65         | 1.5   | 0.4  |           |              |          |        |
| Cattle         | Raw  | 20         | 2     | 1    |           |              |          |        |
| Fish           | Raw  | 10         | 1.5   | 0.75 |           |              |          |        |
| Game           | Raw  | 20         | 2     | 1    |           |              |          |        |
| Wine           | Raw  | 12         | 8     | 1    |           |              |          | 0.5    |
| Olives         | Raw  | 12         | 1.5   | 0.4  |           |              |          |        |
| Honey          | Raw  | 10         | 2     | 0.6  |           |              |          |        |
| Salt           | Raw  | 10         | 2     |      | 1         |              |          |        |
| Dates          | Raw  | 5          | 2     | 1    |           |              |          |        |
| Horses         | Raw  | 6          | 3     |      | 0.45      |              | 0.9      |        |
| Ivory          | Raw  | 2          | 15    |      |           |              |          | 0.55   |
| Camels         | Raw  | 3          | 4     |      | 0.7       |              | 0.6      |        |
| Hemp           | Raw  | 12         | 0.5   |      |           |              |          |        |
| Pearls         | Raw  | 1          | 15    |      |           |              |          | 0.6    |
| Gemstones      | Raw  | 1          | 16    |      |           |              |          | 0.5    |
| Dyes           | Raw  | 4          | 4.5   |      |           |              |          |        |
| Incense        | Raw  | 1.5        | 11    |      |           |              |          | 1      |
| Silk           | Raw  | 1.5        | 9     |      |           |              |          | 1      |
| Spices         | Raw  | 1.5        | 17    |      |           |              |          | 1      |
| Amber          | Raw  | 1.5        | 7     |      |           |              |          | 0.7    |
| Furs           | Raw  | 6          | 3     |      | 0.25      |              |          | 0.75   |
| Wool           | Raw  | 10         | 2     |      |           |              |          |        |
| Slaves         | Raw  | 1.5        | 12    |      | 1         |              |          |        |
| Tar            | Made | 4          | 3     |      | 0.1       |              |          |        |
| Saltpeter      | Raw  | 3          | 1.5   |      |           |              |          |        |
| Coal           | Made | 25         | 8     |      | 0.55      |              |          |        |
| Oil            | Made | 8          | 8     |      | 0.65      |              |          |        |
| Mahogany       | Raw  | 2          | 4     |      |           |              |          | 0.75   |
| Blubber        | Raw  | 3          | 1     | 0.5  | 0.4       |              |          |        |
| Sugar          | Raw  | 3          | 4     | 0.3  |           |              |          | 0.7    |
| Tea            | Raw  | 3          | 7     |      |           |              |          | 1      |
| Tobacco        | Raw  | 3          | 3     |      |           |              |          | 1      |
| Clay           | Raw  | 15         | 1.5   |      |           | 1            |          |        |
| White sand     | Raw  | 5          | 1     |      |           |              |          |        |
| Leather        | Mfg  | 14         | 6     |      |           |              |          |        |
| Cloth          | Mfg  | 9          | 6     |      |           |              |          |        |
| Garments       | Mfg  | 8          | 18    |      | 0.5       |              |          | 0.7    |
| Ceramics       | Mfg  | 15         | 12    |      | 1         |              |          |        |
| Glass          | Mfg  | 4          | 5     |      |           |              |          | 0.65   |
| Ropes          | Mfg  | 4          | 4     |      |           |              |          |        |
| Paper          | Mfg  | 2          | 4     |      |           |              |          |        |
| Ink            | Mfg  | 2          | 13    |      |           |              |          |        |
| Books          | Mfg  | 2          | 21    |      |           |              |          | 0.7    |
| Sails          | Mfg  | 3          | 11    |      |           |              |          |        |
| Boats          | Mfg  | 1          | 65    |      |           |              | 1        |        |
| Boots          | Mfg  | 8          | 10    |      | 1         |              |          |        |
| Harnesses      | Mfg  | 5          | 9     |      |           |              | 0.85     |        |
| Barrels        | Mfg  | 7          | 12    |      |           |              |          |        |
| Bronze         | Mfg  | 4          | 15    |      |           |              |          |        |
| Tools          | Mfg  | 8          | 16    |      | 0.6       |              |          |        |
| Arms           | Mfg  | 24         | 21    |      |           |              | 2        |        |
| Gunpowder      | Mfg  | 3          | 13    |      |           |              | 0.6      |        |
| Artillery      | Mfg  | 1          | 25    |      |           |              | 1.5      |        |
| Coins          | Mfg  | 1          | 25    |      |           |              |          | 1      |
| Jewelry        | Mfg  | 2          | 31    |      |           |              |          | 1.2    |
| Preserved food | Mfg  | 12         | 12    | 1.6  |           |              |          |        |
| Vinegar        | Mfg  | 5          | 8     |      | 0.45      |              |          |        |
| Cheese         | Mfg  | 10         | 12    | 1.5  |           |              |          |        |
| Beer           | Mfg  | 12         | 9     | 1.2  |           |              |          |        |
| Liquor         | Mfg  | 6          | 14    |      |           |              |          | 1      |
| Candles        | Mfg  | 8          | 12    |      | 1         |              |          | 1      |
| Soap           | Mfg  | 6          | 7     |      | 0.6       |              |          | 0.7    |
| Perfume        | Mfg  | 1          | 20    |      |           |              |          | 0.8    |

### Tuning

`scripts/economy-tuner` tunes the default catalogue and the economy constants against these KPIs, on the game's own economy run headless (`build.mjs`, `runner.ts`, `score.js`). Each candidate is a set of overrides, never a source edit:

- raw goods' values, within ¼–4× of their reference value;
- made goods' margins over their recipes' average inputs (1–15);
- every `demandCoverage` entry the reference lists, within its caps;
- the constants listed with their ranges in `tunables.mjs`. Market placement is not tuned: the maps keep their own markets and fees.

**What it minimizes** (`objective.mjs`): the misses against each KPI target, plus made goods over 5% of all output value. Speed and employment are not scored.

**How it searches** (`search.mjs`): simulated annealing, several chains sharing a pool of workers, one per map. Every 30 s it logs progress and checks the best on a held-out map in the real game. The best is saved to `.cache/best.json`; a `.cache/STOP` file ends the run.

With the dev server running (`--url=` for another address):

1. `node scripts/economy-tuner/export-maps.mjs` exports the ten maps to `.cache/maps`. Goods values feed map generation, so export again after every apply.
2. `npm run tune-economy -- --budget=5000` searches (`--chains=6`, `--test-seed=8888`), logging to `.cache/search.log`.
3. `node scripts/economy-tuner/apply.mjs` writes the best into the source, rounded.

A constant at the edge of its range is a sign the range is too narrow.

## Gotchas

- **No time.** A treasury is one day's net cash, reset each run; only the user's adjustments carry over. State spending is read as upkeep, not a stock built up over time.
- **Order matters.** Later burgs see the prices earlier ones moved, so backward and small burgs get the trades left over.
- **Local first.** A trickle of local stock blocks cheaper sources until it is gone.
- **The surplus is real.** Markets buy every unit offered at a falling price, so much of what is made stays unsold. Spending, not supply, limits goods sold.
- **No route, no trade.** The Routes layer explains most odd trade patterns.
- **Economy regeneration redraws territories**, discarding hand-painted market cells; Production keeps them.
- **Most edits apply on the next run.** Apply in the State budget dialog and the good editor offers that run at once.
- **A state's last orders can miss late taxes.** Taxes other states' final orders pay it after its turn count in what it collected, but stay in its treasury that day.
- **Good values and deposits shape the map**, so retuning defaults can break seed-pinned tests.

## Further reading

- [Goods spread functions](../wiki/Goods-spread-functions.md): the distribution expression language.
- [economy-rework.md](../prd/economy-rework.md): the design record.
- [generation-pipeline.md](../architecture/generation-pipeline.md): where the economy sits in map generation.
