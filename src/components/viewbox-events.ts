// Default interaction on the map canvas: pan/zoom, click-to-edit and hover tooltips
import { drag, select } from "d3";
import { Controllers } from "@/controllers";
import { dragLegendBox } from "@/renderers/draw-legend";
import { onMouseMove } from "./map-tooltip";

/** Restore the default viewbox events, dropping whatever an editor bound to the map */
export function restoreDefaultEvents(): void {
  svg.call(zoom);

  select<SVGGElement, unknown>("#viewbox")
    .style("cursor", "default")
    .on(".drag", null)
    .on("click", clicked)
    .on("touchmove mousemove", onMouseMove);

  select<SVGGElement, unknown>("#legend").call(drag<SVGGElement, unknown>().on("start", dragLegendBox));
}

// map group id -> editor to open. The click target is resolved by walking up its ancestors
type Opener = (target: SVGElement, parent: SVGElement) => void;

const PARENT_EDITORS: Record<string, Opener> = {
  rivers: target => Controllers.RiverEditor.open(target.id),
  ice: target => Controllers.IceEditor.open(target),
  terrain: target => Controllers.ReliefEditor.open(target),
  goodsCells: () => Controllers.GoodsEditor.open()
};

const GRAND_EDITORS: Record<string, Opener> = {
  emblems: target => Controllers.EmblemsEditor.open(undefined, undefined, undefined, target),
  routes: target => Controllers.RouteEditor.open(target.id),
  burgLabels: target => Controllers.BurgEditor.open(Number(target.dataset.id)),
  burgIcons: target => Controllers.BurgEditor.open(Number(target.dataset.id)),
  markers: target => Controllers.MarkersEditor.open(undefined, target),
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
  markers: target => Controllers.MarkersEditor.open(undefined, target),
  ruler: () => Controllers.MeasurersEditor.open(),
  armies: (_target, parent) => Controllers.RegimentEditor.open(`#${parent.id}`)
};

/** Handle a click on the map: open the editor for the clicked element */
export function clicked(event: MouseEvent): void {
  const target = event?.target as SVGElement | null;
  const parent = target?.parentElement as SVGElement | null;
  const grand = parent?.parentElement as SVGElement | null;
  const great = grand?.parentElement as SVGElement | null;
  const ancestor = great?.parentElement as SVGElement | null;
  if (!target || !parent || !grand || !great || !ancestor) return;

  if (ancestor.id === "labels" && target.tagName === "tspan")
    return void Controllers.LabelsEditor.open(target as SVGTSpanElement);

  const open = PARENT_EDITORS[parent.id] || GRAND_EDITORS[grand.id] || GREAT_EDITORS[great.id];
  open?.(target, parent);
}

/** Deselect the currently selected element and restore the default map events */
export function unselect(): void {
  restoreDefaultEvents();
  if (!elSelected) return;

  elSelected.call(drag<SVGElement, unknown>().on("drag", null)).attr("class", null);
  select(debug.node() as SVGGElement)
    .selectAll("*")
    .remove();
  select("#viewbox").style("cursor", "default");
  elSelected = null as unknown as typeof elSelected;
}

export const ViewboxEvents = { restoreDefaultEvents, clicked, unselect };

declare global {
  var zoom: any; // d3 v5 zoom behaviour created in main.js
}

window.restoreDefaultEvents = restoreDefaultEvents;
