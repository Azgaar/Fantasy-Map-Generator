declare const grid: IGrid;
declare const pack: IPack;

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

declare let scaleBar: Selection<HTMLElement>;
declare let legend: Selection<HTMLElement>;

declare const defineSvg: (graphWidth: number, graphHeight: number) => void;

// old modules
declare const Biomes: {
  getDefault: () => IBiomesData;
};

declare const Names: {
  getNameBases: () => INamebase[];
};
