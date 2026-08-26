import { drag, type Selection, select } from "d3";
import { closeDialogs, destroyDialog } from "@/components/dialog/dialog-helpers";
import { Layers } from "@/components/layers";
import { clearMainTip, tip } from "@/components/tooltips";
import { applyDefaultViewboxEvents } from "@/components/viewbox-events";
import { redrawIceberg } from "@/renderers/draw-ice";
import { ensureEl, getPointer, parseTransform } from "../utils";

let selectedIce: Selection<SVGElement, unknown, HTMLElement, unknown>;

function open(element: SVGElement): void {
  if (customization) return;
  if (document.getElementById("iceEditor") && element === selectedIce.node()) return;

  closeDialogs(".stable");
  Layers.show("ice");

  selectedIce = select<SVGElement, unknown>(element) as unknown as typeof selectedIce;
  const id = +selectedIce.attr("data-id");
  const iceElement = pack.ice.find(el => el.i === id);
  const isGlacier = selectedIce.attr("type") === "glacier";
  const type = isGlacier ? "Glacier" : "Iceberg";

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
    title: `Edit ${type}`,
    resizable: false,
    position: { my: "center top+60", at: "top", of: "svg", collision: "fit" },
    close: closeEditor
  });
}

function renderDialog(): void {
  destroyDialog("iceEditor");

  const html = /* html */ `<div id="iceEditor" class="dialog">
    <button id="iceEditStyle" data-tip="Edit style in Style Editor" class="icon-brush"></button>
    <button id="iceRandomize" data-tip="Randomize Iceberg shape" class="icon-shuffle"></button>
    <input id="iceSize" data-tip="Change Iceberg size" type="range" min=".05" max="2" step=".01" />
    <button id="iceNew" data-tip="Add an Iceberg (click on map)" class="icon-plus"></button>
    <button id="iceRemove" data-tip="Remove the element" data-shortcut="Delete" class="icon-trash fastDelete"></button>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);

  // add listeners — dropped together with the dialog HTML on close
  ensureEl("iceEditStyle").addEventListener("click", () => editStyle("ice"));
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
    tip("Click on map to create an iceberg. Hold Shift to add multiple", true);
  } else {
    clearMainTip();
    applyDefaultViewboxEvents();
  }
}

function addIcebergOnClick(event: PointerEvent): void {
  const [x, y] = getPointer(event, select<SVGElement, unknown>("#viewbox").node());
  const i = Grid.findCell(x, y);
  const size = +ensureEl<HTMLInputElement>("iceSize").value || 1;

  Ice.addIceberg(i, size);

  if (event.shiftKey === false) toggleAdd();
}

function removeIce(): void {
  const type = selectedIce.attr("type") === "glacier" ? "Glacier" : "Iceberg";
  alertMessage.innerHTML = /* html */ `Are you sure you want to remove the ${type}?`;
  $("#alert").dialog({
    resizable: false,
    title: `Remove ${type}`,
    buttons: {
      Remove: function (this: HTMLElement) {
        $(this).dialog("close");
        Ice.removeIce(+selectedIce.attr("data-id"));
        $("#iceEditor").dialog("close");
      },
      Cancel: function (this: HTMLElement) {
        $(this).dialog("close");
      }
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
}

export const IceEditor = { open };
