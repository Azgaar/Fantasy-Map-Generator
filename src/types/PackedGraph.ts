import type { Burg } from "@/generators/burgs-generator";
import type { Culture } from "@/generators/cultures-generator";
import type { Feature } from "@/generators/features";
import type { Good } from "@/generators/goods-generator";
import type { Ice } from "@/generators/ice-generator";
import type { Marker } from "@/generators/markers-generator";
import type { Deal, Market } from "@/generators/markets-generator";
import type { Province } from "@/generators/provinces-generator";
import type { Religion } from "@/generators/religions-generator";
import type { River } from "@/generators/river-generator";
import type { Route } from "@/generators/routes-generator";
import type { State } from "@/generators/states-generator";
import type { Zone } from "@/generators/zones-generator";

export type TypedArray = Uint8Array | Uint16Array | Uint32Array | Int8Array | Int16Array | Float32Array | Float64Array;

export interface PackedGraph {
  cells: {
    i: number[]; // cell indices
    c: number[][]; // neighboring cells
    v: number[][]; // neighboring vertices
    p: [number, number][]; // cell polygon points
    b: boolean[]; // cell is on border
    h: TypedArray; // cell heights
    t: TypedArray; // cell terrain types
    r: TypedArray; // river id passing through cell
    f: TypedArray; // feature id occupying cell
    fl: TypedArray; // flux presence in cell
    s: TypedArray; // cell suitability
    pop: TypedArray; // cell population
    conf: TypedArray; // cell water confidence
    haven: TypedArray; // cell is a haven
    g: number[]; // cell ground type
    culture: TypedArray; // cell culture id
    biome: TypedArray; // cell biome id
    harbor: TypedArray; // cell harbour presence
    burg: TypedArray; // cell burg id
    religion: TypedArray; // cell religion id
    state: TypedArray; // cell state id
    area: TypedArray; // cell area
    province: TypedArray; // cell province id
    good: Uint16Array; // cell good id
    market: Uint16Array; // cell market id
    routes: Record<number, Record<number, number>>;
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
  features: Feature[];
  burgs: Burg[];
  states: State[];
  cultures: Culture[];
  routes: Route[];
  religions: Religion[];
  zones: Zone[];
  markers: Marker[];
  ice: Ice[];
  provinces: Province[];
  goods: Good[];
  markets: Market[];
  deals: Deal[];
}
