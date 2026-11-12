import { sum } from "d3";
import { EXPENSES, type Expense } from "@/data/expenses";
import { PROSPERITY_LEVEL_LABELS } from "@/data/id-labels";
import { Accounts, type ProvinceAccounts, type StateAccounts } from "@/model/economy/accounts";
import { Corruption } from "@/model/economy/corruption";
import { DEAL_KINDS, Deals } from "@/model/economy/deals";
import { DEMAND_PRIORITY, DEMAND_TARGET_FACTORS } from "@/model/economy/demand";
import { Goods } from "@/model/economy/goods-generator";
import { Markets } from "@/model/economy/markets-generator";
import { type Living, Prosperity, type ProsperityLevel } from "@/model/economy/prosperity";
import { StateOrders } from "@/model/economy/state-orders";
import { Taxes } from "@/model/economy/taxes";
import { Trade } from "@/model/economy/trade";
import type { Burg } from "@/model/political/burgs-generator";
import { Stability } from "@/model/political/stability";
import { formatPrice, getDecima, getDistance } from "@/model/units";
import type { Deal, DealKind, Good, Transaction } from "@/types/economy";
import { wiki } from "@/utils/common-utils";
import { Catalog, sentences, t } from "@/utils/i18n";
import { ensureEl } from "@/utils/node-utils";
import { rn } from "@/utils/number-utils";
import { escapeHtml } from "@/utils/string-utils";

export const ECONOMY_COLORS = {
  positive: "#1b7a43", // money gained: income, surpluses, exports; the .positive class in index.css
  negative: "#a34a14", // money paid out: costs, deficits, imports; the .negative class in index.css
  spent: "var(--header)", // a share of a state's taxes its expenses spend
  pocketed: "#b4b4b4", // the part officials pocket
  empty: "#e8e8e8"
};

/** Badge colors by kind, [background, text]: where goods come from and what a burg did with them */
export const BADGE_COLORS = {
  local: ["#d9e7f5", "#346"],
  buy: ["#f5d9d6", "#a33"],
  mfg: ["#f8e7bf", "#b67a00"],
  sell: ["#dff0e2", "#2f8a46"],
  keep: ["#e6e0f2", "#5a4a8a"],
  need: ["#e4e4e4", "#555"]
} as const;

export const tone = (value: number) => (value >= 0 ? "positive" : "negative");

/** CSS background on a 0–100% track: the part spent, officials' part grayed, the rest empty */
export function budgetBackground(share: number, corruption: number, color = ECONOMY_COLORS.spent): string {
  const kept = (share * (100 - corruption)) / 100;
  const { pocketed, empty } = ECONOMY_COLORS;
  return `linear-gradient(to right, ${color} 0 ${kept}%, ${pocketed} ${kept}% ${share}%, ${empty} ${share}% 100%)`;
}

// One definition per economy term, shared by every view's tooltips

export const EconomyTerms = {
  product: () => t("Product: sales less taxes and ingredients"),
  stateProduct: () => t("Product: what the state's people make in a day"),
  wealth: () => t("Wealth: product per person"),
  treasury: () => t("Balance: the burg's money at the end of the day"),
  burgAdjustments: () => t("Adjustments: the burg's revenue or costs a day besides trade, set by you"),
  stateTreasury: () => t("Balance: the day's taxes less the state's expenses"),
  adjustments: () => t("Adjustments: the state's revenue or costs a day besides taxes, set by you"),
  budget: () => t("Expenses: the shares of its taxes the state spends"),
  expenseTip: (expense: Expense) =>
    ({
      court: t("Court and clergy: luxuries the state buys at its capital"),
      administration: t("Administration: utilities the state buys at its provinces' capitals"),
      infrastructure: t("Infrastructure: construction goods the state buys at its provinces' capitals"),
      military: t("Military: military goods and food the state buys at its capital")
    })[expense],
  prosperity: () => t("Prosperity: how well the people live"),
  open: () => t("Click to open the economy overview"),
  openValue: () => t("Click a value to open the economy overview"),
  noData: () => t("No economy data yet. Regenerate the economy first"),
  table: () => t("Show all as a table"),
  corruption: () => t("Corruption: the share of state spending officials pocket"),
  upkeep: () => t("Upkeep: how well the state's military spending keeps its forces"),
  stability: () => t("Stability: how firmly the state holds together"),
  collected: (paid: number, owed: number) =>
    t("{{share}}% of {{owed}} collected", { share: rn((paid / owed) * 100), owed: formatPrice(owed) })
};

