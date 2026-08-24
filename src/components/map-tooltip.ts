import type { LabelType } from "@/generators/labels-generator";
import type { MapHit } from "@/renderers/core/map-renderer";
import { highlightEmblemElement } from "@/renderers/overlays/highlight";
import { getPixiMapPointAtClient, pickPixiRenderer } from "@/renderers/pixi/pixi-renderer-controller";
import type { Point } from "@/types/global";
import {
  convertTemperature,
  findClosestCell,
  findEl,
  findGridCell,
  getCellPopulation,
  getFriendlyHeight,
  getFriendlyPrecipitation,
  si
} from "@/utils";
import { showMainTip, tip } from "./tooltips";

export function handleMouseMove(event: MouseEvent | TouchEvent): void {
  if (!pack.cells?.p) return;
  const clientPoint = getClientPoint(event);
  if (!clientPoint) return;

  const mapPoint = getPixiMapPointAtClient(clientPoint.x, clientPoint.y);
  if (!mapPoint) return;
  const point: Point = [mapPoint.x, mapPoint.y];
  const cellId = findClosestCell(mapPoint.x, mapPoint.y, undefined, pack);
  if (cellId === undefined) return;
  const hit = pickPixiRenderer(clientPoint.x, clientPoint.y);

  showNotes(hit, event);

  const gridCellId = findGridCell(point[0], point[1], grid);
  if (findEl("tooltip")?.dataset.main) showMainTip();
  else showMapTooltip(point, event, cellId, gridCellId, hit);
}

let currentNoteId: string | null = null; // currently displayed note, to not rerender too often

/** Show the note box for the hovered element, if it has a note */
export function showNotes(hit: MapHit | null, event: Event): void {
  if (findEl("notesEditor")) return;

  const id = getMapHitNoteId(hit);
  const note = notes.find(note => note.id === id);

  if (note?.legend) {
    if (currentNoteId === id) return;
    currentNoteId = id;

    const notesEl = findEl("notes");
    if (notesEl) notesEl.style.display = "block";
    const header = findEl("notesHeader");
    if (header) header.innerHTML = note.name;
    const body = findEl("notesBody");
    if (body) body.innerHTML = note.legend;
    return;
  }

  if (options.pinNotes || findEl("markerEditor") || (event as MouseEvent).shiftKey) return;

  const notesEl = findEl("notes");
  if (notesEl) notesEl.style.display = "none";
  const header = findEl("notesHeader");
  if (header) header.innerHTML = "";
  const body = findEl("notesBody");
  if (body) body.innerHTML = "";
  currentNoteId = null;
}

function getPopulationTip(cellId: number): string {
  const [rural, urban] = getCellPopulation(cellId, pack);
  return `Cell population: ${si(rural + urban)}; Rural: ${si(rural)}; Urban: ${si(urban)}`;
}

/** Show the tooltip for the hovered map element or, failing that, for the active layer */
export function showMapTooltip(
  point: Point,
  event: Event,
  cellId: number,
  gridCellId: number,
  hit: MapHit | null
): void {
  tip(""); // clear tip

  const isLand = pack.cells.h[cellId] >= 20;
  const elementTip = getMapHitTip(hit, event, cellId);
  if (elementTip !== undefined) {
    tip(elementTip);
    return;
  }

  showLayerTip(point, cellId, gridCellId, isLand);
}

/**
 * Get the tooltip for a renderer hit. Returns undefined for area hits so the active layer tip is shown instead.
 */
