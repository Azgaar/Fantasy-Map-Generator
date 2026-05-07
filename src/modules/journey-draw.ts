/**
 * Journey SVG rendering (#journeys): delegates geometry/style to sibling modules;
 * exposes Routes-like `window.Journey` API for legacy scripts.
 */
import type { Selection } from "d3";
import type { JourneyResolvedStopEntry, PackJourney } from "./journey-model";
import {
  buildJourneyResolutionContext,
  burgJourneyStopRef,
  emptyPackJourney,
  ensurePackJourneyNormalized,
  journeyLegToRefString,
  journeyRefStringToLeg,
  journeyResolvedCoordinates,
  journeyResolvedStopEntries,
  markerJourneyStopRef,
  normalizePackJourney,
  resolveJourneyLeg,
  resolveJourneyStopPosition,
} from "./journey-model";
import {
  arrowPositionsAlongPolyline,
  bendSegmentChord,
  chordGradientT,
  directedChordOccurrenceIndex,
  journeyArrowSpacingMapUnits,
  journeyLodTier,
  journeyPolylineSamplesForTier,
  laneMultipliersForSegments,
  MIN_SEG_LEN,
  polylineLength,
  polylinePath,
  quadraticSamples,
  segmentUInterval,
} from "./journey-path-geometry";
import {
  journeyRampSamplerForConfig,
  JOURNEY_STYLE_DEFAULTS,
  readJourneyStyleConfig,
} from "./journey-style-config";
import { rn } from "../utils/numberUtils";

export {
  JOURNEY_DEFAULT_SOLID_STROKE,
  JOURNEY_RAINBOW_STOPS,
  JOURNEY_STYLE_DEFAULTS,
  journeyRampColor,
  parseJourneyRainbowStops,
  readJourneyStyleConfig,
  journeyRampSamplerForConfig,
  type JourneyColorMode,
  type JourneyStyleConfig,
} from "./journey-style-config";

export {
  arrowPositionsAlongPolyline,
  bendSegmentChord,
  chordGradientT,
  chordKey,
  directedChordOccurrenceIndex,
  journeyArrowSpacingMapUnits,
  journeyArrowSpacingMulForTier,
  journeyLodTier,
  journeyPolylineSamplesForTier,
  laneMultipliersForSegments,
  segmentUInterval,
  type ArrowSample,
} from "./journey-path-geometry";

/** Arrowhead path (local coords before translate/rotate); 2× prior triangle size. */
const ARROW_PATH_D = "M0,-8.4 L22.5,0 L0,8.4 Z";

const JOURNEY_OUTLINE_FILTER_ID = "journeyUnifiedOutline";

function mapMetricScreenToWorld(
  screenPx: number,
  zoomScale: number,
  lo: number,
  hi: number,
): number {
  const k = Math.max(zoomScale, 1e-9);
  return Math.min(hi, Math.max(lo, screenPx / k));
}

function arrowTransform(
  x: number,
  y: number,
  angleDeg: number,
  zoomScale: number,
): string {
  const inv = rn(1 / Math.max(zoomScale, 1e-9), 6);
  return `translate(${rn(x, 2)},${rn(y, 2)}) rotate(${rn(angleDeg, 2)}) scale(${inv})`;
}

function ensureJourneyOutlineFilter(
  defs: Selection<SVGDefsElement, unknown, null, undefined>,
  morphologyRadiusMap: number,
  floodColor: string,
): void {
  defs.select(`filter#${JOURNEY_OUTLINE_FILTER_ID}`).remove();
  const f = defs
    .append("filter")
    .attr("id", JOURNEY_OUTLINE_FILTER_ID)
    .attr("class", "journey-outline-filter")
    .attr("color-interpolation-filters", "sRGB")
    .attr("x", "-50%")
    .attr("y", "-50%")
    .attr("width", "200%")
    .attr("height", "200%");

  f.append("feMorphology")
    .attr("in", "SourceAlpha")
    .attr("operator", "dilate")
    .attr("radius", rn(morphologyRadiusMap, 3))
    .attr("result", "dilatedAlpha");

  f.append("feFlood")
    .attr("flood-color", floodColor)
    .attr("result", "outlineFlood");

  f.append("feComposite")
    .attr("in", "outlineFlood")
    .attr("in2", "dilatedAlpha")
    .attr("operator", "in")
    .attr("result", "outlineShape");

  const merge = f.append("feMerge");
  merge.append("feMergeNode").attr("in", "outlineShape");
  merge.append("feMergeNode").attr("in", "SourceGraphic");
}

