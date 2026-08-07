import { Grid } from "../../core/types";
import { Burg } from "./burg-generator";
import { State } from "./state-generator";

export interface Province {
  id: number;
  name: string;
  color: string;
  stateId: number;
  center: number; // Cell ID
}

const PROVINCE_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#ec4899", "#6366f1", "#14b8a6", "#f43f5e"
];

export function generateProvinces(
  grid: Grid,
  heights: Uint8Array,
  cellStates: Uint8Array,
  burgs: Burg[],
  states: State[]
): { provinces: Province[]; cellProvinces: Uint16Array } {
  const pointsN = heights.length;
  const cellProvinces = new Uint16Array(pointsN).fill(0); // 0 = No Province
  const provinces: Province[] = [];

  if (states.length === 0 || burgs.length === 0) {
    return { provinces, cellProvinces };
  }

  const queue: { cellId: number; cost: number; provinceId: number; stateId: number }[] = [];
  const minCost = new Float32Array(pointsN).fill(Infinity);
  let nextProvinceId = 1;

  for (const state of states) {
    // Find burgs in this state that are not the capital
    const stateBurgs = burgs.filter(b => cellStates[b.cell] === state.id && !b.isCapital);
    
    // Select up to 3 province seeds per state
    const seeds = stateBurgs.slice(0, 3);
    for (let i = 0; i < seeds.length; i++) {
      const pId = nextProvinceId++;
      const seedCell = seeds[i].cell;

      provinces.push({
        id: pId,
        name: `${state.name.replace("Republic of ", "").replace("Kingdom of ", "")} Province ${i + 1}`,
        color: PROVINCE_COLORS[pId % PROVINCE_COLORS.length],
        stateId: state.id,
        center: seedCell
      });

      cellProvinces[seedCell] = pId;
      minCost[seedCell] = 0;
      queue.push({ cellId: seedCell, cost: 0, provinceId: pId, stateId: state.id });
    }
  }

  // Dijkstra expansion restricted within state borders
  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost);
    const curr = queue.shift()!;

    if (curr.cost > minCost[curr.cellId]) continue;

    const neighbors = grid.cells.c[curr.cellId] || [];
    for (const n of neighbors) {
      // Must stay inside the same state's borders
      if (cellStates[n] !== curr.stateId) continue;

      const edgeCost = 1.0 + Math.abs(heights[n] - heights[curr.cellId]) * 0.5;
      const nextCost = curr.cost + edgeCost;

      if (nextCost < minCost[n]) {
        minCost[n] = nextCost;
        cellProvinces[n] = curr.provinceId;
        queue.push({ cellId: n, cost: nextCost, provinceId: curr.provinceId, stateId: curr.stateId });
      }
    }
  }

  return { provinces, cellProvinces };
}
