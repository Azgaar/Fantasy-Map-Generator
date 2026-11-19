import { color, contours, curveBasisClosed, curveCatmullRom, line, select } from "d3";
import { type BattleLook, DEFAULT_BATTLE_OPTIONS } from "@/data/battle-options";
import { BATTLE_ACTION_LABELS, BATTLE_STATUS_LABELS } from "@/data/id-labels";
import { Icons } from "@/model/icons";
import { type Battle, Battles, type Block } from "@/model/political/battle/battle";
import type { Side } from "@/model/political/battle/battle-rules";
import { BattleScale } from "@/model/political/battle/battle-scale";
import { type Battlefield, Battlefields, type FieldWork, type WorkKind } from "@/model/political/battle/battlefield";
import { Sight } from "@/model/political/battle/sight";
import { GAP_WAGONS, Works } from "@/model/political/battle/works";
import { convertSpeed, formatLength, getSpeedUnit } from "@/model/units";
import { BattleCamera, type View } from "@/renderers/battle/battle-camera";
import { BattleBurgView } from "@/renderers/battle/draw-battle-burg";
import { BattleCliffsView } from "@/renderers/battle/draw-battle-cliffs";
import { BattleDebugView } from "@/renderers/battle/draw-battle-debug";
import { BattleGroundView, ROAD } from "@/renderers/battle/draw-battle-ground";
import { BattleLightView, LAMP } from "@/renderers/battle/draw-battle-light";
import { BattleReliefView } from "@/renderers/battle/draw-battle-relief";
import { BattleWeatherView } from "@/renderers/battle/draw-battle-weather";
import type { Point } from "@/types/global";
import { sentences, t } from "@/utils/i18n";
import { capitalize, escapeHtml } from "@/utils/string-utils";

/**
 * The scene's layers by id, bottom to top (the diagnostics add `battleDebugGround` under the labels, `battleDebugDoings` on top):
 * - `battlePaper`: the ground's colour under the whole scene
 * - `battleTerrain`: the ground, drawn once (tint, cover, relief, props, water, cliffs, rivers, burgs, roads, plazas)
 * - `battleWalls`: the field's walls, drawn again on a breach
 * - `battleEdge`, `battleFrost`, `battleMud`: the field's edge within its scene, frozen and soaked ground
 * - `battleLightShade`: the ground shaded by the sun and the sky of the moment
 * - `battleLabels`: burg and river names
 * - `battleWorks`, `battleWorkTips`: field works and their hover lines
 * - `battleFire`, `battleArrows`, `battleHover`: fire lines, where battalions went, the marks of the pointed and picked
 * - `battleBlocks`, `battleMissiles`, `battleClashes`: battalions, arrows and shells in flight, clashes
 * - `battleLight`: the tint of the hour and the sky over all of it, battalions too, lifted round each battalion by its
 *   light at night (`battleLamps`); laid on as one, multiplied; the pointer goes through
 * - `battleSelection`: the box dragged and the turning handle
 */
// what the animation export records; the walls too, for their breaches
export const MOVING_LAYERS = [
  "battleWalls",
  "battleWorks",
  "battleFire",
  "battleBlocks",
  "battleMissiles",
  "battleClashes",
  "battleLight"
];

type Group = ReturnType<typeof select<SVGGElement, unknown>>;

/** Where blocks stood a tick ago, to glide between ticks */
export type Positions = Map<number, { x: number; y: number; facing: number }>;

export type SideColors = Record<Side, string>;

/** Attackers are red and defenders blue by default whatever their states' colours, so the sides never look alike */
export const SIDE_COLORS: SideColors = { attackers: "#c8473d", defenders: "#3f72b3" };

/** The box dragged to pick battalions, and the handle that turns the picked ones round their middle */
export interface Selection {
  box: [Point, Point] | null;
  handle: { at: Point; facing: number } | null; // before the picked battalions, the way they face
}

/** Where each battalion went since the last key moment, sampled once a round: by the screen while paused, and in keyframes */
export type Trails = Map<number, Point[]>;

/** What a scene shows and how it is coloured, and the zoom its marks are sized for */
interface Scene {
  look: BattleLook;
  colors: SideColors;
  marks: number;
  hovered: number | null; // the battalion under the pointer
  selected: Set<number>;
}

/** A shot in the air: a dotted fire line without a missile */
interface Shot {
  key: string; // the shooter's, and another for an engine's shot at walls or works
  block: Block;
  missile: "arrows" | "shell" | undefined;
  phase: number;
  from: Point;
  top: Point;
  to: Point;
}

type CoverMasks = Record<"wood" | "marsh", string>;

// what each look switch hides
const LOOK_LAYERS: [keyof BattleLook, string][] = [
  ["woods", ".battleWoods"],
  ["props", ".battleProps"],
  ["labels", "#battleLabels"],
  ["icons", ".battleIcon"],
  ["flags", ".battleFlag"],
  ["health", ".battleHealth"],
  ["arrows", "#battleArrows"],
  ["fire", "#battleFire"],
  ["missiles", "#battleMissiles"],
  ["clashes", "#battleClashes"]
];

const RESCALE = 0.03; // marks are sized anew when the zoom changed by more than this share
const REBAKE = 400; // ms at least between bakes of the shade while the sun drifts

