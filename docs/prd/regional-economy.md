# PRD — Regional Economy

## Problem

The generated economy is uniform. Every market makes roughly the same goods, and its output follows its population: a market with 5% of the world's people holds about 5% of the world's output, give or take a few points. There are no rich trade republics with a sliver of the population, no undeveloped hinterlands, no regions known for one product. The map reads as one economy cut into pieces, not as many.

Measured on six default maps (seeds 431087220, 98765, 55555, 123456789, 4242, 31337) before any change:

| Metric                                                                                                                 | Average  | A regional world would show |
| ---------------------------------------------------------------------------------------------------------------------- | -------- | --------------------------- |
| **Output follows people**: markets whose share of output is within ±25% of their share of people                       | 84%      | under 50%                   |
| **Rich tenth**: the tenth of markets with the most output per person: share of people → share of output                | 8% → 11% | 8% → 25% or more            |
| **Rich/poor gap**: output per person of the richest tenth of burgs ÷ the poorest tenth                                 | 2.2×     | 4× or more                  |
| **Distinctiveness**: share of a typical market's production that would have to change to match the world's average mix | 43%      | 60% or more                 |
| **Price gap**: a typical good's price in its dearest market ÷ its cheapest                                             | 3.4×     | 5× or more                  |

## Causes

1. **Output is linear in workers.** A worker makes at most one unit a day of whatever pays best; there are no scale returns, skills or capital, and every recipe is open to every burg. Output ≈ population × margin.
2. **The margin barely depends on place.** A manufactured good's starting price is its local input cost plus its value added, so making it pays about the same everywhere; buying from other markets when stock runs out flattens prices further.
3. **Raw supply is thin and even.** Only 16 of 71 goods have biome output, most at 0.1 over four or five biomes, so every temperate market gets the same wood, grain and hemp. Bonus resources are placed cell by cell at 1–5% chance and capped at 5 units: salt and pepper, a sample of everything everywhere.
4. **Regional multipliers are mild.** 41 goods carry culture-type multipliers, mostly 1.2–1.4, and most cultures are Generic.
5. **Trade can't enrich anyone.** Burgs trade only with markets and turn to another market only when their own runs out. The 5% market margin and carriage are paid to no one, rural goods enter stock unpaid, and nothing is resold: a port at a crossroads earns what an inland burg of its size earns.
6. **Demand is per head.** Every person wants the same basket; a rich burg wants no more luxury than a poor one.
7. **Markets are alike in size**, placed by spacing; state tax rates vary only ±15%.

## Constraints

- Generation stays one pass and fast: no iteration to equilibrium, no simulated years.
- Saved maps keep their own goods catalogue; changes to the defaults reach new maps and catalogues restored to defaults.
- Every change is scored with the metrics above on the same seeds, before and after.

## Block A — Configuration

Changes to the default goods data and existing constants only; no new mechanics. They change what each region makes more than how much it earns, so they move distinctiveness and price gaps, and output-follows-people only a little.

- **A1. Concentrate biome output.** Fewer biomes per good at higher yields: grain from grassland and temperate forest, timber from forests, dates and camels from deserts, furs from taiga and tundra.
- **A2. Stronger culture-type multipliers.** 2–3× instead of 1.2–1.4, on more goods: Naval for fish, salt, pearls, ships, sails and ropes; Highland for metals, stone, gems and tools; Nomadic for horses, camels, cattle, leather and harnesses; River and Lake for grain, clay, hemp and cloth; Hunting for furs, game and wood. Cultures form continuous regions, which makes this the strongest configuration lever.
- **A3. Coherent placement.** Placement rules that follow terrain belts: metals in the mountains, gems in hot mountains, pearls in warm shallows, and lower chances with richer deposits.
- **A4. Richer deposits.** A higher cap and rate for bonus resources, so a mining district outweighs the biome output around it.
- **A5. Wider value and carriage gaps.** Dear, light luxuries with low carriage travel; bulky staples with high carriage stay home. Values feed population suitability, so they move only with care.
- **A6. Varied taxes.** Per-state jitter of ±50% instead of ±15%, so low-tax states draw buyers.

## Block B — Tweaks to existing mechanics

These break the link between people and output.

