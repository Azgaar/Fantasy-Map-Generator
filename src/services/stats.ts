// What was generated, for the console and for anything watching the app from outside
import { isLocked } from "@/utils/preferences";

/**
 * Record the current map in the session history and report it. A freshly generated map is stamped
 * with a new identity; a loaded one keeps the one it was saved with
 */
export function logStats({ isNewMap = true } = {}): void {
  const heightmap = Options.heightmap.template;
  const isTemplate = heightmap in heightmapTemplates;
  const heightmapType = isTemplate ? "template" : "precreated";
  const isRandomTemplate = isTemplate && !isLocked("template") ? "random " : "";

  if (isNewMap) mapId = Date.now(); // a map's id is the moment it was generated
  mapHistory.push({
    seed: Options.seed,
    width: graphWidth,
    height: graphHeight,
    template: heightmap,
    created: mapId
  });

  INFO &&
    console.info(`  Seed: ${Options.seed}
    Canvas size: ${graphWidth}x${graphHeight} px
    Heightmap: ${heightmap}
    Template: ${isRandomTemplate}${heightmapType}
    Points: ${grid.points.length}
    Cells: ${pack.cells.i.length}
    Map size: ${Options.geography.mapSize}%
    States: ${pack.states.length - 1}
    Provinces: ${pack.provinces.length - 1}
    Burgs: ${pack.burgs.length - 1}
    Religions: ${pack.religions.length - 1}
    Culture set: ${culturesSet.value}
    Cultures: ${pack.cultures.length - 1}`);

  // consumed by the e2e suite and by external integrations
  window.mapId = mapId;
  window.dispatchEvent(new CustomEvent("map:generated", { detail: { seed: Options.seed, mapId: mapId } }));
}

// Legacy seam: classic public/ code reaches it as a global
declare global {
  // biome-ignore lint/suspicious/noRedeclare: exposed on window for legacy JS
  var logStats: typeof import("./stats").logStats;
  interface Window {
    mapId: number;
  }
}
window.logStats = logStats;
