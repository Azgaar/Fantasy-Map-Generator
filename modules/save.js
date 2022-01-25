"use strict";
// functions to save project as .map file

// prepare map data for saving
function getMapData() {
  TIME && console.time("createMapData");

  const date = new Date();
  const dateString = date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate();
  const license = "File can be loaded in azgaar.github.io/Fantasy-Map-Generator";
  const params = [version, license, dateString, seed, graphWidth, graphHeight, mapId].join("|");
  const settings = [
    distanceUnitInput.value,
    distanceScaleInput.value,
    areaUnit.value,
    heightUnit.value,
    heightExponentInput.value,
    temperatureScale.value,
    barSizeInput.value,
    barLabel.value,
    barBackOpacity.value,
    barBackColor.value,
    barPosX.value,
    barPosY.value,
    populationRate,
    urbanization,
    mapSizeOutput.value,
    latitudeOutput.value,
    temperatureEquatorOutput.value,
    temperaturePoleOutput.value,
    precOutput.value,
    JSON.stringify(options),
    mapName.value,
    +hideLabels.checked,
    stylePreset.value,
    +rescaleLabels.checked,
    urbanDensity
  ].join("|");
  const coords = JSON.stringify(mapCoordinates);
  const biomes = [biomesData.color, biomesData.habitability, biomesData.name].join("|");
  const notesData = JSON.stringify(notes);
  const rulersString = rulers.toString();
  const fonts = JSON.stringify(getUsedFonts(svg.node()));

  // save svg
  const cloneEl = document.getElementById("map").cloneNode(true);

  // reset transform values to default
  cloneEl.setAttribute("width", graphWidth);
  cloneEl.setAttribute("height", graphHeight);
  cloneEl.querySelector("#viewbox").removeAttribute("transform");

  cloneEl.querySelector("#ruler").innerHTML = ""; // always remove rulers

  const serializedSVG = new XMLSerializer().serializeToString(cloneEl);

  const {spacing, cellsX, cellsY, boundary, points, features} = grid;
  const gridGeneral = JSON.stringify({spacing, cellsX, cellsY, boundary, points, features});
  const packFeatures = JSON.stringify(pack.features);
  const cultures = JSON.stringify(pack.cultures);
  const states = JSON.stringify(pack.states);
  const burgs = JSON.stringify(pack.burgs);
  const religions = JSON.stringify(pack.religions);
  const provinces = JSON.stringify(pack.provinces);
  const rivers = JSON.stringify(pack.rivers);
  const markers = JSON.stringify(pack.markers);

  // store name array only if not the same as default
  const defaultNB = Names.getNameBases();
  const namesData = nameBases
    .map((b, i) => {
      const names = defaultNB[i] && defaultNB[i].b === b.b ? "" : b.b;
      return `${b.name}|${b.min}|${b.max}|${b.d}|${b.m}|${names}`;
    })
    .join("/");

  // round population to save space
  const pop = Array.from(pack.cells.pop).map(p => rn(p, 4));

  // data format as below
  const mapData = [
    params,
    settings,
    coords,
    biomes,
    notesData,
    serializedSVG,
    gridGeneral,
    grid.cells.h,
    grid.cells.prec,
    grid.cells.f,
    grid.cells.t,
    grid.cells.temp,
    packFeatures,
    cultures,
    states,
    burgs,
    pack.cells.biome,
    pack.cells.burg,
    pack.cells.conf,
    pack.cells.culture,
    pack.cells.fl,
    pop,
    pack.cells.r,
    pack.cells.road,
    pack.cells.s,
    pack.cells.state,
    pack.cells.religion,
    pack.cells.province,
    pack.cells.crossroad,
    religions,
    provinces,
    namesData,
    rivers,
    rulersString,
    fonts,
    markers
  ].join("\r\n");
  TIME && console.timeEnd("createMapData");
  return mapData;
}


