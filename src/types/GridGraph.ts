import type { GridFeature } from "@/generators/features-generator";
import type { Sampling } from "@/generators/lattice";
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

/** the initial graph: points on a sampling lattice and their Voronoi diagram. See `PackedGraph` for the repacked one */
export interface GridGraph {
  sampling: Sampling; // the lattice the points sit on
  spacing: number; // lattice step that gives each cell the same area, derived from the requested cell count
  cellsX: number; // number of cells in a row
  cellsY: number; // number of cells in a column
  boundary: Point[]; // pseudo-points along the map edge, not real cells
  points: Point[]; // one per lattice slot, in rows of cellsX
  cells: GridCells;
  vertices: Vertices;
  features: GridFeature[]; // index 0 is a placeholder, feature ids start from 1
}
