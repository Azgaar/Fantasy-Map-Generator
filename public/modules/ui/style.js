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

// #icons and #goods hold no styling of their own
const STYLE_ELEMENT_ALIASES = { icons: "burgIcons", goods: "goodsCells" };

// select element to be edited
function editStyle(element, group) {
  showOptions();
  styleTab.click();
  styleElementSelect.value = STYLE_ELEMENT_ALIASES[element] || element;
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

function getColorScheme(scheme) {
  if (!scheme) scheme = "bright";
  if (!(scheme in heightmapColorSchemes)) {
    const colors = scheme.split(",");
    heightmapColorSchemes[scheme] = d3.scaleSequential(d3.interpolateRgbBasis(colors));
  }

  return heightmapColorSchemes[scheme];
}

function getColor(value, scheme = getColorScheme("bright")) {
  return scheme(1 - (value < 20 ? value - 5 : value) / 100);
}

// Toggle style sections on element select
styleElementSelect.addEventListener("change", selectStyleElement);

// groups the editor addresses by name; everything else is styled as a whole
const GROUPED_STYLE_ELEMENTS = ["anchors", "borders", "burgIcons", "coastline", "lakes", "labels", "routes", "terrs"];

// the styles store is the source of truth: the editor writes the DOM but never reads it back.
// Values live either in the selection's own node or, for controls that edit a sibling
// (#statesHalo, #legendBox, #scaleBarBack), in that sibling's node - addressed directly
function selectStyleElement() {
  const styleElement = styleElementSelect.value;
  const el = d3.select("#" + styleElement);

  styleElements.querySelectorAll("tbody").forEach(e => (e.style.display = "none")); // hide all sections

  // show alert line if layer is not visible
  const isLayerOff = styleElement !== "ocean" && (el.style("display") === "none" || !el.selectAll("*").size());
  styleIsOff.style.display = isLayerOff ? "block" : "none";

  // the group list comes first: it settles which store node every value below is read from
  updateGroupOptions(styleElement, el);
  const node = stylesLegacy.styleNodeFor(styleElement, styleGroupSelect.value)?.node;
  const attrs = node?.attrs || {};
  const opts = node?.options || {};

  // opacity
  if (!["landmass", "legend", "ocean", "regions"].includes(styleElement)) {
    styleOpacity.style.display = "block";
    styleOpacityInput.value = attrs.opacity ?? 1;
  }

  // filter
  if (!["landmass", "legend", "regions", "scaleBar"].includes(styleElement)) {
    styleFilter.style.display = "block";
    styleFilterInput.value = attrs.filter || "";
  }

  // fill
  if (["fogging", "ice", "lakes", "landmass", "prec", "rivers", "scaleBar", "vignette"].includes(styleElement)) {
    styleFill.style.display = "block";
    styleFillInput.value = styleFillOutput.value = attrs.fill;
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
      "lakes",
      "prec",
      "relig",
      "routes",
      "zones"
    ].includes(styleElement)
  ) {
    styleStroke.style.display = "block";
    styleStrokeInput.value = styleStrokeOutput.value = attrs.stroke;
    styleStrokeWidth.style.display = "block";
    styleStrokeWidthInput.value = attrs["stroke-width"] ?? 0;
  }

  if (styleElement === "journeys") {
    styleStrokeWidth.style.display = "block";
    styleStrokeWidthInput.value = attrs["stroke-width"] ?? 0;
  }

  // stroke dash
  if (
    [
      "borders",
      "cells",
      "coordinates",
      "gridOverlay",
      "journeys",
      "legend",
      "population",
      "routes",
      "temperature",
      "zones"
    ].includes(styleElement)
  ) {
    styleStrokeDash.style.display = "block";
    styleStrokeDasharrayInput.value = attrs["stroke-dasharray"] || "";
    styleStrokeLinecapInput.value = attrs["stroke-linecap"] || "inherit";
  }

  // clipping
  if (
    [
      "biomes",
      "cells",
      "compass",
      "coordinates",
      "gridOverlay",
      "journeys",
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
    styleClippingInput.value = attrs.mask || "";
  }

  // show specific sections
  if (styleElement === "texture") {
    styleTexture.style.display = "block";
    styleTextureShiftX.value = opts.x;
    styleTextureShiftY.value = opts.y;
    updateTextureSelectValue(opts.href);
  }

  if (styleElement === "terrs") {
    styleHeightmap.style.display = "block";
    styleHeightmapRenderOceanOption.style.display = styleGroupSelect.value === "oceanHeights" ? "block" : "none";
    styleHeightmapRenderOcean.checked = opts.render;
    styleHeightmapScheme.value = opts.scheme;
    styleHeightmapTerracing.value = opts.terracing;
    styleHeightmapSkip.value = opts.skip;
    styleHeightmapSimplification.value = opts.relax;
    styleHeightmapCurve.value = opts.curve;
  }

  if (styleElement === "markers") {
    styleMarkers.style.display = "block";
    styleRescaleMarkers.checked = Boolean(opts.rescale);
  }

  if (styleElement === "gridOverlay") {
    styleGrid.style.display = "block";
    styleGridType.value = opts.type;
    styleGridScale.value = opts.scale;
    styleGridShiftX.value = opts.dx;
    styleGridShiftY.value = opts.dy;
    calculateFriendlyGridSize();
  }

  if (styleElement === "compass") {
    styleCompass.style.display = "block";
    const tr = parseTransform(styles.compass.compassRose.attrs.transform);
    styleCompassShiftX.value = tr[0];
    styleCompassShiftY.value = tr[1];
    styleCompassSizeInput.value = tr[2];
  }

  if (styleElement === "terrain") {
    styleRelief.style.display = "block";
    styleReliefSize.value = opts.size;
    styleReliefDensity.value = opts.density;
    styleReliefSet.value = opts.set;
  }

  if (styleElement === "population") {
    stylePopulation.style.display = "block";
    stylePopulationRuralStrokeInput.value = stylePopulationRuralStrokeOutput.value =
      styles.population.rural.attrs.stroke;
    stylePopulationUrbanStrokeInput.value = stylePopulationUrbanStrokeOutput.value =
      styles.population.urban.attrs.stroke;
    styleStrokeWidth.style.display = "block";
    styleStrokeWidthInput.value = attrs["stroke-width"] ?? 0;
  }

  if (styleElement === "regions") {
    const { statesBody, statesHalo } = styles.states;
    styleStates.style.display = "block";
    styleStatesBodyOpacity.value = statesBody.attrs.opacity ?? 1;
    styleStatesBodyFilter.value = statesBody.attrs.filter || "";
    styleStatesHaloWidth.value = statesHalo.options.width;
    styleStatesHaloOpacity.value = statesHalo.attrs.opacity ?? 1;
    styleStatesHaloBlur.value = parseFloat(statesHalo.attrs.filter?.match(/blur\(([^)]+)\)/)?.[1]) || 0;
  }

  if (styleElement === "labels") {
    styleFill.style.display = "block";
    styleStroke.style.display = "block";
    styleStrokeWidth.style.display = "block";
    styleLetterSpacing.style.display = "block";

    styleShadow.style.display = "block";
    styleSize.style.display = "block";
    styleFillInput.value = styleFillOutput.value = attrs.fill || "#3e3e4b";
    styleStrokeInput.value = styleStrokeOutput.value = attrs.stroke || "#3a3a3a";
    styleStrokeWidthInput.value = attrs["stroke-width"] ?? 0;
    styleLetterSpacingInput.value = attrs["letter-spacing"] ?? 0;
    styleShadowInput.value = getTextShadow(attrs.style);

    styleFont.style.display = "block";
    styleSelectFont.value = attrs["font-family"];
    styleFontSize.value = parseFloat(attrs["font-size"]) || 18;

    styleFontShift.style.display = "block";
    const { dx, dy } = getLabelShift(attrs.style);
    styleFontShiftX.value = dx;
    styleFontShiftY.value = dy;
  }

  if (styleElement === "burgIcons") {
    styleBurgIcons.style.display = "block";
    styleBurgIconsIcon.value = opts.icon;
    styleBurgIconsIconSize.value = opts.size;
    styleBurgIconsStrokeLinejoin.value = attrs["stroke-linejoin"] || "inherit";
    styleBurgIconsFillOpacity.value = attrs["fill-opacity"] ?? 1;

    styleFill.style.display = "block";
    styleStroke.style.display = "block";
    styleStrokeWidth.style.display = "block";
    styleStrokeDash.style.display = "block";
    styleFillInput.value = styleFillOutput.value = attrs.fill || "#ffffff";
    styleStrokeInput.value = styleStrokeOutput.value = attrs.stroke || "#3e3e4b";
    styleStrokeWidthInput.value = attrs["stroke-width"] ?? 0.24;
    styleStrokeDasharrayInput.value = attrs["stroke-dasharray"] || "";
    styleStrokeLinecapInput.value = attrs["stroke-linecap"] || "inherit";
  }

  if (styleElement === "anchors") {
    styleFill.style.display = "block";
    styleStroke.style.display = "block";
    styleStrokeWidth.style.display = "block";
    styleSize.style.display = "block";
    styleFillInput.value = styleFillOutput.value = attrs.fill || "#ffffff";
    styleStrokeInput.value = styleStrokeOutput.value = attrs.stroke || "#3e3e4b";
    styleStrokeWidthInput.value = attrs["stroke-width"] ?? 0.24;
    styleFontSize.value = opts.size || 1;
  }

  if (styleElement === "legend") {
    styleStroke.style.display = "block";
    styleStrokeWidth.style.display = "block";
    styleSize.style.display = "block";

    styleLegend.style.display = "block";
    styleLegendColItems.value = opts.columns;
    styleLegendBack.value = styleLegendBackOutput.value = styles.legend.box.attrs.fill || "#ffffff";
    styleLegendOpacity.value = styles.legend.box.attrs["fill-opacity"] ?? 1;

    styleStrokeInput.value = styleStrokeOutput.value = attrs.stroke || "#111111";
    styleStrokeWidthInput.value = attrs["stroke-width"] ?? 0.5;

    styleFont.style.display = "block";
    styleSelectFont.value = attrs["font-family"];
    styleFontSize.value = opts.fontSize;
  }

  if (styleElement === "ocean") {
    styleOcean.style.display = "block";
    styleOceanFill.value = styleOceanFillOutput.value = styles.ocean.base.attrs.fill;
    styleOceanPattern.value = styles.ocean.options.pattern;
    styleOceanPatternOpacity.value = styles.ocean.options.patternOpacity;
    outlineLayers.value = styles.ocean.oceanLayers.options.outline;
  }

  if (styleElement === "temperature") {
    styleStrokeWidth.style.display = "block";
    styleTemperature.style.display = "block";
    styleStrokeWidthInput.value = attrs["stroke-width"] ?? "";
    styleTemperatureFillOpacityInput.value = attrs["fill-opacity"] ?? 0.1;
    styleTemperatureFillInput.value = styleTemperatureFillOutput.value = attrs.fill || "#000";
    styleTemperatureFontSizeInput.value = parseFloat(attrs["font-size"]) || 8;
  }

  if (styleElement === "coordinates") {
    styleSize.style.display = "block";
    styleFontSize.value = opts.fontSize;
  }

  if (styleElement === "ruler") {
    styleStrokeWidth.style.display = "block";
    styleStrokeWidthInput.value = attrs["stroke-width"] ?? 2;

    styleStrokeDash.style.display = "block";
    styleStrokeDasharrayInput.value = attrs["stroke-dasharray"] ?? "10";
    styleStrokeLinecapInput.value = attrs["stroke-linecap"] || "inherit";

    styleSize.style.display = "block";
    styleFontSize.value = opts.fontSize;
  }

  if (styleElement === "armies") {
    styleArmies.style.display = "block";
    styleArmiesFillOpacity.value = attrs["fill-opacity"];
    styleArmiesSize.value = opts.boxSize;
  }

  if (styleElement === "emblems") {
    styleEmblems.style.display = "block";
    styleStrokeWidth.style.display = "block";
    styleStrokeWidthInput.value = attrs["stroke-width"] ?? 1;
    emblemsStateSizeInput.value = styles.emblems.stateEmblems.options.size;
    emblemsProvinceSizeInput.value = styles.emblems.provinceEmblems.options.size;
    emblemsBurgSizeInput.value = styles.emblems.burgEmblems.options.size;
    showAllEmblems.checked = options.emblems.showAll;
  }

  if (styleElement === "goodsIcons") {
    styleStrokeWidth.style.display = "block";
    styleStrokeWidthInput.value = attrs["stroke-width"] ?? "";
    styleGoods.style.display = "block";
    styleGoodsCircle.checked = opts.circle;
    styleGoodsSize.value = opts.size;
  }

  if (styleElement === "goodsBurgs") {
    styleStrokeWidth.style.display = "block";
    styleStrokeWidthInput.value = attrs["stroke-width"] ?? 0.2;
    styleStroke.style.display = "block";
    styleStrokeInput.value = styleStrokeOutput.value = attrs.stroke || "#41414f";
    styleGoodsBurgs.style.display = "block";
    styleGoodsBurgsSize.value = opts.size;
  }

  if (styleElement === "markets") {
    styleStrokeWidth.style.display = "block";
    styleStrokeWidthInput.value = attrs["stroke-width"] ?? 0.5;
    styleMarketsLayer.style.display = "block";
    styleMarketsLayerFillOpacity.value = attrs["fill-opacity"] ?? 0;
    styleMarketsSize.value = opts.size;
    styleMarketsIconSize.value = opts.fontSize;
    styleMarketsIcon.innerHTML = opts.icon;
  }

  if (styleElement === "scaleBar") {
    const back = styles.scaleBar.back;
    styleScaleBar.style.display = "block";

    styleScaleBarSize.value = opts.barSize;
    styleScaleBarFontSize.value = attrs["font-size"];
    styleScaleBarPositionX.value = opts.x;
    styleScaleBarPositionY.value = opts.y;
    styleScaleBarLabel.value = opts.label;

    styleScaleBarBackgroundOpacity.value = back.attrs.opacity ?? 1;
    styleScaleBarBackgroundFill.value = styleScaleBarBackgroundFillOutput.value = back.attrs.fill;
    styleScaleBarBackgroundStroke.value = styleScaleBarBackgroundStrokeOutput.value = back.attrs.stroke;
    styleScaleBarBackgroundStrokeWidth.value = back.attrs["stroke-width"] ?? 0;
    styleScaleBarBackgroundFilter.value = back.attrs.filter || "";
    styleScaleBarBackgroundPaddingTop.value = back.options.top;
    styleScaleBarBackgroundPaddingRight.value = back.options.right;
    styleScaleBarBackgroundPaddingBottom.value = back.options.bottom;
    styleScaleBarBackgroundPaddingLeft.value = back.options.left;
  }

  if (styleElement === "vignette") {
    styleVignette.style.display = "block";
    updateVignetteInputs();
  }
}

