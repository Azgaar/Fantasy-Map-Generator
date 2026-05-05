# Production Schema v4 — Bounded Lookahead Planner

## Core Principle

Every worker tick, the burg evaluates the **best reachable plan** from its current state.
The decision is no longer driven by a precomputed global chain value. Instead, the burg does a
short bounded search over feasible actions and picks the first move of the best plan it can still
complete with its remaining workers.

Market access is universal — every burg can buy from the global market. Small burgs are limited
by population and current state, not by arbitrary rules.

The current implementation also applies a lightweight demand layer: each category has a stable
population-based demand target, and goods get a score multiplier based on how much unmet category
demand they can satisfy. This changes production scoring without introducing a separate
consumer-spending simulation yet.

---

## Data Structures

### A. `cellPool[cellId][goodId]` — Local resources

- Built once in Phase A from `cells.good` + biome production
- Consumed by flood-fill in Phase B; **never replenished**
- Represents physical deposits accessible only to nearby burgs (distance-gated by Dijkstra)

### B. `globalMarket[goodId]` — Global market

- Flat `Record<number, number>`, not cell-indexed — any burg can buy from it
- Starts **empty** before any burg is processed
- **Filled**: each burg dumps its entire net inventory here at end of Phase D (all goods, raw and manufactured)
- **Depleted**: other burgs buy from it during Phase C manufacture actions
- `currentBuyPrice[goodId]` rises when goods are extracted locally or bought from market
- `currentSellPrice[goodId]` falls when goods are added to the market in Phase D

### C. `inventory[goodId]` — Burg inventory (per-burg, temporary)

- Starts empty each burg
- **Grows via**: raw extraction (worker action) or buying from globalMarket (bundled into manufacture)
- **Shrinks via**: manufacturing (ingredients consumed)
- Fully transferred to globalMarket at end of Phase D

### `burg.wealth` — Burg monetary budget

- Starts at 0 for new burgs; persists between runs (net worth accumulates)
- Decreases when buying ingredients from globalMarket during Phase C
- Increases when selling inventory to globalMarket in Phase D
- Can go negative — no hard floor

---

## Per-Burg Production Flow

### Phase A (once, before all burgs)

1. Build `goodById` map (pack.goods is shuffled — never use array indices)
2. Build `cellPool` from cells.good + biome production
3. Pre-calculate stable chain metadata for heuristics / UI:

- `chainValueByWorkers[workers][goodId]` — downstream desirability bucketed by remaining workers
- later: chain complexity, total profit by base values, profit per worker

4. Build price arrays: `currentBuyPrice[i] = currentSellPrice[i] = good.value`
5. Build demand profiles from good tags / bonuses and stable per-population demand targets
6. `globalMarket = {}` (empty)
7. Sort burgs by population ascending (smallest first)

### Phase B (per burg)

- Dijkstra flood-fill from `burg.cell`, budget = `floor(population)` cells
- Cross-province: +3 cost; Cross-state: +15 cost; Water cells: cost 1
- Collect goods from `cellPool` into `goodsPull` (diminishing returns on duplicates)
- `cellPool` entries zeroed as consumed — permanent scarcity
- `remainingPool = {...goodsPull}` — local extraction budget

### Phase C (per burg) — `ceil(population)` worker ticks with lookahead

Each tick = 1 worker (fractional for the last tick `fraction = min(1, population - i)`).

#### Action types

**1. Extract raw** (costs 1 worker, no money)

```
Available if: remainingPool[X] > 0
Immediate value: `currentSellPrice[X] × cultureMod`
Execute:
  extract = min(fraction, remainingPool[X])
  inventory[X] += extract × cultureMod
  remainingPool[X] -= extract
  buyPrice[X] rises (local scarcity signal)
```

This raw action may still win because the planner sees its downstream consequences: after
extracting raw now, later search plies can manufacture from it if enough workers remain.
So the chain logic is still present, but only when it is feasible **for this burg right now**.

**2. Manufacture from inventory** (costs 1 worker, no money)

```
Available if: all ingredients in inventory in sufficient qty
Immediate value: `currentSellPrice[out] × cultureMod − Σ(needed[ing] × currentBuyPrice[ing])`
Execute:
  yield = min(fraction, min_over_ings(inventory[ing] / needed[ing]))
  inventory[ings] -= yield × needed[ing]
  inventory[out] += yield × cultureMod
  (no price change during manufacture; price pressure applied in Phase D)
```

**3. Buy-then-manufacture** (costs 1 worker + money)

```
Available if:
  - For each ingredient: inventory[ing] is enough, OR globalMarket[ing] has the shortfall
  - At least one ingredient must come from globalMarket (else it's action 2)
Immediate value: `currentSellPrice[out] × cultureMod − Σ(needed[ing] × currentBuyPrice[ing])`
Execute (buy step first, no worker cost):
  actualYield = min(fraction, min_over_ings((inventory[ing] + globalMarket[ing]) / needed[ing]))
  for each ingredient ing:
    amtNeeded  = actualYield × needed[ing]
    fromInv    = min(inventory[ing], amtNeeded)
    toBuy      = amtNeeded - fromInv
    inventory[ing] -= fromInv
    if toBuy > 0:
      globalMarket[ing] -= toBuy
      burg.wealth       -= toBuy × buyPrice[ing]
      buyPrice[ing] rises (demand pressure)
Execute (manufacture step, 1 worker):
  inventory[out] += actualYield × cultureMod
```

