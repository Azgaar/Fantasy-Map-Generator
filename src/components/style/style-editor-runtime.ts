import { interpolateRgb, interpolateRgbBasis, type Selection, scaleSequential, select } from "d3";
import { getViewportSurface } from "@/application/viewport-surface";
import { OptionsController } from "@/components/options/options-controller";
import { tip } from "@/components/tooltips";
import { redrawLegend } from "@/renderers/draw-legend";
import { drawMeasurers } from "@/renderers/draw-measurers";
import { drawRelief } from "@/renderers/draw-relief-icons";
import { drawScaleBar, fitScaleBar } from "@/renderers/draw-scalebar";
import { drawLabels } from "@/renderers/labels/labels-renderer";
import {
  addCustomHeightColorScheme,
  getHeightColorScheme,
  HEIGHT_COLOR_SCHEMES
} from "@/renderers/scene/height-color-schemes";
import type { MapStyle, SemanticLineStyle } from "@/renderers/scene/styles";
import type { ReliefSet } from "@/types/relief";
import { toHEX } from "@/utils/colorUtils";
import { drawHeights } from "@/utils/graphUtils";
import { ensureEl } from "@/utils/nodeUtils";
import { lock } from "@/utils/preferences";

interface StyleValueElement extends HTMLElement {
  get value(): string;
  set value(value: string | number);
  addEventListener<K extends keyof HTMLElementEventMap>(
    type: K,
    listener: (this: StyleValueElement, event: HTMLElementEventMap[K]) => unknown,
    options?: boolean | AddEventListenerOptions
  ): void;
}

interface StyleCheckboxElement extends StyleValueElement {
  checked: boolean;
  addEventListener<K extends keyof HTMLElementEventMap>(
    type: K,
    listener: (this: StyleCheckboxElement, event: HTMLElementEventMap[K]) => unknown,
    options?: boolean | AddEventListenerOptions
  ): void;
}

export interface StyleEditorApi {
  calculateFriendlyGridSize: () => void;
  changeFont: () => void;
  edit: (element: string, group?: string) => void;
  refresh: () => void;
  updateTextureSelectValue: (href: string) => void;
}

const valueElement = (id: string): StyleValueElement => ensureEl<StyleValueElement>(id);
const checkboxElement = (id: string): StyleCheckboxElement => ensureEl<StyleCheckboxElement>(id);
const eventValue = (event: Event): string => (event.currentTarget as StyleValueElement).value;
const eventChecked = (event: Event): boolean => (event.currentTarget as StyleCheckboxElement).checked;

const styleElements = ensureEl<HTMLTableElement>("styleElements");
const styleTab = ensureEl<HTMLButtonElement>("styleTab");
const styleElementSelect = ensureEl<HTMLSelectElement>("styleElementSelect");
const styleGroupSelect = ensureEl<HTMLSelectElement>("styleGroupSelect");
const styleTextureInput = ensureEl<HTMLSelectElement>("styleTextureInput");
const styleHeightmapCurve = ensureEl<HTMLSelectElement>("styleHeightmapCurve");
const styleHeightmapScheme = ensureEl<HTMLSelectElement>("styleHeightmapScheme");
const styleDisplayInput = ensureEl<HTMLSelectElement>("styleDisplayInput");
const styleFilterInput = ensureEl<HTMLSelectElement>("styleFilterInput");
const styleStatesBodyFilter = ensureEl<HTMLSelectElement>("styleStatesBodyFilter");
const styleScaleBarBackgroundFilter = ensureEl<HTMLSelectElement>("styleScaleBarBackgroundFilter");
const styleGridType = ensureEl<HTMLSelectElement>("styleGridType");
const styleReliefSet = ensureEl<HTMLSelectElement>("styleReliefSet");
const styleVignettePreset = ensureEl<HTMLSelectElement>("styleVignettePreset");
const styleOceanPattern = ensureEl<HTMLSelectElement>("styleOceanPattern");
const outlineLayers = ensureEl<HTMLSelectElement>("outlineLayers");
const styleBurgIconsIcon = ensureEl<HTMLSelectElement>("styleBurgIconsIcon");
const styleBurgIconsStrokeLinejoin = ensureEl<HTMLSelectElement>("styleBurgIconsStrokeLinejoin");
const styleStrokeLinecapInput = ensureEl<HTMLSelectElement>("styleStrokeLinecapInput");
const styleSelectFont = ensureEl<HTMLSelectElement>("styleSelectFont");
const styleClippingInput = ensureEl<HTMLSelectElement>("styleClippingInput");
const addFontMethod = ensureEl<HTMLSelectElement>("addFontMethod");

const styleHeightmapRenderOcean = checkboxElement("styleHeightmapRenderOcean");
const styleRescaleMarkers = checkboxElement("styleRescaleMarkers");
const hideEmblems = checkboxElement("hideEmblems");
const styleGoodsCircle = checkboxElement("styleGoodsCircle");

const containerIds = [
  "styleIsOff",
  "styleGroup",
  "styleHeightmap",
  "styleHeightmapRenderOceanOption",
  "styleOpacity",
  "styleLegend",
  "stylePopulation",
  "styleTexture",
  "styleVignette",
  "styleOcean",
  "styleBurgIcons",
  "styleGrid",
  "styleCompass",
  "styleRelief",
  "styleFill",
  "styleStroke",
  "styleStrokeWidth",
  "styleLetterSpacing",
  "styleStrokeDash",
  "styleShadow",
  "styleFont",
  "styleSize",
  "styleFontShift",
  "styleTemperature",
  "styleStates",
  "styleArmies",
  "styleEmblems",
  "styleGoods",
  "styleGoodsBurgs",
  "styleMarketsLayer",
  "styleFilter",
  "styleClipping",
  "styleMarkers",
  "styleScaleBar",
  "mapFilters"
] as const;
const containers = Object.fromEntries(containerIds.map(id => [id, ensureEl<HTMLElement>(id)])) as Record<
  (typeof containerIds)[number],
  HTMLElement
>;
const {
  styleIsOff,
  styleGroup,
  styleHeightmap,
  styleHeightmapRenderOceanOption,
  styleOpacity,
  styleLegend,
  stylePopulation,
  styleTexture,
  styleVignette,
  styleOcean,
  styleBurgIcons,
  styleGrid,
  styleCompass,
  styleRelief,
  styleFill,
  styleStroke,
  styleStrokeWidth,
  styleLetterSpacing,
  styleStrokeDash,
  styleShadow,
  styleFont,
  styleSize,
  styleFontShift,
  styleTemperature,
  styleStates,
  styleArmies,
  styleEmblems,
  styleGoods,
  styleGoodsBurgs,
  styleMarketsLayer,
  styleFilter,
  styleClipping,
  styleMarkers,
  styleScaleBar,
  mapFilters
} = containers;

const valueIds = [
  "styleHeightmapTerracing",
  "styleHeightmapSkip",
  "styleHeightmapSimplification",
  "styleOpacityInput",
  "styleLegendColItems",
  "styleLegendBack",
  "styleLegendBackOutput",
  "styleLegendOpacity",
  "stylePopulationRuralStrokeInput",
  "stylePopulationRuralStrokeOutput",
  "stylePopulationUrbanStrokeInput",
  "stylePopulationUrbanStrokeOutput",
  "styleTextureShiftX",
  "styleTextureShiftY",
  "styleVignetteX",
  "styleVignetteWidth",
  "styleVignetteY",
  "styleVignetteHeight",
  "styleVignetteRx",
  "styleVignetteRy",
  "styleVignetteBlur",
  "styleOceanPatternOpacity",
  "styleOceanFill",
  "styleOceanFillOutput",
  "styleBurgIconsIconSize",
  "styleBurgIconsFillOpacity",
  "styleGridScale",
  "styleGridSizeFriendly",
  "styleGridShiftX",
  "styleGridShiftY",
  "styleCompassSizeInput",
  "styleCompassShiftX",
  "styleCompassShiftY",
  "styleReliefSize",
  "styleReliefDensity",
  "styleFillInput",
  "styleFillOutput",
  "styleStrokeInput",
  "styleStrokeOutput",
  "styleStrokeWidthInput",
  "styleLetterSpacingInput",
  "styleStrokeDasharrayInput",
  "styleShadowInput",
  "styleFontSize",
  "styleFontShiftX",
  "styleFontShiftY",
  "styleTemperatureFillOpacityInput",
  "styleTemperatureFontSizeInput",
  "styleTemperatureFillInput",
  "styleTemperatureFillOutput",
  "styleStatesBodyOpacity",
  "styleStatesHaloWidth",
  "styleStatesHaloOpacity",
  "styleStatesHaloBlur",
  "styleArmiesFillOpacity",
  "styleArmiesSize",
  "emblemsStateSizeInput",
  "emblemsProvinceSizeInput",
  "emblemsBurgSizeInput",
  "styleGoodsSize",
  "styleGoodsBurgsSize",
  "styleMarketsLayerFillOpacity",
  "styleMarketsSize",
  "styleMarketsIconSize",
  "styleScaleBarSize",
  "styleScaleBarFontSize",
  "styleScaleBarPositionX",
  "styleScaleBarPositionY",
  "styleScaleBarLabel",
  "styleScaleBarBackgroundOpacity",
  "styleScaleBarBackgroundFill",
  "styleScaleBarBackgroundFillOutput",
  "styleScaleBarBackgroundStroke",
  "styleScaleBarBackgroundStrokeOutput",
  "styleScaleBarBackgroundStrokeWidth",
  "styleScaleBarBackgroundPaddingTop",
  "styleScaleBarBackgroundPaddingRight",
  "styleScaleBarBackgroundPaddingBottom",
  "styleScaleBarBackgroundPaddingLeft",
  "addFontNameInput",
  "addFontURLInput"
] as const;
const valueElements = Object.fromEntries(valueIds.map(id => [id, valueElement(id)])) as Record<
  (typeof valueIds)[number],
  StyleValueElement
>;
const {
  styleHeightmapTerracing,
  styleHeightmapSkip,
  styleHeightmapSimplification,
  styleOpacityInput,
  styleLegendColItems,
  styleLegendBack,
  styleLegendBackOutput,
  styleLegendOpacity,
  stylePopulationRuralStrokeInput,
  stylePopulationRuralStrokeOutput,
  stylePopulationUrbanStrokeInput,
  stylePopulationUrbanStrokeOutput,
  styleTextureShiftX,
  styleTextureShiftY,
  styleVignetteX,
  styleVignetteWidth,
  styleVignetteY,
  styleVignetteHeight,
  styleVignetteRx,
  styleVignetteRy,
  styleVignetteBlur,
  styleOceanPatternOpacity,
  styleOceanFill,
  styleOceanFillOutput,
  styleBurgIconsIconSize,
  styleBurgIconsFillOpacity,
  styleGridScale,
  styleGridSizeFriendly,
  styleGridShiftX,
  styleGridShiftY,
  styleCompassSizeInput,
  styleCompassShiftX,
  styleCompassShiftY,
  styleReliefSize,
  styleReliefDensity,
  styleFillInput,
  styleFillOutput,
  styleStrokeInput,
  styleStrokeOutput,
  styleStrokeWidthInput,
  styleLetterSpacingInput,
  styleStrokeDasharrayInput,
  styleShadowInput,
  styleFontSize,
  styleFontShiftX,
  styleFontShiftY,
  styleTemperatureFillOpacityInput,
  styleTemperatureFontSizeInput,
  styleTemperatureFillInput,
  styleTemperatureFillOutput,
  styleStatesBodyOpacity,
  styleStatesHaloWidth,
  styleStatesHaloOpacity,
  styleStatesHaloBlur,
  styleArmiesFillOpacity,
  styleArmiesSize,
  emblemsStateSizeInput,
  emblemsProvinceSizeInput,
  emblemsBurgSizeInput,
  styleGoodsSize,
  styleGoodsBurgsSize,
  styleMarketsLayerFillOpacity,
  styleMarketsSize,
  styleMarketsIconSize,
  styleScaleBarSize,
  styleScaleBarFontSize,
  styleScaleBarPositionX,
  styleScaleBarPositionY,
  styleScaleBarLabel,
  styleScaleBarBackgroundOpacity,
  styleScaleBarBackgroundFill,
  styleScaleBarBackgroundFillOutput,
  styleScaleBarBackgroundStroke,
  styleScaleBarBackgroundStrokeOutput,
  styleScaleBarBackgroundStrokeWidth,
  styleScaleBarBackgroundPaddingTop,
  styleScaleBarBackgroundPaddingRight,
  styleScaleBarBackgroundPaddingBottom,
  styleScaleBarBackgroundPaddingLeft,
  addFontNameInput,
  addFontURLInput
} = valueElements;

