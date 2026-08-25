import { select } from "d3";
import { closeDialogs, confirmationDialog, destroyDialog } from "@/components/dialog/dialog-helpers";
import { clearMainTip, tip } from "@/components/tooltips";
import { showDomDialog } from "@/components/ui/dom-dialog";
import "@/components/ui/map-feature-editor.css";
import { applyDefaultViewboxEvents } from "@/components/viewbox-events";
import { Controllers } from "@/controllers";
import { insertRoutePoint, moveRoutePoint, removeRoutePoint, replaceRoutePoints } from "@/controllers/editor-mutations";
import { type Route, UNNAMED_ROUTE } from "@/generators/routes-generator";
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
import { getMapRendererStyle } from "@/renderers/scene/map-style-state";
import { speak } from "@/utils";
import { ensureEl, findEl, getSegmentId, rn } from "../utils";

let selectedRouteId = 0;
let activePoint: { index: number; initialCell: number; initialPoint: [number, number] } | null = null;

function open(routeId: number): void {
  if (customization) return;
  if (findEl("routeEditor") && routeId === selectedRouteId) return;
  closeDialogs(".stable");

  if (!window.LayerControls.isLayerOn("toggleRoutes")) window.LayerControls.toggleLayer("toggleRoutes");
  ensureEl("toggleCells").dataset.forced = String(+!window.LayerControls.isLayerOn("toggleCells"));
  if (!window.LayerControls.isLayerOn("toggleCells")) window.LayerControls.toggleLayer("toggleCells");

  const route = pack.routes.find(candidate => candidate.i === routeId);
  if (!route) return;
  selectedRouteId = routeId;

  tip(
    "Drag control points to change the route. Click on point to remove it. Click on the route to add additional control point. For major changes please create a new route instead",
    true
  );
  select<SVGGElement, unknown>("#viewbox").style("cursor", "crosshair").on("click", addControlPoint);
  document.getElementById("map")?.addEventListener(MAP_INTERACTION_HANDLE_EVENT, editRoutePoint as EventListener);

  renderDialog();

  {
    const route = getRoute();
    updateRouteData(route);
    drawControlPoints(route.points);
    drawCells(route.points);
    updateLockIcon();
  }

  showDomDialog({
    content: ensureEl("routeEditor"),
    onClose: closeRouteEditor,
    placement: "top-right",
    placementTarget: document.getElementById("map"),
    resizable: false,
    title: "Edit Route"
  });
}