export class JourneyDrawModule {
  private lastLodTier: number | null = null;

  redraw(
    defs: Selection<SVGDefsElement, unknown, null, undefined>,
    journeys: Selection<SVGGElement, unknown, null, undefined>,
    zoomScale = 1,
    zoomMinForLod = 0.05,
  ): void {
    journeys.selectAll("*").remove();
    defs.selectAll("linearGradient.journey-def").remove();
    defs.select(`filter#${JOURNEY_OUTLINE_FILTER_ID}`).remove();

    if (!pack.journey) {
      this.lastLodTier = null;
      return;
    }
    ensurePackJourneyNormalized(pack);
    const journeyData = pack.journey as PackJourney;
    const resCtx = buildJourneyResolutionContext(pack.burgs ?? [], pack.markers ?? []);
    const resolvedStops = journeyResolvedStopEntries(journeyData, resCtx);
    if (!resolvedStops.length) {
      this.lastLodTier = null;
      return;
    }
    const points = resolvedStops.map((r: JourneyResolvedStopEntry) => r.coord);

    const zs = zoomScale;
    const zm = zoomMinForLod;

    const styleCfg = readJourneyStyleConfig(journeys.node());
    const rampAt = journeyRampSamplerForConfig(styleCfg);

    const verts = journeys.append("g").attr("class", "journey-vertices");

    const waypointR = mapMetricScreenToWorld(
      styleCfg.waypointRScreenPx,
      zs,
      0.15,
      80,
    );
    const waypointSw = mapMetricScreenToWorld(
      styleCfg.waypointRingScreenPx,
      zs,
      0.03,
      24,
    );

    const idsAtCoord = new Map<string, string[]>();
    for (const { leg, coord } of resolvedStops) {
      const sid = journeyLegToRefString(leg);
      const ck = `${rn(coord[0], 2)},${rn(coord[1], 2)}`;
      const arr = idsAtCoord.get(ck) ?? [];
      if (!arr.includes(sid)) arr.push(sid);
      idsAtCoord.set(ck, arr);
    }

    const seen = new Set<string>();
    for (const [x, y] of points) {
      const k = `${rn(x, 2)},${rn(y, 2)}`;
      if (seen.has(k)) continue;
      seen.add(k);
      const jidList = idsAtCoord.get(k);
      const circle = verts
        .append("circle")
        .attr("class", "journey-waypoint")
        .attr("data-jx", rn(x, 2))
        .attr("data-jy", rn(y, 2))
        .attr("cx", rn(x, 2))
        .attr("cy", rn(y, 2))
        .attr("r", rn(waypointR, 3))
        .attr("fill", styleCfg.waypointFill)
        .attr("stroke", styleCfg.waypointStroke)
        .attr("stroke-width", rn(waypointSw, 3))
        .style("cursor", "pointer");
      if (jidList?.length === 1) {
        circle.attr("data-journey-stop-ref", jidList[0]);
      }
    }

    const S = Math.max(0, points.length - 1);
    if (S < 1) {
      this.lastLodTier = journeyLodTier(zs, zm);
      return;
    }

    const tier = journeyLodTier(zs, zm);
    const samples = journeyPolylineSamplesForTier(tier);
    const arrowSpacing = journeyArrowSpacingMapUnits(zs, tier);
    const morphR = mapMetricScreenToWorld(
      styleCfg.outlineScreenPx,
      zs,
      0.35,
      40,
    );

    ensureJourneyOutlineFilter(defs, morphR, styleCfg.outlineColor);
    const segmentsRoot = journeys.append("g").attr("class", "journey-segments");

    const lanes = laneMultipliersForSegments(points);
    const repeats = directedChordOccurrenceIndex(points);

    const strokeW = mapMetricScreenToWorld(
      styleCfg.lineScreenPx,
      zs,
      0.06,
      24,
    );

    for (let i = 0; i < S; i++) {
      const a = points[i];
      const b = points[i + 1];
      const segLen = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (segLen < MIN_SEG_LEN) continue;

      const lane = lanes[i] ?? 0;
      const k = repeats[i] ?? 0;
      const bendAmount = bendSegmentChord(segLen, k);

      const samp = quadraticSamples(a, b, bendAmount, lane, samples);
      const d = polylinePath(samp);
      if (!d) continue;

      const [u0, u1] = segmentUInterval(S, i);
      const c0 = rampAt(u0);
      const c1 = rampAt(u1);

      const seg = segmentsRoot
        .append("g")
        .attr("class", "journey-segment")
        .attr("filter", `url(#${JOURNEY_OUTLINE_FILTER_ID})`);

      let strokeAttr: string;
      if (styleCfg.colorMode === "solid") {
        strokeAttr = styleCfg.solidStroke;
      } else {
        const gid = `journeyGrad_${i}`;
        const grad = defs
          .append("linearGradient")
          .attr("id", gid)
          .attr("class", "journey-def")
          .attr("gradientUnits", "userSpaceOnUse")
          .attr("x1", a[0])
          .attr("y1", a[1])
          .attr("x2", b[0])
          .attr("y2", b[1]);

        grad.append("stop").attr("offset", "0%").attr("stop-color", c0);
        grad.append("stop").attr("offset", "100%").attr("stop-color", c1);
        strokeAttr = `url(#${gid})`;
      }

      seg
        .append("path")
        .attr("class", "journey-segment-stroke")
        .attr("d", d)
        .attr("fill", "none")
        .attr("stroke", strokeAttr)
        .attr("stroke-width", rn(strokeW, 3))
        .attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round");

      let arrPts = arrowPositionsAlongPolyline(samp, arrowSpacing);
      if (!arrPts.length && polylineLength(samp) > MIN_SEG_LEN) {
        const mid = Math.max(1, Math.floor(samp.length / 2));
        const prev = mid - 1;
        const angleDeg =
          (Math.atan2(
            samp[mid][1] - samp[prev][1],
            samp[mid][0] - samp[prev][0],
          ) *
            180) /
          Math.PI;
        arrPts = [{ x: samp[mid][0], y: samp[mid][1], angleDeg }];
      }
      for (const ar of arrPts) {
        const gt = chordGradientT(a, b, ar.x, ar.y);
        const arrowColor = rampAt(u0 + gt * (u1 - u0));
        seg
          .append("path")
          .attr("class", "journey-arrow")
          .attr("d", ARROW_PATH_D)
          .attr("fill", arrowColor)
          .attr("data-ar-x", rn(ar.x, 2))
          .attr("data-ar-y", rn(ar.y, 2))
          .attr("data-ar-ang", rn(ar.angleDeg, 2))
          .attr("transform", arrowTransform(ar.x, ar.y, ar.angleDeg, zs));
      }
    }

    this.lastLodTier = tier;
  }

