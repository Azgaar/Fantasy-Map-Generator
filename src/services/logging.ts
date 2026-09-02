import { isLocked } from "@/utils/preferences";
import { safeParseJSON } from "@/utils/stringUtils";

globalThis.DEBUG = safeParseJSON(localStorage.getItem("debug") ?? "") || {};
globalThis.INFO = true;
globalThis.TIME = true;
globalThis.WARN = true;
globalThis.ERROR = true;

declare global {
  var TIME: boolean;
  var INFO: boolean;
  var WARN: boolean;
  var ERROR: boolean;
  var DEBUG: { stateLabels?: boolean; [key: string]: boolean | undefined };
}

export function logStats(): void {
  const heightmap = options.heightmap.template;
  const isTemplate = heightmap in heightmapTemplates;
  const heightmapType = isTemplate ? "template" : "precreated";
  const isRandomTemplate = isTemplate && !isLocked("template") ? "random " : "";

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
