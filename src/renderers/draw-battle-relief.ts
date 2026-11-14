// The lie of a battle field: hachures or fringed contours, a soft shadow and the heights of tops and hollows.
// Every part is drawn at once in its own group; the battle look shows the chosen ones. See docs/domain/battles.md

import { contours } from "d3";
import { COLS, ROWS } from "@/model/political/battle/battle-scale";
import type { Battlefield } from "@/model/political/battle/battlefield";
import { getHeightUnitRatio } from "@/model/units";
import { getContourLabels } from "@/renderers/heightmap/heightmap-contours";
import type { Point } from "@/types/global";
import { rn } from "@/utils/number-utils";

const SAMPLES = 400; // the surface is sampled so many times across the field, whatever its size
const PAD = 2; // samples added round the field, so lines run off it instead of closing at its edge
const STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]; // contour intervals, in the map's height unit
const MOST_LINES = 12; // the finest interval that draws no more lines over the field's rise
const MOST_ROWS = 24; // and no more rows of hachures, so the strokes stay short
const INDEX_EVERY = 5; // every fifth line is an index line, labelled
const MOST_LABELS = 14;
const INK = "#6c645a";
const HACHURE_SLOPE = [0.004, 0.02]; // gentler ground draws no hachure: a share of the field's steep slope, within these
const SHADOW = 0.18; // the darkest shadow's opacity
const SHADED_SLOPE = 0.3; // the field's steep slope is shaded as if it were this steep, so a gentle field's hills show
const TOP_RADIUS = 6; // nodes each way a top is the highest within
const TOP_RISE = [0.4, 0.2]; // a top stands this share of the field's most prominent one above its surroundings, and so many metres at least
const MOST_TOPS = 5;
const MOST_HOLLOWS = 3;

interface Surface {
  step: number; // metres between samples
  cols: number;
  rows: number;
  z: Float32Array; // metres above the field's lowest node
  gx: Float32Array; // rise over run, east
  gy: Float32Array; // rise over run, south
  steep: number; // the slope only a twentieth of the field is steeper than
}

interface Level {
  value: number; // in the map's height unit above sea level
  interval: number; // to the next level, in the same unit
  index: boolean;
  rings: Point[][]; // closed, in field metres
}

/** The relief groups, each shown or hidden by the battle look */
export function getReliefMarkup(field: Battlefield, halo: string): string {
  if (!field.relief) return "";
  const pt = field.width / 1000;
  const surface = getSurface(field);
  const ratio = getHeightUnitRatio();
  const levels = getLevels(field, surface, ratio, MOST_LINES);
  return /* html */ `<g class="battleShade">${getShade(field, surface)}</g>
    <g class="battleHachures">${getHachures(surface, getLevels(field, surface, ratio, MOST_ROWS), ratio, pt)}</g>
    <g class="battleContours">${getContours(field, levels, surface, pt)}</g>
    <g class="battleContourLabels" fill="${INK}" stroke="${halo}" stroke-width="${3 * pt}" stroke-linejoin="round"
      paint-order="stroke" font-size="${9 * pt}" font-family="Georgia, serif" text-anchor="middle">${getLevelLabels(field, levels, surface, pt)}</g>
    <g class="battleHeights" fill="${INK}" stroke="${halo}" stroke-width="${3 * pt}" stroke-linejoin="round"
      paint-order="stroke" font-size="${10 * pt}" font-family="Georgia, serif">${getHeightMarks(field, ratio, pt)}</g>`;
}

/** Hachures: strokes from each level down the fall line toward the next, thicker where steeper */
function getHachures(
  { step, z, gx, gy, cols, rows, steep }: Surface,
  levels: Level[],
  ratio: number,
  pt: number
): string {
  if (!levels.length) return "";
  const drop = levels[0].interval / ratio;
  const least = Math.min(Math.max(steep * 0.35, HACHURE_SLOPE[0]), HACHURE_SLOPE[1]);
  const at = (x: number, y: number): number =>
    Math.min(Math.max(Math.floor(y / step), 0), rows - 1) * cols +
    Math.min(Math.max(Math.floor(x / step), 0), cols - 1);
  const widths = [0.22, 0.32, 0.42, 0.52]; // in points, by slope
  const strokes: string[][] = widths.map(() => []);
  for (const { rings } of levels) {
    walk(rings, 4 * pt, (x0, y0) => {
      const i0 = at(x0, y0);
      const slope = Math.hypot(gx[i0], gy[i0]);
      if (slope < least) return;
      let [x, y] = [x0, y0];
      for (let k = 0; k < 30; k++) {
        const i = at(x, y);
        const s = Math.hypot(gx[i], gy[i]);
        if (s < least * 0.8 || z[i0] - z[i] > drop * 0.8) break;
        x -= (gx[i] / s) * step;
        y -= (gy[i] / s) * step;
      }
      if (Math.hypot(x - x0, y - y0) < pt) return;
      const bucket = Math.min(Math.floor(((slope - least) / 0.15) * widths.length), widths.length - 1);
      strokes[bucket].push(`M${Math.round(x0)} ${Math.round(y0)}L${Math.round(x)} ${Math.round(y)}`); // a metre is fine enough
    });
  }
  return `<g fill="none" stroke="${INK}" stroke-linecap="round" opacity="0.5">${strokes
    .map((list, k) => (list.length ? `<path d="${list.join("")}" stroke-width="${widths[k] * pt}"/>` : ""))
    .join("")}</g>`;
}

