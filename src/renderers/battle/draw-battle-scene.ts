import { color, contours, curveBasisClosed, curveCatmullRom, line, select } from "d3";
import { type BattleLook, DEFAULT_BATTLE_OPTIONS } from "@/data/battle-options";
import { BATTLE_ACTION_LABELS } from "@/data/id-labels";
import { Icons } from "@/model/icons";
import type { Battle, Block } from "@/model/political/battle/battle";
import type { Side } from "@/model/political/battle/battle-rules";
import { BattleScale } from "@/model/political/battle/battle-scale";
import { type Battlefield, Battlefields, type FieldWork, type WorkKind } from "@/model/political/battle/battlefield";
import { SKIES } from "@/model/political/battle/weather";
import { convertSpeed, formatLength, getSpeedUnit } from "@/model/units";
import { BattleCamera, type View } from "@/renderers/battle/battle-camera";
import { BattleCliffsView } from "@/renderers/battle/draw-battle-cliffs";
import { BattleDebugView } from "@/renderers/battle/draw-battle-debug";
import { BattleGroundView } from "@/renderers/battle/draw-battle-ground";
import { BattleReliefView } from "@/renderers/battle/draw-battle-relief";
import { BattleWeatherView } from "@/renderers/battle/draw-battle-weather";
import type { Point } from "@/types/global";
import { sentences, t } from "@/utils/i18n";
import { capitalize, escapeHtml } from "@/utils/string-utils";

type Group = ReturnType<typeof select<SVGGElement, unknown>>;

/** Where blocks stood a tick ago, to glide between ticks */
export type Positions = Map<number, { x: number; y: number; facing: number }>;

export type SideColors = Record<Side, string>;

/** Attackers are red and defenders blue by default whatever their states' colours, so the sides never look alike */
export const SIDE_COLORS: SideColors = { attackers: "#c8473d", defenders: "#3f72b3" };

/** What a scene shows and how it is coloured, and the zoom its marks are sized for */
interface Scene {
  look: BattleLook;
  colors: SideColors;
  marks: number;
  hovered: number | null; // the battalion under the pointer
  selected: Set<number>;
}
const RESCALE = 0.03; // marks are sized anew when the zoom changed by more than this share
const ICON = 16; // points a unit icon is wide at the most, unzoomed: it grows with the zoom like the block

// what a unit type shoots, the rest are dotted arcs
const MISSILES: Record<string, "arrows" | "shell"> = { ranged: "arrows", machinery: "shell", naval: "shell" };
const VOLLEY_TICKS = 4; // arrows are in the air
const VOLLEY = [
  [0, 0],
  [0.07, 4],
  [0.04, -4]
]; // how far behind the first arrow each one flies, and how far aside
const SHELL_TICKS = 6; // from shot to shot
const SHELL_FLIGHT = 0.6; // share of that the shell flies, then it bursts

const INK = "#3d3a33";
const EDGE = 0.2; // opacity of the line along the field's edge, within its scene
const WATER = "#b4cbe2";
// sea and lake water by kind: a sandy strand, a salt crust, ice, lava; the other lakes are open water
const WATERS: Record<string, { fill: string; strand?: string; rim?: string }> = {
  open: { fill: WATER, strand: "#e8dcbc" },
  salt: { fill: "#bfd3df", strand: "#f6f3ea" },
  frozen: { fill: "#e5eef3", rim: "#b9cad6" },
  lava: { fill: "#e9a07a", rim: "#9b4b2e" }
};

const LOOK_LAYERS: [keyof BattleLook, string][] = [
  ["woods", ".battleWoods"],
  ["props", ".battleProps"],
  ["labels", ".battleLabels, .battleRiverName"],
  ["icons", ".battleIcon"],
  ["flags", ".battleFlag"],
  ["health", ".battleHealth"],
  ["arrows", ".battleArrows"],
  ["fire", ".battleFire"],
  ["missiles", ".battleMissiles"],
  ["clashes", ".battleClashes"]
];

const TOWER_SPACING = 40; // points between the towers of a wall
const WALL = "#55524b";
const PIER = "#8f877a";
const PIER_REACH = 0.25; // of a burg's radius a pier goes out into the water
const PIER_LONGEST = 300; // metres
const PIER_SHORTEST = 24; // points: legible on any field
const PIER_WIDTH = 12; // metres

// Works as old battle plans draw them: flat, one colour a kind, in the plan's ink; sizes in points
const WORK_COLORS: Record<WorkKind, string> = { ditch: "#8a6d4b", stakes: "#6b4f32", wagons: "#9a7044" };
const WAGON_OUTLINE = "#3d2a18";
const WORK_PATHS: [WorkKind, "standing" | "building" | "down"][] = [
  ["ditch", "standing"],
  ["ditch", "building"],
  ["stakes", "standing"],
  ["stakes", "building"],
  ["wagons", "standing"],
  ["wagons", "building"],
  ["wagons", "down"]
];
const HACHURE = [3, 5]; // long, apart
const STAKE = [4, 3, 0.6]; // long, apart, thick
// a wagon is a wall of planks on wheels, seen from above: long, thick, a wheel across each end, apart from the next
const WAGON = { long: 6, thick: 1.2, wheel: [2.4, 0.6], inset: 0.7, apart: 1, outline: 0.25 };

const WORK_HOVER = 8; // points wide a stretch reacts to the pointer

const WORK_LABELS: Record<WorkKind, () => string> = {
  stakes: () => t("Stakes"),
  ditch: () => t("Ditch"),
  wagons: () => t("Wagons")
};
const SIDE_LABELS: Record<Side, () => string> = { attackers: () => t("Attackers"), defenders: () => t("Defenders") };

const WHITE_FLAG = `<path d="M0 6V-14" stroke-width="1.2"/><path d="M0 -14q3 -1.5 6 0t6 0v7q-3 1.5 -6 0t-6 0z" fill="#fff"/>`;
const HEALTH_INSET = 1.5; // half the health line: it lies inside the block, against its outline
const TURN_STEP = Math.PI / 12;

const LAG = 0.8; // ticks the shown place trails the battle by: it evens out the jostle of a crowd
const LEAP = 100; // points: a move further than this is shown at once

const FADE = 12; // ticks a destroyed battalion takes to fade away
const OUTLINE = 0.45; // opacity of the outline a destroyed battalion leaves where it fell

/** The box dragged to pick battalions, and the handle that turns the picked ones round their middle */
export interface Selection {
  box: [Point, Point] | null;
  handle: { at: Point; facing: number } | null; // before the picked battalions, the way they face
}

const HANDLE = 8; // points: the radius of the turning handle
// an arc round the disc, open towards the troops, with a head at each end
const TURN_ARC = "M-0.89 -4.29A4.3 4.3 0 1 1 -0.89 4.29";
const TURN_HEADS = "M-2.07 4.04L0.26 2.75L-0.02 5.74ZM-2.07 -4.04L-0.02 -5.74L0.26 -2.75Z";
const HALO = [4, 0.3]; // a soft glow round a picked battalion: points wide, its opacity

/** Where each battalion went since the last key moment, sampled once a round: by the screen while paused, and in keyframes */
export type Trails = Map<number, Point[]>;
const ARROWHEAD = 7; // points

