import { color, contours, curveBasisClosed, curveCatmullRom, drag, line, pointer, select } from "d3";
import { BATTLE_ACTION_LABELS } from "@/data/id-labels";
import { Icons } from "@/model/icons";
import type { Battle, Block } from "@/model/political/battle/battle";
import { COLS, ROWS } from "@/model/political/battle/battle-scale";
import type { Battlefield } from "@/model/political/battle/battlefield";
import { convertSpeed, formatLength, getLengthUnit, getSpeedUnit } from "@/model/units";
import { updateBattleDebug } from "@/renderers/draw-battle-debug";
import type { Point } from "@/types/global";
import { sentences, t } from "@/utils/i18n";
import { capitalize, escapeHtml } from "@/utils/string-utils";

/** Where blocks stood a tick ago, to glide between ticks */
export type Positions = Map<number, { x: number; y: number; facing: number }>;

/** Attackers are red and defenders blue whatever their states' colours, so the sides never look alike */
export const SIDE_COLORS = { attackers: "#c8473d", defenders: "#3f72b3" };

const FIRE_COLORS = {
  attackers: color(SIDE_COLORS.attackers)!.darker(1).formatHex(),
  defenders: color(SIDE_COLORS.defenders)!.darker(1).formatHex()
};

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

const GROUND: Record<number, string> = { 1: "#f6ecd2", 2: "#f1ecdf", 10: "#eef0ea", 11: "#f3f6f8" };
const INK = "#3d3a33";
const WATER = "#b4cbe2";

/** The field is drawn in metres; what it shows at a size on screen, as marks and lines, is sized in points of a 1000-wide field */
const getPoint = (field: Battlefield): number => field.width / 1000;

/** Where a mark drawn in points stands: its own lines and sizes are then in points */
const markAt = (x: number, y: number, pt: number): string => `translate(${x} ${y}) scale(${pt})`;

/** A round length in the user's units near a sixth of the field, ticked at its ends and middle, by the North arrow */
function getScaleBar(field: Battlefield): string {
  const pt = getPoint(field);
  const most = field.width / 6;
  const unit = getLengthUnit(most);
  const power = 10 ** Math.floor(Math.log10(most / unit.metres));
  const count = [5, 2, 1].map(k => k * power).find(size => size * unit.metres <= most) ?? power;
  const span = (count * unit.metres) / pt; // in points
  return /* html */ `<g class="battleScale" transform="${markAt(field.width - (52 + span) * pt, 46 * pt, pt)}" fill="none" stroke="${INK}" stroke-width="1.5">
      <path d="M0 -5V0H${span}V-5M${span / 2} 0V-3"/>
      <text x="${span / 2}" y="-9" text-anchor="middle" font-size="12" fill="${INK}" stroke="none" font-family="Georgia, serif">${+count.toPrecision(3)} ${unit.name}</text>
    </g>`;
}

