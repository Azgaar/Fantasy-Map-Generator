import type { GridFeature } from "@/generators/features";
import type { Cells, Vertices } from "@/generators/voronoi";
import type { Point } from "./global";

/** cells of the initial graph: `Cells` fields come from the Voronoi diagram, the rest is generated on top of it */
export interface GridCells extends Cells {
  h: Uint8Array; // heights [0, 100], 20 is the sea level
  t: Int8Array; // distance field: 1 = land coast, 2+ = inland, -1 = water coast, -2- = deep water
  f: Uint16Array; // feature id
  temp: Int8Array; // temperature, °C
  prec: Uint8Array; // precipitation
}

/** the initial graph: a jittered square grid of points and its Voronoi diagram. See `PackedGraph` for the repacked one */
export interface GridGraph {
  seed: string;
  spacing: number; // distance between points before jittering
  cellsDesired: number; // requested number of cells, the actual number is close to it
  cellsX: number; // number of cells in a row
  cellsY: number; // number of cells in a column
  boundary: Point[]; // pseudo-points along the map edge, not real cells
  points: Point[]; // jittered square grid points, one per cell
  cells: GridCells;
  vertices: Vertices;
  features: GridFeature[]; // index 0 is a placeholder, feature ids start from 1
}
