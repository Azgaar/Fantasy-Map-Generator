// UI module to control the style
"use strict";

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

function storeStyleOption(ev) {
  if (ev.target.dataset.stored) lock(ev.target.dataset.stored);
}

// select element to be edited
function editStyle(element, group) {
  showOptions();
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

// Color schemes
const heightmapColorSchemes = {
  bright: d3.scaleSequential(d3.interpolateSpectral),
  light: d3.scaleSequential(d3.interpolateRdYlGn),
  natural: d3.scaleSequential(d3.interpolateRgbBasis(["white", "#EEEECC", "tan", "green", "teal"])),
  green: d3.scaleSequential(d3.interpolateGreens),
  olive: d3.scaleSequential(d3.interpolateRgbBasis(["#ffffff", "#cea48d", "#d5b085", "#0c2c19", "#151320"])),
  livid: d3.scaleSequential(d3.interpolateRgbBasis(["#BBBBDD", "#2A3440", "#17343B", "#0A1E24"])),
  monochrome: d3.scaleSequential(d3.interpolateGreys)
};

// add default color schemes to the list of options
ensureEl("styleHeightmapScheme").innerHTML = Object.keys(heightmapColorSchemes)
  .map(scheme => `<option value="${scheme}">${scheme}</option>`)
  .join("");

function addCustomColorScheme(scheme) {
  const stops = scheme.split(",");
  heightmapColorSchemes[scheme] = d3.scaleSequential(d3.interpolateRgbBasis(stops));
  ensureEl("styleHeightmapScheme").options.add(new Option(scheme, scheme, false, true));
}

function getColorScheme(scheme = "bright") {
  if (!(scheme in heightmapColorSchemes)) {
    const colors = scheme.split(",");
    heightmapColorSchemes[scheme] = d3.scaleSequential(d3.interpolateRgbBasis(colors));
  }

  return heightmapColorSchemes[scheme];
}

function getColor(value, scheme = getColorScheme("bright")) {
  return scheme(1 - (value < 20 ? value - 5 : value) / 100);
}

// element select value -> style store LayerId; only elements whose DOM id/select value
// differs from the LayerId (or that live as a child of another layer) need an entry
const GROUPED_STYLE_ELEMENTS = ["anchors", "borders", "burgIcons", "coastline", "lakes", "labels", "routes", "terrs"];
// layers whose fontSize option reader is migrated off the DOM (Task 9) and whose displayed
// font-size equals the stored base size (coordinates is handled separately in changeFontSize -
// its display size is zoom-scaled, so it can't share this fixed-value write path)
const OPTIONS_FONT_SIZE_LAYERS = ["legend", "ruler"];
const STYLE_ELEMENT_TARGETS = {
  ocean: {layerId: "oceanLayers"},
  goodsIcons: {layerId: "goods", childIds: ["goodsIcons"]},
  goodsBurgs: {layerId: "goods", childIds: ["goodsBurgs"]}
};

function styleTargetFromUI() {
  const element = styleElementSelect.value;
  const base = STYLE_ELEMENT_TARGETS[element] || {layerId: element};
  if (base.childIds) return base;
  const group = styleGroupSelect?.value;
  return GROUPED_STYLE_ELEMENTS.includes(element) && group ? {...base, childIds: [group]} : base;
}

// labels/burgIcons/anchors renderers still read the legacy style.labels.groups/style.burgIcons/
// style.anchors mirrors (Task 12 re-homes them); cheap to just rebuild after any write to those layers
function syncLegacyStyleMirror(target) {
  if (["labels", "burgIcons", "anchors"].includes(target.layerId) && window.projectLegacyStyleMirrors) {
    window.projectLegacyStyleMirrors();
  }
}

// Toggle style sections on element select
styleElementSelect.addEventListener("change", selectStyleElement);

function selectStyleElement() {
  const styleElement = styleElementSelect.value;
  let el = d3.select("#" + styleElement);

  styleElements.querySelectorAll("tbody").forEach(e => (e.style.display = "none")); // hide all sections

  // show alert line if layer is not visible
  const isLayerOff = styleElement !== "ocean" && (el.style("display") === "none" || !el.selectAll("*").size());
  styleIsOff.style.display = isLayerOff ? "block" : "none";

  // active group element
  if (GROUPED_STYLE_ELEMENTS.includes(styleElement)) {
    const group = styleGroupSelect.value;
    const defaultGroupSelector = styleElement === "terrs" ? "#landHeights" : "g";
    if (styleElement === "labels") {
      const selected = group && el.select(`[data-group="${CSS.escape(group)}"]`);
      el = selected && selected.size() ? selected : el.select(defaultGroupSelector);
    } else {
      el = group && el.select("#" + group).size() ? el.select("#" + group) : el.select(defaultGroupSelector);
    }
  }

  // resolve the store node for the element actually narrowed above (its true id/data-group,
  // not the possibly-stale group select value from before this function runs)
  const currentStyleTarget = STYLE_ELEMENT_TARGETS[styleElement] || {layerId: styleElement};
  const currentChildId = currentStyleTarget.childIds
    ? undefined
    : GROUPED_STYLE_ELEMENTS.includes(styleElement)
      ? styleElement === "labels"
        ? el.attr("data-group")
        : el.attr("id")
      : undefined;
  const styleNode = getStyleNode(
    currentStyleTarget.layerId,
    ...(currentStyleTarget.childIds ?? (currentChildId ? [currentChildId] : []))
  );

  // opacity
  if (!["landmass", "legend", "ocean", "regions"].includes(styleElement)) {
    styleOpacity.style.display = "block";
    styleOpacityInput.value = styleNode.presentation?.["opacity"] || 1;
  }

  // filter
  if (!["landmass", "legend", "regions", "scaleBar"].includes(styleElement)) {
    styleFilter.style.display = "block";
    styleFilterInput.value = styleNode.presentation?.["filter"] || "";
  }

  // fill
  if (["fogging", "ice", "lakes", "landmass", "prec", "rivers", "scaleBar", "vignette"].includes(styleElement)) {
    styleFill.style.display = "block";
    styleFillInput.value = styleFillOutput.value = styleNode.presentation?.["fill"];
  }

  // stroke color and width
  if (
    [
      "armies",
      "biomes",
      "borders",
      "cells",
      "coastline",
      "coordinates",
      "cults",
      "gridOverlay",
      "ice",
      "icons",
      "lakes",
      "prec",
      "relig",
      "routes",
      "zones"
    ].includes(styleElement)
  ) {
    styleStroke.style.display = "block";
    styleStrokeInput.value = styleStrokeOutput.value = styleNode.presentation?.["stroke"];
    styleStrokeWidth.style.display = "block";
    styleStrokeWidthInput.value = styleNode.presentation?.["stroke-width"] || 0;
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
    styleStrokeDasharrayInput.value = styleNode.presentation?.["stroke-dasharray"] || "";
    styleStrokeLinecapInput.value = styleNode.presentation?.["stroke-linecap"] || "inherit";
  }

  // clipping
  if (
    [
      "biomes",
      "cells",
      "compass",
      "coordinates",
      "gridOverlay",
      "population",
      "prec",
      "routes",
      "temperature",
      "terrain",
      "texture",
      "zones"
    ].includes(styleElement)
  ) {
    styleClipping.style.display = "block";
    styleClippingInput.value = styleNode.presentation?.["mask"] || "";
  }

  // show specific sections
  if (styleElement === "texture") {
    styleTexture.style.display = "block";
    const textureOptions = getLayerOptions("texture");
    styleTextureShiftX.value = textureOptions.x || 0;
    styleTextureShiftY.value = textureOptions.y || 0;
    updateTextureSelectValue(textureOptions.href);
  }

  if (styleElement === "terrs") {
    styleHeightmap.style.display = "block";
    styleHeightmapRenderOceanOption.style.display = el.attr("id") === "oceanHeights" ? "block" : "none";
    styleHeightmapRenderOcean.checked = +el.attr("data-render");

    const heightsOptions = getLayerOptions("terrs", el.attr("id"));
    styleHeightmapScheme.value = heightsOptions.scheme;
    styleHeightmapTerracing.value = heightsOptions.terracing;
    styleHeightmapSkip.value = heightsOptions.skip;
    styleHeightmapSimplification.value = heightsOptions.relax;
    styleHeightmapCurve.value = heightsOptions.curve;
  }

  if (styleElement === "markers") {
    styleMarkers.style.display = "block";
    styleRescaleMarkers.checked = +getLayerOptions("markers").rescale;
  }

  if (styleElement === "gridOverlay") {
    styleGrid.style.display = "block";
    const gridOptions = getLayerOptions("gridOverlay");
    styleGridType.value = gridOptions.type;
    styleGridScale.value = gridOptions.scale || 1;
    styleGridShiftX.value = gridOptions.dx || 0;
    styleGridShiftY.value = gridOptions.dy || 0;
    calculateFriendlyGridSize();
  }

  if (styleElement === "compass") {
    styleCompass.style.display = "block";
    const use = getLayerOptions("compass").use;
    if (use) {
      styleCompassShiftX.value = use.x;
      styleCompassShiftY.value = use.y;
      styleCompassSizeInput.value = use.scale;
    } else {
      // a preset that never carried options.use (pre-migration data) - fall back to parsing
      // the live transform instead of reading undefined, which would zero out the compass
      // on the first input event (translate(0 0) scale(0))
      const tr = parseTransform(compass.select("use").attr("transform"));
      styleCompassShiftX.value = tr[0];
      styleCompassShiftY.value = tr[1];
      styleCompassSizeInput.value = tr[2];
    }
  }

  if (styleElement === "terrain") {
    styleRelief.style.display = "block";
    styleReliefSize.value = style.relief.size;
    styleReliefDensity.value = style.relief.density;
    styleReliefSet.value = style.relief.set;
  }

  if (styleElement === "population") {
    stylePopulation.style.display = "block";
    stylePopulationRuralStrokeInput.value = stylePopulationRuralStrokeOutput.value = getStyleNode(
      "population",
      "rural"
    ).presentation?.["stroke"];
    stylePopulationUrbanStrokeInput.value = stylePopulationUrbanStrokeOutput.value = getStyleNode(
      "population",
      "urban"
    ).presentation?.["stroke"];
    styleStrokeWidth.style.display = "block";
    styleStrokeWidthInput.value = styleNode.presentation?.["stroke-width"] || 0;
  }

  if (styleElement === "regions") {
    styleStates.style.display = "block";
    const statesBodyNode = getStyleNode("regions", "statesBody");
    const statesHaloNode = getStyleNode("regions", "statesHalo");
    styleStatesBodyOpacity.value = statesBodyNode.presentation?.["opacity"] || 1;
    styleStatesBodyFilter.value = statesBodyNode.presentation?.["filter"] || "";
    styleStatesHaloWidth.value = getLayerOptions("regions", "statesHalo").width || 10;
    styleStatesHaloOpacity.value = statesHaloNode.presentation?.["opacity"] || 1;
    styleStatesHaloBlur.value =
      parseFloat(statesHaloNode.presentation?.["filter"]?.match(/blur\(([^)]+)\)/)?.[1]) || 0;
  }

  if (styleElement === "labels") {
    styleFill.style.display = "block";
    styleStroke.style.display = "block";
    styleStrokeWidth.style.display = "block";
    styleLetterSpacing.style.display = "block";

    styleShadow.style.display = "block";
    styleSize.style.display = "block";
    styleFillInput.value = styleFillOutput.value = styleNode.presentation?.["fill"] || "#3e3e4b";
    styleStrokeInput.value = styleStrokeOutput.value = styleNode.presentation?.["stroke"] || "#3a3a3a";
    styleStrokeWidthInput.value = styleNode.presentation?.["stroke-width"] || 0;
    styleLetterSpacingInput.value = styleNode.presentation?.["letter-spacing"] || 0;
    styleShadowInput.value = el.style("text-shadow") || "";

    styleFont.style.display = "block";
    styleSelectFont.value = styleNode.presentation?.["font-family"];
    styleFontSize.value = parseFloat(el.attr("font-size")) || 18;

    styleFontShift.style.display = "block";
    styleFontShiftX.value = el.attr("data-dx") || 0;
    styleFontShiftY.value = el.attr("data-dy") || 0;
  }

  if (styleElement === "burgIcons") {
    styleBurgIcons.style.display = "block";
    styleBurgIconsIcon.value = el.attr("data-icon");
    styleBurgIconsIconSize.value = el.attr("font-size");
    styleBurgIconsStrokeLinejoin.value = el.attr("stroke-linejoin");
    styleBurgIconsFillOpacity.value = el.attr("fill-opacity");

    styleFill.style.display = "block";
    styleStroke.style.display = "block";
    styleStrokeWidth.style.display = "block";
    styleStrokeDash.style.display = "block";
    styleFillInput.value = styleFillOutput.value = styleNode.presentation?.["fill"] || "#ffffff";
    styleStrokeInput.value = styleStrokeOutput.value = styleNode.presentation?.["stroke"] || "#3e3e4b";
    styleStrokeWidthInput.value = styleNode.presentation?.["stroke-width"] || 0.24;
    styleStrokeDasharrayInput.value = styleNode.presentation?.["stroke-dasharray"] || "";
    styleStrokeLinecapInput.value = styleNode.presentation?.["stroke-linecap"] || "inherit";
  }

  if (styleElement === "anchors") {
    styleFill.style.display = "block";
    styleStroke.style.display = "block";
    styleStrokeWidth.style.display = "block";
    styleSize.style.display = "block";
    styleFillInput.value = styleFillOutput.value = styleNode.presentation?.["fill"] || "#ffffff";
    styleStrokeInput.value = styleStrokeOutput.value = styleNode.presentation?.["stroke"] || "#3e3e4b";
    styleStrokeWidthInput.value = styleNode.presentation?.["stroke-width"] || 0.24;
    styleFontSize.value = el.attr("font-size") || 1;
  }

  if (styleElement === "legend") {
    styleStroke.style.display = "block";
    styleStrokeWidth.style.display = "block";
    styleSize.style.display = "block";

    styleLegend.style.display = "block";
    styleLegendColItems.value = getLayerOptions("legend").columns ?? 8;
    const legendBox = el.select("#legendBox");
    styleLegendBack.value = styleLegendBackOutput.value = legendBox.size() ? legendBox.attr("fill") : "#ffffff";
    styleLegendOpacity.value = legendBox.size() ? legendBox.attr("fill-opacity") : 1;

    styleStrokeInput.value = styleStrokeOutput.value = styleNode.presentation?.["stroke"] || "#111111";
    styleStrokeWidthInput.value = styleNode.presentation?.["stroke-width"] || 0.5;

    styleFont.style.display = "block";
    styleSelectFont.value = styleNode.presentation?.["font-family"];
    styleFontSize.value = getLayerOptions("legend").fontSize;
  }

  if (styleElement === "ocean") {
    styleOcean.style.display = "block";
    const oceanOptions = getLayerOptions("oceanLayers");
    styleOceanFill.value = styleOceanFillOutput.value = oceanOptions.baseFill;
    styleOceanPattern.value = oceanOptions.pattern?.href;
    styleOceanPatternOpacity.value = oceanOptions.pattern?.opacity || 1;
    outlineLayers.value = oceanOptions.layers;
  }

  if (styleElement === "temperature") {
    styleStrokeWidth.style.display = "block";
    styleTemperature.style.display = "block";
    styleStrokeWidthInput.value = styleNode.presentation?.["stroke-width"] || "";
    styleTemperatureFillOpacityInput.value = el.attr("fill-opacity") || 0.1;
    styleTemperatureFillInput.value = styleTemperatureFillOutput.value = styleNode.presentation?.["fill"] || "#000";
    styleTemperatureFontSizeInput.value = el.attr("font-size") || "8px";
  }

  if (styleElement === "coordinates") {
    styleSize.style.display = "block";
    styleFontSize.value = getLayerOptions("coordinates").fontSize;
  }

  if (styleElement === "ruler") {
    styleStrokeWidth.style.display = "block";
    styleStrokeWidthInput.value = styleNode.presentation?.["stroke-width"] || 2;

    // show the effective dash, so maps predating the attribute don't display a misleading blank
    styleStrokeDash.style.display = "block";
    styleStrokeDasharrayInput.value = styleNode.presentation?.["stroke-dasharray"] ?? "10";
    styleStrokeLinecapInput.value = styleNode.presentation?.["stroke-linecap"] || "inherit";

    styleSize.style.display = "block";
    styleFontSize.value = getLayerOptions("ruler").fontSize ?? 20;
  }

  if (styleElement === "armies") {
    styleArmies.style.display = "block";
    styleArmiesFillOpacity.value = el.attr("fill-opacity");
    styleArmiesSize.value = getLayerOptions("armies").boxSize;
  }

  if (styleElement === "emblems") {
    styleEmblems.style.display = "block";
    styleStrokeWidth.style.display = "block";
    styleStrokeWidthInput.value = styleNode.presentation?.["stroke-width"] || 1;
    emblemsStateSizeInput.value = getLayerOptions("emblems", "stateEmblems").size ?? 1;
    emblemsProvinceSizeInput.value = getLayerOptions("emblems", "provinceEmblems").size ?? 1;
    emblemsBurgSizeInput.value = getLayerOptions("emblems", "burgEmblems").size ?? 1;
  }

  if (styleElement === "goodsIcons") {
    styleStrokeWidth.style.display = "block";
    styleStrokeWidthInput.value = styleNode.presentation?.["stroke-width"] || "";
    styleGoods.style.display = "block";
    styleGoodsCircle.checked = !!styleNode.options?.circle;
    styleGoodsSize.value = styleNode.options?.size || 6;
  }

  if (styleElement === "goodsBurgs") {
    styleStrokeWidth.style.display = "block";
    styleStrokeWidthInput.value = styleNode.presentation?.["stroke-width"] || "0.2";
    styleStroke.style.display = "block";
    styleStrokeInput.value = styleStrokeOutput.value = styleNode.presentation?.["stroke"] || "#41414f";
    styleGoodsBurgs.style.display = "block";
    styleGoodsBurgsSize.value = styleNode.options?.size || 3;
  }

  if (styleElement === "markets") {
    styleStrokeWidth.style.display = "block";
    styleStrokeWidthInput.value = styleNode.presentation?.["stroke-width"] || "0.5";
    styleMarketsLayer.style.display = "block";
    styleMarketsLayerFillOpacity.value = el.attr("fill-opacity") || "0";
    styleMarketsSize.value = getLayerOptions("markets").size ?? 3;
    styleMarketsIconSize.value = getLayerOptions("markets").fontSize ?? 5;
    styleMarketsIcon.innerHTML = getLayerOptions("markets").icon || "⚖️";
  }

  // update group options
  styleGroupSelect.options.length = 0; // remove all options
  if (GROUPED_STYLE_ELEMENTS.includes(styleElement)) {
    if (styleElement === "labels") {
      options.labels.groups.forEach(group => {
        const groupElement = ensureEl("labels").querySelector(`[data-group="${CSS.escape(group.name)}"]`);
        const count = groupElement?.childElementCount || 0;
        styleGroupSelect.options.add(new Option(`${group.name} (${count})`, group.name, false, false));
      });
      styleGroupSelect.value = el.attr("data-group");
    } else {
      const groups = ensureEl(styleElement).querySelectorAll("g");
      groups.forEach(el => {
        const option = new Option(`${el.id} (${el.childElementCount})`, el.id, false, false);
        styleGroupSelect.options.add(option);
      });
      styleGroupSelect.value = el.attr("id");
    }
    styleGroup.style.display = "block";
  } else {
    styleGroupSelect.options.add(new Option(styleElement, styleElement, false, true));
    styleGroup.style.display = "none";
  }

  if (styleElement === "scaleBar") {
    styleScaleBar.style.display = "block";

    const scaleBarOptions = getLayerOptions("scaleBar");
    styleScaleBarSize.value = scaleBarOptions.barSize;
    styleScaleBarFontSize.value = el.attr("font-size");
    styleScaleBarPositionX.value = scaleBarOptions.x ?? "99";
    styleScaleBarPositionY.value = scaleBarOptions.y ?? "99";
    styleScaleBarLabel.value = scaleBarOptions.label ?? "";

    const scaleBarBack = el.select("#scaleBarBack");
    if (scaleBarBack.size()) {
      const back = scaleBarOptions.back ?? {};
      styleScaleBarBackgroundOpacity.value = scaleBarBack.attr("opacity");
      styleScaleBarBackgroundFill.value = styleScaleBarBackgroundFillOutput.value = scaleBarBack.attr("fill");
      styleScaleBarBackgroundStroke.value = styleScaleBarBackgroundStrokeOutput.value = scaleBarBack.attr("stroke");
      styleScaleBarBackgroundStrokeWidth.value = scaleBarBack.attr("stroke-width");
      styleScaleBarBackgroundFilter.value = scaleBarBack.attr("filter");
      styleScaleBarBackgroundPaddingTop.value = back.top;
      styleScaleBarBackgroundPaddingRight.value = back.right;
      styleScaleBarBackgroundPaddingBottom.value = back.bottom;
      styleScaleBarBackgroundPaddingLeft.value = back.left;
    }
  }

  if (styleElement === "vignette") {
    styleVignette.style.display = "block";

    const rect = getLayerOptions("vignette").rect;
    if (rect) {
      const digit = str => String(str).replace(/[^\d.]/g, "");
      styleVignetteX.value = digit(rect.x);
      styleVignetteY.value = digit(rect.y);
      styleVignetteWidth.value = digit(rect.width);
      styleVignetteHeight.value = digit(rect.height);
      styleVignetteRx.value = digit(rect.rx);
      styleVignetteRy.value = digit(rect.ry);
      styleVignetteBlur.value = digit(rect.filter);
    }
  }
}

