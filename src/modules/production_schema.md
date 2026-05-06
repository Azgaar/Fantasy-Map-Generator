# Production Schema

Production runs once for all valid burgs. Each burg goes through the same loop:

1. Gather nearby raw resources from the map.
2. Spend workers one tick at a time.
3. On each tick, greedily choose the best feasible action.
4. Put all final inventory onto the global market.
5. Store a snapshot for the Production Overview UI.

## The four layers of the simulation

### 1. Local resources

Raw materials come from `cellPool[cellId][goodId]`.

- It is built once from `cells.good` and biome production.
- It is shared by all burgs during the run.
- Once a burg collects a resource from a cell, that resource is removed from the pool.

This is the main local-scarcity mechanic.

### 2. Burg inventory

Each burg has a temporary `inventory[goodId]` during its turn.

- Extraction adds goods to inventory.
- Manufacturing consumes ingredients from inventory.
- Manufacturing output also goes into inventory.
- At the end of the burg turn, all remaining inventory is sold into the global market.

### 3. Global market

There is one shared `globalMarket[goodId]` for the whole run.

- It starts empty.
- Burgs add their final inventory into it when they finish.
- Later burgs can buy ingredients from it while manufacturing.

There is no separate buy-only action. Market buying only happens inside manufacture actions.

### 4. Live prices

Every good has two live prices during the run:

- `currentBuyPrice[goodId]`
- `currentSellPrice[goodId]`

Both start at `good.value`.

Price behavior:

- extracting a good raises its buy price,
- buying a good from market raises its buy price,
- selling final inventory to market lowers its sell price,
- prices are clamped between configured floor and ceiling values.

## Burg processing order

Burgs are processed in ascending population order, so smaller burgs act first.

That matters because:

- they claim nearby map resources earlier,
- they seed the global market earlier,
- they influence prices for later burgs.

## Phase A: one-time setup

Before iterating burgs, the generator builds:

1. `goodById`
2. `cellPool`
3. `chainValueByWorkers`
4. live buy/sell price arrays
5. recipe options for manufactured goods
6. an empty `globalMarket`

### Demand constants

Demand targets depend only on population:

- food: `population × 0.2`
- utilities: `population × 0.05`
- construction: `population × 0.1`
- military: `population × 0.05`
- luxury: `population × 0.05`

### Good demand coverage

Goods do not infer demand behavior from tags.

Each good has explicit authored data:

```ts
good.demandCoverage = {
  food?: number,
  utilities?: number,
  construction?: number,
  military?: number,
  luxury?: number
}
```

Meaning: 1 unit of the good contributes the listed amount toward those demand categories.

Examples:

```ts
Grain.demandCoverage = {food: 1};
Wood.demandCoverage = {construction: 0.75, utilities: 0.25};
```

## Phase B: resource access

Each burg gathers nearby resources using a Dijkstra-style flood fill.

### Reach budget

- `budget = max(1, floor(population))`

### Travel costs

- base cost: 1 per step
- crossing province border on land: `+3`
- crossing state border on land: `+15`
- water cells still cost 1 and ignore province/state penalties

### Collection behavior

When a visited cell contains resources, they are added into `goodsPull`.

If the same good is collected from multiple cells, diminishing returns apply:

- first source adds full amount,
- later sources are reduced by `COLLECTION_DIVISOR = 3`.

After collection, that cell's stored amount is zeroed out in `cellPool`.

The burg then copies `goodsPull` into `remainingPool`, which is the resource budget used by actual
worker actions.

## Phase C: worker loop

Each burg gets up to `ceil(population)` worker ticks.

The last tick may be fractional:

```ts
fraction = min(1, population - workersUsed);
```

If no feasible action remains, the loop ends early.

## The two action kinds

### Extract

Feasible when:

- `remainingPool[goodId] > 0`

Execution:

- take `min(fraction, remainingPool[goodId])`
- apply culture modifier to output
- add result to inventory
- reduce `remainingPool`
- raise current buy price for that good

### Manufacture

Feasible when one recipe can be satisfied from:

- local inventory, and/or
- current global market stock

Execution order:

1. Consume ingredients from inventory first.
2. Buy any shortfall from global market.
3. Subtract purchase cost from `burg.wealth`.
4. Raise buy prices for purchased ingredient quantities.
5. Add manufactured output to inventory, with culture modifier.

Manufacturing itself does not change sell prices. Sell-price pressure happens later when final
inventory is sold to market.

## How the burg chooses actions

The current implementation is greedy.

