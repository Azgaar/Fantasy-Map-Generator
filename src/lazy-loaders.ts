// Layer-agnostic registry of modules loaded on demand. See docs/architecture/lazy_loading.md
const lazyLoaders = {
  battleScreen: () => import("@/controllers/battle-screen"),
  cloud: () => import("@/io/cloud"),
  coastlineEditor: () => import("@/controllers/coastline-editor"),
  culturesEditor: () => import("@/controllers/cultures-editor"),
  exportJson: () => import("@/io/export-json"),
  exportMap: () => import("@/io/export"),
  heightmapSelection: () => import("@/controllers/heightmap-selection"),
  hierarchyTree: () => import("@/controllers/hierarchy-tree"),
  installation: () => import("@/services/installation"),
  load: () => import("@/io/load"),
  militaryOverview: () => import("@/controllers/military-overview"),
  minimap: () => import("@/controllers/minimap"),
  regimentEditor: () => import("@/controllers/regiment-editor"),
  regimentsOverview: () => import("@/controllers/regiments-overview"),
  religionsEditor: () => import("@/controllers/religions-editor"),
  save: () => import("@/io/save"),
  statesEditor: () => import("@/controllers/states-editor"),
  supporters: () => import("@/data/supporters"),
  tradeAnimationEditor: () => import("@/controllers/trade-animation-editor"),
  uiTour: () => import("@/services/ui-tour")
};

window.lazy = lazyLoaders;

declare global {
  var lazy: typeof lazyLoaders;
}
