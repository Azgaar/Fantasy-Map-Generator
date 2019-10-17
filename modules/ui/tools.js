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
  if (button === "editProvincesButton") editProvinces(); else
  if (button === "editDiplomacyButton") editDiplomacy(); else
  if (button === "editCulturesButton") editCultures(); else
  if (button === "editReligions") editReligions(); else
  if (button === "editNamesBaseButton") editNamesbase(); else
  if (button === "overviewBurgsButton") editBurgs(); else
  if (button === "editUnitsButton") editUnits(); else
  if (button === "editNotesButton") editNotes(); else
  if (button === "editZonesButton") editZones();

  // Click to Regenerate buttons
  if (event.target.parentNode.id === "regenerateFeature") {
    if (sessionStorage.getItem("regenerateFeatureDontAsk")) {processFeatureRegeneration(event, button); return;}

    alertMessage.innerHTML = `Regeneration will remove all the custom changes for the element.<br><br>Are you sure you want to proceed?`
    $("#alert").dialog({resizable: false, title: "Regenerate element",
      buttons: {
        Proceed: function() {processFeatureRegeneration(event, button); $(this).dialog("close");},
        Cancel: function() {$(this).dialog("close");}
      },
      open: function() {
        const pane = $(this).dialog("widget").find(".ui-dialog-buttonpane");
        $('<span><input id="dontAsk" class="checkbox" type="checkbox"><label for="dontAsk" class="checkbox-label dontAsk"><i>do not ask again</i></label><span>').prependTo(pane);
      },
      close: function() {
        const box = $(this).dialog("widget").find(".checkbox")[0];
        if (!box) return;
        if (box.checked) sessionStorage.setItem("regenerateFeatureDontAsk", true);
        $(this).dialog("destroy");
      }
    });
  }

  // Click to Add buttons
  if (button === "addLabel") toggleAddLabel(); else
  if (button === "addBurgTool") toggleAddBurg(); else
  if (button === "addRiver") toggleAddRiver(); else
  if (button === "addRoute") toggleAddRoute(); else
  if (button === "addMarker") toggleAddMarker();
});

function processFeatureRegeneration(event, button) {
  if (button === "regenerateStateLabels") {BurgsAndStates.drawStateLabels(); if (!layerIsOn("toggleLabels")) toggleLabels();} else 
  if (button === "regenerateReliefIcons") {ReliefIcons(); if (!layerIsOn("toggleRelief")) toggleRelief();} else 
  if (button === "regenerateRoutes") {Routes.regenerate(); if (!layerIsOn("toggleRoutes")) toggleRoutes();} else 
  if (button === "regenerateRivers") regenerateRivers(); else
  if (button === "regeneratePopulation") recalculatePopulation(); else
  if (button === "regenerateBurgs") regenerateBurgs(); else
  if (button === "regenerateStates") regenerateStates(); else
  if (button === "regenerateProvinces") regenerateProvinces(); else
  if (button === "regenerateReligions") regenerateReligions(); else
  if (button === "regenerateMarkers") regenerateMarkers(event); else
  if (button === "regenerateZones") regenerateZones(event);
}

function regenerateRivers() {
  const heights = new Float32Array(pack.cells.h);
  Rivers.generate();
  pack.cells.h = new Float32Array(heights);
  if (!layerIsOn("toggleRivers")) toggleRivers();
}

function recalculatePopulation() {
  rankCells();
  pack.burgs.forEach(b => {
    if (!b.i || b.removed) return;
    const i = b.cell;

    b.population = rn(Math.max((pack.cells.s[i] + pack.cells.road[i]) / 8 + b.i / 1000 + i % 100 / 1000, .1), 3);
    if (b.capital) b.population = b.population * 1.3; // increase capital population
    if (b.port) b.population = b.population * 1.3; // increase port population
    b.population = rn(b.population * gauss(2,3,.6,20,3), 3);
  });
}

