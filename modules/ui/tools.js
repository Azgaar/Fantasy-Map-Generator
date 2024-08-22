"use strict";

// module to control the Tools options (click to edit, to re-geenerate, tp add)

toolsContent.addEventListener("click", function (event) {
  if (customization) return tip("Please exit the customization mode first", false, "warning");
  if (!["BUTTON", "I"].includes(event.target.tagName)) return;
  const button = event.target.id;

  // click on open Editor buttons
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
  else if (button === "overviewChartsButton") overviewCharts();
  else if (button === "overviewBurgsButton") overviewBurgs();
  else if (button === "overviewRoutesButton") overviewRoutes();
  else if (button === "overviewRiversButton") overviewRivers();
  else if (button === "overviewMilitaryButton") overviewMilitary();
  else if (button === "overviewMarkersButton") overviewMarkers();
  else if (button === "overviewCellsButton") viewCellDetails();

  // click on Regenerate buttons
  if (event.target.parentNode.id === "regenerateFeature") {
    const dontAsk = sessionStorage.getItem("regenerateFeatureDontAsk");
    if (dontAsk) return processFeatureRegeneration(event, button);

    alertMessage.innerHTML = /* html */ `Regeneration will remove all the custom changes for the element.<br /><br />Are you sure you want to proceed?`;
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
        const checkbox =
          '<span><input id="dontAsk" class="checkbox" type="checkbox"><label for="dontAsk" class="checkbox-label dontAsk"><i>do not ask again</i></label><span>';
        const pane = this.parentElement.querySelector(".ui-dialog-buttonpane");
        pane.insertAdjacentHTML("afterbegin", checkbox);
      },
      close: function () {
        const box = this.parentElement.querySelector(".checkbox");
        if (box?.checked) sessionStorage.setItem("regenerateFeatureDontAsk", true);
        $(this).dialog("destroy");
      }
    });
  }

  // click on Configure regenerate buttons
  if (button === "configRegenerateMarkers") configMarkersGeneration();

  // click on Add buttons
  if (button === "addLabel") toggleAddLabel();
  else if (button === "addBurgTool") toggleAddBurg();
  else if (button === "addRiver") toggleAddRiver();
  else if (button === "addRoute") createRoute();
  else if (button === "addMarker") toggleAddMarker();
  // click to create a new map buttons
  else if (button === "openSubmapMenu") UISubmap.openSubmapMenu();
  else if (button === "openResampleMenu") UISubmap.openResampleMenu();
});

