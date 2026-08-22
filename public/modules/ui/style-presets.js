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

  syncPixiCellStylePreset(presetJson);

  function getStyleAttributes(attributes) {
    return Object.fromEntries(Object.entries(attributes).filter(([attribute]) => attribute !== "id"));
  }
}

function syncPixiCellStylePreset(presetJson) {
  const layerSelectors = {
    biomes: "#biomes",
    cells: "#cells",
    cultures: "#cults",
    grid: "#gridOverlay",
    precipitation: "#prec",
    provinces: "#provs",
    religions: "#relig",
    rivers: "#rivers",
    states: "#statesBody",
    temperature: "#temperature",
    zones: "#zones"
  };
  style.mapRenderer ||= {};
  for (const [layer, selector] of Object.entries(layerSelectors)) {
    if (!presetJson[selector]) continue;
    const opacity = presetJson[selector].opacity ?? 1;
    const current = style.mapRenderer[layer] || {};
    style.mapRenderer[layer] = {
      ...current,
      ...(["cells", "grid", "precipitation", "rivers", "temperature", "zones"].includes(layer)
        ? {}
        : {fallbackColor: current.fallbackColor || "#888888"}),
      opacity: Number(opacity)
    };
  }
  for (const [layer, selector] of Object.entries({
    cells: "#cells",
    grid: "#gridOverlay",
    precipitation: "#prec",
    temperature: "#temperature",
    zones: "#zones"
  })) {
    const preset = presetJson[selector];
    if (!preset) continue;
    const layerStyle = style.mapRenderer[layer] || {};
    const stroke = (["grid", "precipitation", "temperature", "zones"].includes(layer)
      ? layerStyle.stroke
      : layerStyle) || {};
    const updatedStroke = {
      ...stroke,
      cap: preset["stroke-linecap"] || stroke.cap || "butt",
      color: preset.stroke || stroke.color || "#333333",
      dash: preset["stroke-dasharray"] || "",
      opacity: layer === "cells" ? Number(preset.opacity ?? stroke.opacity ?? 1) : Number(stroke.opacity ?? 1),
      width: Number(preset["stroke-width"] || 0)
    };
    style.mapRenderer[layer] = ["grid", "precipitation", "temperature", "zones"].includes(layer)
      ? {...layerStyle, stroke: updatedStroke}
      : updatedStroke;
  }
  const gridPreset = presetJson["#gridOverlay"];
  if (gridPreset) {
    style.mapRenderer.grid = {
      ...style.mapRenderer.grid,
      dx: Number(gridPreset.dx || 0),
      dy: Number(gridPreset.dy || 0),
      scale: Number(gridPreset.scale || 1),
      type: gridPreset.type || "pointyHex"
    };
  }
  const precipitationPreset = presetJson["#prec"];
  if (precipitationPreset) {
    style.mapRenderer.precipitation = {
      ...style.mapRenderer.precipitation,
      fill: {
        ...style.mapRenderer.precipitation.fill,
        color: precipitationPreset.fill || style.mapRenderer.precipitation.fill?.color || "#003dff",
        opacity: style.mapRenderer.precipitation.fill?.opacity ?? 1
      }
    };
  }
  const temperaturePreset = presetJson["#temperature"];
  if (temperaturePreset) {
    style.mapRenderer.temperature = {
      ...style.mapRenderer.temperature,
      bandOpacity: Number(temperaturePreset["fill-opacity"] ?? 0.3),
      labels: {
        ...style.mapRenderer.temperature.labels,
        color: temperaturePreset.fill || style.mapRenderer.temperature.labels?.color || "#000000",
        fontFamily: temperaturePreset["font-family"] || "Arial, sans-serif",
        fontSize: Number.parseFloat(temperaturePreset["font-size"] || "8") || 8,
        fontWeight: "bold",
        opacity: style.mapRenderer.temperature.labels?.opacity ?? 1
      }
    };
  }
  const riversPreset = presetJson["#rivers"];
  if (riversPreset) {
    style.mapRenderer.rivers = {
      ...style.mapRenderer.rivers,
      fill: {
        ...style.mapRenderer.rivers.fill,
        color: riversPreset.fill || style.mapRenderer.rivers.fill?.color || "#5d97bb",
        opacity: style.mapRenderer.rivers.fill?.opacity ?? 1
      }
    };
  }
  const routeRoles = {...(style.mapRenderer.routes?.roles || {})};
  for (const group of ["roads", "trails", "searoutes"]) {
    const preset = presetJson[`#${group}`];
    if (!preset) continue;
    const current = routeRoles[group] || style.mapRenderer.routes?.default || {};
    routeRoles[group] = {
      ...current,
      cap: preset["stroke-linecap"] || current.cap || "butt",
      color: preset.stroke || current.color || "#d06324",
      dash: String(preset["stroke-dasharray"] || ""),
      opacity: Number(preset.opacity ?? current.opacity ?? 1),
      width: Number(preset["stroke-width"] || 0)
    };
  }
  style.mapRenderer.routes = {
    ...(style.mapRenderer.routes || {}),
    default: style.mapRenderer.routes?.default || routeRoles.roads,
    roles: routeRoles
  };
  const burgIconRoles = {};
  const burgAnchorRoles = {};
  for (const {name} of options.burgs.groups) {
    const iconPreset = presetJson[`#burgIcons > g#${name}`];
    if (iconPreset) burgIconRoles[name] = pointSymbolStyle(iconPreset, "circle");
    const anchorPreset = presetJson[`#anchors > g#${name}`];
    if (anchorPreset) burgAnchorRoles[name] = pointSymbolStyle(anchorPreset, "anchor");
  }
  if (Object.keys(burgIconRoles).length || Object.keys(burgAnchorRoles).length) {
    style.mapRenderer.burgIcons = {
      anchors: {
        default: burgAnchorRoles.town || Object.values(burgAnchorRoles)[0] || pointSymbolStyle({}, "anchor"),
        roles: burgAnchorRoles
      },
      icons: {
        default: burgIconRoles.town || Object.values(burgIconRoles)[0] || pointSymbolStyle({}, "circle"),
        roles: burgIconRoles
      },
      opacity: 1
    };
  }
  const markerPreset = presetJson["#markers"];
  if (markerPreset) {
    style.mapRenderer.markers = {
      opacity: Number(markerPreset.opacity ?? 1),
      rescale: Boolean(Number(markerPreset.rescale ?? 1))
    };
  }
  const icePreset = presetJson["#ice"];
  if (icePreset) {
    const current = style.mapRenderer.ice || {};
    const area = {
      fill: {
        color: icePreset.fill || current.default?.fill?.color || "#f1f8fe",
        opacity: Number(icePreset.opacity ?? current.default?.fill?.opacity ?? 0.9)
      },
      stroke: {
        cap: icePreset["stroke-linecap"] || current.default?.stroke?.cap || "round",
        color: icePreset.stroke || current.default?.stroke?.color || "#e8f0f6",
        dash: String(icePreset["stroke-dasharray"] || ""),
        opacity: 1,
        width: Number(icePreset["stroke-width"] ?? current.default?.stroke?.width ?? 0.5)
      }
    };
    style.mapRenderer.ice = {default: area, opacity: 1, roles: {glacier: area, iceberg: area}};
  }
  const goodsCellsPreset = presetJson["#goodsCells"];
  const goodsIconsPreset = presetJson["#goodsIcons"];
  const goodsBurgsPreset = presetJson["#goodsBurgs"];
  if (goodsCellsPreset || goodsIconsPreset || goodsBurgsPreset) {
    const current = style.mapRenderer.goods || {};
    style.mapRenderer.goods = {
      ...current,
      burgs: {
        ...(current.burgs || {}),
        iconSize: Number(goodsBurgsPreset?.["data-size"] ?? current.burgs?.iconSize ?? 3),
        opacity: Number(goodsBurgsPreset?.opacity ?? current.burgs?.opacity ?? 1),
        stroke: goodsBurgsPreset?.stroke || current.burgs?.stroke || "#41414f",
        strokeWidth: Number(goodsBurgsPreset?.["stroke-width"] ?? current.burgs?.strokeWidth ?? 0.2)
      },
      cells: {opacity: Number(goodsCellsPreset?.opacity ?? current.cells?.opacity ?? 1)},
      icons: {
        ...(current.icons || {}),
        circle: Boolean(Number(goodsIconsPreset?.["data-circle"] ?? current.icons?.circle ?? 1)),
        opacity: Number(goodsIconsPreset?.opacity ?? current.icons?.opacity ?? 1),
        size: Number(goodsIconsPreset?.["data-size"] ?? current.icons?.size ?? 6),
        strokeWidth: Number(goodsIconsPreset?.["stroke-width"] ?? current.icons?.strokeWidth ?? 0.3)
      },
      opacity: 1
    };
  }
  const marketsPreset = presetJson["#markets"];
  if (marketsPreset) {
    style.mapRenderer.markets = {
      ...(style.mapRenderer.markets || {}),
      areaOpacity: Number(marketsPreset["fill-opacity"] ?? 0.03),
      borderOpacity: Number(marketsPreset["stroke-opacity"] ?? 0.8),
      borderWidth: Number(marketsPreset["stroke-width"] ?? 1),
      icon: marketsPreset["data-icon"] || "⚖️",
      iconSize: Number(marketsPreset["font-size"] ?? 5),
      opacity: Number(marketsPreset.opacity ?? 1),
      radius: Number(marketsPreset["data-size"] ?? 3)
    };
  }
  const populationPreset = presetJson["#population"];
  const ruralPreset = presetJson["#rural"];
  const urbanPreset = presetJson["#urban"];
  if (populationPreset || ruralPreset || urbanPreset) {
    const current = style.mapRenderer.population || {};
    const line = (role, preset, fallbackColor) => ({
      ...(current[role] || {}),
      cap: populationPreset?.["stroke-linecap"] || current[role]?.cap || "butt",
      color: preset?.stroke || current[role]?.color || fallbackColor,
      dash: String(populationPreset?.["stroke-dasharray"] || ""),
      opacity: current[role]?.opacity ?? 1,
      width: Number(populationPreset?.["stroke-width"] ?? current[role]?.width ?? 1.6)
    });
    style.mapRenderer.population = {
      ...current,
      opacity: Number(populationPreset?.opacity ?? current.opacity ?? 1),
      rural: line("rural", ruralPreset, "#0000ff"),
      urban: line("urban", urbanPreset, "#ff0000")
    };
  }
  const armiesPreset = presetJson["#armies"];
  if (armiesPreset) {
    style.mapRenderer.military = {
      ...(style.mapRenderer.military || {}),
      boxSize: Number(armiesPreset["box-size"] ?? 3),
      fillOpacity: Number(armiesPreset["fill-opacity"] ?? 1),
      fontFamily: style.mapRenderer.military?.fontFamily || "Helvetica, Arial, sans-serif",
      opacity: Number(armiesPreset.opacity ?? 1),
      stroke: armiesPreset.stroke || "#000000",
      strokeWidth: Number(armiesPreset["stroke-width"] ?? 0.3),
      textColor: style.mapRenderer.military?.textColor || "#ffffff"
    };
  }
  const compassPreset = presetJson["#compass"];
  const compassUsePreset = presetJson["#compass > use"];
  if (compassPreset || compassUsePreset) {
    const transform = String(compassUsePreset?.transform || "");
    const translate = transform.match(/translate\(\s*([-+.\d]+)[ ,]+([-+.\d]+)/);
    const scale = transform.match(/scale\(\s*([-+.\d]+)/);
    style.mapRenderer.compass = {
      ...(style.mapRenderer.compass || {}),
      opacity: Number(compassPreset?.opacity ?? 0.8),
      scale: Number(scale?.[1] ?? 0.25),
      x: Number(translate?.[1] ?? 80),
      y: Number(translate?.[2] ?? 80)
    };
  }
  const tradePreset = presetJson["#tradeAnimation"];
  if (tradePreset) {
    style.mapRenderer.trade = {
      ...(style.mapRenderer.trade || {}),
      opacity: Number(tradePreset.opacity ?? 1)
    };
  }
  window.dispatchEvent(
    new CustomEvent("map:pixi-renderer:command", {
      detail: {command: "queue-rebuild"}
    })
  );

  function pointSymbolStyle(preset, fallbackIcon) {
    return {
      fill: preset.fill || "#ffffff",
      fillOpacity: Number(preset["fill-opacity"] ?? 1),
      icon: String(preset["data-icon"] || fallbackIcon).replace(/^#?icon-/, ""),
      opacity: Number(preset.opacity ?? 1),
      size: Number(preset["font-size"] || 1),
      stroke: preset.stroke || "#3e3e4b",
      strokeWidth: Number(preset["stroke-width"] || 0)
    };
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

  drawScaleBar(scaleBar, scale);
  fitScaleBar(scaleBar, svgWidth, svgHeight);
  if (layerIsOn("toggleHeight")) drawHeightmap();
  if (legend.selectAll("*").size() && window.redrawLegend) redrawLegend();
  oceanLayers.selectAll("path").remove();
  OceanLayers();
  if (layerIsOn("toggleRulers")) drawMeasurers();
  drawRelief();
  if (layerIsOn("toggleBurgIcons")) redrawPixiLayer("burgIcons");
  drawLabels();

  invokeActiveZooming();
  setPresetRemoveButtonVisibiliy();
}

function addStylePreset() {
  window.showDomDialog({
    content: ensureEl("styleSaver"),
    destroyOnClose: false,
    placement: "center",
    placementTarget: document.getElementById("map"),
    title: "Style Saver",
    width: "26em"
  });

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
    options.burgs.groups.forEach(({ name }) => {
      attributes[`#labels > #${name}`] = burgLabelsAttributes;
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

    const burgStyles = style.mapRenderer?.burgIcons;
    if (burgStyles) {
      for (const {name} of options.burgs.groups) {
        const icon = burgStyles.icons.roles[name] || burgStyles.icons.default;
        const anchor = burgStyles.anchors.roles[name] || burgStyles.anchors.default;
        presetStyle[`#burgIcons > g#${name}`] = serializePointSymbol(icon, true);
        presetStyle[`#anchors > g#${name}`] = serializePointSymbol(anchor, false);
      }
    }
    const markerStyle = style.mapRenderer?.markers;
    if (markerStyle) {
      presetStyle["#markers"] = {opacity: markerStyle.opacity, rescale: Number(markerStyle.rescale), filter: null};
    }
    const iceStyle = style.mapRenderer?.ice;
    if (iceStyle) {
      presetStyle["#ice"] = {
        opacity: iceStyle.default.fill.opacity,
        fill: iceStyle.default.fill.color,
        stroke: iceStyle.default.stroke.color,
        "stroke-width": iceStyle.default.stroke.width,
        filter: null
      };
    }
    const goodsStyle = style.mapRenderer?.goods;
    if (goodsStyle) {
      presetStyle["#goodsCells"] = {opacity: goodsStyle.cells.opacity, filter: null};
      presetStyle["#goodsIcons"] = {
        opacity: goodsStyle.icons.opacity,
        "stroke-width": goodsStyle.icons.strokeWidth,
        "data-circle": Number(goodsStyle.icons.circle),
        "data-size": goodsStyle.icons.size,
        filter: null
      };
      presetStyle["#goodsBurgs"] = {
        opacity: goodsStyle.burgs.opacity,
        stroke: goodsStyle.burgs.stroke,
        "stroke-width": goodsStyle.burgs.strokeWidth,
        "data-size": goodsStyle.burgs.iconSize,
        filter: null
      };
    }
    const marketsStyle = style.mapRenderer?.markets;
    if (marketsStyle) {
      presetStyle["#markets"] = {
        opacity: marketsStyle.opacity,
        "stroke-width": marketsStyle.borderWidth,
        "fill-opacity": marketsStyle.areaOpacity,
        "stroke-opacity": marketsStyle.borderOpacity,
        "data-size": marketsStyle.radius,
        "font-size": marketsStyle.iconSize,
        "data-icon": marketsStyle.icon,
        filter: null
      };
    }
    const populationStyle = style.mapRenderer?.population;
    if (populationStyle) {
      presetStyle["#population"] = {
        opacity: populationStyle.opacity,
        "stroke-width": populationStyle.rural.width,
        "stroke-dasharray": populationStyle.rural.dash,
        "stroke-linecap": populationStyle.rural.cap,
        filter: null
      };
      presetStyle["#rural"] = {stroke: populationStyle.rural.color};
      presetStyle["#urban"] = {stroke: populationStyle.urban.color};
    }
    const militaryStyle = style.mapRenderer?.military;
    if (militaryStyle) {
      presetStyle["#armies"] = {
        opacity: militaryStyle.opacity,
        "font-size": militaryStyle.boxSize * 2,
        "box-size": militaryStyle.boxSize,
        stroke: militaryStyle.stroke,
        "stroke-width": militaryStyle.strokeWidth,
        "fill-opacity": militaryStyle.fillOpacity,
        filter: null
      };
    }
    const compassStyle = style.mapRenderer?.compass;
    if (compassStyle) {
      presetStyle["#compass"] = {opacity: compassStyle.opacity, filter: null, mask: null};
      presetStyle["#compass > use"] = {
        transform: `translate(${compassStyle.x} ${compassStyle.y}) scale(${compassStyle.scale})`
      };
    }
    const tradeStyle = style.mapRenderer?.trade;
    if (tradeStyle) presetStyle["#tradeAnimation"] = {opacity: tradeStyle.opacity, filter: null};

    if (presetStyle["#terrain"]) Object.assign(presetStyle["#terrain"], style.relief);

    function serializePointSymbol(symbol, includeIcon) {
      return {
        ...(includeIcon ? {"data-icon": `#icon-${symbol.icon}`} : {}),
        opacity: symbol.opacity,
        fill: symbol.fill,
        "fill-opacity": symbol.fillOpacity,
        "font-size": symbol.size,
        stroke: symbol.stroke,
        "stroke-width": symbol.strokeWidth
      };
    }

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
    window.destroyDialog("styleSaver");
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
