import { curveCatmullRom, line } from "d3";
import { clipPolygon } from "lineclip";
import { Pack } from "@/model/graph/pack-generator";
import { Coastline } from "@/model/physical/coastline-generator";
import { LAKE_SUBTYPES } from "@/model/physical/features-generator";
import { Rivers } from "@/model/physical/river-generator";
import type { Burg } from "@/model/political/burgs-generator";
import { getKmInDistanceUnit, getPeople, heightToMeters } from "@/model/units";
import type { Point } from "@/types/global";
import { FlatQueue } from "@/utils/flat-queue";
import { BattleRules, type BattleType, type Side } from "./battle-rules";
import { BattleScale, COLS, DEFAULT_BATTALION, type FieldSize, ROWS, SCENE, SURROUND } from "./battle-scale";
import { BattleSite } from "./battle-site";
import { type CliffGround, Cliffs, CORNERS } from "./cliffs";

type Box = [number, number, number, number]; // x0, y0, x1, y1

// a grid node is smaller than a battalion is deep, so the ways round the terrain follow what is drawn
const SITE_SHIFT = 300; // a battle by a river is fought off it, at most
export const BURG_END = 0.4; // of the field's reach from its middle, a burg a field battle is fought before stands at
const BURG_FAR = 0.85; // and a big one at most, by its radius

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
  outline: Point[]; // its edge as drawn, closed; `raiseWalls` sets a blob where none is given
  piers?: number; // on the sea or a lake: by its true size, the drawn one being fitted into a siege field
}

/** A stretch of a burg's wall; a gate lets through those the burg is open to */
export interface FieldWall {
  a: Point;
  b: Point;
  burg: number; // index in the field's burgs
  gate: boolean;
  jamb: boolean; // a stretch of the gateway beside the gate, drawn as wall: troops take a gate wider than it is drawn
  water: number; // what a gate opens on: 0 a road, 1 the sea or a lake, 2 a river
}

/** What a side can build on the field before its first line: see works.ts */
export type WorkKind = "stakes" | "ditch" | "wagons";

/** A stretch of works, its front on the left of the way from `a` to `b` */
export interface FieldWork {
  a: Point;
  b: Point;
  kind: WorkKind;
  side: Side; // who holds it
  builder: number | null; // the battalion building it; null for works laid in advance and wagons nobody is sent to
  done: number; // 0 to 1
  up: boolean; // finished by the start of this round: only then it counts
  harm: number; // 0 to 1: share of a gap engines knocked into a stretch of wagons; at 1 it is open, kept for the drawing
}

export interface FieldBreach {
  x: number;
  y: number;
  burg: number;
  gate: boolean; // a gate battered down
}

/** Scaling ladders stormers raise against a wall to go over it, a battalion's front of them */
export interface FieldLadders {
  x: number;
  y: number;
  burg: number;
  width: number;
  raised: number; // 0 to 1: up at 1, only then climbed
  tick: number; // when they were last worked at: once a tick, whoever is at them
}

/** A place the besieged hold their walls from: the middle of a stretch, a gate or a breach, and the way out from it */
export interface WallPost {
  at: Point;
  out: number;
  opening: boolean;
}

/** A stretch of cliff, its top on the left of the way from `a` to `b`: nobody on the ground crosses it */
export interface FieldCliff {
  a: Point;
  b: Point;
  height: number; // metres from its foot to its top
}

/** Ground of a battle: the map around its cell as the layout, with detail that is always the same for the place */
export interface Battlefield extends FieldSize {
  cols: number; // of its grid: COLS × ROWS for a battle, more for its scene
  rows: number;
  open: "sea" | "sky" | null; // no terrain: a naval or an air battle
  site: Point | null; // the map point a field of the map is built at
  biome: number; // of the site
  biomes: number[]; // of each node, ragged where biomes meet; empty on a field all of `biome`
  lake: number[]; // of each node in a lake or on a dry lake bed: 1 + its subtype's index in LAKE_SUBTYPES; empty on a field without
  // one value per grid node, row by row
  elevation: number[]; // the lie of the land, 0 the lowest to 1 the highest, the step of high ground in
  top: number[]; // 1 on high ground behind an escarpment; empty on a field without
  scarp: number[]; // metres high ground rises by, smooth over all nodes: what `top` adds; empty on a field without
  relief: number; // metres from height 0 to height 1
  base: number; // metres above sea level of height 0
  wood: number[];
  marsh: number[];
  water: number[]; // 1 sea or lake, 2 river
  ford: number[]; // a river shallow enough to wade
  deck: number[]; // a bridge over a river
  road: number[];
  burg: number[];
  walled: number[]; // within the walls of a burg: its index + 1
  rampart: number[]; // by a wall 1, by a gate 2, in a breach 3
  rivers: FieldRiver[];
  roads: Point[][];
  bridges: FieldBridge[];
  burgs: FieldBurg[];
  walls: FieldWall[]; // what stands of them
  breaches: FieldBreach[];
  ladders: FieldLadders[];
  works: FieldWork[];
  cliffs: FieldCliff[];
  held: number | null; // the burg the defenders of a siege hold
  frozen: boolean; // the rivers bear troops anywhere, as a ford
}

export interface Terrain {
  height: number;
  wood: boolean;
  marsh: boolean;
  water: number;
  shallow: boolean; // sea or lake by the land: who comes ashore wades it
  ford: boolean;
  deck: boolean; // on a bridge
  road: boolean;
  burg: boolean;
  walled: number; // within the walls of a burg: its index + 1
  rampart: number; // by a wall 1, by a gate 2, in a breach 3
}

// a river by its width: a brook is waded anywhere, a wider one at its fords, the widest only bridged
const BROOK = 18;
const WADEABLE = 26;
const FORD = 72; // length of a ford along the river

// share of the ground under trees, by biome
const WOODS: Record<number, number> = { 3: 0.15, 4: 0.2, 5: 0.5, 6: 0.55, 7: 0.7, 8: 0.65, 9: 0.55, 10: 0.05, 12: 0.2 };
const WETLAND = 12;
export const DRY_LAKE = LAKE_SUBTYPES.indexOf("dry") + 1;
const HIDING_BIOMES = [5, 6, 7, 8, 9, WETLAND]; // forests and wetland

const VIEW_MARGIN = 0.2; // of the field's width, lines are kept beyond its edge

// how a road is led over the ground
const EASY = 0.08; // rise over run a road takes in its stride: one twice as steep costs five times the way
const SPAN = 8; // ways on level ground a way over a river costs: a road bridges it once, where it is narrow
const BOG = 2; // and a way over a bog
const ROUGH = 1; // and at most over ground too fine for the plan to show: on a plain a road still winds a little
const DRIFT = 4; // battalion fronts off the line the map draws at which the way costs twice
const EVENED = 8; // times a way found from node to node is evened out
const APPROACH = 14; // metres of a bridge on either bank: a road is straight that far, and a node more
const LEAD = 2; // of that, from the middle of the stream, a road is led to the bridge anew
// the steps a way is found by: to the 8 nodes about a node and the 8 a knight's move off, so it keeps to no grid line
const WAYS: [number, number][] = [-2, -1, 0, 1, 2]
  .flatMap(dy => [-2, -1, 0, 1, 2].map((dx): [number, number] => [dx, dy]))
  .filter(([dx, dy]) => Math.abs(dx * dy) === 2 || Math.max(Math.abs(dx), Math.abs(dy)) === 1);
const GATE = 0.5; // width of a gate as drawn, in battalion fronts
const GATEWAY = 1.2; // and as troops take it: a battalion gets through without jamming
const BREACH = 0.7; // and of a breach
const WALL_INSET = 500; // half a wall as drawn is the field's width over this: who holds it stands within that
const RAMPART = 11; // how far from a wall its foot reaches
export const WALL_HEIGHT = 15; // of the walls and towers of a burg, in metres

const EVEN = 0.75; // of how much farther or nearer than the mean a corner of the cell is, the walls keep: no sliver of a burg
const SHORT = 0.15; // of the radius, a side of the cell shorter than that is no side of the walls
const BLUNT = (110 * Math.PI) / 180; // a corner sharper than that is cut off: a tower stands across it
const RUN = 0.3; // of the radius, a stretch of wall between two towers at most
const BOW = 0.06; // a side of the walls bows out by so much of its length
const BEND = 0.08; // and every tower stands off the line by up to so much of a stretch, either way

const PIER_SPAN = 400; // metres of a burg's radius for each pier it has, three at most
const QUAY_WATER = 4; // grid nodes of the sea or a lake straight out from a stretch of wall that make it a waterfront

type Stretch = { a: Point; b: Point };

const NONE: never[] = [];

const NO_WORKS: FieldWork[] = [];

class BattlefieldModule {
  private readonly stretchNodes = new WeakMap<Stretch[], { length: number; nodes: number[][] }>();

  /** A lake's subtype as stored in `field.lake`, and back */
  private toLakeCode(subtype: string): number {
    return (LAKE_SUBTYPES as readonly string[]).indexOf(subtype) + 1;
  }

  getLakeKind(field: Battlefield, node: number): string | undefined {
    return LAKE_SUBTYPES[field.lake[node] - 1];
  }

  /** A field with no ground, of the size for battalions of the default size; `prepare` sizes it to its battle */
  createEmpty(open: Battlefield["open"] = null, cols = COLS, rows = ROWS): Battlefield {
    const grid = (): number[] => new Array(cols * rows).fill(0);
    return {
      cols,
      rows,
      open,
      site: null,
      ...BattleScale.getFieldSize(DEFAULT_BATTALION),
      biome: 4,
      biomes: [],
      lake: [],
      elevation: grid(),
      top: [],
      scarp: [],
      relief: 0,
      base: 0,
      wood: grid(),
      marsh: grid(),
      water: grid(),
      ford: grid(),
      deck: grid(),
      road: grid(),
      burg: grid(),
      walled: grid(),
      rampart: grid(),
      rivers: [],
      roads: [],
      bridges: [],
      burgs: [],
      walls: [],
      breaches: [],
      ladders: [],
      works: [],
      cliffs: [],
      held: null,
      frozen: false
    };
  }

