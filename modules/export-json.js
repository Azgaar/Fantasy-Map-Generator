
/**
 * Downloads created data of getMapDataAPIJson()
 * Download all data generated
 *
 * @see getMapDataAPIJson
 */
function downloadMapDataAPIJson() {
    if (customization) return tip("Map cannot be saved when edit mode is active, please exit the mode and retry", false, "error");
    closeDialogs("#alert");

    const mapData = getMapDataAPIJson();
    const blob = new Blob([mapData], {type: "application/json"});
    const URL = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = getFileName() + "All.json";
    link.href = URL;
    link.click();
    tip(`${link.download} is saved. Open "Downloads" screen (CTRL + J) to check`, true, "success", 7000);
    window.URL.revokeObjectURL(URL);
}

/**
 * Downloads created data of getMinimalMapJSONData()
 * Downloads data without cells
 *
 * @see getMinimalMapJSONData
 */
function downloadMapDataMinimalAPIJson() {
    if (customization) return tip("Map cannot be saved when edit mode is active, please exit the mode and retry", false, "error");
    closeDialogs("#alert");

    const mapData = getMinimalMapJSONData();
    const blob = new Blob([mapData], {type: "application/json"});
    const URL = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = getFileName() + "MinimalDataAPI.json";
    link.href = URL;
    link.click();
    tip(`${link.download} is saved. Open "Downloads" screen (CTRL + J) to check`, true, "success", 7000);
    window.URL.revokeObjectURL(URL);
}


/**
 * Downloads created data of getCellJSONData()
 *
 * @see getCellJSONData
 */
function downloadCellsDataJSON() {
    if (customization) return tip("Map cannot be saved when edit mode is active, please exit the mode and retry", false, "error");
    closeDialogs("#alert");
    const mapData = getCellJSONData();
    const blob = new Blob([mapData], {type: "application/json"});
    const URL = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = getFileName() + "CellsData.json";
    link.href = URL;
    link.click();
    tip(`${link.download} is saved. Open "Downloads" screen (CTRL + J) to check`, true, "success", 7000);
    window.URL.revokeObjectURL(URL);
}








/**
 * Gets current loaded map data as a JSON string.
 * The file contains data looks like:
 * - info
 * - settings (because population and other things are related to this)
 * - coords
 * - notes
 * - pack
 *
 *  @returns {string} JSONString of loaded and constructed data object
 */
function getMapDataAPIJson() {

    TIME && console.time("createMapDataJson");

    const date = new Date();
    const dateString = date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate();
    const info = {
        "version": version,
        "description": "Api-Like Output File Gathered From: azgaar.github.io/Fantasy-map-generator",
        "creation-date":dateString,
        "seed" : seed,
        "mapId":mapId,
        "mapName" : mapName.value
    }

    const settings = {
        "distanceUnit" : distanceUnitInput.value,
        "distanceScale": distanceScaleInput.value,
        "areaUnit" : areaUnit.value,
        "heightUnit" : heightUnit.value,
        "heightExponent" : heightExponentInput.value,
        "temperatureScale" : temperatureScale.value,
        "barSize" : barSizeInput.value,
        "barLabel" : barLabel.value,
        "barBackOpacity" : barBackOpacity.value,
        "barBackColor" : barBackColor.value,
        "barPosX" : barPosX.value,
        "barPosY" : barPosY.value,
        "populationRate" : populationRate,
        "urbanization" : urbanization,
        "mapSize" : mapSizeOutput.value,
        "latitudeO" : latitudeOutput.value,
        "temperatureEquator" : temperatureEquatorOutput.value,
        "temperaturePole" : temperaturePoleOutput.value,
        "prec" : precOutput.value,
        "options" : options,
        "mapName" : mapName.value,
        "hideLabels" : hideLabels.checked,
        "stylePreset" : stylePreset.value,
        "rescaleLabels" : rescaleLabels.checked,
        "urbanDensity" : urbanDensity
    };
    const coords = mapCoordinates;
    const packs = {
        "cells":{
            "h": pack.cells.h,
            "f": pack.cells.f,
            "t": pack.cells.t,
            "s": pack.cells.s,
            "biome": pack.cells.biome,
            "burg": pack.cells.burg,
            "culture": pack.cells.culture,
            "state": pack.cells.state,
            "province" : pack.cells.province,
            "religion" : pack.cells.religion,
            "area": pack.cells.area,
            "pop" : pack.cells.pop,
            "r" : pack.cells.r,
            "fl" : pack.cells.fl,
            "conf" : pack.cells.conf,
            "harbor":pack.cells.harbor,
            "haven" : pack.cells.haven,
            "road":pack.cells.road,
            "crossroad":pack.cells.crossroad
        },
        "features":pack.features,
        "cultures":pack.cultures,
        "burgs":pack.burgs,
        "states":pack.states,
        "provinces":pack.provinces,
        "religions":pack.religions,
        "rivers":pack.rivers,
        "markers":pack.markers,
    }
    const biomes = biomesData;

    const ExportData = {info,settings,coords,packs,biomes,notes,nameBases}

    TIME && console.timeEnd("createMapDataJson");
    return JSON.stringify(ExportData);
}


