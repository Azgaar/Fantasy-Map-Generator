import type { Selection } from "d3";
import type { NameBase } from "../modules/names-generator";
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
  var DEBUG: { stateLabels?: boolean; [key: string]: boolean | undefined };
  var options: any;

  var heightmapTemplates: any;
  var Routes: any;
  var populationRate: number;
  var urbanDensity: number;
  var urbanization: number;
  var distanceScale: number;
  var nameBases: NameBase[];

  var pointsInput: HTMLInputElement;
  var culturesInput: HTMLInputElement;
  var culturesSet: HTMLSelectElement;
  var heightExponentInput: HTMLInputElement;
  var alertMessage: HTMLElement;
  var mapName: HTMLInputElement;
  var distanceUnitInput: HTMLInputElement;

  var rivers: Selection<SVGElement, unknown, null, undefined>;
  var oceanLayers: Selection<SVGGElement, unknown, null, undefined>;
  var emblems: Selection<SVGElement, unknown, null, undefined>;
  var svg: Selection<SVGSVGElement, unknown, null, undefined>;
  var ice: Selection<SVGGElement, unknown, null, undefined>;
  var labels: Selection<SVGGElement, unknown, null, undefined>;
  var burgLabels: Selection<SVGGElement, unknown, null, undefined>;
  var burgIcons: Selection<SVGGElement, unknown, null, undefined>;
  var anchors: Selection<SVGGElement, unknown, null, undefined>;
  var terrs: Selection<SVGGElement, unknown, null, undefined>;
  var temperature: Selection<SVGGElement, unknown, null, undefined>;
  var markers: Selection<SVGGElement, unknown, null, undefined>;
  var defs: Selection<SVGDefsElement, unknown, null, undefined>;
  var coastline: Selection<SVGGElement, unknown, null, undefined>;
  var lakes: Selection<SVGGElement, unknown, null, undefined>;
  var getColorScheme: (scheme: string | null) => (t: number) => string;
  var getColor: (height: number, scheme: (t: number) => string) => string;
  var svgWidth: number;
  var svgHeight: number;
  var viewbox: Selection<SVGElement, unknown, null, undefined>;
  var routes: Selection<SVGElement, unknown, null, undefined>;
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
  var style: {
    burgLabels: { [key: string]: { [key: string]: string } };
    burgIcons: { [key: string]: { [key: string]: string } };
    anchors: { [key: string]: { [key: string]: string } };
    [key: string]: any;
  };

  var layerIsOn: (layerId: string) => boolean;
  var drawRoute: (route: any) => void;
  var invokeActiveZooming: () => void;
  var COArenderer: { trigger: (id: string, coa: any) => void };
  var FlatQueue: any;

  var tip: (
    message: string,
    autoHide?: boolean,
    type?: "info" | "warning" | "error",
  ) => void;
  var locked: (settingId: string) => boolean;
  var unlock: (settingId: string) => void;
  var $: (selector: any) => any;
  var scale: number;
}