// Handle style inputs change
styleGroupSelect.addEventListener("change", selectStyleElement);

function getEl() {
  const el = styleElementSelect.value;
  const g = styleGroupSelect.value;
  if (g === el || g === "") return svg.select("#" + el);
  if (el === "labels") return svg.select("#labels").select(`[data-group="${CSS.escape(g)}"]`);
  else return svg.select("#" + el).select("#" + g);
}

function updateLabelGroupInlineStyle(group) {
  const groupStyle = style.labels.groups[styleGroupSelect.value];
  if (!groupStyle) return;

  const inlineStyle = group.node().style;
  const value = Array.from(inlineStyle)
    .filter(property => property !== "transform")
    .map(property => `${property}: ${inlineStyle.getPropertyValue(property)}`)
    .join("; ");

  if (value) groupStyle.style = value;
  else delete groupStyle.style;
}

styleFillInput.addEventListener("input", function () {
  styleFillOutput.value = this.value;
  const target = styleTargetFromUI();
  setPresentation(target, "fill", this.value);
  syncLegacyStyleMirror(target);
});

styleStrokeInput.addEventListener("input", function () {
  styleStrokeOutput.value = this.value;
  const target = styleTargetFromUI();
  setPresentation(target, "stroke", this.value);
  syncLegacyStyleMirror(target);
  if (styleElementSelect.value === "gridOverlay" && layerIsOn("toggleGrid")) drawGrid();
});

