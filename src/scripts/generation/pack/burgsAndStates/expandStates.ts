import {TIME} from "config/logging";
import FlatQueue from "flatqueue";
import {minmax} from "utils/numberUtils";

// growth algorithm to assign cells to states
export function expandStates() {
  TIME && console.time("expandStates");
  const {cells, states, cultures, burgs} = pack;

  cells.state = new Uint16Array(cells.i.length);
  const queue = new FlatQueue();
  const cost = [];
  const neutral = (cells.i.length / 5000) * 2500 * neutralInput.value * statesNeutral; // limit cost for state growth

  states
    .filter(s => s.i && !s.removed)
    .forEach(state => {
      const capitalCell = burgs[state.capital].cell;
      cells.state[capitalCell] = state.i;
      const cultureCenter = cultures[state.culture].center;
      const biome = cells.biome[cultureCenter]; // state native biome
      queue.push({cellId: state.center, stateId: state.i, b: biome}, 0);
      cost[state.center] = 1;
    });

  while (queue.length) {
    const priority = queue.peekValue();
    const {cellId, stateId, biome} = queue.pop();
    const {type, culture} = states[stateId];

    cells.c[cellId].forEach(neibCellId => {
      if (cells.state[neibCellId] && neibCellId === states[cells.state[neibCellId]].center) return; // do not overwrite capital cells

      const cultureCost = culture === cells.culture[neibCellId] ? -9 : 100;
      const populationCost =
        cells.h[neibCellId] < 20 ? 0 : cells.s[neibCellId] ? Math.max(20 - cells.s[neibCellId], 0) : 5000;
      const biomeCost = getBiomeCost(biome, cells.biome[neibCellId], type);
      const heightCost = getHeightCost(pack.features[cells.f[neibCellId]], cells.h[neibCellId], type);
      const riverCost = getRiverCost(cells.r[neibCellId], neibCellId, type);
      const typeCost = getTypeCost(cells.t[neibCellId], type);
      const cellCost = Math.max(cultureCost + populationCost + biomeCost + heightCost + riverCost + typeCost, 0);
      const totalCost = priority + 10 + cellCost / states[stateId].expansionism;

      if (totalCost > neutral) return;

      if (!cost[neibCellId] || totalCost < cost[neibCellId]) {
        if (cells.h[neibCellId] >= 20) cells.state[neibCellId] = stateId; // assign state to cell
        cost[neibCellId] = totalCost;

        queue.push({cellId: neibCellId, stateId, biome}, totalCost);
      }
    });
  }

  burgs.filter(b => b.i && !b.removed).forEach(b => (b.state = cells.state[b.cell])); // assign state to burgs

  function getBiomeCost(b, biome, type) {
    if (b === biome) return 10; // tiny penalty for native biome
    if (type === "Hunting") return biomesData.cost[biome] * 2; // non-native biome penalty for hunters
    if (type === "Nomadic" && biome > 4 && biome < 10) return biomesData.cost[biome] * 3; // forest biome penalty for nomads
    return biomesData.cost[biome]; // general non-native biome penalty
  }

  function getHeightCost(f, h, type) {
    if (type === "Lake" && f.type === "lake") return 10; // low lake crossing penalty for Lake cultures
    if (type === "Naval" && h < 20) return 300; // low sea crossing penalty for Navals
    if (type === "Nomadic" && h < 20) return 10000; // giant sea crossing penalty for Nomads
    if (h < 20) return 1000; // general sea crossing penalty
    if (type === "Highland" && h < 62) return 1100; // penalty for highlanders on lowlands
    if (type === "Highland") return 0; // no penalty for highlanders on highlands
    if (h >= 67) return 2200; // general mountains crossing penalty
    if (h >= 44) return 300; // general hills crossing penalty
    return 0;
  }

  function getRiverCost(r, i, type) {
    if (type === "River") return r ? 0 : 100; // penalty for river cultures
    if (!r) return 0; // no penalty for others if there is no river
    return minmax(cells.fl[i] / 10, 20, 100); // river penalty from 20 to 100 based on flux
  }

  function getTypeCost(t, type) {
    if (t === 1) return type === "Naval" || type === "Lake" ? 0 : type === "Nomadic" ? 60 : 20; // penalty for coastline
    if (t === 2) return type === "Naval" || type === "Nomadic" ? 30 : 0; // low penalty for land level 2 for Navals and nomads
    if (t !== -1) return type === "Naval" || type === "Lake" ? 100 : 0; // penalty for mainland for navals
    return 0;
  }

  TIME && console.timeEnd("expandStates");
}