At each worker tick, it scores every feasible extract action and every feasible manufacture action,
then picks the single best one.

There is no recursive search in the current code.

## Extract scoring

For every extractable raw good:

```ts
actualUnits = min(fraction, available)
chainValue = chainValueByWorkers[workerBucket][goodId]
score = chainValue × cultureModifier × demandMultiplier × actualUnits
```

Where `workerBucket` is based on remaining workers after the current fractional tick.

## Manufacture scoring

For every feasible recipe option:

```ts
revenue = currentSellPrice[out] × cultureModifier
ingredientCost = sum(recipeAmount × currentBuyPrice[ingredient])
score = (revenue - ingredientCost) × demandMultiplier × actualUnits
```

`actualUnits` is capped by both the fractional worker tick and the limiting ingredient quantity.

## Demand multiplier

Demand scoring is based on unmet demand from the burg's current inventory.

### Step 1: current coverage

The generator sums demand coverage from inventory across all categories.

### Step 2: remaining demand

For each category:

```ts
remainingDemand = max(0, target - currentCoverage);
```

### Step 3: candidate boost

For a candidate good:

```ts
boost += remainingDemand[category] × good.demandCoverage[category]
demandMultiplier = 1 + totalBoost
```

Important detail from the current implementation:

- the multiplier depends on category fit,
- it does not multiply the boost by produced unit count directly,
- produced units are applied later through the final `score × actualUnits` term.

So demand influences ranking strongly, but not as a full demand-quantity simulation.

## Chain heuristics

Raw extraction uses a precomputed heuristic called `chainValueByWorkers`.

This is not the same thing as profit and not the same thing as final action score.

It is built up to 5 workers as follows:

1. Start each good at base `good.value`.
2. For each worker bucket from 2 to 5:
3. For each manufactured good and each recipe:
4. Compute recipe cost from the previous bucket.
5. If recipe profit is positive, distribute that profit back into ingredient values proportionally.

The result is a cheap estimate of how useful a raw good is as a chain input when some workers still
remain.

## Phase D: selling final inventory

After the worker loop, the burg liquidates all remaining inventory into the market.

For each good in inventory:

1. Compute revenue using `currentSellPrice[goodId]`.
2. Add that quantity to `globalMarket`.
3. Lower `currentSellPrice[goodId]` by sell pressure.
4. Store rounded output in `burg.produced` for UI display.

After that, the generator computes summary metrics for the burg.

## Stored production metrics

Each burg snapshot stores these key output values:

### `phaseRevenue`

Total sale value of final inventory at the moment the burg finishes.

### `grossProduct`

```ts
grossProduct = phaseRevenue - purchasedIngredientCosts;
```

This is the cleanest profit-like metric for the run.

### `productPerCapita`

```ts
productPerCapita = grossProduct / population;
```

Used in the UI as the current meaning of “Wealth”.

### `wealthAfter`

The burg's cumulative cash-like value after:

- subtracting ingredient purchases during manufacturing,
- adding final sales revenue at the end.

This is still stored, but it is not the best summary metric for production quality.

## What the Production Overview snapshot contains

`BurgProductionData` includes:

- metadata: population, process rank, reachable cells, culture type
- `goodsPull`: accessible raw resources, with pull amount and chain heuristic
- `jobs`: executed actions with logs
- `finalInventory`: end-of-loop inventory before market sale
- `phaseRevenue`
- `grossProduct`
- `productPerCapita`
- `wealthAfter`

## What the job log means

Each logged tick stores:

- the chosen candidate,
- up to four alternatives,
- the total number of feasible candidates,
- for manufacture jobs, the per-ingredient split between inventory use and market purchases.

This is purely diagnostic data for the Production Overview dialog.

## Price pressure summary

| Event                          | Effect                    |
| ------------------------------ | ------------------------- |
| Extract raw locally            | raises `currentBuyPrice`  |
| Buy ingredients from market    | raises `currentBuyPrice`  |
| Sell final inventory to market | lowers `currentSellPrice` |
| Manufacture itself             | no direct price change    |

## What the system does not currently do

To avoid confusion, the current production system does not include:

- recursive planning or bounded lookahead,
- regional markets,
- consumer purchase simulation,
- transport or route-based shipping,
- a standalone buy-only action,
- an oversupply penalty in demand scoring.

## Practical one-sentence summary

The current production model is a fast greedy worker-by-worker simulator where each burg gathers
nearby raw materials, scores extract and manufacture actions using chain heuristics, explicit demand
coverage, and live prices, then sells all final output into a shared global market.
