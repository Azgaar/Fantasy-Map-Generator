import { drag, select } from "d3";
import { closeDialogs, confirmationDialog, destroyDialog, refreshEditors } from "@/components/dialog/dialog-helpers";
import { stopMapPlacement } from "@/components/map-placement";
import { clearMainTip } from "@/components/tooltips";
import { showDomDialog } from "@/components/ui/dom-dialog";
import { Controllers } from "@/controllers";
import type { Marker } from "@/generators/markers-generator";
import { invalidateMarkerSymbols } from "@/renderers/point-symbols";
import { ensureEl, findEl, rn } from "../utils";

let selectedElement: SVGCircleElement | null = null;
let selectedMarker: Marker;

function open(markerI?: number, target?: Element): void {
  if (customization) return;
  closeDialogs(".stable");

  const targetId = Number(target?.closest<SVGElement>("[data-id]")?.dataset.id ?? markerI);
  const marker = pack.markers.find(({ i }) => i === targetId);
  if (!marker) return;
  selectedMarker = marker;
  selectedElement = createEditControl(marker);

  select<SVGCircleElement, unknown>(selectedElement)
    .call(drag<SVGCircleElement, unknown>().on("start", dragMarker))
    .classed("draggable", true);

  if (findEl("notesEditor")) {
    const id = `marker${selectedMarker.i}`;
    void Controllers.NotesEditor.open(id, id);
  }

  renderDialog();
  updateInputs();

  showDomDialog({
    content: ensureEl("markerEditor"),
    onClose: closeMarkerEditor,
    placement: "top-right",
    placementTarget: document.querySelector("svg"),
    placementOffset: { x: 10, y: 10 },
    resizable: false,
    title: "Edit Marker"
  });
}