#### Decision algorithm

```
function plan(state, workersLeft, depth):
  baseline = liquidation value of current inventory at current sell prices
  if depth == 0 or workersLeft <= 0:
    return baseline

  candidates = top feasible extract actions + top feasible manufacture actions
  calculate unmet category demand from current inventory
  apply demand multiplier based on produced good category fit:
    multiplier = 1 + Σ(max(0, categoryDemand - categoryCoverage) × goodCategoryWeight)
  compare candidates by projected gain for this tick:
    projectedGain = decisionScore × actualUnits
  for each candidate:
    simulate one worker tick
    recurse on the resulting state

  return max(baseline, candidate.cashDelta + recurse(...))

At the real game tick:
  bestPlan = plan(currentBurgState, workersLeft, LOOKAHEAD_DEPTH)
  execute only the first action of bestPlan
  workersUsed += fraction
```

Key implication:

- A long chain is only chosen if it fits within the remaining search horizon and current workers.
- Partial chains are valid because the search can start from inventory or market-bought mid-goods.
- A raw good like Wood is not globally "good" anymore; it is only good if this burg can still turn
  it into something more valuable within the reachable plan tree.
- A good can also rise in priority when it directly satisfies a burg's unmet local demand,
  even if it is not the highest market-price item available.

### Stable Demand Targets

Demand depends only on burg population in the current implementation:

- `food = population × 0.2`
- `utilities = population × 0.05`
- `construction = population × 0.1`
- `military = population × 0.05`
- `luxury = population × 0.05`

Demand coverage is explicit authored data on goods, not inferred from tags or bonuses:

```ts
good.supply = {
  food?: number,
  utilities?: number,
  construction?: number,
  military?: number,
  luxury?: number
}
```

Meaning: `1 unit` of this good covers the listed amount of each category. Example:

```ts
Grain.supply = {food: 1};
Wood.supply = {construction: 1, utilities: 0.25};
```

Demand scoring formula per candidate:

```ts
categoryBoost = categoryShortage × goodSupply[category]
demandMultiplier = 1 + Σ(categoryBoost)
```

Oversupply does not penalize score yet.

### Phase D (per burg, after loop)

```
1. burg.produced = inventory (rounded to 2 dp for UI; raw values stored in finalInventory)

2. Revenue + market fill:
   for each goodId in inventory where amount > 0:
     revenue = amount × currentSellPrice[goodId]
     burg.wealth += revenue
     globalMarket[goodId] += amount
     currentSellPrice[goodId] falls (supply pressure; clamped to priceFloor)

3. Store BurgProductionData snapshot
```

---

## Price Pressure Rules

| Event                                    | Effect                                    |
| ---------------------------------------- | ----------------------------------------- |
| Raw extraction (Phase C action 1)        | `buyPrice[X]` rises — local scarcity      |
| Buy from globalMarket (Phase C action 3) | `buyPrice[X]` rises — demand pressure     |
| Goods added to globalMarket (Phase D)    | `sellPrice[X]` falls — supply glut        |
| Manufacturing itself                     | No price effect (goods not on market yet) |

---

## Chain Metrics

Static chain metrics are still useful, but only as heuristics / UI data.

- `chainValueByWorkers`: broad downstream desirability bucketed by worker count, not a decision score
- `chainComplexity`: minimum worker steps to finish a chain from raw ingredients
- `chainProfitBase`: total profit using `good.value` instead of live market prices
- `chainProfitPerWorker`: `chainProfitBase / chainComplexity`

These metrics can help sort and prune planner branches, but the actual move choice must come from
the bounded lookahead on the burg's current `inventory + remainingPool + globalMarket + workersLeft`.

---

## Expected Emergent Behaviour

| Burg type      | Expected pattern                                                                                                        |
| -------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Village (3–8)  | Usually takes short plans only; long chains are pruned because they cannot be completed in the remaining search horizon |
| Town (15–40)   | Can execute short 2–3 step chains when locally or globally feasible                                                     |
| City (60–150)  | Often prefers market-assisted chains because it can still complete them within multiple remaining worker ticks          |
| Capital (200+) | Can sustain longer profitable plan sequences and convert more mid-goods into high-value outputs                         |

---

## Job Log Entry (BurgProductionData.jobs)

```typescript
type Job =
  | {kind: "extract"; tick: number; goodId: number; units: number; cultureModifier: number}
  | {
      kind: "manufacture";
      tick: number;
      goodId: number;
      units: number;
      cultureModifier: number;
      recipe: Array<{goodId: number; fromInventory: number; fromMarket: number; marketCost: number}>;
      score: number;
    };
```

`fromInventory + fromMarket = totalConsumed` per ingredient.
`marketCost = fromMarket × buyPrice` at time of purchase.
`score` now means the projected bounded-lookahead gain of choosing this action from the current state.
