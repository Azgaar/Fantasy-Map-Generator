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

function selectStyleElement() {
  const styleElement = styleElementSelect.value;
  let el = d3.select("#" + styleElement);

  styleElements.querySelectorAll("tbody").forEach(e => (e.style.display = "none")); // hide all sections

  // show alert line if layer is not visible
  const isLayerOff = styleElement !== "ocean" && (el.style("display") === "none" || !el.selectAll("*").size());
  styleIsOff.style.display = isLayerOff ? "block" : "none";

  // active group element
  if (["anchors", "borders", "burgIcons", "coastline", "lakes", "labels", "routes", "terrs"].includes(styleElement)) {
    const group = styleGroupSelect.value;
    const defaultGroupSelector = styleElement === "terrs" ? "#landHeights" : "g";
    if (styleElement === "labels") {
      const selected = group && el.select(`[data-group="${CSS.escape(group)}"]`);
      el = selected && selected.size() ? selected : el.select(defaultGroupSelector);
    } else {
      el = group && el.select("#" + group).size() ? el.select("#" + group) : el.select(defaultGroupSelector);
    }
  }

  // opacity
  if (!["landmass", "legend", "ocean", "regions"].includes(styleElement)) {
    styleOpacity.style.display = "block";
    styleOpacityInput.value = el.attr("opacity") || 1;
  }

  // filter
  if (!["landmass", "legend", "regions", "scaleBar"].includes(styleElement)) {
    styleFilter.style.display = "block";
    styleFilterInput.value = el.attr("filter") || "";
  }

  // fill
  if (["fogging", "ice", "lakes", "landmass", "prec", "rivers", "scaleBar", "vignette"].includes(styleElement)) {
    styleFill.style.display = "block";
    styleFillInput.value = styleFillOutput.value = el.attr("fill");
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
      "goods",
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
    styleStrokeInput.value = styleStrokeOutput.value = el.attr("stroke");
    styleStrokeWidth.style.display = "block";
    styleStrokeWidthInput.value = el.attr("stroke-width") || 0;
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
    styleStrokeDasharrayInput.value = el.attr("stroke-dasharray") || "";
    styleStrokeLinecapInput.value = el.attr("stroke-linecap") || "inherit";
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
    styleClippingInput.value = el.attr("mask") || "";
  }

  // show specific sections
  if (styleElement === "texture") {
    styleTexture.style.display = "block";
    styleTextureShiftX.value = el.attr("data-x") || 0;
    styleTextureShiftY.value = el.attr("data-y") || 0;
    updateTextureSelectValue(el.attr("data-href"));
  }

  if (styleElement === "terrs") {
    styleHeightmap.style.display = "block";
    styleHeightmapRenderOceanOption.style.display = el.attr("id") === "oceanHeights" ? "block" : "none";
    styleHeightmapRenderOcean.checked = +el.attr("data-render");

    styleHeightmapScheme.value = el.attr("scheme");
    styleHeightmapTerracing.value = el.attr("terracing");
    styleHeightmapSkip.value = el.attr("skip");
    styleHeightmapSimplification.value = el.attr("relax");
    styleHeightmapCurve.value = el.attr("curve");
  }

  if (styleElement === "markers") {
    styleMarkers.style.display = "block";
    styleRescaleMarkers.checked = +d3.select("#markers").attr("rescale");
  }

  if (styleElement === "gridOverlay") {
    styleGrid.style.display = "block";
    styleGridType.value = el.attr("type");
    styleGridScale.value = el.attr("scale") || 1;
    styleGridShiftX.value = el.attr("dx") || 0;
    styleGridShiftY.value = el.attr("dy") || 0;
    calculateFriendlyGridSize();
  }

  if (styleElement === "compass") {
    styleCompass.style.display = "block";
    const tr = parseTransform(d3.select("#compass").select("use").attr("transform"));
    styleCompassShiftX.value = tr[0];
    styleCompassShiftY.value = tr[1];
    styleCompassSizeInput.value = tr[2];
  }

  if (styleElement === "terrain") {
    styleRelief.style.display = "block";
    styleReliefSize.value = style.relief.size;
    styleReliefDensity.value = style.relief.density;
    styleReliefSet.value = style.relief.set;
  }

  if (styleElement === "population") {
    stylePopulation.style.display = "block";
    stylePopulationRuralStrokeInput.value = stylePopulationRuralStrokeOutput.value = d3
      .select("#population")
      .select("#rural")
      .attr("stroke");
    stylePopulationUrbanStrokeInput.value = stylePopulationUrbanStrokeOutput.value = d3
      .select("#population")
      .select("#urban")
      .attr("stroke");
    styleStrokeWidth.style.display = "block";
    styleStrokeWidthInput.value = el.attr("stroke-width") || 0;
  }

  if (styleElement === "regions") {
    styleStates.style.display = "block";
    styleStatesBodyOpacity.value = d3.select("#statesBody").attr("opacity") || 1;
    styleStatesBodyFilter.value = d3.select("#statesBody").attr("filter") || "";
    styleStatesHaloWidth.value = d3.select("#statesHalo").attr("data-width") || 10;
    styleStatesHaloOpacity.value = d3.select("#statesHalo").attr("opacity") || 1;
    styleStatesHaloBlur.value =
      parseFloat(
        d3
          .select("#statesHalo")
          .attr("filter")
          ?.match(/blur\(([^)]+)\)/)?.[1]
      ) || 0;
  }

  if (styleElement === "labels") {
    styleFill.style.display = "block";
    styleStroke.style.display = "block";
    styleStrokeWidth.style.display = "block";
    styleLetterSpacing.style.display = "block";

    styleShadow.style.display = "block";
    styleSize.style.display = "block";
    styleFillInput.value = styleFillOutput.value = el.attr("fill") || "#3e3e4b";
    styleStrokeInput.value = styleStrokeOutput.value = el.attr("stroke") || "#3a3a3a";
    styleStrokeWidthInput.value = el.attr("stroke-width") || 0;
    styleLetterSpacingInput.value = el.attr("letter-spacing") || 0;
    styleShadowInput.value = el.style("text-shadow") || "";

    styleFont.style.display = "block";
    styleSelectFont.value = el.attr("font-family");
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
    styleFillInput.value = styleFillOutput.value = el.attr("fill") || "#ffffff";
    styleStrokeInput.value = styleStrokeOutput.value = el.attr("stroke") || "#3e3e4b";
    styleStrokeWidthInput.value = el.attr("stroke-width") || 0.24;
    styleStrokeDasharrayInput.value = el.attr("stroke-dasharray") || "";
    styleStrokeLinecapInput.value = el.attr("stroke-linecap") || "inherit";
  }

  if (styleElement === "anchors") {
    styleFill.style.display = "block";
    styleStroke.style.display = "block";
    styleStrokeWidth.style.display = "block";
    styleSize.style.display = "block";
    styleFillInput.value = styleFillOutput.value = el.attr("fill") || "#ffffff";
    styleStrokeInput.value = styleStrokeOutput.value = el.attr("stroke") || "#3e3e4b";
    styleStrokeWidthInput.value = el.attr("stroke-width") || 0.24;
    styleFontSize.value = el.attr("font-size") || 1;
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
    styleOceanFill.value = styleOceanFillOutput.value = d3.select("#oceanLayers").select("#oceanBase").attr("fill");
    styleOceanPattern.value = ensureEl("oceanicPattern").getAttribute("href");
    styleOceanPatternOpacity.value = ensureEl("oceanicPattern").getAttribute("opacity") || 1;
    outlineLayers.value = d3.select("#oceanLayers").attr("layers");
  }

  if (styleElement === "temperature") {
    styleStrokeWidth.style.display = "block";
    styleTemperature.style.display = "block";
    styleStrokeWidthInput.value = el.attr("stroke-width") || "";
    styleTemperatureFillOpacityInput.value = el.attr("fill-opacity") || 0.1;
    styleTemperatureFillInput.value = styleTemperatureFillOutput.value = el.attr("fill") || "#000";
    styleTemperatureFontSizeInput.value = el.attr("font-size") || "8px";
  }

  if (styleElement === "coordinates") {
    styleSize.style.display = "block";
    styleFontSize.value = el.attr("data-size");
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
    styleArmies.style.display = "block";
    styleArmiesFillOpacity.value = el.attr("fill-opacity");
    styleArmiesSize.value = el.attr("box-size");
  }

  if (styleElement === "emblems") {
    styleEmblems.style.display = "block";
    styleStrokeWidth.style.display = "block";
    styleStrokeWidthInput.value = el.attr("stroke-width") || 1;
    emblemsStateSizeInput.value = d3.select("#emblems").select("#stateEmblems").attr("data-size") || 1;
    emblemsProvinceSizeInput.value = d3.select("#emblems").select("#provinceEmblems").attr("data-size") || 1;
    emblemsBurgSizeInput.value = d3.select("#emblems").select("#burgEmblems").attr("data-size") || 1;
    showAllEmblems.checked = options.emblems.showAll;
  }

  if (styleElement === "goodsIcons") {
    styleStrokeWidth.style.display = "block";
    styleStrokeWidthInput.value = el.attr("stroke-width") || "";
    styleGoods.style.display = "block";
    styleGoodsCircle.checked = +el.attr("data-circle");
    styleGoodsSize.value = el.attr("data-size") || 6;
  }

  if (styleElement === "goodsBurgs") {
    styleStrokeWidth.style.display = "block";
    styleStrokeWidthInput.value = el.attr("stroke-width") || "0.2";
    styleStroke.style.display = "block";
    styleStrokeInput.value = styleStrokeOutput.value = el.attr("stroke") || "#41414f";
    styleGoodsBurgs.style.display = "block";
    styleGoodsBurgsSize.value = el.attr("data-size") || 3;
  }

  if (styleElement === "markets") {
    styleStrokeWidth.style.display = "block";
    styleStrokeWidthInput.value = el.attr("stroke-width") || "0.5";
    styleMarketsLayer.style.display = "block";
    styleMarketsLayerFillOpacity.value = el.attr("fill-opacity") || "0";
    styleMarketsSize.value = el.attr("data-size") || 3;
    styleMarketsIconSize.value = el.attr("font-size") || 5;
    styleMarketsIcon.innerHTML = el.attr("data-icon") || "⚖️";
  }

  // update group options
  styleGroupSelect.options.length = 0; // remove all options
  if (["anchors", "borders", "burgIcons", "coastline", "lakes", "labels", "routes", "terrs"].includes(styleElement)) {
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
      const digit = str => str.replace(/[^\d.]/g, "");
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

function getEl() {
  const el = styleElementSelect.value;
  const g = styleGroupSelect.value;
  const map = d3.select("#map");
  if (g === el || g === "") return map.select("#" + el);
  if (el === "labels") return map.select("#labels").select(`[data-group="${CSS.escape(g)}"]`);
  else return map.select("#" + el).select("#" + g);
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
  getEl().attr("fill", this.value);
  const groupStyle = style.labels.groups[styleGroupSelect.value];
  if (groupStyle) groupStyle.fill = this.value;
});