- **B1. Margin to merchants.** The 5% market margin goes to the market's center burg, or is shared among its burgs. Busy markets and crossroads ports get rich.
- **B2. Scale returns.** Output per worker × (population ÷ median)^α, α ≈ 0.15–0.3: cities out-produce villages per head.
- **B3. Learning by doing.** A burg grows more productive at a good the more it makes in the run; with goal stickiness, burgs specialize in one or two products.
- **B4. Clustered deposits.** Placing a good raises the chance of the same good in neighboring cells: mining districts and fishing grounds.
- **B5. Rent.** Rural goods sold through a market pay their value to the nearest burg or the state capital, so agrarian capitals with rich hinterlands prosper, and spending on raw goods reaches someone.
- **B6. Demand follows wealth.** Luxury and part of military demand scale with a burg's money per head.
- **B7. Wider price bounds** for rare goods: 0.05–10× instead of 0.1–5×.
- **B8. Fertile valleys.** Rural output bonus on river cells by flow and on coastal fishing shelves.

## Block C — New features

- **C1. Development level.** A per-region productivity factor (about 0.3–2) from access: distance to sea, rivers and roads, state age and form. Advanced cores, backward hinterlands.
- **C2. Merchants trading between markets.** After production, one pass where wealthy port and market-center burgs buy where a good is cheap and sell where it is dear, paying carriage and tariffs and keeping the profit: small trade republics with an outsized share of the economy.
- **C3. Regional specialties.** One to three signature goods per market or culture, chosen from what its inputs favor, with higher productivity and a price premium.
- **C4. Extraction sites.** Rich deposits worked as mines and plantations by the nearest burg at high output: mining towns.
- **C5. Burg capital.** A productivity factor from what a burg has: walls, plaza, citadel, temple, port, capital status.

## Order

1. Block A, measured.
2. B1 and B2, which break proportionality from both sides.
3. C2, which builds on B1.
4. The rest by measured effect.

## Measurements

Scored with `regional-metrics2.js` and `money-metrics.js` (kept with the session scratch scripts) on the six seeds above, averaged.

| Metric                      | Before   | After Block A |
| --------------------------- | -------- | ------------- |
| Output follows people       | 84%      | 55%           |
| Rich tenth: people → output | 8% → 11% | 9.5% → 14%    |
| Rich/poor gap               | 2.2×     | 3.6×          |
| Distinctiveness             | 43%      | 48%           |
| Price gap                   | 3.4×     | 4.1×          |

Block A as applied: A1 (concentrated biome output for ten goods, sugar newly grown in tropical forests), A2 (culture-type multipliers of 2–3 on 34 goods), A3 (iron, grain and dye deposits follow terrain), A4 (bonus resources at 0.5 per person, capped at 10) and A6 (state tax jitter ±50%, within ¼× to 2× of the base). A5 was left out: good values feed population suitability, so changing them reshapes the map itself.

Demand coverage stayed at 99.4–100%; trade between markets rose 5–20%. Because most multipliers are above 1, output per person rose 27–60% and treasuries with it, which moves the economy off the "typical day" calibration of [economy.md](../domain/economy.md) unless rural output or values are scaled back.

What moved: output no longer tracks population (84% → 55%) and the gap between rich and poor burgs widened. What barely moved: concentration of output in the richest markets and the distinctiveness of production mixes. Those need Block B: margin to merchants and scale returns for concentration, clustered deposits for distinctiveness.

### B1 — Margin to merchants

Implemented: the 5% market margin goes to the market's center burg as each trade happens, and to the source market's center on purchases from other markets. It is trade income, kept out of the product, so the output metrics above do not move. Money does, measured on the same six maps with the margin on and switched off:

| Money metric                                                                 | Margin kept by no one | Margin to the center burg |
| ---------------------------------------------------------------------------- | --------------------- | ------------------------- |
| Market center burgs: share of people → share of burg money                   | 12% → 19%             | 12% → 29%                 |
| Richest tenth of burgs by money per person: share of people → share of money | 22% → 47%             | 23% → 53%                 |
| Markets whose money is within ±25% of their population share                 | 48%                   | 50%                       |
| Total burg money                                                             | 30.8k                 | 34.9k (+13%)              |

The margin makes hubs rich but leaves the balance between markets as it was: it is earned at the market where the trade happens, which is mostly the burg's own. Moving wealth between regions needs B2 (scale returns) or C2 (merchants trading between markets).

### B3 — Division of labor

Implemented as a workforce share rather than units made (a worker makes about one unit a day, so units alone give at most +35%): output per worker × (1 + 1 × the burg's share of its workers in the good + 0.5 × the market's share), applied both when choosing and when making. Measured on the six maps with the factor on and pinned to 1:

