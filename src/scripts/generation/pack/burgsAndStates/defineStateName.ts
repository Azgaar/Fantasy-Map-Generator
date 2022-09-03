import {getAdjective} from "utils/languageUtils";
import {each} from "utils/probabilityUtils";
import {adjectivalForms} from "./config";

const {Names} = window;

export function defineStateName(center: number, capitalName: string, nameBase: number, formName: string): string {
  if (["Free City", "City-state"].includes(formName)) return capitalName;

  const useCapitalName = capitalName.length < 9 && each(5)(center);
  const basename: string = useCapitalName ? capitalName : Names.getBaseShort(nameBase);

  return Names.getState(basename, basename);
}

export function defineFullStateName(name: string, formName: string) {
  if (!formName) return name;
  if (!name && formName) return "The " + formName;

  const isAdjectival = adjectivalForms.includes(formName) && !/-| /.test(name);
  return isAdjectival ? `${getAdjective(name)} ${formName}` : `${formName} of ${name}`;
}
