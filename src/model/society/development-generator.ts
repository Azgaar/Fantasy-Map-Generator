// Technological development of each peopled cell, 1–100 (0 where nobody lives): spread from culture centers along routes, waved by noise, shaped by land
import {
  CULTURE_TYPE_DEVELOPMENT,
  DEFAULT_DEVELOPMENT,
  DEVELOPMENT_ERAS,
  type DevelopmentEra,
  WILDLANDS_DEVELOPMENT
} from "@/data/development";
import { FlatQueue } from "@/utils/flat-queue";
import type { Culture } from "./cultures-generator";

const SPREAD_DECAY = 30; // points lost crossing land as wide as the map is in cells, off the routes
const ROUTE_DECAY: Record<string, number> = { roads: 0.15, trails: 0.4, searoutes: 0.25 }; // of the decay off the routes
const FOREIGN = 4; // times the decay in another culture's land: knowledge crosses peoples slowly
const HINTERLAND = 5; // the most a cell falls behind its culture's center, under two eras, however far from it
const ROUTE_BONUS: Record<string, number> = { roads: 5, searoutes: 3, trails: 2 }; // points a cell on the route gains
const ROUTE_FALLOFF = 0.6; // of the bonus a cell further from the route keeps
const ROUTE_REACH = 4; // cells from a route its bonus still reaches
const SMOOTHING = 5; // passes averaging each land cell with its neighbors, before the routes and the noise
const NOISE = 9; // the waves' amplitude, in points
const WAVES = 3; // waves across the map
const RIVER = 1;
const COAST = 1;
const MIN_BURG = 5; // a generated town is past the foragers' era, whatever its land

class DevelopmentGenerator {
  /** The index in DEVELOPMENT_ERAS of the era a development level falls in */
  getEraIndex(level: number): number {
    let index = 0;
    DEVELOPMENT_ERAS.forEach((era, i) => {
      if (level >= era.level) index = i;
    });
    return index;
  }

  /** The era a development level falls in */
  getEra(level: number): DevelopmentEra {
    return DEVELOPMENT_ERAS[this.getEraIndex(level)].name;
  }

