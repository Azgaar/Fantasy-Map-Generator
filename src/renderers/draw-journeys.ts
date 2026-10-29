import { curveCatmullRom, line } from "d3";
import type { Journey, JourneyPoint, JourneySegment } from "@/types/journey";
import { log } from "@/utils/logger";
import { ensureEl } from "@/utils/node-utils";
import { round } from "@/utils/string-utils";

export function drawJourneys(): void {
  log.time("drawJourneys");

  const journeys = (pack.journeys ?? []).filter(j => j.visible !== false);
  ensureEl("journeys").innerHTML = journeys.map(getJourneyPaths).join("");

  log.timeEnd("drawJourneys");
}

const curve = line<JourneyPoint>()
  .x(point => point[0])
  .y(point => point[1])
  .curve(curveCatmullRom.alpha(0.5));

/** The drawn path of a segment: the travel animation follows the same curve */
export function getSegmentPathData(segment: JourneySegment): string {
  return round(curve(segment.points) ?? "", 1);
}

function getJourneyPaths(journey: Journey): string {
  const arrowAttr = styles.journeys.options?.arrows ? ' marker-end="url(#journey-arrow)"' : "";
  const paths = journey.segments
    .filter(segment => segment.visible !== false && segment.points.length > 1)
    .map(segment => {
      const d = getSegmentPathData(segment);
      return /* html */ `<path id="segment${journey.i}_${segment.i}" d="${d}" stroke="${segment.color || journey.color}"${arrowAttr}/>`;
    })
    .join("");

  return /* html */ `<g id="journey${journey.i}">${paths}</g>`;
}