class BattleSceneRenderer {
  private readonly scenes = new WeakMap<SVGSVGElement, Scene>();
  private readonly shown = new WeakMap<SVGSVGElement, { time: number; at: Positions }>();
  private readonly fallen = new WeakMap<Block, number>(); // when a battalion was first drawn destroyed

  private getScene(svg: SVGSVGElement): Scene {
    if (!this.scenes.has(svg))
      this.scenes.set(svg, {
        look: DEFAULT_BATTLE_OPTIONS.rendering,
        colors: SIDE_COLORS,
        marks: 1,
        hovered: null,
        selected: new Set()
      });
    return this.scenes.get(svg)!;
  }

  private darker(fill: string, k: number): string {
    return color(fill)!.darker(k).formatHex();
  }

  /** The field is drawn in metres; what it shows at a size on screen, as marks and lines, is sized in points of a 1000-wide field */
  private getPoint(field: Battlefield): number {
    return field.width / 1000;
  }

  /** A point of what keeps its size on screen, flags, labels and fire lines: it shrinks on the field as the view zooms in */
  private getMark(svg: SVGSVGElement, field: Battlefield): number {
    return this.getPoint(field) / this.getScene(svg).marks;
  }

  /** Where a mark drawn in points stands: its own lines and sizes are then in points */
  private markAt(x: number, y: number, pt: number): string {
    return `translate(${x} ${y}) scale(${pt})`;
  }

  /** What to draw and in which colours; applied at once, by a style the scene and its exports carry */
  setLook(svg: SVGSVGElement, look: BattleLook, colors: SideColors): void {
    Object.assign(this.getScene(svg), { look, colors });
    const style = svg.querySelector("style.battleLook");
    if (style) style.textContent = this.getLookStyle(look);
  }

  // the relief in its chosen style; contour labels only with the contours they run along
  private getHiddenRelief({ relief, shade, heights }: BattleLook): string[] {
    return [
      ...(relief === "hachures" ? [] : [".battleHachures"]),
      ...(relief === "contours" ? [] : [".battleContours", ".battleContourLabels"]),
      ...(shade ? [] : [".battleShade"]),
      ...(heights ? [] : [".battleContourLabels", ".battleHeights"])
    ];
  }

  private getLookStyle(look: BattleLook): string {
    return `${[
      ...LOOK_LAYERS.filter(([key]) => !look[key]).map(([, selector]) => selector),
      ...this.getHiddenRelief(look)
    ]
      .map(selector => `${selector} { display: none; }`)
      .join(" ")} .battleFallen > rect { fill: none; } .battleFallen > :not(rect) { display: none; }`;
  }

  /** Show a part of the field; marks are sized anew for the zoom when it changed by more than a few percent */
  setView(svg: SVGSVGElement, field: Battlefield, view: View): void {
    const box = [view.x, view.y, view.width, view.height].map(value => value.toFixed(2)).join(" ");
    if (svg.getAttribute("viewBox") !== box) svg.setAttribute("viewBox", box);
    const scene = this.getScene(svg);
    const zoom = field.width / view.width;
    if (Math.abs(zoom - scene.marks) <= scene.marks * RESCALE) return;
    scene.marks = zoom;
    this.scaleMarks(svg, field);
  }

  /** Labels, outlines, flags and fire lines at the size they keep on screen */
  private scaleMarks(svg: SVGSVGElement, field: Battlefield): void {
    const mark = this.getMark(svg, field);
    const pt = this.getPoint(field);
    for (const label of svg.querySelectorAll<SVGGElement>(".battleLabel"))
      label.setAttribute("transform", this.markAt(+label.dataset.x!, +label.dataset.y!, mark));
    for (const name of svg.querySelectorAll<SVGTextElement>(".battleRiverName")) {
      name.setAttribute("font-size", String(11 * mark));
      name.setAttribute("dy", String(-+name.dataset.width! / 2 - 3 * mark));
      name.setAttribute("stroke-width", String(2.5 * mark));
    }
    const fire = svg.querySelector(".battleFire");
    fire?.setAttribute("stroke-width", String(mark));
    fire?.setAttribute("stroke-dasharray", `${2 * mark} ${5 * mark}`);
    select(svg)
      .selectAll<SVGGElement, Block>(".battleBlock")
      .each((block, i, nodes) => {
        this.sizeBlock(nodes[i], block, mark, pt);
      });
  }

