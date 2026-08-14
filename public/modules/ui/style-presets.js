// UI module to control the style presets
"use strict";

const systemPresets = [
  "default",
  "ancient",
  "gloom",
  "pale",
  "light",
  "watercolor",
  "clean",
  "atlas",
  "darkSeas",
  "cyberpunk",
  "night",
  "monochrome"
];
const customPresetPrefix = "fmgStyle_";

// add style presets to list
{
  const systemOptions = systemPresets.map(styleName => `<option value="${styleName}">${styleName}</option>`);
  const storedStyles = Object.keys(localStorage).filter(key => key.startsWith(customPresetPrefix));
  const customOptions = storedStyles.map(
    styleName => `<option value="${styleName}">${styleName.replace(customPresetPrefix, "")} [custom]</option>`
  );
  const options = systemOptions.join("") + customOptions.join("");
  document.getElementById("stylePreset").innerHTML = options;
}

async function applyStyleOnLoad() {
  const desiredPreset = localStorage.getItem("presetStyle") || "default";
  const styleData = await getStylePreset(desiredPreset);
  const [appliedPreset, style] = styleData;

  applyStylePreset(style);
  updateMapFilter();
  stylePreset.value = stylePreset.dataset.old = appliedPreset;
  setPresetRemoveButtonVisibiliy();
}

async function getStylePreset(desiredPreset) {
  let presetToLoad = desiredPreset;

  const isCustom = !systemPresets.includes(desiredPreset);
  if (isCustom) {
    const storedStyleJSON = localStorage.getItem(desiredPreset);
    if (!storedStyleJSON) {
      ERROR && console.error(`Custom style ${desiredPreset} in not found in localStorage. Applying default style`);
      presetToLoad = "default";
    } else {
      const isValid = JSON.isValid(storedStyleJSON);
      if (isValid) return [desiredPreset, JSON.parse(storedStyleJSON)];

      ERROR &&
        console.error(`Custom style ${desiredPreset} stored in localStorage is not valid. Applying default style`);
      presetToLoad = "default";
    }
  }

  const style = await fetchSystemPreset(presetToLoad);
  return [presetToLoad, style];
}

async function fetchSystemPreset(preset) {
  try {
    const res = await fetch(`./styles/${preset}.json?v=${VERSION}`);
    return await res.json();
  } catch (err) {
    throw new Error("Cannot fetch style preset", preset);
  }
}

function applyStylePreset(presetJson) {
  const upgraded = isLegacyPreset(presetJson)
    ? upgradeLegacyPreset(presetJson, {onUnknownSelector: "skip"})
    : parseStyle(presetJson);

  style = {...style, ...ensureStyleShape(upgraded)};

  for (const layerId of Object.keys(style.layers)) applyLayerStyle(layerId);

  applyTerrainPresetOptions();
  applyTexturePresetOptions();
  applyLayerOptionAttributes();
  applyChildOptionAttributes();
  applySingleInstanceOptionElements();
  registerCustomHeightmapSchemes();
  projectLegacyStyleMirrors();

  // a group the preset doesn't cover takes the style of the default group of its type. It's left without a
  // style if there is none: getGroupStyle falls back to the built-in style, an empty one would win over it
  for (const group of options.labels.groups) {
    if (style.labels.groups[group.name]) continue;
    const defaultGroupStyle = style.labels.groups[Labels.getFallbackGroup(group.type).name];
    if (defaultGroupStyle) style.labels.groups[group.name] = {...defaultGroupStyle};
  }

  // relief redraw is the caller's job: applyStyleWithUiRefresh always redraws it (letting
  // drawRelief's own layerIsOn check handle the on/off case); the initial applyStyleOnLoad
  // path runs before pack exists, so drawing here would crash Relief.generate() on pack.cells
}

// style.relief mirror consumed by the relief editor and Relief.changeSet/changeSize side effects;
// density has no equivalent in the new schema (dropped on upgrade), so the existing value is kept
function applyTerrainPresetOptions() {
  const {set, size} = style.layers.terrain?.options || {};

  if (size) {
    const ratio = size / style.relief.size;
    style.relief.size = size;
    if (ratio !== 1) Relief.changeSize(size);
  }

  if (set) {
    style.relief.set = set;
    Relief.changeSet(set);
  }
}

