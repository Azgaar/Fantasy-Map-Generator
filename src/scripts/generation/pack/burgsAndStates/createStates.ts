import {TIME} from "config/logging";
import {getColors} from "utils/colorUtils";
import {getInputNumber} from "utils/nodeUtils";
import {rn} from "utils/numberUtils";
import {each} from "utils/probabilityUtils";
import {NEUTRALS} from "./config";
import type {createCapitals} from "./createCapitals";

const {Names, COA} = window;

type TCapitals = ReturnType<typeof createCapitals>;

export function createStates(capitals: TCapitals, cultures: TCultures) {
  TIME && console.time("createStates");

  const colors = getColors(capitals.length);
  const powerInput = getInputNumber("powerInput");

  const states = capitals.map((capital, index) => {
    const {cell: cellId, culture: cultureId, name: capitalName} = capital;
    const id = index + 1;
    const name = getStateName(cellId, capitalName, cultureId, cultures);
    const color = colors[index];

    const {type, shield: cultureShield} = cultures[cultureId] as ICulture;
    const expansionism = rn(Math.random() * powerInput + 1, 1);

    const shield = COA.getShield(cultureShield, null);
    const coa: ICoa = {...COA.generate(null, null, null, type), shield};

    return {i: id, name, type, center: cellId, color, expansionism, capital: id, culture: cultureId, coa};
  });

  TIME && console.timeEnd("createStates");
  return [NEUTRALS, ...states];
}

function getStateName(cellId: number, capitalName: string, cultureId: number, cultures: TCultures): string {
  const useCapitalName = capitalName.length < 9 && each(5)(cellId);
  const nameBase = cultures[cultureId].base;
  const basename: string = useCapitalName ? capitalName : Names.getBaseShort(nameBase);

  return Names.getState(basename, basename);
}
