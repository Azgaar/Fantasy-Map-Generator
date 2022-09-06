import {group} from "d3-array";
import {rand} from "utils/probabilityUtils";

// add "wild" provinces if some cells don't have a province assigned
export function generateWildProvinces(
  states: TStates,
  burgs: TBurgs,
  cultures: TCultures,
  coreProvinces: IProvince[],
  provinceIds: Uint16Array,
  cells: Pick<IPack["cells"], "i" | "state" | "burg">
) {
  const stateProvincesMap = group(coreProvinces, (province: IProvince) => province.state);
  const noProvinceCells = Array.from(cells.i.filter(i => cells.state[i] && !provinceIds[i]));
  const wildProvinces = [] as IProvince[];

  for (const {i: stateId, name: stateName} of states) {
    const stateProvinces = stateProvincesMap.get(stateId);
    if (!stateProvinces || !stateProvinces.length) continue;

    const coreProvinceNames = stateProvinces.map(({name}) => name);
    const colonyNamePool = [stateName, ...coreProvinceNames].filter(name => name && !/new/i.test(name));
    const getColonyName = () => {
      if (colonyNamePool.length < 1) return null;

      const index = rand(colonyNamePool.length - 1);
      const spliced = colonyNamePool.splice(index, 1);
      return spliced[0] ? `New ${spliced[0]}` : null;
    };

    let noProvinceCellsInState = noProvinceCells.filter(i => cells.state[i] === stateId);
    while (noProvinceCellsInState.length) {
      // add new province
      const provinceId = coreProvinces.length + wildProvinces.length;
      const burgCell = noProvinceCellsInState.find(i => cells.burg[i]);
      const center = burgCell || noProvinceCellsInState[0];
      const burg = burgCell ? cells.burg[burgCell] : 0;
      provinceIds[center] = provinceId;

      // expand province
      const costs = [];
      costs[center] = 1;
      queue.push(center, 0);

      while (queue.length) {
        const priority = queue.peekValue();
        const next = queue.pop();

        cells.c[next].forEach(neibCellId => {
          if (cells.province[neibCellId]) return;
          const land = cells.h[neibCellId] >= 20;
          if (cells.state[neibCellId] && cells.state[neibCellId] !== s.i) return;
          const cost = land ? (cells.state[neibCellId] === s.i ? 3 : 20) : cells.t[neibCellId] ? 10 : 30;
          const totalCost = priority + cost;

          if (totalCost > max) return;
          if (!costs[neibCellId] || totalCost < costs[neibCellId]) {
            if (land && cells.state[neibCellId] === s.i) cells.province[neibCellId] = provinceId; // assign province to a cell
            costs[neibCellId] = totalCost;
            queue.push(neibCellId, totalCost);
          }
        });
      }

      // generate "wild" province name
      const cultureId = cells.culture[center];
      const f = pack.features[cells.f[center]];
      const color = brighter(getMixedColor(s.color, 0.2), 0.3);

      const provCells = noProvinceCellsInState.filter(i => cells.province[i] === provinceId);
      const singleIsle = provCells.length === f.cells && !provCells.find(i => cells.f[i] !== f.i);
      const isleGroup = !singleIsle && !provCells.find(i => pack.features[cells.f[i]].group !== "isle");
      const colony = !singleIsle && !isleGroup && P(0.5) && !isPassable(s.center, center);

      const name = (function () {
        const colonyName = colony && P(0.8) && getColonyName();
        if (colonyName) return colonyName;
        if (burgCell && P(0.5)) return burgs[burg].name;
        const base = pack.cultures[cultureId].base;

        return Names.getState(Names.getBaseShort(base), base);
      })();

      const formName = (function () {
        if (singleIsle) return "Island";
        if (isleGroup) return "Islands";
        if (colony) return "Colony";
        return rw(forms["Wild"]);
      })();

      const fullName = name + " " + formName;

      const dominion = colony ? P(0.95) : singleIsle || isleGroup ? P(0.7) : P(0.3);
      const kinship = dominion ? 0 : 0.4;
      const type = getType(center, burgs[burg]?.port);
      const coa = COA.generate(s.coa, kinship, dominion, type);
      coa.shield = COA.getPackShield(cultureId, s.i);

      provinces.push({i: provinceId, state: s.i, center, burg, name, formName, fullName, color, coa});
      s.provinces.push(provinceId);

      // check if there is a land way within the same state between two cells
      function isPassable(from, to) {
        if (cells.f[from] !== cells.f[to]) return false; // on different islands
        const queue = [from];

        const used = new Uint8Array(cells.i.length);
        const state = cells.state[from];

        while (queue.length) {
          const current = queue.pop();
          if (current === to) return true; // way is found
          cells.c[current].forEach(c => {
            if (used[c] || cells.h[c] < 20 || cells.state[c] !== state) return;
            queue.push(c);
            used[c] = 1;
          });
        }
        return false; // way is not found
      }

      // re-check
      noProvinceCellsInState = noProvinceCells.filter(i => cells.state[i] === stateId && !provinceIds[i]);
    }
  }
}
