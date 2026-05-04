# Production Schema v3 — Single Priority Loop

## Core Principle

Every worker tick, the burg evaluates **all available actions** simultaneously, scores each by
profit-per-worker, and executes the best one. Market access is universal — every burg can buy
from the global market. Small burgs are limited by population (few workers, little wealth), not
by arbitrary rules.

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
3. Build `chainValue[]` — propagates downstream manufacturing profit to raw ingredients
4. Build price arrays: `currentBuyPrice[i] = currentSellPrice[i] = good.value`
5. `globalMarket = {}` (empty)
6. Sort burgs by population ascending (smallest first)

### Phase B (per burg)

- Dijkstra flood-fill from `burg.cell`, budget = `floor(population)` cells
- Cross-province: +3 cost; Cross-state: +15 cost; Water cells: cost 1
- Collect goods from `cellPool` into `goodsPull` (diminishing returns on duplicates)
- `cellPool` entries zeroed as consumed — permanent scarcity
- `remainingPool = {...goodsPull}` — local extraction budget

### Phase C (per burg) — `ceil(population)` worker ticks

Each tick = 1 worker (fractional for the last tick `fraction = min(1, population - i)`).

#### Action types

**1. Extract raw** (costs 1 worker, no money)

```
Available if: remainingPool[X] > 0
Score:        good.value × cultureMod
  (base sell value only — what the burg actually earns from extracting and selling this good)
Execute:
  extract = min(fraction, remainingPool[X])
  inventory[X] += extract × cultureMod
  remainingPool[X] -= extract
  buyPrice[X] rises (local scarcity signal)
```

> **Why not chainValue?**
> chainValue is the speculative future profit if the burg completes a full manufacturing chain
> (e.g. Wood → Ships is worth 9.83). A 1-worker burg will never build Ships, so using chainValue
> would make it extract Wood (value 1) instead of Cattle (value 2) — the wrong choice.
> Chain profit is already accounted for in the **manufacture candidate score**, which evaluates
> actual feasibility given current inventory + market. chainValue is retained as a display metric
> (shown in Goods Pool section) and as initial queue seed order for equal-value tiebreaking only.

**2. Manufacture from inventory** (costs 1 worker, no money)

```
Available if: all ingredients in inventory in sufficient qty
Score:        sellPrice[out] × cultureMod − Σ(needed[ing] × buyPrice[ing])
  (opportunity cost: ingredients valued at current buy price even if already owned)
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
Score:        sellPrice[out] × cultureMod − Σ(needed[ing] × buyPrice[ing])
  (identical formula to action 2 — fair comparison regardless of ingredient source)
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
candidates = []
  + all feasible Extract actions (remainingPool[X] > 0)
  + all feasible Manufacture actions (inventory sufficient)
  + all feasible Buy-then-Manufacture actions (inventory + market sufficient)

if candidates is empty → break (idle workers)
best = max(candidates, by score)
execute(best)
workersUsed += fraction
```

There are no hard constraints beyond availability. A burg CAN buy from the market even when
the same ingredient is available locally — if buying enables a higher-scoring manufacture
action than extracting raw, that is the correct economic choice.

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

## Expected Emergent Behaviour

| Burg type      | Expected pattern                                                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Village (3–8)  | Extracts 2–3 raw goods; rarely enough wealth or workers to run complex chains; may occasionally buy a cheap ingredient if wildly profitable |
| Town (15–40)   | Extracts raw + light manufacturing from own inventory; buys ingredients when local pool exhausted and margins are good                      |
| City (60–150)  | Local pool exhausted quickly; buys ingredients from globalMarket at scale; focuses on high-margin chains                                    |
| Capital (200+) | Buys at scale; runs full multi-step chains; wealth accumulates; drives buyPrice up for all                                                  |

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
