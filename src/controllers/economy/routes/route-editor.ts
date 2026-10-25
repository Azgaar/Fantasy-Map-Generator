import { type D3DragEvent, drag, type Selection, select } from "d3";
import { Controllers } from "@/controllers";
import { type Route, Routes, UNNAMED_ROUTE } from "@/model/economy/routes-generator";
import { Pack } from "@/model/graph/pack-generator";
import { Tags } from "@/model/tags";
import { redrawRoute as redrawRouteShape, setEditedRoute } from "@/renderers/draw-routes";
import { Layers } from "@/renderers/layers";
import { speak } from "@/services/speech";
import { Dialog } from "@/ui/dialog/dialog";
import { noteButton } from "@/ui/dialog/dialog-helpers";
import { clearMainTip, tip } from "@/ui/tooltips";
import { getSegmentId } from "@/utils/common-utils";
import { sentences, t } from "@/utils/i18n";
import { ensureEl, findEl, getPointer } from "@/utils/node-utils";
import { rn } from "@/utils/number-utils";

let selectedRoute: Selection<SVGElement, unknown, HTMLElement, unknown>;

let isCellsLayerForced = false; // the cells layer is turned on for the editing mode

function open(id: string): void {
  if (options.app.mode) return;
  if (findEl("routeEditor") && id === selectedRoute.attr("id")) return;
  Dialog.closeAll(".stable");

  Layers.show("routes");
  isCellsLayerForced = !Layers.isOn("cells");
  Layers.show("cells");

  setEditedRoute(Number(id.slice(5))); // keep the route rendered while it is edited
  selectedRoute = select<SVGElement, unknown>(`#${id}`).on("click", addControlPoint);

  tip(
    sentences(
      t("Drag control points to change the route"),
      t("Click on point to remove it"),
      t("Click on the route to add additional control point"),
      t("For major changes please create a new route instead")
    ),
    true
  );
  select("#debug").append("g").attr("id", "controlCells");
  select("#debug").append("g").attr("id", "controlPoints");

  renderDialog();

  {
    const route = getRoute();
    updateRouteData(route);
    drawControlPoints(route.points);
    drawCells(route.points);
    updateLockIcon();
  }

  Dialog.open("routeEditor", {
    title: t("Edit Route"),
    position: { my: "left top", at: "left+10 top+10", of: "#map" },
    onClose: closeRouteEditor
  });
}

