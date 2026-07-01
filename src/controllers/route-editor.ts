import { drag, pointer, select } from "d3";
import { Controllers } from "@/controllers";
import type { Route } from "@/generators/routes-generator";
import { ensureEl, getPackPolygon, getSegmentId, rn } from "../utils";

const DIALOG_HTML = /* html */ `
  <div id="routeBody" style="padding-bottom: 0.3em">
    <div>
      <div class="label">Name:</div>
      <input id="routeName" data-tip="Type to rename the route" autocorrect="off" spellcheck="false" />
      <span data-tip="Speak the name. You can change voice and language in options" class="speaker">🔊</span>
      <span id="routeGenerateName" data-tip="Generate route name" class="icon-globe pointer"></span>
    </div>
    <div data-tip="Select route group">
      <div class="label">Group:</div>
      <select id="routeGroup"></select>
      <span id="routeGroupEdit" data-tip="Edit route groups" class="icon-pencil pointer"></span>
      <span id="routeEditStyle" data-tip="Edit style for the route group" class="icon-brush pointer"></span>
    </div>
    <div data-tip="Route length in selected units">
      <div class="label">Length:</div>
      <input id="routeLength" disabled />
    </div>
  </div>
  <div id="routeBottom">
    <button id="routeCreateSelectingCells" data-tip="Create a new route selecting route cells" class="icon-map-pin"></button>
    <button id="routeJoin" data-tip="Click to join the route to another route that starts or ends at the same cell" class="icon-link"></button>
    <button id="routeSplit" data-tip="Click on a control point to split the route there" class="icon-unlink"></button>
    <button id="routeElevationProfile" data-tip="Show the elevation profile for the route" class="icon-chart-area"></button>
    <button id="routeLegend" data-tip="Edit free text notes (legend) for the route" class="icon-edit"></button>
    <button id="routeLock" class="icon-lock-open" onmouseover="showElementLockTip(event)"></button>
    <button id="routeRemove" data-tip="Remove route" data-shortcut="Delete" class="icon-trash fastDelete"></button>
  </div>`;

function open(id: string): void {
  if (customization) return;
  if (elSelected && id === elSelected.attr("id")) return;
  closeDialogs(".stable");

  if (!layerIsOn("toggleRoutes")) toggleRoutes();
  ensureEl("toggleCells").dataset.forced = String(+!layerIsOn("toggleCells"));
  if (!layerIsOn("toggleCells")) toggleCells();

  elSelected = select<SVGElement, unknown>(`#${id}`).on("click", addControlPoint);

  tip(
    "Drag control points to change the route. Click on point to remove it. Click on the route to add additional control point. For major changes please create a new route instead",
    true
  );
  select("#debug").append("g").attr("id", "controlCells");
  select("#debug").append("g").attr("id", "controlPoints");

  ensureEl("routeEditor").innerHTML = DIALOG_HTML;

  {
    const route = getRoute();
    updateRouteData(route);
    drawControlPoints(route.points);
    drawCells(route.points);
    updateLockIcon();
  }

  // add listeners — dropped together with the dialog HTML on close
  ensureEl("routeCreateSelectingCells").on("click", showCreationDialog);
  ensureEl("routeSplit").on("click", togglePressed);
  ensureEl("routeJoin").on("click", openJoinRoutesDialog);
  ensureEl("routeElevationProfile").on("click", showRouteElevationProfile);
  ensureEl("routeLegend").on("click", editRouteLegend);
  ensureEl("routeLock").on("click", toggleLockButton);
  ensureEl("routeRemove").on("click", removeRoute);
  ensureEl("routeName").on("input", changeName);
  ensureEl("routeGroup").on("input", changeGroup);
  ensureEl("routeGroupEdit").on("click", openRouteGroupsEditor);
  ensureEl("routeEditStyle").on("click", editRouteGroupStyle);
  ensureEl("routeGenerateName").on("click", generateName);

  $("#routeEditor").dialog({
    title: "Edit Route",
    resizable: false,
    position: { my: "left top", at: "left+10 top+10", of: "#map" },
    close: closeRouteEditor
  });
}

