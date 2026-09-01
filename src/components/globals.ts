// The ambient state the app has not finished owning yet. Every name here is read bare by dozens of
// modules across every layer, so it stays on globalThis; this is its single declaration site.
// Retire entries one by one: give a global a real owner, make its readers import it, delete it here
import type { GridGraph } from "@/types/GridGraph";
import type { PackedGraph } from "@/types/PackedGraph";

// world data: wiped and rebuilt on every generation
globalThis.grid = {} as GridGraph; // initial graph based on a jittered square grid
globalThis.pack = {} as PackedGraph; // packed graph and everything derived from it
globalThis.mapCoordinates = {}; // where the map sits on the globe
globalThis.notes = [];

// map identity, written by services/stats.ts on generation and by the loader
globalThis.seed = "";
globalThis.mapId = 0;
globalThis.mapHistory = [];

// voronoi graph extent, fixed once a map is generated; the svg canvas resolution, which is not
globalThis.graphWidth = 0;
globalThis.graphHeight = 0;
globalThis.svgWidth = 0;
globalThis.svgHeight = 0;

// current map view transform, written by the zoom handlers in components/zoom.ts
globalThis.scale = 1;
globalThis.viewX = 0;
globalThis.viewY = 0;

// active customization mode, 0 when none. Editors set it to claim exclusive control of the map
globalThis.customization = 0;

declare global {
  var grid: GridGraph;
  var pack: PackedGraph;
  var mapCoordinates: { latT?: number; latN?: number; latS?: number; lonT?: number; lonW?: number; lonE?: number };
  var notes: any[]; // TODO: correct type
  var seed: string;
  var mapId: number;
  var mapHistory: { created: number; [key: string]: unknown }[];
  var graphWidth: number;
  var graphHeight: number;
  var svgWidth: number;
  var svgHeight: number;
  var scale: number;
  var viewX: number;
  var viewY: number;
  var customization: number;
}
