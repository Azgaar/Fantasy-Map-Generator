interface IGrid extends IGraph {
  cellsDesired: number;
  cellsX: number;
  cellsY: number;
  spacing: number;
  boundary: TPoints;
  points: TPoints;
  cells: IGraphCells & IGridCells;
  features: TGridFeatures;
}

interface IGridCells {
  h: Uint8Array; // heights, [0, 100], see MIN_LAND_HEIGHT constant
  t: Int8Array; // see DISTANCE_FIELD enum
  f: Uint16Array; // feature id, see IGridFeature
  temp: Int8Array; // temparature in Celsius
  prec: Uint8Array; // precipitation in inner units
}

interface IGridBase extends IGrid {
  cells: IGraphCells & Partial<IGridCells>;
  features?: TGridFeatures;
}

interface IGridWithHeights extends IGrid {
  cells: IGraphCells & Partial<IGridCells> & {h: Uint8Array};
  features?: TGridFeatures;
}

type TGridFeatures = [0, ...IGridFeature[]];

interface IGridFeature {
  i: number; // starts from 1, not 0
  land: boolean;
  border: boolean; // if touches map edge
  type: "ocean" | "lake" | "island";
}
