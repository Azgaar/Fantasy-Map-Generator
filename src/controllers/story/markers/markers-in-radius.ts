import { Controllers } from "@/controllers";
import { Icons } from "@/model/icons";
import type { Marker } from "@/model/story/markers-generator";
import { Markers } from "@/model/story/markers-generator";
import { clearMarkerRadius, drawMarkerRadius } from "@/renderers/draw-marker-radius";
import { setMarkersFilter } from "@/renderers/draw-markers";
import { Layers } from "@/renderers/layers";
import { highlightElement } from "@/renderers/overlays/highlight";
import { viewport } from "@/renderers/viewport/viewport";
import { Csv } from "@/services/io/csv";
import { closeDialogs, confirmationDialog, refreshEditors } from "@/ui/dialog/dialog-helpers";
import { zoomTo } from "@/ui/map/zoom";
import { clearMainTip, tip } from "@/ui/tooltips";
import { ensureEl, findEl, getLatitude, getLongitude } from "@/utils";
import { sentences, t } from "@/utils/i18n";

let center: Marker | null = null;
let lastRadius = 0;
let inRangeMarkers: Marker[] = [];

function defaultRadius(): number {
  const distance = (Math.min(viewport.width, viewport.height) / 4) * options.map.units.distance.scale;
  const magnitude = 10 ** Math.floor(Math.log10(distance || 1));
  return Math.max(1, Math.round(distance / magnitude) * magnitude);
}

function getRadius(): number {
  if (!lastRadius) lastRadius = defaultRadius();
  return lastRadius;
}

function markerName(marker: Marker): string {
  return marker.name || marker.type || "Marker";
}

