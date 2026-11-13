import { curveCatmullRom, line } from "d3";
import { clipPolygon } from "lineclip";
import { Pack } from "@/model/graph/pack-generator";
import { Coastline } from "@/model/physical/coastline-generator";
import { Rivers } from "@/model/physical/river-generator";
import type { Burg } from "@/model/political/burgs-generator";
import { getKmInDistanceUnit, heightToMeters } from "@/model/units";
import type { Point } from "@/types/global";
import { COLS, DEFAULT_BATTALION, type FieldSize, getFieldSize, ROWS } from "./battle-scale";

type Box = [number, number, number, number]; // x0, y0, x1, y1

// a grid node is smaller than a battalion is deep, so the ways round the terrain follow what is drawn
const SITE_SHIFT = 300; // a battle by a river is fought off it, at most

export interface FieldRiver {
  points: Point[];
  width: number;
  name: string;
  brook: boolean; // narrow enough to be waded anywhere
}

/** Where a road crosses a river */
export interface FieldBridge {
  x: number;
  y: number;
  angle: number; // of the road, radians
  length: number;
}

export interface FieldBurg {
  x: number;
  y: number;
  radius: number;
  name: string;
  group: string; // capital, city, town…
  walled: boolean;
  outline: Point[]; // its edge as drawn, closed; set by `raiseWalls`
}

/** A stretch of a burg's wall; a gate lets through those the burg is open to */
export interface FieldWall {
  a: Point;
  b: Point;
  burg: number; // index in the field's burgs
  gate: boolean;
  water: number; // what a gate opens on: 0 a road, 1 the sea or a lake, 2 a river
}

export interface FieldBreach {
  x: number;
  y: number;
  burg: number;
}

/** Ground of a battle: the map around its cell as the layout, with detail that is always the same for the place */
export interface Battlefield extends FieldSize {
  open: "sea" | "sky" | null; // no terrain: a naval or an air battle
  site: Point | null; // the map point a field of the map is built at
  biome: number;
  // one value per grid node, row by row
  elevation: number[]; // the lie of the land, 0 the lowest to 1 the highest
  relief: number; // metres from height 0 to height 1
  wood: number[];
  marsh: number[];
  water: number[]; // 1 sea or lake, 2 river
  ford: number[]; // a river shallow enough to wade
  deck: number[]; // a bridge over a river
  road: number[];
  town: number[];
  walled: number[]; // within the walls of a burg: its index + 1
  rampart: number[]; // by a wall 1, by a gate 2, in a breach 3
  rivers: FieldRiver[];
  roads: Point[][];
  bridges: FieldBridge[];
  burgs: FieldBurg[];
  walls: FieldWall[]; // what stands of them
  breaches: FieldBreach[];
  held: number | null; // the burg the defenders of a siege hold
}

export interface Terrain {
  height: number;
  wood: boolean;
  marsh: boolean;
  water: number;
  ford: boolean;
  deck: boolean; // on a bridge
  road: boolean;
  town: boolean;
  walled: number; // within the walls of a burg: its index + 1
  rampart: number; // by a wall 1, by a gate 2, in a breach 3
}

// a river by its width: a brook is waded anywhere, a wider one at its fords, the widest only bridged
const BROOK = 20;
const WADEABLE = 40;
const FORD = 72; // length of a ford along the river

// share of the ground under trees, by biome
const WOODS: Record<number, number> = { 3: 0.15, 4: 0.2, 5: 0.5, 6: 0.55, 7: 0.7, 8: 0.65, 9: 0.55, 10: 0.05, 12: 0.2 };
const FOREST_BIOMES = [5, 6, 7, 8, 9];

/** A field with no ground, of the size for battalions of the default size; `prepare` sizes it to its battle */
export function createEmptyBattlefield(open: Battlefield["open"] = null): Battlefield {
  const grid = (): number[] => new Array(COLS * ROWS).fill(0);
  return {
    open,
    site: null,
    ...getFieldSize(DEFAULT_BATTALION),
    biome: 4,
    elevation: grid(),
    relief: 0,
    wood: grid(),
    marsh: grid(),
    water: grid(),
    ford: grid(),
    deck: grid(),
    road: grid(),
    town: grid(),
    walled: grid(),
    rampart: grid(),
    rivers: [],
    roads: [],
    bridges: [],
    burgs: [],
    walls: [],
    breaches: [],
    held: null
  };
}

/** A field of the map not built yet: `prepare` builds it once the size of the battalions sets its size */
export function createMapField(x: number, y: number): Battlefield {
  return { ...createEmptyBattlefield(), site: [x, y], width: 0 };
}

