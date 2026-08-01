import { pointer } from "d3";
import { closeDialogs, confirmationDialog, refreshEditors } from "@/components/dialog/dialog-helpers";
import { stopMapPlacement, toggleMapPlacement } from "@/components/map-placement";
import { clearMainTip, tip } from "@/components/tooltips";
import { Controllers } from "@/controllers";
import { type Marker, PARTY_LOCATION_TYPE } from "@/generators/markers-generator";
import { drawMarkers, setMarkersFilter } from "@/renderers/draw-markers";
import { clearPartyRange, drawPartyRange } from "@/renderers/draw-party-range";
import { highlightElement } from "@/renderers/overlays/highlight";
import { downloadFile, ensureEl, getFileName, getLatitude, getLongitude, rn } from "@/utils";
import { fitZoom, radiusPxFor } from "@/utils/party-range";

// Travel rings = daily speed × days. Radius is in the map's own distance unit (mi/km).
const RANGE_DAYS = [
  { key: "daily", label: "Daily", days: 1 },
  { key: "weekly", label: "Weekly", days: 7 },
  { key: "monthly", label: "Monthly", days: 30 }
] as const;

const DEFAULT_DAILY_SPEED = 24; // map-distance units the party covers in a day

type RangeKey = (typeof RANGE_DAYS)[number]["key"] | "";

let activeRange: RangeKey = "";
let inRangeMarkers: Marker[] = []; // non-party markers currently listed, for CSV export

function getParty(): Marker | undefined {
  return pack.markers.find(marker => marker.type === PARTY_LOCATION_TYPE);
}

// Daily speed is stored on the party marker, so it round-trips with the .map file.
function getDailySpeed(): number {
  return getParty()?.dailySpeed ?? DEFAULT_DAILY_SPEED;
}

function setDailySpeed(value: number): void {
  const party = getParty();
  if (party) party.dailySpeed = value;
}

function rangeDistance(days: number): number {
  return rn(getDailySpeed() * days, 1);
}

function zoomExtent(): [number, number] {
  return typeof zoom?.scaleExtent === "function" ? zoom.scaleExtent() : [1, 20];
}

// Label a travel distance with the map's distance unit (values are already in that unit).
function formatDistance(distance: number): string {
  return `${distance} ${distanceUnitInput.value}`;
}

function open(): void {
  if (customization) return;
  closeDialogs(".stable");
  if (!layerIsOn("toggleMarkers")) toggleMarkers();

  Markers.ensurePartyLocation();
  renderDialog();
  updateInfo();
  updateRangeButtons();

  $("#partyLocation").dialog({
    title: "Party Location",
    resizable: false,
    width: "fit-content",
    close: closePartyLocation,
    position: { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" }
  });
}

function renderDialog(): void {
  document.getElementById("partyLocation")?.remove();

  const rangeButtons = RANGE_DAYS.map(({ key, label, days }) => {
    const dist = formatDistance(rangeDistance(days));
    return `<button data-range="${key}" data-tip="Zoom to a ${dist} radius around the party">${label}<br><small>${dist}</small></button>`;
  }).join("");

  const html = /* html */ `
    <div id="partyLocation" class="dialog stable">
      <div id="partyInfo" style="padding:.2em 0 .5em; line-height:1.5"></div>

      <div data-tip="Distance the party travels per day, in the map's distance unit — drives the range rings">
        <span class="label" style="display:inline">Daily speed:</span>
        <input id="partyDailySpeed" type="number" min="1" step="1" value="${getDailySpeed()}" style="width:5em" />
        <span>${distanceUnitInput.value}</span>
      </div>

      <div class="label" style="margin-top:.4em">Travel range</div>
      <div id="partyRangeButtons" style="display:flex; gap:.3em; margin:.3em 0">
        ${rangeButtons}
        <button data-range="" data-tip="Hide the travel-range ring">Off</button>
      </div>

      <div id="partyMarkersHeader" class="label" style="margin-top:.4em; display:none">
        In range: <span id="partyMarkersCount">0</span>
      </div>
      <div id="partyMarkersList" class="table" style="max-height:15em; overflow-y:auto"></div>

      <div id="partyBottom" style="margin-top:.4em">
        <button id="partyMoveHere" data-tip="Click on the map to move the party here" class="icon-move"></button>
        <button id="partyLocate" data-tip="Zoom to the party location" class="icon-target"></button>
        <button id="partyEditNote" data-tip="Edit the party legend (notes)" class="icon-edit"></button>
        <button id="partyExport" data-tip="Export the in-range markers as a text file (.csv)" class="icon-download"></button>
      </div>
    </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);

  ensureEl("partyDailySpeed").addEventListener("change", onDailySpeedChange);
  ensureEl("partyRangeButtons").addEventListener("click", onRangeClick);
  ensureEl("partyMarkersList").addEventListener("click", onMarkerListClick);
  ensureEl("partyMoveHere").addEventListener("click", toggleMoveHere);
  ensureEl("partyLocate").addEventListener("click", locateParty);
  ensureEl("partyEditNote").addEventListener("click", editPartyNote);
  ensureEl("partyExport").addEventListener("click", exportInRange);
}

function updateInfo(): void {
  const party = getParty();
  const el = document.getElementById("partyInfo");
  if (!party || !el) return;

  const cell = party.cell;
  const stateName = pack.states[pack.cells.state[cell]]?.name || "Neutral";
  const cultureName = pack.cultures[pack.cells.culture[cell]]?.name || "—";
  const burgId = pack.cells.burg[cell];
  const burgName = burgId ? pack.burgs[burgId].name : "—";

  el.innerHTML = /* html */ `
    <div><b>State:</b> ${stateName}</div>
    <div><b>Culture:</b> ${cultureName}</div>
    <div><b>Burg:</b> ${burgName}</div>`;
}

function updateRangeButtons(): void {
  ensureEl("partyRangeButtons")
    .querySelectorAll<HTMLButtonElement>("button")
    .forEach(button => {
      button.classList.toggle("pressed", (button.dataset.range ?? "") === activeRange);
    });
}

function onRangeClick(event: MouseEvent): void {
  const button = (event.target as HTMLElement).closest("button");
  if (!button) return;
  applyRange((button.dataset.range ?? "") as RangeKey);
}

function onDailySpeedChange(this: HTMLInputElement): void {
  const value = Math.max(1, Math.round(+this.value) || DEFAULT_DAILY_SPEED);
  this.value = String(value);
  setDailySpeed(value);
  updateRangeLabels();
  if (activeRange) applyRange(activeRange); // recompute ring, filter, list and zoom for the new speed
}

// Refresh the daily/weekly/monthly button captions to the current daily speed.
function updateRangeLabels(): void {
  for (const { key, days } of RANGE_DAYS) {
    const button = document.querySelector<HTMLButtonElement>(`#partyRangeButtons button[data-range="${key}"]`);
    if (!button) continue;
    const dist = formatDistance(rangeDistance(days));
    const small = button.querySelector("small");
    if (small) small.textContent = dist;
    button.dataset.tip = `Zoom to a ${dist} radius around the party`;
  }
}

