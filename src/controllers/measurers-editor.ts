import { closeDialogs, confirmationDialog, destroyDialog } from "@/components/dialog/dialog-helpers";
import { clearMainTip, tip } from "@/components/tooltips";
import { showDomDialog } from "@/components/ui/dom-dialog";
import { applyDefaultViewboxEvents } from "@/components/viewbox-events";
import {
  insertMeasurerPoint,
  moveMeasurerPoint,
  removeMeasurerPoint,
  replaceMeasurerPoints
} from "@/controllers/editor-mutations";
import { ensureMeasurerIds, type Measurer, Measurers, type MeasurerType } from "@/generators/measurers-generator";
import type { Point } from "@/generators/voronoi";
import { drawMeasurers, undrawMeasurers } from "@/renderers/draw-measurers";
import {
  MAP_INTERACTION_HANDLE_EVENT,
  type MapInteractionHandleEventDetail
} from "@/renderers/interaction/map-interaction-overlay";
import {
  clearMapInteractionOverlay,
  getPixiMapPointAtClient,
  updateMapInteractionOverlay
} from "@/renderers/pixi/pixi-renderer-controller";
import { ensureEl, getArea, getAreaUnit, getSegmentId, last, rn, si } from "../utils";

type DrawingType = Exclude<MeasurerType, "Ruler">;
type ActiveHandle = {
  initialPoints: Point[];
  kind: "point" | "translate";
  pointIndex?: number;
  startPoint?: Point;
};

let selectedMeasurerId: number | null = null;
let activeHandle: ActiveHandle | null = null;
let drawingType: DrawingType | null = null;
let drawingPointerId: number | null = null;
let drawingMeasurer: Measurer | null = null;

function open(): void {
  if (customization) return;
  closeDialogs("#measurersEditor, .stable");
  if (!window.LayerControls.isLayerOn("toggleRulers")) window.LayerControls.toggleLayer("toggleRulers");
  ensureMeasurerIds(pack.measurers);
  selectedMeasurerId ??= pack.measurers[0]?.i ?? null;

  renderDialog();
  document.getElementById("map")?.addEventListener(MAP_INTERACTION_HANDLE_EVENT, editMeasurerHandle as EventListener);
  document.getElementById("viewbox")?.addEventListener("click", insertRulerPointOnClick, true);
  redraw();

  showDomDialog({
    content: ensureEl("measurersEditor"),
    onClose,
    placement: "top-right",
    placementTarget: document.getElementById("map"),
    resizable: false,
    title: "Measurers Editor",
    width: "fit-content"
  });
}

function renderDialog(): void {
  destroyDialog("measurersEditor");
  ensureEl("dialogs").insertAdjacentHTML(
    "beforeend",
    /* html */ `<div id="measurersEditor" class="dialog">
      <div id="measurersBody" class="table" style="margin-bottom: 0.3em"></div>
      <div id="measurersBottom">
        <button id="addLinearRuler" data-tip="Click to place a linear measurer (ruler)" class="icon-ruler"></button>
        <button id="addOpisometer" data-tip="Draw to measure a curve length (opisometer)" class="icon-drafting-compass"></button>
        <button id="addRouteOpisometer" data-tip="Draw a curve length that sticks to routes">
          <svg width="0.88em" height="0.88em"><use xlink:href="#icon-route" /></svg>
        </button>
        <button id="addPlanimeter" data-tip="Draw a polygon area (planimeter)" class="icon-draw-polygon"></button>
        <button id="removeMeasurers" data-tip="Remove all measurers from the map" class="icon-trash"></button>
      </div>
    </div>`
  );
  ensureEl("measurersBody").addEventListener("click", onListClick);
  ensureEl("addLinearRuler").addEventListener("click", addRuler);
  ensureEl("addOpisometer").addEventListener("click", () => toggleDrawingMode("Opisometer"));
  ensureEl("addRouteOpisometer").addEventListener("click", () => toggleDrawingMode("RouteOpisometer"));
  ensureEl("addPlanimeter").addEventListener("click", () => toggleDrawingMode("Planimeter"));
  ensureEl("removeMeasurers").addEventListener("click", removeAllMeasurers);
}