export const economyWikiButton = (id: string) =>
  /* html */ `<button id="${id}" type="button" data-tip="${t("Open the Economy wiki page")}" class="icon-info"></button>`;

/** Call once the button is in the page */
export const bindEconomyWiki = (id: string) => ensureEl(id).addEventListener("click", () => wiki("Economy"));

const PROSPERITY_COLORS: Record<ProsperityLevel, string> = {
  Desolate: "#8a1f1f",
  Destitute: "#a33",
  Poor: "#b65e1f",
  Modest: "#9a7a1a",
  Comfortable: "#6a8a2a",
  Thriving: "#3a8a3a",
  Affluent: "#2a7a6a",
  Opulent: "#2a5a9a",
  Splendid: "#5a3a9a",
  Peerless: "#8a2a8a"
};

export const prosperityLevel = (prosperity: number) => PROSPERITY_LEVEL_LABELS[Prosperity.getLevel(prosperity)];
export const prosperityColor = (prosperity: number) => PROSPERITY_COLORS[Prosperity.getLevel(prosperity)];

/** "57%, Thriving" */
export const renderProsperity = (prosperity: number) => `${rn(prosperity * 100)}%, ${prosperityLevel(prosperity)}`;

/** "57%", for narrow cells */
export const renderProsperityPercent = (prosperity: number) => `${rn(prosperity * 100)}%`;

/** Its three parts, for one line next to the level */
export function renderProsperityParts(living: Living): string {
  return t("needs met {{needs}}%, comfort ×{{comfort}}, {{variety}} goods, infrastructure {{infrastructure}}%", {
    needs: rn(living.needs * 100),
    comfort: rn(living.comfort, 1),
    variety: rn(living.variety, 1),
    infrastructure: rn(living.infrastructure * 100)
  });
}

export function prosperityTip(prosperity: number): string {
  return t("Prosperity: {{level}}", { level: prosperityLevel(prosperity) });
}

/** A trade's price split per unit; the recorded price holds carriage and, on imports, the taxes */
export function splitDealPrice({ units, price, tax, tariff = 0, carriage = 0 }: Transaction, isSale: boolean) {
  const perUnit = (total: number) => (units ? total / units : 0);
  const unitTax = perUnit(tax);
  const unitTariff = perUnit(tariff);
  const terms: [string, number][] = [
    [t("Carriage"), carriage],
    [t("Sales Tax"), unitTax],
    [t("Tariff"), unitTariff]
  ];
  const added = terms.reduce((sum, [, value]) => sum + value, 0);

  // a purchase pays them on top of the goods' price; a sale gets the goods' price less them
  const goodsPrice = isSale ? price + carriage : price - added;
  const value = isSale ? units * price - tax - tariff : units * price;

  const sign = isSale ? "−" : "+";
  const shown = terms
    .filter(([, amount]) => rn(amount, 2))
    .map(([label, amount]) => ` ${sign} ${label} ${formatPrice(rn(amount, 2))}`);
  const income = isSale ? value : -value;
  const split = `(${t("Net")} ${formatPrice(rn(goodsPrice, 2))}${shown.join("")}) × ${rn(units, 2)}`;
  const formula = `${isSale ? "" : "−"}${split} = ${formatPrice(rn(income, 2))}`;
  return { goodsPrice, carriage, tax: unitTax, tariff: unitTariff, value, formula };
}

