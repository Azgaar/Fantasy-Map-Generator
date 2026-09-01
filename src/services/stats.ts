// What was generated, for the console and for anything watching the app from outside
import { ensureEl } from "@/utils/nodeUtils";
import { stored } from "@/utils/preferences";

/** Stamp the new map with an id, record it in the session history and report it */
export function logStats(): void {
  const heightmap = ensureEl<HTMLInputElement>("templateInput").value;
  const isTemplate = heightmap in heightmapTemplates;
  const heightmapType = isTemplate ? "template" : "precreated";
  const isRandomTemplate = isTemplate && !stored("template") ? "random " : "";

  mapId = Date.now(); // the unique map id is its creation date
  mapHistory.push({ seed, width: graphWidth, height: graphHeight, template: heightmap, created: mapId });

  INFO &&
    console.info(`  Seed: ${seed}
    Canvas size: ${graphWidth}x${graphHeight} px
    Heightmap: ${heightmap}
    Template: ${isRandomTemplate}${heightmapType}
    Points: ${grid.points.length}
    Cells: ${pack.cells.i.length}
    Map size: ${options.mapSize}%
    States: ${pack.states.length - 1}
    Provinces: ${pack.provinces.length - 1}
    Burgs: ${pack.burgs.length - 1}
    Religions: ${pack.religions.length - 1}
    Culture set: ${culturesSet.value}
    Cultures: ${pack.cultures.length - 1}`);

  // consumed by the e2e suite and by external integrations
  window.mapId = mapId;
  window.dispatchEvent(new CustomEvent("map:generated", { detail: { seed, mapId } }));
}

// Legacy seam: classic public/ code reaches it as a global
declare global {
  // biome-ignore lint/suspicious/noRedeclare: exposed on window for legacy JS
  var logStats: () => void;
  interface Window {
    mapId: number;
  }
}
window.logStats = logStats;
