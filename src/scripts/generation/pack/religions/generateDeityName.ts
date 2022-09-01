import {religionsData} from "config/religionsData";
import {ra} from "utils/probabilityUtils";

const {Names} = window;

const {base, approaches} = religionsData;

export function getDeityName(cultures: TCultures, cultureId: number) {
  if (cultureId === undefined) throw "CultureId is undefined";

  const meaning = generateMeaning();

  const base = cultures[cultureId].base;
  const cultureName = Names.getBase(base);
  return cultureName + ", The " + meaning;
}

export function generateMeaning() {
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
