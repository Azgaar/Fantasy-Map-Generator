
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
    const CellConverted = {
        "i" : Array.from(pack.cells.i),
        "v" : pack.cells.v,
        "c" : pack.cells.c,
        "p" : pack.cells.p,
        "g" : Array.from(pack.cells.g),
        "h" : Array.from(pack.cells.h),
        "area" : Array.from(pack.cells.area),
        "f" : Array.from(pack.cells.f),
        "t" : Array.from(pack.cells.t),
        "haven" : Array.from(pack.cells.haven),
        "harbor" : Array.from(pack.cells.harbor),
        "fl" : Array.from(pack.cells.fl),
        "r" : Array.from(pack.cells.r),
        "conf" : Array.from(pack.cells.conf),
        "biome" : Array.from(pack.cells.biome),
        "s" : Array.from(pack.cells.s),
        "pop" : Array.from(pack.cells.pop),
        "culture" : Array.from(pack.cells.culture),
        "burg" : Array.from(pack.cells.burg),
        "road" : Array.from(pack.cells.road),
        "crossroad" : Array.from(pack.cells.crossroad),
        "state" : Array.from(pack.cells.state),
        "religion" : Array.from(pack.cells.religion),
        "province" : Array.from(pack.cells.province)
    };
    const cellObjArr = [];
    {
        CellConverted.i.forEach(value => {
            const cellobj = {
                "i" : value,
                "v" : CellConverted.v[value],
                "c" : CellConverted.c[value],
                "p" : CellConverted.p[value],
                "g" : CellConverted.g[value],
                "h" : CellConverted.h[value],
                "area" : CellConverted.area[value],
                "f" : CellConverted.f[value],
                "t" : CellConverted.t[value],
                "haven" : CellConverted.haven[value],
                "harbor" : CellConverted.harbor[value],
                "fl" : CellConverted.fl[value],
                "r" : CellConverted.r[value],
                "conf" : CellConverted.conf[value],
                "biome" : CellConverted.biome[value],
                "s" : CellConverted.s[value],
                "pop" : CellConverted.pop[value],
                "culture" : CellConverted.culture[value],
                "burg" : CellConverted.burg[value],
                "road" : CellConverted.road[value],
                "crossroad" : CellConverted.crossroad[value],
                "state" : CellConverted.state[value],
                "religion" : CellConverted.religion[value],
                "province" : CellConverted.province[value]
            }
            cellObjArr.push(cellobj)
        })
    };
    const packs = {
        "cells": cellObjArr,
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
    const CellConverted = {
        "i" : Array.from(pack.cells.i),
        "v" : pack.cells.v,
        "c" : pack.cells.c,
        "p" : pack.cells.p,
        "g" : Array.from(pack.cells.g),
        "h" : Array.from(pack.cells.h),
        "area" : Array.from(pack.cells.area),
        "f" : Array.from(pack.cells.f),
        "t" : Array.from(pack.cells.t),
        "haven" : Array.from(pack.cells.haven),
        "harbor" : Array.from(pack.cells.harbor),
        "fl" : Array.from(pack.cells.fl),
        "r" : Array.from(pack.cells.r),
        "conf" : Array.from(pack.cells.conf),
        "biome" : Array.from(pack.cells.biome),
        "s" : Array.from(pack.cells.s),
        "pop" : Array.from(pack.cells.pop),
        "culture" : Array.from(pack.cells.culture),
        "burg" : Array.from(pack.cells.burg),
        "road" : Array.from(pack.cells.road),
        "crossroad" : Array.from(pack.cells.crossroad),
        "state" : Array.from(pack.cells.state),
        "religion" : Array.from(pack.cells.religion),
        "province" : Array.from(pack.cells.province)
    };
    const cellObjArr = [];
    {
        CellConverted.i.forEach(value => {
            const cellobj = {
                "i" : value,
                "v" : CellConverted.v[value],
                "c" : CellConverted.c[value],
                "p" : CellConverted.p[value],
                "g" : CellConverted.g[value],
                "h" : CellConverted.h[value],
                "area" : CellConverted.area[value],
                "f" : CellConverted.f[value],
                "t" : CellConverted.t[value],
                "haven" : CellConverted.haven[value],
                "harbor" : CellConverted.harbor[value],
                "fl" : CellConverted.fl[value],
                "r" : CellConverted.r[value],
                "conf" : CellConverted.conf[value],
                "biome" : CellConverted.biome[value],
                "s" : CellConverted.s[value],
                "pop" : CellConverted.pop[value],
                "culture" : CellConverted.culture[value],
                "burg" : CellConverted.burg[value],
                "road" : CellConverted.road[value],
                "crossroad" : CellConverted.crossroad[value],
                "state" : CellConverted.state[value],
                "religion" : CellConverted.religion[value],
                "province" : CellConverted.province[value]
            }
            cellObjArr.push(cellobj)
        })
    };
    const cells = cellObjArr;

    const ExportData = {info, cells}

    TIME && console.timeEnd("createMapDataMinimalJson");
    return JSON.stringify(ExportData);
}


