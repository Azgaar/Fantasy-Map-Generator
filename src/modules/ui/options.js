import * as d3 from "d3";

import {heightmapTemplates} from "config/heightmap-templates";
import {precreatedHeightmaps} from "config/precreated-heightmaps";
import {lock, locked} from "scripts/options/lock";
import {clearMainTip, tip} from "scripts/tooltips";
import {last} from "utils/arrayUtils";
import {applyDropdownOption} from "utils/nodeUtils";
import {minmax, rn} from "utils/numberUtils";
import {gauss, P, rand, rw} from "utils/probabilityUtils";
import {byId, stored} from "utils/shorthands";
import {regenerateMap} from "scripts/generation/generation";
import {fitScaleBar} from "modules/measurers";
import {openDialog} from "dialogs";
import {closeDialogs} from "dialogs/utils";
import {quickSave, saveToDropbox, dowloadMap} from "modules/io/save.js";

$("#optionsContainer").draggable({handle: ".drag-trigger", snap: "svg", snapMode: "both"});
$("#exitCustomization").draggable({handle: "div"});
$("#mapLayers").disableSelection();

// remove glow if tip is aknowledged
if (stored("disable_click_arrow_tooltip")) {
  clearMainTip();
  optionsTrigger.classList.remove("glow");
}

// Show options pane on trigger click
function showOptions(event) {
  if (!stored("disable_click_arrow_tooltip")) {
    clearMainTip();
    localStorage.setItem("disable_click_arrow_tooltip", true);
    optionsTrigger.classList.remove("glow");
  }

  regenerate.style.display = "none";
  byId("options").style.display = "block";
  optionsTrigger.style.display = "none";

  if (event) event.stopPropagation();
}

// Hide options pane on trigger click
export function hideOptions(event) {
  byId("options").style.display = "none";
  optionsTrigger.style.display = "block";
  if (event) event.stopPropagation();
}

// To toggle options on hotkey press
export function toggleOptions(event) {
  if (byId("options").style.display === "none") showOptions(event);
  else hideOptions(event);
}

// Toggle "New Map!" pane on hover
optionsTrigger.on("mouseenter", function () {
  if (optionsTrigger.classList.contains("glow")) return;
  if (byId("options").style.display === "none") regenerate.style.display = "block";
});

collapsible.on("mouseleave", function () {
  regenerate.style.display = "none";
});

// Activate options tab on click
document
  .getElementById("options")
  .querySelector("div.tab")
  .on("click", function (event) {
    if (event.target.tagName !== "BUTTON") return;
    const id = event.target.id;
    const active = byId("options").querySelector(".tab > button.active");
    if (active && id === active.id) return; // already active tab is clicked

    if (active) active.classList.remove("active");
    byId(id).classList.add("active");
    document
      .getElementById("options")
      .querySelectorAll(".tabcontent")
      .forEach(e => (e.style.display = "none"));

    if (id === "layersTab") layersContent.style.display = "block";
    else if (id === "styleTab") styleContent.style.display = "block";
    else if (id === "optionsTab") optionsContent.style.display = "block";
    else if (id === "toolsTab")
      customization === 1 ? (customizationMenu.style.display = "block") : (toolsContent.style.display = "block");
    else if (id === "aboutTab") aboutContent.style.display = "block";
  });

// show popup with a list of Patreon supportes (updated manually)
async function showSupporters() {
  const {supporters} = await import("../dynamic/supporters.js");
  alertMessage.innerHTML =
    "<ul style='column-count: 5; column-gap: 2em'>" + supporters.map(n => `<li>${n}</li>`).join("") + "</ul>";
  $("#alert").dialog({
    resizable: false,
    title: "Patreon Supporters",
    width: "54vw",
    position: {my: "center", at: "center", of: "svg"}
  });
}

// on any option or dialog change
byId("options").on("change", storeValueIfRequired);
byId("dialogs").on("change", storeValueIfRequired);
byId("options").on("input", updateOutputToFollowInput);
byId("dialogs").on("input", updateOutputToFollowInput);

function storeValueIfRequired(ev) {
  if (ev.target.dataset.stored) lock(ev.target.dataset.stored);
}

function updateOutputToFollowInput(ev) {
  const id = ev.target.id;
  const value = ev.target.value;

  // specific cases
  if (id === "manorsInput") return (manorsOutput.value = value == 1000 ? "auto" : value);

  // generic case
  if (id.slice(-5) === "Input") {
    const output = byId(id.slice(0, -5) + "Output");
    if (output) output.value = value;
  } else if (id.slice(-6) === "Output") {
    const input = byId(id.slice(0, -6) + "Input");
    if (input) input.value = value;
  }
}

// Option listeners
const optionsContent = byId("optionsContent");
optionsContent.on("input", function (event) {
  const id = event.target.id;
  const value = event.target.value;
  if (id === "mapWidthInput" || id === "mapHeightInput") mapSizeInputChange();
  else if (id === "pointsInput") changeCellsDensity(+value);
  else if (id === "culturesSet") changeCultureSet();
  else if (id === "regionsInput" || id === "regionsOutput") changeStatesNumber(value);
  else if (id === "emblemShape") changeEmblemShape(value);
  else if (id === "tooltipSizeInput" || id === "tooltipSizeOutput") changeTooltipSize(value);
  else if (id === "themeHueInput") changeThemeHue(value);
  else if (id === "themeColorInput") changeDialogsTheme(themeColorInput.value, transparencyInput.value);
  else if (id === "transparencyInput") changeDialogsTheme(themeColorInput.value, value);
});

