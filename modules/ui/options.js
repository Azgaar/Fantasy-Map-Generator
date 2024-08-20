// UI module to control the options (preferences)
"use strict";

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
function hideOptions(event) {
  byId("options").style.display = "none";
  optionsTrigger.style.display = "block";
  if (event) event.stopPropagation();
}

// To toggle options on hotkey press
function toggleOptions(event) {
  if (byId("options").style.display === "none") showOptions(event);
  else hideOptions(event);
}

// Toggle "New Map!" pane on hover
optionsTrigger.addEventListener("mouseenter", function () {
  if (optionsTrigger.classList.contains("glow")) return;
  if (byId("options").style.display === "none") regenerate.style.display = "block";
});

collapsible.addEventListener("mouseleave", function () {
  regenerate.style.display = "none";
});

// Activate options tab on click
document
  .getElementById("options")
  .querySelector("div.tab")
  .addEventListener("click", function (event) {
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

    if (id === "layersTab") {
      layersContent.style.display = "block";
    } else if (id === "styleTab") {
      styleContent.style.display = "block";
      selectStyleElement();
    } else if (id === "optionsTab") {
      optionsContent.style.display = "block";
    } else if (id === "toolsTab") {
      customization === 1 ? (customizationMenu.style.display = "block") : (toolsContent.style.display = "block");
    } else if (id === "aboutTab") {
      aboutContent.style.display = "block";
    }
  });

// show popup with a list of Patreon supportes (updated manually)
async function showSupporters() {
  const {supporters} = await import("../dynamic/supporters.js?v=1.97.14");
  const list = supporters.split("\n").sort();
  const columns = window.innerWidth < 800 ? 2 : 5;

  alertMessage.innerHTML =
    `<ul style='column-count: ${columns}; column-gap: 2em'>` + list.map(n => `<li>${n}</li>`).join("") + "</ul>";
  $("#alert").dialog({
    resizable: false,
    title: "Patreon Supporters",
    width: "min-width",
    position: {my: "center", at: "center", of: "svg"}
  });
}

// on any option or dialog change
byId("options").addEventListener("change", storeValueIfRequired);
byId("dialogs").addEventListener("change", storeValueIfRequired);
byId("options").addEventListener("input", updateOutputToFollowInput);
byId("dialogs").addEventListener("input", updateOutputToFollowInput);

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

optionsContent.addEventListener("input", event => {
  const {id, value} = event.target;
  if (id === "mapWidthInput" || id === "mapHeightInput") mapSizeInputChange();
  else if (id === "pointsInput") changeCellsDensity(+value);
  else if (id === "culturesSet") changeCultureSet();
  else if (id === "statesNumber") changeStatesNumber(value);
  else if (id === "emblemShape") changeEmblemShape(value);
  else if (id === "tooltipSize") changeTooltipSize(value);
  else if (id === "themeHueInput") changeThemeHue(value);
  else if (id === "themeColorInput") changeDialogsTheme(themeColorInput.value, transparencyInput.value);
  else if (id === "transparencyInput") changeDialogsTheme(themeColorInput.value, value);
});

optionsContent.addEventListener("change", event => {
  const {id, value} = event.target;
  if (id === "zoomExtentMin" || id === "zoomExtentMax") changeZoomExtent(value);
  else if (id === "optionsSeed") generateMapWithSeed("seed change");
  else if (id === "uiSize") changeUiSize(+value);
  else if (id === "shapeRendering") setRendering(value);
  else if (id === "yearInput") changeYear();
  else if (id === "eraInput") changeEra();
  else if (id === "stateLabelsModeInput") options.stateLabelsMode = value;
});

optionsContent.addEventListener("click", event => {
  const {id} = event.target;
  if (id === "restoreDefaultCanvasSize") restoreDefaultCanvasSize();
  else if (id === "optionsMapHistory") showSeedHistoryDialog();
  else if (id === "optionsCopySeed") copyMapURL();
  else if (id === "optionsEraRegenerate") regenerateEra();
  else if (id === "templateInputContainer") openTemplateSelectionDialog();
  else if (id === "zoomExtentDefault") restoreDefaultZoomExtent();
  else if (id === "translateExtent") toggleTranslateExtent(event.target);
  else if (id === "speakerTest") testSpeaker();
  else if (id === "themeColorRestore") restoreDefaultThemeColor();
  else if (id === "loadGoogleTranslateButton") loadGoogleTranslate();
  else if (id === "resetLanguage") resetLanguage();
});

