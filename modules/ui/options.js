// UI module to control the options (style, preferences)
"use strict";

$("#optionsContainer").draggable({handle: ".drag-trigger", snap: "svg", snapMode: "both"});
$("#mapLayers").disableSelection();

// show control elements and remove loading screen on map load 
d3.select("#loading").transition().duration(5000).style("opacity", 0).remove();
d3.select("#initial").transition().duration(5000).attr("opacity", 0).remove();
d3.select("#optionsContainer").transition().duration(5000).style("opacity", 1);
d3.select("#tooltip").transition().duration(5000).style("opacity", 1);

// remove glow if tip is aknowledged
if (localStorage.getItem("disable_click_arrow_tooltip")) {
  clearMainTip();
  optionsTrigger.classList.remove("glow");
}

// Show options pane on trigger click
function showOptions(event) {
  if (!localStorage.getItem("disable_click_arrow_tooltip")) {
    clearMainTip();
    localStorage.setItem("disable_click_arrow_tooltip", true);
    optionsTrigger.classList.remove("glow");
  }

  regenerate.style.display = "none";
  options.style.display = "block";
  optionsTrigger.style.display = "none";
  
  if (event) event.stopPropagation();
}

// Hide options pane on trigger click
function hideOptions(event) {
  options.style.display = "none";
  optionsTrigger.style.display = "block";
  if (event) event.stopPropagation();
}

// To toggle options on hotkey press
function toggleOptions(event) {
  if (options.style.display === "none") showOptions(event);
  else hideOptions(event);
}

// Toggle "New Map!" pane on hover
optionsTrigger.addEventListener("mouseenter", function() {
  if (optionsTrigger.classList.contains("glow")) return;
  if (options.style.display === "none") regenerate.style.display = "block";
});

collapsible.addEventListener("mouseleave", function() {
  regenerate.style.display = "none";
});

// Activate options tab on click
options.querySelector("div.tab").addEventListener("click", function(event) { 
  if (event.target.tagName !== "BUTTON") return;
  const id = event.target.id;
  const active = options.querySelector(".tab > button.active");
  if (active && id === active.id) return; // already active tab is clicked

  if (active) active.classList.remove("active");
  document.getElementById(id).classList.add("active");  
  options.querySelectorAll(".tabcontent").forEach(e => e.style.display = "none");

  if (id === "styleTab") styleContent.style.display = "block"; else 
  if (id === "optionsTab") optionsContent.style.display = "block"; else 
  if (id === "toolsTab" && !customization) toolsContent.style.display = "block"; else 
  if (id === "toolsTab" && customization) customizationMenu.style.display = "block"; else   
  if (id === "aboutTab") aboutContent.style.display = "block";
});

options.querySelectorAll("i.collapsible").forEach(el => el.addEventListener("click", collapse));
function collapse(e) {
  const trigger = e.target;
  const section = trigger.parentElement.nextElementSibling;

  if (section.style.display === "none") {
    section.style.display = "block";
    trigger.classList.replace("icon-down-open", "icon-up-open");
  } else {
    section.style.display = "none";
    trigger.classList.replace("icon-up-open", "icon-down-open");
  }
}

