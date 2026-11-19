// The lie of a battle field: hachures or fringed contours, a soft shadow and the heights of tops and hollows.
// Every part is drawn at once in its own group; the battle look shows the chosen ones. See docs/domain/battles.md

import { contours } from "d3";
import { COLS } from "@/model/political/battle/battle-scale";
import { type Battlefield, Battlefields } from "@/model/political/battle/battlefield";
import { getHeightUnitRatio } from "@/model/units";
import { getContourLabels } from "@/renderers/heightmap/heightmap-contours";
import type { Point } from "@/types/global";
import { rn } from "@/utils/number-utils";
import { walkLine } from "@/utils/path-utils";

const SAMPLES = 400; // the surface is sampled so many times across the battle's field, whatever its size
const PAD = 2; // samples added round the field, so lines run off it instead of closing at its edge
const STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]; // contour intervals, in the map's height unit
const MOST_LINES = 12; // the finest interval that draws no more lines over the field's rise
const MOST_ROWS = 24; // and no more rows of hachures, so the strokes stay short
const INDEX_EVERY = 5; // every fifth line is an index line, labelled
const MOST_LABELS = 14;
const INK = "#6c645a";
const HACHURE_SLOPE = [0.008, 0.03]; // gentler ground draws no hachure: half the field's steep slope, within these
const FULL_RELIEF = 80; // metres of rise that draw hachures and shade at full strength; a lower field draws them fainter
const SHADOW = 0.22; // the darkest shadow's opacity at full strength
const SHADED_SLOPE = 0.3; // the field's steep slope is shaded as if it were this steep, up to 12 times its own
const PROMINENCE = [0.1, 0.3]; // a top rises this share of the field's rise above the pass to higher ground, so many metres at least; a hollow as deep
const MOST_TOPS = 5;
const MOST_HOLLOWS = 3;
const EXTREME_ROOM = 4; // nodes round the highest and the lowest land kept clear of other marks
const CLIFF_BAND = 0.8; // of a node either side of a cliff, the relief is left out: the cliff's own mark shows the drop

export interface Surface {
  step: number; // metres between samples
  cols: number;
  rows: number;
  z: Float32Array; // metres above the field's lowest node
  gx: Float32Array; // rise over run, east
  gy: Float32Array; // rise over run, south
  steep: number; // the slope only a twentieth of the field is steeper than
  band: Uint8Array; // samples by a cliff, left undrawn; empty without cliffs
}

interface Level {
  value: number; // in the map's height unit above sea level
  interval: number; // to the next level, in the same unit
  index: boolean;
  rings: Point[][]; // closed, in field metres
}

class BattleReliefRenderer {
  /** The relief groups, each shown or hidden by the battle look; the soft shadow left out where the light is drawn over it */
  getMarkup(field: Battlefield, halo: string, shade = true): string {
    if (!field.relief) return "";
    const pt = Battlefields.getPoint(field);
    const surface = this.getSurface(field);
    const ratio = getHeightUnitRatio();
    const levels = this.getLevels(field, surface, ratio, MOST_LINES);
    const strength = Math.min(Math.max(field.relief / FULL_RELIEF, 0.15), 1);
    return /* html */ `<g class="battleShade">${shade ? this.getShade(field, surface, strength) : ""}</g>
      <g class="battleHachures">${this.getHachures(field, surface, this.getLevels(field, surface, ratio, MOST_ROWS), ratio, strength)}</g>
      <g class="battleContours">${this.getContours(field, levels, surface, pt)}</g>
      <g class="battleContourLabels" fill="${INK}" stroke="${halo}" stroke-width="${3 * pt}" stroke-linejoin="round"
        paint-order="stroke" font-size="${9 * pt}" font-family="Georgia, serif" text-anchor="middle">${this.getLevelLabels(field, levels, surface, pt)}</g>`;
  }

