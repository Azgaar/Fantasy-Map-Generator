import { setViewSessionLayerVisibility } from "@/application/view-session-state";
import { getWorkspaceMode, requireWorkspaceCapability } from "@/application/workspace-mode";
import { tip } from "@/components/tooltips";
import type { MapLayerId } from "@/renderers/core/layer-registry";
import { MAP_LAYER_REGISTRY, normalizeMapLayerOrder, resolveMapLayerOrder } from "@/renderers/core/layer-registry";
import { drawGoods } from "@/renderers/draw-goods";
import { drawMarkets } from "@/renderers/draw-markets";
import {
  invalidatePixiRendererLayer,
  queuePixiRendererRebuild,
  setPixiRendererLayerOrder
} from "@/renderers/pixi/pixi-renderer-controller";
import type { PixiOwnedLayer } from "@/renderers/pixi/pixi-renderer-ownership";
import { getMapRendererStyle } from "@/renderers/scene/map-style-state";
import { notifyMapMutation } from "@/services/map-mutation";
import { ensureEl, findEl } from "@/utils";
import { enableVerticalSortable } from "../dialog/vertical-sortable";
import {
  bindLayerControls,
  LAYER_CONTROLS_CHANGE_EVENT,
  LayerControls,
  type LayerControlsSnapshot,
  type LayerPresetOption,
  type LegacyLayerControls
} from "./layer-controls";

type LayerToggleId = keyof typeof PIXI_LAYER_BY_TOGGLE | "toggleRulers" | "toggleScaleBar" | "toggleVignette";
type LayerPresetMap = Record<string, LayerToggleId[]>;

const DEFAULT_PRESETS = {
  political: [
    "toggleBorders",
    "toggleBurgIcons",
    "toggleIce",
    "toggleLabels",
    "toggleLakes",
    "toggleRivers",
    "toggleRoutes",
    "toggleScaleBar",
    "toggleStates",
    "toggleVignette"
  ],
  cultural: [
    "toggleBorders",
    "toggleBurgIcons",
    "toggleCultures",
    "toggleLabels",
    "toggleLakes",
    "toggleRivers",
    "toggleRoutes",
    "toggleScaleBar",
    "toggleVignette"
  ],
  religions: [
    "toggleBorders",
    "toggleBurgIcons",
    "toggleLabels",
    "toggleLakes",
    "toggleReligions",
    "toggleRivers",
    "toggleRoutes",
    "toggleScaleBar",
    "toggleVignette"
  ],
  provinces: [
    "toggleBorders",
    "toggleBurgIcons",
    "toggleLabels",
    "toggleLakes",
    "toggleProvinces",
    "toggleRivers",
    "toggleScaleBar",
    "toggleVignette"
  ],
  biomes: ["toggleBiomes", "toggleIce", "toggleLakes", "toggleRivers", "toggleScaleBar", "toggleVignette"],
  heightmap: ["toggleHeight", "toggleLakes", "toggleRivers", "toggleVignette"],
  physical: [
    "toggleCoordinates",
    "toggleHeight",
    "toggleIce",
    "toggleLakes",
    "toggleRivers",
    "toggleScaleBar",
    "toggleVignette"
  ],
  poi: [
    "toggleBorders",
    "toggleBurgIcons",
    "toggleHeight",
    "toggleIce",
    "toggleLakes",
    "toggleMarkers",
    "toggleRivers",
    "toggleRoutes",
    "toggleScaleBar",
    "toggleVignette"
  ],
  goods: [
    "toggleBorders",
    "toggleBurgIcons",
    "toggleCells",
    "toggleGoods",
    "toggleMarketsLayer",
    "toggleLakes",
    "toggleRivers",
    "toggleRoutes",
    "toggleScaleBar",
    "toggleTrade",
    "toggleVignette"
  ],
  trade: [
    "toggleBorders",
    "toggleBurgIcons",
    "toggleLakes",
    "toggleRivers",
    "toggleRoutes",
    "toggleScaleBar",
    "toggleStates",
    "toggleTrade",
    "toggleVignette"
  ],
  military: [
    "toggleBorders",
    "toggleBurgIcons",
    "toggleLabels",
    "toggleLakes",
    "toggleMilitary",
    "toggleRivers",
    "toggleRoutes",
    "toggleScaleBar",
    "toggleStates",
    "toggleVignette"
  ],
  emblems: [
    "toggleBorders",
    "toggleBurgIcons",
    "toggleIce",
    "toggleEmblems",
    "toggleLakes",
    "toggleRivers",
    "toggleRoutes",
    "toggleScaleBar",
    "toggleStates",
    "toggleVignette"
  ],
  landmass: ["toggleScaleBar"]
} as const satisfies Record<string, readonly LayerToggleId[]>;