// measurers are rendered with baked-in sizes, so a style change requires a redraw
function redrawMeasurersOnStyleChange() {
  if (styleElementSelect.value === "ruler" && layerIsOn("toggleRulers")) drawMeasurers();
}

styleStrokeWidthInput.addEventListener("input", e => {
  const target = styleTargetFromUI();
  setPresentation(target, "stroke-width", e.target.value);
  syncLegacyStyleMirror(target);
  if (styleElementSelect.value === "gridOverlay" && layerIsOn("toggleGrid")) drawGrid();
  redrawMeasurersOnStyleChange();
});

styleLetterSpacingInput.addEventListener("input", e => {
  const target = styleTargetFromUI();
  setPresentation(target, "letter-spacing", e.target.value);
  syncLegacyStyleMirror(target);
});

styleStrokeDasharrayInput.addEventListener("input", function () {
  const target = styleTargetFromUI();
  setPresentation(target, "stroke-dasharray", this.value);
  syncLegacyStyleMirror(target);
  if (styleElementSelect.value === "gridOverlay" && layerIsOn("toggleGrid")) drawGrid();
  redrawMeasurersOnStyleChange();
});

styleStrokeLinecapInput.addEventListener("change", function () {
  const target = styleTargetFromUI();
  setPresentation(target, "stroke-linecap", this.value);
  syncLegacyStyleMirror(target);
  if (styleElementSelect.value === "gridOverlay" && layerIsOn("toggleGrid")) drawGrid();
});

