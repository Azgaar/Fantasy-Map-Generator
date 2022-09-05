import * as d3 from "d3";

import {TIME} from "config/logging";
import {P, rw} from "utils/probabilityUtils";
import {relations} from "./config";

import type {TStateStatistics} from "./collectStatistics";
import type {TStateData} from "./createStateData";

export type TDiplomacy = {[key: number]: TRelation[]};

interface IDiplomacyData {
  i: number;
  type: TCultureType;
  center: number;
  expansionism: number;
  area: number;
  neighbors: number[];
}

export function generateRelations(
  statesData: TStateData[],
  statistics: TStateStatistics,
  cells: Pick<IPack["cells"], "f">
) {
  TIME && console.time("generateRelations");

  const diplomacy = getBlankDiplomacyMatrix(statesData);
  if (statesData.length < 2) return diplomacy;

  const stateAreas = Object.values(statistics).map(({area}) => area);
  const averageStateArea = d3.mean(stateAreas)!;

  for (let i = 0; i < statesData.length; i++) {
    const from = getDiplomacyData(statesData[i], statistics);

    if (diplomacy[from.i].includes("Vassal")) {
      // Vassal copy relations from its Suzerain
      const suzerain = diplomacy[from.i].indexOf("Vassal");

      for (const to of statesData) {
        if (from.i === to.i || to.i === suzerain) continue;
        diplomacy[from.i][to.i] = diplomacy[suzerain][to.i];

        // vassals are Ally to each other
        if (diplomacy[suzerain][to.i] === "Suzerain") diplomacy[from.i][to.i] = "Ally";

        for (let e = 0; e < statesData.length; e++) {
          const nested = statesData[e];
          if (nested.i === from.i || nested.i === suzerain) continue;
          if (diplomacy[nested.i][suzerain] === "Suzerain" || diplomacy[nested.i][suzerain] === "Vassal") continue;
          diplomacy[nested.i][from.i] = diplomacy[nested.i][suzerain];
        }
      }

      continue;
    }

    for (let j = i + 1; j < statesData.length; j++) {
      const to = getDiplomacyData(statesData[j], statistics);

      if (diplomacy[to.i].includes("Vassal")) {
        // relations to vassal is the same as to its Suzerain
        const suzerain = diplomacy[to.i].indexOf("Vassal");
        diplomacy[from.i][to.i] = diplomacy[from.i][suzerain];
        continue;
      }

      const isVassal = detectVassalState(from, to, averageStateArea);
      if (isVassal) {
        diplomacy[from.i][to.i] = "Suzerain";
        diplomacy[to.i][from.i] = "Vassal";
        continue;
      }

      const relations = defineRelations(from, to, cells.f);
      diplomacy[from.i][to.i] = relations;
      diplomacy[to.i][from.i] = relations;
    }
  }

  TIME && console.timeEnd("generateRelations");
  return diplomacy;
}

function getBlankDiplomacyMatrix(statesData: TStateData[]) {
  const length = statesData.length + 1;

  return statesData.reduce((acc, {i}) => {
    acc[i] = new Array(length).fill("x");
    return acc;
  }, {} as TDiplomacy);
}

function getDiplomacyData(stateData: TStateData, statistics: TStateStatistics): IDiplomacyData {
  const {i, type, center, expansionism} = stateData;
  const {neighbors, area} = statistics[i];
  return {i, type, center, expansionism, neighbors, area};
}

function detectVassalState(from: IDiplomacyData, to: IDiplomacyData, averageStateArea: number) {
  if (P(0.2)) return false;

  const isNeighbor = from.neighbors.includes(to.i);
  if (!isNeighbor) return false;

  const isMuchSmaller = from.area * 2 < to.area && from.area < averageStateArea && to.area > averageStateArea;
  if (isMuchSmaller) return true;

  return false;
}

function defineRelations(from: IDiplomacyData, to: IDiplomacyData, featureIds: Uint16Array) {
  const isNeighbor = from.neighbors.includes(to.i);
  if (isNeighbor) return rw(relations.neighbors); // relations between neighboring states

  const isNeighborOfNeighbor = from.neighbors.some(neighbor => to.neighbors.includes(neighbor));
  if (isNeighborOfNeighbor) return rw(relations.neighborsOfNeighbors); // relations between neighbors of neighbors

  const isNaval = from.type === "Naval" && to.type === "Naval" && featureIds[from.center] !== featureIds[to.center];
  if (isNaval) return rw(relations.navalToNaval); // relations between naval states on different islands

  return rw(relations.farStates); // relations between far states
}
