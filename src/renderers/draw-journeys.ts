import { curveCatmullRom, line } from "d3";
import type { Journey, JourneyPoint } from "@/types/Journey";
import { ensureEl, round } from "@/utils";

/** Fallback stroke for custom style presets that predate the Journeys layer */
export const DEFAULT_JOURNEY_COLOR = "#8b1a1a";

const curve = line<JourneyPoint>()
  .x(point => point[0])
  .y(point => point[1])
  .curve(curveCatmullRom.alpha(0.5));

/** Colour a journey is drawn in: its own if set, otherwise the layer stroke it inherits */
export function getJourneyColor(journey: Journey): string {
  return journey.color || ensureEl("journeys").getAttribute("stroke") || DEFAULT_JOURNEY_COLOR;
}

export function drawJourneys(): void {
  TIME && console.time("drawJourneys");

  const journeys = (pack.journeys ?? []).filter(journey => journey.visible);
  ensureEl("journeys").innerHTML = journeys.map(getJourneyPaths).join("");

  TIME && console.timeEnd("drawJourneys");
}

/** Segments inherit the layer style; only an explicit colour is baked into the path */
function getJourneyPaths(journey: Journey): string {
  const paths = journey.segments
    .filter(segment => segment.visible && segment.points.length > 1)
    .map(segment => {
      const d = round(curve(segment.points) ?? "", 1);
      const color = segment.color || journey.color;
      const stroke = color ? ` stroke="${color}"` : "";
      return /* html */ `<path id="segment${journey.i}_${segment.id}" d="${d}"${stroke}/>`;
    })
    .join("");

  return /* html */ `<g id="journey${journey.i}">${paths}</g>`;
}
