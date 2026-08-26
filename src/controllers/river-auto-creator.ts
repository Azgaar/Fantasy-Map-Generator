import { pointer } from "d3";
import { closeDialogs, refreshEditors } from "@/components/dialog/dialog-helpers";
import { Layers } from "@/components/layers";
import { stopMapPlacement, toggleMapPlacement } from "@/components/map-placement";
import { tip } from "@/components/tooltips";

function toggle(): void {
  if (document.getElementById("addRiver")?.classList.contains("pressed")) {
    stopMapPlacement();
    return;
  }

  closeDialogs(".stable");
  toggleMapPlacement(
    "addRiver",
    addOnClick,
    "Click on map to place new river or extend an existing one. Hold Shift to place multiple rivers",
    "warn"
  );
  Layers.show("rivers");
}

function addOnClick(event: MouseEvent): void {
  const point = pointer(event, event.currentTarget as SVGGElement);
  const cell = Pack.findCell(point[0], point[1]);
  if (cell === undefined) return;
  if (pack.cells.r[cell]) {
    tip("There is already a river here", false, "error");
    return;
  }
  if (pack.cells.h[cell] < 20) {
    tip("Cannot create river in water cell", false, "error");
    return;
  }
  if (pack.cells.b[cell]) return;

  const result = Rivers.addDownhill(cell);
  if (result.error) {
    tip(result.error, false, "error");
    return;
  }

  Layers.draw("rivers");
  if (!event.shiftKey) {
    Lakes.cleanupLakeData();
    stopMapPlacement();
    refreshEditors();
  }
}

export const RiverAutoCreator = { toggle };
