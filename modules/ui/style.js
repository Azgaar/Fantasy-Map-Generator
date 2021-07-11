// UI module to control the style
"use strict";

// add available filters to lists
void (function addFilters() {
  const filters = Array.from(document.getElementById("filters").querySelectorAll("filter"));
  const emptyOption = '<option value="" selected>None</option>';
  const options = filters.map(filter => {
    const id = filter.getAttribute("id");
    const name = filter.getAttribute("name");
    return `<option value="url(#${id})">${name}</option>`;
  });
  const allOptions = emptyOption + options.join("");

  document.getElementById("styleFilterInput").innerHTML = allOptions;
  document.getElementById("styleStatesBodyFilter").innerHTML = allOptions;
})();

// store some style inputs as options
styleElements.addEventListener("change", function (ev) {
  if (ev.target.dataset.stored) lock(ev.target.dataset.stored);
});

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

// Toggle style sections on element select
styleElementSelect.addEventListener("change", selectStyleElement);
function selectStyleElement() {
  const sel = styleElementSelect.value;
  let el = d3.select("#" + sel);

  styleElements.querySelectorAll("tbody").forEach(e => (e.style.display = "none")); // hide all sections

  // show alert line if layer is not visible
  const isLayerOff = sel !== "ocean" && (el.style("display") === "none" || !el.selectAll("*").size());
  styleIsOff.style.display = isLayerOff ? "block" : "none";

  // active group element
  const group = styleGroupSelect.value;
  if (["routes", "labels", "coastline", "lakes", "anchors", "burgIcons", "borders"].includes(sel)) {
    const gEl = group && el.select("#" + group);
    el = group && gEl.size() ? gEl : el.select("g");
  }

  // opacity
  if (!["landmass", "ocean", "regions", "legend"].includes(sel)) {
    styleOpacity.style.display = "block";
    styleOpacityInput.value = styleOpacityOutput.value = el.attr("opacity") || 1;
  }

  // filter
  if (!["landmass", "legend", "regions"].includes(sel)) {
    styleFilter.style.display = "block";
    styleFilterInput.value = el.attr("filter") || "";
  }

  // fill
  if (["rivers", "lakes", "landmass", "prec", "ice", "fogging"].includes(sel)) {
    styleFill.style.display = "block";
    styleFillInput.value = styleFillOutput.value = el.attr("fill");
  }

  // stroke color and width
  if (["armies", "routes", "lakes", "borders", "cults", "relig", "cells", "coastline", "prec", "ice", "icons", "coordinates", "zones", "gridOverlay"].includes(sel)) {
    styleStroke.style.display = "block";
    styleStrokeInput.value = styleStrokeOutput.value = el.attr("stroke");
    styleStrokeWidth.style.display = "block";
    styleStrokeWidthInput.value = styleStrokeWidthOutput.value = el.attr("stroke-width") || "";
  }

  // stroke dash
  if (["routes", "borders", "temperature", "legend", "population", "coordinates", "zones", "gridOverlay"].includes(sel)) {
    styleStrokeDash.style.display = "block";
    styleStrokeDasharrayInput.value = el.attr("stroke-dasharray") || "";
    styleStrokeLinecapInput.value = el.attr("stroke-linecap") || "inherit";
  }

  // clipping
  if (["cells", "gridOverlay", "coordinates", "compass", "terrain", "temperature", "routes", "texture", "biomes", "zones"].includes(sel)) {
    styleClipping.style.display = "block";
    styleClippingInput.value = el.attr("mask") || "";
  }

  // show specific sections
  if (sel === "texture") styleTexture.style.display = "block";

  if (sel === "terrs") {
    styleHeightmap.style.display = "block";
    styleHeightmapScheme.value = terrs.attr("scheme");
    styleHeightmapTerracingInput.value = styleHeightmapTerracingOutput.value = terrs.attr("terracing");
    styleHeightmapSkipInput.value = styleHeightmapSkipOutput.value = terrs.attr("skip");
    styleHeightmapSimplificationInput.value = styleHeightmapSimplificationOutput.value = terrs.attr("relax");
    styleHeightmapCurve.value = terrs.attr("curve");
  }

  if (sel === "markers") {
    styleMarkers.style.display = "block";
    styleRescaleMarkers.checked = +markers.attr("rescale");
  }

  if (sel === "gridOverlay") {
    styleGrid.style.display = "block";
    styleGridType.value = el.attr("type");
    styleGridScale.value = el.attr("scale") || 1;
    styleGridShiftX.value = el.attr("dx") || 0;
    styleGridShiftY.value = el.attr("dy") || 0;
    calculateFriendlyGridSize();
  }

  if (sel === "compass") {
    styleCompass.style.display = "block";
    const tr = parseTransform(compass.select("use").attr("transform"));
    styleCompassShiftX.value = tr[0];
    styleCompassShiftY.value = tr[1];
    styleCompassSizeInput.value = styleCompassSizeOutput.value = tr[2];
  }

  if (sel === "terrain") {
    styleRelief.style.display = "block";
    styleReliefSizeOutput.innerHTML = styleReliefSizeInput.value = terrain.attr("size");
    styleReliefDensityOutput.innerHTML = styleReliefDensityInput.value = terrain.attr("density");
    styleReliefSet.value = terrain.attr("set");
  }

  if (sel === "population") {
    stylePopulation.style.display = "block";
    stylePopulationRuralStrokeInput.value = stylePopulationRuralStrokeOutput.value = population.select("#rural").attr("stroke");
    stylePopulationUrbanStrokeInput.value = stylePopulationUrbanStrokeOutput.value = population.select("#urban").attr("stroke");
    styleStrokeWidth.style.display = "block";
    styleStrokeWidthInput.value = styleStrokeWidthOutput.value = el.attr("stroke-width") || "";
  }

  if (sel === "regions") {
    styleStates.style.display = "block";
    styleStatesBodyOpacity.value = styleStatesBodyOpacityOutput.value = statesBody.attr("opacity") || 1;
    styleStatesBodyFilter.value = statesBody.attr("filter") || "";
    styleStatesHaloWidth.value = styleStatesHaloWidthOutput.value = statesHalo.attr("data-width") || 10;
    styleStatesHaloOpacity.value = styleStatesHaloOpacityOutput.value = statesHalo.attr("opacity") || 1;
    const blur = parseFloat(statesHalo.attr("filter")?.match(/blur\(([^)]+)\)/)?.[1]) || 0;
    styleStatesHaloBlur.value = styleStatesHaloBlurOutput.value = blur;
  }

  if (sel === "labels") {
    styleFill.style.display = "block";
    styleStroke.style.display = "block";
    styleStrokeWidth.style.display = "block";
    loadDefaultFonts();
    styleFont.style.display = "block";
    styleShadow.style.display = "block";
    styleSize.style.display = "block";
    styleVisibility.style.display = "block";
    styleFillInput.value = styleFillOutput.value = el.attr("fill") || "#3e3e4b";
    styleStrokeInput.value = styleStrokeOutput.value = el.attr("stroke") || "#3a3a3a";
    styleStrokeWidthInput.value = styleStrokeWidthOutput.value = el.attr("stroke-width") || 0;
    styleShadowInput.value = el.style("text-shadow") || "white 0 0 4px";
    styleSelectFont.value = fonts.indexOf(el.attr("data-font"));
    styleInputFont.style.display = "none";
    styleInputFont.value = "";
    styleFontSize.value = el.attr("data-size");
  }

  if (sel === "provs") {
    styleFill.style.display = "block";
    loadDefaultFonts();
    styleFont.style.display = "block";
    styleSize.style.display = "block";
    styleFillInput.value = styleFillOutput.value = el.attr("fill") || "#111111";
    styleSelectFont.value = fonts.indexOf(el.attr("data-font"));
    styleInputFont.style.display = "none";
    styleInputFont.value = "";
    styleFontSize.value = el.attr("data-size");
  }

  if (sel == "burgIcons") {
    styleFill.style.display = "block";
    styleStroke.style.display = "block";
    styleStrokeWidth.style.display = "block";
    styleStrokeDash.style.display = "block";
    styleRadius.style.display = "block";
    styleFillInput.value = styleFillOutput.value = el.attr("fill") || "#ffffff";
    styleStrokeInput.value = styleStrokeOutput.value = el.attr("stroke") || "#3e3e4b";
    styleStrokeWidthInput.value = styleStrokeWidthOutput.value = el.attr("stroke-width") || 0.24;
    styleStrokeDasharrayInput.value = el.attr("stroke-dasharray") || "";
    styleStrokeLinecapInput.value = el.attr("stroke-linecap") || "inherit";
    styleRadiusInput.value = el.attr("size") || 1;
  }

  if (sel == "anchors") {
    styleFill.style.display = "block";
    styleStroke.style.display = "block";
    styleStrokeWidth.style.display = "block";
    styleIconSize.style.display = "block";
    styleFillInput.value = styleFillOutput.value = el.attr("fill") || "#ffffff";
    styleStrokeInput.value = styleStrokeOutput.value = el.attr("stroke") || "#3e3e4b";
    styleStrokeWidthInput.value = styleStrokeWidthOutput.value = el.attr("stroke-width") || 0.24;
    styleIconSizeInput.value = el.attr("size") || 2;
  }

  if (sel === "legend") {
    styleStroke.style.display = "block";
    styleStrokeWidth.style.display = "block";
    loadDefaultFonts();
    styleFont.style.display = "block";
    styleSize.style.display = "block";

    styleLegend.style.display = "block";
    styleLegendColItemsOutput.value = styleLegendColItems.value = el.attr("data-columns");
    styleLegendBackOutput.value = styleLegendBack.value = el.select("#legendBox").attr("fill");
    styleLegendOpacityOutput.value = styleLegendOpacity.value = el.select("#legendBox").attr("fill-opacity");

    styleStrokeInput.value = styleStrokeOutput.value = el.attr("stroke") || "#111111";
    styleStrokeWidthInput.value = styleStrokeWidthOutput.value = el.attr("stroke-width") || 0.5;
    styleSelectFont.value = fonts.indexOf(el.attr("data-font"));
    styleInputFont.style.display = "none";
    styleInputFont.value = "";
    styleFontSize.value = el.attr("data-size");
  }

  if (sel === "ocean") {
    styleOcean.style.display = "block";
    styleOceanFill.value = styleOceanFillOutput.value = oceanLayers.select("#oceanBase").attr("fill");
    styleOceanPattern.value = document.getElementById("oceanicPattern")?.getAttribute("href");
    styleOceanPatternOpacity.value = styleOceanPatternOpacityOutput.value = document.getElementById("oceanicPattern").getAttribute("opacity") || 1;
    outlineLayers.value = oceanLayers.attr("layers");
  }

  if (sel === "temperature") {
    styleStrokeWidth.style.display = "block";
    styleTemperature.style.display = "block";
    styleStrokeWidthInput.value = styleStrokeWidthOutput.value = el.attr("stroke-width") || "";
    styleTemperatureFillOpacityInput.value = styleTemperatureFillOpacityOutput.value = el.attr("fill-opacity") || 0.1;
    styleTemperatureFillInput.value = styleTemperatureFillOutput.value = el.attr("fill") || "#000";
    styleTemperatureFontSizeInput.value = styleTemperatureFontSizeOutput.value = el.attr("font-size") || "8px";
  }

  if (sel === "coordinates") {
    styleSize.style.display = "block";
    styleFontSize.value = el.attr("data-size");
  }

  if (sel === "armies") {
    styleArmies.style.display = "block";
    styleArmiesFillOpacity.value = styleArmiesFillOpacityOutput.value = el.attr("fill-opacity");
    styleArmiesSize.value = styleArmiesSizeOutput.value = el.attr("box-size");
  }

  if (sel === "emblems") {
    styleEmblems.style.display = "block";
    styleStrokeWidth.style.display = "block";
    styleStrokeWidthInput.value = styleStrokeWidthOutput.value = el.attr("stroke-width") || 1;
  }

  // update group options
  styleGroupSelect.options.length = 0; // remove all options
  if (["routes", "labels", "coastline", "lakes", "anchors", "burgIcons", "borders"].includes(sel)) {
    const groups = document.getElementById(sel).querySelectorAll("g");
    groups.forEach(el => {
      if (el.id === "burgLabels") return;
      const option = new Option(`${el.id} (${el.childElementCount})`, el.id, false, false);
      styleGroupSelect.options.add(option);
    });
    styleGroupSelect.value = el.attr("id");
    styleGroup.style.display = "block";
  } else {
    styleGroupSelect.options.add(new Option(sel, sel, false, true));
    styleGroup.style.display = "none";
  }

  if (sel === "coastline" && styleGroupSelect.value === "sea_island") {
    styleCoastline.style.display = "block";
    const auto = (styleCoastlineAuto.checked = coastline.select("#sea_island").attr("auto-filter"));
    if (auto) styleFilter.style.display = "none";
  }
}

