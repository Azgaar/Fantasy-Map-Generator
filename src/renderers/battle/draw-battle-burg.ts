// Burgs on a battle field as rooftops: the roads that meet in a burg are its main streets, blocks of houses round yards
// between them. Drawn once with the ground and never read by the battle. See docs/domain/battles.md

import { Delaunay, polygonArea, polygonCentroid, polygonContains } from "d3";
import { type Battlefield, Battlefields } from "@/model/political/battle/battlefield";
import { ROAD } from "@/renderers/battle/draw-battle-ground";
import type { Point } from "@/types/global";
import { walkLine } from "@/utils/path-utils";

const BLOCK = [13, 8.5]; // points a block is across at the least, or the burg's radius over this
const LANE = [1.4, 0.1]; // points between the houses of two blocks at the least, or of a block
const HOUSE = [0.27, 0.2]; // of a block: a house's front and its depth
const WALK = 2.4; // points kept clear inside a wall
const TOUCH = 0.01; // houses in a row share a wall: so much overlap is a touch
const GROUND = "#efe8d8";
const GROUND_OPACITY = 0.9;
const YARD = "#e6dfca";
const ROOFS = ["#c98b6b", "#cfb886", "#9da3a5"]; // tile, thatch toward the edge, some slate
const EAVES = "#66513f"; // the roofs' outline
const EAVES_WIDTH = 0.3; // points

