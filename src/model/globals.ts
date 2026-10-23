import type { GridGraph } from "@/types/GridGraph";
import type { PackedGraph } from "@/types/PackedGraph";

globalThis.grid = {} as GridGraph; // initial graph based on a jittered square grid
globalThis.pack = {} as PackedGraph; // packed graph and everything derived from it

declare global {
  var grid: GridGraph;
  var pack: PackedGraph;
}