  syncZoom(
    defs: Selection<SVGDefsElement, unknown, null, undefined>,
    journeys: Selection<SVGGElement, unknown, null, undefined>,
    zoomScale = 1,
    zoomMinForLod = 0.05,
  ): void {
    if (!pack.journey) return;
    ensurePackJourneyNormalized(pack);
    const points = journeyResolvedCoordinates(
      pack.journey as PackJourney,
      buildJourneyResolutionContext(pack.burgs ?? [], pack.markers ?? []),
    );
    if (!points.length) return;

    const zs = zoomScale;
    const zm = zoomMinForLod;
    const tier = journeyLodTier(zs, zm);

    const S = Math.max(0, points.length - 1);
    if (S >= 1 && this.lastLodTier !== tier) {
      this.redraw(defs, journeys, zs, zm);
      return;
    }

    this.applyZoomSizing(defs, journeys, zs);
  }

  private applyZoomSizing(
    defs: Selection<SVGDefsElement, unknown, null, undefined>,
    journeys: Selection<SVGGElement, unknown, null, undefined>,
    zoomScale: number,
  ): void {
    const zs = Math.max(zoomScale, 1e-9);
    const styleCfg = readJourneyStyleConfig(journeys.node());

    const strokeW = mapMetricScreenToWorld(
      styleCfg.lineScreenPx,
      zs,
      0.06,
      24,
    );
    journeys
      .selectAll(".journey-segment-stroke")
      .attr("stroke-width", rn(strokeW, 3));

    const waypointR = mapMetricScreenToWorld(
      styleCfg.waypointRScreenPx,
      zs,
      0.15,
      80,
    );
    const waypointSw = mapMetricScreenToWorld(
      styleCfg.waypointRingScreenPx,
      zs,
      0.03,
      24,
    );
    journeys
      .selectAll(".journey-waypoint")
      .attr("r", rn(waypointR, 3))
      .attr("stroke-width", rn(waypointSw, 3));

    journeys.selectAll(".journey-arrow").each(function () {
      const el = this as SVGPathElement;
      const x = el.getAttribute("data-ar-x");
      const y = el.getAttribute("data-ar-y");
      const ang = el.getAttribute("data-ar-ang");
      if (x == null || y == null || ang == null) return;
      el.setAttribute("transform", arrowTransform(+x, +y, +ang, zoomScale));
    });

    const morphR = mapMetricScreenToWorld(
      styleCfg.outlineScreenPx,
      zs,
      0.35,
      40,
    );
    const filt = defs.select(`filter#${JOURNEY_OUTLINE_FILTER_ID}`);
    filt.select("feMorphology").attr("radius", rn(morphR, 3));
    filt.select("feFlood").attr("flood-color", styleCfg.outlineColor);
  }
}