  /** The people's average development by the id each cell holds, as `cells.state`: rural people by cell, townspeople by burg */
  getAverages(ids: ArrayLike<number>): (number | undefined)[] {
    const { cells, burgs } = pack;
    const development = cells.development;
    if (!development) return [];
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

  /** Set the development of land cells where people live, a whole number from 0 to 100: 0 is none. Empty land and water are skipped */
  setCells(level: number, cells: readonly number[]): void {
    if (!Number.isInteger(level) || level < 0 || level > 100)
      throw new Error("The development must be an integer from 0 to 100");
    const { development } = pack.cells;
    if (!development) throw new Error("The map has no development; regenerate it first");
    for (const cell of cells) {
      if (this.isPeopled(cell)) development[cell] = level;
    }
  }

  /** A burg founded after generation: its cell takes the best development of the land around if it had none, and at least MIN_BURG */
  settle(cell: number): void {
    const { development, c, h } = pack.cells;
    if (!development) return;
    let level = development[cell];
    if (!level) for (const neighbor of c[cell]) if (h[neighbor] >= 20) level = Math.max(level, development[neighbor]);
    development[cell] = Math.max(MIN_BURG, level);
  }

  /** A cell a burg left: no development once nobody lives there */
  vacate(cell: number): void {
    const { development } = pack.cells;
    if (development && !this.isPeopled(cell)) development[cell] = 0;
  }

  /** After the people moved, as when population is regenerated: land newly peopled takes the best level around it, at least 1, and land left empty has none */
  resettle(wasPeopled: readonly boolean[]): void {
    const { development, i, c, h } = pack.cells;
    if (!development) return;
    for (const cell of i) {
      if (h[cell] < 20) continue;
      if (!this.isPeopled(cell)) development[cell] = 0;
      else if (!wasPeopled[cell]) {
        let level = 0;
        for (const neighbor of c[cell]) if (h[neighbor] >= 20) level = Math.max(level, development[neighbor]);
        development[cell] = Math.max(1, level);
      }
    }
  }

  /** A cell's development; a water cell, worked from the shore, takes the best of the land around it */
  ofCell(cell: number): number | undefined {
    const { development, c, h } = pack.cells;
    if (!development) return undefined;
    if (h[cell] >= 20) return development[cell];
    let level = 0;
    for (const neighbor of c[cell]) if (h[neighbor] >= 20) level = Math.max(level, development[neighbor]);
    return level;
  }

  /** Make development again from the cultures, routes and land; painted levels are lost */
  generate(): void {
    const { cells, cultures, biomes } = pack;
    const n = cells.i.length;
    const levels = cultures.map(culture => (culture && !culture.removed ? this.ofCulture(culture) : 0));
    const spread = this.spread(levels);
    const noise = this.getNoise();

    const routes = this.getRouteBonus();
    const field = new Float32Array(n);
    for (let cell = 0; cell < n; cell++) {
      if (cells.h[cell] < 20) continue;
      const base = Math.max(spread[cell], levels[cells.culture[cell]] - HINTERLAND);
      const biome = biomes[cells.biome[cell]]?.development ?? 0;
      const water = (cells.r[cell] ? RIVER : 0) + (cells.harbor[cell] ? COAST : 0);
      field[cell] = base + biome + water;
    }
    const smooth = this.smooth(field);

    const development = new Uint8Array(n);
    for (let cell = 0; cell < n; cell++) {
      if (cells.h[cell] < 20 || (!cells.pop[cell] && !cells.burg[cell])) continue; // no people, no development
      const least = cells.burg[cell] ? MIN_BURG : 1;
      development[cell] = Math.max(least, Math.min(100, Math.round(smooth[cell] + routes[cell] + noise(cell))));
    }
    cells.development = development;
  }

  /** What the routes add to each cell: the best route through it, fading each cell away, down to ROUTE_REACH cells, softened once */
  private getRouteBonus(): Float32Array {
    const { cells, routes } = pack;
    const bonus = new Float32Array(cells.i.length);
    let front: number[] = [];
    for (const key in cells.routes ?? {}) {
      const cell = +key;
      const links = cells.routes[cell];
      for (const next in links) bonus[cell] = Math.max(bonus[cell], ROUTE_BONUS[routes[links[next]]?.group] ?? 0);
      if (bonus[cell]) front.push(cell);
    }
    for (let step = 0; step < ROUTE_REACH && front.length; step++) {
      const next: number[] = [];
      for (const cell of front)
        for (const neighbor of cells.c[cell]) {
          const fading = bonus[cell] * ROUTE_FALLOFF;
          if (cells.h[neighbor] < 20 || bonus[neighbor] >= fading) continue;
          bonus[neighbor] = fading;
          next.push(neighbor);
        }
      front = next;
    }
    return this.smooth(bonus, 1);
  }

  /** The land's field averaged with its land neighbors, a pass at a time: borders between peoples become slopes */
  private smooth(field: Float32Array, passes = SMOOTHING): Float32Array {
    const { cells } = pack;
    let current = field;
    for (let pass = 0; pass < passes; pass++) {
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

  /** The best level reaching each cell from a culture center, losing a step's decay per cell, more in a foreign culture's land; water only by sea routes */
  private spread(levels: number[]): Float32Array {
    const { cells, cultures, routes } = pack;
    const n = cells.i.length;
    const step = SPREAD_DECAY / Math.sqrt(n);
    const reached = new Float32Array(n);
    const source = new Uint16Array(n); // the culture whose level reached the cell
    const queue = new FlatQueue<number>();
    for (const culture of cultures) {
      if (!culture?.i || culture.removed || culture.center === undefined) continue;
      const level = levels[culture.i];
      if (level > reached[culture.center]) {
        reached[culture.center] = level;
        source[culture.center] = culture.i;
        queue.push(culture.center, -level);
      }
    }

    while (queue.length) {
      const level = -queue.peekValue();
      const cell = queue.pop();
      if (level < reached[cell]) continue;
      const links = cells.routes?.[cell];
      for (const next of cells.c[cell]) {
        const routeId = links?.[next];
        const group = routeId === undefined ? undefined : routes[routeId]?.group;
        if (!group && (cells.h[next] < 20 || cells.h[cell] < 20)) continue;
        const foreign = cells.culture[next] && cells.culture[next] !== source[cell] ? FOREIGN : 1;
        const nextLevel = level - step * foreign * (group ? (ROUTE_DECAY[group] ?? 1) : 1);
        if (nextLevel <= reached[next] + 0.01) continue;
        reached[next] = nextLevel;
        source[next] = source[cell];
        queue.push(next, -nextLevel);
      }
    }
    return reached;
  }

  /** Smooth waves over the map, the same for the same seed: value noise in two octaves */
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
