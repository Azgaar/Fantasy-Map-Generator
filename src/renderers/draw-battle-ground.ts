// The ground of a battle field: a pale tint of the map's biome colours and the props on it, by the biome and the lie of the land.
// Drawn once with the field and never read by the battle. See docs/domain/battles.md

import { hcl } from "d3";
import { Relief, type ReliefPool } from "@/model/physical/relief-generator";
import { COLS, ROWS } from "@/model/political/battle/battle-scale";
import { type Battlefield, mix, nodeAt } from "@/model/political/battle/battlefield";
import { rn } from "@/utils/number-utils";

export const PAPER = "#fbf5e9"; // the ground of a biome the map has no colour for
const TINT_LIGHTNESS = 93;
const TINT_CHROMA = [0.35, 14]; // of the biome's chroma, and the most
const SOFT_EDGE = [0.25, 0.75]; // of a twice-blurred grid: woods and bogs fade in between, the edge their outline had halfway
const SPACING = 11; // points between the spots a prop may stand on
const GLYPH = 1.4; // points of a glyph unit: a tree is some 6 points across
const MOST_PROPS = 6000;
const OPEN_SHARE = 0.35; // of the spots on open ground a biome of the densest relief icons fills; a sparser one by the root of its density
const WOOD = [0.3, 0.75, 0.55, 0.5]; // trees from, thickening to so much cover, on this share of spots; the wood itself from
const LONE_TREES = 0.2; // a tree of the biome's pool stands on open ground so much more seldom than its other props
const CLIFF_BAND = 0.8; // of a node either side of a cliff stays clear for its mark
const SCREE = [2, 0.75]; // nodes below a cliff the scree reaches, and its share at the foot
const ROCKY_SLOPE = [0.15, 0.35, 0.4]; // rocks from this grade, full at so much steeper, on this share of spots
const SHORE = [0.2, 0.45, 0.8]; // the band by the sea or a lake drawn as the water's edge, and its share of shingle
const REEDS = [6, 0.45]; // points between the places along a river bank a clump of reeds may stand, and its share

type Kind =
  | "deciduous"
  | "conifer"
  | "coniferSnow"
  | "palm"
  | "acacia"
  | "deadTree"
  | "grass"
  | "cactus"
  | "dune"
  | "reeds"
  | "rock"
  | "scree"
  | "shingle"
  | "crevasse";

interface Style {
  fill?: string;
  stroke: string;
  width: number; // points
  size: number;
}

const STYLES: Record<Kind, Style> = {
  deciduous: { fill: "#cadbb0", stroke: "#7c9a62", width: 0.35, size: 1 },
  conifer: { fill: "#bccfa4", stroke: "#6d8a58", width: 0.35, size: 1 },
  coniferSnow: { fill: "#f1f4ef", stroke: "#6d8a58", width: 0.35, size: 1 },
  palm: { stroke: "#7c9a62", width: 0.45, size: 1 },
  acacia: { fill: "#d6daa8", stroke: "#8a9460", width: 0.35, size: 1 },
  deadTree: { stroke: "#8f8270", width: 0.4, size: 0.9 },
  grass: { stroke: "#a3b585", width: 0.35, size: 0.8 },
  cactus: { stroke: "#86a06a", width: 0.5, size: 0.9 },
  dune: { stroke: "#c5a874", width: 0.5, size: 1.5 },
  reeds: { stroke: "#8fb0b8", width: 0.35, size: 0.8 },
  rock: { fill: "#ddd7cb", stroke: "#8f877a", width: 0.3, size: 1 },
  scree: { fill: "#ddd7cb", stroke: "#8f877a", width: 0.25, size: 0.55 },
  shingle: { fill: "#bdb29c", stroke: "none", width: 0, size: 1 },
  crevasse: { stroke: "#a9c2cf", width: 0.4, size: 1.2 }
};

const TREES: Kind[] = ["deciduous", "conifer", "coniferSnow", "palm", "acacia", "deadTree"];
const POOL: Record<string, Kind> = { swamp: "reeds", ...Object.fromEntries(TREES.map(kind => [kind, kind])) };
for (const kind of ["grass", "cactus", "dune"] as const) POOL[kind] = kind;

