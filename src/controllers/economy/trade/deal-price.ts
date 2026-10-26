import type { Good } from "@/model/economy/goods-generator";
import { Markets, type Trade } from "@/model/economy/markets-generator";
import { formatPrice, getDecima, getDistance } from "@/model/units";
import { Catalog, sentences, t } from "@/utils/i18n";
import { rn } from "@/utils/number-utils";

/**
 * A trade's price split per unit: goods' price, carriage, sales tax and tariff, with the trade's total value. The recorded price already holds carriage and, on an import, the taxes:
 * the goods' own price is what is left, and the formula adds them back up to what the trade is worth to the burg
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
  const formula = `(${t("Price")} ${formatPrice(rn(goodsPrice, 2))}${shown.join("")}) × ${t("Units")} ${rn(units, 2)} = ${formatPrice(rn(value, 2))}`;
  return { goodsPrice, carriage: unitCarriage, tax: unitTax, tariff: unitTariff, value, formula };
}

/** A tariff per unit: shown even when nothing is charged on an import, a dash where no tariff applies */
export const tariffCell = (tariff: number, isImport: boolean) =>
  isImport ? money(tariff, false) || formatPrice(0) : "—";

/** A per-unit amount in green when it adds to the burg's money, in the negative color when it takes from it; blank when zero */
export function money(amount: number, adds: boolean): string {
  if (!rn(amount, 2)) return "";
  return `<span class="${adds ? "positive" : "negative"}">${formatPrice(rn(amount, 2))}</span>`;
}

/** Short tips for the trade columns of the Production Overview and Trade Details */
export const tradeColumnTips = () => ({
  units: t("Units traded"),
  net: sentences(t("Net unit price"), t("Market price before carriage and taxes")),
  carriage: sentences(t("Carriage per unit"), t("Transportation price between the market's center and the burg")),
  tax: sentences(t("Sales tax per unit"), t("Paid by the seller to its state")),
  tariff: sentences(t("Import tariff per unit"), t("Paid by the importer burg to the state of its market")),
  income: sentences(t("Burg total income"), t("Positive on a sale, negative on a purchase"))
});

/** A column's tip with the hint that clicking sorts by it */
export const sortableTip = (tip: string, column: string) =>
  sentences(tip, t("Click to sort by {{column}}", { column }));

type TradeCell = {
  good: Good;
  units: number;
  net: number; // the rest per unit
  carriage: number;
  tax: number;
  tariff: number;
  income: number; // to the burg: positive on a sale, negative on a purchase
  isImport: boolean;
  taxStateId: number;
  tariffStateId: number;
  formula: string;
};

/** A trade row's cell tips: the row's own figures with what they mean */
export function tradeCellTips(cell: TradeCell) {
  const { good, units, net, carriage, tax, tariff, income, isImport, taxStateId, tariffStateId, formula } = cell;
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
      t("Transportation price between the market's center and the burg"),
      t("{{price}} per decima ({{distance}})", { price: price(good.carriage), distance: getDistance(getDecima()) })
    ),
    tax: sentences(
      `${t("Sales tax per unit")}: ${price(tax)}`,
      t("Paid by seller to state: {{- state}}", { state: state(taxStateId) }),
      rate(pack.states[taxStateId]?.salesTax || 0)
    ),
    tariff: isImport
      ? sentences(
          `${t("Import tariff per unit")}: ${price(tariff)}`,
          t("Paid by importer burg to state: {{- state}}", { state: state(tariffStateId) }),
          rate(tariffRate)
        )
      : t("No tariff: not an import from another state"),
    income: sentences(`${t("Burg total income")}: ${price(income)}`, formula)
  };
}

/** A count with the good's unit; unit names are English data, so only an English interface pluralizes them */
function countUnits(units: number, unit: string): string {
  const count = rn(units, 2);
  if (!unit) return String(count);
  if (count === 1 || Catalog.language !== "en") return `${count} ${unit}`;
  return `${count} ${unit}${/(s|x|z|ch|sh)$/.test(unit) ? "es" : "s"}`;
}