// texture options (x/y/href) aren't presentation attrs, so applyLayerStyle never writes them;
// port them onto #texture (as the legacy data-x/data-y/data-href attrs) and its nested <image>
function applyTexturePresetOptions() {
  const {x, y, href} = style.layers.texture?.options || {};
  const textureEl = document.getElementById("texture");
  if (textureEl) {
    if (x !== undefined) textureEl.setAttribute("data-x", x);
    if (y !== undefined) textureEl.setAttribute("data-y", y);
    if (href !== undefined) textureEl.setAttribute("data-href", href);
  }

  const image = document.querySelector("#texture > image");
  if (image) {
    if (x !== undefined) image.setAttribute("x", x);
    if (y !== undefined) image.setAttribute("y", y);
    if (href !== undefined) image.setAttribute("href", href);
  }
}

// options attrs aren't presentation, so applyLayerStyle never writes them to the DOM. These
// layers' renderers (legend, grid overlay, markers, markets, ruler, coordinates, temperature,
// armies, scale bar, ocean layers) still read the literal DOM attribute, not getLayerOptions,
// until they're re-homed (Task 12) - mirror the values back under their pre-migration names,
// matching FLAT_RENAMES in src/services/styles/legacy.ts
const LAYER_OPTION_ATTRIBUTES = {
  gridOverlay: {type: "type", scale: "scale", dx: "dx", dy: "dy"},
  markers: {rescale: "rescale"},
  temperature: {fontSize: "data-size"},
  armies: {boxSize: "box-size", fontSize: "font-size"},
  scaleBar: {barSize: "data-bar-size", x: "data-x", y: "data-y", label: "data-label", fontSize: "font-size"},
  oceanLayers: {layers: "layers"}
};

function applyLayerOptionAttributes() {
  for (const [layerId, renames] of Object.entries(LAYER_OPTION_ATTRIBUTES)) {
    const layerOptions = style.layers[layerId]?.options;
    if (!layerOptions) continue;

    const el = document.getElementById(layerId);
    if (!el) continue;

    for (const [optionKey, attribute] of Object.entries(renames)) {
      if (optionKey in layerOptions) setStyleAttribute(el, attribute, layerOptions[optionKey]);
    }
  }
}

// same idea as LAYER_OPTION_ATTRIBUTES, but for options living on a CHILD node - matching
// CHILD_RULES/HEIGHTS_RENAMES/EMBLEMS_RENAMES in src/services/styles/legacy.ts. keyed
// "layerId/childId", DOM element looked up by the child's own id
const CHILD_OPTION_ATTRIBUTES = {
  "terrs/landHeights": {scheme: "scheme", terracing: "terracing", skip: "skip", relax: "relax", curve: "curve"},
  "terrs/oceanHeights": {scheme: "scheme", terracing: "terracing", skip: "skip", relax: "relax", curve: "curve"},
  "regions/statesHalo": {width: "data-width"}
};

function applyChildOptionAttributes() {
  for (const [path, renames] of Object.entries(CHILD_OPTION_ATTRIBUTES)) {
    const [layerId, childId] = path.split("/");
    const childOptions = style.layers[layerId]?.children?.[childId]?.options;
    if (!childOptions) continue;

    const el = document.getElementById(childId);
    if (!el) continue;

    for (const [optionKey, attribute] of Object.entries(renames)) {
      if (optionKey in childOptions) setStyleAttribute(el, attribute, childOptions[optionKey]);
    }
  }

  // burgIcons/anchors groups share child ids across the two layers (e.g. both have a "capital"
  // group), so they need a layer-scoped selector rather than document.getElementById. The DOM
  // write here (not just the style.burgIcons/style.anchors mirror) is mandatory: createIconGroups
  // (src/renderers/draw-burg-icons.ts) harvests these DOM attributes before recreating the groups
  for (const layerId of ["burgIcons", "anchors"]) {
    const children = style.layers[layerId]?.children || {};
    for (const [name, node] of Object.entries(children)) {
      if (!node.options || !("size" in node.options)) continue;
      const el = document.querySelector(`#${layerId} > g#${CSS.escape(name)}`);
      if (el) setStyleAttribute(el, "font-size", node.options.size);
    }
  }
}

