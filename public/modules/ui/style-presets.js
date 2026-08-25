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
  // the default preset ships in the bundle (src/generators/default-styles.json), not as a fetchable asset
  if (preset === "default") return Styles.defaults;
  try {
    const res = await fetch(`./styles/${preset}.json?v=${VERSION}`);
    return await res.json();
  } catch (err) {
    throw new Error("Cannot fetch style preset", preset);
  }
}

function applyStylePreset(presetJson) {
  const parsed = stylesLegacy.isLegacyPreset(presetJson)
    ? stylesLegacy.presetFromLegacy(presetJson, {onUnknown: "skip"})
    : Styles.parse(presetJson);

  const previousReliefSize = styles.relief.options.size;
  Styles.set(parsed);
  applyStoredStyles();

  applyReliefOptions(previousReliefSize);
  registerCustomScheme();
  fillMissingLabelGroups();
}

function applyStoredStyles() {
  Styles.write(...Object.keys(styles));
  projectPresetOptions();
}

function applyReliefOptions(previousSize) {
  const {set, size} = styles.relief.options;
  if (size && size / previousSize !== 1) Relief.changeSize(size / previousSize);
  if (set) Relief.changeSet(set);
}

function registerCustomScheme() {
  for (const {options} of [styles.heightmap.landHeights, styles.heightmap.oceanHeights]) {
    if (!(options.scheme in heightmapColorSchemes)) addCustomColorScheme(options.scheme);
  }
}

function fillMissingLabelGroups() {
  // a group the preset doesn't cover takes the style of the default group of its type. It's left without a
  // style if there is none: getGroupStyle falls back to the built-in style, an empty one would win over it
  for (const group of options.labels.groups) {
    if (styles.labels.groups[group.name]) continue;
    const defaultGroupStyle = styles.labels.groups[Labels.getFallbackGroup(group.type).name];
    if (defaultGroupStyle) styles.labels.groups[group.name] = structuredClone(defaultGroupStyle);
  }
}

function setOrRemove(el, attribute, value) {
  if (el == null) return;
  if (value == null) el.removeAttribute(attribute);
  else el.setAttribute(attribute, value);
}

function writeAttrsById(id, attrs) {
  const el = document.getElementById(id);
  if (!el) return;
  for (const [attribute, value] of Object.entries(attrs)) setOrRemove(el, attribute, value);
}