styleDisplayInput.addEventListener("change", function () {
  getEl().attr("display", this.value || null);
});

styleOpacityInput.addEventListener("input", e => {
  const target = styleTargetFromUI();
  setPresentation(target, "opacity", e.target.value);
  syncLegacyStyleMirror(target);
});

styleFilterInput.addEventListener("change", function () {
  if (styleGroupSelect.value === "ocean") return oceanLayers.attr("filter", this.value);
  const target = styleTargetFromUI();
  setPresentation(target, "filter", this.value);
  syncLegacyStyleMirror(target);
});

styleTextureInput.addEventListener("change", function () {
  changeTexture(this.value);
});

function changeTexture(href) {
  setOptions({layerId: "texture"}, {href});
  texture.select("image").attr("href", href);
}

function updateTextureSelectValue(href) {
  const isAdded = Array.from(styleTextureInput.options).some(option => option.value === href);
  if (isAdded) {
    styleTextureInput.value = href;
  } else {
    const name = href.split("/").pop().slice(0, 20);
    styleTextureInput.add(new Option(name, href, false, true));
  }
}

styleTextureShiftX.addEventListener("input", function () {
  setOptions({layerId: "texture"}, {x: this.valueAsNumber});
  texture
    .select("image")
    .attr("x", this.value)
    .attr("width", graphWidth - this.valueAsNumber);
});

styleTextureShiftY.addEventListener("input", function () {
  setOptions({layerId: "texture"}, {y: this.valueAsNumber});
  texture
    .select("image")
    .attr("y", this.value)
    .attr("height", graphHeight - this.valueAsNumber);
});

