import type { Good } from "@/model/economy/goods-generator";
import { type Deal, type DealKind, Markets, type Trade } from "@/model/economy/markets-generator";
import { formatPrice, getDecima, getDistance } from "@/model/units";
import { Catalog, sentences, t } from "@/utils/i18n";
import { rn } from "@/utils/number-utils";

/**
 * A trade's price split per unit: goods' price, carriage, sales tax and tariff, with the trade's total value. The recorded price already holds carriage and, on an import, the taxes:
 * the goods' own price is what is left, and the formula adds them back up to the burg's income from the trade
 */
export function splitDealPrice({ units, price, tax, tariff = 0, carriage = 0 }: Trade, isSale: boolean) {
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
  const { taxState, tariffState } = Markets.getTaxStates(deal);
  return {
    decimas: market && burg ? Markets.getDecimas(market, burg) : 0, // carried between the market and the burg
    carriageFactor: market && burg ? Markets.getCarriageFactor(market, burg) : 1, // dearer from another state's market
    isImport: Markets.isImport(deal),
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
  const tariffRate = tariff ? Markets.getTariffRate(tariffStateId, taxStateId, good.i) : 0;

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

/** A count with the good's unit; unit names are English data, so only an English interface pluralizes them */
function countUnits(units: number, unit: string): string {
  const count = rn(units, 2);
  if (!unit) return String(count);
  if (count === 1 || Catalog.language !== "en") return `${count} ${unit}`;
  return `${count} ${unit}${/(s|x|z|ch|sh)$/.test(unit) ? "es" : "s"}`;
}
