import {group} from "d3-array";
import FlatQueue from "flatqueue";

import {DISTANCE_FIELD, MIN_LAND_HEIGHT} from "config/generation";
import {unique} from "utils/arrayUtils";
import {brighter, getMixedColor} from "utils/colorUtils";
import {gauss, P, ra, rw} from "utils/probabilityUtils";
import {isBurg, isState} from "utils/typeUtils";
import {provinceForms} from "./config";

const {COA, Names} = window;

// add "wild" provinces if some cells don't have a province assigned
export function generateWildProvinces({
  states,
  burgs,
  cultures,
  features,
  coreProvinces,
  provinceIds,
  percentage,
  cells
}: {
  states: TStates;
  burgs: TBurgs;
  cultures: TCultures;
  features: TPackFeatures;
  coreProvinces: IProvince[];
  provinceIds: Uint16Array;
  percentage: number;
  cells: Pick<IPack["cells"], "i" | "c" | "h" | "t" | "f" | "culture" | "state" | "burg">;
}) {
  const noProvinceCells = Array.from(cells.i.filter(i => cells.state[i] && !provinceIds[i]));
  const wildProvinces = [] as IProvince[];
  const colonyNamesMap = createColonyNamesMap();

  for (const state of states) {
    if (!isState(state)) continue;

    let noProvinceCellsInState = noProvinceCells.filter(i => cells.state[i] === state.i);
    while (noProvinceCellsInState.length) {
      const provinceId = coreProvinces.length + wildProvinces.length + 1;
      const burgCell = noProvinceCellsInState.find(i => cells.burg[i]);
      const center = burgCell || noProvinceCellsInState[0];
      const cultureId = cells.culture[center];

      const burgId = burgCell ? cells.burg[burgCell] : 0;
      const burg = burgs[burgId];

      const provinceCells = expandWildProvince(center, provinceId, state.i); // mutates provinceIds
      const formName = getProvinceForm(center, provinceCells, state.center);
      const name = getProvinceName(state.i, formName, burg, cultureId);
      const fullName = name + " " + formName;

      const coa = generateEmblem(formName, state, burg, cultureId);
      const color = brighter(getMixedColor(state.color, 0.2), 0.3);
      const province : IProvince = {i: provinceId, name, formName, center, burg: burgId, state: state.i, fullName, color, coa, pole: state.pole};
      wildProvinces.push(province);

      // re-check
      noProvinceCellsInState = noProvinceCells.filter(i => cells.state[i] === state.i && !provinceIds[i]);
    }
  }

  return wildProvinces;

  function createColonyNamesMap() {
    const stateProvincesMap = group(coreProvinces, (province: IProvince) => province.state);

    const colonyNamesMap = new Map<number, string[]>(
      states.map(state => {
        const stateProvinces = stateProvincesMap.get(state.i) || [];
        const coreProvinceNames = stateProvinces.map(province => province.name);
        const colonyNamePool = unique([state.name, ...coreProvinceNames].filter(name => name && !/new/i.test(name)));
        return [state.i, colonyNamePool];
      })
    );

    return colonyNamesMap;
  }

  function getColonyName(stateId: number) {
    const namesPool = colonyNamesMap.get(stateId) || [];
    if (namesPool.length < 1) return null;

    const name = ra(namesPool);
    colonyNamesMap.set(
      stateId,
      namesPool.filter(n => n !== name)
    );

    return `New ${name}`;
  }

  function getProvinceName(stateId: number, formName: string, burg: TNoBurg | IBurg, cultureId: number) {
    const colonyName = formName === "Colony" && P(0.8) && getColonyName(stateId);
    if (colonyName) return colonyName;

    if (burg?.name && P(0.5)) return burg.name;

    const base = cultures[cultureId].base;
    return Names.getState(Names.getBaseShort(base), base);
  }

  function expandWildProvince(center: number, provinceId: number, stateId: number) {
    const maxExpansionCost = percentage === 100 ? 1000 : gauss(20, 5, 5, 100) * percentage ** 0.5;

    const provinceCells = [center];
    provinceIds[center] = provinceId;

    const queue = new FlatQueue<number>();
    const cost: number[] = [];
    cost[center] = 1;
    queue.push(center, 0);

    while (queue.length) {
      const priority = queue.peekValue()!;
      const next = queue.pop()!;

      cells.c[next].forEach(neibCellId => {
        if (provinceIds[neibCellId]) return;
        if (cells.state[neibCellId] !== stateId) return;

        const isLand = cells.h[neibCellId] >= MIN_LAND_HEIGHT;
        const cellCost = isLand ? 3 : cells.t[neibCellId] === DISTANCE_FIELD.WATER_COAST ? 10 : 30;
        const totalCost = priority + cellCost;
        if (totalCost > maxExpansionCost) return;

        if (!cost[neibCellId] || totalCost < cost[neibCellId]) {
          if (isLand && cells.state[neibCellId] === stateId) {
            // assign province to a cell
            provinceCells.push(neibCellId);
            provinceIds[neibCellId] = provinceId;
          }
          cost[neibCellId] = totalCost;
          queue.push(neibCellId, totalCost);
        }
      });
    }

    return provinceCells;
  }

  function getProvinceForm(center: number, provinceCells: number[], stateCenter: number) {
    const feature = features[cells.f[center]];
    if (feature === 0) throw new Error("Feature is not defined");

    const provinceFeatures = unique(provinceCells.map(i => cells.f[i]));
    const isWholeIsle = provinceCells.length === feature.cells && provinceFeatures.length === 1;
    if (isWholeIsle) return "Island";

    const isIsleGroup = provinceFeatures.every(featureId => (features[featureId] as TPackFeature)?.group === "isle");
    if (isIsleGroup) return "Islands";

    const isColony = P(0.5) && !isConnected(stateCenter, center);
    if (isColony) return "Colony";

    return rw(provinceForms["Wild"]);

    // check if two cells are connected by land withing same state
    function isConnected(from: number, to: number) {
      if (cells.f[from] !== cells.f[to]) return false; // on different islands
      const queue = [from];
      const checked: Dict<boolean> = {[from]: true};
      const stateId = cells.state[from];

      while (queue.length) {
        const current = queue.pop()!;
        if (current === to) return true;

        for (const neibId of cells.c[current]) {
          if (checked[neibId] || cells.state[neibId] !== stateId) continue;
          queue.push(neibId);
          checked[neibId] = true;
        }
      }
      return false;
    }
  }

  function generateEmblem(formName: string, state: IState, burg: TNoBurg | IBurg, cultureId: number) {
    const dominion = P(getDominionChance(formName));
    const kinship = dominion ? 0 : 0.4;
    const coaType = isBurg(burg) ? burg.type : "Generic";
    const coa = COA.generate(state.coa, kinship, dominion, coaType);

    const cultureShield = cultures[cultureId].shield;
    const stateShield = (state.coa as ICoa)?.shield;
    coa.shield = COA.getShield(cultureShield, stateShield);

    return coa;
  }

  function getDominionChance(formName: string) {
    if (formName === "Colony") return 0.95;
    if (formName === "Island") return 0.7;
    if (formName === "Islands") return 0.7;
    return 0.3;
  }
}