styleClippingInput.addEventListener("change", function () {
  const target = styleTargetFromUI();
  setPresentation(target, "mask", this.value);
  syncLegacyStyleMirror(target);
});

styleGridType.addEventListener("change", function () {
  setOptions({layerId: "gridOverlay"}, {type: this.value});
  if (layerIsOn("toggleGrid")) drawGrid();
  calculateFriendlyGridSize();
});

styleGridScale.addEventListener("input", function () {
  setOptions({layerId: "gridOverlay"}, {scale: +this.value});
  if (layerIsOn("toggleGrid")) drawGrid();
  calculateFriendlyGridSize();
});

function calculateFriendlyGridSize() {
  const size = styleGridScale.value * 25;
  const friendly = `${rn(size * distanceScale, 2)} ${distanceUnitInput.value}`;
  styleGridSizeFriendly.value = friendly;
}

styleGridShiftX.addEventListener("input", function () {
  setOptions({layerId: "gridOverlay"}, {dx: +this.value});
  if (layerIsOn("toggleGrid")) drawGrid();
});

styleGridShiftY.addEventListener("input", function () {
  setOptions({layerId: "gridOverlay"}, {dy: +this.value});
  if (layerIsOn("toggleGrid")) drawGrid();
});

styleRescaleMarkers.addEventListener("change", function () {
  setOptions({layerId: "markers"}, {rescale: +this.checked});
  invokeActiveZooming();
});

// projects style.layers.oceanLayers.options.baseFill/pattern onto the live #oceanBase/
// #oceanicPattern elements - the single source of truth for their fill/href/opacity;
// nothing else should setAttribute on them directly
function applyOceanBaseAndPattern() {
  const oceanOptions = getLayerOptions("oceanLayers");
  const oceanBaseEl = ensureEl("oceanBase");
  if (oceanBaseEl && oceanOptions.baseFill !== undefined) oceanBaseEl.setAttribute("fill", oceanOptions.baseFill);

  const patternEl = ensureEl("oceanicPattern");
  if (patternEl && oceanOptions.pattern) {
    for (const [attr, value] of Object.entries(oceanOptions.pattern)) patternEl.setAttribute(attr, value);
  }
}

styleOceanFill.addEventListener("input", function () {
  setOptions({layerId: "oceanLayers"}, {baseFill: this.value});
  applyOceanBaseAndPattern();
  styleOceanFillOutput.value = this.value;
});

styleOceanPattern.addEventListener("change", function () {
  setOptions({layerId: "oceanLayers"}, {pattern: {...getLayerOptions("oceanLayers").pattern, href: this.value}});
  applyOceanBaseAndPattern();
});

styleOceanPatternOpacity.addEventListener("input", e => {
  setOptions({layerId: "oceanLayers"}, {pattern: {...getLayerOptions("oceanLayers").pattern, opacity: e.target.value}});
  applyOceanBaseAndPattern();
});

outlineLayers.addEventListener("change", function () {
  oceanLayers.selectAll("path").remove();
  setOptions({layerId: "oceanLayers"}, {layers: this.value});
  OceanLayers();
});

styleHeightmapScheme.addEventListener("change", function () {
  setOptions(styleTargetFromUI(), {scheme: this.value});
  drawHeightmap();
});

openCreateHeightmapSchemeButton.addEventListener("click", function () {
  // start with current scheme
  const scheme = getEl().attr("scheme");
  this.dataset.stops = scheme.startsWith("#")
    ? scheme
    : (() => [0, 0.25, 0.5, 0.75, 1].map(heightmapColorSchemes[scheme]).map(toHEX).join(","))();

  // render dialog base structure
  alertMessage.innerHTML = /* html */ `<div>
    <i>Define heightmap gradient colors from high to low altitude</i>
    <img id="heightmapSchemePreview" alt="heightmap preview" style="margin-top: 0.5em; width: 100%;" />
    <div id="heightmapSchemeStops" style="margin-block: 0.5em; display: flex; flex-wrap: wrap;"></div>
    <div id="heightmapSchemeGradient" style="height: 1.9em; border: 1px solid #767676;"></div>
  </div>`;

  renderPreview();
  renderStops();
  renderGradient();

  function renderPreview() {
    const stops = openCreateHeightmapSchemeButton.dataset.stops.split(",");
    const scheme = d3.scaleSequential(d3.interpolateRgbBasis(stops));

    const preview = drawHeights({
      heights: grid.cells.h,
      width: grid.cellsX,
      height: grid.cellsY,
      scheme,
      renderOcean: false
    });

    ensureEl("heightmapSchemePreview").src = preview;
  }

  function renderStops() {
    const stops = openCreateHeightmapSchemeButton.dataset.stops.split(",");

    const colorInput = color =>
      `<input type="color" class="stop" value="${color}" data-tip="Click to set the color" style="width: 2.5em; border: none;" />`;
    const removeStopButton = index =>
      `<button class="remove" data-index="${index}" data-tip="Remove color stop" style="margin-top: 0.3em; height: max-content;">x</button>`;
    const addStopButton = () =>
      `<button class="add" data-tip="Add color stop in between" style="margin-top: 0.3em; height: max-content;">+</button>`;

    const container = ensureEl("heightmapSchemeStops");
    container.innerHTML = stops
      .map(
        (stop, index) => `${colorInput(stop)}
        ${index && index < stops.length - 1 ? removeStopButton(index) : ""}`
      )
      .join(addStopButton());

    Array.from(container.querySelectorAll("input.stop")).forEach(
      (input, index) =>
        (input.oninput = function () {
          stops[index] = this.value;
          openCreateHeightmapSchemeButton.dataset.stops = stops.join(",");
          renderPreview();
          renderGradient();
        })
    );

    Array.from(container.querySelectorAll("button.remove")).forEach(
      button =>
        (button.onclick = function () {
          const index = +this.dataset.index;
          stops.splice(index, 1);
          openCreateHeightmapSchemeButton.dataset.stops = stops.join(",");
          renderPreview();
          renderStops();
          renderGradient();
        })
    );

    Array.from(container.querySelectorAll("button.add")).forEach(
      (button, index) =>
        (button.onclick = function () {
          const middleColor = d3.interpolateRgb(stops[index], stops[index + 1])(0.5);
          stops.splice(index + 1, 0, toHEX(middleColor));
          openCreateHeightmapSchemeButton.dataset.stops = stops.join(",");
          renderPreview();
          renderStops();
          renderGradient();
        })
    );
  }

  function renderGradient() {
    const stops = openCreateHeightmapSchemeButton.dataset.stops;
    ensureEl("heightmapSchemeGradient").style.background = `linear-gradient(to right, ${stops})`;
  }

  function handleCreate() {
    const stops = openCreateHeightmapSchemeButton.dataset.stops;
    if (stops in heightmapColorSchemes) return tip("This scheme already exists", false, "error");

    addCustomColorScheme(stops);
    getEl().attr("scheme", stops);
    drawHeightmap();

    handleClose();
  }

  function handleClose() {
    $("#alert").dialog("close");
  }

  $("#alert").dialog({
    resizable: false,
    title: "Create heightmap color scheme",
    width: "28em",
    buttons: {
      Create: handleCreate,
      Cancel: handleClose
    },
    position: { my: "center top+150", at: "center top", of: "svg" }
  });
});