// the group names are structure, not styling: the layer's own children, or the groups the
// user has defined. Sets styleGroupSelect.value to the group the sections below read
function updateGroupOptions(styleElement, layerEl) {
  const selected = styleGroupSelect.value; // read before clearing: emptying the list clears it
  styleGroupSelect.options.length = 0;

  if (!GROUPED_STYLE_ELEMENTS.includes(styleElement)) {
    styleGroupSelect.options.add(new Option(styleElement, styleElement, false, true));
    styleGroup.style.display = "none";
    return;
  }

  styleGroup.style.display = "block";

  if (styleElement === "labels") {
    // count from the label data: the culled DOM only holds labels rendered at this zoom
    const labelCounts = {};
    for (const label of window.getLabelsData()) labelCounts[label.group] = (labelCounts[label.group] || 0) + 1;
    const groups = options.labels.groups.map(({ name }) => name);
    groups.forEach(name => styleGroupSelect.options.add(new Option(`${name} (${labelCounts[name] || 0})`, name)));
    styleGroupSelect.value = groups.includes(selected) ? selected : groups[0] || "";
    return;
  }

  // custom route groups exist only in the svg, so the group list is read from it
  const groups = Array.from(layerEl.node()?.querySelectorAll(":scope > g") || []);
  groups.forEach(g => styleGroupSelect.options.add(new Option(`${g.id} (${g.childElementCount})`, g.id)));
  const ids = groups.map(g => g.id);
  const fallback = styleElement === "terrs" ? "landHeights" : ids[0];
  styleGroupSelect.value = ids.includes(selected) ? selected : fallback || "";
}