function openRouteGroupsEditor(): void {
  void Controllers.RouteGroupsEditor.open();
}

function getRoute(): Route {
  const routeId = +elSelected.attr("id").slice(5);
  return pack.routes.find((route: Route) => route.i === routeId) as Route;
}

function updateRouteData(route: Route): void {
  route.name = route.name || Routes.generateName(route);
  ensureEl<HTMLInputElement>("routeName").value = route.name;

  const routeGroup = ensureEl<HTMLSelectElement>("routeGroup");
  routeGroup.options.length = 0;
  routes.selectAll<HTMLElement, unknown>("g").each(function () {
    routeGroup.options.add(new Option(this.id, this.id, false, this.id === route.group));
  });

  updateRouteLength(route);

  const isWaterRoute = route.points.some(([_x, _y, cellId]) => pack.cells.h[cellId] < 20);
  ensureEl("routeElevationProfile").style.display = isWaterRoute ? "none" : "inline-block";
}

function updateRouteLength(route: Route): void {
  route.length = Routes.getLength(route.i);
  ensureEl<HTMLInputElement>("routeLength").value = `${rn(route.length * distanceScale)} ${distanceUnitInput.value}`;
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
    .attr("points", (p: number[]) => getPackPolygon(p[2], pack));
}

function dragControlPoint(event: any): void {
  const route = getRoute();
  const initCell = event.subject[2];
  const pointIndex = route.points.indexOf(event.subject);

  event.on("drag", function (this: any, dragEvent: any) {
    this.setAttribute("cx", dragEvent.x);
    this.setAttribute("cy", dragEvent.y);

    const x = rn(dragEvent.x, 2);
    const y = rn(dragEvent.y, 2);
    const cellId = findCell(x, y);

    this.__data__ = route.points[pointIndex] = [x, y, cellId!];
    redrawRoute(route);
    drawCells(route.points);
  });

  event.on("end", () => {
    const movedToCell = findCell(event.x, event.y);

    if (movedToCell !== initCell) {
      const prev = route.points[pointIndex - 1];
      if (prev) {
        removeConnection(initCell, prev[2]);
        addConnection(movedToCell!, prev[2], route.i);
      }

      const next = route.points[pointIndex + 1];
      if (next) {
        removeConnection(initCell, next[2]);
        addConnection(movedToCell!, next[2], route.i);
      }
    }
  });
}

function redrawRoute(route: Route): void {
  elSelected.attr("d", Routes.getPath(route));
  updateRouteLength(route);
  if (ensureEl("elevationProfile").offsetParent) showRouteElevationProfile();
}

function addControlPoint(this: any, event: any): void {
  const route = getRoute();
  const [x, y] = pointer(event, this);
  const cellId = findCell(x, y);

  const point = [rn(x, 2), rn(y, 2), cellId!];
  const isNewCell = !route.points.some(p => p[2] === cellId);

  const index = getSegmentId(route.points as [number, number][], point as [number, number], 2);
  route.points.splice(index, 0, point);

  // check if added point is in new cell
  if (isNewCell) {
    const prev = route.points[index - 1];
    const next = route.points[index + 1];

    if (!prev) ERROR && console.error("Can't add control point to the start of the route");
    if (!next) ERROR && console.error("Can't add control point to the end of the route");
    if (!prev || !next) return;

    removeConnection(prev[2], next[2]);
    addConnection(prev[2], cellId!, route.i);
    addConnection(cellId!, next[2], route.i);

    drawCells(route.points);
  }

  drawControlPoints(route.points);
  redrawRoute(route);
}

