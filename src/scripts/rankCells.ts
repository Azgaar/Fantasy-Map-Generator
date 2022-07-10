import * as d3 from "d3";

import {TIME} from "config/logging";
import {normalize} from "utils/numberUtils";
import {isWater, isCoastal} from "utils/graphUtils";

const FLUX_MAX_BONUS = 250;
const SUITABILITY_FACTOR = 5;

// assess cells suitability for population and rank cells for culture centers and burgs placement
export function rankCells() {
  TIME && console.time("rankCells");
  const {cells, features} = pack;

  cells.s = new Int16Array(cells.i.length); // cell suitability array
  cells.pop = new Float32Array(cells.i.length); // cell population array

  const meanFlux = d3.median(cells.fl.filter(f => f)) || 0;
  const maxFlux = (d3.max(cells.fl) || 0) + (d3.max(cells.conf) || 0); // to normalize flux
  const meanArea = d3.mean(cells.area) || 0; // to adjust population by cell area

  for (const cellId of cells.i) {
    if (isWater(cellId)) continue; // no population in water

    const habitabilityBonus = getHabitabilityBonus(cellId); // [0, 100]
    if (!habitabilityBonus) continue; // uninhabitable biomes are excluded

    const riverBonus = getFluxBonus(cellId); // [0, 250]
    const elevationBonus = getElevationBonus(cellId); // [-10, 6]
    const coastBonus = getCoastBonus(cellId); // [-30, 30]
    const estuaryBonus = getEstuaryBonus(cellId); // [0, 15]

    const suitability =
      (habitabilityBonus + riverBonus + elevationBonus + coastBonus + estuaryBonus) / SUITABILITY_FACTOR; // [-30, 311]

    // cell rural population is suitability adjusted by cell area
    const population = suitability > 0 ? suitability * (cells.area[cellId] / meanArea) : 0;

    cells.pop[cellId] = population;
    cells.s[cellId] = suitability;
  }

  function getHabitabilityBonus(cellId: number) {
    return biomesData.habitability[cells.biome[cellId]];
  }

  function getFluxBonus(cellId: number) {
    if (!cells.fl[cellId]) return 0;
    return normalize(cells.fl[cellId] + cells.conf[cellId], meanFlux, maxFlux) * FLUX_MAX_BONUS;
  }

  function getElevationBonus(cellId: number) {
    return (50 - cells.h[cellId]) / 5;
  }

  function getCoastBonus(cellId: number) {
    if (!isCoastal(cellId)) return 0;

    const havenCell = cells.haven[cellId];
    const {group} = features[cells.f[havenCell]];

    // lake coast
    if (group === "freshwater") return 30;
    if (group == "salt") return 10;
    if (group == "frozen") return 1;
    if (group == "dry") return 1;
    if (group == "sinkhole") return 3;
    if (group == "lava") return -30;

    // ocean coast
    if (cells.harbor[cellId] === 1) return 25; // safe harbor
    return 5; // unsafe harbor
  }

  // estuary bonus is [0, 15]
  function getEstuaryBonus(cellId: number) {
    return cells.r[cellId] && isCoastal(cellId) ? 15 : 0;
  }

  TIME && console.timeEnd("rankCells");
}
