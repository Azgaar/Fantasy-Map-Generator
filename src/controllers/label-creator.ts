import { pointer } from "d3";
import { closeDialogs } from "@/components/dialog/dialog-helpers";
import { stopMapPlacement, toggleMapPlacement } from "@/components/map-placement";
import { Controllers } from "@/controllers";
import { drawLabel } from "@/renderers/draw-labels";

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
  const group = ["", "states", "burgLabels"].includes(lastSelected) ? "addedLabels" : lastSelected;
  const label = AddedLabels.add({
    group,
    text,
    pathPoints: [
      [point[0] - 100, point[1]],
      [point[0] + 100, point[1]]
    ]
  });
  drawLabel("added", label.i);

  if (!event.shiftKey) stopMapPlacement();
}

export const LabelCreator = { toggle };