// the ground
const INK = "#3d3a33";
const PAPERS = { sea: "#d3e0ea", sky: "#eaf1f7" };
const EDGE = 0.2; // opacity of the line along the field's edge, within its scene
const WATER = "#b4cbe2";
// sea and lake water by kind: a sandy strand, a salt crust, ice, lava; the other lakes are open water
const WATERS: Record<string, { fill: string; strand?: string; rim?: string }> = {
  open: { fill: WATER, strand: "#e8dcbc" },
  salt: { fill: "#bfd3df", strand: "#f6f3ea" },
  frozen: { fill: "#e5eef3", rim: "#b9cad6" },
  lava: { fill: "#e9a07a", rim: "#9b4b2e" }
};
const TOWER_SPACING = 40; // points between the towers of a wall
const WALL = "#55524b";
const PIER = "#8f877a";
const PIER_REACH = 0.25; // of a burg's radius a pier goes out into the water
const PIER_LONGEST = 300; // metres
const PIER_SHORTEST = 24; // points: legible on any field
const PIER_WIDTH = 12; // metres

// works as old battle plans draw them: flat, one colour a kind, in the plan's ink; sizes in points
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

// battalions
const ICON = 16; // points a unit icon is wide at the most, unzoomed: it grows with the zoom like the block
const WHITE_FLAG = `<path d="M0 6V-14" stroke-width="1.2"/><path d="M0 -14q3 -1.5 6 0t6 0v7q-3 1.5 -6 0t-6 0z" fill="#fff"/>`;
const HEALTH_INSET = 1.5; // half the health line: it lies inside the block, against its outline
const HALO = [4, 0.3]; // a soft glow round a picked battalion: points wide, its opacity
const TURN_STEP = Math.PI / 12;
const LAG = 0.8; // ticks the shown place trails the battle by: it evens out the jostle of a crowd
const LEAP = 100; // points: a move further than this is shown at once
const FADE = 12; // ticks a destroyed battalion takes to fade away
const OUTLINE = 0.45; // opacity of the outline a destroyed battalion leaves where it fell

// shots: what a unit type shoots, the rest are dotted arcs
const MISSILES: Record<string, "arrows" | "shell"> = {
  ranged: "arrows",
  mounted: "arrows",
  machinery: "shell",
  naval: "shell"
};
const VOLLEY_TICKS = 4; // arrows are in the air
const VOLLEY = [
  [0, 0],
  [0.07, 4],
  [0.04, -4]
]; // how far behind the first arrow each one flies, and how far aside
const SHELL_TICKS = 6; // from shot to shot
const SHELL_FLIGHT = 0.6; // share of that the shell flies, then it bursts

// the turning handle: an arc round the disc, open towards the troops, with a head at each end
const HANDLE = 8; // points: the radius of the disc
const TURN_ARC = "M-0.89 -4.29A4.3 4.3 0 1 1 -0.89 4.29";
const TURN_HEADS = "M-2.07 4.04L0.26 2.75L-0.02 5.74ZM-2.07 -4.04L-0.02 -5.74L0.26 -2.75Z";

const ARROWHEAD = 7; // points

class BattleSceneRenderer {
  private readonly scenes = new WeakMap<SVGSVGElement, Scene>();
  private readonly baked = new WeakMap<SVGSVGElement, { time: number; sky: string; at: number }>(); // the shade drawn
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

  private getLayer<E extends Element = SVGGElement>(svg: SVGSVGElement, id: string): E | null {
    return svg.querySelector<E>(`#${id}`);
  }

  // look

  /** What to draw and in which colours; applied at once, by a style the scene and its exports carry */
  setLook(svg: SVGSVGElement, look: BattleLook, colors: SideColors): void {
    Object.assign(this.getScene(svg), { look, colors });
    this.baked.delete(svg); // the light may be off or on now
    const style = this.getLayer(svg, "battleLook");
    if (style) style.textContent = this.getLookStyle(look);
  }