styleStrokeInput.addEventListener("input", function () {
  styleStrokeOutput.value = this.value;
  getEl().attr("stroke", this.value);
  const groupStyle = style.labels.groups[styleGroupSelect.value];
  if (groupStyle) groupStyle.stroke = this.value;
  if (styleElementSelect.value === "gridOverlay") Layers.draw("grid");
});

styleStrokeWidthInput.addEventListener("input", e => {
  getEl().attr("stroke-width", e.target.value);
  const groupStyle = style.labels.groups[styleGroupSelect.value];
  if (groupStyle) groupStyle["stroke-width"] = e.target.value;
  if (styleElementSelect.value === "gridOverlay") Layers.draw("grid");
  if (styleElementSelect.value === "ruler") Layers.draw("rulers");
});

styleLetterSpacingInput.addEventListener("input", e => {
  getEl().attr("letter-spacing", e.target.value);
  const groupStyle = style.labels.groups[styleGroupSelect.value];
  if (groupStyle) groupStyle["letter-spacing"] = e.target.value;
});

styleStrokeDasharrayInput.addEventListener("input", function () {
  getEl().attr("stroke-dasharray", this.value);
  if (styleElementSelect.value === "gridOverlay") Layers.draw("grid");
  if (styleElementSelect.value === "ruler") Layers.draw("rulers");
});