function renderDialog(): void {
  destroyDialog("markerEditor");

  const html = /* html */ `<div id="markerEditor" class="dialog">
    <div id="markerBody" style="padding-bottom: 0.3em">
      <div data-tip="Marker type. Style changes will apply to all markers of the same type. Leave blank if the marker is unique">
        <div class="label">Type:</div>
        <input id="markerType" style="width: 10.3em" />
      </div>
      <div data-tip="Marker icon" style="display: flex; align-items: center">
        <div class="label">Icon:</div>
        <div id="markerIcon" style="font-size: 1.5em; width: 3.7em">👑</div>
        <button id="markerIconSelect" style="width: 5em">select</button>
      </div>
      <div data-tip="Marker marker element and icon sizes in pixels">
        <div class="label">Size:</div>
        <input data-tip="Marker element size in pixels" id="markerSize" type="number" min="2" max="500" style="width: 5em" />
        <input data-tip="Marker icon sizes in pixels" id="markerIconSize" type="number" min="2" max="20" step="0.5" style="width: 5em" />
      </div>
      <div data-tip="Marker icon shift (by X and by Y axis), percent. Set to 50 to position icon in center">
        <div class="label">Icon shift:</div>
        <input id="markerIconShiftX" type="number" min="0" max="100" step="1" style="width: 5em" />
        <input id="markerIconShiftY" type="number" min="0" max="100" step="1" style="width: 5em" />
      </div>
      <div data-tip="Marker pin shape">
        <div class="label">Pin shape:</div>
        <select id="markerPin" style="width: 10.3em">
          <option value="bubble">Bubble</option>
          <option value="pin">Pin</option>
          <option value="square">Square</option>
          <option value="squarish">Squarish</option>
          <option value="diamond">Diamond</option>
          <option value="hex">Hex</option>
          <option value="hexy">Hexy</option>
          <option value="shieldy">Shieldy</option>
          <option value="shield">Shield</option>
          <option value="pentagon">Pentagon</option>
          <option value="heptagon">Heptagon</option>
          <option value="circle">Circle</option>
          <option value="no">No</option>
        </select>
      </div>
      <div data-tip="Pin fill and stroke colors">
        <div class="label">Pin colors:</div>
        <input id="markerFill" type="color" style="width: 5em; height: 1.6em" />
        <input id="markerStroke" type="color" style="width: 5em; height: 1.6em" />
      </div>
    </div>
    <div id="markerBottom">
      <button id="markerNotes" data-tip="Edit place legend (notes)" class="icon-edit"></button>
      <button id="markerRadius" data-tip="Show markers within a radius of this one" class="icon-dot-circled"></button>
      <button id="markerLock" class="icon-lock-open" onmouseover="showElementLockTip(event)"></button>
      <button id="markerAdd" data-tip="Add additional marker of that type" class="icon-plus"></button>
      <button id="markerRemove" data-tip="Remove the marker" data-shortcut="Delete" class="icon-trash fastDelete"></button>
    </div>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);

  // add listeners — dropped together with the dialog HTML on close
  ensureEl("markerType").addEventListener("change", changeMarkerType);
  ensureEl("markerIconSelect").addEventListener("click", changeMarkerIcon);
  ensureEl("markerIconSize").addEventListener("input", changeIconSize);
  ensureEl("markerIconShiftX").addEventListener("input", changeIconShiftX);
  ensureEl("markerIconShiftY").addEventListener("input", changeIconShiftY);
  ensureEl("markerSize").addEventListener("input", changeMarkerSize);
  ensureEl("markerPin").addEventListener("change", changeMarkerPin);
  ensureEl("markerFill").addEventListener("input", changePinFill);
  ensureEl("markerStroke").addEventListener("input", changePinStroke);
  ensureEl("markerNotes").addEventListener("click", editMarkerLegend);
  ensureEl("markerRadius").addEventListener("click", openMarkersInRadius);
  ensureEl("markerLock").addEventListener("click", toggleMarkerLock);
  ensureEl("markerAdd").addEventListener("click", toggleAddMarker);
  ensureEl("markerRemove").addEventListener("click", confirmMarkerDeletion);
}

function createEditControl(marker: Marker): SVGCircleElement {
  document.getElementById("marker-edit-control")?.remove();
  return select<SVGGElement, unknown>("#debug")
    .append("circle")
    .attr("id", "marker-edit-control")
    .attr("data-id", marker.i)
    .attr("cx", marker.x)
    .attr("cy", marker.y)
    .attr("r", Math.max(2, (marker.size ?? 30) / 2))
    .attr("fill", "transparent")
    .attr("stroke", "#c13119")
    .attr("stroke-dasharray", "2 1")
    .attr("stroke-width", 1 / scale)
    .node()!;
}

function getSameTypeMarkers(): Marker[] {
  const currentType = selectedMarker.type;
  if (!currentType) return [selectedMarker];
  return pack.markers.filter(({ type }) => type === currentType);
}

function dragMarker(this: SVGCircleElement, event: any): void {
  const dx = +this.getAttribute("cx")! - event.x;
  const dy = +this.getAttribute("cy")! - event.y;

  event.on("drag", function (this: SVGCircleElement, dragEvent: any) {
    this.setAttribute("cx", String(dx + dragEvent.x));
    this.setAttribute("cy", String(dy + dragEvent.y));
  });

  event.on("end", function (this: SVGCircleElement, dragEvent: any) {
    selectedMarker.x = rn(dx + dragEvent.x, 1);
    selectedMarker.y = rn(dy + dragEvent.y, 1);
    this.setAttribute("cx", String(selectedMarker.x));
    this.setAttribute("cy", String(selectedMarker.y));
    selectedMarker.cell = findCell(selectedMarker.x, selectedMarker.y)!;
    invalidateMarkerSymbols();
  });
}

function updateInputs(): void {
  const marker = selectedMarker;
  ensureEl("markerIcon").innerHTML =
    marker.icon.startsWith("http") || marker.icon.startsWith("data:image")
      ? `<img src="${marker.icon}" style="width: 1em; height: 1em;">`
      : marker.icon;

  ensureEl<HTMLInputElement>("markerType").value = marker.type || "";
  ensureEl<HTMLInputElement>("markerIconSize").value = String(marker.px || 12);
  ensureEl<HTMLInputElement>("markerIconShiftX").value = String(marker.dx || 50);
  ensureEl<HTMLInputElement>("markerIconShiftY").value = String(marker.dy || 50);
  ensureEl<HTMLInputElement>("markerSize").value = String(marker.size || 30);
  ensureEl<HTMLSelectElement>("markerPin").value = marker.pin || "bubble";
  ensureEl<HTMLInputElement>("markerFill").value = marker.fill || "#ffffff";
  ensureEl<HTMLInputElement>("markerStroke").value = marker.stroke || "#000000";

  ensureEl("markerLock").className = marker.lock ? "icon-lock" : "icon-lock-open";
}

function changeMarkerType(this: HTMLInputElement): void {
  selectedMarker.type = this.value;
  invalidateMarkerSymbols();
}

function changeMarkerIcon(): void {
  Controllers.IconSelector.open(selectedMarker.icon, value => {
    const isExternal = value.startsWith("http") || value.startsWith("data:image");
    ensureEl("markerIcon").innerHTML = isExternal ? `<img src="${value}" style="width: 1em; height: 1em;">` : value;

    getSameTypeMarkers().forEach(marker => {
      marker.icon = value;
    });
    invalidateMarkerSymbols();
  });
}

function changeIconSize(this: HTMLInputElement): void {
  const px = +this.value;
  getSameTypeMarkers().forEach(marker => {
    marker.px = px;
  });
  invalidateMarkerSymbols();
}

function changeIconShiftX(this: HTMLInputElement): void {
  const dx = +this.value;
  getSameTypeMarkers().forEach(marker => {
    marker.dx = dx;
  });
  invalidateMarkerSymbols();
}

function changeIconShiftY(this: HTMLInputElement): void {
  const dy = +this.value;
  getSameTypeMarkers().forEach(marker => {
    marker.dy = dy;
  });
  invalidateMarkerSymbols();
}

function changeMarkerSize(this: HTMLInputElement): void {
  const size = +this.value;
  getSameTypeMarkers().forEach(marker => {
    marker.size = size;
  });
  selectedElement?.setAttribute("r", String(Math.max(2, size / 2)));
  invalidateMarkerSymbols();
}

function changeMarkerPin(this: HTMLSelectElement): void {
  const pin = this.value;
  getSameTypeMarkers().forEach(marker => {
    marker.pin = pin;
  });
  invalidateMarkerSymbols();
}

function changePinFill(this: HTMLInputElement): void {
  const fill = this.value;
  getSameTypeMarkers().forEach(marker => {
    marker.fill = fill;
  });
  invalidateMarkerSymbols();
}

function changePinStroke(this: HTMLInputElement): void {
  const stroke = this.value;
  getSameTypeMarkers().forEach(marker => {
    marker.stroke = stroke;
  });
  invalidateMarkerSymbols();
}

function editMarkerLegend(): void {
  const id = `marker${selectedMarker.i}`;
  void Controllers.NotesEditor.open(id, id);
}

function openMarkersInRadius(): void {
  void Controllers.MarkersInRadius.open(selectedMarker);
}

function toggleMarkerLock(): void {
  selectedMarker.lock = !selectedMarker.lock;
  const markerLock = ensureEl("markerLock");
  markerLock.classList.toggle("icon-lock-open");
  markerLock.classList.toggle("icon-lock");
}

function toggleAddMarker(): void {
  void Controllers.MarkerCreator.toggle(selectedMarker);
}

function confirmMarkerDeletion(): void {
  confirmationDialog({
    title: "Remove marker",
    message: "Are you sure you want to remove this marker? The action cannot be reverted",
    confirm: "Remove",
    onConfirm: deleteMarker
  });
}

function deleteMarker(): void {
  Markers.deleteMarker(selectedMarker.i);
  selectedElement?.remove();
  selectedElement = null;
  invalidateMarkerSymbols();
  destroyDialog("markerEditor");
  refreshEditors();
}

function closeMarkerEditor(): void {
  if (selectedElement) select(selectedElement).on(".drag", null);
  selectedElement?.remove();
  selectedElement = null;
  if (ensureEl("addMarker").classList.contains("pressed")) stopMapPlacement();
  clearMainTip();
  destroyDialog("markerEditor");
}

export const MarkersEditor = { open };