// Handle style inputs change
styleGroupSelect.addEventListener("change", selectStyleElement);

function getEl() {
  const el = styleElementSelect.value;
  const g = styleGroupSelect.value;
  if (g === el) return svg.select("#" + el);
  else return svg.select("#" + el).select("#" + g);
}

styleFillInput.addEventListener("input", function () {
  styleFillOutput.value = this.value;
  getEl().attr("fill", this.value);
});

styleStrokeInput.addEventListener("input", function () {
  styleStrokeOutput.value = this.value;
  getEl().attr("stroke", this.value);
  if (styleElementSelect.value === "gridOverlay" && layerIsOn("toggleGrid")) drawGrid();
});

styleStrokeWidthInput.addEventListener("input", function () {
  styleStrokeWidthOutput.value = this.value;
  getEl().attr("stroke-width", +this.value);
  if (styleElementSelect.value === "gridOverlay" && layerIsOn("toggleGrid")) drawGrid();
});

styleStrokeDasharrayInput.addEventListener("input", function () {
  getEl().attr("stroke-dasharray", this.value);
  if (styleElementSelect.value === "gridOverlay" && layerIsOn("toggleGrid")) drawGrid();
});

styleStrokeLinecapInput.addEventListener("change", function () {
  getEl().attr("stroke-linecap", this.value);
  if (styleElementSelect.value === "gridOverlay" && layerIsOn("toggleGrid")) drawGrid();
});

styleOpacityInput.addEventListener("input", function () {
  styleOpacityOutput.value = this.value;
  getEl().attr("opacity", this.value);
});

styleFilterInput.addEventListener("change", function () {
  if (styleGroupSelect.value === "ocean") return oceanLayers.attr("filter", this.value);
  getEl().attr("filter", this.value);
});

styleTextureInput.addEventListener("change", function () {
  if (this.value === "none") texture.select("image").attr("xlink:href", "");
  if (this.value === "default") texture.select("image").attr("xlink:href", getDefaultTexture());
  else getBase64(this.value, base64 => texture.select("image").attr("xlink:href", base64));
});

styleTextureShiftX.addEventListener("input", function () {
  texture
    .select("image")
    .attr("x", this.value)
    .attr("width", graphWidth - this.valueAsNumber);
});

styleTextureShiftY.addEventListener("input", function () {
  texture
    .select("image")
    .attr("y", this.value)
    .attr("height", graphHeight - this.valueAsNumber);
});

styleClippingInput.addEventListener("change", function () {
  getEl().attr("mask", this.value);
});

styleGridType.addEventListener("change", function () {
  getEl().attr("type", this.value);
  if (layerIsOn("toggleGrid")) drawGrid();
  calculateFriendlyGridSize();
});

styleGridScale.addEventListener("input", function () {
  getEl().attr("scale", this.value);
  if (layerIsOn("toggleGrid")) drawGrid();
  calculateFriendlyGridSize();
});

function calculateFriendlyGridSize() {
  const size = styleGridScale.value * 25;
  const friendly = `${rn(size * distanceScaleInput.value, 2)} ${distanceUnitInput.value}`;
  styleGridSizeFriendly.value = friendly;
}

styleGridShiftX.addEventListener("input", function () {
  getEl().attr("dx", this.value);
  if (layerIsOn("toggleGrid")) drawGrid();
});

styleGridShiftY.addEventListener("input", function () {
  getEl().attr("dy", this.value);
  if (layerIsOn("toggleGrid")) drawGrid();
});

styleShiftX.addEventListener("input", shiftElement);
styleShiftY.addEventListener("input", shiftElement);

function shiftElement() {
  const x = styleShiftX.value || 0;
  const y = styleShiftY.value || 0;
  getEl().attr("transform", `translate(${x},${y})`);
}

styleRescaleMarkers.addEventListener("change", function () {
  markers.attr("rescale", +this.checked);
  invokeActiveZooming();
});

styleCoastlineAuto.addEventListener("change", function () {
  coastline.select("#sea_island").attr("auto-filter", +this.checked);
  styleFilter.style.display = this.checked ? "none" : "block";
  invokeActiveZooming();
});

styleOceanFill.addEventListener("input", function () {
  oceanLayers.select("rect").attr("fill", this.value);
  styleOceanFillOutput.value = this.value;
});

styleOceanPattern.addEventListener("change", function () {
  document.getElementById("oceanicPattern")?.setAttribute("href", this.value);
});

styleOceanPatternOpacity.addEventListener("input", function () {
  document.getElementById("oceanicPattern").setAttribute("opacity", this.value);
  styleOceanPatternOpacityOutput.value = this.value;
});

outlineLayers.addEventListener("change", function () {
  oceanLayers.selectAll("path").remove();
  oceanLayers.attr("layers", this.value);
  OceanLayers();
});

styleHeightmapScheme.addEventListener("change", function () {
  terrs.attr("scheme", this.value);
  drawHeightmap();
});

styleHeightmapTerracingInput.addEventListener("input", function () {
  terrs.attr("terracing", this.value);
  drawHeightmap();
});

styleHeightmapSkipInput.addEventListener("input", function () {
  terrs.attr("skip", this.value);
  drawHeightmap();
});

styleHeightmapSimplificationInput.addEventListener("input", function () {
  terrs.attr("relax", this.value);
  drawHeightmap();
});

styleHeightmapCurve.addEventListener("change", function () {
  terrs.attr("curve", this.value);
  drawHeightmap();
});

styleReliefSet.addEventListener("change", function () {
  terrain.attr("set", this.value);
  ReliefIcons();
  if (!layerIsOn("toggleRelief")) toggleRelief();
});

styleReliefSizeInput.addEventListener("change", function () {
  terrain.attr("size", this.value);
  styleReliefSizeOutput.value = this.value;
  ReliefIcons();
  if (!layerIsOn("toggleRelief")) toggleRelief();
});

styleReliefDensityInput.addEventListener("change", function () {
  terrain.attr("density", this.value);
  styleReliefDensityOutput.value = this.value;
  ReliefIcons();
  if (!layerIsOn("toggleRelief")) toggleRelief();
});

styleTemperatureFillOpacityInput.addEventListener("input", function () {
  temperature.attr("fill-opacity", this.value);
  styleTemperatureFillOpacityOutput.value = this.value;
});

styleTemperatureFontSizeInput.addEventListener("input", function () {
  temperature.attr("font-size", this.value + "px");
  styleTemperatureFontSizeOutput.value = this.value + "px";
});

styleTemperatureFillInput.addEventListener("input", function () {
  temperature.attr("fill", this.value);
  styleTemperatureFillOutput.value = this.value;
});

stylePopulationRuralStrokeInput.addEventListener("input", function () {
  population.select("#rural").attr("stroke", this.value);
  stylePopulationRuralStrokeOutput.value = this.value;
});

stylePopulationUrbanStrokeInput.addEventListener("input", function () {
  population.select("#urban").attr("stroke", this.value);
  stylePopulationUrbanStrokeOutput.value = this.value;
});

styleCompassSizeInput.addEventListener("input", function () {
  styleCompassSizeOutput.value = this.value;
  shiftCompass();
});

styleCompassShiftX.addEventListener("input", shiftCompass);
styleCompassShiftY.addEventListener("input", shiftCompass);

function shiftCompass() {
  const tr = `translate(${styleCompassShiftX.value} ${styleCompassShiftY.value}) scale(${styleCompassSizeInput.value})`;
  compass.select("use").attr("transform", tr);
}

styleLegendColItems.addEventListener("input", function () {
  styleLegendColItemsOutput.value = this.value;
  legend.select("#legendBox").attr("data-columns", this.value);
  redrawLegend();
});

styleLegendBack.addEventListener("input", function () {
  styleLegendBackOutput.value = this.value;
  legend.select("#legendBox").attr("fill", this.value);
});

styleLegendOpacity.addEventListener("input", function () {
  styleLegendOpacityOutput.value = this.value;
  legend.select("#legendBox").attr("fill-opacity", this.value);
});

styleSelectFont.addEventListener("change", changeFont);
function changeFont() {
  const value = styleSelectFont.value;
  const font = fonts[value].split(":")[0].replace(/\+/g, " ");
  getEl().attr("font-family", font).attr("data-font", fonts[value]);
  if (styleElementSelect.value === "legend") redrawLegend();
}

styleShadowInput.addEventListener("input", function () {
  getEl().style("text-shadow", this.value);
});

styleFontAdd.addEventListener("click", function () {
  if (styleInputFont.style.display === "none") {
    styleInputFont.style.display = "inline-block";
    styleInputFont.focus();
    styleSelectFont.style.display = "none";
  } else {
    styleInputFont.style.display = "none";
    styleSelectFont.style.display = "inline-block";
  }
});

styleInputFont.addEventListener("change", function () {
  if (!this.value) {
    tip("Please provide a valid Google font name or link to a @font-face declaration");
    return;
  }
  fetchFonts(this.value).then(fetched => {
    if (!fetched) return;
    styleFontAdd.click();
    styleInputFont.value = "";
    if (fetched !== 1) return;
    styleSelectFont.value = fonts.length - 1;
    changeFont(); // auto-change font if 1 font is fetched
  });
});

styleFontSize.addEventListener("change", function () {
  changeFontSize(+this.value);
});

styleFontPlus.addEventListener("click", function () {
  const size = +getEl().attr("data-size") + 1;
  changeFontSize(Math.min(size, 999));
});

styleFontMinus.addEventListener("click", function () {
  const size = +getEl().attr("data-size") - 1;
  changeFontSize(Math.max(size, 1));
});

function changeFontSize(size) {
  styleFontSize.value = size;

  const getSizeOnScale = element => {
    // some labels are rescaled on zoom
    if (element === "labels") return Math.max(rn((size + size / scale) / 2, 2), 1);
    if (element === "coordinates") return rn(size / scale ** 0.8, 2);

    // other has the same size
    return size;
  };

  const scaleSize = getSizeOnScale(styleElementSelect.value);
  getEl().attr("data-size", size).attr("font-size", scaleSize);

  if (styleElementSelect.value === "legend") redrawLegend();
}

styleRadiusInput.addEventListener("change", function () {
  changeRadius(+this.value);
});

styleRadiusPlus.addEventListener("click", function () {
  const size = Math.max(rn(getEl().attr("size") * 1.1, 2), 0.2);
  changeRadius(size);
});

styleRadiusMinus.addEventListener("click", function () {
  const size = Math.max(rn(getEl().attr("size") * 0.9, 2), 0.2);
  changeRadius(size);
});

