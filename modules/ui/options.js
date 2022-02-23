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
optionsTrigger.addEventListener("mouseenter", function () {
  if (optionsTrigger.classList.contains("glow")) return;
  if (document.getElementById("options").style.display === "none") regenerate.style.display = "block";
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
    const active = document.getElementById("options").querySelector(".tab > button.active");
    if (active && id === active.id) return; // already active tab is clicked

    if (active) active.classList.remove("active");
    document.getElementById(id).classList.add("active");
    document
      .getElementById("options")
      .querySelectorAll(".tabcontent")
      .forEach(e => (e.style.display = "none"));

    if (id === "layersTab") layersContent.style.display = "block";
    else if (id === "styleTab") styleContent.style.display = "block";
    else if (id === "optionsTab") optionsContent.style.display = "block";
    else if (id === "toolsTab") customization === 1 ? (customizationMenu.style.display = "block") : (toolsContent.style.display = "block");
    else if (id === "aboutTab") aboutContent.style.display = "block";
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
    Thirty-OneR,ThatGuyGW,Dee Chiu,MontyBoosh,Achillain,Jaden,SashaTK,Steve Johnson,Pierrick Bertrand,Jared Kennedy,Dylan Devenny,Kyle Robertson,
    Andrew Rostaing,Daniel Gill,Char,Jack,Barna Csíkos,Ian Rousseau,Nicholas Grabstas,Tom Van Orden jr,Bryan Brake,Akylos,Riley Seaman,MaxOliver,Evan-DiLeo,
    Alex Debus,Joshua Vaught,Kyle S,Eric Moore,Dean Dunakin,Uniquenameosaurus,WarWizardGames,Chance Mena,Jan Ka,Miguel Alejandro,Dalton Clark,Simon Drapeau,
    Radovan Zapletal,Jmmat6,Justa Badge,Blargh Blarghmoomoo,Vanessa Anjos,Grant A. Murray,Akirsop,Rikard Wolff,Jake Fish,teco 47,Antiroo,Jakob Siegel,
    Guilherme Aguiar,Jarno Hallikainen,Justin Mcclain,Kristin Chernoff,Rowland Kingman,Esther Busch,Grayson McClead,Austin,Hakon the Viking,Chad Riley,
    Cooper Counts,Patrick Jones,Clonetone,PlayByMail.Net,Brad Wardell,Lance Saba,Egoensis,Brea Richards,Tiber,Chris Bloom,Maxim Lowe,Aquelion,
    Page One Project,Spencer Morris,Paul Ingram,Dust Bunny,Adrian Wright,Eric Alexander Cartaya,GameNight,Thomas Mortensen Hansen,Zklaus,Drinarius,
    Ed Wright,Lon Varnadore,Crys Cain,Heaven N Lee,Jeffrey Henning,Lazer Elf,Jordan Bellah,Alex Beard,Kass Frisson,Petro Lombaard,Emanuel Pietri,Rox,
    PinkEvil,Gavin Madrigal,Martin Lorber,Prince of Morgoth,Jaryd Armstrong,Andrew Pirkola,ThyHolyDevil,Gary Smith,Tyshaun Wise,Ethan Cook,Jon Stroman,
    Nobody679,良义 金,Chris Gray,Phoenix Boatwright,Mackenzie,Milo Cohen,Jason Matthew Wuerfel,Rasmus Legêne,Andrew Hines,Wexxler,Espen Sæverud,Binks,
    Dominick Ormsby,Linn Browning,Václav Švec,Alan Buehne,George J.Lekkas,Alexandre Boivin,Tommy Mayfield,Skylar Mangum-Turner,Karen Blythe,Stefan Gugerel,
    Mike Conley,Xavier privé,Hope You're Well,Mark Sprietsma,Robert Landry,Nick Mowry,steve hall,Markell,Josh Wren,Neutrix,BLRageQuit,Rocky,
    Dario Spadavecchia,Bas Kroot,John Patrick Callahan Jr,Alexandra Vesey,D,Exp1nt,james,Braxton Istace,w,Rurikid,AntiBlock,Redsauz,BigE0021,
    Jonathan Williams,ojacid .,Brian Wilson,A Patreon of the Ahts,Shubham Jakhotiya,www15o,Jan Bundesmann,Angelique Badger,Joshua Xiong,Moist mongol,
    Frank Fewkes,jason baldrick,Game Master Pro,Andrew Kircher,Preston Mitchell,Chris Kohut,Emarandzeb,Trentin Bergeron,Damon Gallaty,Pleaseworkforonce,
    Jordan,William Markus,Sidr Dim,Alexander Whittaker,The Next Level,Patrick Valverde,Markus Peham,Daniel Cooper,the Beagles of Neorbus,Marley Moule,
    Maximilian Schielke,Johnathan Xavier Hutchinson,Ele,Rita`;

  const array = supporters
    .replace(/(?:\r\n|\r|\n)/g, "")
    .split(",")
    .map(v => capitalize(v.trim()))
    .sort();
  alertMessage.innerHTML = "<ul style='column-count: 5; column-gap: 2em'>" + array.map(n => `<li>${n}</li>`).join("") + "</ul>";
  $("#alert").dialog({resizable: false, title: "Patreon Supporters", width: "54vw", position: {my: "center", at: "center", of: "svg"}});
}

// on any option or dialog change
document.getElementById("options").addEventListener("change", checkIfStored);
document.getElementById("dialogs").addEventListener("change", checkIfStored);
document.getElementById("options").addEventListener("input", updateOutputToFollowInput);
document.getElementById("dialogs").addEventListener("input", updateOutputToFollowInput);

function checkIfStored(ev) {
  if (ev.target.dataset.stored) lock(ev.target.dataset.stored);
}

function updateOutputToFollowInput(ev) {
  const id = ev.target.id;
  const value = ev.target.value;

  // specific cases
  if (id === "manorsInput") return (manorsOutput.value = value == 1000 ? "auto" : value);

  // generic case
  if (id.slice(-5) === "Input") {
    const output = document.getElementById(id.slice(0, -5) + "Output");
    if (output) output.value = value;
  } else if (id.slice(-6) === "Output") {
    const input = document.getElementById(id.slice(0, -6) + "Input");
    if (input) input.value = value;
  }
}

// Option listeners
const optionsContent = document.getElementById("optionsContent");
optionsContent.addEventListener("input", function (event) {
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

optionsContent.addEventListener("change", function (event) {
  const id = event.target.id;
  const value = event.target.value;

  if (id === "zoomExtentMin" || id === "zoomExtentMax") changeZoomExtent(value);
  else if (id === "optionsSeed") generateMapWithSeed("seed change");
  else if (id === "uiSizeInput" || id === "uiSizeOutput") changeUIsize(value);
  if (id === "shapeRendering") viewbox.attr("shape-rendering", value);
  else if (id === "yearInput") changeYear();
  else if (id === "eraInput") changeEra();
  else if (id === "stateLabelsModeInput") options.stateLabelsMode = value;
});

optionsContent.addEventListener("click", function (event) {
  const id = event.target.id;
  if (id === "toggleFullscreen") toggleFullscreen();
  else if (id === "optionsMapHistory") showSeedHistoryDialog();
  else if (id === "optionsCopySeed") copyMapURL();
  else if (id === "optionsEraRegenerate") regenerateEra();
  else if (id === "zoomExtentDefault") restoreDefaultZoomExtent();
  else if (id === "translateExtent") toggleTranslateExtent(event.target);
  else if (id === "speakerTest") testSpeaker();
  else if (id === "themeColorRestore") restoreDefaultThemeColor();
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
  zoom.translateExtent([
    [0, 0],
    [maxWidth, maxHeight]
  ]);
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
  const zoomMin = +zoomExtentMin.value;
  const zoomMax = +zoomExtentMax.value;
  graphWidth = +mapWidthInput.value;
  graphHeight = +mapHeightInput.value;
  svgWidth = Math.min(graphWidth, window.innerWidth);
  svgHeight = Math.min(graphHeight, window.innerHeight);
  svg.attr("width", svgWidth).attr("height", svgHeight);
  zoom
    .translateExtent([
      [0, 0],
      [graphWidth, graphHeight]
    ])
    .scaleExtent([zoomMin, zoomMax])
    .scaleTo(svg, zoomMin);
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
  const on = (el.dataset.on = +!+el.dataset.on);
  if (on)
    zoom.translateExtent([
      [-graphWidth / 2, -graphHeight / 2],
      [graphWidth * 1.5, graphHeight * 1.5]
    ]);
  else
    zoom.translateExtent([
      [0, 0],
      [graphWidth, graphHeight]
    ]);
}

// add voice options
const voiceInterval = setInterval(function () {
  const voices = speechSynthesis.getVoices();
  if (voices.length) clearInterval(voiceInterval);
  else return;

  const select = document.getElementById("speakerVoice");
  voices.forEach((voice, i) => {
    select.options.add(new Option(voice.name, i, false));
  });
  if (stored("speakerVoice")) select.value = localStorage.getItem("speakerVoice");
  // se voice to store
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

function generateMapWithSeed(source) {
  if (optionsSeed.value == seed) return tip("The current map already has this seed", false, "error");
  regeneratePrompt(source);
}

function showSeedHistoryDialog() {
  const lines = mapHistory.map((h, i) => {
    const created = new Date(h.created).toLocaleTimeString();
    const button = `<i data-tip="Click to generate a map with this seed" onclick="restoreSeed(${i})" class="icon-history optionsSeedRestore"></i>`;
    return `<li>Seed: ${h.seed} ${button}. Size: ${h.width}x${h.height}. Template: ${h.template}. Created: ${created}</li>`;
  });
  alertMessage.innerHTML = `<ol style="margin: 0; padding-left: 1.5em">${lines.join("")}</ol>`;

  $("#alert").dialog({
    resizable: false,
    title: "Seed history",
    position: {my: "center", at: "center", of: "svg"}
  });
}

// generate map with historical seed
function restoreSeed(id) {
  if (mapHistory[id].seed == seed) return tip("The current map is already generated with this seed", null, "error");

  optionsSeed.value = mapHistory[id].seed;
  mapWidthInput.value = mapHistory[id].width;
  mapHeightInput.value = mapHistory[id].height;
  templateInput.value = mapHistory[id].template;
  if (locked("template")) unlock("template");
  regeneratePrompt("seed history");
}

function restoreDefaultZoomExtent() {
  zoomExtentMin.value = 1;
  zoomExtentMax.value = 20;
  zoom.scaleExtent([1, 20]).scaleTo(svg, 1);
}

function copyMapURL() {
  const locked = document.querySelectorAll("i.icon-lock").length; // check if some options are locked
  const search = `?seed=${optionsSeed.value}&width=${graphWidth}&height=${graphHeight}${locked ? "" : "&options=default"}`;
  navigator.clipboard
    .writeText(location.host + location.pathname + search)
    .then(() => {
      tip("Map URL is copied to clipboard", false, "success", 3000);
      //window.history.pushState({}, null, search);
    })
    .catch(err => tip("Could not copy URL: " + err, false, "error", 5000));
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
  };
  const cells = convert(value);

  pointsInput.setAttribute("data-cells", cells);
  pointsOutput_formatted.value = cells / 1000 + "K";
  pointsOutput_formatted.style.color = cells > 50000 ? "#b12117" : cells !== 10000 ? "#dfdf12" : "#053305";
}

function changeCultureSet() {
  const max = culturesSet.selectedOptions[0].dataset.max;
  culturesInput.max = culturesOutput.max = max;
  if (+culturesOutput.value > +max) culturesInput.value = culturesOutput.value = max;
}

function changeEmblemShape(emblemShape) {
  const image = document.getElementById("emblemShapeImage");
  const shapePath = window.COArenderer && COArenderer.shieldPaths[emblemShape];
  shapePath ? image.setAttribute("d", shapePath) : image.removeAttribute("d");

  const specificShape = ["culture", "state", "random"].includes(emblemShape) ? null : emblemShape;
  if (emblemShape === "random") pack.cultures.filter(c => !c.removed).forEach(c => (c.shield = Cultures.getRandomShield()));

  const rerenderCOA = (id, coa) => {
    const coaEl = document.getElementById(id);
    if (!coaEl) return; // not rendered
    coaEl.remove();
    COArenderer.trigger(id, coa);
  };

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
  document.getElementById("options").style.width = value * 300 + "px";
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
  const min = Math.max(+zoomExtentMin.value, 0.01);
  const max = Math.min(+zoomExtentMax.value, 200);
  zoom.scaleExtent([min, max]);
  const scale = minmax(+value, 0.01, 200);
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

  for (let i = 0; i < localStorage.length; i++) {
    const stored = localStorage.key(i);
    const value = localStorage.getItem(stored);

    if (stored === "speakerVoice") continue;
    const input = document.getElementById(stored + "Input") || document.getElementById(stored);
    const output = document.getElementById(stored + "Output");
    if (input) input.value = value;
    if (output) output.value = value;
    lock(stored);

    // add saved style presets to options
    if (stored.slice(0, 5) === "style") applyOption(stylePreset, stored, stored.slice(5));
  }

  if (localStorage.getItem("winds"))
    options.winds = localStorage
      .getItem("winds")
      .split(",")
      .map(w => +w);
  if (localStorage.getItem("military")) options.military = JSON.parse(localStorage.getItem("military"));

  if (localStorage.getItem("tooltipSize")) changeTooltipSize(localStorage.getItem("tooltipSize"));
  if (localStorage.getItem("regions")) changeStatesNumber(localStorage.getItem("regions"));

  uiSizeInput.max = uiSizeOutput.max = getUImaxSize();
  if (localStorage.getItem("uiSize")) changeUIsize(localStorage.getItem("uiSize"));
  else changeUIsize(minmax(rn(mapWidthInput.value / 1280, 1), 1, 2.5));

  // search params overwrite stored and default options
  const params = new URL(window.location.href).searchParams;
  const width = +params.get("width");
  const height = +params.get("height");
  if (width) mapWidthInput.value = width;
  if (height) mapHeightInput.value = height;

  const transparency = localStorage.getItem("transparency") || 5;
  const themeColor = localStorage.getItem("themeColor");
  changeDialogsTheme(themeColor, transparency);

  // set shape rendering
  viewbox.attr("shape-rendering", shapeRendering.value);

  options.stateLabelsMode = stateLabelsModeInput.value;
}

// randomize options if randomization is allowed (not locked or options='default')
function randomizeOptions() {
  Math.random = aleaPRNG(seed); // reset seed to initial one
  const randomize = new URL(window.location.href).searchParams.get("options") === "default"; // ignore stored options

  // 'Options' settings
  if (randomize || !locked("template")) randomizeHeightmapTemplate();
  if (randomize || !locked("regions")) regionsInput.value = regionsOutput.value = gauss(18, 5, 2, 30);
  if (randomize || !locked("provinces")) provincesInput.value = provincesOutput.value = gauss(20, 10, 20, 100);
  if (randomize || !locked("manors")) {
    manorsInput.value = 1000;
    manorsOutput.value = "auto";
  }
  if (randomize || !locked("religions")) religionsInput.value = religionsOutput.value = gauss(5, 2, 2, 10);
  if (randomize || !locked("power")) powerInput.value = powerOutput.value = gauss(4, 2, 0, 10, 2);
  if (randomize || !locked("neutral")) neutralInput.value = neutralOutput.value = rn(1 + Math.random(), 1);
  if (randomize || !locked("cultures")) culturesInput.value = culturesOutput.value = gauss(12, 3, 5, 30);
  if (randomize || !locked("culturesSet")) randomizeCultureSet();

  // 'Configure World' settings
  if (randomize || !locked("prec")) precInput.value = precOutput.value = gauss(100, 40, 5, 500);
  const tMax = 30,
    tMin = -30; // temperature extremes
  if (randomize || !locked("temperatureEquator")) temperatureEquatorOutput.value = temperatureEquatorInput.value = rand(tMax - 10, tMax);
  if (randomize || !locked("temperaturePole")) temperaturePoleOutput.value = temperaturePoleInput.value = rand(tMin, tMin + 30);

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
  const templates = {
    volcano: 3,
    highIsland: 22,
    lowIsland: 9,
    continents: 19,
    archipelago: 23,
    mediterranean: 5,
    peninsula: 3,
    pangea: 5,
    isthmus: 2,
    atoll: 1,
    shattered: 7,
    taklamakan: 1
  };
  document.getElementById("templateInput").value = rw(templates);
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
document.getElementById("sticked").addEventListener("click", function (event) {
  const id = event.target.id;
  if (id === "newMapButton") regeneratePrompt("sticky button");
  else if (id === "saveButton") showSavePane();
  else if (id === "exportButton") showExportPane();
  else if (id === "loadButton") showLoadPane();
  else if (id === "zoomReset") resetZoom(1000);
});

function regeneratePrompt(source) {
  if (customization) return tip("New map cannot be generated when edit mode is active, please exit the mode and retry", false, "error");
  const workingTime = (Date.now() - last(mapHistory).created) / 60000; // minutes
  if (workingTime < 5) return regenerateMap(source);

  alertMessage.innerHTML = `Are you sure you want to generate a new map?<br>
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
        regenerateMap(source);
      }
    }
  });
}

