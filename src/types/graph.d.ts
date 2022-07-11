// generic part of any graph, simplest verstion of IGrid and IGraph
interface IGraph {
  vertices: IGraphVertices;
  cells: IGraphCells;
}

interface IGraphVertices {
  p: TPoints;
  v: number[][];
  c: number[][];
}

interface IGraphCells {
  i: UintArray;
  b: (0 | 1)[];
  c: number[][];
  v: number[][];
}