function applyRange(key: RangeKey): void {
  const party = getParty();
  if (!party) return;

  activeRange = key;
  updateRangeButtons();

  if (!key) {
    clearRangeView();
    return;
  }

  const range = RANGE_DAYS.find(r => r.key === key)!;
  const distance = rangeDistance(range.days);
  const radiusPx = radiusPxFor(distance, distanceScale);
  drawPartyRange(party.x, party.y, radiusPx, formatDistance(distance));

  // show only markers inside the ring (the party marker is at distance 0, so it always passes)
  const inRange = pack.markers.filter(marker => Math.hypot(marker.x - party.x, marker.y - party.y) <= radiusPx);
  setMarkersFilter(inRange.map(marker => marker.i));
  if (layerIsOn("toggleMarkers")) drawMarkers();
  renderMarkersList(inRange);

  zoomTo(party.x, party.y, fitZoom(radiusPx, svgWidth, svgHeight, zoomExtent()), 1600);
}

// Drop the ring, the marker filter and the in-range list, restoring every marker to the map.
function clearRangeView(): void {
  clearPartyRange();
  setMarkersFilter(null);
  if (layerIsOn("toggleMarkers")) drawMarkers();
  inRangeMarkers = [];
  ensureEl("partyMarkersList").innerHTML = "";
  ensureEl("partyMarkersHeader").style.display = "none";
}

// List the in-range markers (excluding the party marker itself) like a compact Markers Overview.
function renderMarkersList(inRange: Marker[]): void {
  inRangeMarkers = inRange.filter(marker => marker.type !== PARTY_LOCATION_TYPE);
  ensureEl("partyMarkersCount").textContent = String(inRangeMarkers.length);
  ensureEl("partyMarkersHeader").style.display = "";

  ensureEl("partyMarkersList").innerHTML = inRangeMarkers
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

  // default (locate): row body / target icon
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
  if (marker.protected) return;
  confirmationDialog({
    title: "Remove marker",
    message: "Are you sure you want to remove this marker? The action cannot be reverted",
    confirm: "Remove",
    onConfirm: () => {
      Markers.deleteMarker(marker.i);
      document.getElementById(`marker${marker.i}`)?.remove();
      refreshEditors(); // sync any open Markers Overview (and other editors) so the row disappears there too
      if (activeRange) applyRange(activeRange); // re-assert the party ring/filter/list last (wins the map filter)
    }
  });
}

// Export the in-range markers to CSV — same columns as the Markers Overview export.
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

  downloadFile(headers + body.join("\n"), `${getFileName("Party markers in range")}.csv`);
}

function toggleMoveHere(): void {
  toggleMapPlacement("partyMoveHere", onMoveClick, "Click on the map to move the party here", undefined, () =>
    document.getElementById("partyMoveHere")?.classList.remove("pressed")
  );
}

function onMoveClick(event: MouseEvent): void {
  const [x, y] = pointer(event, event.currentTarget as SVGGElement);
  const cell = findCell(x, y);
  if (cell === undefined) return;

  const party = getParty();
  if (!party) return;

  party.x = rn(x, 2);
  party.y = rn(y, 2);
  party.cell = cell;

  if (layerIsOn("toggleMarkers")) drawMarkers();
  if (activeRange) applyRange(activeRange); // ring follows the party
  updateInfo();

  stopMapPlacement();
  document.getElementById("partyMoveHere")?.classList.remove("pressed");
}

function locateParty(): void {
  const party = getParty();
  if (party) zoomTo(party.x, party.y, 8, 1600);
}

function editPartyNote(): void {
  const party = getParty();
  if (!party) return;
  const id = `marker${party.i}`;
  void Controllers.NotesEditor.open(id, id);
}

function closePartyLocation(): void {
  if (ensureEl("partyMoveHere").classList.contains("pressed")) stopMapPlacement();
  activeRange = "";
  clearRangeView(); // remove the ring + marker filter when the toolbar closes
  clearMainTip();
  $("#partyLocation").dialog("destroy");
  document.getElementById("partyLocation")?.remove();
}

export const PartyLocation = { open };
