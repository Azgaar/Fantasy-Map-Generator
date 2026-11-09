import {
  CULTURE_TYPE_DEVELOPMENT,
  DEFAULT_DEVELOPMENT,
  DEFAULT_ERAS,
  type Era,
  WILDLANDS_DEVELOPMENT
} from "@/data/development";
import type { Culture } from "./cultures-generator";

const SMOOTHING = 2; // passes averaging each land cell with its neighbors, before the noise
const NOISE = 9; // the waves' amplitude, in points
const WAVES = 3; // waves across the map
const RIVER = 1;
const COAST = 1;
const MIN_BURG = 5; // a generated town is past the foragers' era, whatever its land

class DevelopmentGenerator {
  get eras(): Era[] {
    return options.map.eras;
  }

  getDefaultEras(): Era[] {
    return DEFAULT_ERAS.map(era => ({ ...era }));
  }

  /** Make development again from the cultures and land; custom levels are lost */
  generate(): void {
    const { cells, cultures, biomes } = pack;
    const n = cells.i.length;
    const levels = cultures.map(culture => (culture && !culture.removed ? this.ofCulture(culture) : 0));
    const noise = this.getNoise();

    const field = new Float32Array(n);
    for (let cell = 0; cell < n; cell++) {
      if (cells.h[cell] < 20) continue;
      const biome = biomes[cells.biome[cell]]?.development ?? 0;
      const water = (cells.r[cell] ? RIVER : 0) + (cells.harbor[cell] ? COAST : 0);
      field[cell] = (levels[cells.culture[cell]] ?? levels[0]) + biome + water; // a damaged file's culture repairs to 0
    }
    const smooth = this.smooth(field);

    const development = new Uint8Array(n);
    for (let cell = 0; cell < n; cell++) {
      if (cells.h[cell] < 20 || (!cells.pop[cell] && !cells.burg[cell])) continue; // no people, no development
      const least = cells.burg[cell] ? MIN_BURG : 1;
      development[cell] = Math.max(least, Math.min(100, Math.round(smooth[cell] + noise(cell))));
    }
    cells.development = development;
  }

  getEraIndex(level: number): number {
    let index = 0;
    this.eras.forEach((era, i) => {
      if (level >= era.level) index = i;
    });
    return index;
  }

  getEra(level: number): string {
    return this.eras[this.getEraIndex(level)].name;
  }

  /** The people's average development by the id each cell holds, as `cells.state` */
  getAverages(ids: ArrayLike<number>): (number | undefined)[] {
    const { cells, burgs } = pack;
    const development = cells.development;
    const rate = options.map.units.population.urbanization.rate;
    const people: number[] = [];
    const total: number[] = [];
    for (let cell = 0; cell < development.length; cell++) {
      if (!development[cell]) continue; // no development, as painted
      const burg = cells.burg[cell] ? burgs[cells.burg[cell]] : undefined;
      const count = cells.pop[cell] + (burg && !burg.removed ? (burg.population || 0) * rate : 0);
      if (!count) continue;
      const id = ids[cell];
      people[id] = (people[id] || 0) + count;
      total[id] = (total[id] || 0) + count * development[cell];
    }
    return Array.from(people, (count, id) => (count ? total[id] / count : undefined));
  }

  /** Whether people live in the cell: only peopled land has development, 0 is none */
  isPeopled(cell: number): boolean {
    const { cells } = pack;
    return cells.h[cell] >= 20 && (cells.pop[cell] > 0 || cells.burg[cell] > 0);
  }

  /** Set the development of peopled land cells, a whole number from 0 to 100: 0 is none. Empty land and water are skipped */
  setCells(level: number, cells: readonly number[]): void {
    if (!Number.isInteger(level) || level < 0 || level > 100)
      throw new Error("The development must be an integer from 0 to 100");
    const { development } = pack.cells;
    for (const cell of cells) {
      if (this.isPeopled(cell)) development[cell] = level;
    }
  }

