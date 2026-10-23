// Default interaction on the map canvas: pan/zoom, click-to-edit, the context menu and hover tooltips
import { drag, select } from "d3";
import { Controllers } from "@/controllers";
import type { LabelType } from "@/generators/labels-generator";
import { dragLegendBox, legendBoxFromEvent } from "@/renderers/draw-legend";
import { findEl } from "@/utils";
import { debounce } from "@/utils/commonUtils";
import { sentences, t } from "@/utils/i18n";
import { LegendBoxes } from "./legend-boxes";
import { handleMouseMove } from "./map-tooltip";
import { tip } from "./tooltips";
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

  select<SVGGElement, unknown>("#legend")
    .on("mousemove", () => tip(sentences(t("Drag to change the position"), t("Click to hide the legend box"))))
    .on("click", hideLegendBox)
    .call(drag<SVGGElement, unknown>().on("start", dragLegendBox));
}

/** A click on a legend box hides that box alone */
function hideLegendBox(event: MouseEvent): void {
  const name = legendBoxFromEvent(event)?.dataset.legend;
  if (name) LegendBoxes.hide(name);
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
  journeys: (_target, parent) => Controllers.JourneyEditor.open(Number(parent.id.replace("journey", ""))),
  markers: target => Controllers.MarkersEditor.open(undefined, target),
  ruler: () => Controllers.MeasurersEditor.open(),
  goodsIcons: () => Controllers.GoodsEditor.open(),
  goodsBurgs: (_target, parent) => Controllers.ProductionOverview.open(Number(parent.dataset.id)),
  lakes: target => Controllers.LakesEditor.open(target),
  markets: (target, parent) => {
    if (target.tagName !== "path") Controllers.MarketOverview.open(Number(parent.dataset.id));
  }
};

const GREAT_EDITORS: Record<string, Opener> = {
  burgIcons: target => Controllers.BurgEditor.open(Number(target.dataset.id)),
  markers: target => Controllers.MarkersEditor.open(undefined, target),
  ruler: () => Controllers.MeasurersEditor.open(),
  armies: (_target, parent) => Controllers.RegimentEditor.open(`#${parent.id}`)
};

/** Open the editor for a map element, as a click on it does; false when it has none */
export function openEditor(element: Element): boolean {
  const target = element as SVGElement;
  const parent = target.parentElement as SVGElement | null;
  const grand = parent?.parentElement as SVGElement | null;
  const great = grand?.parentElement as SVGElement | null;
  const ancestor = great?.parentElement as SVGElement | null;
  if (!parent || !grand || !great || !ancestor) return false;

  const label = target.closest<SVGTextElement>("#labels text[data-label-type]");
  if (label) {
    const id = Number(label.dataset.id);
    const type = label.dataset.labelType as LabelType;
    if (type === "burg") {
      const burgEditor = findEl("burgEditor");
      const isBurgEditorOpen = burgEditor?.dataset.burgId === String(id);
      if (isBurgEditorOpen) Controllers.LabelsEditor.open(type, id);
      else Controllers.BurgEditor.open(id);
    } else Controllers.LabelsEditor.open(type, id);
    return true;
  }

  const open = PARENT_EDITORS[parent.id] || GRAND_EDITORS[grand.id] || GREAT_EDITORS[great.id];
  open?.(target, parent);
  return Boolean(open);
}

function onClick(event: MouseEvent): void {
  if (event?.target && !options.map.viewOnly) openEditor(event.target as Element);
}

/** Right-click on the map belongs to the context menu; Shift+right-click keeps the browser's own */
function onContextMenu(event: MouseEvent): void {
  if (event.shiftKey || customization || options.map.viewOnly) return;
  event.preventDefault();
  Controllers.ContextMenu.open(event);
}
