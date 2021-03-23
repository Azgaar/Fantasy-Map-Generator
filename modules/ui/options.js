// UI module to control the options (preferences)
"use strict";

$("#optionsContainer").draggable({handle: ".drag-trigger", snap: "svg", snapMode: "both"});
$("#exitCustomization").draggable({handle: "div"});
$("#mapLayers").disableSelection();

// remove glow if tip is aknowledged
if (localStorage.getItem("disable_click_arrow_tooltip")) {
  clearMainTip();
  optionsTrigger.classList.remove("glow");
}

// Show options pane on trigger click
function showOptions(event) {
  if (!localStorage.getItem("disable_click_arrow_tooltip")) {
    clearMainTip();
    localStorage.setItem("disable_click_arrow_tooltip", true);
    optionsTrigger.classList.remove("glow");
  }

  regenerate.style.display = "none";
  document.getElementById("options").style.display = "block";
  optionsTrigger.style.display = "none";

  if (event) event.stopPropagation();
}

// Hide options pane on trigger click
function hideOptions(event) {
  document.getElementById("options").style.display = "none";
  optionsTrigger.style.display = "block";
  if (event) event.stopPropagation();
}

// To toggle options on hotkey press
function toggleOptions(event) {
  if (document.getElementById("options").style.display === "none") showOptions(event);
  else hideOptions(event);
}

// Toggle "New Map!" pane on hover
optionsTrigger.addEventListener("mouseenter", function() {
  if (optionsTrigger.classList.contains("glow")) return;
  if (document.getElementById("options").style.display === "none") regenerate.style.display = "block";
});

collapsible.addEventListener("mouseleave", function() {
  regenerate.style.display = "none";
});

// Activate options tab on click
document.getElementById("options").querySelector("div.tab").addEventListener("click", function(event) {
  if (event.target.tagName !== "BUTTON") return;
  const id = event.target.id;
  const active = document.getElementById("options").querySelector(".tab > button.active");
  if (active && id === active.id) return; // already active tab is clicked

  if (active) active.classList.remove("active");
  document.getElementById(id).classList.add("active");
  document.getElementById("options").querySelectorAll(".tabcontent").forEach(e => e.style.display = "none");

  if (id === "layersTab") layersContent.style.display = "block"; else
  if (id === "styleTab") styleContent.style.display = "block"; else
  if (id === "optionsTab") optionsContent.style.display = "block"; else
  if (id === "toolsTab") customization === 1 
    ? customizationMenu.style.display = "block" 
    : toolsContent.style.display = "block"; else
  if (id === "aboutTab") aboutContent.style.display = "block";
});

