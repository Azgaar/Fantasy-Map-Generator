import {getPolesOfInaccessibility} from "scripts/getPolesOfInaccessibility";

export function specifyProvinces(
  provinceIds: Uint16Array,
  coreProvinces: IProvince[],
  wildProvinces: IProvince[],
  vertices: IGraphVertices,
  cellNeighbors: number[][],
  cellVertices: number[][]
): TProvinces {
  const getType = (cellId: number) => provinceIds[cellId];
  const poles = getPolesOfInaccessibility({vertices, getType, cellNeighbors, cellVertices});

  const provinces = [...coreProvinces, ...wildProvinces].map(province => {
    const pole = poles[province.i];
    return {...province, pole};
  });

  return [0, ...provinces];
}
