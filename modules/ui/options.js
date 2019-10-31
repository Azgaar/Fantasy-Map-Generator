// UI module to control the options (preferences)
"use strict";

$("#optionsContainer").draggable({handle: ".drag-trigger", snap: "svg", snapMode: "both"});
$("#mapLayers").disableSelection();

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

  if (id === "layersTab") layersContent.style.display = "block"; else
  if (id === "styleTab") styleContent.style.display = "block"; else
  if (id === "optionsTab") optionsContent.style.display = "block"; else
  if (id === "toolsTab") customization === 1 
    ? customizationMenu.style.display = "block" 
    : toolsContent.style.display = "block"; else
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

// Option listeners
const optionsContent = document.getElementById("optionsContent");
optionsContent.addEventListener("input", function(event) {
  const id = event.target.id, value = event.target.value;
  if (id === "mapWidthInput" || id === "mapHeightInput") mapSizeInputChange();
  else if (id === "densityInput" || id === "densityOutput") changeCellsDensity(+value);
  else if (id === "culturesInput") culturesOutput.value = value;
  else if (id === "culturesOutput") culturesInput.value = value;
  else if (id === "culturesSet") changeCultureSet();
  else if (id === "regionsInput" || id === "regionsOutput") changeStatesNumber(value);
  else if (id === "provincesInput") provincesOutput.value = value;
  else if (id === "provincesOutput") provincesOutput.value = value;
  else if (id === "provincesOutput") powerOutput.value = value;
  else if (id === "powerInput") powerOutput.value = value;
  else if (id === "powerOutput") powerInput.value = value;
  else if (id === "neutralInput") neutralOutput.value = value;
  else if (id === "neutralOutput") neutralInput.value = value;
  else if (id === "manorsInput") changeBurgsNumberSlider(value);
  else if (id === "religionsInput") religionsOutput.value = value;
  else if (id === "uiSizeInput") uiSizeOutput.value = value;
  else if (id === "uiSizeOutput") changeUIsize(value);
  else if (id === "tooltipSizeInput" || id === "tooltipSizeOutput") changeTooltipSize(value);
  else if (id === "transparencyInput") changeDialogsTransparency(value);
  else if (id === "pngResolutionInput") pngResolutionOutput.value = value;
  else if (id === "pngResolutionOutput") pngResolutionInput.value = value;
});

