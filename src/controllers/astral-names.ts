// The Astral naming action: give the map's polities their own words and its provinces their
// sectors. It is an action, not a generation step: a world stays a fantasy world until the
// author asks for this. See docs/astral/README.md
import { confirmationDialog, refreshEditors } from "@/components/dialog/dialog-helpers";
import { tip } from "@/components/tooltips";
import { applyNaming, groupsOf } from "@/generators/astral-naming";

function apply(): void {
  const astrals = pack.states.filter(state => state.i && !state.removed && groupsOf(state.culture ?? 0)).length;
  if (!astrals) {
    tip(
      "This map has no Astral peoples: generate it with a culture set of AstralTrek, AstralJammer or Grimdark first",
      true,
      "error",
      8000
    );
    return;
  }

  confirmationDialog({
    title: "Apply Astral naming",
    message:
      `The ${astrals} Astral polities of this map will take their own words, and their provinces become sectors.` +
      "<br><br>Stock peoples keep their own names. The change can be undone by renaming the states and provinces.",
    confirm: "Apply",
    onConfirm: () => {
      const { polities, sectors, renamed } = applyNaming();
      refreshEditors();
      tip(
        `Applied Astral naming: ${polities} polities${renamed ? ` (${renamed} renamed after their capitals)` : ""}, ${sectors} sectors`,
        true,
        "success",
        6000
      );
    }
  });
}

export const AstralNames = { apply };
