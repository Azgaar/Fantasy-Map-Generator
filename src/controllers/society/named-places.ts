// The model that stores the name of each kind of place that keeps a meaning, and the renames offered across them

import { Features } from "@/model/physical/features-generator";
import { Rivers } from "@/model/physical/river-generator";
import { Burgs } from "@/model/political/burgs-generator";
import { Provinces } from "@/model/political/provinces-generator";
import { States } from "@/model/political/states-generator";
import { type Retelling, Toponyms } from "@/model/society/names/toponyms-generator";
import type { Named, PlaceRef, PlaceType } from "@/types/names";
import { Dialog } from "@/ui/dialog/dialog";
import { t } from "@/utils/i18n";
import { P } from "@/utils/probability-utils";
import { escapeHtml } from "@/utils/string-utils";

interface NamedModel {
  rename(id: number, name: string): void; // a proper name: the meaning is cleared
  setName(id: number, named: Named): void;
}

export const NAMED_MODELS: Record<PlaceType, NamedModel> = {
  burg: Burgs,
  state: States,
  province: Provinces,
  river: Rivers,
  feature: Features
};

const CULTURE_NAMES_DIALOG = "cultureNamesOffer";
let offered: { places: string; saidIn: string } | undefined; // the open offer: its places are still said in its base

/** Ask how to rename places whose culture may say names in another base than `saidIn`. One window at a time: a newer
 * offer replaces it, and names are worked out on the click, from the places as they are then */
export function offerNamesIn(places: PlaceRef[], saidIn: string, onRenamed: () => void): void {
  const key = JSON.stringify(places);
  if (offered?.places === key && Dialog.isOpen(CULTURE_NAMES_DIALOG)) saidIn = offered.saidIn; // not renamed since
  const moved = places.filter(place => {
    const culture = Toponyms.cultureOf(place);
    return culture !== undefined && pack.cultures[culture].base !== saidIn; // a people of the same tongue says it as it is
  });
  if (!moved.length) return void Dialog.close(CULTURE_NAMES_DIALOG);

  const [first] = moved;
  const message =
    moved.length === 1
      ? t("{{name}} is named in another tongue now. Appropriate its name, regenerate it or pick either at random?", {
          name: escapeHtml(Toponyms.placeOf(first.type, first.id)?.name ?? "")
        })
      : t(
          "{{count}} places are named in another tongue now. Appropriate their names, regenerate them or pick either at random for each?",
          { count: moved.length }
        );
  const rename = (how: () => Retelling) => {
    for (const place of moved) {
      const named = Toponyms.renameIn(place, saidIn, how());
      if (named) NAMED_MODELS[place.type].setName(place.id, named);
    }
    onRenamed();
  };

  Dialog.message({
    id: CULTURE_NAMES_DIALOG,
    title: t("Rename"),
    message,
    width: "28em",
    buttons: [
      { label: t("Appropriate"), onClick: () => rename(() => "appropriate") },
      { label: t("Regenerate"), onClick: () => rename(() => "regenerate") },
      { label: t("Random"), onClick: () => rename(() => (P(0.5) ? "appropriate" : "regenerate")) },
      { label: t("Keep") }
    ]
  });
  offered = { places: key, saidIn };
}