// Toggle style sections on element select
styleElementSelect.addEventListener("change", selectStyleElement);
function selectStyleElement() {
  const sel = styleElementSelect.value;
  let el = viewbox.select("#"+sel);

  styleElements.querySelectorAll("tbody").forEach(e => e.style.display = "none"); // hide all sections 
  const off = el.style("display") === "none" || !el.selectAll("*").size(); // check if layer is off
  if (off) {
    styleIsOff.style.display = "block";
    setTimeout(() => styleIsOff.style.display = "none", 1500);
  }

  // active group element
  const group = styleGroupSelect.value;
  if (sel == "ocean") el = oceanLayers.select("rect");
  else if (sel == "routes" || sel == "labels" || sel == "lakes" || sel == "anchors" || sel == "burgIcons") {
    el = d3.select("#"+sel).select("g#"+group).size()
      ? d3.select("#"+sel).select("g#"+group) 
      : d3.select("#"+sel).select("g");
  }

  if (sel !== "landmass") {
      // opacity
    styleOpacity.style.display = "block";
    styleOpacityInput.value = styleOpacityOutput.value = el.attr("opacity") || 1;

    // filter
    styleFilter.style.display = "block";
    if (sel == "ocean") el = oceanLayers;
    styleFilterInput.value = el.attr("filter") || "";
  }

  // fill
  if (sel === "rivers" || sel === "lakes" || sel === "landmass" || sel === "prec") {
    styleFill.style.display = "block";
    styleFillInput.value = styleFillOutput.value = el.attr("fill");
  }

  // stroke color and width
  if (sel === "routes" || sel === "lakes" || sel === "borders" || sel === "cults" || sel === "cells" || sel === "gridOverlay" || sel === "coastline" || sel === "prec" || sel === "icons" || sel === "coordinates") {
    styleStroke.style.display = "block";
    styleStrokeInput.value = styleStrokeOutput.value = el.attr("stroke");
    styleStrokeWidth.style.display = "block";
    styleStrokeWidthInput.value = styleStrokeWidthOutput.value = el.attr("stroke-width") || "";
  }

  // stroke dash
  if (sel === "routes" || sel === "borders" || sel === "gridOverlay" || sel === "temperature" || sel === "population" || sel === "coordinates") {
    styleStrokeDash.style.display = "block";
    styleStrokeDasharrayInput.value = el.attr("stroke-dasharray") || "";
    styleStrokeLinecapInput.value = el.attr("stroke-linecap") || "inherit";
  }

  // clipping
  if (sel === "cells" || sel === "gridOverlay" || sel === "coordinates" || sel === "compass" || sel === "terrain" || sel === "temperature" || sel === "routes" || sel === "texture" || sel === "biomes") {
    styleClipping.style.display = "block";
    styleClippingInput.value = el.attr("mask") || "";
  }

  // shift (translate)
  if (sel === "gridOverlay") {
    styleShift.style.display = "block";
    const tr = parseTransform(el.attr("transform"));
    styleShiftX.value = tr[0];
    styleShiftY.value = tr[1];
  }

  if (sel === "compass") {
    styleCompass.style.display = "block";
    const tr = parseTransform(d3.select("#rose").attr("transform"));
    styleCompassShiftX.value = tr[0];
    styleCompassShiftY.value = tr[1];
    styleCompassSizeInput.value = styleCompassSizeOutput.value = tr[2];
  }
  
  // show specific sections
  if (sel === "terrs") styleHeightmap.style.display = "block";
  if (sel === "gridOverlay") styleGrid.style.display = "block";
  if (sel === "terrain") styleRelief.style.display = "block";
  if (sel === "texture") styleTexture.style.display = "block";
  if (sel === "routes" || sel === "labels" || sel == "anchors" || sel == "burgIcons" || sel === "lakes") {styleGroup.style.display = "block";}
 
  if (sel === "population") {
    stylePopulation.style.display = "block";
    stylePopulationRuralStrokeInput.value = stylePopulationRuralStrokeOutput.value = population.select("#rural").attr("stroke");
    stylePopulationUrbanStrokeInput.value = stylePopulationUrbanStrokeOutput.value = population.select("#urban").attr("stroke");
    styleStrokeWidth.style.display = "block";
    styleStrokeWidthInput.value = styleStrokeWidthOutput.value = el.attr("stroke-width") || "";      
  }
  
  if (sel === "labels") {
    styleFill.style.display = "block";
    styleStroke.style.display = "block";
    styleStrokeWidth.style.display = "block";
    loadDefaultFonts();
    styleFont.style.display = "block";
    styleSize.style.display = "block";
    styleVisibility.style.display = "block";
    styleFillInput.value = styleFillOutput.value = el.attr("fill") || "#3e3e4b";
    styleStrokeInput.value = styleStrokeOutput.value = el.attr("stroke") || "#3a3a3a";
    styleStrokeWidthInput.value = styleStrokeWidthOutput.value = el.attr("stroke-width") || 0;
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
    styleStrokeWidthInput.value = styleStrokeWidthOutput.value = el.attr("stroke-width") || .24;
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
    styleStrokeWidthInput.value = styleStrokeWidthOutput.value = el.attr("stroke-width") || .24;
    styleIconSizeInput.value = el.attr("size") || 2;
  }

  if (sel === "ocean") {
    styleOcean.style.display = "block";
    styleOceanBack.value = styleOceanBackOutput.value = svg.attr("background-color");
    styleOceanFore.value = styleOceanForeOutput.value = oceanLayers.select("rect").attr("fill");
  }

  if (sel === "coastline") {
    styleCoastline.style.display = "block";
    if (styleCoastlineAuto.checked) styleFilter.style.display = "none";
  }

  if (sel === "temperature") {
    styleStrokeWidth.style.display = "block";
    styleTemperature.style.display = "block";
    styleStrokeWidthInput.value = styleStrokeWidthOutput.value = el.attr("stroke-width") || ""; 
    styleTemperatureFillOpacityInput.value = styleTemperatureFillOpacityOutput.value = el.attr("fill-opacity") || .1;
    styleTemperatureFillInput.value = styleTemperatureFillOutput.value = el.attr("fill") || "#000";
    styleTemperatureFontSizeInput.value = styleTemperatureFontSizeOutput.value = el.attr("font-size") || "8px";;
  }

  if (sel === "coordinates") {
    styleSize.style.display = "block";
    styleFontSize.value = el.attr("data-size");
  }

  // update group options
  styleGroupSelect.options.length = 0; // remove all options
  if (sel === "routes" || sel === "labels" || sel === "lakes" || sel === "anchors" || sel === "burgIcons") {
    document.getElementById(sel).querySelectorAll("g").forEach(el => {
      if (el.id === "burgLabels") return;
      const count = el.childElementCount;
      styleGroupSelect.options.add(new Option(`${el.id} (${count})`, el.id, false, false));
    });
    styleGroupSelect.value = el.attr("id");
  } else {
    styleGroupSelect.options.add(new Option(sel, sel, false, true));
  }

}