export function drawBattlefield(svg: SVGSVGElement, field: Battlefield): void {
  const paper =
    field.open === "sea" ? "#d3e0ea" : field.open === "sky" ? "#eaf1f7" : (GROUND[field.biome] ?? "#fbf5e9");
  const { width, height } = field;
  const pt = getPoint(field);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  svg.innerHTML = /* html */ `<defs>
      <pattern id="battleWood" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="scale(${pt})">
        <path d="M4 20a4 4 0 1 1 6 0M15 10a3.4 3.4 0 1 1 5 0" fill="none" stroke="#9cc47c" stroke-width="1.6" stroke-linecap="round"/>
      </pattern>
      <pattern id="battleMarsh" width="26" height="14" patternUnits="userSpaceOnUse" patternTransform="scale(${pt})">
        <path d="M3 10h9M8 10V5M5.5 10l-1.5-4M10.5 10l1.5-4M16 4h7" fill="none" stroke="#8fb0b8" stroke-width="1" stroke-linecap="round"/>
      </pattern>
      <pattern id="battleTown" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="scale(${pt}) rotate(45)">
        <rect width="6" height="6" fill="#f4f1ea"/><path d="M0 0v6" stroke="#77736b" stroke-width="2"/>
      </pattern>
      <pattern id="battleFord" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="scale(${pt})">
        <rect width="7" height="7" fill="#e4edf4"/><circle cx="2" cy="2" r="0.9" fill="#8ea5b8"/><circle cx="5.5" cy="5.2" r="0.7" fill="#8ea5b8"/>
      </pattern>
      <clipPath id="battleFrame"><rect width="${width}" height="${height}"/></clipPath>
      <mask id="battleRivers" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}"></mask>
    </defs>
    <rect width="${width}" height="${height}" fill="${paper}"/>
    <g class="battleTerrain" clip-path="url(#battleFrame)"></g>
    <g class="battleLabels" pointer-events="none"></g>
    <g class="battleNorth" transform="${markAt(width - 28 * pt, 34 * pt, pt)}" fill="none" stroke="${INK}" stroke-width="1.5">
      <path d="M0 16V-16M-5 -8L0 -16L5 -8"/><text y="30" text-anchor="middle" font-size="13" fill="${INK}" stroke="none" font-family="Georgia, serif" font-weight="bold">N</text>
    </g>
    ${getScaleBar(field)}
    <g class="battleFire" fill="none" stroke-width="${pt}" stroke-dasharray="${2 * pt} ${5 * pt}" opacity="0.55"></g>
    <g class="battleBlocks"></g>
    <g class="battleMissiles" fill="none" stroke-linecap="round" pointer-events="none"></g>
    <g class="battleClashes" text-anchor="middle" dominant-baseline="central" fill="#b3261e" pointer-events="none"></g>`;

  if (field.open) return;
  const terrain = select(svg).select<SVGGElement>(".battleTerrain");
  const labels = select(svg).select<SVGGElement>(".battleLabels");

  // a contour every so many metres, four at most: a plain stays plain
  const rise = field.relief;
  const interval = [5, 10, 20, 50].find(step => rise / step <= 4) ?? 100;
  for (let level = interval; level < rise; level += interval) {
    terrain
      .append("path")
      .attr("d", outline(field, field.elevation, level / rise))
      .attr("fill", "#c99b6a")
      .attr("opacity", 0.16);
  }
  terrain
    .append("path")
    .attr("d", outline(field, field.marsh, 0.5))
    .attr("fill", "url(#battleMarsh)");
  const wood = outline(field, field.wood, 0.5);
  terrain.append("path").attr("d", wood).attr("fill", "#dbe7c9").attr("opacity", 0.75);
  terrain.append("path").attr("d", wood).attr("fill", "url(#battleWood)");
  terrain
    .append("path")
    .attr(
      "d",
      outline(
        field,
        field.water.map(w => +(w === 1)),
        0.5
      )
    )
    .attr("fill", WATER);

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
    .attr("d", outline(field, field.ford, 0.3))
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

  terrain.append("g").attr("class", "battleBurgs");
  drawBurgs(svg, field);
  for (const burg of field.burgs) {
    // above the burg, or below it when the edge is too close
    const top = burg.y - burg.radius * 0.9 - 2 * pt;
    const y = top < 24 * pt ? burg.y + burg.radius * 0.9 + 13 * pt : top;
    label(labels, field, `${burg.name} ${burg.group}`, burg.x, y, 13, INK);
  }

  // names run along the rivers, left to right
  field.rivers.forEach((river, i) => {
    const inside = river.points.filter(
      ([x, y]) => x > 30 * pt && x < width - 30 * pt && y > 20 * pt && y < height - 20 * pt
    );
    if (inside.length < 2 || !river.name) return;
    if (inside[0][0] > inside.at(-1)![0]) inside.reverse();
    terrain.append("path").attr("id", `battleRiver${i}`).attr("d", course(inside)).attr("fill", "none");
    terrain
      .append("text")
      .attr("dy", -river.width / 2 - 3 * pt)
      .attr("font-size", 11 * pt)
      .attr("font-style", "italic")
      .attr("fill", "#2b3a7c")
      .attr("paint-order", "stroke")
      .attr("stroke", "#fbf5e9")
      .attr("stroke-width", 2.5 * pt)
      .append("textPath")
      .attr("href", `#battleRiver${i}`)
      .attr("startOffset", "50%")
      .attr("text-anchor", "middle")
      .text(river.name);
  });
}