/** The route distance the carriage is paid for, in decimas and the map's distance unit */
export const carriageDistance = (decimas: number) =>
  t("Carriage distance: {{decimas}} decima ({{distance}})", {
    decimas: rn(decimas, 2),
    distance: getDistance(decimas * getDecima())
  });

/** Per-unit tariff: shown even at zero on an import, a dash where none applies */
export const tariffCell = (tariff: number, isImport: boolean) =>
  isImport ? money(tariff, false) || formatPrice(0) : "—";

/** A per-unit amount toned by whether it adds to the burg's money; blank when zero */
export function money(amount: number, adds: boolean): string {
  if (!rn(amount, 2)) return "";
  return `<span class="${adds ? "positive" : "negative"}">${formatPrice(rn(amount, 2))}</span>`;
}

export const tradeColumnTips = () => ({
  units: t("Units traded"),
  net: sentences(t("Net unit price"), t("Market price before carriage and taxes")),
  carriage: sentences(t("Carriage per unit"), t("Transportation price between the market and the burg")),
  tax: sentences(t("Sales tax per unit"), t("Paid by the seller to its state")),
  tariff: sentences(t("Import tariff per unit"), t("Paid by the burg to the importing market's state")),
  income: sentences(t("Burg total revenue"), t("Positive on a sale, negative on a purchase"))
});

/** A burg's trade with a market: its route, whether it is an import, the states its taxes go to */
export function getTradeContext(
  burgId: number,
  marketId: number,
  goodId: number,
  kind: DealKind,
  carriage = 0,
  tariff = 0
) {
  const burg = pack.burgs[burgId];
  const market = Markets.get(marketId);
  const deal: Deal = [burgId, marketId, goodId, kind, 0, 0, 0, tariff, 0];
  const { taxState, tariffState } = Taxes.getTaxStates(deal);
  const carriageFactor = market && burg ? Trade.getCarriageFactor(market, burg) : 1; // dearer from another state's market
  const measured = market && burg ? Trade.getDecimas(market, burg) : 0; // carried between the market and the burg
  // a route removed since the run: the distance the deal paid for
  const paidFor = carriage / ((Goods.get(goodId)?.carriage || 0) * carriageFactor);
  return {
    decimas: Number.isFinite(measured) ? measured : Number.isFinite(paidFor) ? paidFor : 0,
    carriageFactor,
    isImport: Taxes.isImport(deal),
    tariffRate: Taxes.getDealTariffRate(deal),
    taxStateId: taxState,
    tariffStateId: tariffState
  };
}

type TradeCell = ReturnType<typeof getTradeContext> & {
  good: Good;
  units: number;
  net: number; // the rest per unit
  carriage: number;
  tax: number;
  tariff: number;
  formula: string;
};

export function tradeCellTips(cell: TradeCell) {
  const {
    good,
    units,
    net,
    carriage,
    tax,
    tariff,
    decimas,
    carriageFactor,
    isImport,
    taxStateId,
    tariffStateId,
    tariffRate,
    formula
  } = cell;
  const price = (amount: number) => formatPrice(rn(amount, 2));
  const state = (stateId: number) => pack.states[stateId]?.name || "";
  const rate = (value: number) => `${t("Rate")}: ${rn(value * 100, 1)}%`;

  return {
    units: `${t("Units traded")}: ${countUnits(units, good.unit)}`,
    net: sentences(
      `${t("Net unit price")}: ${price(net)}`,
      t("Market price before carriage and taxes"),
      `${t("Base good price")}: ${price(good.value)}`
    ),
    carriage: sentences(
      `${t("Carriage per unit")}: ${price(carriage)}`,
      t("Transportation price between the market and the burg"),
      t("{{decimas}} decima × {{price}} per decima", {
        decimas: rn(decimas, 2),
        price: price(good.carriage * carriageFactor)
      })
    ),
    tax: taxStateId
      ? sentences(
          `${t("Sales tax per unit")}: ${price(tax)}`,
          t("Paid by seller to state: {{- state}}", { state: state(taxStateId) }),
          rate(pack.states[taxStateId]?.economy.salesTax || 0)
        )
      : t("No sales tax: neutral lands levy none"),
    tariff: isImport
      ? sentences(
          `${t("Import tariff per unit")}: ${price(tariff)}`,
          t("Paid by the burg to the importing state: {{- state}}", { state: state(tariffStateId) }),
          rate(tariffRate)
        )
      : t("No tariff: not an import from another state"),
    income: `${t("Burg total revenue")}: ${formula}`
  };
}