function changeRadius(size, group) {
  const el = group ? burgIcons.select("#" + group) : getEl();
  const g = el.attr("id");
  el.attr("size", size);
  el.selectAll("circle").each(function () {
    this.setAttribute("r", size);
  });
  styleRadiusInput.value = size;
  burgLabels
    .select("g#" + g)
    .selectAll("text")
    .each(function () {
      this.setAttribute("dy", `${size * -1.5}px`);
    });
  changeIconSize(size * 2, g); // change also anchor icons
}

styleIconSizeInput.addEventListener("change", function () {
  changeIconSize(+this.value);
});

styleIconSizePlus.addEventListener("click", function () {
  const size = Math.max(rn(getEl().attr("size") * 1.1, 2), 0.2);
  changeIconSize(size);
});

styleIconSizeMinus.addEventListener("click", function () {
  const size = Math.max(rn(getEl().attr("size") * 0.9, 2), 0.2);
  changeIconSize(size);
});

function changeIconSize(size, group) {
  const el = group ? anchors.select("#" + group) : getEl();
  const oldSize = +el.attr("size");
  const shift = (size - oldSize) / 2;
  el.attr("size", size);
  el.selectAll("use").each(function () {
    const x = +this.getAttribute("x");
    const y = +this.getAttribute("y");
    this.setAttribute("x", x - shift);
    this.setAttribute("y", y - shift);
    this.setAttribute("width", size);
    this.setAttribute("height", size);
  });
  styleIconSizeInput.value = size;
}

styleStatesBodyOpacity.addEventListener("input", function () {
  styleStatesBodyOpacityOutput.value = this.value;
  statesBody.attr("opacity", this.value);
});

styleStatesBodyFilter.addEventListener("change", function () {
  statesBody.attr("filter", this.value);
});

styleStatesHaloWidth.addEventListener("input", function () {
  styleStatesHaloWidthOutput.value = this.value;
  statesHalo.attr("data-width", this.value).attr("stroke-width", this.value);
});

styleStatesHaloOpacity.addEventListener("input", function () {
  styleStatesHaloOpacityOutput.value = this.value;
  statesHalo.attr("opacity", this.value);
});

styleStatesHaloBlur.addEventListener("input", function () {
  styleStatesHaloBlurOutput.value = this.value;
  const blur = +this.value > 0 ? `blur(${this.value}px)` : null;
  statesHalo.attr("filter", blur);
});

styleArmiesFillOpacity.addEventListener("input", function () {
  armies.attr("fill-opacity", this.value);
  styleArmiesFillOpacityOutput.value = this.value;
});

styleArmiesSize.addEventListener("input", function () {
  armies.attr("box-size", this.value).attr("font-size", this.value * 2);
  styleArmiesSizeOutput.value = this.value;
  armies.selectAll("g").remove(); // clear armies layer
  pack.states.forEach(s => {
    if (!s.i || s.removed || !s.military.length) return;
    Military.drawRegiments(s.military, s.i);
  });
});

emblemsStateSizeInput.addEventListener("change", drawEmblems);
emblemsProvinceSizeInput.addEventListener("change", drawEmblems);
emblemsBurgSizeInput.addEventListener("change", drawEmblems);

// request a URL to image to be used as a texture
function textureProvideURL() {
  alertMessage.innerHTML = `Provide an image URL to be used as a texture:
    <input id="textureURL" type="url" style="width: 100%" placeholder="http://www.example.com/image.jpg" oninput="fetchTextureURL(this.value)">
    <canvas id="texturePreview" width="256px" height="144px"></canvas>`;
  $("#alert").dialog({
    resizable: false,
    title: "Load custom texture",
    width: "26em",
    buttons: {
      Apply: function () {
        const name = textureURL.value.split("/").pop();
        if (!name || name === "") {
          tip("Please provide a valid URL", false, "error");
          return;
        }
        const opt = document.createElement("option");
        opt.value = textureURL.value;
        opt.text = name.slice(0, 20);
        styleTextureInput.add(opt);
        styleTextureInput.value = textureURL.value;
        getBase64(textureURL.value, base64 => texture.select("image").attr("xlink:href", base64));
        zoom.scaleBy(svg, 1.00001); // enforce browser re-draw
        $(this).dialog("close");
      },
      Cancel: function () {
        $(this).dialog("close");
      }
    }
  });
}

function fetchTextureURL(url) {
  INFO && console.log("Provided URL is", url);
  const img = new Image();
  img.onload = function () {
    const canvas = document.getElementById("texturePreview");
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  };
  img.src = url;
}