// Handle style inputs change
styleGroupSelect.addEventListener("change", selectStyleElement);

function getEl() {
  const el = styleElementSelect.value, g = styleGroupSelect.value;
  if (g === el) return svg.select("#"+el); else return svg.select("#"+el).select("#"+g);
}

styleFillInput.addEventListener("input", function() {
  styleFillOutput.value = this.value;
  getEl().attr('fill', this.value);
});

styleStrokeInput.addEventListener("input", function() {
  styleStrokeOutput.value = this.value;
  getEl().attr('stroke', this.value);
});

styleStrokeWidthInput.addEventListener("input", function() {
  styleStrokeWidthOutput.value = this.value;
  getEl().attr('stroke-width', +this.value);
});

styleStrokeDasharrayInput.addEventListener("input", function() {
  getEl().attr('stroke-dasharray', this.value);
});

styleStrokeLinecapInput.addEventListener("change", function() {
  getEl().attr('stroke-linecap', this.value);
});

styleOpacityInput.addEventListener("input", function() {
  styleOpacityOutput.value = this.value;
  getEl().attr('opacity', this.value);
});

styleFilterInput.addEventListener("change", function() {
  if (styleGroupSelect.value === "ocean") {oceanLayers.attr('filter', this.value); return;}
  getEl().attr('filter', this.value);
});

styleTextureInput.addEventListener("change", function() {
  texture.select("image").attr("xlink:href", getAbsolutePath(this.value));
});

styleTextureShiftX.addEventListener("input", function() {
  texture.select("image").attr("x", this.value).attr("width", svgWidth - this.valueAsNumber);
});

styleTextureShiftY.addEventListener("input", function() {
  texture.select("image").attr("y", this.value).attr("height", svgHeight - this.valueAsNumber);
});

styleClippingInput.addEventListener("change", function() {
  getEl().attr('mask', this.value);
});

styleGridType.addEventListener("change", function() {
  if (layerIsOn("toggleGrid")) drawGrid();
});

styleGridSize.addEventListener("input", function() {
  if (layerIsOn("toggleGrid")) drawGrid();
  styleGridSizeOutput.value = this.value;
  calculateFriendlyGridSize();
});

function calculateFriendlyGridSize() {
  const size = styleGridSize.value * Math.cos(30 * Math.PI / 180) * 2;;
  const friendly = "(" + rn(size * distanceScale.value) + " " + distanceUnit.value + ")";
  styleGridSizeFriendly.value = friendly;
}

styleShiftX.addEventListener("input", shiftElement);
styleShiftY.addEventListener("input", shiftElement);

function shiftElement() {
  const x = styleShiftX.value || 0;
  const y = styleShiftY.value || 0;
  getEl().attr("transform", `translate(${x},${y})`);  
}

styleOceanBack.addEventListener("input", function() {
  svg.style("background-color", this.value);
  styleOceanBackOutput.value = this.value;
});

styleOceanFore.addEventListener("input", function() {
  oceanLayers.select("rect").attr("fill", this.value);
  styleOceanForeOutput.value = this.value;
});

styleOceanPattern.addEventListener("change", function() {
  svg.select("pattern#oceanic rect").attr("filter", this.value);
});

outlineLayersInput.addEventListener("change", function() {
  oceanLayers.selectAll("path").remove();
  OceanLayers();
});

styleReliefSizeInput.addEventListener("input", function() {
  styleReliefSizeOutput.value = this.value;
  const size = +this.value;

  terrain.selectAll("use").each(function(d) {
    const newSize = this.getAttribute("data-size") * size;
    const shift = (newSize - +this.getAttribute("width")) / 2;
    this.setAttribute("width", newSize);
    this.setAttribute("height", newSize);
    const x = +this.getAttribute("x");
    const y = +this.getAttribute("y");
    this.setAttribute("x", x - shift);
    this.setAttribute("y", y - shift);
  });
});