// single-instance nested elements parked on a parent layer's options (compass > use, vignette-rect,
// scaleBarBack, oceanBase, oceanicPattern), matching the CHILD_RULES-adjacent handling in legacy.ts
function applySingleInstanceOptionElements() {
  const use = style.layers.compass?.options?.use;
  if (use && use.x !== undefined && use.y !== undefined && use.scale !== undefined) {
    const useEl = document.querySelector("#compass > use");
    if (useEl) useEl.setAttribute("transform", `translate(${use.x} ${use.y}) scale(${use.scale})`);
  }

  const rect = style.layers.vignette?.options?.rect;
  if (rect) {
    const rectEl = document.getElementById("vignette-rect");
    if (rectEl) for (const [attribute, value] of Object.entries(rect)) setStyleAttribute(rectEl, attribute, value);
  }

  const back = style.layers.scaleBar?.options?.back;
  if (back) {
    const backEl = document.getElementById("scaleBarBack");
    const backRenames = {
      opacity: "opacity",
      fill: "fill",
      stroke: "stroke",
      strokeWidth: "stroke-width",
      filter: "filter",
      top: "data-top",
      right: "data-right",
      bottom: "data-bottom",
      left: "data-left"
    };
    if (backEl)
      for (const [optionKey, attribute] of Object.entries(backRenames))
        if (optionKey in back) setStyleAttribute(backEl, attribute, back[optionKey]);
  }

  const baseFill = style.layers.oceanLayers?.options?.baseFill;
  if (baseFill !== undefined) {
    const oceanBaseEl = document.getElementById("oceanBase");
    if (oceanBaseEl) setStyleAttribute(oceanBaseEl, "fill", baseFill);
  }

  const pattern = style.layers.oceanLayers?.options?.pattern;
  if (pattern) {
    const patternEl = document.getElementById("oceanicPattern");
    if (patternEl)
      for (const [attribute, value] of Object.entries(pattern)) setStyleAttribute(patternEl, attribute, value);
  }
}

function setStyleAttribute(el, attribute, value) {
  if (value === null) el.removeAttribute(attribute);
  else el.setAttribute(attribute, value);
}

function registerCustomHeightmapSchemes() {
  const {oceanHeights, landHeights} = style.layers.terrs?.children || {};
  const oceanScheme = oceanHeights?.options?.scheme;
  if (oceanScheme && !(oceanScheme in heightmapColorSchemes)) addCustomColorScheme(oceanScheme);
  const landScheme = landHeights?.options?.scheme;
  if (landScheme && !(landScheme in heightmapColorSchemes)) addCustomColorScheme(landScheme);
}

// projects style.layers back onto the legacy attribute-name-keyed bags that getGroupStyle
// (src/renderers/labels/label-groups.ts) and createIconGroups (src/renderers/draw-burg-icons.ts)
// still read directly. Temporary scaffolding, removed when those renderers are re-homed (Task 12)
function projectLegacyStyleMirrors() {
  const labelsChildren = style.layers.labels?.children || {};
  for (const [name, node] of Object.entries(labelsChildren)) {
    style.labels.groups[name] = projectStyleNode(node, {fontSize: "data-size", dx: "data-dx", dy: "data-dy"});
  }

  const burgIconsChildren = style.layers.burgIcons?.children || {};
  for (const [name, node] of Object.entries(burgIconsChildren)) {
    style.burgIcons[name] = projectStyleNode(node, {size: "font-size"});
  }

  const anchorsChildren = style.layers.anchors?.children || {};
  for (const [name, node] of Object.entries(anchorsChildren)) {
    style.anchors[name] = projectStyleNode(node, {size: "font-size"});
  }
}

function projectStyleNode(node, optionRenames) {
  const attributes = {...(node.presentation || {})};
  for (const [optionKey, attribute] of Object.entries(optionRenames)) {
    if (node.options && optionKey in node.options) attributes[attribute] = node.options[optionKey];
  }
  return attributes;
}

function requestStylePresetChange(preset) {
  const isConfirmed = sessionStorage.getItem("styleChangeConfirmed");
  if (isConfirmed) return changeStyle(preset);

  confirmationDialog({
    title: "Change style preset",
    message: "Are you sure you want to change the style preset? All unsaved style changes will be lost",
    confirm: "Change",
    onConfirm: () => {
      sessionStorage.setItem("styleChangeConfirmed", true);
      changeStyle(preset);
    },
    onCancel: () => {
      stylePreset.value = stylePreset.dataset.old;
    }
  });
}

async function changeStyle(desiredPreset) {
  const styleData = await getStylePreset(desiredPreset);
  const [presetName, style] = styleData;
  localStorage.setItem("presetStyle", presetName);
  applyStyleWithUiRefresh(style);
}

function applyStyleWithUiRefresh(style) {
  applyStylePreset(style);
  selectStyleElement(); // re-select element to trigger values update
  updateMapFilter();
  stylePreset.dataset.old = stylePreset.value;

  drawScaleBar(scaleBar, scale);
  fitScaleBar(scaleBar, svgWidth, svgHeight);
  if (layerIsOn("toggleHeight")) drawHeightmap();
  if (legend.selectAll("*").size() && window.redrawLegend) redrawLegend();
  oceanLayers.selectAll("path").remove();
  OceanLayers();
  if (layerIsOn("toggleRulers")) drawMeasurers();
  drawRelief();
  if (layerIsOn("toggleBurgIcons")) drawBurgIcons();
  drawLabels();

  invokeActiveZooming();
  setPresetRemoveButtonVisibiliy();
}