// Transitional: renderers that still read these options from DOM attributes (not yet
// migrated to read `styles` directly) get them written here, byte-for-byte where the legacy
// selector-keyed loop wrote them. Each row dies once its owning renderer is ported.
function projectPresetOptions() {
  const byId = id => document.getElementById(id);

  setOrRemove(byId("map"), "data-filter", styles.map.options.dataFilter);

  const armies = byId("armies");
  setOrRemove(armies, "font-size", styles.military.options.fontSize);
  setOrRemove(armies, "box-size", styles.military.options.boxSize);

  setOrRemove(byId("sea_island"), "auto-filter", styles.coastline.sea_island.options.autoFilter);

  const gridOverlay = byId("gridOverlay");
  setOrRemove(gridOverlay, "type", styles.grid.options.type);
  setOrRemove(gridOverlay, "scale", styles.grid.options.scale);
  setOrRemove(gridOverlay, "dx", styles.grid.options.dx);
  setOrRemove(gridOverlay, "dy", styles.grid.options.dy);

  const landHeights = byId("landHeights");
  setOrRemove(landHeights, "scheme", styles.heightmap.landHeights.options.scheme);
  setOrRemove(landHeights, "terracing", styles.heightmap.landHeights.options.terracing);
  setOrRemove(landHeights, "skip", styles.heightmap.landHeights.options.skip);
  setOrRemove(landHeights, "relax", styles.heightmap.landHeights.options.relax);
  setOrRemove(landHeights, "curve", styles.heightmap.landHeights.options.curve);

  const oceanHeights = byId("oceanHeights");
  setOrRemove(oceanHeights, "scheme", styles.heightmap.oceanHeights.options.scheme);
  setOrRemove(oceanHeights, "terracing", styles.heightmap.oceanHeights.options.terracing);
  setOrRemove(oceanHeights, "skip", styles.heightmap.oceanHeights.options.skip);
  setOrRemove(oceanHeights, "relax", styles.heightmap.oceanHeights.options.relax);
  setOrRemove(oceanHeights, "curve", styles.heightmap.oceanHeights.options.curve);
  setOrRemove(oceanHeights, "data-render", Number(styles.heightmap.oceanHeights.options.render));

  setOrRemove(byId("goodsIcons"), "data-circle", Number(styles.goods.goodsIcons.options.circle));

  const markets = byId("markets");
  setOrRemove(markets, "font-size", styles.markets.options.fontSize);
  setOrRemove(markets, "data-icon", styles.markets.options.icon);

  const scaleBar = byId("scaleBar");
  setOrRemove(scaleBar, "data-bar-size", styles.scaleBar.options.barSize);
  setOrRemove(scaleBar, "data-x", styles.scaleBar.options.x);
  setOrRemove(scaleBar, "data-y", styles.scaleBar.options.y);
  setOrRemove(scaleBar, "data-label", styles.scaleBar.options.label);

  const scaleBarBack = byId("scaleBarBack");
  setOrRemove(scaleBarBack, "data-top", styles.scaleBar.back.options.top);
  setOrRemove(scaleBarBack, "data-right", styles.scaleBar.back.options.right);
  setOrRemove(scaleBarBack, "data-bottom", styles.scaleBar.back.options.bottom);
  setOrRemove(scaleBarBack, "data-left", styles.scaleBar.back.options.left);
  writeAttrsById("scaleBarBack", styles.scaleBar.back.attrs);

  const legend = byId("legend");
  setOrRemove(legend, "data-x", styles.legend.options.x);
  setOrRemove(legend, "data-y", styles.legend.options.y);
  setOrRemove(legend, "data-columns", styles.legend.options.columns);

  writeAttrsById("legendBox", styles.legend.box.attrs);

  const vignetteRect = byId("vignette-rect");
  setOrRemove(vignetteRect, "x", styles.vignette.options.x);
  setOrRemove(vignetteRect, "y", styles.vignette.options.y);
  setOrRemove(vignetteRect, "width", styles.vignette.options.width);
  setOrRemove(vignetteRect, "height", styles.vignette.options.height);
  setOrRemove(vignetteRect, "rx", styles.vignette.options.rx);
  setOrRemove(vignetteRect, "ry", styles.vignette.options.ry);
  setOrRemove(vignetteRect, "filter", styles.vignette.options.filter);

  setOrRemove(byId("oceanLayers"), "layers", styles.ocean.oceanLayers.options.outline);

  const oceanicPattern = byId("oceanicPattern");
  setOrRemove(oceanicPattern, "href", styles.ocean.options.pattern);
  setOrRemove(oceanicPattern, "opacity", styles.ocean.options.patternOpacity);

  const texture = byId("texture");
  setOrRemove(texture, "data-href", styles.texture.options.href);
  setOrRemove(texture, "data-x", styles.texture.options.x);
  setOrRemove(texture, "data-y", styles.texture.options.y);
  const textureImage = texture ? texture.querySelector("image") : null;
  setOrRemove(textureImage, "href", styles.texture.options.href);
  setOrRemove(textureImage, "x", styles.texture.options.x);
  setOrRemove(textureImage, "y", styles.texture.options.y);

  for (const [group, style] of Object.entries(styles.labels.groups)) {
    const el = document.querySelector(`#labels > [data-group="${CSS.escape(group)}"]`);
    if (!el) continue;
    const {dx, dy} = style.options;
    setOrRemove(el, "data-dx", dx);
    setOrRemove(el, "data-dy", dy);
    el.style.transform = dx || dy ? `translate(${dx}em, ${dy}em)` : "";
  }
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

  Layers.drawAll(); // a style change can affect any layer, so redraw the active ones

  invokeActiveZooming();
  setPresetRemoveButtonVisibiliy();
}