styleStrokeLinecapInput.addEventListener("change", function () {
  getEl().attr("stroke-linecap", this.value);
  if (styleElementSelect.value === "gridOverlay") Layers.draw("grid");
});

styleDisplayInput.addEventListener("change", function () {
  getEl().attr("display", this.value || null);
});

styleOpacityInput.addEventListener("input", e => {
  getEl().attr("opacity", e.target.value);
  const groupStyle = style.labels.groups[styleGroupSelect.value];
  if (groupStyle) groupStyle.opacity = e.target.value;
});

styleFilterInput.addEventListener("change", function () {
  if (styleGroupSelect.value === "ocean") return d3.select("#oceanLayers").attr("filter", this.value);
  getEl().attr("filter", this.value);
  const groupStyle = style.labels.groups[styleGroupSelect.value];
  if (groupStyle) {
    if (this.value) groupStyle.filter = this.value;
    else delete groupStyle.filter;
  }
});

styleTextureInput.addEventListener("change", function () {
  changeTexture(this.value);
});

function changeTexture(href) {
  d3.select("#texture").attr("data-href", href);
  d3.select("#texture").select("image").attr("href", href);
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
  d3.select("#texture").attr("data-x", this.value);
  d3.select("#texture")
    .select("image")
    .attr("x", this.value)
    .attr("width", graphWidth - this.valueAsNumber);
});