  /**
   * The field and its scene round it: the ground drawn once from the scene, a faint line along the field's edge, the
   * walls, which the battle breaches, from the field within it. Without a scene, the field's own ground
   */
  drawField(svg: SVGSVGElement, field: Battlefield, scene: Battlefield | null = null): void {
    const paper =
      field.open === "sea" ? "#d3e0ea" : field.open === "sky" ? "#eaf1f7" : BattleGroundView.getTint(field.biome);
    const { width, height } = field;
    const pt = this.getPoint(field);
    this.getScene(svg).marks = 1;
    const box = BattleCamera.getFieldView(field);
    const ground = scene ?? field;
    const area = BattleCamera.getSceneBox(field);
    const [dx, dy] = scene ? [area.x, area.y] : [0, 0]; // the scene's corner from the field's
    const whole = `x="${area.x}" y="${area.y}" width="${area.width}" height="${area.height}"`;
    const outside = `M${-dx} ${-dy}h${width}v${height}h${-width}ZM0 0h${ground.width}v${ground.height}h${-ground.width}Z`;
    svg.setAttribute("viewBox", `${box.x} ${box.y} ${box.width} ${box.height}`);
    delete svg.dataset.works; // the works layer is drawn empty: `updateBlocks` fills it
    svg.dataset.breaches = String(field.breaches.length);

    svg.innerHTML = /* html */ `<style class="battleLook">${this.getLookStyle(this.getScene(svg).look)}</style><defs>
        <pattern id="battleTown" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="scale(${pt}) rotate(45)">
          <rect width="6" height="6" fill="#f4f1ea"/><path d="M0 0v6" stroke="#77736b" stroke-width="2"/>
        </pattern>
        <pattern id="battleFord" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="scale(${pt})">
          <rect width="7" height="7" fill="#e4edf4"/><circle cx="2" cy="2" r="0.9" fill="#8ea5b8"/><circle cx="5.5" cy="5.2" r="0.7" fill="#8ea5b8"/>
        </pattern>
        <clipPath id="battleFrame"><rect width="${width}" height="${height}"/></clipPath>
        <clipPath id="battleGround"><rect width="${ground.width}" height="${ground.height}"/></clipPath>
        <clipPath id="battleOutside"><path d="${outside}" clip-rule="evenodd"/></clipPath>
        <mask id="battleRivers" maskUnits="userSpaceOnUse" x="0" y="0" width="${ground.width}" height="${ground.height}"></mask>
      </defs>
      <rect ${whole} fill="${paper}"/>
      <g class="battleTerrain" transform="translate(${dx} ${dy})" clip-path="url(#battleGround)"></g>
      <g class="battleWalls" clip-path="url(#battleFrame)"></g>
      ${scene ? `<rect width="${width}" height="${height}" fill="none" stroke="${INK}" stroke-opacity="${EDGE}" stroke-width="${pt}" pointer-events="none"/>` : ""}
      <rect class="battleFrost" ${whole} fill="#f6f9fb" opacity="0.2" display="none" pointer-events="none"/>
      <g class="battleMud" display="none" pointer-events="none">
        <rect ${whole} fill="#6b4a26" opacity="0.04"/>
        <g transform="translate(${dx} ${dy})">${field.open ? "" : BattleWeatherView.getMudMarkup(ground)}</g>
      </g>
      <g class="battleLabels" pointer-events="none"></g>
      <g class="battleWorks" fill="none" stroke-width="${1.6 * pt}" pointer-events="none">${WORK_PATHS.map(
        ([kind, state]) =>
          `<path data-work="${kind} ${state}" ${kind === "wagons" ? `fill="${WORK_COLORS.wagons}" stroke="${WAGON_OUTLINE}" stroke-width="${WAGON.outline * pt}"` : `stroke="${WORK_COLORS[kind]}"`} ${kind === "stakes" ? `stroke-width="${STAKE[2] * pt}"` : ""} ${state === "building" ? `opacity="0.5"` : ""}/>`
      ).join("")}</g>
      <g class="battleWorkTips" stroke="none" pointer-events="stroke"></g>
      <g class="battleFire" fill="none" stroke-width="${pt}" stroke-dasharray="${2 * pt} ${5 * pt}" opacity="0.55"></g>
      <g class="battleArrows" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.8" pointer-events="none"></g>
      <g class="battleHover" fill="none" pointer-events="none"></g>
      <g class="battleBlocks"></g>
      <g class="battleMissiles" fill="none" stroke-linecap="round" pointer-events="none"></g>
      <g class="battleClashes" text-anchor="middle" dominant-baseline="central" fill="#b3261e" pointer-events="none"></g>
      <g class="battleSelection" fill="none" stroke="#222"></g>`;

    if (field.open) return;
    const terrain = select(svg).select<SVGGElement>(".battleTerrain");
    this.drawTerrain(svg, terrain, ground, paper, pt);
    if (scene) this.drawWalls(terrain.append("g").attr("clip-path", "url(#battleOutside)"), scene, pt);
    this.drawWalls(select(svg).select(".battleWalls"), field, pt);

    const labels = select(svg).select<SVGGElement>(".battleLabels");
    for (const burg of ground.burgs) {
      // above the burg, or below it when the edge is too close
      const [x, y] = [burg.x + dx, burg.y + dy];
      const top = y - burg.radius * 0.9 - 2 * pt;
      const below = top < box.y + 24 * pt ? y + burg.radius * 0.9 + 13 * pt : top;
      this.label(labels, field, `${burg.name} ${burg.group}`, x, below, 13, INK);
    }

    // names run along the rivers, left to right
    const course = line<Point>().curve(curveCatmullRom.alpha(0.5));
    field.rivers.forEach((river, i) => {
      const inside = river.points.filter(
        ([x, y]) => x > 30 * pt && x < width - 30 * pt && y > 20 * pt && y < height - 20 * pt
      );
      if (inside.length < 2 || !river.name) return;
      if (inside[0][0] > inside.at(-1)![0]) inside.reverse();
      labels.append("path").attr("id", `battleRiver${i}`).attr("d", course(inside)).attr("fill", "none");
      labels
        .append("text")
        .attr("class", "battleRiverName")
        .attr("data-width", river.width)
        .attr("dy", -river.width / 2 - 3 * pt)
        .attr("font-size", 11 * pt)
        .attr("font-style", "italic")
        .attr("fill", "#2b3a7c")
        .attr("paint-order", "stroke")
        .attr("stroke", paper)
        .attr("stroke-width", 2.5 * pt)
        .append("textPath")
        .attr("href", `#battleRiver${i}`)
        .attr("startOffset", "50%")
        .attr("text-anchor", "middle")
        .text(river.name);
    });
  }

  /** The ground with its waters, roads and towns */
  private drawTerrain(svg: SVGSVGElement, terrain: Group, field: Battlefield, paper: string, pt: number): void {
    const { width, height } = field;
    terrain.append("g").html(BattleGroundView.getMarkup(field));
    // woods and bogs fade out at their edges; without a canvas their outlines are drawn sharp
    const masks = {
      wood: BattleGroundView.getSoftMask(field, field.wood, "battleWoodMask"),
      marsh: BattleGroundView.getSoftMask(field, field.marsh, "battleMarshMask")
    };
    svg.querySelector("defs")?.insertAdjacentHTML("beforeend", masks.wood + masks.marsh);
    const cover = (kind: "wood" | "marsh", fill: string) => {
      const shape = terrain
        .append(masks[kind] ? "rect" : "path")
        .attr("class", "battleWoods")
        .attr("fill", fill);
      if (!masks[kind]) return shape.attr("d", this.outline(field, field[kind], 0.5));
      return shape
        .attr("width", width)
        .attr("height", height)
        .attr("mask", `url(#battle${capitalize(kind)}Mask)`);
    };
    cover("marsh", "#d3e3e0").attr("opacity", 0.75);
    cover("wood", "#dbe7c9").attr("opacity", 0.75);
    terrain.append("g").attr("class", "battleRelief").html(BattleReliefView.getMarkup(field, paper));
    terrain.append("g").html(BattleGroundView.getPropsMarkup(field));
    // the sea and lakes by their kind: a strand along open water, half of it under the water, a rim round ice and lava
    const looks = field.water.map((w, i) => {
      const kind = w === 1 ? Battlefields.getLakeKind(field, i) : undefined;
      return kind && kind in WATERS ? kind : "open";
    });
    for (const [look, { fill, strand, rim }] of Object.entries(WATERS)) {
      const grid = field.water.map((w, i) => +(w === 1 && looks[i] === look));
      if (!grid.some(Boolean)) continue;
      const d = this.outline(field, grid, 0.5);
      if (strand) {
        terrain
          .append("path")
          .attr("class", "battleProps")
          .attr("d", d)
          .attr("fill", "none")
          .attr("stroke", strand)
          .attr("stroke-width", 7 * pt);
      }
      const water = terrain.append("path").attr("d", d).attr("fill", fill);
      if (rim) water.attr("stroke", rim).attr("stroke-width", 1.2 * pt);
    }

    terrain.append("g").html(BattleCliffsView.getMarkup(field, pt));

    // no outline: tributaries join without a seam, and the mouth covers the shore line
    const course = line<Point>().curve(curveCatmullRom.alpha(0.5));
    const banks = select(svg).select("#battleRivers");
    for (const river of field.rivers) {
      const d = course(river.points);
      for (const [parent, stroke] of [
        [terrain, WATER],
        [banks, "#fff"]
      ] as const) {
        if (parent === banks && river.brook) continue; // a brook is waded anywhere: no fords to show on it
        parent
          .append("path")
          .attr("class", parent === terrain ? "battleRiver" : null)
          .attr("d", d)
          .attr("fill", "none")
          .attr("stroke", stroke)
          .attr("stroke-linecap", "round")
          .attr("stroke-width", river.width);
      }
    }
    // fords: a river shown shallow, with its stones, where it can be waded; kept within its banks
    terrain
      .append("path")
      .attr("d", this.outline(field, field.ford, 0.3))
      .attr("fill", "url(#battleFord)")
      .attr("mask", "url(#battleRivers)");

    // a bridge: its deck under the road, its parapets beside it
    const span = (bridge: Battlefield["bridges"][number], d: string) =>
      terrain
        .append("path")
        .attr("transform", `translate(${bridge.x} ${bridge.y}) rotate(${(bridge.angle * 180) / Math.PI})`)
        .attr("d", d);
    for (const bridge of field.bridges) {
      span(bridge, `M${-bridge.length / 2} 0H${bridge.length / 2}`)
        .attr("stroke", "#efe9da")
        .attr("stroke-width", 9 * pt);
    }
    for (const road of field.roads) {
      const d = course(road);
      terrain
        .append("path")
        .attr("d", d)
        .attr("fill", "none")
        .attr("stroke", "#a39d90")
        .attr("stroke-width", 5 * pt);
      terrain
        .append("path")
        .attr("d", d)
        .attr("fill", "none")
        .attr("stroke", "#fbf8f1")
        .attr("stroke-width", 2.2 * pt);
    }
    for (const bridge of field.bridges) {
      const half = bridge.length / 2;
      const [rail, post] = [5 * pt, 7 * pt];
      const parapets = `M${-half} ${-rail}H${half}M${-half} ${rail}H${half}`;
      const posts = `M${-half} ${-post}V${-rail}M${half} ${-post}V${-rail}M${-half} ${post}V${rail}M${half} ${post}V${rail}`;
      span(bridge, parapets + posts)
        .attr("fill", "none")
        .attr("stroke", "#55524b")
        .attr("stroke-width", 1.4 * pt);
    }

    this.drawTowns(terrain.append("g"), field, pt);
  }

