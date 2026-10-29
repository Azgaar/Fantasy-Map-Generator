// The Polity naming action: give the map's polities their own words and its provinces their
// regional titles or sectors. See docs/plans/rpg-fantasy-cultures.md and docs/astral/README.md
import { Dialog } from "@/ui/dialog/dialog";
import { refreshEditors } from "@/ui/dialog/dialog-helpers";
import { Layers } from "@/renderers/layers";
import { tip } from "@/ui/tooltips";
import { applyNaming, groupsOf, isRpgMap } from "@/model/physical/polity-naming";

function apply(): void {
  const isRpg = isRpgMap();
  const qualifying = pack.states.filter(state => state.i && !state.removed && groupsOf(state.culture ?? 0)).length;

  if (!qualifying) {
    const errorMsg = isRpg
      ? "This map has no RPG peoples: generate it with a culture set of RPG Fantasy first"
      : "This map has no Astral peoples: generate it with a culture set of AstralTrek, AstralJammer or Grimdark first";
    tip(errorMsg, true, "error", 8000);
    return;
  }

  const title = isRpg ? "Apply RPG naming" : "Apply Astral naming";
  const message = isRpg
    ? `The ${qualifying} RPG polities of this map will take their own words, and their provinces take regional titles.` +
      "<br><br>Stock peoples keep their own names. The change can be undone by renaming the states and provinces."
    : `The ${qualifying} Astral polities of this map will take their own words, and their provinces become sectors.` +
      "<br><br>Stock peoples keep their own names. The change can be undone by renaming the states and provinces.";

  Dialog.confirm({
    title,
    message,
    confirm: "Apply",
    onConfirm: () => {
      const { polities, sectors, renamed } = applyNaming();
      Layers.draw("labels"); // the map keeps the old words on screen until it draws them again
      refreshEditors();
      const successMsg = isRpg
        ? `Applied RPG naming: ${polities} polities${renamed ? ` (${renamed} renamed after their capitals)` : ""}, ${sectors} provinces`
        : `Applied Astral naming: ${polities} polities${renamed ? ` (${renamed} renamed after their capitals)` : ""}, ${sectors} sectors`;
      tip(successMsg, true, "success", 6000);
    }
  });
}

export const AstralNames = { apply };
