import { select } from "d3";
import { closeDialogs, confirmationDialog, destroyDialog } from "@/components/dialog/dialog-helpers";
import { clearMainTip, tip } from "@/components/tooltips";
import { showDomDialog } from "@/components/ui/dom-dialog";
import "@/components/ui/map-feature-editor.css";
import { applyDefaultViewboxEvents } from "@/components/viewbox-events";
import { Controllers } from "@/controllers";
import { insertRiverPoint, moveRiverPoint, removeRiverPoint } from "@/controllers/editor-mutations";
import type { River } from "@/generators/river-generator";
import type { Point } from "@/generators/voronoi";
import {
  MAP_INTERACTION_HANDLE_EVENT,
  type MapInteractionHandleEventDetail
} from "@/renderers/interaction/map-interaction-overlay";
import { drawLabels } from "@/renderers/labels/labels-renderer";
import {
  clearMapInteractionOverlay,
  getPixiMapPointAtClient,
  invalidatePixiRendererLayer,
  pickPixiRenderer,
  updateMapInteractionOverlay
} from "@/renderers/pixi/pixi-renderer-controller";
import { speak } from "@/utils";
import { ensureEl, findEl, getSegmentId, rand, rn } from "../utils";

let selectedRiverId = 0;
let activePoint: { index: number; initialCell: number; initialPoint: Point } | null = null;

function open(riverId: number): void {
  if (customization) return;
  if (findEl("riverEditor") && riverId === selectedRiverId) return;
  closeDialogs(".stable");
  if (!window.LayerControls.isLayerOn("toggleRivers")) window.LayerControls.toggleLayer("toggleRivers");

  ensureEl("toggleCells").dataset.forced = String(+!window.LayerControls.isLayerOn("toggleCells"));
  if (!window.LayerControls.isLayerOn("toggleCells")) window.LayerControls.toggleLayer("toggleCells");

  const river = pack.rivers.find(candidate => candidate.i === riverId);
  if (!river) return;
  selectedRiverId = riverId;

  tip(
    "Drag control points to change the river course. Click on point to remove it. Click on river to add additional control point. For major changes please create a new river instead",
    true
  );
  select<SVGGElement, unknown>("#viewbox").style("cursor", "crosshair").on("click", addControlPoint);
  document.getElementById("map")?.addEventListener(MAP_INTERACTION_HANDLE_EVENT, editRiverPoint as EventListener);

  renderDialog();
  updateRiverData();

  const { cells, points } = river;
  const riverPoints = Rivers.getRiverPoints(cells, points ?? null);
  river.points = riverPoints;
  drawControlPoints(riverPoints);
  drawCells(cells);

  showDomDialog({
    content: ensureEl("riverEditor"),
    onClose: closeRiverEditor,
    placement: "top-right",
    placementTarget: document.getElementById("map"),
    resizable: false,
    title: "Edit River"
  });
}