function redraw(updateList = true): void {
  drawMeasurers();
  if (updateList) {
    ensureEl("measurersBody").innerHTML = pack.measurers
      .map(
        measurer => /* html */ `<div class="states${measurer.i === selectedMeasurerId ? " selected" : ""}" data-id="${measurer.i}" style="display:flex;align-items:center;gap:.4em;padding:1px .2em">
          <div style="width:9em">${measurer.type}</div>
          <div style="width:6em">${getMeasurerValue(measurer)}</div>
          <span data-tip="Zoom to the measurer" data-zoom class="icon-dot-circled pointer"></span>
          <span data-tip="Remove the measurer" data-remove class="icon-trash-empty pointer"></span>
        </div>`
      )
      .join("");
  }
  renderMeasurerOverlay();
}

function onListClick(event: Event): void {
  const target = event.target as HTMLElement;
  const row = target.closest<HTMLElement>("[data-id]");
  if (!row) return;
  const id = Number(row.dataset.id);
  const measurer = getMeasurer(id);
  if (!measurer) return;

  if (target.matches("[data-remove]")) {
    Measurers.remove(measurer);
    selectedMeasurerId = pack.measurers[0]?.i ?? null;
    redraw();
    return;
  }
  selectedMeasurerId = id;
  if (target.matches("[data-zoom]")) {
    const [x, y] = measurer.points[Math.floor(measurer.points.length / 2)];
    zoomTo(x, y, scale, 800);
    updateMapInteractionOverlay({ highlight: [{ kind: "polyline", points: toScreenPoints(measurer.points) }] });
  }
  redraw();
}

function removeAllMeasurers(): void {
  if (!pack.measurers.length) return;
  confirmationDialog({
    confirm: "Remove",
    message: /* html */ `Are you sure you want to remove all placed measurers?
      <br />If you just want to hide them, toggle the Rulers layer off in Menu`,
    onConfirm: () => {
      pack.measurers = [];
      selectedMeasurerId = null;
      redraw();
    },
    title: "Remove all measurers"
  });
}