  /** The marks of tops and hollows, drawn over the whole ground */
  getHeightsMarkup(field: Battlefield, halo: string): string {
    if (!field.relief) return "";
    const pt = Battlefields.getPoint(field);
    return /* html */ `<g class="battleHeights" fill="${INK}" stroke="${halo}" stroke-width="${3 * pt}" stroke-linejoin="round"
        paint-order="stroke" font-size="${10 * pt}" font-family="Georgia, serif">${this.getHeightMarks(field, getHeightUnitRatio(), pt)}</g>`;
  }

  /** The surface the light falls on, how much its slopes are steepened to show their form, and how strongly a field this high is shaded */
  getLitSurface(field: Battlefield): { surface: Surface; exaggeration: number; strength: number } {
    const surface = this.getSurface(field);
    const exaggeration = Math.min(Math.max(SHADED_SLOPE / surface.steep, 2), 12);
    return { surface, exaggeration, strength: Math.min(Math.max(field.relief / FULL_RELIEF, 0.15), 1) };
  }

  /** Hachures: strokes from each level down the fall line toward the next, thicker where steeper */
  private getHachures(field: Battlefield, surface: Surface, levels: Level[], ratio: number, strength: number): string {
    if (!levels.length) return "";
    const { step, z, gx, gy, cols, rows, steep } = surface;
    const band = surface.band.length ? surface.band : new Uint8Array(cols * rows);
    const pt = Battlefields.getPoint(field);
    const drop = levels[0].interval / ratio;
    const least = Math.min(Math.max(steep * 0.5, HACHURE_SLOPE[0]), HACHURE_SLOPE[1]);
    // the rings run just outside the field to reach its edge: strokes start and end within it
    const inside = (x: number, y: number): boolean => x >= 0 && y >= 0 && x <= field.width && y <= field.height;
    const at = (x: number, y: number): number =>
      Math.min(Math.max(Math.floor(y / step), 0), rows - 1) * cols +
      Math.min(Math.max(Math.floor(x / step), 0), cols - 1);
    const widths = [0.22, 0.32, 0.42, 0.52]; // in points, by slope
    const strokes: string[][] = widths.map(() => []);
    for (const { rings } of levels) {
      this.walkRings(rings, 4 * pt, ([x0, y0]) => {
        if (!inside(x0, y0)) return;
        const i0 = at(x0, y0);
        const slope = Math.hypot(gx[i0], gy[i0]);
        if (slope < least || band[i0]) return;
        let [x, y] = [x0, y0];
        for (let k = 0; k < 30; k++) {
          const i = at(x, y);
          const s = Math.hypot(gx[i], gy[i]);
          if (s < least * 0.8 || z[i0] - z[i] > drop * 0.8) break;
          const [nx, ny] = [x - (gx[i] / s) * step, y - (gy[i] / s) * step];
          if (!inside(nx, ny) || band[at(nx, ny)]) break;
          [x, y] = [nx, ny];
        }
        if (Math.hypot(x - x0, y - y0) < pt) return;
        const bucket = Math.min(Math.floor(((slope - least) / 0.15) * widths.length), widths.length - 1);
        strokes[bucket].push(`M${Math.round(x0)} ${Math.round(y0)}L${Math.round(x)} ${Math.round(y)}`); // a metre is fine enough
      });
    }
    return `<g fill="none" stroke="${INK}" stroke-linecap="round" opacity="${rn(0.3 + 0.35 * strength, 2)}">${strokes
      .map((list, k) => (list.length ? `<path d="${list.join("")}" stroke-width="${widths[k] * pt}"/>` : ""))
      .join("")}</g>`;
  }

  /** Hairline contours with a fringe of short ticks on their downhill side */
  private getContours(field: Battlefield, levels: Level[], surface: Surface, pt: number): string {
    const { step, gx, gy, cols, rows, band } = surface;
    const lines = levels.map(
      ({ rings, index }) =>
        `<path d="${this.toPath(this.cutAtCliffs(surface, rings))}" stroke-width="${(index ? 0.66 : 0.33) * pt}"/>`
    );
    const length = 3.3 * pt;
    const ticks: string[] = [];
    for (const { rings } of levels) {
      this.walkRings(rings, 9 * pt, ([x, y]) => {
        if (x < 0 || y < 0 || x > field.width || y > field.height) return;
        const i = Math.min(Math.floor(y / step), rows - 1) * cols + Math.min(Math.floor(x / step), cols - 1);
        if (band[i]) return;
        const slope = Math.hypot(gx[i], gy[i]);
        if (slope < 0.002) return;
        ticks.push(`M${rn(x, 1)} ${rn(y, 1)}l${rn((-gx[i] / slope) * length, 1)} ${rn((-gy[i] / slope) * length, 1)}`);
      });
    }
    return `<g fill="none" stroke="${INK}" stroke-linejoin="round" opacity="0.45">${lines.join("")}</g>
      <path d="${ticks.join("")}" fill="none" stroke="${INK}" stroke-width="${0.44 * pt}" stroke-linecap="round" opacity="0.45"/>`;
  }