/**
 * The map round a point at true scale: lines and coasts as the map draws them, the ground as it lies between the cell centres.
 * What the map is too coarse to show, hills, copses, bogs, the meanders of a river, comes from noise fixed by the place.
 * @param clearing keep the middle open for the lines to meet; an ambush wants the cover
 */
export function buildBattlefield(x: number, y: number, size: FieldSize, clearing = true): Battlefield {
  const field: Battlefield = { ...createEmptyBattlefield(), site: [x, y], ...size };
  const place: Point = [Math.round(x), Math.round(y)];
  const { cells } = pack;
  const { width, height, cell: step } = size;
  const cell = Pack.findCell(x, y);
  if (cell === undefined) return field;
  field.biome = cells.biome[cell];

  const pixel = options.map.units.distance.scale * (getKmInDistanceUnit() || 1) * 1000; // metres in a map pixel
  const [sx, sy] = findSite(cell, place, pixel);
  const toField = (mx: number, my: number): Point => [(mx - sx) * pixel + width / 2, (my - sy) * pixel + height / 2];
  const inView = ([fx, fy]: Point, margin = 0): boolean =>
    fx > -margin && fx < width + margin && fy > -margin && fy < height + margin;
  const spacing = getSpacing();
  // a port moved onto its shore takes the ends of its roads and rivers along, less and less over a cell
  const port = cells.burg[cell] ? pack.burgs[cells.burg[cell]] : null;
  const [ox, oy] = port ? [sx - port.x, sy - port.y] : [0, 0];
  const lineToField = (mx: number, my: number): Point => {
    const pull = port ? Math.max(1 - Math.hypot(mx - port.x, my - port.y) / spacing, 0) : 0;
    return toField(mx + ox * pull, my + oy * pull);
  };
  const nearby = Pack.findAll(sx, sy, spacing * 2 + width / pixel);
  if (!nearby.includes(cell)) nearby.push(cell);
  const nodes = Array.from({ length: COLS * ROWS }, (_, i) => nodeCentre(field, i));

  // land and water by the coasts as drawn
  const shapes = [...new Set(nearby.map(i => cells.f[i]))]
    .map(f => pack.features[f])
    .filter(feature => feature && (feature.land || feature.type === "lake"))
    .map(feature => ({
      land: feature.land,
      outline: clipPolygon(
        Coastline.getFeatureShape(feature).points.map(([px, py]) => toField(px, py)),
        [-step, -step, width + step, height + step]
      )
    }))
    .filter(shape => shape.outline.length > 2);
  const isLand = (node: Point): boolean =>
    shapes.some(shape => shape.land && isInside(node, shape.outline)) &&
    !shapes.some(shape => !shape.land && isInside(node, shape.outline));

  // the ground between the cell centres, within the triangle of the three cells round each node
  const triangles = [...new Set(nearby.flatMap(i => cells.v[i]))]
    .map(v => pack.vertices.c[v])
    .filter(corners => corners?.every(c => c < cells.i.length))
    .map(corners => ({ corners, points: corners.map(c => toField(cells.p[c][0], cells.p[c][1])) }));
  const interpolate = (node: Point): { h: number; trees: number; wet: number } => {
    for (const { corners, points } of triangles) {
      const weights = getBarycentric(node, points);
      if (!weights) continue;
      const sum = (value: (c: number) => number): number =>
        corners.reduce((total, c, k) => total + value(c) * weights[k], 0);
      return {
        h: sum(c => cells.h[c]),
        trees: sum(c => WOODS[cells.biome[c]] ?? 0),
        wet: sum(c => +(cells.biome[c] === 12))
      };
    }
    return { h: cells.h[cell], trees: WOODS[cells.biome[cell]] ?? 0, wet: +(cells.biome[cell] === 12) };
  };

  // hills below the map's grain: a tenth of the rise to the neighbours, 4 to 100 m
  const rise = cells.c[cell]
    .filter(c => cells.h[c] >= 20)
    .map(c => Math.abs(heightToMeters(cells.h[c]) - heightToMeters(cells.h[cell])));
  const roughness = Math.min(Math.max(Math.max(0, ...rise) / 10, 4), 100);
  const hills = createNoise(field, place, 1, 520);
  const knolls = createNoise(field, place, 7, 230); // off the lattice of the hills, so they do not stand in rows
  const groves = createNoise(field, place, 2, 260);
  const bogs = createNoise(field, place, 3, 220);

  const ground = nodes.map(node => {
    if (!isLand(node)) return null;
    const { h, trees, wet } = interpolate(node);
    return {
      height: heightToMeters(Math.max(h, 20)) + (hills(...node) * 0.65 + knolls(...node) * 0.35) * roughness,
      trees,
      wet
    };
  });
  const land = ground.filter(g => g !== null).map(g => g.height);
  const low = land.length ? Math.min(...land) : 0;
  const high = land.length ? Math.max(...land) : 0;
  field.relief = high - low;
  ground.forEach((g, i) => {
    if (!g) {
      field.water[i] = 1;
      return;
    }
    const [nx, ny] = nodes[i];
    field.elevation[i] = high > low ? (g.height - low) / (high - low) : 0;
    const fromCentre = Math.hypot((nx - width / 2) / width, (ny - height / 2) / height);
    const open = clearing ? Math.min(0.35 + fromCentre * 2.2, 1.15) : 1.15;
    if (groves(nx, ny) < g.trees * open) field.wood[i] = 1;
    else if (bogs(nx, ny) < g.wet * 0.6) field.marsh[i] = 1;
  });

  // roads and rivers on the curves the map draws them with
  const near = new Set(nearby);
  const margin = width * VIEW_MARGIN;
  const box: Box = [-margin, -margin, width + margin, height + margin];
  const touches = (a: Point, b: Point): boolean => clipSegment(a, b, box) !== null;
  for (const route of pack.routes) {
    if (route.group === "searoutes" || !route.points.some(p => near.has(p[2]))) continue;
    const course = route.points.map(p => lineToField(p[0], p[1]));
    const points = clipToView(smooth(sliceAround(course, touches), step / 2, box), box);
    if (points.length) field.roads.push(points);
  }

  pack.rivers.forEach((river, index) => {
    if (!river.cells.some(c => near.has(c))) return;
    const course = Rivers.addMeandering(river.cells, river.points ?? null);
    const points = course.map(p => lineToField(p[0], p[1]));
    const middle = nearestIndex(points, [width / 2, height / 2]);
    if (inView(points[0]) && points.length > 1) {
      // a spring on the field would look cut off: the river comes from beyond the edge
      const [px, py] = points[0];
      const [nx, ny] = points[Math.min(3, points.length - 1)];
      const length = Math.hypot(px - nx, py - ny) || 1;
      const reach = width + height;
      points.unshift([px + ((px - nx) / length) * reach, py + ((py - ny) / length) * reach]);
    }
    const line = clipToView(smooth(sliceAround(points, touches), step / 2, box), box);
    if (!line.length) return;
    const wide = Math.min(Math.max(12 + (Math.sqrt(course[middle][2]) * 2) / 3, 16), 52);
    // meanders some twelve widths long, too small for the map to show
    const winding = bend(line, wide * 12, wide * 2.5, place, 1000 + index);
    field.rivers.push({
      points: winding,
      width: wide,
      name: `${river.name} ${river.type}`.trim(),
      brook: wide <= BROOK
    });
  });

  for (const burg of pack.burgs) {
    if (!burg.i || burg.removed) continue;
    const [bx, by] = burg.i === cells.burg[cell] ? toField(sx, sy) : toField(burg.x, burg.y); // a port on its shore
    const radius = getBurgRadius(burg);
    if (!inView([bx, by], radius)) continue;
    field.burgs.push({
      x: bx,
      y: by,
      radius,
      name: burg.name ?? "",
      group: burg.group ?? "",
      walled: Boolean(burg.walls || burg.citadel),
      outline: []
    });
  }

  // a brook is waded anywhere, a river at a ford now and then, a great river nowhere: it wants a bridge
  const fords: { points: Point[]; width: number }[] = [];
  for (const [index, river] of field.rivers.entries()) {
    let count = 0;
    const chance = (): number => mix(place[0] + index, place[1], 4 + count++); // the same fords for the same place
    if (river.brook) fords.push(river);
    else if (river.width <= WADEABLE) {
      let next = 160 + chance() * 320;
      let walked = 0;
      for (let i = 1; i < river.points.length; i++) {
        const [ax, ay] = river.points[i - 1];
        const [bx, by] = river.points[i];
        const length = Math.hypot(bx - ax, by - ay);
        for (; next < walked + length; next += 480 + chance() * 400) {
          const at = (shift: number): Point => {
            const t = Math.min(Math.max((next - walked + shift) / (length || 1), 0), 1);
            return [ax + (bx - ax) * t, ay + (by - ay) * t];
          };
          if (inView(at(0))) fords.push({ points: [at(-FORD / 2), at(FORD / 2)], width: river.width });
        }
        walked += length;
      }
    }
  }

  // a road that crosses a river has a bridge there
  for (const road of field.roads) {
    for (const river of field.rivers) {
      for (let i = 1; i < road.length; i++) {
        for (let j = 1; j < river.points.length; j++) {
          const point = cross(road[i - 1], road[i], river.points[j - 1], river.points[j]);
          if (!point || !inView(point)) continue;
          if (field.bridges.some(b => Math.hypot(b.x - point[0], b.y - point[1]) < 16)) continue; // the same crossing
          const angle = Math.atan2(road[i][1] - road[i - 1][1], road[i][0] - road[i - 1][0]);
          field.bridges.push({ x: point[0], y: point[1], angle, length: river.width + 28 });
        }
      }
    }
  }

  // features onto the grid: a road cuts the wood and bridges the river where it crosses it; thin ones mark the nodes they touch
  nodes.forEach((node, i) => {
    if (field.burgs.some(b => Math.hypot(b.x - node[0], b.y - node[1]) < b.radius)) {
      field.town[i] = 1;
      field.wood[i] = field.marsh[i] = 0;
    }
    if (field.water[i] === 1) return;
    if (field.rivers.some(r => distanceToLine(node, r.points) < r.width / 2 + step * 0.3)) {
      field.water[i] = 2;
      field.wood[i] = field.marsh[i] = 0;
      if (fords.some(f => distanceToLine(node, f.points) < f.width / 2 + step * 0.3)) field.ford[i] = 1;
    }
    if (field.roads.some(r => distanceToLine(node, r) < step * 0.8)) {
      const bridged = field.bridges.some(b => Math.hypot(b.x - node[0], b.y - node[1]) < b.length / 2 + step * 0.4);
      if (field.water[i] && !bridged) return; // a road along a river is no causeway
      if (field.water[i] === 2) field.deck[i] = 1;
      field.road[i] = 1;
      field.water[i] = field.ford[i] = field.wood[i] = field.marsh[i] = 0;
    }
  });

  raiseWalls(field);
  return field;
}

