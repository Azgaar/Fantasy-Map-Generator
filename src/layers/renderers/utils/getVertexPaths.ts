import {MIN_LAND_HEIGHT} from "config/generation";
import {connectVertices} from "scripts/connectVertices";
import {isLake} from "utils/typeUtils";

type TPath = {fill: string; waterGap: string; halo: string};

export function getPaths({
  vertices,
  getType,
  features,
  cells,
  options
}: {
  vertices: IGraphVertices;
  getType: (cellId: number) => number;
  features: TPackFeatures;
  cells: Pick<IPack["cells"], "c" | "v" | "b" | "h" | "f">;
  options: {[key in keyof TPath]: boolean};
}) {
  const paths: Dict<TPath> = {};

  const checkedCells = new Uint8Array(cells.c.length);
  const addToChecked = (cellId: number) => {
    checkedCells[cellId] = 1;
  };
  const isChecked = (cellId: number) => checkedCells[cellId] === 1;

  for (let cellId = 0; cellId < cells.c.length; cellId++) {
    if (isChecked(cellId) || getType(cellId) === 0) continue;
    addToChecked(cellId);

    const type = getType(cellId);
    const ofSameType = (cellId: number) => getType(cellId) === type;
    const ofDifferentType = (cellId: number) => getType(cellId) !== type;

    const onborderCell = cells.c[cellId].find(ofDifferentType);
    if (onborderCell === undefined) continue;

    const feature = features[cells.f[onborderCell]];
    if (isInnerLake(feature, ofSameType)) continue;

    const startingVertex = cells.v[cellId].find(v => vertices.c[v].some(ofDifferentType));
    if (startingVertex === undefined) throw new Error(`Starting vertex for cell ${cellId} is not found`);

    const vertexChain = connectVertices({vertices, startingVertex, ofSameType, addToChecked, closeRing: true});
    if (vertexChain.length < 3) continue;

    addPath(type, vertexChain);
  }

  return Object.entries(paths);

  function getVertexPoint(vertex: number) {
    return vertices.p[vertex];
  }

  function getFillPath(vertexChain: number[]) {
    const points: TPoints = vertexChain.map(getVertexPoint);
    const firstPoint = points.shift();
    return `M${firstPoint} L${points.join(" ")}`;
  }

  function getBorderPath(vertexChain: number[], discontinue: (vertex: number) => boolean) {
    let discontinued = true;
    let lastOperation = "";
    const path = vertexChain.map(vertex => {
      if (discontinue(vertex)) {
        discontinued = true;
        return "";
      }

      const operation = discontinued ? "M" : "L";
      const command = operation === lastOperation ? "" : operation;

      discontinued = false;
      lastOperation = operation;

      return ` ${command}${getVertexPoint(vertex)}`;
    });

    return path.join("").trim();
  }

  function isBorderVertex(vertex: number) {
    const adjacentCells = vertices.c[vertex];
    return adjacentCells.some(i => cells.b[i]);
  }

  function isLandVertex(vertex: number) {
    const adjacentCells = vertices.c[vertex];
    return adjacentCells.every(i => cells.h[i] >= MIN_LAND_HEIGHT);
  }

  function addPath(index: number, vertexChain: number[]) {
    if (!paths[index]) paths[index] = {fill: "", waterGap: "", halo: ""};

    if (options.fill) paths[index].fill += getFillPath(vertexChain);
    if (options.halo) paths[index].halo += getBorderPath(vertexChain, isBorderVertex);
    if (options.waterGap) paths[index].waterGap += getBorderPath(vertexChain, isLandVertex);
  }
}

function isInnerLake(feature: 0 | TPackFeature, ofSameType: (cellId: number) => boolean) {
  if (!isLake(feature)) return false;
  return feature.shoreline.every(ofSameType);
}