/** The good's unit for a count; unit names are English data, so only English pluralizes them */
export function unitFor(count: number, unit: string): string {
  if (!unit || count === 1 || Catalog.language !== "en") return unit;
  return `${unit}${/(s|x|z|ch|sh)$/.test(unit) ? "es" : "s"}`;
}

function countUnits(units: number, unit: string): string {
  const count = rn(units, 2);
  return unit ? `${count} ${unitFor(count, unit)}` : String(count);
}

// Adjustments: one collapsible row with their total, the lines beneath

type Adjustment = { name: string; value: number };

const ADJUSTMENTS_STYLE = /* css */ `<style>
  .adjustments .head { display: grid; grid-template-columns: 1fr auto; cursor: pointer }
  .adjustments .lines { margin: 0.15em 0 0.2em 1em }
  .adjustments .line { display: grid; grid-template-columns: 1fr 6.5em 1.2em; column-gap: 0.3em; align-items: center; margin-bottom: 0.15em }
  .adjustments button.add { font-size: 0.8em; padding: 0 0.4em }
</style>`;

let expanded = false; // the last choice, kept for the next row shown

/** Fills the container; onChange gets the lines after every edit, a value being typed as 0 */
export function mountAdjustments(
  container: HTMLElement,
  initial: Adjustment[],
  tip: string,
  onChange: (adjustments: Adjustment[]) => void,
  formatTotal = formatPrice
): void {
  const lines = initial.map(line => ({ ...line }));
  const renderHead = () => {
    const total = sum(lines, line => line.value);
    const count = lines.length ? ` (${lines.length})` : "";
    return `<span>${expanded ? "▾" : "▸"} ${t("Adjustments")}${count}</span><span class="${total > 0 ? "positive" : total < 0 ? "negative" : ""}">${formatTotal(total)}</span>`;
  };
  const render = () => {
    const rows = lines.map(
      ({ name, value }, k) => /* html */ `<div class="line" data-index="${k}">
        <input class="name" type="text" style="width: 100%; margin: 0" value="${escapeHtml(name)}" placeholder="${t("Name")}"/>
        <input class="value" type="number" step="0.01" style="width: 100%; margin: 0; text-align: right" value="${value}" data-tip="${t("Amount a day; negative for a cost")}"/>
        <span class="icon-trash-empty pointer remove" data-tip="${t("Remove")}"></span>
      </div>`
    );
    container.innerHTML = /* html */ `${ADJUSTMENTS_STYLE}<div class="adjustments">
      <div class="head" data-tip="${tip}">${renderHead()}</div>
      <div class="lines" ${expanded ? "" : "hidden"}>${rows.join("")}
        <button type="button" class="add icon-plus" data-tip="${t("Add revenue or a cost")}">${t("Add")}</button>
      </div>
    </div>`;
  };
  const changed = () => {
    container.querySelector(".head")!.innerHTML = renderHead();
    onChange(lines.map(line => ({ ...line })));
  };

  container.addEventListener("input", event => {
    const input = event.target as HTMLInputElement;
    const line = lines[+(input.closest<HTMLElement>(".line")?.dataset.index ?? -1)];
    if (!line) return;
    if (input.classList.contains("name")) line.name = input.value;
    else line.value = Number.isFinite(input.valueAsNumber) ? input.valueAsNumber : 0;
    changed();
  });
  container.addEventListener("click", event => {
    const target = event.target as HTMLElement;
    if (target.closest(".head")) {
      expanded = !expanded;
      render();
    } else if (target.classList.contains("add")) {
      lines.push({ name: "", value: 0 });
      render();
      container.querySelector<HTMLInputElement>(".line:last-of-type input.name")?.focus();
      changed();
    } else if (target.classList.contains("remove")) {
      lines.splice(+(target.closest<HTMLElement>(".line")?.dataset.index ?? -1), 1);
      render();
      changed();
    }
  });
  render();
}

