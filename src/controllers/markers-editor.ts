import { drag, select } from "d3";
import { Controllers } from "@/controllers";
import type { Marker } from "@/generators/markers-generator";
import { ensureEl, rn } from "../utils";

const DIALOG_HTML = /* html */ `
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
    <button id="markerLock" class="icon-lock-open" onmouseover="showElementLockTip(event)"></button>
    <button id="markerAdd" data-tip="Add additional marker of that type" class="icon-plus"></button>
    <button id="markerRemove" data-tip="Remove the marker" data-shortcut="Delete" class="icon-trash fastDelete"></button>
  </div>`;

let selectedElement: SVGSVGElement;
let selectedMarker: Marker;

function open(markerI?: number, target?: Element): void {
  if (customization) return;
  closeDialogs(".stable");

  const found = getElement(markerI, target);
  if (!found) return;
  [selectedElement, selectedMarker] = found;

  elSelected = select<SVGElement, unknown>(selectedElement)
    .raise()
    .call(drag<SVGElement, unknown>().on("start", dragMarker))
    .classed("draggable", true) as unknown as typeof elSelected;

  if (ensureEl("notesEditor").offsetParent) {
    void Controllers.NotesEditor.open(selectedElement.id, selectedElement.id);
  }

  ensureEl("markerEditor").innerHTML = DIALOG_HTML;
  updateInputs();

  // add listeners — dropped together with the dialog HTML on close
  ensureEl("markerType").on("change", changeMarkerType);
  ensureEl("markerIconSelect").on("click", changeMarkerIcon);
  ensureEl("markerIconSize").on("input", changeIconSize);
  ensureEl("markerIconShiftX").on("input", changeIconShiftX);
  ensureEl("markerIconShiftY").on("input", changeIconShiftY);
  ensureEl("markerSize").on("input", changeMarkerSize);
  ensureEl("markerPin").on("change", changeMarkerPin);
  ensureEl("markerFill").on("input", changePinFill);
  ensureEl("markerStroke").on("input", changePinStroke);
  ensureEl("markerNotes").on("click", editMarkerLegend);
  ensureEl("markerLock").on("click", toggleMarkerLock);
  ensureEl("markerAdd").on("click", toggleAddMarker);
  ensureEl("markerRemove").on("click", confirmMarkerDeletion);

  $("#markerEditor").dialog({
    title: "Edit Marker",
    resizable: false,
    position: { my: "left top", at: "left+10 top+10", of: "svg", collision: "fit" },
    close: closeMarkerEditor
  });
}

function getElement(markerI?: number, target?: Element): [SVGSVGElement, Marker] | null {
  if (target) {
    const element = target.closest("svg") as SVGSVGElement | null;
    if (!element) return null;
    const marker = pack.markers.find(({ i }) => Number(element.id.slice(6)) === i);
    return marker ? [element, marker] : null;
  }

  const element = ensureEl<HTMLElement>(`marker${markerI}`) as unknown as SVGSVGElement;
  const marker = pack.markers.find(({ i }) => i === markerI);
  return element && marker ? [element, marker] : null;
}

function getSameTypeMarkers(): Marker[] {
  const currentType = selectedMarker.type;
  if (!currentType) return [selectedMarker];
  return pack.markers.filter(({ type }) => type === currentType);
}

