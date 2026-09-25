import { extent, polygonContains } from "d3";
import { RELIEF_SETS } from "@/data/style-choices";
import type { IconAlias, IconSet } from "@/types/icons";
import { minmax, rn } from "@/utils";

const TYPES = [
  { type: "mount", variants: 6 },
  { type: "mountSnow", variants: 6, fallback: "mount" },
  { type: "vulcan", variants: 3, fallback: "mount" },
  { type: "hill", variants: 4 },
  { type: "dune", variants: 1 },
  { type: "deciduous", variants: 2, zoom: 1.5 },
  { type: "conifer", variants: 1, zoom: 1.5 },
  { type: "coniferSnow", variants: 1, zoom: 1.5, fallback: "conifer" },
  { type: "acacia", variants: 1, zoom: 1.5 },
  { type: "palm", variants: 1, zoom: 1.5 },
  { type: "grass", variants: 1, zoom: 1.5 },
  { type: "swamp", variants: 2, zoom: 1.5 },
  { type: "cactus", variants: 3, zoom: 1.5, fallback: "dune" },
  { type: "deadTree", variants: 2, zoom: 1.5, fallback: "dune" }
] as const;

export type ReliefSet = (typeof RELIEF_SETS)[number];
export type ReliefIconSetId = `relief-${ReliefSet}`;
export type ReliefIconType = (typeof TYPES)[number]["type"];

export interface ReliefType {
  type: ReliefIconType;
  variants: number; // widest coverage across the sets
  zoom?: number; // editor preview magnification
  fallback?: ReliefIconType;
}
TYPES satisfies readonly ReliefType[];

// the map stores this ref as it is; the renderer resolves the absent variant to 1 and the absent set to the style
export type ReliefIconRef = { type: ReliefIconType; variant?: number; set?: ReliefSet };
export type ReliefIcon = ReliefIconRef & { x: number; y: number; s: number };

export class ReliefModel {
  readonly sets = RELIEF_SETS;
  readonly types = TYPES;
  /** one icon set per relief set: its directory, plus a symbol for every union slot it draws no file for */
  readonly iconSets: readonly (IconSet & { id: ReliefIconSetId })[] = RELIEF_SETS.map(set => ({
    id: this.iconSetId(set),
    folder: `relief/${set}`,
    aliases: (names: readonly string[]) => this.aliasSlots(set, names)
  }));

  generate(): ReliefIcon[] {
    TIME && console.time("generateRelief");

    const cells = pack.cells;
    const { density } = styles.relief.options;
    const iconSize = 2; // base footprint; styles.relief.options.size scales it at draw time
    const sizeModifier = 0.2 * iconSize;

    // an absent variant means 1, so it is only stored when it carries information
    const pickVariant = (type: ReliefIconType): ReliefIconRef =>
      this.ref(type, 1 + Math.floor(Math.random() * this.variantsOf(type)));
    const getBiomeIcon = (biomeIcons: string[]) => {
      const type = biomeIcons[Math.floor(Math.random() * biomeIcons.length)];
      return pickVariant(this.isType(type) ? type : "grass");
    };

    const getReliefIcon = (cellIndex: number, h: number) => {
      const temp = grid.cells.temp[cells.g[cellIndex]];
      const type = h > 70 && temp < 0 ? "mountSnow" : h > 70 ? "mount" : "hill";
      const size = h > 70 ? (h - 45) * sizeModifier : minmax((h - 40) * sizeModifier, 3, 6);
      return { ...pickVariant(type), size };
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
          const icon = getBiomeIcon(pack.biomes[biome].icons);
          const h = size;
          relief.push({ ...icon, x: rn(cx - h, 2), y: rn(cy - h, 2), s: rn(h * 2, 2) });
        }
      }

      function placeReliefIcons(): void {
        const radius = 2 / density;
        const { size: h, ...icon } = getReliefIcon(i, height);

        for (const [cx, cy] of poissonDiscSampler(minX, minY, maxX, maxY, radius)) {
          if (!polygonContains(polygon, [cx, cy])) continue;
          relief.push({ ...icon, x: rn(cx - h, 2), y: rn(cy - h, 2), s: rn(h * 2, 2) });
        }
      }
    }

    // an icon placed lower draws on top; see byAnchor for why the key is the centre, not the box bottom
    relief.sort(this.byAnchor);
    pack.relief = relief;

    TIME && console.timeEnd("generateRelief");
    return relief;
  }

  iconSetId(set: ReliefSet): ReliefIconSetId {
    return `relief-${set}`;
  }

  symbolId(icon: ReliefIconRef, styleSet: ReliefSet): string {
    return `${this.iconSetId(icon.set ?? styleSet)}-${icon.type}-${icon.variant ?? 1}`;
  }

  /** every icon set a draw needs: the style's set plus each explicit pin in the map */
  requiredIconSets(icons: readonly ReliefIconRef[], styleSet: ReliefSet): ReliefIconSetId[] {
    const sets = new Set<ReliefIconSetId>([this.iconSetId(styleSet)]);
    for (const icon of icons) if (icon.set) sets.add(this.iconSetId(icon.set));
    return [...sets];
  }

  /** the stored descriptor: an absent field means its default, so only informative fields are written */
  ref(type: ReliefIconType, variant = 1, set?: ReliefSet): ReliefIconRef {
    return { type, ...(variant > 1 ? { variant } : {}), ...(set ? { set } : {}) };
  }

  /**
   * The union slots a set draws no file for, each aliased to the set's own artwork. Exact art wins;
   * a type without any follows the catalog's fallback chain, and only real files are candidates.
   */
  aliasSlots(set: ReliefSet, artwork: readonly string[], catalog: readonly ReliefType[] = this.types): IconAlias[] {
    const slots: IconAlias[] = [];
    for (const { type, variants } of catalog) {
      for (let variant = 1; variant <= variants; variant++) {
        if (artwork.includes(`${type}-${variant}`)) continue;
        slots.push({ name: `${type}-${variant}`, target: this.resolveSlot(type, variant, artwork, catalog, set) });
      }
    }
    return slots;
  }

  private resolveSlot(
    type: ReliefIconType,
    variant: number,
    artwork: readonly string[],
    catalog: readonly ReliefType[],
    set: ReliefSet
  ): string {
    const visited = new Set<string>();
    let fallback: ReliefIconType | undefined = type;
    while (fallback && !visited.has(fallback)) {
      const name: ReliefIconType = fallback;
      visited.add(name);
      const candidates = artwork
        .filter(key => key.startsWith(`${name}-`))
        .sort((a, b) => Number(a.split("-").pop()) - Number(b.split("-").pop()));
      if (candidates.length) return candidates[(variant - 1) % candidates.length];
      fallback = catalog.find(entry => entry.type === name)?.fallback;
    }
    throw new Error(`No artwork for relief-${set}/${type}-${variant}`);
  }

  variantsOf(type: ReliefIconType): number {
    return TYPES.find(entry => entry.type === type)!.variants;
  }

  isType(type: string): type is ReliefIconType {
    return TYPES.some(entry => entry.type === type);
  }

  anchorY(icon: ReliefIcon): number {
    return icon.y + icon.s / 2;
  }

  /**
   * z-order: an icon placed lower draws later. The key is the anchor, the sampled cell point the box is
   * centred on — not the box bottom, which would add half the size and float big icons to the front.
   */
  readonly byAnchor = (a: ReliefIcon, b: ReliefIcon): number => this.anchorY(a) - this.anchorY(b);
}

declare global {
  var Relief: ReliefModel;
}

window.Relief = new ReliefModel();

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
