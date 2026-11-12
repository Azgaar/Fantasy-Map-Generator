import { Pack } from "@/model/graph/pack-generator";
import { Rivers } from "@/model/physical/river-generator";
import type { Point } from "@/types/global";

// the plan and its grid: a node is smaller than a battalion is deep, so the ways round the terrain follow what is drawn
export const FIELD = { width: 1000, height: 600, cell: 10, cols: 100, rows: 60 };

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
}

export interface FieldBreach {
  x: number;
  y: number;
  burg: number;
}

/** Ground of a battle: the map around its cell as the layout, with detail that is always the same for the place */
export interface Battlefield {
  open: "sea" | "sky" | null; // no terrain: a naval or an air battle
  biome: number;
  // one value per grid node, row by row
  height: number[]; // relief, 0 to 1
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
const BROOK = 10;
const WADEABLE = 20;
const FORD = 36; // length of a ford along the river

// share of the ground under trees, by biome
const WOODS: Record<number, number> = { 3: 0.15, 4: 0.2, 5: 0.5, 6: 0.55, 7: 0.7, 8: 0.65, 9: 0.55, 10: 0.05, 12: 0.2 };
const FOREST_BIOMES = [5, 6, 7, 8, 9];

export function createEmptyBattlefield(open: Battlefield["open"] = null): Battlefield {
  const grid = (): number[] => new Array(FIELD.cols * FIELD.rows).fill(0);
  return {
    open,
    biome: 4,
    height: grid(),
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

/** @param clearing keep the middle open for the lines to meet; an ambush wants the cover */
export function buildBattlefield(x: number, y: number, clearing = true): Battlefield {
  const field = createEmptyBattlefield();
  const place: Point = [Math.round(x), Math.round(y)];
  const { cells } = pack;
  const { cols, rows, cell: step } = FIELD;

  const spacing = Math.sqrt((options.map.graph.width * options.map.graph.height) / cells.i.length);
  const scale = FIELD.width / 2 / (spacing * 1.7); // field units per map pixel
  const toField = (mx: number, my: number): Point => [
    (mx - x) * scale + FIELD.width / 2,
    (my - y) * scale + FIELD.height / 2
  ];
  const inView = ([fx, fy]: Point, margin = 0): boolean =>
    fx > -margin && fx < FIELD.width + margin && fy > -margin && fy < FIELD.height + margin;

  const around = Pack.findAll(x, y, spacing * 4);
  if (!around.length) return field;
  field.biome = cells.biome[Pack.findCell(x, y) ?? around[0]];

  // elevation and tree cover between the cell centres, by distance
  const elevation: number[] = [];
  const cover: number[] = [];
  const wetness: number[] = [];
  const sites = around.map(i => ({ p: toField(cells.p[i][0], cells.p[i][1]), h: cells.h[i], biome: cells.biome[i] }));
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const nx = (col + 0.5) * step;
      const ny = (row + 0.5) * step;
      let total = 0;
      let h = 0;
      let trees = 0;
      let wet = 0;
      for (const site of sites) {
        const weight = 1 / (((site.p[0] - nx) ** 2 + (site.p[1] - ny) ** 2) ** 1.5 + 1);
        total += weight;
        h += site.h * weight;
        trees += (WOODS[site.biome] ?? 0) * weight;
        wet += +(site.biome === 12) * weight;
      }
      elevation.push(h / total);
      cover.push(trees / total);
      wetness.push(wet / total);
    }
  }

  const land = elevation.filter(h => h >= 20);
  const low = land.length ? Math.min(...land) : 20;
  const range = Math.max((land.length ? Math.max(...land) : 20) - low, 10); // flat land stays flat
  const bumps = createNoise(place, 1, 260);
  const groves = createNoise(place, 2, 130);
  const bogs = createNoise(place, 3, 110);

  for (let i = 0; i < elevation.length; i++) {
    const nx = ((i % cols) + 0.5) * step;
    const ny = (Math.floor(i / cols) + 0.5) * step;
    if (elevation[i] < 20) {
      field.water[i] = 1;
      continue;
    }
    field.height[i] = Math.min(Math.max(((elevation[i] - low) / range) * 0.75 + bumps(nx, ny) * 0.35 - 0.05, 0), 1);
    const fromCentre = Math.hypot((nx - FIELD.width / 2) / FIELD.width, (ny - FIELD.height / 2) / FIELD.height);
    const open = clearing ? Math.min(0.35 + fromCentre * 2.2, 1.15) : 1.15;
    if (groves(nx, ny) < cover[i] * open) field.wood[i] = 1;
    else if (bogs(nx, ny) < wetness[i] * 0.6) field.marsh[i] = 1;
  }

  const nearby = new Set(around);
  for (const route of pack.routes) {
    if (route.group === "searoutes" || !route.points.some(p => nearby.has(p[2]))) continue;
    const points = route.points.map(p => toField(p[0], p[1]));
    if (points.some(p => inView(p))) field.roads.push(points);
  }

  for (const river of pack.rivers) {
    if (!river.cells.some(c => nearby.has(c))) continue;
    const course = Rivers.addMeandering(river.cells, river.points ?? null);
    const points = course.map(p => toField(p[0], p[1]));
    if (!points.some(p => inView(p))) continue;
    if (inView(points[0]) && points.length > 1) {
      // a spring on the field would look cut off: the river comes from beyond the edge
      const [sx, sy] = points[0];
      const [nx, ny] = points[Math.min(3, points.length - 1)];
      const length = Math.hypot(sx - nx, sy - ny) || 1;
      const reach = FIELD.width + FIELD.height;
      points.unshift([sx + ((sx - nx) / length) * reach, sy + ((sy - ny) / length) * reach]);
    }
    const flux = Math.max(...course.filter((_, i) => inView(points[i], 100)).map(p => p[2]), 0);
    const width = Math.min(Math.max(6 + Math.sqrt(flux) / 3, 8), 26);
    field.rivers.push({ points, width, name: `${river.name} ${river.type}`.trim(), brook: width <= BROOK });
  }

  for (const burg of pack.burgs) {
    if (!burg.i || burg.removed) continue;
    const [bx, by] = toField(burg.x, burg.y);
    if (!inView([bx, by])) continue;
    const radius = Math.min(Math.max(16 + Math.sqrt(burg.population ?? 1) * 8, 24), 80);
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
      let next = 80 + chance() * 160;
      let walked = 0;
      for (let i = 1; i < river.points.length; i++) {
        const [ax, ay] = river.points[i - 1];
        const [bx, by] = river.points[i];
        const length = Math.hypot(bx - ax, by - ay);
        for (; next < walked + length; next += 240 + chance() * 200) {
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
          if (field.bridges.some(b => Math.hypot(b.x - point[0], b.y - point[1]) < 12)) continue; // the same crossing
          const angle = Math.atan2(road[i][1] - road[i - 1][1], road[i][0] - road[i - 1][0]);
          field.bridges.push({ x: point[0], y: point[1], angle, length: river.width + 14 });
        }
      }
    }
  }