  /** Burgs as ground: their streets and the piers from their sea gates */
  private drawTowns(group: Group, field: Battlefield, pt: number): void {
    for (const burg of field.burgs) {
      group
        .append("path")
        .attr("d", this.toPath(burg.outline, true))
        .attr("fill", "url(#battleTown)")
        .attr("stroke", burg.walled ? "none" : WALL)
        .attr("stroke-width", 1.6 * pt);
    }
    // a stone pier from every sea gate out into the water, its head wider; under the wall it leaves by
    const middle = (wall: { a: Point; b: Point }): Point => [(wall.a[0] + wall.b[0]) / 2, (wall.a[1] + wall.b[1]) / 2];
    field.burgs.forEach((burg, index) => {
      const reach = Math.max(Math.min(burg.radius * PIER_REACH, PIER_LONGEST), PIER_SHORTEST * pt);
      const width = Math.max(PIER_WIDTH, 4 * pt);
      for (const quay of Battlefields.getQuays(field, burg)) {
        const { away, dry } = quay;
        // in the middle of the gate by it
        const opening = field.walls.filter(wall => {
          const [mx, my] = middle(wall);
          const span = Math.hypot(wall.b[0] - wall.a[0], wall.b[1] - wall.a[1]);
          return (
            wall.gate && !wall.jamb && wall.burg === index && Math.hypot(mx - quay.at[0], my - quay.at[1]) <= span * 1.5
          );
        });
        const at: Point = opening.length
          ? ([0, 1].map(axis => opening.reduce((sum, wall) => sum + middle(wall)[axis], 0) / opening.length) as Point)
          : quay.at;
        const length = dry + reach; // over the strand, then out into the water
        group
          .append("path")
          .attr(
            "d",
            `M${-width} ${-width / 2}H${length - width}V${-width * 1.3}H${length}V${width * 1.3}H${length - width}V${width / 2}H${-width}Z`
          )
          .attr(
            "transform",
            `translate(${at[0].toFixed(1)} ${at[1].toFixed(1)}) rotate(${((away * 180) / Math.PI).toFixed(1)})`
          )
          .attr("fill", PIER)
          .attr("stroke", WALL)
          .attr("stroke-width", 0.6 * pt);
      }
    });
  }

  /** What stands of the walls; drawn again when a breach is made */
  private drawWalls(group: Group, field: Battlefield, pt: number): void {
    group.selectAll("*").remove();
    const walls = field.walls.filter(wall => !wall.gate || wall.jamb); // the gate as drawn, narrower than the gateway
    group
      .append("path")
      .attr("d", walls.map(wall => this.toPath([wall.a, wall.b])).join(""))
      .attr("fill", "none")
      .attr("stroke", WALL)
      .attr("stroke-width", 3.5 * pt)
      .attr("stroke-linecap", "round");

    // square towers flank a gate; round ones stand along the curtain, legible apart at any size
    const isGateEnd = (point: Point): boolean =>
      field.walls.some(wall => wall.gate && !wall.jamb && (wall.a === point || wall.b === point));
    const gates = walls.flatMap(wall => [wall.a, wall.b].filter(isGateEnd));
    const spacing = Math.max(TOWER_SPACING * pt, 50);
    const rounds: Point[] = [];
    let run = spacing / 2;
    walls.forEach((wall, i) => {
      if (walls[i - 1]?.burg !== wall.burg) run = spacing / 2;
      const length = Math.hypot(wall.b[0] - wall.a[0], wall.b[1] - wall.a[1]);
      for (run += length; run >= spacing; run -= spacing) {
        const share = 1 - (run - spacing) / length;
        const at: Point = [wall.a[0] + (wall.b[0] - wall.a[0]) * share, wall.a[1] + (wall.b[1] - wall.a[1]) * share];
        if (gates.every(gate => Math.hypot(gate[0] - at[0], gate[1] - at[1]) > spacing / 2)) rounds.push(at);
      }
    });
    const tower = (at: Point, d: string) =>
      group
        .append("path")
        .attr("d", d)
        .attr("transform", this.markAt(...at, pt))
        .attr("fill", WALL)
        .attr("stroke", "#fbf8f1")
        .attr("stroke-width", 0.8);
    for (const at of rounds) tower(at, "M-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0");
    for (const at of gates) tower(at, "M-4.5-4.5h9v9h-9Z");
    // a breach: rubble in the gap
    for (const breach of field.breaches) {
      const rubble = [0, 1, 2, 3, 4, 5, 6].map(i => {
        const angle = i * 2.4 + breach.x;
        const far = 2 + ((i * 5) % 9);
        return `M${(Math.cos(angle) * far).toFixed(1)} ${(Math.sin(angle) * far).toFixed(1)}h0`;
      });
      group
        .append("path")
        .attr("transform", this.markAt(breach.x, breach.y, pt))
        .attr("d", rubble.join(""))
        .attr("stroke", WALL)
        .attr("stroke-width", 3.2)
        .attr("stroke-linecap", "round");
    }
  }

  private toPath(points: Point[], closed = false): string {
    return `M${points.map(p => p.map(v => v.toFixed(1))).join("L")}${closed ? "Z" : ""}`;
  }

  /** What the works look like now: they are drawn again when it changes */
  private getWorksKey(field: Battlefield): string {
    const up = field.works.filter(work => work.up).length;
    const done = field.works.reduce((sum, work) => sum + work.done, 0);
    const harm = field.works.reduce((sum, work) => sum + work.harm, 0);
    return `${field.works.length}|${up}|${done.toFixed(1)}|${harm.toFixed(2)}`;
  }