const PIXI_LAYER_BY_TOGGLE = {
  toggleBiomes: "biomes",
  toggleBorders: "borders",
  toggleBurgIcons: "burgIcons",
  toggleCells: "cells",
  toggleCompass: "compass",
  toggleCoordinates: "coordinates",
  toggleCultures: "cultures",
  toggleEmblems: "emblems",
  toggleGoods: "goods",
  toggleGrid: "grid",
  toggleHeight: "height",
  toggleIce: "ice",
  toggleLabels: "labels",
  toggleLakes: "lakes",
  toggleMarkers: "markers",
  toggleMarketsLayer: "markets",
  toggleMilitary: "military",
  togglePopulation: "population",
  togglePrecipitation: "precipitation",
  toggleProvinces: "provinces",
  toggleRelief: "relief",
  toggleReligions: "religions",
  toggleRivers: "rivers",
  toggleRoutes: "routes",
  toggleStates: "states",
  toggleTemperature: "temperature",
  toggleTrade: "trade",
  toggleZones: "zones"
} as const satisfies Record<string, PixiOwnedLayer>;

const STYLE_TARGET_BY_TOGGLE: Partial<Record<LayerToggleId, string>> = {
  toggleBiomes: "biomes",
  toggleBorders: "borders",
  toggleCells: "cells",
  toggleCompass: "compass",
  toggleCoordinates: "coordinates",
  toggleCultures: "cults",
  toggleEmblems: "emblems",
  toggleGrid: "gridOverlay",
  toggleGoods: "goodsIcons",
  toggleHeight: "terrs",
  toggleIce: "ice",
  toggleLabels: "labels",
  toggleLakes: "lakes",
  toggleMilitary: "armies",
  toggleMarketsLayer: "markets",
  togglePopulation: "population",
  togglePrecipitation: "prec",
  toggleProvinces: "provs",
  toggleRelief: "terrain",
  toggleReligions: "relig",
  toggleRivers: "rivers",
  toggleRoutes: "routes",
  toggleRulers: "ruler",
  toggleScaleBar: "scaleBar",
  toggleStates: "regions",
  toggleTemperature: "temperature",
  toggleTrade: "tradeAnimation",
  toggleVignette: "vignette",
  toggleZones: "zones"
};

const SVG_LAYER_BY_TOGGLE: Partial<Record<LayerToggleId, string>> = {
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
  toggleLabels: "labels",
  toggleLakes: "lakes",
  toggleMilitary: "armies",
  togglePopulation: "population",
  togglePrecipitation: "prec",
  toggleProvinces: "provs",
  toggleRelief: "terrain",
  toggleReligions: "relig",
  toggleRivers: "rivers",
  toggleRoutes: "routes",
  toggleRulers: "ruler",
  toggleStates: "regions",
  toggleTemperature: "temperature",
  toggleTrade: "tradeAnimation",
  toggleZones: "zones"
};

let presets: LayerPresetMap = cloneDefaultPresets();
let initialized = false;
let layerOrder: LayerToggleId[] = [];
let presetOptions: LayerPresetOption[] = [];
let presetSelectionDisabled = false;
let selectedPreset = "political";

export function initializeLayerControlsRuntime(): void {
  if (initialized) return;
  initialized = true;
  initializePresetStateFromDom();
  restoreCustomPresets();
  syncLayerOrderFromDom();
  syncRendererLayerOrder();
  enableVerticalSortable({
    container: ensureEl("mapLayers"),
    handleSelector: ".fantasia-layer-row__handle",
    itemSelector: "li:not(.solid)",
    onUpdate: item => {
      syncLayerOrderFromDom();
      moveSvgLayerById(item.id, item.previousElementSibling?.id, item.nextElementSibling?.id);
      syncRendererLayerOrder();
      if (getWorkspaceMode() === "edit") {
        style.mapLayerOrder = getMapLayerOrder();
        notifyMapMutation("layer-order");
      }
      notifyLayerControlsChanged();
    }
  });
  bindLayerControlEvents();

  const controls: LegacyLayerControls = {
    applyPreset: handleLayersPresetChange,
    drawActiveLayers,
    getLayerOrder: getMapLayerOrder,
    getSnapshot: getLayerControlsSnapshot,
    isLayerOn,
    moveLayer: moveLayerById,
    redrawLayer,
    removePreset,
    restoreSavedPreset: applySavedPreset,
    savePreset: savePresetByName,
    setLayerOrder: restoreMapLayerOrder,
    setPresetState,
    setLayerVisibility: setLayerButtonVisibility,
    syncPreset,
    toggleLayer(id, modifiers = {}) {
      if (!isLayerToggleId(id)) return false;
      return toggleLayer(id, new MouseEvent("click", modifiers));
    }
  };
  bindLayerControls(controls);
  window.LayerControls = LayerControls;
}