function addStylePreset() {
  $("#styleSaver").dialog({ title: "Style Saver", width: "26em", position: { my: "center", at: "center", of: "svg" } });

  const styleName = stylePreset.value.replace(customPresetPrefix, "");
  document.getElementById("styleSaverName").value = styleName;
  styleSaverJSON.value = collectStyleData();
  checkName();

  if (modules.saveStyle) return;
  modules.saveStyle = true;

  // add listeners
  document.getElementById("styleSaverName").addEventListener("input", checkName);
  document.getElementById("styleSaverSave").addEventListener("click", saveStyle);
  document.getElementById("styleSaverDownload").addEventListener("click", styleDownload);
  document.getElementById("styleSaverLoad").addEventListener("click", () => styleToLoad.click());
  document.getElementById("styleToLoad").addEventListener("change", loadStyleFile);

  function collectStyleData() {
    return JSON.stringify(style, null, 2);
  }

  function checkName() {
    const styleName = customPresetPrefix + styleSaverName.value;

    const isSystem = systemPresets.includes(styleName) || systemPresets.includes(styleSaverName.value);
    if (isSystem) return (styleSaverTip.innerHTML = "default");

    const isExisting = Array.from(stylePreset.options).some(option => option.value == styleName);
    if (isExisting) return (styleSaverTip.innerHTML = "existing");

    styleSaverTip.innerHTML = "new";
  }

  function saveStyle() {
    const styleJSON = styleSaverJSON.value;
    const desiredName = styleSaverName.value;

    if (!styleJSON) return tip("Please provide a style JSON", false, "error");
    if (!JSON.isValid(styleJSON)) return tip("JSON string is not valid, please check the format", false, "error");
    if (!desiredName) return tip("Please provide a preset name", false, "error");
    if (styleSaverTip.innerHTML === "default")
      return tip("You cannot overwrite default preset, please change the name", false, "error");

    const presetName = customPresetPrefix + desiredName;
    applyOption(stylePreset, presetName, desiredName + " [custom]");
    localStorage.setItem("presetStyle", presetName);
    localStorage.setItem(presetName, styleJSON);

    applyStyleWithUiRefresh(JSON.parse(styleJSON));
    tip("Style preset is saved and applied", false, "success", 4000);
    $("#styleSaver").dialog("close");
  }

  function styleDownload() {
    const styleJSON = styleSaverJSON.value;
    const styleName = styleSaverName.value;

    if (!styleJSON) return tip("Please provide a style JSON", false, "error");
    if (!JSON.isValid(styleJSON)) return tip("JSON string is not valid, please check the format", false, "error");
    if (!styleName) return tip("Please provide a preset name", false, "error");

    downloadFile(styleJSON, styleName + ".json", "application/json");
  }

  function loadStyleFile() {
    const fileName = this.files[0]?.name.replace(/\.[^.]*$/, "");
    uploadFile(this, styleUpload);

    function styleUpload(dataLoaded) {
      if (!dataLoaded) return tip("Cannot load the file. Please check the data format", false, "error");
      const isValid = JSON.isValid(dataLoaded);
      if (!isValid) return tip("Loaded data is not a valid JSON, please check the format", false, "error");

      styleSaverJSON.value = JSON.stringify(JSON.parse(dataLoaded), null, 2);
      styleSaverName.value = fileName;
      checkName();
      tip("Style preset is uploaded", false, "success", 4000);
    }
  }
}

function requestRemoveStylePreset() {
  const isDefault = systemPresets.includes(stylePreset.value);
  if (isDefault) return tip("Cannot remove system preset", false, "error");

  confirmationDialog({
    title: "Remove style preset",
    message: "Are you sure you want to remove the style preset? This action cannot be undone.",
    confirm: "Remove",
    onConfirm: removeStylePreset
  });
}

function removeStylePreset() {
  localStorage.removeItem("presetStyle");
  localStorage.removeItem(stylePreset.value);
  stylePreset.selectedOptions[0].remove();

  changeStyle("default");
}

function updateMapFilter() {
  const filter = svg.attr("data-filter");
  mapFilters.querySelectorAll(".pressed").forEach(button => button.classList.remove("pressed"));
  if (!filter) return;
  mapFilters.querySelector("#" + filter).classList.add("pressed");
}

function setPresetRemoveButtonVisibiliy() {
  const isDefault = systemPresets.includes(stylePreset.value);
  removeStyleButton.style.display = isDefault ? "none" : "inline-block";
}
