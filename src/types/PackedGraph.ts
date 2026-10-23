import type { AddedLabel } from "@/model/annotations/added-labels";
import type { Measurer } from "@/model/annotations/measurers-generator";
import type { Good } from "@/model/economy/goods-generator";
import type { Deal, Market } from "@/model/economy/markets-generator";
import type { Route } from "@/model/economy/routes-generator";
import type { Biome } from "@/model/physical/biomes-generator";
import type { Feature } from "@/model/physical/features-generator";
import type { Ice } from "@/model/physical/ice-generator";
import type { ReliefIcon } from "@/model/physical/relief-generator";
import type { River } from "@/model/physical/river-generator";
import type { Burg } from "@/model/political/burgs-generator";
import type { Province } from "@/model/political/provinces-generator";
import type { State } from "@/model/political/states-generator";
import type { Zone } from "@/model/political/zones-generator";
import type { Culture } from "@/model/society/cultures-generator";
import type { Religion } from "@/model/society/religions-generator";
import type { Marker } from "@/model/story/markers-generator";
import type { Journey } from "./Journey";
import type { Legend } from "./Legend";

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
  relief: ReliefIcon[];
  biomes: Biome[];
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
  measurers: Measurer[];
  addedLabels: AddedLabel[];
  journeys: Journey[];
  legends: Legend[];
}
