import { extent, polygonContains } from "d3";
import {
  byId,
  getPackPolygon,
  minmax,
  poissonDiscSampler,
  rand,
  rn,
} from "../utils";

export interface ReliefIcon {
  i: number;
  href: string; // e.g. "#relief-mount-1"
  x: number;
  y: number;
  s: number; // size (width = height in map units)
}

export function generateRelief(): ReliefIcon[] {
  TIME && console.time("generateRelief");

  const cells = pack.cells;
  const terrain = byId("terrain");
  if (!terrain) throw new Error("Terrain element not found");

  const set = terrain.getAttribute("set") || "simple";
  const density = Number(terrain.getAttribute("density")) || 0.4;
  const size = 2 * (Number(terrain.getAttribute("size")) || 1);
  const mod = 0.2 * size;

  const reliefIcons: ReliefIcon[] = [];

  for (const i of cells.i) {
    const height = cells.h[i];
    if (height < 20 || cells.r[i]) continue;
    const biome = cells.biome[i];
    if (height < 50 && biomesData.iconsDensity[biome] === 0) continue;

    const polygon = getPackPolygon(i, pack);
    const [minX, maxX] = extent(polygon, (p) => p[0]);
    const [minY, maxY] = extent(polygon, (p) => p[1]);
    if (
      minX === undefined ||
      minY === undefined ||
      maxX === undefined ||
      maxY === undefined
    )
      continue;

    if (height < 50) {
      const iconsDensity = biomesData.iconsDensity[biome] / 100;
      const radius = 2 / iconsDensity / density;
      if (Math.random() > iconsDensity * 10) continue; // skip very low density icons

      for (const [cx, cy] of poissonDiscSampler(
        minX,
        minY,
        maxX,
        maxY,
        radius,
      )) {
        if (!polygonContains(polygon, [cx, cy])) continue;
        let h = (4 + Math.random()) * size;
        const icon = getBiomeIcon(i, biome);
        if (icon === "#relief-grass-1") h *= 1.2;
        reliefIcons.push({
          i: reliefIcons.length,
          href: icon,
          x: rn(cx - h, 2),
          y: rn(cy - h, 2),
          s: rn(h * 2, 2),
        });
      }
    } else {
      const radius = 2 / density;
      const [icon, h] = getReliefIconForCell(i, height);
      for (const [cx, cy] of poissonDiscSampler(
        minX,
        minY,
        maxX,
        maxY,
        radius,
      )) {
        if (!polygonContains(polygon, [cx, cy])) continue;
        reliefIcons.push({
          i: reliefIcons.length,
          href: icon,
          x: rn(cx - h, 2),
          y: rn(cy - h, 2),
          s: rn(h * 2, 2),
        });
      }
    }
  }

  reliefIcons.sort((a, b) => a.y + a.s - (b.y + b.s));
  pack.relief = reliefIcons;

  TIME && console.timeEnd("generateRelief");
  return reliefIcons;

  function getReliefIconForCell(
    cellIndex: number,
    h: number,
  ): [string, number] {
    const temp = grid.cells.temp[pack.cells.g[cellIndex]];
    const type = h > 70 && temp < 0 ? "mountSnow" : h > 70 ? "mount" : "hill";
    const iconSize = h > 70 ? (h - 45) * mod : minmax((h - 40) * mod, 3, 6);
    return [getHref(type, set), iconSize];
  }

  function getBiomeIcon(cellIndex: number, biome: number): string {
    const b = biomesData.icons[biome];
    let type = b[Math.floor(Math.random() * b.length)];
    const temp = grid.cells.temp[pack.cells.g[cellIndex]];
    if (type === "conifer" && temp < 0) type = "coniferSnow";
    return getHref(type, set);
  }
}

