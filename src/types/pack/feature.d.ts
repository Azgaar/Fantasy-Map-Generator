interface IPackFeatureBase {
  i: number; // feature id starting from 1
  border: boolean; // if touches map border
  cells: number; // number of cells
  firstCell: number; // index of the top left cell
  vertices: number[]; // indexes of perimetric vertices
  area: number; // area of the feature perimetric polygon
}
3;

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
  shoreline: number[];
  height: number;
  flux?: number;
  temp?: number;
  evaporation?: number;
  outCell?: number;
}

type TPackFeature = IPackFeatureOcean | IPackFeatureIsland | IPackFeatureLake;

type FirstElement = 0;

type TPackFeatures = [FirstElement, ...TPackFeature[]];
