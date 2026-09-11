import { type D3DragEvent, drag, select } from "d3";
import { closeDialogs, confirmationDialog, destroyDialog, refreshEditors } from "@/components/dialog/dialog-helpers";
import { stopMapPlacement } from "@/components/map-placement";
import { clearMainTip } from "@/components/tooltips";
import { Controllers } from "@/controllers";
import type { Marker } from "@/generators/markers-generator";
import { Notes } from "@/generators/notes";
import { drawMarkers, setEditedMarker } from "@/renderers/draw-markers";
import { ensureEl, escapeHtml, findEl, isImageIcon, rn } from "../utils";

let selectedElement: SVGSVGElement;
let selectedMarker: Marker;

function open(markerI?: number, target?: Element): void {
  if (customization) return;
  closeDialogs(".stable");

  const found = getElement(markerI, target);
  if (!found) return;
  [selectedElement, selectedMarker] = found;

  select<SVGElement, unknown>(selectedElement)
    .raise()
    .call(drag<SVGElement, unknown>().on("start", dragMarker))
    .classed("draggable", true);

  if (findEl("notesEditor")) {
    void Controllers.NotesEditor.open({ type: "marker", id: selectedMarker.i });
  }

  renderDialog();
  updateInputs();

  $("#markerEditor").dialog({
    title: "Edit Marker",
    resizable: false,
    position: { my: "left top", at: "left+10 top+10", of: "svg", collision: "fit" },
    close: closeMarkerEditor
  });
}

function renderDialog(): void {
  destroyDialog("markerEditor");

  const html = /* html */ `<div id="markerEditor" class="dialog">
    <div id="markerBody" style="padding-bottom: 0.3em">
      <div data-tip="Marker name, shown in the notes editor and overviews">
        <div class="label">Name:</div>
        <input id="markerName" style="width: 10.3em" />
      </div>
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
      ${Notes.getButton("markerNotes", "this marker")}
      <button id="markerRadius" data-tip="Show markers within a radius of this one" class="icon-dot-circled"></button>
      <button id="markerLock" class="icon-lock-open" onmouseover="showElementLockTip(event)"></button>
      <button id="markerAdd" data-tip="Add additional marker of that type" class="icon-plus"></button>
      <button id="markerRemove" data-tip="Remove the marker" data-shortcut="Delete" class="icon-trash fastDelete"></button>
    </div>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);

  // add listeners — dropped together with the dialog HTML on close
  ensureEl("markerName").addEventListener("change", changeMarkerName);
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

function getElement(markerI?: number, target?: Element): [SVGSVGElement, Marker] | null {
  const id = target ? Number(target.closest("svg")?.id.slice(6)) : markerI;
  const marker = pack.markers.find(({ i }) => i === id);
  if (!marker) return null;
  setEditedMarker(marker);
  const element = findEl<SVGSVGElement>(`marker${id}`);
  if (!element) setEditedMarker(null);
  return element ? [element, marker] : null;
}

function getSameTypeMarkers(): Marker[] {
  const currentType = selectedMarker.type;
  if (!currentType) return [selectedMarker];
  return pack.markers.filter(({ type }) => type === currentType);
}

function dragMarker(this: SVGElement, event: D3DragEvent<SVGElement, unknown, unknown>): void {
  const dx = +this.getAttribute("x")! - event.x;
  const dy = +this.getAttribute("y")! - event.y;

  event.on("drag", function (this: SVGElement, dragEvent: D3DragEvent<SVGElement, unknown, unknown>) {
    this.setAttribute("x", String(dx + dragEvent.x));
    this.setAttribute("y", String(dy + dragEvent.y));
  });

  event.on("end", function (this: SVGElement, dragEvent: D3DragEvent<SVGElement, unknown, unknown>) {
    const { x, y } = dragEvent;
    this.setAttribute("x", String(rn(dx + x, 2)));
    this.setAttribute("y", String(rn(dy + y, 2)));

    const zoomSize = Number(this.getAttribute("width"));

    selectedMarker.x = rn(x + dx + zoomSize / 2, 1);
    selectedMarker.y = rn(y + dy + zoomSize, 1);
    selectedMarker.cell = Pack.findCell(selectedMarker.x, selectedMarker.y)!;
    drawMarkers();
  });
}

function updateInputs(): void {
  const marker = selectedMarker;
  ensureEl("markerIcon").innerHTML = isImageIcon(marker.icon)
    ? `<img src="${escapeHtml(marker.icon)}" style="width: 1em; height: 1em;">`
    : escapeHtml(marker.icon);

  ensureEl<HTMLInputElement>("markerName").value = marker.name || "";
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

function changeMarkerName(this: HTMLInputElement): void {
  selectedMarker.name = this.value;
  if (findEl("notesEditor")) void Controllers.NotesEditor.open({ type: "marker", id: selectedMarker.i });
}

function changeMarkerType(this: HTMLInputElement): void {
  selectedMarker.type = this.value;
}

function changeMarkerIcon(): void {
  Controllers.IconSelector.open(selectedMarker.icon, value => {
    const isExternal = isImageIcon(value);
    ensureEl("markerIcon").innerHTML = isExternal
      ? `<img src="${escapeHtml(value)}" style="width: 1em; height: 1em;">`
      : escapeHtml(value);

    getSameTypeMarkers().forEach(marker => {
      marker.icon = value;
    });
    drawMarkers();
  });
}

function changeIconSize(this: HTMLInputElement): void {
  const px = +this.value;
  getSameTypeMarkers().forEach(marker => {
    marker.px = px;
  });
  drawMarkers();
}

function changeIconShiftX(this: HTMLInputElement): void {
  const dx = +this.value;
  getSameTypeMarkers().forEach(marker => {
    marker.dx = dx;
  });
  drawMarkers();
}

function changeIconShiftY(this: HTMLInputElement): void {
  const dy = +this.value;
  getSameTypeMarkers().forEach(marker => {
    marker.dy = dy;
  });
  drawMarkers();
}

function changeMarkerSize(this: HTMLInputElement): void {
  const size = +this.value;
  getSameTypeMarkers().forEach(marker => {
    marker.size = size;
  });
  drawMarkers();
}

function changeMarkerPin(this: HTMLSelectElement): void {
  const pin = this.value;
  getSameTypeMarkers().forEach(marker => {
    marker.pin = pin;
  });
  drawMarkers();
}

function changePinFill(this: HTMLInputElement): void {
  const fill = this.value;
  getSameTypeMarkers().forEach(marker => {
    marker.fill = fill;
  });
  drawMarkers();
}

function changePinStroke(this: HTMLInputElement): void {
  const stroke = this.value;
  getSameTypeMarkers().forEach(marker => {
    marker.stroke = stroke;
  });
  drawMarkers();
}

function editMarkerLegend(): void {
  void Controllers.NotesEditor.open({ type: "marker", id: selectedMarker.i });
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
  drawMarkers();
  $("#markerEditor").dialog("close");
  refreshEditors();
}

function closeMarkerEditor(): void {
  select(selectedElement).on(".drag", null).classed("draggable", false);
  setEditedMarker(null);
  if (ensureEl("addMarker").classList.contains("pressed")) stopMapPlacement();
  clearMainTip();
  destroyDialog("markerEditor");
  selectedElement = null!;
  selectedMarker = null!;
}

export const MarkersEditor = { open };
