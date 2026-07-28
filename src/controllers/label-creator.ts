import { pointer } from "d3";
import { closeDialogs } from "@/components/dialog/dialog-helpers";
import { stopMapPlacement, toggleMapPlacement } from "@/components/map-placement";
import { Controllers } from "@/controllers";
import { Labels } from "@/generators/labels";
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

  const name = Names.getCulture(pack.cells.culture[cell]);
  const lastSelected = await Controllers.LabelsEditor.getLastSelectedGroup();
  const group = ["", "states", "burgLabels"].includes(lastSelected) ? "addedLabels" : lastSelected;
  const label = Labels.addCustomLabel({
    group,
    text: name,
    pathPoints: [
      [point[0] - 100, point[1]],
      [point[0] + 100, point[1]]
    ],
    startOffset: 50,
    fontSize: 100
  });
  drawLabel(label);

  if (!event.shiftKey) stopMapPlacement();
}

export const LabelCreator = { toggle };
