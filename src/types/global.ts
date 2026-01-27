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
  var nameBases: any;
  var pointsInput: HTMLInputElement;
  var culturesInput: HTMLInputElement;
  var culturesSet: HTMLSelectElement;
  var heightExponentInput: HTMLInputElement;
  var alertMessage: HTMLElement;

  var $: (selector: any) => any;

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
  var COA: any;
  var FlatQueue: any;
}
