import * as d3 from "d3";

import { closeDialogs } from "dialogs/utils";
import { layerIsOn, toggleLayer } from "layers";
import { clearMainTip, tip } from "scripts/tooltips";
import { byId, findGridCell, getGridPolygon, getInputNumber, parseTransform, rand, rn } from "utils";
// @ts-expect-error js module
import { editStyle } from "modules/style";
import { setDefaultEventHandlers } from "scripts/events";
// @ts-expect-error js module
import { unselect } from "modules/ui/editors";

let isLoaded = false;

export function open() {
  closeDialogs(".stable");
  if (!layerIsOn("toggleIce")) toggleLayer("toggleIce");

  const elSelected = d3.select<SVGPolygonElement, any>(d3.event.target);

  const type = elSelected.attr("type") ? "Glacier" : "Iceberg";
  if (byId("iceRandomize")) byId("iceRandomize")!.style.display = type === "Glacier" ? "none" : "inline-block";

  const $iceSize = byId("iceSize") as HTMLInputElement;
  if ($iceSize) {
    $iceSize.style.display = type === "Glacier" ? "none" : "inline-block";
    if (type === "Iceberg") $iceSize.value = elSelected.attr("size");
  }
  ice.selectAll<SVGPolygonElement, any>("*").classed("draggable", true).on("drag", dragElement);

  $("#iceEditor").dialog({
    title: "Edit " + type,
    resizable: false,
    position: {my: "center top+60", at: "top", of: d3.event, collision: "fit"},
    close: closeEditor
  });

  if (isLoaded) return;
  isLoaded = true;

  // add listeners
  byId("iceEditStyle")?.on("click", () => editStyle("ice"));
  byId("iceRandomize")?.on("click", randomizeShape);
  byId("iceSize")?.on("input", changeSize);
  byId("iceNew")?.on("click", toggleAdd);
  byId("iceRemove")?.on("click", removeIce);

  function randomizeShape() {
    const c = grid.points[+elSelected.attr("cell")];
    const s = +elSelected.attr("size");
    const i = rand(0, grid.cells.i.length);

    const cn = grid.points[i];
    const poly = getGridPolygon(i).map(p => [p[0] - cn[0], p[1] - cn[1]]);
    const points = poly.map(p => [rn(c[0] + p[0] * s, 2), rn(c[1] + p[1] * s, 2)]);
    elSelected.attr("points", points.flat().toString());
  }

  function changeSize(this: HTMLInputElement) {
    const c = grid.points[+elSelected.attr("cell")];
    const s = +elSelected.attr("size");
    const flat = elSelected
      .attr("points")
      .split(",")
      .map((pointString: string) => +pointString);

    const pairs = [];
    while (flat.length) pairs.push(flat.splice(0, 2));
    const poly = pairs.map(p => [(p[0] - c[0]) / s, (p[1] - c[1]) / s]);
    const size = +this.value;
    const points = poly.map(p => [rn(c[0] + p[0] * size, 2), rn(c[1] + p[1] * size, 2)]);
    elSelected.attr("points", points.toString()).attr("size", size);
  }

  function toggleAdd() {
    byId("iceNew")?.classList.toggle("pressed");
    if (byId("iceNew")?.classList.contains("pressed")) {
      viewbox.style("cursor", "crosshair").on("click",() => addIcebergOnClick);
      tip("Click on map to create an iceberg. Hold Shift to add multiple", true);
    } else {
      clearMainTip();
      setDefaultEventHandlers();
    }
  }

  function addIcebergOnClick(this: d3.ContainerElement) {
    const [x, y] = d3.mouse(this);
    const i = findGridCell(x, y, grid);
    const c = grid.points[i];
    const s = getInputNumber("iceSize");

    const points = getGridPolygon(i).map(p => [(p[0] + (c[0] - p[0]) / s) | 0, (p[1] + (c[1] - p[1]) / s) | 0]);
    const iceberg = ice.append("polygon").attr("points", points.flat().toString()).attr("cell", i).attr("size", s);
    iceberg.on("drag", dragElement);
    if (d3.event.shiftKey === false) toggleAdd();
  }

  function removeIce() {
    const type = elSelected.attr("type") ? "Glacier" : "Iceberg";
    byId("alertMessage")!.innerHTML = `Are you sure you want to remove the ${type}?`;
    $("#alert").dialog({
      resizable: false,
      title: "Remove " + type,
      buttons: {
        Remove: function () {
          $(this).dialog("close");
          elSelected.remove();
          $("#iceEditor").dialog("close");
        },
        Cancel: function () {
          $(this).dialog("close");
        }
      }
    });
  }

  function dragElement(this: SVGPolygonElement) {
    const tr = parseTransform(this.getAttribute("transform"));
    const dx = +tr[0] - d3.event.x;
    const dy = +tr[1] - d3.event.y;

    d3.event.on("drag", function (this: Element) {
      const {x, y} = d3.event;
      this.setAttribute("transform", `translate(${dx + x},${dy + y})`);
    });
  }

  function closeEditor() {
    ice.selectAll("*").classed("draggable", false).on("drag", null);
    clearMainTip();
    byId("iceNew")?.classList.remove("pressed");
    unselect();
  }
}