/** Adjustments as one CSV cell: "Rents: 12; Tribute: -5" */
export const adjustmentsToText = (adjustments: Adjustment[] = []) =>
  adjustments.map(({ name, value }) => `${name}: ${value}`).join("; ");

/** Adjustments read back from a CSV cell; a bare number is one unnamed line */
export function adjustmentsFromText(text: string): Adjustment[] {
  return text
    .split(";")
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => {
      const colon = part.lastIndexOf(":");
      const value = Number(part.slice(colon + 1));
      if (!Number.isFinite(value)) throw new Error(`Not an adjustment: ${part}`);
      return { name: colon < 0 ? "" : part.slice(0, colon).trim(), value };
    });
}

export const SECTORS = ["rural", "manufacturing", "trade"] as const;
export type Sector = (typeof SECTORS)[number];
export type Sectors = Record<Sector | "product", number>;
type Population = Pick<StateAccounts, "people" | "urbanPeople">;
export type ProvinceFigures = { corruption: number; infrastructure: number; stability: number | null };

/** The state, province and burg economy dialogs' style */
export const economyStyle = (dialog: string) => /* html */ `<style>
  .${dialog} > div { width: auto }
  .${dialog} .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(9.5em, 1fr)); gap: 0.4em; margin-bottom: 0.8em }
  .${dialog} .card { border: 1px solid #ccc; border-top: 3px solid var(--header); padding: 0.3em 0.5em; line-height: 1.3 }
  .${dialog} .card .label { font-size: 0.8em; text-transform: uppercase; color: #666 }
  .${dialog} .card .value { font-size: 1.25em; font-weight: bold; white-space: nowrap }
  .${dialog} .card .note { font-size: 0.8em; color: #666; white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
  .${dialog} h4 { margin: 0.8em 0 0.3em; border-bottom: 1px solid var(--dark-solid) }
  .${dialog} .columns { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 20em), 1fr)); column-gap: 1.2em }
  .${dialog} .stack { display: flex; height: 1em }
  .${dialog} .stack.small { display: flex; height: 0.85em; opacity: 0.8 }
  .${dialog} .legend { display: flex; flex-wrap: wrap; justify-content: space-between; column-gap: 0.8em }
  .${dialog} .legend span { font-size: 0.9em; white-space: nowrap }
  .${dialog} .swatch { display: inline-block; width: 0.8em; height: 0.8em; margin-right: 0.25em; vertical-align: middle }
  .${dialog} .row { display: grid; grid-template-columns: minmax(0, 8em) minmax(1em, 1fr) minmax(5em, max-content); align-items: center; column-gap: 0.4em; line-height: 1.5 }
  .${dialog} .row.plain { grid-template-columns: minmax(0, 1fr) minmax(6em, max-content) }
  .${dialog} .row.budget { grid-template-columns: minmax(0, 2fr) 2.5em minmax(1em, 1fr) minmax(5em, max-content) }
  .${dialog} .row .name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: inline-flex; align-items: center; gap: 0.2em }
  .${dialog} .row.plain .name, .${dialog} .row.budget .name { white-space: normal }
  .${dialog} .bar { height: 0.7em; background: #eee }
  .${dialog} .bar > div { height: 100% }
  .${dialog} .bar.stack { display: flex }
  .${dialog} .right { text-align: right; white-space: nowrap }
  .${dialog} .total { font-weight: bold; border-top: 1px solid #ccc }
  .${dialog} .muted { font-size: 0.85em; color: #666 }
  .${dialog} h4 { display: flex; justify-content: space-between; align-items: center }
  .${dialog} h4 button[class^="icon-"] { padding: 0 3px; font-size: 0.75em; line-height: 1; margin: 2px 0; }
  .${dialog} .group { line-height: 1.6 }
</style>`;