// show popup with a list of Patreon supportes (updated manually, to be replaced with API call)
function showSupporters() {
  const supporters = `Aaron Meyer,Ahmad Amerih,AstralJacks,aymeric,Billy Dean Goehring,Branndon Edwards,Chase Mayers,Curt Flood,cyninge,Dino Princip,
    E.M. White,es,Fondue,Fritjof Olsson,Gatsu,Johan Fröberg,Jonathan Moore,Joseph Miranda,Kate,KC138,Luke Nelson,Markus Finster,Massimo Vella,Mikey,
    Nathan Mitchell,Paavi1,Pat,Ryan Westcott,Sasquatch,Shawn Spencer,Sizz_TV,Timothée CALLET,UTG community,Vlad Tomash,Wil Sisney,William Merriott,
    Xariun,Gun Metal Games,Scott Marner,Spencer Sherman,Valerii Matskevych,Alloyed Clavicle,Stewart Walsh,Ruthlyn Mollett (Javan),Benjamin Mair-Pratt,
    Diagonath,Alexander Thomas,Ashley Wilson-Savoury,William Henry,Preston Brooks,JOSHUA QUALTIERI,Hilton Williams,Katharina Haase,Hisham Bedri,Ian arless,
    Karnat,Bird,Kevin,Jessica Thomas,Steve Hyatt,Logicspren,Alfred García,Jonathan Killstring,John Ackley,Invad3r233,Norbert Žigmund,Jennifer,
    PoliticsBuff,_gfx_,Maggie,Connor McMartin,Jared McDaris,BlastWind,Franc Casanova Ferrer,Dead & Devil,Michael Carmody,Valerie Elise,naikibens220,
    Jordon Phillips,William Pucs,The Dungeon Masters,Brady R Rathbun,J,Shadow,Matthew Tiffany,Huw Williams,Joseph Hamilton,FlippantFeline,Tamashi Toh,
    kms,Stephen Herron,MidnightMoon,Whakomatic x,Barished,Aaron bateson,Brice Moss,Diklyquill,PatronUser,Michael Greiner,Steven Bennett,Jacob Harrington,
    Miguel C.,Reya C.,Giant Monster Games,Noirbard,Brian Drennen,Ben Craigie,Alex Smolin,Endwords,Joshua E Goodwin,SirTobit ,Allen S. Rout,Allen Bull Bear,
    Pippa Mitchell,R K,G0atfather,Ryan Lege,Caner Oleas Pekgönenç,Bradley Edwards,Tertiary ,Austin Miller,Jesse Holmes,Jan Dvořák,Marten F,Erin D. Smale,
    Maxwell Hill,Drunken_Legends,rob bee,Jesse Holmes,YYako,Detocroix,Anoplexian,Hannah,Paul,Sandra Krohn,Lucid,Richard Keating,Allen Varney,Rick Falkvinge,
    Seth Fusion,Adam Butler,Gus,StroboWolf,Sadie Blackthorne,Zewen Senpai,Dell McKnight,Oneiris,Darinius Dragonclaw Studios,Christopher Whitney,Rhodes HvZ,
    Jeppe Skov Jensen,María Martín López,Martin Seeger,Annie Rishor,Aram Sabatés,MadNomadMedia,Eric Foley,Vito Martono,James H. Anthony,Kevin Cossutta,
    Thirty-OneR ,ThatGuyGW ,Dee Chiu,MontyBoosh ,Achillain ,Jaden ,SashaTK,Steve Johnson,Eric Foley,Vito Martono,James H. Anthony,Kevin Cossutta,Thirty-OneR,
    ThatGuyGW,Dee Chiu,MontyBoosh,Achillain,Jaden,SashaTK,Steve Johnson,Pierrick Bertrand,Jared Kennedy,Dylan Devenny,Kyle Robertson,Andrew Rostaing,Daniel Gill,
    Char,Jack,Barna Csíkos,Ian Rousseau,Nicholas Grabstas,Tom Van Orden jr,Bryan Brake,Akylos,Riley Seaman,MaxOliver,Evan-DiLeo,Alex Debus,Joshua Vaught,
    Kyle S,Eric Moore,Dean Dunakin,Uniquenameosaurus,WarWizardGames,Chance Mena,Jan Ka,Miguel Alejandro,Dalton Clark,Simon Drapeau,Radovan Zapletal,Jmmat6,
    Justa Badge,Blargh Blarghmoomoo,Vanessa Anjos,Grant A. Murray,Akirsop,Rikard Wolff,Jake Fish,teco 47,Antiroo,Jakob Siegel,Guilherme Aguiar,Jarno Hallikainen,
    Justin Mcclain,Kristin Chernoff,Rowland Kingman,Esther Busch,Grayson McClead,Austin,Hakon the Viking,Chad Riley`;

  const array = supporters.replace(/(?:\r\n|\r|\n)/g, "").split(",").map(v => capitalize(v.trim())).sort();
  alertMessage.innerHTML = "<ul style='column-count: 5; column-gap: 2em'>" + array.map(n => `<li>${n}</li>`).join("") + "</ul>";
  $("#alert").dialog({resizable: false,title: "Patreon Supporters",width: "54vw",position: {my: "center",at: "center",of: "svg"}});
}