  private getLookStyle(look: BattleLook): string {
    return `${[
      ...LOOK_LAYERS.filter(([key]) => !look[key]).map(([, selector]) => selector),
      ...this.getHiddenRelief(look)
    ]
      .map(selector => `${selector} { display: none; }`)
      .join(" ")} .battleFallen > rect { fill: none; } .battleFallen > :not(rect) { display: none; }`;
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

  // view and sizes

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
    const fire = this.getLayer(svg, "battleFire");
    fire?.setAttribute("stroke-width", String(mark));
    fire?.setAttribute("stroke-dasharray", `${2 * mark} ${5 * mark}`);
    select(svg)
      .selectAll<SVGGElement, Block>(".battleBlock")
      .each((block, i, nodes) => {
        this.sizeBlock(nodes[i], block, mark, pt);
      });
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

  // the field

  /**
   * The field and its scene round it: the ground drawn once from the scene, a faint line along the field's edge, the
   * walls, which the battle breaches, from the field within it. Without a scene, the field's own ground
   */
  drawField(svg: SVGSVGElement, field: Battlefield, scene: Battlefield | null = null): void {
    const ground = scene ?? field;
    const paper = field.open ? PAPERS[field.open] : BattleGroundView.getTint(field.biome);
    const pt = this.getPoint(field);
    const area = BattleCamera.getSceneBox(field);
    const [dx, dy] = scene ? [area.x, area.y] : [0, 0]; // the scene's corner from the field's
    const whole = `x="${area.x}" y="${area.y}" width="${area.width}" height="${area.height}"`;
    const masks: CoverMasks = field.open
      ? { wood: "", marsh: "" }
      : {
          wood: BattleGroundView.getSoftMask(ground, ground.wood, "battleWoodMask"),
          marsh: BattleGroundView.getSoftMask(ground, ground.marsh, "battleMarshMask")
        };

    this.getScene(svg).marks = 1;
    this.baked.delete(svg); // a new ground: shaded anew
    svg.setAttribute("viewBox", `${area.x} ${area.y} ${area.width} ${area.height}`);
    delete svg.dataset.works; // the works layer is drawn empty: `updateBlocks` fills it
    svg.dataset.breaches = String(field.breaches.length);

    svg.innerHTML = /* html */ `<style id="battleLook">${this.getLookStyle(this.getScene(svg).look)}</style>
      <defs>${this.getDefs(field, ground, [dx, dy], masks)}</defs>
      <rect id="battlePaper" ${whole} fill="${paper}"/>
      <g id="battleTerrain" transform="translate(${dx} ${dy})" clip-path="url(#battleGroundClip)"></g>
      <g id="battleWalls" clip-path="url(#battleFieldClip)"></g>
      ${scene ? `<rect id="battleEdge" width="${field.width}" height="${field.height}" fill="none" stroke="${INK}" stroke-opacity="${EDGE}" stroke-width="${pt}" pointer-events="none"/>` : ""}
      <rect id="battleFrost" ${whole} fill="#f6f9fb" opacity="0.2" display="none" pointer-events="none"/>
      <g id="battleMud" display="none" pointer-events="none">
        <rect ${whole} fill="#6b4a26" opacity="0.04"/>
        <g transform="translate(${dx} ${dy})">${field.open ? "" : BattleWeatherView.getMudMarkup(ground)}</g>
      </g>
      <g id="battleLightShade" class="battleShade" transform="translate(${dx} ${dy})" clip-path="url(#battleGroundClip)" style="mix-blend-mode: multiply" pointer-events="none"></g>
      <g id="battleLabels" pointer-events="none"></g>
      <g id="battleWorks" fill="none" stroke-width="${1.6 * pt}" pointer-events="none">${this.getWorkPaths(pt)}</g>
      <g id="battleWorkTips" stroke="none" pointer-events="stroke"></g>
      <g id="battleFire" fill="none" stroke-width="${pt}" stroke-dasharray="${2 * pt} ${5 * pt}" opacity="0.55"></g>
      <g id="battleArrows" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.8" pointer-events="none"></g>
      <g id="battleHover" fill="none" pointer-events="none"></g>
      <g id="battleBlocks"></g>
      <g id="battleMissiles" fill="none" stroke-linecap="round" pointer-events="none"></g>
      <g id="battleClashes" text-anchor="middle" dominant-baseline="central" fill="#b3261e" pointer-events="none"></g>
      <g id="battleLight" pointer-events="none" style="mix-blend-mode: multiply"><rect id="battleTint" ${whole} fill="#fff"/><g id="battleLamps" fill="url(#battleLampGlow)"></g></g>
      <g id="battleSelection" fill="none" stroke="#222"></g>`;

    if (field.open) return;
    const root = select(svg);
    const terrain = root.select<SVGGElement>("#battleTerrain");
    this.drawTerrain(terrain, ground, paper, masks, pt);
    if (scene) this.drawWalls(this.addPart(terrain, "Walls").attr("clip-path", "url(#battleOutsideClip)"), scene, pt);
    this.drawWalls(root.select("#battleWalls"), field, pt);
    this.drawLabels(root.select("#battleLabels"), field, ground, [dx, dy], paper);
  }

  /**
   * The light of the battle's moment: the tint follows the time at once, the ground's shade is baked anew once the sun moved
   * a minute's way, no more often than `REBAKE` while it drifts; at once when the sky, the hour or the look changed
   */
  drawLight(svg: SVGSVGElement, battle: Battle): void {
    const tint = this.getLayer(svg, "battleTint");
    if (!tint) return;
    const lighting = BattleLightView.getLighting(battle, this.getScene(svg).look.light);
    const color = BattleLightView.toColor(lighting.tint);
    if (tint.getAttribute("fill") !== color) tint.setAttribute("fill", color);
    this.drawLamps(svg, battle, this.shown.get(svg)?.at ?? null);
    const last = this.baked.get(svg);
    const now = performance.now();
    const drift = last?.sky === lighting.sky ? Math.abs(lighting.time - last.time) : Infinity;
    if (drift < 1 / 60 || (drift < 0.25 && now - last!.at < REBAKE)) return;
    this.baked.set(svg, { time: lighting.time, sky: lighting.sky, at: now });
    const shade = battle.field.open ? null : BattleLightView.bake(battle.scene ?? battle.field, lighting);
    this.getLayer(svg, "battleLightShade")!.innerHTML = shade
      ? `<image href="${shade.href}" width="${shade.width}" height="${shade.height}" preserveAspectRatio="none"/>`
      : "";
  }

  /** A glow as far as it sees about each battalion with its torches lit, where it is shown, as strong as it is dark */
  private drawLamps(svg: SVGSVGElement, battle: Battle, at: Positions | null): void {
    const layer = this.getLayer(svg, "battleLamps");
    if (!layer) return;
    const night = BattleLightView.getNight(battle, this.getScene(svg).look.light);
    const present = (block: Block) => block.status === "ready" || block.status === "routed";
    const lit = night ? battle.blocks.filter(block => present(block) && Sight.isLit(battle, block)) : [];
    const sight = night ? Sight.getSight(battle) : 0;
    const place = (block: Block) => at?.get(block.id) ?? block;
    select(layer)
      .selectAll<SVGCircleElement, Block>("circle")
      .data(lit, block => block.id)
      .join("circle")
      .attr("cx", block => place(block).x.toFixed(1))
      .attr("cy", block => place(block).y.toFixed(1))
      .attr("r", block => (sight + Math.hypot(block.width, block.depth) / 2).toFixed(1))
      .attr("opacity", night.toFixed(2));
  }

  /** The pattern of fords, the clips of the field, its ground and what lies outside it, masks of rivers and cover */
  private getDefs(field: Battlefield, ground: Battlefield, [dx, dy]: Point, masks: CoverMasks): string {
    const { width, height } = field;
    const pt = this.getPoint(field);
    const outside = `M${-dx} ${-dy}h${width}v${height}h${-width}ZM0 0h${ground.width}v${ground.height}h${-ground.width}Z`;
    // the rivers' water, to keep fords within their banks; a brook is waded anywhere: no fords to show on it
    const course = line<Point>().curve(curveCatmullRom.alpha(0.5));
    const banks = field.open
      ? ""
      : ground.rivers
          .filter(river => !river.brook)
          .map(
            river =>
              `<path d="${course(river.points)}" fill="none" stroke="#fff" stroke-linecap="round" stroke-width="${river.width}"/>`
          )
          .join("");
    return /* html */ `<pattern id="battleFordPattern" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="scale(${pt})">
        <rect width="7" height="7" fill="#e4edf4"/><circle cx="2" cy="2" r="0.9" fill="#8ea5b8"/><circle cx="5.5" cy="5.2" r="0.7" fill="#8ea5b8"/>
      </pattern>
      <radialGradient id="battleLampGlow">${LAMP.stops.map(([offset, color, opacity]) => `<stop offset="${offset}" stop-color="${color}" stop-opacity="${opacity}"/>`).join("")}</radialGradient>
      <clipPath id="battleFieldClip"><rect width="${width}" height="${height}"/></clipPath>
      <clipPath id="battleGroundClip"><rect width="${ground.width}" height="${ground.height}"/></clipPath>
      <clipPath id="battleOutsideClip"><path d="${outside}" clip-rule="evenodd"/></clipPath>
      <mask id="battleRiverMask" maskUnits="userSpaceOnUse" x="0" y="0" width="${ground.width}" height="${ground.height}">${banks}</mask>
      ${masks.wood}${masks.marsh}`;
  }

  /** A part of the ground layer, `battleTerrain<name>` */
  private addPart(terrain: Group, name: string): Group {
    return terrain.append("g").attr("id", `battleTerrain${name}`);
  }

  /** The ground, bottom to top: its tint, woods and bogs, relief, props, waters, cliffs, rivers, burgs, roads and plazas */
  private drawTerrain(terrain: Group, field: Battlefield, paper: string, masks: CoverMasks, pt: number): void {
    this.addPart(terrain, "Tint").html(BattleGroundView.getMarkup(field));
    this.drawCover(this.addPart(terrain, "Cover"), field, masks);
    this.addPart(terrain, "Relief").html(BattleReliefView.getMarkup(field, paper, !BattleLightView.isSupported()));
    this.addPart(terrain, "Props").html(BattleGroundView.getPropsMarkup(field));
    this.drawWater(this.addPart(terrain, "Water"), field, pt);
    this.addPart(terrain, "Cliffs").html(BattleCliffsView.getMarkup(field, pt));
    this.drawRivers(this.addPart(terrain, "Rivers"), field);
    const burgs = field.burgs.map((_, index) => BattleBurgView.getMarkup(field, index, pt));
    this.drawBurgs(this.addPart(terrain, "Burgs"), field, burgs.map(burg => burg.burg).join(""), pt);
    this.drawRoads(this.addPart(terrain, "Roads"), field, pt);
    this.addPart(terrain, "Plazas").html(burgs.map(burg => burg.plaza).join(""));
  }

  /** Woods and bogs fade out at their edges; without a canvas their outlines are drawn sharp */
  private drawCover(group: Group, field: Battlefield, masks: CoverMasks): void {
    const cover = (kind: "wood" | "marsh", fill: string) => {
      const shape = group
        .append(masks[kind] ? "rect" : "path")
        .attr("class", "battleWoods")
        .attr("fill", fill);
      if (!masks[kind]) return shape.attr("d", this.outline(field, field[kind], 0.5));
      return shape
        .attr("width", field.width)
        .attr("height", field.height)
        .attr("mask", `url(#battle${capitalize(kind)}Mask)`);
    };
    cover("marsh", "#d3e3e0").attr("opacity", 0.75);
    cover("wood", "#dbe7c9").attr("opacity", 0.75);
  }

  /** The sea and lakes by their kind: a strand along open water, half of it under the water, a rim round ice and lava */
  private drawWater(group: Group, field: Battlefield, pt: number): void {
    const looks = field.water.map((w, i) => {
      const kind = w === 1 ? Battlefields.getLakeKind(field, i) : undefined;
      return kind && kind in WATERS ? kind : "open";
    });
    for (const [look, { fill, strand, rim }] of Object.entries(WATERS)) {
      const grid = field.water.map((w, i) => +(w === 1 && looks[i] === look));
      if (!grid.some(Boolean)) continue;
      const d = this.outline(field, grid, 0.5);
      if (strand) {
        group
          .append("path")
          .attr("class", "battleProps")
          .attr("d", d)
          .attr("fill", "none")
          .attr("stroke", strand)
          .attr("stroke-width", 7 * pt);
      }
      const water = group.append("path").attr("d", d).attr("fill", fill);
      if (rim) water.attr("stroke", rim).attr("stroke-width", 1.2 * pt);
    }
  }

  /** Rivers with no outline: tributaries join without a seam, and the mouth covers the shore line; then their fords */
  private drawRivers(group: Group, field: Battlefield): void {
    const course = line<Point>().curve(curveCatmullRom.alpha(0.5));
    for (const river of field.rivers) {
      group
        .append("path")
        .attr("class", "battleRiver")
        .attr("d", course(river.points))
        .attr("fill", "none")
        .attr("stroke", WATER)
        .attr("stroke-linecap", "round")
        .attr("stroke-width", river.width);
    }
    // a ford: a stretch of the river shown shallow, with its stones, square across it; kept within its banks
    for (const ford of this.getFords(field)) {
      group
        .append("path")
        .attr("d", line<Point>()(ford.points))
        .attr("fill", "none")
        .attr("stroke", "url(#battleFordPattern)")
        .attr("stroke-width", ford.width * 1.5) // wide enough to cover the curve between points: the mask trims it
        .attr("stroke-linejoin", "round")
        .attr("mask", "url(#battleRiverMask)");
    }
  }

  /** Roads, and a bridge where one crosses a river: its deck under the road, its parapets beside it */
  private drawRoads(group: Group, field: Battlefield, pt: number): void {
    const course = line<Point>().curve(curveCatmullRom.alpha(0.5));
    const span = (bridge: Battlefield["bridges"][number], d: string) =>
      group
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
      for (const [stroke, width] of ROAD) {
        group
          .append("path")
          .attr("d", d)
          .attr("fill", "none")
          .attr("stroke", stroke)
          .attr("stroke-width", width * pt);
      }
    }
    for (const bridge of field.bridges) {
      const half = bridge.length / 2;
      const [rail, post] = [5 * pt, 7 * pt];
      const parapets = `M${-half} ${-rail}H${half}M${-half} ${rail}H${half}`;
      const posts = `M${-half} ${-post}V${-rail}M${half} ${-post}V${-rail}M${-half} ${post}V${rail}M${half} ${post}V${rail}`;
      span(bridge, parapets + posts)
        .attr("fill", "none")
        .attr("stroke", WALL)
        .attr("stroke-width", 1.4 * pt);
    }
  }