styleHeightmapRenderOcean.addEventListener("change", e => {
  const checked = +e.target.checked;
  getEl().attr("data-render", checked);
  drawHeightmap();
});

styleHeightmapTerracing.addEventListener("input", e => {
  setOptions(styleTargetFromUI(), {terracing: +e.target.value});
  drawHeightmap();
});

styleHeightmapSkip.addEventListener("input", e => {
  setOptions(styleTargetFromUI(), {skip: +e.target.value});
  drawHeightmap();
});

styleHeightmapSimplification.addEventListener("input", e => {
  setOptions(styleTargetFromUI(), {relax: +e.target.value});
  drawHeightmap();
});

styleHeightmapCurve.addEventListener("change", e => {
  setOptions(styleTargetFromUI(), {curve: e.target.value});
  drawHeightmap();
});

styleReliefSet.addEventListener("change", e => {
  style.relief.set = e.target.value;
  Relief.changeSet(e.target.value);
  drawRelief();
});

styleReliefSize.addEventListener("change", e => {
  const newSize = +e.target.value;
  const ratio = newSize / style.relief.size;
  style.relief.size = newSize;
  if (ratio === 1) return;

  Relief.changeSize(ratio);
  drawRelief();
});

// density defines the placement, so it cannot be applied without regenerating the icons
styleReliefDensity.addEventListener("change", e => {
  style.relief.density = +e.target.value;
  Relief.generate();
  drawRelief();
});

styleTemperatureFillOpacityInput.addEventListener("input", e => {
  temperature.attr("fill-opacity", e.target.value);
});

styleTemperatureFontSizeInput.addEventListener("input", e => {
  temperature.attr("font-size", e.target.value + "px");
});

styleTemperatureFillInput.addEventListener("input", e => {
  temperature.attr("fill", e.target.value);
  styleTemperatureFillOutput.value = e.target.value;
});

stylePopulationRuralStrokeInput.addEventListener("input", e => {
  setPresentation({layerId: "population", childIds: ["rural"]}, "stroke", e.target.value);
  stylePopulationRuralStrokeOutput.value = e.target.value;
});

stylePopulationUrbanStrokeInput.addEventListener("input", e => {
  setPresentation({layerId: "population", childIds: ["urban"]}, "stroke", e.target.value);
  stylePopulationUrbanStrokeOutput.value = e.target.value;
});

styleBurgIconsIcon.addEventListener("change", e => {
  getEl().attr("data-icon", e.target.value).selectAll("use").attr("href", e.target.value);
});

styleBurgIconsIconSize.addEventListener("input", e => {
  getEl().attr("font-size", e.target.value);
});

styleBurgIconsStrokeLinejoin.addEventListener("change", e => {
  getEl().attr("stroke-linejoin", e.target.value);
});

styleBurgIconsFillOpacity.addEventListener("input", e => {
  getEl().attr("fill-opacity", e.target.value);
});

styleCompassSizeInput.addEventListener("input", shiftCompass);
styleCompassShiftX.addEventListener("input", shiftCompass);
styleCompassShiftY.addEventListener("input", shiftCompass);

// projects style.layers.compass.options.use onto the live <use> transform - mirrors the
// existing style-presets.js applySingleInstanceOptionElements projector used on preset load/apply
function applyCompassTransform() {
  const use = getLayerOptions("compass").use;
  const useEl = compass.select("use");
  if (!use || useEl.empty()) return;
  useEl.attr("transform", `translate(${use.x} ${use.y}) scale(${use.scale})`);
}

function shiftCompass() {
  const x = Number(styleCompassShiftX.value);
  const y = Number(styleCompassShiftY.value);
  const scale = Number(styleCompassSizeInput.value);
  setOptions({layerId: "compass"}, {use: {x, y, scale}});
  applyCompassTransform();
}

styleLegendColItems.addEventListener("input", e => {
  setOptions({layerId: "legend"}, {columns: +e.target.value});
  redrawLegend();
});

styleLegendBack.addEventListener("input", e => {
  styleLegendBackOutput.value = e.target.value;
  legend.select("#legendBox").attr("fill", e.target.value);
});

styleLegendOpacity.addEventListener("input", e => {
  legend.select("#legendBox").attr("fill-opacity", e.target.value);
});

styleSelectFont.addEventListener("change", changeFont);
function changeFont() {
  const family = styleSelectFont.value;
  const target = styleTargetFromUI();
  setPresentation(target, "font-family", family);
  syncLegacyStyleMirror(target);

  if (styleElementSelect.value === "legend") redrawLegend();
}

styleShadowInput.addEventListener("input", function () {
  const group = getEl().style("text-shadow", this.value);
  updateLabelGroupInlineStyle(group);
});

styleFontAdd.addEventListener("click", function () {
  addFontNameInput.value = "";
  addFontURLInput.value = "";

  $("#addFontDialog").dialog({
    title: "Add custom font",
    width: "26em",
    position: { my: "center", at: "center", of: "svg" },
    buttons: {
      Add: function () {
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
        $(this).dialog("close");
      },
      Cancel: function () {
        $(this).dialog("close");
      }
    }
  });
});

addFontMethod.addEventListener("change", function () {
  addFontURLInput.style.display = this.value === "fontURL" ? "inline" : "none";
});

styleFontSize.addEventListener("change", function () {
  changeFontSize(getEl(), +this.value);
});

styleFontPlus.addEventListener("click", function () {
  const current = +styleFontSize.value || 12;
  changeFontSize(getEl(), Math.min(rn(current + 0.1, 1), 999));
});

styleFontMinus.addEventListener("click", function () {
  const current = +styleFontSize.value || 12;
  changeFontSize(getEl(), Math.max(rn(current - 0.1, 1), 0.1));
});