function open(marker: Marker): void {
  if (customization) return;
  closeDialogs(".stable");
  Layers.show("markers");

  center = marker;
  renderDialog();
  applyRadius(getRadius());

  $("#markersInRadius").dialog({
    title: t("Markers in Radius"),
    resizable: false,
    width: "fit-content",
    close: closeMarkersInRadius,
    position: { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" }
  });
}

function renderDialog(): void {
  findEl("markersInRadius")?.remove();

  const centerName = center ? markerName(center) : "";
  const html = /* html */ `
    <div id="markersInRadius" class="dialog">
      <div style="padding:.2em 0 .4em; line-height:1.5">${t("Around")}: <b>${centerName}</b></div>

      <div data-tip="${t("Radius around the marker, in the map's distance unit — markers inside it are listed and shown on the map")}">
        <span class="label" style="display:inline">${t("Radius")}:</span>
        <input id="markersRadiusValue" type="number" min="1" step="1" value="${getRadius()}" style="width:6em" />
        <span>${options.map.units.distance.unit}</span>
      </div>

      <div class="label" style="margin-top:.4em">${t("In range")}: <span id="markersRadiusCount">0</span></div>
      <div id="markersRadiusList" class="table" style="max-height:15em; overflow-y:auto"></div>

      <div id="markersRadiusBottom" style="margin-top:.4em">
        <button id="markersRadiusLocate" data-tip="${t("Zoom to the marker")}" class="icon-target"></button>
        <button id="markersRadiusExport" data-tip="${t("Save data as a CSV file")}" class="icon-download"></button>
      </div>
    </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);

  ensureEl("markersRadiusValue").addEventListener("change", onRadiusChange);
  ensureEl("markersRadiusList").addEventListener("click", onMarkerListClick);
  ensureEl("markersRadiusLocate").addEventListener("click", locateCenter);
  ensureEl("markersRadiusExport").addEventListener("click", exportInRange);
}

function onRadiusChange(this: HTMLInputElement): void {
  const value = Math.max(1, Math.round(+this.value) || defaultRadius());
  this.value = String(value);
  lastRadius = value;
  applyRadius(value);
}

function applyRadius(distance: number): void {
  if (!center) return;

  const radiusPx = distance / options.map.units.distance.scale;
  drawMarkerRadius(center.x, center.y, radiusPx);

  const inRange = pack.markers.filter(marker => Math.hypot(marker.x - center!.x, marker.y - center!.y) <= radiusPx);
  setMarkersFilter(inRange.map(marker => marker.i));
  Layers.draw("markers");
  renderMarkersList(inRange);
}

function renderMarkersList(inRange: Marker[]): void {
  inRangeMarkers = inRange.filter(marker => marker.i !== center!.i);
  ensureEl("markersRadiusCount").textContent = String(inRangeMarkers.length);

  ensureEl("markersRadiusList").innerHTML = inRangeMarkers
    .map(({ i, type, icon, iconFill, iconStroke, pinned, lock, name: markerName }) => {
      const name = markerName || type;
      const iconHtml = `<span style="width:1.3em; display:flex">${Icons.html(icon, { fill: iconFill, stroke: iconStroke })}</span>`;
      return /* html */ `
        <div class="states" data-id="${i}" style="display:flex; align-items:center; gap:.15em">
          ${iconHtml}
          <div data-tip="${type}" style="flex:1; min-width:10em; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">${name}</div>
          <span class="icon-pencil pointer" data-tip="${t("Edit Marker")}"></span>
          <span class="icon-target pointer" data-tip="${t("Locate on map")}"></span>
          <span class="icon-pin pointer ${pinned ? "" : "inactive"}" data-tip="${t("Pin marker")}"></span>
          <span class="locks pointer ${lock ? "icon-lock" : "icon-lock-open inactive"}" data-tip="${t("Lock")}"></span>
          <span class="icon-trash-empty pointer" data-tip="${t("Remove")}"></span>
        </div>`;
    })
    .join("");
}

function onMarkerListClick(event: MouseEvent): void {
  const target = event.target as HTMLElement;
  const row = target.closest<HTMLElement>(".states");
  if (!row) return;

  const i = +row.dataset.id!;
  const marker = pack.markers.find(m => m.i === i);
  if (!marker) return;

  if (target.classList.contains("icon-pencil")) {
    zoomTo(marker.x, marker.y, 8, 1600);
    return void Controllers.MarkersEditor.open(i);
  }
  if (target.classList.contains("icon-pin")) return void togglePin(marker, target);
  if (target.classList.contains("locks")) return void toggleLock(marker, target);
  if (target.classList.contains("icon-trash-empty")) return void confirmRemove(marker);

  zoomTo(marker.x, marker.y, 8, 1600);
  const el = findEl(`marker${i}`);
  if (el) highlightElement(el, 2);
}

function togglePin(marker: Marker, el: HTMLElement): void {
  Markers.setPinned(marker.i, !marker.pinned);
  el.classList.toggle("inactive");
  Layers.draw("markers"); // the renderer reads the flag off the markers themselves
}

function toggleLock(marker: Marker, el: HTMLElement): void {
  Markers.setLocked(marker.i, !marker.lock);
  el.className = marker.lock ? "locks pointer icon-lock" : "locks pointer icon-lock-open inactive";
}

function confirmRemove(marker: Marker): void {
  confirmationDialog({
    title: t("Remove"),
    message: sentences(t("Are you sure you want to remove this marker?"), t("This action cannot be reverted")),
    confirm: t("Remove"),
    onConfirm: () => {
      Markers.remove(marker.i);
      findEl(`marker${marker.i}`)?.remove();
      refreshEditors();
      applyRadius(getRadius());
    }
  });
}

function exportInRange(): void {
  if (!inRangeMarkers.length) return void tip(t("No markers in range to export"), false, "error");

  const { coordinates } = options.map.geography;
  const rows = inRangeMarkers.map(({ i, type, icon, x, y, cell, name, note }) => {
    const state = pack.states[pack.cells.state[cell]];
    const culture = pack.cultures[pack.cells.culture[cell]];
    return [
      i,
      type,
      Icons.glyphText(icon) ?? icon,
      name,
      note,
      state ? state.fullName || state.name : "",
      culture?.name,
      x,
      y,
      getLatitude(y, coordinates, options.map.graph.height, 2),
      getLongitude(x, coordinates, options.map.graph.width, 2)
    ];
  });
  const headers = ["Id", "Type", "Icon", "Name", "Note", "State", "Culture", "X", "Y", "Latitude", "Longitude"];
  Csv.download(t("Markers in Radius"), headers, rows);
}

function locateCenter(): void {
  if (center) zoomTo(center.x, center.y, 8, 1600);
}

function closeMarkersInRadius(): void {
  clearMarkerRadius();
  setMarkersFilter(null);
  Layers.draw("markers");
  inRangeMarkers = [];
  center = null;
  clearMainTip();
  $("#markersInRadius").dialog("destroy");
  findEl("markersInRadius")?.remove();
}

export const MarkersInRadius = { open };
