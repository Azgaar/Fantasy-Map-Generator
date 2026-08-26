import { select } from "d3";
import { closeDialogs, destroyDialog } from "@/components/dialog/dialog-helpers";
import { Layers } from "@/components/layers";
import { stopMapPlacement } from "@/components/map-placement";
import { clearMainTip, tip } from "@/components/tooltips";
import { applyDefaultViewboxEvents } from "@/components/viewbox-events";
import { Controllers } from "@/controllers";
import type { Route } from "@/generators/routes-generator";
import { ensureEl, getPointer, rn } from "../utils";

let creatorPoints: number[][] = [];

let isCellsLayerForced = false; // the cells layer is turned on for the editing mode

function open(defaultGroup?: string): void {
  if (customization) return;
  stopMapPlacement();
  closeDialogs();
  Layers.show("routes");

  isCellsLayerForced = !Layers.isOn("cells");
  Layers.show("cells");

  tip("Click to add route point", true);
  select("#debug").append("g").attr("id", "controlCells");
  select("#debug").append("g").attr("id", "controlPoints");
  select<SVGElement, unknown>("#viewbox").style("cursor", "crosshair").on("click", onClick);

  creatorPoints = [];
  renderDialog();

  // update route groups
  ensureEl("routeCreatorGroupSelect").innerHTML = select("#routes")
    .selectAll<SVGGElement, unknown>("g")
    .nodes()
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
  ensureEl("routeCreatorGroupSelect").addEventListener("change", () => drawRoute(creatorPoints));
  ensureEl("routeCreatorGroupEdit").addEventListener("click", () => void Controllers.RouteGroupsEditor.open());
  ensureEl("routeCreatorComplete").addEventListener("click", completeCreation);
  ensureEl("routeCreatorCancel").addEventListener("click", () => $("#routeCreator").dialog("close"));
  ensureEl("routeCreatorBody").addEventListener("click", onBodyClick);
}

function onBodyClick(ev: Event): void {
  const target = ev.target as HTMLElement;
  if (target.classList.contains("icon-trash-empty")) removePoint((target.parentNode as HTMLElement).dataset.point!);
}

function onClick(this: any, event: any): void {
  const [x, y] = getPointer(event, this);
  const cellId = Pack.findCell(x, y);
  const point = [rn(x, 2), rn(y, 2), cellId!];
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
    .attr("points", (p: number[]) => String(Pack.getPolygon(p[2])))
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

  select("#routes").select("#routeTemp").remove();
  select("#routes")
    .select(`#${group}`)
    .append("path")
    .attr("d", Routes.getPath({ group, points }))
    .attr("id", "routeTemp");
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

  select("#routes").select("#routeTemp").attr("id", `route${routeId}`);
  void Controllers.RouteEditor.open(`route${routeId}`);
}

function closeRouteCreator(): void {
  select("#debug").select("#controlCells").remove();
  select("#debug").select("#controlPoints").remove();
  select("#routes").select("#routeTemp").remove();

  applyDefaultViewboxEvents();
  clearMainTip();

  if (isCellsLayerForced) Layers.hide("cells");
  isCellsLayerForced = false;

  destroyDialog("routeCreator");
}

export const RouteCreator = { open };