const getTextShadow = style => style?.match(/(?:^|;)\s*text-shadow\s*:\s*([^;]+)/)?.[1].trim() || "";
const getLabelShift = style => {
  const match = style?.match(/(?:^|;)\s*transform\s*:\s*translate\(\s*(-?[\d.]+)em\s*,\s*(-?[\d.]+)em\s*\)/);
  return match ? { dx: +match[1], dy: +match[2] } : { dx: 0, dy: 0 };
};

function updateVignetteInputs() {
  const { x, y, width, height, rx, ry, filter } = styles.vignette.options;
  const digit = value => String(value ?? "").replace(/[^\d.]/g, "");
  styleVignetteX.value = digit(x);
  styleVignetteY.value = digit(y);
  styleVignetteWidth.value = digit(width);
  styleVignetteHeight.value = digit(height);
  styleVignetteRx.value = digit(rx);
  styleVignetteRy.value = digit(ry);
  styleVignetteBlur.value = digit(filter);
}

// Handle style inputs change
styleGroupSelect.addEventListener("change", selectStyleElement);

function getEl() {
  const el = styleElementSelect.value;
  const g = styleGroupSelect.value;
  const map = d3.select("#map");
  if (g === el || g === "") return map.select("#" + el);
  if (el === "labels") return map.select("#labels").select(`[data-group="${CSS.escape(g)}"]`);
  else return map.select("#" + el).select("#" + g);
}

