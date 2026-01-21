import { PackedGraphFeature } from "./features";
import { River } from "./river-generator";

export interface PackedGraph {
  cells: {
    i: number[]; // cell indices
    c: number[][]; // neighboring cells
    v: number[][]; // neighboring vertices
    b: boolean[]; // cell is on border
    h: Uint8Array; // cell heights
    t: Uint8Array; // cell terrain types
    r: Uint16Array; // river id passing through cell
    f: Uint16Array; // feature id occupying cell
    fl: Uint16Array | Uint8Array; // flux presence in cell
    conf: Uint16Array | Uint8Array; // cell water confidence
    haven: Uint8Array; // cell is a haven
    g: number[]; // cell ground type
    culture: number[]; // cell culture id
    p: [number, number][]; // cell polygon points
  };
  vertices: {
    i: number[]; // vertex indices
    c: number[][]; // neighboring cells
    v: number[][]; // neighboring vertices
    x: number[]; // x coordinates
    y: number[]; // y coordinates
  };
  rivers: River[];
  features: PackedGraphFeature[];
}