styleTextureShiftY.addEventListener("input", function () {
  d3.select("#texture").attr("data-y", this.value);
  d3.select("#texture")
    .select("image")
    .attr("y", this.value)
    .attr("height", graphHeight - this.valueAsNumber);
});

styleClippingInput.addEventListener("change", function () {
  getEl().attr("mask", this.value);
});

styleGridType.addEventListener("change", function () {
  getEl().attr("type", this.value);
  Layers.draw("grid");
  calculateFriendlyGridSize();
});

styleGridScale.addEventListener("input", function () {
  getEl().attr("scale", this.value);
  Layers.draw("grid");
  calculateFriendlyGridSize();
});

function calculateFriendlyGridSize() {
  const size = styleGridScale.value * 25;
  const friendly = `${rn(size * distanceScale, 2)} ${distanceUnitInput.value}`;
  styleGridSizeFriendly.value = friendly;
}

styleGridShiftX.addEventListener("input", function () {
  getEl().attr("dx", this.value);
  Layers.draw("grid");
});

styleGridShiftY.addEventListener("input", function () {
  getEl().attr("dy", this.value);
  Layers.draw("grid");
});

styleRescaleMarkers.addEventListener("change", function () {
  d3.select("#markers").attr("rescale", +this.checked);
  invokeActiveZooming();
});

styleOceanFill.addEventListener("input", function () {
  d3.select("#oceanLayers").select("rect").attr("fill", this.value);
  styleOceanFillOutput.value = this.value;
});

styleOceanPattern.addEventListener("change", function () {
  ensureEl("oceanicPattern").setAttribute("href", this.value);
});

styleOceanPatternOpacity.addEventListener("input", e => {
  ensureEl("oceanicPattern").setAttribute("opacity", e.target.value);
});

outlineLayers.addEventListener("change", function () {
  d3.select("#oceanLayers").attr("layers", this.value);
  Layers.draw("ocean");
});

styleHeightmapScheme.addEventListener("change", function () {
  getEl().attr("scheme", this.value);
  Layers.draw("heightmap");
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
  const checked = +e.target.checked;
  getEl().attr("data-render", checked);
  Layers.draw("heightmap");
});

styleHeightmapTerracing.addEventListener("input", e => {
  getEl().attr("terracing", e.target.value);
  Layers.draw("heightmap");
});

styleHeightmapSkip.addEventListener("input", e => {
  getEl().attr("skip", e.target.value);
  Layers.draw("heightmap");
});

styleHeightmapSimplification.addEventListener("input", e => {
  getEl().attr("relax", e.target.value);
  Layers.draw("heightmap");
});

styleHeightmapCurve.addEventListener("change", e => {
  getEl().attr("curve", e.target.value);
  Layers.draw("heightmap");
});

styleReliefSet.addEventListener("change", e => {
  style.relief.set = e.target.value;
  Relief.changeSet(e.target.value);
  Layers.draw("relief");
});

styleReliefSize.addEventListener("change", e => {
  const newSize = +e.target.value;
  const ratio = newSize / style.relief.size;
  style.relief.size = newSize;
  if (ratio === 1) return;

  Relief.changeSize(ratio);
  Layers.draw("relief");
});

// density defines the placement, so it cannot be applied without regenerating the icons
styleReliefDensity.addEventListener("change", e => {
  style.relief.density = +e.target.value;
  Relief.generate();
  Layers.draw("relief");
});

styleTemperatureFillOpacityInput.addEventListener("input", e => {
  d3.select("#temperature").attr("fill-opacity", e.target.value);
});

styleTemperatureFontSizeInput.addEventListener("input", e => {
  d3.select("#temperature").attr("font-size", e.target.value + "px");
});

