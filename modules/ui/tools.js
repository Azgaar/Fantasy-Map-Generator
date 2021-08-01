// module to control the Tools options (click to edit, to re-geenerate, tp add)
"use strict";

toolsContent.addEventListener("click", function (event) {
  if (customization) {
    tip("Please exit the customization mode first", false, "warning");
    return;
  }
  if (event.target.tagName !== "BUTTON") return;
  const button = event.target.id;

  // Click to open Editor buttons
  if (button === "editHeightmapButton") editHeightmap();
  else if (button === "editBiomesButton") editBiomes();
  else if (button === "editStatesButton") editStates();
  else if (button === "editProvincesButton") editProvinces();
  else if (button === "editDiplomacyButton") editDiplomacy();
  else if (button === "editCulturesButton") editCultures();
  else if (button === "editReligions") editReligions();
  else if (button === "editEmblemButton") openEmblemEditor();
  else if (button === "editNamesBaseButton") editNamesbase();
  else if (button === "editUnitsButton") editUnits();
  else if (button === "editNotesButton") editNotes();
  else if (button === "editZonesButton") editZones();
  else if (button === "overviewBurgsButton") overviewBurgs();
  else if (button === "overviewRiversButton") overviewRivers();
  else if (button === "overviewMilitaryButton") overviewMilitary();
  else if (button === "overviewCellsButton") viewCellDetails();

  // Click to Regenerate buttons
  if (event.target.parentNode.id === "regenerateFeature") {
    if (sessionStorage.getItem("regenerateFeatureDontAsk")) {
      processFeatureRegeneration(event, button);
      return;
    }

    alertMessage.innerHTML = `Regeneration will remove all the custom changes for the element.<br><br>Are you sure you want to proceed?`;
    $("#alert").dialog({
      resizable: false,
      title: "Regenerate element",
      buttons: {
        Proceed: function () {
          processFeatureRegeneration(event, button);
          $(this).dialog("close");
        },
        Cancel: function () {
          $(this).dialog("close");
        }
      },
      open: function () {
        const pane = $(this).dialog("widget").find(".ui-dialog-buttonpane");
        $('<span><input id="dontAsk" class="checkbox" type="checkbox"><label for="dontAsk" class="checkbox-label dontAsk"><i>do not ask again</i></label><span>').prependTo(pane);
      },
      close: function () {
        const box = $(this).dialog("widget").find(".checkbox")[0];
        if (!box) return;
        if (box.checked) sessionStorage.setItem("regenerateFeatureDontAsk", true);
        $(this).dialog("destroy");
      }
    });
  }

  // Click to Add buttons
  if (button === "addLabel") toggleAddLabel();
  else if (button === "addBurgTool") toggleAddBurg();
  else if (button === "addRiver") toggleAddRiver();
  else if (button === "addRoute") toggleAddRoute();
  else if (button === "addMarker") toggleAddMarker();
});

function processFeatureRegeneration(event, button) {
  if (button === "regenerateStateLabels") {
    BurgsAndStates.drawStateLabels();
    if (!layerIsOn("toggleLabels")) toggleLabels();
  } else if (button === "regenerateReliefIcons") {
    ReliefIcons();
    if (!layerIsOn("toggleRelief")) toggleRelief();
  } else if (button === "regenerateRoutes") {
    Routes.regenerate();
    if (!layerIsOn("toggleRoutes")) toggleRoutes();
  } else if (button === "regenerateRivers") regenerateRivers();
  else if (button === "regeneratePopulation") recalculatePopulation();
  else if (button === "regenerateStates") regenerateStates();
  else if (button === "regenerateProvinces") regenerateProvinces();
  else if (button === "regenerateBurgs") regenerateBurgs();
  else if (button === "regenerateEmblems") regenerateEmblems();
  else if (button === "regenerateReligions") regenerateReligions();
  else if (button === "regenerateCultures") regenerateCultures();
  else if (button === "regenerateMilitary") regenerateMilitary();
  else if (button === "regenerateIce") regenerateIce();
  else if (button === "regenerateMarkers") regenerateMarkers(event);
  else if (button === "regenerateZones") regenerateZones(event);
}