class BattleBurgRenderer {
  /**
   * A burg's yards, roofs and the streets from gates no road comes in by, drawn under the roads; and its plaza, drawn over
   * them. The same for the same burg
   */
  getMarkup(field: Battlefield, index: number, pt: number): { burg: string; plaza: string } {
    const { x, y, outline, radius, walled } = field.burgs[index];
    const [sx, sy] = outline[0].map(v => Math.round(v * 10));
    let rolls = 0;
    const random = (): number => Battlefields.mix(sx, sy, rolls++);
    const block = Math.max(BLOCK[0] * pt, radius / BLOCK[1]);
    const lane = Math.max(LANE[0] * pt, block * LANE[1]);
    const [[casing, road], [paving, way]] = ROAD.map(([color, width]) => [color, width * pt] as const);
    const [front, depth] = HOUSE.map(share => share * block);
    const walk = walled ? WALK * pt : 0;
    const ring = [...outline, outline[0]];
    const isIn = (point: Point): boolean => polygonContains(outline, point);
    const toEdge = (point: Point): number => Battlefields.distanceToLine(point, ring);
    const centre: Point = isIn([x, y]) ? [x, y] : polygonCentroid(outline);
    const roadways = this.getRoadways(field, index);
    const lanes = this.getLanes(field, index, roadways, block, centre);
    const streets = [...roadways, ...lanes];

    // the plaza in the middle, blocks in pairs along the streets, the rest thrown loosely
    const seeds: Point[] = [centre];
    const isFree = (point: Point, apart: number): boolean => seeds.every(seed => distance(seed, point) >= apart);
    for (const way of streets) {
      walkLine(way, block * 0.95, (at, [ux, uy]) => {
        if (distance(at, centre) < block * 0.9) return;
        const along = (random() - 0.5) * block * 0.16;
        for (const side of [1, -1]) {
          const seed: Point = [
            at[0] - (uy * side * block) / 2 + ux * along,
            at[1] + (ux * side * block) / 2 + uy * along
          ];
          if (isFree(seed, block * 0.55)) seeds.push(seed);
        }
      });
    }
    const [xs, ys] = [0, 1].map(axis => outline.map(point => point[axis]));
    const box = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map(
      (v, i) => v + (i < 2 ? -3 : 3) * block
    );
    const [width, height] = [box[2] - box[0], box[3] - box[1]];
    for (let tries = Math.round(((width * height) / block ** 2) * 16); tries > 0; tries--) {
      const seed: Point = [box[0] + random() * width, box[1] + random() * height];
      const apart = block * (0.7 + 0.45 * random());
      if (!isIn(seed) && toEdge(seed) > block * 1.8) continue;
      if (distance(seed, centre) < block * 1.15) continue;
      if (streets.some(way => Battlefields.distanceToLine(seed, way) < block * 0.82)) continue;
      if (isFree(seed, apart)) seeds.push(seed);
    }

    // a block is the cell of a seed within the burg; houses line its edges inside it, an open burg
    // thinning out at its edge
    const voronoi = Delaunay.from(seeds).voronoi(box as [number, number, number, number]);
    const keeps = (point: Point): boolean =>
      isIn(point) &&
      (walled
        ? toEdge(point) > walk + depth * 0.55
        : random() < 0.4 + 0.6 * Math.min(toEdge(point) / (0.3 * radius), 1));
    const isWet = ([px, py]: Point): boolean => field.water[Battlefields.nodeAt(field, px, py)] === 1;
    let yards = "";
    // a roof laid over another is drawn a layer above it, covering its outline; no two roofs of a layer overlap
    const roofs: string[][] = [];
    const addRoof = (house: Point[], kind: number, layer = 0): void => {
      roofs[layer] ??= ROOFS.map(() => "");
      roofs[layer][kind] += toPath(house);
    };
    for (let i = 1; i < seeds.length; i++) {
      const placed: { house: Point[]; layer: number }[] = [];
      const cell = voronoi.cellPolygon(i)?.slice(0, -1) as Point[] | undefined;
      if (!cell) continue;
      const middle = polygonCentroid(cell);
      if (!isIn(middle) || (walled ? toEdge(middle) < block * 0.22 : cell.some(isWet))) continue;
      const area = Math.abs(polygonArea(cell));
      if (area < block ** 2 * 0.06) continue;
      yards += toPath(cell);
      const far = distance(middle, centre) / radius;
      const roof = (): number => {
        const roll = random();
        return roll < 0.12 ? 2 : roll < 0.2 + far * 0.55 ? 1 : 0;
      };
      if (area < front * depth * 3.4) {
        if (keeps(middle))
          addRoof(
            cell.map(point => lerp(middle, point, 0.7)),
            roof()
          );
        continue;
      }
      const fits = (house: Point[]): boolean => house.every(point => polygonContains(cell, point));
      for (let k = 0; k < cell.length; k++) {
        const [a, b] = [cell[k], cell[(k + 1) % cell.length]];
        const length = distance(a, b);
        if (length < front * 1.05) continue;
        const u: Point = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
        const inward = (middle[0] - a[0]) * -u[1] + (middle[1] - a[1]) * u[0] > 0 ? 1 : -1;
        const n: Point = [-u[1] * inward, u[0] * inward];
        const at = (s: number, d: number): Point => [a[0] + u[0] * s + n[0] * d, a[1] + u[1] * s + n[1] * d];
        const onStreet = streets.some(street => Battlefields.distanceToLine(lerp(a, b, 0.5), street) < road);
        const face = onStreet ? (road + lane) / 2 : lane / 2; // back from the street's edge, or half a lane in
        const end = length - depth * 0.9; // the next edge's houses take the corner
        for (let along = 0; along < end - front * 0.55; ) {
          let wide = front * (0.7 + random() * 0.9);
          if (end - along - wide < front * 0.55) wide = end - along;
          const deep = depth * (0.8 + random() * 0.5);
          const skip = random() < 0.08;
          // shallower where it would not fit
          const house = [deep, depth * 0.55]
            .map(d => [at(along, face), at(along + wide, face), at(along + wide, face + d), at(along, face + d)])
            .find(fits);
          along += wide;
          if (skip || !house || !keeps(lerp(house[0], house[2], 0.5))) continue;
          const layer =
            Math.max(-1, ...placed.filter(other => overlaps(house, other.house)).map(other => other.layer)) + 1;
          placed.push({ house, layer });
          addRoof(house, roof(), layer);
        }
      }
    }

    // the ground faintly shows through the burg's; its streets and plaza are paved like the roads, the plaza's kerb under
    // the roads, so they run into it unbroken
    const edge = toPath(outline);
    const ways = lanes.map(lane => `M${lane.map(format).join("L")}`).join("");
    const square = toPath((voronoi.cellPolygon(0) ?? []).slice(0, -1) as Point[]);
    const clip = walled ? ` clip-path="url(#battleBurgClip${index})"` : "";
    const ground = walled
      ? `<path d="${edge}" fill="${GROUND}"/><path d="${yards}" fill="${YARD}"/><path d="${edge}" fill="none" stroke="${GROUND}" stroke-width="${walk * 2}"/>`
      : `<path d="${yards}" fill="${YARD}"/>`;
    const markup = /* html */ `<g opacity="${GROUND_OPACITY}">${ground}</g>
      <g fill="none" stroke-linecap="round" stroke-linejoin="round">
        <path d="${ways}" stroke="${casing}" stroke-width="${road}"/>
        <path d="${square}" stroke="${casing}" stroke-width="${road - way}"/>
        <path d="${ways}" stroke="${paving}" stroke-width="${way}"/>
      </g>
      <g stroke="${EAVES}" stroke-width="${EAVES_WIDTH * pt}" stroke-linejoin="round">${roofs.flatMap(layer => ROOFS.map((fill, k) => (layer[k] ? `<path d="${layer[k]}" fill="${fill}"/>` : ""))).join("")}</g>`;
    const plaza = `<path d="${square}" fill="${paving}"${clip}/>`;
    if (!walled) return { burg: markup, plaza };
    const burg = /* html */ `<clipPath id="battleBurgClip${index}"><path d="${edge}"/></clipPath>
      <g${clip}>${markup}</g>`;
    return { burg, plaza };
  }