const VIEW_MARGIN = 0.2; // of the field's width, lines are kept beyond its edge
const GATE = 0.5; // width of a gate, in battalion fronts: a battalion gets through
const BREACH = 0.7; // and of a breach
const RAMPART = 11; // how far from a wall its foot reaches

/** The edge of a burg: a rounded blob, as points close enough to draw and to bar the way */
function getOutline(burg: FieldBurg): Point[] {
  const knots = Array.from({ length: 9 }, (_, i): Point => {
    const angle = (i / 9) * Math.PI * 2;
    const radius = burg.radius * (0.8 + 0.25 * Math.sin(i * 2.4 + burg.x));
    return [burg.x + Math.cos(angle) * radius, burg.y + Math.sin(angle) * radius * 0.85];
  });
  // a closed cubic B-spline through the knots, four points a span
  const outline: Point[] = [];
  for (let i = 0; i < knots.length; i++) {
    const [p0, p1, p2, p3] = [0, 1, 2, 3].map(shift => knots[(i + shift) % knots.length]);
    for (let step = 0; step < 4; step++) {
      const t = step / 4;
      const weights = [(1 - t) ** 3, 3 * t ** 3 - 6 * t ** 2 + 4, -3 * t ** 3 + 3 * t ** 2 + 3 * t + 1, t ** 3];
      outline.push(
        [0, 1].map(
          axis => (weights[0] * p0[axis] + weights[1] * p1[axis] + weights[2] * p2[axis] + weights[3] * p3[axis]) / 6
        ) as Point
      );
    }
  }
  return outline;
}

