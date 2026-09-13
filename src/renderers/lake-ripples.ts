import type { Styles } from "@/generators/styles-schema";
import { createRandom } from "./heightmap-hachures";

export type LakeEmbellishment = Styles["lakes"]["freshwater"]["options"];

/** Fine shore ripples for lakes; a few open strokes for ponds. */
export function getLakeRipples(points: [number, number][], spacing: number, style: LakeEmbellishment, seed: string) {
  const xs = points.map(p => p[0]);
  const ys = points.map(p => p[1]);
  const x = Math.min(...xs),
    y = Math.min(...ys);
  const width = Math.max(...xs) - x,
    height = Math.max(...ys) - y;
  const unit = Math.max(1, Math.min(spacing, Math.min(width, height) / 4));
  const gap = Math.max(style.width, unit * style.halo);
  const bounds = { x, y, width, height, gap };
  if (
    points.length < 3 ||
    Math.min(width, height) < Math.max(spacing * 0.65, style.width * 8) ||
    style.embellishment === "none"
  ) {
    return { ...bounds, path: "" };
  }

  const random = createRandom(seed);
  if (Math.max(width, height) <= spacing * 4) {
    const rows = Math.max(2, Math.min(5, Math.round((height / spacing) * 1.5 * style.density)));
    const parts: string[] = [];
    for (let i = 0; i < rows; i++) {
      const row = y + height * (0.2 + ((i + 0.5) / rows) * 0.6);
      const spans = getWaterSpans(points, row);
      for (let j = 0; j + 1 < spans.length; j += 2) {
        const available = spans[j + 1] - spans[j] - gap * 2;
        const length = Math.min(available * (0.55 + random() * 0.2), spacing * style.length * 1.5);
        if (length < Math.max(spacing * 0.3, style.width * 6)) continue;
        const left = spans[j] + gap + (available - length) * (0.35 + random() * 0.3);
        const mark = `M${left.toFixed(2)},${row.toFixed(2)}`;
        const half = (length / 2).toFixed(2);
        parts.push(
          style.embellishment === "lines"
            ? `${mark}h${length.toFixed(2)}`
            : `${mark}q${(length / 4).toFixed(2)},${(length * 0.04).toFixed(2)} ${half},0t${half},0`
        );
      }
    }
    return { ...bounds, path: parts.join("") };
  }

  const rowGap = (unit * 0.32) / style.density;
  const amplitude = Math.min(unit * 0.045, rowGap * 0.2);
  const reach = unit * 3;
  const phase = random() * Math.PI * 2;
  const edges = points.map((a, i) => ({ a, b: points[(i + 1) % points.length] }));
  const parts: string[] = [];
  const f = (value: number) => value.toFixed(2);
  for (
    let row = y + gap + rowGap * (0.4 + random() * 0.4);
    row < y + height - gap;
    row += rowGap * (0.9 + random() * 0.2)
  ) {
    const crossings = getWaterSpans(points, row);
    const nearby = edges.filter(
      ({ a, b }) => row >= Math.min(a[1], b[1]) - reach && row <= Math.max(a[1], b[1]) + reach
    );
    for (let i = 0; i + 1 < crossings.length; i += 2) {
      const start = crossings[i] + gap;
      const end = crossings[i + 1] - gap;
      for (let left = start + unit * random() * 0.25; left < end; ) {
        const length = Math.min(unit * style.length * (1.8 + random() * 1.8), end - left);
        if (length < unit * 0.4) break;
        const midpoint = left + length / 2;
        let distance = Infinity;
        for (const { a, b } of nearby) {
          const dx = b[0] - a[0],
            dy = b[1] - a[1];
          const t = Math.max(0, Math.min(1, ((midpoint - a[0]) * dx + (row - a[1]) * dy) / (dx * dx + dy * dy || 1)));
          distance = Math.min(distance, Math.hypot(midpoint - a[0] - t * dx, row - a[1] - t * dy));
        }
        const fringe = reach * (0.75 + 0.15 * Math.sin((midpoint / unit) * 0.7 + (row / unit) * 0.4 + phase));
        if (distance < fringe && random() < Math.min(1, (1 - distance / fringe) * 2)) {
          const mark = `M${f(left)},${f(row)}`;
          if (style.embellishment === "lines") parts.push(`${mark}h${f(length)}`);
          else {
            const halves = Math.max(2, Math.round(length / (unit * 0.3)));
            const step = length / halves;
            const up = random() < 0.5 ? -1 : 1;
            parts.push(`${mark}q${f(step / 2)},${f(amplitude * up)} ${f(step)},0${`t${f(step)},0`.repeat(halves - 1)}`);
          }
        }
        left += length + unit * (0.15 + random() * 0.4);
      }
    }
  }
  return { ...bounds, path: parts.join("") };
}

function getWaterSpans(points: [number, number][], row: number): number[] {
  const crossings: number[] = [];
  for (let i = 0; i < points.length; i++) {
    const [ax, ay] = points[i];
    const [bx, by] = points[(i + 1) % points.length];
    if (ay > row !== by > row) crossings.push(ax + ((row - ay) * (bx - ax)) / (by - ay));
  }
  return crossings.sort((a, b) => a - b);
}
