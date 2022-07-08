import * as d3 from "d3";

import {restoreDefaultEvents} from "scripts/events";
import {findCell} from "utils/graphUtils";
import {byId} from "utils/shorthands";
import {tip} from "scripts/tooltips";
import {rn, minmax, normalize} from "utils/numberUtils";
import {parseTransform} from "utils/stringUtils";

// clear elSelected variable
export function unselect() {
  restoreDefaultEvents();
  if (!elSelected) return;
  elSelected.call(d3.drag().on("drag", null)).attr("class", null);
  debug.selectAll("*").remove();
  viewbox.style("cursor", "default");
  elSelected = null;
}

// close all dialogs except stated
export function closeDialogs(except = "#except") {
  try {
    $(".dialog:visible")
      .not(except)
      .each(function () {
        $(this).dialog("close");
      });
  } catch (error) {}
}

// move brush radius circle
export function moveCircle(x, y, r = 20) {
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

export function removeCircle() {
  if (byId("brushCircle")) byId("brushCircle").remove();
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
  const cells = pack.cells;
  const x = rn(point[0], 2),
    y = rn(point[1], 2);
  const cell = findCell(x, point[1]);
  const i = pack.burgs.length;
  const culture = cells.culture[cell];
  const name = Names.getCulture(culture);
  const state = cells.state[cell];
  const feature = cells.f[cell];

  const temple = pack.states[state].form === "Theocracy";
  const population = Math.max((cells.s[cell] + cells.road[cell]) / 3 + i / 1000 + (cell % 100) / 1000, 0.1);
  const type = BurgsAndStates.getType(cell, false);

  // generate emblem
  const coa = COA.generate(pack.states[state].coa, 0.25, null, type);
  coa.shield = COA.getShield(culture, state);
  COArenderer.add("burg", i, coa, x, y);

  pack.burgs.push({name, cell, x, y, state, i, culture, feature, capital: 0, port: 0, temple, population, coa, type});
  cells.burg[cell] = i;

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

  BurgsAndStates.defineBurgFeatures(pack.burgs[i]);
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
  const label = document.querySelector("#burgLabels [data-id='" + id + "']");
  const icon = document.querySelector("#burgIcons [data-id='" + id + "']");
  const anchor = document.querySelector("#anchors [data-id='" + id + "']");
  if (label) label.remove();
  if (icon) icon.remove();
  if (anchor) anchor.remove();

  const cells = pack.cells,
    burg = pack.burgs[id];
  burg.removed = true;
  cells.burg[burg.cell] = 0;

  if (burg.coa) {
    const coaId = "burgCOA" + id;
    if (byId(coaId)) byId(coaId).remove();
    emblems.select(`#burgEmblems > use[data-i='${id}']`).remove();
    delete burg.coa; // remove to save data
  }
}

function toggleCapital(burg) {
  const state = pack.burgs[burg].state;
  if (!state) {
    tip("Neutral lands cannot have a capital", false, "error");
    return;
  }
  if (pack.burgs[burg].capital) {
    tip("To change capital please assign a capital status to another burg of this state", false, "error");
    return;
  }
  const old = pack.states[state].capital;

  // change statuses
  pack.states[state].capital = burg;
  pack.states[state].center = pack.burgs[burg].cell;
  pack.burgs[burg].capital = 1;
  pack.burgs[old].capital = 0;
  moveBurgToGroup(burg, "cities");
  moveBurgToGroup(old, "towns");
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

function getBurgSeed(burg) {
  return burg.MFCG || Number(`${seed}${String(burg.i).padStart(4, 0)}`);
}

function getMFCGlink(burg) {
  if (burg.link) return burg.link;

  const {cells} = pack;
  const {i, name, population: burgPopulation, cell} = burg;
  const seed = getBurgSeed(burg);

  const sizeRaw = 2.13 * Math.pow((burgPopulation * populationRate) / urbanDensity, 0.385);
  const size = minmax(Math.ceil(sizeRaw), 6, 100);
  const population = rn(burgPopulation * populationRate * urbanization);

  const river = cells.r[cell] ? 1 : 0;
  const coast = Number(burg.port > 0);
  const sea = coast && cells.haven[cell] ? getSeaDirections(cell) : null;

  const biome = cells.biome[cell];
  const arableBiomes = river ? [1, 2, 3, 4, 5, 6, 7, 8] : [5, 6, 7, 8];
  const farms = +arableBiomes.includes(biome);

  const citadel = +burg.citadel;
  const urban_castle = +(citadel && each(2)(i));

  const hub = +cells.road[cell] > 50;

  const walls = +burg.walls;
  const plaza = +burg.plaza;
  const temple = +burg.temple;
  const shantytown = +burg.shanty;

  function getSeaDirections(i) {
    const p1 = cells.p[i];
    const p2 = cells.p[cells.haven[i]];
    let deg = (Math.atan2(p2[1] - p1[1], p2[0] - p1[0]) * 180) / Math.PI - 90;
    if (deg < 0) deg += 360;
    return rn(normalize(deg, 0, 360) * 2, 2); // 0 = south, 0.5 = west, 1 = north, 1.5 = east
  }

  const parameters = {
    name,
    population,
    size,
    seed,
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
  };
  const url = new URL("https://watabou.github.io/city-generator/");
  url.search = new URLSearchParams(parameters);
  if (sea) url.searchParams.append("sea", sea);

  return url.toString();
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
      input.value = e.target.innerHTML;
      callback(input.value);
    }
  };
  table.onmouseover = e => {
    if (e.target.tagName === "TD") tip(`Click to select ${e.target.innerHTML} icon`);
  };

  $("#iconSelector").dialog({
    width: "fit-content",
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
  const distanceScale = byId("distanceScaleInput")?.value;
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
export async function editStates() {
  if (customization) return;
  const Editor = await import("../dynamic/editors/states-editor.js");
  Editor.open();
}

export async function editCultures() {
  if (customization) return;
  const Editor = await import("../dynamic/editors/cultures-editor.js");
  Editor.open();
}

export async function editReligions() {
  if (customization) return;
  const Editor = await import("../dynamic/editors/religions-editor.js");
  Editor.open();
}

export async function editUnits() {
  const {open} = await import("./units-editor.js");
  open();
}