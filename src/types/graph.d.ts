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
  b: Logical[];
  c: number[][];
  v: number[][];
}
