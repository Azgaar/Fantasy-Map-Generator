import { select } from "d3";
import { closeDialogs, destroyDialog } from "@/components/dialog/dialog-helpers";
import { stopMapPlacement } from "@/components/map-placement";
import { clearMainTip, tip } from "@/components/tooltips";
import { showDomDialog } from "@/components/ui/dom-dialog";
import { applyDefaultViewboxEvents } from "@/components/viewbox-events";
import { Controllers } from "@/controllers";
import type { Route } from "@/generators/routes-generator";
import {
  MAP_INTERACTION_HANDLE_EVENT,
  type MapInteractionHandleEventDetail
} from "@/renderers/interaction/map-interaction-overlay";
import {
  clearMapInteractionOverlay,
  getPixiMapPointAtClient,
  invalidatePixiRendererLayer,
  updateMapInteractionOverlay
} from "@/renderers/pixi/pixi-renderer-controller";
import { getMapRendererStyle } from "@/renderers/scene/map-style-state";
import type { Point } from "@/types/global";
import { ensureEl, rn } from "../utils";

let creatorPoints: number[][] = [];

function open(defaultGroup?: string): void {
  if (customization) return;
  stopMapPlacement();
  closeDialogs();
  if (!window.LayerControls.isLayerOn("toggleRoutes")) window.LayerControls.toggleLayer("toggleRoutes");

  ensureEl("toggleCells").dataset.forced = String(+!window.LayerControls.isLayerOn("toggleCells"));
  if (!window.LayerControls.isLayerOn("toggleCells")) window.LayerControls.toggleLayer("toggleCells");

  tip("Click to add route point", true);
  select<SVGElement, unknown>("#viewbox").style("cursor", "crosshair").on("click", onClick);
  document.getElementById("map")?.addEventListener(MAP_INTERACTION_HANDLE_EVENT, moveCreatorPoint as EventListener);

  creatorPoints = [];
  renderDialog();

  // update route groups
  const groups = new Set([
    ...Object.keys(getMapRendererStyle(style).routes.roles),
    ...pack.routes.map((route: Route) => route.group)
  ]);
  const selected = defaultGroup || "roads";
  ensureEl("routeCreatorGroupSelect").innerHTML = [...groups]
    .map(group => `<option value="${group}" ${group === selected ? "selected" : ""}>${group}</option>`)
    .join("");

  showDomDialog({
    content: ensureEl("routeCreator"),
    onClose: closeRouteCreator,
    placement: "top-left",
    placementTarget: document.getElementById("map"),
    placementOffset: { x: 10, y: 10 },
    resizable: false,
    title: "Create Route"
  });
}

function openAt(point: Point, defaultGroup?: string): void {
  open(defaultGroup);
  addPoint(point);
}

