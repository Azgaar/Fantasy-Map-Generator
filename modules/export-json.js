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


//Prepare data for API-JSON
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

