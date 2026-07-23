import { select } from "d3";
import { Controllers } from "@/controllers";
import { highlightEmblemElement } from "@/renderers/overlays/highlight";
import {
  convertTemperature,
  debounce,
  findClosestCell,
  findEl,
  findGridCell,
  getCellPopulation,
  getComposedPath,
  getFriendlyHeight,
  getFriendlyPrecipitation,
  getPointer,
  si
} from "@/utils";
import { showMainTip, tip } from "./tooltips";

type Point = [number, number];

export const onMouseMove = debounce(handleMouseMove, 100);

function handleMouseMove(event: MouseEvent | TouchEvent): void {
  const node = event.currentTarget as SVGElement | null;
  if (!node) return;

  const point = getPointer(event, node);
  const cellId = findClosestCell(point[0], point[1], undefined, pack);
  if (cellId === undefined) return;

  showNotes(event);

  const gridCellId = findGridCell(point[0], point[1], grid);
  if (findEl("tooltip")?.dataset.main) showMainTip();
  else showMapTooltip(point, event, cellId, gridCellId);

  if (findEl("cellInfo")?.offsetParent) Controllers.CellInfo.update(point, cellId, gridCellId);
}

let currentNoteId: string | null = null; // currently displayed note, to not rerender too often

/** Show the note box for the hovered element, if it has a note */
export function showNotes(event: Event): void {
  if (findEl("notesEditor")) return;

  const target = event.target as HTMLElement;
  const parent = target.parentNode as HTMLElement;
  const grand = parent?.parentNode as HTMLElement;

  const isBurg = grand?.id === "burgLabels" || grand?.id === "burgIcons";
  const id = isBurg ? `burg${target.dataset.id}` : target.id || parent?.id || grand?.id;

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

/** Highlight the line for an id in an open editor, so hovering the map points at the row */
function highlightIn(editorId: string, id: number, timeout = 10000): void {
  const editor = findEl(editorId);
  if (!editor) return;

  for (const el of Array.from(editor.getElementsByClassName("hovered"))) el.classList.remove("hovered");

  const hovered = Array.from(editor.querySelectorAll("div")).find(el => el.dataset.id === String(id));
  if (!hovered) return;

  hovered.classList.add("hovered");
  if (timeout) setTimeout(() => hovered.classList.remove("hovered"), timeout);
}

function getPopulationTip(cellId: number): string {
  const [rural, urban] = getCellPopulation(cellId, pack);
  return `Cell population: ${si(rural + urban)}; Rural: ${si(rural)}; Urban: ${si(urban)}`;
}

/** Show the tooltip for the hovered map element or, failing that, for the active layer */
export function showMapTooltip(point: Point, event: Event, cellId: number, gridCellId: number): void {
  tip(""); // clear tip

  const target = event.target as SVGElement;
  const path = (event.composedPath ? event.composedPath() : getComposedPath(target)) as HTMLElement[];
  if (!path[path.length - 8]) return;

  const group = path[path.length - 7].id;
  const subgroup = path[path.length - 8].id;
  const isLand = pack.cells.h[cellId] >= 20;

  const elementTip = getElementTip({ group, subgroup, target, event, path, cellId });
  if (elementTip !== undefined) {
    tip(elementTip);
    return;
  }

  showLayerTip(point, cellId, gridCellId, isLand);
}

interface TipContext {
  group: string;
  subgroup: string;
  target: SVGElement;
  event: Event;
  path: HTMLElement[];
  cellId: number;
}

/**
 * Get the tooltip for the hovered element.
 * Returns undefined if the element is not interactive, so the layer tip is shown instead
 */
function getElementTip({ group, subgroup, target, event, path, cellId }: TipContext): string | undefined {
  const parent = target.parentNode as SVGElement;

  if (group === "armies") return `${(parent as SVGElement & { dataset: DOMStringMap }).dataset.name}. Click to edit`;

  if (group === "emblems" && target.tagName === "use") return getEmblemTip(target, parent, event);

  if (group === "rivers") {
    const riverId = Number(target.id.slice(5));
    const river = pack.rivers.find(river => river.i === riverId);
    highlightIn("riversOverview", riverId, 5000);
    return `${river ? `${river.name} ${river.type}` : ""}. Click to edit`;
  }

  if (group === "routes") {
    const routeId = Number(target.id.slice(5));
    const route = pack.routes.find(route => route.i === routeId);
    if (route) return route.name ? `${route.name}. Click to edit the Route` : "Click to edit the Route";
    return undefined;
  }

  if (group === "terrain") return "Click to edit the Relief Icon";

  if (subgroup === "burgLabels" || subgroup === "burgIcons") {
    const burgId = Number(path[path.length - 10]?.dataset.id);
    if (burgId) {
      const burg = pack.burgs[burgId];
      const population = si((burg.population || 0) * populationRate * urbanization);
      highlightIn("burgsOverview", burgId, 5000);
      return `${burg.name} ${burg.group}. Population: ${population}. Click to edit`;
    }
    return "Click to edit the Burg";
  }

  if (group === "labels") return "Click to edit the Label";

  if (group === "markers") return "Click to edit the Marker. Hold Shift to not close the assosiated note";

  if (group === "ruler")
    return findEl("measurersEditor") ? "Drag the measurer or its points to edit" : "Click to open the Measurers Editor";

  // markets and goods swallow the tip even when there is nothing to say, layer values are not shown below them
  if (group === "markets") return getMarketTip(target) ?? "";

  if (group === "goods") return getGoodsTip(target, cellId) ?? "";

  if (group === "lakes" && pack.cells.h[cellId] < 20) {
    const lakeId = Number(target.dataset.f);
    const name = pack.features[lakeId]?.name;
    return `${subgroup === "freshwater" ? name : `${name} ${subgroup}`} lake. Click to edit`;
  }

  if (group === "coastline") return "Click to edit the coastline";

  if (group === "zones") {
    const zoneId = Number(path[path.length - 8].dataset.id);
    const zone = pack.zones.find(zone => zone.i === zoneId);
    highlightIn("zonesEditor", zoneId, 5000);
    return zone?.name;
  }

  if (group === "ice") return "Click to edit the Ice";

  return undefined;
}

function getEmblemTip(target: SVGElement, parent: SVGElement, event: Event): string {
  const [elements, type] =
    parent.id === "burgEmblems"
      ? ([pack.burgs, "burg"] as const)
      : parent.id === "provinceEmblems"
        ? ([pack.provinces, "province"] as const)
        : ([pack.states, "state"] as const);

  const element = elements[Number(target.dataset.i)];
  if ((event as MouseEvent).shiftKey) highlightEmblemElement(type, element);

  select(target).raise();
  select(parent).raise();

  const name = "fullName" in element ? element.fullName || element.name : element.name;
  return `${name} ${type} emblem. Click to edit. Hold Shift to show associated area or place`;
}

function getMarketTip(target: SVGElement): string | undefined {
  const marketEl = target.closest<SVGElement>("[data-id]");
  if (!marketEl) return undefined;

  const market = Markets.get(Number(marketEl.dataset.id));
  const centerBurg = market && pack.burgs[market.centerBurgId];
  if (!centerBurg) return undefined;

  return `${centerBurg.name} market. Click to view`;
}

function getGoodsTip(target: SVGElement, cellId: number): string | undefined {
  const bonusGoodId = pack.cells.good[cellId];

  const formatProduction = (produced: Record<string, number>) =>
    Object.entries(produced)
      .filter(([goodId]) => Goods.get(Number(goodId))?.visible)
      .map(([goodId, amount]) => {
        const name = (Goods.get(Number(goodId))?.name || "unknown").toLowerCase();
        return `${name} ${amount}${Number(goodId) === bonusGoodId ? " (bonus)" : ""}`;
      })
      .join(", ");

  if (target.closest("#goodsIcons")) {
    const good = Goods.get(Number(target.closest<SVGElement>("[data-i]")?.dataset.i));
    return `${good?.name} bonus resource. Click to open Goods Editor and select displayed goods`;
  }

  if (target.closest("#goodsCells")) {
    const produced = Production.getCellProduction(cellId, Goods.getBiomesProduction());
    return `Cell rural production: ${formatProduction(produced)}. Click to select displayed goods in Goods Editor`;
  }

  if (target.closest("#goodsBurgs")) {
    const burgEl = target.closest<SVGElement>("[data-id]");
    const burg = burgEl && pack.burgs[Number(burgEl.dataset.id)];
    if (!burg || burg.removed) return undefined;

    select(burgEl).raise();
    return `${burg.name} urban production: ${formatProduction(Production.getBurgProduction(burg))}. Click to view`;
  }

  return undefined;
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
    highlightIn("biomesEditor", biomeId);
    return void tip(`Biome: ${biomesData.name[biomeId]}`);
  }

  if (layerIsOn("toggleReligions") && cells.religion[cellId]) {
    const religionId = cells.religion[cellId];
    const religion = pack.religions[religionId];
    const type = religion.type === "Cult" || religion.type === "Heresy" ? religion.type : `${religion.type} religion`;
    highlightIn("religionsEditor", religionId);
    return void tip(`${type}: ${religion.name}`);
  }

  if (cells.state[cellId] && (layerIsOn("toggleProvinces") || layerIsOn("toggleStates"))) {
    const stateId = cells.state[cellId];
    const provinceId = cells.province[cellId];
    const province = provinceId ? `${pack.provinces[provinceId].fullName}, ` : "";

    highlightIn("statesEditor", stateId);
    highlightIn("diplomacyEditor", stateId);
    highlightIn("militaryOverview", stateId);
    highlightIn("provincesEditor", provinceId);
    if (findEl("mergeStatesForm")?.offsetParent) highlightIn("mergeStatesForm", stateId);

    return void tip(province + pack.states[stateId].fullName);
  }

  if (layerIsOn("toggleCultures") && cells.culture[cellId]) {
    const cultureId = cells.culture[cellId];
    highlightIn("culturesEditor", cultureId);
    return void tip(`Culture: ${pack.cultures[cultureId].name}`);
  }

  if (layerIsOn("toggleHeight")) return void tip(`Height: ${getFriendlyHeight(point, pack, grid)}`);
}
