// Traveler marker tweened along a hovered journey (or one of its segments), drawn on #debug
import { easeLinear, easeSinInOut, select } from "d3";
import type { Journey, JourneyPoint, JourneySegment } from "@/types/Journey";
import { getSegmentPathData } from "./draw-journeys";

const GROUP_ID = "journeyTravel";
const PX_PER_MS = 0.1;
const MIN_DURATION = 1000;
const MAX_DURATION = 20000;
const STAY_PAUSE = 1500;
const LOOP_PAUSE = 3000;

type Step = {
  color: string;
  duration: number;
} & ({ moving: true; d: string } | { moving: false; point: JourneyPoint });

let runId = 0;
let loopTimeout: number | undefined;

/** Play the journey travel on the map, looping until stopped. Pass a segment id to play a single segment */
export function startJourneyTravel(journeyId: number, segmentId?: number): void {
  stopJourneyTravel();

  const journey = pack.journeys?.find(({ i }) => i === journeyId);
  if (!journey) return;

  const steps = getSteps(journey, segmentId);
  if (steps.length) play(steps, runId);
}

export function stopJourneyTravel(): void {
  runId++;
  clearTimeout(loopTimeout);
  const group = select("#debug").select(`#${GROUP_ID}`);
  group.selectAll("*").interrupt();
  group.remove();
}

/**
 * Split the travel into animation steps: one per segment.
 * Moving segments share the travel time by their travel hours, so a slow leg takes visibly longer;
 * a stay is a short beat in place instead, so a long rest doesn't hold the whole animation
 */
function getSteps(journey: Journey, segmentId?: number): Step[] {
  const segments = journey.segments.filter(
    segment =>
      segment.visible !== false && segment.points.length && (segmentId === undefined || segment.i === segmentId)
  );

  if (!segments.length) return [];

  const isMoving = (segment: JourneySegment) => !Journeys.isStaySegment(segment) && segment.points.length > 1;
  const moving = segments.filter(isMoving);

  const hours = new Map(moving.map(segment => [segment, Journeys.getSegmentTime(segment) || segment.distance || 1]));
  const totalHours = moving.reduce((sum, segment) => sum + hours.get(segment)!, 0) || 1;
  const totalDistance = moving.reduce((sum, segment) => sum + segment.distance, 0); // px, kept in sync by the editor
  const totalDuration = Math.min(Math.max(totalDistance / PX_PER_MS, MIN_DURATION), MAX_DURATION);

  return segments.map(segment => {
    const color = segment.color || journey.color;
    if (!isMoving(segment)) return { moving: false, color, duration: STAY_PAUSE, point: segment.points[0] };
    return {
      moving: true,
      color,
      duration: (totalDuration * hours.get(segment)!) / totalHours,
      d: getSegmentPathData(segment)
    };
  });
}

function play(steps: Step[], id: number): void {
  const group = select("#debug").append("g").attr("id", GROUP_ID).attr("pointer-events", "none");

  const width = Number(styles.journeys.attrs["stroke-width"]) || 1.8;
  const radius = Math.max(width * 1.5, 4 / scale); // stays legible when the map is zoomed out
  const traveler = group.append("g");
  const halo = traveler
    .append("circle")
    .attr("r", radius * 2.2)
    .attr("opacity", 0.25);
  const marker = traveler
    .append("circle")
    .attr("r", radius)
    .attr("stroke", "#fff")
    .attr("stroke-width", radius / 3);

  runStep(0);

  function runStep(index: number): void {
    if (id !== runId) return;

    if (index === steps.length) {
      loopTimeout = window.setTimeout(() => {
        if (id !== runId) return;
        group.remove();
        play(steps, id);
      }, LOOP_PAUSE);
      return;
    }

    const step = steps[index];
    marker.attr("fill", step.color);
    halo.attr("fill", step.color);
    traveler.raise();

    if (!step.moving) {
      // a stay covers no ground: hold the traveler where it waits and pulse while the time passes
      traveler.attr("transform", `translate(${step.point[0]}, ${step.point[1]})`);
      halo
        .transition()
        .duration(step.duration / 2)
        .ease(easeSinInOut)
        .attr("r", radius * 3.5)
        .attr("opacity", 0.1)
        .transition()
        .duration(step.duration / 2)
        .ease(easeSinInOut)
        .attr("r", radius * 2.2)
        .attr("opacity", 0.25)
        .on("end", () => runStep(index + 1));
      return;
    }

    const trail = group
      .append("path")
      .attr("d", step.d)
      .attr("fill", "none")
      .attr("stroke", step.color)
      .attr("stroke-width", width * 2.2)
      .attr("stroke-linecap", "round")
      .attr("opacity", 0.6)
      .attr("filter", "url(#blur1)");

    const path = trail.node() as SVGPathElement;
    const length = path.getTotalLength();
    const start = path.getPointAtLength(0);
    traveler.attr("transform", `translate(${start.x}, ${start.y})`).raise();

    trail
      .attr("stroke-dasharray", `0,${length}`)
      .transition()
      .duration(step.duration)
      .ease(easeLinear)
      .attrTween("stroke-dasharray", () => t => `${t * length},${length}`);

    traveler
      .transition()
      .duration(step.duration)
      .ease(easeLinear)
      .attrTween("transform", () => t => {
        const point = path.getPointAtLength(t * length);
        return `translate(${point.x}, ${point.y})`;
      })
      .on("end", () => runStep(index + 1));
  }
}