function isInside([x, y]: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [ax, ay] = polygon[i];
    const [bx, by] = polygon[j];
    if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) inside = !inside;
  }
  return inside;
}

/**
 * Walls of the walled burgs along their edges, with gates where the roads come in and gaps where they are breached,
 * and what the grid knows of them. Called again when a breach is made.
 */
export function raiseWalls(field: Battlefield): void {
  field.walls = [];
  field.walled.fill(0);
  field.rampart.fill(0);

  field.burgs.forEach((burg, index) => {
    if (!burg.outline.length) burg.outline = getOutline(burg);
    const { outline } = burg;
    const stretches = outline.map((point, i): [Point, Point] => [point, outline[(i + 1) % outline.length]]);

    // nodes within the burg
    const reach = burg.radius * 1.1 + field.cell;
    for (let y = burg.y - reach; y <= burg.y + reach; y += field.cell) {
      for (let x = burg.x - reach; x <= burg.x + reach; x += field.cell) {
        if (x < 0 || y < 0 || x >= field.width || y >= field.height) continue;
        const node = nodeAt(field, x, y);
        if (!isInside(nodeCentre(field, node), outline)) continue;
        field.town[node] = 1;
        if (burg.walled) field.walled[node] = index + 1;
      }
    }
    if (!burg.walled) return;

    // a gate where a road or a river comes in, one on the quay of a port, and one towards the middle of the field
    // when there is none of them
    const [gate, breach] = [GATE * field.front, BREACH * field.front];
    const gates: { at: Point; water: number }[] = [];
    const addGate = (at: Point, water: number): void => {
      if (!gates.some(other => Math.hypot(other.at[0] - at[0], other.at[1] - at[1]) < gate * 2))
        gates.push({ at, water });
    };
    const lines = [
      ...field.roads.map(points => ({ points, water: 0 })),
      ...field.rivers.filter(river => !river.brook).map(({ points }) => ({ points, water: 2 }))
    ];
    for (const { points, water } of lines) {
      for (let i = 1; i < points.length; i++) {
        for (const [a, b] of stretches) {
          const point = cross(points[i - 1], points[i], a, b);
          if (point) addGate(point, water);
        }
      }
    }
    const quay = getQuay(field, burg, stretches);
    if (quay) addGate(quay, 1);
    if (!gates.length) {
      const middle = (point: Point): number => Math.hypot(point[0] - field.width / 2, point[1] - field.height / 2);
      gates.push({ at: outline.reduce((best, point) => (middle(point) < middle(best) ? point : best)), water: 0 });
    }

    const near = (point: Point, [x, y]: Point, distance: number): boolean =>
      Math.hypot(point[0] - x, point[1] - y) < distance;
    for (const [a, b] of stretches) {
      const mid: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if (field.breaches.some(gap => gap.burg === index && near(mid, [gap.x, gap.y], breach / 2))) continue;
      const by = gates.find(other => near(mid, other.at, gate / 2));
      field.walls.push({ a, b, burg: index, gate: Boolean(by), water: by?.water ?? 0 });
    }
  });

  // the foot of the walls: where they are climbed, where a gate is forced, where the rubble of a breach lies
  const mark = (point: Point, reach: number, value: number): void => {
    for (let y = point[1] - reach; y <= point[1] + reach; y += field.cell / 2) {
      for (let x = point[0] - reach; x <= point[0] + reach; x += field.cell / 2) {
        if (x < 0 || y < 0 || x >= field.width || y >= field.height) continue;
        const node = nodeAt(field, x, y);
        const [nx, ny] = nodeCentre(field, node);
        if (Math.hypot(nx - point[0], ny - point[1]) <= reach)
          field.rampart[node] = Math.max(field.rampart[node], value);
      }
    }
  };
  for (const wall of field.walls) {
    for (const t of [0, 0.5, 1]) {
      mark(
        [wall.a[0] + (wall.b[0] - wall.a[0]) * t, wall.a[1] + (wall.b[1] - wall.a[1]) * t],
        RAMPART,
        wall.gate ? 2 : 1
      );
    }
  }
  for (const breach of field.breaches) mark([breach.x, breach.y], (BREACH * field.front) / 2, 3);
}