function bindLayerControlEvents(): void {
  ensureEl("mapLayers").addEventListener("click", event => {
    const layer = (event.target as Element).closest<HTMLElement>("li");
    if (!layer || !isLayerToggleId(layer.id)) return;
    toggleLayer(layer.id, event);
  });
  ensureEl<HTMLSelectElement>("layersPreset").addEventListener("change", event => {
    handleLayersPresetChange((event.currentTarget as HTMLSelectElement).value);
  });
  ensureEl("savePresetButton").addEventListener("click", promptAndSavePreset);
  ensureEl("removePresetButton").addEventListener("click", removePreset);
}

export function isLayerOn(id: string): boolean {
  const control = findEl(id);
  return Boolean(control && !control.classList.contains("buttonoff"));
}

export function setLayerButtonVisibility(id: string, visible: boolean): void {
  ensureEl(id).classList.toggle("buttonoff", !visible);
  if (getWorkspaceMode() === "view") setViewSessionLayerVisibility(id, visible);
  else persistLayerVisibility(id, visible);
  getCurrentPreset();
  ViewportLayers.invalidateAll();
  notifyLayerControlsChanged();
}

export function drawActiveLayers(): void {
  const measure = (name: string, action: () => void): void => {
    if (window.MapPerformance) window.MapPerformance.measure(`render:${name}`, action);
    else action();
  };
  const draw = (): void => {
    measure("features", window.drawFeatures);
    for (const id of Object.keys(PIXI_LAYER_BY_TOGGLE) as (keyof typeof PIXI_LAYER_BY_TOGGLE)[]) {
      if (id === "toggleLabels" || id === "toggleRelief") continue;
      if (!isLayerOn(id)) continue;
      const action = getRedrawAction(id);
      measure(PIXI_LAYER_BY_TOGGLE[id], action);
    }
    measure("relief", window.drawRelief);
    measure("labels", window.drawLabels);
    if (isLayerOn("toggleRulers")) measure("rulers", window.drawMeasurers);
  };
  if (window.MapPerformance) window.MapPerformance.measure("render:total", draw);
  else draw();
  queuePixiRendererRebuild();
}

function toggleLayer(id: LayerToggleId, event?: Event): boolean {
  if (id === "toggleHeight" && customization === 1) {
    tip("You cannot turn off the layer when heightmap is in edit mode", false, "error");
    return false;
  }

  const ctrlClick = event instanceof MouseEvent && isCtrlClick(event);
  if (isLayerOn(id)) {
    if (ctrlClick) {
      openLayerStyle(id);
      return true;
    }
    disableLayer(id);
    return true;
  }

  setLayerButtonVisibility(id, true);
  enableLayer(id);
  if (ctrlClick) openLayerStyle(id);
  return true;
}

function enableLayer(id: LayerToggleId): void {
  if (id === "toggleScaleBar" || id === "toggleVignette") {
    const target = id === "toggleScaleBar" ? "scaleBar" : "vignette";
    ensureEl(target).style.display = "";
    return;
  }
  if (id === "toggleRulers") {
    window.drawMeasurers();
    ensureEl("ruler").style.display = "";
    return;
  }
  getRedrawAction(id)();
}

function disableLayer(id: LayerToggleId): void {
  if (id === "toggleTrade") getTradeAnimation()?.stop();
  if (id === "toggleRulers") {
    ensureEl("ruler").replaceChildren();
    ensureEl("ruler").style.display = "none";
  }
  if (id === "toggleScaleBar" || id === "toggleVignette") {
    const target = id === "toggleScaleBar" ? "scaleBar" : "vignette";
    ensureEl(target).style.display = "none";
  }
  if (id === "toggleCells") window.ViewportCells?.clear();
  setLayerButtonVisibility(id, false);
}

