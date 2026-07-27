import { pointer } from "d3";
import { closeDialogs, refreshEditors } from "@/components/dialog/dialog-helpers";
import { stopMapPlacement, toggleMapPlacement } from "@/components/map-placement";
import { tip } from "@/components/tooltips";

function toggle(): void {
  if (isActive()) {
    stop();
    return;
  }

  closeDialogs(".stable");
  toggleMapPlacement(
    "addBurgTool",
    addOnClick,
    "Click on the map to create a new burg. Hold Shift to add multiple",
    "warn",
    unpressProxyButton
  );
  document.getElementById("addNewBurg")?.classList.add("pressed");

  if (!layerIsOn("toggleBurgIcons")) toggleBurgIcons();
  if (!layerIsOn("toggleLabels")) toggleLabels();
}

function addOnClick(event: MouseEvent): void {
  const point = pointer(event, event.currentTarget as SVGGElement);
  const cell = findCell(point[0], point[1]);
  if (cell === undefined) return;

  if (pack.cells.h[cell] < 20) {
    tip("You cannot place a burg in the water. Please click on a land cell", false, "error");
    return;
  }
  if (pack.cells.burg[cell]) {
    tip("There is already a burg in this cell. Please select a free cell", false, "error");
    return;
  }

  Burgs.add(point);
  refreshEditors();

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
