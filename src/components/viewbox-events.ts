// Default interaction on the map canvas: pan/zoom, click-to-edit and hover tooltips
import { drag, select } from "d3";
import { Controllers } from "@/controllers";
import type { LabelType } from "@/generators/labels-generator";
import { dragLegendBox } from "@/renderers/draw-legend";
import { debounce } from "@/utils/commonUtils";
import { isMapPlacementActive } from "./map-placement";
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

// layer group id -> editor to open, resolved from the nearest matching ancestor of the click
// target. Depth varies by layer and by content — routes nest a type sub-group, megalopolis burgs
// an extra wrapper — so nothing here may count levels.
type Opener = (target: SVGElement, parent: SVGElement) => void;

const openBurgEditor: Opener = target => {
  const burgEl = target.closest<SVGElement>("[data-id]");
  if (burgEl) Controllers.BurgEditor.open(Number(burgEl.dataset.id));
};

const EDITORS: Record<string, Opener> = {
  rivers: target => Controllers.RiverEditor.open(target.id),
  ice: target => Controllers.IceEditor.open(target),
  terrain: target => Controllers.ReliefEditor.open(target),
  goodsCells: () => Controllers.GoodsEditor.open(),
  emblems: target => Controllers.EmblemsEditor.open(undefined, undefined, undefined, target),
  routes: target => Controllers.RouteEditor.open(target.id),
  journeys: (_target, parent) => Controllers.JourneyEditor.open(Number(parent.id.replace("journey", ""))),
  markers: target => Controllers.MarkersEditor.open(undefined, target),
  ruler: () => Controllers.MeasurersEditor.open(),
  goodsIcons: () => Controllers.GoodsEditor.open(),
  goodsBurgs: (_target, parent) => Controllers.ProductionOverview.open(Number(parent.dataset.id)),
  coastline: target => Controllers.CoastlineVertexEditor.open(target),
  lakes: target => Controllers.LakesEditor.open(target),
  markets: (target, parent) => {
    if (target.tagName !== "path") Controllers.MarketOverview.open(Number(parent.dataset.id));
  },
  armies: (_target, parent) => Controllers.RegimentEditor.open(`#${parent.id}`),
  burgLabels: openBurgEditor,
  burgIcons: openBurgEditor
};

const EDITOR_SELECTOR = Object.keys(EDITORS)
  .map(id => `#${id}`)
  .join(",");

/** Handle a click on the map: open the editor for the clicked element */
function onClick(event: MouseEvent): void {
  // An active tool mode (add burg, relocate, zone paint, ...) owns map clicks: its handler
  // replaces the #viewbox listener, but this default dispatcher stays bound on #viewboxTop
  // and would steal the click. `customization` guards legacy tool modes; `isMapPlacementActive()`
  // guards the newer toggleMapPlacement-based tools (add-burg, add-sky-burg, ...), which never
  // set `customization`.
  if (customization || isMapPlacementActive()) return;

  const target = event?.target as SVGElement | null;
  const parent = target?.parentElement as SVGElement | null;
  if (!target || !parent) return;

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

  const layer = parent.closest<SVGElement>(EDITOR_SELECTOR);
  if (layer) EDITORS[layer.id](target, parent);
}

window.applyDefaultViewboxEvents = applyDefaultViewboxEvents;
