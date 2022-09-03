import {MIN_LAND_HEIGHT} from "config/generation";
import {TIME} from "config/logging";

export type TStateStatistics = Record<number, typeof initialData>;
const initialData = {cells: 0, area: 0, burgs: 0, rural: 0, urban: 0, neighbors: [] as number[]};

// calculate states data like area, population, etc.
export function collectStatistics(
  cells: Pick<IPack["cells"], "i" | "c" | "h" | "area" | "pop" | "state" | "burg">,
  burgs: TBurgs
) {
  TIME && console.time("collectStatistics");

  const statesData: TStateStatistics = {};
  const initiate = (stateId: number) => {
    statesData[stateId] = structuredClone(initialData);
  };

  // check for neighboring states
  const checkNeib = (neibCellId: number, stateId: number) => {
    const neibStateId = cells.state[neibCellId];
    if (!neibStateId || neibStateId === stateId) return;
    if (!statesData[stateId].neighbors.includes(neibStateId)) statesData[stateId].neighbors.push(neibStateId);
  };

  for (const cellId of cells.i) {
    if (cells.h[cellId] < MIN_LAND_HEIGHT) continue;
    const stateId = cells.state[cellId];
    if (!statesData[stateId]) initiate(stateId);

    cells.c[cellId].forEach(neibCellId => checkNeib(neibCellId, stateId));

    statesData[stateId].cells += 1;
    statesData[stateId].area += cells.area[cellId];
    statesData[stateId].rural += cells.pop[cellId];

    const burgId = cells.burg[cellId];
    if (burgId) {
      statesData[stateId].burgs += 1;
      statesData[stateId].urban += (burgs[burgId] as IBurg)?.population || 0;
    }
  }

  TIME && console.timeEnd("collectStatistics");
  return statesData;
}