const HOT_DESERT = 1;
const COLD_DESERT = 2;
const TUNDRA = 10;
const GLACIER = 11;
const WETLAND = 12;
const BARE: Partial<Record<number, [Kind, number]>> = {
  [COLD_DESERT]: ["rock", 0.06],
  [TUNDRA]: ["rock", 0.05],
  [GLACIER]: ["crevasse", 0.12]
}; // what lies about on ground the relief icons leave bare
const REEDLESS = [HOT_DESERT, COLD_DESERT, GLACIER];

/** A biome's ground: its map colour made pale, so the plan stays light and every biome reads alike */
export function getGroundTint(biome: number): string {
  const color = hcl(pack.biomes?.[biome]?.color ?? "");
  if (Number.isNaN(color.l)) return PAPER;
  const chroma = Number.isNaN(color.c) ? 0 : Math.min(color.c * TINT_CHROMA[0], TINT_CHROMA[1]);
  return hcl(color.h, chroma, TINT_LIGHTNESS).formatHex();
}

/** A mask of woods or bogs: white within, fading out over a node or two round their edge; nothing on a field without them or a canvas */
export function getSoftMask(field: Battlefield, grid: number[], id: string): string {
  if (!grid.some(Boolean)) return "";
  const canvas = document.createElement("canvas");
  canvas.width = COLS;
  canvas.height = ROWS;
  const context = canvas.getContext("2d");
  if (!context) return "";
  const soft = soften(soften(grid));
  const image = context.createImageData(COLS, ROWS);
  soft.forEach((value, i) => {
    const t = Math.min(Math.max((value - SOFT_EDGE[0]) / (SOFT_EDGE[1] - SOFT_EDGE[0]), 0), 1);
    image.data.set([255, 255, 255, t * t * (3 - 2 * t) * 255], i * 4);
  });
  context.putImageData(image, 0, 0);
  return /* html */ `<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="${field.width}" height="${field.height}">
    <image href="${canvas.toDataURL()}" width="${field.width}" height="${field.height}" preserveAspectRatio="none"/></mask>`;
}

/** Each node's biome tint, smoothed between the nodes; nothing on a field all of one biome */
export function getGroundMarkup(field: Battlefield): string {
  if (!field.biomes.length || field.biomes.every(biome => biome === field.biome)) return "";
  const canvas = document.createElement("canvas");
  canvas.width = COLS;
  canvas.height = ROWS;
  const context = canvas.getContext("2d");
  if (!context) return "";

  const tints = new Map<number, number[]>();
  const rgb = (biome: number): number[] => {
    if (!tints.has(biome)) {
      const { r, g, b } = hcl(getGroundTint(biome)).rgb();
      tints.set(biome, [r, g, b, 255]);
    }
    return tints.get(biome)!;
  };
  const image = context.createImageData(COLS, ROWS);
  field.biomes.forEach((biome, i) => {
    image.data.set(rgb(biome), i * 4);
  });
  context.putImageData(image, 0, 0);
  return `<image class="battleGround" href="${canvas.toDataURL()}" width="${field.width}" height="${field.height}" preserveAspectRatio="none"/>`;
}