function writeSelectedAttr(attr, value) {
  const resolved = stylesLegacy.styleNodeFor(styleElementSelect.value, styleGroupSelect.value);
  if (resolved?.node.attrs && attr in resolved.node.attrs) resolved.node.attrs[attr] = value;
  else {
    tip("This change shows on the map but can't be stored in the style, so it won't survive a redraw or save", false, "warn", 5000);
    ERROR &&
      console.error(
        `Style editor: "${attr}" is not in the styles schema for ${styleElementSelect.value} > ${styleGroupSelect.value}. The change is applied to the map but is not stored in the style`
      );
  }
  getEl().attr(attr, value ?? null);
}

styleFillInput.addEventListener("input", function () {
  styleFillOutput.value = this.value;
  writeSelectedAttr("fill", this.value);
});

styleStrokeInput.addEventListener("input", function () {
  styleStrokeOutput.value = this.value;
  writeSelectedAttr("stroke", this.value);
  if (styleElementSelect.value === "gridOverlay") Layers.draw("grid");
});

styleStrokeWidthInput.addEventListener("input", e => {
  writeSelectedAttr("stroke-width", +e.target.value || 0);
  if (styleElementSelect.value === "gridOverlay") Layers.draw("grid");
  if (styleElementSelect.value === "ruler") Layers.draw("rulers");
});

