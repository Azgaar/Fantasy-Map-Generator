# PRD — Economy Rework

## Problems

1. **Low regionalism.** Every market looked the same: the same goods, at about the same prices. There were no regions known for a product, no rich trade hubs, no backward hinterlands.
2. **Output followed people.** A market's output was its population times a near-constant: more people, more output, in a straight line. A market with 5% of the world's people held about 5% of its output, so the economy was too predictable to tell a story.
3. **Weak control.** Bonus resources were placed cell by cell by chance, and most raw supply came from biome tables. A user could not say "this region mines iron" or "gold is rare here" and get it.

Fixing these exposed how the day's economy worked underneath: demand did not depend on income, rural people earned nothing, markets bought whatever burgs made, and states took half of all income. Much of the work below rebuilt that, so the KPIs could hold at all.

Constraints: saved maps keep their own goods catalogue. Every change is measured on the same six default maps (seeds 431087220, 98765, 55555, 123456789, 4242, 31337), averaged, and compared with master (v1.156.0). How the day is computed is open: today it is one pass of turns, and a different scheme is welcome if it scores better.

## KPIs

The KPIs, their targets and current values are tracked in [the economy domain doc](../domain/economy.md#kpis). Each idea below is scored against them.

## Progress

Eight of thirteen KPIs are met.

Against master: regions are far more distinct (71% vs 47%), 19% of markets produce far more or far less than their headcount instead of 2%, wealth is unequal enough to tell rich burgs from poor ones (Gini 0.39 vs 0.28), states take 13% of the economy's product instead of 64%, and 82% of made goods sell instead of 29%, at 42 ms more per run. Control: deposits are a set number per map, with a range per good, and the Goods editor places them to a typed daily output.

Rich burgs now spend by their wealth: the richest tenth spend a quarter of their income (a tenth before), mostly on luxury, and favor dear goods. More goods sell and more burgs end in profit, but the spending reaches poorer regions' makers, so regions converge and wealth evens out.

Open:

- **Treasuries are too concentrated** (76% in the richest tenth, against 50%): they house 31% of the townspeople, and nearly every market center and state capital is among them (96%), earning the market margins and rural rent. Spending by wealth did not move it: luxury goods run out before the rich run out of money.
- **Rich and poor regions** (3.8×, against 5×) fell as the rich spent more.
- **Output still mostly follows people** (19% of markets apart, against 50%): production is spread by population, with a regional bonus of at most ×2.
- **States barely profit from a wealthier economy** (0.14): sales tax rates vary up to eightfold between states (¼× to 2× of the form's base), more than their people's wealth does, and a third of state income is a flat poll tax.
- **Some goods are missing on some maps**: grain, wine and honey on seed 431087220; tropical goods on seed 123456789, which has no hot climate.

## Ideas

Complexity: **L** low (constants or data), **M** medium (a rule in an existing mechanic), **H** high (a new mechanic).

### Supply and regions

| Idea                                                                                            | Cx  | Status    | Result                                                                                              |
| ----------------------------------------------------------------------------------------------- | --- | --------- | --------------------------------------------------------------------------------------------------- |
| Concentrated biome output: fewer biomes per good, wood and sugar in the tropics                 | L   | Applied   | Small gain: a market's people live in several biomes, so biome output cannot get much more distinct |
| Culture-type multipliers of 2–3 on 34 goods                                                     | L   | Applied   | With the two below: output no longer follows people (84% → 55% of markets), burg gap 2.2× → 3.6×    |
| Deposits follow terrain: metals in mountains, pearls in warm shallows                           | L   | Applied   | Part of the row above                                                                               |
| State tax jitter ±50%                                                                           | L   | Applied   | Part of the row above                                                                               |
| Wider value gaps between goods                                                                  | L   | Discarded | Values feed population suitability, so they reshape the map itself                                  |
| Deposits as a set number per map, clustered (each next one beside the last by 50%)              | M   | Applied   | Distinctiveness +11 points; the strongest regional lever                                            |
| Deposits without biome output, or biome output for staples only                                 | L   | Discarded | Coverage fell 2–7 points; maps without deposits would have no rural economy                         |
| Deposit yield from cell population (capped at 10) × map size; burg on a deposit gets free units | L   | Applied   | Supply scales with the map; few deposits stay meaningful                                            |
| Goods editor: set a good's daily output, deposits re-placed to match                            | M   | Applied   | User control over supply on existing maps                                                           |
| Biome output halved                                                                             | L   | Applied   | Less unused grain, wood and hemp                                                                    |
| Carriage by weight and value: heavy goods ÷2, dear goods ×2, ×1.5 from another state            | L   | Applied   | Staples stay local, luxuries travel                                                                 |
| Clay deposits 6–9, oil deposits 2–3                                                             | L   | Applied   | Ceramics made on every map; oil less oversupplied                                                   |
| Coal valued as charcoal (12), metal deposits ×2                                                 | L   | Applied   | Coal, bronze, artillery, arms and tools made where they never were                                  |
| Fertile valleys: more rural output along rivers and fishing shelves                             | M   | Pending   | –                                                                                                   |
| Extraction sites: rich deposits worked as mines by the nearest burg                             | H   | Pending   | –                                                                                                   |
| Development level: productivity from access to sea, rivers, roads, state age                    | H   | Pending   | –                                                                                                   |

### Production

| Idea                                                                                | Cx  | Status    | Result                                                                                             |
| ----------------------------------------------------------------------------------- | --- | --------- | -------------------------------------------------------------------------------------------------- |
| Division of labor: more output for a good the burg puts more workers into           | M   | Applied   | Burgs specialize (top good 74% → 86% of their manufacturing), regions do not                       |
| Regional bonus: up to ×2 for a good the market makes more of than the world's share | M   | Applied   | Distinctiveness of manufacturing 31% → 45%; most of the regional gain from production              |
| Workforce: 35% of townspeople work in trades                                        | L   | Applied   | Brings output back to the typical-day scale with recipes kept literal; 20% tried, fewer goods made |
| Scaled output per worker instead of a smaller workforce                             | L   | Discarded | Same totals, but recipes stopped being literal (10 steel → 0.55 engine)                            |
| A finished good is sold as each worker makes it                                     | L   | Applied   | The next worker sees the moved price: fewer never-made goods, burg gap up                          |
| Wage floor: workers take only work paying at least 1 or 3 a day                     | L   | Discarded | Unsold unchanged, 1% of workers idle                                                               |
| Scale returns: cities out-produce villages per head                                 | M   | Pending   | –                                                                                                  |
| Burg capital: productivity from walls, port, temple, capital status                 | M   | Pending   | –                                                                                                  |
| Regional specialties: signature goods per market or culture                         | M   | Pending   | Partly covered by the regional bonus                                                               |

### Prices

| Idea                                                                                                  | Cx  | Status    | Result                                                                                        |
| ----------------------------------------------------------------------------------------------------- | --- | --------- | --------------------------------------------------------------------------------------------- |
| A fixed price push per unit traded (1%, 3%)                                                           | L   | Discarded | Stronger push priced households out of their needs; made goods still piled up                 |
| Prices from stock against estimated demand                                                            | M   | Discarded | Coverage held, but every market chased the same short goods: distinctiveness 63% → 45%        |
| Demand re-estimated from purchases during the run                                                     | M   | Discarded | Worse on every measure                                                                        |
| Prices move by expected daily sales: a day's sales moves a price e² times; floor 2%, ceiling 5× value | M   | Applied   | Overstocked goods stop paying; unsold 52% → 43%                                               |
| Buyers turned away raise the price                                                                    | L   | Applied   | Short goods draw makers                                                                       |
| Sales estimate spreads each need as buyers do, and follows whole production chains                    | M   | Applied   | Military goods no longer expected in bulk; ingredients counted for every product they go into |
| Ingredients open at value × √(expected units) where their trades need under one a day                 | M   | Applied   | Fewer stray sails and ropes, distinctiveness 69% → 72%; unsold unchanged                      |
| Consumer goods open by expected sales                                                                 | M   | Discarded | Ships opened at the floor and were never made on 5 of 6 maps                                  |
| Sales estimate from even spending across a need's goods                                               | L   | Discarded | Arms, harnesses and artillery 82–93% unsold                                                   |
| Trades at the average price across their move                                                         | L   | Discarded | Households priced out of their needs (coverage 71–77%)                                        |
| Expected sales floor 0.1 unit instead of 1                                                            | L   | Discarded | Fewer unsold, but fewer goods made and distinctiveness 59%                                    |
| Faster price response (e³)                                                                            | L   | Discarded | Fewer goods made, no gain in unsold                                                           |
| Markets buy only what they expect to resell                                                           | M   | Pending   | Targets the remaining surplus                                                                 |
| Several passes a day, so prices settle before burgs choose their trades                               | H   | Pending   | Would replace the one-pass turns if it scores better on the KPIs                              |

### Demand and money

| Idea                                                                                                                              | Cx  | Status    | Result                                                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------------------- | --- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Needs bought each turn in step with the work done                                                                                 | M   | Applied   | Purchases push back against sales during the run                                                                                                                                                 |
| Rural demand mirroring the burgs' purchases                                                                                       | M   | Discarded | Less unsold, but rural shoppers drained the staples and coverage fell to 71–96%                                                                                                                  |
| Rural people paid when their produce sells, and spend it on wants                                                                 | H   | Applied   | Closes the circular flow                                                                                                                                                                         |
| Spending follows income: needs first, then wants up to 85% of income (15% saved)                                                  | H   | Applied   | The main fix for the surplus: without wants, 72% unsold in the simulation                                                                                                                        |
| Wants capped: one more day of each need, four of luxury                                                                           | L   | Applied   | Stopped the largest burgs buying out all food; coverage 59% → 97%, idle 14% → 0%                                                                                                                 |
| Variety: spending spread over all goods covering a need by (price per coverage)⁻³                                                 | M   | Applied   | Every good finds some buyers; made at all 25 → 30                                                                                                                                                |
| Made goods valued at inputs + 10, coverage scaled so each good covers its need at a reference price                               | L   | Applied   | Every good competes at base prices                                                                                                                                                               |
| Military goods cover what a unit really equips: ships 4, artillery 2, arms 1, harnesses 0.5                                       | L   | Applied   | Not bought as cheap military coverage                                                                                                                                                            |
| Pure ingredients cover no need: cloth, ropes, tar, barrels, sails                                                                 | L   | Applied   | Overproduced 7.3 → 3.7 of 31, gunpowder 94% → 37% unsold                                                                                                                                         |
| Vinegar as an ingredient only                                                                                                     | L   | Discarded | Its unsold share rose to 76%                                                                                                                                                                     |
| Base taxes × 0.4                                                                                                                  | L   | Applied   | Taxes 55% → 12% of income                                                                                                                                                                        |
| Taxes follow wealth: narrower rate jitter, less or wealth-scaled poll tax                                                         | L   | Pending   | Targets KPI 9: states' taxes per head do not follow their people's wealth (0.01)                                                                                                                 |
| State orders buying military goods                                                                                                | M   | Pending   | Natural buyer for ships, arms and artillery                                                                                                                                                      |
| Taste follows wealth: variety falls from 3 by 2 per tenfold of affluence, down to −1 (prestige)                                   | M   | Replaced  | Alone almost neutral; with the next row the rich buy jewelry and perfume over honey and soap                                                                                                     |
| Novelty, not prestige: everyone buys by (price per coverage)⁻³; the rich pay up to 1 + log10(affluence) times for goods they lack | M   | Applied   | Prestige made the rich buy useless dear goods: harnesses at 0.03 military coverage still sold 126 a map                                                                                          |
| Coverage at most 1 (2 for goods of value 20+), cheap raw goods at most value ÷ 3; made goods at inputs + 5; novelty 2             | M   | Replaced  | Price decides demand; made staples cost 2–3× raw per unit of need, and the rich who have bread buy beer                                                                                          |
| Values, margins and coverage tuned by annealing on a market-level model of the six KPI maps (360k runs); novelty 2.7              | L   | Replaced  | Model: volumes 46× → 28×, needs met 91% → 92%, no made good over 5% of value, mix shift under ±10% value jitter 13% → 10%                                                                        |
| Values and coverage tuned by annealing on the game's own economy run headless (6,249 runs, stopped early)                         | L   | Applied   | Six maps: prosperity 50%, volumes 25×, specialization 65%, sold 88%; held-out map: Boats 21% of value                                                                                            |
| Luxury wants grow with affluence (4 × √affluence days), and what the capped staples leave goes to luxury                          | M   | Applied   | The richest tenth spend a quarter of their income, not a tenth; goods sold 70% → 82%; regions converge (4.8× → 3.8×) as rich money reaches poorer makers; treasury concentration unchanged (76%) |
| Construction wants grow with affluence too                                                                                        | L   | Discarded | The first burgs in line bought out construction goods: the smaller half of burgs got 6% of their construction needs                                                                              |
| Luxury wants in step with affluence (linear)                                                                                      | L   | Discarded | Volume ratio 137×; rich burgs drained marble and still spent only a quarter: luxury goods ran out                                                                                                |

### Trade

| Idea                                                                        | Cx  | Status  | Result                                                                                           |
| --------------------------------------------------------------------------- | --- | ------- | ------------------------------------------------------------------------------------------------ |
| Market margin (10%) paid to the market's center burg                        | L   | Applied | Hubs get rich: center burgs hold 29% of burg money with 12% of the people                        |
| Rent: 40% of rural sale income to the state's capital                       | L   | Applied | Moves money between markets, the way dues concentrate wealth in capitals; market gap 2.8× → 3.5× |
| Exports: burgs sell where the price at their door is best                   | M   | Applied | Markets stop making only what they alone lack: distinctiveness 44% → 66% in the simulation       |
| Carriage measured once a run                                                | L   | Applied | Run 235 → 170 ms, identical results                                                              |
| Merchants: wealthy hubs buy where a good is cheap and sell where it is dear | H   | Pending | –                                                                                                |

## Next

In KPI order:

1. **Goods missing on some maps** (KPI 1): grain, wine and honey on seed 431087220.
2. **Rich and poor regions, output apart from people** (KPIs 5 and 6): scale returns, development level, merchants.
3. **Taxes that follow wealth** (KPI 9): narrower rate jitter, less or wealth-scaled poll tax.
4. **Treasury concentration** (KPI 11): the hubs' margins and the capitals' rent pile up in few treasuries; luxury supply limits what the rich can spend.