function mapSizeInputChange() {
  const $mapWidthInput = byId("mapWidthInput");
  const $mapHeightInput = byId("mapHeightInput");

  fitMapToScreen();
  localStorage.setItem("mapWidth", $mapWidthInput.value);
  localStorage.setItem("mapHeight", $mapHeightInput.value);

  const tooWide = +$mapWidthInput.value > window.innerWidth;
  const tooHigh = +$mapHeightInput.value > window.innerHeight;

  if (tooWide || tooHigh) {
    const message = `Canvas size is larger than window size (${window.innerWidth} x ${window.innerHeight}). It can affect performance`;
    tip(message, false, "warn", 4000);
  }
}

function restoreDefaultCanvasSize() {
  mapWidthInput.value = window.innerWidth;
  mapHeightInput.value = window.innerHeight;
  localStorage.removeItem("mapHeight");
  localStorage.removeItem("mapWidth");
  fitMapToScreen();
}

// on map creation
function applyGraphSize() {
  graphWidth = +mapWidthInput.value;
  graphHeight = +mapHeightInput.value;

  landmass.select("rect").attr("x", 0).attr("y", 0).attr("width", graphWidth).attr("height", graphHeight);
  oceanPattern.select("rect").attr("x", 0).attr("y", 0).attr("width", graphWidth).attr("height", graphHeight);
  oceanLayers.select("rect").attr("x", 0).attr("y", 0).attr("width", graphWidth).attr("height", graphHeight);
  fogging.selectAll("rect").attr("x", 0).attr("y", 0).attr("width", graphWidth).attr("height", graphHeight);
  defs.select("mask#fog > rect").attr("width", graphWidth).attr("height", graphHeight);
  defs.select("mask#water > rect").attr("width", graphWidth).attr("height", graphHeight);
}

// on generate, on load, on resize, on canvas size change
function fitMapToScreen() {
  svgWidth = Math.min(+mapWidthInput.value, window.innerWidth);
  svgHeight = Math.min(+mapHeightInput.value, window.innerHeight);
  svg.attr("width", svgWidth).attr("height", svgHeight);

  const zoomExtent = [
    [0, 0],
    [graphWidth, graphHeight]
  ];

  const zoomMin = rn(Math.max(svgWidth / graphWidth, svgHeight / graphHeight), 3);
  zoomExtentMin.value = zoomMin;
  const zoomMax = +zoomExtentMax.value;

  zoom.translateExtent(zoomExtent).scaleExtent([zoomMin, zoomMax]).scaleTo(svg, zoomMin);

  fitScaleBar(scaleBar, svgWidth, svgHeight);
  if (window.fitLegendBox) fitLegendBox();
}