async function openEmblemEditor() {
  let type, id, el;

  if (pack.states[1]?.coa) {
    type = "state";
    id = "stateCOA1";
    el = pack.states[1];
  } else if (pack.burgs[1]?.coa) {
    type = "burg";
    id = "burgCOA1";
    el = pack.burgs[1];
  } else {
    tip("No emblems to edit, please generate states and burgs first", false, "error");
    return;
  }

  await COArenderer.trigger(id, el.coa);
  editEmblem(type, id, el);
}

function regenerateRivers() {
  Rivers.generate();
  Lakes.defineGroup();
  Rivers.specify();
  if (!layerIsOn("toggleRivers")) toggleRivers();
}

function recalculatePopulation() {
  rankCells();
  pack.burgs.forEach(b => {
    if (!b.i || b.removed || b.lock) return;
    const i = b.cell;

    b.population = rn(Math.max((pack.cells.s[i] + pack.cells.road[i] / 2) / 8 + b.i / 1000 + (i % 100) / 1000, 0.1), 3);
    if (b.capital) b.population = b.population * 1.3; // increase capital population
    if (b.port) b.population = b.population * 1.3; // increase port population
    b.population = rn(b.population * gauss(2, 3, 0.6, 20, 3), 3);
  });
}

function regenerateStates() {
  const localSeed = Math.floor(Math.random() * 1e9); // new random seed
  Math.random = aleaPRNG(localSeed);
  const burgs = pack.burgs.filter(b => b.i && !b.removed);
  if (!burgs.length) {
    tip("No burgs to generate states. Please create burgs first", false, "error");
    return;
  }
  if (burgs.length < +regionsInput.value) {
    tip(`Not enough burgs to generate ${regionsInput.value} states. Will generate only ${burgs.length} states`, false, "warn");
  }

  // burg local ids sorted by a bit randomized population:
  const sorted = burgs
    .map((b, i) => [i, b.population * Math.random()])
    .sort((a, b) => b[1] - a[1])
    .map(b => b[0]);
  const capitalsTree = d3.quadtree();

  // turn all old capitals into towns
  burgs
    .filter(b => b.capital)
    .forEach(b => {
      moveBurgToGroup(b.i, "towns");
      b.capital = 0;
    });

  // remove emblems
  document.querySelectorAll("[id^=stateCOA]").forEach(el => el.remove());
  document.querySelectorAll("[id^=provinceCOA]").forEach(el => el.remove());
  emblems.selectAll("use").remove();

  unfog();

  // if desired states number is 0
  if (regionsInput.value == 0) {
    tip(`Cannot generate zero states. Please check the <i>States Number</i> option`, false, "warn");
    pack.states = pack.states.slice(0, 1); // remove all except of neutrals
    pack.states[0].diplomacy = []; // clear diplomacy
    pack.provinces = [0]; // remove all provinces
    pack.cells.state = new Uint16Array(pack.cells.i.length); // reset cells data
    borders.selectAll("path").remove(); // remove borders
    regions.selectAll("path").remove(); // remove states fill
    labels.select("#states").selectAll("text"); // remove state labels
    defs.select("#textPaths").selectAll("path[id*='stateLabel']").remove(); // remove state labels paths

    if (document.getElementById("burgsOverviewRefresh").offsetParent) burgsOverviewRefresh.click();
    if (document.getElementById("statesEditorRefresh").offsetParent) statesEditorRefresh.click();
    return;
  }

  const neutral = pack.states[0].name;
  const count = Math.min(+regionsInput.value, burgs.length);
  let spacing = (graphWidth + graphHeight) / 2 / count; // min distance between capitals
  pack.states = d3.range(count).map(i => {
    if (!i) return {i, name: neutral};

    let capital = null,
      x = 0,
      y = 0;
    for (const i of sorted) {
      capital = burgs[i];
      (x = capital.x), (y = capital.y);
      if (capitalsTree.find(x, y, spacing) === undefined) break;
      spacing = Math.max(spacing - 1, 1);
    }

    capitalsTree.add([x, y]);
    capital.capital = 1;
    moveBurgToGroup(capital.i, "cities");

    const culture = capital.culture;
    const basename = capital.name.length < 9 && capital.cell % 5 === 0 ? capital.name : Names.getCulture(culture, 3, 6, "", 0);
    const name = Names.getState(basename, culture);
    const nomadic = [1, 2, 3, 4].includes(pack.cells.biome[capital.cell]);
    const type = nomadic ? "Nomadic" : pack.cultures[culture].type === "Nomadic" ? "Generic" : pack.cultures[culture].type;
    const expansionism = rn(Math.random() * powerInput.value + 1, 1);

    const cultureType = pack.cultures[culture].type;
    const coa = COA.generate(capital.coa, 0.3, null, cultureType);
    coa.shield = capital.coa.shield;

    return {i, name, type, capital: capital.i, center: capital.cell, culture, expansionism, coa};
  });

  BurgsAndStates.expandStates();
  BurgsAndStates.normalizeStates();
  BurgsAndStates.collectStatistics();
  BurgsAndStates.assignColors();
  BurgsAndStates.generateCampaigns();
  BurgsAndStates.generateDiplomacy();
  BurgsAndStates.defineStateForms();
  BurgsAndStates.generateProvinces(true);
  if (!layerIsOn("toggleStates")) toggleStates();
  else drawStates();
  if (!layerIsOn("toggleBorders")) toggleBorders();
  else drawBorders();
  BurgsAndStates.drawStateLabels();
  Military.generate();
  if (layerIsOn("toggleEmblems")) drawEmblems(); // redrawEmblems

  if (document.getElementById("burgsOverviewRefresh").offsetParent) burgsOverviewRefresh.click();
  if (document.getElementById("statesEditorRefresh").offsetParent) statesEditorRefresh.click();
  if (document.getElementById("militaryOverviewRefresh").offsetParent) militaryOverviewRefresh.click();
}

