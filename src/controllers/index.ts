import { createRegistry } from "@/utils/registry";

export const Controllers = createRegistry({
  BattleScreen: () => import("@/controllers/battle-screen").then(m => m.BattleScreen),
  BurgEditor: () => import("@/controllers/burg-editor").then(m => m.BurgEditor),
  BurgGroupEditor: () => import("@/controllers/burg-group-editor").then(m => m.BurgGroupEditor),
  BurgsOverview: () => import("@/controllers/burgs-overview").then(m => m.BurgsOverview),
  ChartsOverview: () => import("@/controllers/charts-overview").then(m => m.ChartsOverview),
  CoastlineEditor: () => import("@/controllers/coastline-editor").then(m => m.CoastlineEditor),
  ComparePrices: () => import("@/controllers/compare-prices").then(m => m.ComparePrices),
  CulturesEditor: () => import("@/controllers/cultures-editor").then(m => m.CulturesEditor),
  DistributionEditor: () => import("@/controllers/goods-distribution-editor").then(m => m.DistributionEditor),
  ElevationProfile: () => import("@/controllers/elevation-profile").then(m => m.ElevationProfile),
  GoodEditor: () => import("@/controllers/good-editor").then(m => m.GoodEditor),
  GoodsEditor: () => import("@/controllers/goods-editor").then(m => m.GoodsEditor),
  HeightmapSelection: () => import("@/controllers/heightmap-selection").then(m => m.HeightmapSelection),
  HierarchyTree: () => import("@/controllers/hierarchy-tree").then(m => m.HierarchyTree),
  MarketDealsOverview: () => import("@/controllers/market-deals-overview").then(m => m.MarketDealsOverview),
  MarketOverview: () => import("@/controllers/market-overview").then(m => m.MarketOverview),
  MarketsOverview: () => import("@/controllers/markets-overview").then(m => m.MarketsOverview),
  MilitaryOverview: () => import("@/controllers/military-overview").then(m => m.MilitaryOverview),
  Minimap: () => import("@/controllers/minimap").then(m => m.Minimap),
  NamesbaseEditor: () => import("@/controllers/namesbase-editor").then(m => m.NamesbaseEditor),
  ProductionChains: () => import("@/controllers/production-chains").then(m => m.ProductionChains),
  ProductionOverview: () => import("@/controllers/production-overview").then(m => m.ProductionOverview),
  RegimentEditor: () => import("@/controllers/regiment-editor").then(m => m.RegimentEditor),
  RegimentsOverview: () => import("@/controllers/regiments-overview").then(m => m.RegimentsOverview),
  ReligionsEditor: () => import("@/controllers/religions-editor").then(m => m.ReligionsEditor),
  RiverCreator: () => import("@/controllers/river-creator").then(m => m.RiverCreator),
  RiverEditor: () => import("@/controllers/river-editor").then(m => m.RiverEditor),
  RiversOverview: () => import("@/controllers/rivers-overview").then(m => m.RiversOverview),
  RouteCreator: () => import("@/controllers/route-creator").then(m => m.RouteCreator),
  RouteEditor: () => import("@/controllers/route-editor").then(m => m.RouteEditor),
  RouteGroupsEditor: () => import("@/controllers/route-groups-editor").then(m => m.RouteGroupsEditor),
  RoutesOverview: () => import("@/controllers/routes-overview").then(m => m.RoutesOverview),
  StatesEditor: () => import("@/controllers/states-editor").then(m => m.StatesEditor),
  TradeAnimationEditor: () => import("@/controllers/trade-animation-editor").then(m => m.TradeAnimationEditor),
  TradeDetails: () => import("@/controllers/trade-details").then(m => m.TradeDetails),
  View3d: () => import("@/controllers/view-3d").then(m => m.View3d)
});

type ControllersRegistry = typeof Controllers;
declare global {
  // biome-ignore lint/suspicious/noRedeclare: exposed on window for legacy JS
  var Controllers: ControllersRegistry;
}
window.Controllers = Controllers;
