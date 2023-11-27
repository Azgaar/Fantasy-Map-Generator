// UI module to control the style
"use strict";

// add available filters to lists
{
  const filters = Array.from(byId("filters").querySelectorAll("filter"));
  const emptyOption = '<option value="" selected>None</option>';
  const options = filters.map(filter => {
    const id = filter.getAttribute("id");
    const name = filter.getAttribute("name");
    return `<option value="url(#${id})">${name}</option>`;
  });
  const allOptions = emptyOption + options.join("");

  byId("styleFilterInput").innerHTML = allOptions;
  byId("styleStatesBodyFilter").innerHTML = allOptions;
}

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
byId("styleHeightmapScheme").innerHTML = Object.keys(heightmapColorSchemes)
  .map(scheme => `<option value="${scheme}">${scheme}</option>`)
  .join("");

function addCustomColorScheme(scheme) {
  const stops = scheme.split(",");
  heightmapColorSchemes[scheme] = d3.scaleSequential(d3.interpolateRgbBasis(stops));
  byId("styleHeightmapScheme").options.add(new Option(scheme, scheme, false, true));
}

function getColorScheme(scheme = "bright") {
  if (!(scheme in heightmapColorSchemes)) {
    const colors = scheme.split(",");
    heightmapColorSchemes[scheme] = d3.scaleSequential(d3.interpolateRgbBasis(colors));
  }

  return heightmapColorSchemes[scheme];
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
  const group = styleGroupSelect.value;
  if (["routes", "labels", "coastline", "lakes", "anchors", "burgIcons", "borders"].includes(styleElement)) {
    const gEl = group && el.select("#" + group);
    el = group && gEl.size() ? gEl : el.select("g");
  }

  // opacity
  if (!["landmass", "ocean", "regions", "legend"].includes(styleElement)) {
    styleOpacity.style.display = "block";
    styleOpacityInput.value = styleOpacityOutput.value = el.attr("opacity") || 1;
  }

  // filter
  if (!["landmass", "legend", "regions"].includes(styleElement)) {
    styleFilter.style.display = "block";
    styleFilterInput.value = el.attr("filter") || "";
  }

  // fill
  if (["rivers", "lakes", "landmass", "prec", "ice", "fogging", "vignette"].includes(styleElement)) {
    styleFill.style.display = "block";
    styleFillInput.value = styleFillOutput.value = el.attr("fill");
  }

  // stroke color and width
  if (
    [
      "armies",
      "routes",
      "lakes",
      "borders",
      "cults",
      "relig",
      "cells",
      "coastline",
      "prec",
      "ice",
      "icons",
      "coordinates",
      "zones",
      "gridOverlay"
    ].includes(styleElement)
  ) {
    styleStroke.style.display = "block";
    styleStrokeInput.value = styleStrokeOutput.value = el.attr("stroke");
    styleStrokeWidth.style.display = "block";
    styleStrokeWidthInput.value = styleStrokeWidthOutput.value = el.attr("stroke-width") || "";
  }

  // stroke dash
  if (
    ["routes", "borders", "temperature", "legend", "population", "coordinates", "zones", "gridOverlay"].includes(
      styleElement
    )
  ) {
    styleStrokeDash.style.display = "block";
    styleStrokeDasharrayInput.value = el.attr("stroke-dasharray") || "";
    styleStrokeLinecapInput.value = el.attr("stroke-linecap") || "inherit";
  }

  // clipping
  if (
    [
      "cells",
      "gridOverlay",
      "coordinates",
      "compass",
      "terrain",
      "temperature",
      "routes",
      "texture",
      "biomes",
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
    styleHeightmapScheme.value = terrs.attr("scheme");
    styleHeightmapTerracingInput.value = styleHeightmapTerracingOutput.value = terrs.attr("terracing");
    styleHeightmapSkipInput.value = styleHeightmapSkipOutput.value = terrs.attr("skip");
    styleHeightmapSimplificationInput.value = styleHeightmapSimplificationOutput.value = terrs.attr("relax");
    styleHeightmapCurve.value = terrs.attr("curve");
  }

  if (styleElement === "markers") {
    styleMarkers.style.display = "block";
    styleRescaleMarkers.checked = +markers.attr("rescale");
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
    const tr = parseTransform(compass.select("use").attr("transform"));
    styleCompassShiftX.value = tr[0];
    styleCompassShiftY.value = tr[1];
    styleCompassSizeInput.value = styleCompassSizeOutput.value = tr[2];
  }

  if (styleElement === "terrain") {
    styleRelief.style.display = "block";
    styleReliefSizeOutput.innerHTML = styleReliefSizeInput.value = terrain.attr("size");
    styleReliefDensityOutput.innerHTML = styleReliefDensityInput.value = terrain.attr("density");
    styleReliefSet.value = terrain.attr("set");
  }

  if (styleElement === "population") {
    stylePopulation.style.display = "block";
    stylePopulationRuralStrokeInput.value = stylePopulationRuralStrokeOutput.value = population
      .select("#rural")
      .attr("stroke");
    stylePopulationUrbanStrokeInput.value = stylePopulationUrbanStrokeOutput.value = population
      .select("#urban")
      .attr("stroke");
    styleStrokeWidth.style.display = "block";
    styleStrokeWidthInput.value = styleStrokeWidthOutput.value = el.attr("stroke-width") || "";
  }

  if (styleElement === "regions") {
    styleStates.style.display = "block";
    styleStatesBodyOpacity.value = styleStatesBodyOpacityOutput.value = statesBody.attr("opacity") || 1;
    styleStatesBodyFilter.value = statesBody.attr("filter") || "";
    styleStatesHaloWidth.value = styleStatesHaloWidthOutput.value = statesHalo.attr("data-width") || 10;
    styleStatesHaloOpacity.value = styleStatesHaloOpacityOutput.value = statesHalo.attr("opacity") || 1;
    const blur = parseFloat(statesHalo.attr("filter")?.match(/blur\(([^)]+)\)/)?.[1]) || 0;
    styleStatesHaloBlur.value = styleStatesHaloBlurOutput.value = blur;
  }

  if (styleElement === "labels") {
    styleFill.style.display = "block";
    styleStroke.style.display = "block";
    styleStrokeWidth.style.display = "block";

    styleShadow.style.display = "block";
    styleSize.style.display = "block";
    styleVisibility.style.display = "block";
    styleFillInput.value = styleFillOutput.value = el.attr("fill") || "#3e3e4b";
    styleStrokeInput.value = styleStrokeOutput.value = el.attr("stroke") || "#3a3a3a";
    styleStrokeWidthInput.value = styleStrokeWidthOutput.value = el.attr("stroke-width") || 0;
    styleShadowInput.value = el.style("text-shadow") || "white 0 0 4px";

    styleFont.style.display = "block";
    styleSelectFont.value = el.attr("font-family");
    styleFontSize.value = el.attr("data-size");
  }

  if (styleElement === "provs") {
    styleFill.style.display = "block";
    styleSize.style.display = "block";
    styleFillInput.value = styleFillOutput.value = el.attr("fill") || "#111111";

    styleFont.style.display = "block";
    styleSelectFont.value = el.attr("font-family");
    styleFontSize.value = el.attr("data-size");
  }

  if (styleElement == "burgIcons") {
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

  if (styleElement == "anchors") {
    styleFill.style.display = "block";
    styleStroke.style.display = "block";
    styleStrokeWidth.style.display = "block";
    styleIconSize.style.display = "block";
    styleFillInput.value = styleFillOutput.value = el.attr("fill") || "#ffffff";
    styleStrokeInput.value = styleStrokeOutput.value = el.attr("stroke") || "#3e3e4b";
    styleStrokeWidthInput.value = styleStrokeWidthOutput.value = el.attr("stroke-width") || 0.24;
    styleIconSizeInput.value = el.attr("size") || 2;
  }

  if (styleElement === "legend") {
    styleStroke.style.display = "block";
    styleStrokeWidth.style.display = "block";
    styleSize.style.display = "block";

    styleLegend.style.display = "block";
    styleLegendColItemsOutput.value = styleLegendColItems.value = el.attr("data-columns");
    styleLegendBackOutput.value = styleLegendBack.value = el.select("#legendBox").attr("fill");
    styleLegendOpacityOutput.value = styleLegendOpacity.value = el.select("#legendBox").attr("fill-opacity");

    styleStrokeInput.value = styleStrokeOutput.value = el.attr("stroke") || "#111111";
    styleStrokeWidthInput.value = styleStrokeWidthOutput.value = el.attr("stroke-width") || 0.5;

    styleFont.style.display = "block";
    styleSelectFont.value = el.attr("font-family");
    styleFontSize.value = el.attr("data-size");
  }

  if (styleElement === "ocean") {
    styleOcean.style.display = "block";
    styleOceanFill.value = styleOceanFillOutput.value = oceanLayers.select("#oceanBase").attr("fill");
    styleOceanPattern.value = byId("oceanicPattern")?.getAttribute("href");
    styleOceanPatternOpacity.value = styleOceanPatternOpacityOutput.value =
      byId("oceanicPattern").getAttribute("opacity") || 1;
    outlineLayers.value = oceanLayers.attr("layers");
  }

  if (styleElement === "temperature") {
    styleStrokeWidth.style.display = "block";
    styleTemperature.style.display = "block";
    styleStrokeWidthInput.value = styleStrokeWidthOutput.value = el.attr("stroke-width") || "";
    styleTemperatureFillOpacityInput.value = styleTemperatureFillOpacityOutput.value = el.attr("fill-opacity") || 0.1;
    styleTemperatureFillInput.value = styleTemperatureFillOutput.value = el.attr("fill") || "#000";
    styleTemperatureFontSizeInput.value = styleTemperatureFontSizeOutput.value = el.attr("font-size") || "8px";
  }

  if (styleElement === "coordinates") {
    styleSize.style.display = "block";
    styleFontSize.value = el.attr("data-size");
  }

  if (styleElement === "armies") {
    styleArmies.style.display = "block";
    styleArmiesFillOpacity.value = styleArmiesFillOpacityOutput.value = el.attr("fill-opacity");
    styleArmiesSize.value = styleArmiesSizeOutput.value = el.attr("box-size");
  }

  if (styleElement === "emblems") {
    styleEmblems.style.display = "block";
    styleStrokeWidth.style.display = "block";
    styleStrokeWidthInput.value = styleStrokeWidthOutput.value = el.attr("stroke-width") || 1;
  }

  // update group options
  styleGroupSelect.options.length = 0; // remove all options
  if (["routes", "labels", "coastline", "lakes", "anchors", "burgIcons", "borders"].includes(styleElement)) {
    const groups = byId(styleElement).querySelectorAll("g");
    groups.forEach(el => {
      if (el.id === "burgLabels") return;
      const option = new Option(`${el.id} (${el.childElementCount})`, el.id, false, false);
      styleGroupSelect.options.add(option);
    });
    styleGroupSelect.value = el.attr("id");
    styleGroup.style.display = "block";
  } else {
    styleGroupSelect.options.add(new Option(styleElement, styleElement, false, true));
    styleGroup.style.display = "none";
  }

  if (styleElement === "coastline" && styleGroupSelect.value === "sea_island") {
    styleCoastline.style.display = "block";
    const auto = (styleCoastlineAuto.checked = coastline.select("#sea_island").attr("auto-filter"));
    if (auto) styleFilter.style.display = "none";
  }

  if (styleElement === "vignette") {
    styleVignette.style.display = "block";

    const maskRect = byId("vignette-rect");
    if (maskRect) {
      const digit = str => str.replace(/[^\d.]/g, "");
      styleVignetteX.value = digit(maskRect.getAttribute("x"));
      styleVignetteY.value = digit(maskRect.getAttribute("y"));
      styleVignetteWidth.value = digit(maskRect.getAttribute("width"));
      styleVignetteHeight.value = digit(maskRect.getAttribute("height"));
      styleVignetteRx.value = digit(maskRect.getAttribute("rx"));
      styleVignetteRy.value = digit(maskRect.getAttribute("ry"));
      styleVignetteBlur.value = styleVignetteBlurOutput.value = digit(maskRect.getAttribute("filter"));
    }
  }
}

// Handle style inputs change
styleGroupSelect.addEventListener("change", selectStyleElement);

function getEl() {
  const el = styleElementSelect.value;
  const g = styleGroupSelect.value;
  if (g === el || g === "") return svg.select("#" + el);
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
  changeTexture(this.value);
});