function regenerateProvinces() {
  unfog();

  BurgsAndStates.generateProvinces(true);
  drawBorders();
  if (layerIsOn("toggleProvinces")) drawProvinces();

  // remove emblems
  document.querySelectorAll("[id^=provinceCOA]").forEach(el => el.remove());
  emblems.selectAll("use").remove();
  if (layerIsOn("toggleEmblems")) drawEmblems();
}

function regenerateBurgs() {
  const cells = pack.cells,
    states = pack.states,
    Lockedburgs = pack.burgs.filter(b => b.lock);
  rankCells();
  cells.burg = new Uint16Array(cells.i.length);
  const burgs = (pack.burgs = [0]); // clear burgs array
  states.filter(s => s.i).forEach(s => (s.capital = 0)); // clear state capitals
  pack.provinces.filter(p => p.i).forEach(p => (p.burg = 0)); // clear province capitals
  const burgsTree = d3.quadtree();

  const score = new Int16Array(cells.s.map(s => s * Math.random())); // cell score for capitals placement
  const sorted = cells.i.filter(i => score[i] > 0 && cells.culture[i]).sort((a, b) => score[b] - score[a]); // filtered and sorted array of indexes
  const burgsCount = manorsInput.value == 1000 ? rn(sorted.length / 5 / (grid.points.length / 10000) ** 0.8) + states.length : +manorsInput.value + states.length;
  const spacing = (graphWidth + graphHeight) / 150 / (burgsCount ** 0.7 / 66); // base min distance between towns

  //clear locked list since ids will change
  //burglock.selectAll("text").remove();
  for (let j = 0; j < Lockedburgs.length; j++) {
    const id = burgs.length;
    const oldBurg = Lockedburgs[j];
    oldBurg.i = id;
    burgs.push(oldBurg);
    burgsTree.add([oldBurg.x, oldBurg.y]);
    cells.burg[oldBurg.cell] = id;
    if (oldBurg.capital) {
      states[oldBurg.state].capital = id;
      states[oldBurg.state].center = oldBurg.cell;
    }
    //burglock.append("text").attr("data-id", id);
  }

  for (let i = 0; i < sorted.length && burgs.length < burgsCount; i++) {
    const id = burgs.length;
    const cell = sorted[i];
    const x = cells.p[cell][0],
      y = cells.p[cell][1];

    const s = spacing * gauss(1, 0.3, 0.2, 2, 2); // randomize to make the placement not uniform
    if (burgsTree.find(x, y, s) !== undefined) continue; // to close to existing burg

    const state = cells.state[cell];
    const capital = state && !states[state].capital; // if state doesn't have capital, make this burg a capital, no capital for neutral lands
    if (capital) {
      states[state].capital = id;
      states[state].center = cell;
    }

    const culture = cells.culture[cell];
    const name = Names.getCulture(culture);
    burgs.push({cell, x, y, state, i: id, culture, name, capital, feature: cells.f[cell]});
    burgsTree.add([x, y]);
    cells.burg[cell] = id;
  }

  // add a capital at former place for states without added capitals
  states
    .filter(s => s.i && !s.removed && !s.capital)
    .forEach(s => {
      const burg = addBurg([cells.p[s.center][0], cells.p[s.center][1]]); // add new burg
      s.capital = burg;
      s.center = pack.burgs[burg].cell;
      pack.burgs[burg].capital = 1;
      pack.burgs[burg].state = s.i;
      moveBurgToGroup(burg, "cities");
    });

  pack.features.forEach(f => {
    if (f.port) f.port = 0;
  }); // reset features ports counter
  BurgsAndStates.specifyBurgs();
  BurgsAndStates.defineBurgFeatures();
  BurgsAndStates.drawBurgs();
  Routes.regenerate();

  // remove emblems
  document.querySelectorAll("[id^=burgCOA]").forEach(el => el.remove());
  emblems.selectAll("use").remove();
  if (layerIsOn("toggleEmblems")) drawEmblems();

  if (document.getElementById("burgsOverviewRefresh").offsetParent) burgsOverviewRefresh.click();
  if (document.getElementById("statesEditorRefresh").offsetParent) statesEditorRefresh.click();
}

