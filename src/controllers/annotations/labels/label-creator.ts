import { pointer } from "d3";
import { Controllers } from "@/controllers";
import { AddedLabels } from "@/model/annotations/added-labels";
import { Labels } from "@/model/annotations/labels-generator";
import { Pack } from "@/model/graph/pack-generator";
import { Names } from "@/model/society/names-generator";
import { createLabelArc } from "@/renderers/labels/label-arc";
import { Layers } from "@/renderers/layers";
import { closeDialogs } from "@/ui/dialog/dialog-helpers";
import { stopMapPlacement, toggleMapPlacement } from "@/ui/map/map-placement";
import { sentences, t } from "@/utils/i18n";
import { findEl } from "@/utils/node-utils";

function toggle(): void {
  if (findEl("addLabel")?.classList.contains("pressed")) {
    stopMapPlacement();
    return;
  }

  closeDialogs(".stable");
  toggleMapPlacement(
    "addLabel",
    addOnClick,
    sentences(t("Click on map to place label"), t("Hold Shift to add multiple"))
  );
  Layers.show("labels");
}

async function addOnClick(event: MouseEvent): Promise<void> {
  const point = pointer(event, event.currentTarget as SVGGElement);
  const cell = Pack.findCell(point[0], point[1]);
  if (cell === undefined) return;

  const text = Names.getCulture(pack.cells.culture[cell]);
  const lastSelected = await Controllers.LabelsEditor.getLastSelectedGroup();
  const group = Labels.findGroup(lastSelected, "added").name;
  const [x, y] = point;
  const pathPoints = createLabelArc({ text, type: "added", group, anchor: [x, y] });
  AddedLabels.add({ x, y, label: { text, group, pathPoints } });
  Layers.draw("labels");

  if (!event.shiftKey) stopMapPlacement();
}

export const LabelCreator = { toggle };
