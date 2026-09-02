// What was generated, for the console and for anything watching the app from outside
import { getMapId, recordMapInHistory, setMapId } from "@/components/lifecycle";
import { isLocked } from "@/utils/preferences";

export function logStats({ isNewMap = true } = {}): void {
  const heightmap = options.heightmap.template;
  const isTemplate = heightmap in heightmapTemplates;
  const heightmapType = isTemplate ? "template" : "precreated";
  const isRandomTemplate = isTemplate && !isLocked("template") ? "random " : "";

  if (isNewMap) setMapId(Date.now()); // a map's id is the moment it was generated
  recordMapInHistory({
    seed: options.seed,
    width: options.graph.width,
    height: options.graph.height,
    template: heightmap,
    created: getMapId()
  });

  INFO &&
    console.info(` Seed: ${options.seed}
    Canvas size: ${options.graph.width}x${options.graph.height} px
    Heightmap: ${heightmap}
    Template: ${isRandomTemplate}${heightmapType}
    Points: ${grid.points.length}
    Cells: ${pack.cells.i.length}
    Map size: ${options.geography.mapSize}%
    States: ${pack.states.length - 1}
    Provinces: ${pack.provinces.length - 1}
    Burgs: ${pack.burgs.length - 1}
    Religions: ${pack.religions.length - 1}
    Culture set: ${culturesSet.value}
    Cultures: ${pack.cultures.length - 1}`);
}

// Legacy seam: reached as a bare global from generators/resample.ts, which cannot import this
// module without dragging the app shell into its unit tests
declare global {
  // biome-ignore lint/suspicious/noRedeclare: exposed on window for legacy JS
  var logStats: typeof import("./stats").logStats;
}
window.logStats = logStats;