function openLayerStyle(id: LayerToggleId): void {
  if (!requireWorkspaceCapability("map:edit")) return;
  const target = STYLE_TARGET_BY_TOGGLE[id];
  if (target) window.StyleEditor.edit(target);
  else if (id === "toggleMarkers" || id === "toggleBurgIcons") {
    tip(`${id === "toggleMarkers" ? "Markers" : "Burg symbols"} now use semantic Pixi styles`, false, "warn");
  }
}

function getRedrawAction(id: keyof typeof PIXI_LAYER_BY_TOGGLE): () => void {
  switch (id) {
    case "toggleBiomes":
      return window.drawBiomes;
    case "toggleBorders":
      return window.drawBorders;
    case "toggleCells":
      return drawCells;
    case "toggleCoordinates":
      return drawCoordinates;
    case "toggleCultures":
      return drawCultures;
    case "toggleEmblems":
      return window.drawEmblems;
    case "toggleGoods":
      return drawGoods;
    case "toggleGrid":
      return drawGrid;
    case "toggleHeight":
      return window.drawHeightmap;
    case "toggleLabels":
      return window.drawLabels;
    case "toggleMarketsLayer":
      return drawMarkets;
    case "togglePopulation":
      return drawPopulation;
    case "togglePrecipitation":
      return drawPrecipitation;
    case "toggleProvinces":
      return drawProvinces;
    case "toggleRelief":
      return window.drawRelief;
    case "toggleReligions":
      return drawReligions;
    case "toggleRivers":
      return drawRivers;
    case "toggleRoutes":
      return drawRoutes;
    case "toggleStates":
      return drawStates;
    case "toggleTemperature":
      return window.drawTemperature;
    case "toggleTrade":
      return () => {
        invalidatePixiRendererLayer("trade");
        getTradeAnimation()?.start();
      };
    case "toggleZones":
      return drawZones;
    default:
      return () => invalidatePixiRendererLayer(PIXI_LAYER_BY_TOGGLE[id]);
  }
}

function redrawLayer(id: string): boolean {
  if (!isLayerToggleId(id) || !(id in PIXI_LAYER_BY_TOGGLE)) return false;
  getRedrawAction(id as keyof typeof PIXI_LAYER_BY_TOGGLE)();
  return true;
}

function drawCells(): void {
  if (customization === 1 && window.ViewportCells) {
    window.ViewportCells.draw();
    return;
  }
  window.ViewportCells?.clear();
  invalidatePixiRendererLayer("cells");
}

function drawGrid(): void {
  invalidatePixiRendererLayer("grid");
}

function drawZones(): void {
  const filterBy = ensureEl<HTMLSelectElement>("zonesFilterType").value;
  const current = getMapRendererStyle(style).zones;
  if (getWorkspaceMode() === "edit") {
    style.mapRenderer!.zones = {
      ...current,
      filterType: filterBy && filterBy !== "all" ? filterBy : null
    };
  }
  invalidatePixiRendererLayer("zones");
}

const drawCoordinates = (): void => invalidatePixiRendererLayer("coordinates");
const drawCultures = (): void => invalidatePixiRendererLayer("cultures");
const drawPopulation = (): void => invalidatePixiRendererLayer("population");
const drawPrecipitation = (): void => invalidatePixiRendererLayer("precipitation");
const drawProvinces = (): void => invalidatePixiRendererLayer("provinces");
const drawReligions = (): void => invalidatePixiRendererLayer("religions");
const drawRivers = (): void => invalidatePixiRendererLayer("rivers");
const drawRoutes = (): void => invalidatePixiRendererLayer("routes");
const drawStates = (): void => invalidatePixiRendererLayer("states");

function applySavedPreset(): void {
  let preset = localStorage.getItem("preset") || selectedPreset;
  if (!presets[preset]) preset = "political";
  setLayersPreset(preset);
  const visible = new Set(presets[preset]);
  for (const layer of ensureEl("mapLayers").querySelectorAll("li")) {
    layer.classList.toggle("buttonoff", !visible.has(layer.id as LayerToggleId));
  }
  notifyLayerControlsChanged();
}

function handleLayersPresetChange(preset: string): void {
  if (presetSelectionDisabled || !presets[preset]) return;
  setLayersPreset(preset);
  const visible = new Set(presets[preset]);
  for (const layer of ensureEl("mapLayers").querySelectorAll("li")) {
    const id = layer.id;
    if (!isLayerToggleId(id)) continue;
    const shouldBeVisible = visible.has(id);
    if (isLayerOn(id) !== shouldBeVisible) toggleLayer(id);
  }
  notifyLayerControlsChanged();
}