function renderDialog(): void {
  destroyDialog("routeEditor");

  const html = /* html */ `<div id="routeEditor" class="dialog fmg-map-feature-editor">
    <p class="fmg-map-feature-editor__hint">Drag map handles to reshape the route. Click its line to add a point.</p>
    <section class="fmg-map-feature-editor__section">
      <h3 class="fmg-map-feature-editor__section-title">Route details</h3>
      <div class="fmg-map-feature-editor__fields">
        <div class="fmg-map-feature-editor__field fmg-map-feature-editor__field--wide">
          <label for="routeName">Name</label>
          <div class="fmg-map-feature-editor__control">
            <input id="routeName" data-tip="Type to rename the route" autocorrect="off" spellcheck="false" />
            <button id="routeNameSpeak" aria-label="Speak route name" data-tip="Speak the name. You can change voice and language in options" class="fmg-map-feature-editor__icon-button speaker">🔊</button>
            <button id="routeGenerateName" aria-label="Generate route name" data-tip="Generate route name" class="fmg-map-feature-editor__icon-button icon-globe"></button>
          </div>
        </div>
        <div class="fmg-map-feature-editor__field fmg-map-feature-editor__field--wide">
          <label for="routeGroup">Group</label>
          <div class="fmg-map-feature-editor__control">
            <select id="routeGroup" data-tip="Select route group"></select>
            <button id="routeGroupEdit" aria-label="Edit route groups" data-tip="Edit route groups" class="fmg-map-feature-editor__icon-button icon-pencil"></button>
            <button id="routeEditStyle" aria-label="Edit route group style" data-tip="Edit style for this route group" class="fmg-map-feature-editor__icon-button icon-brush"></button>
          </div>
        </div>
        <div class="fmg-map-feature-editor__field"><label for="routeLength">Length</label><input id="routeLength" data-tip="Route length in selected units" disabled /></div>
      </div>
    </section>
    <footer class="fmg-map-feature-editor__toolbar">
      <button id="routeCreateSelectingCells" data-tip="Create a new route by selecting route cells" class="fmg-map-feature-editor__action icon-map-pin">New route</button>
      <button id="routeJoin" data-tip="Join this route to another route that shares an endpoint" class="fmg-map-feature-editor__action icon-link">Join</button>
      <button id="routeSplit" data-tip="Turn on split mode, then click a control point to split the route there" class="fmg-map-feature-editor__action icon-unlink">Split</button>
      <button id="routeElevationProfile" data-tip="Show the elevation profile for this route" class="fmg-map-feature-editor__action icon-chart-area">Elevation</button>
      <button id="routeLegend" data-tip="Edit free-text notes for this route" class="fmg-map-feature-editor__action icon-edit">Notes</button>
      <button id="routeLock" aria-label="Lock route" class="fmg-map-feature-editor__action icon-lock-open" onmouseover="showElementLockTip(event)">Lock</button>
      <button id="routeRemove" data-tip="Remove this route" data-shortcut="Delete" class="fmg-map-feature-editor__action fmg-map-feature-editor__action--danger icon-trash fastDelete">Remove</button>
    </footer>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);

  // add listeners — dropped together with the dialog HTML on close
  ensureEl("routeCreateSelectingCells").addEventListener("click", showCreationDialog);
  ensureEl("routeSplit").addEventListener("click", togglePressed);
  ensureEl("routeJoin").addEventListener("click", openJoinRoutesDialog);
  ensureEl("routeElevationProfile").addEventListener("click", showRouteElevationProfile);
  ensureEl("routeLegend").addEventListener("click", editRouteLegend);
  ensureEl("routeLock").addEventListener("click", toggleLockButton);
  ensureEl("routeRemove").addEventListener("click", removeRoute);
  ensureEl("routeName").addEventListener("input", changeName);
  ensureEl("routeNameSpeak").addEventListener("click", () => speak(ensureEl<HTMLInputElement>("routeName").value));
  ensureEl("routeGroup").addEventListener("input", changeGroup);
  ensureEl("routeGroupEdit").addEventListener("click", openRouteGroupsEditor);
  ensureEl("routeEditStyle").addEventListener("click", editRouteGroupStyle);
  ensureEl("routeGenerateName").addEventListener("click", generateName);
}

function openRouteGroupsEditor(): void {
  void Controllers.RouteGroupsEditor.open();
}

function getRoute(): Route {
  return pack.routes.find((route: Route) => route.i === selectedRouteId) as Route;
}

function updateRouteData(route: Route): void {
  route.name = route.name || Routes.generateName(route) || UNNAMED_ROUTE;
  ensureEl<HTMLInputElement>("routeName").value = route.name;

  const routeGroup = ensureEl<HTMLSelectElement>("routeGroup");
  routeGroup.options.length = 0;
  const groups = new Set([
    ...Object.keys(getMapRendererStyle(style).routes.roles),
    ...pack.routes.map((candidate: Route) => candidate.group)
  ]);
  for (const group of groups) routeGroup.options.add(new Option(group, group, false, group === route.group));

  updateRouteLength(route);

  const isWaterRoute = route.points.some(([_x, _y, cellId]) => pack.cells.h[cellId] < 20);
  ensureEl("routeElevationProfile").style.display = isWaterRoute ? "none" : "inline-block";
}

function updateRouteLength(route: Route): void {
  route.length = Routes.getLength(route.i);
  ensureEl<HTMLInputElement>("routeLength").value = `${rn(route.length * distanceScale)} ${distanceUnitInput.value}`;
}

function drawControlPoints(points: number[][]): void {
  renderRouteOverlay(points);
}

function drawCells(points: number[][]): void {
  renderRouteOverlay(points);
}

function redrawRoute(route: Route, renderOverlay = true): void {
  invalidatePixiRendererLayer("routes");
  updateRouteLength(route);
  if (findEl("elevationProfile")) showRouteElevationProfile();
  drawLabels();
  if (renderOverlay) renderRouteOverlay(route.points);
}

function addControlPoint(event: MouseEvent): void {
  const hit = pickPixiRenderer(event.clientX, event.clientY);
  if (hit?.domainKind !== "route" || Number(hit.domainId) !== selectedRouteId) return;
  const route = getRoute();
  const mapPoint = getPixiMapPointAtClient(event.clientX, event.clientY);
  if (!mapPoint) return;
  const { x, y } = mapPoint;
  const cellId = findCell(x, y);
  if (cellId === undefined) return;

  const point: [number, number, number] = [rn(x, 2), rn(y, 2), cellId];
  const isNewCell = !route.points.some(p => p[2] === cellId);

  const index = getSegmentId(route.points as [number, number][], [point[0], point[1]], 2);
  const mutation = insertRoutePoint(route, index, point);
  if (!mutation.changed) return;

  // check if added point is in new cell
  if (isNewCell) {
    const prev = route.points[index - 1];
    const next = route.points[index + 1];

    if (!prev) ERROR && console.error("Can't add control point to the start of the route");
    if (!next) ERROR && console.error("Can't add control point to the end of the route");
    if (!prev || !next) return;

    removeConnection(prev[2], next[2]);
    addConnection(prev[2], cellId, route.i);
    addConnection(cellId, next[2], route.i);

    drawCells(route.points);
  }

  drawControlPoints(route.points);
  redrawRoute(route);
}

function activateControlPoint(index: number): void {
  const route = getRoute();
  if (route.points.length < 3) return; // can't remove or split point if only 2 points in route
  const point = route.points[index];
  if (!point) return;

  const isSplitMode = ensureEl("routeSplit").classList.contains("pressed");
  if (isSplitMode) splitRoute();
  else removeControlPoint();

  function splitRoute(): void {
    const oldRoutePoints = route.points.slice(0, index + 1);
    const newRoutePoints = route.points.slice(index);

    // update old route
    replaceRoutePoints(route, oldRoutePoints);
    drawControlPoints(route.points);
    drawCells(route.points);
    redrawRoute(route);

    // create new route
    const newRoute = {
      i: Routes.getNextId(),
      group: route.group,
      feature: route.feature,
      name: route.name,
      points: newRoutePoints
    } as Route;
    pack.routes.push(newRoute);

    for (let i = 0; i < newRoute.points.length; i++) {
      const cellId = newRoute.points[i][2];
      const nextPoint = newRoute.points[i + 1];
      if (nextPoint) addConnection(cellId, nextPoint[2], newRoute.i);
    }

    invalidatePixiRendererLayer("routes");

    ensureEl("routeSplit").classList.remove("pressed");
  }

  function removeControlPoint(): void {
    const isOnlyPointInCell = route.points.filter(p => p[2] === point[2]).length === 1;
    if (isOnlyPointInCell) {
      const prev = route.points[index - 1];
      const next = route.points[index + 1];
      if (prev) removeConnection(prev[2], point[2]);
      if (next) removeConnection(point[2], next[2]);
      if (prev && next) addConnection(prev[2], next[2], route.i);
    }

    removeRoutePoint(route, index);

    drawCells(route.points);
    redrawRoute(route);
  }
}

function openJoinRoutesDialog(): void {
  const route = getRoute();
  const firstCell = route.points.at(0)![2];
  const lastCell = route.points.at(-1)![2];

  const candidateRoutes = pack.routes.filter((r: Route) => {
    if (r.i === route.i) return false;
    if (r.group !== route.group) return false;
    if (r.points.at(0)![2] === lastCell) return true;
    if (r.points.at(-1)![2] === firstCell) return true;
    if (r.points.at(0)![2] === firstCell) return true;
    if (r.points.at(-1)![2] === lastCell) return true;
    return false;
  });

  if (candidateRoutes.length) {
    const options = candidateRoutes.map((r: Route) => {
      r.name = r.name || Routes.generateName(r) || UNNAMED_ROUTE;
      r.length = r.length || Routes.getLength(r.i);
      const length = `${rn(r.length * distanceScale)} ${distanceUnitInput.value}`;
      return `<option value="${r.i}">${r.name} (${length})</option>`;
    });
    const messageHtml = /* html */ `<div>Route to join with:
        <select data-route-join-target>${options.join("")}</select>
      </div>`;
    void import("@/components/ui/message-dialog").then(({ showMessageDialog }) => {
      showMessageDialog({
        actions: [
          { label: "Cancel" },
          {
            intent: "primary",
            label: "Join",
            onClick: () => {
              const select = document.querySelector<HTMLSelectElement>(".fmg-message-dialog [data-route-join-target]");
              if (!select) return;
              const selectedRouteId = +select.value;
              const selectedRoute = pack.routes.find((candidate: Route) => candidate.i === selectedRouteId) as Route;
              joinRoutes(route, selectedRoute);
              tip("Routes joined", false, "success", 5000);
            }
          }
        ],
        id: "routeJoinDialog",
        messageHtml,
        title: "Join routes",
        width: "fit-content"
      });
    });
  } else {
    tip("No routes to join with. Route must start or end at current route's start or end cell", false, "error", 4000);
  }
}

function joinRoutes(route: Route, joinedRoute: Route): void {
  const mergedPoints = mergeRoutePoints(route.points, joinedRoute.points);
  if (!mergedPoints) return;
  replaceRoutePoints(route, mergedPoints);

  for (let i = 0; i < route.points.length; i++) {
    const point = route.points[i];
    const nextPoint = route.points[i + 1];
    if (nextPoint) addConnection(point[2], nextPoint[2], route.i);
  }

  Routes.remove(joinedRoute);
  drawControlPoints(route.points);
  redrawRoute(route);
  drawCells(route.points);
}

export function mergeRoutePoints(routePoints: number[][], joinedPoints: number[][]): number[][] | null {
  if (!routePoints.length || !joinedPoints.length) return null;

  const routeStart = routePoints.at(0)?.[2];
  const routeEnd = routePoints.at(-1)?.[2];
  const joinedStart = joinedPoints.at(0)?.[2];
  const joinedEnd = joinedPoints.at(-1)?.[2];

  if (routeEnd === joinedStart) return [...routePoints, ...joinedPoints.slice(1)];
  if (routeStart === joinedEnd) return [...joinedPoints, ...routePoints.slice(1)];
  if (routeStart === joinedStart) return [...[...routePoints].reverse(), ...joinedPoints.slice(1)];
  if (routeEnd === joinedEnd) return [...routePoints, ...[...joinedPoints].reverse().slice(1)];
  return null;
}

function showCreationDialog(): void {
  const route = getRoute();
  void Controllers.RouteCreator.open(route.group);
}

function togglePressed(this: HTMLElement): void {
  this.classList.toggle("pressed");
}

function removeConnection(from: number, to: number): void {
  const cellRoutes = pack.cells.routes;
  if (cellRoutes[from]) delete cellRoutes[from][to];
  if (cellRoutes[to]) delete cellRoutes[to][from];
}

function addConnection(from: number, to: number, routeId: number): void {
  const cellRoutes = pack.cells.routes;

  if (!cellRoutes[from]) cellRoutes[from] = {};
  cellRoutes[from][to] = routeId;

  if (!cellRoutes[to]) cellRoutes[to] = {};
  cellRoutes[to][from] = routeId;
}

function changeName(this: HTMLInputElement): void {
  getRoute().name = this.value;
}

function changeGroup(this: HTMLInputElement): void {
  const group = this.value;
  getRoute().group = group;
  invalidatePixiRendererLayer("routes");
}

function generateName(): void {
  const route = getRoute();
  route.name = ensureEl<HTMLInputElement>("routeName").value = Routes.generateName(route) || UNNAMED_ROUTE;
}

function showRouteElevationProfile(): void {
  const route = getRoute();
  const length = rn(route.length! * distanceScale);
  void Controllers.ElevationProfile.open(
    route.points.map(p => p[2]),
    length,
    false
  );
}

function editRouteLegend(): void {
  const route = getRoute();
  void Controllers.NotesEditor.open(`route${route.i}`, route.name!);
}

function editRouteGroupStyle(): void {
  const { group } = getRoute();
  window.StyleEditor.edit("routes", group);
}

function toggleLockButton(): void {
  const route = getRoute();
  route.lock = !route.lock;
  updateLockIcon();
}

function updateLockIcon(): void {
  const route = getRoute();
  const button = ensureEl("routeLock");
  if (route.lock) {
    button.classList.remove("icon-lock-open");
    button.classList.add("icon-lock");
    button.setAttribute("aria-label", "Unlock route");
    button.dataset.tip = "Locked. Click to unlock this route and allow regeneration tools to change it";
    button.textContent = "Unlock";
  } else {
    button.classList.remove("icon-lock");
    button.classList.add("icon-lock-open");
    button.setAttribute("aria-label", "Lock route");
    button.dataset.tip = "Unlocked. Click to lock this route and prevent regeneration tools from changing it";
    button.textContent = "Lock";
  }
}

function removeRoute(): void {
  confirmationDialog({
    title: "Remove route",
    message: "Are you sure you want to remove the route? <br>This action cannot be reverted",
    confirm: "Remove",
    onConfirm: () => {
      Routes.remove(getRoute());
      invalidatePixiRendererLayer("routes");
      closeRouteEditor();
    }
  });
}

function closeRouteEditor(): void {
  document.getElementById("map")?.removeEventListener(MAP_INTERACTION_HANDLE_EVENT, editRoutePoint as EventListener);
  clearMapInteractionOverlay();
  applyDefaultViewboxEvents();
  activePoint = null;
  selectedRouteId = 0;
  clearMainTip();

  const forced = +ensureEl("toggleCells").dataset.forced!;
  ensureEl("toggleCells").dataset.forced = "0";
  if (forced && window.LayerControls.isLayerOn("toggleCells")) window.LayerControls.toggleLayer("toggleCells");

  destroyDialog("routeEditor");
}

function editRoutePoint(event: CustomEvent<MapInteractionHandleEventDetail>): void {
  const serializedId = String(event.detail.handleId);
  if (!serializedId.startsWith("route-point:")) return;
  const index = Number(serializedId.split(":")[1]);
  const route = getRoute();
  const point = route.points[index];
  if (!point) return;

  if (event.detail.phase === "activate") {
    activateControlPoint(index);
    return;
  }
  if (event.detail.phase === "start") {
    activePoint = { index, initialCell: point[2], initialPoint: [point[0], point[1]] };
    return;
  }
  if (event.detail.phase === "cancel") {
    if (activePoint?.index === index) {
      moveRoutePoint(route, index, [activePoint.initialPoint[0], activePoint.initialPoint[1], activePoint.initialCell]);
      activePoint = null;
      redrawRoute(route);
    }
    return;
  }
  if (event.detail.phase === "move") {
    const cellId = findCell(event.detail.worldPoint.x, event.detail.worldPoint.y);
    if (cellId === undefined) return;
    moveRoutePoint(route, index, [rn(event.detail.worldPoint.x, 2), rn(event.detail.worldPoint.y, 2), cellId]);
    redrawRoute(route, false);
    return;
  }
  if (event.detail.phase !== "end" || activePoint?.index !== index) return;

  const moved = Math.hypot(point[0] - activePoint.initialPoint[0], point[1] - activePoint.initialPoint[1]) > 0.01;
  if (!moved) {
    activePoint = null;
    activateControlPoint(index);
    return;
  }
  if (point[2] !== activePoint.initialCell) {
    const previous = route.points[index - 1];
    const next = route.points[index + 1];
    if (previous) {
      removeConnection(activePoint.initialCell, previous[2]);
      addConnection(point[2], previous[2], route.i);
    }
    if (next) {
      removeConnection(activePoint.initialCell, next[2]);
      addConnection(point[2], next[2], route.i);
    }
  }
  activePoint = null;
  queueMicrotask(() => renderRouteOverlay(route.points));
}

function renderRouteOverlay(points: number[][]): void {
  const cells = [...new Set(points.map(point => point[2]))];
  updateMapInteractionOverlay({
    handles: points.map(([x, y], index) => ({
      id: `route-point:${index}`,
      label: `Edit route point ${index + 1}`,
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

export const RouteEditor = { open };