function getMapDataAPIJson() {

  TIME && console.time("createMapDataJson");

  const date = new Date();
  const dateString = date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate();
  const license = "Api-Like Output File Gathered From: azgaar.github.io/Fantasy-Map-Generator";
  const params = {version, license, dateString, seed, graphWidth, graphHeight, mapId};
  const SettingsOut = {
    "distanceUnit" : distanceUnitInput.value,
    "distanceScale": distanceScaleInput.value,
    "areaUnit" : areaUnit.value,
    "heightUnit" : heightUnit.value,
    "heightExponent" : heightExponentInput.value,
    "temperatureScale" : temperatureScale.value,
    "barSizeInput" : barSizeInput.value,
    "barLabel" : barLabel.value,
    "barBackOpacity" : barBackOpacity.value,
    "barBackColor" : barBackColor.value,
    "barPosX" : barPosX.value,
    "barPosY" : barPosY.value,
    "populationRate" : populationRate,
    "urbanization" : urbanization,
    "mapSizeOutput" : mapSizeOutput.value,
    "latitudeOutput" : latitudeOutput.value,
    "temperatureEquatorOutput" : temperatureEquatorOutput.value,
    "temperaturePoleOutput" : temperaturePoleOutput.value,
    "precOutput" : precOutput.value,
    "options" : options,
    "mapName" : mapName.value,
    "hideLabels" : hideLabels.checked,
    "stylePreset" : stylePreset.value,
    "rescaleLabels" : rescaleLabels.checked,
    "urbanDensity" : urbanDensity
  };
  const coords = mapCoordinates;
  let BiomeObjArr = [];
  {
    for (let i = 0; i < biomesData.name.length; i++)
  {
    const biome = {
      "name": biomesData.name[i],
      "biomeColor": biomesData.color[i],
      "habitability": biomesData.habitability[i]
    };
    BiomeObjArr.push(biome);
  }
  }
  const biomes = BiomeObjArr;
  const notesData = notes;
  const fonts = getUsedFonts(svg.node());

  const {spacing, cellsX, cellsY, boundary, points, features} = grid;
  const gridGeneral = {spacing, cellsX, cellsY, boundary, points, features};
  const packFeatures = pack.features;
  const cultures = pack.cultures;
  const states = pack.states;
  const burgs = pack.burgs;
  const religions = pack.religions;
  const provinces = pack.provinces;
  const rivers = pack.rivers;
  const markers = pack.markers;

  // store name array only if not the same as default
  const defaultNB = Names.getNameBases();
  const namesData = nameBases
      .map((b, i) => {
        const names = defaultNB[i] && defaultNB[i].b === b.b ? "" : b.b;
        return {"name":b.name,"min":b.min,"max":b.max,"d":b.d,"m":b.m,"names":names}
      });


  // round population to save space
  const pop = Array.from(pack.cells.pop).map(p => rn(p, 4));


  const ExportData =JSON.stringify({
    "params" : params,
    "settings" : SettingOut,
    "coords" : coords,
    "biomes" : biomes,
    "notesData" : notesData,
    "gridGeneral" : gridGeneral,
    "gridCellsH" : grid.cells.h,
    "gridCellsPrec" : grid.cells.prec,
    "gridCellsF" : grid.cells.f,
    "gridCellsT" : grid.cells.t,
    "gridCellsTemp" : grid.cells.temp,
    "packFeatures" : packFeatures,
    "cultures" : cultures,
    "states" : states,
    "burgs" : burgs,
    "packCellsBiome" : pack.cells.biome,
    "packCellsBurg" : pack.cells.burg,
    "packCellsConf" : pack.cells.conf,
    "packCellsCulture" : pack.cells.culture,
    "packCellsFl" : pack.cells.fl,
    "pop" : pop,
    "packCellsR" : pack.cells.r,
    "packCellsRoad" : pack.cells.road,
    "packCellsState" : pack.cells.state,
    "packCellsReligion" : pack.cells.religion,
    "packCellsCrossroad" : pack.cells.crossroad,
    "provinces": provinces,
    "religions" : religions,
    "namesData" : namesData,
    "rivers" : rivers,
    "rulers" : rulers,
    "fonts" : fonts,
    "markers" : markers
  })

  TIME && console.timeEnd("createMapDataJson");
  return ExportData;
}
// Download .map file
function dowloadMap() {
  if (customization) return tip("Map cannot be saved when edit mode is active, please exit the mode and retry", false, "error");
  closeDialogs("#alert");

  const mapData = getMapData();
  const blob = new Blob([mapData], {type: "text/plain"});
  const URL = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = getFileName() + ".map";
  link.href = URL;
  link.click();
  tip(`${link.download} is saved. Open "Downloads" screen (CTRL + J) to check`, true, "success", 7000);
  window.URL.revokeObjectURL(URL);
}

