// The Cell Info panel: everything known about a selected cell
import { closeDialogs, destroyDialog } from "@/components/dialog/dialog-helpers";
import { showDomDialog } from "@/components/ui/dom-dialog";
import type { Feature } from "@/generators/features";
import type { Point } from "@/generators/voronoi";
import {
  convertTemperature,
  ensureEl,
  findClosestCell,
  findGridCell,
  getArea,
  getAreaUnit,
  getCellPopulation,
  getFriendlyPrecipitation,
  getHeight,
  getLatitude,
  getLongitude,
  rn,
  si
} from "@/utils";

const INFO_FIELDS = [
  ["Latitude", "infoLat", "", "icon-compass"],
  ["Longitude", "infoLon", "", "icon-target"],
  ["Geozone", "infoGeozone", "", "icon-globe"],
  ["Area", "infoArea", "0", "icon-map-o"],
  ["Type", "infoFeature", "n/a", "icon-layer-group"],
  ["Precipitation", "infoPrec", "0", "icon-umbrella"],
  ["River", "infoRiver", "no", "icon-bezier-curve"],
  ["Population", "infoPopulation", "0", "icon-users"],
  ["Elevation", "infoElevation", "0", "icon-mountain"],
  ["Depth", "infoDepth", "0", "icon-anchor"],
  ["Temperature", "infoTemp", "0", "icon-temperature-high"],
  ["Biome", "infoBiome", "n/a", "icon-tree"],
  ["State", "infoState", "n/a", "icon-flag"],
  ["Province", "infoProvince", "n/a", "icon-map"],
  ["Culture", "infoCulture", "n/a", "icon-user-friends"],
  ["Religion", "infoReligion", "n/a", "icon-place-of-worship"],
  ["Burg", "infoBurg", "n/a", "icon-home"],
  ["Good", "infoGood", "n/a", "icon-tag"],
  ["Market", "infoMarket", "n/a", "icon-store"],
  ["Cell Production", "infoCellProduction", "n/a", "icon-leaf", "wide"],
  ["Burg Production", "infoBurgProduction", "n/a", "icon-box", "wide"]
] as const;

function openAt(point: Point): void {
  const cellId = findClosestCell(...point, undefined, pack);
  if (cellId === undefined) return;
  closeDialogs(".stable");
  destroyDialog("cellInfo");

  const provinceId = pack.cells.province[cellId];
  const province = pack.provinces[provinceId];
  const title = province ? `Province: ${province.fullName || province.name}` : `Cell ${cellId}`;
  const fields = INFO_FIELDS.map(
    ([label, id, initialValue, icon, size]) => /* html */ `
      <div class="cell-info__item${size === "wide" ? " cell-info__item--wide" : ""}">
        <i aria-hidden="true" class="${icon}"></i>
        <span class="cell-info__label">${label}</span>
        <span class="cell-info__value" id="${id}">${initialValue}</span>
      </div>`
  ).join("");
  ensureEl("dialogs").insertAdjacentHTML(
    "beforeend",
    /* html */ `<div id="cellInfo" class="dialog stable cell-info">
      <div class="cell-info__coordinates">
        <span><i aria-hidden="true" class="icon-map"></i>Cell <b id="infoCell"></b></span>
        <span><i aria-hidden="true" class="icon-resize-horizontal"></i>X <b id="infoX"></b></span>
        <span><i aria-hidden="true" class="icon-resize-vertical"></i>Y <b id="infoY"></b></span>
      </div>
      <div class="cell-info__grid">${fields}</div>
    </div>`
  );
  updateFields(point, cellId, findGridCell(point[0], point[1], grid));
  showDomDialog({
    access: "inspect",
    className: "cell-info-panel",
    content: ensureEl("cellInfo"),
    placement: "top-right",
    placementTarget: document.getElementById("map"),
    presentation: "panel",
    resizable: false,
    title
  });
}

