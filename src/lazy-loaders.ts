// Layer-agnostic registry of rarely-used modules, each fetched on demand as its own Rollup chunk.
// Loaded eagerly via its own <script> in index.html so that `window.lazy` is available to classic call sites.
// See docs/architecture/lazy_loading.md.
const lazyLoaders = {
  supporters: () => import("@/data/supporters"),
  installation: () => import("@/services/installation"),
  minimap: () => import("@/controllers/minimap"),
  exportJson: () => import("@/io/export-json"),
  hierarchyTree: () => import("@/controllers/hierarchy-tree"),
  heightmapSelection: () => import("@/controllers/heightmap-selection"),
  culturesEditor: () => import("@/controllers/cultures-editor"),
  religionsEditor: () => import("@/controllers/religions-editor"),
  statesEditor: () => import("@/controllers/states-editor"),
  battleScreen: () => import("@/controllers/battle-screen"),
  regimentEditor: () => import("@/controllers/regiment-editor"),
  militaryOverview: () => import("@/controllers/military-overview"),
  regimentsOverview: () => import("@/controllers/regiments-overview")
};

window.lazy = lazyLoaders;

declare global {
  var lazy: typeof lazyLoaders;
}
