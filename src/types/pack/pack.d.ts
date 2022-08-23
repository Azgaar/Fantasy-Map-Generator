interface IPack extends IGraph {
  cells: IGraphCells & IPackCells;
  features: TPackFeatures;
  states: TStates;
  cultures: TCultures;
  provinces: IProvince[];
  burgs: TBurgs;
  rivers: IRiver[];
  religions: TReligions;
  routes: TRoutes;
}

interface IPackCells {
  p: TPoints; // cell center points
  h: Uint8Array; // heights, [0, 100], see MIN_LAND_HEIGHT constant
  t: Int8Array; // see DISTANCE_FIELD enum
  f: Uint16Array; // feature id, see TPackFeature
  g: UintArray;
  s: IntArray;
  pop: Float32Array;
  fl: Uint16Array; // flux volume, defined by drainWater() in river-generator.ts
  r: Uint16Array; // river id, defined by defineRivers() in river-generator.ts
  conf: Uint16Array; // conluence, defined by defineRivers() in river-generator.ts
  biome: Uint8Array;
  area: UintArray;
  state: Uint16Array;
  culture: Uint16Array;
  religion: Uint16Array;
  province: UintArray;
  burg: UintArray;
  haven: UintArray;
  harbor: UintArray;
  route: Uint8Array; // [0, 1, 2, 3], see ROUTES enum, defined by generateRoutes()
  q: Quadtree;
}

interface IPackBase extends IGraph {
  cells: IGraphCells & Partial<IPackCells>;
  features?: TPackFeatures;
}

interface IProvince {
  i: number;
  name: string;
  fullName: string;
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
