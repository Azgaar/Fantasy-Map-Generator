// Default interaction on the map canvas: pan/zoom, click-to-edit and hover tooltips
import { drag, select } from "d3";
import { Controllers } from "@/controllers";
import type { LabelType } from "@/generators/labels-generator";
import { dragLegendBox } from "@/renderers/draw-legend";
import { debounce } from "@/utils/commonUtils";
import { handleMouseMove } from "./map-tooltip";
import { applyZoomBehavior } from "./zoom";

const onMouseMove = debounce(handleMouseMove, 100);

export function applyDefaultViewboxEvents(): void {
  applyZoomBehavior();

  select<SVGGElement, unknown>("#viewbox")
    .style("cursor", "default")
    .on(".drag", null)
    .on("click", onClick)
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

window.applyDefaultViewboxEvents = applyDefaultViewboxEvents;