styleReliefDensityInput.addEventListener("input", function() {
  styleReliefDensityOutput.value = rn(this.value * 100) + "%";
  ReliefIcons();
});

styleTemperatureFillOpacityInput.addEventListener("input", function() {
  temperature.attr("fill-opacity", this.value);
  styleTemperatureFillOpacityOutput.value = this.value;
});

styleTemperatureFontSizeInput.addEventListener("input", function() {
  temperature.attr("font-size", this.value + "px");
  styleTemperatureFontSizeOutput.value = this.value + "px";
});

styleTemperatureFillInput.addEventListener("input", function() {
  temperature.attr("fill", this.value);
  styleTemperatureFillOutput.value = this.value;
});

stylePopulationRuralStrokeInput.addEventListener("input", function() {
  population.select("#rural").attr("stroke", this.value);
  stylePopulationRuralStrokeOutput.value = this.value;
});

stylePopulationUrbanStrokeInput.addEventListener("input", function() {
  population.select("#urban").attr("stroke", this.value);
  stylePopulationUrbanStrokeOutput.value = this.value;
});

styleCompassSizeInput.addEventListener("input", function() {
  styleCompassSizeOutput.value = this.value;
  shiftCompass();
});

styleCompassShiftX.addEventListener("input", shiftCompass);
styleCompassShiftY.addEventListener("input", shiftCompass);

function shiftCompass() {
  const tr = `translate(${styleCompassShiftX.value} ${styleCompassShiftY.value}) scale(${styleCompassSizeInput.value})`;
  d3.select("#rose").attr("transform", tr); 
}

styleSelectFont.addEventListener("change", changeFont);
function changeFont() {
  const value = styleSelectFont.value;
  const font = fonts[value].split(':')[0].replace(/\+/g, " ");
  getEl().attr("font-family", font).attr("data-font", fonts[value]);
}

styleFontAdd.addEventListener("click", function() {
  if (styleInputFont.style.display === "none") {
    styleInputFont.style.display = "inline-block";
    styleInputFont.focus();
    styleSelectFont.style.display = "none";
  } else {
    styleInputFont.style.display = "none";
    styleSelectFont.style.display = "inline-block";
  }
});

styleInputFont.addEventListener("change", function() {
  if (!this.value) {tip("Please provide a valid Google font name or link to a @font-face declaration"); return;}
  fetchFonts(this.value).then(fetched => {
    if (!fetched) return;
    styleFontAdd.click();
    styleInputFont.value = "";
    if (fetched !== 1) return;
    styleSelectFont.value = fonts.length-1;
    changeFont(); // auto-change font if 1 font is fetched
  });
});

styleFontSize.addEventListener("change", function() {
  changeFontSize(+this.value);
});

styleFontPlus.addEventListener("click", function() {
  const size = Math.max(rn(getEl().attr("data-size") * 1.1, 2), 1);
  changeFontSize(size);
});

styleFontMinus.addEventListener("click", function() {
  const size = Math.max(rn(getEl().attr("data-size") * .9, 2), 1);
  changeFontSize(size);
});

function changeFontSize(size) {
  getEl().attr("data-size", size).attr("font-size", rn((size + (size / scale)) / 2, 2));
  styleFontSize.value = size;
}

styleRadiusInput.addEventListener("change", function() {
  changeRadius(+this.value);
});

styleRadiusPlus.addEventListener("click", function() {
  const size = Math.max(rn(getEl().attr("size") * 1.1, 2), .2);
  changeRadius(size);
});

styleRadiusMinus.addEventListener("click", function() {
  const size = Math.max(rn(getEl().attr("size") * .9, 2), .2);
  changeRadius(size);
});

function changeRadius(size) {
  getEl().attr("size", size)
  getEl().selectAll("circle").each(function() {this.setAttribute("r", size)});
  styleRadiusInput.value = size;
  const group = getEl().attr("id");
  burgLabels.select("g#"+group).selectAll("text").each(function() {this.setAttribute("dy", `${size * -1.5}px`)});
  changeIconSize(size * 2, group); // change also anchor icons
}

styleIconSizeInput.addEventListener("change", function() {
  changeIconSize(+this.value);
});

styleIconSizePlus.addEventListener("click", function() {
  const size = Math.max(rn(getEl().attr("size") * 1.1, 2), .2);
  changeIconSize(size);
});

styleIconSizeMinus.addEventListener("click", function() {
  const size = Math.max(rn(getEl().attr("size") * .9, 2), .2);
  changeIconSize(size);
});