function setLayersPreset(preset: string): void {
  selectedPreset = preset;
  syncLegacyPresetControl();
  if (getWorkspaceMode() === "edit") localStorage.setItem("preset", preset);
}

function savePresetByName(name: string): void {
  if (!requireWorkspaceCapability("map:edit")) return;
  const preset = name.trim();
  if (!preset) return;
  presets[preset] = [...ensureEl("mapLayers").querySelectorAll("li:not(.buttonoff)")]
    .map(node => node.id)
    .filter(isLayerToggleId)
    .sort();

  selectedPreset = preset;
  if (!presetOptions.some(option => option.value === preset)) {
    presetOptions.push({ hidden: false, label: preset, value: preset });
  }
  syncLegacyPresetControl();
  localStorage.setItem("presets", JSON.stringify(presets));
  localStorage.setItem("preset", preset);
  notifyLayerControlsChanged();
}

function removePreset(): void {
  if (!requireWorkspaceCapability("map:edit")) return;
  const preset = selectedPreset;
  if (preset === "custom" || DEFAULT_PRESETS[preset as keyof typeof DEFAULT_PRESETS]) return;
  delete presets[preset];
  presetOptions = presetOptions.filter(option => option.value !== preset);
  selectedPreset = "custom";
  syncLegacyPresetControl();
  localStorage.setItem("presets", JSON.stringify(presets));
  localStorage.removeItem("preset");
  notifyLayerControlsChanged();
}

function promptAndSavePreset(): void {
  if (!requireWorkspaceCapability("map:edit")) return;
  const legacyPrompt = window.prompt as unknown as (
    message: string,
    options: { default: string },
    callback: (value: string) => void
  ) => void;
  legacyPrompt("Please provide a preset name", { default: "" }, savePresetByName);
}

function getCurrentPreset(): void {
  const visible = [...document.querySelectorAll("#mapLayers > li:not(.buttonoff)")]
    .map(node => node.id)
    .filter(isLayerToggleId)
    .sort();
  const match = Object.entries(presets).find(([, layers]) => arraysEqual([...layers].sort(), visible));
  selectedPreset = match?.[0] ?? "custom";
  syncLegacyPresetControl();
}

function setPresetState(preset: string, disabled: boolean): void {
  selectedPreset = preset;
  presetSelectionDisabled = disabled;
  syncLegacyPresetControl();
  notifyLayerControlsChanged();
}

function syncPreset(disabled = presetSelectionDisabled): void {
  presetSelectionDisabled = disabled;
  getCurrentPreset();
  notifyLayerControlsChanged();
}

function restoreCustomPresets(): void {
  presets = cloneDefaultPresets();
  let stored: LayerPresetMap | null = null;
  try {
    stored = JSON.parse(localStorage.getItem("presets") || "null") as LayerPresetMap | null;
  } catch {
    localStorage.removeItem("presets");
  }
  if (!stored) return;
  for (const preset of Object.keys(stored)) {
    if (!presets[preset] && !presetOptions.some(option => option.value === preset)) {
      presetOptions.push({ hidden: false, label: preset, value: preset });
    }
  }
  presets = stored;
}

function initializePresetStateFromDom(): void {
  const select = ensureEl<HTMLSelectElement>("layersPreset");
  selectedPreset = select.value;
  presetSelectionDisabled = select.disabled;
  presetOptions = [...select.options].map(option => ({
    hidden: option.hidden,
    label: option.textContent,
    value: option.value
  }));
}

function syncLegacyPresetControl(): void {
  const select = findEl<HTMLSelectElement>("layersPreset");
  if (!select) return;
  select.value = selectedPreset;
  select.disabled = presetSelectionDisabled;
}

function getLayerControlsSnapshot(): LayerControlsSnapshot {
  const controls = new Map(
    [...ensureEl("mapLayers").querySelectorAll<HTMLElement>("li")].map(layer => [layer.id, layer])
  );
  const layers = layerOrder.flatMap(id => {
    const layer = controls.get(id);
    if (!layer) return [];
    return [
      {
        description: layer.dataset.tip || "",
        fixed: layer.classList.contains("solid"),
        id: layer.id,
        label: layer.dataset.layerLabel || layer.textContent?.trim() || layer.id,
        shortcut: layer.dataset.shortcut || "",
        visible: !layer.classList.contains("buttonoff")
      }
    ];
  });
  return {
    canRemovePreset: selectedPreset !== "custom" && !DEFAULT_PRESETS[selectedPreset as keyof typeof DEFAULT_PRESETS],
    canSavePreset: selectedPreset === "custom",
    layers,
    presetOptions: presetOptions.map(option => ({ ...option })),
    presetSelectionDisabled,
    selectedPreset
  };
}

