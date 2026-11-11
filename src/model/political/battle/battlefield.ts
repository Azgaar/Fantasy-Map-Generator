import Alea from "alea";
import { Pack } from "@/model/graph/pack-generator";
import { Rivers } from "@/model/physical/river-generator";
import type { Point } from "@/types/global";

export const FIELD = { width: 1000, height: 600, cell: 20, cols: 50, rows: 30 };

export interface FieldRiver {
  points: Point[];
  width: number;
  name: string;
}

export interface FieldBurg {
  x: number;
  y: number;
  radius: number;
  name: string;
  group: string; // capital, city, town…
  walled: boolean;
}

/** Ground of a battle: the map around its cell as the layout, seeded detail on top */
export interface Battlefield {
  seed: string;
  open: "sea" | "sky" | null; // no terrain: a naval or an air battle
  biome: number;
  // one value per grid node, row by row
  height: number[]; // relief, 0 to 1
  wood: number[];
  marsh: number[];
  water: number[]; // 1 sea or lake, 2 river
  road: number[];
  town: number[];
  rivers: FieldRiver[];
  roads: Point[][];
  burgs: FieldBurg[];
}

export interface Terrain {
  height: number;
  wood: boolean;
  marsh: boolean;
  water: number;
  road: boolean;
  town: boolean;
}

// share of the ground under trees, by biome
const WOODS: Record<number, number> = { 3: 0.15, 4: 0.2, 5: 0.5, 6: 0.55, 7: 0.7, 8: 0.65, 9: 0.55, 10: 0.05, 12: 0.2 };
const FOREST_BIOMES = [5, 6, 7, 8, 9];

export function createEmptyBattlefield(seed: string, open: Battlefield["open"] = null): Battlefield {
  const grid = (): number[] => new Array(FIELD.cols * FIELD.rows).fill(0);
  return {
    seed,
    open,
    biome: 4,
    height: grid(),
    wood: grid(),
    marsh: grid(),
    water: grid(),
    road: grid(),
    town: grid(),
    rivers: [],
    roads: [],
    burgs: []
  };
}

/** @param clearing keep the middle open for the lines to meet; an ambush wants the cover */
export function buildBattlefield(x: number, y: number, seed: string, clearing = true): Battlefield {
  const field = createEmptyBattlefield(seed);
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
  const bumps = createNoise(`${seed}_h`, 260);
  const groves = createNoise(`${seed}_w`, 130);
  const bogs = createNoise(`${seed}_m`, 110);

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
    field.rivers.push({
      points,
      width: Math.min(Math.max(6 + Math.sqrt(flux) / 3, 8), 26),
      name: `${river.name} ${river.type}`.trim()
    });
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
      walled: Boolean(burg.walls || burg.citadel)
    });
  }

  // features onto the grid: a road bridges the river and cuts the wood
  for (let i = 0; i < elevation.length; i++) {
    const node: Point = [((i % cols) + 0.5) * step, (Math.floor(i / cols) + 0.5) * step];
    if (field.burgs.some(b => Math.hypot(b.x - node[0], b.y - node[1]) < b.radius)) {
      field.town[i] = 1;
      field.wood[i] = field.marsh[i] = 0;
    }
    if (field.water[i] === 1) continue;
    if (field.rivers.some(r => distanceToLine(node, r.points) < r.width / 2 + 5)) {
      field.water[i] = 2;
      field.wood[i] = field.marsh[i] = 0;
    }
    if (field.roads.some(r => distanceToLine(node, r) < 12)) {
      field.road[i] = 1;
      field.water[i] = field.wood[i] = field.marsh[i] = 0;
    }
  }

  return field;
}

export const isForest = (biome: number): boolean => FOREST_BIOMES.includes(biome);

export function terrainAt(field: Battlefield, x: number, y: number): Terrain {
  const col = Math.min(Math.max(Math.floor(x / FIELD.cell), 0), FIELD.cols - 1);
  const row = Math.min(Math.max(Math.floor(y / FIELD.cell), 0), FIELD.rows - 1);
  const i = row * FIELD.cols + col;
  return {
    height: field.height[i],
    wood: field.wood[i] === 1,
    marsh: field.marsh[i] === 1,
    water: field.water[i],
    road: field.road[i] === 1,
    town: field.town[i] === 1
  };
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

/** Smooth seeded noise, 0 to 1 */
function createNoise(seed: string, size: number): (x: number, y: number) => number {
  const random = Alea(seed);
  const cols = Math.ceil(FIELD.width / size) + 2;
  const rows = Math.ceil(FIELD.height / size) + 2;
  const lattice = Array.from({ length: cols * rows }, () => random());
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
