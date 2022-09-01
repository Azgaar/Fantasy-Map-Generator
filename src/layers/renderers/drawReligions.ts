import {pick} from "utils/functionUtils";
import {byId} from "utils/shorthands";
import {getPaths} from "./utils/getVertexPaths";

export function drawReligions() {
  /* global */ const {cells, vertices, features, religions} = pack;

  const paths = getPaths({
    getType: (cellId: number) => cells.religion[cellId],
    cells: pick(cells, "c", "v", "b", "h", "f"),
    vertices,
    features,
    options: {fill: true, waterGap: true, halo: false}
  });

  const getColor = (i: string) => (religions[Number(i)] as IReligion).color;

  const htmlPaths = paths.map(([index, {fill, waterGap}]) => {
    const color = getColor(index);

    return /* html */ `
      <path d="${waterGap}" fill="none" stroke="${color}" id="religion-gap${index}" />
      <path d="${fill}" fill="${color}" stroke="none" id="religion${index}" />
    `;
  });

  byId("relig")!.innerHTML = htmlPaths.join("");
}