/** Burgs with what stands of their walls; drawn again when a breach is made */
function drawBurgs(svg: SVGSVGElement, field: Battlefield): void {
  const group = select(svg).select<SVGGElement>(".battleBurgs");
  group.selectAll("*").remove();
  svg.dataset.breaches = String(field.breaches.length);
  const WALL = "#55524b";
  const pt = getPoint(field);
  const path = (points: Point[], closed = false): string =>
    `M${points.map(p => p.map(v => v.toFixed(1))).join("L")}${closed ? "Z" : ""}`;

  // battlements: merlons stand out of the wall, the burg drawn over them hides their inner half
  const walls = field.walls.filter(wall => !wall.gate);
  const stretches = walls.map(wall => path([wall.a, wall.b])).join("");
  group
    .append("path")
    .attr("d", stretches)
    .attr("fill", "none")
    .attr("stroke", WALL)
    .attr("stroke-width", 6 * pt)
    .attr("stroke-dasharray", `${3 * pt} ${11 * pt}`);
  for (const burg of field.burgs) {
    group
      .append("path")
      .attr("d", path(burg.outline, true))
      .attr("fill", "url(#battleTown)")
      .attr("stroke", burg.walled ? "none" : WALL)
      .attr("stroke-width", 1.6 * pt);
  }
  group
    .append("path")
    .attr("d", stretches)
    .attr("fill", "none")
    .attr("stroke", WALL)
    .attr("stroke-width", 2.4 * pt)
    .attr("stroke-linecap", "round");

  // a gate: a tower at each end of the gap
  const isEnd = (point: Point, gate: boolean): boolean =>
    field.walls.some(wall => wall.gate === gate && (wall.a === point || wall.b === point));
  for (const wall of walls) {
    for (const point of [wall.a, wall.b]) {
      if (!isEnd(point, true)) continue;
      group
        .append("rect")
        .attr("transform", markAt(...point, pt))
        .attr("x", -3.5)
        .attr("y", -3.5)
        .attr("width", 7)
        .attr("height", 7)
        .attr("fill", WALL);
    }
  }
  // a breach: rubble in the gap
  for (const breach of field.breaches) {
    const rubble = [0, 1, 2, 3, 4, 5, 6].map(i => {
      const angle = i * 2.4 + breach.x;
      const far = 2 + ((i * 5) % 9);
      return `M${(Math.cos(angle) * far).toFixed(1)} ${(Math.sin(angle) * far).toFixed(1)}h0`;
    });
    group
      .append("path")
      .attr("transform", markAt(breach.x, breach.y, pt))
      .attr("d", rubble.join(""))
      .attr("stroke", WALL)
      .attr("stroke-width", 3.2)
      .attr("stroke-linecap", "round");
  }
}

