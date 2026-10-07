import { pointer } from "d3";
import { closeDialogs, refreshEditors } from "@/components/dialog/dialog-helpers";
import { Layers } from "@/components/layers";
import { stopMapPlacement, toggleMapPlacement } from "@/components/map-placement";
import { tip } from "@/components/tooltips";
import { redrawEmblem } from "@/renderers/draw-emblems";
import { sentences, t } from "@/utils/i18n";
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
    sentences(t("Click on the map to create a new burg"), t("Hold Shift to add multiple")),
    "warn",
    unpressProxyButton
  );
  document.getElementById("addNewBurg")?.classList.add("pressed");

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
  return document.getElementById("addBurgTool")?.classList.contains("pressed") ?? false;
}

function unpressProxyButton(): void {
  document.getElementById("addNewBurg")?.classList.remove("pressed");
}

export const BurgCreator = { toggle, stop };
