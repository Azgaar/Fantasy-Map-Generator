import {unique} from "utils/arrayUtils";
import {getMixedColor, getRandomColor} from "utils/colorUtils";
import {findAll} from "utils/graphUtils";
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
  stateIds: Uint16Array,
  burgIds: Uint16Array,
  cultures: TCultures,
  states: TStates,
  burgs: TBurgs,
  points: TPoints
) {
  const religions = religionsData.map(({type, form, culture: cultureId, center}, index) => {
    const supreme = getDeityName(cultures, cultureId);
    const deity = form === "Non-theism" || form === "Animism" ? null : supreme;

    const stateId = stateIds[center];
    const burgId = burgIds[center];

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

    const origins: number[] = []; // define after religions expansion
    return {i: index + 1, name, type, form, culture: cultureId, center, deity, expansion, expansionism, color, origins};
  });

  const religionIds = expandReligions(religions);

  const names = renameOldReligions(religions);
  const origins = defineOrigins(religionIds, religions, points);

  return {
    religions: religions.map((religion, index) => ({name: names[index], religion, origins: origins[index]})),
    religionIds
  };
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

function defineOrigins(
  religionIds: Uint16Array,
  religions: Pick<IReligion, "i" | "culture" | "type" | "expansion" | "center">[],
  points: TPoints
) {
  return religions.map(religion => {
    if (religion.type === "Folk") return [0];

    const {type, culture: cultureId, expansion, center} = religion;
    const [x, y] = points[center];

    const folkReligion = religions.find(({culture, type}) => type === "Folk" || culture === cultureId);
    const isFolkBased = folkReligion && cultureId && expansion === "culture" && each(2)(center);

    if (isFolkBased) return [folkReligion.i];

    if (type === "Organized") {
      const origins = getReligionsInRadius(religionIds, {x, y, r: 150 / religions.length, max: 2});
      return origins;
    }

    const origins = getReligionsInRadius(religionIds, {x, y, r: 300 / religions.length, max: rand(0, 4)});
    return origins;
  });
}

function getReligionsInRadius(
  religionIds: Uint16Array,
  {x, y, r, max}: {x: number; y: number; r: number; max: number}
) {
  if (max === 0) return [0];
  const cellsInRadius: number[] = []; // findAll(x, y, r);
  const religions = unique(cellsInRadius.map(i => religionIds[i]).filter(r => r));
  return religions.length ? religions.slice(0, max) : [0];
}
