import { describe, expect, test } from "vitest";
import { DEAL_KINDS, type Deal, type DealKind, Markets } from "@/model/economy/markets-generator";
import { getDealNet, getMarketDeals, getMarketSide } from "./market-deals-overview";

const createDeal = (market: number, kind: DealKind, units = 2.34, price = 3): Deal => [
  7,
  market,
  4,
  kind,
  units,
  price,
  0,
  0,
  0
];

const cents = (value: number) => Math.round(value * 100) / 100;
const MARGIN = Markets.getMarginRate(); // a market that paid no license fee

describe("market deals overview calculations", () => {
  test("selects the deals made with the market, leaving out goods a burg kept", () => {
    const sale = createDeal(2, DEAL_KINDS.sale);
    const purchase = createDeal(2, DEAL_KINDS.demand);
    const kept = createDeal(2, DEAL_KINDS.kept);
    const unrelated = createDeal(9, DEAL_KINDS.input);

    expect(getMarketDeals([sale, purchase, kept, unrelated], 2)).toEqual([sale, purchase]);
  });

  test("treats a burg's purchase as the market's sale and income", () => {
    for (const kind of [DEAL_KINDS.input, DEAL_KINDS.demand]) {
      const deal = createDeal(2, kind);
      expect(getMarketSide(deal)).toBe("sell");
      expect(getDealNet(deal)).toBe(cents(7.02 - (7.02 * MARGIN) / (1 + MARGIN))); // less the center burg's margin
    }
  });

  test("keeps the carriage in the price but passes the taxes to the states and the margin to the center burg", () => {
    const deal: Deal = [7, 2, 4, DEAL_KINDS.input, 2, 10, 3, 1, 1.5]; // the burg paid 20, carriage 3 of it
    const margin = (2 * 6.5 * MARGIN) / (1 + MARGIN); // on the market's price with the margin: 10 less 2 of taxes and 1.5 of carriage
    expect(getDealNet(deal)).toBe(cents(20 - 3 - 1 - margin));
  });

  test("gets nothing from goods a burg kept", () => {
    expect(getDealNet(createDeal(2, DEAL_KINDS.kept))).toBe(0);
  });

  test("treats a burg's sale as the market's purchase and negative income", () => {
    const deal = createDeal(2, DEAL_KINDS.sale);

    expect(getMarketSide(deal)).toBe("buy");
    expect(getDealNet(deal)).toBe(cents(-7.02 - (7.02 * MARGIN) / (1 - MARGIN))); // the burg's 7.02 and its center burg's margin
  });
});
