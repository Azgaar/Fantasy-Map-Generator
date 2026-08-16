// The Cell Info panel: everything known about the cell under the cursor
import { select } from "d3";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { registerManagedDialog } from "@/components/dialog/dialog-helpers";
import { WorkspaceDialog } from "@/components/ui/dialog";
import type { Feature } from "@/generators/features";
import type { Point } from "@/generators/voronoi";
import {
  convertTemperature,
  debounce,
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
  getPointer,
  rn,
  si
} from "@/utils";

const INFO_FIELDS = [
  ["Latitude", "infoLat", ""],
  ["Longitude", "infoLon", ""],
  ["Geozone", "infoGeozone", ""],
  ["Area", "infoArea", "0"],
  ["Type", "infoFeature", "n/a"],
  ["Precipitation", "infoPrec", "0"],
  ["River", "infoRiver", "no"],
  ["Population", "infoPopulation", "0"],
  ["Elevation", "infoElevation", "0"],
  ["Depth", "infoDepth", "0"],
  ["Temperature", "infoTemp", "0"],
  ["Biome", "infoBiome", "n/a"],
  ["State", "infoState", "n/a"],
  ["Province", "infoProvince", "n/a"],
  ["Culture", "infoCulture", "n/a"],
  ["Religion", "infoReligion", "n/a"],
  ["Burg", "infoBurg", "n/a"],
  ["Good", "infoGood", "n/a"],
  ["Market", "infoMarket", "n/a"],
  ["Cell Production", "infoCellProduction", "n/a"],
  ["Burg Production", "infoBurgProduction", "n/a"]
] as const;

let dialogHost: HTMLDivElement | null = null;
let dialogRoot: Root | null = null;
let unregisterDialog: (() => void) | null = null;

function open(): void {
  cleanup();
  renderDialog();
  select<SVGGElement, unknown>("#viewbox").on("touchmove.cellInfo mousemove.cellInfo", updateCellInfo);
}

function openAt(point: Point): void {
  cleanup();
  renderDialog();

  const cellId = findClosestCell(...point, undefined, pack);
  if (cellId === undefined) return;
  updateFields(point, cellId, findGridCell(point[0], point[1], grid));
}

function cleanup(): void {
  select<SVGGElement, unknown>("#viewbox").on(".cellInfo", null);
  unregisterDialog?.();
  unregisterDialog = null;

  const root = dialogRoot;
  const host = dialogHost;
  dialogRoot = null;
  dialogHost = null;
  if (!root) return;

  queueMicrotask(() => {
    root.unmount();
    host?.remove();
  });
}

function renderDialog(): void {
  dialogHost = document.createElement("div");
  dialogHost.dataset.dialogHost = "cellInfo";
  ensureEl("dialogs").appendChild(dialogHost);
  dialogRoot = createRoot(dialogHost);
  unregisterDialog = registerManagedDialog("cellInfo", cleanup, true);

  flushSync(() => {
    dialogRoot?.render(
      <WorkspaceDialog
        className="dialog stable"
        dialogId="cellInfo"
        isModal={false}
        isOpen
        onClose={cleanup}
        placement="top-right"
        placementTarget={document.querySelector("svg")}
        title="Cell Details"
        width="22em"
      >
        <p>
          <b>Cell:</b> <span id="infoCell" /> <b>X:</b> <span id="infoX" /> <b>Y:</b> <span id="infoY" />
        </p>
        {INFO_FIELDS.map(([label, id, initialValue]) => (
          <p key={id}>
            <b>{label}:</b> <span id={id}>{initialValue}</span>
          </p>
        ))}
      </WorkspaceDialog>
    );
  });
}

const updateCellInfo = debounce((event: MouseEvent | TouchEvent): void => {
  const node = event.currentTarget as SVGElement | null;
  if (!node || !pack.cells?.p) return;

  const point = getPointer(event, node);
  const packCellId = findClosestCell(...point, undefined, pack);
  if (packCellId === undefined) return;

  const gridCellId = findGridCell(point[0], point[1], grid);
  updateFields(point, packCellId, gridCellId);
}, 100);

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

export const CellInfo = { open, openAt };