function handleControlPointClick(this: any): void {
  const controlPoint = select(this);
  const point = controlPoint.datum() as number[];
  const route = getRoute();
  if (route.points.length < 3) return; // can't remove or split point if only 2 points in route

  const index = route.points.indexOf(point);

  const isSplitMode = ensureEl("routeSplit").classList.contains("pressed");
  if (isSplitMode) splitRoute();
  else removeControlPoint(controlPoint);

  function splitRoute(): void {
    const oldRoutePoints = route.points.slice(0, index + 1);
    const newRoutePoints = route.points.slice(index);

    // update old route
    route.points = oldRoutePoints;
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

    routes
      .select(`#${newRoute.group}`)
      .append("path")
      .attr("d", Routes.getPath(newRoute))
      .attr("id", `route${newRoute.i}`);

    ensureEl("routeSplit").classList.remove("pressed");
  }

  function removeControlPoint(controlPoint: any): void {
    const isOnlyPointInCell = route.points.filter(p => p[2] === point[2]).length === 1;
    if (isOnlyPointInCell) {
      const prev = route.points[index - 1];
      const next = route.points[index + 1];
      if (prev) removeConnection(prev[2], point[2]);
      if (next) removeConnection(point[2], next[2]);
      if (prev && next) addConnection(prev[2], next[2], route.i);
    }

    controlPoint.remove();
    route.points = route.points.filter(p => p !== point);

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
      r.name = r.name || Routes.generateName(r);
      r.length = r.length || Routes.getLength(r.i);
      const length = `${rn(r.length * distanceScale)} ${distanceUnitInput.value}`;
      return `<option value="${r.i}">${r.name} (${length})</option>`;
    });
    alertMessage.innerHTML = /* html */ `<div>Route to join with:
        <select>${options.join("")}</select>
      </div>`;

    $("#alert").dialog({
      title: "Join routes",
      width: fitContent(),
      position: { my: "left top", at: "left+10 top+150", of: "#map" },
      buttons: {
        Cancel: () => {
          $("#alert").dialog("close");
        },
        Join: () => {
          const selectedRouteId = +alertMessage.querySelector("select")!.value;
          const selectedRoute = pack.routes.find((r: Route) => r.i === selectedRouteId) as Route;
          joinRoutes(route, selectedRoute);
          tip("Routes joined", false, "success", 5000);
          $("#alert").dialog("close");
        }
      }
    });
  } else {
    tip("No routes to join with. Route must start or end at current route's start or end cell", false, "error", 4000);
  }
}

function joinRoutes(route: Route, joinedRoute: Route): void {
  if (route.points.at(-1)![2] === joinedRoute.points.at(0)![2]) {
    // joinedRoute starts at the end of current route
    route.points = [...route.points, ...joinedRoute.points.slice(1)];
  } else if (route.points.at(0)![2] === joinedRoute.points.at(-1)![2]) {
    // joinedRoute ends at the start of current route
    route.points = [...joinedRoute.points, ...route.points.slice(1)];
  } else if (route.points.at(0)![2] === joinedRoute.points.at(0)![2]) {
    // joinedRoute and current route both start at the same cell
    route.points = [...route.points.reverse(), ...joinedRoute.points.slice(1)];
  } else if (route.points.at(-1)![2] === joinedRoute.points.at(-1)![2]) {
    // joinedRoute and current route both end at the same cell
    route.points = [...route.points, ...joinedRoute.points.reverse().slice(1)];
  }

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
  ensureEl(group).appendChild(elSelected.node()!);
  getRoute().group = group;
}

function generateName(): void {
  const route = getRoute();
  route.name = ensureEl<HTMLInputElement>("routeName").value = Routes.generateName(route);
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
  const id = elSelected.attr("id");
  const route = getRoute();
  editNotes(id, route.name!);
}

function editRouteGroupStyle(): void {
  const { group } = getRoute();
  editStyle("routes", group);
}

function toggleLockButton(): void {
  const route = getRoute();
  route.lock = !route.lock;
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
  confirmationDialog({
    title: "Remove route",
    message: "Are you sure you want to remove the route? <br>This action cannot be reverted",
    confirm: "Remove",
    onConfirm: () => {
      Routes.remove(getRoute());
      $("#routeEditor").dialog("close");
    }
  });
}

function closeRouteEditor(): void {
  select("#controlPoints").remove();
  select("#controlCells").remove();

  elSelected.on("click", null);
  unselect();
  clearMainTip();

  const forced = +ensureEl("toggleCells").dataset.forced!;
  ensureEl("toggleCells").dataset.forced = "0";
  if (forced && layerIsOn("toggleCells")) toggleCells();

  ensureEl("routeEditor").innerHTML = "";
}

export const RouteEditor = { open };
