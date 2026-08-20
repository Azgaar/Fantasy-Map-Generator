import { select } from "d3";
import { closeDialogs, destroyDialog } from "@/components/dialog/dialog-helpers";
import { stopMapPlacement } from "@/components/map-placement";
import { clearMainTip, tip } from "@/components/tooltips";
import { showDomDialog } from "@/components/ui/dom-dialog";
import { applyDefaultViewboxEvents } from "@/components/viewbox-events";
import { Controllers } from "@/controllers";
import type { Route } from "@/generators/routes-generator";
import { invalidatePixiRendererLayer } from "@/renderers/pixi/pixi-renderer-controller";
import { getMapRendererStyle } from "@/renderers/scene/map-style-state";
import type { Point } from "@/types/global";
import { ensureEl, getPackPolygon, getPointer, rn } from "../utils";

let creatorPoints: number[][] = [];

function open(defaultGroup?: string): void {
  if (customization) return;
  stopMapPlacement();
  closeDialogs();
  if (!layerIsOn("toggleRoutes")) toggleRoutes();

  ensureEl("toggleCells").dataset.forced = String(+!layerIsOn("toggleCells"));
  if (!layerIsOn("toggleCells")) toggleCells();

  tip("Click to add route point", true);
  select("#debug").append("g").attr("id", "controlCells");
  select("#debug").append("g").attr("id", "controlPoints");
  select<SVGElement, unknown>("#viewbox").style("cursor", "crosshair").on("click", onClick);

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
  destroyDialog("routeCreator");
}

function onBodyClick(ev: Event): void {
  const target = ev.target as HTMLElement;
  if (target.classList.contains("icon-trash-empty")) removePoint((target.parentNode as HTMLElement).dataset.point!);
}

function onClick(this: any, event: any): void {
  addPoint(getPointer(event, this));
}

function addPoint([x, y]: Point): boolean {
  const cellId = findCell(x, y);
  if (cellId === undefined) return false;
  const point = [rn(x, 2), rn(y, 2), cellId];
  creatorPoints.push(point);

  drawRoute(creatorPoints);

  ensureEl("routeCreatorBody").innerHTML +=
    `<div class="editorLine" style="display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 1em;" data-point="${point.join(
      "-"
    )}">
      <span><b>Cell</b>: ${cellId}</span>
      <span><b>X</b>: ${point[0]}</span>
      <span><b>Y</b>: ${point[1]}</span>
      <span data-tip="Remove the point" class="icon-trash-empty pointer"></span>
    </div>`;
  return true;
}

function removePoint(pointString: string): void {
  creatorPoints = creatorPoints.filter(p => p.join("-") !== pointString);
  drawRoute(creatorPoints);
  ensureEl("routeCreatorBody").querySelector(`[data-point='${pointString}']`)?.remove();
}

function drawRoute(points: number[][]): void {
  select("#debug")
    .select("#controlCells")
    .selectAll("polygon")
    .data(points)
    .join("polygon")
    .attr("points", (p: number[]) => getPackPolygon(p[2], pack))
    .attr("class", "current");

  select("#debug")
    .select("#controlPoints")
    .selectAll("circle")
    .data(points)
    .join("circle")
    .attr("cx", (d: number[]) => d[0])
    .attr("cy", (d: number[]) => d[1])
    .attr("r", 0.6);

  const group = ensureEl<HTMLSelectElement>("routeCreatorGroupSelect").value;

  select("#controlPoints").select("#routeTemp").remove();
  select("#controlPoints")
    .append("path")
    .attr("d", Routes.getPath({ group, points }))
    .attr("id", "routeTemp")
    .attr("data-renderer-overlay", "transient");
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

  select("#controlPoints").select("#routeTemp").remove();
  invalidatePixiRendererLayer("routes");
  void Controllers.RouteEditor.open(routeId);
}

function closeRouteCreator(): void {
  select("#debug").select("#controlCells").remove();
  select("#debug").select("#controlPoints").remove();

  applyDefaultViewboxEvents();
  clearMainTip();

  const forced = +ensureEl("toggleCells").dataset.forced!;
  ensureEl("toggleCells").dataset.forced = "0";
  if (forced && layerIsOn("toggleCells")) toggleCells();

  destroyDialog("routeCreator");
}

export const RouteCreator = { open, openAt };
