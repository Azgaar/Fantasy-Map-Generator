// What the battle simulation sees, drawn over the plan while the Battles diagnostics are on in Advanced options.
// For developers: its text is not translated.

import { pointer, select } from "d3";
import type { Battle } from "@/model/political/battle/battle";
import { COLS, formatClock, ROWS } from "@/model/political/battle/battle-scale";
import {
  type Battlefield,
  distanceToLine,
  type FieldWork,
  getWorksBetween,
  isStanding,
  nodeAt,
  terrainAt
} from "@/model/political/battle/battlefield";
import { getWay } from "@/model/political/battle/movement";
import { findStretch, getShelter, holdsWorks } from "@/model/political/battle/works";
import { log } from "@/utils/logger";
import { escapeHtml } from "@/utils/string-utils";

type Places = Map<number, { x: number; y: number; facing: number }>;

// works by what they do
const WORKS: [name: string, color: string, is: (work: FieldWork) => boolean][] = [
  ["bars all (wagons)", "#d0342c", work => work.kind === "wagons" && work.harm < 1],
  ["bars riders (stakes)", "#e08a1a", work => work.kind === "stakes"],
  ["shelters (ditch)", "#1f5fbf", work => work.kind === "ditch"],
  ["down", "#888", work => work.harm >= 1]
];
const getWorkColor = (work: FieldWork): string => WORKS.find(([, , is]) => is(work))![1];

// what a node is to the troops, the later ones drawn over the earlier
const GROUND: [name: string, color: string, is: (field: Battlefield, node: number) => boolean][] = [
  ["sea or lake", "#1f5fbf", (field, node) => field.water[node] === 1],
  ["deep river", "#0c2f6b", (field, node) => field.water[node] === 2 && !field.ford[node]],
  ["ford", "#17b3c7", (field, node) => field.ford[node] === 1],
  ["bridge", "#f08fc0", (field, node) => field.deck[node] === 1],
  ["wood", "#2e8b3d", (field, node) => field.wood[node] === 1],
  ["marsh", "#8a8f2a", (field, node) => field.marsh[node] === 1],
  ["road", "#8a5a2b", (field, node) => field.road[node] === 1],
  ["within walls", "#7b4bb5", (field, node) => field.walled[node] > 0 && !field.rampart[node]],
  ["wall foot", "#d0342c", (field, node) => field.rampart[node] === 1],
  ["gateway", "#e08a1a", (field, node) => field.rampart[node] === 2],
  ["breach", "#e6cf1c", (field, node) => field.rampart[node] === 3]
];

const halo = (pt: number): string =>
  `paint-order="stroke" stroke="#fff" stroke-width="${2.5 * pt}" stroke-linejoin="round"`;
let shown: Battle | null = null; // the battle the pointer reads the ground of

/** Draw or clear the diagnostics; called with the blocks, at the places they are drawn */
/** `pt`: what a mark's point is in metres, as the scene sizes its marks */
export function updateBattleDebug(svg: SVGSVGElement, battle: Battle, at: Places, pt: number): void {
  const root = select(svg);
  if (!log.debug.battle) {
    if (!svg.querySelector(".battleDebug")) return;
    root.selectAll(".battleDebug").remove();
    svg.onpointermove = null;
    shown = null;
    return;
  }

  shown = battle;
  const { field } = battle;
  const key = `${field.breaches.length}|${field.held}`;
  let ground = svg.querySelector<SVGGElement>(".battleDebug.ground");
  if (!ground || ground.dataset.key !== key) {
    root.selectAll(".battleDebug").remove();
    // the ground under the labels and the troops, the troops' doings over everything
    ground = root
      .insert("g", ".battleLabels")
      .attr("class", "battleDebug ground")
      .attr("pointer-events", "none")
      .attr("data-key", key)
      .html(getGround(field, pt))
      .node()!;
    root
      .append("g")
      .attr("class", "battleDebug doings")
      .attr("pointer-events", "none")
      .attr("font-family", "Arial, sans-serif");
    svg.onpointermove = event => {
      const text = svg.querySelector(".battleDebugGround");
      if (!text || !shown) return;
      const [x, y] = pointer(event, svg);
      text.textContent = [describe(shown.field, x, y), describeWork(shown.field, x, y)].filter(Boolean).join(" · ");
    };
  }

  root.select(".battleDebug.doings").html(getDoings(battle, at, pt));
}

