# State Taxes & Treasury

Money lives in two places: `burg.treasury` and `state.treasury`. Markets hold none. Burgs pay every trade tax, inside the prices they pay or get; `States.collectTaxes()` then credits the amounts recorded on deals to state treasuries, and adds a poll tax nobody is charged for. It runs once per production cycle; there are no recurring ticks, no spending, no compounding.

## Who pays whom

Every deal is a burg trading with a market (see [trade_schema.md](trade_schema.md)). A burg sells only to its own market, and buys from its own market or, when that lacks the good, imports from another. One rule covers every sale: **the seller's state levies sales tax**. A market holds no money, so when it is the seller the tax goes into the price: the market owes it on paper, the burg pays it.

| Deal | Seller | Buyer | Sales tax: rate of, paid to | Tariff: rules of, paid to | Paid by |
| --- | --- | --- | --- | --- | --- |
| Sale | burg | its market | the burg's state | none | the burg, out of its revenue |
| Buy | its market, or another market of the same state | burg | the market's state | none | the burg, inside its buy price |
| Import | a market of another state | burg | that market's state | the state of the burg's own market | the burg, inside its buy price |
| Poll tax | — | — | — | — | nobody: the state gets it outright |

A market's state is the state of its center burg. A purchase is an import (`Markets.isImport`) when the selling market's state differs from the state of the burg's own market; only then may a tariff apply. The tariff follows the burg's own market, not the burg, so a burg in a market centered across a border pays that state's tariff.

A good is taxed at every sale: a burg's product when the burg sells it to its market, and again when a burg buys it. Raw goods from rural cells enter markets untaxed and are taxed when burgs buy them.

## Sales tax (`state.salesTax`)

A rate in `[0, 1]`, levied by the seller's state on the seller's price. `MARKET_MARGIN` is 5%.

**Sale.** The burg sells at its market's sell price less the carriage to its center, and the tax comes off what it gets:

    price   = marketPrice × (1 − MARKET_MARGIN) − carriagePerUnit
    tax     = units × price × burgState.salesTax
    revenue = units × price − tax          → burg.treasury

**Buy, local or import.** The selling market's state taxes the market's price. On an import the tariff joins it. Both are added after the margin, with the carriage from the selling market's center to the burg:

    taxPerUnit    = sellerState.salesTax × sellerPrice
    tariffPerUnit = tariffRate × sellerPrice                  (imports only)
    buyPrice      = sellerPrice × (1 + MARKET_MARGIN) + taxPerUnit + tariffPerUnit + carriagePerUnit
    deal.tax      = taxPerUnit × units
    deal.tariff   = tariffPerUnit × units

The burg pays `units × buyPrice`. The cheapest source is the one with the lowest `buyPrice`, so a high-tax state's markets lose foreign buyers.

## Import tariffs (`state.tariffs`)

An array of tariff and embargo rules `TariffRule[]`. The rules of the importing state — the state of the burg's own market — set the rate on goods coming from another state's market:

    tariffPerUnit = tariffRate × sourcePrice
    deal.tariff   = tariffPerUnit × units

- **Same state**: markets of one state trade with no tariff and are never embargoed.
- **Baseline rate**: `0` for all foreign states and goods (`{ states: "all", goods: "all", rate: 0 }`).
- **Seeding from diplomacy**: Allied/Friendly/Vassal/Suzerain states seed `0%`, Suspicion seeds `20%`, Rival seeds `30%`, and Enemy seeds `"embargo"`.
- **Precedence**: Specific state + specific good > specific state + all goods > all states + specific good > all states + all goods.
- **Embargo**: if either state's rules resolve to `"embargo"` for the good, the source is ruled out; burgs of neither state import that good from the other's markets.

## Example

States A and B levy 15% sales tax; A's tariff on B is 20%. Every trade is 10 units of a good priced 10 at the selling market, carried 0.5 per unit.