const styleMarketsIcon = ensureEl<HTMLButtonElement>("styleMarketsIcon");
const styleFontAdd = ensureEl<HTMLButtonElement>("styleFontAdd");
const styleFontPlus = ensureEl<HTMLButtonElement>("styleFontPlus");
const styleFontMinus = ensureEl<HTMLButtonElement>("styleFontMinus");
const openCreateHeightmapSchemeButton = ensureEl<HTMLButtonElement>("openCreateHeightmapSchemeButton");
const styleTextureUrlButton = ensureEl<HTMLButtonElement>("styleTextureUrlButton");

const getMappedValue = <T extends string>(mapping: Record<string, T>, key: string): T | undefined => mapping[key];
const PIXI_STYLE_ELEMENTS = new Set([
  "anchors",
  "armies",
  "biomes",
  "borders",
  "burgIcons",
  "cells",
  "coastline",
  "compass",
  "coordinates",
  "cults",
  "emblems",
  "goodsBurgs",
  "goodsCells",
  "goodsIcons",
  "gridOverlay",
  "ice",
  "labels",
  "lakes",
  "landmass",
  "markers",
  "markets",
  "ocean",
  "population",
  "prec",
  "provs",
  "regions",
  "relig",
  "rivers",
  "routes",
  "terrain",
  "temperature",
  "terrs",
  "texture",
  "tradeAnimation",
  "zones"
]);

// add available filters to lists
{
  const filters = Array.from(ensureEl("filters").querySelectorAll("filter"));
  const emptyOption = '<option value="" selected>None</option>';
  const options = filters.map(filter => {
    const id = filter.getAttribute("id");
    const name = filter.getAttribute("name");
    return `<option value="url(#${id})">${name}</option>`;
  });
  const allOptions = emptyOption + options.join("");

  ensureEl("styleFilterInput").innerHTML = allOptions;
  ensureEl("styleStatesBodyFilter").innerHTML = allOptions;
  ensureEl("styleScaleBarBackgroundFilter").innerHTML = allOptions;
}

// store some style inputs as options
styleElements.addEventListener("input", storeStyleOption);
styleElements.addEventListener("change", storeStyleOption);

function storeStyleOption(event: Event): void {
  const target = event.target as HTMLElement;
  if (target.dataset.stored) lock(target.dataset.stored);
}

// select element to be edited
function editStyle(element: string, group?: string): void {
  OptionsController.show();
  styleTab.click();
  styleElementSelect.value = element;
  if (group) styleGroupSelect.options.add(new Option(group, group, true, true));
  selectStyleElement();

  styleElementSelect.classList.add("glow");
  if (group) styleGroupSelect.classList.add("glow");

  setTimeout(() => {
    styleElementSelect.classList.remove("glow");
    if (group) styleGroupSelect.classList.remove("glow");
  }, 1500);
}

// add default color schemes to the list of options
styleHeightmapScheme.innerHTML = Object.keys(HEIGHT_COLOR_SCHEMES)
  .map(scheme => `<option value="${scheme}">${scheme}</option>`)
  .join("");

// Toggle style sections on element select
styleElementSelect.addEventListener("change", selectStyleElement);

