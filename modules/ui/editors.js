// module stub to store common functions for ui editors
"use strict";

modules.editors = true;

// restore default viewbox events
function restoreDefaultEvents() {
  svg.call(zoom);
  viewbox.style("cursor", "default").on(".drag", null).on("click", clicked).on("touchmove mousemove", onMouseMove);
  legend.call(d3.drag().on("start", dragLegendBox));
}

// on viewbox click event - run function based on target
function clicked() {
  const el = d3.event.target;
  if (!el || !el.parentElement || !el.parentElement.parentElement) return;
  const parent = el.parentElement;
  const grand = parent.parentElement;
  const great = grand.parentElement;
  const p = d3.mouse(this);
  const i = findCell(p[0], p[1]);

  if (grand.id === "emblems") editEmblem();
  else if (parent.id === "rivers") editRiver(el.id);
  else if (grand.id === "routes") editRoute(el.id);
  else if (el.tagName === "tspan" && grand.parentNode.parentNode.id === "labels") editLabel();
  else if (grand.id === "burgLabels") editBurg();
  else if (grand.id === "burgIcons") editBurg();
  else if (parent.id === "ice") editIce();
  else if (parent.id === "terrain") editReliefIcon();
  else if (grand.id === "markers" || great.id === "markers") editMarker();
  else if (grand.id === "coastline") editCoastline();
  else if (great.id === "armies") editRegiment();
  else if (pack.cells.t[i] === 1) {
    const node = byId("island_" + pack.cells.f[i]);
    editCoastline(node);
  } else if (grand.id === "lakes") editLake();
}

// clear elSelected variable
function unselect() {
  restoreDefaultEvents();
  if (!elSelected) return;
  elSelected.call(d3.drag().on("drag", null)).attr("class", null);
  debug.selectAll("*").remove();
  viewbox.style("cursor", "default");
  elSelected = null;
}

// close all dialogs except stated
function closeDialogs(except = "#except") {
  try {
    $(".dialog:visible")
      .not(except)
      .each(function () {
        $(this).dialog("close");
      });
  } catch (error) {}
}

// move brush radius circle
function moveCircle(x, y, r = 20) {
  let circle = byId("brushCircle");
  if (!circle) {
    const html = /* html */ `<circle id="brushCircle" cx=${x} cy=${y} r=${r}></circle>`;
    byId("debug").insertAdjacentHTML("afterBegin", html);
  } else {
    circle.setAttribute("cx", x);
    circle.setAttribute("cy", y);
    circle.setAttribute("r", r);
  }
}

function removeCircle() {
  if (byId("brushCircle")) byId("brushCircle").remove();
}

// get browser-defined fit-content
function fitContent() {
  return !window.chrome ? "-moz-max-content" : "fit-content";
}

// apply sorting behaviour for lines on Editor header click
document.querySelectorAll(".sortable").forEach(function (event) {
  event.on("click", function () {
    sortLines(this);
  });
});

function applySortingByHeader(headerContainer) {
  document
    .getElementById(headerContainer)
    .querySelectorAll(".sortable")
    .forEach(function (element) {
      element.on("click", function () {
        sortLines(this);
      });
    });
}

function sortLines(headerElement) {
  const type = headerElement.classList.contains("alphabetically") ? "name" : "number";
  let order = headerElement.className.includes("-down") ? "-up" : "-down";
  if (!headerElement.className.includes("icon-sort") && type === "name") order = "-up";

  const headers = headerElement.parentNode;
  headers.querySelectorAll("div.sortable").forEach(e => {
    e.classList.forEach(c => {
      if (c.includes("icon-sort")) e.classList.remove(c);
    });
  });
  headerElement.classList.add("icon-sort-" + type + order);
  applySorting(headers);
}

function applySorting(headers) {
  const header = headers.querySelector("div[class*='icon-sort']");
  if (!header) return;
  const sortby = header.dataset.sortby;
  const name = header.classList.contains("alphabetically");
  const desc = header.className.includes("-down") ? -1 : 1;
  const list = headers.nextElementSibling;
  const lines = Array.from(list.children);

  lines
    .sort((a, b) => {
      const an = name ? a.dataset[sortby] : +a.dataset[sortby];
      const bn = name ? b.dataset[sortby] : +b.dataset[sortby];
      return (an > bn ? 1 : an < bn ? -1 : 0) * desc;
    })
    .forEach(line => list.appendChild(line));
}