/** Trees in the woods, the props of each biome on open ground, rocks on steep slopes, scree under cliffs, reeds and shingle by the water */
export function getPropsMarkup(field: Battlefield): string {
  const pt = field.width / 1000;
  const spacing = SPACING * pt;
  const digits = pt < 4 ? 1 : 0;
  const [sx, sy] = field.site ? field.site.map(Math.round) : [0, 0];
  const cover = { wood: soften(field.wood), marsh: soften(field.marsh), sea: soften(field.water.map(w => +(w === 1))) };
  const wind = (mix(sx, sy, 200) - 0.5) * 0.8; // the dunes of a field all face one way
  const biomes = new Map<number, BiomeProps>();
  const placed: Record<"woods" | "open", Partial<Record<Kind, string[]>>> = { woods: {}, open: {} };
  let count = 0;

  const put = (kind: Kind, x: number, y: number, roll: (layer: number) => number, woods = false): void => {
    const size = pt * GLYPH * STYLES[kind].size * (0.85 + roll(3) * 0.35);
    const angle =
      kind === "dune" ? wind + (roll(4) - 0.5) * 0.3 : kind === "rock" || kind === "scree" ? roll(4) * 6.3 : 0;
    const group = placed[woods ? "woods" : "open"];
    group[kind] ??= [];
    group[kind]!.push(drawGlyph(kind, x, y, size, angle, digits, roll));
    count++;
  };
  const isClear = (node: number): boolean =>
    !field.town[node] && !field.road[node] && !field.walled[node] && !field.deck[node] && field.water[node] !== 2;

  const spots = [Math.ceil(field.width / spacing), Math.ceil(field.height / spacing)];
  for (let row = 0; row < spots[1] && count < MOST_PROPS; row++) {
    for (let col = 0; col < spots[0] && count < MOST_PROPS; col++) {
      const roll = (layer: number): number => mix(sx * 31 + col, sy * 37 + row, 100 + layer);
      const x = (col + 0.15 + roll(0) * 0.7) * spacing;
      const y = (row + 0.15 + roll(1) * 0.7) * spacing;
      if (x > field.width || y > field.height) continue;
      const node = nodeAt(field, x, y);
      const at = {
        wood: sample(field, cover.wood, x, y),
        marsh: sample(field, cover.marsh, x, y),
        sea: sample(field, cover.sea, x, y)
      };
      if (!isClear(node) || at.sea > SHORE[1]) continue;
      const biome = field.biomes.length ? field.biomes[node] : field.biome;
      if (!biomes.has(biome)) biomes.set(biome, getBiomeProps(biome));
      const prop = choose(field, node, x, y, roll, at, biome, biomes.get(biome)!);
      if (prop) put(prop.kind, x, y, roll, prop.woods);
    }
  }

  // reeds along the river banks, either side
  field.rivers.forEach((river, index) => {
    walk(river.points, REEDS[0] * pt, (x, y, ux, uy, k) => {
      const roll = (layer: number): number => mix(sx + index * 7, sy + k, 300 + layer);
      if (count >= MOST_PROPS || roll(2) >= REEDS[1]) return;
      const side = roll(5) < 0.5 ? -1 : 1;
      const off = river.width / 2 + (0.5 + roll(6) * 2) * pt * GLYPH;
      const [rx, ry] = [x - uy * off * side, y + ux * off * side];
      if (rx < 0 || ry < 0 || rx > field.width || ry > field.height) return;
      const node = nodeAt(field, rx, ry);
      const biome = field.biomes.length ? field.biomes[node] : field.biome;
      if (!field.water[node] && !field.town[node] && !field.road[node] && !REEDLESS.includes(biome))
        put("reeds", rx, ry, roll);
    });
  });

  const paths = (group: Partial<Record<Kind, string[]>>): string =>
    (Object.keys(STYLES) as Kind[])
      .filter(kind => group[kind]?.length)
      .map(kind => {
        const { fill, stroke, width } = STYLES[kind];
        return `<path d="${group[kind]!.join("")}" fill="${fill ?? "none"}" stroke="${stroke}" stroke-width="${rn(width * pt, 3)}"/>`;
      })
      .join("");
  return /* html */ `<g class="battleProps battleWoods" stroke-linecap="round" stroke-linejoin="round">${paths(placed.woods)}</g>
    <g class="battleProps" stroke-linecap="round" stroke-linejoin="round">${paths(placed.open)}</g>`;
}

interface BiomeProps {
  pool: ReliefPool;
  trees: ReliefPool; // the pool's trees: what grows in its woods
  density: number; // share of open spots with a prop of the pool
}

function getBiomeProps(biome: number): BiomeProps {
  const pool = pack.biomes?.[biome]?.icons ?? {};
  const trees = Object.fromEntries(Object.entries(pool).filter(([entry]) => TREES.includes(POOL[entry])));
  return { pool, trees, density: Math.sqrt((pack.biomes?.[biome]?.iconsDensity ?? 0) / 250) * OPEN_SHARE };
}

