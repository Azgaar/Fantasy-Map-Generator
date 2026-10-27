import { select } from "d3";
import { FEATURE_SUBTYPE_LABELS } from "@/data/id-labels";
import { Goods } from "@/model/economy/goods-generator";
import { Markets } from "@/model/economy/markets-generator";
import { Production } from "@/model/economy/production-generator";
import { Grid } from "@/model/graph/grid-generator";
import { Pack } from "@/model/graph/pack-generator";
import { MapEntities } from "@/model/map-entities";
import { Notes } from "@/model/story/notes";
import { convertTemperature, getCellPopulation, getFriendlyHeight, getFriendlyPrecipitation } from "@/model/units";
import { Layers } from "@/renderers/layers";
import type { Point } from "@/types/global";
import { highlightEmblemElement } from "@/ui/map/highlight";
import { showMainTip, tip } from "@/ui/tooltips";
import { sentences, t } from "@/utils/i18n";
import { findEl, getPointer } from "@/utils/node-utils";
import { si } from "@/utils/number-utils";
import { escapeHtml } from "@/utils/string-utils";

/**
 * Get the composed path of a node (including shadow DOM and window)
 * @param {Node | Window} node - The starting node or window
 * @returns {Array<Node>} - The composed path as an array
 */
const getComposedPath = (node: Node | Window): Array<Node | Window> => {
  const { parentNode, host, defaultView } = node as Partial<Pick<Node, "parentNode"> & ShadowRoot & Document>;
  const parent = parentNode || host || defaultView;
  return parent ? [node, ...getComposedPath(parent)] : [node];
};

export function handleMouseMove(event: MouseEvent | TouchEvent): void {
  const node = event.currentTarget as SVGElement | null;
  if (!node || !pack.cells?.p) return;

  const point = getPointer(event, node);
  const cellId = Pack.findCell(point[0], point[1]);
  if (cellId === undefined) return;

  showNotes(event);

  const gridCellId = Grid.findCell(point[0], point[1]);
  if (findEl("tooltip")?.dataset.main) showMainTip();
  else showMapTooltip(point, event, cellId, gridCellId);
}

let currentNoteId: string | null = null; // currently displayed note, to not rerender too often

/** Show the note box for the hovered element, if it has a note */
export function showNotes(event: Event): void {
  if (findEl("notesEditor")) return;

  const ref = MapEntities.resolveTarget(event.target instanceof Element ? event.target : null);
  const id = ref && MapEntities.key(ref);
  const note = ref && Notes.get(ref);

  if (ref && note) {
    if (currentNoteId === id) return;
    currentNoteId = id ?? null;

    const notesEl = findEl("notes");
    if (notesEl) notesEl.style.display = "block";
    const header = findEl("notesHeader");
    if (header) header.textContent = MapEntities.getName(ref);
    const body = findEl("notesBody");
    if (body) body.innerHTML = note;
    return;
  }

  if (options.app.notesPinned || findEl("markerEditor") || (event as MouseEvent).shiftKey) return;

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
  return t("Cell population: {{total}}; Rural: {{rural}}; Urban: {{urban}}", {
    total: si(rural + urban),
    rural: si(rural),
    urban: si(urban)
  });
}

/** Show the tooltip for the hovered map element or, failing that, for the active layer */
export function showMapTooltip(point: Point, event: Event, cellId: number, gridCellId: number): void {
  tip(""); // clear tip

  const target = event.target as SVGElement;
  const path = (event.composedPath ? event.composedPath() : getComposedPath(target)) as HTMLElement[];
  if (!path[path.length - 8]) return;

  const group = path[path.length - 7].id;
  const isLand = pack.cells.h[cellId] >= 20;

  const elementTip = getElementTip({ group, target, event, path, cellId });
  if (elementTip !== undefined) {
    tip(elementTip);
    return;
  }

  showLayerTip(point, cellId, gridCellId, isLand);
}

/** Add what a click on the element does; on a view-only map clicks open nothing, and an empty tip shows the layer's */
function withHint(text?: string, hint = t("Click to edit")): string | undefined {
  if (options.map.viewOnly) return text || undefined;
  return text ? sentences(text, hint) : hint;
}

interface TipContext {
  group: string;
  target: SVGElement;
  event: Event;
  path: HTMLElement[];
  cellId: number;
}

/**
 * Get the tooltip for the hovered element.
 * Returns undefined if the element is not interactive, so the layer tip is shown instead
 */