/** Corruption, infrastructure and stability of each of the state's provinces, by id */
export function getStateProvinceFigures(stateId: number): Map<number, ProvinceFigures> {
  const state = pack.states[stateId];
  const figures = new Map<number, ProvinceFigures>();
  if (!stateId || !state || state.removed) return figures;
  const infrastructure = StateOrders.getInfrastructure(state);
  for (const { province, stability } of Stability.getProvinces(stateId)) {
    if (!province.id) continue;
    figures.set(province.id, {
      corruption: Corruption.ofProvince(state, province, state.economy.collected),
      infrastructure: infrastructure.get(province.id) ?? 0,
      stability
    });
  }
  return figures;
}

export const sectorShare = (accounts: Sectors, sector: Sector) =>
  accounts.product ? accounts[sector] / accounts.product : 0;

export const taxesOf = ({ taxes }: ProvinceAccounts) =>
  taxes.salesTax + taxes.tariffs + taxes.pollTax + taxes.marketFees;

/** Population as people, from urban and rural population points */
export function people(accounts: Population) {
  const { scale, urbanization } = options.map.units.population;
  const urban = accounts.urbanPeople * scale * urbanization.rate;
  const rural = (accounts.people - accounts.urbanPeople) * scale;
  return { urban, rural, total: urban + rural };
}

/** The good weighing most in its exports: its share² ÷ its world share */
export function knownFor(stateId: number): string | null {
  const { exported, exports } = Accounts.getTrade(stateId);
  if (!exports) return null;
  const world: number[] = [];
  for (const state of pack.states) {
    if (state.removed) continue;
    Accounts.getTrade(state.i).exported.forEach((value, goodId) => {
      world[goodId] = (world[goodId] || 0) + value;
    });
  }
  const worldTotal = world.reduce((total, value) => total + value, 0);
  let bestId = -1;
  let bestLean = 0;
  exported.forEach((value, goodId) => {
    const lean = (value / exports) ** 2 / (world[goodId] / worldTotal);
    if (lean > bestLean) [bestId, bestLean] = [goodId, lean];
  });
  return Goods.get(bestId)?.name ?? null;
}

/** The sector whose share of the product most exceeds its share of the world's */
export function leaningSector(accounts: StateAccounts, world: StateAccounts): Sector | null {
  if (!accounts.product) return null;
  const lean = (sector: Sector) => sectorShare(accounts, sector) / (sectorShare(world, sector) || 1);
  return SECTORS.reduce((best, next) => (lean(next) > lean(best) ? next : best));
}

export function economyType(accounts: StateAccounts, world: StateAccounts): string {
  const sector = leaningSector(accounts, world);
  return sector ? { rural: t("Agrarian"), manufacturing: t("Artisan"), trade: t("Mercantile") }[sector] : "—";
}

/** 0 when all are equal, 1 when one has it all */
export function gini(values: number[]): number {
  const sorted = values.map(value => Math.max(0, value)).sort((a, b) => a - b);
  const total = sorted.reduce((sum, value) => sum + value, 0);
  if (!total || sorted.length < 2) return 0;
  const weighted = sorted.reduce((sum, value, index) => sum + (2 * (index + 1) - sorted.length - 1) * value, 0);
  return weighted / (sorted.length * total);
}

type Cell = string | number;

const percent = (value: number | null | undefined): Cell =>
  value === null || value === undefined ? "" : rn(value * 100);
const amount = (value: number) => rn(value, 2);
const SECTOR_FIGURES = ["Rural Sector", "Manufacturing Sector", "Trade Sector"];
const PROSPERITY_FIGURES = ["Prosperity %", "Urban Prosperity %", "Rural Prosperity %"];
const TAX_FIGURES = ["Sales Tax Collected", "Tariffs Collected", "Poll Tax Collected", "Market Licenses Collected"];