const defaultStyles = {
  styleAncient: `{"#map":{"background-color":"#000000","filter":null,"data-filter":null},"#armies":{"font-size":8,"box-size":4,"stroke":"#000","stroke-width":0.2,"fill-opacity":1,"filter":null},"#biomes":{"opacity":null,"filter":null,"mask":null},"#stateBorders":{"opacity":0.8,"stroke":"#56566d","stroke-width":1,"stroke-dasharray":2,"stroke-linecap":"butt","filter":null},"#provinceBorders":{"opacity":0.8,"stroke":"#56566d","stroke-width":0.2,"stroke-dasharray":1,"stroke-linecap":"butt","filter":null},"#cells":{"opacity":null,"stroke":"#808080","stroke-width":0.1,"filter":null,"mask":null},"#gridOverlay":{"opacity":0.8,"scale":1,"dx":0,"dy":0,"type":"pointyHex","stroke":"#808080","stroke-width":0.5,"stroke-dasharray":null,"stroke-linecap":null,"transform":null,"filter":null,"mask":null},"#coordinates":{"opacity":1,"data-size":12,"font-size":12,"stroke":"#d4d4d4","stroke-width":1,"stroke-dasharray":5,"stroke-linecap":null,"filter":null,"mask":null},"#compass":{"opacity":0.5,"transform":null,"filter":"url(#filter-sepia)","mask":"url(#water)","shape-rendering":"optimizespeed"},"#rose":{"transform":"translate(80 80) scale(.25)"},"#relig":{"opacity":0.7,"stroke":"#404040","stroke-width":0.7,"filter":null},"#cults":{"opacity":0.6,"stroke":"#777777","stroke-width":0.5,"stroke-dasharray":null,"stroke-linecap":null,"filter":null},"#landmass":{"opacity":1,"fill":"#e3dfce","filter":null},"#markers":{"opacity":null,"rescale":1,"filter":""},"#prec":{"opacity":null,"stroke":"#000000","stroke-width":0.1,"fill":"#003dff","filter":null},"#population":{"opacity":null,"stroke-width":1.6,"stroke-dasharray":null,"stroke-linecap":"butt","filter":null},"#rural":{"stroke":"#0000ff"},"#urban":{"stroke":"#ff0000"},"#freshwater":{"opacity":0.6,"fill":"#c8d6e0","stroke":"#968d6e","stroke-width":0.7,"filter":null},"#salt":{"opacity":0.5,"fill":"#339482","stroke":"#836a34","stroke-width":0.7,"filter":null},"#sinkhole":{"opacity":1,"fill":"#c3d6df","stroke":"#b29062","stroke-width":0.7,"filter":null},"#frozen":{"opacity":0.95,"fill":"#cdd4e7","stroke":"#cfe0eb","stroke-width":0,"filter":null},"#lava":{"opacity":0.7,"fill":"#a04e18","stroke":"#835520","stroke-width":2,"filter":"url(#paper)"},"#dry":{"opacity":0.7,"fill":"#c6b795","stroke":"#8e816f","stroke-width":0.7,"filter":null},"#sea_island":{"opacity":0.5,"stroke":"#1f3846","stroke-width":0.7,"filter":"url(#dropShadow)","auto-filter":1},"#lake_island":{"opacity":1,"stroke":"#7c8eaf","stroke-width":0.35,"filter":null},"#terrain":{"opacity":1,"set":"simple","size":1,"density":0.4,"filter":null,"mask":null},"#rivers":{"opacity":null,"filter":"","fill":"#a69b7d"},"#ruler":{"opacity":null,"filter":null},"#roads":{"opacity":0.7,"stroke":"#8d502a","stroke-width":1,"stroke-dasharray":3,"stroke-linecap":"inherit","filter":"","mask":null},"#trails":{"opacity":0.7,"stroke":"#924217","stroke-width":0.5,"stroke-dasharray":"1 2","stroke-linecap":"butt","filter":null,"mask":null},"#searoutes":{"opacity":0.8,"stroke":"#b16925","stroke-width":0.8,"stroke-dasharray":"1 2","stroke-linecap":"round","filter":null,"mask":null},"#statesBody":{"opacity":0.2,"filter":"url(#filter-sepia)"},"#statesHalo":{"opacity":0.4,"data-width":10,"stroke-width":10,"filter":"blur(6px)"},"#provs":{"opacity":0.7,"fill":"#000000","font-size":10,"data-font":"Georgia","font-family":"Georgia","filter":null},"#temperature":{"opacity":null,"font-size":"8px","fill":"#000000","fill-opacity":0.3,"stroke":null,"stroke-width":1.8,"stroke-dasharray":null,"stroke-linecap":null,"filter":null},"#ice":{"opacity":0.35,"fill":"#e8f0f6","stroke":"#e8f0f6","stroke-width":3,"filter":"url(#dropShadow05)"},"#emblems":{"opacity":0.8,"stroke-width":0.8,"filter":"url(#dropShadow05)"},"#texture":{"opacity":0.6,"filter":"","mask":""},"#textureImage":{"x":0,"y":0},"#zones":{"opacity":0.6,"stroke":"#333333","stroke-width":0,"stroke-dasharray":null,"stroke-linecap":"butt","filter":null,"mask":null},"#oceanLayers":{"filter":"","layers":"-6,-4,-2"},"#oceanBase":{"fill":"#c99f64"},"#oceanicPattern":{"href":"./images/kiwiroo.png","opacity":0.4},"#terrs":{"opacity":null,"scheme":"bright","terracing":0,"skip":2,"relax":1,"curve":0,"filter":"url(#blur3)","mask":"url(#land)"},"#legend":{"data-size":13,"font-size":13,"data-font":"Almendra+SC","font-family":"Almendra SC","stroke":"#812929","stroke-width":2.5,"stroke-dasharray":"0 4 10 4","stroke-linecap":"round","data-x":99,"data-y":93,"data-columns":8},"#burgLabels > #cities":{"opacity":1,"fill":"#3e3e4b","text-shadow":"white 0px 0px 4px","data-size":12,"font-size":12,"data-font":"Great+Vibes","font-family":"Great Vibes"},"#burgIcons > #cities":{"opacity":1,"fill":"#fdfab9","fill-opacity":0.7,"size":1,"stroke":"#6f4e1f","stroke-width":0.3,"stroke-dasharray":".3 .4","stroke-linecap":"butt"},"#anchors > #cities":{"opacity":1,"fill":"#ffffff","size":2,"stroke":"#3e3e4b","stroke-width":1.2},"#burgLabels > #towns":{"opacity":1,"fill":"#3e3e4b","text-shadow":"white 0px 0px 4px","data-size":5,"font-size":5,"data-font":"Great+Vibes","font-family":"Great Vibes"},"#burgIcons > #towns":{"opacity":1,"fill":"#fef4d8","fill-opacity":0.7,"size":0.5,"stroke":"#72472c","stroke-width":0.12,"stroke-dasharray":"","stroke-linecap":"butt"},"#anchors > #towns":{"opacity":1,"fill":"#ffffff","size":1,"stroke":"#3e3e4b","stroke-width":1.2},"#labels > #states":{"opacity":1,"fill":"#3e3e4b","stroke":"#3a3a3a","stroke-width":0,"text-shadow":"white 0px 0px 4px","data-size":22,"font-size":22,"data-font":"Great+Vibes","font-family":"Great Vibes","filter":"url(#filter-sepia)"},"#labels > #addedLabels":{"opacity":1,"fill":"#3e3e4b","stroke":"#3a3a3a","stroke-width":0,"text-shadow":"white 0px 0px 4px","data-size":18,"font-size":18,"data-font":"Times+New+Roman","font-family":"Times New Roman","filter":"url(#filter-sepia)"},"#fogging":{"opacity":0.98,"fill":"#30426f","filter":null}}`,
  styleGloom: `{"#map":{"background-color":"#000000","filter":null,"data-filter":null},"#armies":{"font-size":6,"box-size":3,"stroke":"#000","stroke-width":0.3,"opacity":1,"fill-opacity":1,"filter":null},"#biomes":{"opacity":null,"filter":"url(#blur5)","mask":"url(#land)"},"#stateBorders":{"opacity":1,"stroke":"#56566d","stroke-width":1,"stroke-dasharray":2,"stroke-linecap":"butt","filter":null},"#provinceBorders":{"opacity":1,"stroke":"#56566d","stroke-width":0.3,"stroke-dasharray":".7 1","stroke-linecap":"butt","filter":null},"#cells":{"opacity":null,"stroke":"#808080","stroke-width":0.1,"filter":null,"mask":null},"#gridOverlay":{"opacity":0.8,"scale":1,"dx":0,"dy":"0","type":"pointyHex","stroke":"#808080","stroke-width":0.5,"stroke-dasharray":null,"stroke-linecap":null,"transform":null,"filter":null,"mask":null},"#coordinates":{"opacity":1,"data-size":14,"font-size":14,"stroke":"#4a4a4a","stroke-width":1,"stroke-dasharray":6,"stroke-linecap":null,"filter":null,"mask":null},"#compass":{"opacity":0.6,"transform":null,"filter":null,"mask":"url(#water)","shape-rendering":"optimizespeed"},"#rose":{"transform":"translate(100 100) scale(0.3)"},"#relig":{"opacity":0.7,"stroke":"#404040","stroke-width":1,"filter":null},"#cults":{"opacity":0.7,"stroke":"#777777","stroke-width":1.5,"stroke-dasharray":null,"stroke-linecap":null,"filter":null},"#landmass":{"opacity":1,"fill":"#e0e0e0","filter":null},"#markers":{"opacity":0.8,"rescale":1,"filter":"url(#dropShadow05)"},"#prec":{"opacity":null,"stroke":"#000000","stroke-width":0.1,"fill":"#003dff","filter":null},"#population":{"opacity":null,"stroke-width":1.6,"stroke-dasharray":null,"stroke-linecap":"butt","filter":null},"#rural":{"stroke":"#0000aa"},"#urban":{"stroke":"#9d0000"},"#freshwater":{"opacity":0.5,"fill":"#a6c1fd","stroke":"#5f799d","stroke-width":0.7,"filter":null},"#salt":{"opacity":0.5,"fill":"#409b8a","stroke":"#388985","stroke-width":0.7,"filter":null},"#sinkhole":{"opacity":1,"fill":"#5bc9fd","stroke":"#53a3b0","stroke-width":0.7,"filter":null},"#frozen":{"opacity":0.95,"fill":"#cdd4e7","stroke":"#cfe0eb","stroke-width":0,"filter":null},"#lava":{"opacity":0.7,"fill":"#90270d","stroke":"#f93e0c","stroke-width":2,"filter":"url(#crumpled)"},"#dry":{"opacity":0.7,"fill":"#c9bfa7","stroke":"#8e816f","stroke-width":0.7,"filter":null},"#sea_island":{"opacity":0.6,"stroke":"#1f3846","stroke-width":0.7,"filter":"url(#dropShadow)","auto-filter":1},"#lake_island":{"opacity":1,"stroke":"#7c8eaf","stroke-width":0.35,"filter":null},"#terrain":{"opacity":0.9,"set":"simple","size":1,"density":0.4,"filter":null,"mask":null},"#rivers":{"opacity":null,"filter":null,"fill":"#779582"},"#ruler":{"opacity":null,"filter":null},"#roads":{"opacity":1,"stroke":"#8b4418","stroke-width":0.9,"stroke-dasharray":"2 3","stroke-linecap":"round","filter":null,"mask":null},"#trails":{"opacity":1,"stroke":"#844017","stroke-width":0.2,"stroke-dasharray":".5 1","stroke-linecap":"round","filter":null,"mask":null},"#searoutes":{"opacity":0.8,"stroke":"#5e1865","stroke-width":0.6,"stroke-dasharray":"1.2 2.4","stroke-linecap":"round","filter":null,"mask":null},"#statesBody":{"opacity":0.4,"filter":null},"#statesHalo":{"opacity":0.5,"data-width":12,"stroke-width":12,"filter":"blur(10px)"},"#provs":{"opacity":0.7,"fill":"#000000","data-size":10,"font-size":10,"font-family":"Georgia","data-font":"Georgia","filter":null},"#temperature":{"opacity":1,"font-size":"11px","fill":"#62001b","fill-opacity":0.3,"stroke":null,"stroke-width":2,"stroke-dasharray":2,"stroke-linecap":null,"filter":null},"#ice":{"opacity":0.9,"fill":"#e8f0f6","stroke":"#e8f0f6","stroke-width":1,"filter":"url(#dropShadow05)"},"#emblems": {"opacity":0.6,"stroke-width":0.5,"filter":null},"#texture":{"opacity":null,"filter":null,"mask":"url(#land)"},"#textureImage":{"x":0,"y":0},"#zones":{"opacity":0.5,"stroke":"#333333","stroke-width":0,"stroke-dasharray":null,"stroke-linecap":"butt","filter":"url(#dropShadow01)","mask":null},"#oceanLayers":{"filter":null,"layers":"-6,-4,-2"},"#oceanBase":{"fill":"#4e6964"},"#oceanicPattern":{"href":"./images/pattern3.png", "opacity":0.2},"#terrs":{"opacity":1,"scheme":"bright","terracing":0,"skip":0,"relax":1,"curve":1,"filter":"url(#filter-grayscale)","mask":"url(#land)"},"#legend":{"data-size":13,"font-size":13,"data-font":"Almendra+SC","font-family":"Almendra SC","stroke":"#812929","stroke-width":2.5,"stroke-dasharray":"0 4 10 4","stroke-linecap":"round","data-x":99,"data-y":93,"data-columns":8},"#legendBox":{},"#burgLabels > #cities":{"opacity":1,"fill":"#3e3e4b","text-shadow":"white 0 0 4px","data-size":7,"font-size":7,"data-font":"Bitter","font-family":"Bitter"},"#burgIcons > #cities":{"opacity":1,"fill":"#ffffff","fill-opacity":0.7,"size":2,"stroke":"#444444","stroke-width":0.25,"stroke-dasharray":"","stroke-linecap":"butt"},"#anchors > #cities":{"opacity":0.8,"fill":"#ffffff","size":4,"stroke":"#3e3e4b","stroke-width":1},"#burgLabels > #towns":{"opacity":1,"fill":"#3e3e4b","data-size":3,"font-size":3,"data-font":"Bitter","font-family":"Bitter"},"#burgIcons > #towns":{"opacity":0.95,"fill":"#ffffff","fill-opacity":0.7,"size":0.8,"stroke":"#3e3e4b","stroke-width":0.2,"stroke-dasharray":"","stroke-linecap":"butt"},"#anchors > #towns":{"opacity":1,"fill":"#ffffff","size":1.6,"stroke":"#3e3e4b","stroke-width":1.2},"#labels > #states":{"opacity":1,"fill":"#4e4e4e","stroke":"#b5b5b5","stroke-width":0,"text-shadow":"white 0 0 4px","data-size":22,"font-size":22,"data-font":"Almendra+SC","font-family":"Almendra SC","filter":null},"#labels > #addedLabels":{"opacity":1,"fill":"#3e3e4b","stroke":"#3a3a3a","stroke-width":0,"text-shadow":"white 0 0 4px","data-size":18,"font-size":18,"data-font":"Almendra+SC","font-family":"Almendra SC","filter":null},"#fogging":{"opacity":0.98,"fill":"#1b1423","filter":null}}`,
  styleClean: `{"#map":{"background-color":"#000000","filter":null,"data-filter":null},"#armies":{"font-size":6,"box-size":3,"stroke":"#000","stroke-width":0,"opacity":1,"fill-opacity":1,"filter":null},"#biomes":{"opacity":0.5,"filter":"url(#blur7)","mask":"url(#land)"},"#stateBorders":{"opacity":0.8,"stroke":"#414141","stroke-width":0.7,"stroke-dasharray":0,"stroke-linecap":"butt","filter":null},"#provinceBorders":{"opacity":0.8,"stroke":"#414141","stroke-width":0.45,"stroke-dasharray":1,"stroke-linecap":"butt","filter":null},"#cells":{"opacity":null,"stroke":"#808080","stroke-width":0.09,"filter":null,"mask":"url(#land)"},"#gridOverlay":{"opacity":0.8,"scale":1,"dx":0,"dy":"0","type":"pointyHex","stroke":"#808080","stroke-width":0.5,"stroke-dasharray":null,"stroke-linecap":null,"transform":null,"filter":null,"mask":null},"#coordinates":{"opacity":1,"data-size":12,"font-size":12,"stroke":"#414141","stroke-width":0.45,"stroke-dasharray":3,"stroke-linecap":null,"filter":null,"mask":null},"#compass":{"opacity":0.8,"transform":null,"filter":null,"mask":"url(#water)","shape-rendering":"optimizespeed"},"#rose":{"transform":null},"#relig":{"opacity":0.7,"stroke":"#404040","stroke-width":0.7,"filter":null},"#cults":{"opacity":0.6,"stroke":"#777777","stroke-width":0.5,"stroke-dasharray":null,"stroke-linecap":null,"filter":null},"#landmass":{"opacity":1,"fill":"#eeedeb","filter":null},"#markers":{"opacity":null,"rescale":null,"filter":"url(#dropShadow01)"},"#prec":{"opacity":null,"stroke":"#000000","stroke-width":0,"fill":"#0080ff","filter":null},"#population":{"opacity":null,"stroke-width":2.58,"stroke-dasharray":0,"stroke-linecap":"butt","filter":"url(#blur3)"},"#rural":{"stroke":"#ff0000"},"#urban":{"stroke":"#800000"},"#freshwater":{"opacity":0.5,"fill":"#aadaff","stroke":"#5f799d","stroke-width":0,"filter":null},"#salt":{"opacity":0.5,"fill":"#409b8a","stroke":"#388985","stroke-width":0.7,"filter":null},"#sinkhole":{"opacity":1,"fill":"#5bc9fd","stroke":"#53a3b0","stroke-width":0.7,"filter":null},"#frozen":{"opacity":0.95,"fill":"#cdd4e7","stroke":"#cfe0eb","stroke-width":0,"filter":null},"#lava":{"opacity":0.7,"fill":"#90270d","stroke":"#f93e0c","stroke-width":2,"filter":"url(#crumpled)"},"#dry":{"opacity":0.7,"fill":"#c9bfa7","stroke":"#8e816f","stroke-width":0.7,"filter":null},"#sea_island":{"opacity":0.6,"stroke":"#595959","stroke-width":0.4,"filter":null,"auto-filter":0},"#lake_island":{"opacity":0,"stroke":"#7c8eaf","stroke-width":0,"filter":null},"#terrain":{"opacity":1,"set":"simple","size":1,"density":0.4,"filter":null,"mask":null},"#rivers":{"opacity":null,"filter":null,"fill":"#aadaff"},"#ruler":{"opacity":null,"filter":null},"#roads":{"opacity":0.9,"stroke":"#f6d068","stroke-width":0.7,"stroke-dasharray":0,"stroke-linecap":"inherit","filter":null,"mask":null},"#trails":{"opacity":1,"stroke":"#ffffff","stroke-width":0.25,"stroke-dasharray":"","stroke-linecap":"round","filter":null,"mask":null},"#searoutes":{"opacity":0.8,"stroke":"#4f82c6","stroke-width":0.45,"stroke-dasharray":2,"stroke-linecap":"butt","filter":null,"mask":"url(#water)"},"#statesBody":{"opacity":0.3,"filter":null},"#statesHalo":{"opacity":0.5,"data-width":1,"stroke-width":1,"filter":null},"#provs":{"opacity":0.7,"fill":"#000000","data-size":10,"font-size":10,"font-family":"Georgia","data-font":"Georgia","filter":null},"#temperature":{"opacity":null,"font-size":"8px","fill":"#000000","fill-opacity":0.3,"stroke":null,"stroke-width":1.8,"stroke-dasharray":null,"stroke-linecap":null,"filter":null},"#ice":{"opacity":0.9,"fill":"#e8f0f6","stroke":"#e8f0f6","stroke-width":1,"filter":"url(#dropShadow01)"},"#emblems":{"opacity":1,"stroke-width":1,"filter":null},"#texture":{"opacity":null,"filter":null,"mask":"url(#land)"},"#textureImage":{},"#zones":{"opacity":0.7,"stroke":"#ff6262","stroke-width":0,"stroke-dasharray":"","stroke-linecap":"butt","filter":null,"mask":null},"#oceanLayers":{"filter":null,"layers":"none"},"#oceanBase":{"fill":"#aadaff"},"#oceanicPattern":{"href":"", "opacity":0.2},"#terrs":{"opacity":0.5,"scheme":"bright","terracing":0,"skip":5,"relax":0,"curve":0,"filter":null,"mask":"url(#land)"},"#legend":{"data-size":12.74,"font-size":12.74,"data-font":"Arial","font-family":"Arial","stroke":"#909090","stroke-width":1.13,"stroke-dasharray":0,"stroke-linecap":"round","data-x":98.39,"data-y":12.67,"data-columns":null},"#legendBox":{},"#burgLabels > #cities":{"opacity":1,"fill":"#414141","text-shadow":"white 0 0 4px","data-size":7,"font-size":7,"data-font":"Arial","font-family":"Arial"},"#burgIcons > #cities":{"opacity":1,"fill":"#ffffff","fill-opacity":0.7,"size":1,"stroke":"#3e3e4b","stroke-width":0.24,"stroke-dasharray":"","stroke-linecap":"butt"},"#anchors > #cities":{"opacity":1,"fill":"#ffffff","size":2,"stroke":"#303030","stroke-width":1.7},"#burgLabels > #towns":{"opacity":1,"fill":"#414141","data-size":3,"font-size":3,"data-font":"Arial","font-family":"Arial"},"#burgIcons > #towns":{"opacity":1,"fill":"#ffffff","fill-opacity":0.7,"size":0.5,"stroke":"#3e3e4b","stroke-width":0.12,"stroke-dasharray":"","stroke-linecap":"butt"},"#anchors > #towns":{"opacity":1,"fill":"#ffffff","size":1,"stroke":"#3e3e4b","stroke-width":1.06},"#labels > #states":{"opacity":1,"fill":"#292929","stroke":"#303030","stroke-width":0,"text-shadow":"white 0 0 2px","data-size":10,"font-size":10,"data-font":"Arial","font-family":"Arial","filter":null},"#labels > #addedLabels":{"opacity":1,"fill":"#414141","stroke":"#3a3a3a","stroke-width":0,"text-shadow":"white 0 0 4px","data-size":18,"font-size":18,"data-font":"Arial","font-family":"Arial","filter":null},"#fogging":{"opacity":1,"fill":"#ffffff","filter":null}}`,
  styleLight: `{"#map":{"background-color":"#000000","filter":null,"data-filter":null},"#armies":{"font-size":8,"box-size":4,"stroke":"#000","stroke-width":0.02,"fill-opacity":0.8,"filter":null},"#biomes":{"opacity":0.5,"filter":null,"mask":null},"#stateBorders":{"opacity":0.8,"stroke":"#4c483e","stroke-width":1,"stroke-dasharray":2,"stroke-linecap":"square","filter":null},"#provinceBorders":{"opacity":0.8,"stroke":"#56566d","stroke-width":0.2,"stroke-dasharray":1,"stroke-linecap":"butt","filter":null},"#cells":{"opacity":null,"stroke":"#808080","stroke-width":0.1,"filter":null,"mask":null},"#gridOverlay":{"opacity":0.5,"scale":1,"dx":0,"dy":0,"type":"pointyHex","stroke":"#808080","stroke-width":1,"stroke-dasharray":null,"stroke-linecap":null,"transform":null,"filter":null,"mask":null},"#coordinates":{"opacity":0.7,"data-size":15,"font-size":15,"stroke":"#734d37","stroke-width":1.5,"stroke-dasharray":5,"stroke-linecap":"square","filter":null,"mask":""},"#compass":{"opacity":0.6,"transform":null,"filter":null,"mask":"url(#water)","shape-rendering":"optimizespeed"},"#rose":{"transform":null},"#relig":{"opacity":0.5,"stroke":null,"stroke-width":0,"filter":null},"#cults":{"opacity":0.5,"stroke":"#777777","stroke-width":0,"stroke-dasharray":null,"stroke-linecap":null,"filter":null},"#landmass":{"opacity":1,"fill":"#f9f2ea","filter":null},"#markers":{"opacity":null,"rescale":1,"filter":null},"#prec":{"opacity":null,"stroke":"#000000","stroke-width":0.1,"fill":"#2554ef","filter":null},"#population":{"opacity":null,"stroke-width":1.6,"stroke-dasharray":null,"stroke-linecap":"butt","filter":null},"#rural":{"stroke":"#0000ff"},"#urban":{"stroke":"#ff0000"},"#freshwater":{"opacity":1,"fill":"#98cdc4","stroke":"#719892","stroke-width":0.46,"filter":"url(#dropShadow05)"},"#salt":{"opacity":0.5,"fill":"#409b8a","stroke":"#388985","stroke-width":0.7,"filter":null},"#sinkhole":{"opacity":1,"fill":"#5bc9fd","stroke":"#53a3b0","stroke-width":0.7,"filter":null},"#frozen":{"opacity":0.95,"fill":"#cdd4e7","stroke":"#cfe0eb","stroke-width":0,"filter":null},"#lava":{"opacity":0.7,"fill":"#90270d","stroke":"#f93e0c","stroke-width":2,"filter":"url(#crumpled)"},"#dry":{"opacity":1,"fill":"#c9bfa7","stroke":"#8e816f","stroke-width":0.7,"filter":null},"#sea_island":{"opacity":1,"stroke":"#5e5e5e","stroke-width":0.4,"filter":"url(#dropShadow)","auto-filter":1},"#lake_island":{"opacity":1,"stroke":"#7c8eaf","stroke-width":0.35,"filter":null},"#terrain":{"opacity":0.6,"set":"colored","size":1,"density":0.3,"filter":null,"mask":""},"#rivers":{"opacity":null,"filter":null,"fill":"#6d94ba"},"#ruler":{"opacity":null,"filter":null},"#roads":{"opacity":0.9,"stroke":"#3c1d0b","stroke-width":1.37,"stroke-dasharray":2,"stroke-linecap":"inherit","filter":null,"mask":null},"#trails":{"opacity":0.9,"stroke":"#95481a","stroke-width":0.88,"stroke-dasharray":".8 1.6","stroke-linecap":"butt","filter":null,"mask":null},"#searoutes":{"opacity":0.8,"stroke":"#ffffff","stroke-width":0.45,"stroke-dasharray":"1 2","stroke-linecap":"round","filter":null,"mask":null},"#statesBody":{"opacity":0.2,"filter":null},"#statesHalo":{"opacity":0.3,"data-width":25,"stroke-width":25,"filter":"blur(5px)"},"#provs":{"opacity":0.4,"fill":"#000000","font-size":5,"data-font":"IM+Fell+English","font-family":"IM Fell English","filter":null},"#temperature":{"opacity":null,"font-size":"8px","fill":"#000000","fill-opacity":0.3,"stroke":null,"stroke-width":1.8,"stroke-dasharray":null,"stroke-linecap":null,"filter":null},"#ice":{"opacity":0.5,"fill":"#e8f0f6","stroke":"#e8f0f6","stroke-width":1.5,"filter":"url(#dropShadow05)"},"#emblems":{"opacity":0.9,"stroke-width":1,"filter":null},"#texture":{"opacity":0.39,"filter":null,"mask":""},"#zones":{"opacity":0.6,"stroke":"#333333","stroke-width":0,"stroke-dasharray":null,"stroke-linecap":"butt","filter":null,"mask":null},"#oceanLayers":{"filter":"url(#dropShadow05)","layers":"-6,-3,-1"},"#oceanBase":{"fill":"#8dc1c8"},"#oceanicPattern":{"href":"./images/pattern1.png","opacity":0.2},"#terrs":{"opacity":0.4,"scheme":"light","terracing":10,"skip":5,"relax":0,"curve":0,"filter":"url(#turbulence)","mask":"url(#land)"},"#legend":{"data-size":13,"font-size":13,"data-font":"Almendra+SC","font-family":"Almendra SC","stroke":"#812929","stroke-width":2.5,"stroke-dasharray":"0 4 10 4","stroke-linecap":"round","data-x":54.73,"data-y":62.98,"data-columns":8},"#burgLabels > #cities":{"opacity":1,"fill":"#3a3a3a","text-shadow":"white 0px 0px 4px","data-size":8,"font-size":8,"data-font":"IM+Fell+English","font-family":"IM Fell English"},"#burgIcons > #cities":{"opacity":1,"fill":"#ffffff","fill-opacity":0.7,"size":3,"stroke":"#3e3e4b","stroke-width":0.4,"stroke-dasharray":"0.5 0.25","stroke-linecap":"butt"},"#anchors > #cities":{"opacity":1,"fill":"#ffffff","size":5.5,"stroke":"#3e3e4b","stroke-width":1.2},"#burgLabels > #towns":{"opacity":1,"fill":"#3e3e4b","text-shadow":"white 0px 0px 4px","data-size":4,"font-size":4,"data-font":"IM+Fell+English","font-family":"IM Fell English"},"#burgIcons > #towns":{"opacity":1,"fill":"#ffffff","fill-opacity":0.7,"size":1.2,"stroke":"#3e3e4b","stroke-width":0.2,"stroke-dasharray":"","stroke-linecap":"butt"},"#anchors > #towns":{"opacity":1,"fill":"#ffffff","size":2.2,"stroke":"#3e3e4b","stroke-width":1.2},"#labels > #states":{"opacity":1,"fill":"#3e3e3e","stroke":"#000000","stroke-width":0.3,"text-shadow":"white 0px 0px 6px","data-size":14,"font-size":14,"data-font":"IM+Fell+English","font-family":"IM Fell English","filter":null},"#labels > #addedLabels":{"opacity":1,"fill":"#f24706","stroke":"#701b05","stroke-width":0.1,"text-shadow":"white 0px 0px 4px","data-size":6,"font-size":6,"data-font":"IM+Fell+English","font-family":"IM Fell English","filter":null},"#fogging":{"opacity":1,"fill":"#30426f","filter":null}}`,
  styleWatercolor: `{"#map":{"background-color":"#000000","filter":null,"data-filter":null},"#armies":{"font-size":8,"box-size":4,"stroke":"#000","stroke-width":0.2,"fill-opacity":1,"filter":null},"#biomes":{"opacity":0.6,"filter":null,"mask":null},"#stateBorders":{"opacity":0.6,"stroke":"#56566d","stroke-width":1,"stroke-dasharray":3,"stroke-linecap":"butt","filter":null},"#provinceBorders":{"opacity":0.5,"stroke":"#56566d","stroke-width":0.5,"stroke-dasharray":"0 2","stroke-linecap":"round","filter":null},"#cells":{"opacity":null,"stroke":"#808080","stroke-width":0.1,"filter":null,"mask":null},"#gridOverlay":{"opacity":0.8,"scale":1,"dx":0,"dy":0,"type":"pointyHex","stroke":"#777777","stroke-width":0.5,"stroke-dasharray":null,"stroke-linecap":null,"transform":null,"filter":null,"mask":null},"#coordinates":{"opacity":1,"data-size":12,"font-size":12,"stroke":"#d4d4d4","stroke-width":1,"stroke-dasharray":5,"stroke-linecap":null,"filter":null,"mask":null},"#compass":{"opacity":0.8,"transform":null,"filter":null,"mask":"url(#water)","shape-rendering":"optimizespeed"},"#rose":{"transform":"translate(80 80) scale(.25)"},"#relig":{"opacity":0.7,"stroke":"#777777","stroke-width":0,"filter":"url(#bluredSplotch)"},"#cults":{"opacity":0.6,"stroke":"#777777","stroke-width":0.5,"stroke-dasharray":null,"stroke-linecap":null,"filter":"url(#splotch)"},"#landmass":{"opacity":1,"fill":"#eef6fb","filter":null},"#markers":{"opacity":null,"rescale":1,"filter":"url(#dropShadow01)"},"#prec":{"opacity":null,"stroke":"#000000","stroke-width":0.1,"fill":"#003dff","filter":null},"#population":{"opacity":null,"stroke-width":1.6,"stroke-dasharray":null,"stroke-linecap":"butt","filter":null},"#rural":{"stroke":"#0000ff"},"#urban":{"stroke":"#ff0000"},"#freshwater":{"opacity":0.5,"fill":"#a6c1fd","stroke":"#5f799d","stroke-width":0.7,"filter":null},"#salt":{"opacity":0.5,"fill":"#409b8a","stroke":"#388985","stroke-width":0.7,"filter":null},"#sinkhole":{"opacity":1,"fill":"#5bc9fd","stroke":"#53a3b0","stroke-width":0.7,"filter":null},"#frozen":{"opacity":0.95,"fill":"#cdd4e7","stroke":"#cfe0eb","stroke-width":0,"filter":null},"#lava":{"opacity":0.7,"fill":"#90270d","stroke":"#f93e0c","stroke-width":2,"filter":"url(#crumpled)"},"#dry":{"opacity":1,"fill":"#c9bfa7","stroke":"#8e816f","stroke-width":0.7,"filter":null},"#sea_island":{"opacity":0.5,"stroke":"#1f3846","stroke-width":0.7,"filter":"url(#dropShadow)","auto-filter":1},"#lake_island":{"opacity":1,"stroke":"#7c8eaf","stroke-width":0.35,"filter":null},"#terrain":{"opacity":1,"set":"gray","size":1,"density":0.4,"filter":null,"mask":null},"#rivers":{"opacity":null,"filter":null,"fill":"#2e89c2"},"#ruler":{"opacity":null,"filter":null},"#roads":{"opacity":0.9,"stroke":"#969696","stroke-width":0.7,"stroke-dasharray":"","stroke-linecap":"butt","filter":null,"mask":null},"#trails":{"opacity":0.9,"stroke":"#969696","stroke-width":0.4,"stroke-dasharray":"","stroke-linecap":"butt","filter":null,"mask":null},"#searoutes":{"opacity":0.9,"stroke":"#969696","stroke-width":0.7,"stroke-dasharray":"","stroke-linecap":"round","filter":null,"mask":null},"#statesBody":{"opacity":0.05,"filter":null},"#statesHalo":{"opacity":0.4,"data-width":8,"stroke-width":8,"filter":"blur(2px)"},"#provs":{"opacity":0.7,"fill":"#000000","font-size":4,"data-font":"Comfortaa:700","font-family":"Comfortaa","filter":null},"#temperature":{"opacity":null,"font-size":"8px","fill":"#000000","fill-opacity":0.3,"stroke":null,"stroke-width":1.8,"stroke-dasharray":null,"stroke-linecap":null,"filter":null},"#ice":{"opacity":0.7,"fill":"#dfe8ec","stroke":"#000000","stroke-width":0,"filter":"url(#dropShadow05)"},"#emblems":{"opacity":0.95,"stroke-width":1,"filter":null},"#texture":{"opacity":0.2,"filter":null,"mask":"url(#land)"},"#zones":{"opacity":0.6,"stroke":"#333333","stroke-width":0,"stroke-dasharray":null,"stroke-linecap":"butt","filter":null,"mask":null},"#oceanLayers":{"filter":null,"layers":"-6,-4,-2"},"#oceanBase":{"fill":"#2d788b"},"#oceanicPattern":{"href":"./images/kiwiroo.png","opacity":0.5},"#terrs":{"opacity":0.5,"scheme":"light","terracing":0,"skip":5,"relax":1,"curve":0,"filter":null,"mask":"url(#land)"},"#legend":{"data-size":13,"font-size":13,"data-font":"Almendra+SC","font-family":"Almendra SC","stroke":"#812929","stroke-width":2.5,"stroke-dasharray":"0 4 10 4","stroke-linecap":"round","data-x":99,"data-y":93,"data-columns":8},"#burgLabels > #cities":{"opacity":1,"fill":"#043449","text-shadow":"white 0px 0px 2px","data-size":5,"font-size":5,"data-font":"Comfortaa:700","font-family":"Comfortaa"},"#burgIcons > #cities":{"opacity":1,"fill":"#ffffff","fill-opacity":0.7,"size":1,"stroke":"#3e3e4b","stroke-width":0.24,"stroke-dasharray":"","stroke-linecap":"butt"},"#anchors > #cities":{"opacity":1,"fill":"#ffffff","size":2,"stroke":"#3e3e4b","stroke-width":1.2},"#burgLabels > #towns":{"opacity":1,"fill":"#3e3e4b","text-shadow":"white 0px 0px 4px","data-size":3,"font-size":3,"data-font":"Comfortaa:700","font-family":"Comfortaa"},"#burgIcons > #towns":{"opacity":1,"fill":"#ffffff","fill-opacity":0.7,"size":0.5,"stroke":"#3e3e4b","stroke-width":0.12,"stroke-dasharray":"","stroke-linecap":"butt"},"#anchors > #towns":{"opacity":1,"fill":"#ffffff","size":1,"stroke":"#3e3e4b","stroke-width":1.2},"#labels > #states":{"opacity":1,"fill":"#ffffff","stroke":"#000000","stroke-width":0.15,"text-shadow":"black 1px 1px 2px","data-size":20,"font-size":20,"data-font":"Gloria+Hallelujah","font-family":"Gloria Hallelujah","filter":null},"#labels > #addedLabels":{"opacity":1,"fill":"#3e3e4b","stroke":"#3a3a3a","stroke-width":0,"text-shadow":"white 0px 0px 4px","data-size":18,"font-size":18,"data-font":"Comfortaa","font-family":"Comfortaa","filter":null},"#fogging":{"opacity":0.97,"fill":"#8398ce","filter":null}}`,
  styleMonochrome: `{"#map":{"background-color":"#000000","filter":"url(#filter-grayscale)","data-filter":"grayscale"},"#armies":{"font-size":6,"box-size":3,"stroke":"#000","stroke-width":0.3,"opacity":1,"fill-opacity":1,"filter":null},"#biomes":{"opacity":null,"filter":"url(#blur5)","mask":null},"#stateBorders":{"opacity":1,"stroke":"#56566d","stroke-width":1,"stroke-dasharray":2,"stroke-linecap":"butt","filter":null},"#provinceBorders":{"opacity":1,"stroke":"#56566d","stroke-width":0.4,"stroke-dasharray":1,"stroke-linecap":"butt","filter":null},"#cells":{"opacity":null,"stroke":"#808080","stroke-width":0.1,"filter":null,"mask":null},"#gridOverlay":{"opacity":0.8,"scale":1,"dx":0,"dy":"0","type":"pointyHex","stroke":"#808080","stroke-width":0.5,"stroke-dasharray":null,"stroke-linecap":null,"transform":null,"filter":null,"mask":null},"#coordinates":{"opacity":1,"data-size":12,"font-size":12,"stroke":"#d4d4d4","stroke-width":1,"stroke-dasharray":5,"stroke-linecap":null,"filter":null,"mask":null},"#compass":{"opacity":0.8,"transform":null,"filter":null,"mask":"url(#water)","shape-rendering":"optimizespeed"},"#rose":{"transform":null},"#relig":{"opacity":0.7,"stroke":"#404040","stroke-width":0.7,"filter":null},"#cults":{"opacity":0.6,"stroke":"#777777","stroke-width":0.5,"stroke-dasharray":null,"stroke-linecap":null,"filter":null},"#landmass":{"opacity":1,"fill":"#000000","filter":null},"#markers":{"opacity":null,"rescale":1,"filter":"url(#dropShadow01)"},"#prec":{"opacity":null,"stroke":"#000000","stroke-width":0.1,"fill":"#003dff","filter":null},"#population":{"opacity":null,"stroke-width":1.6,"stroke-dasharray":null,"stroke-linecap":"butt","filter":null},"#rural":{"stroke":"#0000ff"},"#urban":{"stroke":"#ff0000"},"#freshwater":{"opacity":1,"fill":"#000000","stroke":"#515151","stroke-width":0,"filter":null},"#salt":{"opacity":1,"fill":"#000000","stroke":"#484848","stroke-width":0,"filter":null},"#sinkhole":{"opacity":1,"fill":"#000000","stroke":"#5f5f5f","stroke-width":0.5,"filter":null},"#frozen":{"opacity":1,"fill":"#000000","stroke":"#6f6f6f","stroke-width":0,"filter":null},"#lava":{"opacity":1,"fill":"#000000","stroke":"#5d5d5d","stroke-width":0,"filter":null},"#sea_island":{"opacity":1,"stroke":"#1f3846","stroke-width":0,"filter":null,"auto-filter":0},"#lake_island":{"opacity":0,"stroke":"#7c8eaf","stroke-width":0,"filter":null},"#terrain":{"opacity":null,"set":"simple","size":1,"density":0.4,"filter":null,"mask":null},"#rivers":{"opacity":0.2,"filter":"url(#blur1)","fill":"#000000"},"#ruler":{"opacity":null,"filter":null},"#roads":{"opacity":0.9,"stroke":"#d06324","stroke-width":0.7,"stroke-dasharray":2,"stroke-linecap":"butt","filter":null,"mask":null},"#trails":{"opacity":0.9,"stroke":"#d06324","stroke-width":0.25,"stroke-dasharray":".8 1.6","stroke-linecap":"butt","filter":null,"mask":null},"#searoutes":{"opacity":0.8,"stroke":"#ffffff","stroke-width":0.45,"stroke-dasharray":"1 2","stroke-linecap":"round","filter":null,"mask":null},"#statesBody":{"opacity":0.4,"filter":null},"#statesHalo":{"opacity":0.4,"data-width":10,"stroke-width":10,"filter":"blur(5px)"},"#provs":{"opacity":0.7,"fill":"#000000","data-size":10,"font-size":10,"font-family":"Georgia","data-font":"Georgia","filter":null},"#temperature":{"opacity":null,"font-size":"8px","fill":"#000000","fill-opacity":0.3,"stroke":null,"stroke-width":1.8,"stroke-dasharray":null,"stroke-linecap":null,"filter":null},"#ice":{"opacity":0.9,"fill":"#e8f0f6","stroke":"#e8f0f6","stroke-width":1,"filter":"url(#dropShadow05)"},"#texture":{"opacity":1,"filter":null,"mask":"url(#land)"},"#emblems": {"opacity": 0.5,"stroke-width": 0.5,"filter": null},"#textureImage":{},"#zones":{"opacity":0.6,"stroke":"#333333","stroke-width":0,"stroke-dasharray":null,"stroke-linecap":"butt","filter":null,"mask":null},"#oceanLayers":{"filter":null,"layers":"none"},"#oceanBase":{"fill":"#000000"},"#oceanicPattern":{"href":"", "opacity":0.2},"#terrs":{"opacity":1,"scheme":"monochrome","terracing":0,"skip":5,"relax":0,"curve":0,"filter":"url(#blur3)","mask":"url(#land)"},"#legend":{"data-size":13,"font-size":13,"data-font":"Almendra+SC","font-family":"Almendra SC","stroke":"#812929","stroke-width":2.5,"stroke-dasharray":"0 4 10 4","stroke-linecap":"round","data-x":99,"data-y":93,"data-columns":8},"#legendBox":{},"#burgLabels > #cities":{"opacity":1,"fill":"#3e3e4b","text-shadow":"white 0 0 4px","data-size":7,"font-size":7,"data-font":"Almendra+SC","font-family":"Almendra SC"},"#burgIcons > #cities":{"opacity":1,"fill":"#ffffff","fill-opacity":0.7,"size":1,"stroke":"#3e3e4b","stroke-width":0.24,"stroke-dasharray":"","stroke-linecap":"butt"},"#anchors > #cities":{"opacity":1,"fill":"#ffffff","size":2,"stroke":"#3e3e4b","stroke-width":1.2},"#burgLabels > #towns":{"opacity":1,"fill":"#3e3e4b","data-size":4,"font-size":4,"data-font":"Almendra+SC","font-family":"Almendra SC"},"#burgIcons > #towns":{"opacity":1,"fill":"#ffffff","fill-opacity":0.7,"size":0.5,"stroke":"#3e3e4b","stroke-width":0.12,"stroke-dasharray":"","stroke-linecap":"butt"},"#anchors > #towns":{"opacity":1,"fill":"#ffffff","size":1,"stroke":"#3e3e4b","stroke-width":1.2},"#labels > #states":{"opacity":1,"fill":"#3e3e4b","stroke":"#3a3a3a","stroke-width":0,"text-shadow":"white 0 0 4px","data-size":22,"font-size":22,"data-font":"Almendra+SC","font-family":"Almendra SC","filter":null},"#labels > #addedLabels":{"opacity":1,"fill":"#3e3e4b","stroke":"#3a3a3a","stroke-width":0,"text-shadow":"white 0 0 4px","data-size":18,"font-size":18,"data-font":"Almendra+SC","font-family":"Almendra SC","filter":null},"#fogging":{"opacity":0.98,"fill":"#30426f","filter":null}}`
};

