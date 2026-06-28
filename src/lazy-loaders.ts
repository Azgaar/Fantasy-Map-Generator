// Layer-agnostic registry of modules loaded on demand. See docs/architecture/lazy_loading.md
// Migrated TS modules import `lazy` directly; `window.lazy` exists only so the
// legacy `public/modules/**/*.js` files can reach the same registry.
export const lazy = {
  battleScreen: () => import("@/controllers/battle-screen"),
  burgEditor: () => import("@/controllers/burg-editor"),
  burgGroupEditor: () => import("@/controllers/burg-group-editor"),
  burgsOverview: () => import("@/controllers/burgs-overview"),
  chartsOverview: () => import("@/controllers/charts-overview"),
  cloud: () => import("@/io/cloud"),
  coastlineEditor: () => import("@/controllers/coastline-editor"),
  comparePrices: () => import("@/controllers/compare-prices"),
  culturesEditor: () => import("@/controllers/cultures-editor"),
  elevationProfile: () => import("@/controllers/elevation-profile"),
  exportJson: () => import("@/io/export-json"),
  exportMap: () => import("@/io/export"),
  goodsEditor: () => import("@/controllers/goods-editor"),
  heightmapSelection: () => import("@/controllers/heightmap-selection"),
  hierarchyTree: () => import("@/controllers/hierarchy-tree"),
  installation: () => import("@/services/installation"),
  load: () => import("@/io/load"),
  marketDealsOverview: () => import("@/controllers/market-deals-overview"),
  marketOverview: () => import("@/controllers/market-overview"),
  marketsOverview: () => import("@/controllers/markets-overview"),
  militaryOverview: () => import("@/controllers/military-overview"),
  minimap: () => import("@/controllers/minimap"),
  namesbaseEditor: () => import("@/controllers/namesbase-editor"),
  productionOverview: () => import("@/controllers/production-overview"),
  regimentEditor: () => import("@/controllers/regiment-editor"),
  regimentsOverview: () => import("@/controllers/regiments-overview"),
  religionsEditor: () => import("@/controllers/religions-editor"),
  save: () => import("@/io/save"),
  statesEditor: () => import("@/controllers/states-editor"),
  supporters: () => import("@/data/supporters"),
  tradeAnimationEditor: () => import("@/controllers/trade-animation-editor"),
  tradeDetails: () => import("@/controllers/trade-details"),
  uiTour: () => import("@/services/ui-tour")
};

// biome-ignore lint/correctness/noInvalidUseBeforeDeclaration: legacy modules expect `lazy`
window.lazy = lazy;

declare global {
  // biome-ignore lint/suspicious/noRedeclare: legacy modules expect `lazy`
  var lazy: Record<string, () => Promise<any>>;
}