function changeIconSize(size, group) {
  const el = group ? anchors.select("#"+group) : getEl();
  const oldSize = +el.attr("size");
  const shift = (size - oldSize) / 2;
  el.attr("size", size);
  el.selectAll("use").each(function() {
    const x = +this.getAttribute("x");
    const y = +this.getAttribute("y");
    this.setAttribute("x", x - shift);
    this.setAttribute("y", y - shift);
    this.setAttribute("width", size);
    this.setAttribute("height", size);
  });;
  styleIconSizeInput.value = size;
}

// request to restore default style on button click
function askToRestoreDefaultStyle() {
  alertMessage.innerHTML = "Are you sure you want to restore default style for all elements?";
  $("#alert").dialog({resizable: false, title: "Restore default style",
    buttons: {
      Restore: function() {
        applyDefaultStyle();
        selectStyleElement();
        $(this).dialog("close");
      },
      Cancel: function() {$(this).dialog("close");}
    }
  });
}

// request a URL to image to be used as a texture
function textureProvideURL() {
  alertMessage.innerHTML = `Provide an image URL to be used as a texture:
                            <input id="textureURL" type="url" style="width: 254px" placeholder="http://www.example.com/image.jpg" oninput="fetchTextureURL(this.value)">
                            <div style="border: 1px solid darkgrey; height: 144px; margin-top: 2px"><canvas id="preview" width="256px" height="144px"></canvas></div>`;
  $("#alert").dialog({resizable: false, title: "Load custom texture", width: 280,
    buttons: {
      Apply: function() {
        const name = textureURL.value.split("/").pop();
        if (!name || name === "") {tip("Please provide a valid URL", false, "error"); return;}
        const opt = document.createElement("option");
        opt.value = textureURL.value;
        opt.text = name.slice(0, 20);
        styleTextureInput.add(opt);
        styleTextureInput.value = textureURL.value;
        texture.select("image").attr('xlink:href', textureURL.value);
        zoom.scaleBy(svg, 1.00001); // enforce browser re-draw
        $(this).dialog("close");
      },
      Cancel: function() {$(this).dialog("close");}
    }
  });
}

function fetchTextureURL(url) {
  console.log("Provided URL is", url);  
  const img = new Image();
  img.onload = function () {
    const canvas = document.getElementById("preview");
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  };
  img.src = url;
}

// Style map filters handler
mapFilters.addEventListener("click", applyMapFilter);
function applyMapFilter() {
  if (event.target.tagName !== "BUTTON") return;
  const button = event.target;
  svg.attr("filter", null);
  if (button.classList.contains("pressed")) {button.classList.remove("pressed"); return;}
  mapFilters.querySelectorAll(".pressed").forEach(button => button.classList.remove("pressed"));
  button.classList.add("pressed");
  svg.attr("filter", "url(#filter-" + button.id + ")");
}

// Option listeners
const optionsContent = document.getElementById("optionsContent");
optionsContent.addEventListener("input", function(event) {
  const id = event.target.id, value = event.target.value;
  if (id === "mapWidthInput" || id === "mapHeightInput") mapSizeInputChange();
  else if (id === "densityInput" || id === "densityOutput") changeCellsDensity(value);
  else if (id === "culturesInput") culturesOutput.value = value;
  else if (id === "culturesOutput") culturesInput.value = value;
  else if (id === "regionsInput" || id === "regionsOutput") changeStatesNumber(value);
  else if (id === "powerInput") powerOutput.value = value;
  else if (id === "powerOutput") powerInput.value = value;
  else if (id === "neutralInput") neutralOutput.value = value;
  else if (id === "neutralOutput") neutralInput.value = value;
  else if (id === "manorsInput") manorsOutput.value = value;
  else if (id === "manorsOutput") manorsInput.value = value;
  else if (id === "uiSizeInput" || id === "uiSizeOutput") changeUIsize(value);
  else if (id === "tooltipSizeInput" || id === "tooltipSizeOutput") changeTooltipSize(value);
  else if (id === "transparencyInput") changeDialogsTransparency(value);
  else if (id === "pngResolutionInput") pngResolutionOutput.value = value;
  else if (id === "pngResolutionOutput") pngResolutionInput.value = value;
});

optionsContent.addEventListener("change", function(event) {
  if (event.target.dataset.stored) lock(event.target.dataset.stored);  
  const id = event.target.id, value = event.target.value;
  if (id === "zoomExtentMin" || id === "zoomExtentMax") changeZoomExtent(value);
});

optionsContent.addEventListener("click", function(event) {
  const id = event.target.id;
  if (id === "toggleFullscreen") toggleFullscreen();
  else if (id === "optionsSeedGenerate") generateMapWithSeed();
  else if (id === "optionsMapHistory") showSeedHistoryDialog();
  else if (id === "zoomExtentDefault") restoreDefaultZoomExtent();
});