function selectStyleElement() {
  const styleElement = styleElementSelect.value;
  const rendererStyle = window.MapStyleControls.getStyle();
  const isPixiStyle = PIXI_STYLE_ELEMENTS.has(styleElement);
  let el: Selection<any, unknown, any, any> = isPixiStyle ? select(null) : select(`#${styleElement}`);
  const requestedGroup = styleGroupSelect.value;
  const routeGroups = styleElement === "routes" ? window.MapStyleControls.getRouteGroups() : [];
  const requestedRouteGroup = styleGroupSelect.value;
  const routeGroup = routeGroups.includes(requestedRouteGroup) ? requestedRouteGroup : routeGroups[0];
  const requestedLabelGroup = styleGroupSelect.value;
  const labelGroup = options.labels.groups.some(group => group.name === requestedLabelGroup)
    ? requestedLabelGroup
    : options.labels.groups[0]?.name;
  if (isPixiStyle && !["labels", "routes"].includes(styleElement)) {
    const semanticGroups = getSemanticStyleGroups(rendererStyle, styleElement);
    if (semanticGroups.length) {
      styleGroupSelect.options.length = 0;
      for (const group of semanticGroups) styleGroupSelect.options.add(new Option(group, group));
      styleGroupSelect.value = semanticGroups.includes(requestedGroup) ? requestedGroup : semanticGroups[0];
    }
  }

  styleElements.querySelectorAll("tbody").forEach(e => {
    e.style.display = "none";
  }); // hide all sections

  // show alert line if layer is not visible
  const semanticControl = {
    armies: "toggleMilitary",
    biomes: "toggleBiomes",
    borders: "toggleBorders",
    burgIcons: "toggleBurgIcons",
    cells: "toggleCells",
    coastline: "toggleLakes",
    compass: "toggleCompass",
    coordinates: "toggleCoordinates",
    cults: "toggleCultures",
    emblems: "toggleEmblems",
    goodsBurgs: "toggleGoods",
    goodsCells: "toggleGoods",
    goodsIcons: "toggleGoods",
    ice: "toggleIce",
    gridOverlay: "toggleGrid",
    lakes: "toggleLakes",
    labels: "toggleLabels",
    markers: "toggleMarkers",
    markets: "toggleMarketsLayer",
    population: "togglePopulation",
    prec: "togglePrecipitation",
    provs: "toggleProvinces",
    regions: "toggleStates",
    relig: "toggleReligions",
    rivers: "toggleRivers",
    routes: "toggleRoutes",
    temperature: "toggleTemperature",
    terrain: "toggleRelief",
    terrs: "toggleHeight",
    texture: "toggleTexture",
    tradeAnimation: "toggleTrade",
    zones: "toggleZones"
  }[styleElement];
  const isLayerOff = semanticControl
    ? !window.LayerControls.isLayerOn(semanticControl)
    : styleElement !== "ocean" && (el.style("display") === "none" || !el.selectAll("*").size());
  styleIsOff.style.display = isLayerOff ? "block" : "none";

  // active group element
  if (
    !isPixiStyle &&
    ["anchors", "borders", "burgIcons", "coastline", "lakes", "labels", "routes", "terrs"].includes(styleElement)
  ) {
    const group = styleGroupSelect.value;
    const defaultGroupSelector = styleElement === "terrs" ? "#landHeights" : "g";
    if (styleElement === "labels") {
      el = select(null);
    } else if (styleElement !== "routes") {
      el = group && el.select(`#${group}`).size() ? el.select(`#${group}`) : el.select(defaultGroupSelector);
    }
  }

  // opacity
  if (!["landmass", "legend", "ocean", "regions"].includes(styleElement)) {
    styleOpacity.style.display = "block";
    styleOpacityInput.value = isPixiStyle
      ? (getSemanticOpacity(rendererStyle, styleElement) ?? 1)
      : (el.attr("opacity") ?? 1);
  }

  // filter
  if (["coordinates", "emblems", "fogging", "labels", "ocean", "terrs", "texture", "vignette"].includes(styleElement)) {
    styleFilter.style.display = "block";
    styleFilterInput.value = isPixiStyle
      ? (getSemanticFilter(rendererStyle, styleElement) ?? "")
      : (el.attr("filter") ?? "");
  }

  // fill
  if (["fogging", "ice", "lakes", "landmass", "prec", "rivers", "scaleBar", "vignette"].includes(styleElement)) {
    styleFill.style.display = "block";
    styleFillInput.value = styleFillOutput.value = isPixiStyle
      ? (getSemanticFill(rendererStyle, styleElement) ?? "")
      : (el.attr("fill") ?? "");
  }

  // stroke color and width
  if (
    [
      "armies",
      "borders",
      "cells",
      "coastline",
      "coordinates",
      "gridOverlay",
      "ice",
      "icons",
      "lakes",
      "prec",
      "routes",
      "zones"
    ].includes(styleElement)
  ) {
    styleStroke.style.display = "block";
    const semanticLine = getSemanticLine(rendererStyle, styleElement);
    styleStrokeInput.value = styleStrokeOutput.value = isPixiStyle
      ? (semanticLine?.color ?? "")
      : (el.attr("stroke") ?? "");
    styleStrokeWidth.style.display = "block";
    styleStrokeWidthInput.value = isPixiStyle ? (semanticLine?.width ?? 0) : (el.attr("stroke-width") ?? 0);
  }

  // stroke dash
  if (
    [
      "borders",
      "cells",
      "coordinates",
      "gridOverlay",
      "legend",
      "population",
      "routes",
      "temperature",
      "zones"
    ].includes(styleElement)
  ) {
    styleStrokeDash.style.display = "block";
    const semanticLine = getSemanticLine(rendererStyle, styleElement);
    styleStrokeDasharrayInput.value = isPixiStyle ? (semanticLine?.dash ?? "") : (el.attr("stroke-dasharray") ?? "");
    styleStrokeLinecapInput.value = isPixiStyle
      ? (semanticLine?.cap ?? "butt")
      : (el.attr("stroke-linecap") ?? "inherit");
  }

  // clipping
  if (styleElement === "texture") {
    styleClipping.style.display = "block";
    styleClippingInput.value =
      rendererStyle.texture.mask === "land"
        ? "url(#land)"
        : rendererStyle.texture.mask === "water"
          ? "url(#water)"
          : "";
  }

  // show specific sections
  if (styleElement === "texture") {
    const textureStyle = rendererStyle.texture;
    styleTexture.style.display = "block";
    styleOpacityInput.value = textureStyle.opacity;
    styleFilterInput.value = textureStyle.filter ?? "";
    styleTextureShiftX.value = textureStyle.x;
    styleTextureShiftY.value = textureStyle.y;
    styleClippingInput.value =
      textureStyle.mask === "land" ? "url(#land)" : textureStyle.mask === "water" ? "url(#water)" : "";
    updateTextureSelectValue(textureStyle.href ?? "");
  }

  if (styleElement === "terrs") {
    const scope = getSelectedHeightScope();
    const heightStyle = rendererStyle.height[scope];
    styleHeightmap.style.display = "block";
    styleHeightmapRenderOceanOption.style.display = scope === "ocean" ? "block" : "none";
    styleHeightmapRenderOcean.checked = scope === "ocean" && rendererStyle.height.ocean.render;
    styleOpacityInput.value = heightStyle.opacity;
    styleFilterInput.value = heightStyle.filter ?? "";
    styleHeightmapScheme.value = heightStyle.scheme;
    styleHeightmapTerracing.value = heightStyle.terracing;
    styleHeightmapSkip.value = heightStyle.skip;
    styleHeightmapSimplification.value = heightStyle.relax;
    styleHeightmapCurve.value = heightStyle.curve;
  }

  if (styleElement === "markers") {
    styleMarkers.style.display = "block";
    styleOpacityInput.value = rendererStyle.markers?.opacity ?? 1;
    styleRescaleMarkers.checked = rendererStyle.markers?.rescale ?? true;
  }

  if (styleElement === "ice") {
    const iceStyle = rendererStyle.ice?.default;
    styleOpacityInput.value = rendererStyle.ice?.opacity ?? 1;
    styleFillInput.value = styleFillOutput.value = iceStyle?.fill?.color ?? "#f1f8fe";
    styleStrokeInput.value = styleStrokeOutput.value = iceStyle?.stroke?.color ?? "#e8f0f6";
    styleStrokeWidthInput.value = iceStyle?.stroke?.width ?? 0.5;
  }

  if (styleElement === "landmass") {
    styleFillInput.value = styleFillOutput.value = rendererStyle.landmass.color;
  }

  if (styleElement === "borders") {
    const borderStyle = rendererStyle.borders[getSelectedBorderRole()];
    styleOpacityInput.value = borderStyle.opacity;
    styleStrokeInput.value = styleStrokeOutput.value = borderStyle.color;
    styleStrokeWidthInput.value = borderStyle.width;
    styleStrokeDasharrayInput.value = borderStyle.dash;
    styleStrokeLinecapInput.value = borderStyle.cap;
  }

  if (styleElement === "coastline") {
    const role = styleGroupSelect.value || "sea_island";
    const coastlineStyle = rendererStyle.coastline.roles[role] ?? rendererStyle.coastline.default;
    styleOpacityInput.value = coastlineStyle.opacity;
    styleStrokeInput.value = styleStrokeOutput.value = coastlineStyle.color;
    styleStrokeWidthInput.value = coastlineStyle.width;
  }

  if (styleElement === "lakes") {
    const role = styleGroupSelect.value || "freshwater";
    const lakeStyle = rendererStyle.lakes.roles[role] ?? rendererStyle.lakes.default;
    styleOpacityInput.value = lakeStyle.fill.opacity;
    styleFillInput.value = styleFillOutput.value = lakeStyle.fill.color;
    styleStrokeInput.value = styleStrokeOutput.value = lakeStyle.stroke.color;
    styleStrokeWidthInput.value = lakeStyle.stroke.width;
  }

  if (styleElement === "gridOverlay") {
    styleGrid.style.display = "block";
    styleOpacityInput.value = rendererStyle.grid.opacity;
    styleStrokeInput.value = styleStrokeOutput.value = rendererStyle.grid.stroke.color;
    styleStrokeWidthInput.value = rendererStyle.grid.stroke.width;
    styleStrokeDasharrayInput.value = rendererStyle.grid.stroke.dash;
    styleStrokeLinecapInput.value = rendererStyle.grid.stroke.cap;
    styleGridType.value = rendererStyle.grid.type;
    styleGridScale.value = rendererStyle.grid.scale;
    styleGridShiftX.value = rendererStyle.grid.dx;
    styleGridShiftY.value = rendererStyle.grid.dy;
    calculateFriendlyGridSize();
  }

  if (styleElement === "compass") {
    styleCompass.style.display = "block";
    const compassStyle = rendererStyle.compass;
    styleOpacityInput.value = compassStyle?.opacity ?? 0.8;
    styleCompassShiftX.value = compassStyle?.x ?? 80;
    styleCompassShiftY.value = compassStyle?.y ?? 80;
    styleCompassSizeInput.value = compassStyle?.scale ?? 0.25;
  }

  if (styleElement === "tradeAnimation") {
    styleOpacityInput.value = rendererStyle.trade?.opacity ?? 1;
  }

  if (styleElement === "terrain") {
    styleRelief.style.display = "block";
    styleOpacityInput.value = rendererStyle.relief.opacity;
    styleReliefSize.value = style.relief.size;
    styleReliefDensity.value = style.relief.density;
    styleReliefSet.value = style.relief.set;
  }

  if (styleElement === "population") {
    const populationStyle = rendererStyle.population;
    stylePopulation.style.display = "block";
    styleOpacityInput.value = populationStyle?.opacity ?? 1;
    stylePopulationRuralStrokeInput.value = stylePopulationRuralStrokeOutput.value =
      populationStyle?.rural?.color ?? "#0000ff";
    stylePopulationUrbanStrokeInput.value = stylePopulationUrbanStrokeOutput.value =
      populationStyle?.urban?.color ?? "#ff0000";
    styleStrokeWidth.style.display = "block";
    styleStrokeWidthInput.value = populationStyle?.rural?.width ?? 1.6;
    styleStrokeDasharrayInput.value = populationStyle?.rural?.dash ?? "";
    styleStrokeLinecapInput.value = populationStyle?.rural?.cap ?? "butt";
  }

  if (styleElement === "regions") {
    styleStates.style.display = "block";
    styleStatesBodyOpacity.value = rendererStyle.states.opacity;
    styleStatesBodyFilter.value = "";
    styleStatesHaloWidth.value = rendererStyle.borders.state.width;
    styleStatesHaloOpacity.value = rendererStyle.borders.state.opacity;
    styleStatesHaloBlur.value = 0;
  }

  if (styleElement === "labels") {
    const labelStyle = style.labels.groups[labelGroup] || {};
    styleFill.style.display = "block";
    styleStroke.style.display = "block";
    styleStrokeWidth.style.display = "block";
    styleLetterSpacing.style.display = "block";

    styleShadow.style.display = "block";
    styleSize.style.display = "block";
    styleOpacityInput.value = labelStyle.opacity ?? 1;
    styleFilterInput.value = labelStyle.filter || "";
    styleFillInput.value = styleFillOutput.value = labelStyle.fill || "#3e3e4b";
    styleStrokeInput.value = styleStrokeOutput.value = labelStyle.stroke || "#3a3a3a";
    styleStrokeWidthInput.value = labelStyle["stroke-width"] || 0;
    styleLetterSpacingInput.value = labelStyle["letter-spacing"] || 0;
    styleShadowInput.value = labelStyle.style?.match(/text-shadow:\s*([^;]+)/)?.[1] || "";

    styleFont.style.display = "block";
    styleSelectFont.value = labelStyle["font-family"] || "Almendra SC";
    styleFontSize.value = parseFloat(labelStyle["font-size"]) || 18;

    styleFontShift.style.display = "block";
    styleFontShiftX.value = labelStyle["data-dx"] || 0;
    styleFontShiftY.value = labelStyle["data-dy"] || 0;
  }

  if (styleElement === "burgIcons") {
    const role = styleGroupSelect.value || "town";
    const symbolStyle = rendererStyle.burgIcons.icons.roles[role] ?? rendererStyle.burgIcons.icons.default;
    styleBurgIcons.style.display = "block";
    styleBurgIconsIcon.value = `#icon-${symbolStyle.icon}`;
    styleBurgIconsIconSize.value = symbolStyle.size;
    styleBurgIconsStrokeLinejoin.value = "round";
    styleBurgIconsFillOpacity.value = symbolStyle.fillOpacity;

    styleFill.style.display = "block";
    styleStroke.style.display = "block";
    styleStrokeWidth.style.display = "block";
    styleStrokeDash.style.display = "block";
    styleOpacityInput.value = symbolStyle.opacity;
    styleFillInput.value = styleFillOutput.value = symbolStyle.fill;
    styleStrokeInput.value = styleStrokeOutput.value = symbolStyle.stroke;
    styleStrokeWidthInput.value = symbolStyle.strokeWidth;
    styleStrokeDasharrayInput.value = "";
    styleStrokeLinecapInput.value = "round";
  }

  if (styleElement === "anchors") {
    const role = styleGroupSelect.value || "town";
    const symbolStyle = rendererStyle.burgIcons.anchors.roles[role] ?? rendererStyle.burgIcons.anchors.default;
    styleFill.style.display = "block";
    styleStroke.style.display = "block";
    styleStrokeWidth.style.display = "block";
    styleSize.style.display = "block";
    styleOpacityInput.value = symbolStyle.opacity;
    styleFillInput.value = styleFillOutput.value = symbolStyle.fill;
    styleStrokeInput.value = styleStrokeOutput.value = symbolStyle.stroke;
    styleStrokeWidthInput.value = symbolStyle.strokeWidth;
    styleFontSize.value = symbolStyle.size;
  }

  if (styleElement === "legend") {
    styleStroke.style.display = "block";
    styleStrokeWidth.style.display = "block";
    styleSize.style.display = "block";

    styleLegend.style.display = "block";
    styleLegendColItems.value = el.attr("data-columns") || 8;
    const legendBox = el.select("#legendBox");
    styleLegendBack.value = styleLegendBackOutput.value = legendBox.size() ? legendBox.attr("fill") : "#ffffff";
    styleLegendOpacity.value = legendBox.size() ? legendBox.attr("fill-opacity") : 1;

    styleStrokeInput.value = styleStrokeOutput.value = el.attr("stroke") || "#111111";
    styleStrokeWidthInput.value = el.attr("stroke-width") || 0.5;

    styleFont.style.display = "block";
    styleSelectFont.value = el.attr("font-family");
    styleFontSize.value = el.attr("data-size");
  }

  if (styleElement === "ocean") {
    styleOcean.style.display = "block";
    const oceanStyle = rendererStyle.ocean;
    styleOceanFill.value = styleOceanFillOutput.value = oceanStyle?.color || "#466eab";
    styleOceanPattern.value = oceanStyle?.pattern?.href || "";
    styleOceanPatternOpacity.value = oceanStyle?.pattern?.opacity ?? 1;
    outlineLayers.value = oceanStyle?.bands?.layers || "none";
  }

  if (styleElement === "temperature") {
    styleStrokeWidth.style.display = "block";
    styleTemperature.style.display = "block";
    styleStrokeWidthInput.value = rendererStyle.temperature.stroke.width;
    styleTemperatureFillOpacityInput.value = rendererStyle.temperature.bandOpacity;
    styleTemperatureFillInput.value = styleTemperatureFillOutput.value = rendererStyle.temperature.labels.color;
    styleTemperatureFontSizeInput.value = rendererStyle.temperature.labels.fontSize;
  }

  if (styleElement === "coordinates") {
    const coordinateStyle = rendererStyle.coordinates;
    styleSize.style.display = "block";
    styleFontSize.value = coordinateStyle?.fontSize ?? 12;
    styleOpacityInput.value = coordinateStyle?.opacity ?? 1;
    styleStrokeInput.value = styleStrokeOutput.value = coordinateStyle?.stroke?.color ?? "#d4d4d4";
    styleStrokeWidthInput.value = coordinateStyle?.stroke?.width ?? 1;
    styleStrokeDasharrayInput.value = coordinateStyle?.stroke?.dash ?? "5";
    styleStrokeLinecapInput.value = coordinateStyle?.stroke?.cap ?? "butt";
    styleFilterInput.value = coordinateStyle?.filter || "";
  }

  if (styleElement === "ruler") {
    styleStrokeWidth.style.display = "block";
    styleStrokeWidthInput.value = el.attr("stroke-width") || 2;

    // show the effective dash, so maps predating the attribute don't display a misleading blank
    styleStrokeDash.style.display = "block";
    styleStrokeDasharrayInput.value = el.attr("stroke-dasharray") ?? "10";
    styleStrokeLinecapInput.value = el.attr("stroke-linecap") || "inherit";

    styleSize.style.display = "block";
    styleFontSize.value = el.attr("data-size") || 20;
  }

  if (styleElement === "armies") {
    const militaryStyle = rendererStyle.military;
    styleArmies.style.display = "block";
    styleOpacityInput.value = militaryStyle?.opacity ?? 1;
    styleArmiesFillOpacity.value = militaryStyle?.fillOpacity ?? 1;
    styleArmiesSize.value = militaryStyle?.boxSize ?? 3;
    styleStrokeInput.value = styleStrokeOutput.value = militaryStyle?.stroke ?? "#000000";
    styleStrokeWidthInput.value = militaryStyle?.strokeWidth ?? 0.3;
  }

  if (styleElement === "emblems") {
    const emblemStyle = rendererStyle.emblems;
    styleEmblems.style.display = "block";
    styleStrokeWidth.style.display = "block";
    styleOpacityInput.value = emblemStyle?.opacity ?? 0.9;
    styleStrokeWidthInput.value = emblemStyle?.strokeWidth ?? 1;
    styleFilterInput.value = emblemStyle?.filter || "";
    emblemsStateSizeInput.value = emblemStyle?.stateSize ?? 1;
    emblemsProvinceSizeInput.value = emblemStyle?.provinceSize ?? 1;
    emblemsBurgSizeInput.value = emblemStyle?.burgSize ?? 1;
    hideEmblems.checked = emblemStyle?.automaticVisibility ?? true;
  }

  if (styleElement === "goodsIcons") {
    styleStrokeWidth.style.display = "block";
    styleStrokeWidthInput.value = rendererStyle.goods?.icons?.strokeWidth ?? 0.3;
    styleGoods.style.display = "block";
    styleGoodsCircle.checked = rendererStyle.goods?.icons?.circle ?? true;
    styleGoodsSize.value = rendererStyle.goods?.icons?.size ?? 6;
    styleOpacityInput.value = rendererStyle.goods?.icons?.opacity ?? 1;
  }

  if (styleElement === "goodsCells") {
    styleOpacityInput.value = rendererStyle.goods?.cells?.opacity ?? 1;
  }

  if (styleElement === "goodsBurgs") {
    styleStrokeWidth.style.display = "block";
    styleStrokeWidthInput.value = rendererStyle.goods?.burgs?.strokeWidth ?? 0.2;
    styleStroke.style.display = "block";
    styleStrokeInput.value = styleStrokeOutput.value = rendererStyle.goods?.burgs?.stroke ?? "#41414f";
    styleGoodsBurgs.style.display = "block";
    styleGoodsBurgsSize.value = rendererStyle.goods?.burgs?.iconSize ?? 3;
    styleOpacityInput.value = rendererStyle.goods?.burgs?.opacity ?? 1;
  }

  if (styleElement === "markets") {
    styleStrokeWidth.style.display = "block";
    const marketStyle = rendererStyle.markets;
    styleOpacityInput.value = marketStyle?.opacity ?? 1;
    styleStrokeWidthInput.value = marketStyle?.borderWidth ?? 1;
    styleMarketsLayer.style.display = "block";
    styleMarketsLayerFillOpacity.value = marketStyle?.areaOpacity ?? 0.03;
    styleMarketsSize.value = marketStyle?.radius ?? 3;
    styleMarketsIconSize.value = marketStyle?.iconSize ?? 5;
    styleMarketsIcon.innerHTML = marketStyle?.icon ?? "⚖️";
  }

  if (styleElement === "routes") {
    const routeStyle = window.MapStyleControls.getRouteLineStyle(routeGroup);
    styleOpacityInput.value = routeStyle.opacity;
    styleStrokeInput.value = styleStrokeOutput.value = routeStyle.color;
    styleStrokeWidthInput.value = routeStyle.width;
    styleStrokeDasharrayInput.value = routeStyle.dash;
    styleStrokeLinecapInput.value = routeStyle.cap;
  }

  // update group options
  styleGroupSelect.options.length = 0; // remove all options
  if (["anchors", "borders", "burgIcons", "coastline", "lakes", "labels", "routes", "terrs"].includes(styleElement)) {
    if (styleElement === "labels") {
      options.labels.groups.forEach(group => {
        styleGroupSelect.options.add(new Option(group.name, group.name, false, false));
      });
      styleGroupSelect.value = labelGroup;
    } else if (styleElement === "routes") {
      for (const group of routeGroups) {
        const count = pack.routes.filter(route => route.group === group).length;
        styleGroupSelect.options.add(new Option(`${group} (${count})`, group, false, group === routeGroup));
      }
      styleGroupSelect.value = routeGroup;
    } else if (isPixiStyle) {
      const groups = getSemanticStyleGroups(rendererStyle, styleElement);
      for (const group of groups) styleGroupSelect.options.add(new Option(group, group, false, false));
      styleGroupSelect.value = groups.includes(requestedGroup) ? requestedGroup : groups[0] || "";
    } else {
      const groups = ensureEl(styleElement).querySelectorAll("g");
      groups.forEach(group => {
        const option = new Option(`${group.id} (${group.childElementCount})`, group.id, false, false);
        styleGroupSelect.options.add(option);
      });
      styleGroupSelect.value = el.attr("id") ?? "";
    }
    styleGroup.style.display = "block";
  } else {
    styleGroupSelect.options.add(new Option(styleElement, styleElement, false, true));
    styleGroup.style.display = "none";
  }

  if (styleElement === "scaleBar") {
    styleScaleBar.style.display = "block";

    styleScaleBarSize.value = el.attr("data-bar-size");
    styleScaleBarFontSize.value = el.attr("font-size");
    styleScaleBarPositionX.value = el.attr("data-x") || "99";
    styleScaleBarPositionY.value = el.attr("data-y") || "99";
    styleScaleBarLabel.value = el.attr("data-label") || "";

    const scaleBarBack = el.select("#scaleBarBack");
    if (scaleBarBack.size()) {
      styleScaleBarBackgroundOpacity.value = scaleBarBack.attr("opacity");
      styleScaleBarBackgroundFill.value = styleScaleBarBackgroundFillOutput.value = scaleBarBack.attr("fill");
      styleScaleBarBackgroundStroke.value = styleScaleBarBackgroundStrokeOutput.value = scaleBarBack.attr("stroke");
      styleScaleBarBackgroundStrokeWidth.value = scaleBarBack.attr("stroke-width");
      styleScaleBarBackgroundFilter.value = scaleBarBack.attr("filter");
      styleScaleBarBackgroundPaddingTop.value = scaleBarBack.attr("data-top");
      styleScaleBarBackgroundPaddingRight.value = scaleBarBack.attr("data-right");
      styleScaleBarBackgroundPaddingBottom.value = scaleBarBack.attr("data-bottom");
      styleScaleBarBackgroundPaddingLeft.value = scaleBarBack.attr("data-left");
    }
  }

  if (styleElement === "vignette") {
    styleVignette.style.display = "block";

    const maskRect = ensureEl("vignette-rect");
    if (maskRect) {
      const digit = (value: string | null): string => value?.replace(/[^\d.]/g, "") ?? "";
      styleVignetteX.value = digit(maskRect.getAttribute("x"));
      styleVignetteY.value = digit(maskRect.getAttribute("y"));
      styleVignetteWidth.value = digit(maskRect.getAttribute("width"));
      styleVignetteHeight.value = digit(maskRect.getAttribute("height"));
      styleVignetteRx.value = digit(maskRect.getAttribute("rx"));
      styleVignetteRy.value = digit(maskRect.getAttribute("ry"));
      styleVignetteBlur.value = digit(maskRect.getAttribute("filter"));
    }
  }
}

