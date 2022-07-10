interface IGrid {
  spacing: number;
  boundary: TPoints;
  points: TPoints;
  vertices: {
    p: TPoints;
    v: number[][];
    c: number[][];
  };
  cells: {
    i: UintArray;
    b: UintArray;
    c: number[][];
    v: number[][];
    h: UintArray;
    t: UintArray;
    f: UintArray;
    temp: UintArray;
    prec: UintArray;
  };
  features: IGridFeature[];
}
interface IGridFeature {
  i: number;
  land: boolean;
  border: boolean;
  type: "ocean" | "lake" | "island";
}