function renderDialog(): void {
  Dialog.destroy("routeEditor");

  const html = /* html */ `<div id="routeEditor" class="dialog">
    <div id="routeBody" style="padding-bottom: 0.3em">
      <div>
        <div class="label">${t("Name")}:</div>
        <input id="routeName" data-tip="${t("Type to rename")}" autocorrect="off" spellcheck="false" />
        <span id="routeNameSpeak" data-tip="${sentences(t("Speak the name"), t("You can change voice and language in options"))}" class="speaker">🔊</span>
        <span id="routeGenerateName" data-tip="${t("Generate route name")}" class="icon-globe pointer"></span>
      </div>
      <div data-tip="${t("Select route group")}">
        <div class="label">${t("Group")}:</div>
        <select id="routeGroup"></select>
        <span id="routeGroupEdit" data-tip="${t("Edit route groups")}" class="icon-pencil pointer"></span>
        <span id="routeEditStyle" data-tip="${t("Edit style")}" class="icon-brush pointer"></span>
      </div>
      <div data-tip="${t("Route tags (comma-separated)")}">
        <div class="label">${t("Tags")}:</div>
        <input
          id="routeTags"
          placeholder="${t("Tags")}"
          autocorrect="off"
          spellcheck="false"
        />
      </div>
      <div data-tip="${t("Route length in selected units")}">
        <div class="label">${t("Length")}:</div>
        <input id="routeLength" disabled />
      </div>
    </div>
    <div id="routeBottom">
      <button id="routeCreateSelectingCells" data-tip="${t("Create a new route selecting route cells")}" class="icon-map-pin"></button>
      <button id="routeJoin" data-tip="${t("Click to join the route to another route that starts or ends at the same cell")}" class="icon-link"></button>
      <button id="routeSplit" data-tip="${t("Click on a control point to split the route there")}" class="icon-unlink"></button>
      <button id="routeElevationProfile" data-tip="${t("Elevation profile")}" class="icon-chart-area"></button>
      ${noteButton("routeLegend", t("Edit free text notes (legend)"))}
      <button id="routeLock" class="icon-lock-open" data-lock-tip></button>
      <button id="routeRemove" data-tip="${t("Remove")}" data-shortcut="Delete" class="icon-trash fastDelete"></button>
    </div>
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
  ensureEl("routeTags").addEventListener("change", changeTags);
  ensureEl("routeGroupEdit").addEventListener("click", openRouteGroupsEditor);
  ensureEl("routeEditStyle").addEventListener("click", editRouteGroupStyle);
  ensureEl("routeGenerateName").addEventListener("click", generateName);
}

function openRouteGroupsEditor(): void {
  void Controllers.RouteGroupsEditor.open();
}

function getRoute(): Route {
  const routeId = +selectedRoute.attr("id").slice(5);
  return pack.routes.find((route: Route) => route.i === routeId) as Route;
}

function updateRouteData(route: Route): void {
  route.name = route.name || Routes.generateName(route) || UNNAMED_ROUTE;
  ensureEl<HTMLInputElement>("routeName").value = route.name;
  ensureEl<HTMLInputElement>("routeTags").value = Tags.format(route.tags);

  const routeGroup = ensureEl<HTMLSelectElement>("routeGroup");
  routeGroup.options.length = 0;
  for (const group of Object.keys(styles.routes.groups)) {
    routeGroup.options.add(new Option(group, group, false, group === route.group));
  }

  updateRouteLength(route);

  const isWaterRoute = route.points.some(([_x, _y, cellId]) => pack.cells.h[cellId] < 20);
  ensureEl("routeElevationProfile").style.display = isWaterRoute ? "none" : "inline-block";
}

function updateRouteLength(route: Route): void {
  route.length = Routes.getLength(route.i);
  ensureEl<HTMLInputElement>("routeLength").value =
    `${rn(route.length * options.map.units.distance.scale)} ${options.map.units.distance.unit}`;
}

function drawControlPoints(points: number[][]): void {
  select<SVGGElement, unknown>("#controlPoints")
    .selectAll<SVGCircleElement, number[]>("circle")
    .data(points)
    .join("circle")
    .attr("cx", (d: number[]) => d[0])
    .attr("cy", (d: number[]) => d[1])
    .attr("r", 0.6)
    .call(drag<SVGCircleElement, number[]>().on("start", dragControlPoint))
    .on("click", handleControlPointClick);
}

function drawCells(points: number[][]): void {
  select<SVGGElement, unknown>("#controlCells")
    .selectAll("polygon")
    .data(points)
    .join("polygon")
    .attr("points", (p: number[]) => String(Pack.getPolygon(p[2])));
}

type PointDrag = D3DragEvent<SVGCircleElement, number[], number[]>;

function dragControlPoint(event: PointDrag): void {
  const route = getRoute();
  const pointIndex = route.points.indexOf(event.subject);

  event.on("drag", function (this: SVGCircleElement, dragEvent: PointDrag) {
    this.setAttribute("cx", String(dragEvent.x));
    this.setAttribute("cy", String(dragEvent.y));

    const x = rn(dragEvent.x, 2);
    const y = rn(dragEvent.y, 2);
    const cellId = Pack.findCell(x, y);

    route.points[pointIndex] = [x, y, cellId!];
    select(this).datum(route.points[pointIndex]);
    redrawRoute(route);
    drawCells(route.points);
  });

  event.on("end", updateLinks);
}

function redrawRoute(route: Route): void {
  redrawRouteShape(route);
  updateRouteLength(route);
  if (findEl("elevationProfile")) showRouteElevationProfile();
  Layers.draw("labels");
}

function addControlPoint(this: SVGElement, event: MouseEvent): void {
  const route = getRoute();
  const [x, y] = getPointer(event, this);
  const cellId = Pack.findCell(x, y);

  const point = [rn(x, 2), rn(y, 2), cellId!];
  const index = getSegmentId(route.points as [number, number][], point as [number, number], 2);
  route.points.splice(index, 0, point);

  drawCells(route.points);
  drawControlPoints(route.points);
  redrawRoute(route);
  updateLinks();
}

function handleControlPointClick(this: SVGCircleElement): void {
  const controlPoint = select(this);
  const point = controlPoint.datum() as number[];
  const route = getRoute();
  if (route.points.length < 3) return; // can't remove or split point if only 2 points in route

  const index = route.points.indexOf(point);

  const isSplitMode = ensureEl("routeSplit").classList.contains("pressed");
  if (isSplitMode) splitRoute();
  else removeControlPoint(controlPoint);

  function splitRoute(): void {
    if (index < 1 || index > route.points.length - 2)
      return void tip(t("A route cannot be split at its end point"), false, "error");
    const newRouteId = Routes.split(route.i, index);
    drawControlPoints(route.points);
    drawCells(route.points);
    redrawRoute(route);
    redrawRouteShape(pack.routes.find((r: Route) => r.i === newRouteId)!);
    Layers.draw("trade");
    ensureEl("routeSplit").classList.remove("pressed");
  }

  function removeControlPoint(controlPoint: Selection<SVGCircleElement, unknown, null, undefined>): void {
    controlPoint.remove();
    route.points = route.points.filter(p => p !== point);

    drawCells(route.points);
    redrawRoute(route);
    updateLinks();
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
    const routeOptions = candidateRoutes.map((r: Route) => {
      r.name = r.name || Routes.generateName(r) || UNNAMED_ROUTE;
      r.length = r.length || Routes.getLength(r.i);
      const length = `${rn(r.length * options.map.units.distance.scale)} ${options.map.units.distance.unit}`;
      return `<option value="${r.i}">${r.name} (${length})</option>`;
    });
    const text = Dialog.message({
      message: /* html */ `<div>${t("Route to join with")}:
        <select>${routeOptions.join("")}</select>
      </div>`,
      title: t("Join routes"),
      width: "fit-content",
      position: { my: "left top", at: "left+10 top+150", of: "#map" },
      buttons: [
        { label: t("Cancel") },
        {
          label: t("Join"),
          onClick: () => {
            const selectedRouteId = +text.querySelector("select")!.value;
            const selectedRoute = pack.routes.find((r: Route) => r.i === selectedRouteId) as Route;
            joinRoutes(route, selectedRoute);
            tip(t("Routes joined"), false, "success", 5000);
          }
        }
      ]
    });
  } else {
    tip(
      t("No routes to join with. Route must start or end at current route's start or end cell"),
      false,
      "error",
      4000
    );
  }
}

function joinRoutes(route: Route, joinedRoute: Route): void {
  Routes.join(route.i, joinedRoute.i);
  Layers.draw("routes", "trade");
  drawControlPoints(route.points);
  redrawRoute(route);
  drawCells(route.points);
}

function showCreationDialog(): void {
  const route = getRoute();
  void Controllers.RouteCreator.open(route.group);
}

function togglePressed(this: HTMLElement): void {
  this.classList.toggle("pressed");
}

// trade paths follow the cell links and the route geometry
function updateLinks(): void {
  Routes.relink();
  Layers.draw("trade");
}

function changeName(this: HTMLInputElement): void {
  if (this.value.trim()) {
    Routes.rename(getRoute().i, this.value);
    Layers.draw("labels");
  }
}

function generateName(): void {
  const route = getRoute();
  const name = Routes.generateName(route) || UNNAMED_ROUTE;
  ensureEl<HTMLInputElement>("routeName").value = name;
  Routes.rename(route.i, name);
  Layers.draw("labels");
}

function changeGroup(this: HTMLInputElement): void {
  const route = getRoute();
  Routes.setGroup(route.i, this.value);
  redrawRouteShape(route); // the path is re-created under the new group, so re-bind the editor to it
  selectedRoute = select<SVGElement, unknown>(`#route${route.i}`).on("click", addControlPoint);
  Layers.draw("trade"); // searoutes animate as ships
}

