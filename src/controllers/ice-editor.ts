import { drag, pointer, select } from "d3";
import { destroyDialogIfExists, ensureEl, findGridCell, parseTransform } from "../utils";

function open(element: SVGElement): void {
  if (customization) return;
  if (elSelected && element === elSelected.node()) return;

  closeDialogs(".stable");
  if (!layerIsOn("toggleIce")) toggleIce();

  elSelected = select<SVGElement, unknown>(element) as unknown as typeof elSelected;
  const id = +elSelected.attr("data-id");
  const iceElement = pack.ice.find(el => el.i === id);
  const isGlacier = elSelected.attr("type") === "glacier";
  const type = isGlacier ? "Glacier" : "Iceberg";

  renderDialog();

  const randomizeBtn = ensureEl("iceRandomize");
  const sizeInput = ensureEl<HTMLInputElement>("iceSize");
  randomizeBtn.style.display = isGlacier ? "none" : "inline-block";
  sizeInput.style.display = isGlacier ? "none" : "inline-block";
  if (!isGlacier) sizeInput.value = String(iceElement && "size" in iceElement ? iceElement.size : "");

  select(ice.node()!)
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
  destroyDialogIfExists("iceEditor");

  const html = /* html */ `<div id="iceEditor" class="dialog">
    <button id="iceEditStyle" data-tip="Edit style in Style Editor" class="icon-brush"></button>
    <button id="iceRandomize" data-tip="Randomize Iceberg shape" class="icon-shuffle"></button>
    <input id="iceSize" data-tip="Change Iceberg size" type="range" min=".05" max="2" step=".01" />
    <button id="iceNew" data-tip="Add an Iceberg (click on map)" class="icon-plus"></button>
    <button id="iceRemove" data-tip="Remove the element" data-shortcut="Delete" class="icon-trash fastDelete"></button>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);

  // add listeners — dropped together with the dialog HTML on close
  ensureEl("iceEditStyle").on("click", () => editStyle("ice"));
  ensureEl("iceRandomize").on("click", randomizeShape);
  ensureEl<HTMLInputElement>("iceSize").on("input", changeSize);
  ensureEl("iceNew").on("click", toggleAdd);
  ensureEl("iceRemove").on("click", removeIce);
}

function randomizeShape(): void {
  const selectedId = +elSelected.attr("data-id");
  Ice.randomizeIcebergShape(selectedId);
  redrawIceberg(selectedId);
}

function changeSize(this: HTMLInputElement): void {
  const newSize = +this.value;
  const selectedId = +elSelected.attr("data-id");
  Ice.changeIcebergSize(selectedId, newSize);
  redrawIceberg(selectedId);
}

function toggleAdd(): void {
  const iceNewBtn = ensureEl("iceNew");
  iceNewBtn.classList.toggle("pressed");
  if (iceNewBtn.classList.contains("pressed")) {
    select(viewbox.node()!).style("cursor", "crosshair").on("click", addIcebergOnClick);
    tip("Click on map to create an iceberg. Hold Shift to add multiple", true);
  } else {
    clearMainTip();
    select(viewbox.node()!).on("click", clicked).style("cursor", "default");
  }
}

function addIcebergOnClick(event: PointerEvent): void {
  const [x, y] = pointer(event, viewbox.node());
  const i = findGridCell(x, y, grid);
  const size = +ensureEl<HTMLInputElement>("iceSize").value || 1;

  Ice.addIceberg(i, size);

  if (event.shiftKey === false) toggleAdd();
}

function removeIce(): void {
  const type = elSelected.attr("type") === "glacier" ? "Glacier" : "Iceberg";
  alertMessage.innerHTML = /* html */ `Are you sure you want to remove the ${type}?`;
  $("#alert").dialog({
    resizable: false,
    title: `Remove ${type}`,
    buttons: {
      Remove: function (this: HTMLElement) {
        $(this).dialog("close");
        Ice.removeIce(+elSelected.attr("data-id"));
        $("#iceEditor").dialog("close");
      },
      Cancel: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });
}

function dragElement(this: SVGElement, event: any): void {
  const selectedId = +elSelected.attr("data-id");
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
  select(ice.node()!)
    .selectAll<SVGElement, unknown>("*")
    .classed("draggable", false)
    .call(drag<SVGElement, unknown>().on("drag", null));
  clearMainTip();
  ensureEl("iceNew").classList.remove("pressed");
  unselect();
  destroyDialogIfExists("iceEditor");
}

export const IceEditor = { open };