/** Blocks, redrawn when their set changes; `onDrop` and `onTurn` let the user place them */
export function drawBlocks(
  svg: SVGSVGElement,
  battle: Battle,
  onDrop: (block: Block, x: number, y: number) => void,
  onTurn: (block: Block, facing: number) => void
): void {
  const root = select(svg);
  const allied = (side: Block["side"]): boolean => new Set(battle[side].regiments.map(r => r.state)).size > 1;
  const flagged = { attackers: allied("attackers"), defenders: allied("defenders") };
  const pt = getPoint(battle.field);
  const groups = root
    .select(".battleBlocks")
    .selectAll<SVGGElement, Block>("g.battleBlock")
    .data(battle.blocks, block => block.key)
    .join("g")
    .attr("class", "battleBlock")
    .html(block => {
      const fill = SIDE_COLORS[block.side];
      const dark = color(fill)!.darker(1.4).formatHex();
      const { width: w, depth: d } = block;
      const unit = battle.units.find(u => u.name === block.unit);
      const size = Math.min(d, w) * 0.6;
      // among allies a battalion flies the colour of its state from its rear corner
      const flag = flagged[block.side]
        ? `<path transform="${markAt(-d / 2, -w / 2, pt)}" d="M0 0h-8l2.5 3l-2.5 3h8z" fill="${stateColor(block.state)}" stroke="${dark}" stroke-width="0.8"/>`
        : "";
      // the body, the health line along its front edge, the unit icon and the white flag of surrender, both upright
      return /* html */ `<rect x="${-d / 2}" y="${-w / 2}" width="${d}" height="${w}" rx="${1.5 * pt}" fill="${fill}" stroke="${dark}" stroke-width="${1.4 * pt}"/>
        <path class="battleHealth" stroke="${dark}" stroke-width="${2 * HEALTH_INSET * pt}"/>
        <g><use href="${escapeHtml(Icons.href(unit?.icon ?? ""))}" x="${-size / 2}" y="${-size / 2}" width="${size}" height="${size}"/>
          <g class="battleWhiteFlag" display="none" stroke="#333" stroke-width="0.8" transform="scale(${pt})">${WHITE_FLAG}</g></g>${flag}`;
    });

  // a drag moves a battalion, a double click turns it
  const editable = (): boolean => svg.classList.contains("battleEditable");
  let start: Point = [0, 0];
  let moved = false;
  groups
    .call(
      drag<SVGGElement, Block>()
        .filter(editable)
        .on("start", event => {
          start = pointer(event, svg);
          moved = false;
        })
        .on("drag", function (event, block) {
          const [x, y] = pointer(event, svg);
          if (!moved && Math.hypot(x - start[0], y - start[1]) < 4 * pt) return; // a shaky click
          moved = true;
          setTransform(this, x, y, block.facing);
        })
        .on("end", (event, block) => {
          if (moved) onDrop(block, ...pointer(event, svg));
        })
    )
    .on("dblclick", (_event, block) => {
      if (editable()) onTurn(block, block.facing + TURN_STEP);
    });

  updateBlocks(svg, battle, null, 1);
}

const WHITE_FLAG = `<path d="M0 6V-14" stroke-width="1.2"/><path d="M0 -14q3 -1.5 6 0t6 0v7q-3 1.5 -6 0t-6 0z" fill="#fff"/>`;
const HEALTH_INSET = 1.5; // half the health line: it lies inside the block, against its outline
const TURN_STEP = Math.PI / 12;

