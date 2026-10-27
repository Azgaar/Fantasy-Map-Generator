// One definition per economy term, shared by every view's tooltips

import { t } from "@/utils/i18n";

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
  table: () => t("Show all as a table")
};
