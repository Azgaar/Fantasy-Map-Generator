import { pointer } from "d3";
import { closeDialogs } from "@/components/dialog/dialog-helpers";
import { stopMapPlacement, toggleMapPlacement } from "@/components/map-placement";
import { Controllers } from "@/controllers";
import { createLabelArc } from "@/renderers/labels/label-arc";
import type { Point } from "@/types/global";

function toggle(): void {
  if (document.getElementById("addLabel")?.classList.contains("pressed")) {
    stopMapPlacement();
    return;
  }

  closeDialogs(".stable");
  toggleMapPlacement("addLabel", addOnClick, "Click on map to place label. Hold Shift to add multiple");
  if (!window.LayerControls.isLayerOn("toggleLabels")) window.LayerControls.toggleLayer("toggleLabels");
}

async function addOnClick(event: MouseEvent): Promise<void> {
  const point = pointer(event, event.currentTarget as SVGGElement);
  if (!(await addAt(point))) return;

  if (!event.shiftKey) stopMapPlacement();
}

async function addAt(point: Point): Promise<boolean> {
  const cell = findCell(point[0], point[1]);
  if (cell === undefined) return false;

  const text = Names.getCulture(pack.cells.culture[cell]);
  const lastSelected = await Controllers.LabelsEditor.getLastSelectedGroup();
  const group = Labels.findGroup(lastSelected, "added").name;
  const [x, y] = point;
  const pathPoints = createLabelArc({ text, type: "added", group, anchor: [x, y] });
  AddedLabels.add({ x, y, label: { text, group, pathPoints } });
  drawLabels();
  return true;
}

export const LabelCreator = { addAt, toggle };