function regenerateEmblems() {
  // remove old emblems
  document.querySelectorAll("[id^=stateCOA]").forEach(el => el.remove());
  document.querySelectorAll("[id^=provinceCOA]").forEach(el => el.remove());
  document.querySelectorAll("[id^=burgCOA]").forEach(el => el.remove());
  emblems.selectAll("use").remove();

  // generate new emblems
  pack.states.forEach(state => {
    if (!state.i || state.removed) return;
    const cultureType = pack.cultures[state.culture].type;
    state.coa = COA.generate(null, null, null, cultureType);
    state.coa.shield = COA.getShield(state.culture, null);
  });

  pack.burgs.forEach(burg => {
    if (!burg.i || burg.removed) return;
    const state = pack.states[burg.state];

    let kinship = state ? 0.25 : 0;
    if (burg.capital) kinship += 0.1;
    else if (burg.port) kinship -= 0.1;
    if (state && burg.culture !== state.culture) kinship -= 0.25;
    burg.coa = COA.generate(state ? state.coa : null, kinship, null, burg.type);
    burg.coa.shield = COA.getShield(burg.culture, state ? burg.state : 0);
  });

  pack.provinces.forEach(province => {
    if (!province.i || province.removed) return;
    const parent = province.burg ? pack.burgs[province.burg] : pack.states[province.state];

    let dominion = false;
    if (!province.burg) {
      dominion = P(0.2);
      if (province.formName === "Colony") dominion = P(0.95);
      else if (province.formName === "Island") dominion = P(0.6);
      else if (province.formName === "Islands") dominion = P(0.5);
      else if (province.formName === "Territory") dominion = P(0.4);
      else if (province.formName === "Land") dominion = P(0.3);
    }

    const nameByBurg = province.burg && province.name.slice(0, 3) === parent.name.slice(0, 3);
    const kinship = dominion ? 0 : nameByBurg ? 0.8 : 0.4;
    const culture = pack.cells.culture[province.center];
    const type = BurgsAndStates.getType(province.center, parent.port);
    province.coa = COA.generate(parent.coa, kinship, dominion, type);
    province.coa.shield = COA.getShield(culture, province.state);
  });

  if (layerIsOn("toggleEmblems")) drawEmblems(); // redrawEmblems
}

