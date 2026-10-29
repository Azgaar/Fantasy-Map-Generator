// One definition per economy term, shared by every view's tooltips

import { formatPrice } from "@/model/units";
import { t } from "@/utils/i18n";
import { rn } from "@/utils/number-utils";

export const EconomyTerms = {
  product: () => t("Product: sales less taxes and ingredients"),
  stateProduct: () => t("Product: what the state's people make in a day"),
  wealth: () => t("Wealth: product per person"),
  treasury: () => t("Treasury: money at the end of the day"),
  stateTreasury: () => t("Treasury: the state's taxes for the day"),
  prosperity: () => t("Prosperity: how well the people live"),
  open: () => t("Click to open the economy overview"),
  openValue: () => t("Click a value to open the economy overview"),
  noData: () => t("No economy data yet. Regenerate the economy first"),
  table: () => t("Show all as a table"),
  corruption: () =>
    t(
      "Corruption: the share of collected taxes officials pocket. It comes from the state's form, its size and the peoples of other cultures and faiths it rules"
    ),
  collected: (paid: number, owed: number) =>
    t("{{share}}% of {{owed}} collected", { share: rn((paid / owed) * 100), owed: formatPrice(owed) })
};