// Handle style inputs change
styleGroupSelect.addEventListener("change", selectStyleElement);

function getEl(): Selection<any, unknown, any, any> {
  const el = styleElementSelect.value;
  const g = styleGroupSelect.value;
  const { svg } = getViewportSurface();
  if (el === "routes") return select(null);
  if (g === el || g === "") return svg.select(`#${el}`);
  if (el === "labels") return svg.select("#labels").select(`[data-group="${CSS.escape(g)}"]`);
  else return svg.select(`#${el}`).select(`#${g}`);
}

function setLegacyStyleAttribute(name: string, value: string | number | null): Selection<any, unknown, any, any> {
  const selection = getEl();
  if (!PIXI_STYLE_ELEMENTS.has(styleElementSelect.value)) selection.attr(name, value);
  return selection;
}

function getSelectedHeightScope(): "land" | "ocean" {
  return styleGroupSelect.value === "oceanHeights" ? "ocean" : "land";
}

function getSelectedBorderRole(): "province" | "state" {
  return styleGroupSelect.value === "provinceBorders" ? "province" : "state";
}

function getSelectedBurgSymbol(): { role: string; section: "anchors" | "icons" } {
  return {
    role: styleGroupSelect.value || "town",
    section: styleElementSelect.value === "anchors" ? "anchors" : "icons"
  };
}

function getSemanticOpacity(rendererStyle: MapStyle, element: string): number | undefined {
  const direct = getMappedValue(
    {
      armies: "military",
      biomes: "biomes",
      cells: "cells",
      compass: "compass",
      coordinates: "coordinates",
      cults: "cultures",
      emblems: "emblems",
      gridOverlay: "grid",
      ice: "ice",
      markers: "markers",
      markets: "markets",
      population: "population",
      prec: "precipitation",
      provs: "provinces",
      regions: "states",
      relig: "religions",
      rivers: "rivers",
      terrain: "relief",
      temperature: "temperature",
      texture: "texture",
      tradeAnimation: "trade",
      zones: "zones"
    },
    element
  );
  if (direct) return rendererStyle[direct].opacity;
  if (element === "landmass") return rendererStyle.landmass.opacity;
  if (element === "ocean") return rendererStyle.ocean.opacity;
  if (element === "routes") return getSemanticLine(rendererStyle, element)?.opacity;
  if (element === "borders" || element === "coastline") return getSemanticLine(rendererStyle, element)?.opacity;
  if (element === "lakes")
    return rendererStyle.lakes.roles[styleGroupSelect.value]?.fill.opacity ?? rendererStyle.lakes.default.fill.opacity;
  if (element === "burgIcons" || element === "anchors") {
    const { role, section } = getSelectedBurgSymbol();
    return rendererStyle.burgIcons[section].roles[role]?.opacity ?? rendererStyle.burgIcons[section].default.opacity;
  }
  if (element === "goodsBurgs") return rendererStyle.goods.burgs.opacity;
  if (element === "goodsCells") return rendererStyle.goods.cells.opacity;
  if (element === "goodsIcons") return rendererStyle.goods.icons.opacity;
  if (element === "labels") return style.labels.groups[styleGroupSelect.value]?.opacity;
  if (element === "terrs") return rendererStyle.height[getSelectedHeightScope()].opacity;
  return undefined;
}

