import { extent, polygonContains } from "d3";
import type { ReliefRule } from "@/components/options-schema";
import { RELIEF_SETS } from "@/data/style-choices";
import type { IconAlias, IconSet } from "@/types/icons";
import { minmax, rn } from "@/utils";

const TYPES = [
  { type: "mount", label: "Mountain", variants: 6 },
  { type: "mountSnow", label: "Snowy mountain", variants: 6, fallback: "mount" },
  { type: "vulcan", label: "Volcano", variants: 3, fallback: "mount" },
  { type: "hill", label: "Hill", variants: 4 },
  { type: "dune", label: "Dune", variants: 1 },
  { type: "deciduous", label: "Deciduous tree", variants: 2 },
  { type: "conifer", label: "Conifer", variants: 1 },
  { type: "coniferSnow", label: "Snowy conifer", variants: 1, fallback: "conifer" },
  { type: "acacia", label: "Acacia", variants: 1 },
  { type: "palm", label: "Palm", variants: 1 },
  { type: "grass", label: "Grass", variants: 1 },
  { type: "swamp", label: "Swamp", variants: 2 },
  { type: "cactus", label: "Cactus", variants: 3, fallback: "dune" },
  { type: "deadTree", label: "Dead tree", variants: 2, fallback: "dune" }
] as const;

export type ReliefSet = (typeof RELIEF_SETS)[number];
export type ReliefIconSetId = `relief-${ReliefSet}`;
export type ReliefIconType = (typeof TYPES)[number]["type"];

export interface ReliefType {
  type: ReliefIconType;
  label: string;
  variants: number; // widest coverage across the sets
  fallback?: ReliefIconType;
}
TYPES satisfies readonly ReliefType[];
/** what slot aliasing reads of a type */
type SlotCatalogEntry = Pick<ReliefType, "type" | "variants" | "fallback">;

// the map stores this ref as it is; the renderer resolves the absent variant to 1 and the absent set to the style
export type ReliefIconRef = { type: ReliefIconType; variant?: number; set?: ReliefSet };
/** a feature drawn with any Icon Library icon instead of a type slot */
export type ReliefLibraryRef = { icon: string };
export type ReliefIcon = (ReliefIconRef | ReliefLibraryRef) & { x: number; y: number; s: number };
/** how often a pool entry is picked, relative to the others, and its icon size as a multiple of the pool's (absent is 1) */
export type ReliefPoolEntry = { weight: number; size?: number };
/** a biome's relief pool: relief types and icon references, each with its weight and size */
export type ReliefPool = Record<string, ReliefPoolEntry>;

const SIZE_GROWTH = 0.8; // what a rule's icon size gains per height unit above the rule's lowest height

export class ReliefModel {
  readonly sets = RELIEF_SETS;
  readonly types = TYPES;
  /** one icon set per relief set: its directory, plus a symbol for every union slot it draws no file for */
  readonly iconSets: readonly (IconSet & { id: ReliefIconSetId })[] = RELIEF_SETS.map(set => ({
    id: this.iconSetId(set),
    group: "Relief",
    aliases: (names: readonly string[]) => this.aliasSlots(set, names),
    paint: { stroke: "#5c5c70", strokeWidth: 1 } // the default relief style
  }));

  getDefaultRules(): ReliefRule[] {
    return structuredClone<ReliefRule[]>([
      {
        name: "Snowy mountains",
        height: { min: 71, max: 100 },
        density: 100,
        size: { min: 20.8, max: 44 },
        temperature: { min: null, max: -1 },
        icons: { mountSnow: { weight: 1 } }
      },
      {
        name: "Mountains",
        height: { min: 71, max: 100 },
        density: 100,
        size: { min: 20.8, max: 44 },
        temperature: { min: null, max: null },
        icons: { mount: { weight: 1 } }
      },
      {
        name: "Hills",
        height: { min: 50, max: 70 },
        density: 100,
        size: { min: 8, max: 12 },
        temperature: { min: null, max: null },
        icons: { hill: { weight: 1 } }
      }
    ]);
  }

  generate(): ReliefIcon[] {
    TIME && console.time("generateRelief");

    const relief: ReliefIcon[] = [];
    for (const i of pack.cells.i) this.placeCell(i, relief);

    // an icon whose box ends lower draws on top
    relief.sort(this.byBottom);
    pack.relief = relief;

    TIME && console.timeEnd("generateRelief");
    return relief;
  }