function showSavePane() {
  const sharableLinkContainer = document.getElementById("sharableLinkContainer");
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
  const shrableLink = document.getElementById("sharableLink");
  const link = shrableLink.getAttribute("href");
  navigator.clipboard.writeText(link).then(() => tip("Link is copied to the clipboard", true, "success", 8000));
}

function showExportPane() {
  document.getElementById("showLabels").checked = !hideLabels.checked;

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
    document.getElementById("dropboxConnectButton").style.display = "none";
    document.getElementById("loadFromDropboxSelect").style.display = "block";
    const loadFromDropboxButtons = document.getElementById("loadFromDropboxButtons");
    const fileSelect = document.getElementById("loadFromDropboxSelect");
    fileSelect.innerHTML = `<option value="" disabled selected>Loading...</option>`;

    const files = await Cloud.providers.dropbox.list();

    if (!files) {
      loadFromDropboxButtons.style.display = "none";
      fileSelect.innerHTML = `<option value="" disabled selected>Save files to Dropbox first</option>`;
      return;
    }

    loadFromDropboxButtons.style.display = "block";
    fileSelect.innerHTML = "";
    files.forEach(file => {
      const opt = document.createElement("option");
      opt.innerText = file.name;
      opt.value = file.path;
      fileSelect.appendChild(opt);
    });

    return;
  }

  // not connected to Dropbox: show connect button
  document.getElementById("dropboxConnectButton").style.display = "inline-block";
  document.getElementById("loadFromDropboxButtons").style.display = "none";
  document.getElementById("loadFromDropboxSelect").style.display = "none";
}

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
document.getElementById("mapToLoad").addEventListener("change", function () {
  const fileToLoad = this.files[0];
  this.value = "";
  closeDialogs();
  uploadMap(fileToLoad);
});

