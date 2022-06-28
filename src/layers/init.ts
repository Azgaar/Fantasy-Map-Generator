import {stored, byId, store} from "utils/shorthands";
import {layerIsOn} from "./utils";

export function initLayers() {
  restoreCustomPresets();
  applyPreset();
  addLayerListeners();
}

let presets = {};

const defaultPresets = {
  political: [
    "toggleBorders",
    "toggleIcons",
    "toggleIce",
    "toggleLabels",
    "toggleRivers",
    "toggleRoutes",
    "toggleScaleBar",
    "toggleStates"
  ],
  cultural: [
    "toggleBorders",
    "toggleCultures",
    "toggleIcons",
    "toggleLabels",
    "toggleRivers",
    "toggleRoutes",
    "toggleScaleBar"
  ],
  religions: [
    "toggleBorders",
    "toggleIcons",
    "toggleLabels",
    "toggleReligions",
    "toggleRivers",
    "toggleRoutes",
    "toggleScaleBar"
  ],
  provinces: ["toggleBorders", "toggleIcons", "toggleProvinces", "toggleRivers", "toggleScaleBar"],
  biomes: ["toggleBiomes", "toggleIce", "toggleRivers", "toggleScaleBar"],
  heightmap: ["toggleHeight", "toggleRivers"],
  physical: ["toggleCoordinates", "toggleHeight", "toggleIce", "toggleRivers", "toggleScaleBar"],
  poi: [
    "toggleBorders",
    "toggleHeight",
    "toggleIce",
    "toggleIcons",
    "toggleMarkers",
    "toggleRivers",
    "toggleRoutes",
    "toggleScaleBar"
  ],
  military: [
    "toggleBorders",
    "toggleIcons",
    "toggleLabels",
    "toggleMilitary",
    "toggleRivers",
    "toggleRoutes",
    "toggleScaleBar",
    "toggleStates"
  ],
  emblems: [
    "toggleBorders",
    "toggleIcons",
    "toggleIce",
    "toggleEmblems",
    "toggleRivers",
    "toggleRoutes",
    "toggleScaleBar",
    "toggleStates"
  ],
  landmass: ["toggleScaleBar"]
};

function restoreCustomPresets() {
  const storedPresentsRaw = stored("presets");
  if (!storedPresentsRaw) {
    presets = structuredClone(defaultPresets);
    return;
  }

  const storedPresets = JSON.parse(storedPresentsRaw);

  for (const preset in storedPresets) {
    if (presets[preset]) continue;
    byId("layersPreset").add(new Option(preset, preset));
  }

  presets = storedPresets;
}

function addLayerListeners() {
  byId("mapLayers").on("click", toggleLayerOnClick);
  byId("savePresetButton").on("click", savePreset);
  byId("removePresetButton").on("click", removePreset);

  // allow to move layers by dragging layer button (jquery)
  $("#mapLayers").sortable({items: "li:not(.solid)", containment: "parent", cancel: ".solid", update: moveLayer});
}

// connection between option layer buttons and actual svg groups to move the element
const layerButtonToElementMap = {
  toggleBiomes: "biomes",
  toggleBorders: "borders",
  toggleCells: "cells",
  toggleCompass: "compass",
  toggleCoordinates: "coordinates",
  toggleCultures: "cults",
  toggleEmblems: "emblems",
  toggleGrid: "gridOverlay",
  toggleHeight: "terrs",
  toggleIce: "ice",
  toggleIcons: "icons",
  toggleLabels: "labels",
  toggleMarkers: "markers",
  toggleMilitary: "armies",
  togglePopulation: "population",
  togglePrec: "prec",
  toggleProvinces: "provs",
  toggleRelief: "terrain",
  toggleReligions: "relig",
  toggleRivers: "rivers",
  toggleRoutes: "routes",
  toggleRulers: "ruler",
  toggleStates: "regions",
  toggleTemp: "temperature",
  toggleTexture: "texture",
  toggleZones: "zones"
};

function moveLayer(event, $layerButton) {
  const getLayer = buttonId => $("#" + layerButtonToElementMap[buttonId]);
  const layer = getLayer($layerButton.item.attr("id"));
  if (!layer) return;

  const prev = getLayer($layerButton.item.prev().attr("id"));
  const next = getLayer($layerButton.item.next().attr("id"));

  if (prev) layer.insertAfter(prev);
  else if (next) layer.insertBefore(next);
}

