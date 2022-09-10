import {group} from "d3-array";

import {brighter, getMixedColor} from "utils/colorUtils";
import {gauss, P, rw} from "utils/probabilityUtils";
import {isBurg, isState} from "utils/typeUtils";
import {provinceForms} from "./config";

const {COA, Names} = window;

export function generateCoreProvinces(states: TStates, burgs: TBurgs, cultures: TCultures, percentage: number) {
  const provinces = [] as IProvince[];

  const validBurgs = burgs.filter(isBurg);
  const burgsToStateMap = group(validBurgs, (burg: IBurg) => burg.state);

  states.filter(isState).forEach(state => {
    const stateBurgs = burgsToStateMap.get(state.i);
    if (!stateBurgs || stateBurgs.length < 2) return; // at least 2 provinces are required

    stateBurgs
      .sort((a, b) => b.population * gauss(1, 0.2, 0.5, 1.5, 3) - a.population)
      .sort((a, b) => b.capital - a.capital);

    const provincesNumber = Math.max(Math.ceil((stateBurgs.length * percentage) / 100), 2);
    const formsPool: Dict<number> = structuredClone(provinceForms[state.form]);

    for (let i = 0; i < provincesNumber; i++) {
      const {i: burg, cell: center, culture: cultureId, coa: burgEmblem, name: burgName, type} = stateBurgs[i];

      const nameByBurg = P(0.5);
      const name = generateName(nameByBurg, burgName, cultureId, cultures);
      const formName = rw(formsPool);
      formsPool[formName] += 10; // increase chance to get the same form again

      const fullName = name + " " + formName;
      const color = brighter(getMixedColor(state.color, 0.2), 0.3);
      const coa = generateEmblem(nameByBurg, burgEmblem, type, cultures, cultureId, state);

      provinces.push({i: provinces.length + 1, name, formName, center, burg, state: state.i, fullName, color, coa});
    }
  });

  return provinces;
}

function generateName(nameByBurg: boolean, burgName: string, cultureId: number, cultures: TCultures) {
  if (nameByBurg) return burgName;

  const base = cultures[cultureId].base;
  return Names.getState(Names.getBaseShort(base), base);
}

function generateEmblem(
  nameByBurg: boolean,
  burgEmblem: ICoa | "string",
  type: TCultureType,
  cultures: TCultures,
  cultureId: number,
  state: IState
) {
  const kinship = nameByBurg ? 0.8 : 0.4;
  const coa: ICoa = COA.generate(burgEmblem, kinship, null, type);

  const cultureShield = cultures[cultureId].shield;
  const stateShield = (state.coa as ICoa)?.shield;
  coa.shield = COA.getShield(cultureShield, stateShield);

  return coa;
}