function getSemanticFilter(rendererStyle: MapStyle, element: string): string | null | undefined {
  if (element === "coordinates") return rendererStyle.coordinates.filter;
  if (element === "emblems") return rendererStyle.emblems.filter;
  if (element === "labels") return style.labels.groups[styleGroupSelect.value]?.filter;
  if (element === "ocean") return rendererStyle.ocean.bands.filter;
  if (element === "terrs") return rendererStyle.height[getSelectedHeightScope()].filter;
  if (element === "texture") return rendererStyle.texture.filter;
  return undefined;
}

function getSemanticFill(rendererStyle: MapStyle, element: string): string | undefined {
  if (element === "ice") return rendererStyle.ice.default.fill.color;
  if (element === "lakes") {
    return rendererStyle.lakes.roles[styleGroupSelect.value]?.fill.color ?? rendererStyle.lakes.default.fill.color;
  }
  if (element === "landmass") return rendererStyle.landmass.color;
  if (element === "prec") return rendererStyle.precipitation.fill.color;
  if (element === "rivers") return rendererStyle.rivers.fill.color;
  return undefined;
}

function getSemanticLine(rendererStyle: MapStyle, element: string): SemanticLineStyle | undefined {
  if (element === "borders") return rendererStyle.borders[getSelectedBorderRole()];
  if (element === "cells") return rendererStyle.cells;
  if (element === "coastline") {
    return rendererStyle.coastline.roles[styleGroupSelect.value] ?? rendererStyle.coastline.default;
  }
  if (element === "coordinates") return rendererStyle.coordinates.stroke;
  if (element === "gridOverlay") return rendererStyle.grid.stroke;
  if (element === "ice") return rendererStyle.ice.default.stroke;
  if (element === "lakes")
    return rendererStyle.lakes.roles[styleGroupSelect.value]?.stroke ?? rendererStyle.lakes.default.stroke;
  if (element === "population") return rendererStyle.population.rural;
  if (element === "prec") return rendererStyle.precipitation.stroke;
  if (element === "routes") {
    return rendererStyle.routes.roles[styleGroupSelect.value] ?? rendererStyle.routes.default;
  }
  if (element === "temperature") return rendererStyle.temperature.stroke;
  if (element === "zones") return rendererStyle.zones.stroke;
  return undefined;
}

function getSemanticStyleGroups(rendererStyle: MapStyle, element: string): string[] {
  if (element === "anchors" || element === "burgIcons") return options.burgs.groups.map(group => group.name);
  if (element === "borders") return ["stateBorders", "provinceBorders"];
  if (element === "coastline") return Object.keys(rendererStyle.coastline.roles);
  if (element === "lakes") return Object.keys(rendererStyle.lakes.roles);
  if (element === "terrs") return ["landHeights", "oceanHeights"];
  return [];
}

styleFillInput.addEventListener("input", function () {
  styleFillOutput.value = this.value;
  setLegacyStyleAttribute("fill", this.value);
  const groupStyle = style.labels.groups[styleGroupSelect.value];
  if (groupStyle) groupStyle.fill = this.value;
  redrawLabelsOnStyleChange();
  const pixiFillLayer = getMappedValue({ prec: "precipitation", rivers: "rivers" }, styleElementSelect.value);
  if (pixiFillLayer) window.MapStyleControls.setAreaFillColor(pixiFillLayer, this.value);
  if (styleElementSelect.value === "ice") window.MapStyleControls.setIceStyle("fill", "color", this.value);
  if (styleElementSelect.value === "landmass") window.MapStyleControls.setLandmassStyle("color", this.value);
  if (styleElementSelect.value === "lakes") {
    window.MapStyleControls.setLakeStyle(styleGroupSelect.value || "freshwater", "fill", "color", this.value);
  }
  if (styleElementSelect.value === "burgIcons" || styleElementSelect.value === "anchors") {
    const { role, section } = getSelectedBurgSymbol();
    window.MapStyleControls.setBurgPointStyle(section, role, "fill", this.value);
  }
});

styleStrokeInput.addEventListener("input", function () {
  styleStrokeOutput.value = this.value;
  setLegacyStyleAttribute("stroke", this.value);
  const groupStyle = style.labels.groups[styleGroupSelect.value];
  if (groupStyle) groupStyle.stroke = this.value;
  redrawLabelsOnStyleChange();
  if (styleElementSelect.value === "coordinates") window.MapStyleControls.setCoordinateLineStyle("color", this.value);
  const pixiStrokeLayer = getMappedValue(
    { cells: "cells", gridOverlay: "grid", prec: "precipitation", zones: "zones" },
    styleElementSelect.value
  );
  if (pixiStrokeLayer) {
    window.MapStyleControls.setLineStyle(pixiStrokeLayer, "color", this.value);
  }
  if (styleElementSelect.value === "ice") window.MapStyleControls.setIceStyle("stroke", "color", this.value);
  if (styleElementSelect.value === "goodsBurgs") window.MapStyleControls.setGoodsStyle("burgs", "stroke", this.value);
  if (styleElementSelect.value === "armies") window.MapStyleControls.setMilitaryStyle("stroke", this.value);
  if (styleElementSelect.value === "borders") {
    window.MapStyleControls.setBorderStyle(getSelectedBorderRole(), "color", this.value);
  }
  if (styleElementSelect.value === "coastline") {
    window.MapStyleControls.setCoastlineStyle(styleGroupSelect.value || "sea_island", "color", this.value);
  }
  if (styleElementSelect.value === "lakes") {
    window.MapStyleControls.setLakeStyle(styleGroupSelect.value || "freshwater", "stroke", "color", this.value);
  }
  if (styleElementSelect.value === "burgIcons" || styleElementSelect.value === "anchors") {
    const { role, section } = getSelectedBurgSymbol();
    window.MapStyleControls.setBurgPointStyle(section, role, "stroke", this.value);
  }
  if (styleElementSelect.value === "routes") {
    window.MapStyleControls.setRouteLineStyle(styleGroupSelect.value || "roads", "color", this.value);
  }
});

// measurers are rendered with baked-in sizes, so a style change requires a redraw
function redrawMeasurersOnStyleChange() {
  if (styleElementSelect.value === "ruler" && window.LayerControls.isLayerOn("toggleRulers")) drawMeasurers();
}

function redrawLabelsOnStyleChange() {
  if (styleElementSelect.value === "labels") drawLabels();
}

styleStrokeWidthInput.addEventListener("input", e => {
  setLegacyStyleAttribute("stroke-width", eventValue(e));
  const groupStyle = style.labels.groups[styleGroupSelect.value];
  if (groupStyle) groupStyle["stroke-width"] = Number(eventValue(e));
  if (styleElementSelect.value === "coordinates")
    window.MapStyleControls.setCoordinateLineStyle("width", Number(eventValue(e)));
  const pixiStrokeLayer = getMappedValue(
    {
      cells: "cells",
      gridOverlay: "grid",
      prec: "precipitation",
      temperature: "temperature",
      zones: "zones"
    },
    styleElementSelect.value
  );
  if (pixiStrokeLayer) {
    window.MapStyleControls.setLineStyle(pixiStrokeLayer, "width", Number(eventValue(e)));
  }
  if (styleElementSelect.value === "ice") window.MapStyleControls.setIceStyle("stroke", "width", Number(eventValue(e)));
  if (styleElementSelect.value === "goodsIcons")
    window.MapStyleControls.setGoodsStyle("icons", "strokeWidth", Number(eventValue(e)));
  if (styleElementSelect.value === "goodsBurgs")
    window.MapStyleControls.setGoodsStyle("burgs", "strokeWidth", Number(eventValue(e)));
  if (styleElementSelect.value === "markets")
    window.MapStyleControls.setMarketStyle("borderWidth", Number(eventValue(e)));
  if (styleElementSelect.value === "population") {
    window.MapStyleControls.setPopulationLineStyle("rural", "width", Number(eventValue(e)));
    window.MapStyleControls.setPopulationLineStyle("urban", "width", Number(eventValue(e)));
  }
  if (styleElementSelect.value === "armies")
    window.MapStyleControls.setMilitaryStyle("strokeWidth", Number(eventValue(e)));
  if (styleElementSelect.value === "emblems")
    window.MapStyleControls.setEmblemStyle("strokeWidth", Number(eventValue(e)));
  if (styleElementSelect.value === "borders") {
    window.MapStyleControls.setBorderStyle(getSelectedBorderRole(), "width", Number(eventValue(e)));
  }
  if (styleElementSelect.value === "coastline") {
    window.MapStyleControls.setCoastlineStyle(styleGroupSelect.value || "sea_island", "width", Number(eventValue(e)));
  }
  if (styleElementSelect.value === "lakes") {
    window.MapStyleControls.setLakeStyle(
      styleGroupSelect.value || "freshwater",
      "stroke",
      "width",
      Number(eventValue(e))
    );
  }
  if (styleElementSelect.value === "burgIcons" || styleElementSelect.value === "anchors") {
    const { role, section } = getSelectedBurgSymbol();
    window.MapStyleControls.setBurgPointStyle(section, role, "strokeWidth", Number(eventValue(e)));
  }
  if (styleElementSelect.value === "routes") {
    window.MapStyleControls.setRouteLineStyle(styleGroupSelect.value || "roads", "width", Number(eventValue(e)));
  }
  redrawLabelsOnStyleChange();
  redrawMeasurersOnStyleChange();
});

styleLetterSpacingInput.addEventListener("input", e => {
  setLegacyStyleAttribute("letter-spacing", eventValue(e));
  const groupStyle = style.labels.groups[styleGroupSelect.value];
  if (groupStyle) groupStyle["letter-spacing"] = Number(eventValue(e));
  redrawLabelsOnStyleChange();
});

styleStrokeDasharrayInput.addEventListener("input", function () {
  setLegacyStyleAttribute("stroke-dasharray", this.value);
  if (styleElementSelect.value === "coordinates") window.MapStyleControls.setCoordinateLineStyle("dash", this.value);
  const pixiStrokeLayer = getMappedValue(
    { cells: "cells", gridOverlay: "grid", temperature: "temperature", zones: "zones" },
    styleElementSelect.value
  );
  if (pixiStrokeLayer) {
    window.MapStyleControls.setLineStyle(pixiStrokeLayer, "dash", this.value);
  }
  if (styleElementSelect.value === "routes") {
    window.MapStyleControls.setRouteLineStyle(styleGroupSelect.value || "roads", "dash", this.value);
  }
  if (styleElementSelect.value === "population") {
    window.MapStyleControls.setPopulationLineStyle("rural", "dash", this.value);
    window.MapStyleControls.setPopulationLineStyle("urban", "dash", this.value);
  }
  if (styleElementSelect.value === "borders") {
    window.MapStyleControls.setBorderStyle(getSelectedBorderRole(), "dash", this.value);
  }
  redrawMeasurersOnStyleChange();
});

