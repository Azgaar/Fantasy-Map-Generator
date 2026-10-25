// Currents: the pure read of a river as a flow lane — its width from discharge, its course as a path
import type { Point } from "@/types/global";
import { rn } from "@/utils/numberUtils";

/** A clamped log ladder over discharge: a creek reads as a hairline, a continental river as a broad lane */
export function currentWidth(discharge: number): number {
  const flow = Number.isFinite(discharge) && discharge > 1 ? discharge : 1;
  const decades = Math.log10(flow) / 4; // 1 m³/s → 0, 10 000 m³/s → 1
  return rn(0.4 + 2.6 * Math.min(1, decades), 2);
}

/** The course as one polyline; a single point has no flow to draw */
export function currentPath(points: readonly Point[]): string {
  if (points.length < 2) return "";
  let path = `M${rn(points[0][0], 1)} ${rn(points[0][1], 1)}`;
  for (let i = 1; i < points.length; i++) path += `L${rn(points[i][0], 1)} ${rn(points[i][1], 1)}`;
  return path;
}
