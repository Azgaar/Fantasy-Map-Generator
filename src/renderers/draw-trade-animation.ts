import type { Point } from "../generators/voronoi";
import type { TradeBatch } from "./trade-animation";

export type TradeMarkerType = "land" | "water";

export interface TradeAnimationMarker {
  angle: number;
  batch: TradeBatch;
  id: number;
  size: number;
  type: TradeMarkerType;
  x: number;
  y: number;
}

export interface TradeAnimationSnapshot {
  highlight: readonly Point[] | null;
  markers: readonly TradeAnimationMarker[];
}

interface TradeAnimationOptions {
  duration: number;
  landDurationModifier: number;
  markerSize: number;
  segmentChangePause: number;
}

interface SegmentState {
  cumulativeLengths: number[];
  length: number;
  points: Point[];
  type: TradeMarkerType;
}

interface AnimationState {
  batch: TradeBatch;
  cancelled?: () => boolean;
  id: number;
  onComplete?: () => void;
  options: TradeAnimationOptions;
  segmentIndex: number;
  segmentStartedAt: number | null;
  segments: SegmentState[];
}

type Listener = (snapshot: TradeAnimationSnapshot) => void;

const animations = new Map<number, AnimationState>();
const listeners = new Set<Listener>();
let frameId: number | null = null;
let highlightPoints: readonly Point[] | null = null;
let nextId = 1;

export function draw(
  batch: TradeBatch,
  segments: { type: TradeMarkerType; points: Point[] }[],
  onComplete?: () => void,
  isCancelled?: () => boolean
): void {
  const prepared = segments.map(prepareSegment).filter(segment => segment.length > 0);
  if (!prepared.length) {
    onComplete?.();
    return;
  }
  const animation: AnimationState = {
    batch,
    cancelled: isCancelled,
    id: nextId++,
    onComplete,
    options: {
      duration: options.trade.animation.duration,
      landDurationModifier: options.trade.animation.landDurationModifier,
      markerSize: options.trade.animation.markerSize,
      segmentChangePause: options.trade.animation.segmentChangePause
    },
    segmentIndex: 0,
    segmentStartedAt: null,
    segments: prepared
  };
  animations.set(animation.id, animation);
  ensureFrame();
}

export function clear(): void {
  animations.clear();
  if (frameId !== null) cancelAnimationFrame(frameId);
  frameId = null;
  emit([]);
}

export function highlight(points: Point[]): void {
  highlightPoints = points.map(([x, y]) => [x, y] as Point);
  emit(getCurrentMarkers(performance.now()));
}

export function clearHighlight(): void {
  highlightPoints = null;
  emit(getCurrentMarkers(performance.now()));
}

export function subscribeTradeAnimation(listener: Listener): () => void {
  listeners.add(listener);
  listener({ highlight: highlightPoints, markers: [] });
  return () => listeners.delete(listener);
}

function ensureFrame(): void {
  if (frameId !== null || !animations.size) return;
  frameId = requestAnimationFrame(tick);
}

function tick(now: number): void {
  frameId = null;
  emit(getCurrentMarkers(now));
  ensureFrame();
}

function getCurrentMarkers(now: number): TradeAnimationMarker[] {
  const markers: TradeAnimationMarker[] = [];
  const completed: AnimationState[] = [];

  for (const animation of animations.values()) {
    if (animation.cancelled?.()) {
      animations.delete(animation.id);
      continue;
    }
    animation.segmentStartedAt ??= now;
    const segment = animation.segments[animation.segmentIndex];
    const duration =
      segment.length *
      animation.options.duration *
      (segment.type === "land" ? animation.options.landDurationModifier : 1);
    const elapsed = now - animation.segmentStartedAt;
    const progress = Math.min(1, Math.max(0, elapsed / Math.max(duration, 1)));
    const position = sampleSegment(segment, progress);
    markers.push({
      ...position,
      batch: animation.batch,
      id: animation.id,
      size: animation.options.markerSize,
      type: segment.type
    });

    if (progress < 1) continue;
    const nextStart = animation.segmentStartedAt + duration + animation.options.segmentChangePause;
    if (animation.segmentIndex + 1 < animation.segments.length) {
      if (now >= nextStart) {
        animation.segmentIndex++;
        animation.segmentStartedAt = nextStart;
      }
      continue;
    }
    if (now >= nextStart) {
      markers.pop();
      completed.push(animation);
    }
  }

  for (const animation of completed) {
    animations.delete(animation.id);
    animation.onComplete?.();
  }
  return markers;
}

function prepareSegment(segment: { type: TradeMarkerType; points: Point[] }): SegmentState {
  const cumulativeLengths = [0];
  let length = 0;
  for (let index = 1; index < segment.points.length; index++) {
    length += Math.hypot(
      segment.points[index][0] - segment.points[index - 1][0],
      segment.points[index][1] - segment.points[index - 1][1]
    );
    cumulativeLengths.push(length);
  }
  return { cumulativeLengths, length, points: segment.points, type: segment.type };
}

function sampleSegment(segment: SegmentState, progress: number): { angle: number; x: number; y: number } {
  const target = segment.length * progress;
  let index = 1;
  while (index < segment.cumulativeLengths.length - 1 && segment.cumulativeLengths[index] < target) index++;
  const start = segment.points[index - 1];
  const end = segment.points[index] ?? start;
  const span = segment.cumulativeLengths[index] - segment.cumulativeLengths[index - 1];
  const localProgress = span > 0 ? (target - segment.cumulativeLengths[index - 1]) / span : 0;
  return {
    angle: Math.atan2(end[1] - start[1], end[0] - start[0]),
    x: start[0] + (end[0] - start[0]) * localProgress,
    y: start[1] + (end[1] - start[1]) * localProgress
  };
}

function emit(markers: readonly TradeAnimationMarker[]): void {
  const snapshot = { highlight: highlightPoints, markers };
  for (const listener of listeners) listener(snapshot);
}