optionsContent.on("change", function (event) {
  const id = event.target.id;
  const value = event.target.value;

  if (id === "zoomExtentMin" || id === "zoomExtentMax") changeZoomExtent(value);
  else if (id === "optionsSeed") generateMapWithSeed("seed change");
  else if (id === "uiSizeInput" || id === "uiSizeOutput") changeUIsize(value);
  else if (id === "shapeRendering") setRendering(value);
  else if (id === "yearInput") changeYear();
  else if (id === "eraInput") changeEra();
  else if (id === "stateLabelsModeInput") options.stateLabelsMode = value;
});

optionsContent.on("click", function (event) {
  const id = event.target.id;
  if (id === "toggleFullscreen") toggleFullscreen();
  else if (id === "optionsMapHistory") showSeedHistoryDialog();
  else if (id === "optionsCopySeed") copyMapURL();
  else if (id === "optionsEraRegenerate") regenerateEra();
  else if (id === "templateInputContainer") openDialog("heightmapSelection");
  else if (id === "zoomExtentDefault") restoreDefaultZoomExtent();
  else if (id === "translateExtent") toggleTranslateExtent(event.target);
  else if (id === "speakerTest") testSpeaker();
  else if (id === "themeColorRestore") restoreDefaultThemeColor();
  else if (id === "configureWorld") openDialog("worldConfigurator");
  else if (id === "optionsReset") restoreDefaultOptions();
});

function mapSizeInputChange() {
  changeMapSize();
  localStorage.setItem("mapWidth", mapWidthInput.value);
  localStorage.setItem("mapHeight", mapHeightInput.value);
}

export function addResizeListener() {
  // fit full-screen map if window is resized
  window.addEventListener("resize", function () {
    if (stored("mapWidth") && stored("mapHeight")) return;

    const {innerWidth, innerHeight} = window;
    byId("mapWidthInput").value = innerWidth;
    byId("mapHeightInput").value = innerHeight;

    changeMapSize();
  });
}

// change svg size on manual size change or window resize, do not change graph size
function changeMapSize() {
  svgWidth = Math.min(+mapWidthInput.value, window.innerWidth);
  svgHeight = Math.min(+mapHeightInput.value, window.innerHeight);
  svg.attr("width", svgWidth).attr("height", svgHeight);

  const maxWidth = Math.max(+mapWidthInput.value, graphWidth);
  const maxHeight = Math.max(+mapHeightInput.value, graphHeight);

  Zoom.translateExtent([0, 0, maxWidth, maxHeight]);

  landmass.select("rect").attr("x", 0).attr("y", 0).attr("width", maxWidth).attr("height", maxHeight);
  oceanPattern.select("rect").attr("x", 0).attr("y", 0).attr("width", maxWidth).attr("height", maxHeight);
  oceanLayers.select("rect").attr("x", 0).attr("y", 0).attr("width", maxWidth).attr("height", maxHeight);
  fogging.selectAll("rect").attr("x", 0).attr("y", 0).attr("width", maxWidth).attr("height", maxHeight);
  defs.select("mask#fog > rect").attr("width", maxWidth).attr("height", maxHeight);
  texture.select("image").attr("width", maxWidth).attr("height", maxHeight);

  fitScaleBar();
  if (window.fitLegendBox) fitLegendBox();
}

// just apply canvas size that was already set
export function applyMapSize() {
  const zoomMin = +zoomExtentMin.value;
  const zoomMax = +zoomExtentMax.value;
  graphWidth = +mapWidthInput.value;
  graphHeight = +mapHeightInput.value;
  svgWidth = Math.min(graphWidth, window.innerWidth);
  svgHeight = Math.min(graphHeight, window.innerHeight);
  svg.attr("width", svgWidth).attr("height", svgHeight);

  // Zoom.translateExtent([0, 0, graphWidth, graphHeight]);
  Zoom.translateExtent([-100, -100, graphWidth + 200, graphHeight + 200]);

  Zoom.scaleExtent([zoomMin, zoomMax]);
  Zoom.scaleTo(svg, zoomMin);
}

function toggleFullscreen() {
  if (mapWidthInput.value != window.innerWidth || mapHeightInput.value != window.innerHeight) {
    mapWidthInput.value = window.innerWidth;
    mapHeightInput.value = window.innerHeight;
    localStorage.removeItem("mapHeight");
    localStorage.removeItem("mapWidth");
  } else {
    mapWidthInput.value = graphWidth;
    mapHeightInput.value = graphHeight;
  }
  changeMapSize();
}

function toggleTranslateExtent(el) {
  const on = !Number(el.dataset.on);
  const extent = on
    ? [-graphWidth / 2, -graphHeight / 2, graphWidth * 1.5, graphHeight * 1.5]
    : [0, 0, graphWidth, graphHeight];
  Zoom.translateExtent(extent);

  el.dataset.on = Number(on);
}