// apply default or custom style settings on load
function applyStyleOnLoad() {
  const preset = localStorage.getItem("presetStyle");
  const style = preset && (defaultStyles[preset] || localStorage.getItem(preset));

  if (preset && style && JSON.isValid(style)) {
    applyStyle(JSON.parse(style));
    updateMapFilter();
    loadDefaultFonts();
    stylePreset.value = preset;
    stylePreset.dataset.old = preset;
  } else {
    if (preset && preset !== "styleDefault" && ERROR) console.error(`Style preset ${preset} is not available in localStorage, applying default style`);
    stylePreset.value = "styleDefault";
    stylePreset.dataset.old = preset;
    applyDefaultStyle();
  }
}

// set default style
function applyDefaultStyle() {
  armies.attr("opacity", 1).attr("fill-opacity", 1).attr("font-size", 6).attr("box-size", 3).attr("stroke", "#000").attr("stroke-width", 0.3);

  biomes.attr("opacity", null).attr("filter", null).attr("mask", null);
  ice.attr("opacity", 0.9).attr("fill", "#e8f0f6").attr("stroke", "#e8f0f6").attr("stroke-width", 1).attr("filter", "url(#dropShadow05)");
  stateBorders.attr("opacity", 0.8).attr("stroke", "#56566d").attr("stroke-width", 1).attr("stroke-dasharray", "2").attr("stroke-linecap", "butt").attr("filter", null);
  provinceBorders.attr("opacity", 0.8).attr("stroke", "#56566d").attr("stroke-width", 0.5).attr("stroke-dasharray", "0 2").attr("stroke-linecap", "round").attr("filter", null);
  cells.attr("opacity", null).attr("stroke", "#808080").attr("stroke-width", 0.1).attr("filter", null).attr("mask", null);

  gridOverlay.attr("opacity", 0.8).attr("type", "pointyHex").attr("scale", 1).attr("dx", 0).attr("dy", 0).attr("stroke", "#777777").attr("stroke-width", 0.5).attr("stroke-dasharray", null).attr("filter", null).attr("mask", null);
  coordinates.attr("opacity", 1).attr("data-size", 12).attr("font-size", 12).attr("stroke", "#d4d4d4").attr("stroke-width", 1).attr("stroke-dasharray", 5).attr("filter", null).attr("mask", null);
  compass.attr("opacity", 0.8).attr("transform", null).attr("filter", null).attr("mask", "url(#water)").attr("shape-rendering", "optimizespeed");
  if (!d3.select("#initial").size()) d3.select("#rose").attr("transform", "translate(80 80) scale(.25)");

  relig.attr("opacity", 0.7).attr("stroke", "#777777").attr("stroke-width", 0).attr("filter", null);
  cults.attr("opacity", 0.6).attr("stroke", "#777777").attr("stroke-width", 0.5).attr("filter", null);
  landmass.attr("opacity", 1).attr("fill", "#eef6fb").attr("filter", null);
  markers.attr("opacity", null).attr("rescale", 1).attr("filter", "url(#dropShadow01)");

  prec.attr("opacity", null).attr("stroke", "#000000").attr("stroke-width", 0.1).attr("fill", "#003dff").attr("filter", null);
  population.attr("opacity", null).attr("stroke-width", 1.6).attr("stroke-dasharray", null).attr("stroke-linecap", "butt").attr("filter", null);
  population.select("#rural").attr("stroke", "#0000ff");
  population.select("#urban").attr("stroke", "#ff0000");

  lakes.select("#freshwater").attr("opacity", 0.5).attr("fill", "#a6c1fd").attr("stroke", "#5f799d").attr("stroke-width", 0.7).attr("filter", null);
  lakes.select("#salt").attr("opacity", 0.5).attr("fill", "#409b8a").attr("stroke", "#388985").attr("stroke-width", 0.7).attr("filter", null);
  lakes.select("#sinkhole").attr("opacity", 1).attr("fill", "#5bc9fd").attr("stroke", "#53a3b0").attr("stroke-width", 0.7).attr("filter", null);
  lakes.select("#frozen").attr("opacity", 0.95).attr("fill", "#cdd4e7").attr("stroke", "#cfe0eb").attr("stroke-width", 0).attr("filter", null);
  lakes.select("#lava").attr("opacity", 0.7).attr("fill", "#90270d").attr("stroke", "#f93e0c").attr("stroke-width", 2).attr("filter", "url(#crumpled)");
  lakes.select("#dry").attr("opacity", 1).attr("fill", "#c9bfa7").attr("stroke", "#8e816f").attr("stroke-width", 0.7).attr("filter", null);

  coastline.select("#sea_island").attr("opacity", 0.5).attr("stroke", "#1f3846").attr("stroke-width", 0.7).attr("auto-filter", 1).attr("filter", "url(#dropShadow)");
  coastline.select("#lake_island").attr("opacity", 1).attr("stroke", "#7c8eaf").attr("stroke-width", 0.35).attr("filter", null);

  terrain.attr("opacity", null).attr("set", "simple").attr("size", 1).attr("density", 0.4).attr("filter", null).attr("mask", null);
  rivers.attr("opacity", null).attr("fill", "#5d97bb").attr("filter", null);
  ruler.attr("opacity", null).attr("filter", null);

  roads.attr("opacity", 0.9).attr("stroke", "#d06324").attr("stroke-width", 0.7).attr("stroke-dasharray", "2").attr("stroke-linecap", "butt").attr("filter", null).attr("mask", null);
  trails.attr("opacity", 0.9).attr("stroke", "#d06324").attr("stroke-width", 0.25).attr("stroke-dasharray", ".8 1.6").attr("stroke-linecap", "butt").attr("filter", null).attr("mask", null);
  searoutes.attr("opacity", 0.8).attr("stroke", "#ffffff").attr("stroke-width", 0.45).attr("stroke-dasharray", "1 2").attr("stroke-linecap", "round").attr("filter", null).attr("mask", null);

  statesBody.attr("opacity", 0.4).attr("filter", null);
  statesHalo.attr("data-width", 10).attr("stroke-width", 10).attr("opacity", 0.4).attr("filter", "blur(5px)");

  provs.attr("opacity", 0.7).attr("fill", "#000000").attr("font-family", "Georgia").attr("data-font", "Georgia").attr("data-size", 10).attr("font-size", 10).attr("filter", null);

  temperature.attr("opacity", null).attr("fill", "#000000").attr("stroke-width", 1.8).attr("fill-opacity", 0.3).attr("font-size", "8px").attr("stroke-dasharray", null).attr("filter", null).attr("mask", null);
  texture.attr("opacity", null).attr("filter", null).attr("mask", "url(#land)");
  texture.select("#textureImage").attr("x", 0).attr("y", 0);
  zones.attr("opacity", 0.6).attr("stroke", "#333333").attr("stroke-width", 0).attr("stroke-dasharray", null).attr("stroke-linecap", "butt").attr("filter", null).attr("mask", null);

  // ocean and svg default style
  svg.attr("background-color", "#000000").attr("data-filter", null).attr("filter", null);
  oceanLayers.select("rect").attr("fill", "#466eab"); // old color #53679f
  oceanLayers.attr("filter", null).attr("layers", "-6,-3,-1");
  svg.select("#oceanicPattern").attr("href", "./images/pattern1.png").attr("opacity", 0.2);

  // heightmap style
  terrs.attr("opacity", null).attr("filter", null).attr("mask", "url(#land)").attr("stroke", "none").attr("scheme", "bright").attr("terracing", 0).attr("skip", 5).attr("relax", 0).attr("curve", 0);

  // legend
  legend.attr("font-family", "Almendra SC").attr("data-font", "Almendra+SC").attr("font-size", 13).attr("data-size", 13).attr("data-x", 99).attr("data-y", 93).attr("data-columns", 8).attr("stroke-width", 2.5).attr("stroke", "#812929").attr("stroke-dasharray", "0 4 10 4").attr("stroke-linecap", "round");
  legend.select("#legendBox").attr("fill", "#ffffff").attr("fill-opacity", 0.8);

  const citiesSize = Math.max(rn(8 - regionsInput.value / 20), 3);
  burgLabels.select("#cities").attr("fill", "#3e3e4b").attr("opacity", 1).style("text-shadow", "white 0 0 4px").attr("font-family", "Almendra SC").attr("data-font", "Almendra+SC").attr("font-size", citiesSize).attr("data-size", citiesSize);
  burgIcons.select("#cities").attr("opacity", 1).attr("size", 1).attr("stroke-width", 0.24).attr("fill", "#ffffff").attr("stroke", "#3e3e4b").attr("fill-opacity", 0.7).attr("stroke-dasharray", "").attr("stroke-linecap", "butt");
  anchors.select("#cities").attr("opacity", 1).attr("fill", "#ffffff").attr("stroke", "#3e3e4b").attr("stroke-width", 1.2).attr("size", 2);

  burgLabels.select("#towns").attr("fill", "#3e3e4b").attr("opacity", 1).style("text-shadow", "white 0 0 4px").attr("font-family", "Almendra SC").attr("data-font", "Almendra+SC").attr("font-size", 3).attr("data-size", 4);
  burgIcons.select("#towns").attr("opacity", 1).attr("size", 0.5).attr("stroke-width", 0.12).attr("fill", "#ffffff").attr("stroke", "#3e3e4b").attr("fill-opacity", 0.7).attr("stroke-dasharray", "").attr("stroke-linecap", "butt");
  anchors.select("#towns").attr("opacity", 1).attr("fill", "#ffffff").attr("stroke", "#3e3e4b").attr("stroke-width", 1.2).attr("size", 1);

  const stateLabelSize = Math.max(rn(24 - regionsInput.value / 6), 6);
  labels.select("#states").attr("fill", "#3e3e4b").attr("opacity", 1).attr("stroke", "#3a3a3a").attr("stroke-width", 0).style("text-shadow", "white 0 0 4px").attr("font-family", "Almendra SC").attr("data-font", "Almendra+SC").attr("font-size", stateLabelSize).attr("data-size", stateLabelSize).attr("filter", null);
  labels.select("#addedLabels").attr("fill", "#3e3e4b").attr("opacity", 1).attr("stroke", "#3a3a3a").attr("stroke-width", 0).style("text-shadow", "white 0 0 4px").attr("font-family", "Almendra SC").attr("data-font", "Almendra+SC").attr("font-size", 18).attr("data-size", 18).attr("filter", null);

  fogging.attr("opacity", 0.98).attr("fill", "#30426f");
  emblems.attr("opacity", 0.9).attr("stroke-width", 1).attr("filter", null);
}

