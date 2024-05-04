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

  drawControlPoints(getRoutePoints(getRoute()));
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
  byId("routeCreateSelectingCells").on("click", createRoute);
  byId("routeEditStyle").on("click", editRouteGroupStyle);
  byId("routeElevationProfile").on("click", showRouteElevationProfile);
  byId("routeLegend").on("click", editRouteLegend);
  byId("routeRemove").on("click", removeRoute);
  byId("routeName").on("input", changeName);
  byId("routeGroup").on("input", changeGroup);
  byId("routeNameCulture").on("click", generateNameCulture);
  byId("routeNameRandom").on("click", generateNameRandom);

  function getRoute() {
    const routeId = +elSelected.attr("id").slice(5);
    const route = pack.routes.find(r => r.i === routeId);
    return route;
  }

  function updateRouteData() {
    const route = getRoute();

    route.name = route.name || generateRouteName(route);
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

  function generateRouteName(route) {
    const {cells, burgs} = pack;

    const burgName = (() => {
      const priority = [route.cells.at(-1), route.cells.at(0), route.cells.slice(1, -1).reverse()];
      for (const cellId of priority) {
        const burgId = cells.burg[cellId];
        if (burgId) return burgs[burgId].name;
      }
    })();

    const type = route.group.replace(/s$/, "");
    if (burgName) return `${getAdjective(burgName)} ${type}`;

    return "Unnamed route";
  }

  function updateRouteLength(route) {
    route.length = rn(elSelected.node().getTotalLength() / 2, 2);
    const lengthUI = `${rn(route.length * distanceScaleInput.value)} ${distanceUnitInput.value}`;
    byId("routeLength").value = lengthUI;
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
      .on("click", removeControlPoint);
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

  function drawConnections() {
    debug.selectAll("line").remove();
    for (const [fromCellId, connections] of Object.entries(pack.cells.routes)) {
      const from = pack.cells.p[fromCellId];
      for (const toCellId of Object.keys(connections)) {
        const to = pack.cells.p[toCellId];
        debug
          .append("line")
          .attr("x1", from[0])
          .attr("y1", from[1])
          .attr("x2", to[0])
          .attr("y2", to[1])
          .attr("stroke", "red")
          .attr("stroke-width", 0.4)
          .attr("opacity", 0.5);
      }
    }
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

  function removeControlPoint() {
    this.remove();
    redrawRoute();
    drawCells();
  }

  function changeName() {
    getRoute().name = this.value;
  }

  function changeGroup() {
    const group = this.value;
    byId(group).appendChild(elSelected.node());
    getRoute().group = group;
  }

  function generateNameCulture() {
    const route = getRoute();
    const cell = ra(route.cells);
    const cultureId = pack.cells.culture[cell];
    route.name = routeName.value = Names.getCulture(cultureId);
  }

  function generateNameRandom() {
    const route = getRoute();
    route.name = routeName.value = Names.getBase(rand(nameBases.length - 1));
  }

  function showRouteElevationProfile() {
    const route = getRoute();
    const routeLen = rn(route.length * distanceScaleInput.value);
    showElevationProfile(route.cells, routeLen, false);
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

  function createRoute() {
    // TODO: white the code :)
  }

  function removeRoute() {
    alertMessage.innerHTML = "Are you sure you want to remove the route";
    $("#alert").dialog({
      resizable: false,
      width: "22em",
      title: "Remove route",
      buttons: {
        Remove: function () {
          const route = getRoute();
          const routes = pack.cells.routes;

          for (const from of route.cells) {
            for (const [to, routeId] of Object.entries(routes[from])) {
              if (routeId === route.i) {
                delete routes[from][to];
                delete routes[to][from];
              }
            }
          }

          pack.routes = pack.routes.filter(r => r.i !== route.i);

          $(this).dialog("close");
          elSelected.remove();
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