function addBurg(point) {
  const {cells, states} = pack;
  const x = rn(point[0], 2);
  const y = rn(point[1], 2);

  const cellId = findCell(x, y);
  const i = pack.burgs.length;
  const culture = cells.culture[cellId];
  const name = Names.getCulture(culture);
  const state = cells.state[cellId];
  const feature = cells.f[cellId];

  const population = Math.max(cells.s[cellId] / 3 + i / 1000 + (cellId % 100) / 1000, 0.1);
  const type = BurgsAndStates.getType(cellId, false);

  // generate emblem
  const coa = COA.generate(states[state].coa, 0.25, null, type);
  coa.shield = COA.getShield(culture, state);
  COArenderer.add("burg", i, coa, x, y);

  const burg = {
    name,
    cell: cellId,
    x,
    y,
    state,
    i,
    culture,
    feature,
    capital: 0,
    port: 0,
    temple: 0,
    population,
    coa,
    type
  };
  pack.burgs.push(burg);
  cells.burg[cellId] = i;

  const townSize = burgIcons.select("#towns").attr("size") || 0.5;
  burgIcons
    .select("#towns")
    .append("circle")
    .attr("id", "burg" + i)
    .attr("data-id", i)
    .attr("cx", x)
    .attr("cy", y)
    .attr("r", townSize);
  burgLabels
    .select("#towns")
    .append("text")
    .attr("id", "burgLabel" + i)
    .attr("data-id", i)
    .attr("x", x)
    .attr("y", y)
    .attr("dy", `${townSize * -1.5}px`)
    .text(name);

  BurgsAndStates.defineBurgFeatures(burg);

  const newRoute = Routes.connect(cellId);
  if (newRoute && layerIsOn("toggleRoutes")) {
    routes
      .select("#" + newRoute.group)
      .append("path")
      .attr("d", Routes.getPath(newRoute))
      .attr("id", "route" + newRoute.i);
  }

  return i;
}

function moveBurgToGroup(id, g) {
  const label = document.querySelector("#burgLabels [data-id='" + id + "']");
  const icon = document.querySelector("#burgIcons [data-id='" + id + "']");
  const anchor = document.querySelector("#anchors [data-id='" + id + "']");
  if (!label || !icon) {
    ERROR && console.error(`Cannot find label or icon elements for id ${id}`);
    return;
  }

  document.querySelector("#burgLabels > #" + g).appendChild(label);
  document.querySelector("#burgIcons > #" + g).appendChild(icon);

  const iconSize = icon.parentNode.getAttribute("size");
  icon.setAttribute("r", iconSize);
  label.setAttribute("dy", `${iconSize * -1.5}px`);

  if (anchor) {
    document.querySelector("#anchors > #" + g).appendChild(anchor);
    const anchorSize = +anchor.parentNode.getAttribute("size");
    anchor.setAttribute("width", anchorSize);
    anchor.setAttribute("height", anchorSize);
    anchor.setAttribute("x", rn(pack.burgs[id].x - anchorSize * 0.47, 2));
    anchor.setAttribute("y", rn(pack.burgs[id].y - anchorSize * 0.47, 2));
  }
}

function moveAllBurgsToGroup(fromGroup, toGroup) {
  const groupToMove = document.querySelector(`#burgIcons #${fromGroup}`);
  const burgsToMove = Array.from(groupToMove.children).map(x => x.dataset.id);
  addBurgsGroup(toGroup);
  burgsToMove.forEach(x => moveBurgToGroup(x, toGroup));
}

function addBurgsGroup(group) {
  if (document.querySelector(`#burgLabels > #${group}`)) return;
  const labelCopy = document.querySelector("#burgLabels > #towns").cloneNode(false);
  const iconCopy = document.querySelector("#burgIcons > #towns").cloneNode(false);
  const anchorCopy = document.querySelector("#anchors > #towns").cloneNode(false);

  // FIXME: using the same id is against the spec!
  document.querySelector("#burgLabels").appendChild(labelCopy).id = group;
  document.querySelector("#burgIcons").appendChild(iconCopy).id = group;
  document.querySelector("#anchors").appendChild(anchorCopy).id = group;
}

function removeBurg(id) {
  document.querySelector("#burgLabels [data-id='" + id + "']")?.remove();
  document.querySelector("#burgIcons [data-id='" + id + "']")?.remove();
  document.querySelector("#anchors [data-id='" + id + "']")?.remove();

  const cells = pack.cells;
  const burg = pack.burgs[id];

  burg.removed = true;
  cells.burg[burg.cell] = 0;

  const noteId = notes.findIndex(note => note.id === `burg${id}`);
  if (noteId !== -1) notes.splice(noteId, 1);

  if (burg.coa) {
    const coaId = "burgCOA" + id;
    if (byId(coaId)) byId(coaId).remove();
    emblems.select(`#burgEmblems > use[data-i='${id}']`).remove();
    delete burg.coa; // remove to save data
  }
}

function toggleCapital(burgId) {
  const {burgs, states} = pack;
  if (burgs[burgId].capital)
    return tip("To change capital please assign a capital status to another burg of this state", false, "error");

  const stateId = burgs[burgId].state;
  if (!stateId) return tip("Neutral lands cannot have a capital", false, "error");

  const prevCapitalId = states[stateId].capital;
  states[stateId].capital = burgId;
  states[stateId].center = burgs[burgId].cell;
  burgs[burgId].capital = 1;
  burgs[prevCapitalId].capital = 0;

  moveBurgToGroup(burgId, "cities");
  moveBurgToGroup(prevCapitalId, "towns");
}