// apply style settings in JSON
function applyStyle(style) {
  for (const selector in style) {
    const el = document.querySelector(selector);
    if (!el) continue;
    for (const attribute in style[selector]) {
      const value = style[selector][attribute];

      if (value === "null" || value === null) {
        el.removeAttribute(attribute);
        continue;
      }

      if (attribute === "text-shadow") {
        el.style[attribute] = value;
      } else {
        el.setAttribute(attribute, value);
      }
    }
  }
}

// change current style preset to another saved one
function changeStylePreset(preset) {
  if (customization) return tip("Please exit the customization mode first", false, "error");

  alertMessage.innerHTML = "Are you sure you want to change the style preset? All unsaved style changes will be lost";
  $("#alert").dialog({
    resizable: false,
    title: "Change style preset",
    width: "23em",
    buttons: {
      Change: function () {
        const customPreset = localStorage.getItem(preset);
        if (customPreset) {
          if (JSON.isValid(customPreset)) applyStyle(JSON.parse(customPreset));
          else {
            tip("Cannot parse stored style JSON. Default style applied", false, "error", 5000);
            applyDefaultStyle();
          }
        } else if (defaultStyles[preset]) applyStyle(JSON.parse(defaultStyles[preset]));
        else applyDefaultStyle();
        loadUsedFonts();

        removeStyleButton.style.display = stylePreset.selectedOptions[0].dataset.system ? "none" : "inline-block";
        updateElements(); // change elements
        selectStyleElement(); // re-select element to trigger values update
        updateMapFilter();
        localStorage.setItem("presetStyle", preset); // save preset to use it onload
        stylePreset.dataset.old = stylePreset.value; // save current value
        $(this).dialog("close");
      },
      Cancel: function () {
        stylePreset.value = stylePreset.dataset.old;
        $(this).dialog("close");
      }
    }
  });
}