styleLetterSpacingInput.addEventListener("input", e => {
  writeSelectedAttr("letter-spacing", +e.target.value || 0);
});

styleStrokeDasharrayInput.addEventListener("input", function () {
  // rulers fall back to the default pattern when the attr is unset, so a cleared field means solid, not default
  const cleared = styleElementSelect.value === "ruler" ? "none" : null;
  writeSelectedAttr("stroke-dasharray", this.value || cleared);
  if (styleElementSelect.value === "gridOverlay") Layers.draw("grid");
  if (styleElementSelect.value === "ruler") Layers.draw("rulers");
});

styleStrokeLinecapInput.addEventListener("change", function () {
  writeSelectedAttr("stroke-linecap", this.value || null);
  if (styleElementSelect.value === "gridOverlay") Layers.draw("grid");
});

styleOpacityInput.addEventListener("input", e => {
  writeSelectedAttr("opacity", +e.target.value);
});

styleFilterInput.addEventListener("change", function () {
  if (styleGroupSelect.value === "ocean") {
    styles.ocean.oceanLayers.attrs.filter = this.value || null;
    return Styles.write("ocean");
  }
  writeSelectedAttr("filter", this.value || null);
});

styleTextureInput.addEventListener("change", function () {
  changeTexture(this.value);
});

function changeTexture(href) {
  styles.texture.options.href = href;
  Layers.draw("texture");
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
  styles.texture.options.x = this.valueAsNumber || 0;
  Layers.draw("texture");
});

styleTextureShiftY.addEventListener("input", function () {
  styles.texture.options.y = this.valueAsNumber || 0;
  Layers.draw("texture");
});

styleClippingInput.addEventListener("change", function () {
  writeSelectedAttr("mask", this.value || null);
});

styleGridType.addEventListener("change", function () {
  styles.grid.options.type = this.value;
  Layers.draw("grid");
  calculateFriendlyGridSize();
});

styleGridScale.addEventListener("input", function () {
  styles.grid.options.scale = +this.value || 1;
  Layers.draw("grid");
  calculateFriendlyGridSize();
});

function calculateFriendlyGridSize() {
  const size = styleGridScale.value * 25;
  const friendly = `${rn(size * distanceScale, 2)} ${distanceUnitInput.value}`;
  styleGridSizeFriendly.value = friendly;
}

styleGridShiftX.addEventListener("input", function () {
  styles.grid.options.dx = +this.value || 0;
  Layers.draw("grid");
});

styleGridShiftY.addEventListener("input", function () {
  styles.grid.options.dy = +this.value || 0;
  Layers.draw("grid");
});

styleRescaleMarkers.addEventListener("change", function () {
  styles.markers.options.rescale = +this.checked;
  invokeActiveZooming();
});

styleOceanFill.addEventListener("input", function () {
  styles.ocean.base.attrs.fill = this.value;
  d3.select("#oceanLayers").select("rect").attr("fill", this.value);
  styleOceanFillOutput.value = this.value;
});

styleOceanPattern.addEventListener("change", function () {
  styles.ocean.options.pattern = this.value;
  ensureEl("oceanicPattern").setAttribute("href", this.value);
});

styleOceanPatternOpacity.addEventListener("input", e => {
  styles.ocean.options.patternOpacity = +e.target.value;
  ensureEl("oceanicPattern").setAttribute("opacity", e.target.value);
});

outlineLayers.addEventListener("change", function () {
  styles.ocean.oceanLayers.options.outline = this.value;
  Layers.draw("ocean");
});

const heightsOptions = () => styles.heightmap[styleGroupSelect.value].options;

styleHeightmapScheme.addEventListener("change", function () {
  heightsOptions().scheme = this.value;
  Layers.draw("heightmap");
});

openCreateHeightmapSchemeButton.addEventListener("click", function () {
  // start with current scheme
  const scheme = heightsOptions().scheme;
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
    heightsOptions().scheme = stops;
    Layers.draw("heightmap");

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
  heightsOptions().render = e.target.checked;
  Layers.draw("heightmap");
});

styleHeightmapTerracing.addEventListener("input", e => {
  heightsOptions().terracing = +e.target.value || 0;
  Layers.draw("heightmap");
});

styleHeightmapSkip.addEventListener("input", e => {
  heightsOptions().skip = +e.target.value || 0;
  Layers.draw("heightmap");
});

styleHeightmapSimplification.addEventListener("input", e => {
  heightsOptions().relax = +e.target.value || 0;
  Layers.draw("heightmap");
});

styleHeightmapCurve.addEventListener("change", e => {
  heightsOptions().curve = e.target.value;
  Layers.draw("heightmap");
});

styleReliefSet.addEventListener("change", e => {
  styles.relief.options.set = e.target.value;
  Relief.changeSet(e.target.value);
  Layers.draw("relief");
});

