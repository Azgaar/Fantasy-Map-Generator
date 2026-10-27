# PRD — Regional Economy

## Problems

1. **The economy was uniform.** Every market made about the same goods, and its output followed its population. There were no rich trade hubs, no backward hinterlands, no regions known for one product.
2. **The economy did not balance.** Most made goods piled up unsold while others were never made. Demand did not depend on income: people bought a fixed basket whatever they earned, rural people produced half the supply and earned nothing, and markets bought whatever burgs made. Taxes took about half of all income, and few burgs saved anything.

Constraints: generation stays one pass and fast, with no iteration to equilibrium. Saved maps keep their own goods catalogue. Every change is measured on the same six default maps (seeds 431087220, 98765, 55555, 123456789, 4242, 31337), before and after.

## KPIs

| KPI                   | Measure                                                           | Target      | At start | Now            |
| --------------------- | ----------------------------------------------------------------- | ----------- | -------- | -------------- |
| Every good made       | Made goods made on a map                                          | 32 of 32    | 17       | 31.2 ✗         |
| Nothing underproduced | Consumer goods never made, or with half the buyers turned away    | ≤ 1         | 14 of 28 | 0.7 of 23 ✓    |
| Nothing overproduced  | Made goods with half or more left unsold                          | ≤ 3         | 15 of 17 | 5.0 of 31 ✗    |
| Little waste          | Made goods left unsold, by value                                  | ≤ 20%       | 87%      | 30% ✗          |
| Needs covered         | Townspeople's needs met                                           | ≥ 97%       | 87–100%  | 98% ✓          |
| No idle workers       | Workers with nothing to make, without a good reason               | ≤ 1%        | 0%       | 0% ✓           |
| Reasonable taxes      | States' taxes, share of all income                                | 10–20%      | 55%      | 12% ✓          |
| Burgs profitable      | Burgs ending the day with savings                                 | ≥ 80%       | 17%      | 87% ✓          |
| Regions distinct      | Share of a market's production that differs from the world's mix  | ≥ 60%       | 43%      | 72% ✓          |
| Rich and poor         | Income per person, richest ÷ poorest tenth: of burgs / of markets | ≥ 5× / ≥ 3× | 2.2×     | 10.5× / 3.6× ✓ |
| Fast                  | Economy run per map                                               | ≤ 200 ms    | 113 ms   | 174 ms ✓       |
| Controllable          | Each setting moves its own KPI predictably                        | –           | –        | ✓              |

"At start" is the game before this work, or its replay in the simulation where the game did not measure it.

## Progress

Ten of twelve KPIs are met. Regions are distinct, the circular flow works (sales are income, income is spent, rural people are paid), taxes are moderate, burgs save, and needs are covered.

Open: about 30% of made goods by value are left unsold, five goods are overproduced on a typical map, and a few goods are not made on every map. The surplus moves between goods with every price tweak but its total holds, because a market buys every unit offered at a price that only falls as it fills, whether anyone will buy it back or not.

| Milestone                          | Made at all | Overproduced | Unsold | Covered | Distinct | Burg / market gap | Run    |
| ---------------------------------- | ----------- | ------------ | ------ | ------- | -------- | ----------------- | ------ |
| Start                              | 17 of 32    | 15 of 17     | 87%    | 87%     | 43%      | 2.2× / –          | 113 ms |
| Economy v2, wants capped           | 25          | 11 of 25     | 57%    | 97%     | 62%      | 5.1× / 4.7×       | 174 ms |
| Variety buying, faster prices      | 30.0        | 8 of 30      | 43%    | 97%     | 69%      | 8.5× / 5.0×       | 204 ms |
| Military coverage, sell per worker | 30.8        | 7 of 31      | 40%    | 97%     | 69%      | 13.3× / 3.7×      | 218 ms |
| Made goods reviewed                | 31.2        | 3.7 of 31    | 33%    | 98%     | 64%      | 11.8× / 4.1×      | 215 ms |
| Ingredient opening, carriage cache | 31.2        | 5.0 of 31    | 30%    | 98%     | 72%      | 10.5× / 3.6×      | 174 ms |

The last row was measured after ships were revalued from 172 to 122.

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

### Demand and money

| Idea                                                                                                | Cx  | Status    | Result                                                                           |
| --------------------------------------------------------------------------------------------------- | --- | --------- | -------------------------------------------------------------------------------- |
| Needs bought each turn in step with the work done                                                   | M   | Applied   | Purchases push back against sales during the run                                 |
| Rural demand mirroring the burgs' purchases                                                         | M   | Discarded | Less unsold, but rural shoppers drained the staples and coverage fell to 71–96%  |
| Rural people paid when their produce sells, and spend it on wants                                   | H   | Applied   | Closes the circular flow                                                         |
| Spending follows income: needs first, then wants up to 85% of income (15% saved)                    | H   | Applied   | The main fix for the surplus: without wants, 72% unsold in the simulation        |
| Wants capped: one more day of each need, four of luxury                                             | L   | Applied   | Stopped the largest burgs buying out all food; coverage 59% → 97%, idle 14% → 0% |
| Variety: spending spread over all goods covering a need by (price per coverage)⁻³                   | M   | Applied   | Every good finds some buyers; made at all 25 → 30                                |
| Made goods valued at inputs + 10, coverage scaled so each good covers its need at a reference price | L   | Applied   | Every good competes at base prices                                               |
| Military goods cover what a unit really equips: ships 4, artillery 2, arms 1, harnesses 0.5         | L   | Applied   | Not bought as cheap military coverage                                            |
| Pure ingredients cover no need: cloth, ropes, tar, barrels, sails                                   | L   | Applied   | Overproduced 7.3 → 3.7 of 31, gunpowder 94% → 37% unsold                         |
| Vinegar as an ingredient only                                                                       | L   | Discarded | Its unsold share rose to 76%                                                     |
| Base taxes × 0.4                                                                                    | L   | Applied   | Taxes 55% → 12% of income                                                        |
| State orders buying military goods                                                                  | M   | Pending   | Natural buyer for ships, arms and artillery                                      |
| Wants favor quality goods as income rises                                                           | M   | Pending   | –                                                                                |

### Trade

| Idea                                                                        | Cx  | Status  | Result                                                                                           |
| --------------------------------------------------------------------------- | --- | ------- | ------------------------------------------------------------------------------------------------ |
| Market margin (10%) paid to the market's center burg                        | L   | Applied | Hubs get rich: center burgs hold 29% of burg money with 12% of the people                        |
| Rent: 40% of rural sale income to the state's capital                       | L   | Applied | Moves money between markets, the way dues concentrate wealth in capitals; market gap 2.8× → 3.5× |
| Exports: burgs sell where the price at their door is best                   | M   | Applied | Markets stop making only what they alone lack: distinctiveness 44% → 66% in the simulation       |
| Carriage measured once a run                                                | L   | Applied | Run 235 → 170 ms, identical results                                                              |
| Merchants: wealthy hubs buy where a good is cheap and sell where it is dear | H   | Pending | –                                                                                                |

## Next

1. **Markets buy only what they expect to resell**, so goods nobody will buy stop selling at all. This is the lever for the 30% unsold.
2. **State orders for military goods**, their natural buyer.
3. Pending regional ideas by measured effect: scale returns, merchants, development level.
