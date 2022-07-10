interface IGrid extends IGraph {
  cellsDesired: number;
  cellsX: number;
  cellsY: number;
  spacing: number;
  boundary: TPoints;
  points: TPoints;
  cells: IGridCells;
  features: TGridFeatures;
}

interface IGridCells extends IGraphCells {
  h: UintArray; // heights, [0, 100], see MIN_LAND_HEIGHT constant
  t: Int8Array; // see DISTANCE_FIELD enum
  f: Uint16Array; // feature id, see IGridFeature
  temp: UintArray; // temparature in Celsius
  prec: UintArray; // precipitation in inner units
}

type TGridFeatures = [0, ...IGridFeature[]];

interface IGridFeature {
  i: number; // starts from 1, not 0
  land: boolean;
  border: boolean; // if touches map edge
  type: "ocean" | "lake" | "island";
}
