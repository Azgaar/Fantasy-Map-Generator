import {TIME} from "config/logging";
import {religionsData} from "config/religionsData";
import {getMixedColor} from "utils/colorUtils";
import {ra, rw} from "utils/probabilityUtils";

type TCellsData = Pick<IPack["cells"], "c" | "p" | "g" | "h" | "t" | "biome" | "burg">;

const {Names} = window;
const {approaches, base, forms, methods, types} = religionsData;

export function generateReligions(states: TStates, cultures: TCultures, cells: TCellsData) {
  TIME && console.time("generateReligions");

  const religionIds = new Uint16Array(cells.c.length);

  const folkReligions = generateFolkReligions(cultures, cells);
  console.log(folkReligions);

  TIME && console.timeEnd("generateReligions");
  return {religionIds};
}

function generateFolkReligions(cultures: TCultures, cells: TCellsData) {
  const isValidCulture = (culture: TWilderness | ICulture): culture is ICulture =>
    culture.i !== 0 && !(culture as ICulture).removed;

  return cultures.filter(isValidCulture).map((culture, index) => {
    const {i: cultureId, name: cultureName, center} = culture;
    const id = index + 1;
    const form = rw(forms.Folk);
    const type: {[key: string]: number} = types[form];
    const name = cultureName + " " + rw(type);
    const deity = form === "Animism" ? null : getDeityName(cultures, cultureId);
    const color = getMixedColor(culture.color, 0.1, 0);

    return {i: id, name, color, culture: cultureId, type: "Folk", form, deity, center: center, origins: [0]};
  });
}

function getDeityName(cultures: TCultures, cultureId: number) {
  if (cultureId === undefined) throw "CultureId is undefined";

  const meaning = generateMeaning();

  const base = cultures[cultureId].base;
  const cultureName = Names.getBase(base);
  return cultureName + ", The " + meaning;
}

function generateMeaning() {
  const approach = ra(approaches);
  if (approach === "Number") return ra(base.number);
  if (approach === "Being") return ra(base.being);
  if (approach === "Adjective") return ra(base.adjective);
  if (approach === "Color + Animal") return `${ra(base.color)} ${ra(base.animal)}`;
  if (approach === "Adjective + Animal") return `${ra(base.adjective)} ${ra(base.animal)}`;
  if (approach === "Adjective + Being") return `${ra(base.adjective)} ${ra(base.being)}`;
  if (approach === "Adjective + Genitive") return `${ra(base.adjective)} ${ra(base.genitive)}`;
  if (approach === "Color + Being") return `${ra(base.color)} ${ra(base.being)}`;
  if (approach === "Color + Genitive") return `${ra(base.color)} ${ra(base.genitive)}`;
  if (approach === "Being + of + Genitive") return `${ra(base.being)} of ${ra(base.genitive)}`;
  if (approach === "Being + of the + Genitive") return `${ra(base.being)} of the ${ra(base.theGenitive)}`;
  if (approach === "Animal + of + Genitive") return `${ra(base.animal)} of ${ra(base.genitive)}`;
  if (approach === "Adjective + Being + of + Genitive")
    return `${ra(base.adjective)} ${ra(base.being)} of ${ra(base.genitive)}`;
  if (approach === "Adjective + Animal + of + Genitive")
    return `${ra(base.adjective)} ${ra(base.animal)} of ${ra(base.genitive)}`;

  throw "Unknown generation approach";
}
