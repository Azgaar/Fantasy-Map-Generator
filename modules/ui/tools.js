// module to control the Tools options (click to edit, to re-geenerate, tp add)
"use strict";

toolsContent.addEventListener("click", function(event) {
  if (customization) {tip("Please exit the customization mode first", false, "warning"); return;}
  if (event.target.tagName !== "BUTTON") return;
  const button = event.target.id;

  // Click to open Editor buttons
  if (button === "editHeightmapButton") editHeightmap(); else
  if (button === "editBiomesButton") editBiomes(); else
  if (button === "editStatesButton") editStates(); else
  if (button === "editCulturesButton") editCultures(); else
  if (button === "editNamesBaseButton") editNamesbase(); else
  if (button === "editBurgsButton") editBurgs(); else
  if (button === "editUnitsButton") editUnits();

  // Click to Regenerate buttons
  if (button === "regenerateStateLabels") {BurgsAndStates.drawStateLabels(); if (!layerIsOn("toggleLabels")) toggleLabels();} else 
  if (button === "regenerateReliefIcons") {ReliefIcons(); if (!layerIsOn("toggleRelief")) toggleRelief();} else 
  if (button === "regenerateRoutes") {Routes.regenerate(); if (!layerIsOn("toggleRoutes")) toggleRoutes();} else 
  if (button === "regenerateRivers") {
    const heights = new Uint8Array(pack.cells.h);
    Rivers.generate();
    pack.cells.h = new Uint8Array(heights);
    if (!layerIsOn("toggleRivers")) toggleRivers();
  } else
  if (button === "regeneratePopulation") recalculatePopulation();

  // Click to Add buttons
  if (button === "addLabel") toggleAddLabel(); else
  if (button === "addBurgTool") toggleAddBurg(); else
  if (button === "addRiver") toggleAddRiver(); else
  if (button === "addRoute") toggleAddRoute(); else
  if (button === "addMarker") toggleAddMarker();
});

function recalculatePopulation() {
  rankCells();
  pack.burgs.forEach(b => {
    if (!b.i || b.removed) return;
    const i = b.cell;

    b.population = rn(Math.max((pack.cells.s[i] + pack.cells.road[i]) / 3 + b.i / 1000 + i % 100 / 1000, .1), 3);
    if (b.capital) b.population = rn(b.population * 1.3, 3); // increase capital population
    if (b.port) b.population = rn(b.population * 1.3, 3); // increase port population
  });
}

function unpressClickToAddButton() {
  addFeature.querySelectorAll("button.pressed").forEach(b => b.classList.remove("pressed"));
  restoreDefaultEvents();
  clearMainTip();
}

function toggleAddLabel() {
  const pressed = document.getElementById("addLabel").classList.contains("pressed");
  if (pressed) {unpressClickToAddButton(); return;}

  addFeature.querySelectorAll("button.pressed").forEach(b => b.classList.remove("pressed"));
  addLabel.classList.add('pressed');
  closeDialogs(".stable");
  viewbox.style("cursor", "crosshair").on("click", addLabelOnClick);
  tip("Click on map to place label. Hold Shift to add multiple", true);
  if (!layerIsOn("toggleLabels")) toggleLabels();
}

function addLabelOnClick() {
  const point = d3.mouse(this);

  // get culture in clicked point to generate a name
  const cell = findCell(point[0], point[1]);
  const culture = pack.cells.culture[cell];
  const name = Names.getCulture(culture);
  const id = getNextId("label");

  let group = labels.select("#addedLabels");
  if (!group.size()) group = labels.append("g").attr("id", "addedLabels")
    .attr("fill", "#3e3e4b").attr("opacity", 1).attr("stroke", "#3a3a3a")
    .attr("stroke-width", 0).attr("font-family", "Almendra SC").attr("data-font", "Almendra+SC")
    .attr("font-size", 18).attr("data-size", 18).attr("filter", null);

  group.append("text").attr("id", id)
    .append("textPath").attr("xlink:href", "#textPath_"+id).text(name)
    .attr("startOffset", "50%").attr("font-size", "100%");

  defs.select("#textPaths").append("path").attr("id", "textPath_"+id)
    .attr("d", `M${point[0]-60},${point[1]} h${120}`);

  if (d3.event.shiftKey === false) unpressClickToAddButton();
}

function toggleAddBurg() {
  unpressClickToAddButton();
  document.getElementById("addBurgTool").classList.add("pressed");
  editBurgs();
  document.getElementById("addNewBurg").click();
}

function toggleAddRiver() {
  const pressed = document.getElementById("addRiver").classList.contains("pressed");
  if (pressed) {unpressClickToAddButton(); return;}

  addFeature.querySelectorAll("button.pressed").forEach(b => b.classList.remove("pressed"));
  addRiver.classList.add('pressed');
  closeDialogs(".stable");
  viewbox.style("cursor", "crosshair").on("click", addRiverOnClick);
  tip("Click on map to place new river or extend an existing one. Hold Shift to place multiple rivers", true);
  if (!layerIsOn("toggleRivers")) toggleRivers();
}