function mapSizeInputChange() {
    changeMapSize();
    autoResize = false;
    localStorage.setItem("mapWidth", mapWidthInput.value);
    localStorage.setItem("mapHeight", mapHeightInput.value);  
}

// change svg size on manual size change or window resize, do not change graph size
function changeMapSize() {
  svgWidth = +mapWidthInput.value;
  svgHeight = +mapHeightInput.value;
  svg.attr("width", svgWidth).attr("height", svgHeight);
  const width = Math.max(svgWidth, graphWidth);
  const height = Math.max(svgHeight, graphHeight);
  zoom.translateExtent([[0, 0], [width, height]]);
  fitScaleBar();
}

// just apply map size that was already set, apply graph size!
function applyMapSize() {
  svgWidth = graphWidth = +mapWidthInput.value;
  svgHeight = graphHeight = +mapHeightInput.value;
  svg.attr("width", svgWidth).attr("height", svgHeight);
  zoom.translateExtent([[0, 0],[graphWidth, graphHeight]]).scaleExtent([1, 20]).scaleTo(svg, 1);
  viewbox.attr("transform", null);
}

function toggleFullscreen() {
  if (mapWidthInput.value != window.innerWidth || mapHeightInput.value != window.innerHeight) {
    mapWidthInput.value = window.innerWidth;
    mapHeightInput.value = window.innerHeight;
    localStorage.removeItem("mapHeight");
    localStorage.removeItem("mapWidth");
  } else {
    mapWidthInput.value = graphWidth;
    mapHeightInput.value = graphHeight;
  }
  changeMapSize();  
}

function generateMapWithSeed() {
  if (optionsSeed.value == seed) {
    tip("The current map already has this seed", false, "error"); 
    return;
  }
  regeneratePrompt();
}

function showSeedHistoryDialog() {
  const alert = mapHistory.map(function(h, i) {
    const created = new Date(h.created).toLocaleTimeString();
    const button = `<i data-tip"Click to generate a map with this seed" onclick="restoreSeed(${i})" class="icon-history optionsSeedRestore"></i>`;
    return `<div>${i+1}. Seed: ${h.seed} ${button}. Size: ${h.width}x${h.height}. Template: ${h.template}. Created: ${created}</div>`;
  }).join("");
  alertMessage.innerHTML = alert;
  $("#alert").dialog({
    resizable: false, title: "Seed history",
    width: fitContent(), position: {my: "center", at: "center", of: "svg"}
  });
}

// generate map with historycal seed
function restoreSeed(id) {
  if (mapHistory[id].seed == seed) {
    tip("The current map is already generated with this seed", null, "error"); 
    return;
  }
  optionsSeed.value = mapHistory[id].seed;
  mapWidthInput.value = mapHistory[id].width;
  mapHeightInput.value = mapHistory[id].height;
  templateInput.value = mapHistory[id].template;
  if (locked("template")) unlock("template");
  regeneratePrompt();
}

function restoreDefaultZoomExtent() {
  zoomExtentMin.value = 1;
  zoomExtentMax.value = 20;
  zoom.scaleExtent([1, 20]).scaleTo(svg, 1);
}

function changeCellsDensity(value) {
  densityInput.value = densityOutput.value = value;
  if (value == 3) densityOutput.style.color = "red";
  else if (value == 2) densityOutput.style.color = "yellow";
  else if (value == 1) densityOutput.style.color = "green";
}

function changeStatesNumber(value) {
  regionsInput.value = regionsOutput.value = value;
  burgLabels.select("#capitals").attr("data-size", Math.max(rn(6 - value / 20), 3));
  labels.select("#countries").attr("data-size", Math.max(rn(18 - value / 6), 4));
}

function changeUIsize(value) {
  uiSizeInput.value = uiSizeOutput.value = value;
  document.getElementsByTagName("body")[0].style.fontSize = value * 11 + "px";
  document.getElementById("options").style.width = (value - 1) * 300 / 2 + 300 + "px"; 
}

function changeTooltipSize(value) {
  tooltipSizeInput.value = tooltipSizeOutput.value = value;
  tooltip.style.fontSize = `calc(${value}px + 0.5vw)`;
}