| Trade | Price per unit | Burg pays / gets | State A gets | State B gets |
| --- | --- | --- | --- | --- |
| A's burg buys from its A market | 10 × 1.05 + 1.5 + 0.5 = 12.5 | pays 125 | 15 sales tax | — |
| A's burg imports from a B market | 10 × 1.05 + 1.5 + 2 + 0.5 = 14.5 | pays 145 | 20 tariff | 15 sales tax |
| A's burg sells to its A market | 10 × 0.95 − 0.5 = 9 | gets 90 − 13.5 = 76.5 | 13.5 sales tax | — |

## Poll tax (`state.pollTax`)

A flat levy per population point, once per cycle: `pollTax × (state.rural + state.urban)`. It is not deducted from any burg or cell; the money simply appears in the state treasury, matching the frozen-cycle economy.

## Rate generation

Rates are seeded from `state.form` at state form assignment (in `States.defineStateForms`) and jittered per state via `gauss(base, base × 0.15, base × 0.5, base × 1.5)` rounded to 2 decimals. Tariffs are seeded in `States.defineTariffs(state)` based on diplomatic relations.

| Form      | Sales Tax base | Poll Tax base | Base Tariff |
| --------- | -------------- | ------------- | ----------- |
| Monarchy  | 0.15           | 0.20          | 0.00        |
| Theocracy | 0.25           | 0.10          | 0.00        |
| Union     | 0.07           | 0.13          | 0.00        |
| Republic  | 0.05           | 0.15          | 0.00        |
| Anarchy   | 0.00           | 0.00          | 0.00        |

Anarchy collapses to exactly 0 for taxes. Neutrals (state 0) always have tax rates 0, empty tariffs `[]`, and treasury 0.

## Collection (`States.collectTaxes`)

Run by the generation pipeline after `Production.produce()`:

1. Reset every non-neutral state's `treasury` to 0.
2. For each deal, `Markets.getTaxStates(deal)` names the states as in the table above: `deal.tax` goes to the burg's state on a sale and to the source market's state on an import, `deal.tariff` to the state of the burg's own market. Neutrals get nothing.
3. For each non-neutral state, add `pollTax × (rural + urban)` to its treasury.

This is the only writer of `state.treasury` outside the editor (which can also write via the Treasury dialog manual override).

## Editor surface

The States Editor exposes a Treasury column. Clicking a treasury value opens a dialog with editable `salesTax`, `pollTax`, `treasury`, read-only revenue breakdown (including collected tariffs), and a **Tariffs and Embargoes** rule list with multi-select state and good popups. Edits take effect on the next production regeneration.

The Burg Editor exposes `burg.treasury` the same way: the field is editable, and the value the user enters stands until the next production run overwrites it. Nothing recalculates production, deals or the owning state's treasury to match — a hand-set balance is an assertion about the burg, not a transaction.

## Backward compatibility

When loading an older save (`auto-update.ts`), the migration runs `States.defineTaxRates(state)` and `States.defineTariffs(state)` for every non-neutral state and resets `treasury = 0`. Custom rules can subsequently be configured in the Treasury dialog.

## Out of scope

- Recurring economy ticks / yearly cycle accumulation.
- Spending (administration cost, military upkeep, corruption).
- Per-`formName` modifiers or per-state-type modifiers.

## Sources

- [`src/model/political/states-generator.ts`](../../src/model/political/states-generator.ts) — rate generation, `collectTaxes`
- [`src/model/economy/markets-generator.ts`](../../src/model/economy/markets-generator.ts) — `sell`, `getTradeTerms`, `importForBurg` and `getTaxStates`
- [`src/model/economy/production-generator.ts`](../../src/model/economy/production-generator.ts) — sale revenue net of tax
- [`src/controllers/political/states-editor.ts`](../../src/controllers/political/states-editor.ts) — Treasury column + dialog
- [`src/services/io/auto-update.ts`](../../src/services/io/auto-update.ts) — migration