// Option listeners
const optionsContent = document.getElementById("optionsContent");
optionsContent.addEventListener("input", function(event) {
  const id = event.target.id, value = event.target.value;
  if (id === "mapWidthInput" || id === "mapHeightInput") mapSizeInputChange();
  else if (id === "pointsInput") changeCellsDensity(+value);
  else if (id === "culturesInput") culturesOutput.value = value;
  else if (id === "culturesOutput") culturesInput.value = value;
  else if (id === "culturesSet") changeCultureSet();
  else if (id === "regionsInput" || id === "regionsOutput") changeStatesNumber(value);
  else if (id === "provincesInput") provincesOutput.value = value;
  else if (id === "provincesOutput") provincesOutput.value = value;
  else if (id === "provincesOutput") powerOutput.value = value;
  else if (id === "powerInput") powerOutput.value = value;
  else if (id === "powerOutput") powerInput.value = value;
  else if (id === "neutralInput") neutralOutput.value = value;
  else if (id === "neutralOutput") neutralInput.value = value;
  else if (id === "manorsInput") changeBurgsNumberSlider(value);
  else if (id === "religionsInput") religionsOutput.value = value;
  else if (id === "emblemShape") changeEmblemShape(value);
  else if (id === "tooltipSizeInput" || id === "tooltipSizeOutput") changeTooltipSize(value);
  else if (id === "transparencyInput") changeDialogsTransparency(value);
});

optionsContent.addEventListener("change", function(event) {
  if (event.target.dataset.stored) lock(event.target.dataset.stored);
  const id = event.target.id, value = event.target.value;
  if (id === "zoomExtentMin" || id === "zoomExtentMax") changeZoomExtent(value);
  else if (id === "optionsSeed") generateMapWithSeed();
  else if (id === "uiSizeInput" || id === "uiSizeOutput") changeUIsize(value);
  else if (id === "yearInput") changeYear();
  else if (id === "eraInput") changeEra();
});

optionsContent.addEventListener("click", function(event) {
  const id = event.target.id;
  if (id === "toggleFullscreen") toggleFullscreen();
  else if (id === "optionsSeedGenerate") generateMapWithSeed();
  else if (id === "optionsMapHistory") showSeedHistoryDialog();
  else if (id === "optionsCopySeed") copyMapURL();
  else if (id === "optionsEraRegenerate") regenerateEra();
  else if (id === "zoomExtentDefault") restoreDefaultZoomExtent();
  else if (id === "translateExtent") toggleTranslateExtent(event.target);
  else if (id === "speakerTest") testSpeaker();
});

function mapSizeInputChange() {
  changeMapSize();
  localStorage.setItem("mapWidth", mapWidthInput.value);
  localStorage.setItem("mapHeight", mapHeightInput.value);
}

