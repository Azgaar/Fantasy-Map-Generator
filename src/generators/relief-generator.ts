import { extent, polygonContains } from "d3";
import { RELIEF_ICONS, RELIEF_SETS } from "@/data/relief-icons";
import type { ReliefSet, ReliefTypeIcons } from "@/types/relief";
import { minmax, ra, rn } from "@/utils";

declare global {
  var Relief: ReliefModule;
}

export interface ReliefIcon {
  icon: string; // symbol id without the leading "#", e.g. "relief-mount-3"
  x: number;
  y: number;
  s: number; // size, used as both width and height
}

class ReliefModule {
  generate(): ReliefIcon[] {
    TIME && console.time("generateRelief");

    const cells = pack.cells;
    const { size, density } = styles.relief.options;
    const set = styles.relief.options.set as ReliefSet;
    const iconSize = 2 * size;
    const sizeModifier = 0.2 * iconSize;

    const getBiomeIcon = (cellIndex: number, biomeIcons: string[]) => {
      let type = biomeIcons[Math.floor(Math.random() * biomeIcons.length)];
      const temp = grid.cells.temp[cells.g[cellIndex]];
      if (type === "conifer" && temp < 0) type = "coniferSnow";
      return this.pickIcon(type, set);
    };

    const getReliefIcon = (cellIndex: number, h: number): [string, number] => {
      const temp = grid.cells.temp[cells.g[cellIndex]];
      const type = h > 70 && temp < 0 ? "mountSnow" : h > 70 ? "mount" : "hill";
      const size = h > 70 ? (h - 45) * sizeModifier : minmax((h - 40) * sizeModifier, 3, 6);
      const [icon, scale] = this.pickIcon(type, set);
      return [icon, size * scale];
    };

    const relief: ReliefIcon[] = [];
    for (const i of cells.i) {
      const height = cells.h[i];
      if (height < 20) continue; // no icons on water
      if (cells.r[i]) continue; // no icons on rivers
      const biome = cells.biome[i];
      if (height < 50 && pack.biomes[biome].iconsDensity === 0) continue; // no icons for this biome

      const polygon = Pack.getPolygon(i);
      const [minX, maxX] = extent(polygon, (p: number[]) => p[0]) as [number, number];
      const [minY, maxY] = extent(polygon, (p: number[]) => p[1]) as [number, number];

      if (height < 50) placeBiomeIcons();
      else placeReliefIcons();

      function placeBiomeIcons(): void {
        const iconsDensity = pack.biomes[biome].iconsDensity / 100;
        const radius = 2 / iconsDensity / density;
        if (Math.random() > iconsDensity * 10) return;

        for (const [cx, cy] of poissonDiscSampler(minX, minY, maxX, maxY, radius)) {
          if (!polygonContains(polygon, [cx, cy])) continue;
          const size = (4 + Math.random()) * iconSize;
          const [icon, scale] = getBiomeIcon(i, pack.biomes[biome].icons);
          const h = size * scale;
          relief.push({ icon, x: rn(cx - h, 2), y: rn(cy - h, 2), s: rn(h * 2, 2) });
        }
      }

      function placeReliefIcons(): void {
        const radius = 2 / density;
        const [icon, h] = getReliefIcon(i, height);

        for (const [cx, cy] of poissonDiscSampler(minX, minY, maxX, maxY, radius)) {
          if (!polygonContains(polygon, [cx, cy])) continue;
          relief.push({ icon, x: rn(cx - h, 2), y: rn(cy - h, 2), s: rn(h * 2, 2) });
        }
      }
    }

    // sort icons by the bottom edge, so the closer ones are drawn on top
    relief.sort((a, b) => a.y + a.s - (b.y + b.s));
    pack.relief = relief;

    TIME && console.timeEnd("generateRelief");
    return relief;
  }

  changeSet(set: ReliefSet): void {
    for (const icon of pack.relief || []) {
      const [, type, variant] = icon.icon.match(/^relief-(\w+?)-(\d+)/) || [];
      if (!type) continue;
      [icon.icon] = this.pickIcon(type, set, Number(variant));
    }
  }

