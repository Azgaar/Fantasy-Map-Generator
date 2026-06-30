import { pointer, select } from "d3";
import { Controllers } from "@/controllers";
import type { Route } from "@/generators/routes-generator";
import { ensureEl, getPackPolygon, rn } from "../utils";

let isInitialized = false;
let creatorPoints: number[][] = [];

function createRoute(defaultGroup?: string): void {
  if (customization) return;
  closeDialogs();
  if (!layerIsOn("toggleRoutes")) toggleRoutes();

  ensureEl("toggleCells").dataset.forced = String(+!layerIsOn("toggleCells"));
  if (!layerIsOn("toggleCells")) toggleCells();

  tip("Click to add route point, click again to remove", true);
  debug.append("g").attr("id", "controlCells");
  debug.append("g").attr("id", "controlPoints");
  select<SVGElement, unknown>("#viewbox").style("cursor", "crosshair").on("click", onClick);

  creatorPoints = [];
  const body = ensureEl("routeCreatorBody");

  // update route groups
  ensureEl("routeCreatorGroupSelect").innerHTML = Array.from((routes.selectAll("g") as any)._groups[0] as HTMLElement[])
    .map(el => {
      const selected = defaultGroup || "roads";
      return `<option value="${el.id}" ${el.id === selected ? "selected" : ""}>${el.id}</option>`;
    })
    .join("");

  $("#routeCreator").dialog({
    title: "Create Route",
    resizable: false,
    position: { my: "left top", at: "left+10 top+10", of: "#map" },
    close: closeRouteCreator
  });

  if (isInitialized) return;
  isInitialized = true;

  // add listeners
  ensureEl("routeCreatorGroupSelect").on("change", () => drawRoute(creatorPoints));
  ensureEl("routeCreatorGroupEdit").on("click", () => void Controllers.RouteGroupsEditor.open());
  ensureEl("routeCreatorComplete").on("click", completeCreation);
  ensureEl("routeCreatorCancel").on("click", () => $("#routeCreator").dialog("close"));
  body.on("click", (ev: Event) => {
    const target = ev.target as HTMLElement;
    if (target.classList.contains("icon-trash-empty")) removePoint((target.parentNode as HTMLElement).dataset.point!);
  });

  function onClick(this: any, event: any): void {
    const [x, y] = pointer(event, this);
    const cellId = findCell(x, y);
    const point = [rn(x, 2), rn(y, 2), cellId!];
    creatorPoints.push(point);

    drawRoute(creatorPoints);

    body.innerHTML += `<div class="editorLine" style="display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 1em;" data-point="${point.join(
      "-"
    )}">
      <span><b>Cell</b>: ${cellId}</span>
      <span><b>X</b>: ${point[0]}</span>
      <span><b>Y</b>: ${point[1]}</span>
      <span data-tip="Remove the point" class="icon-trash-empty pointer"></span>
    </div>`;
  }

  function removePoint(pointString: string): void {
    creatorPoints = creatorPoints.filter(p => p.join("-") !== pointString);
    drawRoute(creatorPoints);
    body.querySelector(`[data-point='${pointString}']`)?.remove();
  }
}

function drawRoute(points: number[][]): void {
  debug
    .select("#controlCells")
    .selectAll("polygon")
    .data(points)
    .join("polygon")
    .attr("points", (p: number[]) => getPackPolygon(p[2], pack))
    .attr("class", "current");

  debug
    .select("#controlPoints")
    .selectAll("circle")
    .data(points)
    .join("circle")
    .attr("cx", (d: number[]) => d[0])
    .attr("cy", (d: number[]) => d[1])
    .attr("r", 0.6);

  const group = ensureEl<HTMLSelectElement>("routeCreatorGroupSelect").value;

  routes.select("#routeTemp").remove();
  routes.select(`#${group}`).append("path").attr("d", Routes.getPath({ group, points })).attr("id", "routeTemp");
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

  routes.select("#routeTemp").attr("id", `route${routeId}`);
  void Controllers.RouteEditor.open(`route${routeId}`);
}

function closeRouteCreator(): void {
  ensureEl("routeCreatorBody").innerHTML = "";
  debug.select("#controlCells").remove();
  debug.select("#controlPoints").remove();
  routes.select("#routeTemp").remove();

  restoreDefaultEvents();
  clearMainTip();

  const forced = +ensureEl("toggleCells").dataset.forced!;
  ensureEl("toggleCells").dataset.forced = "0";
  if (forced && layerIsOn("toggleCells")) toggleCells();
}

export const RouteCreator = { open: createRoute };
