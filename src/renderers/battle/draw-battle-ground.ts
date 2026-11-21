// The ground of a battle field: a pale tint of the map's biome colours and the props on it, by the biome and the lie of the land.
// Drawn once with the field and never read by the battle. See docs/domain/battles.md

import { hcl } from "d3";
import { Relief, type ReliefPool } from "@/model/physical/relief-generator";
import { type Battlefield, Battlefields, DRY_LAKE } from "@/model/political/battle/battlefield";
import { minmax, normalize, rn } from "@/utils/number-utils";
import { walkLine } from "@/utils/path-utils";

const PAPER = "#fbf5e9"; // the ground of a biome the map has no colour for
export const ROAD = [
  ["#a39d90", 5],
  ["#fbf8f1", 2.2]
] as const; // the casing and the way, points wide: the roads, and the streets and market of a burg
const TINT_LIGHTNESS = 93;
const TINT_CHROMA = [0.35, 14]; // of the biome's chroma, and the most
const DRY_BED = "#ece2c6";
const SOFT_EDGE = [0.25, 0.75]; // of a twice-blurred grid: woods and bogs fade in between, the edge their outline had halfway
const SPACING = 11; // points between the spots a prop may stand on
const GLYPH = 1.4; // points of a glyph unit: a tree is some 6 points across
const MOST_PROPS = 6000;
const OPEN_SHARE = 0.35; // of the spots on open ground a biome of the densest relief icons fills; a sparser one by the root of its density
const WOOD = [0.3, 0.75, 0.55, 0.5]; // trees from, thickening to so much cover, on this share of spots; the wood itself from
const BOG = [0.3, 0.75, 0.6, 0.5]; // reeds in a bog alike
const LONE_TREES = 0.2; // a tree of the biome's pool stands on open ground so much more seldom than its other props
const CLIFF_BAND = 0.8; // of a node either side of a cliff stays clear for its mark
const SCREE = [2, 0.75]; // nodes below a cliff the scree reaches, and its share at the foot
const ROCKY_SLOPE = [0.15, 0.35, 0.4]; // rocks from this grade, full at so much steeper, on this share of spots
const SHORE = [0.2, 0.45, 0.8]; // the band by the sea or a lake drawn as the water's edge, and its share of shingle
const REEDS = [6, 0.45]; // points between the places along a river bank a clump of reeds may stand, and its share
const CRACKS = 0.45; // share of the spots on a dry lake bed with a crack

type PropKind =
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
  | "crevasse"
  | "crack";

interface Style {
  fill?: string;
  stroke: string;
  width: number; // points
  size: number;
}

const STYLES: Record<PropKind, Style> = {
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
  crevasse: { stroke: "#a9c2cf", width: 0.4, size: 1.2 },
  crack: { stroke: "#bba987", width: 0.35, size: 1 }
};

const KINDS = Object.keys(STYLES) as PropKind[];
const TREES = new Set<PropKind>(["deciduous", "conifer", "coniferSnow", "palm", "acacia", "deadTree"]);
const TURNED = new Set<PropKind>(["rock", "scree", "crack"]); // lie any way round
// the relief icons of a biome's pool as props
const POOL: Record<string, PropKind> = {
  ...Object.fromEntries([...TREES].map(kind => [kind, kind])),
  swamp: "reeds",
  grass: "grass",
  cactus: "cactus",
  dune: "dune"
};

const HOT_DESERT = 1;
const COLD_DESERT = 2;
const TUNDRA = 10;
const GLACIER = 11;
const WETLAND = 12;
const BARE: Partial<Record<number, [PropKind, number]>> = {
  [COLD_DESERT]: ["rock", 0.06],
  [TUNDRA]: ["rock", 0.05],
  [GLACIER]: ["crevasse", 0.12]
}; // what lies about on ground the relief icons leave bare
const REEDLESS = new Set([HOT_DESERT, COLD_DESERT, GLACIER]);

/** A number in [0, 1) fixed by the spot and the layer it is rolled for */
type Roll = (layer: number) => number;