/** Hairline contours with a fringe of short ticks on their downhill side */
function getContours(field: Battlefield, levels: Level[], { step, gx, gy, cols, rows }: Surface, pt: number): string {
  const lines = levels.map(
    ({ rings, index }) => `<path d="${toPath(rings)}" stroke-width="${(index ? 0.66 : 0.33) * pt}"/>`
  );
  const length = 3.3 * pt;
  const ticks: string[] = [];
  for (const { rings } of levels) {
    walk(rings, 9 * pt, (x, y) => {
      if (x < 0 || y < 0 || x > field.width || y > field.height) return;
      const i = Math.min(Math.floor(y / step), rows - 1) * cols + Math.min(Math.floor(x / step), cols - 1);
      const slope = Math.hypot(gx[i], gy[i]);
      if (slope < 0.002) return;
      ticks.push(`M${rn(x, 1)} ${rn(y, 1)}l${rn((-gx[i] / slope) * length, 1)} ${rn((-gy[i] / slope) * length, 1)}`);
    });
  }
  return `<g fill="none" stroke="${INK}" stroke-linejoin="round" opacity="0.45">${lines.join("")}</g>
    <path d="${ticks.join("")}" fill="none" stroke="${INK}" stroke-width="${0.44 * pt}" stroke-linecap="round" opacity="0.45"/>`;
}

/** Labels along the index lines, or along every line where fewer than two index lines cross the field */
function getLevelLabels(field: Battlefield, levels: Level[], surface: Surface, pt: number): string {
  const indexed = levels.filter(level => level.index).length >= 2;
  const labelled = levels.map(({ value, index }) => ({ height: value, value, major: indexed ? index : true }));

  // the stretches within the field, away from its edge
  const margin = 20 * pt;
  const inside = ([x, y]: Point) => x > margin && y > margin && x < field.width - margin && y < field.height - margin;
  const chains = levels.flatMap(({ value, rings }) =>
    rings.flatMap(ring => {
      const runs: Point[][] = [[]];
      for (const point of ring) {
        if (inside(point)) runs.at(-1)!.push(point);
        else if (runs.at(-1)!.length) runs.push([]);
      }
      const closed = runs.length === 1 && runs[0].length === ring.length;
      return runs.filter(run => run.length > 1).map(points => ({ height: value, closed, points }));
    })
  );
  const size = 9 * pt;
  return getContourLabels(chains, labelled, {
    size,
    spacing: size * (indexed ? 36 : 54), // every line labelled: further apart
    heightAt: (x, y) => heightAt(surface, x, y),
    probe: field.cell
  })
    .slice(0, MOST_LABELS) // the longest lines are labelled first
    .map(
      ({ x, y, angle, text }) =>
        `<text transform="translate(${rn(x, 1)} ${rn(y, 1)}) rotate(${Math.round(angle)})" dy="0.35em">${text}</text>`
    )
    .join("");
}

