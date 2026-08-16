import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Good } from "./goods-generator";
import { ProductionModule } from "./production-generator";

describe("ProductionModule planning caches", () => {
  let production: ProductionModule;

  beforeEach(() => {
    production = new ProductionModule();
  });

  it("quotes each good only once within a production decision", () => {
    const quote = { stock: 12, buyPrice: 4, sellPrice: 3 };
    const quoteMarket = vi.fn(() => quote);
    globalThis.Markets = { quoteMarket } as any;
    const state = { market: { i: 1 } } as any;
    const context = { quotes: [], path: [] };
    const internal = production as any;

    const first = internal.getDecisionQuote(state, 7, context);
    const second = internal.getDecisionQuote(state, 7, context);

    expect(first).toBe(quote);
    expect(second).toBe(quote);
    expect(quoteMarket).toHaveBeenCalledOnce();
  });

  it("calculates each good modifier only once per burg", () => {
    const modifier = vi.spyOn(production as any, "getModifiers").mockReturnValue(1.5);
    const state = { burg: { cell: 42 }, modifierByGood: [] } as any;
    const good = { i: 3 } as Good;
    const internal = production as any;

    expect(internal.getStateModifier(state, good)).toBe(1.5);
    expect(internal.getStateModifier(state, good)).toBe(1.5);
    expect(modifier).toHaveBeenCalledOnce();
  });
});
