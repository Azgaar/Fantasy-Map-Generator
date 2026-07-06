# PRD — State Taxes & Treasury

## Background

Today's tax model has two gaps:

1. Every state shares a hard-coded `salesTax = 0.2`, with no link to its political form.
2. Sales tax is deducted from burg revenue and then **discarded** — no entity ever receives it.

Global market-to-market trade is also tax-free, so high-volume long-distance flows generate no state income, and there is no mechanism for a state to fund anything (treasury, military, administration).

This PRD introduces a State Treasury fed by two taxes (sales + poll), with rates derived from `state.form`.

## Goals

- States accumulate a serialized treasury balance.
- Sales tax (local + global) accrues to the seller's state treasury.
- A new poll tax accrues per population point.
- Tax rates are generated from `state.form` at state generation, jittered per state, editable from the States Editor.
- Neutrals (state 0) pay/collect no tax.

## Non-goals

- Ticking / recurring production. Economy stays frozen at a single post-generation cycle.
- Spending mechanics (corruption, administration, military upkeep) — flagged for future work.
- Type-based or formName-based rate modifiers.

## Data model changes

`State` gains three persisted fields:

| Field | Type | Notes |
|---|---|---|
| `salesTax` | `number` | already exists; now generated, not constant |
| `pollTax` | `number` | NEW — flat currency per population point |
| `treasury` | `number` | NEW — accumulated balance |

`Deal` gains one optional persisted field:

| Field | Type | Notes |
|---|---|---|
| `tax` | `number` (optional) | sales tax amount applied to the deal, in currency units |

## Tax rate generation

At state generation, each state's rate is drawn from:

```
rate = round(gauss(base, base × 0.15, base × 0.5, base × 1.5), 2)
```

Anarchy stays at exactly 0 (gauss collapses).

| Form | Sales Tax (base) | Poll Tax (base) |
|---|---|---|
| Monarchy | 0.15 | 0.20 |
| Theocracy | 0.25 | 0.10 |
| Union | 0.07 | 0.13 |
| Republic | 0.05 | 0.15 |
| Anarchy | 0.00 | 0.00 |

Neutrals (state 0): both 0 unconditionally.

## Sales tax mechanics

### Local sale (burg → market)

Already implemented as a deduction from burg revenue in `production-generator.ts:218`. Behavior unchanged here:

```
tax = state.salesTax × units × dealPrice
burg.treasury -= grossRevenue            // existing
burg.treasury += (grossRevenue − tax)    // existing
```

The deal records `tax` on `Deal.tax` so `States.collectTaxes()` can credit it later without re-resolving rates.

### Global sale (market → market)

Tax is **added to the landed cost** during `Markets.runGlobalTrade()`'s profitability check:

```
exporterTaxPerUnit = exporterState.salesTax × exporterPrice
landedCost         = exporterPrice + transportCost + exporterTaxPerUnit
unitProfit         = importerPrice − landedCost
```

