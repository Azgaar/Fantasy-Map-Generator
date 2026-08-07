import { Grid, Pack } from "./types";

export interface SerializedMapData {
  seed: string;
  width: number;
  height: number;
  cellsDesired: number;
  spacing: number;
  cellsX: number;
  cellsY: number;
  points: [number, number][];
  boundary: [number, number][];
  
  // Grid topology arrays (converted to normal arrays for JSON)
  cellsI: number[];
  cellsV: number[][];
  cellsC: number[][];
  cellsB: number[];

  // Simulation arrays
  heights: number[];
  temp: number[];
  prec: number[];
  flowDirections: number[];
  flux: number[];
  rivers: number[];
  biomes: number[];
  cellCultures: number[];
  cellStates: number[];
  cellProvinces: number[];

  // Collections
  cultures: any[];
  burgs: any[];
  states: any[];
  provinces: any[];
  routes: any[];
  military: any[];
}

export function serializeMapState(state: any): string {
  const data: SerializedMapData = {
    seed: state.seed,
    width: state.width,
    height: state.height,
    cellsDesired: state.grid.cellsDesired,
    spacing: state.grid.spacing,
    cellsX: state.grid.cellsX,
    cellsY: state.grid.cellsY,
    points: state.grid.points,
    boundary: state.grid.boundary,
    
    cellsI: Array.from(state.grid.cells.i),
    cellsV: state.grid.cells.v,
    cellsC: state.grid.cells.c,
    cellsB: Array.from(state.grid.cells.b),

    heights: state.heights ? Array.from(state.heights) : [],
    temp: state.temp ? Array.from(state.temp) : [],
    prec: state.prec ? Array.from(state.prec) : [],
    flowDirections: state.flowDirections ? Array.from(state.flowDirections) : [],
    flux: state.flux ? Array.from(state.flux) : [],
    rivers: state.rivers ? Array.from(state.rivers) : [],
    biomes: state.biomes ? Array.from(state.biomes) : [],
    cellCultures: state.cellCultures ? Array.from(state.cellCultures) : [],
    cellStates: state.cellStates ? Array.from(state.cellStates) : [],
    cellProvinces: state.cellProvinces ? Array.from(state.cellProvinces) : [],

    cultures: state.cultures || [],
    burgs: state.burgs || [],
    states: state.states || [],
    provinces: state.provinces || [],
    routes: state.routes || [],
    military: state.military || []
  };

  return JSON.stringify(data);
}

export function deserializeMapState(jsonStr: string): any {
  const data: SerializedMapData = JSON.parse(jsonStr);

  const grid: Grid = {
    cellsDesired: data.cellsDesired,
    spacing: data.spacing,
    cellsX: data.cellsX,
    cellsY: data.cellsY,
    points: data.points,
    boundary: data.boundary,
    cells: {
      i: new Uint32Array(data.cellsI),
      v: data.cellsV,
      c: data.cellsC,
      b: new Uint8Array(data.cellsB)
    },
    vertices: {
      p: [], // Recomputed if needed, or left empty if unused
      c: [],
      v: []
    }
  };

  return {
    seed: data.seed,
    width: data.width,
    height: data.height,
    grid,
    heights: new Uint8Array(data.heights),
    temp: new Float32Array(data.temp),
    prec: new Uint8Array(data.prec),
    flowDirections: new Int32Array(data.flowDirections),
    flux: new Float32Array(data.flux),
    rivers: new Uint16Array(data.rivers),
    biomes: new Uint8Array(data.biomes),
    cellCultures: new Uint8Array(data.cellCultures),
    cellStates: new Uint8Array(data.cellStates),
    cellProvinces: new Uint16Array(data.cellProvinces),
    cultures: data.cultures,
    burgs: data.burgs,
    states: data.states,
    provinces: data.provinces,
    routes: data.routes,
    military: data.military
  };
}
