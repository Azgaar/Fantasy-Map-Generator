import { pointer } from "d3";
import { closeDialogs, refreshEditors } from "@/components/dialog/dialog-helpers";
import { stopMapPlacement, toggleMapPlacement } from "@/components/map-placement";
import { tip } from "@/components/tooltips";
import type { Point } from "@/types/global";

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
  if (!layerIsOn("toggleRivers")) toggleRivers();
}

function addOnClick(event: MouseEvent): void {
  const point = pointer(event, event.currentTarget as SVGGElement);
  const finalize = !event.shiftKey;
  if (!addAt(point, finalize)) return;

  if (finalize) stopMapPlacement();
}

function addAt(point: Point, finalize = true): boolean {
  const cell = findCell(point[0], point[1]);
  if (cell === undefined) return false;
  if (pack.cells.r[cell]) {
    tip("There is already a river here", false, "error");
    return false;
  }
  if (pack.cells.h[cell] < 20) {
    tip("Cannot create river in water cell", false, "error");
    return false;
  }
  if (pack.cells.b[cell]) return false;

  const result = Rivers.addDownhill(cell);
  if (result.error) {
    tip(result.error, false, "error");
    return false;
  }

  drawRivers();
  if (finalize) {
    Lakes.cleanupLakeData();
    refreshEditors();
  }
  return true;
}

export const RiverAutoCreator = { addAt, toggle };