function changeFontSize(el, size) {
  styleFontSize.value = size;

  const groupStyle = style.labels.groups[styleGroupSelect.value];
  if (styleElementSelect.value === "labels") {
    el.attr("font-size", `${size}%`).attr("data-size", null);
    if (groupStyle) {
      delete groupStyle["data-size"];
      groupStyle["font-size"] = `${size}%`;
    }
    return;
  }

  // coordinates' displayed font-size is zoom-scaled (rn(size / scale ** 0.8, 2)), not a fixed
  // value like the other layers here - persisting that scaled number into style.layers would
  // freeze the wrong number in once the user zooms again. Store only the base size (matching
  // the old data-size-is-base model) and let drawCoordinates() derive+apply the scaled display
  // font-size itself, the same way it already does on every zoom-triggered redraw
  if (styleElementSelect.value === "coordinates") {
    setOptions({layerId: "coordinates"}, {fontSize: size});
    if (layerIsOn("toggleCoordinates")) drawCoordinates();
    return;
  }

  // layers whose fontSize option reader has been migrated off the DOM (Task 9); every other
  // element in this shared handler (armies/temperature) still reads the DOM directly
  if (OPTIONS_FONT_SIZE_LAYERS.includes(styleElementSelect.value)) {
    setOptions({layerId: styleElementSelect.value}, {fontSize: size});
    setPresentation({layerId: styleElementSelect.value}, "font-size", size);
  } else {
    el.attr("data-size", size).attr("font-size", size);
  }

  if (styleElementSelect.value === "legend") redrawLegend();
  redrawMeasurersOnStyleChange();
}

styleFontShiftX.addEventListener("input", e => {
  const group = getEl().attr("data-dx", e.target.value);
  const groupStyle = style.labels.groups[styleGroupSelect.value];
  if (groupStyle) groupStyle["data-dx"] = e.target.value;
  const dx = e.target.value || 0;
  const dy = group.attr("data-dy") || 0;
  group.style("transform", +dx || +dy ? `translate(${dx}em, ${dy}em)` : null);
});

styleFontShiftY.addEventListener("input", e => {
  const group = getEl().attr("data-dy", e.target.value);
  const groupStyle = style.labels.groups[styleGroupSelect.value];
  if (groupStyle) groupStyle["data-dy"] = e.target.value;
  const dx = group.attr("data-dx") || 0;
  const dy = e.target.value || 0;
  group.style("transform", +dx || +dy ? `translate(${dx}em, ${dy}em)` : null);
});

styleStatesBodyOpacity.addEventListener("input", e => {
  setPresentation({layerId: "regions", childIds: ["statesBody"]}, "opacity", e.target.value);
});

styleStatesBodyFilter.addEventListener("change", function () {
  setPresentation({layerId: "regions", childIds: ["statesBody"]}, "filter", this.value);
});

styleStatesHaloWidth.addEventListener("input", e => {
  const value = e.target.value;
  setOptions({layerId: "regions", childIds: ["statesHalo"]}, {width: +value});
  setPresentation({layerId: "regions", childIds: ["statesHalo"]}, "stroke-width", value);
});

styleStatesHaloOpacity.addEventListener("input", e => {
  setPresentation({layerId: "regions", childIds: ["statesHalo"]}, "opacity", e.target.value);
});

styleStatesHaloBlur.addEventListener("input", e => {
  const value = Number(e.target.value);
  const blur = value > 0 ? `blur(${value}px)` : null;
  setPresentation({layerId: "regions", childIds: ["statesHalo"]}, "filter", blur);
});

styleArmiesFillOpacity.addEventListener("input", e => {
  armies.attr("fill-opacity", e.target.value);
});

styleArmiesSize.addEventListener("input", e => {
  const value = Number(e.target.value);
  // box-size only lives in style.layers now (draw-military.ts reads it via getLayerOptions);
  // font-size stays a direct DOM write too - it's inherited by regiment text, not JS-read
  setOptions({layerId: "armies"}, {boxSize: value, fontSize: value * 2});
  armies.attr("font-size", value * 2);

  armies.selectAll("g").remove(); // clear armies layer
  pack.states.forEach(s => {
    if (!s.i || s.removed || !s.military.length) return;
    drawRegiments(s.military, s.i);
  });
});

emblemsStateSizeInput.addEventListener("change", e => {
  setOptions({layerId: "emblems", childIds: ["stateEmblems"]}, {size: +e.target.value});
  drawEmblems();
});

emblemsProvinceSizeInput.addEventListener("change", e => {
  setOptions({layerId: "emblems", childIds: ["provinceEmblems"]}, {size: +e.target.value});
  drawEmblems();
});

emblemsBurgSizeInput.addEventListener("change", e => {
  setOptions({layerId: "emblems", childIds: ["burgEmblems"]}, {size: +e.target.value});
  drawEmblems();
});

styleGoodsCircle.addEventListener("change", function () {
  setOptions({layerId: "goods", childIds: ["goodsIcons"]}, {circle: +this.checked});
  drawGoods();
});

styleGoodsSize.addEventListener("change", function () {
  setOptions({layerId: "goods", childIds: ["goodsIcons"]}, {size: +this.value});
  drawGoods();
});

styleGoodsBurgsSize.addEventListener("change", function () {
  setOptions({layerId: "goods", childIds: ["goodsBurgs"]}, {size: +this.value});
  drawGoods();
});

styleMarketsLayerFillOpacity.addEventListener("input", e => {
  markets.attr("fill-opacity", e.target.value);
});

styleMarketsSize.addEventListener("change", function () {
  setOptions({layerId: "markets"}, {size: +this.value});
  drawMarketsLayer();
});

styleMarketsIconSize.addEventListener("change", function () {
  setOptions({layerId: "markets"}, {fontSize: +this.value});
  drawMarketsLayer();
});

styleMarketsIcon.addEventListener("click", function () {
  window.Controllers.IconSelector.open(getLayerOptions("markets").icon || "⚖️", value => {
    setOptions({layerId: "markets"}, {icon: value});
    this.innerHTML = value;
    drawMarketsLayer();
  });
});

// request a URL to image to be used as a texture
function textureProvideURL() {
  alertMessage.innerHTML = /* html */ `Provide a texture image URL:
    <input id="textureURL" type="url" style="width: 100%" placeholder="http://www.example.com/image.jpg" oninput="fetchTextureURL(this.value)" />
    <canvas id="texturePreview" width="256px" height="144px"></canvas>`;

  $("#alert").dialog({
    resizable: false,
    title: "Load custom texture",
    width: "28em",
    buttons: {
      Apply: function () {
        if (!textureURL.value) return tip("Please provide a valid URL", false, "error");
        changeTexture(textureURL.value);
        updateTextureSelectValue(textureURL.value);
        $(this).dialog("close");
      },
      Cancel: function () {
        $(this).dialog("close");
      }
    }
  });
}