function processFeatureRegeneration(event, button) {
  if (button === "regenerateStateLabels") drawStateLabels();
  else if (button === "regenerateReliefIcons") {
    ReliefIcons.draw();
    if (!layerIsOn("toggleRelief")) toggleRelief();
  } else if (button === "regenerateRoutes") {
    regenerateRoutes();
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
  else if (button === "regenerateMarkers") regenerateMarkers();
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

function regenerateRoutes() {
  const locked = pack.routes.filter(route => route.lock).map((route, index) => ({...route, i: index}));
  Routes.generate(locked);

  routes.selectAll("path").remove();
  if (layerIsOn("toggleRoutes")) drawRoutes();
}

function regenerateRivers() {
  Rivers.generate();
  Lakes.defineGroup();
  Rivers.specify();
  if (!layerIsOn("toggleRivers")) toggleRivers();
  else drawRivers();
}

function recalculatePopulation() {
  rankCells();
  pack.burgs.forEach(b => {
    if (!b.i || b.removed || b.lock) return;
    const i = b.cell;

    b.population = rn(Math.max(pack.cells.s[i] / 8 + b.i / 1000 + (i % 100) / 1000, 0.1), 3);
    if (b.capital) b.population = b.population * 1.3; // increase capital population
    if (b.port) b.population = b.population * 1.3; // increase port population
    b.population = rn(b.population * gauss(2, 3, 0.6, 20, 3), 3);
  });
}

function regenerateStates() {
  const newStates = recreateStates();
  if (!newStates) return;

  pack.states = newStates;
  BurgsAndStates.expandStates();
  BurgsAndStates.normalizeStates();
  BurgsAndStates.collectStatistics();
  BurgsAndStates.assignColors();
  BurgsAndStates.generateCampaigns();
  BurgsAndStates.generateDiplomacy();
  BurgsAndStates.defineStateForms();
  BurgsAndStates.generateProvinces(true);

  layerIsOn("toggleStates") ? drawStates() : toggleStates();
  layerIsOn("toggleBorders") ? drawBorders() : toggleBorders();
  if (layerIsOn("toggleProvinces")) drawProvinces();

  drawStateLabels();
  Military.generate();
  if (layerIsOn("toggleEmblems")) drawEmblems();

  if (document.getElementById("burgsOverviewRefresh")?.offsetParent) burgsOverviewRefresh.click();
  if (document.getElementById("statesEditorRefresh")?.offsetParent) statesEditorRefresh.click();
  if (document.getElementById("militaryOverviewRefresh")?.offsetParent) militaryOverviewRefresh.click();
}

function recreateStates() {
  const localSeed = generateSeed();
  Math.random = aleaPRNG(localSeed);

  const statesCount = +byId("").value;
  if (!statesCount) {
    tip(`<i>States Number</i> option value is zero. No counties are generated`, false, "error");
    return null;
  }

  const validBurgs = pack.burgs.filter(b => b.i && !b.removed);
  if (!validBurgs.length) {
    tip("There are no any burgs to generate states. Please create burgs first", false, "error");
    return null;
  }

  if (validBurgs.length < statesCount) {
    const message = `Not enough burgs to generate ${statesCount} states. Will generate only ${validBurgs.length} states`;
    tip(message, false, "warn");
  }

  const validStates = pack.states.filter(s => s.i && !s.removed);
  const lockedStates = validStates.filter(s => s.lock);
  const lockedStatesIds = lockedStates.map(s => s.i);
  const lockedStatesCapitals = lockedStates.map(s => s.capital);

  if (validStates.length && lockedStates.length === validStates.length) {
    tip("Unable to regenerate as all states are locked", false, "error");
    return null;
  }

  // turn all old capitals into towns, except for the capitals of locked states
  for (const burg of validBurgs) {
    if (!burg.capital) continue;
    if (lockedStatesCapitals.includes(burg.i)) continue;

    moveBurgToGroup(burg.i, "towns");
    burg.capital = 0;
  }

  // remove labels and emblems for non-locked states
  for (const state of pack.states) {
    if (!state.i || state.removed || state.lock) continue;

    // remove state labels
    byId(`stateLabel${state.i}`)?.remove();
    byId(`textPath_stateLabel${state.i}`)?.remove();

    // remove state emblems
    byId(`stateCOA${state.i}`)?.remove();
    document.querySelector(`#stateEmblems > use[data-i="${state.i}"]`)?.remove();

    // remove province data and emblems
    for (const provinceId of state.provinces) {
      byId(`provinceCOA${provinceId}`)?.remove();
      document.querySelector(`#provinceEmblems > use[data-i="${provinceId}"]`)?.remove();
      pack.provinces[provinceId].removed = true;
    }
  }

  unfog();

  // burg local ids sorted by a bit randomized population. Also ignore burgs of a locked state
  const sortedBurgs = validBurgs
    .filter(b => !lockedStatesIds.includes(b.state))
    .map(b => [b, b.population * Math.random()])
    .sort((a, b) => b[1] - a[1])
    .map(b => b[0]);

  const count = Math.min(statesCount, validBurgs.length) + 1; // +1 for neutral
  let spacing = (graphWidth + graphHeight) / 2 / count; // min distance between capitals

  const capitalsTree = d3.quadtree();
  const isTooClose = (x, y, spacing) => Boolean(capitalsTree.find(x, y, spacing));

  const newStates = [{i: 0, name: pack.states[0].name}];

  // restore locked states
  lockedStates.forEach(state => {
    const newId = newStates.length;
    const {x, y} = pack.burgs[state.capital];
    capitalsTree.add([x, y]);

    // update label id reference
    byId(`textPath_stateLabel${state.i}`)?.setAttribute("id", `textPath_stateLabel${newId}`);
    const $label = byId(`stateLabel${state.i}`);
    if ($label) {
      $label.setAttribute("id", `stateLabel${newId}`);
      const $textPath = $label.querySelector("textPath");
      if ($textPath) {
        $textPath.removeAttribute("href");
        $textPath.setAttribute("href", `#textPath_stateLabel${newId}`);
      }
    }

    // update emblem id reference
    byId(`stateCOA${state.i}`)?.setAttribute("id", `stateCOA${newId}`);
    document.querySelector(`#stateEmblems > use[data-i="${state.i}"]`)?.setAttribute("data-i", newId);

    state.provinces.forEach(provinceId => {
      if (!pack.provinces[provinceId]) return;
      pack.provinces[provinceId].state = newId;
    });

    state.i = newId;
    newStates.push(state);
  });

  for (const i of pack.cells.i) {
    const stateId = pack.cells.state[i];
    const lockedStateIndex = lockedStatesIds.indexOf(stateId) + 1;
    // lockedStateIndex is an index of locked state or 0 if state is not locked
    pack.cells.state[i] = lockedStateIndex;
  }

  for (let i = newStates.length; i < count; i++) {
    let capital = null;

    for (const burg of sortedBurgs) {
      const {x, y} = burg;
      if (!isTooClose(x, y, spacing)) {
        burg.capital = 1;
        capital = burg;
        capitalsTree.add([x, y]);
        moveBurgToGroup(burg.i, "cities");
        break;
      }

      spacing = Math.max(spacing - 1, 1);
    }

    // all burgs are too close, should not happen in normal conditions
    if (!capital) break;

    // create new state
    const culture = capital.culture;
    const basename =
      capital.name.length < 9 && capital.cell % 5 === 0 ? capital.name : Names.getCulture(culture, 3, 6, "", 0);
    const name = Names.getState(basename, culture);
    const nomadic = [1, 2, 3, 4].includes(pack.cells.biome[capital.cell]);
    const type = nomadic
      ? "Nomadic"
      : pack.cultures[culture].type === "Nomadic"
      ? "Generic"
      : pack.cultures[culture].type;
    const expansionism = rn(Math.random() * byId("sizeVariety").value + 1, 1);

    const cultureType = pack.cultures[culture].type;
    const coa = COA.generate(capital.coa, 0.3, null, cultureType);
    coa.shield = capital.coa.shield;

    newStates.push({i, name, type, capital: capital.i, center: capital.cell, culture, expansionism, coa});
  }

  return newStates;
}

function regenerateProvinces() {
  unfog();

  BurgsAndStates.generateProvinces(true, true);
  drawBorders();
  if (layerIsOn("toggleProvinces")) drawProvinces();

  // remove emblems
  document.querySelectorAll("[id^=provinceCOA]").forEach(el => el.remove());
  emblems.selectAll("use").remove();
  if (layerIsOn("toggleEmblems")) drawEmblems();
  refreshAllEditors();
}

function regenerateBurgs() {
  const {cells, features, burgs, states, provinces} = pack;

  rankCells();

  // remove notes for unlocked burgs
  notes = notes.filter(note => {
    if (note.id.startsWith("burg")) {
      const burgId = +note.id.slice(4);
      return burgs[burgId]?.lock;
    }
    return true;
  });

  const newBurgs = [0]; // new burgs array
  const burgsTree = d3.quadtree();

  cells.burg = new Uint16Array(cells.i.length); // clear cells burg data
  states.filter(s => s.i).forEach(s => (s.capital = 0)); // clear state capitals
  provinces.filter(p => p.i).forEach(p => (p.burg = 0)); // clear province capitals

  // readd locked burgs
  const lockedburgs = burgs.filter(burg => burg.i && !burg.removed && burg.lock);
  for (let j = 0; j < lockedburgs.length; j++) {
    const lockedBurg = lockedburgs[j];
    const newId = newBurgs.length;

    const noteIndex = notes.findIndex(note => note.id === `burg${lockedBurg.i}`);
    if (noteIndex !== -1) notes[noteIndex].id = `burg${newId}`;

    lockedBurg.i = newId;
    newBurgs.push(lockedBurg);

    burgsTree.add([lockedBurg.x, lockedBurg.y]);
    cells.burg[lockedBurg.cell] = newId;

    if (lockedBurg.capital) {
      const stateId = lockedBurg.state;
      states[stateId].capital = newId;
      states[stateId].center = lockedBurg.cell;
    }
  }

  const score = new Int16Array(cells.s.map(s => s * Math.random())); // cell score for capitals placement
  const sorted = cells.i.filter(i => score[i] > 0 && cells.culture[i]).sort((a, b) => score[b] - score[a]); // filtered and sorted array of indexes
  const existingStatesCount = states.filter(s => s.i && !s.removed).length;
  const burgsCount =
    (manorsInput.value === "1000" ? rn(sorted.length / 5 / (grid.points.length / 10000) ** 0.8) : +manorsInput.value) +
    existingStatesCount;
  const spacing = (graphWidth + graphHeight) / 150 / (burgsCount ** 0.7 / 66); // base min distance between towns

  for (let i = 0; i < sorted.length && newBurgs.length < burgsCount; i++) {
    const id = newBurgs.length;
    const cell = sorted[i];
    const [x, y] = cells.p[cell];

    const s = spacing * gauss(1, 0.3, 0.2, 2, 2); // randomize to make the placement not uniform
    if (burgsTree.find(x, y, s) !== undefined) continue; // to close to existing burg

    const stateId = cells.state[cell];
    const capital = stateId && !states[stateId].capital; // if state doesn't have capital, make this burg a capital, no capital for neutral lands
    if (capital) {
      states[stateId].capital = id;
      states[stateId].center = cell;
    }

    const culture = cells.culture[cell];
    const name = Names.getCulture(culture);
    newBurgs.push({cell, x, y, state: stateId, i: id, culture, name, capital, feature: cells.f[cell]});
    burgsTree.add([x, y]);
    cells.burg[cell] = id;
  }

  pack.burgs = newBurgs; // assign new burgs array

  // add a capital at former place for states without added capitals
  states
    .filter(s => s.i && !s.removed && !s.capital)
    .forEach(s => {
      const [x, y] = cells.p[s.center];
      const burgId = addBurg([x, y]);
      s.capital = burgId;
      s.center = pack.burgs[burgId].cell;
      pack.burgs[burgId].capital = 1;
      pack.burgs[burgId].state = s.i;
      moveBurgToGroup(burgId, "cities");
    });

  features.forEach(f => {
    if (f.port) f.port = 0; // reset features ports counter
  });

  BurgsAndStates.specifyBurgs();
  BurgsAndStates.defineBurgFeatures();
  BurgsAndStates.drawBurgs();
  regenerateRoutes();

  // remove emblems
  document.querySelectorAll("[id^=burgCOA]").forEach(el => el.remove());
  emblems.selectAll("use").remove();
  if (layerIsOn("toggleEmblems")) drawEmblems();

  if (document.getElementById("burgsOverviewRefresh")?.offsetParent) burgsOverviewRefresh.click();
  if (document.getElementById("statesEditorRefresh")?.offsetParent) statesEditorRefresh.click();
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
  refreshAllEditors();
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

function regenerateMarkers() {
  Markers.regenerate();
  turnButtonOn("toggleMarkers");
  drawMarkers();
  if (document.getElementById("markersOverviewRefresh").offsetParent) markersOverviewRefresh.click();
}

function regenerateZones(event) {
  if (isCtrlClick(event))
    prompt("Please provide zones number multiplier", {default: 1, step: 0.01, min: 0, max: 100}, v =>
      addNumberOfZones(v)
    );
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

  // use most recently selected label group
  const lastSelected = labelGroupSelect.value;
  const groupId = ["", "states", "burgLabels"].includes(lastSelected) ? "#addedLabels" : "#" + lastSelected;

  let group = labels.select(groupId);
  if (!group.size())
    group = labels
      .append("g")
      .attr("id", "addedLabels")
      .attr("fill", "#3e3e4b")
      .attr("opacity", 1)
      .attr("stroke", "#3a3a3a")
      .attr("stroke-width", 0)
      .attr("font-family", "Almendra SC")
      .attr("font-size", 18)
      .attr("data-size", 18)
      .attr("filter", null);

  const example = group.append("text").attr("x", 0).attr("y", 0).text(name);
  const width = example.node().getBBox().width;
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
    .attr("x", 0)
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

  const {
    alterHeights,
    resolveDepressions,
    addMeandering,
    getRiverPath,
    getBasin,
    getName,
    getType,
    getWidth,
    getOffset,
    getApproximateLength,
    getNextId
  } = Rivers;
  const riverCells = [];
  let riverId = getNextId(rivers);
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

  const defaultWidthFactor = rn(1 / (pointsInput.dataset.cells / 10000) ** 0.25, 2);
  const widthFactor =
    river?.widthFactor || (!parent || parent === riverId ? defaultWidthFactor * 1.2 : defaultWidthFactor);
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

    rivers.push({
      i: riverId,
      source,
      mouth,
      discharge,
      length,
      width,
      widthFactor,
      sourceWidth: 0,
      parent,
      cells: riverCells,
      basin,
      name,
      type
    });
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

function toggleAddMarker() {
  const pressed = document.getElementById("addMarker")?.classList.contains("pressed");
  if (pressed) {
    unpressClickToAddButton();
    return;
  }

  addFeature.querySelectorAll("button.pressed").forEach(b => b.classList.remove("pressed"));
  addMarker.classList.add("pressed");
  markersAddFromOverview.classList.add("pressed");

  viewbox.style("cursor", "crosshair").on("click", addMarkerOnClick);
  tip("Click on map to add a marker. Hold Shift to add multiple", true);
  if (!layerIsOn("toggleMarkers")) toggleMarkers();
}

function addMarkerOnClick() {
  const {markers} = pack;
  const point = d3.mouse(this);
  const x = rn(point[0], 2);
  const y = rn(point[1], 2);

  // Find the current cell
  const cell = findCell(point[0], point[1]);

  // Find the currently selected marker to use as a base
  const isMarkerSelected = markers.length && elSelected?.node()?.parentElement?.id === "markers";
  const selectedMarker = isMarkerSelected ? markers.find(marker => marker.i === +elSelected.attr("id").slice(6)) : null;

  const selectedType = document.getElementById("addedMarkerType").value;
  const selectedConfig = Markers.getConfig().find(({type}) => type === selectedType);

  const baseMarker = selectedMarker || selectedConfig || {icon: "❓"};
  const marker = Markers.add({...baseMarker, x, y, cell});

  if (selectedConfig && selectedConfig.add) {
    selectedConfig.add("marker" + marker.i, cell);
  }

  const markersElement = document.getElementById("markers");
  const rescale = +markersElement.getAttribute("rescale");
  markersElement.insertAdjacentHTML("beforeend", drawMarker(marker, rescale));

  if (d3.event.shiftKey === false) {
    document.getElementById("markerAdd").classList.remove("pressed");
    document.getElementById("markersAddFromOverview").classList.remove("pressed");
    unpressClickToAddButton();
  }
}

function configMarkersGeneration() {
  drawConfigTable();

  function drawConfigTable() {
    const {markers} = pack;
    const config = Markers.getConfig();
    const headers = `<thead style='font-weight:bold'><tr>
      <td data-tip="Marker type name">Type</td>
      <td data-tip="Marker icon">Icon</td>
      <td data-tip="Marker number multiplier">Multiplier</td>
      <td data-tip="Number of markers of that type on the current map">Number</td>
    </tr></thead>`;
    const lines = config.map(({type, icon, multiplier}, index) => {
      const inputId = `markerIconInput${index}`;
      return `<tr>
        <td><input value="${type}" /></td>
        <td style="position: relative">
          <input id="${inputId}" style="width: 5em" value="${icon}" />
          <i class="icon-edit pointer" style="position: absolute; margin:.4em 0 0 -1.4em; font-size:.85em"></i>
        </td>
        <td><input type="number" min="0" max="100" step="0.1" value="${multiplier}" /></td>
        <td style="text-align:center">${markers.filter(marker => marker.type === type).length}</td>
      </tr>`;
    });
    const table = `<table class="table">${headers}<tbody>${lines.join("")}</tbody></table>`;
    alertMessage.innerHTML = table;

    alertMessage.querySelectorAll("i").forEach(selectIconButton => {
      selectIconButton.addEventListener("click", function () {
        const input = this.previousElementSibling;
        selectIcon(input.value, icon => (input.value = icon));
      });
    });
  }

  const applyChanges = () => {
    const rows = alertMessage.querySelectorAll("tbody > tr");
    const rowsData = Array.from(rows).map(row => {
      const inputs = row.querySelectorAll("input");
      return {
        type: inputs[0].value,
        icon: inputs[1].value,
        multiplier: parseFloat(inputs[2].value)
      };
    });

    const config = Markers.getConfig();
    const newConfig = config.map((markerType, index) => {
      const {type, icon, multiplier} = rowsData[index];
      return {...markerType, type, icon, multiplier};
    });

    Markers.setConfig(newConfig);
  };

  $("#alert").dialog({
    resizable: false,
    title: "Markers generation settings",
    position: {my: "left top", at: "left+10 top+10", of: "svg", collision: "fit"},
    buttons: {
      Regenerate: () => {
        applyChanges();
        regenerateMarkers();
        drawConfigTable();
      },
      Close: function () {
        $(this).dialog("close");
      }
    },
    open: function () {
      const buttons = $(this).dialog("widget").find(".ui-dialog-buttonset > button");
      buttons[0].addEventListener("mousemove", () => tip("Apply changes and regenerate markers"));
      buttons[1].addEventListener("mousemove", () => tip("Close the window"));
    },
    close: function () {
      $(this).dialog("destroy");
    }
  });
}

function viewCellDetails() {
  $("#cellInfo").dialog({
    resizable: false,
    width: "22em",
    title: "Cell Details",
    position: {my: "right top", at: "right-10 top+10", of: "svg", collision: "fit"}
  });
}

async function overviewCharts() {
  const Overview = await import("../dynamic/overview/charts-overview.js?v=1.99.00");
  Overview.open();
}