function addRuler(): void {
  const map = ensureEl("map");
  const bounds = map.getBoundingClientRect();
  const center = getPixiMapPointAtClient(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
  if (!center) return;
  const dx = Math.min(graphWidth / 4, 100 / scale);
  const ruler = Measurers.create("Ruler", [
    [rn(Math.max(0, center.x - dx), 1), rn(center.y, 1)],
    [rn(Math.min(graphWidth, center.x + dx), 1), rn(center.y, 1)]
  ]);
  selectedMeasurerId = ruler.i!;
  redraw();
}

function addRulerAt(point: Point): void {
  open();
  const dx = Math.min(graphWidth / 4, 100 / scale);
  const endX = point[0] + dx <= graphWidth ? point[0] + dx : point[0] - dx;
  const ruler = Measurers.create("Ruler", [
    [rn(point[0], 1), rn(point[1], 1)],
    [rn(endX, 1), rn(point[1], 1)]
  ]);
  selectedMeasurerId = ruler.i!;
  redraw();
}

function toggleDrawingMode(type: DrawingType): void {
  if (drawingType === type) {
    exitDrawingMode();
    return;
  }
  exitDrawingMode();
  drawingType = type;
  const buttonId = {
    Opisometer: "addOpisometer",
    Planimeter: "addPlanimeter",
    RouteOpisometer: "addRouteOpisometer"
  }[type];
  ensureEl(buttonId).classList.add("pressed");
  const viewbox = ensureEl("viewbox");
  viewbox.style.cursor = "crosshair";
  viewbox.addEventListener("pointerdown", startDrawing, true);
  tip(
    type === "RouteOpisometer"
      ? "Draw along routes to measure length. Hold Shift to measure away from roads"
      : `Draw a ${type === "Planimeter" ? "polygon" : "curve"}. Hold Shift to keep all sampled points`,
    true
  );
}

function startDrawing(event: PointerEvent): void {
  if (!drawingType || event.button !== 0 || !event.isPrimary) return;
  const point = getPixiMapPointAtClient(event.clientX, event.clientY);
  if (!point) return;
  let startPoint: Point = [rn(point.x, 1), rn(point.y, 1)];
  if (drawingType === "RouteOpisometer" && !event.shiftKey) {
    const cell = findCell(point.x, point.y);
    if (cell === undefined || !Routes.isConnected(cell)) {
      tip("Must start in a cell with a route in it", false, "error");
      exitDrawingMode();
      return;
    }
    startPoint = getCellCoord(cell);
  }

  event.preventDefault();
  event.stopImmediatePropagation();
  drawingPointerId = event.pointerId;
  drawingMeasurer = Measurers.create(drawingType, [startPoint]);
  selectedMeasurerId = drawingMeasurer.i!;
  const viewbox = ensureEl("viewbox");
  viewbox.setPointerCapture(event.pointerId);
  viewbox.addEventListener("pointermove", continueDrawing, true);
  viewbox.addEventListener("pointerup", finishDrawing, true);
  viewbox.addEventListener("pointercancel", cancelDrawing, true);
  redraw();
}

function continueDrawing(event: PointerEvent): void {
  if (!drawingMeasurer || event.pointerId !== drawingPointerId) return;
  const world = getPixiMapPointAtClient(event.clientX, event.clientY);
  if (!world) return;
  if (drawingMeasurer.type === "RouteOpisometer" && !event.shiftKey) {
    const cell = findCell(world.x, world.y);
    if (cell !== undefined && Routes.isConnected(cell)) trackCell(drawingMeasurer, cell);
  } else addSampledPoint(drawingMeasurer, [world.x, world.y], event.shiftKey);
  event.preventDefault();
  event.stopImmediatePropagation();
  redraw(false);
}

function finishDrawing(event: PointerEvent): void {
  if (!drawingMeasurer || event.pointerId !== drawingPointerId) return;
  const measurer = drawingMeasurer;
  releaseDrawingPointer(event.pointerId);
  const minPoints = measurer.type === "Planimeter" ? 3 : 2;
  if (measurer.points.length < minPoints) {
    Measurers.remove(measurer);
    selectedMeasurerId = pack.measurers[0]?.i ?? null;
  } else if (!event.shiftKey) optimizePoints(measurer);
  exitDrawingMode();
  redraw();
}

function cancelDrawing(event: PointerEvent): void {
  if (!drawingMeasurer || event.pointerId !== drawingPointerId) return;
  Measurers.remove(drawingMeasurer);
  selectedMeasurerId = pack.measurers[0]?.i ?? null;
  releaseDrawingPointer(event.pointerId);
  exitDrawingMode();
  redraw();
}

function releaseDrawingPointer(pointerId: number): void {
  const viewbox = ensureEl("viewbox");
  if (viewbox.hasPointerCapture(pointerId)) viewbox.releasePointerCapture(pointerId);
  viewbox.removeEventListener("pointermove", continueDrawing, true);
  viewbox.removeEventListener("pointerup", finishDrawing, true);
  viewbox.removeEventListener("pointercancel", cancelDrawing, true);
  drawingPointerId = null;
  drawingMeasurer = null;
}

function exitDrawingMode(): void {
  const viewbox = document.getElementById("viewbox");
  viewbox?.removeEventListener("pointerdown", startDrawing, true);
  if (drawingPointerId !== null && viewbox) releaseDrawingPointer(drawingPointerId);
  drawingType = null;
  clearMainTip();
  document.querySelectorAll("#measurersBottom .pressed").forEach(button => {
    button.classList.remove("pressed");
  });
  applyDefaultViewboxEvents();
}

function editMeasurerHandle(event: CustomEvent<MapInteractionHandleEventDetail>): void {
  const parts = String(event.detail.handleId).split(":");
  if (parts[0] !== "measurer") return;
  const measurer = getMeasurer(Number(parts[1]));
  if (!measurer || measurer.i !== selectedMeasurerId) return;
  const kind = parts[2];

  if (event.detail.phase === "activate" && kind === "point") {
    const index = Number(parts[3]);
    const minPoints = measurer.type === "Planimeter" ? 3 : 2;
    if (removeMeasurerPoint(measurer, index, minPoints).changed) redraw();
    return;
  }
  if (event.detail.phase === "start") {
    activeHandle = {
      initialPoints: measurer.points.map(point => [...point]),
      kind: kind === "translate" ? "translate" : "point",
      pointIndex: kind === "point" ? Number(parts[3]) : undefined,
      startPoint: [event.detail.worldPoint.x, event.detail.worldPoint.y]
    };
    return;
  }
  if (event.detail.phase === "cancel") {
    if (activeHandle) replaceMeasurerPoints(measurer, activeHandle.initialPoints);
    activeHandle = null;
    redraw();
    return;
  }
  if (event.detail.phase === "move" && activeHandle) {
    if (activeHandle.kind === "translate") {
      const dx = event.detail.worldPoint.x - activeHandle.startPoint![0];
      const dy = event.detail.worldPoint.y - activeHandle.startPoint![1];
      replaceMeasurerPoints(
        measurer,
        activeHandle.initialPoints.map(([x, y]) => [rn(x + dx, 1), rn(y + dy, 1)])
      );
    } else {
      const point = getEditablePoint(measurer, event.detail.worldPoint);
      moveMeasurerPoint(measurer, activeHandle.pointIndex!, point);
    }
    drawMeasurers();
    return;
  }
  if (event.detail.phase !== "end" || !activeHandle) return;
  activeHandle = null;
  redraw();
}

function renderMeasurerOverlay(): void {
  const measurer = selectedMeasurerId === null ? undefined : getMeasurer(selectedMeasurerId);
  if (!measurer || drawingType) {
    updateMapInteractionOverlay({
      handles: [],
      selection: measurer ? [{ kind: "polyline", points: toScreenPoints(measurer.points) }] : null
    });
    return;
  }
  const center = getCentroid(measurer.points);
  updateMapInteractionOverlay({
    handles: [
      ...measurer.points.map(([x, y], index) => ({
        id: `measurer:${measurer.i}:point:${index}`,
        label: `Edit ${measurer.type} point ${index + 1}. Activate to remove`,
        point: { x, y }
      })),
      {
        id: `measurer:${measurer.i}:translate`,
        label: `Move ${measurer.type}`,
        point: { x: center[0], y: center[1] }
      }
    ],
    highlight: null,
    selection: [
      { kind: measurer.type === "Planimeter" ? "polygon" : "polyline", points: toScreenPoints(measurer.points) }
    ]
  });
}

function insertRulerPointOnClick(event: MouseEvent): void {
  if (drawingType || selectedMeasurerId === null) return;
  const measurer = getMeasurer(selectedMeasurerId);
  if (measurer?.type !== "Ruler") return;
  const world = getPixiMapPointAtClient(event.clientX, event.clientY);
  if (!world) return;
  const point: Point = [rn(world.x, 1), rn(world.y, 1)];
  if (distanceToPolyline(point, measurer.points) > 6 / scale) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  insertMeasurerPoint(measurer, getSegmentId(measurer.points, point, 2), point);
  redraw();
}

function addSampledPoint(measurer: Measurer, point: Point, preserve: boolean): void {
  const previous = last(measurer.points);
  const next: Point = [point[0] | 0, point[1] | 0];
  const minDistanceSquared = preserve ? 9 : 100;
  if ((previous[0] - next[0]) ** 2 + (previous[1] - next[1]) ** 2 < minDistanceSquared) return;
  insertMeasurerPoint(measurer, measurer.points.length, next);
}

function optimizePoints(measurer: Measurer): void {
  const optimized: Point[] = [];
  for (let index = 0, previous = measurer.points[0]; index < measurer.points.length; index++) {
    const point = measurer.points[index];
    const edge = index === 0 || index === measurer.points.length - 1;
    if (!edge && (point[0] - previous[0]) ** 2 + (point[1] - previous[1]) ** 2 < 900) continue;
    optimized.push(point);
    previous = point;
  }
  replaceMeasurerPoints(measurer, optimized);
}

function trackCell(measurer: Measurer, cell: number): void {
  const cells = measurer.points.map(([x, y]) => findCell(x, y));
  if (last(cells) === cell) return;
  const found = cells.indexOf(cell);
  const points = found !== -1 ? measurer.points.slice(0, found + 1) : [...measurer.points, getCellCoord(cell)];
  replaceMeasurerPoints(measurer, points);
}

function getEditablePoint(measurer: Measurer, point: { x: number; y: number }): Point {
  if (measurer.type !== "RouteOpisometer") return [rn(point.x, 1), rn(point.y, 1)];
  const cell = findCell(point.x, point.y);
  return cell !== undefined && Routes.isConnected(cell) ? getCellCoord(cell) : [rn(point.x, 1), rn(point.y, 1)];
}

function getCellCoord(cell: number): Point {
  const burg = pack.cells.burg[cell];
  if (burg) return [pack.burgs[burg].x, pack.burgs[burg].y];
  return [...pack.cells.p[cell]];
}

function getMeasurer(id: number): Measurer | undefined {
  return pack.measurers.find(measurer => measurer.i === id);
}

function getMeasurerValue(measurer: Measurer): string {
  if (measurer.type === "Planimeter") {
    const area = Math.abs(getPolygonArea(measurer.points));
    return `${si(getArea(area))} ${getAreaUnit()}`;
  }
  let length = 0;
  for (let index = 1; index < measurer.points.length; index++) {
    length += Math.hypot(
      measurer.points[index][0] - measurer.points[index - 1][0],
      measurer.points[index][1] - measurer.points[index - 1][1]
    );
  }
  return `${rn(length * distanceScale)} ${distanceUnitInput.value}`;
}

function getCentroid(points: Point[]): Point {
  const count = Math.max(points.length, 1);
  return [points.reduce((sum, [x]) => sum + x, 0) / count, points.reduce((sum, [, y]) => sum + y, 0) / count];
}

function getPolygonArea(points: Point[]): number {
  let area = 0;
  for (let index = 0; index < points.length; index++) {
    const [x1, y1] = points[index];
    const [x2, y2] = points[(index + 1) % points.length];
    area += x1 * y2 - x2 * y1;
  }
  return area / 2;
}

function toScreenPoints(points: Point[]): { x: number; y: number }[] {
  return points.map(([x, y]) => ({ x, y }));
}

function distanceToPolyline(point: Point, points: Point[]): number {
  let distance = Infinity;
  for (let index = 1; index < points.length; index++) {
    distance = Math.min(distance, distanceToSegment(point, points[index - 1], points[index]));
  }
  return distance;
}

function distanceToSegment(point: Point, start: Point, end: Point): number {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const lengthSquared = dx * dx + dy * dy;
  const progress = lengthSquared
    ? Math.max(0, Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / lengthSquared))
    : 0;
  return Math.hypot(point[0] - (start[0] + progress * dx), point[1] - (start[1] + progress * dy));
}

function onClose(): void {
  exitDrawingMode();
  document
    .getElementById("map")
    ?.removeEventListener(MAP_INTERACTION_HANDLE_EVENT, editMeasurerHandle as EventListener);
  document.getElementById("viewbox")?.removeEventListener("click", insertRulerPointOnClick, true);
  activeHandle = null;
  selectedMeasurerId = null;
  clearMapInteractionOverlay();
  if (window.LayerControls.isLayerOn("toggleRulers")) drawMeasurers();
  else undrawMeasurers();
  destroyDialog("measurersEditor");
}

export const MeasurersEditor = { addRulerAt, open };
