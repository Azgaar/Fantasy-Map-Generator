import { pointer } from "d3";
import { closeDialogs } from "@/components/dialog/dialog-helpers";
import { stopMapPlacement, toggleMapPlacement } from "@/components/map-placement";
import { Controllers } from "@/controllers";
import { DEFAULT_ADDED_LABEL_GROUP } from "@/generators/labels-generator";
import type { Point } from "@/types/global";

function toggle(): void {
  if (document.getElementById("addLabel")?.classList.contains("pressed")) {
    stopMapPlacement();
    return;
  }

  closeDialogs(".stable");
  toggleMapPlacement("addLabel", addOnClick, "Click on map to place label. Hold Shift to add multiple");
  if (!layerIsOn("toggleLabels")) toggleLabels();
}

async function addOnClick(event: MouseEvent): Promise<void> {
  const point = pointer(event, event.currentTarget as SVGGElement);
  const cell = findCell(point[0], point[1]);
  if (cell === undefined) return;

  const text = Names.getCulture(pack.cells.culture[cell]);
  const lastSelected = await Controllers.LabelsEditor.getLastSelectedGroup();
  const group = Labels.findGroup(lastSelected, "added").name;
  const pathPoints: Point[] = [
    [point[0] - 100, point[1]],
    [point[0] + 100, point[1]]
  ];
  AddedLabels.add({ group, text, pathPoints });
  drawLabels();

  if (!event.shiftKey) stopMapPlacement();
}

export const LabelCreator = { toggle };