function togglePort(burg) {
  const anchor = document.querySelector("#anchors [data-id='" + burg + "']");
  if (anchor) anchor.remove();
  const b = pack.burgs[burg];
  if (b.port) {
    b.port = 0;
    return;
  } // not a port anymore

  const haven = pack.cells.haven[b.cell];
  const port = haven ? pack.cells.f[haven] : -1;
  if (!haven) tip("Port haven is not found, system won't be able to make a searoute", false, "warn");
  b.port = port;

  const g = b.capital ? "cities" : "towns";
  const group = anchors.select("g#" + g);
  const size = +group.attr("size");
  group
    .append("use")
    .attr("xlink:href", "#icon-anchor")
    .attr("data-id", burg)
    .attr("x", rn(b.x - size * 0.47, 2))
    .attr("y", rn(b.y - size * 0.47, 2))
    .attr("width", size)
    .attr("height", size);
}

function getBurgLink(burg) {
  if (burg.link) return burg.link;

  const population = burg.population * populationRate * urbanization;
  if (population >= options.villageMaxPopulation || burg.citadel || burg.walls || burg.temple || burg.shanty)
    return createMfcgLink(burg);

  return createVillageGeneratorLink(burg);
}

function createMfcgLink(burg) {
  const {cells} = pack;
  const {i, name, population: burgPopulation, cell} = burg;
  const burgSeed = burg.MFCG || seed + String(burg.i).padStart(4, 0);

  const sizeRaw = 2.13 * Math.pow((burgPopulation * populationRate) / urbanDensity, 0.385);
  const size = minmax(Math.ceil(sizeRaw), 6, 100);
  const population = rn(burgPopulation * populationRate * urbanization);

  const river = cells.r[cell] ? 1 : 0;
  const coast = Number(burg.port > 0);
  const sea = (() => {
    if (!coast || !cells.haven[cell]) return null;

    // calculate see direction: 0 = south, 0.5 = west, 1 = north, 1.5 = east
    const p1 = cells.p[cell];
    const p2 = cells.p[cells.haven[cell]];
    let deg = (Math.atan2(p2[1] - p1[1], p2[0] - p1[0]) * 180) / Math.PI - 90;
    if (deg < 0) deg += 360;
    return rn(normalize(deg, 0, 360) * 2, 2);
  })();

  const arableBiomes = river ? [1, 2, 3, 4, 5, 6, 7, 8] : [5, 6, 7, 8];
  const farms = +arableBiomes.includes(cells.biome[cell]);

  const citadel = +burg.citadel;
  const urban_castle = +(citadel && each(2)(i));

  const hub = Routes.isCrossroad(cell);
  const walls = +burg.walls;
  const plaza = +burg.plaza;
  const temple = +burg.temple;
  const shantytown = +burg.shanty;

  const url = new URL("https://watabou.github.io/city-generator/");
  url.search = new URLSearchParams({
    name,
    population,
    size,
    seed: burgSeed,
    river,
    coast,
    farms,
    citadel,
    urban_castle,
    hub,
    plaza,
    temple,
    walls,
    shantytown,
    gates: -1
  });
  if (sea) url.searchParams.append("sea", sea);

  return url.toString();
}

function createVillageGeneratorLink(burg) {
  const {cells, features} = pack;
  const {i, population, cell} = burg;

  const pop = rn(population * populationRate * urbanization);
  const burgSeed = seed + String(i).padStart(4, 0);
  const tags = [];

  if (cells.r[cell] && cells.haven[cell]) tags.push("estuary");
  else if (cells.haven[cell] && features[cells.f[cell]].cells === 1) tags.push("island,district");
  else if (burg.port) tags.push("coast");
  else if (cells.conf[cell]) tags.push("confluence");
  else if (cells.r[cell]) tags.push("river");
  else if (pop < 200 && each(4)(cell)) tags.push("pond");

  const connections = pack.cells.routes[cell] || {};
  const roads = Object.values(connections).filter(routeId => {
    const route = pack.routes[routeId];
    return route.group === "roads" || route.group === "trails";
  }).length;
  tags.push(roads > 1 ? "highway" : roads === 1 ? "dead end" : "isolated");

  const biome = cells.biome[cell];
  const arableBiomes = cells.r[cell] ? [1, 2, 3, 4, 5, 6, 7, 8] : [5, 6, 7, 8];
  if (!arableBiomes.includes(biome)) tags.push("uncultivated");
  else if (each(6)(cell)) tags.push("farmland");

  const temp = grid.cells.temp[cells.g[cell]];
  if (temp <= 0 || temp > 28 || (temp > 25 && each(3)(cell))) tags.push("no orchards");

  if (!burg.plaza) tags.push("no square");

  if (pop < 100) tags.push("sparse");
  else if (pop > 300) tags.push("dense");

  const width = (() => {
    if (pop > 1500) return 1600;
    if (pop > 1000) return 1400;
    if (pop > 500) return 1000;
    if (pop > 200) return 800;
    if (pop > 100) return 600;
    return 400;
  })();
  const height = rn(width / 2.2);

  const url = new URL("https://watabou.github.io/village-generator/");
  url.search = new URLSearchParams({pop, name: "", seed: burgSeed, width, height, tags});
  return url.toString();
}