function getMapHitTip(hit: MapHit | null, event: Event, cellId: number): string | undefined {
  if (!hit) return undefined;
  const id = Number(hit.domainId);

  if (hit.domainKind === "burg") return getBurgTip(id);
  if (hit.domainKind === "label") return getLabelTip(hit);
  if (hit.domainKind === "regiment") {
    const stateId = Number(hit.subPart?.stateId);
    const regimentId = Number(hit.subPart?.regimentId);
    const regiment = pack.states[stateId]?.military?.find(item => item.i === regimentId);
    return `${regiment?.name || `Regiment ${regimentId}`}. Click to edit`;
  }
  if (hit.domainKind === "emblem") return getEmblemTip(hit, event);
  if (hit.domainKind === "river") {
    const river = pack.rivers.find(river => river.i === id);
    return `${river ? `${river.name} ${river.type}` : ""}. Click to edit`;
  }
  if (hit.domainKind === "route") {
    const route = pack.routes.find(route => route.i === id);
    if (route) return route.name ? `${route.name}. Click to edit the Route` : "Click to edit the Route";
    return undefined;
  }
  if (hit.domainKind === "relief") return "Click to edit the Relief Icon";
  if (hit.domainKind === "marker") return "Click to edit the Marker. Hold Shift to keep the associated note open";
  if (hit.domainKind === "market") return getMarketTip(id) ?? "";
  if (hit.domainKind === "good") return getGoodsTip(hit, cellId) ?? "";
  if (hit.domainKind === "lake" && pack.cells.h[cellId] < 20) {
    const lake = pack.features[id];
    const name = lake?.name || `Lake ${id}`;
    const type = lake?.group === "freshwater" ? "" : ` ${lake?.group || ""}`;
    return `${name}${type} lake. Click to edit`;
  }
  if (hit.domainKind === "coastline") return "Click to edit the coastline";
  if (hit.domainKind === "zone") {
    const zone = pack.zones.find(zone => zone.i === id);
    return zone?.name;
  }
  if (hit.domainKind === "ice") return "Click to edit the Ice";
  return undefined;
}

function getEmblemTip(hit: MapHit, event: Event): string {
  const id = Number(hit.domainId);
  const type = String(hit.subPart?.type || "state") as "burg" | "province" | "state";
  const elements = type === "burg" ? pack.burgs : type === "province" ? pack.provinces : pack.states;
  const element = elements[id];
  if (!element) return `${type} emblem. Click to edit`;
  if ((event as MouseEvent).shiftKey) highlightEmblemElement(type, element);
  const name = "fullName" in element ? element.fullName || element.name : element.name;
  return `${name} ${type} emblem. Click to edit. Hold Shift to show associated area or place`;
}

function getMarketTip(marketId: number): string | undefined {
  const market = Markets.get(marketId);
  const centerBurg = market && pack.burgs[market.centerBurgId];
  if (!centerBurg) return undefined;

  return `${centerBurg.name} market. Click to view`;
}

function getGoodsTip(hit: MapHit, cellId: number): string | undefined {
  const bonusGoodId = pack.cells.good[cellId];

  const formatProduction = (produced: Record<string, number>) =>
    Object.entries(produced)
      .filter(([goodId]) => Goods.get(Number(goodId))?.visible)
      .map(([goodId, amount]) => {
        const name = (Goods.get(Number(goodId))?.name || "unknown").toLowerCase();
        return `${name} ${amount}${Number(goodId) === bonusGoodId ? " (bonus)" : ""}`;
      })
      .join(", ");

  if (hit.subPart?.type === "icon") {
    const good = Goods.get(Number(hit.domainId));
    return `${good?.name || "Unknown"} bonus resource. Click to open Goods Editor and select displayed goods`;
  }
  if (hit.subPart?.type === "burg") {
    const burg = pack.burgs[Number(hit.subPart.burgId)];
    if (!burg || burg.removed) return undefined;
    return `${burg.name} urban production: ${formatProduction(Production.getBurgProduction(burg))}. Click to view`;
  }
  const sourceCellId = Number(hit.subPart?.cellId);
  const resolvedCellId = Number.isFinite(sourceCellId) ? sourceCellId : cellId;
  const produced = Production.getCellProduction(resolvedCellId, Goods.getBiomesProduction());
  return `Cell rural production: ${formatProduction(produced)}. Click to select displayed goods in Goods Editor`;
}