function dragMarker(this: SVGElement, event: any): void {
  const dx = +this.getAttribute("x")! - event.x;
  const dy = +this.getAttribute("y")! - event.y;

  event.on("drag", function (this: SVGElement, dragEvent: any) {
    this.setAttribute("x", String(dx + dragEvent.x));
    this.setAttribute("y", String(dy + dragEvent.y));
  });

  event.on("end", function (this: SVGElement, dragEvent: any) {
    const { x, y } = dragEvent;
    this.setAttribute("x", String(rn(dx + x, 2)));
    this.setAttribute("y", String(rn(dy + y, 2)));

    const size = selectedMarker.size || 30;
    const zoomSize = Math.max(rn(size / 5 + 24 / scale, 2), 1);

    selectedMarker.x = rn(x + dx + zoomSize / 2, 1);
    selectedMarker.y = rn(y + dy + zoomSize, 1);
    selectedMarker.cell = findCell(selectedMarker.x, selectedMarker.y)!;
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
}

function changeMarkerIcon(): void {
  selectIcon(selectedMarker.icon, value => {
    const isExternal = value.startsWith("http") || value.startsWith("data:image");
    ensureEl("markerIcon").innerHTML = isExternal ? `<img src="${value}" style="width: 1em; height: 1em;">` : value;

    getSameTypeMarkers().forEach(marker => {
      marker.icon = value;
      redrawIcon(marker);
    });
  });
}

function changeIconSize(this: HTMLInputElement): void {
  const px = +this.value;
  getSameTypeMarkers().forEach(marker => {
    marker.px = px;
    redrawIcon(marker);
  });
}

function changeIconShiftX(this: HTMLInputElement): void {
  const dx = +this.value;
  getSameTypeMarkers().forEach(marker => {
    marker.dx = dx;
    redrawIcon(marker);
  });
}

function changeIconShiftY(this: HTMLInputElement): void {
  const dy = +this.value;
  getSameTypeMarkers().forEach(marker => {
    marker.dy = dy;
    redrawIcon(marker);
  });
}

function changeMarkerSize(this: HTMLInputElement): void {
  const size = +this.value;
  const rescale = +markers.attr("rescale");

  getSameTypeMarkers().forEach(marker => {
    marker.size = size;
    const { i, x, y, hidden } = marker;
    const el = !hidden && document.getElementById(`marker${i}`);
    if (!el) return;

    const zoomedSize = rescale ? Math.max(rn(size / 5 + 24 / scale, 2), 1) : size;
    el.setAttribute("width", String(zoomedSize));
    el.setAttribute("height", String(zoomedSize));
    el.setAttribute("x", String(rn(x - zoomedSize / 2, 1)));
    el.setAttribute("y", String(rn(y - zoomedSize, 1)));
  });
}

function changeMarkerPin(this: HTMLSelectElement): void {
  const pin = this.value;
  getSameTypeMarkers().forEach(marker => {
    marker.pin = pin;
    redrawPin(marker);
  });
}

function changePinFill(this: HTMLInputElement): void {
  const fill = this.value;
  getSameTypeMarkers().forEach(marker => {
    marker.fill = fill;
    redrawPin(marker);
  });
}

function changePinStroke(this: HTMLInputElement): void {
  const stroke = this.value;
  getSameTypeMarkers().forEach(marker => {
    marker.stroke = stroke;
    redrawPin(marker);
  });
}

function redrawIcon({ i, hidden, icon, dx = 50, dy = 50, px = 12 }: Marker): void {
  const isExternal = icon.startsWith("http") || icon.startsWith("data:image");

  const iconText = !hidden && document.querySelector(`#marker${i} > text`);
  if (iconText) {
    iconText.innerHTML = isExternal ? "" : icon;
    iconText.setAttribute("x", `${dx}%`);
    iconText.setAttribute("y", `${dy}%`);
    iconText.setAttribute("font-size", `${px}px`);
  }

  const iconImage = !hidden && document.querySelector(`#marker${i} > image`);
  if (iconImage) {
    iconImage.setAttribute("x", `${dx / 2}%`);
    iconImage.setAttribute("y", `${dy / 2}%`);
    iconImage.setAttribute("width", `${px}px`);
    iconImage.setAttribute("height", `${px}px`);
    iconImage.setAttribute("href", isExternal ? icon : "");
  }
}

function redrawPin({ i, hidden, pin = "bubble", fill = "#fff", stroke = "#000" }: Marker): void {
  const pinGroup = !hidden && document.querySelector(`#marker${i} > g`);
  if (pinGroup) pinGroup.innerHTML = getPin(pin, fill, stroke);
}

function editMarkerLegend(): void {
  const id = selectedElement.id;
  void Controllers.NotesEditor.open(id, id);
}

function toggleMarkerLock(): void {
  selectedMarker.lock = !selectedMarker.lock;
  const markerLock = ensureEl("markerLock");
  markerLock.classList.toggle("icon-lock-open");
  markerLock.classList.toggle("icon-lock");
}

function toggleAddMarker(): void {
  ensureEl("markerAdd").classList.toggle("pressed");
  ensureEl("addMarker").click();
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
  selectedElement.remove();
  $("#markerEditor").dialog("close");
  if (ensureEl("markersOverviewRefresh").offsetParent) ensureEl("markersOverviewRefresh").click();
}

function closeMarkerEditor(): void {
  unselect();
  ensureEl("addMarker").classList.remove("pressed");
  restoreDefaultEvents();
  clearMainTip();
  ensureEl("markerEditor").innerHTML = "";
}

export const MarkersEditor = { open };
