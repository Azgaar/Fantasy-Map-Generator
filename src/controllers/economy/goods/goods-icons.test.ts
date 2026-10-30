// @vitest-environment jsdom

import { beforeEach, expect, test, vi } from "vitest";
import { burgEconomyOverview } from "@/controllers/economy/entities/burg-economy-overview";
import { ProductionChains } from "@/controllers/economy/goods/production-chains";
import { MarketDealsOverview } from "@/controllers/economy/markets/market-deals-overview";
import { MarketOverview } from "@/controllers/economy/markets/market-overview";
import { TradeDetails } from "@/controllers/economy/trade/trade-details";
import { Markets } from "@/model/economy/markets-generator";
import { Icons } from "@/model/icons";
import { GoodsEditor } from "./goods-editor";

vi.mock("@/model/icons", () => ({
  Icons: { retry: vi.fn().mockResolvedValue(undefined), href: (id: string) => `#${id}`, name: (id: string) => id }
}));
vi.mock("@/ui/tooltips", () => ({
  tip: vi.fn(),
  clearMainTip: vi.fn(),
  showMainTip: vi.fn(),
  loadingTip: { start: vi.fn(), end: vi.fn() }
}));

beforeEach(() => {
  vi.mocked(Icons.retry).mockClear();
  document.body.innerHTML = '<div id="dialogs"></div><svg id="defElements"><defs/></svg>';
  options.app.mode = "heightmap"; // every dialog bails out before touching its markup
  globalThis.pack = { goods: [], burgs: [] } as unknown as typeof pack;
  Object.assign(Markets, { get: () => undefined });
});

// each goods consumer must start the goods load on entry, before its own validation and whatever the goods layer shows
test.each([
  ["market overview", () => MarketOverview.open(-1)],
  ["market deals overview", () => MarketDealsOverview.open(-1)],
  ["trade details", () => TradeDetails.open([0, 0, 0, 0, 0, 0, 0, 0, 0])],
  ["economy overview", () => burgEconomyOverview.open(-1)],
  ["production chains", () => ProductionChains.open()],
  ["goods editor", () => GoodsEditor.open()]
])("%s requests the goods icons on entry", (_, open) => {
  open();
  expect(Icons.retry).toHaveBeenCalledWith("goods");
});
