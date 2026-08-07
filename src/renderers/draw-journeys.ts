import { curveCatmullRom, line, select } from "d3";
import "@/data/transport-types"; // register getDefaultTransportTypes on window for legacy main.js
import type { Journey, JourneyPoint, Segment } from "@/types/Journey";
import { round } from "@/utils";

const curveGen = line<JourneyPoint>()
  .x(d => d[0])
  .y(d => d[1])
  .curve(curveCatmullRom.alpha(0.5));

const DEFAULT_STROKE_WIDTH = 1.8;
const DEFAULT_JOURNEY_COLOR = "#8b1a1a";

function getStyle(): { strokeWidth: number } {
  const el = document.getElementById("journeys");
  const strokeWidth = Number(el?.getAttribute("stroke-width")) || DEFAULT_STROKE_WIDTH;
  return { strokeWidth };
}

export function drawJourneys(): void {
  const root = select("#journeys");
  if (root.empty()) return;
  root.selectAll("*").remove();
  if (!pack.journeys?.length) return;

  const { strokeWidth } = getStyle();

  for (const journey of pack.journeys) {
    if (!journey.visible) continue;
    const jColor = journey.color || DEFAULT_JOURNEY_COLOR;
    const g = root.append<SVGGElement>("g").attr("id", `journey${journey.i}`).attr("fill", "none");

    for (const seg of journey.segments) {
      if (!seg.visible) continue;
      if (!seg.points || seg.points.length < 2) continue;
      const d = round(curveGen(seg.points) || "", 1);
      g.append("path")
        .attr("id", `segment${journey.i}_${seg.id}`)
        .attr("d", d)
        .attr("stroke", seg.color || jColor)
        .attr("stroke-width", strokeWidth)
        .attr("stroke-linecap", "round")
        .attr("marker-end", "url(#journey-arrow)");

      const [x1, y1] = seg.points[0];
      const [x2, y2] = seg.points[seg.points.length - 1];
      const endpoints = g.append("g").attr("class", "journeyEndpoints");
      endpoints
        .append("circle")
        .attr("cx", x1)
        .attr("cy", y1)
        .attr("r", strokeWidth * 1.2)
        .attr("fill", seg.color || jColor)
        .attr("stroke", "#fff")
        .attr("stroke-width", 0.4);
      endpoints
        .append("circle")
        .attr("cx", x2)
        .attr("cy", y2)
        .attr("r", strokeWidth * 1.2)
        .attr("fill", seg.color || jColor)
        .attr("stroke", "#fff")
        .attr("stroke-width", 0.4);
    }
  }

  ensureArrowMarker();
}

function ensureArrowMarker(): void {
  const defs = document.querySelector<SVGDefsElement>("svg defs");
  if (!defs || defs.querySelector("#journey-arrow")) return;
  const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
  marker.setAttribute("id", "journey-arrow");
  marker.setAttribute("viewBox", "0 0 10 10");
  marker.setAttribute("refX", "8");
  marker.setAttribute("refY", "5");
  marker.setAttribute("markerWidth", "5");
  marker.setAttribute("markerHeight", "5");
  marker.setAttribute("orient", "auto-start-reverse");
  marker.setAttribute("markerUnits", "strokeWidth");
  marker.innerHTML = '<path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke"/>';
  defs.appendChild(marker);
}

export function undrawJourneys(): void {
  select("#journeys").selectAll("*").remove();
}

export function redrawJourney(_journey: Journey): void {
  drawJourneys();
}

export function redrawSegment(_journey: Journey, _segment: Segment): void {
  drawJourneys();
}

declare global {
  // biome-ignore lint/suspicious/noRedeclare: exposed on window for legacy JS
  var drawJourneys: () => void;
}
window.drawJourneys = drawJourneys;
