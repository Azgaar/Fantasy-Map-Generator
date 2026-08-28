import { curveCatmullRom, line } from "d3";
import type { JouneySegment, Journey, JourneyPoint } from "@/types/Journey";
import { ensureEl, round } from "@/utils";

const curve = line<JourneyPoint>()
  .x(point => point[0])
  .y(point => point[1])
  .curve(curveCatmullRom.alpha(0.5));

/** Color a segment is drawn in: its own override if set, otherwise its journey's */
export function getSegmentColor(journey: Journey, segment: JouneySegment): string {
  return segment.color || journey.color;
}

export function drawJourneys(): void {
  TIME && console.time("drawJourneys");

  const journeys = (pack.journeys ?? []).filter(journey => journey.visible);
  ensureEl("journeys").innerHTML = journeys.map(getJourneyPaths).join("");

  TIME && console.timeEnd("drawJourneys");
}

/** Every path carries its own stroke: journeys own their color, the layer has none to give */
function getJourneyPaths(journey: Journey): string {
  const paths = journey.segments
    .filter(segment => segment.visible && segment.points.length > 1)
    .map(segment => {
      const d = round(curve(segment.points) ?? "", 1);
      return /* html */ `<path id="segment${journey.i}_${segment.id}" d="${d}" stroke="${getSegmentColor(journey, segment)}"/>`;
    })
    .join("");

  return /* html */ `<g id="journey${journey.i}">${paths}</g>`;
}
