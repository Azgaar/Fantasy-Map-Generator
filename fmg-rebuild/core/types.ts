export interface GridCells {
  i: Uint32Array | Uint16Array; // Cell indices
  v: number[][]; // Vertex indices for each cell
  c: number[][]; // Adjacent cell indices for each cell
  b: Uint8Array; // Border indicator (1 if borders edge, 0 otherwise)
  h?: Uint8Array; // Elevation [0, 100]
  f?: Uint16Array | Uint32Array; // Feature ID
  t?: Int8Array; // Distance field from water
  temp?: Float32Array; // Temperature in Celsius
  prec?: Uint8Array; // Precipitation
}

export interface GridVertices {
  p: [number, number][]; // Vertex coordinates [x, y]
  c: number[][]; // Adjacent cells (3 per vertex)
  v: number[][]; // Adjacent vertices (3 per vertex, or -1 if bordering)
}

export interface Grid {
  cellsDesired: number;
  spacing: number;
  cellsX: number;
  cellsY: number;
  points: [number, number][]; // Jittered grid point coordinates [x, y]
  boundary: [number, number][]; // Boundary points used to cut the diagram
  cells: GridCells;
  vertices: GridVertices;
}

export interface PackCells {
  i: Uint32Array | Uint16Array;
  p: [number, number][]; // Repacked cell coordinates [x, y]
  v: number[][];
  c: number[][];
  b: Uint8Array;
  g: Uint32Array | Uint16Array; // Mapping back to grid cells index
  h: Uint8Array;
  f: Uint16Array | Uint32Array;
  t: Int8Array;
  s: Uint16Array; // Score for burg placement
  biome: Uint8Array;
  burg: Uint16Array;
  culture: Uint16Array;
  state: Uint8Array;
  province: Uint16Array;
  religion: Uint16Array;
}

export interface PackVertices {
  p: [number, number][];
  c: number[][];
  v: number[][];
}

export interface Feature {
  i: number; // Feature ID
  land: boolean;
  border: boolean;
  type: "ocean" | "island" | "lake";
  group?: "ocean" | "continent" | "island" | "isle" | "lake_island" | "freshwater" | "salt" | "dry" | "sinkhole" | "lava";
  cells?: number;
  firstCell?: number;
  vertices?: number[];
  name?: string;
}

export interface Pack {
  cells: PackCells;
  vertices: PackVertices;
  features: Feature[];
}