  /** Labels along the index lines, or along every line where fewer than two index lines cross the field */
  private getLevelLabels(field: Battlefield, levels: Level[], surface: Surface, pt: number): string {
    const indexed = levels.filter(level => level.index).length >= 2;
    const labelled = levels.map(({ value, index }) => ({ height: value, value, major: indexed ? index : true }));

    // the stretches within the field, away from its edge
    const margin = 20 * pt;
    const inside = ([x, y]: Point) =>
      x > margin &&
      y > margin &&
      x < field.width - margin &&
      y < field.height - margin &&
      !this.isByCliff(surface, x, y);
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
      heightAt: (x, y) => this.heightAt(surface, x, y),
      probe: field.cell
    })
      .slice(0, MOST_LABELS) // the longest lines are labelled first
      .map(
        ({ x, y, angle, text }) =>
          `<text transform="translate(${rn(x, 1)} ${rn(y, 1)}) rotate(${Math.round(angle)})" dy="0.35em">${text}</text>`
      )
      .join("");
  }

  /** Tops and hollows: ▲ on the highest node of a hill, ▽ in the lowest of a hollow, each with its height; none on a flat field */
  private getHeightMarks(field: Battlefield, ratio: number, pt: number): string {
    const { cols, rows } = field;
    const ground = this.getGround(field);
    const least = Math.max(field.relief * PROMINENCE[0], PROMINENCE[1]);
    const neighbours = (i: number): number[] => {
      const [col, row] = [i % cols, Math.floor(i / cols)];
      const out: number[] = [];
      for (let r = Math.max(row - 1, 0); r <= Math.min(row + 1, rows - 1); r++) {
        for (let c = Math.max(col - 1, 0); c <= Math.min(col + 1, cols - 1); c++)
          if (r !== row || c !== col) out.push(r * cols + c);
      }
      return out;
    };
    // the shore is the lowest land, not a hollow
    const nearWater = (i: number): boolean => {
      const [col, row] = [i % cols, Math.floor(i / cols)];
      for (let r = Math.max(row - 3, 0); r <= Math.min(row + 3, rows - 1); r++) {
        for (let c = Math.max(col - 3, 0); c <= Math.min(col + 3, cols - 1); c++)
          if (field.water[r * cols + c] === 1) return true;
      }
      return false;
    };
    // an edge is a slope running off the field
    const inner = (i: number): boolean => {
      const [col, row] = [i % cols, Math.floor(i / cols)];
      return col >= 2 && row >= 2 && col < cols - 2 && row < rows - 2 && !field.water[i];
    };
    const land = ground.map((_, i) => i).filter(inner);
    if (!land.length) return "";
    const extreme = (sign: number): number => land.reduce((a, b) => ((ground[b] - ground[a]) * sign > 0 ? b : a));
    const [highest, lowest] = [extreme(1), extreme(-1)];
    if ((ground[highest] - ground[lowest]) * ratio < 1) return ""; // flat
    const pick = (sign: number, most: number): number[] => {
      const found: [node: number, prominence: number][] = [];
      ground.forEach((z, i) => {
        if (!inner(i) || (sign < 0 && nearWater(i))) return;
        // level ground counts once: the first node of it
        if (neighbours(i).some(n => (ground[n] - z) * sign > 0 || (ground[n] === z && n < i))) return;
        const prominence = this.getProminence(field, ground, i, sign);
        if (prominence >= least) found.push([i, prominence]);
      });
      return found
        .sort((a, b) => b[1] - a[1])
        .slice(0, most)
        .map(([i]) => i);
    };

    const mark = (i: number, top: boolean): string => {
      const [x, y] = [((i % cols) + 0.5) * field.cell, (Math.floor(i / cols) + 0.5) * field.cell];
      const [h, w] = [5 * pt, 4.4 * pt];
      const sign = top
        ? `<path d="M0 ${-h * 0.62}L${w} ${h * 0.38}H${-w}Z" stroke="none"/>`
        : `<path d="M0 ${h * 0.62}L${w} ${-h * 0.38}H${-w}Z" fill="none" stroke="${INK}" stroke-width="${0.8 * pt}" paint-order="normal"/>`;
      const height = Math.round((field.base + ground[i]) * ratio);
      const left = x + (7 + 6 * String(height).length) * pt > field.width; // the label would run off the field
      const label = left ? `x="${-7 * pt}" text-anchor="end"` : `x="${7 * pt}"`;
      return `<g transform="translate(${rn(x, 1)} ${rn(y, 1)})">${sign}<text ${label} dy="0.35em">${height}</text></g>`;
    };
    // the highest and the lowest land always marked, a lesser mark by them left out
    const apart = (a: number, b: number): boolean =>
      Math.hypot((a % cols) - (b % cols), Math.floor(a / cols) - Math.floor(b / cols)) > EXTREME_ROOM;
    const withExtreme = (extreme: number, marks: number[], most: number): number[] =>
      [extreme, ...marks.filter(i => apart(i, extreme))].slice(0, most);
    const tops = withExtreme(highest, pick(1, MOST_TOPS), MOST_TOPS);
    const hollows = withExtreme(lowest, pick(-1, MOST_HOLLOWS), MOST_HOLLOWS);
    return [...tops.map(i => mark(i, true)), ...hollows.map(i => mark(i, false))].join("");
  }

  /**
   * How far a top rises above the lowest pass to higher ground (sign 1), or a hollow sinks below its lowest outlet (sign -1).
   * The ground is flooded from the node down (or up) the levels; reaching the field's edge ends it, as the ground runs on
   */
  private getProminence({ cols, rows }: Battlefield, ground: number[], start: number, sign: number): number {
    const key = (i: number): number => ground[i] * sign;
    const peak = key(start);
    const seen = new Uint8Array(ground.length);
    const queue = [start]; // a heap, the highest first
    seen[start] = 1;
    let level = peak;
    while (queue.length) {
      const i = this.popHighest(queue, key);
      if (key(i) > peak) break;
      level = Math.min(level, key(i));
      const [col, row] = [i % cols, Math.floor(i / cols)];
      if (col === 0 || row === 0 || col === cols - 1 || row === rows - 1) break;
      for (const n of [i - 1, i + 1, i - cols, i + cols]) {
        if (seen[n]) continue;
        seen[n] = 1;
        this.pushHeap(queue, n, key);
      }
    }
    return peak - level;
  }

  private pushHeap(heap: number[], item: number, key: (i: number) => number): void {
    heap.push(item);
    for (let k = heap.length - 1; k > 0; ) {
      const parent = (k - 1) >> 1;
      if (key(heap[parent]) >= key(heap[k])) break;
      [heap[parent], heap[k]] = [heap[k], heap[parent]];
      k = parent;
    }
  }

  private popHighest(heap: number[], key: (i: number) => number): number {
    const top = heap[0];
    const last = heap.pop()!;
    if (!heap.length) return top;
    heap[0] = last;
    for (let k = 0; ; ) {
      const [left, right] = [2 * k + 1, 2 * k + 2];
      let high = k;
      if (left < heap.length && key(heap[left]) > key(heap[high])) high = left;
      if (right < heap.length && key(heap[right]) > key(heap[high])) high = right;
      if (high === k) break;
      [heap[high], heap[k]] = [heap[k], heap[high]];
      k = high;
    }
    return top;
  }

  /** A soft grey on the slopes turned from the north-west light: gentle slopes exaggerated so their form shows, a low field fainter */
  private getShade(field: Battlefield, { cols, rows, gx, gy, steep }: Surface, strength: number): string {
    const canvas = document.createElement("canvas");
    canvas.width = cols;
    canvas.height = rows;
    const context = canvas.getContext("2d");
    if (!context) return "";

    const exaggeration = Math.min(Math.max(SHADED_SLOPE / steep, 2), 12);
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
      const shadow = Math.min(Math.max((flat - lit) * 1.1, 0), SHADOW) * strength;
      image.data.set([60, 60, 66, shadow * 255], i * 4);
    }
    context.putImageData(image, 0, 0);
    return `<image href="${canvas.toDataURL()}" width="${field.width}" height="${field.height}" preserveAspectRatio="none"/>`;
  }

  /** The levels at round heights: the finest interval that draws no more than so many lines over the rise */
  private getLevels(field: Battlefield, surface: Surface, ratio: number, most: number): Level[] {
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
  private getSurface(field: Battlefield): Surface {
    const cols = Math.round((field.cols * SAMPLES) / COLS);
    const step = field.width / cols;
    const rows = Math.ceil(field.height / step);
    // high ground stands on the ground under it by its step, sharp at its edge as the troops have it
    const { top, scarp } = field;
    const under = this.getGround(field, true);
    const side = new Uint8Array(cols * rows);
    const z = new Float32Array(cols * rows);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const [x, y] = [(col + 0.5) * step, (row + 0.5) * step];
        const i = row * cols + col;
        side[i] = top.length ? top[Battlefields.nodeAt(field, x, y)] : 0;
        z[i] = this.sampleGround(field, under, x, y) + (side[i] ? this.sampleGround(field, scarp, x, y) : 0);
      }
    }
    // slopes read on the sample's own side of a step: a cliff is no slope
    const gx = new Float32Array(cols * rows);
    const gy = new Float32Array(cols * rows);
    const rise = (i: number, a: number, b: number, run: number): number => {
      const [p, q] = [side[a] === side[i] ? a : i, side[b] === side[i] ? b : i];
      return p === q ? 0 : (z[q] - z[p]) / (((q - p) / run) * step);
    };
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const i = row * cols + col;
        gx[i] = rise(i, row * cols + Math.max(col - 1, 0), row * cols + Math.min(col + 1, cols - 1), 1);
        gy[i] = rise(i, Math.max(row - 1, 0) * cols + col, Math.min(row + 1, rows - 1) * cols + col, cols);
      }
    }
    const band = this.getCliffBand(field, step, cols, rows);
    const slopes = Array.from(gx, (x, i) => (band[i] ? 0 : Math.hypot(x, gy[i]))).sort((a, b) => a - b);
    const steep = Math.max(slopes[Math.floor(slopes.length * 0.95)], 0.001);
    return { step, cols, rows, z, gx, gy, steep, band };
  }

  /** The samples within a band either side of a cliff; empty on a field without */
  private getCliffBand({ cliffs, cell }: Battlefield, step: number, cols: number, rows: number): Uint8Array {
    if (!cliffs.length) return new Uint8Array(0);
    const band = new Uint8Array(cols * rows);
    const reach = cell * CLIFF_BAND;
    const span = Math.ceil(reach / step);
    for (const { a, b } of cliffs) {
      const count = Math.max(Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step), 1);
      for (let k = 0; k <= count; k++) {
        const [px, py] = [a[0] + ((b[0] - a[0]) * k) / count, a[1] + ((b[1] - a[1]) * k) / count];
        const [col, row] = [Math.floor(px / step), Math.floor(py / step)];
        for (let r = Math.max(row - span, 0); r <= Math.min(row + span, rows - 1); r++) {
          for (let c = Math.max(col - span, 0); c <= Math.min(col + span, cols - 1); c++) {
            const [x, y] = [(c + 0.5) * step, (r + 0.5) * step];
            if (!band[r * cols + c] && Battlefields.distanceToLine([x, y], [a, b]) <= reach) band[r * cols + c] = 1;
          }
        }
      }
    }
    return band;
  }

  private isByCliff({ band, step, cols, rows }: Surface, x: number, y: number): boolean {
    return (
      band.length > 0 &&
      band[
        Math.min(Math.max(Math.floor(y / step), 0), rows - 1) * cols +
          Math.min(Math.max(Math.floor(x / step), 0), cols - 1)
      ] === 1
    );
  }

  /** Rings as lines, broken off by the cliffs: a contour runs into a cliff, not along it */
  private cutAtCliffs(surface: Surface, rings: Point[][]): Point[][] {
    if (!surface.band.length) return rings;
    return rings.flatMap(ring => {
      const runs: Point[][] = [[]];
      for (const point of ring) {
        if (!this.isByCliff(surface, ...point)) runs.at(-1)!.push(point);
        else if (runs.at(-1)!.length) runs.push([]);
      }
      if (runs.length > 1 && this.isClosed(ring) && runs[0].length && runs.at(-1)!.length)
        runs[0] = [...runs.pop()!, ...runs[0].slice(1)]; // the run over the ring's seam is one
      return runs.filter(run => run.length > 1);
    });
  }

  private isClosed(ring: Point[]): boolean {
    return ring.length > 2 && ring[0][0] === ring.at(-1)![0] && ring[0][1] === ring.at(-1)![1];
  }

  private heightAt({ step, cols, rows, z }: Surface, x: number, y: number): number {
    return z[
      Math.min(Math.max(Math.floor(y / step), 0), rows - 1) * cols +
        Math.min(Math.max(Math.floor(x / step), 0), cols - 1)
    ];
  }

  /** Node heights in metres above the lowest node, or of the ground under the high ground; sea and lake nodes take the height of the nearest shore */
  private getGround({ elevation, water, relief, top, scarp, cols }: Battlefield, under = false): number[] {
    const ground = elevation.map((e, i) => e * relief - (under && top.length ? top[i] * scarp[i] : 0));
    let known = water.map(w => w !== 1);
    if (!known.some(Boolean)) return ground;
    while (known.some(k => !k)) {
      const next = [...known];
      for (let i = 0; i < ground.length; i++) {
        if (known[i]) continue;
        const col = i % cols;
        const sides = [col > 0 ? i - 1 : -1, col < cols - 1 ? i + 1 : -1, i - cols, i + cols];
        const shore = sides.filter(n => n >= 0 && n < ground.length && known[n]);
        if (!shore.length) continue;
        ground[i] = shore.reduce((sum, n) => sum + ground[n], 0) / shore.length;
        next[i] = true;
      }
      known = next;
    }
    return ground;
  }

  private bspline(p0: number, p1: number, p2: number, p3: number, t: number): number {
    const [t2, t3, u] = [t * t, t * t * t, 1 - t];
    return (u * u * u * p0 + (3 * t3 - 6 * t2 + 4) * p1 + (-3 * t3 + 3 * t2 + 3 * t + 1) * p2 + t3 * p3) / 6;
  }

  private sampleGround({ cell, cols, rows }: Battlefield, ground: number[], x: number, y: number): number {
    const [fx, fy] = [x / cell - 0.5, y / cell - 0.5];
    const [col, row] = [Math.floor(fx), Math.floor(fy)];
    const at = (c: number, r: number): number =>
      ground[Math.min(Math.max(r, 0), rows - 1) * cols + Math.min(Math.max(c, 0), cols - 1)];
    const across = (k: number): number =>
      this.bspline(at(col - 1, row + k), at(col, row + k), at(col + 1, row + k), at(col + 2, row + k), fx - col);
    return this.bspline(across(-1), across(0), across(1), across(2), fy - row);
  }

  private walkRings(rings: Point[][], spacing: number, visit: (at: Point) => void): void {
    for (const ring of rings) walkLine(ring, spacing, visit);
  }

  private toPath(rings: Point[][]): string {
    return rings
      .map(ring => `M${ring.map(([x, y]) => `${rn(x, 1)} ${rn(y, 1)}`).join("L")}${this.isClosed(ring) ? "Z" : ""}`)
      .join("");
  }
}

export const BattleReliefView = new BattleReliefRenderer();
