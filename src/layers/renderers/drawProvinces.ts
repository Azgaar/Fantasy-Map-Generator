import {pick} from "utils/functionUtils";
import {byId} from "utils/shorthands";
import {isProvince} from "utils/typeUtils";
import {getPaths} from "./utils/getVertexPaths";

export function drawProvinces() {
  /* global */ const {cells, vertices, features, provinces} = pack;

  const paths = getPaths({
    getType: (cellId: number) => cells.province[cellId],
    cells: pick(cells, "c", "v", "b", "h", "f"),
    vertices,
    features,
    options: {fill: true, waterGap: true, halo: false}
  });

  const getColor = (i: string) => (provinces[Number(i)] as IProvince).color;

  const getLabels = () => {
    const renderLabels = byId("provs")!.getAttribute("data-labels") === "1";
    if (!renderLabels) return [];

    return provinces.filter(isProvince).map(({i, pole: [x, y], name}) => {
      return `<text x="${x}" y="${y}" id="provinceLabel${i}">${name}</text>`;
    });
  };

  const htmlPaths = paths.map(([index, {fill, waterGap}]) => {
    const color = getColor(index);

    return /* html */ `
      <path d="${waterGap}" fill="none" stroke="${color}" id="province-gap${index}" />
      <path d="${fill}" fill="${color}" stroke="none" id="province${index}" />
    `;
  });

  byId("provs")!.innerHTML = /* html*/ `
    <g id="provincesBody">
      ${htmlPaths.join("")}
    </g>
    <g id="provinceLabels">
      ${getLabels().join("")}
    </g>
  `;
}