function getElementTip({ group, target, event, path, cellId }: TipContext): string | undefined {
  const parent = target.parentNode as SVGElement;
  const burgElement = target.closest<SVGElement>("[data-label-type='burg'][data-id], #burgIcons [data-id]");
  if (burgElement) {
    const burgId = Number(burgElement.dataset.id);
    const burg = pack.burgs[burgId];
    if (!burg) return withHint();
    const population = si(
      (burg.population || 0) * options.map.units.population.scale * options.map.units.population.urbanization.rate
    );
    const values = { burg: burg.name, group: burg.group, population };
    const name = burg.port ? t("{{burg}} {{group}} port", values) : t("{{burg}} {{group}}", values);
    return withHint(sentences(name, `${t("Population")}: ${population}`));
  }

  const labelElement = target.closest<SVGElement>("#labels [data-label-type]");
  if (labelElement) return withHint(escapeHtml(getLabelText(labelElement)));

  if (group === "armies")
    return withHint(escapeHtml((parent as SVGElement & { dataset: DOMStringMap }).dataset.name ?? ""));

  if (group === "emblems" && target.tagName === "use") return getEmblemTip(target, parent, event);

  if (group === "rivers") {
    const ref = MapEntities.resolveTarget(target);
    return withHint(escapeHtml(ref ? MapEntities.getName(ref) : ""));
  }

  if (group === "routes") {
    const ref = MapEntities.resolveTarget(target);
    if (ref && MapEntities.get(ref)) {
      const name = MapEntities.getName(ref);
      return withHint(name ? escapeHtml(name) : undefined);
    }
    return undefined;
  }

  if (group === "terrain" || group === "ice") return withHint();

  if (group === "markers")
    return withHint(undefined, t("Click to edit the Marker. Hold Shift to not close the assosiated note"));

  if (group === "ruler")
    return findEl("measurersEditor") ? t("Drag the measurer or its points to edit") : t("Measurers Editor");

  // markets and goods swallow the tip even when there is nothing to say, layer values are not shown below them
  if (group === "markets") return getMarketTip(target) ?? "";

  if (group === "goods") return getGoodsTip(target, cellId) ?? "";

  if (group === "lakes" && pack.cells.h[cellId] < 20) {
    const lake = pack.features[Number(target.dataset.f)];
    const name = lake?.name ? [escapeHtml(lake.name)] : [];
    const subtype = lake?.subtype || "lake";
    return withHint(sentences(...name, FEATURE_SUBTYPE_LABELS[subtype] ?? subtype));
  }

  if (group === "zones") {
    const zoneId = Number(path[path.length - 8].dataset.id);
    const zone = pack.zones.find(zone => zone.i === zoneId);
    return zone?.name;
  }

  if (group === "journeys") {
    const match = target.id?.match(/^segment(\d+)_(\d+)$/);
    if (match) {
      const journey = pack.journeys?.find(j => j.i === +match[1]);
      const segment = journey?.segments?.find(s => s.i === +match[2]);
      if (journey && segment) {
        const name = escapeHtml(`${journey.name}: ${segment.name}`);
        return withHint(segment.note ? sentences(name, `“${escapeHtml(segment.note)}”`) : name);
      }
    }
    return withHint();
  }

  return undefined;
}

/** Get the full label text, joining lines of multi-line labels rendered as tspans */
function getLabelText(labelElement: SVGElement): string {
  const tspans = labelElement.querySelectorAll("tspan");
  const text = tspans.length
    ? Array.from(tspans, tspan => tspan.textContent ?? "").join(" ")
    : (labelElement.textContent ?? "");
  return text.replaceAll("|", " ").trim();
}

function getEmblemTip(target: SVGElement, parent: SVGElement, event: Event): string | undefined {
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
  const emblem =
    type === "burg"
      ? t("{{name}} burg emblem", { name })
      : type === "province"
        ? t("{{name}} province emblem", { name })
        : t("{{name}} state emblem", { name });
  return withHint(sentences(emblem, t("Hold Shift to show associated area or place")));
}

function getMarketTip(target: SVGElement): string | undefined {
  const marketEl = target.closest<SVGElement>("[data-id]");
  if (!marketEl) return undefined;

  const market = Markets.get(Number(marketEl.dataset.id));
  const centerBurg = market && pack.burgs[market.centerBurgId];
  if (!centerBurg) return undefined;

  return withHint(t("{{burg}} market", { burg: centerBurg.name }), t("Click to view"));
}