  changeSize(ratio: number): void {
    for (const icon of pack.relief || []) {
      const resized = rn(icon.s * ratio, 2);
      const shift = (resized - icon.s) / 2;
      icon.x = rn(icon.x - shift, 2);
      icon.y = rn(icon.y - shift, 2);
      icon.s = resized;
    }
  }

  // pick an icon of the type in the set, keeping the variant if the set has it
  private pickIcon(type: string, set: ReliefSet, variant?: number): [icon: string, scale: number] {
    const icons = getTypeIcons(type, set);
    if (!icons) return [getReliefIconId(type, variant || 1, set), 1];

    const { variants, scale = 1 } = icons;
    const picked = variant && variants.includes(variant) ? variant : variants.length > 1 ? ra(variants) : variants[0];
    return [getReliefIconId(icons.type, picked, set), scale];
  }
}

export const getReliefIconId = (type: string, variant: number, set: ReliefSet): string =>
  `relief-${type}-${variant}${RELIEF_SETS[set].suffix}`;

// icons of the type available in the set, falling back to the closest type the set has
function getTypeIcons(type: string, set: ReliefSet): ReliefTypeIcons | null {
  const base = RELIEF_SETS[set].base;

  for (let name: string | undefined = type; name; name = findType(name)?.fallback) {
    const icons = RELIEF_ICONS.find(entry => entry.set === base && entry.type === name);
    if (icons) return icons;
  }

  return null;
}

const findType = (type: string) => RELIEF_ICONS.find(entry => entry.type === type);

window.Relief = new ReliefModule();

/**
 * mbostock's poissonDiscSampler implementation
 * Generates points using Poisson-disc sampling within a specified rectangle
 * @param {number} x0 - The minimum x coordinate of the rectangle
 * @param {number} y0 - The minimum y coordinate of the rectangle
 * @param {number} x1 - The maximum x coordinate of the rectangle
 * @param {number} y1 - The maximum y coordinate of the rectangle
 * @param {number} r - The minimum distance between points
 * @param {number} k - The number of attempts before rejection (default is 3)
 * @yields {Array} - An array containing the x and y coordinates of a generated point
 */
function* poissonDiscSampler(x0: number, y0: number, x1: number, y1: number, r: number, k = 3) {
  if (!(x1 >= x0) || !(y1 >= y0) || !(r > 0)) throw new Error();

  const width = x1 - x0;
  const height = y1 - y0;
  const r2 = r * r;
  const r2_3 = 3 * r2;
  const cellSize = r * Math.SQRT1_2;
  const gridWidth = Math.ceil(width / cellSize);
  const gridHeight = Math.ceil(height / cellSize);
  const grid = new Array(gridWidth * gridHeight);
  const queue: [number, number][] = [];

  function far(x: number, y: number) {
    const i = (x / cellSize) | 0;
    const j = (y / cellSize) | 0;
    const i0 = Math.max(i - 2, 0);
    const j0 = Math.max(j - 2, 0);
    const i1 = Math.min(i + 3, gridWidth);
    const j1 = Math.min(j + 3, gridHeight);
    for (let j = j0; j < j1; ++j) {
      const o = j * gridWidth;
      for (let i = i0; i < i1; ++i) {
        const s = grid[o + i];
        if (s) {
          const dx = s[0] - x;
          const dy = s[1] - y;
          if (dx * dx + dy * dy < r2) return false;
        }
      }
    }
    return true;
  }

  function sample(x: number, y: number): [number, number] {
    const point: [number, number] = [x, y];
    grid[gridWidth * ((y / cellSize) | 0) + ((x / cellSize) | 0)] = point;
    queue.push(point);
    return [x + x0, y + y0];
  }

  yield sample(width / 2, height / 2);

  pick: while (queue.length) {
    const i = (Math.random() * queue.length) | 0;
    const parent = queue[i];

    for (let j = 0; j < k; ++j) {
      const a = 2 * Math.PI * Math.random();
      const r = Math.sqrt(Math.random() * r2_3 + r2);
      const x = parent[0] + r * Math.cos(a);
      const y = parent[1] + r * Math.sin(a);
      if (0 <= x && x < width && 0 <= y && y < height && far(x, y)) {
        yield sample(x, y);
        continue pick;
      }
    }

    const r = queue.pop();
    if (r !== undefined && i < queue.length) queue[i] = r;
  }
}
