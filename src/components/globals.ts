// The ambient state the app has not finished owning yet. Every name here is read bare by dozens of
// modules across every layer, so it stays on globalThis; this is its single declaration site.
// Retire entries one by one: give a global a real owner, make its readers import it, delete it here
import type { GridGraph } from "@/types/GridGraph";
import type { PackedGraph } from "@/types/PackedGraph";

// world data: wiped and rebuilt on every generation
globalThis.grid = {} as GridGraph; // initial graph based on a jittered square grid
globalThis.pack = {} as PackedGraph; // packed graph and everything derived from it
globalThis.notes = [];

// map metadata: the id is the moment of generation, the history lets a seed be revisited
globalThis.mapId = 0;
globalThis.mapHistory = [];

// active customization mode, 0 when none. Editors set it to claim exclusive control of the map
globalThis.customization = 0;

declare global {
  var grid: GridGraph;
  var pack: PackedGraph;
  var notes: any[]; // TODO: correct type
  var mapId: number;
  var mapHistory: { created: number; [key: string]: unknown }[];
  var customization: number;
}
