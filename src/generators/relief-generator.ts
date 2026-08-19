import { extent, polygonContains } from "d3";
import { RELIEF_ICONS, RELIEF_SETS } from "@/data/relief-icons";
import type { ReliefSet, ReliefTypeIcons } from "@/types/relief";
import { getPackPolygon, minmax, poissonDiscSampler, ra, rn } from "@/utils";

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
    const { set, size, density } = style.relief;
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

      const polygon = getPackPolygon(i, pack);
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