  // features onto the grid: a road cuts the wood and bridges the river where it crosses it
  for (let i = 0; i < elevation.length; i++) {
    const node: Point = [((i % cols) + 0.5) * step, (Math.floor(i / cols) + 0.5) * step];
    if (field.burgs.some(b => Math.hypot(b.x - node[0], b.y - node[1]) < b.radius)) {
      field.town[i] = 1;
      field.wood[i] = field.marsh[i] = 0;
    }
    if (field.water[i] === 1) continue;
    if (field.rivers.some(r => distanceToLine(node, r.points) < r.width / 2 + 3)) {
      field.water[i] = 2;
      field.wood[i] = field.marsh[i] = 0;
      if (fords.some(f => distanceToLine(node, f.points) < f.width / 2 + 3)) field.ford[i] = 1;
    }
    if (field.roads.some(r => distanceToLine(node, r) < 8)) {
      const bridged = field.bridges.some(b => Math.hypot(b.x - node[0], b.y - node[1]) < b.length / 2 + 4);
      if (field.water[i] && !bridged) continue; // a road along a river is no causeway
      if (field.water[i] === 2) field.deck[i] = 1;
      field.road[i] = 1;
      field.water[i] = field.ford[i] = field.wood[i] = field.marsh[i] = 0;
    }
  }

  raiseWalls(field);
  return field;
}