function renderDialog(): void {
  destroyDialog("riverEditor");

  const html = /* html */ `<div id="riverEditor" class="dialog fantasia-map-feature-editor">
    <p class="fantasia-map-feature-editor__hint">Drag map handles to reshape the river. Click its line to add a point.</p>
    <section class="fantasia-map-feature-editor__section">
      <h3 class="fantasia-map-feature-editor__section-title">Identity</h3>
      <div class="fantasia-map-feature-editor__fields">
        <div class="fantasia-map-feature-editor__field fantasia-map-feature-editor__field--wide">
          <label for="riverName">Name</label>
          <div class="fantasia-map-feature-editor__control">
            <input id="riverName" data-tip="Type to rename the river" autocorrect="off" spellcheck="false" />
            <button id="riverNameCulture" aria-label="Generate culture-specific river name" data-tip="Generate culture-specific name for the river" class="fantasia-map-feature-editor__icon-button icon-book"></button>
            <button id="riverNameRandom" aria-label="Generate random river name" data-tip="Generate random name for the river" class="fantasia-map-feature-editor__icon-button icon-globe"></button>
            <button id="riverNameSpeak" aria-label="Speak river name" data-tip="Speak the name. You can change voice and language in options" class="fantasia-map-feature-editor__icon-button speaker">🔊</button>
          </div>
        </div>
        <div class="fantasia-map-feature-editor__field"><label for="riverType">Type</label><input id="riverType" data-tip="Change the river type, for example fork, creek, river, brook, or stream" autocorrect="off" spellcheck="false" /></div>
        <div class="fantasia-map-feature-editor__field"><label for="riverMainstem">Mainstem</label><select id="riverMainstem" data-tip="Select the river this waterway flows into"></select></div>
      </div>
    </section>
    <section class="fantasia-map-feature-editor__section">
      <h3 class="fantasia-map-feature-editor__section-title">Hydrology</h3>
      <div class="fantasia-map-feature-editor__fields">
        <div class="fantasia-map-feature-editor__field"><label for="riverBasin">Basin</label><input id="riverBasin" data-tip="River drainage basin (watershed)" disabled /></div>
        <div class="fantasia-map-feature-editor__field"><label for="riverDischarge">Discharge</label><input id="riverDischarge" data-tip="River discharge (flux power)" disabled /></div>
        <div class="fantasia-map-feature-editor__field"><label for="riverLength">Length</label><input id="riverLength" data-tip="River length in selected units" disabled /></div>
        <div class="fantasia-map-feature-editor__field"><label for="riverWidth">Mouth width</label><input id="riverWidth" data-tip="River mouth width in selected units" disabled /></div>
        <div class="fantasia-map-feature-editor__field"><label for="riverSourceWidth">Source width</label><input id="riverSourceWidth" data-tip="Additional width at the source. Default is 0" type="number" min="0" max="3" step=".01" /></div>
        <div class="fantasia-map-feature-editor__field"><label for="riverWidthFactor">Width modifier</label><input id="riverWidthFactor" data-tip="Multiplier for the river width. Default is 1" type="number" min=".1" max="4" step=".1" /></div>
      </div>
    </section>
    <footer class="fantasia-map-feature-editor__toolbar">
      <button id="riverCreateSelectingCells" data-tip="Create a new river by selecting river cells" class="fantasia-map-feature-editor__action icon-map-pin">New river</button>
      <button id="riverEditStyle" data-tip="Edit the style for all rivers" class="fantasia-map-feature-editor__action icon-brush">Style</button>
      <button id="riverElevationProfile" data-tip="Show the elevation profile for this river" class="fantasia-map-feature-editor__action icon-chart-area">Elevation</button>
      <button id="riverLegend" data-tip="Edit free-text notes for this river" class="fantasia-map-feature-editor__action icon-edit">Notes</button>
      <button id="riverRemove" data-tip="Remove this river and its tributaries" data-shortcut="Delete" class="fantasia-map-feature-editor__action fantasia-map-feature-editor__action--danger icon-trash fastDelete">Remove</button>
    </footer>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);

  // add listeners — dropped together with the dialog HTML on close
  ensureEl("riverCreateSelectingCells").addEventListener("click", openRiverCreator);
  ensureEl("riverEditStyle").addEventListener("click", openRiverStyle);
  ensureEl("riverElevationProfile").addEventListener("click", showRiverElevationProfile);
  ensureEl("riverLegend").addEventListener("click", editRiverLegend);
  ensureEl("riverRemove").addEventListener("click", removeRiver);
  ensureEl("riverName").addEventListener("input", changeName);
  ensureEl("riverNameSpeak").addEventListener("click", () => speak(ensureEl<HTMLInputElement>("riverName").value));
  ensureEl("riverType").addEventListener("input", changeType);
  ensureEl("riverNameCulture").addEventListener("click", generateNameCulture);
  ensureEl("riverNameRandom").addEventListener("click", generateNameRandom);
  ensureEl("riverMainstem").addEventListener("change", changeParent);
  ensureEl("riverSourceWidth").addEventListener("input", changeSourceWidth);
  ensureEl("riverWidthFactor").addEventListener("input", changeWidthFactor);
}

function openRiverCreator(): void {
  void Controllers.RiverCreator.open();
}

function openRiverStyle(): void {
  window.StyleEditor.edit("rivers");
}

function getRiver(): River {
  return pack.rivers.find((river: River) => river.i === selectedRiverId) as River;
}

function updateRiverData(): void {
  const r = getRiver();

  ensureEl<HTMLInputElement>("riverName").value = r.name;
  ensureEl<HTMLInputElement>("riverType").value = r.type;

  const parentSelect = ensureEl<HTMLSelectElement>("riverMainstem");
  parentSelect.options.length = 0;
  const parent = r.parent || r.i;
  const sortedRivers = pack.rivers.slice().sort((a: River, b: River) => (a.name > b.name ? 1 : -1));
  sortedRivers.forEach((river: River) => {
    const opt = new Option(river.name, String(river.i), false, river.i === parent);
    parentSelect.options.add(opt);
  });
  ensureEl<HTMLInputElement>("riverBasin").value = pack.rivers.find((river: River) => river.i === r.basin)!.name;

  ensureEl<HTMLInputElement>("riverDischarge").value = `${r.discharge} m³/s`;
  ensureEl<HTMLInputElement>("riverSourceWidth").value = String(r.sourceWidth);
  ensureEl<HTMLInputElement>("riverWidthFactor").value = String(r.widthFactor);

  updateRiverLength(r);
  updateRiverWidth(r);
}

function updateRiverLength(river: River): void {
  const anchors = river.points?.length === river.cells.length ? river.points : undefined;
  const meanderedPoints = Rivers.addMeandering(river.cells, anchors);
  river.length = Rivers.getApproximateLength(meanderedPoints.map(([x, y]) => [x, y]));
  const lengthUI = `${rn(river.length * distanceScale)} ${distanceUnitInput.value}`;
  ensureEl<HTMLInputElement>("riverLength").value = lengthUI;
}

function updateRiverWidth(river: River): void {
  const { cells, discharge, widthFactor, sourceWidth } = river;
  const meanderedPoints = Rivers.addMeandering(cells);
  river.width = Rivers.getWidth(
    Rivers.getOffset({
      flux: discharge,
      pointIndex: meanderedPoints.length,
      widthFactor,
      startingWidth: sourceWidth
    })
  );

  const width = `${rn(river.width * distanceScale, 3)} ${distanceUnitInput.value}`;
  ensureEl<HTMLInputElement>("riverWidth").value = width;
}

function drawControlPoints(points: Point[]): void {
  renderRiverOverlay(points);
}

function drawCells(cells: number[]): void {
  renderRiverOverlay(getRiver().points ?? Rivers.getRiverPoints(cells, null));
}

function redrawRiver(renderOverlay = true): void {
  const river = getRiver();
  river.points ??= Rivers.getRiverPoints(river.cells, null);
  river.cells = river.points.map(([x, y]) => findCell(x, y)!);

  invalidatePixiRendererLayer("rivers");

  updateRiverLength(river);
  drawLabels();
  if (findEl("elevationProfile")) showRiverElevationProfile();
  if (renderOverlay) renderRiverOverlay(river.points);
}

function addControlPoint(event: MouseEvent): void {
  const hit = pickPixiRenderer(event.clientX, event.clientY);
  if (hit?.domainKind !== "river" || Number(hit.domainId) !== selectedRiverId) return;
  const mapPoint = getPixiMapPointAtClient(event.clientX, event.clientY);
  if (!mapPoint) return;
  const { x, y } = mapPoint;
  const point: Point = [rn(x, 1), rn(y, 1)];

  const river = getRiver();
  river.points ??= Rivers.getRiverPoints(river.cells, null);

  const index = getSegmentId(river.points, point, 2);
  const cellId = findCell(point[0], point[1]);
  if (cellId === undefined || !insertRiverPoint(river, index, point, cellId).changed) return;
  drawControlPoints(river.points);
  redrawRiver();
}

function removeControlPoint(index: number): void {
  const river = getRiver();
  if (!river.points || river.points.length <= 2) return;
  const point = river.points[index];
  if (!point) return;
  const cellId = findCell(point[0], point[1]);
  if (cellId === undefined || !removeRiverPoint(river, index, cellId).changed) return;
  redrawRiver();

  drawCells(river.cells);
}

function changeName(this: HTMLInputElement): void {
  getRiver().name = this.value;
}

function changeType(this: HTMLInputElement): void {
  getRiver().type = this.value;
}

function generateNameCulture(): void {
  const r = getRiver();
  r.name = ensureEl<HTMLInputElement>("riverName").value = Rivers.getName(r.mouth);
}

function generateNameRandom(): void {
  const r = getRiver();
  if (r) r.name = ensureEl<HTMLInputElement>("riverName").value = Names.getBase(rand(Names.nameBases.length - 1));
}

function changeParent(this: HTMLInputElement): void {
  const r = getRiver();
  r.parent = +this.value;
  r.basin = pack.rivers.find((river: River) => river.i === r.parent)!.basin;
  ensureEl<HTMLInputElement>("riverBasin").value = pack.rivers.find((river: River) => river.i === r.basin)!.name;
}

function changeSourceWidth(this: HTMLInputElement): void {
  const river = getRiver();
  river.sourceWidth = +this.value;
  updateRiverWidth(river);
  redrawRiver();
}

function changeWidthFactor(this: HTMLInputElement): void {
  const river = getRiver();
  river.widthFactor = +this.value;
  updateRiverWidth(river);
  redrawRiver();
}

function showRiverElevationProfile(): void {
  const river = getRiver();
  const points = (river.points ?? Rivers.getRiverPoints(river.cells, null)).map(([x, y]) => findCell(x, y)!);
  const riverLen = rn(river.length * distanceScale);
  void Controllers.ElevationProfile.open(points, riverLen, true);
}

function editRiverLegend(): void {
  const river = getRiver();
  void Controllers.NotesEditor.open(`river${river.i}`, `${river.name} ${river.type}`);
}

function removeRiver(): void {
  confirmationDialog({
    confirm: "Remove",
    message: "Are you sure you want to remove the river and all its tributaries",
    onConfirm: () => {
      Rivers.remove(selectedRiverId);
      invalidatePixiRendererLayer("rivers");
      closeRiverEditor();
    },
    title: "Remove river and tributaries"
  });
}

function closeRiverEditor(): void {
  document.getElementById("map")?.removeEventListener(MAP_INTERACTION_HANDLE_EVENT, editRiverPoint as EventListener);
  clearMapInteractionOverlay();
  applyDefaultViewboxEvents();
  activePoint = null;
  selectedRiverId = 0;
  clearMainTip();

  const forced = +ensureEl("toggleCells").dataset.forced!;
  ensureEl("toggleCells").dataset.forced = "0";
  if (forced && window.LayerControls.isLayerOn("toggleCells")) window.LayerControls.toggleLayer("toggleCells");

  destroyDialog("riverEditor");
}

function editRiverPoint(event: CustomEvent<MapInteractionHandleEventDetail>): void {
  const serializedId = String(event.detail.handleId);
  if (!serializedId.startsWith("river-point:")) return;
  const index = Number(serializedId.split(":")[1]);
  const river = getRiver();
  river.points ??= Rivers.getRiverPoints(river.cells, null);
  const point = river.points[index];
  if (!point) return;

  if (event.detail.phase === "activate") {
    removeControlPoint(index);
    return;
  }
  if (event.detail.phase === "start") {
    activePoint = { index, initialCell: findCell(point[0], point[1])!, initialPoint: [...point] };
    return;
  }
  if (event.detail.phase === "cancel") {
    if (activePoint?.index === index) {
      moveRiverPoint(
        river,
        index,
        [...activePoint.initialPoint],
        findCell(point[0], point[1])!,
        activePoint.initialCell
      );
      activePoint = null;
      redrawRiver();
    }
    return;
  }
  if (event.detail.phase === "move") {
    const nextPoint: Point = [rn(event.detail.worldPoint.x, 1), rn(event.detail.worldPoint.y, 1)];
    const nextCell = findCell(nextPoint[0], nextPoint[1]);
    if (nextCell === undefined) return;
    moveRiverPoint(river, index, nextPoint, findCell(point[0], point[1])!, nextCell);
    redrawRiver(false);
    return;
  }
  if (event.detail.phase !== "end" || activePoint?.index !== index) return;

  const moved = Math.hypot(point[0] - activePoint.initialPoint[0], point[1] - activePoint.initialPoint[1]) > 0.01;
  if (!moved) {
    activePoint = null;
    removeControlPoint(index);
    return;
  }

  const movedToCell = findCell(point[0], point[1]);
  if (movedToCell !== undefined && movedToCell !== activePoint.initialCell && !pack.cells.r[movedToCell]) {
    pack.cells.r[activePoint.initialCell] = 0;
    pack.cells.r[movedToCell] = river.i;
    const sourceFlux = pack.cells.fl[activePoint.initialCell];
    pack.cells.fl[activePoint.initialCell] = pack.cells.fl[movedToCell];
    pack.cells.fl[movedToCell] = sourceFlux;
    redrawRiver(false);
  }
  activePoint = null;
  queueMicrotask(() => renderRiverOverlay(river.points ?? []));
}

function renderRiverOverlay(points: readonly Point[]): void {
  const cells = [
    ...new Set(points.map(([x, y]) => findCell(x, y)).filter((cell): cell is number => cell !== undefined))
  ];
  updateMapInteractionOverlay({
    handles: points.map(([x, y], index) => ({
      id: `river-point:${index}`,
      label: `Edit river point ${index + 1}`,
      point: { x, y }
    })),
    selection: [
      { kind: "polyline", points: points.map(([x, y]) => ({ x, y })) },
      ...cells.map(cellId => ({
        kind: "polygon" as const,
        points: pack.cells.v[cellId].map(vertexId => {
          const [x, y] = pack.vertices.p[vertexId];
          return { x, y };
        })
      }))
    ]
  });
}

export const RiverEditor = { open };