  /** Works on the plan, all of a kind and state in one path: a stretch being built grows along its line from `a` */
  private drawWorks(svg: SVGSVGElement, field: Battlefield): void {
    svg.dataset.works = this.getWorksKey(field);
    const pt = this.getPoint(field);
    const paths: Record<string, string> = {};
    for (const work of field.works) {
      const state = work.harm >= 1 ? "down" : work.done >= 1 ? "standing" : "building";
      const key = `${work.kind} ${state}`;
      paths[key] = (paths[key] ?? "") + this.drawStretch(work, state === "down", pt);
    }
    // an empty path is drawn as a point of nothing: an empty "d" would not animate in an exported SVG
    for (const path of svg.querySelectorAll<SVGPathElement>(".battleWorks > path"))
      path.setAttribute("d", paths[path.dataset.work!] || "M0 0");
    // hover lines for the tooltip, kept out of the layers the animation export records
    svg.querySelector(".battleWorkTips")!.innerHTML = field.works
      .map(
        work =>
          `<line x1="${work.a[0].toFixed(1)}" y1="${work.a[1].toFixed(1)}" x2="${work.b[0].toFixed(1)}" y2="${work.b[1].toFixed(1)}" stroke-width="${(WORK_HOVER * pt).toFixed(2)}" data-tip="${escapeHtml(this.getWorkTip(work))}"/>`
      )
      .join("");
  }

  /** What a stretch is, whose and how far along it is */
  private getWorkTip(work: FieldWork): string {
    const percent = (share: number): number => Math.floor(share * 100);
    const status =
      work.harm >= 1
        ? t("Knocked down")
        : work.done < 1
          ? t("Building: {{percent}}%", { percent: percent(work.done) })
          : !work.up
            ? t("Finished, stands from the next round")
            : work.harm > 0
              ? t("Damaged: {{percent}}%", { percent: percent(work.harm) })
              : t("Standing");
    return sentences(`${WORK_LABELS[work.kind]()} (${SIDE_LABELS[work.side]()})`, status);
  }

  /** The path of a stretch, its front on the left of `a` → `b`: hachures and stakes on the foe's side */
  private drawStretch(work: FieldWork, down: boolean, pt: number): string {
    const [ax, ay] = work.a;
    const full = Math.hypot(work.b[0] - ax, work.b[1] - ay) || 1;
    const [ux, uy] = [(work.b[0] - ax) / full, (work.b[1] - ay) / full];
    const [fx, fy] = [uy, -ux];
    const length = full * Math.min(work.done, 1);
    const at = (along: number, ahead = 0): string =>
      `${(ax + ux * along + fx * ahead).toFixed(1)} ${(ay + uy * along + fy * ahead).toFixed(1)}`;
    let d = "";
    if (work.kind === "ditch") {
      d += `M${at(0)}L${at(length)}`;
      for (let along = (HACHURE[1] * pt) / 2; along < length; along += HACHURE[1] * pt)
        d += `M${at(along)}L${at(along, HACHURE[0] * pt)}`;
    } else if (work.kind === "stakes") {
      const lean = (STAKE[0] * pt) / Math.SQRT2; // out to the front at 45°
      for (let along = (STAKE[1] * pt) / 2; along < length; along += STAKE[1] * pt)
        d += `M${at(along)}L${at(along + lean, lean)}`;
    } else {
      const { long, thick, inset, apart } = WAGON;
      const [round, wide] = WAGON.wheel;
      // a wall, its front on the line, and a wheel near each end rolling to the front; in points, about its middle
      const parts = [[-long / 2, long / 2, -thick, 0]];
      for (const end of [-1, 1]) {
        const x = end * (long / 2 - inset);
        parts.push([x - wide / 2, x + wide / 2, -thick / 2 - round / 2, -thick / 2 + round / 2]);
      }
      const wagon = (along: number, ahead: number, turn: number): string => {
        const [cos, sin] = [Math.cos(turn), Math.sin(turn)];
        const corner = (x: number, y: number): string =>
          at(along + (x * cos - y * sin) * pt, ahead + (x * sin + y * cos) * pt);
        return parts
          .map(([x0, x1, y0, y1]) => `M${corner(x0, y0)}L${corner(x1, y0)}L${corner(x1, y1)}L${corner(x0, y1)}Z`)
          .join("");
      };
      if (down) {
        // three wagons askew in the gap, as a breach leaves rubble
        return [0.3, 0.5, 0.72]
          .map((share, i) => wagon(full * share, (i - 1) * round * pt, [0.7, -0.5, 2.6][i]))
          .join("");
      }
      const count = Math.max(Math.floor((full + apart * pt) / ((long + apart) * pt)), 1);
      const pitch = full / count; // end to end along the whole stretch
      for (let i = 0; (i + 0.5) * pitch <= length; i++) d += wagon((i + 0.5) * pitch, 0, 0);
    }
    return d;
  }

  /** Blocks, redrawn when their set changes; `onTurn` lets the user turn one */
  drawBlocks(svg: SVGSVGElement, battle: Battle, onTurn: (block: Block, facing: number) => void): void {
    const root = select(svg);
    const allied = (side: Block["side"]): boolean => new Set(battle[side].regiments.map(r => r.state)).size > 1;
    const flagged = { attackers: allied("attackers"), defenders: allied("defenders") };
    const mark = this.getMark(svg, battle.field);
    const pt = this.getPoint(battle.field);
    const { colors } = this.getScene(svg);
    const groups = root
      .select(".battleBlocks")
      .selectAll<SVGGElement, Block>("g.battleBlock")
      .data(battle.blocks, block => block.key)
      .join("g")
      .attr("class", "battleBlock")
      .html(block => {
        const fill = colors[block.side];
        const dark = this.darker(fill, 1.4);
        const { width: w, depth: d } = block;
        const unit = battle.units.find(u => u.name === block.unit);
        // among allies a battalion flies the colour of its state from its rear corner
        const flag = flagged[block.side]
          ? `<path class="battleFlag" d="M0 0h-8l2.5 3l-2.5 3h8z" fill="${this.stateColor(block.state)}" stroke="${dark}" stroke-width="0.8"/>`
          : "";
        // the body, the health line along its front edge, the unit icon and the white flag of surrender, both upright,
        // and the glow shown when the battalion is picked
        return /* html */ `<rect x="${-d / 2}" y="${-w / 2}" width="${d}" height="${w}" fill="${fill}" stroke="${dark}"/>
          <path class="battleHealth" stroke="${dark}"/>
          <g><use class="battleIcon" href="${escapeHtml(Icons.href(unit?.icon ?? ""))}"/>
            <g class="battleWhiteFlag" display="none" stroke="#333" stroke-width="0.8">${WHITE_FLAG}</g></g>${flag}
          <rect class="battleHalo" display="none" fill="none" stroke="${fill}" stroke-opacity="${HALO[1]}" pointer-events="none"/>`;
      })
      .each((block, i, nodes) => {
        this.sizeBlock(nodes[i], block, mark, pt);
      });

    // a double click turns a battalion
    const editable = (): boolean => svg.classList.contains("battleEditable");
    groups.on("dblclick", (_event, block) => {
      if (editable()) onTurn(block, block.facing + TURN_STEP);
    });

    this.updateBlocks(svg, battle, null, 1);
  }