const sectorCells = (accounts: Sectors) => SECTORS.map(sector => amount(accounts[sector]));
const prosperityCells = (accounts: Pick<StateAccounts, "living" | "prosperity">) => [
  percent(accounts.prosperity),
  percent(accounts.living.urban?.prosperity),
  percent(accounts.living.rural?.prosperity)
];

/** The state's economy figures, in its economy dialog's CSV and the States Editor's */
export const STATE_FIGURES = [
  "Economy",
  "Known For",
  "Product",
  ...SECTOR_FIGURES,
  "Wealth",
  "Inequality",
  ...PROSPERITY_FIGURES,
  "Exports",
  "Imports",
  "Trade Balance",
  ...TAX_FIGURES,
  "Taxes Collected",
  "Tax Burden %",
  ...EXPENSES.map(expense => `${expense[0].toUpperCase()}${expense.slice(1)} Spent`),
  "Pocketed",
  "Corruption %"
];

/** Values in the STATE_FIGURES order; blanks when the economy has not run */
export function getStateFigures(stateId: number): Cell[] {
  const state = pack.states[stateId];
  const accounts = Accounts.ofState(stateId);
  const world = Accounts.getWorld();
  if (!state || !accounts || !world) return STATE_FIGURES.map(() => "");
  const { economy } = state;
  const { exports, imports } = Accounts.getTrade(stateId);
  const budget = Accounts.getBudget(stateId);
  const governed = (value: number) => (stateId ? amount(value) : "");
  return [
    economyType(accounts, world),
    knownFor(stateId) ?? "",
    amount(accounts.product),
    ...sectorCells(accounts),
    amount(accounts.wealth),
    rn(gini(accounts.burgWealth), 2),
    ...prosperityCells(accounts),
    amount(exports),
    amount(imports),
    amount(exports - imports),
    governed(budget.salesTax),
    governed(budget.tariffs),
    governed(budget.pollTax),
    governed(budget.marketFees),
    governed(economy.collected),
    stateId && accounts.product ? rn((accounts.taxes / accounts.product) * 100, 1) : "",
    ...EXPENSES.map(expense => governed(economy.spent[expense])),
    governed(economy.pocketed),
    stateId ? rn(Corruption.ofState(state, economy.collected), 1) : ""
  ];
}

/** The province's economy figures, in its economy dialog's CSV and the Provinces Editor's */
export const PROVINCE_FIGURES = [
  "Product",
  ...SECTOR_FIGURES,
  "Wealth",
  ...PROSPERITY_FIGURES,
  ...TAX_FIGURES,
  "Taxes Collected",
  "Tax Burden %",
  "State Orders",
  "Pocketed",
  "Corruption %",
  "Infrastructure %",
  "Stability %"
];

/** Values in the PROVINCE_FIGURES order; blanks when the economy has not run */
export function getProvinceFigures(provinceId: number): Cell[] {
  const province = pack.provinces[provinceId];
  const accounts = Accounts.ofProvince(provinceId);
  if (!province || !accounts) return PROVINCE_FIGURES.map(() => "");
  const own = getStateProvinceFigures(province.state).get(provinceId);
  const taxes = taxesOf(accounts);
  return [
    amount(accounts.product),
    ...sectorCells(accounts),
    amount(accounts.wealth),
    ...prosperityCells(accounts),
    amount(accounts.taxes.salesTax),
    amount(accounts.taxes.tariffs),
    amount(accounts.taxes.pollTax),
    amount(accounts.taxes.marketFees),
    amount(taxes),
    accounts.product ? rn((taxes / accounts.product) * 100, 1) : "",
    amount(accounts.spent),
    amount(accounts.pocketed),
    own ? rn(own.corruption, 1) : "",
    percent(own?.infrastructure),
    percent(own?.stability)
  ];
}

