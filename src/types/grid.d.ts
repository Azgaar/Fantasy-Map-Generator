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
    i: IntArray;
    b: IntArray;
    c: number[][];
    v: number[][];
    h: IntArray;
    t: IntArray;
    f: IntArray;
    prec: IntArray;
  };
  features: IFeature[];
}
interface IFeature {
  i: number;
  land: boolean;
  border: boolean;
  type: "ocean" | "lake" | "island";
}