// draw legend box
function drawLegend(name, data) {
  legend.selectAll("*").remove(); // fully redraw every time
  legend.attr("data", data.join("|")); // store data

  const itemsInCol = +styleLegendColItems.value;
  const fontSize = +legend.attr("font-size");
  const backClr = styleLegendBack.value;
  const opacity = +styleLegendOpacity.value;

  const lineHeight = Math.round(fontSize * 1.7);
  const colorBoxSize = Math.round(fontSize / 1.7);
  const colOffset = fontSize;
  const vOffset = fontSize / 2;

  // append items
  const boxes = legend.append("g").attr("stroke-width", 0.5).attr("stroke", "#111111").attr("stroke-dasharray", "none");
  const labels = legend.append("g").attr("fill", "#000000").attr("stroke", "none");

  const columns = Math.ceil(data.length / itemsInCol);
  for (let column = 0, i = 0; column < columns; column++) {
    const linesInColumn = Math.ceil(data.length / columns);
    const offset = column ? colOffset * 2 + legend.node().getBBox().width : colOffset;

    for (let l = 0; l < linesInColumn && data[i]; l++, i++) {
      boxes
        .append("rect")
        .attr("fill", data[i][1])
        .attr("x", offset)
        .attr("y", lineHeight + l * lineHeight + vOffset)
        .attr("width", colorBoxSize)
        .attr("height", colorBoxSize);

      labels
        .append("text")
        .text(data[i][2])
        .attr("x", offset + colorBoxSize * 1.6)
        .attr("y", fontSize / 1.6 + lineHeight + l * lineHeight + vOffset);
    }
  }

  // append label
  const offset = colOffset + legend.node().getBBox().width / 2;
  labels
    .append("text")
    .attr("text-anchor", "middle")
    .attr("font-weight", "bold")
    .attr("font-size", "1.2em")
    .attr("id", "legendLabel")
    .text(name)
    .attr("x", offset)
    .attr("y", fontSize * 1.1 + vOffset / 2);

  // append box
  const bbox = legend.node().getBBox();
  const width = bbox.width + colOffset * 2;
  const height = bbox.height + colOffset / 2 + vOffset;

  legend
    .insert("rect", ":first-child")
    .attr("id", "legendBox")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", width)
    .attr("height", height)
    .attr("fill", backClr)
    .attr("fill-opacity", opacity);

  fitLegendBox();
}

// fit Legend box to canvas size
function fitLegendBox() {
  if (!legend.selectAll("*").size()) return;
  const px = isNaN(+legend.attr("data-x")) ? 99 : legend.attr("data-x") / 100;
  const py = isNaN(+legend.attr("data-y")) ? 93 : legend.attr("data-y") / 100;
  const bbox = legend.node().getBBox();
  const x = rn(svgWidth * px - bbox.width),
    y = rn(svgHeight * py - bbox.height);
  legend.attr("transform", `translate(${x},${y})`);
}

// draw legend with the same data, but using different settings
function redrawLegend() {
  if (legend.select("rect").size()) {
    const name = legend.select("#legendLabel").text();
    const data = legend
      .attr("data")
      .split("|")
      .map(l => l.split(","));
    drawLegend(name, data);
  }
}

function dragLegendBox() {
  const tr = parseTransform(this.getAttribute("transform"));
  const x = +tr[0] - d3.event.x,
    y = +tr[1] - d3.event.y;
  const bbox = legend.node().getBBox();

  d3.event.on("drag", function () {
    const px = rn(((x + d3.event.x + bbox.width) / svgWidth) * 100, 2);
    const py = rn(((y + d3.event.y + bbox.height) / svgHeight) * 100, 2);
    const transform = `translate(${x + d3.event.x},${y + d3.event.y})`;
    legend.attr("transform", transform).attr("data-x", px).attr("data-y", py);
  });
}

function clearLegend() {
  legend.selectAll("*").remove();
  legend.attr("data", null);
}