function downloadMapDataAPIJson() {
  if (customization) return tip("Map cannot be saved when edit mode is active, please exit the mode and retry", false, "error");
  closeDialogs("#alert");

  const mapData = getMapDataAPIJson();
  const blob = new Blob([mapData], {type: "application/json"});
  const URL = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = getFileName() + ".json";
  link.href = URL;
  link.click();
  tip(`${link.download} is saved. Open "Downloads" screen (CTRL + J) to check`, true, "success", 7000);
  window.URL.revokeObjectURL(URL);
}
function exportGridCellsData(exportName){
  if(customization) return tip("Map cannot be saved when edit mode is active, please exit and retry",false,"error");
  closeDialogs("#alert");

  const toWrite = JSON.stringify(grid.cells);
  const blob = new Blob([toWrite],{type: "application/json"});
  const URL = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = exportName + ".json";
  link.href = URL;
  link.click();
  window.URL.revokeObjectURL(URL);
  return "Item Must Be Downloading"
}


async function saveToDropbox() {
  if (customization) return tip("Map cannot be saved when edit mode is active, please exit the mode and retry", false, "error");
  closeDialogs("#alert");
  const mapData = getMapData();
  const filename = getFileName() + ".map";
  try {
    await Cloud.providers.dropbox.save(filename, mapData);
    tip("Map is saved to your Dropbox", true, "success", 8000);
  } catch (msg) {
    console.error(msg);
    tip("Cannot save .map to your Dropbox", true, "error", 8000);
  }
}

function quickSave() {
  if (customization) return tip("Map cannot be saved when edit mode is active, please exit the mode and retry", false, "error");

  const mapData = getMapData();
  const blob = new Blob([mapData], {type: "text/plain"});
  if (blob) ldb.set("lastMap", blob); // auto-save map
  tip("Map is saved to browser memory. Please also save as .map file to secure progress", true, "success", 2000);
}

const saveReminder = function () {
  if (localStorage.getItem("noReminder")) return;
  const message = [
    "Please don't forget to save your work as a .map file",
    "Please remember to save work as a .map file",
    "Saving in .map format will ensure your data won't be lost in case of issues",
    "Safety is number one priority. Please save the map",
    "Don't forget to save your map on a regular basis!",
    "Just a gentle reminder for you to save the map",
    "Please don't forget to save your progress (saving as .map is the best option)",
    "Don't want to be reminded about need to save? Press CTRL+Q"
  ];
  const interval = 15 * 60 * 1000; // remind every 15 minutes

  saveReminder.reminder = setInterval(() => {
    if (customization) return;
    tip(ra(message), true, "warn", 2500);
  }, interval);
  saveReminder.status = 1;
};
saveReminder();

function toggleSaveReminder() {
  if (saveReminder.status) {
    tip("Save reminder is turned off. Press CTRL+Q again to re-initiate", true, "warn", 2000);
    clearInterval(saveReminder.reminder);
    localStorage.setItem("noReminder", true);
    saveReminder.status = 0;
  } else {
    tip("Save reminder is turned on. Press CTRL+Q to turn off", true, "warn", 2000);
    localStorage.removeItem("noReminder");
    saveReminder();
  }
}
