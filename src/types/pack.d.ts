interface IPack extends IGraph {
  cells: IGraphCells & IPackCells;
  features: TPackFeatures;
  states: IState[];
  cultures: ICulture[];
  provinces: IProvince[];
  burgs: IBurg[];
  rivers: IRiver[];
  religions: IReligion[];
}

interface IPackCells {
  p: TPoints; // cell center points
  h: Uint8Array; // heights, [0, 100], see MIN_LAND_HEIGHT constant
  t: Int8Array; // see DISTANCE_FIELD enum
  f: Uint16Array; // feature id, see TPackFeature
  g: UintArray;
  s: IntArray;
  pop: Float32Array;
  fl: UintArray;
  conf: UintArray;
  r: UintArray;
  biome: UintArray;
  area: UintArray;
  state: UintArray;
  culture: UintArray;
  religion: UintArray;
  province: UintArray;
  burg: UintArray;
  haven: UintArray;
  harbor: UintArray;
  q: Quadtree;
}

interface IPackBase extends IGraph {
  cells: IGraphCells & Partial<IPackCells>;
  features?: TPackFeatures;
}

interface IPackFeatureBase {
  i: number; // feature id starting from 1
  border: boolean; // if touches map border
  cells: number; // number of cells
  firstCell: number; // index of the top left cell
  vertices: number[]; // indexes of perimetric vertices
}

interface IPackFeatureOcean extends IPackFeatureBase {
  land: false;
  type: "ocean";
  group: "ocean" | "sea" | "gulf";
}

interface IPackFeatureIsland extends IPackFeatureBase {
  land: true;
  type: "island";
  group: "continent" | "island" | "isle" | "lake_island";
}

interface IPackFeatureLake extends IPackFeatureBase {
  land: false;
  type: "lake";
  group: "freshwater" | "salt" | "frozen" | "dry" | "sinkhole" | "lava";
  name: string;
}

type TPackFeature = IPackFeatureOcean | IPackFeatureIsland | IPackFeatureLake;

type TPackFeatures = [0, ...TPackFeature[]];

interface IState {
  i: number;
  name: string;
  fullName: string;
  removed?: boolean;
}

interface ICulture {
  i: number;
  name: string;
  removed?: boolean;
}

interface IProvince {
  i: number;
  name: string;
  fullName: string;
  removed?: boolean;
}

interface IBurg {
  i: number;
  name: string;
  cell: number;
  x: number;
  y: number;
  population: number;
  port: number;
  shanty: number;
  MFCG?: string | number;
  removed?: boolean;
}

interface IReligion {
  i: number;
  name: string;
  type: "Folk" | "Orgamized" | "Cult" | "Heresy";
  removed?: boolean;
}

interface IRiver {
  i: number;
  name: string;
  basin: number;
  parent: number;
  type: string;
  source: number;
  mouth: number;
  sourceWidth: number;
  width: number;
  widthFactor: number;
  length: number;
  discharge: number;
  cells: number[];
  points?: number[];
}