If the trade executes, the deal records:
- `price = landedCost` (the importer's effective per-unit cost)
- `tax = exporterTaxPerUnit × units`

High-tax states therefore become poorer exporters. Trade profitability constants (`MIN_PROFIT`, `DISTANCE_COST_FACTOR`) may need tuning to keep global trade viable under the new friction.

### Pricing / animation impact

The recorded global-trade `price` shifts upward to include the tax. The trade-details dialog reads `deal.price × units` for total value, which now reflects what the importer paid (gross of exporter tax). The exporter's notional take is `price − transportCost/unit − tax/unit`, but markets have no treasury so this is informational only.

## Poll tax mechanics

A single post-cycle pass:

```
revenue = state.pollTax × (state.rural + state.urban)
state.treasury += revenue
```

No deduction from any burg or rural source — the money simply appears, matching the frozen-tick model. (Same shape as how trade tax revenue used to evaporate, now reversed.)

## `States.collectTaxes()`

A new method on `StatesModule`, invoked from `public/main.js` after `Production.produce()`. Single post-cycle pass:

1. For each state with `i > 0`: reset `treasury = 0`.
2. Walk `pack.deals`:
   - If `deal.sellerType === "burg"`: credit `deal.tax` to `pack.burgs[deal.seller].state`'s treasury.
   - If `deal.sellerType === "market"`: credit `deal.tax` to the exporter market's center burg's state.
   - Deals with no `tax` (e.g., buys, demand-fill purchases) contribute 0.
3. For each state with `i > 0`: `treasury += pollTax × (rural + urban)`.
4. Skip state 0 (Neutrals) — always 0 treasury.

This is the **only** writer of `state.treasury` from the generator (the editor can also write via manual override — see UI section).

## States Editor

### New "Treasury" column

- Read-only cell text showing `state.treasury`.
- Cell click opens a per-state Treasury dialog.

### Treasury dialog

Fields:

| Field | Editable | Notes |
|---|---|---|
| Sales Tax rate | yes | `0.00–1.00` |
| Poll Tax rate | yes | `0.00–10.00` (loose upper bound; tweakable) |
| Treasury balance | yes | manual override |
| Breakdown — Sales Tax revenue | no | summed from `pack.deals` `tax` where this state collected |
| Breakdown — Poll Tax revenue | no | `pollTax × (rural + urban)` |

Tooltip on rate inputs: **"Changes take effect when production is next regenerated. (TODO: 'Regenerate Production' action.)"**

Neutrals: dialog hidden or all fields read-only at 0.

## Backward compatibility

Handled in `public/modules/dynamic/auto-update.js`:

- `state.treasury` missing → set to `0`.
- `state.pollTax` missing → backfill from the form-based table (no jitter on load).
- `state.salesTax` present → **overwrite** from the form-based table (no jitter on load).

This rebalances pre-existing saves to the new model; users keep their world but lose any custom per-state sales tax that had been edited under the old default-0.2 regime.

## Out of scope / future work

- **Regenerate Production action** — referenced in editor tooltip, not built.
- **Spending** — corruption levels, administration cost, military upkeep deducting from treasury.
- **Recurring economy ticks** — yearly cycle, accumulating treasury, population growth feedback.
- **formName / type modifiers** — finer-grained rates (e.g., Trade Republic ≠ Most Serene Republic).
- **Import tariffs** — only exporter-side tax in this PRD.

## Files affected

### Modified

- `src/generators/states-generator.ts` — replace `DEFAULT_SALES_TAX` with form-based generation for both `salesTax` and `pollTax`; add `treasury` init to 0; add `collectTaxes()` method to `StatesModule`; update `State` interface.
- `src/generators/markets-generator.ts` — `runGlobalTrade` adds exporter tax to landed cost; populates `deal.tax` for market deals.
- `src/generators/production-generator.ts` — populates `deal.tax` for burg sells (already computes the value, just persist it).
- `src/generators/markets-generator.ts` (Deal type) — add optional `tax` field.
- `public/main.js` — call `States.collectTaxes()` after `Production.produce()`.
- `public/modules/dynamic/auto-update.js` — migrate `salesTax`, `pollTax`, `treasury`.
- States Editor (location TBD — likely `public/modules/dynamic/editors/states-editor.js`) — add Treasury column + dialog.
- `src/controllers/markets-overview.ts` — update tax computation for market→market deals to read `deal.tax` rather than re-deriving from burg rate.
- `src/controllers/production-overview.ts` — `getDealTax(deal)` can now read `deal.tax` directly.

### Docs

- `docs/domain/glossary.md` — add Treasury, Sales Tax, Poll Tax entries.
- `docs/domain/trade_schema.md` — update sell phase / global redistribution sections; remove "No sales tax on inter-market trade" claim.
- `docs/architecture/data_model.md` — add `salesTax`, `pollTax`, `treasury` to State; add `tax?` to Deal.
- `docs/domain/taxes.md` — NEW short domain doc.
- `CONTEXT.md` — minor Domain Knowledge addition.

### Tests

- `src/generators/markets-generator.test.ts` — global trade tax affects landed cost; deal records `tax`.
- New test for `States.collectTaxes()` — single state, mixed local/global deals, poll tax credit.

## Acceptance criteria

1. After regeneration, every non-neutral state has non-zero `salesTax` and `pollTax` derived from its form, jittered per state.
2. After production, `state.treasury` for any non-neutral state equals `sum(deal.tax for deals where seller's state == this state) + pollTax × (rural + urban)`.
3. Global trade deals carry `deal.tax`, and `runGlobalTrade` skips opportunities that become unprofitable once tax is added to landed cost.
4. Neutrals (state 0): treasury stays 0; no taxes collected on neutral burg deals.
5. Loading an old `.map` populates the three new/changed fields per the migration rules; the States Editor shows non-zero treasury after the next production run.
6. States Editor displays Treasury column; click opens dialog with editable rates and treasury override.