/** Tops and hollows: ▲ on the highest node of a hill, ▽ in the lowest of a hollow, each with its height */
function getHeightMarks(field: Battlefield, ratio: number, pt: number): string {
  const ground = getGround(field);
  // height over the mean of the nodes about it
  const relative = ground.map((z, i) => {
    const [col, row] = [i % COLS, Math.floor(i / COLS)];
    let sum = 0;
    let count = 0;
    for (let r = Math.max(row - 7, 0); r <= Math.min(row + 7, ROWS - 1); r++) {
      for (let c = Math.max(col - 7, 0); c <= Math.min(col + 7, COLS - 1); c++) {
        sum += ground[r * COLS + c];
        count++;
      }
    }
    return z - sum / count;
  });
  const isExtreme = (i: number, sign: number): boolean => {
    const [col, row] = [i % COLS, Math.floor(i / COLS)];
    for (let r = row - TOP_RADIUS; r <= row + TOP_RADIUS; r++) {
      for (let c = col - TOP_RADIUS; c <= col + TOP_RADIUS; c++) {
        if (r < 0 || c < 0 || r >= ROWS || c >= COLS || (r === row && c === col)) continue;
        const other = r * COLS + c;
        // level ground counts once: the first node of it wins
        if ((ground[other] - ground[i]) * sign > 0 || (ground[other] === ground[i] && other < i)) return false;
      }
    }
    return true;
  };
  // the shore is the lowest land, not a hollow
  const nearWater = (i: number): boolean => {
    const [col, row] = [i % COLS, Math.floor(i / COLS)];
    for (let r = Math.max(row - 3, 0); r <= Math.min(row + 3, ROWS - 1); r++) {
      for (let c = Math.max(col - 3, 0); c <= Math.min(col + 3, COLS - 1); c++)
        if (field.water[r * COLS + c] === 1) return true;
    }
    return false;
  };
  const pick = (sign: number, most: number): number[] => {
    const rise = Math.max(Math.max(...relative.map(r => r * sign)) * TOP_RISE[0], TOP_RISE[1]);
    const found: number[] = [];
    ground.forEach((_, i) => {
      const [col, row] = [i % COLS, Math.floor(i / COLS)];
      if (col < 3 || row < 3 || col >= COLS - 3 || row >= ROWS - 3) return; // an edge is a slope running off the field
      if (field.water[i] || relative[i] * sign < rise || nearWater(i)) return;
      if (isExtreme(i, sign)) found.push(i);
    });
    return found.sort((a, b) => (relative[b] - relative[a]) * sign).slice(0, most);
  };

  const mark = (i: number, top: boolean): string => {
    const [x, y] = [((i % COLS) + 0.5) * field.cell, (Math.floor(i / COLS) + 0.5) * field.cell];
    const [h, w] = [5 * pt, 4.4 * pt];
    const sign = top
      ? `<path d="M0 ${-h * 0.62}L${w} ${h * 0.38}H${-w}Z" stroke="none"/>`
      : `<path d="M0 ${h * 0.62}L${w} ${-h * 0.38}H${-w}Z" fill="none" stroke="${INK}" stroke-width="${0.8 * pt}" paint-order="normal"/>`;
    const height = Math.round((field.base + ground[i]) * ratio);
    return `<g transform="translate(${rn(x, 1)} ${rn(y, 1)})">${sign}<text x="${7 * pt}" dy="0.35em">${height}</text></g>`;
  };
  return [...pick(1, MOST_TOPS).map(i => mark(i, true)), ...pick(-1, MOST_HOLLOWS).map(i => mark(i, false))].join("");
}

/** A soft grey on the slopes turned from the north-west light; gentle fields are exaggerated more, so their hills show */
function getShade(field: Battlefield, { cols, rows, gx, gy, steep }: Surface): string {
  const canvas = document.createElement("canvas");
  canvas.width = cols;
  canvas.height = rows;
  const context = canvas.getContext("2d");
  if (!context) return "";

  const exaggeration = Math.min(Math.max(SHADED_SLOPE / steep, 2), 30);
  const flat = Math.SQRT1_2;
  const light = (x: number, y: number, azimuth: number): number => {
    const [nx, ny] = [-x * exaggeration, -y * exaggeration];
    const lit = (nx * Math.cos(azimuth) + ny * Math.sin(azimuth)) * flat + flat;
    return Math.max(lit / Math.hypot(nx, ny, 1), 0);
  };

  const image = context.createImageData(cols, rows);
  for (let i = 0; i < cols * rows; i++) {
    // mostly from the north-west, a little from the west and north, so no ridge line goes flat
    const lit =
      0.5 * light(gx[i], gy[i], (-3 * Math.PI) / 4) +
      0.25 * light(gx[i], gy[i], Math.PI) +
      0.25 * light(gx[i], gy[i], -Math.PI / 2);
    const shadow = Math.min(Math.max((flat - lit) * 1.1, 0), SHADOW);
    image.data.set([60, 60, 66, shadow * 255], i * 4);
  }
  context.putImageData(image, 0, 0);
  return `<image href="${canvas.toDataURL()}" width="${field.width}" height="${field.height}" preserveAspectRatio="none"/>`;
}

/** The levels at round heights: the finest interval that draws no more than so many lines over the rise */
function getLevels(field: Battlefield, surface: Surface, ratio: number, most: number): Level[] {
  const low = field.base * ratio;
  const high = (field.base + field.relief) * ratio;
  const interval = STEPS.find(step => (high - low) / step <= most);
  if (!interval) return [];
  const values: number[] = [];
  for (let value = Math.floor(low / interval + 1) * interval; value < high; value += interval) values.push(value);
  if (!values.length) return [];

  const { step, cols, rows, z } = surface;
  const [width, height] = [cols + PAD * 2, rows + PAD * 2];
  const padded = new Float64Array(width * height);
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const [c, r] = [Math.min(Math.max(col - PAD, 0), cols - 1), Math.min(Math.max(row - PAD, 0), rows - 1)];
      padded[row * width + col] = z[r * cols + c];
    }
  }
  const rings = (geometry: { coordinates: number[][][][] }): Point[][] =>
    geometry.coordinates.flat().map(ring => ring.map(([x, y]): Point => [(x - PAD) * step, (y - PAD) * step]));

  return contours()
    .size([width, height])
    .thresholds(values.map(value => value / ratio - field.base))(Array.from(padded))
    .map((geometry, k) => ({
      value: values[k],
      interval,
      index: values[k] % (interval * INDEX_EVERY) === 0,
      rings: rings(geometry)
    }))
    .filter(level => level.rings.length);
}

