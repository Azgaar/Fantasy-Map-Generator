import { extent, polygonContains } from "d3";
import { getPackPolygon, minmax, poissonDiscSampler, rand, rn } from "@/utils";

declare global {
  var Relief: ReliefModule;
}

// variants available per icon type in the colored and gray sets
const VARIANTS: Record<string, [number, number]> = {
  mount: [2, 7],
  mountSnow: [1, 6],
  hill: [2, 5],
  conifer: [2, 2],
  coniferSnow: [1, 1],
  swamp: [2, 3],
  cactus: [1, 3],
  deadTree: [1, 2]
};
const DEFAULT_VARIANT: [number, number] = [2, 2];

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

    const getIcon = (type: string): string => this.getIcon(type, set);

    const getBiomeIcon = (cellIndex: number, biomeIcons: string[]): string => {
      let type = biomeIcons[Math.floor(Math.random() * biomeIcons.length)];
      const temp = grid.cells.temp[cells.g[cellIndex]];
      if (type === "conifer" && temp < 0) type = "coniferSnow";
      return getIcon(type);
    };

    const getReliefIcon = (cellIndex: number, h: number): [string, number] => {
      const temp = grid.cells.temp[cells.g[cellIndex]];
      const type = h > 70 && temp < 0 ? "mountSnow" : h > 70 ? "mount" : "hill";
      const size = h > 70 ? (h - 45) * sizeModifier : minmax((h - 40) * sizeModifier, 3, 6);
      return [getIcon(type), size];
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
          let h = (4 + Math.random()) * iconSize;
          const icon = getBiomeIcon(i, pack.biomes[biome].icons);
          if (icon === "relief-grass-1") h *= 1.2;
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

  changeSet(set: string): void {
    for (const icon of pack.relief || []) {
      const [, type, variant] = icon.icon.match(/^relief-(\w+?)-(\d+)/) || [];
      if (!type) continue;
      icon.icon = this.getIcon(type, set, Number(variant));
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

  private getIcon(type: string, set: string, variant?: number): string {
    if (set === "simple") return `relief-${this.getSimpleIcon(type)}-1`;
    const [min, max] = VARIANTS[type] || DEFAULT_VARIANT;
    const valid = variant && variant >= min && variant <= max ? variant : this.getVariant(type);
    return set === "gray" ? `relief-${type}-${valid}-bw` : `relief-${type}-${valid}`;
  }

  private getVariant(type: string): number {
    const [min, max] = VARIANTS[type] || DEFAULT_VARIANT;
    return min === max ? min : rand(min, max);
  }

  // the simple set has a single variant per type, some types fall back to a similar one
  private getSimpleIcon(type: string): string {
    switch (type) {
      case "mountSnow":
      case "vulcan":
        return "mount";
      case "coniferSnow":
        return "conifer";
      case "cactus":
      case "deadTree":
        return "dune";
      default:
        return type;
    }
  }
}

window.Relief = new ReliefModule();