/** What stands on a spot, if anything: the ground it lies on picks it */
function choose(
  field: Battlefield,
  node: number,
  x: number,
  y: number,
  roll: (layer: number) => number,
  cover: { wood: number; marsh: number; sea: number },
  biome: number,
  { pool, trees, density }: BiomeProps
): { kind: Kind; woods?: boolean } | null {
  const chance = roll(2);

  const cliff = getCliffSide(field, x, y);
  if (cliff && cliff.distance < CLIFF_BAND) return null;
  if (cliff?.below && cliff.distance < SCREE[0]) {
    const share = SCREE[1] * (1 - (cliff.distance - CLIFF_BAND) / (SCREE[0] - CLIFF_BAND));
    if (chance < share) return { kind: "scree" };
  }

  if (cover.sea > SHORE[0]) {
    if (biome === GLACIER || chance >= SHORE[2]) return null;
    return { kind: biome === WETLAND ? "reeds" : "shingle" };
  }

  if (cover.wood > WOOD[0]) {
    // thinning out to the wood's edge, as it fades
    const t = Math.min((cover.wood - WOOD[0]) / (WOOD[1] - WOOD[0]), 1);
    if (chance < WOOD[2] * t * t * (3 - 2 * t)) {
      const entry = Relief.pickEntry(trees, roll(5));
      return { kind: entry ? POOL[entry] : "deciduous", woods: cover.wood >= WOOD[3] };
    }
    if (cover.wood >= WOOD[3]) return null;
  }
  if (cover.marsh > 0.4) return null; // a bog: its own marks

  const slope = getSlope(field, node);
  const rocky = Math.min(Math.max((slope - ROCKY_SLOPE[0]) / ROCKY_SLOPE[1], 0), 1) * ROCKY_SLOPE[2];
  if (chance < rocky) return { kind: "rock" };

  const bare = BARE[biome];
  if (bare && chance < bare[1]) return { kind: bare[0] };

  if (roll(6) >= density) return null;
  const entry = Relief.pickEntry(pool, roll(5));
  const kind = entry ? POOL[entry] : undefined;
  if (!kind || (TREES.includes(kind) && roll(7) >= LONE_TREES)) return null;
  return { kind };
}

/** A glyph in field coordinates, `size` a point of it */
function drawGlyph(
  kind: Kind,
  x: number,
  y: number,
  size: number,
  angle: number,
  digits: number,
  roll: (layer: number) => number
): string {
  const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
  const p = (dx: number, dy: number): string =>
    `${rn(x + (dx * cos - dy * sin) * size, digits)} ${rn(y + (dx * sin + dy * cos) * size, digits)}`;
  const circle = (cx: number, cy: number, r: number): string => {
    const radius = rn(r * size, digits + 1);
    return `M${p(cx - r, cy)}a${radius} ${radius} 0 1 0 ${rn(radius * 2, digits + 1)} 0a${radius} ${radius} 0 1 0 ${-rn(radius * 2, digits + 1)} 0`;
  };

  switch (kind) {
    case "deciduous":
      return circle(0, 0, 2);
    case "conifer":
    case "coniferSnow":
      return `M${p(0, -2.6)}L${p(1.6, 1.4)}L${p(-1.6, 1.4)}Z`;
    case "palm":
      return `M${p(0, 1.6)}L${p(0, 0)}L${p(-2, -0.6)}M${p(0, 0)}L${p(2, -0.6)}M${p(0, 0)}L${p(-1.1, -1.8)}M${p(0, 0)}L${p(1.1, -1.8)}`;
    case "acacia":
      return `M${p(-2.4, 0)}Q${p(0, -2.2)} ${p(2.4, 0)}ZM${p(0, 0)}L${p(0, 1.6)}`;
    case "deadTree":
      return `M${p(0, 1.6)}L${p(0, -0.4)}L${p(-1.1, -1.8)}M${p(0, -0.4)}L${p(1, -1.5)}M${p(0, 0.4)}L${p(0.8, -0.4)}`;
    case "grass":
      return `M${p(-1, 0)}L${p(-1.5, -1.5)}M${p(0, 0)}L${p(0, -2)}M${p(1, 0)}L${p(1.5, -1.5)}`;
    case "cactus":
      return `M${p(0, 1.4)}L${p(0, -2)}M${p(-1.2, -1)}L${p(-1.2, 0)}L${p(0, 0)}M${p(1.2, -1.4)}L${p(1.2, -0.5)}L${p(0, -0.5)}`;
    case "dune":
      return `M${p(-3, 0.8)}Q${p(0, -1.8)} ${p(3, 0.8)}M${p(-1.8, 1)}Q${p(0, -0.4)} ${p(1.8, 1)}`;
    case "reeds":
      return `M${p(-1.4, 0.6)}L${p(1.4, 0.6)}M${p(-0.8, 0.6)}L${p(-1.1, -1.4)}M${p(0, 0.6)}L${p(0, -2)}M${p(0.8, 0.6)}L${p(1.1, -1.4)}`;
    case "rock":
    case "scree": {
      const corners = Array.from({ length: 5 }, (_, k) => {
        const [a, r] = [(k / 5) * Math.PI * 2, 0.9 + roll(10 + k) * 0.6];
        return p(Math.cos(a) * r * 1.2, Math.sin(a) * r);
      });
      return `M${corners.join("L")}Z`;
    }
    case "shingle":
      return circle(-0.9, 0.3, 0.45) + circle(0.6, -0.5, 0.4) + circle(0.5, 0.8, 0.35);
    case "crevasse":
      return `M${p(-2, 0)}Q${p(0, 0.8)} ${p(2, 0)}`;
  }
}

