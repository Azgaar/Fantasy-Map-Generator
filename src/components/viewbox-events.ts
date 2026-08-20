// Default interaction on the map canvas: pan/zoom, click-to-edit and hover tooltips
import { drag, select } from "d3";
import { Controllers } from "@/controllers";
import type { LabelType } from "@/generators/labels-generator";
import { dragLegendBox } from "@/renderers/draw-legend";
import { debounce, findClosestCell, getPointer } from "@/utils";
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
  terrain: target => Controllers.ReliefEditor.open(target),
  goodsCells: () => Controllers.GoodsEditor.open()
};

const GRAND_EDITORS: Record<string, Opener> = {
  emblems: target => Controllers.EmblemsEditor.open(undefined, undefined, undefined, target),
  routes: target => Controllers.RouteEditor.open(Number(target.dataset.id ?? target.id.slice(5))),
  ruler: () => Controllers.MeasurersEditor.open(),
  goodsIcons: () => Controllers.GoodsEditor.open(),
  goodsBurgs: (_target, parent) => Controllers.ProductionOverview.open(Number(parent.dataset.id)),
  coastline: target => Controllers.CoastlineVertexEditor.open(target),
  lakes: target => Controllers.LakesEditor.open(target),
  markets: (target, parent) => {
    if (target.tagName !== "path") Controllers.MarketOverview.open(Number(parent.dataset.id));
  }
};

const GREAT_EDITORS: Record<string, Opener> = {
  ruler: () => Controllers.MeasurersEditor.open(),
  armies: (_target, parent) => Controllers.RegimentEditor.open(`#${parent.id}`)
};

/** Handle a click on the map: open the editor for the clicked element */
function onClick(event: MouseEvent): void {
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

/** Open an action menu for the clicked map objects and cell. Shift preserves the browser menu. */
function onContextMenu(event: MouseEvent): void {
  if (event.shiftKey) return;
  const viewbox = event.currentTarget as SVGGElement | null;
  if (!viewbox || !contextMenuIsAvailable(viewbox)) return;

  const context = getContextAtClientPoint(event.clientX, event.clientY, viewbox, event.target);
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
  const context = getContextAtClientPoint(clientX, clientY, viewbox, document.elementFromPoint(clientX, clientY));
  if (!context) return;

  event.preventDefault();
  void import("./map-context-menu").then(({ showMapContextMenu }) => showMapContextMenu(context));
}

function contextMenuIsAvailable(viewbox: SVGGElement): boolean {
  if ((typeof customization !== "undefined" && customization) || !pack.cells?.p) return false;
  return !viewbox.style.cursor || viewbox.style.cursor === "default";
}

function getContextAtClientPoint(clientX: number, clientY: number, viewbox: SVGGElement, target: EventTarget | null) {
  const pointerEvent = { clientX, clientY } as MouseEvent;
  const point = getPointer(pointerEvent, viewbox);
  const cellId = findClosestCell(point[0], point[1], undefined, pack);
  if (cellId === undefined) return null;

  const elements = document.elementsFromPoint(clientX, clientY).filter(element => viewbox.contains(element));
  if (target instanceof Element && viewbox.contains(target) && !elements.includes(target)) elements.unshift(target);

  return buildMapContext({ cellId, clientX, clientY, elements, pack, point });
}

window.applyDefaultViewboxEvents = applyDefaultViewboxEvents;