function addStylePreset() {
  $("#styleSaver").dialog({ title: "Style Saver", width: "26em", position: { my: "center", at: "center", of: "svg" } });

  const styleName = stylePreset.value.replace(customPresetPrefix, "");
  document.getElementById("styleSaverName").value = styleName;
  styleSaverJSON.value = JSON.stringify(collectStyleData(), null, 2);
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
    const presetStyle = {};
    const attributes = {
      "#map": ["background-color", "filter", "data-filter"],
      "#armies": ["font-size", "box-size", "stroke", "stroke-width", "fill-opacity", "filter"],
      "#biomes": ["opacity", "filter", "mask"],
      "#stateBorders": ["opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "filter"],
      "#provinceBorders": ["opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "filter"],
      "#cells": ["opacity", "stroke", "stroke-width", "filter", "mask"],
      "#gridOverlay": [
        "opacity",
        "scale",
        "dx",
        "dy",
        "type",
        "stroke",
        "stroke-width",
        "stroke-dasharray",
        "stroke-linecap",
        "transform",
        "filter",
        "mask"
      ],
      "#coordinates": [
        "opacity",
        "data-size",
        "font-size",
        "stroke",
        "stroke-width",
        "stroke-dasharray",
        "stroke-linecap",
        "filter",
        "mask"
      ],
      "#compass": ["opacity", "transform", "filter", "mask", "shape-rendering"],
      "#compass > use": ["transform"],
      "#relig": ["opacity", "stroke", "stroke-width", "filter"],
      "#cults": ["opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "filter"],
      "#landmass": ["opacity", "fill", "filter"],
      "#markers": ["opacity", "filter"],
      "#prec": ["opacity", "stroke", "stroke-width", "fill", "filter"],
      "#population": ["opacity", "stroke-width", "stroke-dasharray", "stroke-linecap", "filter"],
      "#markets": [
        "opacity",
        "stroke-width",
        "fill-opacity",
        "stroke-opacity",
        "data-size",
        "font-size",
        "data-icon",
        "filter"
      ],
      "#goodsCells": ["opacity", "filter"],
      "#goodsIcons": ["opacity", "stroke-width", "data-circle", "data-size", "filter"],
      "#goodsBurgs": ["opacity", "stroke", "stroke-width", "data-size", "filter"],
      "#tradeAnimation": ["opacity", "filter"],
      "#rural": ["stroke"],
      "#urban": ["stroke"],
      "#freshwater": ["opacity", "fill", "stroke", "stroke-width", "filter"],
      "#salt": ["opacity", "fill", "stroke", "stroke-width", "filter"],
      "#sinkhole": ["opacity", "fill", "stroke", "stroke-width", "filter"],
      "#frozen": ["opacity", "fill", "stroke", "stroke-width", "filter"],
      "#lava": ["opacity", "fill", "stroke", "stroke-width", "filter"],
      "#dry": ["opacity", "fill", "stroke", "stroke-width", "filter"],
      "#sea_island": ["opacity", "stroke", "stroke-width", "filter", "auto-filter"],
      "#lake_island": ["opacity", "stroke", "stroke-width", "filter"],
      "#terrain": ["opacity", "filter", "mask"],
      "#rivers": ["opacity", "filter", "fill"],
      "#ruler": ["opacity", "data-size", "font-size", "stroke-width", "stroke-dasharray", "stroke-linecap", "filter"],
      "#roads": ["opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "filter", "mask"],
      "#trails": ["opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "filter", "mask"],
      "#searoutes": ["opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "filter", "mask"],
      "#statesBody": ["opacity", "filter"],
      "#statesHalo": ["opacity", "stroke-width", "filter"],
      "#provs": ["opacity", "fill", "font-size", "font-family", "filter"],
      "#temperature": [
        "opacity",
        "font-size",
        "fill",
        "fill-opacity",
        "stroke",
        "stroke-width",
        "stroke-dasharray",
        "stroke-linecap",
        "filter"
      ],
      "#ice": ["opacity", "fill", "stroke", "stroke-width", "filter"],
      "#emblems": ["opacity", "stroke-width", "filter"],
      "#emblems > #stateEmblems": ["data-size"],
      "#emblems > #provinceEmblems": ["data-size"],
      "#emblems > #burgEmblems": ["data-size"],
      "#texture": ["opacity", "filter", "mask", "data-x", "data-y", "data-href"],
      "#zones": ["opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "filter", "mask"],
      "#oceanLayers": ["filter", "layers"],
      "#oceanBase": ["fill"],
      "#oceanicPattern": ["href", "opacity"],
      "#terrs #oceanHeights": [
        "data-render",
        "opacity",
        "scheme",
        "terracing",
        "skip",
        "relax",
        "curve",
        "filter",
        "mask"
      ],
      "#terrs #landHeights": ["opacity", "scheme", "terracing", "skip", "relax", "curve", "filter", "mask"],
      "#legend": [
        "data-size",
        "font-size",
        "font-family",
        "stroke",
        "stroke-width",
        "stroke-dasharray",
        "stroke-linecap",
        "data-x",
        "data-y",
        "data-columns"
      ],
      "#legendBox": ["fill", "fill-opacity"],
      "#labels > #state": [
        "opacity",
        "fill",
        "stroke",
        "stroke-width",
        "style",
        "letter-spacing",
        "data-size",
        "font-size",
        "font-family",
        "filter"
      ],
      "#labels > #province": [
        "opacity",
        "fill",
        "stroke",
        "stroke-width",
        "style",
        "letter-spacing",
        "data-size",
        "font-size",
        "font-family",
        "filter"
      ],
      "#labels > #added": [
        "opacity",
        "fill",
        "stroke",
        "stroke-width",
        "style",
        "letter-spacing",
        "data-size",
        "font-size",
        "font-family",
        "filter"
      ],
      "#fogging": ["opacity", "fill", "filter"],
      "#vignette": ["opacity", "fill", "filter"],
      "#vignette-rect": ["x", "y", "width", "height", "rx", "ry", "filter"],
      "#scaleBar": ["opacity", "fill", "font-size", "data-bar-size", "data-x", "data-y", "data-label"],
      "#scaleBarBack": [
        "opacity",
        "fill",
        "stroke",
        "stroke-width",
        "filter",
        "data-top",
        "data-right",
        "data-bottom",
        "data-left"
      ]
    };

    const burgLabelsAttributes = [
      "opacity",
      "fill",
      "stroke",
      "stroke-width",
      "style",
      "letter-spacing",
      "data-size",
      "font-size",
      "font-family",
      "data-dx",
      "data-dy"
    ];
    const burgIconsAttributes = [
      "opacity",
      "data-icon",
      "font-size",
      "fill",
      "fill-opacity",
      "stroke",
      "stroke-width",
      "stroke-dasharray",
      "stroke-linecap",
      "stroke-linejoin",
      "filter"
    ];
    const anchorsAttributes = ["opacity", "fill", "font-size", "stroke", "stroke-width", "filter"];
    options.burgs.groups.forEach(({ name }) => {
      attributes[`#labels > #${name}`] = burgLabelsAttributes;
      attributes[`#burgIcons > g#${name}`] = burgIconsAttributes;
      attributes[`#anchors > g#${name}`] = anchorsAttributes;
    });

    for (const selector in attributes) {
      const el = document.querySelector(selector);
      if (!el) continue;

      presetStyle[selector] = {};
      for (const attr of attributes[selector]) {
        let value = el.style[attr] || el.getAttribute(attr);
        if (attr === "font-size" && selector !== "#markets" && el.hasAttribute("data-size"))
          value = el.getAttribute("data-size");
        presetStyle[selector][attr] = parseValue(value);
      }
    }

    if (presetStyle["#terrain"]) Object.assign(presetStyle["#terrain"], styles.relief.options);
    if (presetStyle["#markers"]) presetStyle["#markers"].rescale = styles.markers.options.rescale;
    if (presetStyle["#statesHalo"])
      presetStyle["#statesHalo"]["data-width"] = styles.states.statesHalo.options.width;
    if (presetStyle["#coordinates"]) {
      presetStyle["#coordinates"]["data-size"] = styles.coordinates.options.fontSize;
      presetStyle["#coordinates"]["font-size"] = styles.coordinates.options.fontSize;
    }
    if (presetStyle["#ruler"]) {
      presetStyle["#ruler"]["data-size"] = styles.rulers.options.fontSize;
      presetStyle["#ruler"]["font-size"] = styles.rulers.options.fontSize;
    }
    if (presetStyle["#legend"]) {
      presetStyle["#legend"]["data-size"] = styles.legend.options.fontSize;
      presetStyle["#legend"]["font-size"] = styles.legend.options.fontSize;
    }
    if (presetStyle["#emblems > #stateEmblems"])
      presetStyle["#emblems > #stateEmblems"]["data-size"] = styles.emblems.stateEmblems.options.size;
    if (presetStyle["#emblems > #provinceEmblems"])
      presetStyle["#emblems > #provinceEmblems"]["data-size"] = styles.emblems.provinceEmblems.options.size;
    if (presetStyle["#emblems > #burgEmblems"])
      presetStyle["#emblems > #burgEmblems"]["data-size"] = styles.emblems.burgEmblems.options.size;
    if (presetStyle["#goodsIcons"]) presetStyle["#goodsIcons"]["data-size"] = styles.goods.goodsIcons.options.size;
    if (presetStyle["#goodsBurgs"]) presetStyle["#goodsBurgs"]["data-size"] = styles.goods.goodsBurgs.options.size;
    if (presetStyle["#markets"]) presetStyle["#markets"]["data-size"] = styles.markets.options.size;

    for (const [group, groupStyle] of Object.entries(styles.labels.groups)) {
      addStoredLabelStyle(`#labels > #${group}`, stylesLegacy.labelGroupToLegacy(groupStyle));
    }

    function addStoredLabelStyle(selector, groupStyle) {
      if (!groupStyle) return;
      presetStyle[selector] = Object.fromEntries(
        Object.entries(groupStyle)
          .filter(([key]) => key !== "id" && key !== "transform")
          .map(([key, value]) => [key, parseValue(value)])
      );
    }

    function parseValue(value) {
      if (value === "null" || value === null) return null;
      if (value === "") return "";
      if (!isNaN(+value)) return +value;
      return value;
    }

    return presetStyle;
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
  const filter = d3.select("#map").attr("data-filter");
  mapFilters.querySelectorAll(".pressed").forEach(button => button.classList.remove("pressed"));
  if (!filter) return;
  mapFilters.querySelector("#" + filter).classList.add("pressed");
}

function setPresetRemoveButtonVisibiliy() {
  const isDefault = systemPresets.includes(stylePreset.value);
  removeStyleButton.style.display = isDefault ? "none" : "inline-block";
}
