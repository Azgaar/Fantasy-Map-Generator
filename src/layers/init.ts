import {getInputValue, setInputValue} from "utils/nodeUtils";
import {stored, byId, store} from "utils/shorthands";
import {renderLayer} from "./renderers";
import {toggleLayerOnClick} from "./toggles";
import {layerIsOn} from "./utils";
import {prompt} from "scripts/prompt";

export function initLayers() {
  restoreCustomPresets();
  applyPreset();
  addLayerListeners();
}

let presets: Dict<string[]> = {};

const defaultPresets = {
  political: [
    "toggleBorders",
    "toggleBurgs",
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
    "toggleBurgs",
    "toggleLabels",
    "toggleRivers",
    "toggleRoutes",
    "toggleScaleBar"
  ],
  religions: [
    "toggleBorders",
    "toggleBurgs",
    "toggleLabels",
    "toggleReligions",
    "toggleRivers",
    "toggleRoutes",
    "toggleScaleBar"
  ],
  provinces: ["toggleBorders", "toggleBurgs", "toggleProvinces", "toggleRivers", "toggleScaleBar"],
  biomes: ["toggleBiomes", "toggleIce", "toggleRivers", "toggleScaleBar"],
  heightmap: ["toggleHeight", "toggleRivers"],
  physical: ["toggleCoordinates", "toggleHeight", "toggleIce", "toggleRivers", "toggleScaleBar"],
  poi: [
    "toggleBorders",
    "toggleHeight",
    "toggleIce",
    "toggleBurgs",
    "toggleMarkers",
    "toggleRivers",
    "toggleRoutes",
    "toggleScaleBar"
  ],
  military: [
    "toggleBorders",
    "toggleBurgs",
    "toggleLabels",
    "toggleMilitary",
    "toggleRivers",
    "toggleRoutes",
    "toggleScaleBar",
    "toggleStates"
  ],
  emblems: [
    "toggleBorders",
    "toggleBurgs",
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
    (byId("layersPreset") as HTMLSelectElement)?.add(new Option(preset, preset));
  }

  presets = storedPresets;
}

function addLayerListeners() {
  byId("mapLayers")?.on("click", toggleLayerOnClick);
  byId("savePresetButton")?.on("click", savePreset);
  byId("removePresetButton")?.on("click", removePreset);

  // allow to move layers by dragging layer button (jquery)
  $("#mapLayers").sortable({items: "li:not(.solid)", containment: "parent", cancel: ".solid", update: moveLayer});
}

// connection between option layer buttons and actual svg groups to move the element
const layerButtonToElementMap: Dict<string> = {
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
  toggleBurgs: "icons",
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

function moveLayer(_event: Event, layer: JQueryUI.SortableUIParams) {
  const getLayer = (buttonId: string) => $("#" + layerButtonToElementMap[buttonId]);
  const layerId = getLayer(layer.item.attr("id") || "");
  if (!layerId) return;

  const prev = getLayer(layer.item.prev().attr("id") || "");
  const next = getLayer(layer.item.next().attr("id") || "");

  if (prev) layer.item.insertAfter(prev);
  else if (next) layer.item.insertBefore(next);
}

// run on map generation
function applyPreset() {
  const preset = stored("preset") || getInputValue("layersPreset") || "political";
  changePreset(preset);
}

// toggle layers on preset change
function changePreset(preset: string) {
  const layers = presets[preset]; // layers to be turned on
  const $layerButtons = byId("mapLayers")?.querySelectorAll("li")!;

  $layerButtons.forEach(function ($layerButton) {
    const {id} = $layerButton;
    if (layers.includes(id) && !layerIsOn(id)) $layerButton.click();
    else if (!layers.includes(id) && layerIsOn(id)) $layerButton.click();
  });

  setInputValue("layersPreset", preset);
  store("preset", preset);

  const isDefault = preset in defaultPresets;

  const $removeButton = byId("removePresetButton")!;
  const $saveButton = byId("savePresetButton")!;

  $removeButton.style.display = isDefault ? "none" : "inline-block";
  $saveButton.style.display = "none";

  if (byId("canvas3d")) setTimeout(window.ThreeD.update(), 400);
}

function savePreset() {
  prompt("Please provide a preset name", {default: ""}, returned => {
    const preset = String(returned);
    presets[preset] = Array.from(byId("mapLayers")?.querySelectorAll("li:not(.buttonoff)") || [])
      .map(node => node.id)
      .sort();

    (byId("layersPreset") as HTMLSelectElement)?.add(new Option(preset, preset, false, true));
    localStorage.setItem("presets", JSON.stringify(presets));
    localStorage.setItem("preset", preset);
    byId("removePresetButton")!.style.display = "inline-block";
    byId("savePresetButton")!.style.display = "none";
  });
}

function removePreset() {
  const $layersPreset = byId("layersPreset") as HTMLSelectElement;
  const preset = $layersPreset.value;
  delete presets[preset];
  const index = Array.from($layersPreset.options).findIndex(option => option.value === preset);
  $layersPreset.options.remove(index);
  $layersPreset.value = "custom";

  byId("removePresetButton")!.style.display = "none";
  byId("savePresetButton")!.style.display = "inline-block";

  store("presets", JSON.stringify(presets));
  localStorage.removeItem("preset");
}

// run on map regeneration
export function restoreLayers() {
  if (layerIsOn("toggleHeight")) renderLayer("heightmap");
  if (layerIsOn("toggleCells")) renderLayer("cells");
  if (layerIsOn("toggleGrid")) renderLayer("grid");
  if (layerIsOn("toggleCoordinates")) renderLayer("coordinates");
  if (layerIsOn("toggleCompass")) compass.style("display", "block");
  if (layerIsOn("toggleTemp")) renderLayer("temperature");
  if (layerIsOn("togglePrec")) renderLayer("precipitation");
  if (layerIsOn("togglePopulation")) renderLayer("population");
  if (layerIsOn("toggleBiomes")) renderLayer("biomes");
  if (layerIsOn("toggleRelief")) window.ReliefIcons();
  if (layerIsOn("toggleCultures")) renderLayer("cultures");
  if (layerIsOn("toggleProvinces")) renderLayer("provinces");
  if (layerIsOn("toggleReligions")) renderLayer("religions");
  if (layerIsOn("toggleIce")) renderLayer("ice");
  if (layerIsOn("toggleEmblems")) renderLayer("emblems");
  if (layerIsOn("toggleMarkers")) renderLayer("markers");

  // some layers are rendered each time, remove them if they are not on
  if (!layerIsOn("toggleBorders")) borders.selectAll("path").remove();
  if (!layerIsOn("toggleStates")) regions.selectAll("path").remove();
  if (!layerIsOn("toggleRivers")) rivers.selectAll("*").remove();
}

export function updatePresetInput() {
  const $toggledOnLayers = byId("mapLayers")?.querySelectorAll("li:not(.buttonoff)");
  const currentLayers = Array.from($toggledOnLayers || [])
    .map(node => node.id)
    .sort();

  for (const preset in presets) {
    if (JSON.stringify(presets[preset].sort()) !== JSON.stringify(currentLayers)) continue;

    setInputValue("layersPreset", preset);
    byId("removePresetButton")!.style.display = preset in defaultPresets ? "none" : "inline-block";
    byId("savePresetButton")!.style.display = "none";
    return;
  }

  setInputValue("layersPreset", "custom");
  byId("removePresetButton")!.style.display = "none";
  byId("savePresetButton")!.style.display = "inline-block";
}