/** The grid, what each node is, and the walls as the simulation has them */
function getGround(field: Battlefield, pt: number): string {
  const { cell, width, height } = field;
  const [cols, rows] = [COLS, ROWS];
  const HALO = halo(pt);
  let html = "";

  for (const [, color, is] of GROUND) {
    let d = "";
    for (let node = 0; node < cols * rows; node++) {
      if (is(field, node)) d += `M${(node % cols) * cell} ${Math.floor(node / cols) * cell}h${cell}v${cell}h${-cell}z`;
    }
    if (d) html += `<path d="${d}" fill="${color}" fill-opacity="0.34"/>`;
  }

  const lines = (step: number): string => {
    let d = "";
    for (let x = 0; x <= width; x += step) d += `M${x} 0V${height}`;
    for (let y = 0; y <= height; y += step) d += `M0 ${y}H${width}`;
    return d;
  };
  html += `<path d="${lines(cell)}" fill="none" stroke="#000" stroke-width="${0.3 * pt}" stroke-opacity="0.16"/>`;
  html += `<path d="${lines(cell * 10)}" fill="none" stroke="#000" stroke-width="${0.5 * pt}" stroke-opacity="0.4"/>`;
  for (let col = 10; col < cols; col += 10) {
    html += `<text x="${col * cell + 2 * pt}" y="${8 * pt}" font-size="${7 * pt}" font-family="Arial, sans-serif" ${HALO}>${col}</text>`;
  }
  for (let row = 10; row < rows; row += 10) {
    html += `<text x="${2 * pt}" y="${row * cell + 8 * pt}" font-size="${7 * pt}" font-family="Arial, sans-serif" ${HALO}>${row}</text>`;
  }

  // walls bar the way, gates let through whom the burg is open to
  const stretch = (gate: boolean): string =>
    field.walls
      .filter(wall => wall.gate === gate)
      .map(wall => `M${wall.a.map(v => v.toFixed(1))}L${wall.b.map(v => v.toFixed(1))}`)
      .join("");
  html += `<path d="${stretch(false)}" fill="none" stroke="#d0342c" stroke-width="${1.6 * pt}"/>`;
  html += `<path d="${stretch(true)}" fill="none" stroke="#1a9e3a" stroke-width="${2.6 * pt}"/>`;
  field.burgs.forEach((burg, index) => {
    if (index === field.held)
      html += `<circle cx="${burg.x}" cy="${burg.y}" r="${5 * pt}" fill="none" stroke="#7b4bb5" stroke-width="${1.5 * pt}"/>`;
  });

  // what the colors stand for
  const used = GROUND.filter(([, , is]) => field.water.some((_, node) => is(field, node)));
  const legend = [...used.map(([name, color]) => [name, color]), ["wall line", "#d0342c"], ["gate line", "#1a9e3a"]];
  legend.forEach(([name, color], i) => {
    const y = height - (8 + (legend.length - 1 - i) * 11) * pt;
    html += `<rect x="${6 * pt}" y="${y - 7 * pt}" width="${8 * pt}" height="${8 * pt}" fill="${color}" fill-opacity="0.6" stroke="#000" stroke-width="${0.3 * pt}"/>`;
    html += `<text x="${18 * pt}" y="${y}" font-size="${8 * pt}" font-family="Arial, sans-serif" ${HALO}>${name}</text>`;
  });
  return html;
}

