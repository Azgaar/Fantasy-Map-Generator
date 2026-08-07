import { closeDialogs, confirmationDialog } from "@/components/dialog/dialog-helpers";
import { applySorting, applySortingByHeader } from "@/components/dialog/sorting";
import { clearMainTip } from "@/components/tooltips";
import { applyDefaultViewboxEvents } from "@/components/viewbox-events";
import { Controllers } from "@/controllers";
import type { Marker } from "@/generators/markers-generator";
import { drawMarkers, setMarkersFilter } from "@/renderers/draw-markers";
import { highlightElement } from "@/renderers/overlays/highlight";
import { downloadFile, getFileName, getLatitude, getLongitude } from "@/utils";
import { ensureEl } from "../utils";

function open(): void {
  if (customization) return;
  closeDialogs("#markersOverview, .stable");
  if (!layerIsOn("toggleMarkers")) toggleMarkers();

  renderDialog();
  addLines();

  $("#markersOverview").dialog({
    title: "Markers Overview",
    resizable: false,
    width: "fit-content",
    close: closeMarkersOverview,
    position: { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" }
  });
}

function renderDialog(): void {
  document.getElementById("markersOverview")?.remove();

  const html = /* html */ `
    <div id="markersOverview" class="dialog stable">
      <div id="markersHeader" class="header" style="grid-template-columns: 15em 1em 3em">
        <div data-tip="Click to sort by marker type" class="sortable alphabetically" data-sortby="type">Type&nbsp;</div>
        <div
          id="markersInverPin"
          style="color: #6e5e66"
          data-tip="Click to invert pin state for all markers"
          class="icon-pin pointer"
        ></div>
        <div
          id="markersInverLock"
          style="color: #6e5e66"
          data-tip="Click to invert lock state for all markers"
          class="icon-lock pointer"
        ></div>
      </div>
      <div id="markersBody" class="table"></div>
      <div id="markersFilters" style="display:flex; gap:.2em; padding:0.5em 0; flex-direction:column; font-size:smaller">
        <select id="markersFilterState" data-tip="Show only markers located in the selected state"></select>
        <select id="markersFilterCulture" data-tip="Show only markers located in the selected culture"></select>
        <select id="markersFilterType" data-tip="Show only markers of the selected type"></select>
        <label for="markersSearch" data-tip="Filter by type">Search: <input id="markersSearch" type="search" /></label>
      </div>
      <div id="markersFooter" class="totalLine">
        <div data-tip="Markers number">
          Markers: <span id="markersFooterNumber">0</span> of <span id="markersFooterTotal">0</span>
        </div>
      </div>
      <div id="markersBottom">
        <button id="markersOverviewRefresh" data-tip="Refresh the Overview screen" class="icon-cw"></button>
        <button id="markersRegenerate" data-tip="Regenerate unlocked markers" class="icon-shuffle"></button>
        <span id="markerTypeSelectorWrapper">
          <button id="markerTypeSelector" data-tip="Select marker type for newly added markers.">❓</button>
          <div id="markerTypeSelectMenu"></div>
        </span>
        <button
          id="markersAddFromOverview"
          data-tip="Add a new marker. Hold Shift to add multiple"
          class="icon-plus"
        ></button>
        <button id="markersGenerationConfig" data-tip="Config markers generation options" class="icon-cog"></button>
        <button id="markersRemoveAll" data-tip="Remove all unlocked markers" class="icon-trash"></button>
        <button id="markersExport" data-tip="Save markers data as a text file (.csv)" class="icon-download"></button>
      </div>
    </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);
  applySortingByHeader("markersHeader");

  ensureEl("markersBody").addEventListener("click", handleLineClick);
  ensureEl("markersInverPin").addEventListener("click", invertPin);
  ensureEl("markersInverLock").addEventListener("click", invertLock);
  ensureEl("markersOverviewRefresh").addEventListener("click", addLines);
  ensureEl("markersRegenerate").addEventListener("click", regenerateMarkers);
  ensureEl("markerTypeSelector").addEventListener("click", toggleMarkerTypeMenu);
  ensureEl("markersAddFromOverview").addEventListener("click", () => void Controllers.MarkerCreator.toggle());
  ensureEl("markersGenerationConfig").addEventListener("click", () => void Controllers.MarkersSettings.open());
  ensureEl("markersRemoveAll").addEventListener("click", triggerRemoveAll);
  ensureEl("markersExport").addEventListener("click", exportMarkers);
  ensureEl("markersSearch").addEventListener("input", addLines);
  ensureEl("markersFilterState").addEventListener("change", addLines);
  ensureEl("markersFilterCulture").addEventListener("change", addLines);
  ensureEl("markersFilterType").addEventListener("change", addLines);

  populateMarkerTypeMenu();
  populateFilters();
}

// remembered filter selections, kept out of the DOM so they survive the dialog being rebuilt on each open
const filterState = { search: "", state: "", culture: "", type: "" };

// fill a <select> with a leading placeholder option, restoring `selected` when that option still exists
function fillSelect(
  select: HTMLSelectElement,
  placeholder: string,
  options: { value: string; label: string }[],
  selected = ""
): void {
  select.innerHTML = "";
  select.add(new Option(placeholder, ""));
  for (const { value, label } of options) select.add(new Option(label, value));
  if (selected && options.some(option => option.value === selected)) select.value = selected;
}

// populate the state / culture / type filter dropdowns from current pack data
function populateFilters(): void {
  const states = pack.states
    .filter(state => !state.removed)
    .map(state => ({ value: String(state.i), label: state.fullName || state.name }));
  fillSelect(ensureEl<HTMLSelectElement>("markersFilterState"), "All states", states, filterState.state);

  const cultures = pack.cultures
    .filter(culture => !culture.removed)
    .map(culture => ({ value: String(culture.i), label: culture.name }));
  fillSelect(ensureEl<HTMLSelectElement>("markersFilterCulture"), "All cultures", cultures, filterState.culture);

  const types = [...new Set(pack.markers.map(marker => marker.type))]
    .sort()
    .map(type => ({ value: type, label: type }));
  fillSelect(ensureEl<HTMLSelectElement>("markersFilterType"), "All types", types, filterState.type);

  ensureEl<HTMLInputElement>("markersSearch").value = filterState.search;
}

function closeMarkersOverview(): void {
  document.getElementById("addMarker")?.classList.remove("pressed");
  document.getElementById("markerAdd")?.classList.remove("pressed");
  applyDefaultViewboxEvents();
  clearMainTip();

  $("#markersOverview").dialog("destroy");
  ensureEl("markersOverview").remove();
}

function regenerateMarkers(): void {
  Markers.regenerate();
  if (layerIsOn("toggleMarkers")) drawMarkers();
  populateFilters();
  addLines();
}

function populateMarkerTypeMenu(): void {
  const menu = ensureEl("markerTypeSelectMenu");
  menu.innerHTML = "";

  const types = [{ type: "empty", icon: "❓" }, ...Markers.getConfig()];
  types.forEach(({ icon, type }) => {
    const option = document.createElement("button");
    option.textContent = `${icon} ${type}`;
    menu.appendChild(option);

    option.addEventListener("click", () => {
      ensureEl("markerTypeSelector").textContent = icon;
      ensureEl<HTMLInputElement>("addedMarkerType").value = type;
      changeMarkerType();
      toggleMarkerTypeMenu();
    });
  });
}

function handleLineClick(ev: MouseEvent): void {
  const el = ev.target as HTMLElement;
  const i = +(el.parentNode as HTMLElement).dataset.id!;

  if (el.classList.contains("icon-pencil")) return void openEditor(i);
  if (el.classList.contains("icon-target")) return void highlightMarker(i);
  if (el.classList.contains("icon-pin")) return void pinMarker(el, i);
  if (el.classList.contains("locks")) return void toggleLockStatus(el, i);
  if (el.classList.contains("icon-trash-empty")) return void triggerRemove(i);
}

function addLines(): void {
  let markers: Marker[] = pack.markers;

  const searchRaw = ensureEl<HTMLInputElement>("markersSearch").value;
  const stateFilter = ensureEl<HTMLSelectElement>("markersFilterState").value;
  const cultureFilter = ensureEl<HTMLSelectElement>("markersFilterCulture").value;
  const typeFilter = ensureEl<HTMLSelectElement>("markersFilterType").value;

  // remember selections so they persist across dialog close/reopen until the user changes them
  filterState.search = searchRaw;
  filterState.state = stateFilter;
  filterState.culture = cultureFilter;
  filterState.type = typeFilter;

  const searchText = searchRaw.toLowerCase().trim();
  if (searchText) {
    markers = markers.filter(marker => {
      const type = (marker.type || "").toLowerCase();
      return type.includes(searchText);
    });
  }

  if (stateFilter !== "") {
    const stateId = +stateFilter;
    markers = markers.filter(marker => pack.cells.state[marker.cell] === stateId);
  }

  if (cultureFilter !== "") {
    const cultureId = +cultureFilter;
    markers = markers.filter(marker => pack.cells.culture[marker.cell] === cultureId);
  }

  if (typeFilter !== "") {
    markers = markers.filter(marker => marker.type === typeFilter);
  }

  const anyFilterActive = Boolean(searchText) || stateFilter !== "" || cultureFilter !== "" || typeFilter !== "";
  syncMapToFilter(markers, anyFilterActive);

  const lines = markers
    .map(({ i, type, icon, pinned, lock }) => {
      return /* html */ `
        <div class="states" data-id=${i} data-type="${type}">
          ${
            icon.startsWith("http") || icon.startsWith("data:image")
              ? `<img src="${icon}" data-tip="Marker icon" style="width:1.2em; height:1.2em; vertical-align: middle;">`
              : `<span data-tip="Marker icon" style="width:1.2em">${icon}</span>`
          }
          <div data-tip="Marker type" style="width:10em">${type}</div>
          <span style="padding-right:.1em" data-tip="Edit marker" class="icon-pencil"></span>
          <span style="padding-right:.1em" data-tip="Locate the marker" class="icon-target"></span>
          <span style="padding-right:.1em" data-tip="Pin marker (display only pinned markers)" class="icon-pin ${
            pinned ? "" : "inactive"
          }" pointer"></span>
          <span style="padding-right:.1em" class="locks pointer ${
            lock ? "icon-lock" : "icon-lock-open inactive"
          }" onmouseover="showElementLockTip(event)"></span>
          <span data-tip="Remove marker" class="icon-trash-empty"></span>
        </div>`;
    })
    .join("");

  const body = ensureEl("markersBody");
  body.innerHTML = lines;
  ensureEl("markersFooterNumber").innerText = String(markers.length);
  ensureEl("markersFooterTotal").innerText = String(pack.markers.length);

  applySorting(ensureEl("markersHeader"));
}

// last filter set pushed to the renderer, so we only redraw the map when the visible set actually changes
let lastFilterSignature = "";

// mirror the overview filter onto the map: render only matching markers, or all markers when no filter is active
function syncMapToFilter(filteredMarkers: Marker[], anyFilterActive: boolean): void {
  const ids = anyFilterActive ? filteredMarkers.map(marker => marker.i) : null;
  const signature = ids ? ids.join(",") : "";
  if (signature === lastFilterSignature) return;
  lastFilterSignature = signature;

  setMarkersFilter(ids);
  if (layerIsOn("toggleMarkers")) drawMarkers();
}

function invertPin(): void {
  let anyPinned = false;

  pack.markers.forEach(marker => {
    const pinned = !marker.pinned;
    if (pinned) {
      marker.pinned = true;
      anyPinned = true;
    } else delete marker.pinned;
  });

  ensureEl("markers").setAttribute("pinned", anyPinned ? "1" : "");
  drawMarkers();
  addLines();
}

function invertLock(): void {
  pack.markers = pack.markers.map(marker => ({ ...marker, lock: !marker.lock }));
  addLines();
}

function openEditor(i: number): void {
  const marker = pack.markers.find(marker => marker.i === i);
  if (!marker) return;

  const { x, y } = marker;
  zoomTo(x, y, 8, 2000);
  void Controllers.MarkersEditor.open(i);
}

function highlightMarker(i: number): void {
  const marker = document.getElementById(`marker${i}`);
  if (!marker) return;
  highlightElement(marker, 2);
}

function pinMarker(el: HTMLElement, i: number): void {
  const marker = pack.markers.find(marker => marker.i === i);
  if (!marker) return;

  const markerGroup = ensureEl("markers");
  if (marker.pinned) {
    delete marker.pinned;
    const anyPinned = pack.markers.some(marker => marker.pinned);
    if (!anyPinned) markerGroup.removeAttribute("pinned");
  } else {
    marker.pinned = true;
    markerGroup.setAttribute("pinned", "1");
  }
  el.classList.toggle("inactive");
  drawMarkers();
}

function toggleLockStatus(el: HTMLElement, i: number): void {
  const marker = pack.markers.find(marker => marker.i === i);
  if (!marker) return;

  if (marker.lock) {
    delete marker.lock;
    el.className = "locks pointer icon-lock-open inactive";
  } else {
    marker.lock = true;
    el.className = "locks pointer icon-lock";
  }
}

function triggerRemove(i: number): void {
  confirmationDialog({
    title: "Remove marker",
    message: "Are you sure you want to remove this marker? The action cannot be reverted",
    confirm: "Remove",
    onConfirm: () => removeMarker(i)
  });
}

function toggleMarkerTypeMenu(): void {
  ensureEl("markerTypeSelectMenu").classList.toggle("visible");
}

function toggleAddMarker(): void {
  void Controllers.MarkerCreator.toggle();
}

function changeMarkerType(): void {
  if (!ensureEl("markersAddFromOverview").classList.contains("pressed")) toggleAddMarker();
}

function removeMarker(i: number): void {
  notes = notes.filter(note => note.id !== `marker${i}`);
  pack.markers = pack.markers.filter(marker => marker.i !== i);
  document.getElementById(`marker${i}`)?.remove();
  addLines();
}

function triggerRemoveAll(): void {
  confirmationDialog({
    title: "Remove all markers",
    message: "Are you sure you want to remove all non-locked markers? The action cannot be reverted",
    confirm: "Remove all",
    onConfirm: removeAllMarkers
  });
}

function removeAllMarkers(): void {
  pack.markers = pack.markers.filter(({ i, lock }) => {
    if (lock) return true;

    const id = `marker${i}`;
    document.getElementById(id)?.remove();
    notes = notes.filter(note => note.id !== id);
    return false;
  });

  addLines();
}

function exportMarkers(): void {
  const headers = "Id,Type,Icon,Name,Note,State,Culture,X,Y,Latitude,Longitude\n";
  const quote = (s: string) => `"${s.replaceAll('"', '""')}"`;

  const body = pack.markers.map(marker => {
    const { i, type, icon, x, y, cell } = marker;

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

  const data = headers + body.join("\n");
  const fileName = `${getFileName("Markers")}.csv`;
  downloadFile(data, fileName);
}

export const MarkersOverview = { open };
