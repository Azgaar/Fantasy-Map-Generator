export type Point = [number, number];

export interface MeanderOptions {
  meandering?: number;
}

export function meander(
  points: Point[],
  options: MeanderOptions = {}
): Point[] {
  const meandering = options.meandering ?? 0.5;
  const n = points.length;
  if (n < 2) return points;

  const meandered: Point[] = [];
  const lastStep = n - 1;

  for (let i = 0; i <= lastStep; i++) {
    const [x1, y1] = points[i];
    meandered.push([x1, y1]);

    if (i === lastStep) break;

    const [x2, y2] = points[i + 1];
    const dist2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
    if (dist2 <= 25 && n >= 6) continue;

    // Apply meander displacement offset perpendicular to path segment
    const meanderVal = meandering + 1.0 / (i + 10) + Math.max(meandering - i / 100, 0);
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const sinMeander = Math.sin(angle) * meanderVal;
    const cosMeander = Math.cos(angle) * meanderVal;

    if (i < 20 && (dist2 > 64 || (dist2 > 36 && n < 5))) {
      const p1x = (x1 * 2 + x2) / 3 - sinMeander * 6;
      const p1y = (y1 * 2 + y2) / 3 + cosMeander * 6;
      const p2x = (x1 + x2 * 2) / 3 + sinMeander * 3;
      const p2y = (y1 + y2 * 2) / 3 - cosMeander * 3;
      meandered.push([p1x, p1y], [p2x, p2y]);
    } else if (dist2 > 25 || n < 6) {
      const p1x = (x1 + x2) / 2 - sinMeander * 6;
      const p1y = (y1 + y2) / 2 + cosMeander * 6;
      meandered.push([p1x, p1y]);
    }
  }

  return meandered;
}