// ── Utilities ─────────────────────────────────────────────────────────
export const RELIEF_SYMBOLS: Record<string, string[]> = {
  simple: [
    "relief-mount-1",
    "relief-hill-1",
    "relief-conifer-1",
    "relief-deciduous-1",
    "relief-acacia-1",
    "relief-palm-1",
    "relief-grass-1",
    "relief-swamp-1",
    "relief-dune-1",
  ],
  gray: [
    "relief-mount-2-bw",
    "relief-mount-3-bw",
    "relief-mount-4-bw",
    "relief-mount-5-bw",
    "relief-mount-6-bw",
    "relief-mount-7-bw",
    "relief-mountSnow-1-bw",
    "relief-mountSnow-2-bw",
    "relief-mountSnow-3-bw",
    "relief-mountSnow-4-bw",
    "relief-mountSnow-5-bw",
    "relief-mountSnow-6-bw",
    "relief-hill-2-bw",
    "relief-hill-3-bw",
    "relief-hill-4-bw",
    "relief-hill-5-bw",
    "relief-conifer-2-bw",
    "relief-coniferSnow-1-bw",
    "relief-swamp-2-bw",
    "relief-swamp-3-bw",
    "relief-cactus-1-bw",
    "relief-cactus-2-bw",
    "relief-cactus-3-bw",
    "relief-deadTree-1-bw",
    "relief-deadTree-2-bw",
    "relief-vulcan-1-bw",
    "relief-vulcan-2-bw",
    "relief-vulcan-3-bw",
    "relief-dune-2-bw",
    "relief-grass-2-bw",
    "relief-acacia-2-bw",
    "relief-palm-2-bw",
    "relief-deciduous-2-bw",
    "relief-deciduous-3-bw",
  ],
  colored: [
    "relief-mount-2",
    "relief-mount-3",
    "relief-mount-4",
    "relief-mount-5",
    "relief-mount-6",
    "relief-mount-7",
    "relief-mountSnow-1",
    "relief-mountSnow-2",
    "relief-mountSnow-3",
    "relief-mountSnow-4",
    "relief-mountSnow-5",
    "relief-mountSnow-6",
    "relief-hill-2",
    "relief-hill-3",
    "relief-hill-4",
    "relief-hill-5",
    "relief-conifer-2",
    "relief-coniferSnow-1",
    "relief-swamp-2",
    "relief-swamp-3",
    "relief-cactus-1",
    "relief-cactus-2",
    "relief-cactus-3",
    "relief-deadTree-1",
    "relief-deadTree-2",
    "relief-vulcan-1",
    "relief-vulcan-2",
    "relief-vulcan-3",
    "relief-dune-2",
    "relief-grass-2",
    "relief-acacia-2",
    "relief-palm-2",
    "relief-deciduous-2",
    "relief-deciduous-3",
  ],
};

// map a symbol href to its atlas set and tile index
export function resolveSprite(symbolHref: string): {
  set: string;
  tileIndex: number;
} {
  const id = symbolHref.startsWith("#") ? symbolHref.slice(1) : symbolHref;
  for (const [set, ids] of Object.entries(RELIEF_SYMBOLS)) {
    const idx = ids.indexOf(id);
    if (idx !== -1) return { set, tileIndex: idx };
  }
  throw new Error(`Relief: unknown symbol href "${symbolHref}"`);
}

const VARIANT_RANGES: Record<string, [number, number]> = {
  mount: [2, 7],
  mountSnow: [1, 6],
  hill: [2, 5],
  conifer: [2, 2],
  coniferSnow: [1, 1],
  swamp: [2, 3],
  cactus: [1, 3],
  deadTree: [1, 2],
  vulcan: [1, 3],
  deciduous: [2, 3],
};

const COLORED_TO_SIMPLE_MAP: Record<string, string> = {
  mountSnow: "mount",
  vulcan: "mount",
  coniferSnow: "conifer",
  cactus: "dune",
  deadTree: "dune",
};

function getVariant(type: string): number {
  const range = VARIANT_RANGES[type];
  return range ? rand(...range) : 2;
}

function getHref(type: string, set: string): string {
  if (set === "colored") return `#relief-${type}-${getVariant(type)}`;
  if (set === "gray") return `#relief-${type}-${getVariant(type)}-bw`;
  return `#relief-${COLORED_TO_SIMPLE_MAP[type] ?? type}-1`;
}

window.generateReliefIcons = generateRelief;

declare global {
  var generateReliefIcons: () => ReliefIcon[];
}