/**
*   For exporting as JSON without pack.cells
*   This can become handy if user don't want a huge data.
*   For assigning data to cells user must download cells data with downloadCellsData().
*
*   @returns {string} JSONString data of the created object
*/
function getMinimalMapJSONData(){

    TIME && console.time("createMapDataMinimalJson");

    const date = new Date();
    const dateString = date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate();
    const info = {
        "version": version,
        "description": "Api-Like Output File Gathered From: azgaar.github.io/Fantasy-map-generator",
        "creation-date":dateString,
        "seed" : seed,
        "mapId":mapId,
        "mapName" : mapName.value
    }

    const settings = {
        "distanceUnit" : distanceUnitInput.value,
        "distanceScale": distanceScaleInput.value,
        "areaUnit" : areaUnit.value,
        "heightUnit" : heightUnit.value,
        "heightExponent" : heightExponentInput.value,
        "temperatureScale" : temperatureScale.value,
        "barSize" : barSizeInput.value,
        "barLabel" : barLabel.value,
        "barBackOpacity" : barBackOpacity.value,
        "barBackColor" : barBackColor.value,
        "barPosX" : barPosX.value,
        "barPosY" : barPosY.value,
        "populationRate" : populationRate,
        "urbanization" : urbanization,
        "mapSize" : mapSizeOutput.value,
        "latitudeO" : latitudeOutput.value,
        "temperatureEquator" : temperatureEquatorOutput.value,
        "temperaturePole" : temperaturePoleOutput.value,
        "prec" : precOutput.value,
        "options" : options,
        "mapName" : mapName.value,
        "hideLabels" : hideLabels.checked,
        "stylePreset" : stylePreset.value,
        "rescaleLabels" : rescaleLabels.checked,
        "urbanDensity" : urbanDensity
    };
    const coords = mapCoordinates;
    const packs = {
        "features":pack.features,
        "cultures":pack.cultures,
        "burgs":pack.burgs,
        "states":pack.states,
        "provinces":pack.provinces,
        "religions":pack.religions,
        "rivers":pack.rivers,
        "markers":pack.markers,
    }
    const biomes = biomesData;

    const ExportData = {info,settings,coords,packs,biomes,notes,nameBases}

    TIME && console.timeEnd("createMapDataMinimalJson");
    return JSON.stringify(ExportData);
}
/**
 * Gets data that created with info and pack.cell
 * This function is created for primarly pack.cell data is too big.
 * for speeding up the proccess the main data and cell data is seperated as two files.
 *
 * exported data look like:
 *      - info
 *      - cells
 *
 * @see pack
 * @see getMinimalMapJSONData
 * @returns {string} The JSONString of pack.cell
 */
function getCellJSONData() {
    TIME && console.time("createMapDataMinimalJson");

    const date = new Date();
    const dateString = date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate();
    const info = {
        "version": version,
        "description": "Api-Like Output File Gathered From: azgaar.github.io/Fantasy-map-generator",
        "creation-date":dateString,
        "seed" : seed,
        "mapId":mapId,
        "mapName" : mapName.value
    }
    const cells = pack.cells
    const ExportData = {info, cells}

    TIME && console.timeEnd("createMapDataMinimalJson");
    return JSON.stringify(ExportData);
}