interface BiomeProps {
  pool: ReliefPool;
  trees: ReliefPool; // the pool's trees: what grows in its woods
  density: number; // share of open spots with a prop of the pool
}

class BattleGroundRenderer {
  /** A biome's ground: its map colour made pale, so the plan stays light and every biome reads alike */
  getTint(biome: number): string {
    const color = hcl(pack.biomes?.[biome]?.color ?? "");
    if (Number.isNaN(color.l)) return PAPER;
    const chroma = Number.isNaN(color.c) ? 0 : Math.min(color.c * TINT_CHROMA[0], TINT_CHROMA[1]);
    return hcl(color.h, chroma, TINT_LIGHTNESS).formatHex();
  }

  /** A mask of woods or bogs: white within, fading out over a node or two round their edge; nothing on a field without them or a canvas */
  getSoftMask(field: Battlefield, grid: number[], id: string): string {
    if (!grid.some(Boolean)) return "";
    const soft = this.soften(field, this.soften(field, grid));
    const image = this.toImage(field, i => [
      255,
      255,
      255,
      this.smoothstep(normalize(soft[i], SOFT_EDGE[0], SOFT_EDGE[1])) * 255
    ]);
    return (
      image &&
      /* html */ `<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="${field.width}" height="${field.height}">
      ${image}</mask>`
    );
  }

  /** Each node's biome tint and the dry lake beds, smoothed between the nodes; nothing on a field all of one biome */
  getMarkup(field: Battlefield): string {
    const dry = field.lake.includes(DRY_LAKE);
    if (!dry && (!field.biomes.length || field.biomes.every(biome => biome === field.biome))) return "";
    const tints = new Map<number, number[]>();
    const rgba = (color: string): number[] => {
      const { r, g, b } = hcl(color).rgb();
      return [r, g, b, 255];
    };
    const bed = rgba(DRY_BED);
    const tint = (biome: number): number[] => {
      if (!tints.has(biome)) tints.set(biome, rgba(this.getTint(biome)));
      return tints.get(biome)!;
    };
    const image = this.toImage(field, i => (field.lake[i] === DRY_LAKE ? bed : tint(field.biomes[i] ?? field.biome)));
    return image.replace("<image ", `<image class="battleGround" `);
  }

