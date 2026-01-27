import type { PackedGraphFeature } from "../modules/features";
import type { River } from "../modules/river-generator";
import type { State } from "../modules/states-generator";

type TypedArray =
  | Uint8Array
  | Uint16Array
  | Uint32Array
  | Int8Array
  | Int16Array
  | Float32Array
  | Float64Array;

export interface PackedGraph {
  cells: {
    i: number[]; // cell indices
    c: number[][]; // neighboring cells
    v: number[][]; // neighboring vertices
    p: [number, number][]; // cell polygon points
    b: boolean[]; // cell is on border
    h: TypedArray; // cell heights
    t: TypedArray; // cell terrain types
    r: Uint16Array; // river id passing through cell
    f: Uint16Array; // feature id occupying cell
    fl: TypedArray; // flux presence in cell
    conf: TypedArray; // cell water confidence
    haven: TypedArray; // cell is a haven
    g: number[]; // cell ground type
    culture: number[]; // cell culture id
    biome: TypedArray; // cell biome id
    harbor: TypedArray; // cell harbour presence
    state: Uint16Array; // state id occupying cell
    s: TypedArray; // cell population score
    burg: number[]; // burg id in cell
    area: number[]; // cell area
    pop: number[]; // cell population
    religion: number[]; // cell religion id
  };
  vertices: {
    i: number[]; // vertex indices
    c: [number, number, number][]; // neighboring cells
    v: number[][]; // neighboring vertices
    x: number[]; // x coordinates
    y: number[]; // y coordinates
    p: [number, number][]; // vertex points
  };
  rivers: River[];
  features: PackedGraphFeature[];
  states: State[];
  burgs: any[]; // TODO: import Burg type when burgs-generator is fully migrated
  cultures: any[];
  religions: any[];
}
