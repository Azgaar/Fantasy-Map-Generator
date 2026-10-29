// One definition per economy term, shared by every view's tooltips

import type { Expense } from "@/model/political/states-generator";
import { formatPrice } from "@/model/units";
import { t } from "@/utils/i18n";
import { rn } from "@/utils/number-utils";

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
  expense: (expense: Expense) =>
    ({
      court: t("Court and clergy"),
      administration: t("Administration"),
      infrastructure: t("Infrastructure"),
      military: t("Military")
    })[expense],
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