/** The ground at so many samples across the field: a cubic B-spline over the nodes, water filled from the shore */
function getSurface(field: Battlefield): Surface {
  const ground = getGround(field);
  const step = field.width / SAMPLES;
  const cols = SAMPLES;
  const rows = Math.ceil(field.height / step);
  const z = new Float32Array(cols * rows);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++)
      z[row * cols + col] = sampleGround(field, ground, (col + 0.5) * step, (row + 0.5) * step);
  }
  const gx = new Float32Array(cols * rows);
  const gy = new Float32Array(cols * rows);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const [c0, c1] = [Math.max(col - 1, 0), Math.min(col + 1, cols - 1)];
      const [r0, r1] = [Math.max(row - 1, 0), Math.min(row + 1, rows - 1)];
      gx[row * cols + col] = (z[row * cols + c1] - z[row * cols + c0]) / ((c1 - c0) * step);
      gy[row * cols + col] = (z[r1 * cols + col] - z[r0 * cols + col]) / ((r1 - r0) * step);
    }
  }
  const slopes = Array.from(gx, (x, i) => Math.hypot(x, gy[i])).sort((a, b) => a - b);
  const steep = Math.max(slopes[Math.floor(slopes.length * 0.95)], 0.001);
  return { step, cols, rows, z, gx, gy, steep };
}

const heightAt = ({ step, cols, rows, z }: Surface, x: number, y: number): number =>
  z[
    Math.min(Math.max(Math.floor(y / step), 0), rows - 1) * cols + Math.min(Math.max(Math.floor(x / step), 0), cols - 1)
  ];

/** Node heights in metres above the lowest node; sea and lake nodes take the height of the nearest shore */
function getGround({ elevation, water, relief }: Battlefield): number[] {
  const ground = elevation.map(e => e * relief);
  let known = water.map(w => w !== 1);
  if (!known.some(Boolean)) return ground;
  while (known.some(k => !k)) {
    const next = [...known];
    for (let i = 0; i < ground.length; i++) {
      if (known[i]) continue;
      const col = i % COLS;
      const sides = [col > 0 ? i - 1 : -1, col < COLS - 1 ? i + 1 : -1, i - COLS, i + COLS];
      const shore = sides.filter(n => n >= 0 && n < ground.length && known[n]);
      if (!shore.length) continue;
      ground[i] = shore.reduce((sum, n) => sum + ground[n], 0) / shore.length;
      next[i] = true;
    }
    known = next;
  }
  return ground;
}

const bspline = (p0: number, p1: number, p2: number, p3: number, t: number): number => {
  const [t2, t3, u] = [t * t, t * t * t, 1 - t];
  return (u * u * u * p0 + (3 * t3 - 6 * t2 + 4) * p1 + (-3 * t3 + 3 * t2 + 3 * t + 1) * p2 + t3 * p3) / 6;
};

function sampleGround({ cell }: Battlefield, ground: number[], x: number, y: number): number {
  const [fx, fy] = [x / cell - 0.5, y / cell - 0.5];
  const [col, row] = [Math.floor(fx), Math.floor(fy)];
  const at = (c: number, r: number): number =>
    ground[Math.min(Math.max(r, 0), ROWS - 1) * COLS + Math.min(Math.max(c, 0), COLS - 1)];
  const across = (k: number): number =>
    bspline(at(col - 1, row + k), at(col, row + k), at(col + 1, row + k), at(col + 2, row + k), fx - col);
  return bspline(across(-1), across(0), across(1), across(2), fy - row);
}

/** Points every `spacing` metres along the rings */
function walk(rings: Point[][], spacing: number, visit: (x: number, y: number) => void): void {
  for (const ring of rings) {
    let next = spacing / 2;
    let distance = 0;
    for (let k = 1; k < ring.length; k++) {
      const [[x0, y0], [x1, y1]] = [ring[k - 1], ring[k]];
      const length = Math.hypot(x1 - x0, y1 - y0);
      while (next <= distance + length) {
        const t = (next - distance) / (length || 1);
        visit(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
        next += spacing;
      }
      distance += length;
    }
  }
}

const toPath = (rings: Point[][]): string =>
  rings.map(ring => `M${ring.map(([x, y]) => `${rn(x, 1)} ${rn(y, 1)}`).join("L")}Z`).join("");
