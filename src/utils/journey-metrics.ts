import type { Journey, Segment } from "@/types/Journey";

/** Off-road travel is slower than on-road — this factor is applied to the
 *  segment's base speed when `avoidRoads` is set (0.5 = half speed). */
export const OFF_ROAD_SPEED_FACTOR = 0.5;

export const segmentLengthKm = (seg: Segment): number => seg.distance * distanceScale;

export const effectiveSpeed = (seg: Segment): number => {
  if (!seg.speed || seg.speed <= 0) return 0;
  return seg.avoidRoads ? seg.speed * OFF_ROAD_SPEED_FACTOR : seg.speed;
};

export const segmentTimeHours = (seg: Segment): number => {
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
  for (const seg of journey.segments) {
    totalKm += segmentLengthKm(seg);
    totalHours += segmentTimeHours(seg);
  }
  const avgSpeed = totalHours > 0 ? totalKm / totalHours : 0;
  return { totalKm, totalHours, avgSpeed };
};

export const formatTravelTime = (hours: number): string => {
  if (!Number.isFinite(hours) || hours < 0) return "0m";
  const totalMinutes = Math.round(hours * 60);
  const days = Math.floor(totalMinutes / (60 * 24));
  const rem1 = totalMinutes - days * 60 * 24;
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
