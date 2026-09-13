import { createRandom } from "./heightmap-hachures";

export interface CoastalWaveParams {
  width: number; // map size
  height: number;
  spacing: number; // cell spacing, the unit of every length below
  /** how many cells a point lies from the shore: 1 on the coastal water cell, growing seaward, 0 on land or in a lake */
  distanceAt: (x: number, y: number) => number;
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

/**
 * The engraver's sea: rows of short horizontal wave-dashes, packed against the shore and thinning
 * out to open water. The fade is driven by the distance from the coast, softened with noise so no
 * cell edges show. Returns one stroked path
 */
export function getCoastalWaves(params: CoastalWaveParams): string {
  const { width, height, spacing, distanceAt, density, length, reach, seed } = params;
  const random = createRandom(seed);
  const rowGap = (spacing * ROW_GAP) / density;
  const halfPeriod = (spacing * PERIOD) / 2;
  const amplitude = spacing * AMPLITUDE;
  const f = (v: number) => v.toFixed(2);
  const parts: string[] = [];

  for (let y = rowGap * random(); y < height; y += rowGap * (0.85 + random() * 0.3)) {
    let x = -random() * DASH * spacing;
    while (x < width) {
      // how close to the shore this dash is: 1 at the coast, 0 out of reach; noise blurs the rings
      const distance = distanceAt(Math.max(0, Math.min(width - 1, x + spacing)), y);
      const closeness = distance ? Math.max(0, 1 - (distance - 1 + random() * 1.5) / reach) : 0;
      const dash = DASH * length * spacing * (0.4 + 0.6 * random()) * (0.4 + 0.6 * closeness);
      if (closeness && random() < closeness) parts.push(wave(x, y, dash));
      // dashes crowd the shore and drift apart at sea
      x += dash + DASH_GAP * spacing * (0.5 + random()) * (1 + 3 * (1 - closeness));
    }
  }

  return parts.join("");

  /** a wavy dash: one quadratic half-wave, then smooth continuations */
  function wave(x: number, y: number, dash: number): string {
    const halves = Math.max(2, Math.round(dash / halfPeriod));
    const up = random() < 0.5 ? -1 : 1;
    let path = `M${f(x)},${f(y)}q${f(halfPeriod / 2)},${f(amplitude * up)} ${f(halfPeriod)},0`;
    for (let i = 1; i < halves; i++) path += `t${f(halfPeriod)},0`;
    return path;
  }
}