function regenerateReligions() {
  Religions.generate();
  if (!layerIsOn("toggleReligions")) toggleReligions();
  else drawReligions();
}

function regenerateCultures() {
  Cultures.generate();
  Cultures.expand();
  BurgsAndStates.updateCultures();
  Religions.updateCultures();
  if (!layerIsOn("toggleCultures")) toggleCultures();
  else drawCultures();
  refreshAllEditors();
}

function regenerateMilitary() {
  Military.generate();
  if (!layerIsOn("toggleMilitary")) toggleMilitary();
  if (document.getElementById("militaryOverviewRefresh").offsetParent) militaryOverviewRefresh.click();
}

function regenerateIce() {
  if (!layerIsOn("toggleIce")) toggleIce();
  ice.selectAll("*").remove();
  drawIce();
}

function regenerateMarkers(event) {
  if (isCtrlClick(event)) prompt("Please provide markers number multiplier", {default: 1, step: 0.01, min: 0, max: 100}, v => addNumberOfMarkers(v));
  else addNumberOfMarkers(gauss(1, 0.5, 0.3, 5, 2));

  function addNumberOfMarkers(number) {
    // remove existing markers and assigned notes
    markers
      .selectAll("use")
      .each(function () {
        const index = notes.findIndex(n => n.id === this.id);
        if (index != -1) notes.splice(index, 1);
      })
      .remove();

    addMarkers(number);
    if (!layerIsOn("toggleMarkers")) toggleMarkers();
  }
}

function regenerateZones(event) {
  if (isCtrlClick(event)) prompt("Please provide zones number multiplier", {default: 1, step: 0.01, min: 0, max: 100}, v => addNumberOfZones(v));
  else addNumberOfZones(gauss(1, 0.5, 0.6, 5, 2));

  function addNumberOfZones(number) {
    zones.selectAll("g").remove(); // remove existing zones
    addZones(number);
    if (document.getElementById("zonesEditorRefresh").offsetParent) zonesEditorRefresh.click();
    if (!layerIsOn("toggleZones")) toggleZones();
  }
}

function unpressClickToAddButton() {
  addFeature.querySelectorAll("button.pressed").forEach(b => b.classList.remove("pressed"));
  restoreDefaultEvents();
  clearMainTip();
}

function toggleAddLabel() {
  const pressed = document.getElementById("addLabel").classList.contains("pressed");
  if (pressed) {
    unpressClickToAddButton();
    return;
  }

  addFeature.querySelectorAll("button.pressed").forEach(b => b.classList.remove("pressed"));
  addLabel.classList.add("pressed");
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
  if (!group.size()) group = labels.append("g").attr("id", "addedLabels").attr("fill", "#3e3e4b").attr("opacity", 1).attr("stroke", "#3a3a3a").attr("stroke-width", 0).attr("font-family", "Almendra SC").attr("data-font", "Almendra+SC").attr("font-size", 18).attr("data-size", 18).attr("filter", null);

  const example = group.append("text").attr("x", 0).attr("x", 0).text(name);
  const width = example.node().getBBox().width;
  const x = width / -2; // x offset;
  example.remove();

  group.classed("hidden", false);
  group
    .append("text")
    .attr("id", id)
    .append("textPath")
    .attr("xlink:href", "#textPath_" + id)
    .attr("startOffset", "50%")
    .attr("font-size", "100%")
    .append("tspan")
    .attr("x", x)
    .text(name);

  defs
    .select("#textPaths")
    .append("path")
    .attr("id", "textPath_" + id)
    .attr("d", `M${point[0] - width},${point[1]} h${width * 2}`);

  if (d3.event.shiftKey === false) unpressClickToAddButton();
}