function changeTexture(href) {
  texture.attr("data-href", href);
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
  texture.attr("data-x", this.value);
  texture
    .select("image")
    .attr("x", this.value)
    .attr("width", graphWidth - this.valueAsNumber);
});

styleTextureShiftY.addEventListener("input", function () {
  texture.attr("data-y", this.value);
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
  byId("oceanicPattern")?.setAttribute("href", this.value);
});

styleOceanPatternOpacity.addEventListener("input", function () {
  byId("oceanicPattern").setAttribute("opacity", this.value);
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

openCreateHeightmapSchemeButton.addEventListener("click", function () {
  // start with current scheme
  this.dataset.stops = terrs.attr("scheme").startsWith("#")
    ? terrs.attr("scheme")
    : (function () {
        const scheme = heightmapColorSchemes[terrs.attr("scheme")];
        return [0, 0.25, 0.5, 0.75, 1].map(scheme).map(toHEX).join(",");
      })();

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

    byId("heightmapSchemePreview").src = preview;
  }

  function renderStops() {
    const stops = openCreateHeightmapSchemeButton.dataset.stops.split(",");

    const colorInput = color =>
      `<input type="color" class="stop" value="${color}" data-tip="Click to set the color" style="width: 2.5em; border: none;" />`;
    const removeStopButton = index =>
      `<button class="remove" data-index="${index}" data-tip="Remove color stop" style="margin-top: 0.3em; height: max-content;">x</button>`;
    const addStopButton = () =>
      `<button class="add" data-tip="Add color stop in between" style="margin-top: 0.3em; height: max-content;">+</button>`;

    const container = byId("heightmapSchemeStops");
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
    byId("heightmapSchemeGradient").style.background = `linear-gradient(to right, ${stops})`;
  }

  function handleCreate() {
    const stops = openCreateHeightmapSchemeButton.dataset.stops;
    if (stops in heightmapColorSchemes) return tip("This scheme already exists", false, "error");

    addCustomColorScheme(stops);
    terrs.attr("scheme", stops);
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
    position: {my: "center top+150", at: "center top", of: "svg"}
  });
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
  const family = styleSelectFont.value;
  getEl().attr("font-family", family);

  if (styleElementSelect.value === "legend") redrawLegend();
}

styleShadowInput.addEventListener("input", function () {
  getEl().style("text-shadow", this.value);
});

styleFontAdd.addEventListener("click", function () {
  addFontNameInput.value = "";
  addFontURLInput.value = "";

  $("#addFontDialog").dialog({
    title: "Add custom font",
    width: "26em",
    position: {my: "center", at: "center", of: "svg"},
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
  const size = +getEl().attr("data-size") + 1;
  changeFontSize(getEl(), Math.min(size, 999));
});

styleFontMinus.addEventListener("click", function () {
  const size = +getEl().attr("data-size") - 1;
  changeFontSize(getEl(), Math.max(size, 1));
});

function changeFontSize(el, size) {
  styleFontSize.value = size;

  const getSizeOnScale = element => {
    // some labels are rescaled on zoom
    if (element === "labels") return Math.max(rn((size + size / scale) / 2, 2), 1);
    if (element === "coordinates") return rn(size / scale ** 0.8, 2);

    // other has the same size
    return size;
  };

  const scaleSize = getSizeOnScale(styleElementSelect.value);
  el.attr("data-size", size).attr("font-size", scaleSize);

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
  if (!el.size()) {
    console.warn(`Group ${group} not found. Can not set icon size!`);
    return;
  }
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
  INFO && console.log("Provided URL is", url);
  const img = new Image();
  img.onload = function () {
    const canvas = byId("texturePreview");
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

  const vignette = byId("vignette");
  if (vignette) {
    styleOpacityInput.value = styleOpacityOutput.value = vignette.getAttribute("opacity");
    styleFillInput.value = styleFillOutput.value = vignette.getAttribute("fill");
    styleFilterInput.value = vignette.getAttribute("filter");
  }

  const maskRect = byId("vignette-rect");
  if (maskRect) {
    const digit = str => str.replace(/[^\d.]/g, "");
    styleVignetteX.value = digit(maskRect.getAttribute("x"));
    styleVignetteY.value = digit(maskRect.getAttribute("y"));
    styleVignetteWidth.value = digit(maskRect.getAttribute("width"));
    styleVignetteHeight.value = digit(maskRect.getAttribute("height"));
    styleVignetteRx.value = digit(maskRect.getAttribute("rx"));
    styleVignetteRy.value = digit(maskRect.getAttribute("ry"));
    styleVignetteBlur.value = styleVignetteBlurOutput.value = digit(maskRect.getAttribute("filter"));
  }
});

styleVignetteX.addEventListener("input", function () {
  byId("vignette-rect")?.setAttribute("x", `${this.value}%`);
});

styleVignetteWidth.addEventListener("input", function () {
  byId("vignette-rect")?.setAttribute("width", `${this.value}%`);
});

styleVignetteY.addEventListener("input", function () {
  byId("vignette-rect")?.setAttribute("y", `${this.value}%`);
});

styleVignetteHeight.addEventListener("input", function () {
  byId("vignette-rect")?.setAttribute("height", `${this.value}%`);
});

styleVignetteRx.addEventListener("input", function () {
  byId("vignette-rect")?.setAttribute("rx", `${this.value}%`);
});

styleVignetteRy.addEventListener("input", function () {
  byId("vignette-rect")?.setAttribute("ry", `${this.value}%`);
});

styleVignetteBlur.addEventListener("input", function () {
  styleVignetteBlurOutput.value = this.value;
  byId("vignette-rect")?.setAttribute("filter", `blur(${this.value}px)`);
});

function updateElements() {
  // burgIcons to desired size
  burgIcons.selectAll("g").each(function () {
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