  /** Trees in the woods and reeds in the bogs, the props of each biome on open ground, rocks on steep slopes, scree under cliffs, reeds and shingle by the water */
  getPropsMarkup(field: Battlefield): string {
    const pt = Battlefields.getPoint(field);
    const spacing = SPACING * pt;
    const digits = pt < 4 ? 1 : 0;
    const [sx, sy] = field.site ? field.site.map(Math.round) : [0, 0];
    const cover = {
      wood: this.soften(field, field.wood),
      marsh: this.soften(field, field.marsh),
      sea: this.soften(
        field,
        field.water.map(w => +(w === 1))
      )
    };
    const wind = (Battlefields.mix(sx, sy, 200) - 0.5) * 0.8; // the dunes of a field all face one way
    const biomes = new Map<number, BiomeProps>();
    const glyphs = () => Object.fromEntries(KINDS.map(kind => [kind, [] as string[]])) as Record<PropKind, string[]>;
    const placed = { covered: glyphs(), open: glyphs() }; // in woods and bogs, or not
    let count = 0;

    const put = (kind: PropKind, x: number, y: number, roll: Roll, covered = false): void => {
      const size = pt * GLYPH * STYLES[kind].size * (0.85 + roll(3) * 0.35);
      const angle = kind === "dune" ? wind + (roll(4) - 0.5) * 0.3 : TURNED.has(kind) ? roll(4) * 6.3 : 0;
      placed[covered ? "covered" : "open"][kind].push(this.drawGlyph(kind, x, y, size, angle, digits, roll));
      count++;
    };
    const nearCliff = this.getCliffReach(field);
    const isClear = (node: number): boolean =>
      !field.burg[node] && !field.road[node] && !field.walled[node] && !field.deck[node] && field.water[node] !== 2;

    const [cols, rows] = [Math.ceil(field.width / spacing), Math.ceil(field.height / spacing)];
    for (let row = 0; row < rows && count < MOST_PROPS; row++) {
      for (let col = 0; col < cols && count < MOST_PROPS; col++) {
        const roll: Roll = layer => Battlefields.mix(sx * 31 + col, sy * 37 + row, 100 + layer);
        const x = (col + 0.15 + roll(0) * 0.7) * spacing;
        const y = (row + 0.15 + roll(1) * 0.7) * spacing;
        if (x > field.width || y > field.height) continue;
        const node = Battlefields.nodeAt(field, x, y);
        const at = {
          wood: this.sample(field, cover.wood, x, y),
          marsh: this.sample(field, cover.marsh, x, y),
          sea: this.sample(field, cover.sea, x, y)
        };
        if (!isClear(node) || at.sea > SHORE[1]) continue;
        const biome = this.biomeAt(field, node);
        if (!biomes.has(biome)) biomes.set(biome, this.getBiomeProps(biome));
        const cliff = nearCliff[node] ? this.getCliffSide(field, x, y) : null;
        const prop = this.choose(field, node, cliff, roll, at, biome, biomes.get(biome)!);
        if (prop) put(prop.kind, x, y, roll, prop.covered);
      }
    }

    // reeds along the river banks, either side
    field.rivers.forEach((river, index) => {
      walkLine(river.points, REEDS[0] * pt, ([x, y], [ux, uy], step) => {
        const roll: Roll = layer => Battlefields.mix(sx + index * 7, sy + step, 300 + layer);
        if (count >= MOST_PROPS || roll(2) >= REEDS[1]) return;
        const side = roll(5) < 0.5 ? -1 : 1;
        const off = (river.width / 2 + (0.5 + roll(6) * 2) * pt * GLYPH) * side;
        const [rx, ry] = [x - uy * off, y + ux * off];
        if (rx < 0 || ry < 0 || rx > field.width || ry > field.height) return;
        const node = Battlefields.nodeAt(field, rx, ry);
        if (isClear(node) && !field.water[node] && !REEDLESS.has(this.biomeAt(field, node))) put("reeds", rx, ry, roll);
      });
    });

    const paths = (group: Record<PropKind, string[]>): string =>
      KINDS.filter(kind => group[kind].length)
        .map(kind => {
          const { fill, stroke, width } = STYLES[kind];
          return `<path d="${group[kind].join("")}" fill="${fill ?? "none"}" stroke="${stroke}" stroke-width="${rn(width * pt, 3)}"/>`;
        })
        .join("");
    return /* html */ `<g class="battleProps battleWoods" stroke-linecap="round" stroke-linejoin="round">${paths(placed.covered)}</g>
      <g class="battleProps" stroke-linecap="round" stroke-linejoin="round">${paths(placed.open)}</g>`;
  }

  private getBiomeProps(biome: number): BiomeProps {
    const pool = pack.biomes?.[biome]?.icons ?? {};
    const trees = Object.fromEntries(Object.entries(pool).filter(([entry]) => TREES.has(POOL[entry])));
    return { pool, trees, density: Math.sqrt((pack.biomes?.[biome]?.iconsDensity ?? 0) / 250) * OPEN_SHARE };
  }

