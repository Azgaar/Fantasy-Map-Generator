import { extent, polygonContains } from "d3";
import { COLORED_TO_SIMPLE_MAP, VARIANT_RANGES } from "../config/relief-config";
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