styleReliefSize.addEventListener("change", e => {
  const newSize = +e.target.value;
  const ratio = newSize / styles.relief.options.size;
  styles.relief.options.size = newSize;
  if (ratio === 1) return;

  Relief.changeSize(ratio);
  Layers.draw("relief");
});

// density defines the placement, so it cannot be applied without regenerating the icons
styleReliefDensity.addEventListener("change", e => {
  styles.relief.options.density = +e.target.value;
  Relief.generate();
  Layers.draw("relief");
});

styleTemperatureFillOpacityInput.addEventListener("input", e => {
  styles.temperature.attrs["fill-opacity"] = +e.target.value;
  d3.select("#temperature").attr("fill-opacity", e.target.value);
});

styleTemperatureFontSizeInput.addEventListener("input", e => {
  styles.temperature.attrs["font-size"] = e.target.value + "px";
  d3.select("#temperature").attr("font-size", e.target.value + "px");
});

styleTemperatureFillInput.addEventListener("input", e => {
  styles.temperature.attrs.fill = e.target.value;
  d3.select("#temperature").attr("fill", e.target.value);
  styleTemperatureFillOutput.value = e.target.value;
});

stylePopulationRuralStrokeInput.addEventListener("input", e => {
  styles.population.rural.attrs.stroke = e.target.value;
  d3.select("#population").select("#rural").attr("stroke", e.target.value);
  stylePopulationRuralStrokeOutput.value = e.target.value;
});

stylePopulationUrbanStrokeInput.addEventListener("input", e => {
  styles.population.urban.attrs.stroke = e.target.value;
  d3.select("#population").select("#urban").attr("stroke", e.target.value);
  stylePopulationUrbanStrokeOutput.value = e.target.value;
});

const burgIconsGroup = () => styles.burgIcons.burgIcons.groups[styleGroupSelect.value];

styleBurgIconsIcon.addEventListener("change", e => {
  const group = burgIconsGroup();
  if (group) group.options.icon = e.target.value;
  getEl().attr("data-icon", e.target.value).selectAll("use").attr("href", e.target.value);
});

styleBurgIconsIconSize.addEventListener("input", e => {
  const group = burgIconsGroup();
  if (group) group.options.size = +e.target.value || 1;
  getEl().attr("font-size", e.target.value);
});

styleBurgIconsStrokeLinejoin.addEventListener("change", e => {
  writeSelectedAttr("stroke-linejoin", e.target.value || null);
});

styleBurgIconsFillOpacity.addEventListener("input", e => {
  writeSelectedAttr("fill-opacity", +e.target.value);
});

styleCompassSizeInput.addEventListener("input", shiftCompass);
styleCompassShiftX.addEventListener("input", shiftCompass);
styleCompassShiftY.addEventListener("input", shiftCompass);

function shiftCompass() {
  const tr = `translate(${styleCompassShiftX.value} ${styleCompassShiftY.value}) scale(${styleCompassSizeInput.value})`;
  styles.compass.compassRose.attrs.transform = tr;
  d3.select("#compass").select("use").attr("transform", tr);
}

styleLegendColItems.addEventListener("input", e => {
  styles.legend.options.columns = +e.target.value || 8;
  Layers.draw("legend");
});

styleLegendBack.addEventListener("input", e => {
  styleLegendBackOutput.value = e.target.value;
  styles.legend.box.attrs.fill = e.target.value;
  d3.select("#legend").select("#legendBox").attr("fill", e.target.value);
});

styleLegendOpacity.addEventListener("input", e => {
  styles.legend.box.attrs["fill-opacity"] = +e.target.value;
  d3.select("#legend").select("#legendBox").attr("fill-opacity", e.target.value);
});

styleSelectFont.addEventListener("change", changeFont);
function changeFont() {
  writeSelectedAttr("font-family", styleSelectFont.value);
  if (styleElementSelect.value === "legend") Layers.draw("legend");
}