/** Stretches of works as the simulation has them: by what they do, thin while built, a tick on the front side */
function getWorks(battle: Battle, pt: number): string {
  const HALO = halo(pt);
  let html = "";
  for (const work of battle.field.works) {
    const color = getWorkColor(work);
    const standing = isStanding(work);
    const [a, b] = [work.a, work.b];
    const [mx, my] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const [fx, fy] = [(b[1] - a[1]) / length, -(b[0] - a[0]) / length]; // the front is on the left of a → b
    const dash = work.harm >= 1 ? ` stroke-dasharray="${2 * pt} ${2 * pt}"` : "";
    html += `<path d="M${a.map(v => v.toFixed(1))}L${b.map(v => v.toFixed(1))}M${mx.toFixed(1)} ${my.toFixed(1)}l${(fx * 4 * pt).toFixed(1)} ${(fy * 4 * pt).toFixed(1)}" fill="none" stroke="${color}" stroke-width="${(standing || work.harm >= 1 ? 2 : 0.8) * pt}"${dash}/>`;
    if (!work.up)
      html += `<text x="${mx.toFixed(1)}" y="${(my - 2 * pt).toFixed(1)}" font-size="${6.5 * pt}" text-anchor="middle" fill="${color}" ${HALO}>${Math.floor(work.done * 100)}%</text>`;
  }
  if (!battle.field.works.length) return html;
  WORKS.forEach(([name, color], i) => {
    const y = battle.field.height - (8 + (WORKS.length - 1 - i) * 11) * pt;
    const x = battle.field.width - 110 * pt;
    html += `<path d="M${x} ${y - 3 * pt}h${10 * pt}" stroke="${color}" stroke-width="${2 * pt}"/>`;
    html += `<text x="${x + 14 * pt}" y="${y}" font-size="${8 * pt}" ${HALO}>${name}</text>`;
  });
  return html;
}

/** Where every battalion is going and what it is at, and the state of the battle */
function getDoings(battle: Battle, at: Places, pt: number): string {
  const HALO = halo(pt);
  let html = getWorks(battle, pt);
  const byId = new Map(battle.blocks.map(block => [block.id, block]));

  for (const block of battle.blocks) {
    if (block.status === "fled" || block.status === "destroyed") continue;
    const { x, y, facing } = at.get(block.id) ?? block;
    const target = block.target === null ? null : byId.get(block.target);
    if (target) {
      const to = at.get(target.id) ?? target;
      // a blow or a shot the target's works weaken is drawn in their colour
      const striking = block.action === "fight" || block.action === "shoot";
      const sheltered = striking && getShelter(battle, block, target, block.action === "shoot") < 1;
      const works = sheltered
        ? getWorksBetween(battle.field, [block.x, block.y], [target.x, target.y], target.side)
        : [];
      const color = works.length ? getWorkColor(works[0]) : "#000";
      html += `<path d="M${x.toFixed(1)} ${y.toFixed(1)}L${to.x.toFixed(1)} ${to.y.toFixed(1)}" stroke="${color}" stroke-width="${(works.length ? 1 : 0.5) * pt}" stroke-opacity="${works.length ? 0.9 : 0.45}" stroke-dasharray="${pt} ${3 * pt}"/>`;
    }
    if (block.action === "build") {
      const work = findStretch(battle, block);
      if (work) {
        const [mx, my] = [(work.a[0] + work.b[0]) / 2, (work.a[1] + work.b[1]) / 2];
        html += `<path d="M${x.toFixed(1)} ${y.toFixed(1)}L${mx.toFixed(1)} ${my.toFixed(1)}" stroke="${getWorkColor(work)}" stroke-width="${0.5 * pt}"/>`;
      }
    }
    const way = getWay(battle, block);
    if (way.length) {
      const points = [[x, y], ...way].map(point => point.map(v => v.toFixed(1)).join(" ")).join("L");
      html += `<path d="M${points}" fill="none" stroke="#c7128a" stroke-width="${1.1 * pt}"/>`;
      html += way.map(([wx, wy]) => `<circle cx="${wx}" cy="${wy}" r="${1.6 * pt}" fill="#c7128a"/>`).join("");
    }
    // its place in the formation, or the point the general sent it round by
    if (block.status === "ready" && Math.hypot(block.order.x - x, block.order.y - y) > 6 * pt) {
      html += `<path d="M${x.toFixed(1)} ${y.toFixed(1)}L${block.order.x.toFixed(1)} ${block.order.y.toFixed(1)}" stroke="#1a9e3a" stroke-width="${0.6 * pt}" stroke-opacity="0.7"/>`;
      html += `<circle cx="${block.order.x.toFixed(1)}" cy="${block.order.y.toFixed(1)}" r="${1.4 * pt}" fill="#1a9e3a"/>`;
    }
    const sent = block.order.sent ? "!" : "";
    const mark = block.status === "routed" ? "routed" : `${block.order.mission}${sent} ${block.action}`;
    // right over the block, whatever way it is turned
    const top = (Math.abs(Math.sin(facing)) * block.depth + Math.abs(Math.cos(facing)) * block.width) / 2;
    html += `<text x="${x.toFixed(1)}" y="${(y - top - 1.5 * pt).toFixed(1)}" font-size="${7.5 * pt}" text-anchor="middle" ${HALO}>${mark} ♥${Math.round(block.morale)}</text>`;
  }

  const side = (name: "attackers" | "defenders"): string => {
    const { phase, morale, power, die, bonus, plan, advancing } = battle[name];
    const own = battle.field.works.filter(work => work.side === name);
    const arrives = Number.isFinite(plan.arrival) ? (plan.arrival / 6).toFixed(1) : "∞";
    const works = [
      plan.fortify ? "fortify" : "",
      holdsWorks(battle, name) ? "holds works" : "",
      `arrives ${arrives}`,
      own.length ? `works ${own.filter(isStanding).length}/${own.length}` : ""
    ].filter(Boolean);
    return `${name}: ${plan.tactic}, ${advancing ? "advancing" : "holding"}, ${phase}, morale ${morale.toFixed(0)}, power ${power.toFixed(1)}${bonus ? ` (${bonus > 0 ? "+" : ""}${bonus})` : ""}, die ${die}, ${works.join(", ")}`;
  };
  const { works } = battle.field;
  const down = works.filter(work => work.harm >= 1).length;
  const held = battle.field.held === null ? "none" : escapeHtml(battle.field.burgs[battle.field.held].name);
  const state = [
    `tick ${battle.tick}`,
    `round ${Math.floor(battle.tick / 6) + 1}`,
    formatClock(battle.tick),
    `field ${Math.round(battle.field.width)} m, front ${Math.round(battle.field.front)} m`,
    `engaged ${battle.engaged ?? "no"}`,
    `storm ${battle.storm ?? "no"}`,
    `held ${held}`,
    `breaches ${battle.field.breaches.length}`,
    `works ${works.filter(isStanding).length} standing, ${works.filter(work => !work.up).length} building, ${down} down`,
    `blocks ${battle.blocks.length}`
  ].join(" · ");
  const lines = [state, side("attackers"), side("defenders")];
  html += lines
    .map((text, i) => `<text x="${58 * pt}" y="${(20 + i * 11) * pt}" font-size="${8.5 * pt}" ${HALO}>${text}</text>`)
    .join("");
  html += `<text class="battleDebugGround" x="${58 * pt}" y="${(20 + lines.length * 11) * pt}" font-size="${8.5 * pt}" ${HALO}>${escapeHtml(
    document.querySelector(".battleDebugGround")?.textContent ?? "point at the ground to read a node"
  )}</text>`;
  return html;
}