// add voice options
const voiceInterval = setInterval(function () {
  const voices = speechSynthesis.getVoices();
  if (voices.length) clearInterval(voiceInterval);
  else return;

  const select = byId("speakerVoice");
  voices.forEach((voice, i) => {
    select.options.add(new Option(voice.name, i, false));
  });
  if (stored("speakerVoice")) select.value = stored("speakerVoice");
  // se voice to store
  else select.value = voices.findIndex(voice => voice.lang === "en-US"); // or to first found English-US
}, 1000);

function testSpeaker() {
  const text = `${mapName.value}, ${options.year} ${options.era}`;
  const speaker = new SpeechSynthesisUtterance(text);
  const voices = speechSynthesis.getVoices();
  if (voices.length) {
    const voiceId = +byId("speakerVoice").value;
    speaker.voice = voices[voiceId];
  }
  speechSynthesis.speak(speaker);
}

function generateMapWithSeed() {
  if (optionsSeed.value == seed) return tip("The current map already has this seed", false, "error");
  regeneratePrompt();
}

function showSeedHistoryDialog() {
  const lines = mapHistory.map((h, i) => {
    const created = new Date(h.created).toLocaleTimeString();
    const button = `<i data-tip="Click to generate a map with this seed" onclick="restoreSeed(${i})" class="icon-history optionsSeedRestore"></i>`;
    return `<li>Seed: ${h.seed} ${button}. Size: ${h.width}x${h.height}. Template: ${h.template}. Created: ${created}</li>`;
  });
  alertMessage.innerHTML = /* html */ `<ol style="margin: 0; padding-left: 1.5em">
    ${lines.join("")}
  </ol>`;

  $("#alert").dialog({
    resizable: false,
    title: "Seed history",
    position: {my: "center", at: "center", of: "svg"}
  });
}

// generate map with historical seed
function restoreSeed(id) {
  const {seed, width, height, template} = mapHistory[id];
  byId("optionsSeed").value = seed;
  byId("mapWidthInput").value = width;
  byId("mapHeightInput").value = height;
  byId("templateInput").value = template;

  if (locked("template")) unlock("template");

  regeneratePrompt();
}

function restoreDefaultZoomExtent() {
  zoomExtentMin.value = 1;
  zoomExtentMax.value = 20;
  Zoom.scaleExtent([1, 20]);
  Zoom.scaleTo(svg, 1);
}

function copyMapURL() {
  const locked = document.querySelectorAll("i.icon-lock").length; // check if some options are locked
  const search = `?seed=${optionsSeed.value}&width=${graphWidth}&height=${graphHeight}${
    locked ? "" : "&options=default"
  }`;
  navigator.clipboard
    .writeText(location.host + location.pathname + search)
    .then(() => {
      tip("Map URL is copied to clipboard", false, "success", 3000);
      //window.history.pushState({}, null, search);
    })
    .catch(err => tip("Could not copy URL: " + err, false, "error", 5000));
}

const cellsDensityMap = {
  1: 1000,
  2: 2000,
  3: 5000,
  4: 10000,
  5: 20000,
  6: 30000,
  7: 40000,
  8: 50000,
  9: 60000,
  10: 70000,
  11: 80000,
  12: 90000,
  13: 100000
};

function changeCellsDensity(value) {
  const cells = cellsDensityMap[value] || 1000;
  pointsInput.dataset.cells = cells;
  pointsOutputFormatted.value = getCellsDensityValue(cells);
  pointsOutputFormatted.style.color = getCellsDensityColor(cells);
}

function getCellsDensityValue(cells) {
  return cells / 1000 + "K";
}

function getCellsDensityColor(cells) {
  return cells > 50000 ? "#b12117" : cells !== 10000 ? "#dfdf12" : "#053305";
}

function changeCultureSet() {
  const max = culturesSet.selectedOptions[0].dataset.max;
  culturesInput.max = culturesOutput.max = max;
  if (+culturesOutput.value > +max) culturesInput.value = culturesOutput.value = max;
}

function changeEmblemShape(emblemShape) {
  const image = byId("emblemShapeImage");
  const shapePath = window.COArenderer && COArenderer.shieldPaths[emblemShape];
  shapePath ? image.setAttribute("d", shapePath) : image.removeAttribute("d");

  const specificShape = ["culture", "state", "random"].includes(emblemShape) ? null : emblemShape;
  if (emblemShape === "random") pack.cultures.filter(c => !c.removed).forEach(c => (c.shield = COA.getRandomShield()));

  const rerenderCOA = (id, coa) => {
    const coaEl = byId(id);
    if (!coaEl) return; // not rendered
    coaEl.remove();
    COArenderer.trigger(id, coa);
  };

  pack.states.forEach(state => {
    if (!state.i || state.removed || !state.coa || state.coa === "custom") return;

    const newShield = specificShape || COA.getPackShield(state.culture, null);
    if (newShield === state.coa.shield) return;
    state.coa.shield = newShield;
    rerenderCOA("stateCOA" + state.i, state.coa);
  });

  pack.provinces.forEach(province => {
    if (!province.i || province.removed || !province.coa || province.coa === "custom") return;
    const culture = pack.cells.culture[province.center];
    const newShield = specificShape || COA.getPackShield(culture, province.state);
    if (newShield === province.coa.shield) return;
    province.coa.shield = newShield;
    rerenderCOA("provinceCOA" + province.i, province.coa);
  });

  pack.burgs.forEach(burg => {
    if (!burg.i || burg.removed || !burg.coa || burg.coa === "custom") return;
    const newShield = specificShape || COA.getPackShield(burg.culture, burg.state);
    if (newShield === burg.coa.shield) return;
    burg.coa.shield = newShield;
    rerenderCOA("burgCOA" + burg.i, burg.coa);
  });
}

