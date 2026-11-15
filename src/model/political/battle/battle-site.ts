// Where on the map a battle is fought. Kept apart from the battlefield, so the map's screens ask it without loading the battle

import { Pack } from "@/model/graph/pack-generator";
import { Coastline } from "@/model/physical/coastline-generator";
import type { Point } from "@/types/global";

class BattleSiteModule {
  /** The shore nearest a point, of land or a lake, a cell and a half off at most; null when there is none */
  getShore([x, y]: Point): Point | null {
    let [best, least]: [Point | null, number] = [null, this.getSpacing() * 1.5];
    for (const f of new Set(Pack.findAll(x, y, least).map(i => pack.cells.f[i]))) {
      const feature = pack.features[f];
      if (!feature || !(feature.land || feature.type === "lake")) continue;
      const outline = Coastline.getFeatureShape(feature).points.map(([px, py]): Point => [px, py]);
      if (outline.length < 2) continue;
      const point = this.nearestOnLine([x, y], [...outline, outline[0]]);
      const distance = Math.hypot(point[0] - x, point[1] - y);
      if (distance < least) [best, least] = [point, distance];
    }
    return best;
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