function changeTags(this: HTMLInputElement): void {
  const route = getRoute();
  if (!route) return;
  Tags.set(route, this.value);
  this.value = Tags.format(route.tags);
}

function showRouteElevationProfile(): void {
  const route = getRoute();
  const length = rn(route.length! * options.map.units.distance.scale);
  void Controllers.ElevationProfile.open(
    route.points.map(p => p[2]),
    length,
    false
  );
}

function editRouteLegend(): void {
  void Controllers.NotesEditor.open({ type: "route", id: getRoute().i });
}

function editRouteGroupStyle(): void {
  const { group } = getRoute();
  void Controllers.StyleEditor.open("routes", group);
}

function toggleLockButton(): void {
  const route = getRoute();
  Routes.setLocked(route.i, !route.lock);
  updateLockIcon();
}

function updateLockIcon(): void {
  const route = getRoute();
  if (route.lock) {
    ensureEl("routeLock").classList.remove("icon-lock-open");
    ensureEl("routeLock").classList.add("icon-lock");
  } else {
    ensureEl("routeLock").classList.remove("icon-lock");
    ensureEl("routeLock").classList.add("icon-lock-open");
  }
}

function removeRoute(): void {
  Dialog.confirm({
    title: t("Remove"),
    message: `${t("Are you sure you want to remove the route?")}<br>${t("This action cannot be reverted")}`,
    confirm: t("Remove"),
    onConfirm: () => {
      Routes.remove(getRoute().i);
      Dialog.close("routeEditor");
      Layers.draw("routes", "labels", "trade");
    }
  });
}

function closeRouteEditor(): void {
  select("#controlPoints").remove();
  select("#controlCells").remove();

  selectedRoute.on("click", null);
  setEditedRoute(null);
  clearMainTip();

  if (isCellsLayerForced) Layers.hide("cells");
  isCellsLayerForced = false;

  Dialog.destroy("routeEditor");
  selectedRoute = null!;
}

export const RouteEditor = { open };
