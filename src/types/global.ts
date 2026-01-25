import type { Selection } from 'd3';
import { PackedGraph } from "./PackedGraph";
import { NameBase } from '../modules/names-generator';

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
  var nameBases: NameBase[];
  
  var pointsInput: HTMLInputElement;
  var heightExponentInput: HTMLInputElement;
  var mapName: HTMLInputElement;

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

  var tip: (message: string, autoHide?: boolean, type?: "info" | "warning" | "error") => void;
  var locked: (settingId: string) => boolean;
  var unlock: (settingId: string) => void;  
}