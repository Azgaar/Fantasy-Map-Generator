import { pointer } from "d3";
import { closeDialogs, refreshEditors } from "@/components/dialog/dialog-helpers";
import { Layers } from "@/components/layers";
import { stopMapPlacement, toggleMapPlacement } from "@/components/map-placement";
import { toast } from "@/components/toast";

function toggle(): void {
  if (document.getElementById("addRiver")?.classList.contains("pressed")) {
    stopMapPlacement();
    return;
  }

  closeDialogs(".stable");
  toggleMapPlacement(
    "addRiver",
    addOnClick,
    "Click on map to place new river or extend an existing one. Hold Shift to place multiple rivers"
  );
  Layers.show("rivers");
}

function addOnClick(event: MouseEvent): void {
  const point = pointer(event, event.currentTarget as SVGGElement);
  const cell = findCell(point[0], point[1]);
  if (cell === undefined) return;
  if (pack.cells.r[cell]) {
    toast("There is already a river here", "error");
    return;
  }
  if (pack.cells.h[cell] < 20) {
    toast("Cannot create river in water cell", "error");
    return;
  }
  if (pack.cells.b[cell]) return;

  const result = Rivers.addDownhill(cell);
  if (result.error) {
    toast(result.error, "error");
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
