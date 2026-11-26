// Where on the map a battle is fought. Kept apart from the battlefield, so the map's screens ask it without loading the battle

import { Pack } from "@/model/graph/pack-generator";
import { Coastline } from "@/model/physical/coastline-generator";
import { Names } from "@/model/society/names-generator";
import type { Point } from "@/types/global";

class BattleSiteModule {
  /** The shore nearest a point, of the sea or a lake with water, a cell and a half off at most; null when there is none */
  getShore([x, y]: Point): Point | null {
    const spacing = this.getSpacing();
    let [best, least]: [Point | null, number] = [null, spacing * 1.5];
    for (const f of new Set(Pack.findAll(x, y, least).map(i => pack.cells.f[i]))) {
      const feature = pack.features[f];
      if (!feature || !(feature.land || this.isWater(feature))) continue;
      const outline = Coastline.getFeatureShape(feature).points.map(([px, py]): Point => [px, py]);
      if (outline.length < 2) continue;
      for (let i = 0; i < outline.length; i++) {
        const point = this.nearestOnLine([x, y], [outline[i], outline[(i + 1) % outline.length]]);
        const distance = Math.hypot(point[0] - x, point[1] - y);
        if (distance >= least) continue;
        // land cut off by the map's edge has no water by it
        if (feature.land && !Pack.findAll(...point, spacing).some(c => this.isWater(pack.features[pack.cells.f[c]])))
          continue;
        [best, least] = [point, distance];
      }
    }
    return best;
  }

  /** What a battle is named after: the burg, the river or the land, whose name is rolled */
  getPlaceName(cell: number): string | null {
    const { cells } = pack;
    if (cells.burg[cell]) return pack.burgs[cells.burg[cell]].name ?? null;
    const river = cells.r[cell] && pack.rivers.find(river => river.i === cells.r[cell]);
    if (river) return `${river.name} ${river.type}`;
    return Names.getCulture(cells.culture[cell]);
  }

  /** A road or a trail leads through the cell: a column on the march can be caught there */
  hasRoad(cell: number): boolean {
    return pack.routes.some(route => route.group !== "searoutes" && route.points.some(point => point[2] === cell));
  }

  /** The sea, or a lake that is not dry */
  private isWater(feature: (typeof pack.features)[number]): boolean {
    return Boolean(feature) && !feature.land && !(feature.type === "lake" && feature.subtype === "dry");
  }

  /** The distance between the map's cells */
  getSpacing(): number {
    return Math.sqrt((options.map.graph.width * options.map.graph.height) / pack.cells.i.length);
  }

  /** The point of a polyline nearest a point */
  nearestOnLine(point: Point, line: Point[]): Point {
    let best: Point = line[0];
    let distance = Infinity;
    for (let i = 1; i < line.length; i++) {
      const [ax, ay] = line[i - 1];
      const [bx, by] = line[i];
      const dx = bx - ax;
      const dy = by - ay;
      const length = dx * dx + dy * dy;
      const t = length ? Math.min(Math.max(((point[0] - ax) * dx + (point[1] - ay) * dy) / length, 0), 1) : 0;
      const at: Point = [ax + dx * t, ay + dy * t];
      const away = Math.hypot(point[0] - at[0], point[1] - at[1]);
      if (away < distance) [best, distance] = [at, away];
    }
    return best;
  }
}

export const BattleSite = new BattleSiteModule();
