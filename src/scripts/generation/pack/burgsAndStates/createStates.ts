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
  const each5th = each(5); // select each 5th element
  const powerInput = getInputNumber("powerInput");

  const states = capitals.map((capital, index) => {
    const {cell: cellId, culture: cultureId, name: capitalName, i: capitalId} = capital;
    const id = index + 1;

    const useCapitalName = capitalName.length < 9 && each5th(cellId);
    const basename = useCapitalName ? capitalName : Names.getCultureShort(cultureId);
    const name: string = Names.getState(basename, cultureId);
    const color = colors[index];

    const type = (cultures[cultureId] as ICulture).type;
    const expansionism = rn(Math.random() * powerInput + 1, 1);

    const shield = COA.getShield(cultureId, null);
    const coa = {...COA.generate(null, null, null, type), shield};

    return {i: id, center: cellId, type, name, color, expansionism, capital: capitalId, culture: cultureId, coa};
  });

  TIME && console.timeEnd("createStates");
  return [NEUTRALS, ...states];
}
