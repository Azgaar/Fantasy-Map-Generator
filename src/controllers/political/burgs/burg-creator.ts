import { pointer } from "d3";
import { Burgs } from "@/model/political/burgs-generator";
import { redrawEmblem } from "@/renderers/draw-emblems";
import { Layers } from "@/renderers/layers";
import { closeDialogs, refreshEditors } from "@/ui/dialog/dialog-helpers";
import { stopMapPlacement, toggleMapPlacement } from "@/ui/map/map-placement";
import { tip } from "@/ui/tooltips";
import { sentences, t } from "@/utils/i18n";
import { findEl } from "@/utils/nodeUtils";
import { errorText } from "@/utils/stringUtils";

function toggle(): void {
  if (isActive()) {
    stop();
    return;
  }

  closeDialogs(".stable");
  toggleMapPlacement(
    "addBurgTool",
    addOnClick,
    sentences(t("Click on map to place a burg"), t("Hold Shift to add multiple")),
    "warn",
    unpressProxyButton
  );
  findEl("addNewBurg")?.classList.add("pressed");

  Layers.show("burgIcons", "labels");
}

function addOnClick(event: MouseEvent): void {
  const point = pointer(event, event.currentTarget as SVGGElement);
  let burgId: number;
  try {
    burgId = Burgs.add(...point);
  } catch (error) {
    tip(errorText(error), false, "error");
    return;
  }
  redrawEmblem("burg", burgId);
  refreshEditors();
  Layers.draw("burgIcons", "labels", "routes");

  if (!event.shiftKey) stop();
}

function stop(): void {
  if (isActive()) stopMapPlacement();
  else unpressProxyButton();
}

function isActive(): boolean {
  return findEl("addBurgTool")?.classList.contains("pressed") ?? false;
}

function unpressProxyButton(): void {
  findEl("addNewBurg")?.classList.remove("pressed");
}

export const BurgCreator = { toggle, stop };