/** Where the quay of a burg on the sea or a lake is: on the stretch of its wall that looks out on the most water */
function getQuay(field: Battlefield, burg: FieldBurg, stretches: [Point, Point][]): Point | null {
  let best: Point | null = null;
  let most = 0;
  for (const [a, b] of stretches) {
    const mid: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const away = Math.atan2(mid[1] - burg.y, mid[0] - burg.x);
    let water = 0;
    for (let i = 0; i < 8; i++) {
      const [x, y] = [mid[0] + Math.cos(away) * field.cell * i, mid[1] + Math.sin(away) * field.cell * i];
      if (x >= 0 && y >= 0 && x < field.width && y < field.height && field.water[nodeAt(field, x, y)] === 1) water++;
    }
    if (water > most) [best, most] = [mid, water];
  }
  return most >= 4 ? best : null;
}

/** Knock a gap into the wall of a burg at the point */
export function openBreach(field: Battlefield, burg: number, [x, y]: Point): void {
  field.breaches.push({ x, y, burg });
  raiseWalls(field);
}

/** The stretches of wall, gates among them, that the straight way between two points crosses */
export function getWallsBetween(field: Battlefield, from: Point, to: Point): FieldWall[] {
  if (!field.walls.length) return NO_WALLS;
  // only the burgs the way comes by
  const near = field.burgs.map(
    burg => burg.walled && distanceToLine([burg.x, burg.y], [from, to]) < burg.radius * 1.15
  );
  if (!near.includes(true)) return NO_WALLS;
  let crossed = NO_WALLS;
  for (const wall of field.walls) {
    if (!near[wall.burg] || !cross(from, to, wall.a, wall.b)) continue;
    if (crossed === NO_WALLS) crossed = [];
    crossed.push(wall);
  }
  return crossed;
}

const NO_WALLS: FieldWall[] = [];

export const isForest = (biome: number): boolean => FOREST_BIOMES.includes(biome);

