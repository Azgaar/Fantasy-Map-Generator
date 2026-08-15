import type { GridFeature } from "@/generators/features";
import type { GeneratedGrid } from "@/generators/grid-builder";
import type { Cells } from "@/generators/voronoi";

type CellIndexArray = Uint16Array<ArrayBufferLike> | Uint32Array<ArrayBufferLike>;

export type GridCells = Cells & {
  h: Uint8Array;
  f: CellIndexArray;
  t: Int8Array;
  temp: Int8Array;
  prec: Uint8Array;
};

/**
 * Stable grid state shared by terrain and climate generation. Domain-specific generators may
 * extend it, but its Voronoi topology and typed cell layers are always present after grid build.
 */
export type Grid = Omit<GeneratedGrid, "cells"> & {
  cells: GridCells;
  features: GridFeature[];
};
