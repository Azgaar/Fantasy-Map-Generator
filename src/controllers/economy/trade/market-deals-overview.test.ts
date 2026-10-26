import { describe, expect, test } from "vitest";
import { DEAL_KINDS, type Deal, type DealKind } from "@/model/economy/markets-generator";
import { getDealNet, getDirection, getMarketDeals } from "./market-deals-overview";

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
  test("selects the deals made with the market", () => {
    const sale = createDeal(2, DEAL_KINDS.sale);
    const purchase = createDeal(2, DEAL_KINDS.demand);
    const unrelated = createDeal(9, DEAL_KINDS.input);

    expect(getMarketDeals([sale, purchase, unrelated], 2)).toEqual([sale, purchase]);
  });

  test("treats a burg's purchase as outgoing goods and income for the market", () => {
    for (const kind of [DEAL_KINDS.input, DEAL_KINDS.demand]) {
      const deal = createDeal(2, kind);
      expect(getDirection(deal)).toBe("out");
      expect(getDealNet(deal)).toBe(7.04);
    }
  });

  test("treats a burg's sale as incoming goods and negative cash flow", () => {
    const deal = createDeal(2, DEAL_KINDS.sale);

    expect(getDirection(deal)).toBe("in");
    expect(getDealNet(deal)).toBe(-7.04);
  });
});
