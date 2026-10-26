import { describe, expect, it } from "vitest";
import { splitDealPrice } from "./deal-price";

describe("splitDealPrice", () => {
  it("leaves the goods' price of an import once carriage and taxes paid per unit are taken out", () => {
    const trade = { units: 4, price: 10, tax: 2, tariff: 4, carriage: 2 };
    const { goodsPrice, value } = splitDealPrice(trade, false);
    expect(goodsPrice).toBeCloseTo(10 - 2 - 0.5 - 1);
    expect(value).toBe(40); // what the burg paid
  });

  it("gets a sale's value as the goods' price less carriage and sales tax per unit", () => {
    const trade = { units: 5, price: 8, tax: 4, carriage: 2 };
    const { goodsPrice, value } = splitDealPrice(trade, true);
    expect(goodsPrice).toBe(10);
    expect(value).toBe(36); // (10 - 2 - 0.8) × 5
    expect(value).toBeCloseTo((goodsPrice - 2 - 4 / 5) * 5);
  });
});
