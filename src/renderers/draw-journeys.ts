import { curveCatmullRom, line } from "d3";
import type { Journey, JourneyPoint } from "@/types/Journey";
import { ensureEl, round } from "@/utils";

const curve = line<JourneyPoint>()
  .x(point => point[0])
  .y(point => point[1])
  .curve(curveCatmullRom.alpha(0.5));

export function drawJourneys(): void {
  TIME && console.time("drawJourneys");

  const journeys = (pack.journeys ?? []).filter(j => j.visible !== false);
  ensureEl("journeys").innerHTML = journeys.map(getJourneyPaths).join("");

  TIME && console.timeEnd("drawJourneys");
}

function getJourneyPaths(journey: Journey): string {
  const paths = journey.segments
    .filter(segment => segment.visible !== false && segment.points.length > 1)
    .map(segment => {
      const d = round(curve(segment.points) ?? "", 1);
      return /* html */ `<path id="segment${journey.i}_${segment.id}" d="${d}" stroke="${segment.color || journey.color}"/>`;
    })
    .join("");

  return /* html */ `<g id="journey${journey.i}">${paths}</g>`;
}
