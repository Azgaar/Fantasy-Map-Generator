# PRD — State Tariffs and Embargoes

## Problem Statement

Global trade (`Markets.runGlobalTrade`) currently models only exporter-side friction via `state.salesTax`. Importing states have no economic policy lever over foreign goods entering their markets:

1. **No import revenue**: High-volume imports generate tax for the exporting state, while the importing state collects nothing for its treasury.
2. **No protectionism or sanctions**: A state cannot protect domestic industries with targeted tariffs on specific goods, nor can it impose trade embargoes on rival or enemy states.
3. **Diplomacy is disconnected from trade**: Two states at war (`Enemy`) or in fierce competition (`Rival`) trade with each other on the exact same terms as close allies (`Ally`, `Vassal`).

## Goals

- Allow states to configure **import tariffs** and **embargoes** scoped to specific states (or `"all"`) and specific goods (or `"all"`).
- Store all state trade policies in a single compact `state.tariffs` rule list, with a default `0%` (`0`) baseline rule for all foreign states and goods.
- Seed initial tariff and embargo rules procedurally from diplomatic relations.
- Compile `tariffs` into a fast lookup table prior to `Markets.runGlobalTrade()` execution so hot-path trade evaluation stays $O(1)$.
- Enforce **bidirected embargoes** (if either state embargoes the other on a good, trade of that good between their markets is eliminated in both directions).
- Apply **most-specific-wins override precedence** for tariff rates on the importing state.
- Credit collected import tariffs (`deal.tariff`) to the buyer market's state treasury during `States.collectTaxes()`.
- Prune deleted or merged states and deleted goods from `state.tariffs` automatically so no empty or orphaned rules remain.
- Extend the States Editor **Taxes and Treasury** dialog to view tariff revenue and edit tariff/embargo rules.

## Non-goals