// change svg size on manual size change or window resize, do not change graph size
function changeMapSize() {
  svgWidth = Math.min(+mapWidthInput.value, window.innerWidth);
  svgHeight = Math.min(+mapHeightInput.value, window.innerHeight);
  svg.attr("width", svgWidth).attr("height", svgHeight);

  const maxWidth = Math.max(+mapWidthInput.value, graphWidth);
  const maxHeight = Math.max(+mapHeightInput.value, graphHeight);
  zoom.translateExtent([[0, 0], [maxWidth, maxHeight]]);
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
function applyMapSize() {
  const zoomMin = +zoomExtentMin.value, zoomMax = +zoomExtentMax.value;
  graphWidth = +mapWidthInput.value;
  graphHeight = +mapHeightInput.value;
  svgWidth = Math.min(graphWidth, window.innerWidth);
  svgHeight = Math.min(graphHeight, window.innerHeight);
  svg.attr("width", svgWidth).attr("height", svgHeight);
  zoom.translateExtent([[0, 0], [graphWidth, graphHeight]]).scaleExtent([zoomMin, zoomMax]).scaleTo(svg, zoomMin);
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
  const on = el.dataset.on = +!(+el.dataset.on);
  if (on) zoom.translateExtent([[-graphWidth/2, -graphHeight/2], [graphWidth*1.5, graphHeight*1.5]]);
  else zoom.translateExtent([[0, 0], [graphWidth, graphHeight]]);
}

// add voice options
const voiceInterval = setInterval(function() {
  const voices = speechSynthesis.getVoices();
  if (voices.length) clearInterval(voiceInterval); else return;

  const select = document.getElementById("speakerVoice");
  voices.forEach((voice, i) => {
    select.options.add(new Option(voice.name, i, false));
  });
  if (stored("speakerVoice")) select.value = localStorage.getItem("speakerVoice"); // se voice to store
  else select.value = voices.findIndex(voice => voice.lang === "en-US"); // or to first found English-US
}, 1000);

function testSpeaker() {
  const text = `${mapName.value}, ${options.year} ${options.era}`;
  const speaker = new SpeechSynthesisUtterance(text);
  const voices = speechSynthesis.getVoices();
  if (voices.length) {
    const voiceId = +document.getElementById("speakerVoice").value;
    speaker.voice = voices[voiceId];
  }
  speechSynthesis.speak(speaker);
}

function generateMapWithSeed() {
  if (optionsSeed.value == seed) {
    tip("The current map already has this seed", false, "error");
    return;
  }
  regeneratePrompt();
}

function showSeedHistoryDialog() {
  const alert = mapHistory.map(function(h, i) {
    const created = new Date(h.created).toLocaleTimeString();
    const button = `<i data-tip"Click to generate a map with this seed" onclick="restoreSeed(${i})" class="icon-history optionsSeedRestore"></i>`;
    return `<div>${i+1}. Seed: ${h.seed} ${button}. Size: ${h.width}x${h.height}. Template: ${h.template}. Created: ${created}</div>`;
  }).join("");
  alertMessage.innerHTML = alert;
  $("#alert").dialog({
    resizable: false, title: "Seed history",
    width: fitContent(), position: {my: "center", at: "center", of: "svg"}
  });
}

// generate map with historical seed
function restoreSeed(id) {
  if (mapHistory[id].seed == seed) {
    tip("The current map is already generated with this seed", null, "error");
    return;
  }
  optionsSeed.value = mapHistory[id].seed;
  mapWidthInput.value = mapHistory[id].width;
  mapHeightInput.value = mapHistory[id].height;
  templateInput.value = mapHistory[id].template;
  if (locked("template")) unlock("template");
  regeneratePrompt();
}

function restoreDefaultZoomExtent() {
  zoomExtentMin.value = 1;
  zoomExtentMax.value = 20;
  zoom.scaleExtent([1, 20]).scaleTo(svg, 1);
}

function copyMapURL() {
  const locked = document.querySelectorAll("i.icon-lock").length; // check if some options are locked
  const search = `?seed=${optionsSeed.value}&width=${graphWidth}&height=${graphHeight}${locked?'':'&options=default'}`;
  navigator.clipboard.writeText(location.host+location.pathname+search)
  .then(() => {
    tip("Map URL is copied to clipboard", false, "success", 3000);
    //window.history.pushState({}, null, search);
  })
  .catch(err => tip("Could not copy URL: "+err, false, "error", 5000));
}

function changeCellsDensity(value) {
  const convert = v => {
    if (v == 1) return 1000;
    if (v == 2) return 2000;
    if (v == 3) return 5000;
    if (v == 4) return 10000;
    if (v == 5) return 20000;
    if (v == 6) return 30000;
    if (v == 7) return 40000;
    if (v == 8) return 50000;
    if (v == 9) return 60000;
    if (v == 10) return 70000;
    if (v == 11) return 80000;
    if (v == 12) return 90000;
    if (v == 13) return 100000;
  }
  const cells = convert(value);

  pointsInput.setAttribute("data-cells", cells);
  pointsOutput.value = cells / 1000 + "K";
  pointsOutput.style.color = cells > 50000 ? "#b12117" : cells !== 10000 ? "#dfdf12" : "#053305";
}

function changeCultureSet() {
  const max = culturesSet.selectedOptions[0].dataset.max;
  culturesInput.max = culturesOutput.max = max
  if (+culturesOutput.value > +max) culturesInput.value = culturesOutput.value = max;
}

function changeEmblemShape(emblemShape) {
  const image = document.getElementById("emblemShapeImage");
  const shapePath = window.COArenderer && COArenderer.shieldPaths[emblemShape];
  shapePath ? image.setAttribute("d", shapePath) : image.removeAttribute("d");

  const specificShape = ["culture", "state", "random"].includes(emblemShape) ? null : emblemShape;
  if (emblemShape === "random") pack.cultures.filter(c => !c.removed).forEach(c => c.shield = Cultures.getRandomShield());

  const rerenderCOA = (id, coa) => {
    const coaEl = document.getElementById(id);
    if (!coaEl) return; // not rendered
    coaEl.remove();
    COArenderer.trigger(id, coa);
  }

  pack.states.forEach(state => {
    if (!state.i || state.removed || !state.coa || state.coa === "custom") return;
    const newShield = specificShape || COA.getShield(state.culture, null);
    if (newShield === state.coa.shield) return;
    state.coa.shield = newShield;
    rerenderCOA("stateCOA" + state.i, state.coa);
  });

  pack.provinces.forEach(province => {
    if (!province.i || province.removed || !province.coa || province.coa === "custom") return;
    const culture = pack.cells.culture[province.center];
    const newShield = specificShape || COA.getShield(culture, province.state);
    if (newShield === province.coa.shield) return;
    province.coa.shield = newShield;
    rerenderCOA("provinceCOA" + province.i, province.coa);
  });

  pack.burgs.forEach(burg => {
    if (!burg.i || burg.removed || !burg.coa || burg.coa === "custom") return;
    const newShield = specificShape || COA.getShield(burg.culture, burg.state);
    if (newShield === burg.coa.shield) return;
    burg.coa.shield = newShield
    rerenderCOA("burgCOA" + burg.i, burg.coa);
  });
}

function changeStatesNumber(value) {
  regionsInput.value = regionsOutput.value = value;
  regionsOutput.style.color = +value ? null : "#b12117";
  burgLabels.select("#capitals").attr("data-size", Math.max(rn(6 - value / 20), 3));
  labels.select("#countries").attr("data-size", Math.max(rn(18 - value / 6), 4));
}

function changeBurgsNumberSlider(value) {
  manorsOutput.value = value == 1000 ? "auto" : value;
}

function changeUIsize(value) {
  if (isNaN(+value) || +value < .5) return;

  const max = getUImaxSize();
  if (+value > max) value = max;

  uiSizeInput.value = uiSizeOutput.value = value;
  document.getElementsByTagName("body")[0].style.fontSize = value * 11 + "px";
  document.getElementById("options").style.width = value * 300 + "px";
}

function getUImaxSize() {
  return rn(Math.min(window.innerHeight / 465, window.innerWidth / 302), 1);
}

function changeTooltipSize(value) {
  tooltipSizeInput.value = tooltipSizeOutput.value = value;
  tooltip.style.fontSize = `calc(${value}px + 0.5vw)`;
}

// change transparency for modal windows
function changeDialogsTransparency(value) {
  transparencyInput.value = transparencyOutput.value = value;
  const alpha = (100 - +value) / 100;
  const optionsColor = "rgba(164, 139, 149, " + alpha + ")";
  const dialogsColor = "rgba(255, 255, 255, " + alpha + ")";
  const optionButtonsColor = "rgba(145, 110, 127, " + Math.min(alpha + .3, 1) + ")";
  const optionLiColor = "rgba(153, 123, 137, " + Math.min(alpha + .3, 1) + ")";
  document.getElementById("options").style.backgroundColor = optionsColor;
  document.getElementById("dialogs").style.backgroundColor = dialogsColor;
  document.querySelectorAll(".tabcontent button").forEach(el => el.style.backgroundColor = optionButtonsColor);
  document.querySelectorAll(".tabcontent li").forEach(el => el.style.backgroundColor = optionLiColor);
  document.querySelectorAll("button.options").forEach(el => el.style.backgroundColor = optionLiColor);
}

function changeZoomExtent(value) {
  const min = Math.max(+zoomExtentMin.value, .01), max = Math.min(+zoomExtentMax.value, 200);
  zoom.scaleExtent([min, max]);
  const scale = Math.max(Math.min(+value, 200), .01);
  zoom.scaleTo(svg, scale);
}

// control stored options logic
function applyStoredOptions() {
  if (!localStorage.getItem("mapWidth") || !localStorage.getItem("mapHeight")) {
    mapWidthInput.value = window.innerWidth;
    mapHeightInput.value = window.innerHeight;
  }

  if (localStorage.getItem("distanceUnit")) applyOption(distanceUnitInput, localStorage.getItem("distanceUnit"));
  if (localStorage.getItem("heightUnit")) applyOption(heightUnit, localStorage.getItem("heightUnit"));

  for (let i=0; i < localStorage.length; i++) {
    const stored = localStorage.key(i), value = localStorage.getItem(stored);
    if (stored === "speakerVoice") continue;
    const input = document.getElementById(stored+"Input") || document.getElementById(stored);
    const output = document.getElementById(stored+"Output");
    if (input) input.value = value;
    if (output) output.value = value;
    lock(stored);

    // add saved style presets to options
    if(stored.slice(0,5) === "style") applyOption(stylePreset, stored, stored.slice(5));
  }

  if (localStorage.getItem("winds")) options.winds = localStorage.getItem("winds").split(",").map(w => +w);
  if (localStorage.getItem("military")) options.military = JSON.parse(localStorage.getItem("military"));

  changeDialogsTransparency(localStorage.getItem("transparency") || 5);
  if (localStorage.getItem("tooltipSize")) changeTooltipSize(localStorage.getItem("tooltipSize"));
  if (localStorage.getItem("regions")) changeStatesNumber(localStorage.getItem("regions"));

  uiSizeInput.max = uiSizeOutput.max = getUImaxSize();
  if (localStorage.getItem("uiSize")) changeUIsize(localStorage.getItem("uiSize"));
  else changeUIsize(Math.max(Math.min(rn(mapWidthInput.value / 1280, 1), 2.5), 1));

  // search params overwrite stored and default options
  const params = new URL(window.location.href).searchParams;
  const width = +params.get("width");
  const height = +params.get("height");
  if (width) mapWidthInput.value = width;
  if (height) mapHeightInput.value = height;
}

// randomize options if randomization is allowed (not locked or options='default')
function randomizeOptions() {
  Math.random = aleaPRNG(seed); // reset seed to initial one
  const randomize = new URL(window.location.href).searchParams.get("options") === "default"; // ignore stored options

  // 'Options' settings
  if (randomize || !locked("template")) randomizeHeightmapTemplate();
  if (randomize || !locked("regions")) regionsInput.value = regionsOutput.value = gauss(15, 3, 2, 30);
  if (randomize || !locked("provinces")) provincesInput.value = provincesOutput.value = gauss(20, 10, 20, 100);
  if (randomize || !locked("manors")) {manorsInput.value = 1000; manorsOutput.value = "auto";}
  if (randomize || !locked("religions")) religionsInput.value = religionsOutput.value = gauss(5, 2, 2, 10);
  if (randomize || !locked("power")) powerInput.value = powerOutput.value = gauss(4, 2, 0, 10, 2);
  if (randomize || !locked("neutral")) neutralInput.value = neutralOutput.value = rn(1 + Math.random(), 1);
  if (randomize || !locked("cultures")) culturesInput.value = culturesOutput.value = gauss(12, 3, 5, 30);
  if (randomize || !locked("culturesSet")) randomizeCultureSet();

  // 'Configure World' settings
  if (randomize || !locked("prec")) precInput.value = precOutput.value = gauss(100, 40, 5, 500);
  const tMax = +temperatureEquatorOutput.max, tMin = +temperatureEquatorOutput.min; // temperature extremes
  if (randomize || !locked("temperatureEquator")) temperatureEquatorOutput.value = temperatureEquatorInput.value = rand(tMax-6, tMax);
  if (randomize || !locked("temperaturePole")) temperaturePoleOutput.value = temperaturePoleInput.value = rand(tMin, tMin+10);

  // 'Units Editor' settings
  const US = navigator.language === "en-US";
  const UK = navigator.language === "en-GB";
  if (randomize || !locked("distanceScale")) distanceScaleOutput.value = distanceScaleInput.value = gauss(3, 1, 1, 5);
  if (!stored("distanceUnit")) distanceUnitInput.value = US || UK ? "mi" : "km";
  if (!stored("heightUnit")) heightUnit.value = US || UK ? "ft" : "m";
  if (!stored("temperatureScale")) temperatureScale.value = US ? "°F" : "°C";

  // World settings
  generateEra();
}

// select heightmap template pseudo-randomly
function randomizeHeightmapTemplate() {
  const templates = {
    "Volcano":      3,
    "High Island":  22,
    "Low Island":   9,
    "Continents":   20,
    "Archipelago":  25,
    "Mediterranean":3,
    "Peninsula":    3,
    "Pangea":       5,
    "Isthmus":      2,
    "Atoll":        1,
    "Shattered":    7
  };
  document.getElementById("templateInput").value = rw(templates);
}

// select culture set pseudo-randomly
function randomizeCultureSet() {
  const sets = {
    "world":       10,
    "european":    10,
    "oriental":    2,
    "english":     5,
    "antique":     3,
    "highFantasy": 11,
    "darkFantasy": 3,
    "random":      1};
  culturesSet.value = rw(sets);
  changeCultureSet();
}

// generate current year and era name
function generateEra() {
  if (!stored("year")) yearInput.value = rand(100, 2000); // current year
  if (!stored("era")) eraInput.value = Names.getBaseShort(P(.7) ? 1 : rand(nameBases.length)) + " Era";
  options.year = +yearInput.value;
  options.era = eraInput.value;
  options.eraShort = options.era.split(" ").map(w => w[0].toUpperCase()).join(""); // short name for era
}

function regenerateEra() {
  unlock("era");
  options.era = eraInput.value = Names.getBaseShort(P(.7) ? 1 : rand(nameBases.length)) + " Era";
  options.eraShort = options.era.split(" ").map(w => w[0].toUpperCase()).join("");
}

function changeYear() {
  if (!yearInput.value) return;
  if (isNaN(+yearInput.value)) {tip("Current year should be a number", false, "error"); return;}
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
document.getElementById("sticked").addEventListener("click", function(event) {
  const id = event.target.id;
  if (id === "newMapButton") regeneratePrompt();
  else if (id === "saveButton") showSavePane();
  else if (id === "loadButton") showLoadPane();
  else if (id === "zoomReset") resetZoom(1000);
});

function regeneratePrompt() {
  if (customization) {tip("New map cannot be generated when edit mode is active, please exit the mode and retry", false, "error"); return;}
  const workingTime = (Date.now() - last(mapHistory).created) / 60000; // minutes
  if (workingTime < 5) {regenerateMap(); return;}

  alertMessage.innerHTML = `Are you sure you want to generate a new map?<br>
  All unsaved changes made to the current map will be lost`;
  $("#alert").dialog({resizable: false, title: "Generate new map",
    buttons: {
      Cancel: function() {$(this).dialog("close");},
      Generate: function() {closeDialogs(); regenerateMap();}
    }
  });
}

function showSavePane() {
  $("#saveMapData").dialog({title: "Save map", resizable: false, width: "27em", 
    position: {my: "center", at: "center", of: "svg"},
    buttons: {Close: function() {$(this).dialog("close");}}
  });
}

// download map data as GeoJSON
function saveGeoJSON() {
  alertMessage.innerHTML = `You can export map data in GeoJSON format used in GIS tools such as QGIS.
  Check out ${link("https://github.com/Azgaar/Fantasy-Map-Generator/wiki/GIS-data-export", "wiki-page")} for guidance`;

  $("#alert").dialog({title: "GIS data export", resizable: false, width: "35em", position: {my: "center", at: "center", of: "svg"},
    buttons: {
      Cells: saveGeoJSON_Cells,
      Routes: saveGeoJSON_Routes,
      Rivers: saveGeoJSON_Rivers,
      Markers: saveGeoJSON_Markers,
      Close: function() {$(this).dialog("close");}
    }
  });
}

function showLoadPane() {
  $("#loadMapData").dialog({title: "Load map", resizable: false, width: "17em", 
    position: {my: "center", at: "center", of: "svg"},
    buttons: {Close: function() {$(this).dialog("close");}}
  });
}

function loadURL() {
  const pattern = /(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/;
  const inner = `Provide URL to a .map file:
    <input id="mapURL" type="url" style="width: 24em" placeholder="https://e-cloud.com/test.map">
    <br><i>Please note server should allow CORS for file to be loaded. If CORS is not allowed, save file to Dropbox and provide a direct link</i>`;
  alertMessage.innerHTML = inner;
  $("#alert").dialog({resizable: false, title: "Load map from URL", width: "27em",
    buttons: {
      Load: function() {
        const value = mapURL.value;
        if (!pattern.test(value)) {tip("Please provide a valid URL", false, "error"); return;}
        loadMapFromURL(value);
        $(this).dialog("close");
      },
      Cancel: function() {$(this).dialog("close");}
    }
  });
}

// load map
document.getElementById("mapToLoad").addEventListener("change", function() {
  const fileToLoad = this.files[0];
  this.value = "";
  closeDialogs();
  uploadMap(fileToLoad);
});

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

  if (!document.getElementById("canvas3d")) return;
  ThreeD.stop();
  document.getElementById("canvas3d").remove();
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
    const help = "Left mouse to change angle, middle mouse / mousewheel to zoom, right mouse to pan. <b>O</b> to toggle options";
    +canvas.dataset.hovered > 2 ? tip("") : tip(help);
    canvas.dataset.hovered = (+canvas.dataset.hovered|0) + 1;
  };

  if (type === "heightmap3DView") {
    document.getElementById("preview3d").appendChild(canvas);
    $("#preview3d").dialog({
      title: "3D Preview", resizable: true,
      position: {my: "left bottom", at: "left+10 bottom-20", of: "svg"},
      resizeStop: resize3d, close: enterStandardView
    });
  } else document.body.insertBefore(canvas, optionsContainer);

  toggle3dOptions();
}

function resize3d() {
  const canvas = document.getElementById("canvas3d");
  canvas.width = parseFloat(preview3d.style.width);
  canvas.height = parseFloat(preview3d.style.height) - 2;
  ThreeD.redraw();
}

function toggle3dOptions() {
  if (options3dUpdate.offsetParent) {$("#options3d").dialog("close"); return;}
  $("#options3d").dialog({
    title: "3D mode settings", resizable: false, width: fitContent(),
    position: {my: "right top", at: "right-30 top+10", of: "svg", collision: "fit"}
  });

  updateValues();

  if (modules.options3d) return;
  modules.options3d = true;

  document.getElementById("options3dUpdate").addEventListener("click", ThreeD.update);
  document.getElementById("options3dSave").addEventListener("click", ThreeD.saveScreenshot);
  document.getElementById("options3dOBJSave").addEventListener("click", ThreeD.saveOBJ);

  document.getElementById("options3dScaleRange").addEventListener("input", changeHeightScale);
  document.getElementById("options3dScaleNumber").addEventListener("change", changeHeightScale);
  document.getElementById("options3dLightnessRange").addEventListener("input", changeLightness);
  document.getElementById("options3dLightnessNumber").addEventListener("change", changeLightness);
  document.getElementById("options3dSunX").addEventListener("change", changeSunPosition);
  document.getElementById("options3dSunY").addEventListener("change", changeSunPosition);
  document.getElementById("options3dSunZ").addEventListener("change", changeSunPosition);
  document.getElementById("options3dMeshRotationRange").addEventListener("input", changeRotation);
  document.getElementById("options3dMeshRotationNumber").addEventListener("change", changeRotation);
  document.getElementById("options3dGlobeRotationRange").addEventListener("input", changeRotation);
  document.getElementById("options3dGlobeRotationNumber").addEventListener("change", changeRotation);
  document.getElementById("options3dMeshSkyMode").addEventListener("change", toggleSkyMode);
  document.getElementById("options3dMeshSky").addEventListener("input", changeColors);
  document.getElementById("options3dMeshWater").addEventListener("input", changeColors);
  document.getElementById("options3dGlobeResolution").addEventListener("change", changeResolution);

  function updateValues() {
    const globe = document.getElementById("canvas3d").dataset.type === "viewGlobe";
    options3dMesh.style.display = globe ? "none" : "block";
    options3dGlobe.style.display = globe ? "block" : "none";
    options3dScaleRange.value = options3dScaleNumber.value = ThreeD.options.scale;
    options3dLightnessRange.value = options3dLightnessNumber.value = ThreeD.options.lightness * 100;
    options3dSunX.value = ThreeD.options.sun.x;
    options3dSunY.value = ThreeD.options.sun.y;
    options3dSunZ.value = ThreeD.options.sun.z;
    options3dMeshRotationRange.value = options3dMeshRotationNumber.value = ThreeD.options.rotateMesh;
    options3dGlobeRotationRange.value = options3dGlobeRotationNumber.value = ThreeD.options.rotateGlobe;
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