function changeStatesNumber(value) {
  regionsOutput.style.color = +value ? null : "#b12117";
  burgLabels.select("#capitals").attr("data-size", Math.max(rn(6 - value / 20), 3));
  labels.select("#countries").attr("data-size", Math.max(rn(18 - value / 6), 4));
}

function changeUIsize(value) {
  if (isNaN(+value) || +value < 0.5) return;

  const max = getUImaxSize();
  if (+value > max) value = max;

  uiSizeInput.value = uiSizeOutput.value = value;
  document.getElementsByTagName("body")[0].style.fontSize = rn(value * 10, 2) + "px";
  byId("options").style.width = value * 300 + "px";
}

function getUImaxSize() {
  return rn(Math.min(window.innerHeight / 465, window.innerWidth / 302), 1);
}

function changeTooltipSize(value) {
  tooltip.style.fontSize = `calc(${value}px + 0.5vw)`;
}

const THEME_COLOR = "#997787";
function restoreDefaultThemeColor() {
  localStorage.removeItem("themeColor");
  changeDialogsTheme(THEME_COLOR, transparencyInput.value);
}

function changeThemeHue(hue) {
  const {s, l} = d3.hsl(themeColorInput.value);
  const newColor = d3.hsl(+hue, s, l).hex();
  changeDialogsTheme(newColor, transparencyInput.value);
}

// change color and transparency for modal windows
function changeDialogsTheme(themeColor, transparency) {
  transparencyInput.value = transparencyOutput.value = transparency;
  const alpha = (100 - +transparency) / 100;
  const alphaReduced = Math.min(alpha + 0.3, 1);

  const {h, s, l} = d3.hsl(themeColor || THEME_COLOR);
  themeColorInput.value = themeColor || THEME_COLOR;
  themeHueInput.value = h;

  const getRGBA = (hue, saturation, lightness, alpha) => {
    const color = d3.hsl(hue, saturation, lightness, alpha);
    return color.toString();
  };

  const theme = [
    {name: "--bg-main", h, s, l, alpha},
    {name: "--bg-lighter", h, s, l: l + 0.02, alpha},
    {name: "--bg-light", h, s: s - 0.02, l: l + 0.06, alpha},
    {name: "--light-solid", h, s: s + 0.01, l: l + 0.05, alpha: 1},
    {name: "--dark-solid", h, s, l: l - 0.2, alpha: 1},
    {name: "--header", h, s: s, l: l - 0.03, alpha: alphaReduced},
    {name: "--header-active", h, s: s, l: l - 0.09, alpha: alphaReduced},
    {name: "--bg-disabled", h, s: s - 0.04, l: l + 0.09, alphaReduced},
    {name: "--bg-dialogs", h: 0, s: 0, l: 0.98, alpha}
  ];

  const sx = document.documentElement.style;
  theme.forEach(({name, h, s, l, alpha}) => {
    sx.setProperty(name, getRGBA(h, s, l, alpha));
  });
}

function changeZoomExtent(value) {
  const zoomExtentMin = byId("zoomExtentMin");
  const zoomExtentMax = byId("zoomExtentMax");

  if (+zoomExtentMin.value > +zoomExtentMax.value) {
    [zoomExtentMin.value, zoomExtentMax.value] = [zoomExtentMax.value, zoomExtentMin.value];
  }
  const min = Math.max(+zoomExtentMin.value, 0.01);
  const max = Math.min(+zoomExtentMax.value, 200);
  zoomExtentMin.value = min;
  zoomExtentMax.value = max;
  zoom.scaleExtent([min, max]);
  const scale = minmax(+value, 0.01, 200);
  Zoom.scaleTo(svg, scale);
}

// restore options stored in localStorage
export function applyStoredOptions() {
  if (!stored("mapWidth") || !stored("mapHeight")) {
    mapWidthInput.value = window.innerWidth;
    mapHeightInput.value = window.innerHeight;
  }

  const heightmapId = stored("template");
  if (heightmapId) {
    const name = heightmapTemplates[heightmapId]?.name || precreatedHeightmaps[heightmapId]?.name || heightmapId;
    applyDropdownOption(byId("templateInput"), heightmapId, name);
  }

  if (stored("distanceUnit")) applyDropdownOption(byId("distanceUnitInput"), stored("distanceUnit"));
  if (stored("heightUnit")) applyDropdownOption(byId("heightUnit"), stored("heightUnit"));

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);

    if (key === "speakerVoice") continue;
    const input = byId(key + "Input") || byId(key);
    const output = byId(key + "Output");

    const value = stored(key);
    if (input) input.value = value;
    if (output) output.value = value;
    lock(key);

    // add saved style presets to options
    if (key.slice(0, 5) === "style") applyDropdownOption(byId("stylePreset"), key, key.slice(5));
  }

  if (stored("winds"))
    options.winds = localStorage
      .getItem("winds")
      .split(",")
      .map(w => +w);
  if (stored("military")) options.military = JSON.parse(stored("military"));

  if (stored("tooltipSize")) changeTooltipSize(stored("tooltipSize"));
  if (stored("regions")) changeStatesNumber(stored("regions"));

  uiSizeInput.max = uiSizeOutput.max = getUImaxSize();
  if (stored("uiSize")) changeUIsize(stored("uiSize"));
  else changeUIsize(minmax(rn(mapWidthInput.value / 1280, 1), 1, 2.5));

  // search params overwrite stored and default options
  const params = new URL(window.location.href).searchParams;
  const width = +params.get("width");
  const height = +params.get("height");
  if (width) mapWidthInput.value = width;
  if (height) mapHeightInput.value = height;

  const transparency = stored("transparency") || 5;
  const themeColor = stored("themeColor");
  changeDialogsTheme(themeColor, transparency);

  setRendering(shapeRendering.value);
  options.stateLabelsMode = stateLabelsModeInput.value;
}