  /** the first relief rule a land cell matches; a cell no rule claims takes its biome's pool */
  claim(cell: number): ReliefRule | undefined {
    const height = pack.cells.h[cell];
    if (height < 20) return undefined;
    const temp = grid.cells.temp[pack.cells.g[cell]];
    const biome = pack.cells.biome[cell];
    const within = (value: number, { min, max }: { min: number | null; max: number | null }) =>
      (min === null || value >= min) && (max === null || value <= max);
    return options.map.relief.rules.find(
      rule =>
        within(height, rule.height) &&
        within(temp, rule.temperature) &&
        (!rule.biomes?.length || rule.biomes.includes(biome))
    );
  }

  /** a cell whose relief the biome's pool places */
  isPoolCell(cell: number, biome: number): boolean {
    return pack.cells.biome[cell] === biome && pack.cells.h[cell] >= 20 && !this.claim(cell);
  }

  /** the icons anchored on the given cells, placed there by generation or by hand */
  iconsOn(covers: (cell: number) => boolean): ReliefIcon[] {
    return pack.relief.filter(icon => {
      const cell = Pack.findCell(icon.x + icon.s / 2, icon.y + icon.s / 2);
      return cell !== undefined && covers(cell);
    });
  }

  /** place the given cells' relief anew by the current rules and pools; every other icon keeps its place and order */
  regenerate(covers: (cell: number) => boolean): void {
    const replaced = new Set(this.iconsOn(covers));
    const placed: ReliefIcon[] = [];
    for (const i of pack.cells.i) if (covers(i)) this.placeCell(i, placed);
    placed.sort(this.byBottom);
    // merged, not re-sorted: the kept icons may be in a hand-set order
    const merged: ReliefIcon[] = [];
    let next = 0;
    for (const kept of pack.relief) {
      if (replaced.has(kept)) continue;
      while (next < placed.length && this.byBottom(placed[next], kept) < 0) merged.push(placed[next++]);
      merged.push(kept);
    }
    pack.relief = merged.concat(placed.slice(next));
  }