// change transparency for modal windows
function changeDialogsTransparency(value) {
  transparencyInput.value = transparencyOutput.value = value;
  const alpha = (100 - +value) / 100;
  const optionsColor = "rgba(164, 139, 149, " + alpha + ")";
  const dialogsColor = "rgba(255, 255, 255, " + alpha + ")";
  const optionButtonsColor = "rgba(145, 110, 127, " + Math.min(alpha + .3, 1) + ")";
  const optionLiColor = "rgba(153, 123, 137, " + Math.min(alpha + .3, 1) + ")";
  document.getElementById("options").style.backgroundColor = optionsColor;
  document.getElementById("dialogs").style.backgroundColor = dialogsColor;
  document.querySelectorAll(".tabcontent button").forEach(el => el.style.backgroundColor = optionButtonsColor);
  document.querySelectorAll(".tabcontent li").forEach(el => el.style.backgroundColor = optionLiColor);
  document.querySelectorAll("button.options").forEach(el => el.style.backgroundColor = optionLiColor);
}

function changeZoomExtent(value) {
  zoom.scaleExtent([+zoomExtentMin.value, +zoomExtentMax.value]);
  zoom.scaleTo(svg, +value);  
}

// control sroted options
function applyStoredOptions() {
  for(let i=0; i < localStorage.length; i++){
    const stored = localStorage.key(i), value = localStorage.getItem(stored);
    const input = document.getElementById(stored+"Input");
    const output = document.getElementById(stored+"Output");
    if (input) input.value = value;
    if (output) output.value = value;
    lock(stored);
  }

  if (!localStorage.getItem("mapWidth") || !localStorage.getItem("mapHeight")) {
    mapWidthInput.value = window.innerWidth;
    mapHeightInput.value = window.innerHeight;
  }

  if (localStorage.getItem("winds")) winds = localStorage.getItem("winds").split(",").map(w => +w);
  
  changeDialogsTransparency(localStorage.getItem("transparency") || 30);
  if (localStorage.getItem("uiSize")) changeUIsize(localStorage.getItem("uiSize"));
  if (localStorage.getItem("tooltipSize")) changeTooltipSize(localStorage.getItem("tooltipSize"));
  if (localStorage.getItem("regions")) changeStatesNumber(localStorage.getItem("regions"));

  if (localStorage.getItem("equator")) {
    const eqY = +equatorInput.value;
    equidistanceOutput.min = equidistanceInput.min = Math.max(+mapHeightInput.value - eqY, eqY);
    equidistanceOutput.max = equidistanceInput.max = equidistanceOutput.min * 10;
  }
}

// randomize options if randomization is allowed in option
function randomizeOptions() {
  Math.seedrandom(seed); // reset seed to initial one
  if (!locked("regions")) regionsInput.value = regionsOutput.value = rand(12, 17);
  if (!locked("manors")) manorsInput.value = manorsOutput.value = rn(0.5 + Math.random(), 1);
  if (!locked("power")) powerInput.value = powerOutput.value = rand(0, 4);
  if (!locked("neutral")) neutralInput.value = neutralOutput.value = rn(0.8 + Math.random(), 1);
  if (!locked("cultures")) culturesInput.value = culturesOutput.value = rand(10, 15);
  if (!locked("prec")) precInput.value = precOutput.value = gauss(100, 40, 0, 500);
  const tMax = +temperatureEquatorOutput.max, tMin = +temperatureEquatorOutput.min; // temperature extremes
  if (!locked("temperatureEquator")) temperatureEquatorOutput.value = temperatureEquatorInput.value = rand(tMax-6, tMax);
  if (!locked("temperaturePole")) temperaturePoleOutput.value = temperaturePoleInput.value = rand(tMin, tMin+10);
  if (!locked("equator") && !locked("equidistance")) randomizeWorldSize();
}

// define world size
function randomizeWorldSize() {
  const eq = document.getElementById("equatorInput");
  const eqDI = document.getElementById("equidistanceInput");
  const eqDO = document.getElementById("equidistanceOutput");

  const eqY = equatorOutput.value = eq.value = rand(+eq.min, +eq.max); // equator Y
  eqDO.min = eqDI.min = Math.max(graphHeight - eqY, eqY);
  eqDO.max = eqDI.max = eqDO.min * 10;
  eqDO.value = eqDI.value = rand(rn(eqDO.min * 1.2), rn(eqDO.min * 4)); // distance from equator to poles
}

// remove all saved data from LocalStorage and reload the page
function restoreDefaultOptions() {
  localStorage.clear();
  location.reload();
}


// FONTS

// fetch default fonts if not done before
function loadDefaultFonts() {
  if (!$('link[href="fonts.css"]').length) {
    $("head").append('<link rel="stylesheet" type="text/css" href="fonts.css">');
    const fontsToAdd = ["Amatic+SC:700", "IM+Fell+English", "Great+Vibes", "MedievalSharp", "Metamorphous",
                      "Nova+Script", "Uncial+Antiqua", "Underdog", "Caesar+Dressing", "Bitter", "Yellowtail", "Montez",
                      "Shadows+Into+Light", "Fredericka+the+Great", "Orbitron", "Dancing+Script:700",
                      "Architects+Daughter", "Kaushan+Script", "Gloria+Hallelujah", "Satisfy", "Comfortaa:700", "Cinzel"];
    fontsToAdd.forEach(function(f) {if (fonts.indexOf(f) === -1) fonts.push(f);});
    updateFontOptions();
  }
}

