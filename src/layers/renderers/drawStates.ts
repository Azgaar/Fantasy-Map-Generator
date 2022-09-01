import * as d3 from "d3";

import {pick} from "utils/functionUtils";
import {byId} from "utils/shorthands";
import {getPaths} from "./utils/getVertexPaths";

export function drawStates() {
  /* global */ const {cells, vertices, features, states} = pack;

  const paths = getPaths({
    getType: (cellId: number) => cells.state[cellId],
    cells: pick(cells, "c", "v", "b", "h", "f"),
    vertices,
    features,
    options: {fill: true, waterGap: true, halo: true}
  });

  const getColor = (i: number) => (states[i] as IState).color;

  const maxLength = states.length - 1;
  const bodyPaths = new Array(maxLength);
  const clipPaths = new Array(maxLength);
  const haloPaths = new Array(maxLength);

  for (const [index, {fill, waterGap, halo}] of paths) {
    const color = getColor(Number(index));
    const haloColor = d3.color(color)?.darker().formatHex() || "#666666";

    bodyPaths.push(/* html */ `
      <path d="${waterGap}" fill="none" stroke="${color}" id="state-gap${index}" />
      <path d="${fill}" fill="${color}" stroke="none" id="state${index}" />
    `);

    clipPaths.push(/* html */ `
      <clipPath id="state-clip${index}"><use href="#state${index}"/></clipPath>
    `);

    haloPaths.push(/* html */ `
      <path id="state-border${index}" d="${halo}" clip-path="url(#state-clip${index})" stroke="${haloColor}"/>
    `);
  }

  byId("statesBody")!.innerHTML = bodyPaths.join("");
  byId("statePaths")!.innerHTML = clipPaths.join("");
  byId("statesHalo")!.innerHTML = haloPaths.join("");

  /* global */ window.Zoom.invoke();
}