/** A node as the simulation has it */
function describe(field: Battlefield, x: number, y: number): string {
  if (x < 0 || y < 0 || x >= field.width || y >= field.height) return "";
  const node = nodeAt(field, x, y);
  const terrain = terrainAt(field, x, y);
  const what = [
    terrain.water === 1 ? "sea or lake" : terrain.water === 2 ? (terrain.ford ? "ford" : "deep river") : "",
    terrain.deck ? "bridge" : "",
    terrain.road ? "road" : "",
    terrain.wood ? "wood" : "",
    terrain.marsh ? "marsh" : "",
    terrain.town ? "town" : "",
    terrain.walled ? `within walls of ${field.burgs[terrain.walled - 1].name}` : "",
    ["", "wall foot", "gateway", "breach"][terrain.rampart]
  ].filter(Boolean);
  return `node ${node % COLS},${Math.floor(node / COLS)} at ${x.toFixed(0)},${y.toFixed(0)} · height ${terrain.height.toFixed(2)} · ${what.join(", ") || "open ground"}`;
}

/** A stretch of works under the pointer, within 6 m */
function describeWork(field: Battlefield, x: number, y: number): string {
  const work = field.works.find(work => distanceToLine([x, y], [work.a, work.b]) <= 6);
  if (!work) return "";
  return `${work.kind} of the ${work.side}, done ${Math.floor(work.done * 100)}%${work.up ? " (stands)" : ""}, harm ${Math.round(work.harm * 100)}%`;
}
