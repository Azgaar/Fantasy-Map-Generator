import * as d3 from "d3";

import {getName, getEmblem, generateNote} from "./specifyRegiments";
import type {IPlatoon} from "./generatePlatoons";

const MIN_DISTANCE = 20;

export function generateRegiments({
  stateId,
  platoons,
  states,
  provinceIds,
  provinces,
  burgIds,
  burgs
}: {
  stateId: number;
  platoons: IPlatoon[];
  states: TStates;
  provinceIds: Uint16Array;
  provinces: TProvinces;
  burgIds: Uint16Array;
  burgs: TBurgs;
}): IRegiment[] {
  const regiments: IRegiment[] = [];
  if (!platoons.length) return regiments;

  platoons.sort((a, b) => a.total - b.total);
  const tree = d3.quadtree(
    platoons,
    d => d.x,
    d => d.y
  ) as Quadtree<IPlatoon>;

  const removed = new Set<IPlatoon>();
  const remove = (platoon: IPlatoon) => {
    tree.remove(platoon);
    removed.add(platoon);
  };

  const expectedSize = 3 * populationRate; // expected regiment size is about 3k

  for (const platoon of platoons) {
    if (removed.has(platoon)) continue;
    remove(platoon);

    const regimentPlatoons = [platoon];
    let regimentForce = platoon.total;

    // join all overlapping mergeable platoons
    const overlapping = tree.findAll(platoon.x, platoon.y, MIN_DISTANCE);

    for (const overlappingPlatoon of overlapping) {
      if (!isMergeable(platoon, overlappingPlatoon)) continue;
      regimentPlatoons.push(overlappingPlatoon);
      regimentForce += overlappingPlatoon.total;
      remove(overlappingPlatoon);
    }

    if (regimentForce >= expectedSize) continue;
    // if joined force is still too small, check platoons in further range

    const radius = (expectedSize - platoon.total) / MIN_DISTANCE;
    const candidates = tree.findAll(platoon.x, platoon.y, radius);
    for (const candidatePlatoon of candidates) {
      if (candidatePlatoon.total >= expectedSize) break;
      if (!isMergeable(platoon, candidatePlatoon)) continue;

      regimentPlatoons.push(candidatePlatoon);
      regimentForce += candidatePlatoon.total;
      remove(candidatePlatoon);
      break;
    }

    regiments.push({
      i: regiments.length,
      icon: "", // define below
      name: "", // define below
      state: stateId,
      cell: platoon.cell,
      x: platoon.x,
      y: platoon.y,
      bx: platoon.x,
      by: platoon.y,
      total: regimentForce,
      units: getRegimentUnits(regimentPlatoons),
      isNaval: platoon.unit.type === "naval"
    });
  }

  for (const regiment of regiments) {
    regiment.name = getName(regiment, regiments, provinceIds, burgIds, provinces, burgs);
    regiment.icon = getEmblem(regiment, states, burgs, burgIds);
    generateNote(regiment, provinceIds, burgIds, provinces, burgs); // TODO: move out of military generation
  }

  return regiments;
}

// check if 2 plattons can be merged
function isMergeable(platoon1: IPlatoon, platoon2: IPlatoon) {
  return platoon1.unit.name === platoon2.unit.name || (!platoon1.unit.separate && !platoon2.unit.separate);
}

function getRegimentUnits(platoons: IPlatoon[]) {
  const units: {[key: string]: number} = {};
  for (const platoon of platoons) {
    if (!units[platoon.unit.name]) units[platoon.unit.name] = 0;
    units[platoon.unit.name] += platoon.total;
  }

  return units;
}