- Tariffs or embargoes on local trade (`burg ↔ market` within a market's territory).
- Changes to the Diplomacy Overview or Diplomacy Editor UI (diplomacy changes only affect trade when economy/trade is regenerated).
- Government-form-based tariff rate jittering (all states default to a flat `0` base tariff rule).
- Recurring economy ticks or dynamic retaliatory tariff loops.

## User Stories

1. As a worldbuilder, I want states to collect import tariffs on foreign goods sold into their markets, so that trade hubs and importing nations accumulate realistic treasury revenue.
2. As a worldbuilder, I want tariffs to increase the landed cost of foreign goods, so that high tariffs reduce international trade volume and raise local prices in the importing market.
3. As a worldbuilder, I want states at war (`Enemy`) to automatically embargo each other, so that warring nations do not freely trade resources during a conflict.
4. As a worldbuilder, I want allied and friendly states (`Ally`, `Friendly`, `Vassal`, `Suzerain`) to default to `0%` tariffs with each other, so that diplomatic blocs form natural free-trade zones.
5. As a worldbuilder, I want `Suspicion` and `Rival` relations to seed higher tariffs (`20%` and `30%`), so that political tension dampens cross-border commerce.
6. As a user editing a state's taxes, I want a single unified list of tariff and embargo rules covering all states/specific states and all goods/specific goods, so that I can express both broad policies and surgical sanctions without navigating a huge 2D matrix.
7. As a user, I want to group multiple states or multiple goods into a single rule (e.g., a `25%` tariff on all luxury goods, or an embargo on `Arms` and `Gunpowder`), so that the policy list stays short and readable.
8. As a user, I want more specific rules (e.g., an exemption or embargo on a single good from a single state) to override general rules, so that exceptions behave predictably.
9. As a user, I want embargoes to block trade in both directions between the two states for the covered goods, so that an embargo completely eliminates that trade flow.
10. As a user removing or merging states, or deleting a good, I want tariff rules referencing those entities to clean themselves up automatically, so that no broken references or empty rules remain.

## Data Model Changes

### `TariffRule` and `State` (`src/model/political/states-generator.ts`)

Each non-neutral `State` carries a `tariffs` array:

```typescript
export type TariffRule = {
  states: number[] | "all";
  goods: number[] | "all";
  rate: number | "embargo"; // e.g. 0.1 = 10% tariff, "embargo" = trade blocked
};
```

`State` interface addition:

| Field     | Type           | Notes                                                               |
| --------- | -------------- | ------------------------------------------------------------------- |
| `tariffs` | `TariffRule[]` | Ordered list of tariff/embargo rules; `[]` for Neutrals (state `0`) |

There is no separate `state.tariff` scalar; the baseline tariff for all foreign states and all goods is represented by `{ states: "all", goods: "all", rate: 0 }`. If no matching rule exists for a pair, the effective tariff rate is `0`.

### `Deal` (`src/model/economy/markets-generator.ts`)

`Deal` gains an optional `tariff` field alongside `tax`:

```typescript
export type Deal = {
  i: number;
  seller: number;
  sellerType: "burg" | "market";
  buyer: number;
  buyerType: "burg" | "market";
  good: number;
  units: number;
  price: number;
  tax: number; // exporter sales tax amount → credited to seller's state
  tariff?: number; // importer tariff amount → credited to buyer's state
};
```

## Procedural Seeding

Tariff rules are seeded from diplomatic relations at the end of `States.generateDiplomacy()` (and initialized with the default rule when a new state is founded):

| Diplomatic Relation                      | Generated Rule                                         | Effective Rate |
| ---------------------------------------- | ------------------------------------------------------ | -------------- |
| _(Default baseline)_                     | `{ states: "all", goods: "all", rate: 0 }`             | **0%**         |
| `Ally`, `Friendly`, `Vassal`, `Suzerain` | `{ states: [...ids], goods: "all", rate: 0 }`          | **0%**         |
| `Neutral`, `Unknown`                     | _(omitted — falls back to `"all"` / `"all"` baseline)_ | **0%**         |
| `Suspicion`                              | `{ states: [...ids], goods: "all", rate: 0.2 }`        | **20%**        |
| `Rival`                                  | `{ states: [...ids], goods: "all", rate: 0.3 }`        | **30%**        |
| `Enemy`                                  | `{ states: [...ids], goods: "all", rate: "embargo" }`  | **Embargo**    |

- Rules with an empty `states` list are not emitted, so each generated state has at most 5 rules.
- Neutral state (`i === 0`) always has `tariffs: []`.

## Implementation Decisions

### 1. Fast Pre-Indexed Lookup in `Markets.runGlobalTrade()`

To avoid scanning `state.tariffs` inside the inner `goods × exporters × importers` loop, `Markets.runGlobalTrade()` compiles all states' `tariffs` once before trading begins.

#### Specificity Tiers (Override Precedence)

For any single state's policy towards `(otherStateId, goodId)`, the most specific matching rule wins:

1. **Tier 1 (`states: number[]`, `goods: number[]`)**: Specific state + Specific good
2. **Tier 2 (`states: number[]`, `goods: "all"`)**: Specific state + All goods
3. **Tier 3 (`states: "all"`, `goods: number[]`)**: All states + Specific good
4. **Tier 4 (`states: "all"`, `goods: "all"`)**: All states + All goods
5. **Fallback**: `0` (if no rule matches)

Within the same tier, if two rules both match the same `(otherStateId, goodId)`, `"embargo"` takes precedence over a numeric rate; otherwise the later rule in `state.tariffs` wins.

#### Bidirected Embargo & Importer Rate Resolution

For a candidate trade of `good.i` from `exporter` (state `exporterStateId`) to `importer` (state `importerStateId`):

1. **Domestic trade (`exporterStateId === importerStateId`)**: Tariff is `0`, never embargoed.
2. **Bidirected embargo check**:
   - Evaluate `importerPolicy = resolveRule(importerStateId, exporterStateId, good.i)` (0 if `importerStateId === 0`).
   - Evaluate `exporterPolicy = resolveRule(exporterStateId, importerStateId, good.i)` (0 if `exporterStateId === 0`).
   - If `importerPolicy === "embargo" || exporterPolicy === "embargo"`, skip the trade opportunity.
3. **Tariff rate**:
   - `tariffRate = importerPolicy` (guaranteed `number >= 0`).

### 2. Landed Cost & Deal Execution

In `Markets.runGlobalTrade()`:

```
exporterTaxPerUnit = exporterState.salesTax × exporterPrice
tariffPerUnit      = tariffRate × exporterPrice
landedCost         = exporterPrice + transportCost + exporterTaxPerUnit + tariffPerUnit
unitProfit         = importerPrice − landedCost
```

- Both the initial opportunity filter and the greedy execution re-check use `landedCost` (including `tariffPerUnit`).
- When a trade executes, the recorded `Deal` sets:
  - `price = rn(landedCost, 2)`
  - `tax = rn(exporterTaxPerUnit * units, 2)`
  - `tariff = rn(tariffPerUnit * units, 2)` (omitted or `0` when `tariffPerUnit === 0`)
- Market stock and price pressure (`applyMarketPressure`) update as before. Because higher tariffs reduce or eliminate unprofitable trade opportunities, importing markets receive fewer units and maintain higher local prices.

### 3. Treasury Collection (`States.collectTaxes()`)

`States.collectTaxes()` walks `pack.deals` in a single pass:

- `deal.tax` credits `sellerStateId` (existing behavior).
- `deal.tariff` (when `> 0` and `deal.buyerType === "market"`) resolves `buyerStateId = pack.burgs[Markets.get(deal.buyer)?.centerBurgId]?.state || 0` and credits `states[buyerStateId].treasury += deal.tariff`.
- After summing deals and poll tax, each state's `treasury` is rounded to 2 decimals.

### 4. Entity Lifecycle & Pruning

Whenever states or goods are removed, `States.pruneTariffs({ states?: Iterable<number>, goods?: Iterable<number> })` cleans up all living states' `tariffs`:

- For each rule where `Array.isArray(rule.states)`, remove any state ID in the removed set (and also remove the owning state's own ID `state.i` so a state never targets itself after a merge). If `rule.states.length === 0`, remove the rule.
- For each rule where `Array.isArray(rule.goods)`, remove any good ID in the removed set. If `rule.goods.length === 0`, remove the rule.

Call sites:

- `States.remove(stateId)` — prunes `[stateId]`.
- `States.merge(rulingStateId, stateIds)` — prunes `stateIds`.
- `GoodsEditor` `removeGood(good)` — prunes `[good.i]`.

Validation / setter method on `StatesModule`:

- `States.setTariffs(stateId: number, tariffs: TariffRule[]): void` validates that `stateId` is a living non-neutral state, filters out invalid/removed state or good IDs and empty array rules, clamps numeric rates to `[0, 10]` rounded to 4 decimals, and assigns `state.tariffs`.

### 5. UI Design — Taxes and Treasury Dialog (`src/controllers/political/states-editor.ts`)

Clicking a state's Treasury cell in the States Editor opens `openTreasuryDialog(stateId)`:

1. **Summary Grid**:
   - `Sales Tax`: numeric input (`0`–`1`, step `0.01`) + `= 🟡 <salesTaxRevenue>`
   - `Poll Tax`: numeric input (`0`–`10`, step `0.01`) + `= 🟡 <pollTaxRevenue>`
   - `Tariffs`: read-only revenue total `🟡 <tariffRevenue>` (sum of `deal.tariff` where `buyerStateId === stateId`)
   - `Treasury`: numeric input (manual override)

2. **Tariffs and Embargoes Section**:
   - Header with `Tariffs and Embargoes` title, `Reset` button (`icon-arrows-cw`) to reset tariffs to defaults based on current diplomatic relations, and `+ Add` button (`icon-plus`).
   - Scrollable rule list where each row represents one `TariffRule`:
     - **States selector button**: Displays `"All states"` when `states === "all"`, or comma-separated state names (e.g., `"Slavikos, Restia"` or `"Slavikos +2"`). Clicking opens a checklist dialog of all active foreign states (with `<fill-box>` color + name) plus an `"All states"` checkbox at the top.
     - **Goods selector button**: Displays `"All goods"` when `goods === "all"`, or comma-separated good names. Clicking opens a checklist dialog of all goods rendered with their SVG good icons and badges (via `goodBadge(good)`) plus an `"All goods"` checkbox at the top.
     - **Policy type & rate**: `<select>` with `Tariff` and `Embargo` options. When `Tariff` is chosen, a numeric input (`min="0" max="10" step="0.01"`) is shown; when `Embargo` is chosen, the numeric input is hidden.
     - **Delete button**: `icon-trash-empty` removes the rule row.
   - **Apply**: Saves `salesTax`, `pollTax`, `treasury`, and calls `States.setTariffs(stateId, rules)`.
   - **Tooltip on state row in States Editor**: Includes tariff revenue or base tariff summary alongside Sales Tax and Poll Tax.

### 6. Backward Compatibility (`src/services/io/auto-update.ts`)

When loading a map older than the release version (or any state where `!Array.isArray(state.tariffs)`):

- Run `States.defineTariffs(state)` for each living non-neutral state to seed `state.tariffs` from its existing `state.diplomacy` relations, and set `state.tariffs = []` for state `0`.

## Testing Decisions

Good tests verify observable outputs (deals produced, prices recorded, treasury balances, and pruned rules) against known inputs without coupling to private lookup structures.

### Modules to Test

1. **`MarketsModule.runGlobalTrade` (`src/model/economy/markets-generator.test.ts`)**:
   - Base `all`/`all` tariff increases `deal.price` by `tariffRate × exporterPrice`, records `deal.tariff`, and skips trades that become unprofitable under the tariff.
   - Domestic market-to-market trade (`exporterState === importerState`) applies `0` tariff and ignores embargoes.
   - Override precedence: `states[] + goods[]` > `states[] + "all"` > `"all" + goods[]` > `"all" + "all"`.
   - Bidirected embargo: an `"embargo"` rule on either the importer state or the exporter state blocks trade of the covered good(s) in both directions while leaving other goods/states unaffected.

2. **`StatesModule` (`src/model/political/states-generator.test.ts`)**:
   - `States.collectTaxes()` credits `deal.tax` to the exporter state's treasury and `deal.tariff` to the importer state's treasury.
   - `States.defineTariffs()` seeds the `0` baseline plus `0` (`Ally`/`Friendly`/`Vassal`/`Suzerain`), `0.2` (`Suspicion`), `0.3` (`Rival`), and `"embargo"` (`Enemy`), omitting `Neutral` and `Unknown`.
   - `States.remove()` and `States.merge()` prune removed state IDs from other states' `tariffs` and drop rules whose `states` array becomes empty.
   - `States.setTariffs()` validates and normalizes rules.

## Out of Scope

- Local burg-to-market tariffs or cross-border market territory restrictions during `Markets.expandMarkets()`.
- Editing tariffs from the Diplomacy Overview, Diplomacy Editor, or Goods Editor.
- Automatic regeneration of tariffs when a single diplomatic relation is painted in the Diplomacy Editor (tariffs are seeded on diplomacy generation and edited in the Taxes & Treasury dialog).

## Acceptance Criteria

1. After state and diplomacy generation, every non-neutral state has `state.tariffs` seeded with `{ states: "all", goods: "all", rate: 0 }` and relation-based state rules (`0` for `Ally`/`Friendly`/`Vassal`/`Suzerain`, `0.2` for `Suspicion`, `0.3` for `Rival`, `"embargo"` for `Enemy`).
2. During `Markets.runGlobalTrade()`, cross-state trades apply the importer's most-specific matching tariff rate to `landedCost` and record `deal.tariff = rn(tariffPerUnit * units, 2)`.
3. Any trade where either the exporter state or importer state resolves to `"embargo"` for that good is not executed.
4. `States.collectTaxes()` adds `deal.tariff` to the buyer market's state treasury.
5. Removing or merging states, or removing a good, removes its ID from all `state.tariffs` rules and deletes any rule whose `states` or `goods` array becomes empty.
6. The Taxes and Treasury dialog in the States Editor displays collected tariff revenue and allows adding, editing, and removing `TariffRule` entries (with multi-select popups for states and goods).
7. Loading an older `.map` file populates `state.tariffs` from existing diplomatic relations without errors.
