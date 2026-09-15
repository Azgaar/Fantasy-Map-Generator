import Alea from "alea";
import type { Styles } from "@/generators/styles-schema";
import { wavyDash } from "@/utils/pathUtils";

export interface CoastalWaveParams {
  width: number;
  height: number;
  spacing: number; // cell spacing, the unit of every length below
  /** how many cells a point lies from the shore: 1 on the coastal water cell, growing seaward, 0 on land or in a lake */
  distanceAt: (x: number, y: number) => number;
  type?: Styles["ocean"]["oceanWaves"]["options"]["type"];
  density: number; // rows of dashes, relative to the default
  length: number; // dash length, relative to the default
  reach: number; // cells from the shore over which the dashes thin out to nothing
  seed: string;
}

const ROW_GAP = 0.4; // between rows of dashes at density 1, in cell spacings
const DASH = 2.5; // dash length at length 1 next to the shore, in cell spacings
const DASH_GAP = 0.5; // between dashes along a row next to the shore, in cell spacings
const PERIOD = 0.5; // wave length, in cell spacings
const AMPLITUDE = 0.06; // wave height, in cell spacings

/** Coastal dashes and a distant wave field surround a clear offshore band. */
export function getCoastalWaves(params: CoastalWaveParams): string {
  const { width, height, spacing, distanceAt, density, length, reach, seed, type = "waves" } = params;
  const random = Alea(seed);
  const rowGap = (spacing * ROW_GAP) / density;
  const halfPeriod = (spacing * PERIOD) / 2;
  const amplitude = Math.min(spacing * AMPLITUDE, rowGap * 0.3);
  const f = (v: number) => v.toFixed(2);
  const parts: string[] = [];
  const mark = (x: number, y: number, dash: number): string => {
    const up = random() < 0.5 ? -1 : 1;
    if (type === "lines") return `M${f(x)},${f(y)}h${f(dash)}`;
    const halves = Math.max(2, Math.round(dash / halfPeriod)); // whole half-periods, so the dash ends on the axis
    return wavyDash(x, y, halves * halfPeriod, halves, amplitude * up);
  };

  for (let y = rowGap * random(); y < height; y += rowGap * (0.85 + random() * 0.3)) {
    let x = -random() * DASH * spacing;
    while (x < width) {
      // Distant water resumes the wave field around the continents, independent of map edges.
      const sampleX = Math.max(0, Math.min(width, x + spacing));
      const coastDistance = distanceAt(sampleX, y);
      const distance = coastDistance > reach * 2 + 1 ? 1 : coastDistance;
      const closeness = distance ? Math.max(0, 1 - (distance - 1 + random() * 1.5) / reach) : 0;
      const dash = DASH * length * spacing * (0.4 + 0.6 * random()) * (0.4 + 0.6 * closeness);
      if (closeness && random() < closeness) parts.push(mark(x, y, dash));
      // dashes crowd the shore and drift apart at sea
      x += dash + DASH_GAP * spacing * (0.5 + random()) * (1 + 3 * (1 - closeness));
    }
  }

  return parts.join("");
}

/** Cells from the shore per water cell: 1 on the coastal ring, 0 on land and beyond `reach`. Not cells.t: it stops at 9 and is saved */
export function getCoastalDistances(heights: ArrayLike<number>, neighbors: number[][], reach: number): Uint8Array {
  const distances = new Uint8Array(heights.length);
  const limit = Math.ceil(reach) + 1;
  const queue: number[] = [];
  for (let cell = 0; cell < heights.length; cell++) {
    if (heights[cell] >= 20 || !neighbors[cell].some(next => heights[next] >= 20)) continue;
    distances[cell] = 1;
    queue.push(cell);
  }
  for (let index = 0; index < queue.length; index++) {
    const cell = queue[index];
    if (distances[cell] >= limit) continue;
    for (const next of neighbors[cell]) {
      if (heights[next] >= 20 || distances[next]) continue;
      distances[next] = distances[cell] + 1;
      queue.push(next);
    }
  }
  return distances;
}
