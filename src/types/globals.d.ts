declare let grid: IGrid;
declare let pack: IPack;

declare let notes: INote[];

declare let seed: string;
declare let mapId: number;
declare let mapHistory: IMapHistoryEntry[];

declare let customization: number;

declare let rulers: Rulers;
declare let biomesData: IBiomesData;
declare let nameBases: INamebase[];

declare let graphWidth: number;
declare let graphHeight: number;
declare let svgWidth: number;
declare let svgHeight: number;

declare let options: IOptions;

interface IOptions {
  pinNotes: boolean;
  showMFCGMap: boolean;
  winds: number[];
  stateLabelsMode: "auto" | "short" | "full";
  year: number;
  era: string;
  eraShort: string;
  military: any; //MARKER any
}

declare let populationRate: number;
declare let urbanization: number;
declare let distanceScale: number;
declare let urbanDensity: number;
declare let statesNeutral: number;

declare const defineSvg: (graphWidth: number, graphHeight: number) => void;

type D3Selection = d3.Selection<d3.BaseType, unknown, SVGElement, any>;

declare let elSelected: D3Selection;

let svg: D3Selection;
let defs: D3Selection;
let viewbox: D3Selection;
let scaleBar: D3Selection;
let legend: D3Selection;
let ocean: D3Selection;
let oceanLayers: D3Selection;
let oceanPattern: D3Selection;
let lakes: D3Selection;
let landmass: D3Selection;
let texture: D3Selection;
let terrs: D3Selection;
let biomes: D3Selection;
// let cells: D3Selection;
let gridOverlay: D3Selection;
let coordinates: D3Selection;
let compass: D3Selection;
let rivers: D3Selection;
let terrain: D3Selection;
let relig: D3Selection;
let cults: D3Selection;
let regions: D3Selection;
let statesBody: D3Selection;
let statesHalo: D3Selection;
let provs: D3Selection;
let zones: D3Selection;
let borders: D3Selection;
let stateBorders: D3Selection;
let provinceBorders: D3Selection;
let routes: D3Selection;
// let roads: D3Selection;
// let trails: D3Selection;
// let searoutes: D3Selection;
let temperature: D3Selection;
let coastline: D3Selection;
let ice: D3Selection;
let prec: D3Selection;
let population: D3Selection;
let emblems: D3Selection;
let labels: D3Selection;
let icons: D3Selection;
let burgLabels: D3Selection;
let burgIcons: D3Selection;
let anchors: D3Selection;
let armies: D3Selection;
let markers: D3Selection;
let fogging: D3Selection;
let ruler: D3Selection;
let debug: D3Selection;
