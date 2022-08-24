import {religionsData} from "config/religionsData";
import {getMixedColor} from "utils/colorUtils";
import {rw} from "utils/probabilityUtils";
import {getDeityName} from "./generateDeityName";

const {forms, types} = religionsData;

export function generateFolkReligions(cultures: TCultures) {
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