function toggleLayerOnClick(event) {
  const targetId = event.target.id;
  if (!targetId || targetId === "mapLayers" || !layerTogglesMap[targetId]) return;
  layerTogglesMap[targetId]();
}

// run on map generation
function applyPreset() {
  const preset = stored("preset") || byId("layersPreset")?.value || "political";
  changePreset(preset);
}

// toggle layers on preset change
function changePreset(preset) {
  const layers = presets[preset]; // layers to be turned on
  const $layerButtons = byId("mapLayers").querySelectorAll("li");

  $layerButtons.forEach(function ($layerButton) {
    const {id} = $layerButton;
    if (layers.includes(id) && !layerIsOn(id)) $layerButton.click();
    else if (!layers.includes(id) && layerIsOn(id)) $layerButton.click();
  });

  byId("layersPreset").value = preset;
  store("preset", preset);

  const isDefault = defaultPresets[preset];
  byId("removePresetButton").style.display = isDefault ? "none" : "inline-block";
  byId("savePresetButton").style.display = "none";
  if (byId("canvas3d")) setTimeout(ThreeD.update(), 400);
}

function savePreset() {
  prompt("Please provide a preset name", {default: ""}, preset => {
    presets[preset] = Array.from(byId("mapLayers").querySelectorAll("li:not(.buttonoff)"))
      .map(node => node.id)
      .sort();
    layersPreset.add(new Option(preset, preset, false, true));
    localStorage.setItem("presets", JSON.stringify(presets));
    localStorage.setItem("preset", preset);
    removePresetButton.style.display = "inline-block";
    savePresetButton.style.display = "none";
  });
}

function removePreset() {
  const preset = layersPreset.value;
  delete presets[preset];
  const index = Array.from(layersPreset.options).findIndex(o => o.value === preset);
  layersPreset.options.remove(index);
  layersPreset.value = "custom";
  removePresetButton.style.display = "none";
  savePresetButton.style.display = "inline-block";

  store("presets", JSON.stringify(presets));
  localStorage.removeItem("preset");
}

// run on map regeneration
export function restoreLayers() {
  if (layerIsOn("toggleHeight")) drawHeightmap();
  if (layerIsOn("toggleCells")) drawCells();
  if (layerIsOn("toggleGrid")) drawGrid();
  if (layerIsOn("toggleCoordinates")) drawCoordinates();
  if (layerIsOn("toggleCompass")) compass.style("display", "block");
  if (layerIsOn("toggleTemp")) drawTemp();
  if (layerIsOn("togglePrec")) drawPrec();
  if (layerIsOn("togglePopulation")) drawPopulation();
  if (layerIsOn("toggleBiomes")) drawBiomes();
  if (layerIsOn("toggleRelief")) ReliefIcons();
  if (layerIsOn("toggleCultures")) drawCultures();
  if (layerIsOn("toggleProvinces")) drawProvinces();
  if (layerIsOn("toggleReligions")) drawReligions();
  if (layerIsOn("toggleIce")) drawIce();
  if (layerIsOn("toggleEmblems")) drawEmblems();
  if (layerIsOn("toggleMarkers")) drawMarkers();

  // some layers are rendered each time, remove them if they are not on
  if (!layerIsOn("toggleBorders")) borders.selectAll("path").remove();
  if (!layerIsOn("toggleStates")) regions.selectAll("path").remove();
  if (!layerIsOn("toggleRivers")) rivers.selectAll("*").remove();
}

export function updatePresetInput() {
  const $toggledOnLayers = byId("mapLayers").querySelectorAll("li:not(.buttonoff)");
  const currentLayers = Array.from($toggledOnLayers)
    .map(node => node.id)
    .sort();

  for (const preset in presets) {
    if (JSON.stringify(presets[preset].sort()) !== JSON.stringify(currentLayers)) continue;

    byId("layersPreset").value = preset;
    byId("removePresetButton").style.display = defaultPresets[preset] ? "none" : "inline-block";
    byId("savePresetButton").style.display = "none";
    return;
  }

  byId("layersPreset").value = "custom";
  byId("removePresetButton").style.display = "none";
  byId("savePresetButton").style.display = "inline-block";
}