styleStrokeLinecapInput.addEventListener("change", function () {
  setLegacyStyleAttribute("stroke-linecap", this.value);
  if (styleElementSelect.value === "coordinates") window.MapStyleControls.setCoordinateLineStyle("cap", this.value);
  const pixiStrokeLayer = getMappedValue(
    { cells: "cells", gridOverlay: "grid", temperature: "temperature", zones: "zones" },
    styleElementSelect.value
  );
  if (pixiStrokeLayer) {
    window.MapStyleControls.setLineStyle(pixiStrokeLayer, "cap", this.value);
  }
  if (styleElementSelect.value === "routes") {
    window.MapStyleControls.setRouteLineStyle(styleGroupSelect.value || "roads", "cap", this.value);
  }
  if (styleElementSelect.value === "population") {
    window.MapStyleControls.setPopulationLineStyle("rural", "cap", this.value);
    window.MapStyleControls.setPopulationLineStyle("urban", "cap", this.value);
  }
  if (styleElementSelect.value === "borders") {
    window.MapStyleControls.setBorderStyle(getSelectedBorderRole(), "cap", this.value);
  }
});

styleDisplayInput.addEventListener("change", function () {
  setLegacyStyleAttribute("display", this.value || null);
});

styleOpacityInput.addEventListener("input", e => {
  setLegacyStyleAttribute("opacity", eventValue(e));
  const pixiLayer = getMappedValue(
    {
      armies: "military",
      biomes: "biomes",
      cells: "cells",
      compass: "compass",
      coordinates: "coordinates",
      emblems: "emblems",
      cults: "cultures",
      gridOverlay: "grid",
      ice: "ice",
      markers: "markers",
      prec: "precipitation",
      population: "population",
      provs: "provinces",
      relig: "religions",
      rivers: "rivers",
      temperature: "temperature",
      tradeAnimation: "trade",
      zones: "zones"
    },
    styleElementSelect.value
  );
  if (pixiLayer) window.MapStyleControls.setLayerOpacity(pixiLayer, eventValue(e));
  if (styleElementSelect.value === "texture") {
    const current = window.MapStyleControls.getStyle().texture;
    window.MapStyleControls.setTextureStyle({ ...current, opacity: Number(eventValue(e)) });
  }
  if (styleElementSelect.value === "terrs") {
    window.MapStyleControls.setHeightBandStyle(getSelectedHeightScope(), { opacity: Number(eventValue(e)) });
  }
  if (styleElementSelect.value === "goodsIcons")
    window.MapStyleControls.setGoodsStyle("icons", "opacity", Number(eventValue(e)));
  if (styleElementSelect.value === "goodsCells")
    window.MapStyleControls.setGoodsStyle("cells", "opacity", Number(eventValue(e)));
  if (styleElementSelect.value === "goodsBurgs")
    window.MapStyleControls.setGoodsStyle("burgs", "opacity", Number(eventValue(e)));
  if (styleElementSelect.value === "markets") window.MapStyleControls.setMarketStyle("opacity", Number(eventValue(e)));
  if (styleElementSelect.value === "routes") {
    window.MapStyleControls.setRouteLineStyle(styleGroupSelect.value || "roads", "opacity", Number(eventValue(e)));
  }
  if (styleElementSelect.value === "terrain") window.MapStyleControls.setReliefOpacity(eventValue(e));
  if (styleElementSelect.value === "borders") {
    window.MapStyleControls.setBorderStyle(getSelectedBorderRole(), "opacity", Number(eventValue(e)));
  }
  if (styleElementSelect.value === "coastline") {
    window.MapStyleControls.setCoastlineStyle(styleGroupSelect.value || "sea_island", "opacity", Number(eventValue(e)));
  }
  if (styleElementSelect.value === "lakes") {
    window.MapStyleControls.setLakeStyle(
      styleGroupSelect.value || "freshwater",
      "fill",
      "opacity",
      Number(eventValue(e))
    );
  }
  if (styleElementSelect.value === "burgIcons" || styleElementSelect.value === "anchors") {
    const { role, section } = getSelectedBurgSymbol();
    window.MapStyleControls.setBurgPointStyle(section, role, "opacity", Number(eventValue(e)));
  }
  const groupStyle = style.labels.groups[styleGroupSelect.value];
  if (groupStyle) groupStyle.opacity = Number(eventValue(e));
  redrawLabelsOnStyleChange();
});

styleFilterInput.addEventListener("change", function () {
  if (styleGroupSelect.value === "ocean") {
    const current = window.MapStyleControls.getOceanStyle();
    window.MapStyleControls.setOceanStyle({ ...current, bands: { ...current.bands, filter: this.value || null } });
    return;
  }
  if (!new Set(["coordinates", "emblems", "terrs", "texture"]).has(styleElementSelect.value)) {
    setLegacyStyleAttribute("filter", this.value);
  }
  if (styleElementSelect.value === "emblems") window.MapStyleControls.setEmblemStyle("filter", this.value || null);
  if (styleElementSelect.value === "coordinates")
    window.MapStyleControls.setCoordinateStyle("filter", this.value || null);
  if (styleElementSelect.value === "texture") {
    const current = window.MapStyleControls.getStyle().texture;
    window.MapStyleControls.setTextureStyle({ ...current, filter: this.value || null });
  }
  if (styleElementSelect.value === "terrs") {
    window.MapStyleControls.setHeightBandStyle(getSelectedHeightScope(), { filter: this.value || null });
  }
  const groupStyle = style.labels.groups[styleGroupSelect.value];
  if (groupStyle) {
    if (this.value) groupStyle.filter = this.value;
    else groupStyle.filter = null;
  }
  redrawLabelsOnStyleChange();
});

styleTextureInput.addEventListener("change", function () {
  changeTexture(this.value);
});

function changeTexture(href: string): void {
  const current = window.MapStyleControls.getStyle().texture;
  window.MapStyleControls.setTextureStyle({ ...current, href: href || null });
}

function updateTextureSelectValue(href: string): void {
  const isAdded = Array.from(styleTextureInput.options).some(option => option.value === href);
  if (isAdded) {
    styleTextureInput.value = href;
  } else {
    const name = href.split("/").pop()?.slice(0, 20) || href;
    styleTextureInput.add(new Option(name, href, false, true));
  }
}

styleTextureShiftX.addEventListener("input", function () {
  const current = window.MapStyleControls.getStyle().texture;
  window.MapStyleControls.setTextureStyle({ ...current, x: Number(this.value) });
});

styleTextureShiftY.addEventListener("input", function () {
  const current = window.MapStyleControls.getStyle().texture;
  window.MapStyleControls.setTextureStyle({ ...current, y: Number(this.value) });
});

styleClippingInput.addEventListener("change", function () {
  setLegacyStyleAttribute("mask", this.value);
  if (styleElementSelect.value === "texture") {
    const current = window.MapStyleControls.getStyle().texture;
    const mask = this.value.includes("#land") ? "land" : this.value.includes("#water") ? "water" : "none";
    window.MapStyleControls.setTextureStyle({ ...current, mask });
  }
});

styleGridType.addEventListener("change", function () {
  window.MapStyleControls.setGridStyle("type", this.value);
  calculateFriendlyGridSize();
});

styleGridScale.addEventListener("input", function () {
  window.MapStyleControls.setGridStyle("scale", Number(this.value));
  calculateFriendlyGridSize();
});

function calculateFriendlyGridSize(): void {
  const size = Number(styleGridScale.value) * 25;
  const friendly = `${rn(size * distanceScale, 2)} ${distanceUnitInput.value}`;
  styleGridSizeFriendly.value = friendly;
}

styleGridShiftX.addEventListener("input", function () {
  window.MapStyleControls.setGridStyle("dx", Number(this.value));
});

styleGridShiftY.addEventListener("input", function () {
  window.MapStyleControls.setGridStyle("dy", Number(this.value));
});

styleRescaleMarkers.addEventListener("change", function () {
  window.MapStyleControls.setMarkerStyle("rescale", this.checked);
});

styleOceanFill.addEventListener("input", function () {
  styleOceanFillOutput.value = this.value;
  const oceanStyle = window.MapStyleControls.getOceanStyle();
  window.MapStyleControls.setOceanStyle({ ...oceanStyle, color: this.value });
});

styleOceanPattern.addEventListener("change", function () {
  const current = window.MapStyleControls.getOceanStyle();
  window.MapStyleControls.setOceanStyle({ ...current, pattern: { ...current.pattern, href: this.value || null } });
});

styleOceanPatternOpacity.addEventListener("input", e => {
  const current = window.MapStyleControls.getOceanStyle();
  window.MapStyleControls.setOceanStyle({
    ...current,
    pattern: { ...current.pattern, opacity: Number(eventValue(e)) }
  });
});

outlineLayers.addEventListener("change", function () {
  const current = window.MapStyleControls.getOceanStyle();
  window.MapStyleControls.setOceanStyle({ ...current, bands: { ...current.bands, layers: this.value } });
});

styleHeightmapScheme.addEventListener("change", function () {
  window.MapStyleControls.setHeightBandStyle(getSelectedHeightScope(), { scheme: this.value });
});

openCreateHeightmapSchemeButton.addEventListener("click", function () {
  // start with current scheme
  const scheme = window.MapStyleControls.getStyle().height[getSelectedHeightScope()].scheme;
  this.dataset.stops = scheme.startsWith("#")
    ? scheme
    : (() => [0, 0.25, 0.5, 0.75, 1].map(getHeightColorScheme(scheme)).map(toHEX).join(","))();

  // render dialog base structure
  window.destroyDialog("heightmapSchemeDialog");
  const content = document.createElement("div");
  content.id = "heightmapSchemeDialog";
  content.innerHTML = /* html */ `<div>
    <i>Define heightmap gradient colors from high to low altitude</i>
    <img id="heightmapSchemePreview" alt="heightmap preview" style="margin-top: 0.5em; width: 100%;" />
    <div id="heightmapSchemeStops" style="margin-block: 0.5em; display: flex; flex-wrap: wrap;"></div>
    <div id="heightmapSchemeGradient" style="height: 1.9em; border: 1px solid #767676;"></div>
  </div>`;
  ensureEl("dialogs").appendChild(content);

  const getStops = (): string[] => (openCreateHeightmapSchemeButton.dataset.stops ?? "").split(",");
  renderPreview();
  renderStops();
  renderGradient();

  function renderPreview(): void {
    const stops = getStops();
    const scheme = scaleSequential(interpolateRgbBasis(stops));

    const preview = drawHeights({
      heights: grid.cells.h,
      width: grid.cellsX,
      height: grid.cellsY,
      scheme,
      renderOcean: false
    });

    ensureEl<HTMLImageElement>("heightmapSchemePreview").src = preview;
  }

  function renderStops(): void {
    const stops = getStops();

    const colorInput = (color: string): string =>
      `<input type="color" class="stop" value="${color}" data-tip="Click to set the color" style="width: 2.5em; border: none;" />`;
    const removeStopButton = (index: number): string =>
      `<button class="remove" data-index="${index}" data-tip="Remove color stop" style="margin-top: 0.3em; height: max-content;">x</button>`;
    const addStopButton = (): string =>
      `<button class="add" data-tip="Add color stop in between" style="margin-top: 0.3em; height: max-content;">+</button>`;

    const container = ensureEl("heightmapSchemeStops");
    container.innerHTML = stops
      .map(
        (stop, index) => `${colorInput(stop)}
        ${index && index < stops.length - 1 ? removeStopButton(index) : ""}`
      )
      .join(addStopButton());

    Array.from(container.querySelectorAll<HTMLInputElement>("input.stop")).forEach((input, index) => {
      input.oninput = () => {
        stops[index] = input.value;
        openCreateHeightmapSchemeButton.dataset.stops = stops.join(",");
        renderPreview();
        renderGradient();
      };
    });

    Array.from(container.querySelectorAll<HTMLButtonElement>("button.remove")).forEach(button => {
      button.onclick = () => {
        const index = Number(button.dataset.index);
        stops.splice(index, 1);
        openCreateHeightmapSchemeButton.dataset.stops = stops.join(",");
        renderPreview();
        renderStops();
        renderGradient();
      };
    });

    Array.from(container.querySelectorAll<HTMLButtonElement>("button.add")).forEach((button, index) => {
      button.onclick = () => {
        const middleColor = interpolateRgb(stops[index], stops[index + 1])(0.5);
        stops.splice(index + 1, 0, toHEX(middleColor));
        openCreateHeightmapSchemeButton.dataset.stops = stops.join(",");
        renderPreview();
        renderStops();
        renderGradient();
      };
    });
  }

  function renderGradient(): void {
    const stops = openCreateHeightmapSchemeButton.dataset.stops ?? "";
    ensureEl("heightmapSchemeGradient").style.background = `linear-gradient(to right, ${stops})`;
  }

  function handleCreate(): void {
    const stops = openCreateHeightmapSchemeButton.dataset.stops ?? "";
    if (stops in HEIGHT_COLOR_SCHEMES) {
      tip("This scheme already exists", false, "error");
      return;
    }

    addCustomHeightColorScheme(stops);
    styleHeightmapScheme.options.add(new Option(stops, stops, false, true));
    window.MapStyleControls.setHeightBandStyle(getSelectedHeightScope(), { scheme: stops });

    handleClose();
  }

  function handleClose(): void {
    window.destroyDialog(content.id);
  }

  window.showDomDialog({
    actions: [{ close: false, label: "Create", onClick: handleCreate }, { label: "Cancel" }],
    content,
    placement: "top-center",
    placementOffset: { x: 0, y: 150 },
    placementTarget: document.getElementById("map"),
    resizable: false,
    title: "Create heightmap color scheme",
    width: "28em"
  });
});

