import {connectVertices} from "scripts/connectVertices";

export function getPaths(
  cellNeighbors: number[][],
  cellVertices: number[][],
  vertices: IGraphVertices,
  getType: (cellId: number) => number
) {
  const paths: Dict<string> = {};

  function addPath(index: number, points: TPoints) {
    if (!paths[index]) paths[index] = "";
    paths[index] += "M" + points.join("L") + "Z";
  }

  const checkedCells = new Uint8Array(cellNeighbors.length);
  for (let cellId = 0; cellId < cellNeighbors.length; cellId++) {
    if (checkedCells[cellId]) continue;
    if (!getType(cellId)) continue;
    checkedCells[cellId] = 1;

    const type = getType(cellId);
    const ofSameType = (cellId: number) => getType(cellId) === type;

    const isOnborder = cellNeighbors[cellId].some(cellId => !ofSameType(cellId));
    if (!isOnborder) continue;

    const startingVertex = cellVertices[cellId].find(v => vertices.c[v].some(cellId => !ofSameType(cellId)));
    if (startingVertex === undefined) throw new Error(`getPath: starting vertex for cell ${cellId} is not found`);

    const chain = connectVertices({vertices, startingVertex, ofSameType, checkedCellsMutable: checkedCells});

    if (chain.length < 3) continue;
    const points = chain.map(v => vertices.p[v]);

    addPath(type, points);
  }

  return paths;
}
