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
  var options: any;

  var heightmapTemplates: any;
  var Names: any;
  var Routes: any;
  var populationRate: number;
  var urbanDensity: number;
  var urbanization: number;

  var pointsInput: HTMLInputElement;
  var heightExponentInput: HTMLInputElement;

  var rivers: Selection<SVGElement, unknown, null, undefined>;
  var oceanLayers: Selection<SVGGElement, unknown, null, undefined>;
  var emblems: Selection<SVGElement, unknown, null, undefined>;
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
  var notes: any[];

  var layerIsOn: (layerId: string) => boolean;
  var drawRoute: (route: any) => void;
  var drawBurgIcon: (burg: any) => void;
  var drawBurgLabel: (burg: any) => void;
  var removeBurgIcon: (burg: any) => void;
  var removeBurgLabel: (burg: any) => void;
  var tip: (message: string, autoHide?: boolean, type?: string) => void;
}