const GATE = 22; // width of a gate
const BREACH = 30; // and of a breach
const RAMPART = 8; // how far from a wall its foot reaches

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
    const reach = burg.radius * 1.1 + FIELD.cell;
    for (let y = burg.y - reach; y <= burg.y + reach; y += FIELD.cell) {
      for (let x = burg.x - reach; x <= burg.x + reach; x += FIELD.cell) {
        if (x < 0 || y < 0 || x >= FIELD.width || y >= FIELD.height) continue;
        const node = nodeAt(x, y);
        if (!isInside(nodeCentre(node), outline)) continue;
        field.town[node] = 1;
        if (burg.walled) field.walled[node] = index + 1;
      }
    }
    if (!burg.walled) return;

    // a gate where a road comes in, or one towards the middle of the field when no road does
    const gates: Point[] = [];
    for (const road of field.roads) {
      for (let i = 1; i < road.length; i++) {
        for (const [a, b] of stretches) {
          const point = cross(road[i - 1], road[i], a, b);
          if (point && !gates.some(gate => Math.hypot(gate[0] - point[0], gate[1] - point[1]) < GATE * 2))
            gates.push(point);
        }
      }
    }
    if (!gates.length) {
      const middle = (point: Point): number => Math.hypot(point[0] - FIELD.width / 2, point[1] - FIELD.height / 2);
      gates.push(outline.reduce((best, point) => (middle(point) < middle(best) ? point : best)));
    }

    const near = (point: Point, [x, y]: Point, distance: number): boolean =>
      Math.hypot(point[0] - x, point[1] - y) < distance;
    for (const [a, b] of stretches) {
      const mid: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if (field.breaches.some(breach => breach.burg === index && near(mid, [breach.x, breach.y], BREACH / 2))) continue;
      field.walls.push({ a, b, burg: index, gate: gates.some(gate => near(mid, gate, GATE / 2)) });
    }
  });

  // the foot of the walls: where they are climbed, where a gate is forced, where the rubble of a breach lies
  const mark = (point: Point, reach: number, value: number): void => {
    for (let y = point[1] - reach; y <= point[1] + reach; y += FIELD.cell / 2) {
      for (let x = point[0] - reach; x <= point[0] + reach; x += FIELD.cell / 2) {
        if (x < 0 || y < 0 || x >= FIELD.width || y >= FIELD.height) continue;
        const node = nodeAt(x, y);
        const [nx, ny] = nodeCentre(node);
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
  for (const breach of field.breaches) mark([breach.x, breach.y], BREACH / 2, 3);
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
export function nodeAt(x: number, y: number): number {
  const col = Math.min(Math.max(Math.floor(x / FIELD.cell), 0), FIELD.cols - 1);
  const row = Math.min(Math.max(Math.floor(y / FIELD.cell), 0), FIELD.rows - 1);
  return row * FIELD.cols + col;
}

/** The middle of a grid node */
export const nodeCentre = (node: number): [number, number] => [
  ((node % FIELD.cols) + 0.5) * FIELD.cell,
  (Math.floor(node / FIELD.cols) + 0.5) * FIELD.cell
];

export function terrainAt(field: Battlefield, x: number, y: number): Terrain {
  const i = nodeAt(x, y);
  return {
    height: field.height[i],
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

function distanceToLine(point: Point, line: Point[]): number {
  let best = Infinity;
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = line[i - 1];
    const [bx, by] = line[i];
    const dx = bx - ax;
    const dy = by - ay;
    const length = dx * dx + dy * dy;
    const t = length ? Math.min(Math.max(((point[0] - ax) * dx + (point[1] - ay) * dy) / length, 0), 1) : 0;
    best = Math.min(best, Math.hypot(point[0] - ax - dx * t, point[1] - ay - dy * t));
  }
  return best;
}

/** A fixed number from 0 to 1 for three whole numbers: what makes the ground of a place the same every time */
function mix(a: number, b: number, c: number): number {
  let hash = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 1274126177)) | 0;
  hash = Math.imul(hash ^ (hash >>> 13), 1103515245);
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
}

/** Smooth noise, 0 to 1, of a pattern fixed by the place on the map and the layer it is for */
function createNoise(place: Point, layer: number, size: number): (x: number, y: number) => number {
  const cols = Math.ceil(FIELD.width / size) + 2;
  const rows = Math.ceil(FIELD.height / size) + 2;
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
