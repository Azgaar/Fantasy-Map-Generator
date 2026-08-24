// Default interaction on the map canvas: pan/zoom, click-to-edit and hover tooltips
import { drag, select } from "d3";
import { Controllers } from "@/controllers";
import type { LabelType } from "@/generators/labels-generator";
import type { MapHit } from "@/renderers/core/map-renderer";
import { dragLegendBox } from "@/renderers/draw-legend";
import { getPixiMapPointAtClient, pickPixiRenderer } from "@/renderers/pixi/pixi-renderer-controller";
import { debounce, findClosestCell } from "@/utils";
import { buildMapContext } from "./map-context";
import { handleMouseMove } from "./map-tooltip";
import { applyZoomBehavior } from "./zoom";

const onMouseMove = debounce(handleMouseMove, 100);

export function applyDefaultViewboxEvents(): void {
  applyZoomBehavior();

  select<SVGGElement, unknown>("#viewbox")
    .style("cursor", "default")
    .on(".drag", null)
    .on("click", onClick)
    .on("contextmenu", onContextMenu)
    .on("touchmove mousemove", onMouseMove);

  select<SVGSVGElement, unknown>("#map")
    .attr("aria-label", "Fantasy map. Press Shift+F10 for map actions")
    .attr("tabindex", 0)
    .on("keydown.mapContextMenu", onMapKeyDown);

  select<SVGGElement, unknown>("#legend").call(drag<SVGGElement, unknown>().on("start", dragLegendBox));
}

// map group id -> editor to open. The click target is resolved by walking up its ancestors
type Opener = (target: SVGElement, parent: SVGElement) => void;

const PARENT_EDITORS: Record<string, Opener> = {
  rivers: target => Controllers.RiverEditor.open(Number(target.dataset.id ?? target.id.slice(5))),
  ice: target => Controllers.IceEditor.open(target),
  terrain: target => Controllers.ReliefEditor.open(Number(target.dataset.id)),
  goodsCells: () => Controllers.GoodsEditor.open()
};

const GRAND_EDITORS: Record<string, Opener> = {
  emblems: target => Controllers.EmblemsEditor.open(undefined, undefined, undefined, target),
  routes: target => Controllers.RouteEditor.open(Number(target.dataset.id ?? target.id.slice(5))),
  ruler: () => Controllers.MeasurersEditor.open(),
  goodsIcons: () => Controllers.GoodsEditor.open(),
  goodsBurgs: (_target, parent) => Controllers.ProductionOverview.open(Number(parent.dataset.id)),
  coastline: target => Controllers.CoastlineVertexEditor.open(Number(target.dataset.f)),
  lakes: target => Controllers.LakesEditor.open(Number(target.dataset.f)),
  markets: (target, parent) => {
    if (target.tagName !== "path") Controllers.MarketOverview.open(Number(parent.dataset.id));
  }
};

const GREAT_EDITORS: Record<string, Opener> = {
  ruler: () => Controllers.MeasurersEditor.open(),
  armies: (_target, parent) => Controllers.RegimentEditor.open(Number(parent.dataset.state), Number(parent.dataset.id))
};

/** Handle a click on the map: open the editor for the clicked element */
function onClick(event: MouseEvent): void {
  const hit = pickPixiRenderer(event.clientX, event.clientY);
  if (hit && openMapHit(hit)) return;

  const target = event?.target as SVGElement | null;
  const parent = target?.parentElement as SVGElement | null;
  const grand = parent?.parentElement as SVGElement | null;
  const great = grand?.parentElement as SVGElement | null;
  const ancestor = great?.parentElement as SVGElement | null;
  if (!target || !parent || !grand || !great || !ancestor) return;

  const label = target.closest<SVGTextElement>("#labels text[data-label-type]");
  if (label) {
    const id = Number(label.dataset.id);
    const type = label.dataset.labelType as LabelType;
    if (type === "burg") {
      const burgEditor = document.getElementById("burgEditor");
      const isBurgEditorOpen = burgEditor?.dataset.burgId === String(id);
      if (isBurgEditorOpen) Controllers.LabelsEditor.open(type, id);
      else Controllers.BurgEditor.open(id);
    } else Controllers.LabelsEditor.open(type, id);
    return;
  }

  const open = PARENT_EDITORS[parent.id] || GRAND_EDITORS[grand.id] || GREAT_EDITORS[great.id];
  open?.(target, parent);
}