// randomize options if randomization is allowed (not locked or options='default')
export function randomizeOptions() {
  const randomize = new URL(window.location.href).searchParams.get("options") === "default"; // ignore stored options

  // 'Options' settings
  if (randomize || !locked("template")) randomizeHeightmapTemplate();
  if (randomize || !locked("regions")) regionsInput.value = regionsOutput.value = gauss(18, 5, 2, 30);
  if (randomize || !locked("provinces")) provincesInput.value = provincesOutput.value = gauss(20, 10, 20, 100);
  if (randomize || !locked("manors")) {
    manorsInput.value = 1000;
    manorsOutput.value = "auto";
  }
  if (randomize || !locked("religions")) religionsInput.value = religionsOutput.value = gauss(6, 3, 2, 10);
  if (randomize || !locked("power")) powerInput.value = powerOutput.value = gauss(4, 2, 0, 10, 2);
  if (randomize || !locked("neutral")) neutralInput.value = neutralOutput.value = rn(1 + Math.random(), 1);
  if (randomize || !locked("cultures")) culturesInput.value = culturesOutput.value = gauss(12, 3, 5, 30);
  if (randomize || !locked("culturesSet")) randomizeCultureSet();

  // 'Configure World' settings
  if (randomize || !locked("prec")) precInput.value = precOutput.value = gauss(100, 40, 5, 500);
  const tMax = 30,
    tMin = -30; // temperature extremes
  if (randomize || !locked("temperatureEquator"))
    temperatureEquatorOutput.value = temperatureEquatorInput.value = rand(tMax - 10, tMax);
  if (randomize || !locked("temperaturePole"))
    temperaturePoleOutput.value = temperaturePoleInput.value = rand(tMin, tMin + 30);

  // 'Units Editor' settings
  const US = navigator.language === "en-US";
  if (randomize || !locked("distanceScale")) distanceScaleOutput.value = distanceScaleInput.value = gauss(3, 1, 1, 5);
  if (!stored("distanceUnit")) distanceUnitInput.value = US ? "mi" : "km";
  if (!stored("heightUnit")) heightUnit.value = US ? "ft" : "m";
  if (!stored("temperatureScale")) temperatureScale.value = US ? "°F" : "°C";

  // World settings
  generateEra();
}

// select heightmap template pseudo-randomly
function randomizeHeightmapTemplate() {
  const templates = {};
  for (const key in heightmapTemplates) {
    templates[key] = heightmapTemplates[key].probability || 0;
  }
  const template = rw(templates);
  const name = heightmapTemplates[template].name;
  applyDropdownOption(byId("templateInput"), template, name);
}

// select culture set pseudo-randomly
function randomizeCultureSet() {
  const sets = {
    world: 10,
    european: 10,
    oriental: 2,
    english: 5,
    antique: 3,
    highFantasy: 11,
    darkFantasy: 3,
    random: 1
  };
  culturesSet.value = rw(sets);
  changeCultureSet();
}

function setRendering(value) {
  viewbox?.attr("shape-rendering", value);
}

// generate current year and era name
function generateEra() {
  if (!stored("year")) yearInput.value = rand(100, 2000); // current year
  if (!stored("era")) eraInput.value = Names.getBaseShort(P(0.7) ? 1 : rand(nameBases.length)) + " Era";
  options.year = +yearInput.value;
  options.era = eraInput.value;
  options.eraShort = options.era
    .split(" ")
    .map(w => w[0].toUpperCase())
    .join(""); // short name for era
}

function regenerateEra() {
  unlock("era");
  options.era = eraInput.value = Names.getBaseShort(P(0.7) ? 1 : rand(nameBases.length)) + " Era";
  options.eraShort = options.era
    .split(" ")
    .map(w => w[0].toUpperCase())
    .join("");
}

function changeYear() {
  if (!yearInput.value) return;
  if (isNaN(+yearInput.value)) {
    tip("Current year should be a number", false, "error");
    return;
  }
  options.year = +yearInput.value;
}

function changeEra() {
  if (!eraInput.value) return;
  lock("era");
  options.era = eraInput.value;
}

// remove all saved data from LocalStorage and reload the page
function restoreDefaultOptions() {
  localStorage.clear();
  location.reload();
}

// Sticked menu Options listeners
byId("sticked").on("click", function (event) {
  const id = event.target.id;
  if (id === "newMapButton") regeneratePrompt();
  else if (id === "saveButton") showSavePane();
  else if (id === "exportButton") showExportPane();
  else if (id === "loadButton") showLoadPane();
  else if (id === "zoomReset") Zoom.reset(1000);
});

