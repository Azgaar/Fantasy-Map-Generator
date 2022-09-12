import polylabel from "polylabel";

import {TIME} from "config/logging";
import {connectVertices} from "./connectVertices";
import {rn} from "utils/numberUtils";

interface IGetPolesProps {
  vertices: IGraphVertices;
  cellNeighbors: number[][];
  cellVertices: number[][];
  getType: (cellId: number) => number;
}

export function getPolesOfInaccessibility(props: IGetPolesProps) {
  TIME && console.time("getPolesOfInaccessibility");
  const multiPolygons = getMultiPolygons(props);
  const sortByLength = (a: unknown[], b: unknown[]) => b.length - a.length;
  console.log(multiPolygons);

  const poles: Dict<TPoint> = Object.fromEntries(
    Object.entries(multiPolygons).map(([id, multiPolygon]) => {
      const [x, y] = polylabel(multiPolygon.sort(sortByLength), 20);
      return [id, [rn(x), rn(y)]];
    })
  );

  TIME && console.timeEnd("getPolesOfInaccessibility");
  return poles;
}

function getMultiPolygons({vertices, getType, cellNeighbors, cellVertices}: IGetPolesProps) {
  const multiPolygons: Dict<number[][][]> = {};

  const checkedCells = new Uint8Array(cellNeighbors.length);
  const addToChecked = (cellId: number) => {
    checkedCells[cellId] = 1;
  };
  const isChecked = (cellId: number) => checkedCells[cellId] === 1;

  for (let cellId = 0; cellId < cellNeighbors.length; cellId++) {
    if (isChecked(cellId) || getType(cellId) === 0) continue;
    addToChecked(cellId);

    const type = getType(cellId);
    const ofSameType = (cellId: number) => getType(cellId) === type;
    const ofDifferentType = (cellId: number) => getType(cellId) !== type;

    const onborderCell = cellNeighbors[cellId].find(ofDifferentType);
    if (onborderCell === undefined) continue;

    const startingVertex = cellVertices[cellId].find(v => vertices.c[v].some(ofDifferentType));
    if (startingVertex === undefined) throw new Error(`Starting vertex for cell ${cellId} is not found`);

    const vertexChain = connectVertices({vertices, startingVertex, ofSameType, addToChecked, closeRing: true});
    if (vertexChain.length < 3) continue;

    addPolygon(type, vertexChain);
  }

  return multiPolygons;

  function addPolygon(id: number, vertexChain: number[]) {
    if (!multiPolygons[id]) multiPolygons[id] = [];
    const polygon = vertexChain.map(vertex => vertices.p[vertex]);
    multiPolygons[id].push(polygon);
  }
}