function regenerateBurgs() {
  const cells = pack.cells, states = pack.states;
  rankCells();
  cells.burg = new Uint16Array(cells.i.length);
  const burgs = pack.burgs = [0]; // clear burgs array
  states.filter(s => s.i).forEach(s => s.capital = 0); // clear capitals
  const burgsTree = d3.quadtree();

  const score = new Int16Array(cells.s.map(s => s * Math.random())); // cell score for capitals placement
  const sorted = cells.i.filter(i => score[i] > 0 && cells.culture[i]).sort((a, b) => score[b] - score[a]); // filtered and sorted array of indexes
  const burgsCount = manorsInput.value == 1000 ? rn(sorted.length / 5 / (grid.points.length / 10000) ** .8) + states.length : +manorsInput.value + states.length;
  const spacing = (graphWidth + graphHeight) / 150 / (burgsCount ** .7 / 66); // base min distance between towns

  for (let i=0; i < sorted.length && burgs.length < burgsCount; i++) {
    const id = burgs.length;
    const cell = sorted[i];
    const x = cells.p[cell][0], y = cells.p[cell][1];

    const s = spacing * gauss(1, .3, .2, 2, 2); // randomize to make the placement not uniform
    if (burgsTree.find(x, y, s) !== undefined) continue; // to close to existing burg

    const state = cells.state[cell];
    const capital = !states[state].capital; // if state doesn't have capital, make this burg a capital
    if (capital) {states[state].capital = id; states[state].center = cell;}

    const culture = cells.culture[cell];
    const name = Names.getCulture(culture);
    burgs.push({cell, x, y, state, i: id, culture, name, capital, feature: cells.f[cell]});
    burgsTree.add([x, y]);
    cells.burg[cell] = id;
  }

  // add a capital at former place for states without added capitals
  states.filter(s => s.i && !s.removed && !s.capital).forEach(s => {
    const burg = addBurg([cells.p[s.center][0], cells.p[s.center][1]]); // add new burg
    s.capital = burg;
    s.center = pack.burgs[burg].cell;
    pack.burgs[burg].capital = 1;
    pack.burgs[burg].state = s.i;
    moveBurgToGroup(burg, "cities");
  });

  BurgsAndStates.specifyBurgs();
  BurgsAndStates.defineBurgFeatures();
  BurgsAndStates.drawBurgs();
  Routes.regenerate();

  if (document.getElementById("burgsEditorRefresh").offsetParent) burgsEditorRefresh.click();
  if (document.getElementById("statesEditorRefresh").offsetParent) statesEditorRefresh.click();
}

function regenerateStates() {
  Math.seedrandom(Math.floor(Math.random() * 1e9)); // new random seed
  const burgs = pack.burgs.filter(b => b.i && !b.removed);
  if (!burgs.length) {
    tip("No burgs to generate states. Please create burgs first", false, "error");
    return;
  }
  if (burgs.length < +regionsInput.value) {
    tip(`Not enought burgs to generate ${regionsInput.value} states. Will generate only ${burgs.length} states`, false, "warn");
  }

  // burg ids sorted by a bit randomized population:
  const sorted = burgs.map(b => [b.i, b.population * Math.random()]).sort((a, b) => b[1] - a[1]).map(b => b[0]);
  const capitalsTree = d3.quadtree();

  // turn all old capitals into towns
  burgs.filter(b => b.capital).forEach(b => {
    moveBurgToGroup(b.i, "towns");
    b.capital = 0;
  });

  unfog();

  // if desired states number is 0
  if (regionsInput.value == 0) {
    tip(`Cannot generate zero states. Please check the <i>States Number</i> option`, false, "warn");
    pack.states = pack.states.slice(0,1); // remove all except of neutrals
    pack.states[0].diplomacy = []; // clear diplomacy
    pack.provinces = [0]; // remove all provinces
    pack.cells.state = new Uint16Array(pack.cells.i.length); // reset cells data
    borders.selectAll("path").remove(); // remove borders
    regions.selectAll("path").remove(); // remove states fill
    labels.select("#states").selectAll("text"); // remove state labels
    defs.select("#textPaths").selectAll("path[id*='stateLabel']").remove(); // remove state labels paths

    if (document.getElementById("burgsEditorRefresh").offsetParent) burgsEditorRefresh.click();
    if (document.getElementById("statesEditorRefresh").offsetParent) statesEditorRefresh.click();
    return;
  }

  const neutral = pack.states[0].name;
  const count = Math.min(+regionsInput.value, burgs.length);
  let spacing = (graphWidth + graphHeight) / 2 / count; // min distance between capitals
  pack.states = d3.range(count).map(i => {
    if (!i) return {i, name: neutral};

    let capital = null, x = 0, y = 0;
    for (let i=0; i < sorted.length; i++) {
      capital = burgs[sorted[i]];
      x = capital.x, y = capital.y;
      if (capitalsTree.find(x, y, spacing) === undefined) break;
      spacing = Math.max(spacing - 1, 1);
    }

    capitalsTree.add([x, y]);
    capital.capital = 1;
    moveBurgToGroup(capital.i, "cities");

    const culture = capital.culture;
    const basename = capital.name.length < 9 && capital.cell%5 === 0 ? capital.name : Names.getCulture(culture, 3, 6, "", 0);
    const name = Names.getState(basename, culture);
    const nomadic = [1, 2, 3, 4].includes(pack.cells.biome[capital.cell]);
    const type = nomadic ? "Nomadic" : pack.cultures[culture].type === "Nomadic" ? "Generic" : pack.cultures[culture].type;
    const expansionism = rn(Math.random() * powerInput.value + 1, 1);
    return {i, name, type, capital:capital.i, center:capital.cell, culture, expansionism};
  });

  BurgsAndStates.expandStates();
  BurgsAndStates.normalizeStates();
  BurgsAndStates.collectStatistics();
  BurgsAndStates.assignColors();
  BurgsAndStates.generateDiplomacy();
  BurgsAndStates.defineStateForms();
  BurgsAndStates.generateProvinces(true);
  if (!layerIsOn("toggleStates")) toggleStates(); else drawStates();
  if (!layerIsOn("toggleBorders")) toggleBorders(); else drawBorders();
  BurgsAndStates.drawStateLabels();

  if (document.getElementById("burgsEditorRefresh").offsetParent) burgsEditorRefresh.click();
  if (document.getElementById("statesEditorRefresh").offsetParent) statesEditorRefresh.click();
}