function getGoodsTip(target: SVGElement, cellId: number): string | undefined {
  const bonusGoodId = pack.cells.good[cellId];

  const formatProduction = (produced: Record<string, number>) =>
    Object.entries(produced)
      .filter(([goodId]) => Goods.isDisplayed(Goods.get(Number(goodId))))
      .map(([goodId, amount]) => {
        const name = (Goods.get(Number(goodId))?.name || "unknown").toLowerCase();
        return `${name} ${amount}${Number(goodId) === bonusGoodId ? " (bonus)" : ""}`;
      })
      .join(", ");

  if (target.closest("#goodsIcons")) {
    const good = Goods.get(Number(target.closest<SVGElement>("[data-i]")?.dataset.i));
    return t("{{good}} bonus resource", { good: good?.name });
  }

  if (target.closest("#goodsCells")) {
    const produced = Production.getCellProduction(cellId, Goods.getBiomesProduction());
    // the overview draws only the bonus resource cells
    const good = !pack.goods.some(good => good.visible) && Goods.get(bonusGoodId);
    if (good) {
      const amount = produced[good.i] || 0;
      const unit = amount === 1 ? good.unit : `${good.unit}s`;
      return t("{{good}} bonus resource: {{amount}} {{unit}} per day", { good: good.name, amount, unit });
    }
    return t("Cell rural production: {{production}}", { production: formatProduction(produced) });
  }

  if (target.closest("#goodsBurgs")) {
    const burgEl = target.closest<SVGElement>("[data-id]");
    const burg = burgEl && pack.burgs[Number(burgEl.dataset.id)];
    if (!burg || burg.removed) return undefined;

    select(burgEl).raise();
    // an overview pie sector: only its goods
    const sector = target.closest<SVGElement>("[data-goods]")?.dataset.goods?.split(",");
    const produced = Production.getBurgProduction(burg);
    const shown = sector ? Object.fromEntries(sector.map(goodId => [goodId, produced[+goodId]])) : produced;
    return withHint(
      t("{{burg}} urban production: {{production}}", { burg: burg.name, production: formatProduction(shown) }),
      t("Click to view")
    );
  }

  return undefined;
}

/** Show the value of the active data layer in the hovered cell */
function showLayerTip(point: Point, cellId: number, gridCellId: number, isLand: boolean): void {
  const { cells } = pack;
  if (Layers.isOn("precipitation") && isLand)
    return void tip(t("Annual Precipitation: {{value}}", { value: getFriendlyPrecipitation(cellId, pack, grid) }));
  if (Layers.isOn("population")) return void tip(getPopulationTip(cellId));
  if (Layers.isOn("temperature"))
    return void tip(`${t("Temperature")}: ${convertTemperature(grid.cells.temp[gridCellId])}`);
  if (Layers.isOn("biomes") && cells.biome[cellId]) {
    const biomeId = cells.biome[cellId];
    return void tip(`${t("Biome")}: ${escapeHtml(pack.biomes[biomeId].name)}`);
  }
  if (Layers.isOn("religions") && cells.religion[cellId]) {
    const religionId = cells.religion[cellId];
    const religion = pack.religions[religionId];
    const name = religion.name;
    if (religion.type === "Cult") return void tip(`${t("Cult")}: ${escapeHtml(name)}`);
    if (religion.type === "Heresy") return void tip(`${t("Heresy")}: ${escapeHtml(name)}`);
    if (religion.type === "Folk") return void tip(`${t("Folk religion")}: ${escapeHtml(name)}`);
    return void tip(`${t("Organized religion")}: ${escapeHtml(name)}`);
  }
  if (cells.state[cellId] && (Layers.isOn("provinces") || Layers.isOn("states"))) {
    const stateId = cells.state[cellId];
    const provinceId = cells.province[cellId];
    const province = provinceId ? `${pack.provinces[provinceId].fullName}, ` : "";
    return void tip(province + pack.states[stateId].fullName);
  }
  if (Layers.isOn("cultures") && cells.culture[cellId]) {
    const cultureId = cells.culture[cellId];
    const culture = pack.cultures[cultureId];
    const ancestry = culture?.ancestry?.trim();
    const name = ancestry ? `${culture.name} (${ancestry})` : culture?.name || "";
    return void tip(`${t("Culture")}: ${escapeHtml(name)}`);
  }
  if (Layers.isOn("cells")) return void tip(`${t("Cell")}: ${cellId} (${t("Grid")}: ${gridCellId})`);
  if (Layers.isOn("heightmap")) return void tip(`${t("Height")}: ${getFriendlyHeight(point, pack, grid)}`);
}
