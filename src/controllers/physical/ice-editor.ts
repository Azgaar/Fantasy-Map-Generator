import { drag, type Selection, select } from "d3";
import { Controllers } from "@/controllers";
import { Grid } from "@/model/graph/grid-generator";
import { Ice } from "@/model/physical/ice-generator";
import { redrawGlacier, redrawIceberg } from "@/renderers/draw-ice";
import { Layers } from "@/renderers/layers";
import { closeDialogs, confirmationDialog, destroyDialog } from "@/ui/dialog/dialog-helpers";
import { applyDefaultViewboxEvents } from "@/ui/map/viewbox-events";
import { clearMainTip, tip } from "@/ui/tooltips";
import { sentences, t } from "@/utils/i18n";
import { ensureEl, findEl, getPointer } from "@/utils/node-utils";
import { parseTransform } from "@/utils/string-utils";

let selectedIce: Selection<SVGElement, unknown, HTMLElement, unknown>;

function open(element: SVGElement): void {
  if (options.app.mode) return;
  if (findEl("iceEditor") && element === selectedIce.node()) return;

  closeDialogs(".stable");
  Layers.show("ice");

  selectedIce = select<SVGElement, unknown>(element) as unknown as typeof selectedIce;
  const id = +selectedIce.attr("data-id");
  const iceElement = pack.ice.find(el => el.i === id);
  const isGlacier = selectedIce.attr("type") === "glacier";
  const type = isGlacier ? t("Glacier") : t("Iceberg");

  renderDialog();

  const randomizeBtn = ensureEl("iceRandomize");
  const sizeInput = ensureEl<HTMLInputElement>("iceSize");
  randomizeBtn.style.display = isGlacier ? "none" : "inline-block";
  sizeInput.style.display = isGlacier ? "none" : "inline-block";
  if (!isGlacier) sizeInput.value = String(iceElement && "size" in iceElement ? iceElement.size : "");

  select<SVGGElement, unknown>("#ice")
    .selectAll<SVGElement, unknown>("*")
    .classed("draggable", true)
    .call(drag<SVGElement, unknown>().on("drag", dragElement));

  $("#iceEditor").dialog({
    title: t("Edit {{- type}}", { type }),
    resizable: false,
    position: { my: "center top+60", at: "top", of: "svg", collision: "fit" },
    close: closeEditor
  });
}

function renderDialog(): void {
  destroyDialog("iceEditor");

  const html = /* html */ `<div id="iceEditor" class="dialog">
    <button id="iceEditStyle" data-tip="${t("Edit style in Style Editor")}" class="icon-brush"></button>
    <button id="iceRandomize" data-tip="${t("Randomize Iceberg shape")}" class="icon-shuffle"></button>
    <input id="iceSize" data-tip="${t("Change Iceberg size")}" type="range" min=".05" max="2" step=".01" />
    <button id="iceNew" data-tip="${t("Add an Iceberg (click on map)")}" class="icon-plus"></button>
    <button id="iceRemove" data-tip="${t("Remove")}" data-shortcut="Delete" class="icon-trash fastDelete"></button>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);

  // add listeners — dropped together with the dialog HTML on close
  ensureEl("iceEditStyle").addEventListener("click", () => void Controllers.StyleEditor.open("ice"));
  ensureEl("iceRandomize").addEventListener("click", randomizeShape);
  ensureEl<HTMLInputElement>("iceSize").addEventListener("input", changeSize);
  ensureEl("iceNew").addEventListener("click", toggleAdd);
  ensureEl("iceRemove").addEventListener("click", removeIce);
}

function randomizeShape(): void {
  const selectedId = +selectedIce.attr("data-id");
  Ice.randomizeIcebergShape(selectedId);
  redrawIceberg(selectedId);
}

function changeSize(this: HTMLInputElement): void {
  const newSize = +this.value;
  const selectedId = +selectedIce.attr("data-id");
  Ice.changeIcebergSize(selectedId, newSize);
  redrawIceberg(selectedId);
}

function toggleAdd(): void {
  const iceNewBtn = ensureEl("iceNew");
  iceNewBtn.classList.toggle("pressed");
  if (iceNewBtn.classList.contains("pressed")) {
    select<SVGElement, unknown>("#viewbox").style("cursor", "crosshair").on("click", addIcebergOnClick);
    tip(sentences(t("Click on map to create an iceberg"), t("Hold Shift to add multiple")), true);
  } else {
    clearMainTip();
    applyDefaultViewboxEvents();
  }
}

function addIcebergOnClick(event: PointerEvent): void {
  const [x, y] = getPointer(event, select<SVGElement, unknown>("#viewbox").node());
  const i = Grid.findCell(x, y);
  const size = +ensureEl<HTMLInputElement>("iceSize").value || 1;

  redrawIceberg(Ice.addIceberg(i, size));

  if (event.shiftKey === false) toggleAdd();
}

function removeIce(): void {
  const isGlacier = selectedIce.attr("type") === "glacier";
  confirmationDialog({
    title: t("Remove"),
    message: isGlacier
      ? t("Are you sure you want to remove the glacier?")
      : t("Are you sure you want to remove the iceberg?"),
    confirm: t("Remove"),
    onConfirm: () => {
      const id = +selectedIce.attr("data-id");
      Ice.removeIce(id);
      if (isGlacier) redrawGlacier(id);
      else redrawIceberg(id);
      $("#iceEditor").dialog("close");
    }
  });
}

function dragElement(this: SVGElement, event: any): void {
  const selectedId = +selectedIce.attr("data-id");
  const initialTransform = parseTransform(this.getAttribute("transform") ?? "");
  const dx = +initialTransform[0] - event.x;
  const dy = +initialTransform[1] - event.y;

  event.on("drag", function (this: SVGElement, dragEvent: any) {
    const x = dragEvent.x;
    const y = dragEvent.y;
    this.setAttribute("transform", `translate(${dx + x},${dy + y})`);

    // Store offset for visual positioning; actual geometry stays in points
    const iceData = pack.ice.find(el => el.i === selectedId);
    if (iceData) iceData.offset = [dx + x, dy + y];
  });
}

function closeEditor(): void {
  const wasAdding = ensureEl("iceNew").classList.contains("pressed");
  select<SVGGElement, unknown>("#ice")
    .selectAll<SVGElement, unknown>("*")
    .classed("draggable", false)
    .on(".drag", null);
  clearMainTip();
  ensureEl("iceNew").classList.remove("pressed");
  if (wasAdding) applyDefaultViewboxEvents();
  destroyDialog("iceEditor");
  selectedIce = null!;
}

export const IceEditor = { open };
