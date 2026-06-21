import "./charts-overview";
import "./coastline-editor";
import "./compare-prices";
import "./elevation-profile";
import "./market-deals-overview";
import "./market-overview";
import "./markets-overview";
import "./namesbase-editor";
import "./production-overview";
import "./production-chains";
import "./trade-animation-editor";
import "./trade-details";
import "./view-3d";

const lazyLoaders = {
  supporters: () => import("./supporters"),
  installation: () => import("./installation"),
  minimap: () => import("./minimap"),
  exportJson: () => import("./export-json"),
  hierarchyTree: () => import("./hierarchy-tree"),
  heightmapSelection: () => import("./heightmap-selection"),
  culturesEditor: () => import("./cultures-editor"),
  religionsEditor: () => import("./religions-editor"),
  statesEditor: () => import("./states-editor")
};

window.lazy = lazyLoaders;

declare global {
  var lazy: typeof lazyLoaders;
}