function renderDialog(): void {
  destroyDialog("routeCreator");

  const html = /* html */ `<div id="routeCreator" class="dialog">
    <div>Click on map to add/remove route points</div>
    <div id="routeCreatorBody" class="table" style="margin: 0.3em 0"></div>
    <div id="routeCreatorBottom">
      <button id="routeCreatorComplete" data-tip="Complete route creation" class="icon-check"></button>
      <button id="routeCreatorCancel" data-tip="Cancel the creation" class="icon-cancel"></button>
      <div style="display: inline-block">
        Group:
        <select id="routeCreatorGroupSelect"></select>
        <span id="routeCreatorGroupEdit" data-tip="Edit route groups" class="icon-pencil pointer"></span>
      </div>
    </div>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);

  // add listeners — dropped together with the dialog HTML on close
  ensureEl("routeCreatorGroupSelect").addEventListener("change", redrawCreatorRoute);
  ensureEl("routeCreatorGroupEdit").addEventListener("click", openRouteGroupsEditor);
  ensureEl("routeCreatorComplete").addEventListener("click", completeCreation);
  ensureEl("routeCreatorCancel").addEventListener("click", cancelCreation);
  ensureEl("routeCreatorBody").addEventListener("click", onBodyClick);
}

function redrawCreatorRoute(): void {
  drawRoute(creatorPoints);
}

function openRouteGroupsEditor(): void {
  void Controllers.RouteGroupsEditor.open();
}

function cancelCreation(): void {
  closeRouteCreator();
}

function onBodyClick(ev: Event): void {
  const target = ev.target as HTMLElement;
  if (target.classList.contains("icon-trash-empty")) removePoint((target.parentNode as HTMLElement).dataset.point!);
}

function onClick(this: any, event: any): void {
  const point = getPixiMapPointAtClient(event.clientX, event.clientY);
  if (point) addPoint([point.x, point.y]);
}

function addPoint([x, y]: Point): boolean {
  const cellId = findCell(x, y);
  if (cellId === undefined) return false;
  const point = [rn(x, 2), rn(y, 2), cellId];
  creatorPoints.push(point);

  drawRoute(creatorPoints);
  renderCreatorRows();
  return true;
}

function removePoint(pointString: string): void {
  creatorPoints = creatorPoints.filter(p => p.join("-") !== pointString);
  drawRoute(creatorPoints);
  renderCreatorRows();
}

function drawRoute(points: number[][]): void {
  updateMapInteractionOverlay({
    handles: points.map(([x, y], index) => ({
      id: `route-create:${index}`,
      label: `Move route point ${index + 1}`,
      point: { x, y }
    })),
    selection: points.length ? [{ kind: "polyline", points: points.map(([x, y]) => ({ x, y })) }] : null
  });
}

function completeCreation(): void {
  const points = creatorPoints;
  if (points.length < 2) {
    tip("Add at least 2 points", false, "error");
    return;
  }

  const routeId = Routes.getNextId();
  const group = ensureEl<HTMLSelectElement>("routeCreatorGroupSelect").value;
  const feature = pack.cells.f[points[0][2]];
  const route = { points, group, feature, i: routeId } as Route;
  pack.routes.push(route);

  const links = pack.cells.routes;
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    const nextPoint = points[i + 1];

    if (nextPoint) {
      const cellId = point[2];
      const nextId = nextPoint[2];

      if (!links[cellId]) links[cellId] = {};
      links[cellId][nextId] = routeId;

      if (!links[nextId]) links[nextId] = {};
      links[nextId][cellId] = routeId;
    }
  }

  clearMapInteractionOverlay();
  invalidatePixiRendererLayer("routes");
  void Controllers.RouteEditor.open(routeId);
}

function closeRouteCreator(): void {
  document.getElementById("map")?.removeEventListener(MAP_INTERACTION_HANDLE_EVENT, moveCreatorPoint as EventListener);
  clearMapInteractionOverlay();

  applyDefaultViewboxEvents();
  clearMainTip();

  const forced = +ensureEl("toggleCells").dataset.forced!;
  ensureEl("toggleCells").dataset.forced = "0";
  if (forced && window.LayerControls.isLayerOn("toggleCells")) window.LayerControls.toggleLayer("toggleCells");

  destroyDialog("routeCreator");
}

function moveCreatorPoint(event: CustomEvent<MapInteractionHandleEventDetail>): void {
  if (!["move", "end"].includes(event.detail.phase) || !String(event.detail.handleId).startsWith("route-create:"))
    return;
  const index = Number(String(event.detail.handleId).split(":")[1]);
  const cellId = findCell(event.detail.worldPoint.x, event.detail.worldPoint.y);
  if (!creatorPoints[index] || cellId === undefined) return;
  creatorPoints[index] = [rn(event.detail.worldPoint.x, 2), rn(event.detail.worldPoint.y, 2), cellId];
  if (event.detail.phase === "end") {
    queueMicrotask(() => drawRoute(creatorPoints));
    renderCreatorRows();
  }
}

function renderCreatorRows(): void {
  ensureEl("routeCreatorBody").innerHTML = creatorPoints
    .map(
      point => `<div class="editorLine" style="display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 1em;" data-point="${point.join("-")}">
        <span><b>Cell</b>: ${point[2]}</span>
        <span><b>X</b>: ${point[0]}</span>
        <span><b>Y</b>: ${point[1]}</span>
        <span data-tip="Remove the point" class="icon-trash-empty pointer"></span>
      </div>`
    )
    .join("");
}

export const RouteCreator = { open, openAt };
