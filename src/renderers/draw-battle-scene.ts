import { color, contours, curveBasisClosed, curveCatmullRom, drag, line, pointer, select } from "d3";
import { Icons } from "@/model/icons";
import { type Battle, type Block, blockName } from "@/model/political/battle/battle";
import { type Battlefield, FIELD } from "@/model/political/battle/battlefield";
import type { Point } from "@/types/global";
import { escapeHtml } from "@/utils/string-utils";

/** Where blocks stood a tick ago, to glide between ticks */
export type Positions = Map<number, { x: number; y: number; facing: number }>;

/** Attackers are red and defenders blue whatever their states' colours, so the sides never look alike */
export const SIDE_COLORS = { attackers: "#c8473d", defenders: "#3f72b3" };

const GROUND: Record<number, string> = { 1: "#f6ecd2", 2: "#f1ecdf", 10: "#eef0ea", 11: "#f3f6f8" };
const INK = "#3d3a33";
const WATER = "#b4cbe2";

export function drawBattlefield(svg: SVGSVGElement, field: Battlefield): void {
  const paper =
    field.open === "sea" ? "#d3e0ea" : field.open === "sky" ? "#eaf1f7" : (GROUND[field.biome] ?? "#fbf5e9");

  svg.innerHTML = /* html */ `<defs>
      <pattern id="battleWood" width="24" height="24" patternUnits="userSpaceOnUse">
        <path d="M4 20a4 4 0 1 1 6 0M15 10a3.4 3.4 0 1 1 5 0" fill="none" stroke="#9cc47c" stroke-width="1.6" stroke-linecap="round"/>
      </pattern>
      <pattern id="battleMarsh" width="26" height="14" patternUnits="userSpaceOnUse">
        <path d="M3 10h9M8 10V5M5.5 10l-1.5-4M10.5 10l1.5-4M16 4h7" fill="none" stroke="#8fb0b8" stroke-width="1" stroke-linecap="round"/>
      </pattern>
      <pattern id="battleTown" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="6" height="6" fill="#f4f1ea"/><path d="M0 0v6" stroke="#77736b" stroke-width="2"/>
      </pattern>
      <clipPath id="battleFrame"><rect width="${FIELD.width}" height="${FIELD.height}"/></clipPath>
    </defs>
    <rect width="${FIELD.width}" height="${FIELD.height}" fill="${paper}"/>
    <g class="battleTerrain" clip-path="url(#battleFrame)"></g>
    <g class="battleLabels" pointer-events="none"></g>
    <g class="battleNorth" transform="translate(${FIELD.width - 28} 34)" fill="none" stroke="${INK}" stroke-width="1.5">
      <path d="M0 16V-16M-5 -8L0 -16L5 -8"/><text y="30" text-anchor="middle" font-size="13" fill="${INK}" stroke="none" font-family="Georgia, serif" font-weight="bold">N</text>
    </g>
    <g class="battleFire" fill="none" stroke-width="1" stroke-dasharray="2 5" opacity="0.55"></g>
    <g class="battleBlocks"></g>
    <g class="battleClashes" text-anchor="middle" dominant-baseline="central" font-size="13"></g>`;

  if (field.open) return;
  const terrain = select(svg).select<SVGGElement>(".battleTerrain");
  const labels = select(svg).select<SVGGElement>(".battleLabels");

  for (const level of [0.4, 0.58, 0.76]) {
    terrain.append("path").attr("d", outline(field.height, level)).attr("fill", "#c99b6a").attr("opacity", 0.16);
  }
  terrain.append("path").attr("d", outline(field.marsh, 0.5)).attr("fill", "url(#battleMarsh)");
  const wood = outline(field.wood, 0.5);
  terrain.append("path").attr("d", wood).attr("fill", "#dbe7c9").attr("opacity", 0.75);
  terrain.append("path").attr("d", wood).attr("fill", "url(#battleWood)");
  terrain
    .append("path")
    .attr(
      "d",
      outline(
        field.water.map(w => +(w === 1)),
        0.5
      )
    )
    .attr("fill", WATER);

  // no outline: tributaries join without a seam, and the mouth covers the shore line
  const course = line<Point>().curve(curveCatmullRom.alpha(0.5));
  for (const river of field.rivers) {
    terrain
      .append("path")
      .attr("d", course(river.points))
      .attr("fill", "none")
      .attr("stroke", WATER)
      .attr("stroke-linecap", "round")
      .attr("stroke-width", river.width);
  }
  for (const road of field.roads) {
    const d = course(road);
    terrain.append("path").attr("d", d).attr("fill", "none").attr("stroke", "#a39d90").attr("stroke-width", 5);
    terrain.append("path").attr("d", d).attr("fill", "none").attr("stroke", "#fbf8f1").attr("stroke-width", 2.2);
  }

  for (const burg of field.burgs) {
    const blob = Array.from({ length: 9 }, (_, i): Point => {
      const angle = (i / 9) * Math.PI * 2;
      const radius = burg.radius * (0.8 + 0.25 * Math.sin(i * 2.4 + burg.x));
      return [burg.x + Math.cos(angle) * radius, burg.y + Math.sin(angle) * radius * 0.85];
    });
    const shape = line<Point>().curve(curveBasisClosed)(blob);
    if (burg.walled) {
      // battlements: merlons stand out of the wall, the burg drawn over them hides their inner half
      terrain
        .append("path")
        .attr("d", shape)
        .attr("fill", "none")
        .attr("stroke", "#55524b")
        .attr("stroke-width", 7)
        .attr("stroke-dasharray", "4 4");
    }
    terrain
      .append("path")
      .attr("d", shape)
      .attr("fill", "url(#battleTown)")
      .attr("stroke", "#55524b")
      .attr("stroke-width", burg.walled ? 2.4 : 1.6);
    // above the burg, or below it when the edge is too close
    const top = burg.y - burg.radius * 0.9 - 2;
    const y = top < 24 ? burg.y + burg.radius * 0.9 + 13 : top;
    label(labels, `${burg.name} ${burg.group}`, burg.x, y, 13, INK);
  }

  // names run along the rivers, left to right
  field.rivers.forEach((river, i) => {
    const inside = river.points.filter(([x, y]) => x > 30 && x < FIELD.width - 30 && y > 20 && y < FIELD.height - 20);
    if (inside.length < 2 || !river.name) return;
    if (inside[0][0] > inside.at(-1)![0]) inside.reverse();
    terrain.append("path").attr("id", `battleRiver${i}`).attr("d", course(inside)).attr("fill", "none");
    terrain
      .append("text")
      .attr("dy", -river.width / 2 - 3)
      .attr("font-size", 11)
      .attr("font-style", "italic")
      .attr("fill", "#2b3a7c")
      .attr("paint-order", "stroke")
      .attr("stroke", "#fbf5e9")
      .attr("stroke-width", 2.5)
      .append("textPath")
      .attr("href", `#battleRiver${i}`)
      .attr("startOffset", "50%")
      .attr("text-anchor", "middle")
      .text(river.name);
  });
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
      const size = Math.min(d, w) - 4;
      // among allies a battalion flies the colour of its state from its rear corner
      const flag = flagged[block.side]
        ? `<path d="M${-d / 2} ${-w / 2}h-8l2.5 3l-2.5 3h8z" fill="${stateColor(block.state)}" stroke="${dark}" stroke-width="0.8"/>`
        : "";
      // the body, the health line along its front edge, the unit icon
      return /* html */ `<rect x="${-d / 2}" y="${-w / 2}" width="${d}" height="${w}" rx="1.5" fill="${fill}" stroke="${dark}" stroke-width="1.4"/>
        <path class="battleHealth" stroke="${dark}" stroke-width="3"/>
        <use href="${escapeHtml(Icons.href(unit?.icon ?? ""))}" x="${-size / 2}" y="${-size / 2}" width="${size}" height="${size}"/>${flag}`;
    });

  // a drag moves a battalion; held still, it turns until let go
  let hold: { start: Point; facing: number; moved: boolean; turned: boolean; timer: number } | null = null;
  groups.call(
    drag<SVGGElement, Block>()
      .filter(() => svg.classList.contains("battleEditable"))
      .on("start", function (event, block) {
        const held = { start: pointer(event, svg), facing: block.facing, moved: false, turned: false, timer: 0 };
        const turn = (): void => {
          if (hold !== held || held.moved) return;
          held.turned = true;
          held.facing += TURN_STEP;
          setTransform(this, block.x, block.y, held.facing);
          held.timer = window.setTimeout(turn, TURN_MS);
        };
        hold = held;
        held.timer = window.setTimeout(turn, HOLD_MS);
      })
      .on("drag", function (event, block) {
        if (!hold || hold.turned) return;
        const [x, y] = pointer(event, svg);
        if (!hold.moved && Math.hypot(x - hold.start[0], y - hold.start[1]) < 4) return; // a shaky hold
        hold.moved = true;
        clearTimeout(hold.timer);
        setTransform(this, x, y, block.facing);
      })
      .on("end", (event, block) => {
        const held = hold;
        hold = null;
        if (!held) return;
        clearTimeout(held.timer);
        if (held.turned) onTurn(block, held.facing);
        else if (held.moved) onDrop(block, ...pointer(event, svg));
      })
  );

  updateBlocks(svg, battle, null, 1);
}

