import { closeDialogs, confirmationDialog, refreshEditors } from "@/components/dialog/dialog-helpers";
import { clearMainTip, tip } from "@/components/tooltips";
import { Controllers } from "@/controllers";
import type { Marker } from "@/generators/markers-generator";
import { clearMarkerRadius, drawMarkerRadius } from "@/renderers/draw-marker-radius";
import { drawMarkers, setMarkersFilter } from "@/renderers/draw-markers";
import { highlightElement } from "@/renderers/overlays/highlight";
import { downloadFile, ensureEl, getFileName, getLatitude, getLongitude } from "@/utils";

let center: Marker | null = null;
let lastRadius = 0;
let inRangeMarkers: Marker[] = [];

function defaultRadius(): number {
  const distance = (Math.min(svgWidth, svgHeight) / 4) * distanceScale;
  const magnitude = 10 ** Math.floor(Math.log10(distance || 1));
  return Math.max(1, Math.round(distance / magnitude) * magnitude);
}

function getRadius(): number {
  if (!lastRadius) lastRadius = defaultRadius();
  return lastRadius;
}

function markerName(marker: Marker): string {
  return notes.find(note => note.id === `marker${marker.i}`)?.name || marker.type || "Marker";
}

function open(marker: Marker): void {
  if (customization) return;
  closeDialogs(".stable");
  if (!layerIsOn("toggleMarkers")) toggleMarkers();

  center = marker;
  renderDialog();
  applyRadius(getRadius());

  $("#markersInRadius").dialog({
    title: "Markers in Radius",
    resizable: false,
    width: "fit-content",
    close: closeMarkersInRadius,
    position: { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" }
  });
}

function renderDialog(): void {
  document.getElementById("markersInRadius")?.remove();

  const centerName = center ? markerName(center) : "";
  const html = /* html */ `
    <div id="markersInRadius" class="dialog">
      <div style="padding:.2em 0 .4em; line-height:1.5">Around: <b>${centerName}</b></div>

      <div data-tip="Radius around the marker, in the map's distance unit — markers inside it are listed and shown on the map">
        <span class="label" style="display:inline">Radius:</span>
        <input id="markersRadiusValue" type="number" min="1" step="1" value="${getRadius()}" style="width:6em" />
        <span>${distanceUnitInput.value}</span>
      </div>

      <div class="label" style="margin-top:.4em">In range: <span id="markersRadiusCount">0</span></div>
      <div id="markersRadiusList" class="table" style="max-height:15em; overflow-y:auto"></div>

      <div id="markersRadiusBottom" style="margin-top:.4em">
        <button id="markersRadiusLocate" data-tip="Zoom to the marker" class="icon-target"></button>
        <button id="markersRadiusExport" data-tip="Export the in-range markers as a text file (.csv)" class="icon-download"></button>
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

  const radiusPx = distance / distanceScale;
  drawMarkerRadius(center.x, center.y, radiusPx);

  const inRange = pack.markers.filter(marker => Math.hypot(marker.x - center!.x, marker.y - center!.y) <= radiusPx);
  setMarkersFilter(inRange.map(marker => marker.i));
  if (layerIsOn("toggleMarkers")) drawMarkers();
  renderMarkersList(inRange);
}

function renderMarkersList(inRange: Marker[]): void {
  inRangeMarkers = inRange.filter(marker => marker.i !== center!.i);
  ensureEl("markersRadiusCount").textContent = String(inRangeMarkers.length);

  ensureEl("markersRadiusList").innerHTML = inRangeMarkers
    .map(({ i, type, icon, pinned, lock }) => {
      const name = notes.find(note => note.id === `marker${i}`)?.name || type;
      const iconHtml =
        icon.startsWith("http") || icon.startsWith("data:image")
          ? `<img src="${icon}" style="width:1.2em; height:1.2em; vertical-align:middle">`
          : `<span style="width:1.3em">${icon}</span>`;
      return /* html */ `
        <div class="states" data-id="${i}" style="display:flex; align-items:center; gap:.15em">
          ${iconHtml}
          <div data-tip="${type}" style="flex:1; min-width:10em; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">${name}</div>
          <span class="icon-pencil pointer" data-tip="Edit marker"></span>
          <span class="icon-target pointer" data-tip="Locate on map"></span>
          <span class="icon-pin pointer ${pinned ? "" : "inactive"}" data-tip="Pin marker"></span>
          <span class="locks pointer ${lock ? "icon-lock" : "icon-lock-open inactive"}" data-tip="Lock marker"></span>
          <span class="icon-trash-empty pointer" data-tip="Remove marker"></span>
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
  const el = document.getElementById(`marker${i}`);
  if (el) highlightElement(el, 2);
}

function togglePin(marker: Marker, el: HTMLElement): void {
  const markerGroup = ensureEl("markers");
  if (marker.pinned) {
    delete marker.pinned;
    if (!pack.markers.some(m => m.pinned)) markerGroup.removeAttribute("pinned");
  } else {
    marker.pinned = true;
    markerGroup.setAttribute("pinned", "1");
  }
  el.classList.toggle("inactive");
  drawMarkers();
}

function toggleLock(marker: Marker, el: HTMLElement): void {
  if (marker.lock) {
    delete marker.lock;
    el.className = "locks pointer icon-lock-open inactive";
  } else {
    marker.lock = true;
    el.className = "locks pointer icon-lock";
  }
}

function confirmRemove(marker: Marker): void {
  confirmationDialog({
    title: "Remove marker",
    message: "Are you sure you want to remove this marker? The action cannot be reverted",
    confirm: "Remove",
    onConfirm: () => {
      Markers.deleteMarker(marker.i);
      document.getElementById(`marker${marker.i}`)?.remove();
      refreshEditors();
      applyRadius(getRadius());
    }
  });
}

function exportInRange(): void {
  if (!inRangeMarkers.length) return void tip("No markers in range to export", false, "error");

  const headers = "Id,Type,Icon,Name,Note,State,Culture,X,Y,Latitude,Longitude\n";
  const quote = (s: string) => `"${s.replaceAll('"', '""')}"`;

  const body = inRangeMarkers.map(({ i, type, icon, x, y, cell }) => {
    const note = notes.find(note => note.id === `marker${i}`);
    const name = note ? quote(note.name) : "Unknown";
    const legend = note ? quote(note.legend) : "";
    const state = pack.states[pack.cells.state[cell]];
    const culture = pack.cultures[pack.cells.culture[cell]];
    const stateName = state ? quote(state.fullName || state.name) : "";
    const cultureName = culture ? quote(culture.name) : "";
    const lat = getLatitude(y, mapCoordinates, graphHeight, 2);
    const lon = getLongitude(x, mapCoordinates, graphWidth, 2);
    return [i, type, icon, name, legend, stateName, cultureName, x, y, lat, lon].join(",");
  });

  downloadFile(headers + body.join("\n"), `${getFileName("Markers in radius")}.csv`);
}

function locateCenter(): void {
  if (center) zoomTo(center.x, center.y, 8, 1600);
}

function closeMarkersInRadius(): void {
  clearMarkerRadius();
  setMarkersFilter(null);
  if (layerIsOn("toggleMarkers")) drawMarkers();
  inRangeMarkers = [];
  center = null;
  clearMainTip();
  $("#markersInRadius").dialog("destroy");
  document.getElementById("markersInRadius")?.remove();
}

export const MarkersInRadius = { open };