/** Each demand category's units covered by what the burg consumed, and its need */
export function getDemand(burg: Burg): { covered: number[]; targets: number[] } {
  const population = burg.population || 0;
  const targets = DEMAND_PRIORITY.map(category => population * DEMAND_TARGET_FACTORS[category]);
  const covered = DEMAND_PRIORITY.map(() => 0);
  Prosperity.getConsumption(burg.i!).forEach((units, goodId) => {
    const coverage = Goods.get(goodId)?.demandCoverage ?? {};
    DEMAND_PRIORITY.forEach((category, index) => {
      covered[index] += units * (coverage[category] || 0);
    });
  });
  return { covered, targets };
}

type Flows = { sales: number; ingredients: number; consumption: number };

/** The deals' money flows by burg id, and the margins by market id, in one pass */
export function getFlows(): { burgs: Map<number, Flows>; margins: Map<number, number> } {
  const burgs = new Map<number, Flows>();
  const margins = new Map<number, number>();
  for (const deal of pack.deals) {
    const [burgId, marketId, , kind, units, price, tax, tariff] = deal;
    margins.set(marketId, (margins.get(marketId) || 0) + Deals.getMargin(deal));
    const flows = burgs.get(burgId) ?? { sales: 0, ingredients: 0, consumption: 0 };
    burgs.set(burgId, flows);
    if (kind === DEAL_KINDS.sale) flows.sales += units * price - tax - tariff;
    else if (kind === DEAL_KINDS.input) flows.ingredients -= units * price;
    else if (kind === DEAL_KINDS.demand) flows.consumption -= units * price; // a state order is the state's money
  }
  return { burgs, margins };
}

/** The burg's day in money: what it got positive, what it paid negative */
export function getBalance(burg: Burg, { burgs, margins }: ReturnType<typeof getFlows>) {
  const market = Markets.ofBurg(burg);
  const isCenter = market?.centerBurgId === burg.i;
  return {
    ...(burgs.get(burg.i!) ?? { sales: 0, ingredients: 0, consumption: 0 }),
    pollTax: -(burg.pollTaxPaid || 0),
    license: isCenter ? -(market.feePaid || 0) : 0,
    margin: isCenter ? (market.rural?.margin || 0) + (margins.get(market.i) || 0) : 0
  };
}

/** The burg's economy columns in the Burgs overview's CSV, beside its product, wealth, prosperity and balance */
export const BURG_FIGURES = [
  "Market Center",
  "Needs Met %",
  "Comfort",
  "Variety",
  "Infrastructure %",
  ...DEMAND_PRIORITY.map(category => `${category[0].toUpperCase()}${category.slice(1)} Covered %`),
  "Sales",
  "Ingredients",
  "Consumption",
  "Poll Tax Paid",
  "Market License",
  "Market Margin",
  "Production",
  "Consumed Goods"
];

/** Values in the BURG_FIGURES order; flows from getFlows, made once for all burgs */
export function getBurgFigures(burg: Burg, flows = getFlows()): (string | number)[] {
  if (!burg.production || !Markets.ofBurg(burg)) return BURG_FIGURES.map(() => "");
  const living = Prosperity.getBurg(burg.i!);
  const { covered, targets } = getDemand(burg);
  const balance = getBalance(burg, flows);
  const goodsList = (goods: [goodId: number, units: number][]) =>
    goods
      .flatMap(([goodId, units]) => {
        const good = Goods.get(goodId);
        return good && units ? [`${good.name}: ${rn(units, 2)}`] : [];
      })
      .join("; ");
  return [
    Markets.ofBurg(burg)?.centerBurgId === burg.i ? "center" : "",
    percent(living?.needs),
    living ? rn(living.comfort, 1) : "",
    living ? rn(living.variety, 1) : "",
    percent(living?.infrastructure),
    ...targets.map((target, index) => (target ? rn(Math.min(1, covered[index] / target) * 100) : "")),
    amount(balance.sales),
    amount(balance.ingredients),
    amount(balance.consumption),
    amount(balance.pollTax),
    amount(balance.license),
    amount(balance.margin),
    goodsList(burg.production),
    goodsList(Prosperity.getConsumption(burg.i!).map((units, goodId) => [goodId, units]))
  ];
}
