import { curveCatmullRom, hsl, line, select } from "d3";
import { DEFAULT_JOURNEY_COLOR } from "@/generators/journeys-generator";
import type { Journey, JourneyPoint } from "@/types/Journey";
import { round } from "@/utils";

const curveGen = line<JourneyPoint>()
  .x(d => d[0])
  .y(d => d[1])
  .curve(curveCatmullRom.alpha(0.5));

const DEFAULT_STROKE_WIDTH = 1.8;
const ENDPOINT_RADIUS_RATIO = 1.2;

/** Hue step between journeys that set no colour of their own — the golden angle spreads them evenly. */
const HUE_STEP = 137.508;

/** A grey layer stroke has no hue to rotate, so give derived colours some saturation to work with. */
const MIN_AUTO_SATURATION = 0.55;

/**
 * Which colour a journey's segments are drawn in.
 *   journey — one colour per journey, so journeys read apart on the map (the default)
 *   segment — per-segment overrides are honoured; set while the journey editor is open
 */
export type JourneyColorMode = "journey" | "segment";

let colorMode: JourneyColorMode = "journey";

export function setJourneyColorMode(mode: JourneyColorMode): void {
  if (colorMode === mode) return;
  colorMode = mode;
  drawJourneys();
}

/** The layer's effective stroke — the base every derived journey colour comes from. */
export function getJourneyLayerColor(): string {
  return select("#journeys").attr("stroke") || DEFAULT_JOURNEY_COLOR;
}

/**
 * The colour a journey is drawn in: its own if set, otherwise one derived from the
 * layer stroke by rotating the hue. The first journey keeps the layer colour exactly,
 * so the Style panel's stroke still seeds the whole set rather than being shadowed.
 */
export function getJourneyColor(journey: Journey, layerColor = getJourneyLayerColor()): string {
  if (journey.color) return journey.color;
  if (!journey.i) return layerColor;

  const derived = hsl(layerColor);
  if (Number.isNaN(derived.h)) derived.h = 0;
  if (derived.s < MIN_AUTO_SATURATION) derived.s = MIN_AUTO_SATURATION;
  derived.h = (derived.h + journey.i * HUE_STEP) % 360;
  return derived.formatHex();
}

/**
 * Paths carry geometry only — width, linecap and the arrow marker are inherited
 * from the `#journeys` group so the Style panel drives them. A path gets an explicit
 * `stroke` only where its colour differs from the layer's.
 *
 * Endpoint dots are filled, so they cannot inherit the layer stroke; their colour and
 * radius are baked from it and style.js redraws the layer when either changes.
 */
export function drawJourneys(): void {
  const root = select("#journeys");
  if (root.empty()) return;
  root.selectAll("*").remove();
  if (!pack.journeys?.length) return;

  const layerColor = getJourneyLayerColor();
  const strokeWidth = Number(root.attr("stroke-width")) || DEFAULT_STROKE_WIDTH;

  for (const journey of pack.journeys) {
    if (!journey.visible) continue;
    const journeyColor = getJourneyColor(journey, layerColor);
    const g = root.append<SVGGElement>("g").attr("id", `journey${journey.i}`);

    for (const seg of journey.segments) {
      if (!seg.visible || seg.points.length < 2) continue;
      const color = colorMode === "segment" && seg.color ? seg.color : journeyColor;

      const path = g
        .append("path")
        .attr("id", `segment${journey.i}_${seg.id}`)
        .attr("d", round(curveGen(seg.points) || "", 1));
      if (color !== layerColor) path.attr("stroke", color);

      const endpoints = g.append("g").attr("class", "journeyEndpoints");
      for (const [x, y] of [seg.points[0], seg.points[seg.points.length - 1]]) {
        endpoints
          .append("circle")
          .attr("cx", x)
          .attr("cy", y)
          .attr("r", strokeWidth * ENDPOINT_RADIUS_RATIO)
          .attr("fill", color)
          .attr("stroke", "#fff")
          .attr("stroke-width", 0.4);
      }
    }
  }
}

declare global {
  // biome-ignore lint/suspicious/noRedeclare: exposed on window for legacy JS
  var drawJourneys: () => void;
}
window.drawJourneys = drawJourneys;
