interface IGrid {
  points: TPoints;
  cells: {
    h: TypedArray;
    prec: number[];
  };
}
