import {pick} from "utils/functionUtils";
import {byId} from "utils/shorthands";
import {getPaths} from "./utils/getVertexPaths";

export function drawBiomes() {
  /* global */ const {cells, vertices, features} = pack;
  /* global */ const colors = biomesData.color;

  const paths = getPaths({
    getType: (cellId: number) => cells.biome[cellId],
    cells: pick(cells, "c", "v", "b", "h", "f"),
    vertices,
    features,
    options: {fill: true, waterGap: true, halo: false}
  });

  console.log(paths);

  const htmlPaths = paths.map(([index, {fill, waterGap}]) => {
    const color = colors[Number(index)];

    return /* html */ `
      <path d="${waterGap}" fill="none" stroke="${color}" id="biome-gap${index}" />
      <path d="${fill}" fill="${color}" stroke="none" id="biome${index}" />
    `;
  });

  byId("biomes")!.innerHTML = htmlPaths.join("");
}