function fetchTextureURL(url) {
  INFO && console.info("Provided URL is", url);
  const img = new Image();
  img.onload = function () {
    const canvas = ensureEl("texturePreview");
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  };
  img.src = url;
}

const vignettePresets = {
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

// projects style.layers.vignette.options.rect onto the live <rect> - the single source of
// truth for #vignette-rect's geometry; nothing else should setAttribute on it directly
function applyVignetteRect() {
  const rect = getLayerOptions("vignette").rect;
  const rectEl = ensureEl("vignette-rect");
  if (!rect || !rectEl) return;
  for (const [attr, value] of Object.entries(rect)) rectEl.setAttribute(attr, value);
}

styleVignettePreset.addEventListener("change", function () {
  const attributes = JSON.parse(vignettePresets[this.value]);

  const vignetteAttrs = attributes["#vignette"];
  const vignette = ensureEl("vignette");
  if (vignette && vignetteAttrs) {
    for (const attr in vignetteAttrs) setPresentation({layerId: "vignette"}, attr, vignetteAttrs[attr]);
  }

  const rectAttrs = attributes["#vignette-rect"];
  if (rectAttrs) {
    setOptions({layerId: "vignette"}, {rect: {...getLayerOptions("vignette").rect, ...rectAttrs}});
    applyVignetteRect();
  }

  if (vignette) {
    styleOpacityInput.value = vignette.getAttribute("opacity");
    styleFillInput.value = styleFillOutput.value = vignette.getAttribute("fill");
    styleFilterInput.value = vignette.getAttribute("filter");
  }

  const rect = getLayerOptions("vignette").rect;
  if (rect) {
    const digit = str => String(str).replace(/[^\d.]/g, "");
    styleVignetteX.value = digit(rect.x);
    styleVignetteY.value = digit(rect.y);
    styleVignetteWidth.value = digit(rect.width);
    styleVignetteHeight.value = digit(rect.height);
    styleVignetteRx.value = digit(rect.rx);
    styleVignetteRy.value = digit(rect.ry);
    styleVignetteBlur.value = digit(rect.filter);
  }
});

function setVignetteRectOption(attr, value) {
  setOptions({layerId: "vignette"}, {rect: {...getLayerOptions("vignette").rect, [attr]: value}});
  applyVignetteRect();
}

styleVignetteX.addEventListener("input", e => setVignetteRectOption("x", `${e.target.value}%`));

styleVignetteWidth.addEventListener("input", e => setVignetteRectOption("width", `${e.target.value}%`));

styleVignetteY.addEventListener("input", e => setVignetteRectOption("y", `${e.target.value}%`));

styleVignetteHeight.addEventListener("input", e => setVignetteRectOption("height", `${e.target.value}%`));

styleVignetteRx.addEventListener("input", e => setVignetteRectOption("rx", `${e.target.value}%`));

styleVignetteRy.addEventListener("input", e => setVignetteRectOption("ry", `${e.target.value}%`));

styleVignetteBlur.addEventListener("input", e => setVignetteRectOption("filter", `blur(${e.target.value}px)`));

styleScaleBar.addEventListener("input", function (event) {
  const scaleBarBack = scaleBar.select("#scaleBarBack");
  if (!scaleBarBack.size()) return;

  const { id, value } = event.target;

  if (id === "styleScaleBarSize") setOptions({layerId: "scaleBar"}, {barSize: +value});
  else if (id === "styleScaleBarFontSize") {
    // font-size stays a direct DOM write too - it's inherited by CSS, nothing reads it as JS -
    // but it must also go through setOptions, or the next preset apply reverts it: LAYER_OPTION_
    // ATTRIBUTES.scaleBar still projects options.fontSize onto #scaleBar's font-size attribute
    setOptions({layerId: "scaleBar"}, {fontSize: value});
    scaleBar.attr("font-size", value);
  } else if (id === "styleScaleBarPositionX") setOptions({layerId: "scaleBar"}, {x: +value});
  else if (id === "styleScaleBarPositionY") setOptions({layerId: "scaleBar"}, {y: +value});
  else if (id === "styleScaleBarLabel") setOptions({layerId: "scaleBar"}, {label: value});
  else if (id === "styleScaleBarBackgroundOpacity") {
    setOptions({layerId: "scaleBar"}, {back: {...getLayerOptions("scaleBar").back, opacity: value}});
    scaleBarBack.attr("opacity", value);
  } else if (id === "styleScaleBarBackgroundFill") {
    setOptions({layerId: "scaleBar"}, {back: {...getLayerOptions("scaleBar").back, fill: value}});
    scaleBarBack.attr("fill", value);
  } else if (id === "styleScaleBarBackgroundStroke") {
    setOptions({layerId: "scaleBar"}, {back: {...getLayerOptions("scaleBar").back, stroke: value}});
    scaleBarBack.attr("stroke", value);
  } else if (id === "styleScaleBarBackgroundStrokeWidth") {
    setOptions({layerId: "scaleBar"}, {back: {...getLayerOptions("scaleBar").back, strokeWidth: value}});
    scaleBarBack.attr("stroke-width", value);
  } else if (id === "styleScaleBarBackgroundFilter") {
    setOptions({layerId: "scaleBar"}, {back: {...getLayerOptions("scaleBar").back, filter: value}});
    scaleBarBack.attr("filter", value);
  }
  else if (id === "styleScaleBarBackgroundPaddingTop")
    setOptions({layerId: "scaleBar"}, {back: {...getLayerOptions("scaleBar").back, top: +value}});
  else if (id === "styleScaleBarBackgroundPaddingRight")
    setOptions({layerId: "scaleBar"}, {back: {...getLayerOptions("scaleBar").back, right: +value}});
  else if (id === "styleScaleBarBackgroundPaddingBottom")
    setOptions({layerId: "scaleBar"}, {back: {...getLayerOptions("scaleBar").back, bottom: +value}});
  else if (id === "styleScaleBarBackgroundPaddingLeft")
    setOptions({layerId: "scaleBar"}, {back: {...getLayerOptions("scaleBar").back, left: +value}});

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
function applyMapFilter(event) {
  if (event.target.tagName !== "BUTTON") return;
  const button = event.target;
  svg.attr("data-filter", null).attr("filter", null);
  if (button.classList.contains("pressed")) return button.classList.remove("pressed");

  mapFilters.querySelectorAll(".pressed").forEach(button => button.classList.remove("pressed"));
  button.classList.add("pressed");
  svg.attr("data-filter", button.id).attr("filter", "url(#filter-" + button.id + ")");
}