optionsContent.addEventListener("change", function(event) {
  if (event.target.dataset.stored) lock(event.target.dataset.stored);
  const id = event.target.id, value = event.target.value;
  if (id === "zoomExtentMin" || id === "zoomExtentMax") changeZoomExtent(value);
  else if (id === "optionsSeed") generateMapWithSeed();
  else if (id === "uiSizeInput") changeUIsize(value);
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
  localStorage.setItem("mapWidth", mapWidthInput.value);
  localStorage.setItem("mapHeight", mapHeightInput.value);
}

// change svg size on manual size change or window resize, do not change graph size
function changeMapSize() {
  const svgWidth = Math.min(+mapWidthInput.value, window.innerWidth);
  const svgHeight = Math.min(+mapHeightInput.value, window.innerHeight);
  svg.attr("width", svgWidth).attr("height", svgHeight);

  const maxWidth = Math.max(+mapWidthInput.value, graphWidth);
  const maxHeight = Math.max(+mapHeightInput.value, graphHeight);
  zoom.translateExtent([[0, 0], [maxWidth, maxHeight]]);
  landmass.select("rect").attr("x", 0).attr("y", 0).attr("width", maxWidth).attr("height", maxHeight);
  oceanPattern.select("rect").attr("x", 0).attr("y", 0).attr("width", maxWidth).attr("height", maxHeight);
  oceanLayers.select("rect").attr("x", 0).attr("y", 0).attr("width", maxWidth).attr("height", maxHeight);
  //defs.select("#mapClip > rect").attr("width", maxWidth).attr("height", maxHeight);

  fitScaleBar();
  if (window.fitLegendBox) fitLegendBox();
}

// just apply canvas size that was already set
function applyMapSize() {
  graphWidth = +mapWidthInput.value;
  graphHeight = +mapHeightInput.value;
  svgWidth = Math.min(graphWidth, window.innerWidth)
  svgHeight = Math.min(graphHeight, window.innerHeight)
  svg.attr("width", svgWidth).attr("height", svgHeight);
  zoom.translateExtent([[0, 0],[graphWidth, graphHeight]]).scaleExtent([1, 20]).scaleTo(svg, 1);
  //viewbox.attr("transform", null).attr("clip-path", "url(#mapClip)");
  //defs.append("clipPath").attr("id", "mapClip").append("rect").attr("x", 0).attr("y", 0).attr("width", graphWidth).attr("height", graphHeight);
  //zoom.translateExtent([[-svgWidth*.2, -graphHeight*.2], [svgWidth*1.2, graphHeight*1.2]]);
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
  densityOutput.value = value * 10 + "K";
  if (value > 5) densityOutput.style.color = "#b12117";
  else if (value > 1) densityOutput.style.color = "#dfdf12";
  else densityOutput.style.color = "#038603";
}

function changeCultureSet() {
  const max = culturesSet.selectedOptions[0].dataset.max;
  culturesInput.max = culturesOutput.max = max
  if (+culturesOutput.value > +max) culturesInput.value = culturesOutput.value = max;
}

function changeStatesNumber(value) {
  regionsInput.value = regionsOutput.value = value;
  regionsOutput.style.color = +value ? null : "#b12117";
  burgLabels.select("#capitals").attr("data-size", Math.max(rn(6 - value / 20), 3));
  labels.select("#countries").attr("data-size", Math.max(rn(18 - value / 6), 4));
}

function changeBurgsNumberSlider(value) {
  manorsOutput.value = value == 1000 ? "auto" : value;
}

function changeUIsize(value) {
  if (isNaN(+value) || +value > 4 || +value < .5) return;
  uiSizeInput.value = uiSizeOutput.value = value;
  document.getElementsByTagName("body")[0].style.fontSize = value * 11 + "px";
  document.getElementById("options").style.width = value * 300 + "px";
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
  const min = Math.max(+zoomExtentMin.value, .01), max = Math.min(+zoomExtentMax.value, 200);
  zoom.scaleExtent([min, max]);
  const scale = Math.max(Math.min(+value, 200), .01);
  zoom.scaleTo(svg, scale);
}

// control sroted options
function applyStoredOptions() {
  if (!localStorage.getItem("mapWidth") || !localStorage.getItem("mapHeight")) {
    mapWidthInput.value = window.innerWidth;
    mapHeightInput.value = window.innerHeight;
  }

  if (localStorage.getItem("distanceUnit")) applyOption(distanceUnitInput, localStorage.getItem("distanceUnit"));
  if (localStorage.getItem("heightUnit")) applyOption(heightUnit, localStorage.getItem("heightUnit"));

  for (let i=0; i < localStorage.length; i++) {
    const stored = localStorage.key(i), value = localStorage.getItem(stored);
    const input = document.getElementById(stored+"Input") || document.getElementById(stored);
    const output = document.getElementById(stored+"Output");
    if (input) input.value = value;
    if (output) output.value = value;
    lock(stored);

    // add saved style presets to options
    if(stored.slice(0,5) === "style") applyOption(stylePreset, stored, stored.slice(5));
  }

  if (localStorage.getItem("winds")) winds = localStorage.getItem("winds").split(",").map(w => +w);

  changeDialogsTransparency(localStorage.getItem("transparency") || 5);
  if (localStorage.getItem("tooltipSize")) changeTooltipSize(localStorage.getItem("tooltipSize"));
  if (localStorage.getItem("regions")) changeStatesNumber(localStorage.getItem("regions"));

  if (localStorage.getItem("uiSize")) changeUIsize(localStorage.getItem("uiSize"));
  else changeUIsize(Math.max(Math.min(rn(mapWidthInput.value / 1280, 1), 2.5), 1));
}

// randomize options if randomization is allowed (not locked)
function randomizeOptions() {
  Math.seedrandom(seed); // reset seed to initial one

  // 'Options' settings
  if (!locked("regions")) regionsInput.value = regionsOutput.value = gauss(15, 3, 2, 30);
  if (!locked("provinces")) provincesInput.value = provincesOutput.value = gauss(40, 20, 20, 100);
  if (!locked("manors")) {manorsInput.value = 1000; manorsOutput.value = "auto";}
  if (!locked("religions")) religionsInput.value = religionsOutput.value = gauss(5, 2, 2, 10);
  if (!locked("power")) powerInput.value = powerOutput.value = gauss(3, 2, 0, 10);
  if (!locked("neutral")) neutralInput.value = neutralOutput.value = rn(1 + Math.random(), 1);
  if (!locked("cultures")) culturesInput.value = culturesOutput.value = gauss(12, 3, 5, 30);
  if (!locked("culturesSet")) culturesSet.value = ra(Array.from(culturesSet.options)).value;
  changeCultureSet();

  // 'Configure World' settings
  if (!locked("prec")) precInput.value = precOutput.value = gauss(120, 20, 5, 500);
  const tMax = +temperatureEquatorOutput.max, tMin = +temperatureEquatorOutput.min; // temperature extremes
  if (!locked("temperatureEquator")) temperatureEquatorOutput.value = temperatureEquatorInput.value = rand(tMax-6, tMax);
  if (!locked("temperaturePole")) temperaturePoleOutput.value = temperaturePoleInput.value = rand(tMin, tMin+10);
  if (!locked("mapSize")) mapSizeOutput.value = mapSizeInput.value = gauss(50, 20, 15, 100);
  if (!locked("latitude")) latitudeOutput.value = latitudeInput.value = gauss(50, 20, 15, 100);

  // 'Units Editor' settings
  const US = navigator.language === "en-US";
  const UK = navigator.language === "en-GB";
  if (!locked("distanceScale")) distanceScaleOutput.value = distanceScaleInput.value = gauss(3, 1, 1, 5);
  if (!stored("distanceUnit")) distanceUnitInput.value = US || UK ? "mi" : "km";
  if (!stored("heightUnit")) heightUnit.value = US || UK ? "ft" : "m";
  if (!stored("temperatureScale")) temperatureScale.value = US ? "°F" : "°C";
}

// remove all saved data from LocalStorage and reload the page
function restoreDefaultOptions() {
  localStorage.clear();
  location.reload();
}

// Sticked menu Options listeners
document.getElementById("sticked").addEventListener("click", function(event) {
  const id = event.target.id;
  if (id === "newMapButton") regeneratePrompt();
  else if (id === "saveButton") showSavePane();
  else if (id === "loadButton") showLoadPane();
  else if (id === "zoomReset") resetZoom(1000);
});

function regeneratePrompt() {
  if (customization) {tip("New map cannot be generated when edit mode is active, please exit the mode and retry", false, "error"); return;}
  const workingTime = (Date.now() - last(mapHistory).created) / 60000; // minutes
  if (workingTime < 5) {regenerateMap(); return;}

  alertMessage.innerHTML = `Are you sure you want to generate a new map?<br>
  All unsaved changes made to the current map will be lost`;
  $("#alert").dialog({resizable: false, title: "Generate new map",
    buttons: {
      Cancel: function() {$(this).dialog("close");},
      Generate: function() {closeDialogs(); regenerateMap();}
    }
  });
}

function showSavePane() {
  $("#saveMapData").dialog({title: "Save map", resizable: false, width: "27em", 
    position: {my: "center", at: "center", of: "svg"},
    buttons: {Close: function() {$(this).dialog("close");}}
  });
}

// download map data as GeoJSON
function saveGeoJSON() {
  alertMessage.innerHTML = `You can export map data in GeoJSON format used in GIS tools such as QGIS.
  Check out ${link("https://github.com/Azgaar/Fantasy-Map-Generator/wiki/GIS-data-export", "wiki-page")} for guidance`;

  $("#alert").dialog({title: "GIS data export", resizable: false, width: "35em", position: {my: "center", at: "center", of: "svg"},
    buttons: {
      Cells: saveGeoJSON_Cells,
      Routes: saveGeoJSON_Roads,
      Rivers: saveGeoJSON_Rivers,
      Markers: saveGeoJSON_Markers,
      Close: function() {$(this).dialog("close");}
    }
  });
}

function showLoadPane() {
  $("#loadMapData").dialog({title: "Load map", resizable: false, width: "17em", 
    position: {my: "center", at: "center", of: "svg"},
    buttons: {Close: function() {$(this).dialog("close");}}
  });
}

function loadURL() {
  const pattern = /(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/;
  const inner = `Provide URL to a .map file:
    <input id="mapURL" type="url" style="width: 24em" placeholder="https://e-cloud.com/test.map">
    <br><i>Please note server should allow CORS for file to be loaded. If CORS is not allowed, save file to Dropbox and provide a direct link</i>`;
  alertMessage.innerHTML = inner;
  $("#alert").dialog({resizable: false, title: "Load map from URL", width: "27em",
    buttons: {
      Load: function() {
        const value = mapURL.value;
        if (!pattern.test(value)) {tip("Please provide a valid URL", false, "error"); return;}
        loadMapFromURL(value);
        $(this).dialog("close");
      },
      Cancel: function() {$(this).dialog("close");}
    }
  });
}

// load map
document.getElementById("mapToLoad").addEventListener("change", function() {
  const fileToLoad = this.files[0];
  this.value = "";
  closeDialogs();
  uploadMap(fileToLoad);
});

// View mode
viewMode.addEventListener("click", changeViewMode);
function changeViewMode(event) {
  if (event.target.tagName !== "BUTTON") return;
  const button = event.target;

  enterStandardView();
  if (button.classList.contains("pressed")) {
    button.classList.remove("pressed");
    viewStandard.classList.add("pressed");
  } else {
    viewMode.querySelectorAll(".pressed").forEach(button => button.classList.remove("pressed"));
    button.classList.add("pressed");
    if (button.id !== "viewStandard") enter3dView(button.id);
  }
}

function enterStandardView() {
  if (!document.getElementById("canvas3d")) return;
  ThreeD.stop();
  document.getElementById("canvas3d").remove();
  if (options3dUpdate.offsetParent) $("#options3d").dialog("close");
}

async function enter3dView(type) {
  const canvas = document.createElement("canvas");
  canvas.id = "canvas3d";
  canvas.style.display = "block";
  canvas.width = svgWidth;
  canvas.height = svgHeight;
  canvas.style.position = "absolute";
  canvas.style.display = "none";
  canvas.dataset.type = type;
  const started = await ThreeD.create(canvas, type);
  if (!started) return;
  canvas.style.display = "block";
  document.body.insertBefore(canvas, optionsContainer);
  canvas.onmouseenter = () => {
    const help = "Left mouse to change angle, middle mouse / mousewheel to zoom, right mouse to pan. <b>O</b> to toggle options";
    +canvas.dataset.hovered > 2 ? tip("") : tip(help);
    canvas.dataset.hovered = (+canvas.dataset.hovered|0) + 1;
  };
  toggle3dOptions();
}

function toggle3dOptions() {
  if (options3dUpdate.offsetParent) {$("#options3d").dialog("close"); return;}
  $("#options3d").dialog({
    title: "3D mode settings", resizable: false, width: fitContent(),
    position: {my: "right top", at: "right-40 top+10", of: "svg", collision: "fit"}
  });

  updateValues();

  if (modules.options3d) return;
  modules.options3d = true;

  document.getElementById("options3dUpdate").addEventListener("click", ThreeD.update);
  document.getElementById("options3dSave").addEventListener("click", ThreeD.saveScreenshot);

  document.getElementById("options3dScaleRange").addEventListener("input", changeHeightScale);
  document.getElementById("options3dScaleNumber").addEventListener("change", changeHeightScale);
  document.getElementById("options3dLightnessRange").addEventListener("input", changeLightness);
  document.getElementById("options3dLightnessNumber").addEventListener("change", changeLightness);
  document.getElementById("options3dSunX").addEventListener("change", changeSunPosition);
  document.getElementById("options3dSunY").addEventListener("change", changeSunPosition);
  document.getElementById("options3dSunZ").addEventListener("change", changeSunPosition);
  document.getElementById("options3dMeshRotationRange").addEventListener("input", changeRotation);
  document.getElementById("options3dMeshRotationNumber").addEventListener("change", changeRotation);
  document.getElementById("options3dGlobeRotationRange").addEventListener("input", changeRotation);
  document.getElementById("options3dGlobeRotationNumber").addEventListener("change", changeRotation);
  document.getElementById("options3dMeshSkyMode").addEventListener("change", toggleSkyMode);
  document.getElementById("options3dMeshSky").addEventListener("input", changeColors);
  document.getElementById("options3dMeshWater").addEventListener("input", changeColors);
  document.getElementById("options3dGlobeResolution").addEventListener("change", changeResolution);

  function updateValues() {
    const globe = document.getElementById("canvas3d").dataset.type === "viewGlobe";
    options3dMesh.style.display = globe ? "none" : "block";
    options3dGlobe.style.display = globe ? "block" : "none";
    options3dScaleRange.value = options3dScaleNumber.value = ThreeD.options.scale;
    options3dLightnessRange.value = options3dLightnessNumber.value = ThreeD.options.lightness * 100;
    options3dSunX.value = ThreeD.options.sun.x;
    options3dSunY.value = ThreeD.options.sun.y;
    options3dSunZ.value = ThreeD.options.sun.z;
    options3dMeshRotationRange.value = options3dMeshRotationNumber.value = ThreeD.options.rotateMesh;
    options3dGlobeRotationRange.value = options3dGlobeRotationNumber.value = ThreeD.options.rotateGlobe;
    options3dMeshSkyMode.value = ThreeD.options.extendedWater;
    options3dColorSection.style.display = ThreeD.options.extendedWater ? "block" : "none";
    options3dMeshSky.value = ThreeD.options.skyColor;
    options3dMeshWater.value = ThreeD.options.waterColor;
    options3dGlobeResolution.value = ThreeD.options.resolution;
  }

  function changeHeightScale() {
    options3dScaleRange.value = options3dScaleNumber.value = this.value;
    ThreeD.setScale(+this.value);
  }

  function changeLightness() {
    options3dLightnessRange.value = options3dLightnessNumber.value = this.value;
    ThreeD.setLightness(this.value / 100);
  }

  function changeSunPosition() {
    const x = +options3dSunX.value;
    const y = +options3dSunY.value;
    const z = +options3dSunZ.value;
    ThreeD.setSun(x, y, z);
  }

  function changeRotation() {
    (this.nextElementSibling || this.previousElementSibling).value = this.value;
    const speed = +this.value;
    ThreeD.setRotation(speed);
  }

  function toggleSkyMode() {
    const hide = ThreeD.options.extendedWater;
    options3dColorSection.style.display = hide ? "none" : "block";
    ThreeD.toggleSky();
  }

  function changeColors() {
    ThreeD.setColors(options3dMeshSky.value, options3dMeshWater.value);
  }

  function changeResolution() {
    ThreeD.setResolution(this.value);
  }
}