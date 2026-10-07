import { type D3DragEvent, drag, select } from "d3";
import {
  closeDialogs,
  confirmationDialog,
  destroyDialog,
  noteButton,
  refreshEditors
} from "@/components/dialog/dialog-helpers";
import { Icons } from "@/components/icons";
import { stopMapPlacement } from "@/components/map-placement";
import { clearMainTip, tip } from "@/components/tooltips";
import { Controllers } from "@/controllers";
import type { Marker, MarkerAppearance } from "@/generators/markers-generator";
import { drawMarkers, setEditedMarker } from "@/renderers/draw-markers";
import { sentences, t } from "@/utils/i18n";
import { ensureEl, findEl, minmax, rn } from "../utils";

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
  ensureEl("markerEditor").dataset.entity = `marker:${selectedMarker.i}`;
  updateInputs();

  $("#markerEditor").dialog({
    title: t("Edit Marker"),
    resizable: false,
    position: { my: "left top", at: "left+10 top+10", of: "svg", collision: "fit" },
    close: closeMarkerEditor
  });
}

function renderDialog(): void {
  destroyDialog("markerEditor");

  const html = /* html */ `<div id="markerEditor" class="dialog">
    <div id="markerBody" style="padding-bottom: 0.3em">
      <div data-tip="${t("Marker name, shown in the notes editor and overviews")}">
        <div class="label">${t("Name")}:</div>
        <input id="markerName" style="width: 10.3em" />
      </div>
      <div data-tip="${sentences(t("Marker type"), t("Style changes will apply to all markers of the same type"), t("Leave blank if the marker is unique"))}">
        <div class="label">${t("Type")}:</div>
        <input id="markerType" style="width: 10.3em" />
      </div>
      <div data-tip="${t("Marker icon")}" style="display: flex; align-items: center">
        <div class="label">${t("Icon")}:</div>
        <div id="markerIcon" style="font-size: 1.5em; width: 3.7em; display: flex"></div>
        <button id="markerIconSelect" style="width: 5em">${t("Select")}</button>
      </div>
      <div data-tip="${t("Marker marker element and icon sizes in pixels")}">
        <div class="label">${t("Size")}:</div>
        <input data-tip="${t("Marker element size in pixels")}" id="markerSize" type="number" min="1" max="500" style="width: 5em" />
        <input data-tip="${t("Marker icon sizes in pixels")}" id="markerIconSize" type="number" min="1" max="50" step="0.1" style="width: 5em" />
      </div>
      <div data-tip="${t("Marker icon shift (by X and by Y axis), percent. Set to 50 to position icon in center")}">
        <div class="label">${t("Icon shift")}:</div>
        <input id="markerIconShiftX" type="number" min="0" max="100" step="1" style="width: 5em" />
        <input id="markerIconShiftY" type="number" min="0" max="100" step="1" style="width: 5em" />
      </div>
      <div data-tip="${t("Marker pin shape")}">
        <div class="label">${t("Pin shape")}:</div>
        <select id="markerPin" style="width: 10.3em">
          <option value="bubble">${t("Bubble")}</option>
          <option value="pin">${t("Pin")}</option>
          <option value="square">${t("Square")}</option>
          <option value="squarish">${t("Squarish")}</option>
          <option value="diamond">${t("Diamond")}</option>
          <option value="hex">${t("Hex")}</option>
          <option value="hexy">${t("Hexy")}</option>
          <option value="shieldy">${t("Shieldy")}</option>
          <option value="shield">${t("Shield")}</option>
          <option value="pentagon">${t("Pentagon")}</option>
          <option value="heptagon">${t("Heptagon")}</option>
          <option value="circle">${t("Circle")}</option>
          <option value="no">${t("No")}</option>
        </select>
      </div>
      <div data-tip="${t("Pin fill and stroke colors")}">
        <div class="label">${t("Pin colors")}:</div>
        <input id="markerFill" type="color" style="width: 5em; height: 1.6em" />
        <input id="markerStroke" type="color" style="width: 5em; height: 1.6em" />
      </div>
      <div data-tip="${t("Icon fill and stroke colors: they paint the parts the icon leaves uncolored. Emoji keep their own colors")}">
        <div class="label">${t("Icon colors")}:</div>
        <input id="markerIconFill" type="color" style="width: 5em; height: 1.6em" />
        <input id="markerIconStroke" type="color" style="width: 5em; height: 1.6em" />
        <i id="markerIconPaintReset" data-tip="${t("Restore the icon's default colors")}" class="icon-ccw pointer"></i>
      </div>
    </div>
    <div id="markerBottom">
      ${noteButton("markerNotes", t("Edit free text notes (legend)"))}
      <button id="markerRadius" data-tip="${t("Show markers within a radius of this one")}" class="icon-dot-circled"></button>
      <button id="markerLock" class="icon-lock-open" onmouseover="showElementLockTip(event)"></button>
      <button id="markerAdd" data-tip="${t("Add additional marker of that type")}" class="icon-plus"></button>
      <button id="markerRemove" data-tip="${t("Remove marker")}" data-shortcut="Delete" class="icon-trash fastDelete"></button>
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
  ensureEl("markerIconFill").addEventListener("input", changeIconFill);
  ensureEl("markerIconStroke").addEventListener("input", changeIconStroke);
  ensureEl("markerIconPaintReset").addEventListener("click", resetIconPaint);
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
    const { width, height } = options.map.graph;
    const x = minmax(dragEvent.x + dx, 0, width); // the box sits at the marker point
    const y = minmax(dragEvent.y + dy, 0, height);
    this.setAttribute("x", String(rn(x, 2)));
    this.setAttribute("y", String(rn(y, 2)));

    Markers.move(selectedMarker.i, x, y);
    drawMarkers();
  });
}

function updateInputs(): void {
  const marker = selectedMarker;
  updateIconPaint();

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

/** the icon preview and its colors: the marker's own, else the icon's default paint */
function updateIconPaint(): void {
  const { icon, iconFill, iconStroke } = selectedMarker;
  const paint = Icons.paint(icon);
  const color = (value: string | undefined) => (value && /^#[\da-f]{6}$/i.test(value) ? value : "#000000");
  ensureEl("markerIcon").innerHTML = Icons.html(icon, { fill: iconFill, stroke: iconStroke });
  ensureEl<HTMLInputElement>("markerIconFill").value = color(iconFill ?? paint.fill);
  ensureEl<HTMLInputElement>("markerIconStroke").value = color(iconStroke ?? paint.stroke);
  ensureEl("markerIconPaintReset").style.visibility = iconFill || iconStroke ? "visible" : "hidden";
}

function changeMarkerName(this: HTMLInputElement): void {
  if (this.value.trim()) Markers.rename(selectedMarker.i, this.value);
  if (findEl("notesEditor")) void Controllers.NotesEditor.open({ type: "marker", id: selectedMarker.i });
}

function changeMarkerType(this: HTMLInputElement): void {
  if (this.value.trim()) Markers.setType(selectedMarker.i, this.value);
}

function changeMarkerIcon(): void {
  Controllers.IconPicker.open({
    current: selectedMarker.icon,
    live: true,
    onPick: icon => {
      for (const marker of getSameTypeMarkers()) marker.icon = icon;
      updateIconPaint();
      drawMarkers();
    }
  });
}

function changeIconSize(this: HTMLInputElement): void {
  setSameTypeAppearance({ px: +this.value });
}

function changeIconShiftX(this: HTMLInputElement): void {
  setSameTypeAppearance({ dx: +this.value });
}

function changeIconShiftY(this: HTMLInputElement): void {
  setSameTypeAppearance({ dy: +this.value });
}

function changeMarkerSize(this: HTMLInputElement): void {
  setSameTypeAppearance({ size: +this.value });
}

function changeMarkerPin(this: HTMLSelectElement): void {
  setSameTypeAppearance({ pin: this.value });
}

function changePinFill(this: HTMLInputElement): void {
  setSameTypeAppearance({ fill: this.value });
}

function changePinStroke(this: HTMLInputElement): void {
  setSameTypeAppearance({ stroke: this.value });
}

function changeIconFill(this: HTMLInputElement): void {
  setSameTypeAppearance({ iconFill: this.value });
  updateIconPaint();
}

function changeIconStroke(this: HTMLInputElement): void {
  setSameTypeAppearance({ iconStroke: this.value });
  updateIconPaint();
}

function resetIconPaint(): void {
  setSameTypeAppearance({ iconFill: null, iconStroke: null });
  updateIconPaint();
}

/** Markers of one type share their look, as the editor shows it */
function setSameTypeAppearance(appearance: MarkerAppearance): void {
  try {
    for (const marker of getSameTypeMarkers()) Markers.setAppearance(marker.i, appearance);
  } catch (error) {
    tip((error as Error).message, false, "error");
  }
  drawMarkers();
}

function editMarkerLegend(): void {
  void Controllers.NotesEditor.open({ type: "marker", id: selectedMarker.i });
}

function openMarkersInRadius(): void {
  void Controllers.MarkersInRadius.open(selectedMarker);
}

function toggleMarkerLock(): void {
  Markers.setLocked(selectedMarker.i, !selectedMarker.lock);
  const markerLock = ensureEl("markerLock");
  markerLock.classList.toggle("icon-lock-open");
  markerLock.classList.toggle("icon-lock");
}

function toggleAddMarker(): void {
  void Controllers.MarkerCreator.toggle(selectedMarker);
}

function confirmMarkerDeletion(): void {
  confirmationDialog({
    title: t("Remove marker"),
    message: sentences(t("Are you sure you want to remove this marker?"), t("This action cannot be reverted")),
    confirm: t("Remove"),
    onConfirm: deleteMarker
  });
}

function deleteMarker(): void {
  Markers.remove(selectedMarker.i);
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