  /** A battalion and its icon are drawn true to size; its outline and flags keep their size on screen */
  private sizeBlock(group: SVGGElement, { width: w, depth: d }: Block, mark: number, pt: number): void {
    const [rect, , upright] = group.children;
    rect.setAttribute("rx", String(1.5 * mark));
    rect.setAttribute("stroke-width", String(1.4 * mark));
    const size = Math.min(Math.min(d, w) * 0.6, ICON * pt);
    const icon = upright.children[0];
    for (const [name, value] of [
      ["x", -size / 2],
      ["y", -size / 2],
      ["width", size],
      ["height", size]
    ] as const)
      icon.setAttribute(name, String(value));
    upright.children[1].setAttribute("transform", `scale(${mark})`);
    group.querySelector(".battleFlag")?.setAttribute("transform", this.markAt(-d / 2, -w / 2, mark));
    const halo = group.querySelector(".battleHalo")!;
    const off = (0.7 + HALO[0] / 2) * mark; // the glow starts where the outline ends
    for (const [name, value] of [
      ["x", -d / 2 - off],
      ["y", -w / 2 - off],
      ["width", d + 2 * off],
      ["height", w + 2 * off],
      ["rx", 1.5 * mark + off],
      ["stroke-width", HALO[0] * mark]
    ] as const)
      halo.setAttribute(name, String(value));
  }

