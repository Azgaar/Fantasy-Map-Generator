import type { Selection } from "d3";
import type { PackedGraph } from "./PackedGraph";

declare global {
  var seed: string;
  var pack: PackedGraph;
  var grid: any;
  var graphHeight: number;
  var graphWidth: number;
  var TIME: boolean;
  var WARN: boolean;
  var ERROR: boolean;

  var heightmapTemplates: any;
  var Names: any;
  var pointsInput: HTMLInputElement;
  var heightExponentInput: HTMLInputElement;

  var rivers: Selection<SVGElement, unknown, null, undefined>;
  var oceanLayers: Selection<SVGGElement, unknown, null, undefined>;
  var biomesData: {
    i: number[];
    name: string[];
    color: string[];
    biomesMatrix: Uint8Array[];
    habitability: number[];
    iconsDensity: number[];
    icons: string[][];
    cost: number[];
  };
}