function getBurgTip(id: number): string {
  const burg = pack.burgs[id];
  if (!burg) return "Click to edit the Burg";
  const population = si((burg.population || 0) * populationRate * urbanization);
  return `${burg.name} ${burg.group}. Population: ${population}. Click to edit`;
}

function getLabelTip(hit: MapHit): string {
  const entityId = Number(hit.subPart?.entityId);
  const type = String(hit.subPart?.type || "added") as LabelType;
  if (type === "burg") return getBurgTip(entityId);
  const text =
    type === "state"
      ? pack.states[entityId]?.fullName || pack.states[entityId]?.name
      : type === "province"
        ? pack.provinces[entityId]?.fullName || pack.provinces[entityId]?.name
        : type === "river"
          ? pack.rivers.find(item => item.i === entityId)?.name
          : type === "route"
            ? pack.routes.find(item => item.i === entityId)?.name
            : pack.addedLabels.find(item => item.i === entityId)?.label.text;
  return `${text || "Label"}. Click to edit the label`;
}

function getMapHitNoteId(hit: MapHit | null): string {
  if (!hit) return "";
  if (hit.domainKind === "label") {
    const type = String(hit.subPart?.type || "added");
    const entityId = Number(hit.subPart?.entityId);
    return type === "burg" ? `burg${entityId}` : String(hit.domainId);
  }
  if (hit.domainKind === "regiment") return `regiment${hit.subPart?.stateId}-${hit.subPart?.regimentId}`;
  if (hit.domainKind === "emblem") return `${hit.subPart?.type || "state"}COA${hit.domainId}`;
  return `${hit.domainKind}${hit.domainId}`;
}

function getClientPoint(event: MouseEvent | TouchEvent): { x: number; y: number } | null {
  if ("touches" in event) {
    const touch = event.touches[0] || event.changedTouches[0];
    return touch ? { x: touch.clientX, y: touch.clientY } : null;
  }
  return { x: event.clientX, y: event.clientY };
}

/** Show the value of the active data layer in the hovered cell */
function showLayerTip(point: Point, cellId: number, gridCellId: number, isLand: boolean): void {
  const { cells } = pack;

  if (layerIsOn("togglePrecipitation") && isLand) {
    return void tip(`Annual Precipitation: ${getFriendlyPrecipitation(cellId, pack, grid)}`);
  }

  if (layerIsOn("togglePopulation")) return void tip(getPopulationTip(cellId));

  if (layerIsOn("toggleTemperature")) {
    return void tip(`Temperature: ${convertTemperature(grid.cells.temp[gridCellId])}`);
  }

  if (layerIsOn("toggleBiomes") && cells.biome[cellId]) {
    const biomeId = cells.biome[cellId];
    return void tip(`Biome: ${pack.biomes[biomeId].name}`);
  }

  if (layerIsOn("toggleReligions") && cells.religion[cellId]) {
    const religionId = cells.religion[cellId];
    const religion = pack.religions[religionId];
    const type = religion.type === "Cult" || religion.type === "Heresy" ? religion.type : `${religion.type} religion`;
    return void tip(`${type}: ${religion.name}`);
  }

  if (cells.state[cellId] && (layerIsOn("toggleProvinces") || layerIsOn("toggleStates"))) {
    const stateId = cells.state[cellId];
    const provinceId = cells.province[cellId];
    const province = provinceId ? `${pack.provinces[provinceId].fullName}, ` : "";

    return void tip(province + pack.states[stateId].fullName);
  }

  if (layerIsOn("toggleCultures") && cells.culture[cellId]) {
    const cultureId = cells.culture[cellId];
    return void tip(`Culture: ${pack.cultures[cultureId].name}`);
  }

  if (layerIsOn("toggleHeight")) return void tip(`Height: ${getFriendlyHeight(point, pack, grid)}`);
}
