import {ERROR} from "config/logging";

export function getFeatureVertices({
  firstCell,
  vertices,
  cells,
  featureIds,
  featureId
}: {
  firstCell: number;
  vertices: IGraphVertices;
  cells: Pick<IPack["cells"], "c" | "v">;
  featureIds: Uint16Array;
  featureId: number;
}) {
  const packCellsNumber = cells.c.length;

  const startingCell = findStartingCell({firstCell, featureIds, featureId, vertices, cells, packCellsNumber});
  const startingVertex = findStartingVertex({startingCell, featureIds, featureId, vertices, cells, packCellsNumber});
  const featureVertices = connectVertices({vertices, startingVertex, featureIds, featureId});

  return featureVertices;
}

function findStartingCell({
  firstCell,
  featureIds,
  featureId,
  vertices,
  cells,
  packCellsNumber
}: {
  firstCell: number;
  featureIds: Uint16Array;
  featureId: number;
  vertices: IGraphVertices;
  cells: Pick<IPack["cells"], "c" | "v">;
  packCellsNumber: number;
}) {
  const bordersOtherFeature = cells.c[firstCell].some(neighbor => featureIds[neighbor] !== featureId);
  if (bordersOtherFeature) return firstCell;

  const neibCells = cells.c[firstCell].sort((a, b) => a - b);
  for (const neibCell of neibCells) {
    const cellVertices = cells.v[neibCell];
    const edgingVertex = cellVertices.findIndex(vertex => vertices.c[vertex].some(cellId => cellId >= packCellsNumber));
    if (edgingVertex !== -1) {
      const engingCell = cells.c[neibCell];
      return engingCell[edgingVertex];
    }
  }

  throw new Error(`Markup: firstCell ${firstCell} of feature ${featureId} has no neighbors of other features`);
}

function findStartingVertex({
  startingCell,
  featureIds,
  featureId,
  vertices,
  cells,
  packCellsNumber
}: {
  startingCell: number;
  featureIds: Uint16Array;
  featureId: number;
  vertices: IGraphVertices;
  cells: Pick<IPack["cells"], "c" | "v">;
  packCellsNumber: number;
}) {
  const neibCells = cells.c[startingCell];
  const cellVertices = cells.v[startingCell];

  const externalVertex = cellVertices.find(vertex => {
    const [x, y] = vertices.p[vertex];
    if (x < 0 || y < 0) return true;
    return vertices.c[vertex].some((cellId: number) => cellId >= packCellsNumber);
  });
  if (externalVertex !== undefined) return externalVertex;

  const otherFeatureNeibs = neibCells.filter(neibCell => featureIds[neibCell] !== featureId);
  if (!otherFeatureNeibs.length) {
    throw new Error(`Markup: firstCell ${startingCell} of feature ${featureId} has no neighbors of other features`);
  }

  const index = neibCells.indexOf(Math.min(...otherFeatureNeibs)!);
  return cellVertices[index];
}

const CONNECT_VERTICES_MAX_ITERATIONS = 50000;

// connect vertices around feature
function connectVertices({
  vertices,
  startingVertex,
  featureIds,
  featureId
}: {
  vertices: IGraphVertices;
  startingVertex: number;
  featureIds: Uint16Array;
  featureId: number;
}) {
  const ofSameType = (cellId: number) => featureIds[cellId] === featureId;
  const chain: number[] = []; // vertices chain to form a path

  let next = startingVertex;
  for (let i = 0; i === 0 || (next !== startingVertex && i < CONNECT_VERTICES_MAX_ITERATIONS); i++) {
    const previous = chain.at(-1);
    const current = next;
    chain.push(current);

    const [c1, c2, c3] = vertices.c[current].map(ofSameType);
    const [v1, v2, v3] = vertices.v[current];

    if (v1 !== previous && c1 !== c2) next = v1;
    else if (v2 !== previous && c2 !== c3) next = v2;
    else if (v3 !== previous && c1 !== c3) next = v3;

    if (next === current) {
      ERROR && console.error("Next vertex is not found");
      break;
    }
  }

  return chain;
}
