import * as d3 from "d3";

import {TIME, WARN} from "config/logging";
import {religionsData} from "config/religionsData";
import {unique} from "utils/arrayUtils";
import {getMixedColor, getRandomColor} from "utils/colorUtils";
import {findAll} from "utils/graphUtils";
import {getInputNumber} from "utils/nodeUtils";
import {ra, rand, rw} from "utils/probabilityUtils";
import {isBurg} from "utils/typeUtils";
import {generateReligionName} from "./generateReligionName";

const {Names} = window;
const {approaches, base, forms, types} = religionsData;

type TCellsData = Pick<IPack["cells"], "i" | "c" | "p" | "g" | "h" | "t" | "biome" | "pop" | "burg">;

export function generateReligions({
  states,
  cultures,
  burgs,
  cultureIds,
  stateIds,
  burgIds,
  cells
}: {
  states: TStates;
  cultures: TCultures;
  burgs: TBurgs;
  cultureIds: Uint16Array;
  stateIds: Uint16Array;
  burgIds: Uint16Array;
  cells: TCellsData;
}) {
  TIME && console.time("generateReligions");

  const religionIds = new Uint16Array(cells.c.length);

  const folkReligions = generateFolkReligions(cultures);
  const basicReligions = generateOrganizedReligionsAndCults(
    states,
    cultures,
    burgs,
    cultureIds,
    stateIds,
    burgIds,
    folkReligions,
    {
      i: cells.i,
      p: cells.p,
      pop: cells.pop
    }
  );

  console.log(folkReligions, basicReligions);

  TIME && console.timeEnd("generateReligions");
  return {religionIds};
}

function generateFolkReligions(cultures: TCultures) {
  const isValidCulture = (culture: TWilderness | ICulture): culture is ICulture =>
    culture.i !== 0 && !(culture as ICulture).removed;

  return cultures.filter(isValidCulture).map(culture => {
    const {i: cultureId, name: cultureName, center} = culture;
    const form = rw(forms.Folk);
    const type: {[key: string]: number} = types[form];
    const name = cultureName + " " + rw(type);
    const deity = form === "Animism" ? null : getDeityName(cultures, cultureId);
    const color = getMixedColor(culture.color, 0.1, 0);

    return {name, type: "Folk", form, deity, color, culture: cultureId, center, origins: [0]};
  });
}

function generateOrganizedReligionsAndCults(
  states: TStates,
  cultures: TCultures,
  burgs: TBurgs,
  cultureIds: Uint16Array,
  stateIds: Uint16Array,
  burgIds: Uint16Array,
  folkReligions: ReturnType<typeof generateFolkReligions>,
  cells: Pick<IPack["cells"], "i" | "p" | "pop">
) {
  const religionsNumber = getInputNumber("religionsInput");
  if (religionsNumber === 0) return [];

  const cultsNumber = Math.floor((rand(1, 4) / 10) * religionsNumber); // 10-40%
  const organizedNumber = religionsNumber - cultsNumber;

  const canditateCells = getCandidateCells();
  const religionCells = placeReligions();

  return religionCells.map((cellId, index) => {
    const cultureId = cultureIds[cellId];
    const stateId = stateIds[cellId];
    const burgId = burgIds[cellId];

    const type = index < organizedNumber ? "Organized" : "Cult";

    const form = rw(forms[type] as {[key in keyof typeof types]: number});
    const deityName = getDeityName(cultures, cultureId);
    const deity = form === "Non-theism" ? null : deityName;

    const {name, expansion, center} = generateReligionName({
      cultureId,
      stateId,
      burgId,
      cultures,
      states,
      burgs,
      center: cellId,
      form,
      deity: deityName
    });

    const folkReligion = folkReligions.find(({culture}) => culture === cultureId);
    const baseColor = folkReligion?.color || getRandomColor();
    const color = getMixedColor(baseColor, 0.3, 0);

    return {name, type, form, deity, color, culture: cultureId, center, expansion};
  });

  function placeReligions() {
    const religionCells = [];
    const religionsTree = d3.quadtree();

    // initial min distance between religions
    let spacing = (graphWidth + graphHeight) / 4 / religionsNumber;

    for (const cellId of canditateCells) {
      const [x, y] = cells.p[cellId];

      if (religionsTree.find(x, y, spacing) === undefined) {
        religionCells.push(cellId);
        religionsTree.add([x, y]);

        if (religionCells.length === religionsNumber) return religionCells;
      }
    }

    WARN && console.warn(`Placed only ${religionCells.length} of ${religionsNumber} religions`);
    return religionCells;
  }

  function getCandidateCells() {
    const validBurgs = burgs.filter(isBurg);

    if (validBurgs.length >= religionsNumber)
      return validBurgs.sort((a, b) => b.population - a.population).map(burg => burg.cell);

    return cells.i.filter(i => cells.pop[i] > 2).sort((a, b) => cells.pop[b] - cells.pop[a]);
  }
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

function getReligionsInRadius(
  religionIds: Uint16Array,
  {x, y, r, max}: {x: number; y: number; r: number; max: number}
) {
  if (max === 0) return [0];
  const cellsInRadius = findAll(x, y, r);
  const religions = unique(cellsInRadius.map(i => religionIds[i]).filter(r => r));
  return religions.length ? religions.slice(0, max) : [0];
}
