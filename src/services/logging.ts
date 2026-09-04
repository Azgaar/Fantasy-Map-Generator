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
  INFO &&
    console.info(` Seed: ${facts.seed}
    Map size: ${facts.graph.width}x${facts.graph.height} px
    Points: ${grid.points.length}
    Cells: ${pack.cells.i.length}
    Map size: ${facts.geography.mapSize}%
    States: ${pack.states.length - 1}
    Provinces: ${pack.provinces.length - 1}
    Burgs: ${pack.burgs.length - 1}
    Religions: ${pack.religions.length - 1}
    Culture set: ${facts.cultures.set}
    Cultures: ${pack.cultures.length - 1}`);
}
