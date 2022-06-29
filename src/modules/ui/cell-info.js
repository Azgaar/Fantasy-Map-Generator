import {getHeight, getCellIdPrecipitation, getFriendlyPopulation} from "utils/unitUtils.ts";

// get cell info on mouse move
export function updateCellInfo(point, i, g) {
  const cells = pack.cells;
  const x = (infoX.innerHTML = rn(point[0]));
  const y = (infoY.innerHTML = rn(point[1]));
  const f = cells.f[i];

  const [lon, lat] = getCoordinates(x, y, 4);
  infoLat.innerHTML = toDMS(lat, "lat");
  infoLon.innerHTML = toDMS(lon, "lon");

  infoCell.innerHTML = i;
  infoArea.innerHTML = cells.area[i] ? si(getArea(cells.area[i])) + " " + getAreaUnit() : "n/a";
  infoEvelation.innerHTML = getElevation(pack.features[f], pack.cells.h[i]);
  infoDepth.innerHTML = getDepth(pack.features[f], point);
  infoTemp.innerHTML = convertTemperature(grid.cells.temp[g]);
  infoPrec.innerHTML = cells.h[i] >= 20 ? getCellIdPrecipitation(i) : "n/a";
  infoRiver.innerHTML = cells.h[i] >= 20 && cells.r[i] ? getRiverInfo(cells.r[i]) : "no";
  infoState.innerHTML =
    cells.h[i] >= 20
      ? cells.state[i]
        ? `${pack.states[cells.state[i]].fullName} (${cells.state[i]})`
        : "neutral lands (0)"
      : "no";
  infoProvince.innerHTML = cells.province[i]
    ? `${pack.provinces[cells.province[i]].fullName} (${cells.province[i]})`
    : "no";
  infoCulture.innerHTML = cells.culture[i] ? `${pack.cultures[cells.culture[i]].name} (${cells.culture[i]})` : "no";
  infoReligion.innerHTML = cells.religion[i]
    ? `${pack.religions[cells.religion[i]].name} (${cells.religion[i]})`
    : "no";
  infoPopulation.innerHTML = getFriendlyPopulation(i);
  infoBurg.innerHTML = cells.burg[i] ? pack.burgs[cells.burg[i]].name + " (" + cells.burg[i] + ")" : "no";
  infoFeature.innerHTML = f ? pack.features[f].group + " (" + f + ")" : "n/a";
  infoBiome.innerHTML = biomesData.name[cells.biome[i]];
}

// get surface elevation
function getElevation(f, h) {
  if (f.land) return getHeight(h) + " (" + h + ")"; // land: usual height
  if (f.border) return "0 " + heightUnit.value; // ocean: 0
  if (f.type === "lake") return getHeight(f.height) + " (" + f.height + ")"; // lake: defined on river generation
}

// get water depth
function getDepth(f, p) {
  if (f.land) return "0 " + heightUnit.value; // land: 0

  // lake: difference between surface and bottom
  const gridH = grid.cells.h[findGridCell(p[0], p[1], grid)];
  if (f.type === "lake") {
    const depth = gridH === 19 ? f.height / 2 : gridH;
    return getHeight(depth, true);
  }

  return getHeight(gridH, true); // ocean: grid height
}

function getRiverInfo(id) {
  const r = pack.rivers.find(r => r.i == id);
  return r ? `${r.name} ${r.type} (${id})` : "n/a";
}