function fetchFonts(url) {
  return new Promise((resolve, reject) => {
    if (url === "") {
      tip("Use a direct link to any @font-face declaration or just font name to fetch from Google Fonts");
      return;
    }
    if (url.indexOf("http") === -1) {
      url = url.replace(url.charAt(0), url.charAt(0).toUpperCase()).split(" ").join("+");
      url = "https://fonts.googleapis.com/css?family=" + url;
    }
    const fetched = addFonts(url).then(fetched => {
      if (fetched === undefined) {
        tip("Cannot fetch font for this value!", false, "error");
        return;
      }
      if (fetched === 0) {
        tip("Already in the fonts list!", false, "error");
        return;
      }
      updateFontOptions();
      if (fetched === 1) {
        tip("Font " + fonts[fonts.length - 1] + " is fetched");
      } else if (fetched > 1) {
        tip(fetched + " fonts are added to the list");
      }
      resolve(fetched);
    });
  })
}

function addFonts(url) {
  $("head").append('<link rel="stylesheet" type="text/css" href="' + url + '">');
  return fetch(url)
    .then(resp => resp.text())
    .then(text => {
      let s = document.createElement('style');
      s.innerHTML = text;
      document.head.appendChild(s);
      let styleSheet = Array.prototype.filter.call(
        document.styleSheets,
        sS => sS.ownerNode === s)[0];
      let FontRule = rule => {
        let family = rule.style.getPropertyValue('font-family');
        let font = family.replace(/['"]+/g, '').replace(/ /g, "+");
        let weight = rule.style.getPropertyValue('font-weight');
        if (weight !== "400") font += ":" + weight;
        if (fonts.indexOf(font) == -1) {
          fonts.push(font);
          fetched++
        }
      };
      let fetched = 0;
      for (let r of styleSheet.cssRules) {FontRule(r);}
      document.head.removeChild(s);
      return fetched;
    })
    .catch(function() {});
}

// Update font list for Label and Burg Editors
function updateFontOptions() {
  styleSelectFont.innerHTML = "";
  for (let i=0; i < fonts.length; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    const font = fonts[i].split(':')[0].replace(/\+/g, " ");
    opt.style.fontFamily = opt.innerHTML = font;
    styleSelectFont.add(opt);
  }
}

// Sticked menu Options listeners
document.getElementById("sticked").addEventListener("click", function(event) {
  const id = event.target.id;
  if (id === "newMapButton") regeneratePrompt();
  else if (id === "saveButton") toggleSavePane();
  else if (id === "loadMap") mapToLoad.click();
  else if (id === "zoomReset") resetZoom(1000);
  else if (id === "saveMap") saveMap();
  else if (id === "saveSVG") saveAsImage("svg");
  else if (id === "savePNG") saveAsImage("png");
  if (id === "saveMap" || id === "saveSVG" || id === "savePNG") toggleSavePane();
});

function regeneratePrompt() {
  if (customization) {tip("Please exit the customization mode first", false, "warning"); return;} 
  const workingTime = (Date.now() - last(mapHistory).created) / 60000; // minutes
  if (workingTime < 15) {regenerateMap(); return;}

  alertMessage.innerHTML = `Are you sure you want to generate a new map?<br>
  All unsaved changes made to the current map will be lost`;
  $("#alert").dialog({resizable: false, title: "Generate new map",
    buttons: {
      Cancel: function() {$(this).dialog("close");},
      Generate: regenerateMap
    }
  });
}

function toggleSavePane() {
  if (saveDropdown.style.display === "block") {saveDropdown.style.display = "none"; return;}
  saveDropdown.style.display = "block";

  // ask users to allow popups
  if (!localStorage.getItem("dns_allow_popup_message")) {
    alertMessage.innerHTML = `Generator uses pop-up window to download files. 
    <br>Please ensure your browser does not block popups.
    <br>Please check browser settings and turn off adBlocker if it is enabled`;

    $("#alert").dialog({title: "File saver", resizable: false, position: {my: "center", at: "center", of: "svg"},
      buttons: {
        OK: function() {
          localStorage.setItem("dns_allow_popup_message", true);
          $(this).dialog("close");
        }
      }
    });
  }

}

// load map
document.getElementById("mapToLoad").addEventListener("change", function() {
  closeDialogs();
  const fileToLoad = this.files[0];
  this.value = "";
  uploadFile(fileToLoad);
});