function toggleAddBurg() {
  unpressClickToAddButton();
  document.getElementById("addBurgTool").classList.add("pressed");
  overviewBurgs();
  document.getElementById("addNewBurg").click();
}

function toggleAddRiver() {
  const pressed = document.getElementById("addRiver").classList.contains("pressed");
  if (pressed) {
    unpressClickToAddButton();
    document.getElementById("addNewRiver").classList.remove("pressed");
    return;
  }

  addFeature.querySelectorAll("button.pressed").forEach(b => b.classList.remove("pressed"));
  addRiver.classList.add("pressed");
  document.getElementById("addNewRiver").classList.add("pressed");
  closeDialogs(".stable");
  viewbox.style("cursor", "crosshair").on("click", addRiverOnClick);
  tip("Click on map to place new river or extend an existing one. Hold Shift to place multiple rivers", true, "warn");
  if (!layerIsOn("toggleRivers")) toggleRivers();
}

function addRiverOnClick() {
  const {cells, rivers} = pack;
  let i = findCell(...d3.mouse(this));

  if (cells.r[i]) return tip("There is already a river here", false, "error");
  if (cells.h[i] < 20) return tip("Cannot create river in water cell", false, "error");
  if (cells.b[i]) return;

  const {alterHeights, resolveDepressions, addMeandering, getRiverPath, getBasin, getName, getType, getWidth, getOffset, getApproximateLength} = Rivers;
  const riverCells = [];
  let riverId = rivers.length ? last(rivers).i + 1 : 1;
  let parent = riverId;

  const initialFlux = grid.cells.prec[cells.g[i]];
  cells.fl[i] = initialFlux;

  const h = alterHeights();
  resolveDepressions(h);

  while (i) {
    cells.r[i] = riverId;
    riverCells.push(i);

    const min = cells.c[i].sort((a, b) => h[a] - h[b])[0]; // downhill cell
    if (h[i] <= h[min]) return tip(`Cell ${i} is depressed, river cannot flow further`, false, "error");

    // pour to water body
    if (h[min] < 20) {
      riverCells.push(min);

      const feature = pack.features[cells.f[min]];
      if (feature.type === "lake") {
        if (feature.outlet) parent = feature.outlet;
        feature.inlets ? feature.inlets.push(riverId) : (feature.inlets = [riverId]);
      }
      break;
    }

    // pour outside of map from border cell
    if (cells.b[min]) {
      cells.fl[min] += cells.fl[i];
      riverCells.push(-1);
      break;
    }

    // continue propagation if min cell has no river
    if (!cells.r[min]) {
      cells.fl[min] += cells.fl[i];
      i = min;
      continue;
    }

    // handle case when lowest cell already has a river
    const oldRiverId = cells.r[min];
    const oldRiver = rivers.find(river => river.i === oldRiverId);
    const oldRiverCells = oldRiver?.cells || cells.i.filter(i => cells.r[i] === oldRiverId);
    const oldRiverCellsUpper = oldRiverCells.filter(i => h[i] > h[min]);

    // create new river as a tributary
    if (riverCells.length <= oldRiverCellsUpper.length) {
      cells.conf[min] += cells.fl[i];
      riverCells.push(min);
      parent = oldRiverId;
      break;
    }

    // continue old river
    document.getElementById("river" + oldRiverId)?.remove();
    riverCells.forEach(i => (cells.r[i] = oldRiverId));
    oldRiverCells.forEach(cell => {
      if (h[cell] > h[min]) {
        cells.r[cell] = 0;
        cells.fl[cell] = grid.cells.prec[cells.g[cell]];
      } else {
        riverCells.push(cell);
        cells.fl[cell] += cells.fl[i];
      }
    });
    riverId = oldRiverId;

    break;
  }

  const river = rivers.find(r => r.i === riverId);

  const source = riverCells[0];
  const mouth = riverCells[riverCells.length - 2];
  const widthFactor = river?.widthFactor || (!parent || parent === riverId ? 1.2 : 1);
  const meanderedPoints = addMeandering(riverCells);

  const discharge = cells.fl[mouth]; // m3 in second
  const length = getApproximateLength(meanderedPoints);
  const width = getWidth(getOffset(discharge, meanderedPoints.length, widthFactor));

  if (river) {
    river.source = source;
    river.length = length;
    river.discharge = discharge;
    river.width = width;
    river.cells = riverCells;
  } else {
    const basin = getBasin(parent);
    const name = getName(mouth);
    const type = getType({i: riverId, length, parent});

    rivers.push({i: riverId, source, mouth, discharge, length, width, widthFactor, sourceWidth: 0, parent, cells: riverCells, basin, name, type});
  }

  // render river
  lineGen.curve(d3.curveCatmullRom.alpha(0.1));
  const path = getRiverPath(meanderedPoints, widthFactor);
  const id = "river" + riverId;
  const riversG = viewbox.select("#rivers");
  riversG.append("path").attr("id", id).attr("d", path);

  if (d3.event.shiftKey === false) {
    Lakes.cleanupLakeData();
    unpressClickToAddButton();
    document.getElementById("addNewRiver").classList.remove("pressed");
    if (addNewRiver.offsetParent) riversOverviewRefresh.click();
  }
}