/** The grid node a point of the field lies in */
export function nodeAt({ cell }: Battlefield, x: number, y: number): number {
  const col = Math.min(Math.max(Math.floor(x / cell), 0), COLS - 1);
  const row = Math.min(Math.max(Math.floor(y / cell), 0), ROWS - 1);
  return row * COLS + col;
}

/** The middle of a grid node */
export const nodeCentre = ({ cell }: Battlefield, node: number): [number, number] => [
  ((node % COLS) + 0.5) * cell,
  (Math.floor(node / COLS) + 0.5) * cell
];

/** Height of a point above the lowest ground, between the nodes as well */
export function getElevation(field: Battlefield, x: number, y: number): number {
  if (!field.relief) return 0;
  const { cell } = field;
  const fx = Math.min(Math.max(x / cell - 0.5, 0), COLS - 1);
  const fy = Math.min(Math.max(y / cell - 0.5, 0), ROWS - 1);
  const [c, r] = [Math.min(Math.floor(fx), COLS - 2), Math.min(Math.floor(fy), ROWS - 2)];
  const [dx, dy] = [fx - c, fy - r];
  const at = (col: number, row: number): number => field.elevation[row * COLS + col];
  const top = at(c, r) * (1 - dx) + at(c + 1, r) * dx;
  const bottom = at(c, r + 1) * (1 - dx) + at(c + 1, r + 1) * dx;
  return (top * (1 - dy) + bottom * dy) * field.relief;
}

/** Rise over run of the ground at a point in the direction of the heading: uphill positive */
export function getSlope(field: Battlefield, x: number, y: number, heading: number): number {
  if (!field.relief) return 0;
  const [dx, dy] = [Math.cos(heading) * field.cell, Math.sin(heading) * field.cell];
  return (getElevation(field, x + dx, y + dy) - getElevation(field, x - dx, y - dy)) / (field.cell * 2);
}

export function terrainAt(field: Battlefield, x: number, y: number): Terrain {
  const i = nodeAt(field, x, y);
  return {
    height: field.elevation[i],
    wood: field.wood[i] === 1,
    marsh: field.marsh[i] === 1,
    water: field.water[i],
    ford: field.ford[i] === 1,
    deck: field.deck[i] === 1,
    road: field.road[i] === 1,
    town: field.town[i] === 1,
    walled: field.walled[i],
    rampart: field.rampart[i]
  };
}

/** The point where two segments cross */
function cross(a: Point, b: Point, c: Point, d: Point): Point | null {
  const [rx, ry] = [b[0] - a[0], b[1] - a[1]];
  const [sx, sy] = [d[0] - c[0], d[1] - c[1]];
  const span = rx * sy - ry * sx;
  if (!span) return null;
  const t = ((c[0] - a[0]) * sy - (c[1] - a[1]) * sx) / span;
  const u = ((c[0] - a[0]) * ry - (c[1] - a[1]) * rx) / span;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [a[0] + rx * t, a[1] + ry * t] : null;
}

function distanceToLine([x, y]: Point, line: Point[]): number {
  let best = Infinity;
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = line[i - 1];
    const [bx, by] = line[i];
    const dx = bx - ax;
    const dy = by - ay;
    const length = dx * dx + dy * dy;
    const t = length ? Math.min(Math.max(((x - ax) * dx + (y - ay) * dy) / length, 0), 1) : 0;
    best = Math.min(best, (x - ax - dx * t) ** 2 + (y - ay - dy * t) ** 2);
  }
  return Math.sqrt(best);
}