function toggleTranslateExtent(el) {
  const on = (el.dataset.on = +!+el.dataset.on);
  if (on) {
    zoom.translateExtent([
      [-graphWidth / 2, -graphHeight / 2],
      [graphWidth * 1.5, graphHeight * 1.5]
    ]);
  } else {
    zoom.translateExtent([
      [0, 0],
      [graphWidth, graphHeight]
    ]);
  }
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
  if (optionsSeed.value === seed) return tip("The current map already has this seed", false, "error");
  regeneratePrompt({seed: optionsSeed.value});
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

  regeneratePrompt({seed});
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
  pointsInput.value = value;
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
  if (emblemShape === "random")
    pack.cultures.filter(c => !c.removed).forEach(c => (c.shield = Cultures.getRandomShield()));

  const rerenderCOA = (id, coa) => {
    const coaEl = byId(id);
    if (!coaEl) return; // not rendered
    coaEl.remove();
    COArenderer.trigger(id, coa);
  };

  pack.states.forEach(state => {
    if (!state.i || state.removed || !state.coa || state.coa.custom) return;
    const newShield = specificShape || COA.getShield(state.culture, null);
    if (newShield === state.coa.shield) return;
    state.coa.shield = newShield;
    rerenderCOA("stateCOA" + state.i, state.coa);
  });

  pack.provinces.forEach(province => {
    if (!province.i || province.removed || !province.coa || province.coa.custom) return;
    const culture = pack.cells.culture[province.center];
    const newShield = specificShape || COA.getShield(culture, province.state);
    if (newShield === province.coa.shield) return;
    province.coa.shield = newShield;
    rerenderCOA("provinceCOA" + province.i, province.coa);
  });

  pack.burgs.forEach(burg => {
    if (!burg.i || burg.removed || !burg.coa || burg.coa.custom) return;
    const newShield = specificShape || COA.getShield(burg.culture, burg.state);
    if (newShield === burg.coa.shield) return;
    burg.coa.shield = newShield;
    rerenderCOA("burgCOA" + burg.i, burg.coa);
  });
}

function changeStatesNumber(value) {
  byId("statesNumber").style.color = +value ? null : "#b12117";
  burgLabels.select("#capitals").attr("data-size", Math.max(rn(6 - value / 20), 3));
  labels.select("#countries").attr("data-size", Math.max(rn(18 - value / 6), 4));
}

function changeUiSize(value) {
  if (isNaN(value) || value < 0.5) return;

  const max = getUImaxSize();
  if (value > max) value = max;

  uiSize.value = value;
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
  transparencyInput.value = transparency;
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

function loadGoogleTranslate() {
  const script = document.createElement("script");
  script.src = "https://translate.google.com/translate_a/element.js?cb=initGoogleTranslate";
  script.onload = () => {
    byId("loadGoogleTranslateButton")?.remove();

    // replace mapLayers underline <u> with bare text to avoid translation issue
    document
      .getElementById("mapLayers")
      .querySelectorAll("li")
      .forEach(el => {
        const text = el.innerHTML.replace(/<u>(.+)<\/u>/g, "$1");
        el.innerHTML = text;
      });
  };

  document.head.appendChild(script);
}

function initGoogleTranslate() {
  new google.translate.TranslateElement(
    {pageLanguage: "en", layout: google.translate.TranslateElement.InlineLayout.VERTICAL},
    "google_translate_element"
  );
}

function resetLanguage() {
  const languageSelect = document.querySelector("#google_translate_element select");
  if (!languageSelect.value) return;

  languageSelect.value = "en";
  languageSelect.handleChange(new Event("change"));

  // do once again to actually reset the language
  languageSelect.value = "en";
  languageSelect.handleChange(new Event("change"));
}

function changeZoomExtent(value) {
  if (+zoomExtentMin.value > +zoomExtentMax.value) {
    [zoomExtentMin.value, zoomExtentMax.value] = [zoomExtentMax.value, zoomExtentMin.value];
  }
  const min = Math.max(+zoomExtentMin.value, 0.01);
  const max = Math.min(+zoomExtentMax.value, 200);
  zoomExtentMin.value = min;
  zoomExtentMax.value = max;
  zoom.scaleExtent([min, max]);
  const scale = minmax(+value, 0.01, 200);
  zoom.scaleTo(svg, scale);
}

function restoreDefaultZoomExtent() {
  zoomExtentMin.value = 1;
  zoomExtentMax.value = 20;
  zoom.scaleExtent([1, 20]).scaleTo(svg, 1);
}

// restore options stored in localStorage
function applyStoredOptions() {
  if (!stored("mapWidth") || !stored("mapHeight")) {
    mapWidthInput.value = window.innerWidth;
    mapHeightInput.value = window.innerHeight;
  }

  const heightmapId = stored("template");
  if (heightmapId) {
    const name = heightmapTemplates[heightmapId]?.name || precreatedHeightmaps[heightmapId]?.name || heightmapId;
    applyOption(byId("templateInput"), heightmapId, name);
  }

  if (stored("distanceUnit")) applyOption(distanceUnitInput, stored("distanceUnit"));
  if (stored("heightUnit")) applyOption(heightUnit, stored("heightUnit"));

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key === "speakerVoice") continue;

    const input = byId(key + "Input") || byId(key);
    const output = byId(key + "Output");

    const value = stored(key);
    if (input) input.value = value;
    if (output) output.value = value;
    lock(key);

    if (key === "points") changeCellsDensity(+value);
    if (key === "distanceScale") distanceScale = +value;

    // add saved style presets to options
    if (key.slice(0, 5) === "style") applyOption(stylePreset, key, key.slice(5));
  }

  if (stored("winds")) options.winds = localStorage.getItem("winds").split(",").map(Number);
  if (stored("temperatureEquator")) options.temperatureEquator = +localStorage.getItem("temperatureEquator");
  if (stored("temperatureNorthPole")) options.temperatureNorthPole = +localStorage.getItem("temperatureNorthPole");
  if (stored("temperatureSouthPole")) options.temperatureSouthPole = +localStorage.getItem("temperatureSouthPole");
  if (stored("military")) options.military = JSON.parse(stored("military"));

  if (stored("tooltipSize")) changeTooltipSize(stored("tooltipSize"));
  if (stored("regions")) changeStatesNumber(stored("regions"));

  uiSize.max = uiSize.max = getUImaxSize();
  if (stored("uiSize")) changeUiSize(+stored("uiSize"));
  else changeUiSize(minmax(rn(mapWidthInput.value / 1280, 1), 1, 2.5));

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

