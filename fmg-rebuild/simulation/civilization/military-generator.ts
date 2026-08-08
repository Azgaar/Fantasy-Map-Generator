import { Grid } from "../../core/types";
import { State } from "./state-generator";
import { Burg } from "./burg-generator";

export interface MilitaryUnit {
  id: number;
  name: string;
  type: "infantry" | "cavalry" | "navy";
  size: number;
  cell: number;
  stateId: number;
}

export function generateMilitary(
  grid: Grid,
  heights: Uint8Array,
  cellStates: Uint8Array,
  states: State[],
  burgs: Burg[]
): MilitaryUnit[] {
  const units: MilitaryUnit[] = [];
  let nextUnitId = 1;

  for (const state of states) {
    // 1. Spawning Garrison at Capital
    const capitalBurg = burgs.find(b => b.id === state.capital);
    if (capitalBurg) {
      units.push({
        id: nextUnitId++,
        name: `1st ${capitalBurg.name} Garrison`,
        type: "infantry",
        size: 3000,
        cell: capitalBurg.cell,
        stateId: state.id
      });
    }

    // 2. Spawning border patrol forces
    // Find land cells belonging to this state that border cells of a different state (or neutral)
    const borderCells: number[] = [];
    const pointsN = heights.length;
    for (let i = 0; i < pointsN; i++) {
      if (cellStates[i] === state.id && heights[i] >= 20) {
        for (const c of grid.cells.c[i]) {
          if (cellStates[c] !== state.id) {
            borderCells.push(i);
            break;
          }
        }
      }
    }

    // Spawn up to 2 border regiments
    const borderSeeds = borderCells.slice(0, 2);
    for (let idx = 0; idx < borderSeeds.length; idx++) {
      units.push({
        id: nextUnitId++,
        name: `${idx + 2}nd Border Regiment`,
        type: "cavalry",
        size: 1500,
        cell: borderSeeds[idx],
        stateId: state.id
      });
    }

    // 3. Spawning naval fleets
    // Spawns navy units at ports if available
    const statePorts = burgs.filter(b => cellStates[b.cell] === state.id && b.port > 0);
    for (let idx = 0; idx < Math.min(statePorts.length, 1); idx++) {
      units.push({
        id: nextUnitId++,
        name: `Royal Fleet ${state.name.replace("Republic of ", "").replace("Kingdom of ", "")}`,
        type: "navy",
        size: 1200,
        cell: statePorts[idx].cell,
        stateId: state.id
      });
    }
  }

  return units;
}