function updateFields(point: Point, cellId: number, gridCellId: number): void {
  const { cells } = pack;
  const x = rn(point[0]);
  const y = rn(point[1]);
  set("infoX", x);
  set("infoY", y);

  const latitude = getLatitude(y, mapCoordinates, graphHeight, 4);
  set("infoLat", toDMS(latitude, "lat"));
  set("infoLon", toDMS(getLongitude(x, mapCoordinates, graphWidth, 4), "lon"));
  set("infoGeozone", getGeozone(latitude));

  const featureId = cells.f[cellId];
  const feature = pack.features[featureId];

  set("infoCell", cellId);
  set("infoArea", cells.area[cellId] ? `${si(getArea(cells.area[cellId]))} ${getAreaUnit()}` : "n/a");
  set("infoElevation", getElevation(feature, cells.h[cellId]));
  set("infoDepth", getDepth(feature, point));
  set("infoTemp", convertTemperature(grid.cells.temp[gridCellId]));
  set("infoPrec", cells.h[cellId] >= 20 ? getFriendlyPrecipitation(cellId, pack, grid) : "n/a");
  set("infoRiver", cells.h[cellId] >= 20 && cells.r[cellId] ? getRiverInfo(cells.r[cellId]) : "no");
  set("infoState", getStateInfo(cellId));
  set("infoProvince", getNamedInfo(pack.provinces, cells.province[cellId], "fullName"));
  set("infoCulture", getNamedInfo(pack.cultures, cells.culture[cellId], "name"));
  set("infoReligion", getNamedInfo(pack.religions, cells.religion[cellId], "name"));
  set("infoPopulation", getFriendlyPopulation(cellId));
  set("infoBurg", getNamedInfo(pack.burgs, cells.burg[cellId], "name"));
  set("infoFeature", featureId ? `${feature.group || feature.type} (${featureId})` : "n/a");
  set("infoBiome", pack.biomes[cells.biome[cellId]].name);
  set("infoGood", getNamedInfo(pack.goods, cells.good[cellId], "name"));
  set("infoMarket", getMarketInfo(cells.market?.[cellId]));

  set("infoCellProduction", listProduction(Production.getCellProduction(cellId, Goods.getBiomesProduction())));

  const burgId = cells.burg[cellId];
  set("infoBurgProduction", burgId ? listProduction(Production.getBurgProduction(pack.burgs[burgId])) : "n/a");
}

function set(id: string, value: string | number) {
  ensureEl(id).innerHTML = String(value);
}

function getNamedInfo<T, K extends keyof T>(elements: T[], id: number, key: K): string {
  if (!id) return "no";
  return `${elements[id]?.[key]} (${id})`;
}

function getStateInfo(cellId: number): string {
  const { cells } = pack;
  if (cells.h[cellId] < 20) return "no";
  const stateId = cells.state[cellId];
  return stateId ? `${pack.states[stateId].fullName} (${stateId})` : "neutral lands (0)";
}

function getMarketInfo(marketId: number | undefined): string {
  if (!marketId) return "no";
  const market = Markets.get(marketId);
  const centerBurg = market && pack.burgs[market.centerBurgId];
  return centerBurg ? `${centerBurg.name} market (${marketId})` : `market ${marketId}`;
}

function listProduction(produced: Record<string, number>): string {
  const entries = Object.entries(produced).filter(([, amount]) => amount > 0);
  if (!entries.length) return "none";
  return entries.map(([goodId, amount]) => `${Goods.get(Number(goodId))?.name || goodId}: ${rn(amount, 2)}`).join(", ");
}

// The formatters below have this panel as their only consumer, so they live here rather than in utils

/** Get the climate zone name for a latitude */
export function getGeozone(latitude: number): string {
  if (latitude > 66.5) return "Arctic";
  if (latitude > 35) return "Temperate North";
  if (latitude > 23.5) return "Subtropical North";
  if (latitude > 1) return "Tropical North";
  if (latitude > -1) return "Equatorial";
  if (latitude > -23.5) return "Tropical South";
  if (latitude > -35) return "Subtropical South";
  if (latitude > -66.5) return "Temperate South";
  return "Antarctic";
}

/** Convert a coordinate to degrees-minutes-seconds format */
export function toDMS(coord: number, type: "lat" | "lon"): string {
  const degrees = Math.floor(Math.abs(coord));
  const minutesNotTruncated = (Math.abs(coord) - degrees) * 60;
  const minutes = Math.floor(minutesNotTruncated);
  const seconds = Math.floor((minutesNotTruncated - minutes) * 60);
  const cardinal = type === "lat" ? (coord >= 0 ? "N" : "S") : coord >= 0 ? "E" : "W";
  return `${degrees}°${minutes}′${seconds}″${cardinal}`;
}

/** Get surface elevation of a feature */
function getElevation(feature: Feature, h: number): string {
  if (feature.land) return `${getHeight(h)} (${h})`; // land: usual height
  if (feature.border) return `0 ${ensureEl<HTMLSelectElement>("heightUnit").value}`; // ocean: 0
  if (feature.type === "lake") return `${getHeight(feature.height)} (${feature.height})`; // lake: set on river generation
  return "n/a";
}

/** Get water depth at a point */
function getDepth(feature: Feature, [x, y]: Point): string {
  if (feature.land) return `0 ${ensureEl<HTMLSelectElement>("heightUnit").value}`; // land: 0

  const gridH = grid.cells.h[findGridCell(x, y, grid)];
  // lake: difference between surface and bottom
  if (feature.type === "lake") return getHeight(gridH === 19 ? feature.height / 2 : gridH, true);

  return getHeight(gridH, true); // ocean: grid height
}

function getRiverInfo(riverId: number): string {
  const river = pack.rivers.find(river => river.i === riverId);
  return river ? `${river.name} ${river.type} (${riverId})` : "n/a";
}

/** Get user-friendly (real-world) population value in a cell */
function getFriendlyPopulation(cellId: number): string {
  const [rural, urban] = getCellPopulation(cellId, pack);
  return `${si(rural + urban)} (${si(rural)} rural, urban ${si(urban)})`;
}

export const CellInfo = { openAt };
