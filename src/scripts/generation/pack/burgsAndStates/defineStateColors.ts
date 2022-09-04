import * as d3 from "d3";

import {getMixedColor} from "utils/colorUtils";
import {ra} from "utils/probabilityUtils";
import type {TStateStatistics} from "./collectStatistics";

export function defineStateColors(statistics: TStateStatistics) {
  const scheme: Hex[] = d3.shuffle(["#e78ac3", "#a6d854", "#ffd92f", "#66c2a5", "#fc8d62", "#8da0cb"]);
  const colors: Record<number, Hex> = {};

  // assign colors using greedy algorithm
  for (const i in statistics) {
    const {neighbors} = statistics[i];
    const schemeColor = scheme.find(schemeColor => neighbors.every(neighbor => colors[neighbor] !== schemeColor));
    colors[i] = schemeColor || ra(scheme);
    scheme.push(scheme.shift()!);
  }

  // make each color unique
  for (const i in colors) {
    const isColorReused = Object.values(colors).some(color => color === colors[i]);
    if (isColorReused) colors[i] = getMixedColor(colors[i], 0.3);
  }

  return colors;
}