const HOLD_MS = 400; // a press this long starts to turn the battalion
const TURN_MS = 110;
const TURN_STEP = Math.PI / 12;

/** Put a block's group at a place; its icon stays upright whatever the block faces */
function setTransform(group: SVGGElement, x: number, y: number, facing: number): void {
  const angle = ((facing * 180) / Math.PI).toFixed(1);
  group.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${angle})`);
  group.children[2].setAttribute("transform", `rotate(${-Number(angle)})`);
}

/** Put blocks where they are `progress` of the way through the tick */
export function updateBlocks(svg: SVGSVGElement, battle: Battle, previous: Positions | null, progress: number): void {
  const root = select(svg);
  const at = new Map<number, { x: number; y: number; facing: number }>();
  for (const block of battle.blocks) {
    const from = previous?.get(block.id);
    if (!from || progress >= 1) {
      at.set(block.id, block);
      continue;
    }
    const swing = Math.atan2(Math.sin(block.facing - from.facing), Math.cos(block.facing - from.facing));
    at.set(block.id, {
      x: from.x + (block.x - from.x) * progress,
      y: from.y + (block.y - from.y) * progress,
      facing: from.facing + swing * progress
    });
  }

  root
    .select(".battleBlocks")
    .selectAll<SVGGElement, Block>("g.battleBlock")
    .each(function (block) {
      const { x, y, facing } = at.get(block.id)!;
      setTransform(this, x, y, facing);
    })
    .attr("display", block => (block.status === "fled" ? "none" : null))
    .attr("opacity", block => (block.status === "destroyed" ? 0.25 : block.status === "routed" ? 0.6 : 1))
    .attr("data-tip", block => {
      const mood = block.status === "ready" ? `${Math.round(block.morale)}%` : block.status;
      return `${blockName(battle, block)}: ${block.troops} / ${block.initial}, ${mood}`;
    })
    .each(function (block) {
      // the front line is as long as the share of the troops alive
      const half = ((block.initial ? block.troops / block.initial : 0) * block.width) / 2;
      (this.children[1] as SVGPathElement).setAttribute("d", `M${block.depth / 2} ${-half}V${half}`);
      (this.children[0] as SVGRectElement).setAttribute("stroke-dasharray", block.status === "routed" ? "3 2" : "");
    });

  const byId = new Map(battle.blocks.map(block => [block.id, block]));
  const pairs = (action: Block["action"]): [Block, Block][] =>
    battle.blocks
      .filter(block => block.action === action && block.target !== null && byId.has(block.target))
      .map(block => [block, byId.get(block.target!)!]);

  root
    .select(".battleFire")
    .selectAll<SVGPathElement, [Block, Block]>("path")
    .data(battle.result ? [] : pairs("shoot"), ([block]) => block.key)
    .join("path")
    .attr("stroke", ([block]) => color(SIDE_COLORS[block.side])!.darker(1).formatHex())
    .attr("stroke-dashoffset", -battle.tick * 3 - progress * 3)
    .attr("d", ([block, target]) => {
      const a = at.get(block.id)!;
      const b = at.get(target.id)!;
      const lift = Math.hypot(b.x - a.x, b.y - a.y) / 5;
      return `M${a.x.toFixed(1)} ${a.y.toFixed(1)}Q${((a.x + b.x) / 2).toFixed(1)} ${((a.y + b.y) / 2 - lift).toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
    });

  root
    .select(".battleClashes")
    .selectAll<SVGTextElement, [Block, Block]>("text")
    .data(
      battle.result
        ? []
        : pairs("fight").filter(([block, target]) => block.id < target.id || target.target !== block.id),
      ([block]) => block.key
    )
    .join("text")
    .text("✸")
    .attr("fill", "#b3261e")
    .attr("opacity", 0.55 + 0.45 * Math.sin((battle.tick + progress) * 2.2))
    .attr("x", ([block, target]) => (at.get(block.id)!.x + at.get(target.id)!.x) / 2)
    .attr("y", ([block, target]) => (at.get(block.id)!.y + at.get(target.id)!.y) / 2);
}

export const snapshot = (battle: Battle): Positions =>
  new Map(battle.blocks.map(block => [block.id, { x: block.x, y: block.y, facing: block.facing }]));

function stateColor(stateId: number): string {
  const fill = pack.states[stateId]?.color;
  return fill && fill[0] === "#" ? fill : "#999";
}

function label(
  parent: ReturnType<typeof select<SVGGElement, unknown>>,
  text: string,
  x: number,
  y: number,
  size: number,
  fill: string
) {
  return parent
    .append("text")
    .attr("x", Math.min(Math.max(x, 60), FIELD.width - 60))
    .attr("y", Math.min(Math.max(y, 24), FIELD.height - 12))
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
function outline(grid: number[], level: number): string {
  const { cell } = FIELD;
  // two nodes wider on each side, so shapes run off the field instead of closing at its edge
  const cols = FIELD.cols + 4;
  const rows = FIELD.rows + 4;
  const at = (col: number, row: number): number =>
    grid[Math.min(Math.max(row - 2, 0), FIELD.rows - 1) * FIELD.cols + Math.min(Math.max(col - 2, 0), FIELD.cols - 1)];

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