// draw color (fill) picker
function createPicker() {
  const pos = () => tip("Drag to change the picker position");
  const cl = () => tip("Click to close the picker");
  const closePicker = () => container.style("display", "none");

  const container = d3
    .select("body")
    .append("svg")
    .attr("id", "pickerContainer")
    .attr("width", "100%")
    .attr("height", "100%");
  container
    .append("rect")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("opacity", 0.2)
    .on("mousemove", cl)
    .on("click", closePicker);
  const picker = container
    .append("g")
    .attr("id", "picker")
    .call(
      d3
        .drag()
        .filter(() => event.target.tagName !== "INPUT")
        .on("start", dragPicker)
    );

  const controls = picker.append("g").attr("id", "pickerControls");
  const h = controls.append("g");
  h.append("text").attr("x", 4).attr("y", 14).text("H:");
  h.append("line").attr("x1", 18).attr("y1", 10).attr("x2", 107).attr("y2", 10);
  h.append("circle").attr("cx", 75).attr("cy", 10).attr("r", 5).attr("id", "pickerH");
  h.on("mousemove", () => tip("Set palette hue"));

  const s = controls.append("g");
  s.append("text").attr("x", 113).attr("y", 14).text("S:");
  s.append("line").attr("x1", 124).attr("y1", 10).attr("x2", 206).attr("y2", 10);
  s.append("circle").attr("cx", 181.4).attr("cy", 10).attr("r", 5).attr("id", "pickerS");
  s.on("mousemove", () => tip("Set palette saturation"));

  const l = controls.append("g");
  l.append("text").attr("x", 213).attr("y", 14).text("L:");
  l.append("line").attr("x1", 226).attr("y1", 10).attr("x2", 306).attr("y2", 10);
  l.append("circle").attr("cx", 282).attr("cy", 10).attr("r", 5).attr("id", "pickerL");
  l.on("mousemove", () => tip("Set palette lightness"));

  controls.selectAll("line").on("click", clickPickerControl);
  controls.selectAll("circle").call(d3.drag().on("start", dragPickerControl));

  const spaces = picker
    .append("foreignObject")
    .attr("id", "pickerSpaces")
    .attr("x", 4)
    .attr("y", 20)
    .attr("width", 303)
    .attr("height", 20)
    .on("mousemove", () => tip("Color value in different color spaces. Edit to change"));
  const html = /* html */ ` <label style="margin-right: 6px"
      >HSL: <input type="number" id="pickerHSL_H" data-space="hsl" min="0" max="360" value="231" />,
      <input type="number" id="pickerHSL_S" data-space="hsl" min="0" max="100" value="70" />,
      <input type="number" id="pickerHSL_L" data-space="hsl" min="0" max="100" value="70" />
    </label>
    <label style="margin-right: 6px"
      >RGB: <input type="number" id="pickerRGB_R" data-space="rgb" min="0" max="255" value="125" />,
      <input type="number" id="pickerRGB_G" data-space="rgb" min="0" max="255" value="142" />,
      <input type="number" id="pickerRGB_B" data-space="rgb" min="0" max="255" value="232" />
    </label>
    <label>HEX: <input type="text" id="pickerHEX" data-space="hex" style="width:42px" autocorrect="off" spellcheck="false" value="#7d8ee8" /></label>`;
  spaces.node().insertAdjacentHTML("beforeend", html);
  spaces.selectAll("input").on("change", changePickerSpace);

  const colors = picker.append("g").attr("id", "pickerColors").attr("stroke", "#333333");
  const hatches = picker.append("g").attr("id", "pickerHatches").attr("stroke", "#333333");
  const hatching = d3.selectAll("g#defs-hatching > pattern");
  const number = hatching.size();

  const clr = d3.range(number).map(i => d3.hsl((i / number) * 360, 0.7, 0.7).hex());
  clr.forEach(function (d, i) {
    colors
      .append("rect")
      .attr("id", "picker_" + d)
      .attr("fill", d)
      .attr("class", i ? "" : "selected")
      .attr("x", (i % 14) * 22 + 4)
      .attr("y", 40 + Math.floor(i / 14) * 20)
      .attr("width", 16)
      .attr("height", 16);
  });

  hatching.each(function (d, i) {
    hatches
      .append("rect")
      .attr("id", "picker_" + this.id)
      .attr("fill", "url(#" + this.id + ")")
      .attr("x", (i % 14) * 22 + 4)
      .attr("y", Math.floor(i / 14) * 20 + 20 + number * 2)
      .attr("width", 16)
      .attr("height", 16);
  });

  colors
    .selectAll("rect")
    .on("click", pickerFillClicked)
    .on("mouseover", () => tip("Click to fill with the color"));
  hatches
    .selectAll("rect")
    .on("click", pickerFillClicked)
    .on("mouseover", function () {
      tip("Click to fill with the hatching " + this.id);
    });

  // append box
  const bbox = picker.node().getBBox();
  const width = bbox.width + 8;
  const height = bbox.height + 9;

  picker
    .insert("rect", ":first-child")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", width)
    .attr("height", height)
    .attr("fill", "#ffffff")
    .attr("stroke", "#5d4651")
    .on("mousemove", pos);
  picker
    .insert("text", ":first-child")
    .attr("x", width - 20)
    .attr("y", -10)
    .attr("id", "pickerCloseText")
    .text("✕");
  picker
    .insert("rect", ":first-child")
    .attr("x", width - 23)
    .attr("y", -21)
    .attr("id", "pickerCloseRect")
    .attr("width", 14)
    .attr("height", 14)
    .on("mousemove", cl)
    .on("click", closePicker);
  picker
    .insert("text", ":first-child")
    .attr("x", 12)
    .attr("y", -10)
    .attr("id", "pickerLabel")
    .text("Color Picker")
    .on("mousemove", pos);
  picker
    .insert("rect", ":first-child")
    .attr("x", 0)
    .attr("y", -30)
    .attr("width", width)
    .attr("height", 30)
    .attr("id", "pickerHeader")
    .on("mousemove", pos);
  picker.attr("transform", `translate(${(svgWidth - width) / 2},${(svgHeight - height) / 2})`);
}

function updateSelectedRect(fill) {
  byId("picker").querySelector("rect.selected").classList.remove("selected");
  document
    .getElementById("picker")
    .querySelector("rect[fill='" + fill.toLowerCase() + "']")
    .classList.add("selected");
}