function openMapHit(hit: MapHit): boolean {
  const id = Number(hit.domainId);
  if (hit.domainKind === "label") {
    const entityId = Number(hit.subPart?.entityId);
    const type = String(hit.subPart?.type) as LabelType;
    if (type === "burg") {
      const burgEditor = document.getElementById("burgEditor");
      if (burgEditor?.dataset.burgId === String(entityId)) Controllers.LabelsEditor.open(type, entityId);
      else Controllers.BurgEditor.open(entityId);
    } else Controllers.LabelsEditor.open(type, entityId);
    return true;
  }
  if (hit.domainKind === "burg") Controllers.BurgEditor.open(id);
  else if (hit.domainKind === "compass") Controllers.CompassEditor.open();
  else if (hit.domainKind === "ice") Controllers.IceEditor.open(id);
  else if (hit.domainKind === "marker") Controllers.MarkersEditor.open(id);
  else if (hit.domainKind === "river") Controllers.RiverEditor.open(id);
  else if (hit.domainKind === "route") Controllers.RouteEditor.open(id);
  else if (hit.domainKind === "market") Controllers.MarketOverview.open(id);
  else if (hit.domainKind === "regiment") {
    Controllers.RegimentEditor.open(Number(hit.subPart?.stateId), Number(hit.subPart?.regimentId));
  } else if (hit.domainKind === "emblem") {
    const type = String(hit.subPart?.type || "state") as "burg" | "province" | "state";
    const entity = type === "burg" ? pack.burgs[id] : type === "province" ? pack.provinces[id] : pack.states[id];
    Controllers.EmblemsEditor.open(type, `${type}COA${id}`, entity);
  } else return false;
  return true;
}

/** Open an action menu for the clicked map objects and cell. Shift preserves the browser menu. */
function onContextMenu(event: MouseEvent): void {
  if (event.shiftKey) return;
  const viewbox = event.currentTarget as SVGGElement | null;
  if (!viewbox || !contextMenuIsAvailable(viewbox)) return;

  const context = getContextAtClientPoint(event.clientX, event.clientY);
  if (!context) return;

  event.preventDefault();
  event.stopPropagation();
  void import("./map-context-menu").then(({ showMapContextMenu }) => showMapContextMenu(context));
}

/** Keyboard equivalent of right-click, anchored at the center of the focused map. */
function onMapKeyDown(event: KeyboardEvent): void {
  if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return;
  const viewbox = document.querySelector<SVGGElement>("#viewbox");
  const map = event.currentTarget as SVGSVGElement | null;
  if (!viewbox || !map || !contextMenuIsAvailable(viewbox)) return;

  const bounds = map.getBoundingClientRect();
  const clientX = bounds.left + bounds.width / 2;
  const clientY = bounds.top + bounds.height / 2;
  const context = getContextAtClientPoint(clientX, clientY);
  if (!context) return;

  event.preventDefault();
  void import("./map-context-menu").then(({ showMapContextMenu }) => showMapContextMenu(context));
}

function contextMenuIsAvailable(viewbox: SVGGElement): boolean {
  if ((typeof customization !== "undefined" && customization) || !pack.cells?.p) return false;
  return !viewbox.style.cursor || viewbox.style.cursor === "default";
}

function getContextAtClientPoint(clientX: number, clientY: number) {
  const mapPoint = getPixiMapPointAtClient(clientX, clientY);
  if (!mapPoint) return null;
  const cellId = findClosestCell(mapPoint.x, mapPoint.y, undefined, pack);
  if (cellId === undefined) return null;
  const hit = pickPixiRenderer(clientX, clientY);
  return buildMapContext({ cellId, clientX, clientY, hit, pack, point: [mapPoint.x, mapPoint.y] });
}

window.applyDefaultViewboxEvents = applyDefaultViewboxEvents;
