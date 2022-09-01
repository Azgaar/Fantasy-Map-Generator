import FlatQueue from "flatqueue";

import {MIN_LAND_HEIGHT, ROUTES} from "config/generation";
import {getInputNumber} from "utils/nodeUtils";
import {gauss} from "utils/probabilityUtils";
import {isReligion} from "utils/typeUtils";

type TReligionData = Pick<IReligion, "i" | "type" | "center" | "culture" | "expansion" | "expansionism">;
type TCellsData = Pick<IPack["cells"], "i" | "c" | "h" | "biome" | "culture" | "state" | "route">;

export function expandReligions(religions: TReligionData[], cells: TCellsData) {
  const religionIds = spreadFolkReligions(religions, cells);

  const queue = new FlatQueue<{cellId: number; religionId: number}>();
  const cost: number[] = [];

  const neutralInput = getInputNumber("neutralInput");
  const maxExpansionCost = (cells.i.length / 20) * gauss(1, 0.3, 0.2, 2, 2) * neutralInput;

  const biomePassageCost = (cellId: number) => biomesData.cost[cells.biome[cellId]];

  for (const religion of religions) {
    if (!isReligion(religion as IReligion) || (religion as IReligion).type === "Folk") continue;

    const {i: religionId, center: cellId} = religion;
    religionIds[cellId] = religionId;
    cost[cellId] = 1;
    queue.push({cellId, religionId}, 0);
  }

  const religionsMap = new Map<number, TReligionData>(religions.map(religion => [religion.i, religion]));

  const isMainRoad = (cellId: number) => cells.route[cellId] === ROUTES.MAIN_ROAD;
  const isTrail = (cellId: number) => cells.route[cellId] === ROUTES.TRAIL;
  const isSeaRoute = (cellId: number) => cells.route[cellId] === ROUTES.SEA_ROUTE;
  const isWater = (cellId: number) => cells.h[cellId] < MIN_LAND_HEIGHT;

  while (queue.length) {
    const priority = queue.peekValue()!;
    const {cellId, religionId} = queue.pop()!;

    const {culture, center, expansion, expansionism} = religionsMap.get(religionId)!;

    cells.c[cellId].forEach(neibCellId => {
      if (expansion === "culture" && culture !== cells.culture[neibCellId]) return;
      if (expansion === "state" && cells.state[center] !== cells.state[neibCellId]) return;

      const cultureCost = culture !== cells.culture[neibCellId] ? 10 : 0;
      const stateCost = cells.state[center] !== cells.state[neibCellId] ? 10 : 0;
      const passageCost = getPassageCost(neibCellId);

      const cellCost = cultureCost + stateCost + passageCost;
      const totalCost = priority + 10 + cellCost / expansionism;
      if (totalCost > maxExpansionCost) return;

      if (!cost[neibCellId] || totalCost < cost[neibCellId]) {
        if (cells.culture[neibCellId]) religionIds[neibCellId] = religionId; // assign religion to cell
        cost[neibCellId] = totalCost;

        queue.push({cellId: neibCellId, religionId}, totalCost);
      }
    });
  }

  return religionIds;

  function getPassageCost(cellId: number) {
    if (isWater(cellId)) return isSeaRoute(cellId) ? 50 : 500;
    if (isMainRoad(cellId)) return 1;
    const biomeCost = biomePassageCost(cellId); // [1, 5000]
    return isTrail(cellId) ? biomeCost / 1.5 : biomeCost;
  }
}

// folk religions initially get all cells of their culture
function spreadFolkReligions(religions: TReligionData[], cells: TCellsData) {
  const religionIds = new Uint16Array(cells.i.length);

  const folkReligions = religions.filter(({type}) => type === "Folk");
  const cultureToReligionMap = new Map<number, number>(folkReligions.map(({i, culture}) => [culture, i]));

  for (const cellId of cells.i) {
    const cultureId = cells.culture[cellId];
    religionIds[cellId] = cultureToReligionMap.get(cultureId) || 0;
  }

  return religionIds;
}