styleShadowInput.addEventListener("input", function () {
  // the label shift transform lives in the same inline style, so merge instead of replacing
  const groupStyle = styles.labels.groups[styleGroupSelect.value];
  const shadow = this.value.trim();
  if (groupStyle) groupStyle.attrs.style = setInlineStyleProperty(groupStyle.attrs.style, "text-shadow", shadow);
  getEl().style("text-shadow", shadow || null);
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

  const groupStyle = styles.labels.groups[styleGroupSelect.value];
  if (styleElementSelect.value === "labels") {
    el.attr("font-size", `${size}%`).attr("data-size", null);
    if (groupStyle) groupStyle.attrs["font-size"] = `${size}%`;
    return;
  }

  if (styleElementSelect.value === "coordinates") {
    styles.coordinates.options.fontSize = size;
    Layers.draw("coordinates");
    return;
  }
  if (styleElementSelect.value === "legend") {
    styles.legend.options.fontSize = size;
    Layers.draw("legend");
    return;
  }
  if (styleElementSelect.value === "ruler") {
    styles.rulers.options.fontSize = size;
    Layers.draw("rulers");
    return;
  }

  if (styleElementSelect.value === "anchors") {
    const group = styles.burgIcons.anchors.groups[styleGroupSelect.value];
    if (group) group.options.size = size;
    el.attr("font-size", size);
    return;
  }

  ERROR && console.error(`Style editor: no font size handler for ${styleElementSelect.value}`);
}

function applyLabelShift(axis, value) {
  const groupStyle = styles.labels.groups[styleGroupSelect.value];
  if (!groupStyle) return;
  const current = getLabelShift(groupStyle.attrs.style);
  current[axis] = +value || 0;
  const transform = current.dx || current.dy ? `translate(${current.dx}em, ${current.dy}em)` : "";
  groupStyle.attrs.style = setInlineStyleProperty(groupStyle.attrs.style, "transform", transform);
  getEl().attr("style", groupStyle.attrs.style);
}

styleFontShiftX.addEventListener("input", e => applyLabelShift("dx", e.target.value));

styleFontShiftY.addEventListener("input", e => applyLabelShift("dy", e.target.value));

styleStatesBodyOpacity.addEventListener("input", e => {
  styles.states.statesBody.attrs.opacity = +e.target.value;
  d3.select("#statesBody").attr("opacity", e.target.value);
});

styleStatesBodyFilter.addEventListener("change", function () {
  styles.states.statesBody.attrs.filter = this.value || null;
  d3.select("#statesBody").attr("filter", this.value || null);
});

styleStatesHaloWidth.addEventListener("input", e => {
  const value = +e.target.value;
  styles.states.statesHalo.options.width = value;
  styles.states.statesHalo.attrs["stroke-width"] = value;
  d3.select("#statesHalo").attr("stroke-width", value);
});

styleStatesHaloOpacity.addEventListener("input", e => {
  styles.states.statesHalo.attrs.opacity = +e.target.value;
  d3.select("#statesHalo").attr("opacity", e.target.value);
});

styleStatesHaloBlur.addEventListener("input", e => {
  const value = Number(e.target.value);
  const blur = value > 0 ? `blur(${value}px)` : null;
  styles.states.statesHalo.attrs.filter = blur;
  d3.select("#statesHalo").attr("filter", blur);
});

styleArmiesFillOpacity.addEventListener("input", e => {
  styles.military.attrs["fill-opacity"] = +e.target.value;
  d3.select("#armies").attr("fill-opacity", e.target.value);
});

styleArmiesSize.addEventListener("input", e => {
  const value = Number(e.target.value);
  styles.military.options.boxSize = value;
  styles.military.options.fontSize = value * 2;
  Layers.draw("military");
});

emblemsStateSizeInput.addEventListener("change", e => {
  styles.emblems.stateEmblems.options.size = +e.target.value || 1;
  Layers.draw("emblems");
});

emblemsProvinceSizeInput.addEventListener("change", e => {
  styles.emblems.provinceEmblems.options.size = +e.target.value || 1;
  Layers.draw("emblems");
});

emblemsBurgSizeInput.addEventListener("change", e => {
  styles.emblems.burgEmblems.options.size = +e.target.value || 1;
  Layers.draw("emblems");
});

showAllEmblems.addEventListener("change", e => {
  options.emblems.showAll = e.target.checked;
  invokeActiveZooming();
});

styleGoodsCircle.addEventListener("change", function () {
  styles.goods.goodsIcons.options.circle = this.checked;
  Layers.draw("goods");
});

styleGoodsSize.addEventListener("input", function () {
  styles.goods.goodsIcons.options.size = +this.value || 6;
  Layers.draw("goods");
});

styleGoodsBurgsSize.addEventListener("input", function () {
  styles.goods.goodsBurgs.options.size = +this.value || 3;
  Layers.draw("goods");
});

styleMarketsLayerFillOpacity.addEventListener("input", e => {
  styles.markets.attrs["fill-opacity"] = +e.target.value;
  d3.select("#markets").attr("fill-opacity", e.target.value);
});

styleMarketsSize.addEventListener("input", function () {
  styles.markets.options.size = +this.value || 3;
  Layers.draw("markets");
});

styleMarketsIconSize.addEventListener("input", function () {
  styles.markets.options.fontSize = +this.value || 5;
  Layers.draw("markets");
});

styleMarketsIcon.addEventListener("click", function () {
  window.Controllers.IconSelector.open(styles.markets.options.icon, value => {
    styles.markets.options.icon = value;
    this.innerHTML = value;
    Layers.draw("markets");
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

styleVignettePreset.addEventListener("change", function () {
  const attributes = JSON.parse(vignettePresets[this.value]);

  for (const selector in attributes) {
    const el = document.querySelector(selector);
    if (!el) continue;
    const target = selector === "#vignette" ? styles.vignette.attrs : styles.vignette.options;
    for (const attr in attributes[selector]) {
      const value = attributes[selector][attr];
      if (attr in target) target[attr] = value;
      if (value === null) el.removeAttribute(attr);
      else el.setAttribute(attr, value);
    }
  }

  styleOpacityInput.value = styles.vignette.attrs.opacity ?? 1;
  styleFillInput.value = styleFillOutput.value = styles.vignette.attrs.fill;
  styleFilterInput.value = styles.vignette.attrs.filter || "";
  updateVignetteInputs();
});

styleVignetteX.addEventListener("input", e => {
  styles.vignette.options.x = `${e.target.value}%`;
  ensureEl("vignette-rect").setAttribute("x", `${e.target.value}%`);
});

styleVignetteWidth.addEventListener("input", e => {
  styles.vignette.options.width = `${e.target.value}%`;
  ensureEl("vignette-rect").setAttribute("width", `${e.target.value}%`);
});

styleVignetteY.addEventListener("input", e => {
  styles.vignette.options.y = `${e.target.value}%`;
  ensureEl("vignette-rect").setAttribute("y", `${e.target.value}%`);
});

styleVignetteHeight.addEventListener("input", e => {
  styles.vignette.options.height = `${e.target.value}%`;
  ensureEl("vignette-rect").setAttribute("height", `${e.target.value}%`);
});

styleVignetteRx.addEventListener("input", e => {
  styles.vignette.options.rx = `${e.target.value}%`;
  ensureEl("vignette-rect").setAttribute("rx", `${e.target.value}%`);
});

styleVignetteRy.addEventListener("input", e => {
  styles.vignette.options.ry = `${e.target.value}%`;
  ensureEl("vignette-rect").setAttribute("ry", `${e.target.value}%`);
});

styleVignetteBlur.addEventListener("input", e => {
  styles.vignette.options.filter = `blur(${e.target.value}px)`;
  ensureEl("vignette-rect").setAttribute("filter", `blur(${e.target.value}px)`);
});

styleScaleBar.addEventListener("input", function (event) {
  const scaleBarBack = d3.select("#scaleBar").select("#scaleBarBack");
  if (!scaleBarBack.size()) return;

  const { id, value } = event.target;

  if (id === "styleScaleBarSize") styles.scaleBar.options.barSize = +value || 1;
  else if (id === "styleScaleBarFontSize") {
    styles.scaleBar.attrs["font-size"] = +value || 10;
    d3.select("#scaleBar").attr("font-size", value);
  } else if (id === "styleScaleBarPositionX") styles.scaleBar.options.x = +value || 0;
  else if (id === "styleScaleBarPositionY") styles.scaleBar.options.y = +value || 0;
  else if (id === "styleScaleBarLabel") styles.scaleBar.options.label = value;
  else if (id === "styleScaleBarBackgroundOpacity") writeBackAttr("opacity", +value || 0);
  else if (id === "styleScaleBarBackgroundFill") writeBackAttr("fill", value);
  else if (id === "styleScaleBarBackgroundStroke") writeBackAttr("stroke", value);
  else if (id === "styleScaleBarBackgroundStrokeWidth") writeBackAttr("stroke-width", +value || 0);
  else if (id === "styleScaleBarBackgroundFilter") writeBackAttr("filter", value || null);
  else if (id === "styleScaleBarBackgroundPaddingTop") styles.scaleBar.back.options.top = +value || 0;
  else if (id === "styleScaleBarBackgroundPaddingRight") styles.scaleBar.back.options.right = +value || 0;
  else if (id === "styleScaleBarBackgroundPaddingBottom") styles.scaleBar.back.options.bottom = +value || 0;
  else if (id === "styleScaleBarBackgroundPaddingLeft") styles.scaleBar.back.options.left = +value || 0;
  Layers.draw("scaleBar");

  // drawScaleBar only lays the background rect out; its paint comes from the store, so the
  // edit must land there or Styles.write would restore the stored value on the next load
  function writeBackAttr(attr, attrValue) {
    styles.scaleBar.back.attrs[attr] = attrValue;
    scaleBarBack.attr(attr, attrValue);
  }
});

// GLOBAL FILTERS
mapFilters.addEventListener("click", applyMapFilter);
function applyMapFilter(event) {
  if (event.target.tagName !== "BUTTON") return;
  const button = event.target;
  styles.map.options.dataFilter = null;
  styles.map.attrs.filter = null;
  d3.select("#map").attr("filter", null);
  if (button.classList.contains("pressed")) return button.classList.remove("pressed");

  mapFilters.querySelectorAll(".pressed").forEach(button => button.classList.remove("pressed"));
  button.classList.add("pressed");
  styles.map.options.dataFilter = button.id;
  styles.map.attrs.filter = "url(#filter-" + button.id + ")";
  d3.select("#map").attr("filter", "url(#filter-" + button.id + ")");
}
