export function exportToJson(type) {
  if (customization)
    return tip("Data cannot be exported when edit mode is active, please exit the mode and retry", false, "error");
  closeDialogs("#alert");

  TIME && console.time("exportToJson");
  const typeMap = {
    Full: getFullDataJson,
    Minimal: getMinimalDataJson,
    PackCells: getPackDataJson,
    GridCells: getGridDataJson
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
  TIME && console.timeEnd("exportToJson");
}

function getFullDataJson() {
  const info = getMapInfo();
  const settings = getSettings();
  const pack = getPackCellsData();
  const grid = getGridCellsData();

  return JSON.stringify({
    info,
    settings,
    mapCoordinates,
    pack,
    grid,
    biomesData,
    notes,
    nameBases
  });
}

function getMinimalDataJson() {
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
    markers: pack.markers,
    routes: pack.routes
  };
  return JSON.stringify({info, settings, mapCoordinates, pack: packData, biomesData, notes, nameBases});
}

function getPackDataJson() {
  const info = getMapInfo();
  const cells = getPackCellsData();
  return JSON.stringify({info, cells});
}

function getGridDataJson() {
  const info = getMapInfo();
  const cells = getGridCellsData();
  return JSON.stringify({info, cells});
}

function getMapInfo() {
  return {
    version,
    description: "Azgaar's Fantasy Map Generator output: azgaar.github.io/Fantasy-map-generator",
    exportedAt: new Date().toISOString(),
    mapName: mapName.value,
    width: graphWidth,
    height: graphHeight,
    seed,
    mapId
  };
}

function getSettings() {
  return {
    distanceUnit: distanceUnitInput.value,
    distanceScale,
    areaUnit: areaUnit.value,
    heightUnit: heightUnit.value,
    heightExponent: heightExponentInput.value,
    temperatureScale: temperatureScale.value,
    populationRate: populationRate,
    urbanization: urbanization,
    mapSize: mapSizeOutput.value,
    latitude: latitudeOutput.value,
    longitude: longitudeOutput.value,
    prec: precOutput.value,
    options: options,
    mapName: mapName.value,
    hideLabels: hideLabels.checked,
    stylePreset: stylePreset.value,
    rescaleLabels: rescaleLabels.checked,
    urbanDensity: urbanDensity
  };
}

function getPackCellsData() {
  const data = {
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
    routes: pack.cells.routes,
    state: Array.from(pack.cells.state),
    religion: Array.from(pack.cells.religion),
    province: Array.from(pack.cells.province)
  };

  return {
    cells: Array.from(pack.cells.i).map(cellId => ({
      i: cellId,
      v: data.v[cellId],
      c: data.c[cellId],
      p: data.p[cellId],
      g: data.g[cellId],
      h: data.h[cellId],
      area: data.area[cellId],
      f: data.f[cellId],
      t: data.t[cellId],
      haven: data.haven[cellId],
      harbor: data.harbor[cellId],
      fl: data.fl[cellId],
      r: data.r[cellId],
      conf: data.conf[cellId],
      biome: data.biome[cellId],
      s: data.s[cellId],
      pop: data.pop[cellId],
      culture: data.culture[cellId],
      burg: data.burg[cellId],
      routes: data.routes[cellId],
      state: data.state[cellId],
      religion: data.religion[cellId],
      province: data.province[cellId]
    })),
    vertices: Array.from(pack.vertices.p).map((_, vertexId) => ({
      i: vertexId,
      p: pack.vertices.p[vertexId],
      v: pack.vertices.v[vertexId],
      c: pack.vertices.c[vertexId]
    })),
    features: pack.features,
    cultures: pack.cultures,
    burgs: pack.burgs,
    states: pack.states,
    provinces: pack.provinces,
    religions: pack.religions,
    rivers: pack.rivers,
    markers: pack.markers,
    routes: pack.routes
  };
}

function getGridCellsData() {
  const dataArrays = {
    v: grid.cells.v,
    c: grid.cells.c,
    b: grid.cells.b,
    f: Array.from(grid.cells.f),
    t: Array.from(grid.cells.t),
    h: Array.from(grid.cells.h),
    temp: Array.from(grid.cells.temp),
    prec: Array.from(grid.cells.prec)
  };

  const gridData = {
    cells: Array.from(grid.cells.i).map(cellId => ({
      i: cellId,
      v: dataArrays.v[cellId],
      c: dataArrays.c[cellId],
      b: dataArrays.b[cellId],
      f: dataArrays.f[cellId],
      t: dataArrays.t[cellId],
      h: dataArrays.h[cellId],
      temp: dataArrays.temp[cellId],
      prec: dataArrays.prec[cellId]
    })),
    vertices: Array.from(grid.vertices.p).map((_, vertexId) => ({
      i: vertexId,
      p: grid.vertices.p[vertexId],
      v: grid.vertices.v[vertexId],
      c: grid.vertices.c[vertexId]
    })),
    cellsDesired: grid.cellsDesired,
    spacing: grid.spacing,
    cellsY: grid.cellsY,
    cellsX: grid.cellsX,
    points: grid.points,
    boundary: grid.boundary,
    seed: grid.seed,
    features: pack.features
  };
  return gridData;
}
