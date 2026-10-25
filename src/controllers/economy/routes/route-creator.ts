import { select } from "d3";
import { Controllers } from "@/controllers";
import { Routes } from "@/model/economy/routes-generator";
import { Pack } from "@/model/graph/pack-generator";
import { setTempRoute } from "@/renderers/draw-routes";
import { Layers } from "@/renderers/layers";
import { Dialog } from "@/ui/dialog/dialog";

import { stopMapPlacement } from "@/ui/map/map-placement";
import { applyDefaultViewboxEvents } from "@/ui/map/viewbox-events";
import { clearMainTip, tip } from "@/ui/tooltips";
import { t } from "@/utils/i18n";
import { ensureEl, getPointer } from "@/utils/node-utils";
import { minmax, rn } from "@/utils/number-utils";

let creatorPoints: number[][] = [];

let isCellsLayerForced = false; // the cells layer is turned on for the editing mode

function open(defaultGroup?: string): void {
  if (options.app.mode) return;
  stopMapPlacement();
  Dialog.closeAll();
  Layers.show("routes");

  isCellsLayerForced = !Layers.isOn("cells");
  Layers.show("cells");

  tip(t("Click to add route point"), true);
  select("#debug").append("g").attr("id", "controlCells");
  select("#debug").append("g").attr("id", "controlPoints");
  select<SVGElement, unknown>("#viewbox").style("cursor", "crosshair").on("click", onClick);

  creatorPoints = [];
  renderDialog();

  // update route groups
  const selected = defaultGroup || "roads";
  ensureEl("routeCreatorGroupSelect").innerHTML = Object.keys(styles.routes.groups)
    .map(group => `<option value="${group}" ${group === selected ? "selected" : ""}>${group}</option>`)
    .join("");

  Dialog.open("routeCreator", {
    title: t("Create Route"),
    position: { my: "left top", at: "left+10 top+10", of: "#map" },
    onClose: closeRouteCreator
  });
}

function renderDialog(): void {
  Dialog.destroy("routeCreator");

  const html = /* html */ `<div id="routeCreator" class="dialog">
    <div>${t("Click on map to add/remove route points")}</div>
    <div id="routeCreatorBody" class="table" style="margin: 0.3em 0"></div>
    <div id="routeCreatorBottom">
      <button id="routeCreatorComplete" data-tip="${t("Complete route creation")}" class="icon-check"></button>
      <button id="routeCreatorCancel" data-tip="${t("Cancel the creation")}" class="icon-cancel"></button>
      <div style="display: inline-block">
        ${t("Group")}:
        <select id="routeCreatorGroupSelect"></select>
        <span id="routeCreatorGroupEdit" data-tip="${t("Edit route groups")}" class="icon-pencil pointer"></span>
      </div>
    </div>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);

  // add listeners — dropped together with the dialog HTML on close
  ensureEl("routeCreatorGroupSelect").addEventListener("change", () => drawRoute(creatorPoints));
  ensureEl("routeCreatorGroupEdit").addEventListener("click", () => void Controllers.RouteGroupsEditor.open());
  ensureEl("routeCreatorComplete").addEventListener("click", completeCreation);
  ensureEl("routeCreatorCancel").addEventListener("click", () => Dialog.close("routeCreator"));
  ensureEl("routeCreatorBody").addEventListener("click", onBodyClick);
}

function onBodyClick(ev: Event): void {
  const target = ev.target as HTMLElement;
  if (target.classList.contains("icon-trash-empty")) removePoint((target.parentNode as HTMLElement).dataset.point!);
}

function onClick(this: SVGElement, event: MouseEvent): void {
  const [px, py] = getPointer(event, this);
  const x = minmax(px, 0, options.map.graph.width); // a route point must be on the map
  const y = minmax(py, 0, options.map.graph.height);
  const cellId = Pack.findCell(x, y);
  const point = [rn(x, 2), rn(y, 2), cellId!];
  creatorPoints.push(point);

  drawRoute(creatorPoints);

  ensureEl("routeCreatorBody").innerHTML +=
    `<div class="editorLine" style="display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 1em;" data-point="${point.join(
      "-"
    )}">
      <span><b>${t("Cell")}</b>: ${cellId}</span>
      <span><b>X</b>: ${point[0]}</span>
      <span><b>Y</b>: ${point[1]}</span>
      <span data-tip="${t("Remove")}" class="icon-trash-empty pointer"></span>
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
  setTempRoute({ group, points });
}

function completeCreation(): void {
  const points = creatorPoints;
  if (points.length < 2) {
    tip(t("Add at least 2 points"), false, "error");
    return;
  }

  const group = ensureEl<HTMLSelectElement>("routeCreatorGroupSelect").value;
  const routeId = Routes.create(points, group);

  setTempRoute(null);
  Layers.draw("routes", "trade");
  void Controllers.RouteEditor.open(`route${routeId}`);
}

function closeRouteCreator(): void {
  select("#debug").select("#controlCells").remove();
  select("#debug").select("#controlPoints").remove();
  setTempRoute(null);

  applyDefaultViewboxEvents();
  clearMainTip();

  if (isCellsLayerForced) Layers.hide("cells");
  isCellsLayerForced = false;

  Dialog.destroy("routeCreator");
}

export const RouteCreator = { open };