function updateSpaces() {
  // hsl
  const h = getPickerControl(pickerH, 360);
  const s = getPickerControl(pickerS, 1);
  const l = getPickerControl(pickerL, 1);
  pickerHSL_H.value = rn(h);
  pickerHSL_S.value = rn(s * 100); // multiplied by 100
  pickerHSL_L.value = rn(l * 100); // multiplied by 100

  // rgb
  const rgb = d3.color(d3.hsl(h, s, l));
  pickerRGB_R.value = rgb.r;
  pickerRGB_G.value = rgb.g;
  pickerRGB_B.value = rgb.b;

  // hex
  pickerHEX.value = rgb.hex();
}

function updatePickerColors() {
  const colors = d3.select("#picker > #pickerColors").selectAll("rect");
  const number = colors.size();

  const h = getPickerControl(pickerH, 360);
  const s = getPickerControl(pickerS, 1);
  const l = getPickerControl(pickerL, 1);

  colors.each(function (d, i) {
    const clr = d3.hsl((i / number) * 180 + h, s, l).hex();
    this.setAttribute("id", "picker_" + clr);
    this.setAttribute("fill", clr);
  });
}

function openPicker(fill, callback) {
  const picker = d3.select("#picker");
  if (!picker.size()) createPicker();
  d3.select("#pickerContainer").style("display", "block");

  if (fill[0] === "#") {
    const hsl = d3.hsl(fill);
    if (!isNaN(hsl.h)) setPickerControl(pickerH, hsl.h, 360);
    if (!isNaN(hsl.s)) setPickerControl(pickerS, hsl.s, 1);
    if (!isNaN(hsl.l)) setPickerControl(pickerL, hsl.l, 1);
    updateSpaces();
    updatePickerColors();
  }

  updateSelectedRect(fill);

  openPicker.updateFill = function () {
    const selected = byId("picker").querySelector("rect.selected");
    if (!selected) return;
    callback(selected.getAttribute("fill"));
  };
}

function setPickerControl(control, value, max) {
  const min = +control.previousSibling.getAttribute("x1");
  const delta = +control.previousSibling.getAttribute("x2") - min;
  const percent = value / max;
  control.setAttribute("cx", min + delta * percent);
}

function getPickerControl(control, max) {
  const min = +control.previousSibling.getAttribute("x1");
  const delta = +control.previousSibling.getAttribute("x2") - min;
  const current = +control.getAttribute("cx") - min;
  return (current / delta) * max;
}

function dragPicker() {
  const tr = parseTransform(this.getAttribute("transform"));
  const x = +tr[0] - d3.event.x,
    y = +tr[1] - d3.event.y;
  const picker = d3.select("#picker");
  const bbox = picker.node().getBBox();

  d3.event.on("drag", function () {
    const px = rn(((x + d3.event.x + bbox.width) / svgWidth) * 100, 2);
    const py = rn(((y + d3.event.y + bbox.height) / svgHeight) * 100, 2);
    const transform = `translate(${x + d3.event.x},${y + d3.event.y})`;
    picker.attr("transform", transform).attr("data-x", px).attr("data-y", py);
  });
}

function pickerFillClicked() {
  const fill = this.getAttribute("fill");
  updateSelectedRect(fill);
  openPicker.updateFill();

  const hsl = d3.hsl(fill);
  if (isNaN(hsl.h)) return; // not a color
  setPickerControl(pickerH, hsl.h, 360);
  updateSpaces();
}

function clickPickerControl() {
  const min = this.getScreenCTM().e;
  this.nextSibling.setAttribute("cx", d3.event.x - min);
  updateSpaces();
  updatePickerColors();
  openPicker.updateFill();
}

function dragPickerControl() {
  const min = +this.previousSibling.getAttribute("x1");
  const max = +this.previousSibling.getAttribute("x2");

  d3.event.on("drag", function () {
    const x = Math.max(Math.min(d3.event.x, max), min);
    this.setAttribute("cx", x);
    updateSpaces();
    updatePickerColors();
    openPicker.updateFill();
  });
}

function changePickerSpace() {
  const valid = this.checkValidity();
  if (!valid) {
    tip("You must provide a correct value", false, "error");
    return;
  }

  const space = this.dataset.space;
  const i = Array.from(this.parentNode.querySelectorAll("input")).map(input => input.value); // inputs
  const fill =
    space === "hex"
      ? d3.rgb(this.value)
      : space === "rgb"
      ? d3.rgb(i[0], i[1], i[2])
      : d3.hsl(i[0], i[1] / 100, i[2] / 100);

  const hsl = d3.hsl(fill);
  if (isNaN(hsl.l)) {
    tip("You must provide a correct value", false, "error");
    return;
  }
  if (!isNaN(hsl.h)) setPickerControl(pickerH, hsl.h, 360);
  if (!isNaN(hsl.s)) setPickerControl(pickerS, hsl.s, 1);
  if (!isNaN(hsl.l)) setPickerControl(pickerL, hsl.l, 1);

  updateSpaces();
  updatePickerColors();
  openPicker.updateFill();
}

