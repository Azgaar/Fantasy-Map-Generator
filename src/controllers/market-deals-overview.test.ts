import { describe, expect, test } from "vitest";
import type { Deal } from "@/generators/markets-generator";
import { getCounterparty, getDealNet, getDirection, getMarketDeals } from "./market-deals-overview";

const createDeal = (overrides: Partial<Deal> = {}): Deal => ({
  i: 1,
  seller: 2,
  sellerType: "market",
  buyer: 3,
  buyerType: "burg",
  good: 4,
  units: 5,
  price: 6,
  tax: 0,
  ...overrides
});

describe("market deals overview calculations", () => {
  test("selects deals where the market is either seller or buyer", () => {
    const sold = createDeal({ i: 1, seller: 2 });
    const bought = createDeal({ i: 2, seller: 8, buyer: 2, buyerType: "market" });
    const unrelated = createDeal({ i: 3, seller: 8, buyer: 9, buyerType: "market" });

    expect(getMarketDeals([sold, bought, unrelated], 2)).toEqual([sold, bought]);
  });

  test("treats a sale as outgoing income from the active market", () => {
    const deal = createDeal({ units: 2.345, price: 3 });

    expect(getDirection(deal, 2)).toBe("out");
    expect(getCounterparty(deal, 2)).toEqual({ id: 3, type: "burg" });
    expect(getDealNet(deal, 2)).toBe(7.04);
  });

  test("treats a purchase as incoming goods and negative cash flow", () => {
    const deal = createDeal({
      seller: 7,
      sellerType: "burg",
      buyer: 2,
      buyerType: "market",
      units: 2.345,
      price: 3
    });

    expect(getDirection(deal, 2)).toBe("in");
    expect(getCounterparty(deal, 2)).toEqual({ id: 7, type: "burg" });
    expect(getDealNet(deal, 2)).toBe(-7.04);
  });

  test("preserves a market counterparty for global deals", () => {
    const deal = createDeal({ buyer: 9, buyerType: "market" });

    expect(getCounterparty(deal, 2)).toEqual({ id: 9, type: "market" });
  });
});
