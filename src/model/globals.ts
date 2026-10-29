import type { GridGraph } from "@/types/grid-graph";
import type { PackedGraph } from "@/types/packed-graph";

globalThis.grid = {} as GridGraph; // initial graph based on a jittered square grid
globalThis.pack = {} as PackedGraph; // packed graph and everything derived from it
globalThis.TIME = true;
globalThis.ERROR = true;

declare global {
  var grid: GridGraph;
  var pack: PackedGraph;
  // legacy switches the fork's astral renderers still gate their timing/error logs on
  var TIME: boolean;
  var ERROR: boolean;
}