styleHeightmapRenderOcean.addEventListener("change", e => {
  const current = window.MapStyleControls.getStyle().height;
  window.MapStyleControls.setHeightStyle({
    ...current,
    ocean: { ...current.ocean, render: eventChecked(e) }
  });
});

styleHeightmapTerracing.addEventListener("input", e => {
  window.MapStyleControls.setHeightBandStyle(getSelectedHeightScope(), { terracing: Number(eventValue(e)) });
});

styleHeightmapSkip.addEventListener("input", e => {
  window.MapStyleControls.setHeightBandStyle(getSelectedHeightScope(), { skip: Number(eventValue(e)) });
});

styleHeightmapSimplification.addEventListener("input", e => {
  window.MapStyleControls.setHeightBandStyle(getSelectedHeightScope(), { relax: Number(eventValue(e)) });
});

styleHeightmapCurve.addEventListener("change", e => {
  window.MapStyleControls.setHeightBandStyle(getSelectedHeightScope(), { curve: eventValue(e) });
});

styleReliefSet.addEventListener("change", e => {
  const set = eventValue(e) as ReliefSet;
  style.relief.set = set;
  Relief.changeSet(set);
  drawRelief();
});

styleReliefSize.addEventListener("change", e => {
  const newSize = +eventValue(e);
  const ratio = newSize / style.relief.size;
  style.relief.size = newSize;
  if (ratio === 1) return;

  Relief.changeSize(ratio);
  drawRelief();
});

// density defines the placement, so it cannot be applied without regenerating the icons
styleReliefDensity.addEventListener("change", e => {
  style.relief.density = +eventValue(e);
  Relief.generate();
  drawRelief();
});

styleTemperatureFillOpacityInput.addEventListener("input", e => {
  window.MapStyleControls.setTemperatureStyle({ bandOpacity: Number(eventValue(e)) });
});

styleTemperatureFontSizeInput.addEventListener("input", e => {
  window.MapStyleControls.setTemperatureStyle({
    labels: { ...window.MapStyleControls.getTemperatureStyle().labels, fontSize: Number(eventValue(e)) }
  });
});

styleTemperatureFillInput.addEventListener("input", e => {
  styleTemperatureFillOutput.value = eventValue(e);
  window.MapStyleControls.setTemperatureStyle({
    labels: { ...window.MapStyleControls.getTemperatureStyle().labels, color: eventValue(e) }
  });
});

stylePopulationRuralStrokeInput.addEventListener("input", e => {
  window.MapStyleControls.setPopulationLineStyle("rural", "color", eventValue(e));
  stylePopulationRuralStrokeOutput.value = eventValue(e);
});

stylePopulationUrbanStrokeInput.addEventListener("input", e => {
  window.MapStyleControls.setPopulationLineStyle("urban", "color", eventValue(e));
  stylePopulationUrbanStrokeOutput.value = eventValue(e);
});

