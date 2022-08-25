import {religionsData} from "config/religionsData";
import {rw} from "utils/probabilityUtils";
import {isCulture} from "utils/typeUtils";

const {forms} = religionsData;

export function generateFolkReligions(cultures: TCultures): Pick<IReligion, "type" | "form" | "culture" | "center">[] {
  return cultures.filter(isCulture).map(culture => {
    const {i: cultureId, center} = culture;
    const form = rw<string>(forms.Folk);

    return {type: "Folk", form, culture: cultureId, center};
  });
}