byId("regenerate").on("click", regeneratePrompt);

export function regeneratePrompt(options) {
  if (customization)
    return tip("New map cannot be generated when edit mode is active, please exit the mode and retry", false, "error");
  const workingTime = (Date.now() - last(mapHistory).created) / 60000; // minutes
  if (workingTime < 5) return regenerateMap(options);

  alertMessage.innerHTML = /* html */ `Are you sure you want to generate a new map?<br />
    All unsaved changes made to the current map will be lost`;
  $("#alert").dialog({
    resizable: false,
    title: "Generate new map",
    buttons: {
      Cancel: function () {
        $(this).dialog("close");
      },
      Generate: function () {
        closeDialogs();
        regenerateMap(options);
      }
    }
  });
}

function showSavePane() {
  const sharableLinkContainer = byId("sharableLinkContainer");
  sharableLinkContainer.style.display = "none";

  $("#saveMapData").dialog({
    title: "Save map",
    resizable: false,
    width: "25em",
    position: {my: "center", at: "center", of: "svg"},
    buttons: {
      Close: function () {
        $(this).dialog("close");
      }
    }
  });
}

byId("dowloadMap").on("click", dowloadMap);
byId("saveToDropbox").on("click", saveToDropbox);
byId("quickSave").on("click", quickSave);

function copyLinkToClickboard() {
  const shrableLink = byId("sharableLink");
  const link = shrableLink.getAttribute("href");
  navigator.clipboard.writeText(link).then(() => tip("Link is copied to the clipboard", true, "success", 8000));
}

function showExportPane() {
  byId("showLabels").checked = !hideLabels.checked;

  $("#exportMapData").dialog({
    title: "Export map data",
    resizable: false,
    width: "26em",
    position: {my: "center", at: "center", of: "svg"},
    buttons: {
      Close: function () {
        $(this).dialog("close");
      }
    }
  });
}

async function exportToJson(type) {
  const {exportToJson} = await import("../dynamic/export-json.js");
  exportToJson(type);
}

byId("saveSVG").on("click", saveSVG);
byId("savePNG").on("click", savePNG);
byId("saveJPEG").on("click", saveJPEG);
byId("openSaveTiles").on("click", openSaveTiles);

byId("saveGeoJSON_Cells").on("click", saveGeoJSON_Cells);
byId("saveGeoJSON_Routes").on("click", saveGeoJSON_Routes);
byId("saveGeoJSON_Rivers").on("click", saveGeoJSON_Rivers);
byId("saveGeoJSON_Markers").on("click", saveGeoJSON_Markers);

byId("exportToJson_Full").on("click", () => exportToJson("Full"));
byId("exportToJson_Minimal").on("click", () => exportToJson("Minimal"));
byId("exportToJson_PackCells").on("click", () => exportToJson("PackCells"));
byId("exportToJson_GridCells").on("click", () => exportToJson("GridCells"));

async function showLoadPane() {
  $("#loadMapData").dialog({
    title: "Load map",
    resizable: false,
    width: "24em",
    position: {my: "center", at: "center", of: "svg"},
    buttons: {
      Close: function () {
        $(this).dialog("close");
      }
    }
  });

  // already connected to Dropbox: list saved maps
  if (Cloud.providers.dropbox.api) {
    byId("dropboxConnectButton").style.display = "none";
    byId("loadFromDropboxSelect").style.display = "block";
    const loadFromDropboxButtons = byId("loadFromDropboxButtons");
    const fileSelect = byId("loadFromDropboxSelect");
    fileSelect.innerHTML = /* html */ `<option value="" disabled selected>Loading...</option>`;

    const files = await Cloud.providers.dropbox.list();

    if (!files) {
      loadFromDropboxButtons.style.display = "none";
      fileSelect.innerHTML = /* html */ `<option value="" disabled selected>Save files to Dropbox first</option>`;
      return;
    }

    loadFromDropboxButtons.style.display = "block";
    fileSelect.innerHTML = "";
    files.forEach(({name, updated, size, path}) => {
      const sizeMB = rn(size / 1024 / 1024, 2) + " MB";
      const updatedOn = new Date(updated).toLocaleDateString();
      const nameFormatted = `${updatedOn}: ${name} [${sizeMB}]`;
      const option = new Option(nameFormatted, path);
      fileSelect.options.add(option);
    });

    return;
  }

  // not connected to Dropbox: show connect button
  byId("dropboxConnectButton").style.display = "inline-block";
  byId("loadFromDropboxButtons").style.display = "none";
  byId("loadFromDropboxSelect").style.display = "none";
}

byId("loadFromMachine").on("click", () => mapToLoad.click());
byId("loadURL").on("click", loadURL);
byId("quickLoad").on("click", quickLoad);

byId("dropboxConnectButton").on("click", connectToDropbox);
byId("loadFromDropbox").on("click", loadFromDropbox);
byId("createSharableDropboxLink").on("click", createSharableDropboxLink);
byId("copyLinkToClickboard").on("click", copyLinkToClickboard);

async function connectToDropbox() {
  await Cloud.providers.dropbox.initialize();
  if (Cloud.providers.dropbox.api) showLoadPane();
}

