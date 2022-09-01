import {each} from "utils/probabilityUtils";

const {Names} = window;

export function defineStateName(cellId: number, capitalName: string, cultureId: number, cultures: TCultures): string {
  const useCapitalName = capitalName.length < 9 && each(5)(cellId);
  const nameBase = cultures[cultureId].base;
  const basename: string = useCapitalName ? capitalName : Names.getBaseShort(nameBase);

  return Names.getState(basename, basename);
}

export function defineFullStateName(name: string, form: string) {
  return `${name} ${form}`;
}