  /** A burg founded after generation: a cell with none takes the best around, at least MIN_BURG */
  settle(cell: number): void {
    const { development } = pack.cells;
    development[cell] = Math.max(MIN_BURG, development[cell] || this.getBestAround(cell));
  }

  /** A cell a burg left: no development once nobody lives there */
  vacate(cell: number): void {
    if (!this.isPeopled(cell)) pack.cells.development[cell] = 0;
  }

  /** After people moved: newly peopled land takes the best around, at least 1; emptied has none */
  resettle(wasPeopled: readonly boolean[]): void {
    const { development, i, h } = pack.cells;
    for (const cell of i) {
      if (h[cell] < 20) continue;
      if (!this.isPeopled(cell)) development[cell] = 0;
      else if (!wasPeopled[cell]) development[cell] = Math.max(1, this.getBestAround(cell));
    }
  }

  /** A cell's development; a water cell, worked from the shore, takes the best of the land around */
  ofCell(cell: number): number {
    return pack.cells.h[cell] >= 20 ? pack.cells.development[cell] : this.getBestAround(cell);
  }

  private getBestAround(cell: number): number {
    const { development, c, h } = pack.cells;
    let level = 0;
    for (const neighbor of c[cell]) if (h[neighbor] >= 20) level = Math.max(level, development[neighbor]);
    return level;
  }

  private smooth(field: Float32Array): Float32Array {
    const { cells } = pack;
    let current = field;
    for (let pass = 0; pass < SMOOTHING; pass++) {
      const next = new Float32Array(current.length);
      for (let cell = 0; cell < current.length; cell++) {
        if (cells.h[cell] < 20) continue;
        let sum = current[cell];
        let count = 1;
        for (const neighbor of cells.c[cell]) {
          if (cells.h[neighbor] < 20) continue;
          sum += current[neighbor];
          count++;
        }
        next[cell] = sum / count;
      }
      current = next;
    }
    return current;
  }

  /** A culture's development at its center: its own level and its way of life */
  ofCulture(culture: Culture): number {
    if (!culture.i) return WILDLANDS_DEVELOPMENT;
    return (culture.development ?? DEFAULT_DEVELOPMENT) + (CULTURE_TYPE_DEVELOPMENT[culture.type] ?? 0);
  }

  /** Value noise in two octaves, the same for the same seed */
  private getNoise(): (cell: number) => number {
    const points = pack.cells.p;
    let minX = Infinity;
    let minY = Infinity;
    let size = 0;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      if (point[0] < minX) minX = point[0];
      if (point[0] > maxX) maxX = point[0];
      if (point[1] < minY) minY = point[1];
      if (point[1] > maxY) maxY = point[1];
    }
    size = Math.max(maxX - minX, maxY - minY);
    const seed = hashString(String(options.map.seed));
    const lattice = (x: number, y: number) => {
      let h = seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      return (((h ^ (h >>> 16)) >>> 0) / 4294967295) * 2 - 1;
    };
    const smooth = (t: number) => t * t * (3 - 2 * t);
    const valueNoise = (x: number, y: number) => {
      const ix = Math.floor(x);
      const iy = Math.floor(y);
      const fx = smooth(x - ix);
      const fy = smooth(y - iy);
      const top = lattice(ix, iy) + (lattice(ix + 1, iy) - lattice(ix, iy)) * fx;
      const bottom = lattice(ix, iy + 1) + (lattice(ix + 1, iy + 1) - lattice(ix, iy + 1)) * fx;
      return top + (bottom - top) * fy;
    };
    return cell => {
      const x = ((points[cell][0] - minX) / (size || 1)) * WAVES;
      const y = ((points[cell][1] - minY) / (size || 1)) * WAVES;
      return NOISE * (0.67 * valueNoise(x, y) + 0.33 * valueNoise(x * 2 + 17, y * 2 + 17));
    };
  }
}

/** FNV-1a: a seed's text as a 32-bit number */
function hashString(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return hash >>> 0;
}

export const Development = new DevelopmentGenerator();