function nearestOnLine(point: Point, line: Point[]): Point {
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

const nearestIndex = (points: Point[], [x, y]: Point): number =>
  points.reduce(
    (best, p, i) => (Math.hypot(p[0] - x, p[1] - y) < Math.hypot(points[best][0] - x, points[best][1] - y) ? i : best),
    0
  );

/**
 * Where in its cell a battle is fought, in map pixels: at the burg or by the river it is named after,
 * on the crossing of a road over the river if there is one
 */
function findSite(cell: number, place: Point, pixel: number): Point {
  const { cells } = pack;
  if (cells.burg[cell]) {
    const burg = pack.burgs[cells.burg[cell]];
    return burg.port ? getHarbour(burg, pixel) : [burg.x, burg.y];
  }
  const river = cells.r[cell] && pack.rivers.find(river => river.i === cells.r[cell]);
  if (!river) return place;

  // the curves as drawn, about the cell only
  const [cx, cy] = cells.p[cell];
  const reach = getSpacing() * 2;
  const close = (a: Point, b: Point): boolean => distanceToLine([cx, cy], [a, b]) < reach;
  const local = (points: number[][]): Point[] =>
    smooth(
      sliceAround(
        points.map(([x, y]): Point => [x, y]),
        close
      ),
      0.05,
      [cx - reach, cy - reach, cx + reach, cy + reach]
    );
  const course = local(Rivers.addMeandering(river.cells, river.points ?? null));
  let site = nearestOnLine(place, course);
  for (const route of pack.routes) {
    if (route.group === "searoutes" || !route.points.some(p => p[2] === cell)) continue;
    const road = local(route.points);
    for (let i = 1; i < road.length; i++) {
      for (let j = 1; j < course.length; j++) {
        const point = cross(road[i - 1], road[i], course[j - 1], course[j]);
        if (point && Pack.findCell(point[0], point[1]) === cell) site = point;
      }
    }
  }
  const angle = mix(place[0], place[1], -1) * Math.PI * 2;
  const shift = (mix(place[0], place[1], -2) * SITE_SHIFT) / pixel;
  return [site[0] + Math.cos(angle) * shift, site[1] + Math.sin(angle) * shift];
}

/** The mean distance between cell centres in map pixels */
const getSpacing = (): number => Math.sqrt((options.map.graph.width * options.map.graph.height) / pack.cells.i.length);

/** The radius of the burg a siege of the place is for, Infinity where it has none */
export function getSiegeRadius([x, y]: Point): number {
  const cell = Pack.findCell(x, y);
  const burg = cell === undefined ? 0 : pack.cells.burg[cell];
  return burg ? getBurgRadius(pack.burgs[burg]) : Infinity;
}

/** A burg's radius in metres, by its people */
const getBurgRadius = (burg: Burg): number => Math.min(Math.max(32 + Math.sqrt(burg.population ?? 1) * 16, 48), 160);

/** Where a port stands on the map at true scale: the map draws it a few km off the shore, the plan right on it */
function getHarbour(burg: Burg, pixel: number): Point {
  const water = pack.features[burg.port!];
  const coast = water?.type === "lake" ? water : pack.features[pack.cells.f[burg.cell]];
  const shore = coast && Coastline.getFeatureShape(coast).points;
  if (!shore?.length) return [burg.x, burg.y];
  const [cx, cy] = shore.reduce((a, b) =>
    Math.hypot(b[0] - burg.x, b[1] - burg.y) < Math.hypot(a[0] - burg.x, a[1] - burg.y) ? b : a
  );
  const away = Math.hypot(burg.x - cx, burg.y - cy) || 1;
  if (away > getSpacing() / 2) return [burg.x, burg.y]; // a river port, its sea far off
  const inland = (getBurgRadius(burg) * 0.8) / pixel; // its edge at the water
  return [cx + ((burg.x - cx) / away) * inland, cy + ((burg.y - cy) / away) * inland];
}

/** The part of a line whose segments pass the test, two points more each way to keep its curve; empty when none do */
function sliceAround(line: Point[], test: (a: Point, b: Point) => boolean): Point[] {
  let [first, last] = [-1, -1];
  for (let i = 1; i < line.length; i++) {
    if (!test(line[i - 1], line[i])) continue;
    if (first < 0) first = i - 1;
    last = i;
  }
  return first < 0 ? [] : line.slice(Math.max(first - 2, 0), last + 3);
}

/** The line on the curve the map draws rivers and roads with, a point every `step` or so within the box */
function smooth(
  points: Point[],
  step: number,
  [x0, y0, x1, y1]: Box = [-Infinity, -Infinity, Infinity, Infinity]
): Point[] {
  const sampled: Point[] = [];
  const add = (x: number, y: number): void => void sampled.push([x, y]);
  const context = {
    moveTo: add,
    lineTo: add,
    closePath: () => {},
    bezierCurveTo(cx1: number, cy1: number, cx2: number, cy2: number, x: number, y: number): void {
      const [sx, sy] = sampled[sampled.length - 1];
      const xs = [sx, cx1, cx2, x];
      const ys = [sy, cy1, cy2, y];
      const outside = Math.max(...xs) < x0 || Math.min(...xs) > x1 || Math.max(...ys) < y0 || Math.min(...ys) > y1;
      const steps = outside ? 1 : Math.max(Math.ceil(Math.hypot(x - sx, y - sy) / step), 1);
      for (let k = 1; k <= steps; k++) {
        const t = k / steps;
        const s = 1 - t;
        const blend = (a: number, b: number, c: number, d: number): number =>
          s * s * s * a + 3 * s * s * t * b + 3 * s * t * t * c + t * t * t * d;
        add(blend(sx, cx1, cx2, x), blend(sy, cy1, cy2, y));
      }
    }
  };
  if (points.length > 1)
    line()
      .curve(curveCatmullRom.alpha(0.1))
      .context(context as unknown as CanvasRenderingContext2D)(points);
  return sampled;
}

/** Weights of the corners of a triangle for a point within it, null for a point outside */
function getBarycentric([x, y]: Point, [[ax, ay], [bx, by], [cx, cy]]: Point[]): number[] | null {
  const area = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
  if (!area) return null;
  const a = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / area;
  const b = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / area;
  const c = 1 - a - b;
  return a < -1e-9 || b < -1e-9 || c < -1e-9 ? null : [a, b, c];
}

/** The stretch of a line within the box, cut at its edge; empty when it passes by */
function clipToView(line: Point[], box: Box): Point[] {
  const at = (i: number, t: number): Point => [
    line[i - 1][0] + (line[i][0] - line[i - 1][0]) * t,
    line[i - 1][1] + (line[i][1] - line[i - 1][1]) * t
  ];
  let first: [number, number] | null = null;
  let last: [number, number] | null = null;
  for (let i = 1; i < line.length; i++) {
    const span = clipSegment(line[i - 1], line[i], box);
    if (!span) continue;
    if (!first) first = [i, span[0]];
    last = [i, span[1]];
  }
  if (!first || !last) return [];
  return [at(...first), ...line.slice(first[0], last[0]), at(...last)];
}

/** Liang–Barsky: the share of a segment, from and to, that lies within a box */
function clipSegment([ax, ay]: Point, [bx, by]: Point, [x0, y0, x1, y1]: Box): [number, number] | null {
  let [from, to] = [0, 1];
  const [dx, dy] = [bx - ax, by - ay];
  const edges = [
    [-dx, ax - x0],
    [dx, x1 - ax],
    [-dy, ay - y0],
    [dy, y1 - ay]
  ];
  for (const [p, q] of edges) {
    if (!p) {
      if (q < 0) return null;
      continue;
    }
    if (p < 0) from = Math.max(from, q / p);
    else to = Math.min(to, q / p);
    if (from > to) return null;
  }
  return [from, to];
}

/** A line wound about its course, sideways by up to the amplitude, a bend about every wavelength */
function bend(line: Point[], wavelength: number, amplitude: number, place: Point, layer: number): Point[] {
  const knot = wavelength / 2;
  const at = (k: number): number => mix(place[0] * 31 + k, place[1] * 37, layer);
  const offset = (along: number): number => {
    const k = Math.floor(along / knot);
    const t = along / knot - k;
    return (at(k) + (at(k + 1) - at(k)) * t * t * (3 - 2 * t) - 0.5) * 2 * amplitude;
  };

  const wound: Point[] = [];
  let walked = 0;
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = line[i - 1];
    const [bx, by] = line[i];
    const length = Math.hypot(bx - ax, by - ay);
    if (!length) continue;
    const [nx, ny] = [-(by - ay) / length, (bx - ax) / length];
    const steps = Math.ceil(length / (wavelength / 6));
    for (let s = wound.length ? 1 : 0; s <= steps; s++) {
      const t = s / steps;
      const shift = offset(walked + length * t);
      wound.push([ax + (bx - ax) * t + nx * shift, ay + (by - ay) * t + ny * shift]);
    }
    walked += length;
  }
  return wound;
}

