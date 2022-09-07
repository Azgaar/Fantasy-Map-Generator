import FlatQueue from "flatqueue";

import {DISTANCE_FIELD, ELEVATION, MIN_LAND_HEIGHT} from "config/generation";
import {gauss} from "utils/probabilityUtils";

const {WATER_COAST} = DISTANCE_FIELD;
const {MOUNTAINS, HILLS, LOWLANDS} = ELEVATION;

export function expandProvinces(
  percentage: number,
  provinces: IProvince[],
  cells: Pick<IPack["cells"], "i" | "c" | "h" | "t" | "state" | "burg">
) {
  const provinceIds = new Uint16Array(cells.i.length);

  const queue = new FlatQueue<{cellId: number; provinceId: number; stateId: number}>();
  const cost: number[] = [];

  const maxExpansionCost = percentage === 100 ? 1000 : gauss(20, 5, 5, 100) * percentage ** 0.5;

  for (const {i: provinceId, center: cellId, state: stateId} of provinces) {
    provinceIds[cellId] = provinceId;
    cost[cellId] = 1;
    queue.push({cellId, provinceId, stateId}, 0);
  }

  while (queue.length) {
    const priority = queue.peekValue()!;
    const {cellId, provinceId, stateId} = queue.pop()!;

    cells.c[cellId].forEach(neibCellId => {
      const isLand = cells.h[neibCellId] >= MIN_LAND_HEIGHT;
      if (isLand && cells.state[neibCellId] !== stateId) return; // can expand only within state

      const evevationCost = getElevationCost(cells.h[neibCellId], cells.t[neibCellId]);
      const totalCost = priority + evevationCost;
      if (totalCost > maxExpansionCost) return;

      if (!cost[neibCellId] || totalCost < cost[neibCellId]) {
        if (isLand) provinceIds[neibCellId] = provinceId; // assign province to cell
        cost[neibCellId] = totalCost;

        queue.push({cellId: neibCellId, provinceId, stateId}, totalCost);
      }
    });
  }

  return normalizeProvinces(provinceIds, cells.c, cells.state, cells.burg);
}

function getElevationCost(elevation: number, distance: number) {
  if (elevation >= MOUNTAINS) return 100;
  if (elevation >= HILLS) return 30;
  if (elevation >= LOWLANDS) return 10;
  if (elevation >= MIN_LAND_HEIGHT) return 5;
  if (distance === WATER_COAST) return 100;

  return 300; // deep water
}

function normalizeProvinces(
  provinceIds: Uint16Array,
  neibCells: number[][],
  stateIds: Uint16Array,
  burgIds: Uint16Array
) {
  const normalizedIds = Uint16Array.from(provinceIds);

  for (let cellId = 0; cellId < neibCells.length; cellId++) {
    if (!stateIds[cellId]) continue; // skip water or neutral cells
    if (burgIds[cellId]) continue; // do not overwrite burgs

    const neibs = neibCells[cellId].filter(neib => stateIds[neib] >= stateIds[cellId]);

    const adversaries = neibs.filter(neib => normalizedIds[neib] !== normalizedIds[cellId]);
    if (adversaries.length < 2) continue;

    const buddies = neibs.filter(neib => normalizedIds[neib] === normalizedIds[cellId]);
    if (buddies.length > 2) continue;

    // change cells's province
    if (adversaries.length > buddies.length) normalizedIds[cellId] = normalizedIds[adversaries[0]];
  }

  return normalizedIds;
}