// add fogging
function fog(id, path) {
  if (defs.select("#fog #" + id).size()) return;
  const fadeIn = d3.transition().duration(2000).ease(d3.easeSinInOut);
  if (defs.select("#fog path").size()) {
    defs
      .select("#fog")
      .append("path")
      .attr("d", path)
      .attr("id", id)
      .attr("opacity", 0)
      .transition(fadeIn)
      .attr("opacity", 1);
  } else {
    defs.select("#fog").append("path").attr("d", path).attr("id", id).attr("opacity", 1);
    const opacity = fogging.attr("opacity");
    fogging.style("display", "block").attr("opacity", 0).transition(fadeIn).attr("opacity", opacity);
  }
}

// remove fogging
function unfog(id) {
  let el = defs.select("#fog #" + id);
  if (!id || !el.size()) el = defs.select("#fog").selectAll("path");

  el.remove();
  if (!defs.selectAll("#fog path").size()) fogging.style("display", "none");
}

function getFileName(dataType) {
  const formatTime = time => (time < 10 ? "0" + time : time);
  const name = mapName.value;
  const type = dataType ? dataType + " " : "";
  const date = new Date();
  const year = date.getFullYear();
  const month = formatTime(date.getMonth() + 1);
  const day = formatTime(date.getDate());
  const hour = formatTime(date.getHours());
  const minutes = formatTime(date.getMinutes());
  const dateString = [year, month, day, hour, minutes].join("-");
  return name + " " + type + dateString;
}

function downloadFile(data, name, type = "text/plain") {
  const dataBlob = new Blob([data], {type});
  const url = window.URL.createObjectURL(dataBlob);
  const link = document.createElement("a");
  link.download = name;
  link.href = url;
  link.click();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 2000);
}

function uploadFile(el, callback) {
  const fileReader = new FileReader();
  fileReader.readAsText(el.files[0], "UTF-8");
  el.value = "";
  fileReader.onload = loaded => callback(loaded.target.result);
}

function getBBox(element) {
  const x = +element.getAttribute("x");
  const y = +element.getAttribute("y");
  const width = +element.getAttribute("width");
  const height = +element.getAttribute("height");
  return {x, y, width, height};
}

function highlightElement(element, zoom) {
  if (debug.select(".highlighted").size()) return; // allow only 1 highlight element simultaneously
  const box = element.tagName === "svg" ? getBBox(element) : element.getBBox();
  const transform = element.getAttribute("transform") || null;
  const enter = d3.transition().duration(1000).ease(d3.easeBounceOut);
  const exit = d3.transition().duration(500).ease(d3.easeLinear);

  const highlight = debug
    .append("rect")
    .attr("x", box.x)
    .attr("y", box.y)
    .attr("width", box.width)
    .attr("height", box.height);
  highlight.classed("highlighted", 1).attr("transform", transform);
  highlight
    .transition(enter)
    .style("outline-offset", "0px")
    .transition(exit)
    .style("outline-color", "transparent")
    .delay(1000)
    .remove();

  if (zoom) {
    const tr = parseTransform(transform);
    let x = box.x + box.width / 2;
    if (tr[0]) x += tr[0];
    let y = box.y + box.height / 2;
    if (tr[1]) y += tr[1];
    zoomTo(x, y, scale > 2 ? scale : zoom, 1600);
  }
}