  /** Burgs as rooftops, and the piers from their sea gates */
  private drawBurgs(group: Group, field: Battlefield, markup: string, pt: number): void {
    group.html(markup);
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

  /** Burg names over the burgs of the scene, river names along the field's rivers, left to right */
  private drawLabels(labels: Group, field: Battlefield, ground: Battlefield, [dx, dy]: Point, paper: string): void {
    const { width, height } = field;
    const pt = this.getPoint(field);
    const box = BattleCamera.getSceneBox(field);
    for (const burg of ground.burgs) {
      // above the burg, or below it when the edge is too close
      const [x, y] = [burg.x + dx, burg.y + dy];
      const top = y - burg.radius * 0.9 - 2 * pt;
      const below = top < box.y + 24 * pt ? y + burg.radius * 0.9 + 13 * pt : top;
      this.label(labels, field, burg.name, x, below, 13, INK);
    }

    const course = line<Point>().curve(curveCatmullRom.alpha(0.5));
    field.rivers.forEach((river, i) => {
      const inside = river.points.filter(
        ([x, y]) => x > 30 * pt && x < width - 30 * pt && y > 20 * pt && y < height - 20 * pt
      );
      if (inside.length < 2 || !river.name) return;
      if (inside[0][0] > inside.at(-1)![0]) inside.reverse();
      labels.append("path").attr("id", `battleRiverCourse${i}`).attr("d", course(inside)).attr("fill", "none");
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
        .attr("href", `#battleRiverCourse${i}`)
        .attr("startOffset", "50%")
        .attr("text-anchor", "middle")
        .text(river.name);
    });
  }

  /** A label in points, kept within the field's view */
  private label(parent: Group, field: Battlefield, text: string, x: number, y: number, size: number, fill: string) {
    const pt = this.getPoint(field);
    const box = BattleCamera.getSceneBox(field);
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

  // works

  /** A path for each kind and state of works, filled by `drawWorks` */
  private getWorkPaths(pt: number): string {
    return WORK_PATHS.map(([kind, state]) => {
      const paint =
        kind === "wagons"
          ? `fill="${WORK_COLORS.wagons}" stroke="${WAGON_OUTLINE}" stroke-width="${WAGON.outline * pt}"`
          : `stroke="${WORK_COLORS[kind]}"`;
      const thick = kind === "stakes" ? `stroke-width="${STAKE[2] * pt}"` : "";
      return `<path data-work="${kind} ${state}" ${paint} ${thick} ${state === "building" ? `opacity="0.5"` : ""}/>`;
    }).join("");
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
    const add = (key: string, d: string): void => {
      paths[key] = (paths[key] ?? "") + d;
    };
    for (const work of field.works) {
      add(`${work.kind} ${work.done >= 1 ? "standing" : "building"}`, this.drawStretch(work, false, pt));
      if (work.harm > 0) add(`${work.kind} down`, this.drawStretch(work, true, pt));
    }
    // an empty path is drawn as a point of nothing: an empty "d" would not animate in an exported SVG
    for (const path of svg.querySelectorAll<SVGPathElement>("#battleWorks > path"))
      path.setAttribute("d", paths[path.dataset.work!] || "M0 0");
    // hover lines for the tooltip, kept out of the layers the animation export records
    this.getLayer(svg, "battleWorkTips")!.innerHTML = field.works
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
        ? t("Broken through")
        : work.done < 1
          ? t("Building: {{percent}}%", { percent: percent(work.done) })
          : !work.up
            ? t("Finished, stands from the next round")
            : work.harm > 0
              ? t("Damaged: {{percent}}%", { percent: percent(work.harm) })
              : t("Standing");
    return sentences(`${WORK_LABELS[work.kind]()} (${SIDE_LABELS[work.side]()})`, status);
  }

  /**
   * The path of a stretch, its front on the left of `a` → `b`: hachures and stakes on the foe's side
   * @param wrecks the wagons knocked out of it instead, askew in its middle
   */
  private drawStretch(work: FieldWork, wrecks: boolean, pt: number): string {
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
      const count = Math.max(Math.floor((full + apart * pt) / ((long + apart) * pt)), 1);
      const pitch = full / count; // end to end along the whole stretch
      const knocked = Math.min(Math.round(work.harm * GAP_WAGONS), count); // one a shot, from the middle
      const first = Math.floor((count - knocked) / 2);
      for (let i = 0; (i + 0.5) * pitch <= length; i++) {
        const j = i - first; // of the knocked ones
        if ((j >= 0 && j < knocked) !== wrecks) continue;
        d += wrecks
          ? wagon((i + 0.5) * pitch, (j - 1) * round * pt, [0.7, -0.5][j % 2])
          : wagon((i + 0.5) * pitch, 0, 0);
      }
    }
    return d;
  }

  // battalions

  /** Blocks, redrawn when their set changes; `onTurn` lets the user turn one */
  drawBlocks(svg: SVGSVGElement, battle: Battle, onTurn: (block: Block, facing: number) => void): void {
    const allied = (side: Block["side"]): boolean => new Set(battle[side].regiments.map(r => r.state)).size > 1;
    const flagged = { attackers: allied("attackers"), defenders: allied("defenders") };
    const mark = this.getMark(svg, battle.field);
    const pt = this.getPoint(battle.field);
    const { colors } = this.getScene(svg);
    const groups = select(svg)
      .select("#battleBlocks")
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

    // those destroyed before the blocks were drawn fell unseen: they do not fade anew
    for (const block of battle.blocks)
      if (block.status === "destroyed" && !this.fallen.has(block)) this.fallen.set(block, -Infinity);
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

  /** Put blocks where they are `progress` of the way through the tick, eased; with no `previous` right where they are */
  updateBlocks(svg: SVGSVGElement, battle: Battle, previous: Positions | null, progress: number): void {
    this.updateField(svg, battle.field);
    const time = battle.tick + progress;
    const at = this.getShownPositions(svg, battle, previous, progress, time);
    this.updateBattalions(svg, battle, at, time);
    const shots = battle.result ? [] : [...this.getShots(battle, at, time), ...this.getWorkShots(battle, at, time)];
    this.drawShots(svg, battle, shots, time);
    this.drawClashes(svg, battle, shots, at, time);
    this.drawHover(svg, battle, at);
    this.drawLamps(svg, battle, at);
    BattleDebugView.update(svg, battle, at, this.getPoint(battle.field));
  }

  /** Walls come down and works grow and fall as the battle goes */
  private updateField(svg: SVGSVGElement, field: Battlefield): void {
    if (svg.dataset.breaches !== String(field.breaches.length)) {
      svg.dataset.breaches = String(field.breaches.length);
      this.drawWalls(select(svg).select("#battleWalls"), field, this.getPoint(field));
    }
    if (svg.dataset.works !== this.getWorksKey(field)) this.drawWorks(svg, field);
  }

  /** Where blocks are shown: trailing where they are by an easing that evens out the jostle, at once after a leap */
  private getShownPositions(
    svg: SVGSVGElement,
    battle: Battle,
    previous: Positions | null,
    progress: number,
    time: number
  ): Positions {
    const pt = this.getPoint(battle.field);
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
    return at;
  }

  /** Each block at its place, faded, outlined and tipped by its state; its health line as long as its troops left */
  private updateBattalions(svg: SVGSVGElement, battle: Battle, at: Positions, time: number): void {
    const mark = this.getMark(svg, battle.field);
    const { look, selected } = this.getScene(svg);
    const outline = look.fallen === "outline";
    select(svg)
      .select("#battleBlocks")
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
      .classed("battleSelected", block => selected.has(block.id))
      .attr("data-tip", block => this.getBlockTip(block))
      .each(function (block) {
        const [body, health] = this.children;
        // the line inside the front edge is as long as the share of the troops alive
        const half = ((block.initial ? block.troops / block.initial : 0) * block.width) / 2;
        const x = block.depth / 2 - HEALTH_INSET * mark;
        health.setAttribute("d", `M${x} ${-half}V${half}`);
        health.setAttribute("stroke-width", String(2 * HEALTH_INSET * mark));
        body.setAttribute("stroke-dasharray", block.status === "routed" ? `${3 * mark} ${2 * mark}` : "");
        this.querySelector(".battleWhiteFlag")!.setAttribute(
          "display",
          block.status === "surrendered" ? "inline" : "none"
        );
      });
  }

  private getBlockTip(block: Block): string {
    const troops = `${capitalize(block.unit.replace(/_/g, " "))}: ${block.troops} / ${block.initial}`;
    if (block.status !== "ready" && block.status !== "routed")
      return `${troops}, ${BATTLE_STATUS_LABELS[block.status]}`;
    const kmh = BattleScale.toMetresPerSecond(Math.hypot(block.vx, block.vy)) * 3.6;
    const speed = `${t("Speed")}: ${convertSpeed(kmh)} ${getSpeedUnit()}`;
    const range = block.range ? `${t("Range")}: ${formatLength(block.range)}` : "";
    const morale = `${t("Morale")}: ${Math.round(block.morale)}%`;
    const energy = `${t("Energy")}: ${Math.round(block.energy * 100)}%`;
    return sentences(troops, morale, energy, BATTLE_ACTION_LABELS[block.action], ...[speed, range].filter(Boolean));
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

  // shots and clashes

  /** Blocks doing `action` to a target still on the field, with the target */
  private getPairs(battle: Battle, action: Block["action"]): [Block, Block][] {
    const byId = new Map(battle.blocks.map(block => [block.id, block]));
    return battle.blocks
      .filter(block => block.action === action && block.target !== null && byId.has(block.target))
      .map(block => [block, byId.get(block.target!)!]);
  }

  /** Each shooter's arc to its target and how far its shot is through its cycle */
  private getShots(battle: Battle, at: Positions, time: number): Shot[] {
    return this.getPairs(battle, "shoot").map(([block, target]) =>
      this.aim(battle, block, at, at.get(target.id)!, time)
    );
  }

  /** Engines shelling the walls they batter or the wagons they knock down, between their shots at troops */
  private getWorkShots(battle: Battle, at: Positions, time: number): Shot[] {
    const shots: Shot[] = [];
    for (const engine of battle.blocks) {
      if (engine.kind !== "machinery" || !at.has(engine.id)) continue;
      const work = Works.getBattered(battle, engine);
      const point =
        Battles.getWallShot(battle, engine) ?? (work && [(work.a[0] + work.b[0]) / 2, (work.a[1] + work.b[1]) / 2]);
      if (point)
        shots.push(this.aim(battle, engine, at, { x: point[0], y: point[1] }, time + SHELL_TICKS / 2, ":works"));
    }
    return shots;
  }

  /** A shot's arc from a shooter where it is shown to a point, and how far through its cycle it is */
  private aim(battle: Battle, block: Block, at: Positions, b: { x: number; y: number }, time: number, kind = ""): Shot {
    const pt = this.getPoint(battle.field);
    const a = at.get(block.id)!;
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
    return { key: block.key + kind, block, missile, phase, from: [a.x, a.y], top, to };
  }

  /** Dotted fire lines of the shooters with no missile, arrows and shells in flight of the others */
  private drawShots(svg: SVGSVGElement, battle: Battle, shots: Shot[], time: number): void {
    const mark = this.getMark(svg, battle.field);
    const { colors } = this.getScene(svg);
    const fire = { attackers: this.darker(colors.attackers, 1), defenders: this.darker(colors.defenders, 1) };
    const root = select(svg);

    root
      .select("#battleFire")
      .selectAll<SVGPathElement, Shot>("path")
      .data(
        shots.filter(shot => !shot.missile),
        shot => shot.key
      )
      .join("path")
      .attr("stroke", shot => fire[shot.block.side])
      .attr("stroke-dashoffset", -time * 3 * mark)
      .attr("d", ({ from, top, to }) => `M${this.fixed(from)}Q${this.fixed(top)} ${this.fixed(to)}`);

    root
      .select("#battleMissiles")
      .selectAll<SVGPathElement, Shot>("path")
      .data(
        shots.filter(shot => shot.missile),
        shot => shot.key
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
  }

  /** A star where a shell bursts, bigger than one pulsing between two battalions in melee */
  private drawClashes(svg: SVGSVGElement, battle: Battle, shots: Shot[], at: Positions, time: number): void {
    const mark = this.getMark(svg, battle.field);
    const bursts: { key: string; x: number; y: number; size: number; opacity: number }[] = [];
    for (const { key, missile, phase, to } of shots) {
      if (missile !== "shell" || phase < SHELL_FLIGHT) continue;
      const spent = (phase - SHELL_FLIGHT) / (1 - SHELL_FLIGHT);
      bursts.push({ key, x: to[0], y: to[1], size: (20 + spent * 16) * mark, opacity: 1 - spent });
    }
    if (!battle.result) {
      const pulse = 0.55 + 0.45 * Math.sin(time * 2.2);
      for (const [block, target] of this.getPairs(battle, "fight")) {
        if (block.id > target.id && target.target === block.id) continue; // one star for the two of them
        const [a, b] = [at.get(block.id)!, at.get(target.id)!];
        bursts.push({ key: block.key, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, size: 13 * mark, opacity: pulse });
      }
    }

    select(svg)
      .select("#battleClashes")
      .selectAll<SVGTextElement, (typeof bursts)[number]>("text")
      .data(bursts, burst => burst.key)
      .join("text")
      .text("✸")
      .attr("font-size", burst => burst.size.toFixed(2))
      .attr("opacity", burst => burst.opacity.toFixed(2))
      .attr("x", burst => burst.x.toFixed(1))
      .attr("y", burst => burst.y.toFixed(1));
  }

  // the pointer and the pick

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
    const layer = this.getLayer(svg, "battleSelection");
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
    const layer = this.getLayer(svg, "battleHover");
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
    const chased = task?.kind === "attack" || task?.kind === "pursue";
    const foe = chased ? aim : block.target === null ? undefined : at.get(block.target);
    const goal: Point | null = task?.kind === "move" ? [task.x, task.y] : task ? null : block.goal;
    const marks: string[] = [];
    if (task?.kind === "protect" && aim)
      marks.push(
        `<path d="M${this.fixed([from.x, from.y])}L${this.fixed([aim.x, aim.y])}" stroke-dasharray="0 ${3 * mark}" stroke-linecap="round" stroke-width="${2.2 * mark}"/>`
      );
    if (block.range && ranged) {
      const radius = Sight.getReach(battle, block);
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

  // movement arrows

  drawArrows(svg: SVGSVGElement, battle: Battle, trails: Trails | null): void {
    const layer = this.getLayer(svg, "battleArrows");
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

  // helpers

  private darker(fill: string, k: number): string {
    return color(fill)!.darker(k).formatHex();
  }

  private stateColor(stateId: number): string {
    const fill = pack.states[stateId]?.color;
    return fill && fill[0] === "#" ? fill : "#999";
  }

  private swing(from: number, to: number): number {
    return Math.atan2(Math.sin(to - from), Math.cos(to - from));
  }

  private fixed([x, y]: Point): string {
    return `${x.toFixed(1)} ${y.toFixed(1)}`;
  }

  private toPath(points: Point[], closed = false): string {
    return `M${points.map(p => p.map(v => v.toFixed(1))).join("L")}${closed ? "Z" : ""}`;
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

  /** The stretches of river the ford nodes lie on, each from its first node to its last along the course */
  private getFords(field: Battlefield): { points: Point[]; width: number }[] {
    const { cell } = field;
    const rivers = field.rivers.filter(river => !river.brook); // a brook has no fords to show
    const along = rivers.map((): number[] => []);
    field.ford.forEach((ford, node) => {
      if (!ford) return;
      const [x, y] = Battlefields.nodeCentre(field, node);
      let best = { river: -1, distance: Infinity, at: 0 };
      rivers.forEach(({ points, width }, river) => {
        for (let i = 1, walked = 0; i < points.length; i++) {
          const [ax, ay] = points[i - 1];
          const [dx, dy] = [points[i][0] - ax, points[i][1] - ay];
          const length = Math.hypot(dx, dy);
          const t = length ? Math.min(Math.max(((x - ax) * dx + (y - ay) * dy) / length ** 2, 0), 1) : 0;
          const distance = Math.hypot(x - ax - dx * t, y - ay - dy * t);
          if (distance < best.distance && distance < width / 2 + cell)
            best = { river, distance, at: walked + t * length };
          walked += length;
        }
      });
      if (best.river !== -1) along[best.river].push(best.at);
    });

    const fords: { points: Point[]; width: number }[] = [];
    along.forEach((spots, river) => {
      spots.sort((a, b) => a - b);
      for (let first = 0; first < spots.length; ) {
        let last = first;
        while (last + 1 < spots.length && spots[last + 1] - spots[last] < cell * 1.5) last++;
        const points = this.getStretch(rivers[river].points, spots[first] - cell / 2, spots[last] + cell / 2);
        if (points.length > 1) fords.push({ points, width: rivers[river].width });
        first = last + 1;
      }
    });
    return fords;
  }

  /** The part of a line between two distances along it */
  private getStretch(points: Point[], from: number, to: number): Point[] {
    const stretch: Point[] = [];
    for (let i = 1, walked = 0; i < points.length; i++) {
      const [ax, ay] = points[i - 1];
      const [bx, by] = points[i];
      const length = Math.hypot(bx - ax, by - ay);
      const at = (distance: number): Point => {
        const t = length ? (distance - walked) / length : 0;
        return [ax + (bx - ax) * t, ay + (by - ay) * t];
      };
      if (walked + length > from && walked < to) {
        if (!stretch.length) stretch.push(at(Math.max(from, walked)));
        stretch.push(at(Math.min(to, walked + length)));
      }
      walked += length;
    }
    return stretch;
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
