import type { Journey, Segment } from "@/types/Journey";

export const DEFAULT_JOURNEY_COLOR = "#8b1a1a";

/** Off-road travel is slower than on-road — this factor is applied to the
 *  segment's base speed when `avoidRoads` is set (0.5 = half speed). */
export const OFF_ROAD_SPEED_FACTOR = 0.5;

/** Fallback when the hours-per-day setting isn't stored yet. */
export const DEFAULT_HOURS_PER_DAY = 8;

export const isStaySegment = (seg: Segment): boolean => seg.speed <= 0;

export const segmentLengthKm = (seg: Segment): number => (isStaySegment(seg) ? 0 : seg.distance * distanceScale);

export const effectiveSpeed = (seg: Segment): number => {
  if (!seg.speed || seg.speed <= 0) return 0;
  return seg.avoidRoads ? seg.speed * OFF_ROAD_SPEED_FACTOR : seg.speed;
};

export const segmentTimeHours = (seg: Segment): number => {
  if (isStaySegment(seg)) return Math.max(0, seg.duration ?? 0);
  const speed = effectiveSpeed(seg);
  if (speed <= 0) return 0;
  return segmentLengthKm(seg) / speed;
};

export interface JourneyTotals {
  totalKm: number;
  totalHours: number;
  avgSpeed: number;
}

export const journeyTotals = (journey: Journey): JourneyTotals => {
  let totalKm = 0;
  let totalHours = 0;
  let movingHours = 0;
  for (const seg of journey.segments) {
    const km = segmentLengthKm(seg);
    const hours = segmentTimeHours(seg);
    totalKm += km;
    totalHours += hours;
    if (!isStaySegment(seg)) movingHours += hours;
  }
  const avgSpeed = movingHours > 0 ? totalKm / movingHours : 0;
  return { totalKm, totalHours, avgSpeed };
};

/**
 * Format an hours value as e.g. "2d 3h 15m". Days are counted based on
 * `hoursPerDay` (default 8h — a realistic day of travel), so a 24-hour
 * journey with 8h/day reads as "3d" rather than "1d".
 */
export const formatTravelTime = (hours: number, hoursPerDay = DEFAULT_HOURS_PER_DAY): string => {
  if (!Number.isFinite(hours) || hours <= 0) return "0m";
  const perDay = hoursPerDay > 0 ? hoursPerDay : DEFAULT_HOURS_PER_DAY;
  const totalMinutes = Math.round(hours * 60);
  const minutesPerDay = perDay * 60;
  const days = Math.floor(totalMinutes / minutesPerDay);
  const rem1 = totalMinutes - days * minutesPerDay;
  const h = Math.floor(rem1 / 60);
  const m = rem1 - h * 60;
  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (h) parts.push(`${h}h`);
  if (m || parts.length === 0) parts.push(`${m}m`);
  return parts.join(" ");
};

declare global {
  var distanceScale: number;
}