/** A fixed number from 0 to 1 for three whole numbers: what makes the ground of a place the same every time */
function mix(a: number, b: number, c: number): number {
  let hash = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 1274126177)) | 0;
  hash = Math.imul(hash ^ (hash >>> 13), 1103515245);
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
}

/** Smooth noise, 0 to 1, of a pattern fixed by the place on the map and the layer it is for */
function createNoise(field: Battlefield, place: Point, layer: number, size: number): (x: number, y: number) => number {
  const cols = Math.ceil(field.width / size) + 2;
  const rows = Math.ceil(field.height / size) + 2;
  const lattice = Array.from({ length: cols * rows }, (_, i) =>
    mix(place[0] * 31 + (i % cols), place[1] * 37 + ((i / cols) | 0), layer)
  );
  const ease = (t: number): number => t * t * (3 - 2 * t);

  return (x, y) => {
    const col = Math.min(Math.max(Math.floor(x / size), 0), cols - 2);
    const row = Math.min(Math.max(Math.floor(y / size), 0), rows - 2);
    const tx = ease(Math.min(Math.max(x / size - col, 0), 1));
    const ty = ease(Math.min(Math.max(y / size - row, 0), 1));
    const at = (c: number, r: number): number => lattice[r * cols + c];
    const top = at(col, row) + (at(col + 1, row) - at(col, row)) * tx;
    const bottom = at(col, row + 1) + (at(col + 1, row + 1) - at(col, row + 1)) * tx;
    return top + (bottom - top) * ty;
  };
}
