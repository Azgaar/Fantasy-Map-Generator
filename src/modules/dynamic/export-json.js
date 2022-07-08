import {tip} from "scripts/tooltips";
import {closeDialogs} from "dialogs/utils";

export function exportToJson(type) {
  if (customization)
    return tip("Data cannot be exported when edit mode is active, please exit the mode and retry", false, "error");
  closeDialogs("#alert");

  const typeMap = {
    Full: getFullDataJson,
    Minimal: getMinimalDataJson,
    PackCells: getPackCellsDataJson,
    GridCells: getGridCellsDataJson
  };

  const mapData = typeMap[type]();
  const blob = new Blob([mapData], {type: "application/json"});
  const URL = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = getFileName(type) + ".json";
  link.href = URL;
  link.click();
  tip(`${link.download} is saved. Open "Downloads" screen (CTRL + J) to check`, true, "success", 7000);
  window.URL.revokeObjectURL(URL);
}

function getFullDataJson() {
  TIME && console.time("getFullDataJson");

  const info = getMapInfo();
  const settings = getSettings();
  const cells = getPackCellsData();
  const vertices = getPackVerticesData();
  const exportData = {info, settings, coords: mapCoordinates, cells, vertices, biomes: biomesData, notes, nameBases};

  TIME && console.timeEnd("getFullDataJson");
  return JSON.stringify(exportData);
}

function getMinimalDataJson() {
  TIME && console.time("getMinimalDataJson");

  const info = getMapInfo();
  const settings = getSettings();
  const packData = {
    features: pack.features,
    cultures: pack.cultures,
    burgs: pack.burgs,
    states: pack.states,
    provinces: pack.provinces,
    religions: pack.religions,
    rivers: pack.rivers,
    markers: pack.markers
  };
  const exportData = {info, settings, coords: mapCoordinates, pack: packData, biomes: biomesData, notes, nameBases};

  TIME && console.timeEnd("getMinimalDataJson");
  return JSON.stringify(exportData);
}

function getPackCellsDataJson() {
  TIME && console.time("getCellsDataJson");

  const info = getMapInfo();
  const cells = getPackCellsData();
  const exportData = {info, cells};

  TIME && console.timeEnd("getCellsDataJson");
  return JSON.stringify(exportData);
}

function getGridCellsDataJson() {
  TIME && console.time("getGridCellsDataJson");

  const info = getMapInfo();
  const gridCells = getGridCellsData();
  const exportData = {info, gridCells};

  TIME && console.log("getGridCellsDataJson");
  return JSON.stringify(exportData);
}

function getMapInfo() {
  const info = {
    version,
    description: "Azgaar's Fantasy Map Generator output: azgaar.github.io/Fantasy-map-generator",
    exportedAt: new Date().toISOString(),
    mapName: mapName.value,
    seed,
    mapId
  };

  return info;
}

function getSettings() {
  const settings = {
    distanceUnit: distanceUnitInput.value,
    distanceScale: distanceScaleInput.value,
    areaUnit: areaUnit.value,
    heightUnit: heightUnit.value,
    heightExponent: heightExponentInput.value,
    temperatureScale: temperatureScale.value,
    barSize: barSizeInput.value,
    barLabel: barLabel.value,
    barBackOpacity: barBackOpacity.value,
    barBackColor: barBackColor.value,
    barPosX: barPosX.value,
    barPosY: barPosY.value,
    populationRate: populationRate,
    urbanization: urbanization,
    mapSize: mapSizeOutput.value,
    latitudeO: latitudeOutput.value,
    temperatureEquator: temperatureEquatorOutput.value,
    temperaturePole: temperaturePoleOutput.value,
    prec: precOutput.value,
    options: options,
    mapName: mapName.value,
    hideLabels: hideLabels.checked,
    stylePreset: stylePreset.value,
    rescaleLabels: rescaleLabels.checked,
    urbanDensity: urbanDensity
  };

  return settings;
}

function getPackCellsData() {
  const cellConverted = {
    i: Array.from(pack.cells.i),
    v: pack.cells.v,
    c: pack.cells.c,
    p: pack.cells.p,
    g: Array.from(pack.cells.g),
    h: Array.from(pack.cells.h),
    area: Array.from(pack.cells.area),
    f: Array.from(pack.cells.f),
    t: Array.from(pack.cells.t),
    haven: Array.from(pack.cells.haven),
    harbor: Array.from(pack.cells.harbor),
    fl: Array.from(pack.cells.fl),
    r: Array.from(pack.cells.r),
    conf: Array.from(pack.cells.conf),
    biome: Array.from(pack.cells.biome),
    s: Array.from(pack.cells.s),
    pop: Array.from(pack.cells.pop),
    culture: Array.from(pack.cells.culture),
    burg: Array.from(pack.cells.burg),
    road: Array.from(pack.cells.road),
    crossroad: Array.from(pack.cells.crossroad),
    state: Array.from(pack.cells.state),
    religion: Array.from(pack.cells.religion),
    province: Array.from(pack.cells.province)
  };

  const cellObjArr = [];
  {
    cellConverted.i.forEach(value => {
      const cellobj = {
        i: value,
        v: cellConverted.v[value],
        c: cellConverted.c[value],
        p: cellConverted.p[value],
        g: cellConverted.g[value],
        h: cellConverted.h[value],
        area: cellConverted.area[value],
        f: cellConverted.f[value],
        t: cellConverted.t[value],
        haven: cellConverted.haven[value],
        harbor: cellConverted.harbor[value],
        fl: cellConverted.fl[value],
        r: cellConverted.r[value],
        conf: cellConverted.conf[value],
        biome: cellConverted.biome[value],
        s: cellConverted.s[value],
        pop: cellConverted.pop[value],
        culture: cellConverted.culture[value],
        burg: cellConverted.burg[value],
        road: cellConverted.road[value],
        crossroad: cellConverted.crossroad[value],
        state: cellConverted.state[value],
        religion: cellConverted.religion[value],
        province: cellConverted.province[value]
      };
      cellObjArr.push(cellobj);
    });
  }

  const cellsData = {
    cells: cellObjArr,
    features: pack.features,
    cultures: pack.cultures,
    burgs: pack.burgs,
    states: pack.states,
    provinces: pack.provinces,
    religions: pack.religions,
    rivers: pack.rivers,
    markers: pack.markers
  };

  return cellsData;
}

function getGridCellsData() {
  const gridData = {
    cellsDesired: grid.cellsDesired,
    spacing: grid.spacing,
    cellsY: grid.cellsY,
    cellsX: grid.cellsX,
    points: grid.points,
    boundary: grid.boundary
  };
  return gridData;
}

function getPackVerticesData() {
  const {vertices} = pack;
  const verticesNumber = vertices.p.length;
  const verticesArray = new Array(verticesNumber);
  for (let i = 0; i < verticesNumber; i++) {
    verticesArray[i] = {
      p: vertices.p[i],
      v: vertices.v[i],
      c: vertices.c[i]
    };
  }
  return verticesArray;
}