/** Put a block's group at a place; its icon stays upright whatever the block faces */
function setTransform(group: SVGGElement, x: number, y: number, facing: number): void {
  const angle = ((facing * 180) / Math.PI).toFixed(1);
  group.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${angle})`);
  group.children[2].setAttribute("transform", `rotate(${-Number(angle)})`);
}

const LAG = 0.8; // ticks the shown place trails the battle by: it evens out the jostle of a crowd
const LEAP = 100; // points: a move further than this is shown at once
const shown = new WeakMap<SVGSVGElement, { time: number; at: Positions }>();

const FADE = 12; // ticks a destroyed battalion takes to fade away
const fallen = new WeakMap<Block, number>(); // when a battalion was first drawn destroyed

function getOpacity(block: Block, time: number): number {
  if (block.status === "routed" || block.status === "surrendered") return 0.7;
  if (block.status !== "destroyed") return 1;
  if (!fallen.has(block)) fallen.set(block, time);
  return +Math.min(Math.max(1 - (time - fallen.get(block)!) / FADE, 0), 1).toFixed(2);
}

const swing = (from: number, to: number): number => Math.atan2(Math.sin(to - from), Math.cos(to - from));

/** Put blocks where they are `progress` of the way through the tick, eased; with no `previous` right where they are */
export function updateBlocks(svg: SVGSVGElement, battle: Battle, previous: Positions | null, progress: number): void {
  const root = select(svg);
  if (svg.dataset.breaches !== String(battle.field.breaches.length)) drawBurgs(svg, battle.field); // the walls came down
  const pt = getPoint(battle.field);
  const time = battle.tick + progress;
  const last = shown.get(svg);
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
            facing: from.facing + swing(from.facing, block.facing) * progress
          };
    const was = elapsed >= 0 ? last!.at.get(block.id) : undefined;
    if (!was || Math.hypot(to.x - was.x, to.y - was.y) > LEAP * pt) {
      at.set(block.id, { x: to.x, y: to.y, facing: to.facing });
      continue;
    }
    at.set(block.id, {
      x: was.x + (to.x - was.x) * ease,
      y: was.y + (to.y - was.y) * ease,
      facing: was.facing + swing(was.facing, to.facing) * ease
    });
  }
  shown.set(svg, { time, at });

  root
    .select(".battleBlocks")
    .selectAll<SVGGElement, Block>("g.battleBlock")
    .data(battle.blocks, block => block.key) // blocks are lined up anew at each change before the start
    .each(function (block) {
      const { x, y, facing } = at.get(block.id)!;
      setTransform(this, x, y, facing);
    })
    .attr("display", block => (block.status === "fled" || getOpacity(block, time) === 0 ? "none" : null))
    .attr("opacity", block => getOpacity(block, time))
    .attr("data-tip", block => {
      const troops = `${capitalize(block.unit.replace(/_/g, " "))}: ${block.troops} / ${block.initial}`;
      if (block.status !== "ready") return `${troops}, ${block.status}`;
      const unit = battle.units.find(unit => unit.name === block.unit);
      const speed = unit ? `${t("Speed")}: ${convertSpeed(unit.speed)} ${getSpeedUnit()}` : "";
      const range = block.range ? `${t("Range")}: ${formatLength(block.range)}` : "";
      const morale = `${t("Morale")}: ${Math.round(block.morale)}%`;
      return sentences(troops, morale, BATTLE_ACTION_LABELS[block.action], ...[speed, range].filter(Boolean));
    })
    .each(function (block) {
      // the line inside the front edge is as long as the share of the troops alive
      const half = ((block.initial ? block.troops / block.initial : 0) * block.width) / 2;
      const x = block.depth / 2 - HEALTH_INSET * pt;
      (this.children[1] as SVGPathElement).setAttribute("d", `M${x} ${-half}V${half}`);
      (this.children[0] as SVGRectElement).setAttribute(
        "stroke-dasharray",
        block.status === "routed" ? `${3 * pt} ${2 * pt}` : ""
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
    .attr("stroke", shot => FIRE_COLORS[shot.block.side])
    .attr("stroke-dashoffset", -time * 3 * pt)
    .attr("d", ({ from, top, to }) => `M${fixed(from)}Q${fixed(top)} ${fixed(to)}`);

  root
    .select(".battleMissiles")
    .selectAll<SVGPathElement, (typeof shots)[number]>("path")
    .data(
      shots.filter(shot => shot.missile),
      shot => shot.block.key
    )
    .join("path")
    .attr("stroke", shot => FIRE_COLORS[shot.block.side])
    .attr("stroke-width", shot => (shot.missile === "shell" ? 4.5 : 1.2) * pt)
    .attr("d", ({ missile, phase, from, top, to }) => {
      if (missile === "arrows") {
        return VOLLEY.map(([lag, aside]) => {
          const flown = phase * 1.07 - lag;
          return flown > 0 && flown < 1 ? arrow(...arcAt(from, top, to, flown), aside, pt) : "";
        }).join("");
      }
      if (phase >= SHELL_FLIGHT) return "";
      const [x, y] = arcAt(from, top, to, phase / SHELL_FLIGHT);
      return `M${fixed([x, y])}h0.01`; // a dot
    });

  // a shell bursts bigger than a melee
  for (const { block, missile, phase, to } of shots) {
    if (missile !== "shell" || phase < SHELL_FLIGHT) continue;
    const spent = (phase - SHELL_FLIGHT) / (1 - SHELL_FLIGHT);
    bursts.push({ key: block.key, x: to[0], y: to[1], size: (20 + spent * 16) * pt, opacity: 1 - spent });
  }

  if (!battle.result) {
    const pulse = 0.55 + 0.45 * Math.sin(time * 2.2);
    for (const [block, target] of pairs("fight")) {
      if (block.id > target.id && target.target === block.id) continue; // one star for the two of them
      const [a, b] = [at.get(block.id)!, at.get(target.id)!];
      bursts.push({ key: block.key, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, size: 13 * pt, opacity: pulse });
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

  updateBattleDebug(svg, battle, at, pt);
}

const fixed = ([x, y]: Point): string => `${x.toFixed(1)} ${y.toFixed(1)}`;

/** Point of the arc from one point over the top to another, and the way it runs there */
function arcAt(from: Point, top: Point, to: Point, share: number): [number, number, number] {
  const rest = 1 - share;
  const at = (i: 0 | 1): number => rest * rest * from[i] + 2 * rest * share * top[i] + share * share * to[i];
  const run = (i: 0 | 1): number => rest * (top[i] - from[i]) + share * (to[i] - top[i]);
  return [at(0), at(1), Math.atan2(run(1), run(0))];
}

/** An arrow with its head at the point, `aside` of the course; sized in points */
function arrow(x: number, y: number, angle: number, aside: number, pt: number): string {
  const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
  const tip: Point = [x - sin * aside * pt, y + cos * aside * pt];
  const back = (along: number, across: number): Point => [
    tip[0] - (cos * along + sin * across) * pt,
    tip[1] - (sin * along - cos * across) * pt
  ];
  return `M${fixed(back(9, 0))}L${fixed(tip)}M${fixed(back(3, 2))}L${fixed(tip)}L${fixed(back(3, -2))}`;
}

export const snapshot = (battle: Battle): Positions =>
  new Map(battle.blocks.map(block => [block.id, { x: block.x, y: block.y, facing: block.facing }]));

function stateColor(stateId: number): string {
  const fill = pack.states[stateId]?.color;
  return fill && fill[0] === "#" ? fill : "#999";
}

/** A label in points */
function label(
  parent: ReturnType<typeof select<SVGGElement, unknown>>,
  field: Battlefield,
  text: string,
  x: number,
  y: number,
  size: number,
  fill: string
) {
  const pt = getPoint(field);
  return parent
    .append("text")
    .attr("x", Math.min(Math.max(x, 60 * pt), field.width - 60 * pt))
    .attr("y", Math.min(Math.max(y, 24 * pt), field.height - 12 * pt))
    .attr("text-anchor", "middle")
    .attr("font-size", size * pt)
    .attr("font-family", "Georgia, serif")
    .attr("fill", fill)
    .attr("paint-order", "stroke")
    .attr("stroke", "#fbf5e9")
    .attr("stroke-width", 3 * pt)
    .text(text);
}

/** Smooth outline of the grid nodes above the level */
function outline({ cell }: Battlefield, grid: number[], level: number): string {
  // two nodes wider on each side, so shapes run off the field instead of closing at its edge
  const cols = COLS + 4;
  const rows = ROWS + 4;
  const at = (col: number, row: number): number =>
    grid[Math.min(Math.max(row - 2, 0), ROWS - 1) * COLS + Math.min(Math.max(col - 2, 0), COLS - 1)];

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