  /** What stands on a spot, if anything: the ground it lies on picks it */
  private choose(
    field: Battlefield,
    node: number,
    cliff: { distance: number; below: boolean } | null,
    roll: Roll,
    cover: { wood: number; marsh: number; sea: number },
    biome: number,
    { pool, trees, density }: BiomeProps
  ): { kind: PropKind; covered?: boolean } | null {
    const chance = roll(2);

    if (cliff && cliff.distance < CLIFF_BAND) return null;
    if (cliff?.below && cliff.distance < SCREE[0]) {
      const share = SCREE[1] * (1 - (cliff.distance - CLIFF_BAND) / (SCREE[0] - CLIFF_BAND));
      if (chance < share) return { kind: "scree" };
    }

    if (cover.sea > SHORE[0]) {
      if (biome === GLACIER || chance >= SHORE[2]) return null;
      return { kind: biome === WETLAND ? "reeds" : "shingle" };
    }

    // trees in a wood and reeds in a bog, thinning out to its edge as it fades
    const thick = (value: number, [from, full, share]: number[]): boolean =>
      value > from && chance < share * this.smoothstep(normalize(value, from, full));
    if (thick(cover.wood, WOOD)) {
      const entry = Relief.pickEntry(trees, roll(5));
      return { kind: entry ? POOL[entry] : "deciduous", covered: cover.wood >= WOOD[3] };
    }
    if (thick(cover.marsh, BOG)) return { kind: "reeds", covered: cover.marsh >= BOG[3] };
    if (cover.wood >= WOOD[3] || cover.marsh >= BOG[3]) return null;
    if (field.lake[node] === DRY_LAKE) return chance < CRACKS ? { kind: "crack" } : null;

    const rocky = minmax((this.getSlope(field, node) - ROCKY_SLOPE[0]) / ROCKY_SLOPE[1], 0, 1) * ROCKY_SLOPE[2];
    if (chance < rocky) return { kind: "rock" };

    const bare = BARE[biome];
    if (bare && chance < bare[1]) return { kind: bare[0] };

    if (roll(6) >= density) return null;
    const entry = Relief.pickEntry(pool, roll(5));
    const kind = entry ? POOL[entry] : undefined;
    if (!kind || (TREES.has(kind) && roll(7) >= LONE_TREES)) return null;
    return { kind };
  }

  /** A glyph in field coordinates, `size` a point of it */
  private drawGlyph(
    kind: PropKind,
    x: number,
    y: number,
    size: number,
    angle: number,
    digits: number,
    roll: Roll
  ): string {
    const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
    const p = (dx: number, dy: number): string =>
      `${rn(x + (dx * cos - dy * sin) * size, digits)} ${rn(y + (dx * sin + dy * cos) * size, digits)}`;
    const circle = (cx: number, cy: number, r: number): string => {
      const [radius, across] = [rn(r * size, digits + 1), rn(rn(r * size, digits + 1) * 2, digits + 1)];
      return `M${p(cx - r, cy)}a${radius} ${radius} 0 1 0 ${across} 0a${radius} ${radius} 0 1 0 ${-across} 0`;
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
      case "crack":
        return `M${p(-2, 0.3)}L${p(-0.7, -0.2)}L${p(0.3, 0.5)}L${p(2, -0.1)}M${p(-0.7, -0.2)}L${p(-0.4, -1.5)}M${p(0.3, 0.5)}L${p(0.6, 1.6)}`;
    }
  }

  private smoothstep(t: number): number {
    return t * t * (3 - 2 * t);
  }

  private biomeAt(field: Battlefield, node: number): number {
    return field.biomes.length ? field.biomes[node] : field.biome;
  }

  /** The node grid as an image over the field, a pixel a node, smoothed between them; nothing without a canvas */
  private toImage(field: Battlefield, pixel: (node: number) => ArrayLike<number>): string {
    const canvas = document.createElement("canvas");
    canvas.width = field.cols;
    canvas.height = field.rows;
    const context = canvas.getContext("2d");
    if (!context) return "";
    const image = context.createImageData(field.cols, field.rows);
    for (let i = 0; i < field.cols * field.rows; i++) image.data.set(pixel(i), i * 4);
    context.putImageData(image, 0, 0);
    return `<image href="${canvas.toDataURL()}" width="${field.width}" height="${field.height}" preserveAspectRatio="none"/>`;
  }

