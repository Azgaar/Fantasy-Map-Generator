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
const RELIEF_STYLE_ATTRIBUTES = ["set", "size", "density"];

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
  for (const selector in presetJson) {
    let labelGroup = null;
    if (selector.startsWith("#labels > #")) {
      labelGroup = selector.split("#").pop();
      style.labels.groups[labelGroup] = getStyleAttributes(presetJson[selector]);
    }

    if (selector.startsWith("#burgIcons")) {
      const group = selector.split("#").pop();
      style.burgIcons[group] = presetJson[selector];
    }

    if (selector.startsWith("#anchors")) {
      const group = selector.split("#").pop();
      style.anchors[group] = presetJson[selector];
    }

    if (selector === "#terrain") {
      const { set, size, density } = presetJson[selector];

      if (size) {
        const ratio = size / style.relief.size;
        style.relief.size = size;
        if (ratio !== 1) Relief.changeSize(size);
      }

      if (set) {
        style.relief.set = set;
        Relief.changeSet(set);
      }

      if (density) style.relief.density = density; // no model change as it would require regeneration
    }

    const el = labelGroup
      ? document.querySelector(`#labels > [data-group="${CSS.escape(labelGroup)}"]`)
      : document.querySelector(selector);
    if (!el) continue;

    for (const attribute in presetJson[selector]) {
      if (attribute === "id") continue;
      if (selector === "#terrain" && RELIEF_STYLE_ATTRIBUTES.includes(attribute)) continue; // stored in style.relief
      const value = presetJson[selector][attribute];

      if (value === "null" || value === null) {
        el.removeAttribute(attribute);
        continue;
      }

      el.setAttribute(attribute, value);

      if (selector === "#texture") {
        const image = document.querySelector("#texture > image");
        if (image) {
          if (attribute === "data-x") image.setAttribute("x", value);
          if (attribute === "data-y") image.setAttribute("y", value);
          if (attribute === "data-href") image.setAttribute("href", value);
        }
      }

      // add custom heightmap color scheme
      if (selector === "#terrs" && attribute === "scheme" && !(value in heightmapColorSchemes)) {
        addCustomColorScheme(value);
      }
    }

    if (selector.startsWith("#labels > #")) {
      const dx = el.dataset.dx || 0;
      const dy = el.dataset.dy || 0;
      el.style.transform = +dx || +dy ? `translate(${dx}em, ${dy}em)` : "";
    }
  }

  // a group the preset doesn't cover takes the style of the default group of its type. It's left without a
  // style if there is none: getGroupStyle falls back to the built-in style, an empty one would win over it
  for (const group of options.labels.groups) {
    if (style.labels.groups[group.name]) continue;
    const defaultGroupStyle = style.labels.groups[Labels.getFallbackGroup(group.type).name];
    if (defaultGroupStyle) style.labels.groups[group.name] = { ...defaultGroupStyle };
  }

  function getStyleAttributes(attributes) {
    return Object.fromEntries(Object.entries(attributes).filter(([attribute]) => attribute !== "id"));
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
      "#markers": ["opacity", "rescale", "filter"],
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
      "#statesHalo": ["opacity", "data-width", "stroke-width", "filter"],
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

    if (presetStyle["#terrain"]) Object.assign(presetStyle["#terrain"], style.relief);

    for (const [group, groupStyle] of Object.entries(style.labels.groups)) {
      addStoredLabelStyle(`#labels > #${group}`, groupStyle);
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
