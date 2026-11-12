// What the battle simulation sees, drawn over the plan while the Battles diagnostics are on in Advanced options.
// For developers: its text is not translated.

import { pointer, select } from "d3";
import { type Battle, getWay } from "@/model/political/battle/battle";
import { type Battlefield, FIELD, nodeAt, terrainAt } from "@/model/political/battle/battlefield";
import { log } from "@/utils/logger";
import { escapeHtml } from "@/utils/string-utils";

type Places = Map<number, { x: number; y: number; facing: number }>;

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

const HALO = `paint-order="stroke" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"`;
let shown: Battle | null = null; // the battle the pointer reads the ground of

/** Draw or clear the diagnostics; called with the blocks, at the places they are drawn */
export function updateBattleDebug(svg: SVGSVGElement, battle: Battle, at: Places): void {
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
      .html(getGround(field))
      .node()!;
    root
      .append("g")
      .attr("class", "battleDebug doings")
      .attr("pointer-events", "none")
      .attr("font-family", "Arial, sans-serif");
    svg.onpointermove = event => {
      const text = svg.querySelector(".battleDebugGround");
      if (text && shown) text.textContent = describe(shown.field, ...pointer(event, svg));
    };
  }

  root.select(".battleDebug.doings").html(getDoings(battle, at));
}

/** The grid, what each node is, and the walls as the simulation has them */
function getGround(field: Battlefield): string {
  const { cell, cols, rows, width, height } = FIELD;
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
  html += `<path d="${lines(cell)}" fill="none" stroke="#000" stroke-width="0.3" stroke-opacity="0.16"/>`;
  html += `<path d="${lines(cell * 10)}" fill="none" stroke="#000" stroke-width="0.5" stroke-opacity="0.4"/>`;
  for (let col = 10; col < cols; col += 10) {
    html += `<text x="${col * cell + 2}" y="8" font-size="7" font-family="Arial, sans-serif" ${HALO}>${col}</text>`;
  }
  for (let row = 10; row < rows; row += 10) {
    html += `<text x="2" y="${row * cell + 8}" font-size="7" font-family="Arial, sans-serif" ${HALO}>${row}</text>`;
  }

  // walls bar the way, gates let through whom the burg is open to
  const stretch = (gate: boolean): string =>
    field.walls
      .filter(wall => wall.gate === gate)
      .map(wall => `M${wall.a.map(v => v.toFixed(1))}L${wall.b.map(v => v.toFixed(1))}`)
      .join("");
  html += `<path d="${stretch(false)}" fill="none" stroke="#d0342c" stroke-width="1.6"/>`;
  html += `<path d="${stretch(true)}" fill="none" stroke="#1a9e3a" stroke-width="2.6"/>`;
  field.burgs.forEach((burg, index) => {
    if (index === field.held)
      html += `<circle cx="${burg.x}" cy="${burg.y}" r="5" fill="none" stroke="#7b4bb5" stroke-width="1.5"/>`;
  });

  // what the colors stand for
  const used = GROUND.filter(([, , is]) => field.water.some((_, node) => is(field, node)));
  const legend = [...used.map(([name, color]) => [name, color]), ["wall line", "#d0342c"], ["gate line", "#1a9e3a"]];
  legend.forEach(([name, color], i) => {
    const y = height - 8 - (legend.length - 1 - i) * 11;
    html += `<rect x="6" y="${y - 7}" width="8" height="8" fill="${color}" fill-opacity="0.6" stroke="#000" stroke-width="0.3"/>`;
    html += `<text x="18" y="${y}" font-size="8" font-family="Arial, sans-serif" ${HALO}>${name}</text>`;
  });
  return html;
}

/** Where every battalion is going and what it is at, and the state of the battle */
function getDoings(battle: Battle, at: Places): string {
  let html = "";
  const byId = new Map(battle.blocks.map(block => [block.id, block]));

  for (const block of battle.blocks) {
    if (block.status === "fled" || block.status === "destroyed") continue;
    const { x, y, facing } = at.get(block.id) ?? block;
    const target = block.target === null ? null : byId.get(block.target);
    if (target) {
      const to = at.get(target.id) ?? target;
      html += `<path d="M${x.toFixed(1)} ${y.toFixed(1)}L${to.x.toFixed(1)} ${to.y.toFixed(1)}" stroke="#000" stroke-width="0.5" stroke-opacity="0.45" stroke-dasharray="1 3"/>`;
    }
    const way = getWay(battle, block);
    if (way.length) {
      const points = [[x, y], ...way].map(point => point.map(v => v.toFixed(1)).join(" ")).join("L");
      html += `<path d="M${points}" fill="none" stroke="#c7128a" stroke-width="1.1"/>`;
      html += way.map(([wx, wy]) => `<circle cx="${wx}" cy="${wy}" r="1.6" fill="#c7128a"/>`).join("");
    }
    const mark = block.status === "routed" ? "routed" : block.action;
    // right over the block, whatever way it is turned
    const top = (Math.abs(Math.sin(facing)) * block.depth + Math.abs(Math.cos(facing)) * block.width) / 2;
    html += `<text x="${x.toFixed(1)}" y="${(y - top - 1.5).toFixed(1)}" font-size="7.5" text-anchor="middle" ${HALO}>${mark} ♥${Math.round(block.morale)}</text>`;
  }

  const side = (name: "attackers" | "defenders"): string => {
    const { phase, morale, power, die, bonus } = battle[name];
    return `${name}: ${phase}, morale ${morale.toFixed(0)}, power ${power.toFixed(1)}${bonus ? ` (${bonus > 0 ? "+" : ""}${bonus})` : ""}, die ${die}`;
  };
  const held = battle.field.held === null ? "none" : escapeHtml(battle.field.burgs[battle.field.held].name);
  const state = [
    `tick ${battle.tick}`,
    `round ${Math.floor(battle.tick / 6) + 1}`,
    `engaged ${battle.engaged ?? "no"}`,
    `storm ${battle.storm ?? "no"}`,
    `held ${held}`,
    `breaches ${battle.field.breaches.length}`,
    `blocks ${battle.blocks.length}`
  ].join(" · ");
  const lines = [state, side("attackers"), side("defenders")];
  html += lines.map((text, i) => `<text x="58" y="${20 + i * 11}" font-size="8.5" ${HALO}>${text}</text>`).join("");
  html += `<text class="battleDebugGround" x="58" y="${20 + lines.length * 11}" font-size="8.5" ${HALO}>${escapeHtml(
    document.querySelector(".battleDebugGround")?.textContent ?? "point at the ground to read a node"
  )}</text>`;
  return html;
}

/** A node as the simulation has it */
function describe(field: Battlefield, x: number, y: number): string {
  if (x < 0 || y < 0 || x >= FIELD.width || y >= FIELD.height) return "";
  const node = nodeAt(x, y);
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
  return `node ${node % FIELD.cols},${Math.floor(node / FIELD.cols)} at ${x.toFixed(0)},${y.toFixed(0)} · height ${terrain.height.toFixed(2)} · ${what.join(", ") || "open ground"}`;
}