styleTemperatureFillInput.addEventListener("input", e => {
  d3.select("#temperature").attr("fill", e.target.value);
  styleTemperatureFillOutput.value = e.target.value;
});

stylePopulationRuralStrokeInput.addEventListener("input", e => {
  d3.select("#population").select("#rural").attr("stroke", e.target.value);
  stylePopulationRuralStrokeOutput.value = e.target.value;
});

stylePopulationUrbanStrokeInput.addEventListener("input", e => {
  d3.select("#population").select("#urban").attr("stroke", e.target.value);
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

function shiftCompass() {
  const tr = `translate(${styleCompassShiftX.value} ${styleCompassShiftY.value}) scale(${styleCompassSizeInput.value})`;
  d3.select("#compass").select("use").attr("transform", tr);
}

styleLegendColItems.addEventListener("input", e => {
  d3.select("#legend").select("#legendBox").attr("data-columns", e.target.value);
  Layers.draw("legend");
});

styleLegendBack.addEventListener("input", e => {
  styleLegendBackOutput.value = e.target.value;
  d3.select("#legend").select("#legendBox").attr("fill", e.target.value);
});

styleLegendOpacity.addEventListener("input", e => {
  d3.select("#legend").select("#legendBox").attr("fill-opacity", e.target.value);
});

styleSelectFont.addEventListener("change", changeFont);
function changeFont() {
  const family = styleSelectFont.value;
  getEl().attr("font-family", family);
  const groupStyle = style.labels.groups[styleGroupSelect.value];
  if (groupStyle) groupStyle["font-family"] = family;

  if (styleElementSelect.value === "legend") Layers.draw("legend");
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

  const scaleSize = styleElementSelect.value === "coordinates" ? rn(size / scale ** 0.8, 2) : size;
  el.attr("data-size", size).attr("font-size", scaleSize);

  if (styleElementSelect.value === "legend") Layers.draw("legend");
  if (styleElementSelect.value === "ruler") Layers.draw("rulers");
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
  d3.select("#statesBody").attr("opacity", e.target.value);
});

styleStatesBodyFilter.addEventListener("change", function () {
  d3.select("#statesBody").attr("filter", this.value);
});

styleStatesHaloWidth.addEventListener("input", e => {
  const value = e.target.value;
  d3.select("#statesHalo").attr("data-width", value).attr("stroke-width", value);
});

styleStatesHaloOpacity.addEventListener("input", e => {
  d3.select("#statesHalo").attr("opacity", e.target.value);
});

styleStatesHaloBlur.addEventListener("input", e => {
  const value = Number(e.target.value);
  const blur = value > 0 ? `blur(${value}px)` : null;
  d3.select("#statesHalo").attr("filter", blur);
});

styleArmiesFillOpacity.addEventListener("input", e => {
  d3.select("#armies").attr("fill-opacity", e.target.value);
});

styleArmiesSize.addEventListener("input", e => {
  const value = Number(e.target.value);
  d3.select("#armies")
    .attr("box-size", value)
    .attr("font-size", value * 2);

  Layers.draw("military");
});

emblemsStateSizeInput.addEventListener("change", e => {
  d3.select("#emblems").select("#stateEmblems").attr("data-size", e.target.value);
  Layers.draw("emblems");
});

emblemsProvinceSizeInput.addEventListener("change", e => {
  d3.select("#emblems").select("#provinceEmblems").attr("data-size", e.target.value);
  Layers.draw("emblems");
});

emblemsBurgSizeInput.addEventListener("change", e => {
  d3.select("#emblems").select("#burgEmblems").attr("data-size", e.target.value);
  Layers.draw("emblems");
});

showAllEmblems.addEventListener("change", e => {
  options.emblems.showAll = e.target.checked;
  invokeActiveZooming();
});

styleGoodsCircle.addEventListener("change", function () {
  d3.select("#goods").select("#goodsIcons").attr("data-circle", +this.checked);
  Layers.draw("goods");
});

styleGoodsSize.addEventListener("change", function () {
  d3.select("#goods").select("#goodsIcons").attr("data-size", this.value);
  Layers.draw("goods");
});

styleGoodsBurgsSize.addEventListener("change", function () {
  d3.select("#goods").select("#goodsBurgs").attr("data-size", this.value);
  Layers.draw("goods");
});

styleMarketsLayerFillOpacity.addEventListener("input", e => {
  d3.select("#markets").attr("fill-opacity", e.target.value);
});

styleMarketsSize.addEventListener("change", function () {
  d3.select("#markets").attr("data-size", this.value);
  Layers.draw("markets");
});

styleMarketsIconSize.addEventListener("change", function () {
  d3.select("#markets").attr("font-size", this.value);
  Layers.draw("markets");
});

styleMarketsIcon.addEventListener("click", function () {
  window.Controllers.IconSelector.open(d3.select("#markets").attr("data-icon") || "⚖️", value => {
    d3.select("#markets").attr("data-icon", value);
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
    for (const attr in attributes[selector]) {
      const value = attributes[selector][attr];
      el.setAttribute(attr, value);
    }
  }

  const vignette = ensureEl("vignette");
  if (vignette) {
    styleOpacityInput.value = vignette.getAttribute("opacity");
    styleFillInput.value = styleFillOutput.value = vignette.getAttribute("fill");
    styleFilterInput.value = vignette.getAttribute("filter");
  }

  const maskRect = ensureEl("vignette-rect");
  if (maskRect) {
    const digit = str => str.replace(/[^\d.]/g, "");
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
  ensureEl("vignette-rect").setAttribute("x", `${e.target.value}%`);
});

styleVignetteWidth.addEventListener("input", e => {
  ensureEl("vignette-rect").setAttribute("width", `${e.target.value}%`);
});

styleVignetteY.addEventListener("input", e => {
  ensureEl("vignette-rect").setAttribute("y", `${e.target.value}%`);
});

styleVignetteHeight.addEventListener("input", e => {
  ensureEl("vignette-rect").setAttribute("height", `${e.target.value}%`);
});

styleVignetteRx.addEventListener("input", e => {
  ensureEl("vignette-rect").setAttribute("rx", `${e.target.value}%`);
});

styleVignetteRy.addEventListener("input", e => {
  ensureEl("vignette-rect").setAttribute("ry", `${e.target.value}%`);
});

styleVignetteBlur.addEventListener("input", e => {
  ensureEl("vignette-rect").setAttribute("filter", `blur(${e.target.value}px)`);
});

styleScaleBar.addEventListener("input", function (event) {
  const scaleBarBack = d3.select("#scaleBar").select("#scaleBarBack");
  if (!scaleBarBack.size()) return;

  const { id, value } = event.target;

  if (id === "styleScaleBarSize") d3.select("#scaleBar").attr("data-bar-size", value);
  else if (id === "styleScaleBarFontSize") d3.select("#scaleBar").attr("font-size", value);
  else if (id === "styleScaleBarPositionX") d3.select("#scaleBar").attr("data-x", value);
  else if (id === "styleScaleBarPositionY") d3.select("#scaleBar").attr("data-y", value);
  else if (id === "styleScaleBarLabel") d3.select("#scaleBar").attr("data-label", value);
  else if (id === "styleScaleBarBackgroundOpacity") scaleBarBack.attr("opacity", value);
  else if (id === "styleScaleBarBackgroundFill") scaleBarBack.attr("fill", value);
  else if (id === "styleScaleBarBackgroundStroke") scaleBarBack.attr("stroke", value);
  else if (id === "styleScaleBarBackgroundStrokeWidth") scaleBarBack.attr("stroke-width", value);
  else if (id === "styleScaleBarBackgroundFilter") scaleBarBack.attr("filter", value);
  else if (id === "styleScaleBarBackgroundPaddingTop") scaleBarBack.attr("data-top", value);
  else if (id === "styleScaleBarBackgroundPaddingRight") scaleBarBack.attr("data-right", value);
  else if (id === "styleScaleBarBackgroundPaddingBottom") scaleBarBack.attr("data-bottom", value);
  else if (id === "styleScaleBarBackgroundPaddingLeft") scaleBarBack.attr("data-left", value);
  Layers.draw("scaleBar");
});

// GLOBAL FILTERS
mapFilters.addEventListener("click", applyMapFilter);
function applyMapFilter(event) {
  if (event.target.tagName !== "BUTTON") return;
  const button = event.target;
  d3.select("#map").attr("data-filter", null).attr("filter", null);
  if (button.classList.contains("pressed")) return button.classList.remove("pressed");

  mapFilters.querySelectorAll(".pressed").forEach(button => button.classList.remove("pressed"));
  button.classList.add("pressed");
  d3.select("#map")
    .attr("data-filter", button.id)
    .attr("filter", "url(#filter-" + button.id + ")");
}
