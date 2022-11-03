interface IPack extends IGraph {
  cells: IGraphCells & IPackCells;
  features: TPackFeatures;
  states: TStates;
  cultures: TCultures;
  provinces: TProvinces;
  burgs: TBurgs;
  rivers: TRivers;
  religions: TReligions;
  routes: TRoutes;
  events: IEvents;
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
  province: Uint16Array;
  burg: Uint16Array;
  haven: UintArray;
  harbor: UintArray;
  route: Uint8Array; // [0, 1, 2, 3], see ROUTES enum, defined by generateRoutes()
  q: Quadtree<number[]>;
}

interface IPackBase extends IGraph {
  cells: IGraphCells & Partial<IPackCells>;
  features?: TPackFeatures;
}
