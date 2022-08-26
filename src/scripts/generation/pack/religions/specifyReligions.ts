import {getMixedColor, getRandomColor} from "utils/colorUtils";
import {each, gauss, rand} from "utils/probabilityUtils";
import {isCulture} from "utils/typeUtils";
import {expandReligions} from "./expandReligions";
import {getDeityName} from "./generateDeityName";
import {generateReligionName} from "./generateReligionName";

const expansionismMap = {
  Folk: () => 0,
  Organized: () => rand(3, 8),
  Cult: () => gauss(1.1, 0.5, 0, 5),
  Heresy: () => gauss(1.2, 0.5, 0, 5)
};

export function specifyReligions(
  religionsData: Pick<IReligion, "type" | "form" | "culture" | "center">[],
  cultures: TCultures,
  states: TStates,
  burgs: TBurgs,
  cells: Pick<IPack["cells"], "i" | "c" | "culture" | "burg" | "state">
): {religions: TReligions; religionIds: Uint16Array} {
  const rawReligions = religionsData.map(({type, form, culture: cultureId, center}, index) => {
    const supreme = getDeityName(cultures, cultureId);
    const deity = form === "Non-theism" || form === "Animism" ? null : supreme;

    const stateId = cells.state[center];
    const burgId = cells.burg[center];

    const {name, expansion} = generateReligionName(type, {
      cultureId,
      stateId,
      burgId,
      cultures,
      states,
      burgs,
      form,
      supreme
    });

    const expansionism = expansionismMap[type]();

    const culture = cultures[cultureId];
    const color = isCulture(culture) ? getMixedColor(culture.color, 0.1, 0) : getRandomColor();

    return {i: index + 1, name, type, form, culture: cultureId, center, deity, expansion, expansionism, color};
  });

  const religionIds = expandReligions(rawReligions, cells);
  const names = renameOldReligions(rawReligions);
  const origins = defineOrigins(religionIds, rawReligions, cells.c);

  return {religions: combineReligionsData(), religionIds};

  function combineReligionsData(): TReligions {
    const noReligion: TNoReligion = {i: 0, name: "No religion"};

    const religions = rawReligions.map((religion, index) => ({
      ...religion,
      name: names[index],
      origins: origins[index]
    }));

    return [noReligion, ...religions];
  }
}

// add 'Old' to names of folk religions which have organized competitors
function renameOldReligions(religions: Pick<IReligion, "name" | "culture" | "type" | "expansion">[]) {
  return religions.map(({name, type, culture: cultureId}) => {
    if (type !== "Folk") return name;

    const haveOrganized = religions.some(
      ({type, culture, expansion}) => culture === cultureId && type === "Organized" && expansion === "culture"
    );
    if (haveOrganized && name.slice(0, 3) !== "Old") return `Old ${name}`;
    return name;
  });
}

const religionOriginsParamsMap = {
  Organized: {clusterSize: 100, maxReligions: 2},
  Cult: {clusterSize: 50, maxReligions: 3},
  Heresy: {clusterSize: 50, maxReligions: 43}
};

function defineOrigins(
  religionIds: Uint16Array,
  religions: Pick<IReligion, "i" | "culture" | "type" | "expansion" | "center">[],
  neighbors: number[][]
) {
  return religions.map(religion => {
    if (religion.type === "Folk") return [0];

    const {i, type, culture: cultureId, expansion, center} = religion;

    const folkReligion = religions.find(({culture, type}) => type === "Folk" || culture === cultureId);
    const isFolkBased = folkReligion && cultureId && expansion === "culture" && each(2)(center);

    if (isFolkBased) return [folkReligion.i];

    const {clusterSize, maxReligions} = religionOriginsParamsMap[type];
    const origins = getReligionsInRadius(neighbors, center, religionIds, i, clusterSize, maxReligions);
    return origins;
  });
}

function getReligionsInRadius(
  neighbors: number[][],
  center: number,
  religionIds: Uint16Array,
  religionId: number,
  clusterSize: number,
  maxReligions: number
) {
  const religions = new Set<number>();
  const queue = [center];
  const checked = <{[key: number]: true}>{};

  for (let size = 0; queue.length && size < clusterSize; size++) {
    const cellId = queue.pop()!;
    checked[center] = true;

    for (const neibId of neighbors[cellId]) {
      if (checked[neibId]) continue;
      checked[neibId] = true;

      const neibReligion = religionIds[neibId];
      if (neibReligion && neibReligion !== religionId) religions.add(neibReligion);
      queue.push(neibId);
    }
  }

  return religions.size ? [...religions].slice(0, maxReligions) : [0];
}
