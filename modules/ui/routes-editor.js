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

  {
    const route = getRoute();
    updateRouteData(route);
    drawControlPoints(route.points);
    drawCells(route.points);
    updateLockIcon();
  }

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
  byId("routeLock").on("click", toggleLockButton);
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

  function updateRouteData(route) {
    route.name = route.name || Routes.generateName(route);
    byId("routeName").value = route.name;

    const routeGroup = byId("routeGroup");
    routeGroup.options.length = 0;
    routes.selectAll("g").each(function () {
      routeGroup.options.add(new Option(this.id, this.id, false, this.id === route.group));
    });

    updateRouteLength(route);

    const isWater = route.points.some(([x, y, cellId]) => pack.cells.h[cellId] < 20);
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

  function drawCells(points) {
    debug
      .select("#controlCells")
      .selectAll("polygon")
      .data(points)
      .join("polygon")
      .attr("points", p => getPackPolygon(p[2]));
  }

  function dragControlPoint() {
    const route = getRoute();
    const initCell = d3.event.subject[2];
    const pointIndex = route.points.indexOf(d3.event.subject);

    d3.event.on("drag", function () {
      this.setAttribute("cx", d3.event.x);
      this.setAttribute("cy", d3.event.y);

      const x = rn(d3.event.x, 2);
      const y = rn(d3.event.y, 2);
      const cellId = findCell(x, y);

      this.__data__ = route.points[pointIndex] = [x, y, cellId];
      redrawRoute(route);
      drawCells(route.points);
    });

    d3.event.on("end", () => {
      const movedToCell = findCell(d3.event.x, d3.event.y);

      if (movedToCell !== initCell) {
        const prev = route.points[pointIndex - 1];
        if (prev) {
          removeConnection(initCell, prev[2]);
          addConnection(movedToCell, prev[2], route.i);
        }

        const next = route.points[pointIndex + 1];
        if (next) {
          removeConnection(initCell, next[2]);
          addConnection(movedToCell, next[2], route.i);
        }
      }
    });
  }

  function redrawRoute(route) {
    elSelected.attr("d", Routes.getPath(route));
    updateRouteLength(route);
    if (byId("elevationProfile").offsetParent) showRouteElevationProfile();
  }

  function addControlPoint() {
    const route = getRoute();
    const [x, y] = d3.mouse(this);
    const cellId = findCell(x, y);

    const point = [rn(x, 2), rn(y, 2), cellId];
    const isNewCell = !route.points.some(p => p[2] === cellId);

    const index = getSegmentId(route.points, point, 2);
    route.points.splice(index, 0, point);

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

  function handleControlPointClick() {
    const controlPoint = d3.select(this);

    const point = controlPoint.datum();
    const route = getRoute();
    const index = route.points.indexOf(point);

    const isSplitMode = byId("routeSplit").classList.contains("pressed");
    return isSplitMode ? splitRoute() : removeControlPoint(controlPoint);

    function splitRoute() {
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
      };
      pack.routes.push(newRoute);

      for (let i = 0; i < newRoute.points.length; i++) {
        const cellId = newRoute.points[i][2];
        const nextPoint = newRoute.points[i + 1];
        if (nextPoint) addConnection(cellId, nextPoint[2], newRoute.i);
      }

      routes
        .select("#" + newRoute.group)
        .append("path")
        .attr("d", Routes.getPath(newRoute))
        .attr("id", "route" + newRoute.i);

      byId("routeSplit").classList.remove("pressed");
    }

    function removeControlPoint(controlPoint) {
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

  function openJoinRoutesDialog() {
    const route = getRoute();
    const firstCell = route.points.at(0)[2];
    const lastCell = route.points.at(-1)[2];

    const candidateRoutes = pack.routes.filter(r => {
      if (r.i === route.i) return false;
      if (r.group !== route.group) return false;
      if (r.points.at(0)[2] === lastCell) return true;
      if (r.points.at(-1)[2] === firstCell) return true;
      if (r.points.at(0)[2] === firstCell) return true;
      if (r.points.at(-1)[2] === lastCell) return true;
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
        position: {my: "left top", at: "left+10 top+150", of: "#map"},
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
    if (route.points.at(-1)[2] === joinedRoute.points.at(0)[2]) {
      // joinedRoute starts at the end of current route
      route.points = [...route.points, ...joinedRoute.points.slice(1)];
    } else if (route.points.at(0)[2] === joinedRoute.points.at(-1)[2]) {
      // joinedRoute ends at the start of current route
      route.points = [...joinedRoute.points, ...route.points.slice(1)];
    } else if (route.points.at(0)[2] === joinedRoute.points.at(0)[2]) {
      // joinedRoute and current route both start at the same cell
      route.points = [...route.points.reverse(), ...joinedRoute.points.slice(1)];
    } else if (route.points.at(-1)[2] === joinedRoute.points.at(-1)[2]) {
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
    showElevationProfile(
      route.points.map(p => p[2]),
      length,
      false
    );
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

  function toggleLockButton() {
    const route = getRoute();
    route.lock = !route.lock;
    updateLockIcon();
  }

  function updateLockIcon() {
    const route = getRoute();
    if (route.lock) {
      byId("routeLock").classList.remove("icon-lock-open");
      byId("routeLock").classList.add("icon-lock");
    } else {
      byId("routeLock").classList.remove("icon-lock");
      byId("routeLock").classList.add("icon-lock-open");
    }
  }

  function removeRoute() {
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
