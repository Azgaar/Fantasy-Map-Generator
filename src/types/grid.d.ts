interface IGrid {
  spacing: number;
  boundary: TPoints;
  points: TPoints;
  features: IFeature[];
  cells: {
    i: IntArray;
    b: IntArray;
    c: number[][];
    h: IntArray;
    t: IntArray;
    f: IntArray;
    prec: IntArray;
  };
}
interface IFeature {
  i: number;
  land: boolean;
  border: boolean;
  type: "ocean" | "lake" | "island";
}
