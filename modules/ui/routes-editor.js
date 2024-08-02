"use strict";

function editRoute(id) {
  if (customization) return;
  if (elSelected && id === elSelected.attr("id")) return;
  closeDialogs(".stable");

  if (!layerIsOn("toggleRoutes")) toggleRoutes();
  byId("toggleCells").dataset.forced = +!layerIsOn("toggleCells");
  if (!layerIsOn("toggleCells")) toggleCells();

  elSelected = d3.select("#" + id).on("click", addControlPoint);

  tip(
    "Drag control points to change the route. Click on point to remove it. Click on the route to add additional control point. For major changes please create a new route instead",
    true
  );
  debug.append("g").attr("id", "controlCells");
  debug.append("g").attr("id", "controlPoints");

  updateRouteData();

  const route = getRoute();
  drawControlPoints(Routes.getPoints(route, Routes.preparePointsArray()));
  drawCells();

  $("#routeEditor").dialog({
    title: "Edit Route",
    resizable: false,
    position: {my: "left top", at: "left+10 top+10", of: "#map"},
    close: closeRouteEditor
  });

  if (modules.editRoute) return;
  modules.editRoute = true;

  // add listeners
  byId("routeCreateSelectingCells").on("click", showCreationDialog);
  byId("routeSplit").on("click", togglePressed);
  byId("routeJoin").on("click", openJoinRoutesDialog);
  byId("routeElevationProfile").on("click", showRouteElevationProfile);
  byId("routeLegend").on("click", editRouteLegend);
  byId("routeRemove").on("click", removeRoute);
  byId("routeName").on("input", changeName);
  byId("routeGroup").on("input", changeGroup);
  byId("routeGroupEdit").on("click", editRouteGroups);
  byId("routeEditStyle").on("click", editRouteGroupStyle);
  byId("routeGenerateName").on("click", generateName);

  function getRoute() {
    const routeId = +elSelected.attr("id").slice(5);
    return pack.routes.find(route => route.i === routeId);
  }

  function updateRouteData() {
    const route = getRoute();

    route.name = route.name || Routes.generateName(route);
    byId("routeName").value = route.name;

    const routeGroup = byId("routeGroup");
    routeGroup.options.length = 0;
    routes.selectAll("g").each(function () {
      routeGroup.options.add(new Option(this.id, this.id, false, this.id === route.group));
    });

    updateRouteLength(route);

    const isWater = route.cells.some(cell => pack.cells.h[cell] < 20);
    byId("routeElevationProfile").style.display = isWater ? "none" : "inline-block";
  }

  function updateRouteLength(route) {
    route.length = Routes.getLength(route.i);
    byId("routeLength").value = rn(route.length * distanceScale) + " " + distanceUnitInput.value;
  }

  function drawControlPoints(points) {
    debug
      .select("#controlPoints")
      .selectAll("circle")
      .data(points)
      .join("circle")
      .attr("cx", d => d[0])
      .attr("cy", d => d[1])
      .attr("r", 0.6)
      .call(d3.drag().on("start", dragControlPoint))
      .on("click", handleControlPointClick);
  }

  function drawCells() {
    const {cells} = getRoute();
    debug.select("#controlCells").selectAll("polygon").data(cells).join("polygon").attr("points", getPackPolygon);
  }

  function dragControlPoint() {
    const initCell = findCell(d3.event.x, d3.event.y);
    const route = getRoute();
    const cellIndex = route.cells.indexOf(initCell);

    d3.event.on("drag", function () {
      this.setAttribute("cx", d3.event.x);
      this.setAttribute("cy", d3.event.y);
      this.__data__ = [rn(d3.event.x, 2), rn(d3.event.y, 2)];

      redrawRoute();
      drawCells();
    });

    d3.event.on("end", () => {
      const movedToCell = findCell(d3.event.x, d3.event.y);

      if (movedToCell !== initCell) {
        route.cells[cellIndex] = movedToCell;

        const prevCell = route.cells[cellIndex - 1];
        if (prevCell) {
          removeConnection(initCell, prevCell);
          addConnection(movedToCell, prevCell, route.i);
        }

        const nextCell = route.cells[cellIndex + 1];
        if (nextCell) {
          removeConnection(initCell, nextCell);
          addConnection(movedToCell, nextCell, route.i);
        }
      }
    });
  }

  function redrawRoute() {
    const route = getRoute();
    route.points = debug.selectAll("#controlPoints > *").data();
    route.cells = unique(route.points.map(([x, y]) => findCell(x, y)));

    const lineGen = d3.line();
    lineGen.curve(ROUTE_CURVES[route.group] || ROUTE_CURVES.default);

    const path = round(lineGen(route.points), 1);
    elSelected.attr("d", path);

    updateRouteLength(route);
    if (byId("elevationProfile").offsetParent) showRouteElevationProfile();
  }

  function addControlPoint() {
    const [x, y] = d3.mouse(this);
    const route = getRoute();
    if (!route.points) route.points = debug.selectAll("#controlPoints > *").data();

    const point = [rn(x, 2), rn(y, 2)];
    const index = getSegmentId(route.points, point, 2);
    route.points.splice(index, 0, point);

    const cellId = findCell(x, y);
    if (!route.cells.includes(cellId)) {
      route.cells = unique(route.points.map(([x, y]) => findCell(x, y)));
      const cellIndex = route.cells.indexOf(cellId);

      const prev = route.cells[cellIndex - 1];
      const next = route.cells[cellIndex + 1];

      removeConnection(prev, next);
      addConnection(prev, cellId, route.i);
      addConnection(cellId, next, route.i);

      drawCells();
    }

    drawControlPoints(route.points);
    redrawRoute();
  }

  function handleControlPointClick() {
    const controlPoint = d3.select(this);

    const isSplitMode = byId("routeSplit").classList.contains("pressed");
    if (isSplitMode) return splitRoute(controlPoint);

    return removeControlPoint(controlPoint);

    function splitRoute(controlPoint) {
      const allPoints = debug.selectAll("#controlPoints > *").data();
      const pointIndex = allPoints.indexOf(controlPoint.datum());

      const oldRoutePoints = allPoints.slice(0, pointIndex + 1);
      const newRoutePoints = allPoints.slice(pointIndex);

      // update old route
      const oldRoute = getRoute();
      oldRoute.points = oldRoutePoints;
      oldRoute.cells = unique(oldRoute.points.map(([x, y]) => findCell(x, y)));
      drawControlPoints(oldRoute.points);
      drawCells();
      redrawRoute();

      // create new route
      const newRoute = {
        ...oldRoute,
        i: Math.max(...pack.routes.map(route => route.i)) + 1,
        cells: unique(newRoutePoints.map(([x, y]) => findCell(x, y))),
        points: newRoutePoints
      };
      pack.routes.push(newRoute);

      for (let i = 0; i < newRoute.cells.length; i++) {
        const cellId = newRoute.cells[i];
        const nextCellId = newRoute.cells[i + 1];
        if (nextCellId) addConnection(cellId, nextCellId, newRoute.i);
      }

      const lineGen = d3.line();
      lineGen.curve(ROUTE_CURVES[newRoute.group] || ROUTE_CURVES.default);
      routes
        .select("#" + newRoute.group)
        .append("path")
        .attr("d", round(lineGen(Routes.getPoints(newRoute, newRoutePoints)), 1))
        .attr("id", "route" + newRoute.i);

      byId("routeSplit").classList.remove("pressed");
    }

    function removeControlPoint(controlPoint) {
      const route = getRoute();

      if (!route.points) route.points = debug.selectAll("#controlPoints > *").data();
      const cellId = findCell(...controlPoint.datum());
      const routeAllCells = route.points.map(([x, y]) => findCell(x, y));

      const isOnlyPointInCell = routeAllCells.filter(cell => cell === cellId).length === 1;
      if (isOnlyPointInCell) {
        const index = route.cells.indexOf(cellId);
        const prev = route.cells[index - 1];
        const next = route.cells[index + 1];
        if (prev) removeConnection(prev, cellId);
        if (next) removeConnection(cellId, next);
        if (prev && next) addConnection(prev, next, route.i);
      }

      controlPoint.remove();
      route.points = debug.selectAll("#controlPoints > *").data();
      route.cells = unique(route.points.map(([x, y]) => findCell(x, y)));

      drawCells();
      redrawRoute();
    }
  }

  function openJoinRoutesDialog() {
    const route = getRoute();
    const firstCell = route.cells.at(0);
    const lastCell = route.cells.at(-1);

    const candidateRoutes = pack.routes.filter(r => {
      if (r.i === route.i) return false;
      if (r.group !== route.group) return false;
      if (r.cells.at(0) === lastCell) return true;
      if (r.cells.at(-1) === firstCell) return true;
      if (r.cells.at(0) === firstCell) return true;
      if (r.cells.at(-1) === lastCell) return true;
      return false;
    });

    if (candidateRoutes.length) {
      const options = candidateRoutes.map(r => {
        r.name = r.name || Routes.generateName(r);
        r.length = r.length || Routes.getLength(r.i);
        const length = rn(r.length * distanceScale) + " " + distanceUnitInput.value;
        return `<option value="${r.i}">${r.name} (${length})</option>`;
      });
      alertMessage.innerHTML = /* html */ `<div>Route to join with:
        <select>${options.join("")}</select>
      </div>`;

      $("#alert").dialog({
        title: "Join routes",
        width: fitContent(),
        position: {my: "center", at: "center", of: "svg"},
        buttons: {
          Cancel: () => {
            $("#alert").dialog("close");
          },
          Join: () => {
            const selectedRouteId = +alertMessage.querySelector("select").value;
            const selectedRoute = pack.routes.find(r => r.i === selectedRouteId);
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

  function joinRoutes(route, joinedRoute) {
    if (!route.points) route.points = debug.selectAll("#controlPoints > *").data();
    if (!joinedRoute.points) joinedRoute.points = Routes.getPoints(joinedRoute, Routes.preparePointsArray());

    if (route.cells.at(-1) === joinedRoute.cells.at(0)) {
      // joinedRoute starts at the end of current route
      route.cells = [...route.cells, ...joinedRoute.cells.slice(1)];
      route.points = [...route.points, ...joinedRoute.points.slice(1)];
    } else if (route.cells.at(0) === joinedRoute.cells.at(-1)) {
      // joinedRoute ends at the start of current route
      route.cells = [...joinedRoute.cells, ...route.cells.slice(1)];
      route.points = [...joinedRoute.points, ...route.points.slice(1)];
    } else if (route.cells.at(0) === joinedRoute.cells.at(0)) {
      // joinedRoute and current route both start at the same cell
      route.cells = [...route.cells.reverse(), ...joinedRoute.cells.slice(1)];
      route.points = [...route.points.reverse(), ...joinedRoute.points.slice(1)];
    } else if (route.cells.at(-1) === joinedRoute.cells.at(-1)) {
      // joinedRoute and current route both end at the same cell
      route.cells = [...route.cells, ...joinedRoute.cells.reverse().slice(1)];
      route.points = [...route.points, ...joinedRoute.points.reverse().slice(1)];
    }

    for (let i = 0; i < route.cells.length; i++) {
      const cellId = route.cells[i];
      const nextCellId = route.cells[i + 1];
      if (nextCellId) addConnection(cellId, nextCellId, route.i);
    }

    Routes.remove(joinedRoute);
    drawControlPoints(route.points);
    drawCells();
    redrawRoute();
  }

  function showCreationDialog() {
    const route = getRoute();
    createRoute(route.group);
  }

  function togglePressed() {
    this.classList.toggle("pressed");
  }

  function removeConnection(from, to) {
    const routes = pack.cells.routes;
    if (routes[from]) delete routes[from][to];
    if (routes[to]) delete routes[to][from];
  }

  function addConnection(from, to, routeId) {
    const routes = pack.cells.routes;

    if (!routes[from]) routes[from] = {};
    routes[from][to] = routeId;

    if (!routes[to]) routes[to] = {};
    routes[to][from] = routeId;
  }

  function changeName() {
    getRoute().name = this.value;
  }

  function changeGroup() {
    const group = this.value;
    byId(group).appendChild(elSelected.node());
    getRoute().group = group;
  }

  function generateName() {
    const route = getRoute();
    route.name = routeName.value = Routes.generateName(route);
  }

  function showRouteElevationProfile() {
    const route = getRoute();
    const length = rn(route.length * distanceScale);
    showElevationProfile(route.cells, length, false);
  }

  function editRouteLegend() {
    const id = elSelected.attr("id");
    const route = getRoute();
    editNotes(id, route.name);
  }

  function editRouteGroupStyle() {
    const {group} = getRoute();
    editStyle("routes", group);
  }

  function removeRoute() {
    alertMessage.innerHTML = "Are you sure you want to remove the route";
    $("#alert").dialog({
      resizable: false,
      width: "22em",
      title: "Remove route",
      buttons: {
        Remove: function () {
          Routes.remove(getRoute());
          $(this).dialog("close");
          $("#routeEditor").dialog("close");
        },
        Cancel: function () {
          $(this).dialog("close");
        }
      }
    });
  }

  function closeRouteEditor() {
    debug.select("#controlPoints").remove();
    debug.select("#controlCells").remove();

    elSelected.on("click", null);
    unselect();
    clearMainTip();

    const forced = +byId("toggleCells").dataset.forced;
    byId("toggleCells").dataset.forced = 0;
    if (forced && layerIsOn("toggleCells")) toggleCells();
  }
}