function selectIcon(initial, callback) {
  if (!callback) return;
  $("#iconSelector").dialog();

  const table = byId("iconTable");
  const input = byId("iconInput");
  input.value = initial;

  if (!table.innerHTML) {
    const icons = [
      "⚔️",
      "🏹",
      "🐴",
      "💣",
      "🌊",
      "🎯",
      "⚓",
      "🔮",
      "📯",
      "⚒️",
      "🛡️",
      "👑",
      "⚜️",
      "☠️",
      "🎆",
      "🗡️",
      "🔪",
      "⛏️",
      "🔥",
      "🩸",
      "💧",
      "🐾",
      "🎪",
      "🏰",
      "🏯",
      "⛓️",
      "❤️",
      "💘",
      "💜",
      "📜",
      "🔔",
      "🔱",
      "💎",
      "🌈",
      "🌠",
      "✨",
      "💥",
      "☀️",
      "🌙",
      "⚡",
      "❄️",
      "♨️",
      "🎲",
      "🚨",
      "🌉",
      "🗻",
      "🌋",
      "🧱",
      "⚖️",
      "✂️",
      "🎵",
      "👗",
      "🎻",
      "🎨",
      "🎭",
      "⛲",
      "💉",
      "📖",
      "📕",
      "🎁",
      "💍",
      "⏳",
      "🕸️",
      "⚗️",
      "☣️",
      "☢️",
      "🔰",
      "🎖️",
      "🚩",
      "🏳️",
      "🏴",
      "💪",
      "✊",
      "👊",
      "🤜",
      "🤝",
      "🙏",
      "🧙",
      "🧙‍♀️",
      "💂",
      "🤴",
      "🧛",
      "🧟",
      "🧞",
      "🧝",
      "👼",
      "👻",
      "👺",
      "👹",
      "🦄",
      "🐲",
      "🐉",
      "🐎",
      "🦓",
      "🐺",
      "🦊",
      "🐱",
      "🐈",
      "🦁",
      "🐯",
      "🐅",
      "🐆",
      "🐕",
      "🦌",
      "🐵",
      "🐒",
      "🦍",
      "🦅",
      "🕊️",
      "🐓",
      "🦇",
      "🦜",
      "🐦",
      "🦉",
      "🐮",
      "🐄",
      "🐂",
      "🐃",
      "🐷",
      "🐖",
      "🐗",
      "🐏",
      "🐑",
      "🐐",
      "🐫",
      "🦒",
      "🐘",
      "🦏",
      "🐭",
      "🐁",
      "🐀",
      "🐹",
      "🐰",
      "🐇",
      "🦔",
      "🐸",
      "🐊",
      "🐢",
      "🦎",
      "🐍",
      "🐳",
      "🐬",
      "🦈",
      "🐠",
      "🐙",
      "🦑",
      "🐌",
      "🦋",
      "🐜",
      "🐝",
      "🐞",
      "🦗",
      "🕷️",
      "🦂",
      "🦀",
      "🌳",
      "🌲",
      "🎄",
      "🌴",
      "🍂",
      "🍁",
      "🌵",
      "☘️",
      "🍀",
      "🌿",
      "🌱",
      "🌾",
      "🍄",
      "🌽",
      "🌸",
      "🌹",
      "🌻",
      "🍒",
      "🍏",
      "🍇",
      "🍉",
      "🍅",
      "🍓",
      "🥔",
      "🥕",
      "🥩",
      "🍗",
      "🍞",
      "🍻",
      "🍺",
      "🍲",
      "🍷"
    ];

    let row = "";
    for (let i = 0; i < icons.length; i++) {
      if (i % 17 === 0) row = table.insertRow((i / 17) | 0);
      const cell = row.insertCell(i % 17);
      cell.innerHTML = icons[i];
    }
  }

  input.oninput = e => callback(input.value);
  table.onclick = e => {
    if (e.target.tagName === "TD") {
      input.value = e.target.textContent;
      callback(input.value);
    }
  };
  table.onmouseover = e => {
    if (e.target.tagName === "TD") tip(`Click to select ${e.target.textContent} icon`);
  };

  $("#iconSelector").dialog({
    width: fitContent(),
    title: "Select Icon",
    buttons: {
      Apply: function () {
        callback(input.value || "⠀");
        $(this).dialog("close");
      },
      Close: function () {
        callback(initial);
        $(this).dialog("close");
      }
    }
  });
}

function getAreaUnit(squareMark = "²") {
  return byId("areaUnit").value === "square" ? byId("distanceUnitInput").value + squareMark : byId("areaUnit").value;
}

function getArea(rawArea) {
  return rawArea * distanceScale ** 2;
}

function confirmationDialog(options) {
  const {
    title = "Confirm action",
    message = "Are you sure you want to continue? <br>The action cannot be reverted",
    cancel = "Cancel",
    confirm = "Continue",
    onCancel,
    onConfirm
  } = options;

  const buttons = {
    [confirm]: function () {
      if (onConfirm) onConfirm();
      $(this).dialog("close");
    },
    [cancel]: function () {
      if (onCancel) onCancel();
      $(this).dialog("close");
    }
  };

  byId("alertMessage").innerHTML = message;
  $("#alert").dialog({resizable: false, title, buttons});
}

// add and register event listeners to clean up on editor closure
function listen(element, event, handler) {
  element.on(event, handler);
  return () => element.off(event, handler);
}

// Calls the refresh functionality on all editors currently open.
function refreshAllEditors() {
  TIME && console.time("refreshAllEditors");
  if (byId("culturesEditorRefresh")?.offsetParent) culturesEditorRefresh.click();
  if (byId("biomesEditorRefresh")?.offsetParent) biomesEditorRefresh.click();
  if (byId("diplomacyEditorRefresh")?.offsetParent) diplomacyEditorRefresh.click();
  if (byId("provincesEditorRefresh")?.offsetParent) provincesEditorRefresh.click();
  if (byId("religionsEditorRefresh")?.offsetParent) religionsEditorRefresh.click();
  if (byId("statesEditorRefresh")?.offsetParent) statesEditorRefresh.click();
  if (byId("zonesEditorRefresh")?.offsetParent) zonesEditorRefresh.click();
  TIME && console.timeEnd("refreshAllEditors");
}

// dynamically loaded editors
async function editStates() {
  if (customization) return;
  const Editor = await import("../dynamic/editors/states-editor.js?v=1.99.05");
  Editor.open();
}

async function editCultures() {
  if (customization) return;
  const Editor = await import("../dynamic/editors/cultures-editor.js?v=1.99.05");
  Editor.open();
}

async function editReligions() {
  if (customization) return;
  const Editor = await import("../dynamic/editors/religions-editor.js?v=1.99.05");
  Editor.open();
}