function toggleAddRoute() {
  const pressed = document.getElementById("addRoute").classList.contains("pressed");
  if (pressed) {
    unpressClickToAddButton();
    return;
  }

  addFeature.querySelectorAll("button.pressed").forEach(b => b.classList.remove("pressed"));
  addRoute.classList.add("pressed");
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
  if (pressed) {
    unpressClickToAddButton();
    return;
  }

  addFeature.querySelectorAll("button.pressed").forEach(b => b.classList.remove("pressed"));
  addMarker.classList.add("pressed");
  closeDialogs(".stable");
  viewbox.style("cursor", "crosshair").on("click", addMarkerOnClick);
  tip("Click on map to add a marker. Hold Shift to add multiple", true);
  if (!layerIsOn("toggleMarkers")) toggleMarkers();
}

function addMarkerOnClick() {
  const point = d3.mouse(this);
  const x = rn(point[0], 2),
    y = rn(point[1], 2);
  const id = getNextId("markerElement");

  const selected = markerSelectGroup.value;
  const valid =
    selected &&
    d3
      .select("#defs-markers")
      .select("#" + selected)
      .size();
  const symbol = valid ? "#" + selected : "#marker0";
  const added = markers.select("[data-id='" + symbol + "']").size();
  let desired = valid && added ? markers.select("[data-id='" + symbol + "']").attr("data-size") : 1;
  if (isNaN(desired)) desired = 1;
  const size = desired * 5 + 25 / scale;

  markers
    .append("use")
    .attr("id", id)
    .attr("xlink:href", symbol)
    .attr("data-id", symbol)
    .attr("data-x", x)
    .attr("data-y", y)
    .attr("x", x - size / 2)
    .attr("y", y - size)
    .attr("data-size", desired)
    .attr("width", size)
    .attr("height", size);

  if (d3.event.shiftKey === false) unpressClickToAddButton();
}

function viewCellDetails() {
  $("#cellInfo").dialog({
    resizable: false,
    width: "22em",
    title: "Cell Details",
    position: {my: "right top", at: "right-10 top+10", of: "svg", collision: "fit"}
  });
}
