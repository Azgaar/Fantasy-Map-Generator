import { pointer } from "d3";
import { Rivers } from "@/model/physical/river-generator";
import { Layers } from "@/renderers/layers";
import { closeDialogs, refreshEditors } from "@/ui/dialog/dialog-helpers";
import { stopMapPlacement, toggleMapPlacement } from "@/ui/map/map-placement";
import { tip } from "@/ui/tooltips";
import { findEl } from "@/utils";
import { t } from "@/utils/i18n";
import { errorText } from "@/utils/stringUtils";

function toggle(): void {
  if (findEl("addRiver")?.classList.contains("pressed")) {
    stopMapPlacement();
    return;
  }

  closeDialogs(".stable");
  toggleMapPlacement(
    "addRiver",
    addOnClick,
    t("Click on map to place new river or extend an existing one. Hold Shift to place multiple rivers"),
    "warn"
  );
  Layers.show("rivers");
}

function addOnClick(event: MouseEvent): void {
  const [x, y] = pointer(event, event.currentTarget as SVGGElement);
  try {
    Rivers.add(x, y);
  } catch (error) {
    tip(errorText(error), false, "error");
    return;
  }

  Layers.draw("rivers");
  if (!event.shiftKey) {
    stopMapPlacement();
    refreshEditors();
  }
}

export const RiverAutoCreator = { toggle };