  /** A field of the map not built yet: `prepare` builds it once the size of the battalions sets its size */
  createMapField(x: number, y: number): Battlefield {
    return { ...this.createEmpty(), site: [x, y], width: 0 };
  }

  /**
   * The scene of a battle: the map round a point at true scale, a field of the size in its middle and ground round it.
   * Lines and coasts as the map draws them, the ground as it lies between the cell centres. What the map is too coarse to
   * show, hills, copses, bogs, the meanders of a river, comes from noise fixed by the place. An ambush keeps the cover in
   * the middle, a siege fits the besieged burg in, a battle from the sea is fought on the shore. `cut` takes the field out
   */
  build(x: number, y: number, size: FieldSize, type: BattleType = "field", ring?: number): Battlefield {
    const [clearing, siege] = [type !== "ambush", type === "siege"];
    const [cols, rows] = SCENE;
    const field: Battlefield = {
      ...this.createEmpty(null, cols, rows),
      site: [x, y],
      ...size,
      width: size.cell * cols,
      height: size.cell * rows
    };
    const place: Point = [Math.round(x), Math.round(y)];
    const { cells } = pack;
    const { width, height, cell: step } = field;
    const cell = Pack.findCell(x, y);
    if (cell === undefined) return field;
    field.biome = cells.biome[cell];

    const pixel = options.map.units.distance.scale * (getKmInDistanceUnit() || 1) * 1000; // metres in a map pixel
    const held = cells.burg[cell] ? pack.burgs[cells.burg[cell]] : null;
    const heldRadius = held ? this.getBurgRadius(held) : 0;
    const drawnRadius = siege ? BattleScale.fitSiegeBurg(heldRadius, size, ring) : heldRadius;
    const fromSea = BattleRules.isFromSea(type);
    const [sx, sy] = this.findSite(cell, place, pixel, drawnRadius, fromSea, type === "ambush");
    // a field battle at a burg is fought before it: the field's middle off the burg
    const [mx, my] = held && !siege && !fromSea ? this.getOutskirts([sx, sy], pixel, size, heldRadius) : [sx, sy];
    const toField = (x: number, y: number): Point => [(x - mx) * pixel + width / 2, (y - my) * pixel + height / 2];
    const inView = ([fx, fy]: Point, margin = 0): boolean =>
      fx > -margin && fx < width + margin && fy > -margin && fy < height + margin;
    const spacing = BattleSite.getSpacing();
    // a port moved onto its shore takes the ends of its roads and rivers along, less and less over a cell
    const [ox, oy] = held ? [sx - held.x, sy - held.y] : [0, 0];
    const lineToField = (mx: number, my: number): Point => {
      const pull = held ? Math.max(1 - Math.hypot(mx - held.x, my - held.y) / spacing, 0) : 0;
      return toField(mx + ox * pull, my + oy * pull);
    };
    const nearby = Pack.findAll(mx, my, spacing * 2 + width / pixel);
    if (!nearby.includes(cell)) nearby.push(cell);
    const nodes = Array.from({ length: cols * rows }, (_, i) => this.nodeCentre(field, i));

    // land and water by the coasts as drawn
    const shapes = [...new Set(nearby.map(i => cells.f[i]))]
      .map(f => pack.features[f])
      .filter(feature => feature && (feature.land || feature.type === "lake"))
      .map(feature => {
        const points = Coastline.getFeatureShape(feature).points.map(([px, py]) => toField(px, py));
        const box: [number, number, number, number] = [-step, -step, width + step, height + step];
        return {
          land: feature.land,
          lake: feature.type === "lake" ? this.toLakeCode(feature.subtype) : 0,
          outline: points.length > 2 ? clipPolygon(points, box) : [], // a feature with no outline drawn
          area: this.getArea(points) // unclipped: an island and its lake both covering the field clip alike
        };
      })
      .filter(shape => shape.outline.length > 2);
    // the innermost outline about a point: an island in a lake is land, a lake on it water again
    const shapeAt = (point: Point): (typeof shapes)[number] | undefined => {
      let inner: (typeof shapes)[number] | undefined;
      for (const shape of shapes)
        if ((!inner || shape.area < inner.area) && this.isInside(point, shape.outline)) inner = shape;
      return inner;
    };
    // a dry lake is a flat, bare bed of the land
    const isLand = (point: Point, shape = shapeAt(point)): boolean =>
      Boolean(shape && (shape.land || shape.lake === DRY_LAKE));
    const inner = nodes.map(shapeAt);
    const lakes = shapes.some(shape => shape.lake) ? inner.map(shape => shape?.lake ?? 0) : [];

    // the ground between the cell centres, within the triangle of the three cells round each node; a pseudo-cell beyond the
    // map's edge lends the values of the cell nearest it
    const toCell = (c: number): number | undefined => {
      if (c < cells.i.length) return c;
      const point = grid.boundary?.[c - cells.i.length];
      return point && Pack.findCell(point[0], point[1]);
    };
    const toPoint = (c: number): Point | undefined =>
      c < cells.i.length ? cells.p[c] : grid.boundary?.[c - cells.i.length];
    const triangles = [...new Set(nearby.flatMap(i => cells.v[i]))]
      .map(v => pack.vertices.c[v])
      .filter(corners => corners?.every(c => toCell(c) !== undefined && toPoint(c)))
      .map(corners => ({
        corners: corners.map(c => toCell(c)!),
        points: corners.map(c => toField(...(toPoint(c) as [number, number])))
      }));
    const borders = this.createNoise(field, place, 8, 160);
    const interpolate = (node: Point): { h: number; trees: number; wet: number; biome: number } => {
      for (const { corners, points } of triangles) {
        const weights = this.getBarycentric(node, points);
        if (!weights) continue;
        const sum = (value: (c: number) => number): number =>
          corners.reduce((total, c, k) => total + value(c) * weights[k], 0);
        return {
          h: sum(c => cells.h[c]),
          trees: sum(c => WOODS[cells.biome[c]] ?? 0),
          wet: sum(c => +(cells.biome[c] === WETLAND)),
          biome: this.pickBiome(corners, weights, () => borders(...node), field.biome)
        };
      }
      const biome = cells.biome[cell];
      return { h: cells.h[cell], trees: WOODS[biome] ?? 0, wet: +(biome === WETLAND), biome };
    };

    // hills below the map's grain: a tenth of the rise to the neighbours, 4 to 100 m
    const rise = cells.c[cell]
      .filter(c => cells.h[c] >= 20)
      .map(c => Math.abs(heightToMeters(cells.h[c]) - heightToMeters(cells.h[cell])));
    const roughness = Math.min(Math.max(Math.max(0, ...rise) / 10, 4), 100);
    const hills = this.createNoise(field, place, 1, 520);
    const knolls = this.createNoise(field, place, 7, 230); // off the lattice of the hills, so they do not stand in rows
    const groves = this.createNoise(field, place, 2, 260);
    const bogs = this.createNoise(field, place, 3, 220);

    field.biomes = new Array(cols * rows).fill(field.biome);
    const ground = nodes.map((node, i) => {
      if (!isLand(node, inner[i])) return null;
      const { h, trees, wet, biome } = interpolate(node);
      field.biomes[i] = biome;
      return {
        height:
          heightToMeters(Math.max(h, 20)) +
          (lakes[i] === DRY_LAKE ? 0 : hills(...node) * 0.65 + knolls(...node) * 0.35) * roughness,
        trees,
        wet
      };
    });
    // a field sited on the sea takes the biome most of its land has; water and land the map left marine take the field's
    if (!field.biome) field.biome = this.getMostCommon(field.biomes.filter(Boolean)) ?? 0;
    field.biomes = field.biomes.map((biome, i) => (ground[i] && biome) || field.biome);
    const land = ground.filter(g => g !== null).map(g => g.height);
    const low = land.length ? Math.min(...land) : 0;
    const high = land.length ? Math.max(...land) : 0;
    field.relief = high - low;
    field.base = low;
    ground.forEach((g, i) => {
      if (!g) {
        field.water[i] = 1;
        return;
      }
      const [nx, ny] = nodes[i];
      field.elevation[i] = high > low ? (g.height - low) / (high - low) : 0;
      if (lakes[i] === DRY_LAKE) return;
      const fromCentre = Math.hypot((nx - width / 2) / size.width, (ny - height / 2) / size.height);
      const open = clearing ? Math.min(0.35 + fromCentre * 2.2, 1.15) : 1.15;
      if (groves(nx, ny) < g.trees * open) field.wood[i] = 1;
      else if (bogs(nx, ny) < g.wet * 0.6) field.marsh[i] = 1;
    });
    if (lakes.length) field.lake = lakes.map((lake, i) => (field.water[i] === 1 || lake === DRY_LAKE ? lake : 0));

    // roads and rivers on the curves the map draws them with
    const near = new Set(nearby);
    const margin = width * VIEW_MARGIN;
    const box: Box = [-margin, -margin, width + margin, height + margin];
    const touches = (a: Point, b: Point): boolean => this.clipSegment(a, b, box) !== null;
    pack.rivers.forEach((river, index) => {
      if (!river.cells.some(c => near.has(c))) return;
      const course = Rivers.addMeandering(river.cells, river.points ?? null);
      const points = course.map(p => lineToField(p[0], p[1]));
      const anchors = points.filter((_, i) => course[i][2]); // only the cell centres carry flux, the meanders between none
      const flux = course.filter(p => p[2])[this.nearestIndex(anchors, [width / 2, height / 2])]?.[2] ?? 0;
      if (inView(points[0]) && points.length > 1) {
        // a spring on the field would look cut off: the river comes from beyond the edge
        const [px, py] = points[0];
        const [nx, ny] = points[Math.min(3, points.length - 1)];
        const length = Math.hypot(px - nx, py - ny) || 1;
        const reach = width + height;
        points.unshift([px + ((px - nx) / length) * reach, py + ((py - ny) / length) * reach]);
      }
      const line = this.clipToView(this.smooth(this.sliceAround(points, touches), step / 2, box), box);
      if (!line.length) return;
      const wide = Math.min(Math.max(12 + (Math.sqrt(flux) * 2) / 3, 16), 52);
      // meanders some twelve widths long, too small for the map to show
      const winding = this.bend(line, wide * 12, wide * 2.5, place, 1000 + index);
      field.rivers.push({
        points: winding,
        width: wide,
        name: `${river.name} ${river.type}`.trim(),
        brook: wide <= BROOK
      });
    });

    for (const burg of pack.burgs) {
      if (!burg.i || burg.removed) continue;
      const atSite = burg === held;
      const [bx, by] = atSite ? toField(sx, sy) : toField(burg.x, burg.y); // a port on its shore
      const radius = atSite ? drawnRadius : this.getBurgRadius(burg);
      if (!inView([bx, by], radius)) continue;
      const polygon = cells.v[burg.cell].map(v => pack.vertices.p[v]);
      field.burgs.push({
        x: bx,
        y: by,
        radius,
        name: burg.name ?? "",
        group: burg.group ?? "",
        walled: Boolean(burg.walls || burg.citadel),
        piers: this.countPiers(this.getBurgRadius(burg)),
        outline: this.getOutline({ x: bx, y: by, radius }, polygon, point => !isLand(point))
      });
    }

    // roads go as the ground lets them, between where the map brings them onto the scene and where it takes them off it
    const inRiver = nodes.map(
      (node, i) =>
        field.water[i] !== 1 && field.rivers.some(r => this.distanceToLine(node, r.points) < r.width / 2 + step * 0.3)
    );
    const [coarse, fine] = [this.createNoise(field, place, 15, 310), this.createNoise(field, place, 16, 130)]; // two lattices: neither shows
    const toll = (node: number): number => {
      if (field.water[node] === 1) return Infinity;
      const rough = coarse(...nodes[node]) * 0.6 + fine(...nodes[node]) * 0.4;
      return (inRiver[node] ? SPAN : 0) + (field.marsh[node] ? BOG : 0) + rough * ROUGH;
    };
    // a road is a curve through points far apart: it may bow into the view where the straight line between two does not
    const bowsIn = (a: Point, b: Point): boolean => {
      const bow = Math.hypot(b[0] - a[0], b[1] - a[1]) / 4;
      return this.clipSegment(a, b, [box[0] - bow, box[1] - bow, box[2] + bow, box[3] + bow]) !== null;
    };
    const lines = pack.routes
      .filter(route => route.group !== "searoutes" && route.points.some(p => near.has(p[2])))
      .map(route => route.points.map(p => lineToField(p[0], p[1])))
      .map(course => this.clipToView(this.smooth(this.sliceAround(course, bowsIn), step / 2, box), box))
      .filter(line => line.length);
    // roads meet where the map has them meet: at a burg, and where one ends on another
    const joints = [
      ...field.burgs.map((burg): Point => [burg.x, burg.y]),
      ...lines.flatMap(line => [line[0], line.at(-1)!])
    ];
    for (const line of lines) field.roads.push(this.squareCrossings(field, this.leadRoad(field, line, joints, toll)));

    // a brook is waded anywhere, a river at a ford now and then, a great river nowhere: it wants a bridge
    const fords: { points: Point[]; width: number }[] = [];
    for (const [index, river] of field.rivers.entries()) {
      let count = 0;
      const chance = (): number => this.mix(place[0] + index, place[1], 4 + count++); // the same fords for the same place
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
            const point = this.cross(road[i - 1], road[i], river.points[j - 1], river.points[j]);
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
        field.burg[i] = 1;
        field.wood[i] = field.marsh[i] = 0;
      }
      if (field.water[i] === 1) return;
      if (inRiver[i]) {
        field.water[i] = 2;
        field.wood[i] = field.marsh[i] = 0;
        if (fords.some(f => this.distanceToLine(node, f.points) < f.width / 2 + step * 0.3)) field.ford[i] = 1;
      }
      if (field.roads.some(r => this.distanceToLine(node, r) < step * 0.8)) {
        const bridged = field.bridges.some(b => Math.hypot(b.x - node[0], b.y - node[1]) < b.length / 2 + step * 0.4);
        if (field.water[i] && !bridged) return; // a road along a river is no causeway
        if (field.water[i] === 2) field.deck[i] = 1;
        field.road[i] = 1;
        field.water[i] = field.ford[i] = field.wood[i] = field.marsh[i] = 0;
      }
    });

    if (Cliffs.isRugged(roughness)) this.raiseCliffs(field, ground, nodes, roughness, place, siege);
    this.raiseWalls(field);
    return field;
  }

  /** The node of the scene a node of the field cut from its middle lies on */
  toSceneNode(scene: Battlefield, node: number): number {
    const [left, top] = SURROUND;
    return (Math.floor(node / COLS) + top) * scene.cols + (node % COLS) + left;
  }

  /** The battle's field of the size its scene was built for: the middle of the scene; burgs that reach it come along */
  cut(scene: Battlefield, size: FieldSize): Battlefield {
    const [left, top] = SURROUND;
    const [dx, dy] = [left * scene.cell, top * scene.cell];
    const field: Battlefield = { ...this.createEmpty(), site: scene.site, ...size, biome: scene.biome };
    const nodes = Array.from({ length: COLS * ROWS }, (_, i) => this.toSceneNode(scene, i));
    const slice = (grid: number[]): number[] => (grid.length ? nodes.map(node => grid[node]) : []);
    const move = ([x, y]: Point): Point => [x - dx, y - dy];
    Object.assign(field, {
      biomes: slice(scene.biomes),
      lake: slice(scene.lake),
      top: slice(scene.top),
      scarp: slice(scene.scarp),
      wood: slice(scene.wood),
      marsh: slice(scene.marsh),
      water: slice(scene.water),
      ford: slice(scene.ford),
      deck: slice(scene.deck),
      road: slice(scene.road),
      burg: slice(scene.burg),
      rivers: scene.rivers.map(river => ({ ...river, points: river.points.map(move) })),
      roads: scene.roads.map(road => road.map(move)),
      bridges: scene.bridges.map(bridge => ({ ...bridge, x: bridge.x - dx, y: bridge.y - dy })),
      burgs: scene.burgs
        .map(burg => ({ ...burg, x: burg.x - dx, y: burg.y - dy, outline: burg.outline.map(move) }))
        .filter(
          ({ x, y, radius }) =>
            x + radius > 0 && x - radius < field.width && y + radius > 0 && y - radius < field.height
        )
    });
    const box: Box = [-field.cell, -field.cell, field.width + field.cell, field.height + field.cell]; // off the field: see `toCliffs`
    field.cliffs = scene.cliffs.flatMap(cliff => {
      const [a, b] = [move(cliff.a), move(cliff.b)];
      const span = this.clipSegment(a, b, box);
      if (!span) return [];
      const at = (t: number): Point => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      return [{ a: at(span[0]), b: at(span[1]), height: cliff.height }];
    });

    // heights from the lowest land of the field
    const heights = nodes.map(node =>
      scene.water[node] === 1 ? null : scene.base + scene.elevation[node] * scene.relief
    );
    const land = heights.filter(h => h !== null);
    [field.base, field.relief] = land.length ? [Math.min(...land), Math.max(...land) - Math.min(...land)] : [0, 0];
    field.elevation = heights.map(h => (h !== null && field.relief ? (h - field.base) / field.relief : 0));
    this.raiseWalls(field);
    return field;
  }

  /** Cliffs where the ground is broken: on the coast, and on the steep edges of high ground but about a burg besieged */
  private raiseCliffs(
    field: Battlefield,
    ground: ({ height: number } | null)[],
    nodes: Point[],
    roughness: number,
    place: Point,
    siege: boolean
  ): void {
    const cliffGround: CliffGround = {
      cols: field.cols,
      rows: field.rows,
      cell: field.cell,
      front: field.front,
      water: field.water,
      open: Uint8Array.from(field.water, (water, i) => +((!water || field.ford[i] === 1) && this.isInField(field, i))), // no ground of the battle closed off but through the scene round it
      clearance: this.getClearance(field, nodes),
      height: ground.map(g => g?.height ?? 0)
    };
    field.cliffs = Cliffs.laySeaCliffs(cliffGround, roughness, this.createNoise(field, place, 11, 300));
    const scarps = siege ? null : Cliffs.raiseEscarpments(cliffGround, roughness, this.getGapNoise(field, place));
    if (scarps) {
      field.cliffs.push(...scarps.cliffs);
      field.top = scarps.top;
      field.scarp = scarps.step;
      // raised by half the step on a cliff's top side, lowered by half at its foot
      const heights = ground.map((g, i) => (g ? g.height + (scarps.top[i] - 0.5) * scarps.step[i] : null));
      const land = heights.filter(h => h !== null);
      [field.base, field.relief] = [Math.min(...land), Math.max(...land) - Math.min(...land)];
      heights.forEach((h, i) => {
        if (h !== null) field.elevation[i] = field.relief ? (h - field.base) / field.relief : 0;
      });
    }
  }

  /** A node of a scene within the battle's field */
  private isInField({ cols, rows }: Battlefield, node: number): boolean {
    const [col, row] = [node % cols, Math.floor(node / cols)];
    const [across, down] = SURROUND;
    return col >= across && col < cols - across && row >= down && row < rows - down;
  }

  /** Where the edges of high ground are cliffs: two octaves, so the lattice of either does not show */
  private getGapNoise(field: Battlefield, place: Point): (x: number, y: number) => number {
    const [coarse, fine] = [this.createNoise(field, place, 13, 420), this.createNoise(field, place, 14, 170)];
    return (x, y) => coarse(x, y) * 0.65 + fine(x, y) * 0.35;
  }

  /** Metres from each node to the nearest road or river node, or to a burg's edge with its piers taken in */
  private getClearance(field: Battlefield, nodes: Point[]): number[] {
    const { road, water, burgs } = field;
    const lines = Cliffs.getDistances(node => road[node] === 1 || water[node] === 2, field);
    return lines.map((least, node) => {
      const [x, y] = nodes[node];
      for (const burg of burgs) least = Math.min(least, Math.hypot(x - burg.x, y - burg.y) - burg.radius * 1.25);
      return least;
    });
  }

  /**
   * The walls of a burg as a medieval town has them: its cell's corners for the plan, evened out about the burg, with no
   * corner sharper than a tower holds; every side a run of straight stretches from tower to tower, bowing out a little and
   * bending with the ground, the same for the same burg. Laid with its farthest point at the radius; on the sea or a lake the
   * walls keep to the shore
   */
  private getOutline(
    burg: Pick<FieldBurg, "x" | "y" | "radius">,
    polygon?: Point[],
    isWet: (point: Point) => boolean = () => false
  ): Point[] {
    const knots =
      polygon ??
      Array.from({ length: 9 }, (_, i): Point => {
        const angle = (i / 9) * Math.PI * 2;
        const radius = 0.8 + 0.25 * Math.sin(i * 2.4 + burg.x);
        return [Math.cos(angle) * radius, Math.sin(angle) * radius * 0.85];
      });
    const [seedX, seedY] = (polygon?.[0] ?? [burg.x, burg.y]).map(v => Math.round(v * 10));
    const random = (i: number): number => this.mix(seedX, seedY, i);

    const [cx, cy] = [0, 1].map(axis => knots.reduce((total, point) => total + point[axis], 0) / knots.length);
    const far = knots.map(([x, y]) => Math.hypot(x - cx, y - cy) || 1);
    const mean = far.reduce((total, d) => total + d, 0) / far.length;
    let corners = knots.map(([x, y], i): Point => {
      const keep = (mean + (far[i] - mean) * EVEN) / far[i];
      return [((x - cx) * keep * burg.radius) / mean, ((y - cy) * keep * burg.radius) / mean];
    });
    corners = corners.filter((point, i) => {
      const next = corners[(i + 1) % corners.length];
      return corners.length <= 4 || Math.hypot(next[0] - point[0], next[1] - point[1]) >= burg.radius * SHORT;
    });
    corners = corners.flatMap((point, i): Point[] => {
      const before = corners[(i + corners.length - 1) % corners.length];
      const after = corners[(i + 1) % corners.length];
      const [u, w] = [before, after].map(([x, y]): Point => [x - point[0], y - point[1]]);
      const [lu, lw] = [Math.hypot(...u), Math.hypot(...w)];
      const cos = (u[0] * w[0] + u[1] * w[1]) / (lu * lw);
      if (Math.acos(Math.min(Math.max(cos, -1), 1)) >= BLUNT) return [point];
      const cut = Math.min(lu, lw) * 0.2;
      return [u, w].map(([x, y], k): Point => {
        const length = k ? lw : lu;
        return [point[0] + (x / length) * cut, point[1] + (y / length) * cut];
      });
    });

    const outline: Point[] = [];
    corners.forEach(([ax, ay], i) => {
      const [bx, by] = corners[(i + 1) % corners.length];
      const length = Math.hypot(bx - ax, by - ay);
      const runs = Math.max(Math.ceil(length / (burg.radius * RUN)), 1);
      // outward: away from the middle of the burg
      let [nx, ny] = [(by - ay) / length, -(bx - ax) / length];
      if (nx * (ax + bx) + ny * (ay + by) < 0) [nx, ny] = [-nx, -ny];
      outline.push([ax, ay]);
      for (let step = 1; step < runs; step++) {
        const t = step / runs;
        const off = length * BOW * 4 * t * (1 - t) + (length / runs) * BEND * (random(i * 64 + step) * 2 - 1);
        outline.push([ax + (bx - ax) * t + nx * off, ay + (by - ay) * t + ny * off]);
      }
    });
    const scale = burg.radius / Math.max(...outline.map(([x, y]) => Math.hypot(x, y)));
    const points = outline.map(([x, y]): Point => [burg.x + x * scale, burg.y + y * scale]);
    const origin = this.findDry(burg, isWet);
    if (!origin) return points;
    return points.map(point => {
      if (!isWet(point)) return point;
      // the farthest dry point on the way out
      const along = (share: number): Point => [
        origin[0] + (point[0] - origin[0]) * share,
        origin[1] + (point[1] - origin[1]) * share
      ];
      let [dry, wet] = [0, 1];
      for (let i = 0; i < 8; i++) {
        const share = (dry + wet) / 2;
        if (isWet(along(share))) wet = share;
        else dry = share;
      }
      return along(dry);
    });
  }

  /** The burg's middle, or the dry ground nearest to it: a port stands on its shore */
  private findDry(
    { x, y, radius }: Pick<FieldBurg, "x" | "y" | "radius">,
    isWet: (point: Point) => boolean
  ): Point | null {
    if (!isWet([x, y])) return [x, y];
    for (let ring = 1; ring <= 16; ring++)
      for (let k = 0; k < 16; k++) {
        const angle = (k / 16) * Math.PI * 2;
        const point: Point = [x + (Math.cos(angle) * radius * ring) / 16, y + (Math.sin(angle) * radius * ring) / 16];
        if (!isWet(point)) return point;
      }
    return null;
  }

  private getArea(polygon: Point[]): number {
    let area = 0;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++)
      area += polygon[j][0] * polygon[i][1] - polygon[i][0] * polygon[j][1];
    return Math.abs(area) / 2;
  }

  private isInside([x, y]: Point, polygon: Point[]): boolean {
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
  raiseWalls(field: Battlefield): void {
    field.walls = [];
    field.walled.fill(0);
    field.rampart.fill(0);
    const [gate, gateway, breach] = [
      this.getOpening(field, GATE),
      this.getOpening(field, GATEWAY),
      this.getOpening(field, BREACH)
    ];

    field.burgs.forEach((burg, index) => {
      if (!burg.outline.length) burg.outline = this.getOutline(burg);
      const { outline } = burg;
      const stretches = this.getStretches(outline, gate / 2);

      // nodes within the burg
      const reach = burg.radius * 1.1 + field.cell;
      for (let y = burg.y - reach; y <= burg.y + reach; y += field.cell) {
        for (let x = burg.x - reach; x <= burg.x + reach; x += field.cell) {
          if (x < 0 || y < 0 || x >= field.width || y >= field.height) continue;
          const node = this.nodeAt(field, x, y);
          if (!this.isInside(this.nodeCentre(field, node), outline)) continue;
          field.burg[node] = 1;
          if (burg.walled) field.walled[node] = index + 1;
        }
      }
      if (!burg.walled) return;

      // a gate where a road or a river comes in, one on the quay of a port, and one towards the middle of the field
      // when there is none of them
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
            const point = this.cross(points[i - 1], points[i], a, b);
            if (point) addGate(point, water);
          }
        }
      }
      for (const quay of this.getQuays(field, burg)) addGate(quay.at, 1);
      if (!gates.length) {
        const middle = (point: Point): number => Math.hypot(point[0] - field.width / 2, point[1] - field.height / 2);
        gates.push({ at: outline.reduce((best, point) => (middle(point) < middle(best) ? point : best)), water: 0 });
      }

      const near = (point: Point, [x, y]: Point, distance: number): boolean =>
        Math.hypot(point[0] - x, point[1] - y) < distance;
      // a gate battered down takes its whole gateway with it, its rubble in the middle of it
      for (const gap of field.breaches) {
        const by = gap.burg === index && gap.gate ? gates.find(other => near(other.at, [gap.x, gap.y], gateway)) : null;
        if (by) [gap.x, gap.y] = by.at;
      }
      const broken = (by: { at: Point }): boolean =>
        field.breaches.some(gap => gap.burg === index && gap.gate && near(by.at, [gap.x, gap.y], 1));
      for (const [a, b] of stretches) {
        const mid: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        if (field.breaches.some(gap => gap.burg === index && near(mid, [gap.x, gap.y], breach / 2))) continue;
        const by = gates.find(other => near(mid, other.at, gateway / 2));
        if (by && broken(by)) continue;
        const jamb = Boolean(by) && !gates.some(other => near(mid, other.at, gate / 2));
        field.walls.push({ a, b, burg: index, gate: Boolean(by), jamb, water: by?.water ?? 0 });
      }
    });

    // the foot of the walls: where they are climbed, where a gate is forced, where the rubble of a breach lies
    const raise = (node: number, value: number): void => {
      field.rampart[node] = Math.max(field.rampart[node], value);
    };
    const mark = (point: Point, reach: number, value: number): void => {
      for (let y = point[1] - reach; y <= point[1] + reach; y += field.cell / 2) {
        for (let x = point[0] - reach; x <= point[0] + reach; x += field.cell / 2) {
          if (x < 0 || y < 0 || x >= field.width || y >= field.height) continue;
          const node = this.nodeAt(field, x, y);
          const [nx, ny] = this.nodeCentre(field, node);
          if (Math.hypot(nx - point[0], ny - point[1]) <= reach) raise(node, value);
        }
      }
    };
    // and every node a wall runs through, however large the nodes: a corner it clips between two samples too
    for (const wall of field.walls) {
      const value = wall.gate ? 2 : 1;
      const parts = Math.max(Math.ceil(Math.hypot(wall.b[0] - wall.a[0], wall.b[1] - wall.a[1]) / (field.cell / 2)), 2);
      let last: [number, number] | null = null;
      for (let i = 0; i <= parts; i++) {
        const point: Point = [
          wall.a[0] + ((wall.b[0] - wall.a[0]) * i) / parts,
          wall.a[1] + ((wall.b[1] - wall.a[1]) * i) / parts
        ];
        mark(point, RAMPART, value);
        if (point[0] < 0 || point[1] < 0 || point[0] >= field.width || point[1] >= field.height) continue;
        const [col, row] = [Math.floor(point[0] / field.cell), Math.floor(point[1] / field.cell)];
        raise(row * field.cols + col, value);
        if (last && col !== last[0] && row !== last[1]) {
          raise(last[1] * field.cols + col, value);
          raise(row * field.cols + last[0], value);
        }
        last = [col, row];
      }
    }
    for (const gap of field.breaches) mark([gap.x, gap.y], breach / 2, 3);
  }

  getBreachWidth(field: Battlefield): number {
    return this.getOpening(field, BREACH);
  }

  /** How wide a gate or a breach is: so many battalion fronts, and two grid nodes at least for the ways to go through */
  private getOpening(field: Battlefield, fronts: number): number {
    return Math.max(fronts * field.front, 2 * field.cell);
  }

  /** The stretches of a closed outline, none longer than so much, sharing their ends: a gate or a breach takes in the ones about it */
  private getStretches(outline: Point[], most: number): [Point, Point][] {
    const points = outline.flatMap((a, i) => {
      const b = outline[(i + 1) % outline.length];
      const parts = Math.max(Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / most), 1);
      return Array.from(
        { length: parts },
        (_, k): Point => [a[0] + ((b[0] - a[0]) * k) / parts, a[1] + ((b[1] - a[1]) * k) / parts]
      );
    });
    return points.map((point, i): [Point, Point] => [point, points[(i + 1) % points.length]]);
  }
  private countPiers(radius: number): number {
    return Math.min(Math.max(Math.round(radius / PIER_SPAN), 1), 3);
  }

  /**
   * Where a burg on the sea or a lake has its piers, a sea gate in its wall by each: on the stretches of its edge that look
   * out on the most water, apart from each other, more of them the larger the burg. Each with the way out to the water,
   * square to the shore, and how far it is dry that way
   */
  getQuays(field: Battlefield, burg: FieldBurg): { at: Point; away: number; dry: number }[] {
    const count = burg.piers ?? this.countPiers(burg.radius);
    const apart = burg.radius * 0.5;
    const isSea = (x: number, y: number): boolean =>
      x >= 0 && y >= 0 && x < field.width && y < field.height && field.water[this.nodeAt(field, x, y)] === 1;
    const fronts = this.getStretches(burg.outline, this.getOpening(field, GATE) / 2)
      .map(([a, b]) => {
        const at: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        // square to the wall, out of the burg
        let square = Math.atan2(b[1] - a[1], b[0] - a[0]) + Math.PI / 2;
        const [nearX, nearY] = [Math.cos(square) * field.cell * 0.25, Math.sin(square) * field.cell * 0.25];
        if (this.isInside([at[0] + nearX, at[1] + nearY], burg.outline)) square += Math.PI;
        let water = 0;
        for (let i = 0; i < 8; i++) {
          if (isSea(at[0] + Math.cos(square) * field.cell * i, at[1] + Math.sin(square) * field.cell * i)) water++;
        }
        return { at, square, water };
      })
      .filter(front => front.water >= QUAY_WATER)
      .sort((a, b) => b.water - a.water);
    const quays: { at: Point; away: number; dry: number }[] = [];
    for (const { at, square } of fronts) {
      if (quays.length === count) break;
      if (quays.some(quay => Math.hypot(quay.at[0] - at[0], quay.at[1] - at[1]) < apart)) continue;
      // square to the shore about the place rather than to its one stretch of wall: towards the open water round it
      const isOpen = (x: number, y: number): boolean => isSea(x, y) && !this.isInside([x, y], burg.outline);
      let [seaX, seaY] = [0, 0];
      for (let ring = 2; ring <= 8; ring++) {
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 12) {
          const [x, y] = [Math.cos(angle), Math.sin(angle)];
          if (isOpen(at[0] + x * field.cell * ring, at[1] + y * field.cell * ring)) [seaX, seaY] = [seaX + x, seaY + y];
        }
      }
      const away = Math.hypot(seaX, seaY) > 1 ? Math.atan2(seaY, seaX) : square;
      let dry = 0;
      const isWater = (): boolean => {
        const [x, y] = [at[0] + Math.cos(away) * dry, at[1] + Math.sin(away) * dry];
        return x < 0 || y < 0 || x >= field.width || y >= field.height || isOpen(x, y);
      };
      while (dry < field.cell * 8 && !isWater()) dry += field.cell / 4;
      quays.push({ at, away, dry });
    }
    return quays;
  }

  /** Knock a gap into the wall of a burg at the point, or batter down its gate there */
  openBreach(field: Battlefield, burg: number, [x, y]: Point, gate = false): void {
    field.breaches.push({ x, y, burg, gate });
    this.raiseWalls(field);
  }

  /** Where the besieged hold their walls: over each stretch, in each gate but the sea gates and in each breach, with the way out from it */
  getWallPosts(field: Battlefield, held: number): WallPost[] {
    const burg = field.burgs[held];
    const out = ([x, y]: Point, along: number): number => {
      const normal = along + Math.PI / 2;
      const outward = Math.cos(normal) * (x - burg.x) + Math.sin(normal) * (y - burg.y) > 0;
      return outward ? normal : normal + Math.PI;
    };
    const posts = field.walls
      .filter(wall => wall.burg === held && !wall.jamb && wall.water !== 1) // nobody storms a quay from the water
      .map(({ a, b, gate }) => {
        const at: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        return { at, out: out(at, Math.atan2(b[1] - a[1], b[0] - a[0])), opening: gate };
      });
    for (const { x, y, burg: own } of field.breaches)
      if (own === held) posts.push({ at: [x, y], out: Math.atan2(y - burg.y, x - burg.x), opening: true });
    return posts;
  }

  /** Where a battalion holding a post stands: just within, its front along the wall's line and its ends too; null if that is not within */
  toPost(field: Battlefield, { width, depth }: { width: number; depth: number }, { at, out }: WallPost): Point | null {
    const burg = field.burgs[field.held!];
    const bow = (width * width) / (8 * burg.radius); // the wall curves away under its ends
    const back = depth / 2 + Math.min(bow, depth) + field.width / WALL_INSET; // clear of the wall as drawn
    const point: Point = [at[0] - Math.cos(out) * back, at[1] - Math.sin(out) * back];
    return this.terrainAt(field, ...point).walled === field.held! + 1 ? point : null;
  }

  /** How far a burg's edge lies from its middle the way of the angle; its radius where the outline gives none */
  getEdge(burg: FieldBurg, angle: number): number {
    const [dx, dy] = [Math.cos(angle), Math.sin(angle)];
    const { outline } = burg;
    let far = 0;
    outline.forEach(([ax, ay], i) => {
      const [bx, by] = outline[(i + 1) % outline.length];
      const [ex, ey] = [bx - ax, by - ay];
      const cross = dx * ey - dy * ex;
      if (!cross) return;
      const along = ((ax - burg.x) * ey - (ay - burg.y) * ex) / cross;
      const share = ((ax - burg.x) * dy - (ay - burg.y) * dx) / cross;
      if (along > 0 && share >= 0 && share <= 1) far = Math.max(far, along);
    });
    return far || burg.radius;
  }

  /** How far a point lies from a burg's edge, the walls standing or breached */
  getEdgeGap(burg: FieldBurg, [x, y]: Point): number {
    const { outline } = burg;
    if (!outline.length) return Math.max(Math.hypot(x - burg.x, y - burg.y) - burg.radius, 0);
    let least = Infinity;
    outline.forEach(([ax, ay], i) => {
      const [bx, by] = outline[(i + 1) % outline.length];
      const [dx, dy] = [bx - ax, by - ay];
      const t = Math.min(Math.max(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1), 0), 1);
      least = Math.min(least, Math.hypot(ax + dx * t - x, ay + dy * t - y));
    });
    return least;
  }

  /** The gates of a burg, as drawn: the stretches of its gateways that are no jambs */
  getGates(field: Battlefield, burg: number | null): FieldWall[] {
    return field.walls.filter(wall => wall.burg === burg && wall.gate && !wall.jamb);
  }

  /** The stretches of a burg's wall engines batter, gates among them: a gate battered down is a breach */
  getBurgWalls(field: Battlefield, burg: number | null): FieldWall[] {
    return field.walls.filter(wall => wall.burg === burg);
  }

  /** The stretches of wall, gates among them, that the straight way between two points crosses */
  getWallsBetween(field: Battlefield, from: Point, to: Point): FieldWall[] {
    return this.getCrossed(field.walls, field.cell, from, to);
  }

  /** The stretches of cliff that the straight way between two points crosses */
  getCliffsBetween(field: Battlefield, from: Point, to: Point): FieldCliff[] {
    return this.getCrossed(field.cliffs, field.cell, from, to);
  }

  /** Of the stretches, the ones the straight way crosses: checked are those of the grid nodes it passes through */
  private getCrossed<T extends Stretch>(stretches: T[], cell: number, from: Point, to: Point): T[] {
    if (!stretches.length) return NONE;
    const nodes = this.getStretchNodes(stretches, cell);
    const candidates: number[] = [];
    this.forNodesAlong(from, to, cell, node => {
      for (const i of nodes[node]) candidates.push(i);
    });
    if (!candidates.length) return NONE;
    candidates.sort((a, b) => a - b);
    let crossed: T[] = NONE;
    for (let i = 0; i < candidates.length; i++) {
      if (candidates[i] === candidates[i - 1]) continue;
      const stretch = stretches[candidates[i]];
      if (!this.crosses(from, to, stretch.a, stretch.b)) continue;
      if (crossed === NONE) crossed = [];
      crossed.push(stretch);
    }
    return crossed;
  }

  /**
   * Every grid node the straight way between two points passes through, in order (a voxel walk); points off the field
   * are on the nodes at its edge, as the stretches beyond it are
   */
  private forNodesAlong(from: Point, to: Point, cell: number, visit: (node: number) => void): void {
    const [x0, y0, x1, y1] = [from[0] / cell, from[1] / cell, to[0] / cell, to[1] / cell];
    let [col, row] = [Math.floor(x0), Math.floor(y0)];
    const [lastCol, lastRow] = [Math.floor(x1), Math.floor(y1)];
    const [dx, dy] = [x1 - x0, y1 - y0];
    const [stepCol, stepRow] = [Math.sign(dx), Math.sign(dy)];
    const [spanX, spanY] = [dx ? Math.abs(1 / dx) : Infinity, dy ? Math.abs(1 / dy) : Infinity];
    let nextX = dx ? (stepCol > 0 ? col + 1 - x0 : x0 - col) * spanX : Infinity;
    let nextY = dy ? (stepRow > 0 ? row + 1 - y0 : y0 - row) * spanY : Infinity;
    const at = (c: number, r: number): number =>
      Math.min(Math.max(r, 0), ROWS - 1) * COLS + Math.min(Math.max(c, 0), COLS - 1);
    for (let count = Math.abs(lastCol - col) + Math.abs(lastRow - row); ; count--) {
      visit(at(col, row));
      if (count <= 0) return;
      if (nextX === nextY) visit(at(col + stepCol, row)); // through a corner: both nodes by it
      if (nextX <= nextY) {
        col += stepCol;
        nextX += spanX;
      } else {
        row += stepRow;
        nextY += spanY;
      }
    }
  }

  /** The first and the last grid column (or row) between two coordinates */
  private getSpan(a: number, b: number, cell: number, count: number): [number, number] {
    const at = (value: number): number => Math.min(Math.max(Math.floor(value / cell), 0), count - 1);
    return a < b ? [at(a), at(b)] : [at(b), at(a)];
  }

  /** The stretches by the grid nodes their bounds take in, found once for the stretches as they stand */
  private getStretchNodes(stretches: Stretch[], cell: number): number[][] {
    let known = this.stretchNodes.get(stretches);
    if (!known || known.length !== stretches.length) {
      const nodes: number[][] = Array.from({ length: COLS * ROWS }, () => []);
      stretches.forEach(({ a, b }, i) => {
        const [c0, c1] = this.getSpan(a[0], b[0], cell, COLS);
        const [r0, r1] = this.getSpan(a[1], b[1], cell, ROWS);
        for (let row = r0; row <= r1; row++) for (let col = c0; col <= c1; col++) nodes[row * COLS + col].push(i);
      });
      known = { length: stretches.length, nodes };
      this.stretchNodes.set(stretches, known);
    }
    return known.nodes;
  }

  /** Whether the field needs ways over the grid for everybody: water, walls or cliffs anywhere */
  isRoughField(field: Battlefield): boolean {
    return field.water.some(Boolean) || field.walls.length > 0 || field.cliffs.length > 0;
  }

  /** Stretches of works that stand and that the straight way between two points crosses; of one side's when given */
  getWorksBetween(field: Battlefield, from: Point, to: Point, side?: FieldWork["side"]): FieldWork[] {
    if (!field.works.length) return NO_WORKS;
    let crossed = NO_WORKS;
    for (const work of field.works) {
      if (!this.isStanding(work) || (side && work.side !== side) || !this.crosses(from, to, work.a, work.b)) continue;
      if (crossed === NO_WORKS) crossed = [];
      crossed.push(work);
    }
    return crossed;
  }

  /** Whether the straight way between two points crosses a stretch of works that stands and is the kind asked for */
  hasWorksBetween(field: Battlefield, from: Point, to: Point, test: (work: FieldWork) => boolean): boolean {
    for (const work of field.works) {
      if (this.isStanding(work) && test(work) && this.crosses(from, to, work.a, work.b)) return true;
    }
    return false;
  }

  /** Whether the straight way between two points crosses one of the stretches that stand */
  crossesStanding(works: FieldWork[], from: Point, to: Point): boolean {
    for (const work of works) if (this.isStanding(work) && this.crosses(from, to, work.a, work.b)) return true;
    return false;
  }

  /** A stretch that counts: finished and not knocked down */
  isStanding(work: FieldWork): boolean {
    return work.up && work.harm < 1;
  }

  /** How far along the way from a point, as a share of it, it first meets one of the stretches; null when it meets none */
  getCrossing(works: Stretch[], from: Point, to: Point): number | null {
    let first: number | null = null;
    for (const work of works) {
      const point = this.cross(from, to, work.a, work.b);
      if (!point) continue;
      const length = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1;
      const share = Math.hypot(point[0] - from[0], point[1] - from[1]) / length;
      if (first === null || share < first) first = share;
    }
    return first;
  }

  /** Woods and marsh, where troops lie hidden */
  hidesTroops(biome: number): boolean {
    return HIDING_BIOMES.includes(biome);
  }

  /** A point of a drawing: a thousandth of the battle's width, on its field and on its scene alike */
  getPoint({ cell }: Battlefield): number {
    return (cell * COLS) / 1000;
  }

  /** The grid node a point of the field lies in */
  nodeAt({ cell, cols, rows }: Battlefield, x: number, y: number): number {
    const col = Math.min(Math.max(Math.floor(x / cell), 0), cols - 1);
    const row = Math.min(Math.max(Math.floor(y / cell), 0), rows - 1);
    return row * cols + col;
  }

  /** The middle of a grid node */
  nodeCentre({ cell, cols }: Battlefield, node: number): [number, number] {
    return [((node % cols) + 0.5) * cell, (Math.floor(node / cols) + 0.5) * cell];
  }

  /** Height of a point above the lowest ground, between the nodes as well; who is within walls stands on them */
  getElevation(field: Battlefield, x: number, y: number, onWalls = true): number {
    const node = this.nodeAt(field, x, y);
    const walls = onWalls && field.walled[node] && field.rampart[node] !== 3 ? WALL_HEIGHT : 0; // a breach is no higher than its rubble
    if (!field.relief) return walls;
    const { cell, cols, rows } = field;
    const fx = Math.min(Math.max(x / cell - 0.5, 0), cols - 1);
    const fy = Math.min(Math.max(y / cell - 0.5, 0), rows - 1);
    const [c, r] = [Math.min(Math.floor(fx), cols - 2), Math.min(Math.floor(fy), rows - 2)];
    const [dx, dy] = [fx - c, fy - r];
    const between = (at: (col: number, row: number) => number): number => {
      const top = at(c, r) * (1 - dx) + at(c + 1, r) * dx;
      const bottom = at(c, r + 1) * (1 - dx) + at(c + 1, r + 1) * dx;
      return top * (1 - dy) + bottom * dy;
    };
    const { elevation, relief, top, scarp } = field;
    if (!top.length) return between((col, row) => elevation[row * cols + col]) * relief + walls;
    // high ground: the ground under it between the nodes, and its step where the point is on it, sharp at the edge
    const under = between(
      (col, row) => elevation[row * cols + col] * relief - top[row * cols + col] * scarp[row * cols + col]
    );
    const step = this.isOnTop(top, cols, c, r, dx, dy) ? between((col, row) => scarp[row * cols + col]) : 0;
    return under + step + walls;
  }

  /**
   * Whether a point between four nodes is on the top side of a cliff, as the cliff runs between them: through the middles
   * of the sides between a top node and one at its foot (see `traceEdges`), cutting the corners off squares it crosses
   */
  private isOnTop(top: number[], cols: number, c: number, r: number, dx: number, dy: number): boolean {
    const corners = CORNERS.map(([x, y]) => ({ x, y, high: top[(r + y) * cols + c + x] === 1 }));
    const high = corners.filter(corner => corner.high);
    const low = corners.filter(corner => !corner.high);
    if (!low.length || !high.length) return !low.length;
    const cut = ({ x, y }: { x: number; y: number }): boolean => Math.abs(dx - x) + Math.abs(dy - y) < 0.5;
    if (high.length === 1) return cut(high[0]);
    if (high.length === 2 && (high[0].x === high[1].x || high[0].y === high[1].y))
      return top[(r + Math.round(dy)) * cols + c + Math.round(dx)] === 1; // straight across the square
    return !low.some(cut);
  }

  /**
   * Rise over run of the ground at a point in the direction of the heading: uphill positive.
   * The walls count for who climbs them, and only over a stretch of them: a gate and the streets within are level
   */
  getSlope(field: Battlefield, x: number, y: number, heading: number, climber = false): number {
    if (!field.relief && !climber) return 0;
    const [dx, dy] = [Math.cos(heading) * field.cell, Math.sin(heading) * field.cell];
    let [ahead, behind]: Point[] = [
      [x + dx, y + dy],
      [x - dx, y - dy]
    ];
    const walls = climber && this.getWallsBetween(field, behind, ahead).some(wall => !wall.gate);
    if (!field.cliffs.length)
      return (
        (this.getElevation(field, ...ahead, walls) - this.getElevation(field, ...behind, walls)) / (field.cell * 2)
      );
    // a cliff is no slope: the ground is read on the point's own side of it
    const here: Point = [x, y];
    if (this.getCliffsBetween(field, here, ahead).length) ahead = here;
    if (this.getCliffsBetween(field, here, behind).length) behind = here;
    const run = Math.hypot(ahead[0] - behind[0], ahead[1] - behind[1]);
    return run ? (this.getElevation(field, ...ahead, walls) - this.getElevation(field, ...behind, walls)) / run : 0;
  }

  /** Rise over run of the ground at a point the way it falls steepest; walls and cliffs do not count */
  getGrade(field: Battlefield, x: number, y: number): number {
    if (!field.relief) return 0;
    return Math.hypot(this.getSlope(field, x, y, 0), this.getSlope(field, x, y, Math.PI / 2));
  }

  /** A river troops may cross at the node: a ford, or any river frozen over */
  isFordable(field: Battlefield, node: number): boolean {
    return field.ford[node] === 1 || (field.frozen && field.water[node] === 2);
  }

  terrainAt(field: Battlefield, x: number, y: number): Terrain {
    const i = this.nodeAt(field, x, y);
    return {
      height: field.elevation[i],
      wood: field.wood[i] === 1,
      marsh: field.marsh[i] === 1,
      water: field.water[i],
      shallow: field.water[i] === 1 && this.isByLand(field, i),
      ford: this.isFordable(field, i),
      deck: field.deck[i] === 1,
      road: field.road[i] === 1,
      burg: field.burg[i] === 1,
      walled: field.walled[i],
      rampart: field.rampart[i]
    };
  }

  /** A node next to one of dry land, corners too */
  private isByLand(field: Battlefield, node: number): boolean {
    const { cols, rows } = field;
    const [col, row] = [node % cols, Math.floor(node / cols)];
    for (let y = Math.max(row - 1, 0); y <= Math.min(row + 1, rows - 1); y++)
      for (let x = Math.max(col - 1, 0); x <= Math.min(col + 1, cols - 1); x++)
        if (!field.water[y * cols + x]) return true;
    return false;
  }

  /** Whether two segments cross: as `cross` finds it, the segments whose bounds lie apart passed over at once */
  private crosses(a: Point, b: Point, c: Point, d: Point): boolean {
    if (Math.max(a[0], b[0]) < Math.min(c[0], d[0]) || Math.min(a[0], b[0]) > Math.max(c[0], d[0])) return false;
    if (Math.max(a[1], b[1]) < Math.min(c[1], d[1]) || Math.min(a[1], b[1]) > Math.max(c[1], d[1])) return false;
    const rx = b[0] - a[0];
    const ry = b[1] - a[1];
    const sx = d[0] - c[0];
    const sy = d[1] - c[1];
    const span = rx * sy - ry * sx;
    if (!span) return false;
    const t = ((c[0] - a[0]) * sy - (c[1] - a[1]) * sx) / span;
    const u = ((c[0] - a[0]) * ry - (c[1] - a[1]) * rx) / span;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  }

  /** The point where two segments cross */
  private cross(a: Point, b: Point, c: Point, d: Point): Point | null {
    const [rx, ry] = [b[0] - a[0], b[1] - a[1]];
    const [sx, sy] = [d[0] - c[0], d[1] - c[1]];
    const span = rx * sy - ry * sx;
    if (!span) return null;
    const t = ((c[0] - a[0]) * sy - (c[1] - a[1]) * sx) / span;
    const u = ((c[0] - a[0]) * ry - (c[1] - a[1]) * rx) / span;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [a[0] + rx * t, a[1] + ry * t] : null;
  }

  distanceToLine([x, y]: Point, line: Point[]): number {
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

  private nearestIndex(points: Point[], [x, y]: Point): number {
    return points.reduce(
      (best, p, i) =>
        Math.hypot(p[0] - x, p[1] - y) < Math.hypot(points[best][0] - x, points[best][1] - y) ? i : best,
      0
    );
  }

  /**
   * Where in its cell a battle is fought, in map pixels: at the burg or by the river it is named after,
   * on the crossing of a road over the river if there is one; an ambush on the road of its cell nearest the place
   */
  private findSite(
    cell: number,
    place: Point,
    pixel: number,
    burgRadius: number,
    fromSea: boolean,
    onRoad = false
  ): Point {
    const { cells } = pack;
    const burg = cells.burg[cell] ? pack.burgs[cells.burg[cell]] : null;
    if (burg?.port) return this.getHarbour(burg, pixel, burgRadius);
    if (fromSea) return BattleSite.getShore(place) ?? (burg ? [burg.x, burg.y] : place); // the fight is for the water's edge
    if (burg) return [burg.x, burg.y];

    // the curves as drawn, about the cell only
    const [cx, cy] = cells.p[cell];
    const reach = BattleSite.getSpacing() * 2;
    const close = (a: Point, b: Point): boolean => this.distanceToLine([cx, cy], [a, b]) < reach;
    const local = (points: number[][]): Point[] =>
      this.smooth(
        this.sliceAround(
          points.map(([x, y]): Point => [x, y]),
          close
        ),
        0.05,
        [cx - reach, cy - reach, cx + reach, cy + reach]
      );
    const roads = pack.routes
      .filter(route => route.group !== "searoutes" && route.points.some(p => p[2] === cell))
      .map(route => local(route.points));
    if (onRoad) {
      const far = (point: Point): number => Math.hypot(point[0] - place[0], point[1] - place[1]);
      const spots = roads.filter(road => road.length > 1).map(road => BattleSite.nearestOnLine(place, road));
      if (spots.length) return spots.reduce((a, b) => (far(b) < far(a) ? b : a));
    }
    const river = cells.r[cell] && pack.rivers.find(river => river.i === cells.r[cell]);
    if (!river) return place;
    const course = local(Rivers.addMeandering(river.cells, river.points ?? null));
    if (!course.length) return place; // a river of a cell, on an edited map
    let site = BattleSite.nearestOnLine(place, course);
    for (const road of roads) {
      for (let i = 1; i < road.length; i++) {
        for (let j = 1; j < course.length; j++) {
          const point = this.cross(road[i - 1], road[i], course[j - 1], course[j]);
          if (point && Pack.findCell(point[0], point[1]) === cell) site = point;
        }
      }
    }
    const angle = this.mix(place[0], place[1], -1) * Math.PI * 2;
    const shift = (this.mix(place[0], place[1], -2) * SITE_SHIFT) / pixel;
    return [site[0] + Math.cos(angle) * shift, site[1] + Math.sin(angle) * shift];
  }

  /**
   * The middle of a field fought before a burg: the burg at one end of it, where its defenders form up, and dry land for
   * the attackers at the other; which end by the place, where more than one will do. A big burg goes the further out,
   * half of it off the field at most: it has no walls to fight over
   */
  private getOutskirts([bx, by]: Point, pixel: number, { width, height }: FieldSize, radius: number): Point {
    const { cells } = pack;
    const isLand = ([x, y]: Point): boolean => (cells.h[Pack.findCell(x, y) ?? -1] ?? 0) >= 20;
    const sites = [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1]
    ].map(([dx, dy]) => {
      const reach = dx ? width * 0.44 : height / 2 - width * 0.05; // as Generals.reach
      const deep = Math.min(Math.max(radius / reach, BURG_END), BURG_FAR);
      const back = (share: number): Point => [bx - (dx * reach * share) / pixel, by - (dy * reach * share) / pixel];
      return { site: back(deep), dry: [back(deep), back(deep + 0.8)].filter(isLand).length };
    });
    const most = Math.max(...sites.map(site => site.dry));
    const dry = sites.filter(site => site.dry === most);
    return dry[Math.floor(this.mix(bx, by, -3) * dry.length)].site;
  }

  /** The radius of the burg a siege of the place is for, Infinity where it has none */
  getSiegeRadius([x, y]: Point): number {
    const cell = Pack.findCell(x, y);
    const burg = cell === undefined ? 0 : pack.cells.burg[cell];
    return burg ? this.getBurgRadius(pack.burgs[burg]) : Infinity;
  }

  /** A burg's radius in metres: 100 m² a dweller, as in a walled town of the Middle Ages; ten dwellers at least */
  private getBurgRadius(burg: Burg): number {
    return 10 * Math.sqrt(Math.max(getPeople(0, burg.population), 10) / Math.PI);
  }

  /** Where a port stands on the map at true scale: the map draws it a few km off the shore, the plan right on it */
  private getHarbour(burg: Burg, pixel: number, radius: number): Point {
    const water = pack.features[burg.port!];
    const coast = water?.type === "lake" ? water : pack.features[pack.cells.f[burg.cell]];
    const shore = coast && Coastline.getFeatureShape(coast).points;
    if (!shore?.length) return [burg.x, burg.y];
    const [cx, cy] = shore.reduce((a, b) =>
      Math.hypot(b[0] - burg.x, b[1] - burg.y) < Math.hypot(a[0] - burg.x, a[1] - burg.y) ? b : a
    );
    const away = Math.hypot(burg.x - cx, burg.y - cy) || 1;
    if (away > BattleSite.getSpacing() / 2) return [burg.x, burg.y]; // a river port, its sea far off
    const inland = (radius * 0.8) / pixel; // its edge at the water
    const at = (share: number): Point => [
      cx + ((burg.x - cx) / away) * inland * share,
      cy + ((burg.y - cy) / away) * inland * share
    ];
    // no further than the land goes, as the coast is drawn: a small island has its burg on it
    const isLand = (point: Point): boolean => this.isInside(point, shore as Point[]) !== (coast.type === "lake");
    let share = 1;
    while (share > 0 && !isLand(at(share))) share -= 0.125;
    return at(Math.max(share, 0));
  }

  /** The part of a line whose segments pass the test, two points more each way to keep its curve; empty when none do */
  private sliceAround(line: Point[], test: (a: Point, b: Point) => boolean): Point[] {
    let [first, last] = [-1, -1];
    for (let i = 1; i < line.length; i++) {
      if (!test(line[i - 1], line[i])) continue;
      if (first < 0) first = i - 1;
      last = i;
    }
    return first < 0 ? [] : line.slice(Math.max(first - 2, 0), last + 3);
  }

  /** The line on the curve the map draws rivers and roads with, a point every `step` or so within the box */
  private smooth(
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
  private getBarycentric([x, y]: Point, [[ax, ay], [bx, by], [cx, cy]]: Point[]): number[] | null {
    const area = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (!area) return null;
    const a = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / area;
    const b = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / area;
    const c = 1 - a - b;
    return a < -1e-9 || b < -1e-9 || c < -1e-9 ? null : [a, b, c];
  }

  /** The stretch of a line within the box, cut at its edge; empty when it passes by */
  private clipToView(line: Point[], box: Box): Point[] {
    const at = (i: number, t: number): Point => [
      line[i - 1][0] + (line[i][0] - line[i - 1][0]) * t,
      line[i - 1][1] + (line[i][1] - line[i - 1][1]) * t
    ];
    let first: [number, number] | null = null;
    let last: [number, number] | null = null;
    for (let i = 1; i < line.length; i++) {
      const span = this.clipSegment(line[i - 1], line[i], box);
      if (!span) continue;
      if (!first) first = [i, span[0]];
      last = [i, span[1]];
    }
    if (!first || !last) return [];
    return [at(...first), ...line.slice(first[0], last[0]), at(...last)];
  }

  /** Liang–Barsky: the share of a segment, from and to, that lies within a box */
  private clipSegment([ax, ay]: Point, [bx, by]: Point, [x0, y0, x1, y1]: Box): [number, number] | null {
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

  /**
   * A road of the map as it goes over the ground of the scene: led anew from where it comes onto the scene to where it
   * leaves it, by the joints it passes; where no way is found it keeps the line the map draws
   */
  private leadRoad(field: Battlefield, drawn: Point[], joints: Point[], toll: (node: number) => number): Point[] {
    const line = this.densify(drawn, field.cell / 2);
    const inside = ([x, y]: Point): boolean => x >= 0 && y >= 0 && x <= field.width && y <= field.height;
    const first = line.findIndex(inside);
    const last = line.findLastIndex(inside);
    if (first < 0 || last - first < 2) return drawn;
    const stops = new Set([first, last]);
    for (const joint of joints) {
      const i = this.nearestIndex(line, joint);
      if (i > first && i < last && Math.hypot(line[i][0] - joint[0], line[i][1] - joint[1]) < field.cell) stops.add(i);
    }
    const led: Point[] = line.slice(0, first);
    const order = [...stops].sort((a, b) => a - b);
    for (let k = 1; k < order.length; k++) {
      const leg = line.slice(order[k - 1], order[k] + 1);
      const way = this.leadWay(field, leg, toll) ?? leg;
      led.push(...(k > 1 ? way.slice(1) : way));
    }
    return [...led, ...line.slice(last + 1)];
  }

  /**
   * A road bridges a river square to the stream: where it crosses one on the scene, it is laid straight across from a
   * bridge's approach on one bank to that on the other, and what led up to the crossing is dropped and evened out to it.
   * Left as it is where the banks have no room for that, or where it would cross again
   */
  private squareCrossings(field: Battlefield, road: Point[]): Point[] {
    const inside = ([x, y]: Point): boolean => x >= 0 && y >= 0 && x <= field.width && y <= field.height;
    const far = (a: Point, b: Point): number => Math.hypot(a[0] - b[0], a[1] - b[1]);
    let line = road;
    for (const river of field.rivers) {
      const { points: course, width } = river;
      /** Where a stretch of the road crosses the river, and the way the river runs there */
      const crossAt = (a: Point, b: Point): { at: Point; flow: Point } | null => {
        for (let j = 1; j < course.length; j++) {
          const at = this.cross(a, b, course[j - 1], course[j]);
          if (!at) continue;
          const length = far(course[j - 1], course[j]) || 1;
          return {
            at,
            flow: [(course[j][0] - course[j - 1][0]) / length, (course[j][1] - course[j - 1][1]) / length]
          };
        }
        return null;
      };
      const count = (points: Point[]): number =>
        points.reduce((sum, point, k) => sum + +(k > 0 && crossAt(points[k - 1], point) !== null), 0);
      const reach = width / 2 + APPROACH + field.cell; // from the middle of the stream to the end of the approach

      for (let i = 1; i < line.length; i++) {
        const crossing = crossAt(line[i - 1], line[i]);
        if (!crossing || !inside(crossing.at)) continue;
        const { at, flow } = crossing;
        // what leads up to the crossing and away from it goes: from further off the road comes to the bridge anew
        let [from, to] = [i - 1, i];
        while (from > 0 && far(line[from], at) < reach * LEAD) from--;
        while (to < line.length - 1 && far(line[to], at) < reach * LEAD) to++;
        const along = (line[to][0] - line[from][0]) * -flow[1] + (line[to][1] - line[from][1]) * flow[0];
        const sign = along < 0 ? -1 : 1;
        const [nx, ny] = [-flow[1] * sign, flow[0] * sign]; // across the stream, the way the road goes
        const [near, off]: Point[] = [
          [at[0] - nx * reach, at[1] - ny * reach],
          [at[0] + nx * reach, at[1] + ny * reach]
        ];
        const dry = (point: Point): boolean =>
          field.water[this.nodeAt(field, ...point)] !== 1 && this.distanceToLine(point, course) > width / 2;
        const clear =
          count(line.slice(from, to + 1)) % 2 === 1 && // not a bend it only dips into
          dry(near) &&
          dry(off) &&
          count([near, off]) === 1 &&
          count([line[from], near]) + count([off, line[to]]) === 0;
        if (!clear) continue;
        line = [...line.slice(0, from + 1), near, at, off, ...line.slice(to)];
        i = from + 3;
      }
    }
    return line;
  }

  /**
   * The way a road takes from the first point of a line to its last: the cheapest over the grid, where a climb costs by
   * its steepness, a node by its toll (Infinity bars it) and by how far off the line it lies, evened out to a curve.
   * `shut` bars a step between two nodes. Null where there is no way
   */
  leadWay(
    field: Battlefield,
    line: Point[],
    toll: (node: number) => number,
    shut?: (from: Point, to: Point) => boolean
  ): Point[] | null {
    const { cols, rows, cell, front } = field;
    const [from, to] = [line[0], line.at(-1)!];
    const [start, goal] = [this.nodeAt(field, ...from), this.nodeAt(field, ...to)];
    if (start === goal) return [from, to];
    const every = Math.max(Math.round(line.length / 12), 1);
    const guide = [...line.filter((_, i) => i % every === 0), to];
    const height = (node: number): number => field.elevation[node] * field.relief;

    const cost = new Float64Array(cols * rows).fill(Infinity);
    const prev = new Int32Array(cols * rows).fill(-1);
    const dues = new Float64Array(cols * rows).fill(-1); // what a way over a node costs, a way on level open ground being 1
    const due = (node: number): number => {
      if (dues[node] < 0) {
        const off = this.distanceToLine(this.nodeCentre(field, node), guide) / (DRIFT * front);
        dues[node] = 1 + toll(node) + off * off;
      }
      return dues[node];
    };
    const queue = new FlatQueue<number>();
    cost[start] = 0;
    queue.push(start, 0);
    while (queue.length) {
      const reached = queue.peekValue();
      const node = queue.pop();
      if (node === goal) break;
      if (reached > cost[node]) continue;
      const [col, row] = [node % cols, Math.floor(node / cols)];
      for (const [dx, dy] of WAYS) {
        const [x, y] = [col + dx, row + dy];
        if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
        const next = y * cols + x;
        let rate = due(next);
        if (dx * dx + dy * dy > 2) {
          // a long step goes between two nodes: over the dearer of them
          const [sx, sy] = [Math.abs(dx) > 1 ? dx / 2 : 0, Math.abs(dy) > 1 ? dy / 2 : 0];
          const [near, far] = [(row + sy) * cols + col + sx, (row + dy - sy) * cols + col + dx - sx];
          rate = (rate + Math.max(due(near), due(far))) / 2;
        }
        if (rate === Infinity) continue;
        if (shut?.(this.nodeCentre(field, node), this.nodeCentre(field, next))) continue;
        const length = Math.hypot(dx, dy) * cell;
        const grade = (height(next) - height(node)) / length / EASY;
        const total = reached + length * (rate + grade * grade);
        if (total >= cost[next]) continue;
        cost[next] = total;
        prev[next] = node;
        queue.push(next, total);
      }
    }
    if (prev[goal] < 0) return null;

    let way: Point[] = [to];
    for (let node = prev[goal]; node !== start; node = prev[node]) way.push(this.nodeCentre(field, node));
    way.push(from);
    way.reverse();
    // evened out, but never into what bars it
    for (let pass = 0; pass < EVENED; pass++)
      way = way.map(([x, y], i): Point => {
        if (!i || i === way.length - 1) return [x, y];
        const [[ax, ay], [bx, by]] = [way[i - 1], way[i + 1]];
        const even: Point = [(ax + x * 2 + bx) / 4, (ay + y * 2 + by) / 4];
        return due(this.nodeAt(field, ...even)) === Infinity || shut?.([x, y], even) ? [x, y] : even;
      });
    return way;
  }

  /** The line with a point every `step` or so along it */
  densify(line: Point[], step: number): Point[] {
    const points: Point[] = [line[0]];
    for (let i = 1; i < line.length; i++) {
      const [[ax, ay], [bx, by]] = [line[i - 1], line[i]];
      const parts = Math.max(Math.ceil(Math.hypot(bx - ax, by - ay) / step), 1);
      for (let k = 1; k <= parts; k++) points.push([ax + ((bx - ax) * k) / parts, ay + ((by - ay) * k) / parts]);
    }
    return points;
  }

  /** A line wound about its course, sideways by up to the amplitude, a bend about every wavelength */
  private bend(line: Point[], wavelength: number, amplitude: number, place: Point, layer: number): Point[] {
    const knot = wavelength / 2;
    const at = (k: number): number => this.mix(place[0] * 31 + k, place[1] * 37, layer);
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
  mix(a: number, b: number, c: number): number {
    let hash = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 1274126177)) | 0;
    hash = Math.imul(hash ^ (hash >>> 13), 1103515245);
    return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
  }

  private getMostCommon(values: number[]): number | undefined {
    const counts = new Map<number, number>();
    for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0];
  }

  /** One of the corners' land biomes by its share of the node: the noise roughens the border between them */
  private pickBiome(corners: number[], weights: number[], roll: () => number, fallback: number): number {
    const [a, b, c] = corners.map(corner => pack.cells.biome[corner]);
    if (a === b && b === c) return a || fallback; // inside a biome: nothing to pick
    const shares = new Map<number, number>();
    corners.forEach((c, k) => {
      const biome = pack.cells.biome[c];
      if (biome) shares.set(biome, (shares.get(biome) ?? 0) + weights[k]); // a marine cell lends the shore no biome
    });
    const sorted = [...shares].sort((a, b) => a[0] - b[0]);
    const sum = sorted.reduce((total, [, share]) => total + share, 0);
    const draw = roll();
    let total = 0;
    for (const [biome, share] of sorted) {
      total += share / sum;
      if (draw < total) return biome;
    }
    return sorted.at(-1)?.[0] ?? fallback;
  }

  /** Smooth noise, 0 to 1, of a pattern fixed by the place on the map and the layer it is for */
  private createNoise(field: Battlefield, place: Point, layer: number, size: number): (x: number, y: number) => number {
    const cols = Math.ceil(field.width / size) + 2;
    const rows = Math.ceil(field.height / size) + 2;
    const lattice = Array.from({ length: cols * rows }, (_, i) =>
      this.mix(place[0] * 31 + (i % cols), place[1] * 37 + ((i / cols) | 0), layer)
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
}

export const Battlefields = new BattlefieldModule();