  /** add an icon where its box bottom puts it in the drawing order */
  insert(icon: ReliefIcon): void {
    const bottom = this.bottomY(icon);
    let low = 0;
    let high = pack.relief.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (this.bottomY(pack.relief[mid]) <= bottom) low = mid + 1;
      else high = mid;
    }
    pack.relief.splice(low, 0, icon);
  }

  /** a pool entry for a roll in [0, 1): the cumulative weights split the range, so a default pool picks
   * exactly as its older list of repeated entries did */
  pickEntry(pool: ReliefPool, roll: number): string | undefined {
    const entries = Object.entries(pool).filter(([, { weight }]) => weight > 0);
    const target = roll * entries.reduce((total, [, { weight }]) => total + weight, 0);
    let cumulative = 0;
    for (const [entry, { weight }] of entries) {
      cumulative += weight;
      if (target < cumulative) return entry;
    }
    return undefined;
  }

  /** what a pool entry draws in the interface: a type in the style's set, or the reference itself */
  entrySymbol(entry: string, styleSet: ReliefSet): string {
    return this.isType(entry) ? this.symbolId({ type: entry }, styleSet) : entry;
  }

  labelOf(type: ReliefIconType): string {
    return TYPES.find(entry => entry.type === type)!.label;
  }

  private placeCell(i: number, relief: ReliefIcon[]): void {
    const cells = pack.cells;
    if (cells.h[i] < 20) return; // no icons on water
    if (cells.r[i]) return; // no icons on rivers
    const rule = this.claim(i);
    if (rule) this.placeRule(i, rule, relief);
    else this.placePool(i, relief);
  }

  /** an icon for a pool entry; an absent variant means 1, so it is only stored when it carries information */
  private entryIcon(entry: string): ReliefIconRef | ReliefLibraryRef {
    if (!this.isType(entry)) return { icon: entry };
    return this.ref(entry, 1 + Math.floor(Math.random() * this.variantsOf(entry)));
  }

  private placePool(i: number, relief: ReliefIcon[]): void {
    const biome = pack.biomes[pack.cells.biome[i]];
    if (!biome.iconsDensity || !this.pickEntry(biome.icons, 0)) return; // no icons for this biome

    if (Math.random() > (biome.iconsDensity / 100) * 10) return;

    for (const [cx, cy] of this.samplePoints(i, this.spacing(biome.iconsDensity))) {
      const base = this.poolSize(Math.random());
      const entry = this.pickEntry(biome.icons, Math.random())!;
      const s = base * (biome.icons[entry].size ?? 1);
      relief.push({ ...this.entryIcon(entry), x: rn(cx - s / 2, 2), y: rn(cy - s / 2, 2), s: rn(s, 2) });
    }
  }

  /** one entry and variant per cell, so a cell's relief is uniform; no roll is spent where there is no choice */
  private placeRule(i: number, rule: ReliefRule, relief: ReliefIcon[]): void {
    const entries = Object.keys(rule.icons).filter(entry => rule.icons[entry].weight > 0);
    if (!rule.density || !entries.length) return;
    if (rule.density < 10 && Math.random() > rule.density / 10) return;

    const entry = entries.length > 1 ? this.pickEntry(rule.icons, Math.random())! : entries[0];
    const icon = this.entryIcon(entry);
    const s = this.ruleSize(rule, pack.cells.h[i]) * (rule.icons[entry].size ?? 1);
    for (const [cx, cy] of this.samplePoints(i, this.spacing(rule.density))) {
      relief.push({ ...icon, x: rn(cx - s / 2, 2), y: rn(cy - s / 2, 2), s: rn(s, 2) });
    }
  }

  /** a biome pool's icon size for a roll in [0, 1), before its entry's size; styles.relief.options.size scales it at draw time */
  poolSize(roll: number): number {
    return (4 + roll) * 4;
  }

  /** a rule's icon size at a height, before its entry's size */
  ruleSize({ height, size }: ReliefRule, h: number): number {
    return minmax(size.min + SIZE_GROWTH * (h - height.min), size.min, size.max);
  }

  /** the least distance between the icons of a pool at a density */
  spacing(density: number): number {
    return 2 / (density / 100) / styles.relief.options.density;
  }

  /** Poisson-disc points over a box, to preview what a pool places */
  samplePatch(width: number, height: number, radius: number, random: () => number): Generator<[number, number]> {
    return poissonDiscSampler(0, 0, width, height, radius, 3, random);
  }

  /** Poisson-disc points inside the cell polygon */
  private *samplePoints(i: number, radius: number): Generator<[number, number]> {
    const polygon = Pack.getPolygon(i);
    const [minX, maxX] = extent(polygon, (p: number[]) => p[0]) as [number, number];
    const [minY, maxY] = extent(polygon, (p: number[]) => p[1]) as [number, number];
    for (const point of poissonDiscSampler(minX, minY, maxX, maxY, radius)) {
      if (polygonContains(polygon, point)) yield point;
    }
  }

  iconSetId(set: ReliefSet): ReliefIconSetId {
    return `relief-${set}`;
  }

  /** the icon reference a feature draws: its own, else its type's slot in its pinned or the style's set */
  symbolId(icon: ReliefIconRef | ReliefLibraryRef, styleSet: ReliefSet): string {
    if ("icon" in icon) return icon.icon;
    return `${this.iconSetId(icon.set ?? styleSet)}-${icon.type}-${icon.variant ?? 1}`;
  }

  /** every relief set a draw needs: the style's set plus each explicit pin in the map */
  requiredIconSets(icons: readonly (ReliefIconRef | ReliefLibraryRef)[], styleSet: ReliefSet): ReliefIconSetId[] {
    const sets = new Set<ReliefIconSetId>([this.iconSetId(styleSet)]);
    for (const icon of icons) if ("set" in icon && icon.set) sets.add(this.iconSetId(icon.set));
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
  aliasSlots(
    set: ReliefSet,
    artwork: readonly string[],
    catalog: readonly SlotCatalogEntry[] = this.types
  ): IconAlias[] {
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
    catalog: readonly SlotCatalogEntry[],
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

  bottomY(icon: ReliefIcon): number {
    return icon.y + icon.s;
  }

  /** z-order: an icon whose box ends lower draws later, so it covers the foot of the icons behind it */
  readonly byBottom = (a: ReliefIcon, b: ReliefIcon): number => this.bottomY(a) - this.bottomY(b);
}

declare global {
  var Relief: ReliefModel;
}

// biome-ignore lint/suspicious/noRedeclare: legacy seam
export const Relief = new ReliefModel();
window.Relief = Relief;

/**
 * mbostock's poissonDiscSampler implementation
 * Generates points using Poisson-disc sampling within a specified rectangle
 * @param {number} x0 - The minimum x coordinate of the rectangle
 * @param {number} y0 - The minimum y coordinate of the rectangle
 * @param {number} x1 - The maximum x coordinate of the rectangle
 * @param {number} y1 - The maximum y coordinate of the rectangle
 * @param {number} r - The minimum distance between points
 * @param {number} k - The number of attempts before rejection (default is 3)
 * @param {function} random - The random source (default is Math.random)
 * @yields {Array} - An array containing the x and y coordinates of a generated point
 */
function* poissonDiscSampler(x0: number, y0: number, x1: number, y1: number, r: number, k = 3, random = Math.random) {
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
    const i = (random() * queue.length) | 0;
    const parent = queue[i];

    for (let j = 0; j < k; ++j) {
      const a = 2 * Math.PI * random();
      const r = Math.sqrt(random() * r2_3 + r2);
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
