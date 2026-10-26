import { describe, expect, test } from "vitest";
import { DEAL_KINDS, type Deal, type DealKind } from "@/model/economy/markets-generator";
import { getDealNet, getMarketDeals, getMarketSide } from "./market-deals-overview";

const createDeal = (market: number, kind: DealKind, units = 2.345, price = 3): Deal => [
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
      expect(getDealNet(deal)).toBe(7.04);
    }
  });

  test("treats a burg's sale as the market's purchase and negative income", () => {
    const deal = createDeal(2, DEAL_KINDS.sale);

    expect(getMarketSide(deal)).toBe("buy");
    expect(getDealNet(deal)).toBe(-7.04);
  });
});