styleBurgIconsIcon.addEventListener("change", e => {
  const { role, section } = getSelectedBurgSymbol();
  window.MapStyleControls.setBurgPointStyle(section, role, "icon", eventValue(e).replace(/^#?icon-/, ""));
});

styleBurgIconsIconSize.addEventListener("input", e => {
  const { role, section } = getSelectedBurgSymbol();
  window.MapStyleControls.setBurgPointStyle(section, role, "size", Number(eventValue(e)));
});

styleBurgIconsStrokeLinejoin.addEventListener("change", e => {
  setLegacyStyleAttribute("stroke-linejoin", eventValue(e));
});

styleBurgIconsFillOpacity.addEventListener("input", e => {
  const { role, section } = getSelectedBurgSymbol();
  window.MapStyleControls.setBurgPointStyle(section, role, "fillOpacity", Number(eventValue(e)));
});

styleCompassSizeInput.addEventListener("input", shiftCompass);
styleCompassShiftX.addEventListener("input", shiftCompass);
styleCompassShiftY.addEventListener("input", shiftCompass);

function shiftCompass() {
  window.MapStyleControls.setCompassStyle({
    scale: Number(styleCompassSizeInput.value),
    x: Number(styleCompassShiftX.value),
    y: Number(styleCompassShiftY.value)
  });
}

styleLegendColItems.addEventListener("input", e => {
  const { legend } = getViewportSurface();
  legend.select("#legendBox").attr("data-columns", eventValue(e));
  redrawLegend();
});

styleLegendBack.addEventListener("input", e => {
  const { legend } = getViewportSurface();
  styleLegendBackOutput.value = eventValue(e);
  legend.select("#legendBox").attr("fill", eventValue(e));
});

styleLegendOpacity.addEventListener("input", e => {
  const { legend } = getViewportSurface();
  legend.select("#legendBox").attr("fill-opacity", eventValue(e));
});

styleSelectFont.addEventListener("change", changeFont);
function changeFont() {
  const family = styleSelectFont.value;
  setLegacyStyleAttribute("font-family", family);
  const groupStyle = style.labels.groups[styleGroupSelect.value];
  if (groupStyle) groupStyle["font-family"] = family;
  redrawLabelsOnStyleChange();

  if (styleElementSelect.value === "legend") redrawLegend();
}

styleShadowInput.addEventListener("input", function () {
  const groupStyle = style.labels.groups[styleGroupSelect.value];
  if (groupStyle) groupStyle.style = this.value ? `text-shadow: ${this.value}` : null;
  if (!PIXI_STYLE_ELEMENTS.has(styleElementSelect.value)) getEl().style("text-shadow", this.value);
  redrawLabelsOnStyleChange();
});

styleFontAdd.addEventListener("click", () => {
  addFontNameInput.value = "";
  addFontURLInput.value = "";

  window.showDomDialog({
    actions: [
      {
        close: false,
        label: "Add",
        onClick: () => {
          const family = addFontNameInput.value;
          const src = addFontURLInput.value;
          const method = addFontMethod.value;

          if (!family) return tip("Please provide a font name", false, "error");

          const existingFont =
            method === "fontURL"
              ? fonts.find(font => font.family === family && font.src === src)
              : fonts.find(font => font.family === family);
          if (existingFont) return tip("The font is already added", false, "error");

          if (method === "fontURL") addWebFont(family, src);
          else if (method === "googleFont") addGoogleFont(family);
          else if (method === "localFont") addLocalFont(family);

          addFontNameInput.value = "";
          addFontURLInput.value = "";
          window.destroyDialog("addFontDialog");
        }
      },
      { label: "Cancel" }
    ],
    content: ensureEl("addFontDialog"),
    destroyOnClose: false,
    placement: "center",
    placementTarget: document.getElementById("map"),
    title: "Add custom font",
    width: "26em"
  });
});

addFontMethod.addEventListener("change", function () {
  addFontURLInput.style.display = this.value === "fontURL" ? "inline" : "none";
});

styleFontSize.addEventListener("change", function () {
  changeFontSize(+this.value);
});

styleFontPlus.addEventListener("click", () => {
  const current = +styleFontSize.value || 12;
  changeFontSize(Math.min(rn(current + 0.1, 1), 999));
});

styleFontMinus.addEventListener("click", () => {
  const current = +styleFontSize.value || 12;
  changeFontSize(Math.max(rn(current - 0.1, 1), 0.1));
});

function changeFontSize(size: number): void {
  styleFontSize.value = size;

  const groupStyle = style.labels.groups[styleGroupSelect.value];
  if (styleElementSelect.value === "labels") {
    if (groupStyle) {
      groupStyle["font-size"] = `${size}%`;
    }
    redrawLabelsOnStyleChange();
    return;
  }

  if (styleElementSelect.value === "coordinates") {
    window.MapStyleControls.setCoordinateStyle("fontSize", Number(size));
    return;
  }

  if (styleElementSelect.value === "anchors" || styleElementSelect.value === "burgIcons") {
    const { role, section } = getSelectedBurgSymbol();
    window.MapStyleControls.setBurgPointStyle(section, role, "size", size);
    return;
  }

  setLegacyStyleAttribute("data-size", size).attr("font-size", size);

  if (styleElementSelect.value === "legend") redrawLegend();
  redrawMeasurersOnStyleChange();
}

styleFontShiftX.addEventListener("input", e => {
  const groupStyle = style.labels.groups[styleGroupSelect.value];
  if (groupStyle) groupStyle["data-dx"] = Number(eventValue(e));
  setLegacyStyleAttribute("data-dx", eventValue(e));
  redrawLabelsOnStyleChange();
});

styleFontShiftY.addEventListener("input", e => {
  const groupStyle = style.labels.groups[styleGroupSelect.value];
  if (groupStyle) groupStyle["data-dy"] = Number(eventValue(e));
  setLegacyStyleAttribute("data-dy", eventValue(e));
  redrawLabelsOnStyleChange();
});

styleStatesBodyOpacity.addEventListener("input", e => {
  window.MapStyleControls.setLayerOpacity("states", eventValue(e));
});

for (const unsupportedStateControl of [
  styleStatesBodyFilter,
  styleStatesHaloWidth,
  styleStatesHaloOpacity,
  styleStatesHaloBlur
]) {
  const row = unsupportedStateControl.closest("tr");
  if (row) row.hidden = true;
}

styleArmiesFillOpacity.addEventListener("input", e => {
  window.MapStyleControls.setMilitaryStyle("fillOpacity", Number(eventValue(e)));
});

styleArmiesSize.addEventListener("input", e => {
  const value = Number(eventValue(e));
  window.MapStyleControls.setMilitaryStyle("boxSize", value);
});

emblemsStateSizeInput.addEventListener("change", e => {
  window.MapStyleControls.setEmblemStyle("stateSize", Number(eventValue(e)));
});

emblemsProvinceSizeInput.addEventListener("change", e => {
  window.MapStyleControls.setEmblemStyle("provinceSize", Number(eventValue(e)));
});

emblemsBurgSizeInput.addEventListener("change", e => {
  window.MapStyleControls.setEmblemStyle("burgSize", Number(eventValue(e)));
});

hideEmblems.addEventListener("change", function () {
  window.MapStyleControls.setEmblemStyle("automaticVisibility", this.checked);
});

styleGoodsCircle.addEventListener("change", function () {
  window.MapStyleControls.setGoodsStyle("icons", "circle", this.checked);
});

styleGoodsSize.addEventListener("change", function () {
  window.MapStyleControls.setGoodsStyle("icons", "size", Number(this.value));
});

styleGoodsBurgsSize.addEventListener("change", function () {
  window.MapStyleControls.setGoodsStyle("burgs", "iconSize", Number(this.value));
});

styleMarketsLayerFillOpacity.addEventListener("input", e =>
  window.MapStyleControls.setMarketStyle("areaOpacity", Number(eventValue(e)))
);

styleMarketsSize.addEventListener("change", function () {
  window.MapStyleControls.setMarketStyle("radius", Number(this.value));
});

styleMarketsIconSize.addEventListener("change", function () {
  window.MapStyleControls.setMarketStyle("iconSize", Number(this.value));
});

styleMarketsIcon.addEventListener("click", function () {
  window.Controllers.IconSelector.open(window.MapStyleControls.getStyle().markets.icon || "⚖️", value => {
    window.MapStyleControls.setMarketStyle("icon", value);
    this.innerHTML = value;
  });
});

// request a URL to image to be used as a texture
function textureProvideURL(): void {
  window.destroyDialog("textureUrlDialog");
  const content = document.createElement("div");
  content.id = "textureUrlDialog";
  content.innerHTML = /* html */ `Provide a texture image URL:
    <input id="textureURL" type="url" style="width: 100%" placeholder="http://www.example.com/image.jpg" />
    <canvas id="texturePreview" width="256px" height="144px"></canvas>`;
  ensureEl("dialogs").appendChild(content);
  const textureUrlInput = content.querySelector<HTMLInputElement>("#textureURL")!;
  textureUrlInput.addEventListener("input", () => fetchTextureURL(textureUrlInput.value));

  window.showDomDialog({
    actions: [
      {
        close: false,
        label: "Apply",
        onClick: () => {
          const url = textureUrlInput.value;
          if (!url) return tip("Please provide a valid URL", false, "error");
          changeTexture(url);
          updateTextureSelectValue(url);
          window.destroyDialog(content.id);
        }
      },
      { label: "Cancel" }
    ],
    content,
    placement: "center",
    placementTarget: document.getElementById("map"),
    resizable: false,
    title: "Load custom texture",
    width: "28em"
  });
}

function fetchTextureURL(url: string): void {
  INFO && console.info("Provided URL is", url);
  const img = new Image();
  img.onload = () => {
    const canvas = ensureEl<HTMLCanvasElement>("texturePreview");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  };
  img.src = url;
}

const vignettePresets: Record<string, string> = {
  default: `{ "#vignette": { "opacity": 0.3, "fill": "#000000", "filter": null }, "#vignette-rect": { "x": "0.3%", "y": "0.4%", "width": "99.6%", "height": "99.2%", "rx": "5%", "ry": "5%", "filter": "blur(20px)" } }`,
  neon: `{ "#vignette": { "opacity": 0.5, "fill": "#7300ff", "filter": null }, "#vignette-rect": { "x": "0.3%", "y": "0.4%", "width": "99.6%", "height": "99.2%", "rx": "0%", "ry": "0%", "filter": "blur(15px)" } }`,
  smoke: `{ "#vignette": { "opacity": 1, "fill": "#000000", "filter": "url(#splotch)" }, "#vignette-rect": { "x": "3%", "y": "5%", "width": "96%", "height": "90%", "rx": "10%", "ry": "10%", "filter": "blur(100px)" } }`,
  wound: `{ "#vignette": { "opacity": 0.8, "fill": "#ff0000", "filter": "url(#paper)"}, "#vignette-rect": {"x": "0.5%", "y": "1%", "width": "99%", "height": "98%", "rx": "5%", "ry": "5%", "filter": "blur(50px)" } }`,
  paper: `{ "#vignette": { "opacity": 1, "fill": "#000000", "filter": "url(#paper)" }, "#vignette-rect": { "x": "0.3%", "y": "0.4%", "width": "99.6%", "height": "99.2%", "rx": "20%", "ry": "20%", "filter": "blur(150px)" } }`,
  granite: `{ "#vignette": { "opacity": 0.95, "fill": "#231b1b", "filter": "url(#crumpled)" }, "#vignette-rect": { "x": "3%", "y": "5%", "width": "94%", "height": "90%", "rx": "20%", "ry": "20%", "filter": "blur(150px)" } }`,
  spotlight: `{ "#vignette": { "opacity": 0.96, "fill": "#000000", "filter": null }, "#vignette-rect": { "x": "20%", "y": "30%", "width": "24%", "height": "30%", "rx": "50%", "ry": "50%", "filter": "blur(30px) "} }`
};

Object.keys(vignettePresets).forEach(preset => {
  styleVignettePreset.options.add(new Option(preset, preset, false, false));
});

styleVignettePreset.addEventListener("change", function () {
  const attributes = JSON.parse(vignettePresets[this.value]) as Record<string, Record<string, string | number | null>>;

  for (const selector in attributes) {
    const el = document.querySelector(selector);
    if (!el) continue;
    for (const attr in attributes[selector]) {
      const value = attributes[selector][attr];
      if (value === null) el.removeAttribute(attr);
      else el.setAttribute(attr, String(value));
    }
  }

  const vignette = ensureEl("vignette");
  if (vignette) {
    styleOpacityInput.value = vignette.getAttribute("opacity") ?? "";
    styleFillInput.value = styleFillOutput.value = vignette.getAttribute("fill") ?? "";
    styleFilterInput.value = vignette.getAttribute("filter") ?? "";
  }

  const maskRect = ensureEl("vignette-rect");
  if (maskRect) {
    const digit = (value: string | null): string => value?.replace(/[^\d.]/g, "") ?? "";
    styleVignetteX.value = digit(maskRect.getAttribute("x"));
    styleVignetteY.value = digit(maskRect.getAttribute("y"));
    styleVignetteWidth.value = digit(maskRect.getAttribute("width"));
    styleVignetteHeight.value = digit(maskRect.getAttribute("height"));
    styleVignetteRx.value = digit(maskRect.getAttribute("rx"));
    styleVignetteRy.value = digit(maskRect.getAttribute("ry"));
    styleVignetteBlur.value = digit(maskRect.getAttribute("filter"));
  }
});

styleVignetteX.addEventListener("input", e => {
  ensureEl("vignette-rect").setAttribute("x", `${eventValue(e)}%`);
});

styleVignetteWidth.addEventListener("input", e => {
  ensureEl("vignette-rect").setAttribute("width", `${eventValue(e)}%`);
});

styleVignetteY.addEventListener("input", e => {
  ensureEl("vignette-rect").setAttribute("y", `${eventValue(e)}%`);
});

styleVignetteHeight.addEventListener("input", e => {
  ensureEl("vignette-rect").setAttribute("height", `${eventValue(e)}%`);
});

styleVignetteRx.addEventListener("input", e => {
  ensureEl("vignette-rect").setAttribute("rx", `${eventValue(e)}%`);
});

styleVignetteRy.addEventListener("input", e => {
  ensureEl("vignette-rect").setAttribute("ry", `${eventValue(e)}%`);
});

styleVignetteBlur.addEventListener("input", e => {
  ensureEl("vignette-rect").setAttribute("filter", `blur(${eventValue(e)}px)`);
});

styleScaleBar.addEventListener("input", event => {
  const { scaleBar } = getViewportSurface();
  const scaleBarBack = scaleBar.select("#scaleBarBack");
  if (!scaleBarBack.size()) return;

  const { id, value } = event.target as StyleValueElement;

  if (id === "styleScaleBarSize") scaleBar.attr("data-bar-size", value);
  else if (id === "styleScaleBarFontSize") scaleBar.attr("font-size", value);
  else if (id === "styleScaleBarPositionX") scaleBar.attr("data-x", value);
  else if (id === "styleScaleBarPositionY") scaleBar.attr("data-y", value);
  else if (id === "styleScaleBarLabel") scaleBar.attr("data-label", value);
  else if (id === "styleScaleBarBackgroundOpacity") scaleBarBack.attr("opacity", value);
  else if (id === "styleScaleBarBackgroundFill") scaleBarBack.attr("fill", value);
  else if (id === "styleScaleBarBackgroundStroke") scaleBarBack.attr("stroke", value);
  else if (id === "styleScaleBarBackgroundStrokeWidth") scaleBarBack.attr("stroke-width", value);
  else if (id === "styleScaleBarBackgroundFilter") scaleBarBack.attr("filter", value);
  else if (id === "styleScaleBarBackgroundPaddingTop") scaleBarBack.attr("data-top", value);
  else if (id === "styleScaleBarBackgroundPaddingRight") scaleBarBack.attr("data-right", value);
  else if (id === "styleScaleBarBackgroundPaddingBottom") scaleBarBack.attr("data-bottom", value);
  else if (id === "styleScaleBarBackgroundPaddingLeft") scaleBarBack.attr("data-left", value);

  if (
    [
      "styleScaleBarSize",
      "styleScaleBarPositionX",
      "styleScaleBarPositionY",
      "styleScaleBarLabel",
      "styleScaleBarBackgroundPaddingLeft",
      "styleScaleBarBackgroundPaddingTop",
      "styleScaleBarBackgroundPaddingRight",
      "styleScaleBarBackgroundPaddingBottom"
    ].includes(id)
  ) {
    drawScaleBar(scaleBar, scale);
    fitScaleBar(scaleBar, svgWidth, svgHeight);
  }
});

// GLOBAL FILTERS
mapFilters.addEventListener("click", applyMapFilter);
function applyMapFilter(event: MouseEvent): void {
  const button = event.target;
  if (!(button instanceof HTMLButtonElement)) return;
  const { svg } = getViewportSurface();
  svg.attr("data-filter", null).attr("filter", null);
  if (button.classList.contains("pressed")) {
    button.classList.remove("pressed");
    return;
  }

  mapFilters.querySelectorAll(".pressed").forEach(button => {
    button.classList.remove("pressed");
  });
  button.classList.add("pressed");
  svg.attr("data-filter", button.id).attr("filter", `url(#filter-${button.id})`);
}

styleTextureUrlButton.addEventListener("click", textureProvideURL);

window.StyleEditor = {
  calculateFriendlyGridSize,
  changeFont,
  edit: editStyle,
  refresh: selectStyleElement,
  updateTextureSelectValue
};
