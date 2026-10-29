// What the economy dialogs and the economy columns of the political editors share

import { PROSPERITY_LEVEL_LABELS } from "@/data/id-labels";
import type { Good } from "@/model/economy/goods-generator";
import { Markets } from "@/model/economy/markets-generator";
import { type Living, Prosperity, type ProsperityLevel } from "@/model/economy/prosperity";
import { type Deal, type DealKind, Trade, type Transaction } from "@/model/economy/trade";
import type { Expense } from "@/model/political/states-generator";
import { formatPrice, getDecima, getDistance } from "@/model/units";
import { wiki } from "@/utils/common-utils";
import { Catalog, sentences, t } from "@/utils/i18n";
import { ensureEl } from "@/utils/node-utils";
import { rn } from "@/utils/number-utils";

// Colors and tones

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
  manufactured: ["#f8e7bf", "#b67a00"],
  sell: ["#dff0e2", "#2f8a46"],
  keep: ["#e6e0f2", "#5a4a8a"],
  need: ["#e4e4e4", "#555"]
} as const;

/** The tone class of an amount: positive for a gain, negative for a loss */
export const tone = (value: number) => (value >= 0 ? "positive" : "negative");

/** CSS background for a share of the taxes on a 0–100% track: the part spent, the part officials pocket grayed, the rest empty */
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
  treasury: () => t("Treasury: money at the end of the day"),
  stateTreasury: () =>
    t("Treasury balance: the day's taxes less the state's expenses, below zero when it spends more than it collects"),
  otherRevenue: () =>
    t(
      "Other revenue: the state's income a day besides taxes, such as tribute or crown estates; negative for debts or tribute it pays"
    ),
  budget: () =>
    t("Expenses: the shares of its taxes the state spends; together they may pass 100% and put the treasury in debt"),
  expenseTip: (expense: Expense) =>
    ({
      court: t("Court and clergy: luxuries the state buys at its capital"),
      administration: t("Administration: utilities the state buys at its provinces' seats"),
      infrastructure: t("Infrastructure: construction goods the state buys at its provinces' seats"),
      military: t("Military: military goods and food the state buys at its capital")
    })[expense],
  prosperity: () => t("Prosperity: how well the people live"),
  open: () => t("Click to open the economy overview"),
  openValue: () => t("Click a value to open the economy overview"),
  noData: () => t("No economy data yet. Regenerate the economy first"),
  table: () => t("Show all as a table"),
  corruption: () =>
    t(
      "Corruption: the share of each expense officials pocket. It comes from the state's form, its size and the peoples of other cultures and faiths it rules"
    ),
  collected: (paid: number, owed: number) =>
    t("{{share}}% of {{owed}} collected", { share: rn((paid / owed) * 100), owed: formatPrice(owed) })
};

// The Economy wiki page, opened from the bottom of every economy dialog

export const economyWikiButton = (id: string) =>
  /* html */ `<button id="${id}" type="button" data-tip="${t("Open the Economy wiki page")}" class="icon-info"></button>`;

/** Call once the button is in the page */
export const bindEconomyWiki = (id: string) => ensureEl(id).addEventListener("click", () => wiki("Economy"));

// Prosperity as text, and its colors for charts of people by level

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
  return t("needs met {{needs}}%, comfort ×{{comfort}}, {{variety}} goods", {
    needs: rn(living.needs * 100),
    comfort: rn(living.comfort, 1),
    variety: rn(living.variety, 1)
  });
}

export function prosperityTip(prosperity: number): string {
  return t("Prosperity: {{level}}. Defined by consumption fulfillment, quality and variety", {
    level: prosperityLevel(prosperity)
  });
}

// A deal's price broken down for the trade tables

/**
 * A trade's price split per unit: goods' price, carriage, sales tax and tariff, with the trade's total value. The recorded price already holds carriage and, on an import, the taxes:
 * the goods' own price is what is left, and the formula adds them back up to the burg's income from the trade
 */