function addRiverOnClick() {
  const cells = pack.cells;
  const point = d3.mouse(this);
  let i = findCell(point[0], point[1]);
  if (cells.r[i] || cells.h[i] < 20 || cells.b[i]) return;

  const dataRiver = []; // to store river points
  const river = +getNextId("river").slice(5); // river id
  cells.fl[i] = grid.cells.prec[cells.g[i]]; // initial flux
  let render = true;

  while (i) {
    cells.r[i] = river;
    const x = cells.p[i][0], y = cells.p[i][1];
    dataRiver.push({x, y, cell:i});

    const min = cells.c[i][d3.scan(cells.c[i], (a, b) => cells.h[a] - cells.h[b])]; // downhill cell

    if (cells.h[i] <= cells.h[min]) {
      tip(`Clicked cell is depressed! To resolve edit the heightmap and allow system to change heights`, false, "error");
      render = false;
      break;
    }

    const tx = cells.p[min][0], ty = cells.p[min][1];

    if (cells.h[min] < 20) {
      const px = (x + tx) / 2;
      const py = (y + ty) / 2;
      dataRiver.push({x: px, y: py, cell:i});
      break;
    }

    if (!cells.r[min]) {
      cells.fl[min] += cells.fl[i];
      i = min;
      continue;
    }

    const r = cells.r[min];
    const riverCellsUpper = cells.i.filter(i => cells.r[i] === r && cells.h[i] > cells.h[min]);

    // new river is not perspective
    if (dataRiver.length <= riverCellsUpper.length) {
      cells.conf[min] += cells.fl[i];
      dataRiver.push({x: tx, y: ty, cell: min});
      break;
    }

    // new river is more perspective
    rivers.select("#river"+r).remove();
    riverCellsUpper.forEach(i => cells.r[i] = 0);
    if (riverCellsUpper.length > 1) {
      // redraw upper part of the old river
    }

    cells.conf[min] = cells.fl[min];
    cells.fl[min] = cells.fl[i] + grid.cells.prec[cells.g[min]];
    i = min;
  }

  if (!render) return;
  const points = Rivers.addMeandring(dataRiver, Math.random() * .5 + .1);
  const width = Math.random() * .5 + .9;
  const increment = Math.random() * .4 + .8;
  const d = Rivers.getPath(points, width, increment);
  rivers.append("path").attr("d", d).attr("id", "river"+river).attr("data-width", width).attr("data-increment", increment);

  if (d3.event.shiftKey === false) unpressClickToAddButton();
}

function toggleAddRoute() {
  const pressed = document.getElementById("addRoute").classList.contains("pressed");
  if (pressed) {unpressClickToAddButton(); return;}

  addFeature.querySelectorAll("button.pressed").forEach(b => b.classList.remove("pressed"));
  addRoute.classList.add('pressed');
  closeDialogs(".stable");
  viewbox.style("cursor", "crosshair").on("click", addRouteOnClick);
  tip("Click on map to add a first control point", true);
  if (!layerIsOn("toggleRoutes")) toggleRoutes();
}

function addRouteOnClick() {
  unpressClickToAddButton();
  const point = d3.mouse(this);
  const id = getNextId("route");
  elSelected = routes.select("g").append("path").attr("id", id).attr("data-new", 1).attr("d", `M${point[0]},${point[1]}`);
  editRoute(true);
}

function toggleAddMarker() {
  const pressed = document.getElementById("addMarker").classList.contains("pressed");
  if (pressed) {unpressClickToAddButton(); return;}

  addFeature.querySelectorAll("button.pressed").forEach(b => b.classList.remove("pressed"));
  addMarker.classList.add('pressed');
  closeDialogs(".stable");
  viewbox.style("cursor", "crosshair").on("click", addMarkerOnClick);
  tip("Click on map to add a marker. Hold Shift to add multiple", true);
  if (!layerIsOn("toggleMarkers")) toggleMarkers();
}

function addMarkerOnClick() {
  const point = d3.mouse(this);
  const x = rn(point[0], 2), y = rn(point[1], 2);
  const id = getNextId("markerElement");

  const selected = markerSelectGroup.value;
  const valid = selected && d3.select("#defs-markers").select("#"+selected).size();
  const symbol = valid ? "#"+selected : "#marker0";
  const added = markers.select("[data-id='" + symbol + "']").size();
  let desired = valid && added ? markers.select("[data-id='" + symbol + "']").attr("data-size") : 1;
  if (isNaN(desired)) desired = 1;
  const size = desired * 5 + 25 / scale;

  markers.append("use").attr("id", id).attr("xlink:href", symbol).attr("data-id", symbol)
    .attr("data-x", x).attr("data-y", y).attr("x", x - size / 2).attr("y", y - size)
    .attr("data-size", desired).attr("width", size).attr("height", size);

  if (d3.event.shiftKey === false) unpressClickToAddButton();
}