  /** A node grid blurred as the outlines of woods and water are, to be sampled anywhere */
  private soften({ cols, rows }: Battlefield, grid: ArrayLike<number>): Float32Array {
    const at = (col: number, row: number): number =>
      grid[minmax(row, 0, rows - 1) * cols + minmax(col, 0, cols - 1)] ?? 0;
    const soft = new Float32Array(cols * rows);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        let total = at(col, row) * 2;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) total += at(col + dx, row + dy);
        soft[row * cols + col] = total / 11;
      }
    }
    return soft;
  }

  /** A softened grid between the node centres */
  private sample({ cell, cols, rows }: Battlefield, soft: Float32Array, x: number, y: number): number {
    const [u, v] = [minmax(x / cell - 0.5, 0, cols - 1), minmax(y / cell - 0.5, 0, rows - 1)];
    const [col, row] = [Math.min(Math.floor(u), cols - 2), Math.min(Math.floor(v), rows - 2)];
    const [tx, ty] = [u - col, v - row];
    const at = (c: number, r: number): number => soft[r * cols + c];
    const top = at(col, row) + (at(col + 1, row) - at(col, row)) * tx;
    const bottom = at(col, row + 1) + (at(col + 1, row + 1) - at(col, row + 1)) * tx;
    return top + (bottom - top) * ty;
  }

  /** Nodes a cliff's scree may reach: spots elsewhere need not measure the cliffs */
  private getCliffReach({ cliffs, cell, cols, rows }: Battlefield): Uint8Array {
    const reach = new Uint8Array(cols * rows);
    const margin = Math.ceil(SCREE[0]) + 1;
    for (const { a, b } of cliffs) {
      const [c0, c1] = [
        Math.floor(Math.min(a[0], b[0]) / cell) - margin,
        Math.floor(Math.max(a[0], b[0]) / cell) + margin
      ];
      const [r0, r1] = [
        Math.floor(Math.min(a[1], b[1]) / cell) - margin,
        Math.floor(Math.max(a[1], b[1]) / cell) + margin
      ];
      for (let row = Math.max(r0, 0); row <= Math.min(r1, rows - 1); row++) {
        for (let col = Math.max(c0, 0); col <= Math.min(c1, cols - 1); col++) reach[row * cols + col] = 1;
      }
    }
    return reach;
  }

  /** The nearest cliff in nodes and whether the spot lies below it, on the right of its way: null on a field without */
  private getCliffSide(
    { cliffs, cell }: Battlefield,
    x: number,
    y: number
  ): { distance: number; below: boolean } | null {
    let best: { distance: number; below: boolean } | null = null;
    for (const { a, b } of cliffs) {
      const [ux, uy] = [b[0] - a[0], b[1] - a[1]];
      const length = Math.hypot(ux, uy) || 1;
      const t = minmax(((x - a[0]) * ux + (y - a[1]) * uy) / (length * length), 0, 1);
      const distance = Math.hypot(x - a[0] - ux * t, y - a[1] - uy * t) / cell;
      if (best && distance >= best.distance) continue;
      best = { distance, below: ux * (y - a[1]) - uy * (x - a[0]) > 0 };
    }
    return best;
  }

  /** Rise over run at a node, read on land and on its own side of an escarpment */
  private getSlope({ elevation, relief, cell, cols, rows, top, water }: Battlefield, node: number): number {
    const [col, row] = [node % cols, Math.floor(node / cols)];
    const same = (other: number): number =>
      water[other] !== 1 && (!top.length || top[other] === top[node]) ? other : node;
    const rise = (a: number, b: number, run: number): number => ((elevation[b] - elevation[a]) * relief) / (run * cell);
    const [w, e] = [same(row * cols + Math.max(col - 1, 0)), same(row * cols + Math.min(col + 1, cols - 1))];
    const [n, s] = [same(Math.max(row - 1, 0) * cols + col), same(Math.min(row + 1, rows - 1) * cols + col)];
    const gx = e === w ? 0 : rise(w, e, e - w);
    const gy = n === s ? 0 : rise(n, s, (s - n) / cols);
    return Math.hypot(gx, gy);
  }
}

export const BattleGroundView = new BattleGroundRenderer();