export function splitDealPrice({ units, price, tax, tariff = 0, carriage = 0 }: Transaction, isSale: boolean) {
  const perUnit = (total: number) => (units ? total / units : 0);
  const unitCarriage = carriage;
  const unitTax = perUnit(tax);
  const unitTariff = perUnit(tariff);
  const terms: [string, number][] = [
    [t("Carriage"), unitCarriage],
    [t("Sales Tax"), unitTax],
    [t("Tariff"), unitTariff]
  ];
  const added = terms.reduce((sum, [, value]) => sum + value, 0);

  // a purchase pays them on top of the goods' price; a sale gets the goods' price less them
  const goodsPrice = isSale ? price + unitCarriage : price - added;
  const value = isSale ? units * price - tax : units * price;

  const sign = isSale ? "−" : "+";
  const shown = terms
    .filter(([, amount]) => rn(amount, 2))
    .map(([label, amount]) => ` ${sign} ${label} ${formatPrice(rn(amount, 2))}`);
  const income = isSale ? value : -value;
  const split = `(${t("Net")} ${formatPrice(rn(goodsPrice, 2))}${shown.join("")}) × ${rn(units, 2)}`;
  const formula = `${isSale ? "" : "−"}${split} = ${formatPrice(rn(income, 2))}`;
  return { goodsPrice, carriage: unitCarriage, tax: unitTax, tariff: unitTariff, value, formula };
}

/** The route distance the carriage is paid for, in decimas and the map's distance unit */
export const carriageDistance = (decimas: number) =>
  t("Carriage distance: {{decimas}} decima ({{distance}})", {
    decimas: rn(decimas, 2),
    distance: getDistance(decimas * getDecima())
  });

/** A tariff per unit: shown even when nothing is charged on an import, a dash where no tariff applies */
export const tariffCell = (tariff: number, isImport: boolean) =>
  isImport ? money(tariff, false) || formatPrice(0) : "—";

/** A per-unit amount in the positive tone when it adds to the burg's money, the negative when it takes from it; blank when zero */
export function money(amount: number, adds: boolean): string {
  if (!rn(amount, 2)) return "";
  return `<span class="${adds ? "positive" : "negative"}">${formatPrice(rn(amount, 2))}</span>`;
}

/** Short tips for the trade columns of the Economy Overview and Trade Details */
export const tradeColumnTips = () => ({
  units: t("Units traded"),
  net: sentences(t("Net unit price"), t("Market price before carriage and taxes")),
  carriage: sentences(t("Carriage per unit"), t("Transportation price between the market and the burg")),
  tax: sentences(t("Sales tax per unit"), t("Paid by the seller to its state")),
  tariff: sentences(t("Import tariff per unit"), t("Paid by the importer burg to the state of its market")),
  income: sentences(t("Burg total income"), t("Positive on a sale, negative on a purchase"))
});

/** Where a burg's trade with a market stands: the route it is carried along, whether it is an import, and the states its taxes go to */
export function getTradeContext(burgId: number, marketId: number, goodId: number, kind: DealKind) {
  const burg = pack.burgs[burgId];
  const market = Markets.get(marketId);
  const deal: Deal = [burgId, marketId, goodId, kind, 0, 0, 0, 0, 0];
  const { taxState, tariffState } = Trade.getTaxStates(deal);
  return {
    decimas: market && burg ? Trade.getDecimas(market, burg) : 0, // carried between the market and the burg
    carriageFactor: market && burg ? Trade.getCarriageFactor(market, burg) : 1, // dearer from another state's market
    isImport: Trade.isImport(deal),
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

/** A trade row's cell tips: the row's own figures with what they mean */
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
    formula
  } = cell;
  const price = (amount: number) => formatPrice(rn(amount, 2));
  const state = (stateId: number) => pack.states[stateId]?.name || "";
  const rate = (value: number) => `${t("Rate")}: ${rn(value * 100, 1)}%`;
  const tariffRate = tariff ? Trade.getTariffRate(tariffStateId, taxStateId, good.i) : 0;

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
          t("Paid by importer burg to state: {{- state}}", { state: state(tariffStateId) }),
          rate(tariffRate)
        )
      : t("No tariff: not an import from another state"),
    income: `${t("Burg total income")}: ${formula}`
  };
}

/** The good's unit for a count; unit names are English data, so only an English interface pluralizes them */
export function unitFor(count: number, unit: string): string {
  if (!unit || count === 1 || Catalog.language !== "en") return unit;
  return `${unit}${/(s|x|z|ch|sh)$/.test(unit) ? "es" : "s"}`;
}

function countUnits(units: number, unit: string): string {
  const count = rn(units, 2);
  return unit ? `${count} ${unitFor(count, unit)}` : String(count);
}
