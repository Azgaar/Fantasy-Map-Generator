import { type D3DragEvent, drag, type Selection, select } from "d3";
import { closeDialogs } from "@/components/dialog/dialog-helpers";
import { clearMainTip, tip } from "@/components/tooltips";
import { restoreDefaultEvents } from "@/components/viewbox-events";
import { type Measurer, Measurers, type MeasurerType } from "@/generators/measurers-generator";
import type { Point } from "@/generators/voronoi";
import { drawMeasurers, undrawMeasurers } from "@/renderers/draw-measurers";
import { highlightElement } from "@/renderers/overlays/highlight";
import { destroyDialogIfExists, ensureEl, getSegmentId, last, rn } from "../utils";

type MeasurerEl = Selection<SVGGElement, unknown, null, undefined>;
type MeasurerDragEvent<E extends Element = SVGGElement> = D3DragEvent<E, unknown, unknown>;

const rulerLayer = () => document.getElementById("ruler") as unknown as SVGGElement;
function measurerDrag<E extends Element>() {
  return drag<E, unknown>().container(rulerLayer);
}

function open(): void {
  if (customization) return;

  closeDialogs("#measurersEditor, .stable");
  if (!layerIsOn("toggleRulers")) toggleRulers();

  renderDialog();
  select("#ruler").classed("editable", true); // interactive cursor while the editor is open
  redraw();

  $("#measurersEditor").dialog({
    title: "Measurers Editor",
    resizable: false,
    position: { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" },
    close: onClose
  });
}

function renderDialog(): void {
  destroyDialogIfExists("measurersEditor");

  const html = /* html */ `<div id="measurersEditor" class="dialog">
    <div id="measurersBody" class="table" style="margin-bottom: 0.3em"></div>
    <div id="measurersBottom">
      <button id="addLinearRuler" data-tip="Click to place a linear measurer (ruler)" class="icon-ruler"></button>
      <button id="addOpisometer" data-tip="Drag to measure a curve length (opisometer)" class="icon-drafting-compass"></button>
      <button id="addRouteOpisometer" data-tip="Drag to measure a curve length that sticks to routes (route opisometer)">
        <svg width="0.88em" height="0.88em"><use xlink:href="#icon-route" /></svg>
      </button>
      <button id="addPlanimeter" data-tip="Drag to measure a polygon area (planimeter)" class="icon-draw-polygon"></button>
      <button id="removeMeasurers" data-tip="Remove all measurers from the map" class="icon-trash"></button>
    </div>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);

  ensureEl("measurersBody").on("click", onListClick);
  ensureEl("addLinearRuler").on("click", addRuler);
  ensureEl("addOpisometer").on("click", toggleOpisometerMode);
  ensureEl("addRouteOpisometer").on("click", toggleRouteOpisometerMode);
  ensureEl("addPlanimeter").on("click", togglePlanimeterMode);
  ensureEl("removeMeasurers").on("click", removeAllMeasurers);
}

function onClose(): void {
  if (ensureEl("measurersBottom").querySelector(".pressed")) exitDrawingMode();
  select("#ruler").classed("editable", false);
  if (layerIsOn("toggleRulers")) drawMeasurers();
  else undrawMeasurers();
  destroyDialogIfExists("measurersEditor");
}

// every data change goes through a full redraw
function redraw(): void {
  drawMeasurers();

  const groups = document.querySelectorAll<SVGGElement>("#ruler > g");
  groups.forEach((node, index) => {
    const measurer = pack.measurers[index];
    if (measurer) WIRERS[measurer.type](measurer, select(node));
  });

  const rows = pack.measurers.map((measurer, index) => {
    const value = groups[index]?.querySelector("text")?.textContent || "—";
    return /* html */ `<div class="states" data-index="${index}" style="display: flex; align-items: center; gap: 0.4em; padding: 1px 0.2em">
      <div style="width: 9em">${measurer.type}</div>
      <div style="width: 6em">${value}</div>
      <span data-tip="Zoom to the measurer" data-zoom class="icon-dot-circled pointer"></span>
      <span data-tip="Remove the measurer" data-remove class="icon-trash-empty pointer"></span>
    </div>`;
  });
  ensureEl("measurersBody").innerHTML = rows.join("");
}

function onListClick(event: Event): void {
  const target = event.target as HTMLElement;
  const row = target.closest<HTMLElement>("[data-index]");
  if (!row) return;
  const index = Number(row.dataset.index);
  const measurer = pack.measurers[index];
  if (!measurer) return;

  if (target.matches("[data-remove]")) {
    Measurers.remove(measurer);
    redraw();
  } else if (target.matches("[data-zoom]")) {
    const [x, y] = measurer.points[Math.floor(measurer.points.length / 2)];
    zoomTo(x, y, scale, 800);
    highlightElement(document.querySelectorAll("#ruler > g")[index], 2);
  }
}

function removeAllMeasurers(): void {
  if (!pack.measurers.length) return;
  alertMessage.innerHTML = /* html */ ` Are you sure you want to remove all placed measurers?
    <br />If you just want to hide them, toggle the Rulers layer off in Menu`;
  $("#alert").dialog({
    resizable: false,
    title: "Remove all measurers",
    buttons: {
      Remove: function (this: HTMLElement) {
        $(this).dialog("close");
        pack.measurers = [];
        redraw();
      },
      Cancel: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });
}

// measurer creation tools

function addRuler(): void {
  const width = Math.min(graphWidth, svgWidth);
  const height = Math.min(graphHeight, svgHeight);
  const svgEl = ensureEl<HTMLElement>("map") as unknown as SVGSVGElement;
  const pt = svgEl.createSVGPoint();
  pt.x = width / 2;
  pt.y = height / 4;
  const p = pt.matrixTransform((select("#viewbox").node() as SVGGraphicsElement).getScreenCTM()!.inverse());

  const dx = width / 4 / scale;
  const dy = (pack.measurers.length * 40) % (height / 2);
  Measurers.create("Ruler", [
    [(p.x - dx) | 0, (p.y + dy) | 0],
    [(p.x + dx) | 0, (p.y + dy) | 0]
  ]);
  redraw();
}

function toggleOpisometerMode(this: HTMLElement): void {
  startDrawingMode(this, "Draw a curve to measure length. Hold Shift to disallow path optimization", (event: any) => {
    const opisometer = Measurers.create("Opisometer", [[event.x, event.y]]);
    redraw();
    event.on("drag", (dragEvent: any) =>
      addPoint(opisometer, [dragEvent.x, dragEvent.y], dragEvent.sourceEvent.shiftKey)
    );
    event.on("end", (endEvent: any) => finishStroke(opisometer, 2, endEvent));
  });
}

function togglePlanimeterMode(this: HTMLElement): void {
  startDrawingMode(this, "Draw a curve to measure its area. Hold Shift to disallow path optimization", (event: any) => {
    const planimeter = Measurers.create("Planimeter", [[event.x, event.y]]);
    redraw();
    event.on("drag", (dragEvent: any) =>
      addPoint(planimeter, [dragEvent.x, dragEvent.y], dragEvent.sourceEvent.shiftKey)
    );
    event.on("end", (endEvent: any) => finishStroke(planimeter, 3, endEvent));
  });
}

function toggleRouteOpisometerMode(this: HTMLElement): void {
  const tipText = "Draw a curve along routes to measure length. Hold Shift to measure away from roads.";
  startDrawingMode(this, tipText, (event: any) => {
    const cell = findCell(event.x, event.y)!;
    if (!Routes.isConnected(cell) && !event.sourceEvent.shiftKey) {
      exitDrawingMode();
      tip("Must start in a cell with a route in it", false, "error");
      return;
    }

    const routeOpisometer = Measurers.create("RouteOpisometer", [getCellCoord(cell)]);
    redraw();
    event.on("drag", (dragEvent: any) => {
      const c = findCell(dragEvent.x, dragEvent.y)!;
      if (Routes.isConnected(c) || dragEvent.sourceEvent.shiftKey) trackCell(routeOpisometer, c, true);
    });
    event.on("end", () => finishStroke(routeOpisometer, 2));
  });
}

function startDrawingMode(button: HTMLElement, tipText: string, onStart: (event: any) => void): void {
  if (button.classList.contains("pressed")) {
    exitDrawingMode();
    return;
  }

  tip(tipText, true);
  exitPressedButtons();
  button.classList.add("pressed");
  select<SVGElement, unknown>("#viewbox")
    .style("cursor", "crosshair")
    .call(measurerDrag<SVGElement>().on("start", onStart));
}

function exitDrawingMode(): void {
  restoreDefaultEvents();
  clearMainTip();
  exitPressedButtons();
}

function exitPressedButtons(): void {
  ensureEl("measurersBottom")
    .querySelectorAll(".pressed")
    .forEach(button => {
      button.classList.remove("pressed");
    });
}

function finishStroke(measurer: Measurer, minPoints: number, endEvent?: any): void {
  exitDrawingMode();
  if (measurer.points.length < minPoints) {
    Measurers.remove(measurer);
    redraw();
  } else if (endEvent && !endEvent.sourceEvent.shiftKey) {
    optimizePoints(measurer);
  }
}

// point mutations

function addPoint(measurer: Measurer, point: Point, isShiftPressed = false): void {
  const MIN_DIST = isShiftPressed ? 9 : 100;
  const prev = last(measurer.points);
  const next: Point = [point[0] | 0, point[1] | 0];
  const dist2 = (prev[0] - next[0]) ** 2 + (prev[1] - next[1]) ** 2;
  if (dist2 < MIN_DIST) return;
  measurer.points.push(next);
  redraw();
}

function optimizePoints(measurer: Measurer): void {
  const MIN_DIST2 = 900;
  const optimized: Point[] = [];

  for (let i = 0, p1 = measurer.points[0]; i < measurer.points.length; i++) {
    const p2 = measurer.points[i];
    const dist2 = !i || i === measurer.points.length - 1 ? Infinity : (p2[0] - p1[0]) ** 2 + (p2[1] - p1[1]) ** 2;
    if (dist2 < MIN_DIST2) continue;
    optimized.push(p2);
    p1 = p2;
  }

  measurer.points = optimized;
  redraw();
}

function trackCell(measurer: Measurer, cell: number, right: boolean): void {
  // cell per point, derived on demand: points are cell/burg coordinates, so findCell restores them
  const cellStops = measurer.points.map(p => findCell(p[0], p[1])!);
  const foundIndex = cellStops.indexOf(cell);

  if (right) {
    if (last(cellStops) === cell) return;
    if (cellStops.length > 1 && foundIndex !== -1) measurer.points.splice(foundIndex + 1);
    else measurer.points.push(getCellCoord(cell));
  } else {
    if (cellStops[0] === cell) return;
    if (cellStops.length > 1 && foundIndex !== -1) measurer.points.splice(0, foundIndex);
    else measurer.points.unshift(getCellCoord(cell));
  }
  redraw();
}

function getCellCoord(cell: number): Point {
  const burg = pack.cells.burg[cell];
  if (burg) return [pack.burgs[burg].x, pack.burgs[burg].y];
  const [x, y] = pack.cells.p[cell];
  return [x, y];
}

// interaction wiring: user gestures → point mutations → redraw

const WIRERS: Record<MeasurerType, (measurer: Measurer, el: MeasurerEl) => void> = {
  Ruler: wireRuler,
  Opisometer: wireOpisometer,
  RouteOpisometer: wireRouteOpisometer,
  Planimeter: wirePlanimeter
};

function wireRuler(measurer: Measurer, el: MeasurerEl): void {
  wireTranslate(measurer, el);
  el.select<SVGPolylineElement>("polyline.white").call(
    measurerDrag<SVGPolylineElement>().on("start", (event: MeasurerDragEvent<SVGPolylineElement>) => {
      const pointId = getSegmentId(measurer.points, [rn(event.x, 1), rn(event.y, 1)]);
      measurer.points.splice(pointId, 0, [rn(event.x, 1), rn(event.y, 1)]);
      redraw();
      dragRulerPoint(measurer, event, pointId);
    })
  );
  el.select(".rulerPoints")
    .selectAll<SVGCircleElement, unknown>("circle")
    .each(function (_, pointId) {
      select(this)
        .on("click", () => removeRulerPoint(measurer, pointId))
        .call(
          measurerDrag<SVGCircleElement>()
            .clickDistance(3)
            .on("start", (event: MeasurerDragEvent<SVGCircleElement>) => dragRulerPoint(measurer, event, pointId))
        );
    });
}

function wireOpisometer(measurer: Measurer, el: MeasurerEl): void {
  wireTranslate(measurer, el);
  wireEndpoints(measurer, el, dragEndpoint);
}

function wireRouteOpisometer(measurer: Measurer, el: MeasurerEl): void {
  wireEndpoints(measurer, el, dragRouteEndpoint);
}

function wirePlanimeter(measurer: Measurer, el: MeasurerEl): void {
  wireTranslate(measurer, el);
}

// translate the whole measurer by shifting every point by the drag delta
function wireTranslate(measurer: Measurer, el: MeasurerEl): void {
  el.call(
    measurerDrag<SVGGElement>().on("start", (event: MeasurerDragEvent) => {
      event.on("drag", (dragEvent: MeasurerDragEvent) => {
        for (const point of measurer.points) {
          point[0] = rn(point[0] + dragEvent.dx, 1);
          point[1] = rn(point[1] + dragEvent.dy, 1);
        }
        redraw();
      });
    })
  );
}

type EndpointDragHandler = (measurer: Measurer, event: MeasurerDragEvent<SVGCircleElement>, right: boolean) => void;

function wireEndpoints(measurer: Measurer, el: MeasurerEl, handler: EndpointDragHandler): void {
  el.select<SVGCircleElement>(".rulerPoints > circle:first-child").call(
    measurerDrag<SVGCircleElement>().on("start", (event: MeasurerDragEvent<SVGCircleElement>) =>
      handler(measurer, event, false)
    )
  );
  el.select<SVGCircleElement>(".rulerPoints > circle:last-child").call(
    measurerDrag<SVGCircleElement>().on("start", (event: MeasurerDragEvent<SVGCircleElement>) =>
      handler(measurer, event, true)
    )
  );
}

function removeRulerPoint(measurer: Measurer, pointId: number): void {
  if (measurer.points.length < 3) return;
  measurer.points.splice(pointId, 1);
  redraw();
}

function dragRulerPoint<E extends Element>(measurer: Measurer, event: MeasurerDragEvent<E>, pointId: number): void {
  const isEdgePoint = pointId === 0 || pointId === measurer.points.length - 1;
  let addPointOnEdge = isEdgePoint && event.sourceEvent.ctrlKey;

  let x0 = rn(event.x, 1);
  let y0 = rn(event.y, 1);
  let axis: "x" | "y" | null = null;

  event.on("drag", (dragEvent: MeasurerDragEvent<E>) => {
    if (addPointOnEdge) {
      if (dragEvent.dx < 0.1 && dragEvent.dy < 0.1) return;
      const [x, y] = measurer.points[pointId];
      if (pointId) measurer.points.push([x, y]);
      else measurer.points.unshift([x, y]);
      if (pointId) pointId++;
      addPointOnEdge = false;
    }

    const shiftPressed = dragEvent.sourceEvent.shiftKey;
    if (shiftPressed && !axis) axis = Math.abs(dragEvent.dx) > Math.abs(dragEvent.dy) ? "x" : "y";

    const x = axis === "y" ? x0 : rn(dragEvent.x, 1);
    const y = axis === "x" ? y0 : rn(dragEvent.y, 1);

    if (!shiftPressed) {
      axis = null;
      x0 = x;
      y0 = y;
    }

    measurer.points[pointId] = [x, y];
    redraw();
  });
}

function dragEndpoint(measurer: Measurer, event: MeasurerDragEvent<SVGCircleElement>, right: boolean): void {
  const MIN_DIST = event.sourceEvent.shiftKey ? 9 : 100;

  event.on("drag", (dragEvent: MeasurerDragEvent<SVGCircleElement>) => {
    const point: Point = [dragEvent.x | 0, dragEvent.y | 0];
    const prev = right ? last(measurer.points) : measurer.points[0];
    const dist2 = (prev[0] - point[0]) ** 2 + (prev[1] - point[1]) ** 2;
    if (dist2 < MIN_DIST) return;

    if (right) measurer.points.push(point);
    else measurer.points.unshift(point);
    redraw();
  });

  event.on("end", (endEvent: MeasurerDragEvent<SVGCircleElement>) => {
    if (!endEvent.sourceEvent.shiftKey) optimizePoints(measurer);
  });
}

function dragRouteEndpoint(measurer: Measurer, event: MeasurerDragEvent<SVGCircleElement>, right: boolean): void {
  event.on("drag", (dragEvent: MeasurerDragEvent<SVGCircleElement>) => {
    const cell = findCell(dragEvent.x | 0, dragEvent.y | 0);
    if (cell === undefined) return;
    if (!Routes.isConnected(cell) && !dragEvent.sourceEvent.shiftKey) return;
    trackCell(measurer, cell, right);
  });
}

export const MeasurersEditor = { open };