function regenerateProvinces() {
  unfog();
  BurgsAndStates.generateProvinces(true);
  drawBorders();
  if (layerIsOn("toggleProvinces")) drawProvinces();
}

function regenerateReligions() {
  Religions.generate();
  if (!layerIsOn("toggleReligions")) toggleReligions(); else drawReligions();
}

function regenerateMarkers(event) {
  let number = gauss(1, .5, .3, 5, 2);

  if (event.ctrlKey) {
    const numberManual = prompt("Please provide markers number multiplier", 1);
    if (numberManual === null || numberManual === "" || isNaN(+numberManual)) {
      tip("The number provided is invalid, please try again and provide a valid number", false, "error", 4000);
      return;
    }

    number = Math.min(+numberManual, 100);
  }

  // remove existing markers and assigned notes  
  markers.selectAll("use").each(function() {
    const index = notes.findIndex(n => n.id === this.id);
    if (index != -1) notes.splice(index, 1);
  }).remove();

  addMarkers(number);
}

function regenerateZones(event) {
  let number = gauss(1, .5, .6, 5, 2);

  if (event.ctrlKey) {
    const numberManual = prompt("Please provide zones number multiplier", 1);
    if (numberManual === null || numberManual === "" || isNaN(+numberManual)) {
      tip("The number provided is invalid, please try again and provide a valid number", false, "error", 4000);
      return;
    }

    number = Math.min(+numberManual, 100);
  }

  zones.selectAll("g").remove(); // remove existing zones
  addZones(number);
  if (document.getElementById("zonesEditorRefresh").offsetParent) zonesEditorRefresh.click();
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

  const example = group.append("text").attr("x", 0).attr("x", 0).text(name);
  const width = example.node().getBBox().width;
  const x = width / -2; // x offset;
  example.remove();

  group.classed("hidden", false);
  group.append("text").attr("id", id)
    .append("textPath").attr("xlink:href", "#textPath_"+id).attr("startOffset", "50%").attr("font-size", "100%")
    .append("tspan").attr("x", x).text(name);

  defs.select("#textPaths")
    .append("path").attr("id", "textPath_"+id)
    .attr("d", `M${point[0]-width},${point[1]} h${width*2}`);

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
  let depressed = false;
  const heights = new Uint8Array(pack.cells.h); // initial heights

  while (i) {
    cells.r[i] = river;
    const x = cells.p[i][0], y = cells.p[i][1];
    dataRiver.push({x, y, cell:i});

    let min = cells.c[i][d3.scan(cells.c[i], (a, b) => cells.h[a] - cells.h[b])]; // downhill cell

    if (cells.h[i] <= cells.h[min]) {
      if (depressed) {tip("The heightmap is too depressed, please try again", false, "error"); return;}
      depressed = Rivers.resolveDepressions();
      min = cells.c[i][d3.scan(cells.c[i], (a, b) => cells.h[a] - cells.h[b])];
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

  const points = Rivers.addMeandring(dataRiver, Math.random() * .5 + .1);
  const width = Math.random() * .5 + .9;
  const increment = Math.random() * .4 + .8;
  const d = Rivers.getPath(points, width, increment);
  rivers.append("path").attr("d", d).attr("id", "river"+river).attr("data-width", width).attr("data-increment", increment);

  if (depressed) {
    if (layerIsOn("toggleHeight")) drawHeightmap();
    alertMessage.innerHTML = `<p>Heightmap is depressed and the system had to change the heightmap to allow water flux.</p>
    Would you like to <i>keep</i> the changes or <i>restore</i> the initial heightmap?`;

    $("#alert").dialog({resizable: false, title: "Heightmap is changed", width: "30em", modal: true,
      buttons: {
        Keep: function() {$(this).dialog("close");},
        Restore: function() {
          $(this).dialog("close");
          pack.cells.h = new Float32Array(heights);
          if (layerIsOn("toggleHeight")) drawHeightmap();
        }
      }
    });
  }

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