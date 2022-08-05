declare let grid: IGrid;
declare let pack: IPack;

declare let seed: string;
declare let mapId: number;
declare let mapHistory: IMapHistoryEntry[];

declare let elSelected: Selection<HTMLElement>;

declare let notes: INote[];
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
  winds: [number, number, number, number, number, number];
  stateLabelsMode: "auto" | "short" | "full";
}

declare let populationRate: number;
declare let urbanization: number;
declare let distanceScale: number;
declare let urbanDensity: number;
declare let statesNeutral: number;

declare const defineSvg: (graphWidth: number, graphHeight: number) => void;

let svg: Selection<SVGGElement>;
let defs: Selection<SVGDefsElement>;
let viewbox: Selection<SVGGElement>;
let scaleBar: Selection<SVGGElement>;
let legend: Selection<SVGGElement>;
let ocean: Selection<SVGGElement>;
let oceanLayers: Selection<SVGGElement>;
let oceanPattern: Selection<SVGPatternElement>;
let lakes: Selection<SVGGElement>;
let landmass: Selection<SVGGElement>;
let texture: Selection<SVGGElement>;
let terrs: Selection<SVGGElement>;
let biomes: Selection<SVGGElement>;
// let cells: Selection<SVGGElement>;
let gridOverlay: Selection<SVGGElement>;
let coordinates: Selection<SVGGElement>;
let compass: Selection<SVGGElement>;
let rivers: Selection<SVGGElement>;
let terrain: Selection<SVGGElement>;
let relig: Selection<SVGGElement>;
let cults: Selection<SVGGElement>;
let regions: Selection<SVGGElement>;
let statesBody: Selection<SVGGElement>;
let statesHalo: Selection<SVGGElement>;
let provs: Selection<SVGGElement>;
let zones: Selection<SVGGElement>;
let borders: Selection<SVGGElement>;
let stateBorders: Selection<SVGGElement>;
let provinceBorders: Selection<SVGGElement>;
let routes: Selection<SVGGElement>;
let roads: Selection<SVGGElement>;
let trails: Selection<SVGGElement>;
let searoutes: Selection<SVGGElement>;
let temperature: Selection<SVGGElement>;
let coastline: Selection<SVGGElement>;
let ice: Selection<SVGGElement>;
let prec: Selection<SVGGElement>;
let population: Selection<SVGGElement>;
let emblems: Selection<SVGGElement>;
let labels: Selection<SVGGElement>;
let icons: Selection<SVGGElement>;
let burgLabels: Selection<SVGGElement>;
let burgIcons: Selection<SVGGElement>;
let anchors: Selection<SVGGElement>;
let armies: Selection<SVGGElement>;
let markers: Selection<SVGGElement>;
let fogging: Selection<SVGGElement>;
let ruler: Selection<SVGGElement>;
let debug: Selection<SVGGElement>;
