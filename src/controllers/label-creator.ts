import { pointer, select } from "d3";
import { closeDialogs } from "@/components/dialog/dialog-helpers";
import { stopMapPlacement, toggleMapPlacement } from "@/components/map-placement";
import { Controllers } from "@/controllers";
import { getNextId } from "@/utils";

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
  const id = getNextId("label");
  const lastSelected = await Controllers.LabelsEditor.getLastSelectedGroup();
  const groupId = ["", "states", "burgLabels"].includes(lastSelected) ? "#addedLabels" : `#${lastSelected}`;

  const labelsLayer = select<SVGGElement, unknown>("#labels");
  let group = labelsLayer.select<SVGGElement>(groupId);
  if (!group.size()) {
    group = labelsLayer
      .append("g")
      .attr("id", "addedLabels")
      .attr("fill", "#3e3e4b")
      .attr("opacity", 1)
      .attr("stroke", "#3a3a3a")
      .attr("stroke-width", 0)
      .attr("font-family", "Almendra SC")
      .attr("font-size", 18)
      .attr("data-size", 18)
      .attr("filter", null);
  }

  const example = group.append("text").attr("x", 0).attr("y", 0).text(name);
  const width = example.node()?.getBBox().width ?? 0;
  example.remove();

  group.classed("hidden", false);
  group
    .append("text")
    .attr("text-rendering", "optimizeSpeed")
    .attr("id", id)
    .append("textPath")
    .attr("text-rendering", "optimizeSpeed")
    .attr("xlink:href", `#textPath_${id}`)
    .attr("startOffset", "50%")
    .attr("font-size", "100%")
    .append("tspan")
    .attr("x", 0)
    .text(name);

  select<SVGGElement, unknown>("#textPaths")
    .append("path")
    .attr("id", `textPath_${id}`)
    .attr("d", `M${point[0] - width},${point[1]} h${width * 2}`);

  if (!event.shiftKey) stopMapPlacement();
}

export const LabelCreator = { toggle };
