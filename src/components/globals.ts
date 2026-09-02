import type { GridGraph } from "@/types/GridGraph";
import type { Note } from "@/types/global";
import type { PackedGraph } from "@/types/PackedGraph";

globalThis.grid = {} as GridGraph; // initial graph based on a jittered square grid
globalThis.pack = {} as PackedGraph; // packed graph and everything derived from it
globalThis.notes = [] as Note[];
globalThis.customization = 0; // active customization mode, 0 when none

declare global {
  var grid: GridGraph;
  var pack: PackedGraph;
  var notes: Note[];
  var customization: number;
}
