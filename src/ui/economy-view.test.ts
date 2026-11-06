import { describe, expect, it } from "vitest";
import { adjustmentsFromText, adjustmentsToText, splitDealPrice } from "./economy-view";

describe("splitDealPrice", () => {
  it("leaves the goods' price of an import once carriage and taxes paid per unit are taken out", () => {
    const trade = { units: 4, price: 10, tax: 2, tariff: 4, carriage: 2 };
    const { goodsPrice, value, formula } = splitDealPrice(trade, false);
    expect(goodsPrice).toBeCloseTo(10 - 2 - 0.5 - 1);
    expect(value).toBe(40); // what the burg paid
    expect(formula).toBe("−(Net 🟡 6.5 + Carriage 🟡 2 + Sales Tax 🟡 0.5 + Tariff 🟡 1) × 4 = 🟡 -40");
  });

  it("gets a sale's value as the goods' price less carriage and sales tax per unit", () => {
    const trade = { units: 5, price: 8, tax: 4, carriage: 2 };
    const { goodsPrice, value, formula } = splitDealPrice(trade, true);
    expect(goodsPrice).toBe(10);
    expect(value).toBe(36); // (10 - 2 - 0.8) × 5
    expect(value).toBeCloseTo((goodsPrice - 2 - 4 / 5) * 5);
    expect(formula).toBe("(Net 🟡 10 − Carriage 🟡 2 − Sales Tax 🟡 0.8) × 5 = 🟡 36");
  });
});

describe("adjustments in a CSV cell", () => {
  it("round-trip; a bare number is one unnamed line", () => {
    const lines = [
      { name: "Rents", value: 12 },
      { name: "Tribute: to the khan", value: -5.5 }
    ];
    expect(adjustmentsToText(lines)).toBe("Rents: 12; Tribute: to the khan: -5.5");
    expect(adjustmentsFromText(adjustmentsToText(lines))).toEqual(lines);
    expect(adjustmentsFromText("7")).toEqual([{ name: "", value: 7 }]);
    expect(adjustmentsFromText("")).toEqual([]);
    expect(() => adjustmentsFromText("Rents: lots")).toThrow("Not an adjustment");
  });
});
