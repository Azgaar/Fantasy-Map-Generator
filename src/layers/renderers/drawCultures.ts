import {pick} from "utils/functionUtils";
import {byId} from "utils/shorthands";
import {getPaths} from "./utils/getVertexPaths";

export function drawCultures() {
  /* global */ const {cells, vertices, features, cultures} = pack;

  const paths = getPaths({
    getType: (cellId: number) => cells.culture[cellId],
    cells: pick(cells, "c", "v", "b", "h", "f"),
    vertices,
    features,
    options: {fill: true, waterGap: true, halo: false}
  });

  const getColor = (i: string) => (cultures[Number(i)] as ICulture).color;

  const htmlPaths = paths.map(([index, {fill, waterGap}]) => {
    const color = getColor(index);

    return /* html */ `
      <path d="${waterGap}" fill="none" stroke="${color}" id="culture-gap${index}" />
      <path d="${fill}" fill="${color}" stroke="none" id="culture${index}" />
    `;
  });

  byId("cults")!.innerHTML = htmlPaths.join("");
}