/** A node grid blurred as the outlines of woods and water are, to be sampled anywhere */
function soften(grid: ArrayLike<number>): Float32Array {
  const at = (col: number, row: number): number =>
    grid[Math.min(Math.max(row, 0), ROWS - 1) * COLS + Math.min(Math.max(col, 0), COLS - 1)] ?? 0;
  const soft = new Float32Array(COLS * ROWS);
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      let total = at(col, row) * 2;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) total += at(col + dx, row + dy);
      soft[row * COLS + col] = total / 11;
    }
  }
  return soft;
}

/** A softened grid between the node centres */
function sample({ cell }: Battlefield, soft: Float32Array, x: number, y: number): number {
  const [u, v] = [Math.min(Math.max(x / cell - 0.5, 0), COLS - 1), Math.min(Math.max(y / cell - 0.5, 0), ROWS - 1)];
  const [col, row] = [Math.min(Math.floor(u), COLS - 2), Math.min(Math.floor(v), ROWS - 2)];
  const [tx, ty] = [u - col, v - row];
  const at = (c: number, r: number): number => soft[r * COLS + c];
  const top = at(col, row) + (at(col + 1, row) - at(col, row)) * tx;
  const bottom = at(col, row + 1) + (at(col + 1, row + 1) - at(col, row + 1)) * tx;
  return top + (bottom - top) * ty;
}

/** The nearest cliff in nodes and whether the spot lies below it, on the right of its way: null on a field without */
function getCliffSide(
  { cliffs, cell }: Battlefield,
  x: number,
  y: number
): { distance: number; below: boolean } | null {
  let best: { distance: number; below: boolean } | null = null;
  for (const { a, b } of cliffs) {
    const [ux, uy] = [b[0] - a[0], b[1] - a[1]];
    const length = Math.hypot(ux, uy) || 1;
    const t = Math.min(Math.max(((x - a[0]) * ux + (y - a[1]) * uy) / (length * length), 0), 1);
    const distance = Math.hypot(x - a[0] - ux * t, y - a[1] - uy * t) / cell;
    if (best && distance >= best.distance) continue;
    best = { distance, below: ux * (y - a[1]) - uy * (x - a[0]) > 0 };
  }
  return best;
}

/** Rise over run at a node, read on land and on its own side of an escarpment */
function getSlope({ elevation, relief, cell, top, water }: Battlefield, node: number): number {
  const [col, row] = [node % COLS, Math.floor(node / COLS)];
  const same = (other: number): number =>
    water[other] !== 1 && (!top.length || top[other] === top[node]) ? other : node;
  const rise = (a: number, b: number, run: number): number => ((elevation[b] - elevation[a]) * relief) / (run * cell);
  const [w, e] = [same(row * COLS + Math.max(col - 1, 0)), same(row * COLS + Math.min(col + 1, COLS - 1))];
  const [n, s] = [same(Math.max(row - 1, 0) * COLS + col), same(Math.min(row + 1, ROWS - 1) * COLS + col)];
  const gx = e === w ? 0 : rise(w, e, e - w);
  const gy = n === s ? 0 : rise(n, s, (s - n) / COLS);
  return Math.hypot(gx, gy);
}

/** Every so far along a line, its point, the way it runs and the step's number */
function walk(
  points: [number, number][],
  apart: number,
  visit: (x: number, y: number, ux: number, uy: number, k: number) => void
): void {
  let [next, walked, k] = [apart / 2, 0, 0];
  for (let i = 1; i < points.length; i++) {
    const [[ax, ay], [bx, by]] = [points[i - 1], points[i]];
    const length = Math.hypot(bx - ax, by - ay);
    if (!length) continue;
    for (; next <= walked + length; next += apart) {
      const t = (next - walked) / length;
      visit(ax + (bx - ax) * t, ay + (by - ay) * t, (bx - ax) / length, (by - ay) / length, k++);
    }
    walked += length;
  }
}