/** Routes-like facade: pack helpers + style defaults for legacy UI scripts. */
export type JourneyGlobalApi = {
  STYLE_DEFAULTS: typeof JOURNEY_STYLE_DEFAULTS;
  ensurePackJourneyNormalized: typeof ensurePackJourneyNormalized;
  normalizePackJourney: typeof normalizePackJourney;
  journeyResolvedCoordinates: typeof journeyResolvedCoordinates;
  resolveJourneyStopPosition: typeof resolveJourneyStopPosition;
  resolveJourneyLeg: typeof resolveJourneyLeg;
  journeyRefStringToLeg: typeof journeyRefStringToLeg;
  emptyPackJourney: typeof emptyPackJourney;
  burgJourneyStopRef: typeof burgJourneyStopRef;
  markerJourneyStopRef: typeof markerJourneyStopRef;
  journeyLegToRefString: typeof journeyLegToRefString;
};

if (typeof window !== "undefined") {
  window.JourneyDraw = new JourneyDrawModule();
  const journeyApi: JourneyGlobalApi = {
    STYLE_DEFAULTS: JOURNEY_STYLE_DEFAULTS,
    ensurePackJourneyNormalized,
    normalizePackJourney,
    journeyResolvedCoordinates,
    resolveJourneyStopPosition,
    resolveJourneyLeg,
    journeyRefStringToLeg,
    emptyPackJourney,
    burgJourneyStopRef,
    markerJourneyStopRef,
    journeyLegToRefString,
  };
  window.Journey = journeyApi;
  window.JourneyPack = journeyApi;
}

declare global {
  var pack: import("../types/PackedGraph").PackedGraph;
  interface Window {
    JourneyDraw?: JourneyDrawModule;
    /** Journey pack helpers + defaults (Routes-style); prefer over `JourneyPack`. */
    Journey?: JourneyGlobalApi;
    /** @deprecated Use `Journey` */
    JourneyPack?: JourneyGlobalApi;
  }
}