function updateElements() {
  // burgIcons to desired size
  burgIcons.selectAll("g").each(function (d) {
    const size = +this.getAttribute("size");
    d3.select(this)
      .selectAll("circle")
      .each(function () {
        this.setAttribute("r", size);
      });
    burgLabels
      .select("g#" + this.id)
      .selectAll("text")
      .each(function () {
        this.setAttribute("dy", `${size * -1.5}px`);
      });
  });

  // anchor icons to desired size
  anchors.selectAll("g").each(function (d) {
    const size = +this.getAttribute("size");
    d3.select(this)
      .selectAll("use")
      .each(function () {
        const id = +this.dataset.id;
        const x = pack.burgs[id].x,
          y = pack.burgs[id].y;
        this.setAttribute("x", rn(x - size * 0.47, 2));
        this.setAttribute("y", rn(y - size * 0.47, 2));
        this.setAttribute("width", size);
        this.setAttribute("height", size);
      });
  });

  // redraw elements
  if (layerIsOn("toggleHeight")) drawHeightmap();
  if (legend.selectAll("*").size() && window.redrawLegend) redrawLegend();
  oceanLayers.selectAll("path").remove();
  OceanLayers();
  invokeActiveZooming();
}

function addStylePreset() {
  $("#styleSaver").dialog({
    title: "Style Saver",
    width: "26em",
    position: {my: "center", at: "center", of: "svg"}
  });

  const currentStyle = document.getElementById("stylePreset").selectedOptions[0].text;
  document.getElementById("styleSaverName").value = currentStyle;
  styleSaverJSON.value = JSON.stringify(getStyle(), null, 2);
  checkName();

  if (modules.saveStyle) return;
  modules.saveStyle = true;

  // add listeners
  document.getElementById("styleSaverName").addEventListener("input", checkName);
  document.getElementById("styleSaverSave").addEventListener("click", saveStyle);
  document.getElementById("styleSaverDownload").addEventListener("click", styleDownload);
  document.getElementById("styleSaverLoad").addEventListener("click", () => styleToLoad.click());
  document.getElementById("styleToLoad").addEventListener("change", function () {
    uploadFile(this, styleUpload);
  });

  function getStyle() {
    const style = {};
    const attributes = {
      "#map": ["background-color", "filter", "data-filter"],
      "#armies": ["font-size", "box-size", "stroke", "stroke-width", "fill-opacity", "filter"],
      "#biomes": ["opacity", "filter", "mask"],
      "#stateBorders": ["opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "filter"],
      "#provinceBorders": ["opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "filter"],
      "#cells": ["opacity", "stroke", "stroke-width", "filter", "mask"],
      "#gridOverlay": ["opacity", "scale", "dx", "dy", "type", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "transform", "filter", "mask"],
      "#coordinates": ["opacity", "data-size", "font-size", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "filter", "mask"],
      "#compass": ["opacity", "transform", "filter", "mask", "shape-rendering"],
      "#rose": ["transform"],
      "#relig": ["opacity", "stroke", "stroke-width", "filter"],
      "#cults": ["opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "filter"],
      "#landmass": ["opacity", "fill", "filter"],
      "#markers": ["opacity", "rescale", "filter"],
      "#prec": ["opacity", "stroke", "stroke-width", "fill", "filter"],
      "#population": ["opacity", "stroke-width", "stroke-dasharray", "stroke-linecap", "filter"],
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
      "#terrain": ["opacity", "set", "size", "density", "filter", "mask"],
      "#rivers": ["opacity", "filter", "fill"],
      "#ruler": ["opacity", "filter"],
      "#roads": ["opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "filter", "mask"],
      "#trails": ["opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "filter", "mask"],
      "#searoutes": ["opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "filter", "mask"],
      "#statesBody": ["opacity", "filter"],
      "#statesHalo": ["opacity", "data-width", "stroke-width", "filter"],
      "#provs": ["opacity", "fill", "font-size", "data-font", "font-family", "filter"],
      "#temperature": ["opacity", "font-size", "fill", "fill-opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "filter"],
      "#ice": ["opacity", "fill", "stroke", "stroke-width", "filter"],
      "#emblems": ["opacity", "stroke-width", "filter"],
      "#texture": ["opacity", "filter", "mask"],
      "#textureImage": ["x", "y"],
      "#zones": ["opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "filter", "mask"],
      "#oceanLayers": ["filter", "layers"],
      "#oceanBase": ["fill"],
      "#oceanicPattern": ["href", "opacity"],
      "#terrs": ["opacity", "scheme", "terracing", "skip", "relax", "curve", "filter", "mask"],
      "#legend": ["data-size", "font-size", "data-font", "font-family", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "data-x", "data-y", "data-columns"],
      "#legendBox": ["fill", "fill-opacity"],
      "#burgLabels > #cities": ["opacity", "fill", "text-shadow", "data-size", "font-size", "data-font", "font-family"],
      "#burgIcons > #cities": ["opacity", "fill", "fill-opacity", "size", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap"],
      "#anchors > #cities": ["opacity", "fill", "size", "stroke", "stroke-width"],
      "#burgLabels > #towns": ["opacity", "fill", "text-shadow", "data-size", "font-size", "data-font", "font-family"],
      "#burgIcons > #towns": ["opacity", "fill", "fill-opacity", "size", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap"],
      "#anchors > #towns": ["opacity", "fill", "size", "stroke", "stroke-width"],
      "#labels > #states": ["opacity", "fill", "stroke", "stroke-width", "text-shadow", "data-size", "font-size", "data-font", "font-family", "filter"],
      "#labels > #addedLabels": ["opacity", "fill", "stroke", "stroke-width", "text-shadow", "data-size", "font-size", "data-font", "font-family", "filter"],
      "#fogging": ["opacity", "fill", "filter"]
    };

    for (const selector in attributes) {
      const el = document.querySelector(selector);
      if (!el) continue;

      style[selector] = {};
      for (const attr of attributes[selector]) {
        let value = el.style[attr] || el.getAttribute(attr);
        if (attr === "font-size" && el.hasAttribute("data-size")) value = el.getAttribute("data-size");
        style[selector][attr] = parseValue(value);
      }
    }

    function parseValue(value) {
      if (value === "null" || value === null) return null;
      if (value === "") return "";
      if (!isNaN(+value)) return +value;
      return value;
    }

    return style;
  }

  function checkName() {
    let tip = "";
    const v = "style" + styleSaverName.value;
    const listed = Array.from(stylePreset.options).some(o => o.value == v);
    const stored = localStorage.getItem(v);
    if (!stored && listed) tip = "default";
    else if (stored) tip = "existing";
    else if (styleSaverName.value) tip = "new";
    styleSaverTip.innerHTML = tip;
  }

  function saveStyle() {
    if (!styleSaverJSON.value) return tip("Please provide a style JSON", false, "error");
    if (!JSON.isValid(styleSaverJSON.value)) return tip("JSON string is not valid, please check the format", false, "error");
    if (!styleSaverName.value) return tip("Please provide a preset name", false, "error");
    if (styleSaverTip.innerHTML === "default") return tip("You cannot overwrite default preset, please change the name", false, "error");

    const preset = "style" + styleSaverName.value;
    applyOption(stylePreset, preset, styleSaverName.value); // add option
    localStorage.setItem("presetStyle", preset); // mark preset as default
    localStorage.setItem(preset, styleSaverJSON.value); // save preset
    $("#styleSaver").dialog("close");
    removeStyleButton.style.display = "inline-block";
    tip("Style preset is saved", false, "success", 4000);
  }

  function styleDownload() {
    if (!styleSaverJSON.value) return tip("Please provide a style JSON", false, "error");
    if (!JSON.isValid(styleSaverJSON.value)) return tip("JSON string is not valid, please check the format", false, "error");
    if (!styleSaverName.value) return tip("Please provide a preset name", false, "error");

    const data = styleSaverJSON.value;
    if (!data) return tip("Please provide a style JSON", false, "error");
    downloadFile(data, "style" + styleSaverName.value + ".json", "application/json");
  }

  function styleUpload(dataLoaded) {
    if (!dataLoaded) return tip("Cannot load the file. Please check the data format", false, "error");
    const data = JSON.stringify(JSON.parse(dataLoaded), null, 2);
    styleSaverJSON.value = data;
  }
}

function removeStylePreset() {
  if (stylePreset.selectedOptions[0].dataset.system) return tip("Cannot remove system preset", false, "error");

  localStorage.removeItem("presetStyle");
  localStorage.removeItem(stylePreset.value);
  stylePreset.selectedOptions[0].remove();
  removeStyleButton.style.display = "none";
}

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

function updateMapFilter() {
  const filter = svg.attr("data-filter");
  mapFilters.querySelectorAll(".pressed").forEach(button => button.classList.remove("pressed"));
  if (!filter) return;
  mapFilters.querySelector("#" + filter).classList.add("pressed");
}
