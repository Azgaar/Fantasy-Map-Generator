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

  // the preset replaces style.layers wholesale, so the outgoing terrain options have to be
  // captured before the swap: relief resizing is relative to the size that is being replaced
  const previousTerrain = {...(style.layers.terrain?.options || {})};

  style = {...style, ...ensureStyleShape(upgraded)};

  for (const layerId of Object.keys(style.layers)) applyLayerStyle(layerId);

  applyTerrainPresetOptions(previousTerrain);
  applyTexturePresetOptions();
  applyLayerOptionAttributes();
  applySingleInstanceOptionElements();
  registerCustomHeightmapSchemes();

  // a group the preset doesn't cover takes the style of the default group of its type. It's left without a
  // style if there is none: getGroupStyle falls back to the built-in style, an empty one would win over it
  const labelGroupStyles = (style.layers.labels.children ??= {});
  for (const group of options.labels.groups) {
    if (labelGroupStyles[group.name]) continue;
    const defaultGroupStyle = labelGroupStyles[Labels.getFallbackGroup(group.type).name];
    if (defaultGroupStyle) labelGroupStyles[group.name] = structuredClone(defaultGroupStyle);
  }

  // relief redraw is the caller's job: applyStyleWithUiRefresh always redraws it (letting
  // drawRelief's own layerIsOn check handle the on/off case); the initial applyStyleOnLoad
  // path runs before pack exists, so drawing here would crash Relief.generate() on pack.cells
}

// set/size are stored on the terrain layer, but the already-generated icons carry baked-in sizes
// and icon ids, so a preset switch has to re-run the Relief side effects. Density is not a style
// value at all (it drives placement) - it lives in the global options and presets never carry it
function applyTerrainPresetOptions(previousTerrain) {
  const {set, size} = style.layers.terrain?.options || {};

  if (size) {
    const ratio = size / (previousTerrain.size || 1);
    if (ratio !== 1) Relief.changeSize(size);
  }

  if (set) Relief.changeSet(set);
}

// texture options (x/y/href) aren't presentation attrs, so applyLayerStyle never writes them;
// drawTexture() (public/modules/ui/layers.js) reads them via getLayerOptions when the layer is
// (re)drawn from scratch, but the nested <image> - once it exists - is cheaper to patch in place
// on a preset switch than to remove and redraw
function applyTexturePresetOptions() {
  const {x, y, href} = style.layers.texture?.options || {};
  const image = document.querySelector("#texture > image");
  if (image) {
    if (x !== undefined) image.setAttribute("x", x);
    if (y !== undefined) image.setAttribute("y", y);
    if (href !== undefined) image.setAttribute("href", href);
  }
}

// options attrs aren't presentation, so applyLayerStyle never writes them to the DOM. armies/
// scaleBar's fontSize is inherited CSS sizing that nothing reads as JS, so the rendered text
// only picks it up from the group attribute - mirror those values back under their pre-migration
// names, matching FLAT_RENAMES in src/services/styles/legacy.ts
const LAYER_OPTION_ATTRIBUTES = {
  // boxSize is dropped: draw-military.ts/regiment-editor.ts read it via getLayerOptions now.
  // fontSize stays DOM-written here - it's inherited by regiment text, nothing reads it as JS
  armies: {fontSize: "font-size"},
  // barSize/x/y/label are dropped: draw-scalebar.ts reads them via getLayerOptions now.
  // fontSize stays DOM-written here - nothing reads it as JS, only CSS inheritance uses it
  scaleBar: {fontSize: "font-size"}
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
    // top/right/bottom/left are dropped: draw-scalebar.ts reads options.scaleBar.back via
    // getLayerOptions now. opacity/fill/stroke/strokeWidth/filter stay DOM-written - nothing
    // reads them as JS, they're purely visual on the #scaleBarBack rect
    const backRenames = {
      opacity: "opacity",
      fill: "fill",
      stroke: "stroke",
      strokeWidth: "stroke-width",
      filter: "filter"
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
