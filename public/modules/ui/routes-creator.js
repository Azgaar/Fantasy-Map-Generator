"use strict";

function createRoute(defaultGroup) {
  if (customization) return;
  closeDialogs();
  if (!layerIsOn("toggleRoutes")) toggleRoutes();

  byId("toggleCells").dataset.forced = +!layerIsOn("toggleCells");
  if (!layerIsOn("toggleCells")) toggleCells();

  tip("Click to add route point, click again to remove", true);
  debug.append("g").attr("id", "controlCells");
  debug.append("g").attr("id", "controlPoints");
  viewbox.style("cursor", "crosshair").on("click", onClick);

  createRoute.points = [];
  const body = byId("routeCreatorBody");

  // update route groups
  byId("routeCreatorGroupSelect").innerHTML = Array.from(routes.selectAll("g")._groups[0]).map(el => {
    const selected = defaultGroup || "roads";
    return `<option value="${el.id}" ${el.id === selected ? "selected" : ""}>${el.id}</option>`;
  });

  $("#routeCreator").dialog({
    title: "Create Route",
    resizable: false,
    position: {my: "left top", at: "left+10 top+10", of: "#map"},
    close: closeRouteCreator
  });

  if (modules.createRoute) return;
  modules.createRoute = true;

  // add listeners
  byId("routeCreatorGroupSelect").on("change", () => drawRoute(createRoute.points));
  byId("routeCreatorGroupEdit").on("click", editRouteGroups);
  byId("routeCreatorComplete").on("click", completeCreation);
  byId("routeCreatorCancel").on("click", () => $("#routeCreator").dialog("close"));
  body.on("click", ev => {
    if (ev.target.classList.contains("icon-trash-empty")) removePoint(ev.target.parentNode.dataset.point);
  });

  function onClick() {
    const [x, y] = d3.mouse(this);
    const cellId = findCell(x, y);
    const point = [rn(x, 2), rn(y, 2), cellId];
    createRoute.points.push(point);

    drawRoute(createRoute.points);

    body.innerHTML += `<div class="editorLine" style="display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 1em;" data-point="${point.join(
      "-"
    )}">
      <span><b>Cell</b>: ${cellId}</span>
      <span><b>X</b>: ${point[0]}</span>
      <span><b>Y</b>: ${point[1]}</span>
      <span data-tip="Remove the point" class="icon-trash-empty pointer"></span>
    </div>`;
  }

  function removePoint(pointString) {
    createRoute.points = createRoute.points.filter(p => p.join("-") !== pointString);
    drawRoute(createRoute.points);
    body.querySelector(`[data-point='${pointString}']`)?.remove();
  }

  function drawRoute(points) {
    debug
      .select("#controlCells")
      .selectAll("polygon")
      .data(points)
      .join("polygon")
      .attr("points", p => getPackPolygon(p[2]))
      .attr("class", "current");

    debug
      .select("#controlPoints")
      .selectAll("circle")
      .data(points)
      .join("circle")
      .attr("cx", d => d[0])
      .attr("cy", d => d[1])
      .attr("r", 0.6);

    const group = byId("routeCreatorGroupSelect").value;

    routes.select("#routeTemp").remove();
    routes
      .select("#" + group)
      .append("path")
      .attr("d", Routes.getPath({group, points}))
      .attr("id", "routeTemp");
  }

  function completeCreation() {
    const points = createRoute.points;
    if (points.length < 2) return tip("Add at least 2 points", false, "error");

    const routeId = Routes.getNextId();
    const group = byId("routeCreatorGroupSelect").value;
    const feature = pack.cells.f[points[0][2]];
    const route = {points, group, feature, i: routeId};
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

    routes.select("#routeTemp").attr("id", "route" + routeId);
    editRoute("route" + routeId);
  }

  function closeRouteCreator() {
    body.innerHTML = "";
    debug.select("#controlCells").remove();
    debug.select("#controlPoints").remove();
    routes.select("#routeTemp").remove();

    restoreDefaultEvents();
    clearMainTip();

    const forced = +byId("toggleCells").dataset.forced;
    byId("toggleCells").dataset.forced = 0;
    if (forced && layerIsOn("toggleCells")) toggleCells();
  }
}