function openSaveTiles() {
  closeDialogs();
  updateTilesOptions();
  const status = document.getElementById("tileStatus");
  status.innerHTML = "";
  let loading = null;

  const inputs = document.getElementById("saveTilesScreen").querySelectorAll("input");
  inputs.forEach(input => input.addEventListener("input", updateTilesOptions));

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
          status.innerHTML = `Done. Check file in "Downloads" (crtl + J)`;
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

  const tileSize = document.getElementById("tileSize");
  const tilesX = +document.getElementById("tileColsOutput").value;
  const tilesY = +document.getElementById("tileRowsOutput").value;
  const scale = +document.getElementById("tileScaleOutput").value;

  // calculate size
  const sizeX = graphWidth * scale * tilesX;
  const sizeY = graphHeight * scale * tilesY;
  const totalSize = sizeX * sizeY;

  tileSize.innerHTML = `${sizeX} x ${sizeY} px`;
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
  const labelsG = "<g fill='#000' stroke='none' text-anchor='middle' dominant-baseline='central' font-size='24px'>" + labels.join("") + "</g>";
  debug.html(rectsG + labelsG);
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
    canvas.dataset.hovered = (+canvas.dataset.hovered | 0) + 1;
  };

  if (type === "heightmap3DView") {
    document.getElementById("preview3d").appendChild(canvas);
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
  const canvas = document.getElementById("canvas3d");
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
  document.getElementById("options3dMeshLabels3d").addEventListener("change", toggleLabels3d);
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