  /** A street from each gate no road comes in by to the middle */
  private getLanes(field: Battlefield, index: number, roadways: Point[][], block: number, centre: Point): Point[][] {
    const lanes: Point[][] = [];
    for (const gate of Battlefields.getGates(field, index)) {
      const at = lerp(gate.a, gate.b, 0.5);
      if ([...roadways, ...lanes].every(way => Battlefields.distanceToLine(at, way) > block * 1.2))
        lanes.push([at, centre]);
    }
    return lanes;
  }

  /** The roads within the burg */
  private getRoadways(field: Battlefield, index: number): Point[][] {
    const { outline } = field.burgs[index];
    const isIn = (point: Point): boolean => polygonContains(outline, point);
    const cross = (a: Point, b: Point): Point => {
      let [lo, hi] = [0, 1];
      for (let i = 0; i < 12; i++) {
        const mid = (lo + hi) / 2;
        if (isIn(lerp(a, b, mid)) === isIn(a)) lo = mid;
        else hi = mid;
      }
      return lerp(a, b, lo);
    };
    const streets: Point[][] = [];
    for (const road of field.roads) {
      const inside = road.map(isIn);
      let run: Point[] = [];
      road.forEach((point, i) => {
        if (i && inside[i] !== inside[i - 1]) run.push(cross(road[i - 1], point));
        if (inside[i]) run.push(point);
        else if (run.length) {
          streets.push(run);
          run = [];
        }
      });
      if (run.length > 1) streets.push(run);
    }
    return streets;
  }
}

export const BattleBurgView = new BattleBurgRenderer();

function distance(a: Point, b: Point): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

function lerp(a: Point, b: Point, t: number): Point {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** Whether two convex shapes overlap by more than a touch: no side of either parts them */
function overlaps(a: Point[], b: Point[]): boolean {
  for (const shape of [a, b]) {
    for (let i = 0; i < shape.length; i++) {
      const [p, q] = [shape[i], shape[(i + 1) % shape.length]];
      const length = distance(p, q);
      if (!length) continue;
      const [nx, ny] = [(p[1] - q[1]) / length, (q[0] - p[0]) / length];
      const [pa, pb] = [a, b].map(points => points.map(([x, y]) => x * nx + y * ny));
      if (Math.min(...pa) >= Math.max(...pb) - TOUCH || Math.min(...pb) >= Math.max(...pa) - TOUCH) return false;
    }
  }
  return true;
}

function format([x, y]: Point): string {
  return `${x.toFixed(1)},${y.toFixed(1)}`;
}

function toPath(points: Point[]): string {
  return points.length ? `M${points.map(format).join("L")}Z` : "";
}