// randomize options if randomization is allowed (not locked or queryParam options='default')
function randomizeOptions() {
  const randomize = new URL(window.location.href).searchParams.get("options") === "default"; // ignore stored options

  // 'Options' settings
  if (randomize || !locked("points")) changeCellsDensity(4); // reset to default, no need to randomize
  if (randomize || !locked("template")) randomizeHeightmapTemplate();
  if (randomize || !locked("statesNumber")) statesNumber.value = gauss(18, 5, 2, 30);
  if (randomize || !locked("provincesRatio")) provincesRatio.value = gauss(20, 10, 20, 100);
  if (randomize || !locked("manors")) {
    manorsInput.value = 1000;
    manorsOutput.value = "auto";
  }
  if (randomize || !locked("religionsNumber")) religionsNumber.value = gauss(6, 3, 2, 10);
  if (randomize || !locked("sizeVariety")) sizeVariety.value = gauss(4, 2, 0, 10, 1);
  if (randomize || !locked("growthRate")) growthRate.value = rn(1 + Math.random(), 1);
  if (randomize || !locked("cultures")) culturesInput.value = culturesOutput.value = gauss(12, 3, 5, 30);
  if (randomize || !locked("culturesSet")) randomizeCultureSet();

  // 'Configure World' settings
  if (randomize || !locked("temperatureEquator")) options.temperatureEquator = gauss(25, 7, 20, 35, 0);
  if (randomize || !locked("temperatureNorthPole")) options.temperatureNorthPole = gauss(-25, 7, -40, 10, 0);
  if (randomize || !locked("temperatureSouthPole")) options.temperatureSouthPole = gauss(-15, 7, -40, 10, 0);
  if (randomize || !locked("prec")) precInput.value = precOutput.value = gauss(100, 40, 5, 500);

  // 'Units Editor' settings
  const US = navigator.language === "en-US";
  if (randomize || !locked("distanceScale")) distanceScale = distanceScaleInput.value = gauss(3, 1, 1, 5);
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
  applyOption(byId("templateInput"), template, name);
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
  viewbox.attr("shape-rendering", value);

  if (value === "optimizeSpeed") {
    // block some styles
    coastline.select("#sea_island").style("filter", "none");
    statesHalo.style("display", "none");
  } else {
    // remove style block
    coastline.select("#sea_island").style("filter", null);
    statesHalo.style("display", null);
    if (pack.cells && statesHalo.selectAll("*").size() === 0) drawStates();
  }
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

async function openTemplateSelectionDialog() {
  const HeightmapSelectionDialog = await import("../dynamic/heightmap-selection.js?v=1.96.00");
  HeightmapSelectionDialog.open();
}

// remove all saved data from LocalStorage and reload the page
function restoreDefaultOptions() {
  localStorage.clear();
  location.reload();
}

// Sticked menu Options listeners
byId("sticked").addEventListener("click", function (event) {
  const id = event.target.id;
  if (id === "newMapButton") regeneratePrompt();
  else if (id === "saveButton") showSavePane();
  else if (id === "exportButton") showExportPane();
  else if (id === "loadButton") showLoadPane();
  else if (id === "zoomReset") resetZoom(1000);
});

function regeneratePrompt(options) {
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
  const {exportToJson} = await import("../dynamic/export-json.js?v=1.97.08");
  exportToJson(type);
}

async function showLoadPane() {
  $("#loadMapData").dialog({
    title: "Load map",
    resizable: false,
    width: "auto",
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

async function connectToDropbox() {
  await Cloud.providers.dropbox.initialize();
  if (Cloud.providers.dropbox.api) showLoadPane();
}

function loadURL() {
  const pattern = /(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/;
  const inner = `Provide URL to map file:
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
byId("mapToLoad").addEventListener("change", function () {
  const fileToLoad = this.files[0];
  this.value = "";
  closeDialogs();
  uploadMap(fileToLoad);
});

function openExportToPngTiles() {
  byId("tileStatus").innerHTML = "";
  closeDialogs();
  updateTilesOptions();

  const inputs = byId("exportToPngTilesScreen").querySelectorAll("input");
  inputs.forEach(input => input.addEventListener("input", updateTilesOptions));

  $("#exportToPngTilesScreen").dialog({
    resizable: false,
    title: "Download tiles",
    width: "23em",
    buttons: {
      Download: () => exportToPngTiles(),
      Cancel: function () {
        $(this).dialog("close");
      }
    },
    close: () => {
      inputs.forEach(input => input.removeEventListener("input", updateTilesOptions));
      debug.selectAll("*").remove();
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
  const tilesX = +byId("tileColsOutput").value || 2;
  const tilesY = +byId("tileRowsOutput").value || 2;
  const scale = +byId("tileScaleOutput").value || 1;

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

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  function getRowLabel(row) {
    const first = row >= alphabet.length ? alphabet[Math.floor(row / alphabet.length) - 1] : "";
    const last = alphabet[row % alphabet.length];
    return first + last;
  }

  for (let y = 0, row = 0; y + tileH <= graphHeight; y += tileH, row++) {
    for (let x = 0, column = 1; x + tileW <= graphWidth; x += tileW, column++) {
      rects.push(`<rect x=${x} y=${y} width=${tileW} height=${tileH} />`);
      labels.push(`<text x=${x + tileW / 2} y=${y + tileH / 2}>${getRowLabel(row)}${column}</text>`);
    }
  }

  debug.html(`
    <g fill='none' stroke='#000'>${rects.join("")}</g>
    <g fill='#000' stroke='none' text-anchor='middle' dominant-baseline='central' font-size='18px'>${labels.join(
      ""
    )}</g>
  `);
}

// View mode
viewMode.addEventListener("click", changeViewMode);
function changeViewMode(event) {
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
      "Left mouse to change angle, middle mouse. Mousewheel to zoom. Right mouse or hold Shift to pan. <b>O</b> to toggle options";
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

function toggle3dOptions() {
  if (options3dUpdate.offsetParent) {
    $("#options3d").dialog("close");
    return;
  }
  $("#options3d").dialog({
    title: "3D mode settings",
    resizable: false,
    width: fitContent(),
    position: {my: "right top", at: "right-30 top+10", of: "svg", collision: "fit"}
  });

  updateValues();

  if (modules.options3d) return;
  modules.options3d = true;

  byId("options3dUpdate").addEventListener("click", ThreeD.update);
  byId("options3dSave").addEventListener("click", ThreeD.saveScreenshot);
  byId("options3dOBJSave").addEventListener("click", ThreeD.saveOBJ);

  byId("options3dScaleRange").addEventListener("input", changeHeightScale);
  byId("options3dScaleNumber").addEventListener("change", changeHeightScale);
  byId("options3dLightnessRange").addEventListener("input", changeLightness);
  byId("options3dLightnessNumber").addEventListener("change", changeLightness);
  byId("options3dSunX").addEventListener("change", changeSunPosition);
  byId("options3dSunY").addEventListener("change", changeSunPosition);
  byId("options3dMeshSkinResolution").addEventListener("change", changeResolutionScale);
  byId("options3dMeshRotationRange").addEventListener("input", changeRotation);
  byId("options3dMeshRotationNumber").addEventListener("change", changeRotation);
  byId("options3dGlobeRotationRange").addEventListener("input", changeRotation);
  byId("options3dGlobeRotationNumber").addEventListener("change", changeRotation);
  byId("options3dMeshLabels3d").addEventListener("change", toggleLabels3d);
  byId("options3dMeshSkyMode").addEventListener("change", toggleSkyMode);
  byId("options3dMeshSky").addEventListener("input", changeColors);
  byId("options3dMeshWater").addEventListener("input", changeColors);
  byId("options3dGlobeResolution").addEventListener("change", changeResolution);
  // byId("options3dMeshWireframeMode").addEventListener("change",toggleWireframe3d);
  byId("options3dSunColor").addEventListener("input", changeSunColor);
  byId("options3dSubdivide").addEventListener("change", toggle3dSubdivision);

  function updateValues() {
    const globe = byId("canvas3d").dataset.type === "viewGlobe";
    options3dMesh.style.display = globe ? "none" : "block";
    options3dGlobe.style.display = globe ? "block" : "none";
    options3dOBJSave.style.display = globe ? "none" : "inline-block";
    options3dScaleRange.value = options3dScaleNumber.value = ThreeD.options.scale;
    options3dLightnessRange.value = options3dLightnessNumber.value = ThreeD.options.lightness * 100;
    options3dSunX.value = ThreeD.options.sun.x;
    options3dSunY.value = ThreeD.options.sun.y;
    options3dMeshRotationRange.value = options3dMeshRotationNumber.value = ThreeD.options.rotateMesh;
    options3dMeshSkinResolution.value = ThreeD.options.resolutionScale;
    options3dGlobeRotationRange.value = options3dGlobeRotationNumber.value = ThreeD.options.rotateGlobe;
    options3dMeshLabels3d.value = ThreeD.options.labels3d;
    options3dMeshSkyMode.value = ThreeD.options.extendedWater;
    options3dColorSection.style.display = ThreeD.options.extendedWater ? "block" : "none";
    options3dMeshSky.value = ThreeD.options.skyColor;
    options3dMeshWater.value = ThreeD.options.waterColor;
    options3dGlobeResolution.value = ThreeD.options.resolution;
    options3dSunColor.value = ThreeD.options.sunColor;
    options3dSubdivide.value = ThreeD.options.subdivide;
  }

  function changeHeightScale() {
    options3dScaleRange.value = options3dScaleNumber.value = this.value;
    ThreeD.setScale(+this.value);
  }

  function changeResolutionScale() {
    options3dMeshSkinResolution.value = this.value;
    ThreeD.setResolutionScale(+this.value);
  }

  function changeLightness() {
    options3dLightnessRange.value = options3dLightnessNumber.value = this.value;
    ThreeD.setLightness(this.value / 100);
  }

  function changeSunColor() {
    ThreeD.setSunColor(options3dSunColor.value);
  }

  function changeSunPosition() {
    const x = +options3dSunX.value;
    const y = +options3dSunY.value;
    ThreeD.setSun(x, y);
  }

  function changeRotation() {
    (this.nextElementSibling || this.previousElementSibling).value = this.value;
    const speed = +this.value;
    ThreeD.setRotation(speed);
  }

  function toggleLabels3d() {
    ThreeD.toggleLabels();
  }

  function toggle3dSubdivision() {
    ThreeD.toggle3dSubdivision();
  }

  // function toggleWireframe3d() {
  //   ThreeD.toggleWireframe();
  // }

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