function notifyLayerControlsChanged(): void {
  window.dispatchEvent(new CustomEvent(LAYER_CONTROLS_CHANGE_EVENT, { detail: getLayerControlsSnapshot() }));
}

function moveLayerById(id: string, previousId?: string, nextId?: string): void {
  if (!isLayerToggleId(id)) return;
  const nextOrder = layerOrder.filter(layerId => layerId !== id);
  const previousIndex = previousId ? nextOrder.indexOf(previousId as LayerToggleId) : -1;
  const nextIndex = nextId ? nextOrder.indexOf(nextId as LayerToggleId) : -1;
  const insertionIndex = previousIndex >= 0 ? previousIndex + 1 : nextIndex >= 0 ? nextIndex : nextOrder.length;
  nextOrder.splice(insertionIndex, 0, id);
  layerOrder = nextOrder;
  moveSvgLayerById(id, previousId, nextId);
  syncRendererLayerOrder();
  if (getWorkspaceMode() === "edit") {
    style.mapLayerOrder = getMapLayerOrder();
    notifyMapMutation("layer-order");
  }
  notifyLayerControlsChanged();
}

function moveSvgLayerById(id: string, previousId?: string, nextId?: string): void {
  const layer = getSvgLayer(id);
  if (!layer) return;
  const previous = previousId ? getSvgLayer(previousId) : null;
  const next = nextId ? getSvgLayer(nextId) : null;
  if (previous) previous.after(layer);
  else if (next) next.before(layer);
}

function syncLayerOrderFromDom(): void {
  layerOrder = [...ensureEl("mapLayers").querySelectorAll<HTMLElement>("li")]
    .map(layer => layer.id)
    .filter(isLayerToggleId);
}

function syncRendererLayerOrder(): void {
  setPixiRendererLayerOrder(getMapLayerOrder());
}

function getMapLayerOrder(): MapLayerId[] {
  return resolveMapLayerOrder(layerOrder);
}

function restoreMapLayerOrder(order: readonly MapLayerId[]): void {
  const controlByLayer = new Map(
    MAP_LAYER_REGISTRY.flatMap(layer => (layer.controlId ? [[layer.id, layer.controlId] as const] : []))
  );
  const requested = normalizeMapLayerOrder(order).flatMap(layer => {
    const controlId = controlByLayer.get(layer);
    return controlId && isLayerToggleId(controlId) ? [controlId] : [];
  });
  const requestedSet = new Set(requested);
  layerOrder = [...requested, ...layerOrder.filter(controlId => !requestedSet.has(controlId))];

  const container = ensureEl("mapLayers");
  for (const controlId of layerOrder) {
    const element = document.getElementById(controlId);
    if (element?.parentElement === container) container.appendChild(element);
  }
  syncRendererLayerOrder();
  notifyLayerControlsChanged();
}

function persistLayerVisibility(id: string, visible: boolean): void {
  const layer = PIXI_LAYER_BY_TOGGLE[id as keyof typeof PIXI_LAYER_BY_TOGGLE] as MapLayerId | undefined;
  if (!layer) return;
  style.mapLayerVisibility = { ...style.mapLayerVisibility, [layer]: visible };
  notifyMapMutation("layer-visibility");
}

function getSvgLayer(id: string): Element | null {
  return isLayerToggleId(id) ? document.getElementById(SVG_LAYER_BY_TOGGLE[id] || "") : null;
}

function getTradeAnimation(): { start: () => void; stop: () => void } | undefined {
  return (window as unknown as { TradeAnimation?: { start: () => void; stop: () => void } }).TradeAnimation;
}

function isLayerToggleId(value: string): value is LayerToggleId {
  return (
    value in PIXI_LAYER_BY_TOGGLE ||
    value === "toggleRulers" ||
    value === "toggleScaleBar" ||
    value === "toggleVignette"
  );
}

function cloneDefaultPresets(): LayerPresetMap {
  return Object.fromEntries(Object.entries(DEFAULT_PRESETS).map(([name, layers]) => [name, [...layers]]));
}

function arraysEqual(first: readonly string[], second: readonly string[]): boolean {
  return first.length === second.length && first.every((value, index) => value === second[index]);
}