  /** Put a block's group at a place; its icon stays upright whatever the block faces */
  private setTransform(group: SVGGElement, x: number, y: number, facing: number): void {
    const angle = ((facing * 180) / Math.PI).toFixed(1);
    group.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${angle})`);
    group.children[2].setAttribute("transform", `rotate(${-Number(angle)})`);
  }

  private getOpacity(block: Block, time: number, outline: boolean): number {
    if (block.status === "routed" || block.status === "surrendered") return 0.7;
    if (block.status !== "destroyed") return 1;
    if (outline) return OUTLINE;
    if (!this.fallen.has(block)) this.fallen.set(block, time);
    return +Math.min(Math.max(1 - (time - this.fallen.get(block)!) / FADE, 0), 1).toFixed(2);
  }

  private swing(from: number, to: number): number {
    return Math.atan2(Math.sin(to - from), Math.cos(to - from));
  }

  /** Put blocks where they are `progress` of the way through the tick, eased; with no `previous` right where they are */
  updateBlocks(svg: SVGSVGElement, battle: Battle, previous: Positions | null, progress: number): void {
    const root = select(svg);
    if (svg.dataset.breaches !== String(battle.field.breaches.length)) {
      svg.dataset.breaches = String(battle.field.breaches.length);
      this.drawWalls(select(svg).select(".battleWalls"), battle.field, this.getPoint(battle.field)); // the walls came down
    }
    if (svg.dataset.works !== this.getWorksKey(battle.field)) this.drawWorks(svg, battle.field); // works grow and fall
    const pt = this.getPoint(battle.field);
    const mark = this.getMark(svg, battle.field);
    const { look, colors } = this.getScene(svg);
    const outline = look.fallen === "outline";
    const fire = { attackers: this.darker(colors.attackers, 1), defenders: this.darker(colors.defenders, 1) };
    const time = battle.tick + progress;
    const last = this.shown.get(svg);
    const elapsed = previous && last ? time - last.time : -1;
    const ease = 1 - Math.exp(-elapsed / LAG);
    const at: Positions = new Map();
    for (const block of battle.blocks) {
      const from = previous?.get(block.id);
      const to =
        !from || progress >= 1
          ? block
          : {
              x: from.x + (block.x - from.x) * progress,
              y: from.y + (block.y - from.y) * progress,
              facing: from.facing + this.swing(from.facing, block.facing) * progress
            };
      const was = elapsed >= 0 ? last!.at.get(block.id) : undefined;
      if (!was || Math.hypot(to.x - was.x, to.y - was.y) > LEAP * pt) {
        at.set(block.id, { x: to.x, y: to.y, facing: to.facing });
        continue;
      }
      at.set(block.id, {
        x: was.x + (to.x - was.x) * ease,
        y: was.y + (to.y - was.y) * ease,
        facing: was.facing + this.swing(was.facing, to.facing) * ease
      });
    }
    this.shown.set(svg, { time, at });

    root
      .select(".battleBlocks")
      .selectAll<SVGGElement, Block>("g.battleBlock")
      .data(battle.blocks, block => block.key) // blocks are lined up anew at each change before the start
      .each((block, i, nodes) => {
        const { x, y, facing } = at.get(block.id)!;
        this.setTransform(nodes[i], x, y, facing);
      })
      .attr("display", block =>
        block.status === "fled" || this.getOpacity(block, time, outline) === 0 ? "none" : null
      )
      .attr("opacity", block => this.getOpacity(block, time, outline))
      .classed("battleFallen", block => outline && block.status === "destroyed")
      .classed("battleSelected", block => this.getScene(svg).selected.has(block.id))
      .attr("data-tip", block => {
        const troops = `${capitalize(block.unit.replace(/_/g, " "))}: ${block.troops} / ${block.initial}`;
        if (block.status !== "ready" && block.status !== "routed") return `${troops}, ${block.status}`;
        const kmh = BattleScale.toMetresPerSecond(Math.hypot(block.vx, block.vy)) * 3.6;
        const speed = `${t("Speed")}: ${convertSpeed(kmh)} ${getSpeedUnit()}`;
        const range = block.range ? `${t("Range")}: ${formatLength(block.range)}` : "";
        const morale = `${t("Morale")}: ${Math.round(block.morale)}%`;
        const energy = `${t("Energy")}: ${Math.round(block.energy * 100)}%`;
        return sentences(troops, morale, energy, BATTLE_ACTION_LABELS[block.action], ...[speed, range].filter(Boolean));
      })
      .each(function (block) {
        // the line inside the front edge is as long as the share of the troops alive
        const half = ((block.initial ? block.troops / block.initial : 0) * block.width) / 2;
        const x = block.depth / 2 - HEALTH_INSET * mark;
        (this.children[1] as SVGPathElement).setAttribute("d", `M${x} ${-half}V${half}`);
        (this.children[1] as SVGPathElement).setAttribute("stroke-width", String(2 * HEALTH_INSET * mark));
        (this.children[0] as SVGRectElement).setAttribute(
          "stroke-dasharray",
          block.status === "routed" ? `${3 * mark} ${2 * mark}` : ""
        );
        this.querySelector(".battleWhiteFlag")!.setAttribute(
          "display",
          block.status === "surrendered" ? "inline" : "none"
        );
      });

    const byId = new Map(battle.blocks.map(block => [block.id, block]));
    const pairs = (action: Block["action"]): [Block, Block][] =>
      battle.blocks
        .filter(block => block.action === action && block.target !== null && byId.has(block.target))
        .map(block => [block, byId.get(block.target!)!]);

    const bursts: { key: string; x: number; y: number; size: number; opacity: number }[] = [];
    const shots = (battle.result ? [] : pairs("shoot")).map(([block, target]) => {
      const a = at.get(block.id)!;
      const b = at.get(target.id)!;
      const missile = MISSILES[block.type];
      const cycle = time / (missile === "shell" ? SHELL_TICKS : VOLLEY_TICKS) + block.id * 0.37; // each in its own time
      const phase = cycle % 1;
      // every shell lands a little off the last one
      const scatter = missile === "shell" ? 9 * pt : 0;
      const to: Point = [
        b.x + Math.sin(Math.floor(cycle) * 7 + block.id) * scatter,
        b.y + Math.cos(Math.floor(cycle) * 11 + block.id) * scatter
      ];
      const lift = Math.hypot(to[0] - a.x, to[1] - a.y) / 5;
      const top: Point = [(a.x + to[0]) / 2, (a.y + to[1]) / 2 - lift];
      return { block, missile, phase, from: [a.x, a.y] as Point, top, to };
    });

    root
      .select(".battleFire")
      .selectAll<SVGPathElement, (typeof shots)[number]>("path")
      .data(
        shots.filter(shot => !shot.missile),
        shot => shot.block.key
      )
      .join("path")
      .attr("stroke", shot => fire[shot.block.side])
      .attr("stroke-dashoffset", -time * 3 * mark)
      .attr("d", ({ from, top, to }) => `M${this.fixed(from)}Q${this.fixed(top)} ${this.fixed(to)}`);

    root
      .select(".battleMissiles")
      .selectAll<SVGPathElement, (typeof shots)[number]>("path")
      .data(
        shots.filter(shot => shot.missile),
        shot => shot.block.key
      )
      .join("path")
      .attr("stroke", shot => fire[shot.block.side])
      .attr("stroke-width", shot => (shot.missile === "shell" ? 4.5 : 1.2) * mark)
      .attr("d", ({ missile, phase, from, top, to }) => {
        if (missile === "arrows") {
          return VOLLEY.map(([lag, aside]) => {
            const flown = phase * 1.07 - lag;
            return flown > 0 && flown < 1 ? this.arrow(...this.arcAt(from, top, to, flown), aside, mark) : "";
          }).join("");
        }
        if (phase >= SHELL_FLIGHT) return "";
        const [x, y] = this.arcAt(from, top, to, phase / SHELL_FLIGHT);
        return `M${this.fixed([x, y])}h0.01`; // a dot
      });

    // a shell bursts bigger than a melee
    for (const { block, missile, phase, to } of shots) {
      if (missile !== "shell" || phase < SHELL_FLIGHT) continue;
      const spent = (phase - SHELL_FLIGHT) / (1 - SHELL_FLIGHT);
      bursts.push({ key: block.key, x: to[0], y: to[1], size: (20 + spent * 16) * mark, opacity: 1 - spent });
    }

    if (!battle.result) {
      const pulse = 0.55 + 0.45 * Math.sin(time * 2.2);
      for (const [block, target] of pairs("fight")) {
        if (block.id > target.id && target.target === block.id) continue; // one star for the two of them
        const [a, b] = [at.get(block.id)!, at.get(target.id)!];
        bursts.push({ key: block.key, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, size: 13 * mark, opacity: pulse });
      }
    }

    root
      .select(".battleClashes")
      .selectAll<SVGTextElement, (typeof bursts)[number]>("text")
      .data(bursts, burst => burst.key)
      .join("text")
      .text("✸")
      .attr("font-size", burst => burst.size.toFixed(2))
      .attr("opacity", burst => burst.opacity.toFixed(2))
      .attr("x", burst => burst.x.toFixed(1))
      .attr("y", burst => burst.y.toFixed(1));

    this.drawHover(svg, battle, at);
    BattleDebugView.update(svg, battle, at, pt);
  }

  /** The battalion under the pointer shows its foe, where it goes and how far it shoots */
  hoverBlock(svg: SVGSVGElement, battle: Battle, id: number | null): void {
    this.getScene(svg).hovered = id;
    const at = this.shown.get(svg)?.at;
    if (at) this.drawHover(svg, battle, at);
  }

  /** The battalions the user picked: outlined, with their marks shown as on hover */
  selectBlocks(svg: SVGSVGElement, battle: Battle, ids: number[]): void {
    this.getScene(svg).selected = new Set(ids);
    select(svg)
      .selectAll<SVGGElement, Block>("g.battleBlock")
      .classed("battleSelected", block => ids.includes(block.id));
    const at = this.shown.get(svg)?.at;
    if (at) this.drawHover(svg, battle, at);
  }

  /** Battalions shown where a drag would put them, before they are put there */
  previewBlocks(svg: SVGSVGElement, places: Positions): void {
    select(svg)
      .selectAll<SVGGElement, Block>("g.battleBlock")
      .each((block, i, nodes) => {
        const place = places.get(block.id);
        if (place) this.setTransform(nodes[i], place.x, place.y, place.facing);
      });
  }

  drawSelection(svg: SVGSVGElement, battle: Battle, { box, handle }: Selection): void {
    const layer = svg.querySelector(".battleSelection");
    if (!layer) return;
    const mark = this.getMark(svg, battle.field);
    const dash = `stroke-dasharray="${4 * mark} ${3 * mark}"`;
    let markup = "";
    if (box) {
      const [x, y] = [Math.min(box[0][0], box[1][0]), Math.min(box[0][1], box[1][1])];
      const [width, height] = [Math.abs(box[1][0] - box[0][0]), Math.abs(box[1][1] - box[0][1])];
      markup += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${width.toFixed(1)}" height="${height.toFixed(1)}" fill="#fff" fill-opacity="0.15" stroke-width="${mark}" ${dash} pointer-events="none"/>`;
    }
    if (handle) {
      // a white disc with a two-headed turning arrow: it swings the troops round
      const angle = ((handle.facing * 180) / Math.PI).toFixed(1);
      markup += `<g class="battleTurnHandle" data-tip="${escapeHtml(t("Drag to turn the picked troops"))}" transform="translate(${this.fixed(handle.at)}) rotate(${angle}) scale(${mark})">
          <circle r="${HANDLE}" fill="#fff" stroke="${INK}" stroke-width="1"/>
          <path d="${TURN_ARC}" stroke="${INK}" stroke-width="1.1" stroke-linecap="round"/>
          <path d="${TURN_HEADS}" fill="${INK}" stroke="${INK}" stroke-width="0.35" stroke-linejoin="round"/>
        </g>`;
    }
    layer.innerHTML = markup;
  }

  private drawHover(svg: SVGSVGElement, battle: Battle, at: Positions): void {
    const layer = svg.querySelector(".battleHover");
    if (!layer) return;
    const { hovered, selected } = this.getScene(svg);
    const shown = battle.result
      ? []
      : battle.blocks.filter(
          block =>
            (block.id === hovered || selected.has(block.id)) &&
            (block.status === "ready" || block.status === "routed") &&
            at.has(block.id)
        );
    layer.innerHTML = shown
      .map(block => this.getBlockMarks(svg, battle, at, block, block.id === hovered && !selected.has(block.id)))
      .join("");
  }

  /** A battalion's foe, where it goes, the friend it protects and, under the pointer unless picked, how far it shoots */
  private getBlockMarks(svg: SVGSVGElement, battle: Battle, at: Positions, block: Block, ranged: boolean): string {
    const from = at.get(block.id)!;
    const mark = this.getMark(svg, battle.field);
    const stroke = this.darker(this.getScene(svg).colors[block.side], 0.6);
    const { task } = block;
    // an order given by hand shows at once, before the battalion acts on it
    const aim = task && task.target !== null ? at.get(task.target) : undefined;
    const foe = task?.kind === "attack" ? aim : block.target === null ? undefined : at.get(block.target);
    const goal: Point | null = task?.kind === "move" ? [task.x, task.y] : task ? null : block.goal;
    const marks: string[] = [];
    if (task?.kind === "protect" && aim)
      marks.push(
        `<path d="M${this.fixed([from.x, from.y])}L${this.fixed([aim.x, aim.y])}" stroke-dasharray="0 ${3 * mark}" stroke-linecap="round" stroke-width="${2.2 * mark}"/>`
      );
    if (block.range && ranged) {
      const radius = block.range * SKIES[battle.weather].range;
      marks.push(
        `<circle cx="${from.x.toFixed(1)}" cy="${from.y.toFixed(1)}" r="${radius.toFixed(1)}" stroke-dasharray="${4 * mark} ${3 * mark}"/>`
      );
    }
    if (goal && (!foe || Math.hypot(goal[0] - foe.x, goal[1] - foe.y) > block.depth))
      marks.push(
        `<path d="M${this.fixed([from.x, from.y])}L${this.fixed(goal)}" stroke-dasharray="${4 * mark} ${3 * mark}"/>`
      );
    if (foe) marks.push(`<path d="M${this.fixed([from.x, from.y])}L${this.fixed([foe.x, foe.y])}"/>`);
    return `<g stroke="${stroke}" stroke-width="${1.5 * mark}">${marks.join("")}</g>`;
  }

  private fixed([x, y]: Point): string {
    return `${x.toFixed(1)} ${y.toFixed(1)}`;
  }

  /** Point of the arc from one point over the top to another, and the way it runs there */
  private arcAt(from: Point, top: Point, to: Point, share: number): [number, number, number] {
    const rest = 1 - share;
    const at = (i: 0 | 1): number => rest * rest * from[i] + 2 * rest * share * top[i] + share * share * to[i];
    const run = (i: 0 | 1): number => rest * (top[i] - from[i]) + share * (to[i] - top[i]);
    return [at(0), at(1), Math.atan2(run(1), run(0))];
  }

  /** An arrow with its head at the point, `aside` of the course; sized in points */
  private arrow(x: number, y: number, angle: number, aside: number, pt: number): string {
    const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
    const tip: Point = [x - sin * aside * pt, y + cos * aside * pt];
    const back = (along: number, across: number): Point => [
      tip[0] - (cos * along + sin * across) * pt,
      tip[1] - (sin * along - cos * across) * pt
    ];
    return `M${this.fixed(back(9, 0))}L${this.fixed(tip)}M${this.fixed(back(3, 2))}L${this.fixed(tip)}L${this.fixed(back(3, -2))}`;
  }

  drawArrows(svg: SVGSVGElement, battle: Battle, trails: Trails | null): void {
    const layer = svg.querySelector(".battleArrows");
    if (!layer) return;
    const mark = this.getMark(svg, battle.field);
    const { colors, look } = this.getScene(svg);
    const curve = line<Point>().curve(curveCatmullRom.alpha(0.5));
    const arrows = (trails && look.arrows ? battle.blocks : []).flatMap(block => {
      if (block.status === "fled" || block.status === "destroyed") return [];
      const points = [...(trails!.get(block.id) ?? []), [block.x, block.y] as Point].filter(
        (point, i, all) => !i || Math.hypot(point[0] - all[i - 1][0], point[1] - all[i - 1][1]) > 0.5
      );
      const [first, end] = [points[0], points.at(-1)!];
      if (points.length < 2 || Math.hypot(end[0] - first[0], end[1] - first[1]) < block.depth) return [];
      const before = points.at(-2)!;
      const angle = Math.atan2(end[1] - before[1], end[0] - before[0]);
      const head = ARROWHEAD * mark;
      const corner = (turn: number): string =>
        this.fixed([end[0] - Math.cos(angle + turn) * head, end[1] - Math.sin(angle + turn) * head]);
      const stroke = this.darker(colors[block.side], 0.6);
      const shaft = [
        ...points.slice(0, -1),
        [end[0] - Math.cos(angle) * head * 0.7, end[1] - Math.sin(angle) * head * 0.7] as Point
      ];
      return `<path d="${curve(shaft)}" stroke="${stroke}" stroke-width="${2 * mark}"/><path d="M${this.fixed(end)}L${corner(0.45)}L${corner(-0.45)}Z" fill="${stroke}"/>`;
    });
    layer.innerHTML = arrows.join("");
  }

  snapshot(battle: Battle): Positions {
    return new Map(battle.blocks.map(block => [block.id, { x: block.x, y: block.y, facing: block.facing }]));
  }

  private stateColor(stateId: number): string {
    const fill = pack.states[stateId]?.color;
    return fill && fill[0] === "#" ? fill : "#999";
  }

  /** A label in points */
  private label(
    parent: ReturnType<typeof select<SVGGElement, unknown>>,
    field: Battlefield,
    text: string,
    x: number,
    y: number,
    size: number,
    fill: string
  ) {
    const pt = this.getPoint(field);
    const box = BattleCamera.getFieldView(field);
    const [left, top] = [
      Math.min(Math.max(x, box.x + 60 * pt), box.x + box.width - 60 * pt),
      Math.min(Math.max(y, box.y + 24 * pt), box.y + box.height - 12 * pt)
    ];
    return parent
      .append("g")
      .attr("class", "battleLabel")
      .attr("data-x", left)
      .attr("data-y", top)
      .attr("transform", this.markAt(left, top, pt))
      .append("text")
      .attr("text-anchor", "middle")
      .attr("font-size", size)
      .attr("font-family", "Georgia, serif")
      .attr("fill", fill)
      .attr("paint-order", "stroke")
      .attr("stroke", "#fbf5e9")
      .attr("stroke-width", 3)
      .text(text);
  }

  /** Smooth outline of the grid nodes above the level */
  private outline(field: Battlefield, grid: number[], level: number): string {
    // two nodes wider on each side, so shapes run off the field instead of closing at its edge
    const { cell } = field;
    const cols = field.cols + 4;
    const rows = field.rows + 4;
    const at = (col: number, row: number): number =>
      grid[
        Math.min(Math.max(row - 2, 0), field.rows - 1) * field.cols + Math.min(Math.max(col - 2, 0), field.cols - 1)
      ];

    // blur, so the outline rounds the grid steps
    const soft: number[] = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        let total = at(col, row) * 2;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) total += at(col + dx, row + dy);
        soft.push(total / 11);
      }
    }

    const curve = line<Point>().curve(curveBasisClosed);
    const [shape] = contours().size([cols, rows]).thresholds([level])(soft);
    return shape.coordinates
      .flat()
      .map(ring => curve(ring.slice(0, -1).map(([x, y]): Point => [(x - 2) * cell, (y - 2) * cell])))
      .join("");
  }
}

export const BattleSceneView = new BattleSceneRenderer();