function loadURL() {
  const pattern = /(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/;
  const inner = `Provide URL to a .map file:
    <input id="mapURL" type="url" style="width: 24em" placeholder="https://e-cloud.com/test.map">
    <br><i>Please note server should allow CORS for file to be loaded. If CORS is not allowed, save file to Dropbox and provide a direct link</i>`;
  alertMessage.innerHTML = inner;
  $("#alert").dialog({
    resizable: false,
    title: "Load map from URL",
    width: "27em",
    buttons: {
      Load: function () {
        const value = mapURL.value;
        if (!pattern.test(value)) {
          tip("Please provide a valid URL", false, "error");
          return;
        }
        loadMapFromURL(value);
        $(this).dialog("close");
      },
      Cancel: function () {
        $(this).dialog("close");
      }
    }
  });
}

// load map
byId("mapToLoad").on("change", function () {
  const fileToLoad = this.files[0];
  this.value = "";
  closeDialogs();
  uploadMap(fileToLoad);
});

function openSaveTiles() {
  closeDialogs();
  updateTilesOptions();
  const status = byId("tileStatus");
  status.innerHTML = "";
  let loading = null;

  const inputs = byId("saveTilesScreen").querySelectorAll("input");
  inputs.forEach(input => input.on("input", updateTilesOptions));

  $("#saveTilesScreen").dialog({
    resizable: false,
    title: "Download tiles",
    width: "23em",
    buttons: {
      Download: function () {
        status.innerHTML = "Preparing for download...";
        setTimeout(() => (status.innerHTML = "Downloading. It may take some time."), 1000);
        loading = setInterval(() => (status.innerHTML += "."), 1000);
        saveTiles().then(() => {
          clearInterval(loading);
          status.innerHTML = /* html */ `Done. Check file in "Downloads" (crtl + J)`;
          setTimeout(() => (status.innerHTML = ""), 8000);
        });
      },
      Cancel: function () {
        $(this).dialog("close");
      }
    },
    close: () => {
      inputs.forEach(input => input.removeEventListener("input", updateTilesOptions));
      debug.selectAll("*").remove();
      clearInterval(loading);
    }
  });
}

function updateTilesOptions() {
  if (this?.tagName === "INPUT") {
    const {nextElementSibling: next, previousElementSibling: prev} = this;
    if (next?.tagName === "INPUT") next.value = this.value;
    if (prev?.tagName === "INPUT") prev.value = this.value;
  }

  const tileSize = byId("tileSize");
  const tilesX = +byId("tileColsOutput").value;
  const tilesY = +byId("tileRowsOutput").value;
  const scale = +byId("tileScaleOutput").value;

  // calculate size
  const sizeX = graphWidth * scale * tilesX;
  const sizeY = graphHeight * scale * tilesY;
  const totalSize = sizeX * sizeY;

  tileSize.innerHTML = /* html */ `${sizeX} x ${sizeY} px`;
  tileSize.style.color = totalSize > 1e9 ? "#d00b0b" : totalSize > 1e8 ? "#9e6409" : "#1a941a";

  // draw tiles
  const rects = [];
  const labels = [];
  const tileW = (graphWidth / tilesX) | 0;
  const tileH = (graphHeight / tilesY) | 0;
  for (let y = 0, i = 0; y + tileH <= graphHeight; y += tileH) {
    for (let x = 0; x + tileW <= graphWidth; x += tileW, i++) {
      rects.push(`<rect x=${x} y=${y} width=${tileW} height=${tileH} />`);
      labels.push(`<text x=${x + tileW / 2} y=${y + tileH / 2}>${i}</text>`);
    }
  }
  const rectsG = "<g fill='none' stroke='#000'>" + rects.join("") + "</g>";
  const labelsG =
    "<g fill='#000' stroke='none' text-anchor='middle' dominant-baseline='central' font-size='24px'>" +
    labels.join("") +
    "</g>";
  debug.html(rectsG + labelsG);
}

// View mode
viewMode.on("click", changeViewMode);
export function changeViewMode(event) {
  const button = event.target;
  if (button.tagName !== "BUTTON") return;
  const pressed = button.classList.contains("pressed");
  enterStandardView();

  if (!pressed && button.id !== "viewStandard") {
    viewStandard.classList.remove("pressed");
    button.classList.add("pressed");
    enter3dView(button.id);
  }
}

function enterStandardView() {
  viewMode.querySelectorAll(".pressed").forEach(button => button.classList.remove("pressed"));
  heightmap3DView.classList.remove("pressed");
  viewStandard.classList.add("pressed");

  if (!byId("canvas3d")) return;
  ThreeD.stop();
  byId("canvas3d").remove();
  if (options3dUpdate.offsetParent) $("#options3d").dialog("close");
  if (preview3d.offsetParent) $("#preview3d").dialog("close");
}

async function enter3dView(type) {
  const canvas = document.createElement("canvas");
  canvas.id = "canvas3d";
  canvas.dataset.type = type;

  if (type === "heightmap3DView") {
    canvas.width = parseFloat(preview3d.style.width) || graphWidth / 3;
    canvas.height = canvas.width / (graphWidth / graphHeight);
    canvas.style.display = "block";
  } else {
    canvas.width = svgWidth;
    canvas.height = svgHeight;
    canvas.style.position = "absolute";
    canvas.style.display = "none";
  }

  const started = await ThreeD.create(canvas, type);
  if (!started) return;

  canvas.style.display = "block";
  canvas.onmouseenter = () => {
    const help =
      "Left mouse to change angle, middle mouse / mousewheel to zoom, right mouse to pan. <b>O</b> to toggle options";
    +canvas.dataset.hovered > 2 ? tip("") : tip(help);
    canvas.dataset.hovered = (+canvas.dataset.hovered | 0) + 1;
  };

  if (type === "heightmap3DView") {
    byId("preview3d").appendChild(canvas);
    $("#preview3d").dialog({
      title: "3D Preview",
      resizable: true,
      position: {my: "left bottom", at: "left+10 bottom-20", of: "svg"},
      resizeStop: resize3d,
      close: enterStandardView
    });
  } else document.body.insertBefore(canvas, optionsContainer);

  toggle3dOptions();
}

function resize3d() {
  const canvas = byId("canvas3d");
  canvas.width = parseFloat(preview3d.style.width);
  canvas.height = parseFloat(preview3d.style.height) - 2;
  ThreeD.redraw();
}

let isLoaded = false;

export function toggle3dOptions() {
  if (options3dUpdate.offsetParent) {
    $("#options3d").dialog("close");
    return;
  }
  $("#options3d").dialog({
    title: "3D mode settings",
    resizable: false,
    width: "fit-content",
    position: {my: "right top", at: "right-30 top+10", of: "svg", collision: "fit"}
  });

  updateValues();

  if (isLoaded) return;
  isLoaded = true;

  byId("options3dUpdate").on("click", ThreeD.update);
  byId("options3dConfigureWorld").on("click", () => openDialog("worldConfigurator"));
  byId("options3dSave").on("click", ThreeD.saveScreenshot);
  byId("options3dOBJSave").on("click", ThreeD.saveOBJ);

  byId("options3dScaleRange").on("input", changeHeightScale);
  byId("options3dScaleNumber").on("change", changeHeightScale);
  byId("options3dLightnessRange").on("input", changeLightness);
  byId("options3dLightnessNumber").on("change", changeLightness);
  byId("options3dSunX").on("change", changeSunPosition);
  byId("options3dSunY").on("change", changeSunPosition);
  byId("options3dSunZ").on("change", changeSunPosition);
  byId("options3dMeshRotationRange").on("input", changeRotation);
  byId("options3dMeshRotationNumber").on("change", changeRotation);
  byId("options3dGlobeRotationRange").on("input", changeRotation);
  byId("options3dGlobeRotationNumber").on("change", changeRotation);
  byId("options3dMeshLabels3d").on("change", toggleLabels3d);
  byId("options3dMeshSkyMode").on("change", toggleSkyMode);
  byId("options3dMeshSky").on("input", changeColors);
  byId("options3dMeshWater").on("input", changeColors);
  byId("options3dGlobeResolution").on("change", changeResolution);

  function updateValues() {
    const globe = byId("canvas3d").dataset.type === "viewGlobe";
    options3dMesh.style.display = globe ? "none" : "block";
    options3dGlobe.style.display = globe ? "block" : "none";
    options3dOBJSave.style.display = globe ? "none" : "inline-block";
    options3dScaleRange.value = options3dScaleNumber.value = ThreeD.options.scale;
    options3dLightnessRange.value = options3dLightnessNumber.value = ThreeD.options.lightness * 100;
    options3dSunX.value = ThreeD.options.sun.x;
    options3dSunY.value = ThreeD.options.sun.y;
    options3dSunZ.value = ThreeD.options.sun.z;
    options3dMeshRotationRange.value = options3dMeshRotationNumber.value = ThreeD.options.rotateMesh;
    options3dGlobeRotationRange.value = options3dGlobeRotationNumber.value = ThreeD.options.rotateGlobe;
    options3dMeshLabels3d.value = ThreeD.options.labels3d;
    options3dMeshSkyMode.value = ThreeD.options.extendedWater;
    options3dColorSection.style.display = ThreeD.options.extendedWater ? "block" : "none";
    options3dMeshSky.value = ThreeD.options.skyColor;
    options3dMeshWater.value = ThreeD.options.waterColor;
    options3dGlobeResolution.value = ThreeD.options.resolution;
  }

  function changeHeightScale() {
    options3dScaleRange.value = options3dScaleNumber.value = this.value;
    ThreeD.setScale(+this.value);
  }

  function changeLightness() {
    options3dLightnessRange.value = options3dLightnessNumber.value = this.value;
    ThreeD.setLightness(this.value / 100);
  }

  function changeSunPosition() {
    const x = +options3dSunX.value;
    const y = +options3dSunY.value;
    const z = +options3dSunZ.value;
    ThreeD.setSun(x, y, z);
  }

  function changeRotation() {
    (this.nextElementSibling || this.previousElementSibling).value = this.value;
    const speed = +this.value;
    ThreeD.setRotation(speed);
  }

  function toggleLabels3d() {
    ThreeD.toggleLabels();
  }

  function toggleSkyMode() {
    const hide = ThreeD.options.extendedWater;
    options3dColorSection.style.display = hide ? "none" : "block";
    ThreeD.toggleSky();
  }

  function changeColors() {
    ThreeD.setColors(options3dMeshSky.value, options3dMeshWater.value);
  }

  function changeResolution() {
    ThreeD.setResolution(this.value);
  }
}
