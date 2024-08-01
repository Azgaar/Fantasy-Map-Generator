"use strict";

function createRoute(defaultGroup) {
  if (customization) return;
  closeDialogs();
  if (!layerIsOn("toggleRoutes")) toggleRoutes();

  byId("toggleCells").dataset.forced = +!layerIsOn("toggleCells");
  if (!layerIsOn("toggleCells")) toggleCells();

  tip("Click to add route point, click again to remove", true);
  debug.append("g").attr("id", "controlCells");
  viewbox.style("cursor", "crosshair").on("click", onCellClick);

  createRoute.cells = [];
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
  byId("routeCreatorGroupEdit").on("click", editRouteGroups);
  byId("routeCreatorComplete").on("click", completeCreation);
  byId("routeCreatorCancel").on("click", () => $("#routeCreator").dialog("close"));
  body.on("click", ev => {
    if (ev.target.classList.contains("icon-trash-empty")) removeCell(+ev.target.parentNode.dataset.cell);
  });

  function onCellClick() {
    const cell = findCell(...d3.mouse(this));

    if (createRoute.cells.includes(cell)) removeCell(cell);
    else addCell(cell);
  }

  function addCell(cell) {
    createRoute.cells.push(cell);
    drawCells(createRoute.cells);

    body.innerHTML += `<li class="editorLine" data-cell="${cell}">
      <span>Cell ${cell}</span>
      <span data-tip="Remove the cell" class="icon-trash-empty pointer"></span>
    </li>`;
  }

  function removeCell(cell) {
    createRoute.cells = createRoute.cells.filter(c => c !== cell);
    drawCells(createRoute.cells);
    body.querySelector(`[data-cell='${cell}']`)?.remove();
  }

  function drawCells(cells) {
    debug
      .select("#controlCells")
      .selectAll("polygon")
      .data(cells)
      .join("polygon")
      .attr("points", getPackPolygon)
      .attr("class", "current");
  }

  function completeCreation() {
    const routeCells = createRoute.cells;
    if (routeCells.length < 2) return tip("Add at least 2 cells", false, "error");

    const routeId = Math.max(...pack.routes.map(route => route.i)) + 1;
    const group = byId("routeCreatorGroupSelect").value;
    const feature = pack.cells.f[routeCells[0]];
    const route = {cells: routeCells, group, feature, i: routeId};
    pack.routes.push(route);

    const links = pack.cells.routes;
    for (let i = 0; i < routeCells.length; i++) {
      const cellId = routeCells[i];
      const nextCellId = routeCells[i + 1];
      if (nextCellId) {
        if (!links[cellId]) links[cellId] = {};
        links[cellId][nextCellId] = routeId;

        if (!links[nextCellId]) links[nextCellId] = {};
        links[nextCellId][cellId] = routeId;
      }
    }

    const lineGen = d3.line();
    lineGen.curve(ROUTE_CURVES[group] || ROUTE_CURVES.default);
    const routePoints = Routes.getPoints(route, Routes.preparePointsArray());
    const path = round(lineGen(routePoints), 1);
    routes
      .select("#" + group)
      .append("path")
      .attr("d", path)
      .attr("id", "route" + routeId);

    editRoute("route" + routeId);
  }

  function closeRouteCreator() {
    body.innerHTML = "";
    debug.select("#controlCells").remove();
    restoreDefaultEvents();
    clearMainTip();

    const forced = +byId("toggleCells").dataset.forced;
    byId("toggleCells").dataset.forced = 0;
    if (forced && layerIsOn("toggleCells")) toggleCells();
  }
}
