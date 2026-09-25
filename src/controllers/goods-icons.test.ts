// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from "vitest";
import { IconSets } from "@/components/icon-sets";
import { GoodsEditor } from "./goods-editor";
import { MarketDealsOverview } from "./market-deals-overview";
import { MarketOverview } from "./market-overview";
import { ProductionChains } from "./production-chains";
import { ProductionOverview } from "./production-overview";
import { TradeDetails } from "./trade-details";

vi.mock("@/components/icon-sets", () => ({
  IconSets: {
    retry: vi.fn().mockResolvedValue(undefined),
    files: () => [],
    symbolId: (set: string, name: string) => `${set}-${name}`,
    defs: "#defElements defs"
  }
}));
vi.mock("@/components/tooltips", () => ({ tip: vi.fn(), clearMainTip: vi.fn(), showMainTip: vi.fn() }));

beforeEach(() => {
  vi.mocked(IconSets.retry).mockClear();
  document.body.innerHTML = '<div id="dialogs"></div><svg id="defElements"><defs/></svg>';
  globalThis.customization = 1; // every dialog bails out before touching its markup
  globalThis.pack = { goods: [], burgs: [] } as unknown as typeof pack;
  globalThis.Markets = { get: () => undefined } as unknown as typeof Markets;
});

// each goods consumer must start the goods load on entry, before its own validation and whatever the goods layer shows
test.each([
  ["market overview", () => MarketOverview.open(-1)],
  ["market deals overview", () => MarketDealsOverview.open(-1)],
  ["trade details", () => TradeDetails.open({ deals: [] } as never)],
  ["production overview", () => ProductionOverview.open(-1)],
  ["production chains", () => ProductionChains.open()],
  ["goods editor", () => GoodsEditor.open()]
])("%s requests the goods icons on entry", (_, open) => {
  open();
  expect(IconSets.retry).toHaveBeenCalledWith("goods");
});