| Metric                                          | Off  | On          |
| ----------------------------------------------- | ---- | ----------- |
| Manufactured goods per burg (median)            | 2.7  | 2.0         |
| Share of a burg's manufacturing in its top good | 74%  | 86%         |
| Distinctiveness of a market's manufacturing     | 35%  | 38%         |
| Distinctiveness, all production                 | 47%  | 47%         |
| Output follows people                           | 54%  | 59%         |
| Rich tenth: share of output                     | 12%  | 10%         |
| Rich/poor gap                                   | 3.6× | 3.8×        |
| Output per person                               | 8.5  | 10.3 (+22%) |

Burgs specialize clearly. Regions do not: every burg gains about the same, so output follows people a little more, and the market term barely registers, because one good's share of a whole market's workforce stays small. Making it regional would need a bonus relative to the world's mix (only goods a market makes more of than the world average get it) or a larger market weight, and the +22% output on top of Block A's increase asks for a rebalance of rural output or worker productivity.

#### B3, market term relative to the world

The market term now rewards concentration, not size: × 0.5 × (the market's share of its workers in the good ÷ the world's share − 1), from 0 when the market makes the good in the world's proportion up to 0.5 at twice it. Measured on the six maps with the factor pinned to 1, with the first market term (absolute share), and with the relative one. The maps differ from the table above (market fill now charges for crossing state borders), so the "off" column is the new baseline:

| Metric                                            | Off  | Absolute market share | Relative to world |
| ------------------------------------------------- | ---- | --------------------- | ----------------- |
| Distinctiveness of a market's manufacturing       | 31%  | 33%                   | 45%               |
| Share of a market's manufacturing in its top good | 35%  | 36%                   | 40%               |
| Distinctiveness, all production                   | 47%  | 47%                   | 51%               |
| Price gap                                         | 3.8× | 3.9×                  | 4.1×              |
| Share of a burg's manufacturing in its top good   | 76%  | 89%                   | 90%               |
| Output follows people                             | 66%  | 67%                   | 67%               |
| Rich tenth: share of output                       | 12%  | 11%                   | 13%               |
| Rich/poor gap                                     | 3.2× | 3.3×                  | 3.2×              |
| Output per person                                 | 8.8  | 10.9 (+23%)           | 13.4 (+53%)       |

Regions now specialize: a market's manufacturing is half again as distinct from the world's mix, on every seed (+5 to +16 points). Concentration of wealth does not move, as expected from a productivity bonus every market can earn in its own specialties. Most goods are concentrated somewhere, so most workers earn part of the market bonus and output per person rises 53% over the baseline: a rebalance of worker productivity or rural output is now due.

### Rebalance to the typical day

Block A and B3 together raised value added per townsperson from 5.4 to 13.4, which broke the "typical day" calibration. Two constants bring it back, one per source of the increase:

- **Rural output** (`RURAL_OUTPUT_FACTOR` 3 → 2) undoes Block A's raw-goods increase. On its own it barely moves value added (13.4 → 13.0), because value added is made by workers.
- **Workforce share** (`WORKFORCE_SHARE` 0.35): 35% of townspeople work in trades; the rest serve, build, farm, or are too young or too old. This undoes the gain from B3. It shrinks the workforce rather than each worker's output, so recipes stay literal: a worker who works one recipe consumes one recipe's inputs. Scaling each worker's output to 0.55 was tried first and hit the same totals, but it turned "10 steel → 1 engine" into "10 steel → 0.55 engine".

Measured against the last commit before Block A (same six seeds, the same in-page metrics):

| Metric                                            | Before Block A | Before rebalance | Rebalanced |
| ------------------------------------------------- | -------------- | ---------------- | ---------- |
| Value added per townsperson                       | 5.37           | 13.42            | 5.39       |
| Rural output value per townsperson                | 18.1           | 28.8             | 19.6       |
| Units manufactured per townsperson                | 1.01           | 1.78             | 0.61       |
| Demand coverage                                   | 99.9%          |                  | 99.95%     |
| Idle workers                                      | 0%             | 0%               | 0%         |
| Output follows people                             | 84%            | 67%              | 62%        |
| Rich/poor gap                                     | 2.2×           | 3.2×             | 3.7×       |
| Distinctiveness, all production                   | 44%            | 51%              | 55%        |
| Distinctiveness of a market's manufacturing       | 40%            | 45%              | 58%        |
| Share of a market's manufacturing in its top good | 25%            | 40%              | 47%        |
| Manufactured goods per burg (median)              | 2.8            | 2.0              | 1.0        |

Value added per townsperson is back where it was, and the regional gains hold or grow. Fewer workers make fewer units (0.61 per townsperson), but those units are dearer goods made from cheaper inputs. With fewer workers each, most burgs now settle on a single trade: their own sales no longer move prices enough to make a second good pay.
