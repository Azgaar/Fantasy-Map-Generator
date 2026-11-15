#!/usr/bin/env node
/**
 * Draw the tactic diagrams of the Battle Simulator wiki page: one PNG per tactic, docs/wiki/Battle-tactic-<name>.png.
 * The side drawn up in the tactic stands where the formation code puts it (Formations.form, for an army suited to the
 * tactic); the foe, the ground, the arrows and the labels are drawn round it by hand, scene by scene.
 * Re-run when a formation changes. Node 24 imports formations.ts as it is: it only imports types.
 *
 * Usage:
 *   npm run battle-diagrams [-- --only oblique,wedge] [--out docs/wiki] [--svg]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { Formations, TACTICS } from "../src/model/political/battle/formations.ts";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
const arg = name => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const OUT = path.resolve(ROOT, arg("--out") ?? "docs/wiki");
const ONLY = arg("--only")?.split(",") ?? null;
const PNG_WIDTH = 1100;

// the formations, drawn up as the general would for an army suited to each: 300-man battalions on the default field
const FRONT = 60; // metres a battalion stands wide
const ROOM = 580; // metres across the attack a line has on the default field
const POWER = { line: 1, shooter: 0.93, rider: 2.03, engine: 12 }; // of the default units, so the best stand first
const ARMIES = {
  assault: { line: 7, shooter: 3, rider: 4 },
  oblique: { line: 8, shooter: 2, rider: 3 },
  envelopment: { line: 6, shooter: 2, rider: 4 },
  wedge: { line: 7, shooter: 2, rider: 2 },
  harass: { line: 4, shooter: 5, rider: 2 },
  flyingWedge: { line: 6, shooter: 2, rider: 6 },
  defensiveLine: { line: 8, shooter: 3, rider: 2 },
  refusedFlanks: { line: 6, shooter: 2, rider: 2 },
  crossing: { line: 6, shooter: 2, rider: 2 },
  wagenburg: { line: 8, shooter: 3, engine: 1 },
  waves: { line: 6, shooter: 2, rider: 2 }
};
const P = Object.fromEntries(
  Object.entries(ARMIES).map(([tactic, counts]) => {
    let id = 0;
    const blocks = Object.entries(counts).flatMap(([kind, n]) =>
      Array.from({ length: n }, (_, i) => ({
        id: id++,
        kind,
        troops: 300 - i,
        unitPower: POWER[kind],
        width: FRONT,
        depth: FRONT / 2
      }))
    );
    const places = Formations.form(blocks, TACTICS[tactic], 1, ROOM, FRONT).map(p => ({
      kind: p.block.kind,
      role: p.role,
      across: Math.round(p.across),
      along: Math.round(p.along),
      facing: p.facing ?? 0,
      w: p.block.width,
      d: p.block.depth
    }));
    return [tactic, places];
  })
);

const W = 1400;
const H = 760;
const C = {
  paper: "#eef0e6",
  frame: "#c9cdbf",
  ink: "#3a3f38",
  muted: "#6b7266",
  red: "#c0392b",
  blue: "#2a5ca8",
  water: "#b7d1e4",
  waterEdge: "#8fb3cf",
  shallow: "#cfe1ee",
  ford: "#d9e8f1",
  wood: "#cfdcbd",
  tree: "#9fb78a",
  hill: ["#e6e1cf", "#ddd5bb", "#d3c8a8"],
  road: "#c3ab83",
  town: "#e3dccb",
  wall: "#4a443c",
  wagon: "#5b4a36"
};
const SIDE = { red: C.red, blue: C.blue };

const rad = deg => (deg * Math.PI) / 180;
const f1 = v => Math.round(v * 10) / 10;

/** A formation's places on the plan: its first line's middle at x, y, facing the heading (degrees, 0 east, 90 south) */
function seat(name, side, x, y, heading, filter = () => true) {
  const h = rad(heading);
  const [fx, fy, rx, ry] = [Math.cos(h), Math.sin(h), -Math.sin(h), Math.cos(h)];
  return P[name].filter(filter).map(p => ({
    side,
    kind: p.kind,
    role: p.role,
    x: x + fx * p.along + rx * p.across,
    y: y + fy * p.along + ry * p.across,
    angle: heading + (p.facing * 180) / Math.PI,
    w: p.w,
    d: p.d
  }));
}

/** A battalion: a block across its front, its kind in white, its front edge lighter */
function unit({ side, kind, x, y, angle, w = 60, d = 30 }) {
  const c = SIDE[side];
  const [hw, hd] = [w / 2, d / 2];
  let glyph = "";
  const gx = hd * 0.62;
  const gy = Math.min(hw * 0.78, hd * 1.6);
  if (kind === "line") glyph = `<path d="M${-gx} ${-gy}L${gx} ${gy}M${gx} ${-gy}L${-gx} ${gy}"/>`;
  if (kind === "rider") glyph = `<path d="M${gx} ${-gy}L${-gx} ${gy}"/>`;
  if (kind === "shooter") glyph = `<circle r="3.6" fill="#fff" stroke="none"/>`;
  if (kind === "engine") glyph = `<circle r="6"/>`;
  return `<g transform="translate(${f1(x)} ${f1(y)}) rotate(${f1(angle)})"><rect x="${-hd}" y="${-hw}" width="${d}" height="${w}" rx="2" fill="${c}"/><rect x="${hd - 4}" y="${-hw}" width="4" height="${w}" fill="#fff" opacity="0.55"/><g stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round">${glyph}</g></g>`;
}

/** A movement arrow along a path; dashed for what comes later */
function arrow(d, side, { dashed = false, width = 9, opacity = 0.8 } = {}) {
  const c = SIDE[side] ?? side;
  return `<path d="${d}" fill="none" stroke="${c}" stroke-width="${width}" stroke-opacity="${opacity}" stroke-linecap="round" stroke-linejoin="round" ${dashed ? `stroke-dasharray="${width * 1.6} ${width * 1.4}"` : ""} marker-end="url(#head-${side})"/>`;
}

/** Shots: thin dotted lines from shooters to their targets */
function fire(from, to, side) {
  return from
    .map((u, i) => {
      const t = to[i % to.length];
      const mx = (u.x + t.x) / 2;
      const my = (u.y + t.y) / 2 - 18;
      return `<path d="M${f1(u.x)} ${f1(u.y)}Q${f1(mx)} ${f1(my)} ${f1(t.x)} ${f1(t.y)}" fill="none" stroke="${SIDE[side]}" stroke-width="2.4" stroke-dasharray="2 7" stroke-linecap="round" opacity="0.8"/>`;
    })
    .join("");
}

function label(text, x, y, { anchor = "middle", size = 25, color = C.ink, italic = true, weight = 500 } = {}) {
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" font-weight="${weight}" ${italic ? 'font-style="italic"' : ""} fill="${color}" stroke="${C.paper}" stroke-width="6" paint-order="stroke" stroke-linejoin="round">${text}</text>`;
}

/** A blob of woods with tree marks */
function woods(points, seed = 1) {
  const d = smooth(points);
  const [x0, y0, x1, y1] = bounds(points);
  let trees = "";
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let y = y0 + 18; y < y1; y += 34)
    for (let x = x0 + 18 + ((y / 34) % 2) * 17; x < x1; x += 34) {
      const [px, py] = [x + (rnd() - 0.5) * 14, y + (rnd() - 0.5) * 14];
      if (inside(points, px, py, 14)) trees += `<circle cx="${f1(px)}" cy="${f1(py)}" r="7.5"/>`;
    }
  return `<path d="${d}" fill="${C.wood}"/><g fill="${C.tree}">${trees}</g>`;
}

function hill(cx, cy, rx, ry) {
  return [1, 0.68, 0.38]
    .map((k, i) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx * k}" ry="${ry * k}" fill="${C.hill[i]}" stroke="#c4b894" stroke-width="1.5"/>`)
    .join("");
}

function water(points, { edge = true } = {}) {
  return `<path d="${smooth(points)}" fill="${C.water}" ${edge ? `stroke="${C.waterEdge}" stroke-width="2"` : ""}/>`;
}

function road(d, width = 14) {
  return `<path d="${d}" fill="none" stroke="${C.road}" stroke-width="${width}" stroke-linecap="round" opacity="0.8"/>`;
}

/** Walls round a burg: a ring of stretches with gaps for gates where the road comes in (angles in degrees) */
function burg(cx, cy, r, gates = [180, 0]) {
  const pts = Array.from({ length: 13 }, (_, i) => {
    const a = (i / 13) * Math.PI * 2;
    const k = 1 + 0.08 * Math.sin(i * 2.3) + 0.05 * Math.cos(i * 4.1);
    return [cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * 0.9 * k];
  });
  const fill = `<path d="${smooth(pts)}" fill="${C.town}"/>`;
  // houses
  let houses = "";
  for (let i = 0; i < 26; i++) {
    const a = i * 2.39996;
    const d = Math.sqrt(i / 26) * r * 0.78;
    const [x, y] = [cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.9];
    houses += `<rect x="${f1(x - 7)}" y="${f1(y - 5)}" width="14" height="10" fill="#cbbfa6" transform="rotate(${(i * 37) % 90} ${f1(x)} ${f1(y)})"/>`;
  }
  // walls as an outline with gaps at the gates
  const path = smooth(pts);
  const len = r * 2 * Math.PI * 0.95;
  const gap = 34;
  const dash = gates
    .map(g => (((g + 360) % 360) / 360) * len)
    .sort((a, b) => a - b)
    .reduce((acc, at, i, all) => {
      const prev = i ? all[i - 1] + gap / 2 : 0;
      acc.push(at - gap / 2 - prev, gap);
      return acc;
    }, []);
  const total = dash.reduce((a, b) => a + b, 0);
  dash.push(len - total + 0.1, 0);
  const towers = pts.map(([x, y]) => `<circle cx="${f1(x)}" cy="${f1(y)}" r="7" fill="${C.wall}"/>`).join("");
  // gates: where the road crosses the walls, a gap with a tower each side
  const gateMarks = gates
    .map(g => {
      const a = rad(g);
      let d = 0;
      while (inside(pts, cx + Math.cos(a) * d, cy + Math.sin(a) * d)) d += 2;
      const [x, y] = [cx + Math.cos(a) * d, cy + Math.sin(a) * d];
      const [nx, ny] = [-Math.sin(a), Math.cos(a)];
      return `<rect x="-9" y="-17" width="18" height="34" fill="${C.road}" transform="translate(${f1(x)} ${f1(y)}) rotate(${g})"/>${[-1, 1].map(k => `<circle cx="${f1(x + nx * 19 * k)}" cy="${f1(y + ny * 19 * k)}" r="8" fill="${C.wall}"/>`).join("")}`;
    })
    .join("");
  return `${fill}<g>${houses}</g><path d="${path}" fill="none" stroke="${C.wall}" stroke-width="7"/>${towers}${gateMarks}`;
}

/** Wagons: a chain of short dark boxes along a closed or open polyline */
function wagons(points, closed = true) {
  const pts = closed ? [...points, points[0]] : points;
  let out = "";
  for (let i = 1; i < pts.length; i++) {
    const [a, b] = [pts[i - 1], pts[i]];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.round(len / 26));
    const ang = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      const [x, y] = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      out += `<rect x="-10" y="-5" width="20" height="10" rx="1.5" fill="${C.wagon}" transform="translate(${f1(x)} ${f1(y)}) rotate(${f1(ang)})"/>`;
    }
  }
  return out;
}

function smooth(pts) {
  const n = pts.length;
  let d = `M${f1((pts[0][0] + pts[n - 1][0]) / 2)} ${f1((pts[0][1] + pts[n - 1][1]) / 2)}`;
  for (let i = 0; i < n; i++) {
    const [p, q] = [pts[i], pts[(i + 1) % n]];
    d += `Q${f1(p[0])} ${f1(p[1])} ${f1((p[0] + q[0]) / 2)} ${f1((p[1] + q[1]) / 2)}`;
  }
  return `${d}Z`;
}
function bounds(pts) {
  const xs = pts.map(p => p[0]);
  const ys = pts.map(p => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
function inside(pts, x, y, margin = 0) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  if (!c || !margin) return c;
  return [0, 90, 180, 270].every(a => inside(pts, x + Math.cos(rad(a)) * margin, y + Math.sin(rad(a)) * margin));
}

function svg(title, body) {
  const heads = Object.entries(SIDE)
    .map(
      ([side, c]) =>
        `<marker id="head-${side}" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="3.4" markerHeight="3.4" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${c}"/></marker>`
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Helvetica, Arial, sans-serif"><defs>${heads}</defs><rect width="${W}" height="${H}" fill="${C.paper}"/>${body}${label(title, 28, 50, { anchor: "start", size: 32, italic: false, weight: 600 })}<rect x="1" y="1" width="${W - 2}" height="${H - 2}" fill="none" stroke="${C.frame}" stroke-width="2"/></svg>`;
}

const units = list => list.map(unit).join("");
const enemyLine = (x, y, heading = 180, side = "blue") => seat("defensiveLine", side, x, y, heading);

// ---------- scenes
const S = {};

S.assault = () => {
  const red = seat("assault", "red", 420, 380, 0);
  const blue = enemyLine(960, 380);
  return svg(
    "Frontal assault",
    units(blue) +
      [270, 345, 415, 490].map(y => arrow(`M${470} ${y}L${905} ${y}`, "red")).join("") +
      arrow(`M420 735 C 760 770, 1010 720, 1000 620`, "red", { dashed: true }) +
      arrow(`M420 25 C 760 -10, 1010 40, 1000 140`, "red", { dashed: true }) +
      units(red) +
      label("riders guard the wings,", 640, 700) +
      label("then ride round the ends", 640, 728) +
      label("reserve", 285, 388, { anchor: "end" }) +
      label("shooters", 340, 290, { anchor: "end" })
  );
};

S.oblique = () => {
  const red = seat("oblique", "red", 430, 320, 0);
  const blue = enemyLine(970, 320);
  return svg(
    "Oblique attack",
    units(blue) +
      arrow(`M500 430 L 925 480`, "red", { width: 14 }) +
      arrow(`M500 515 L 925 503`, "red", { width: 14 }) +
      arrow(`M560 690 C 990 740, 1060 640, 1012 555`, "red", { dashed: true }) +
      arrow(`M430 190 L 560 190`, "red", { dashed: true, width: 7 }) +
      units(red) +
      label("massed wing strikes first", 720, 600) +
      label("weak wing held back", 585, 199, { anchor: "start" }) +
      label("the riders go with the massed wing", 560, 745, { anchor: "start" })
  );
};

S.envelopment = () => {
  const red = seat("envelopment", "red", 430, 380, 0);
  const blue = enemyLine(960, 380);
  return svg(
    "Envelopment",
    units(blue) +
      arrow(`M470 70 C 820 20, 1080 70, 1050 200`, "red") +
      arrow(`M470 690 C 820 740, 1080 690, 1050 560`, "red") +
      arrow(`M480 380 L 640 380`, "red", { dashed: true, width: 7 }) +
      units(red) +
      label("the wings close round the foe", 760, 120) +
      label("centre held back", 560, 430)
  );
};

S.wedge = () => {
  const red = seat("wedge", "red", 470, 380, 0);
  const blue = seat("defensiveLine", "blue", 980, 380, 180, p => p.role === "line" || p.role === "support");
  const more = [-333, -259, 259, 333].map(a => ({ side: "blue", kind: "line", x: 980, y: 380 - a, angle: 180, w: 60, d: 30 }));
  return svg(
    "Wedge",
    units([...blue, ...more]) +
      arrow(`M520 380 L 1060 380`, "red", { width: 18 }) +
      units(red) +
      label("the centre leads to break through", 760, 330) +
      label("a long, thin line", 1030, 130, { anchor: "start" }) +
      label("wings trail", 380, 172)
  );
};

S.harass = () => {
  const red = seat("harass", "red", 470, 380, 0);
  const blue = enemyLine(760, 380);
  const shooters = red.filter(u => u.kind === "shooter").sort((a, b) => a.y - b.y);
  const targets = blue.filter(u => u.role === "line").sort((a, b) => a.y - b.y).slice(0, 5);
  return svg(
    "Harassing fire",
    units(blue) +
      fire(shooters, targets, "red") +
      arrow(`M380 680 L 640 680`, "red", { dashed: true, width: 7 }) +
      units(red) +
      label("shooters in the first line wear the foe down", 620, 85) +
      label("then the foot go in", 510, 725) +
      label("foot behind", 330, 460)
  );
};

S.flyingWedge = () => {
  const red = seat("flyingWedge", "red", 430, 300, 0, p => p.role !== "wedge");
  const wedge = seat("flyingWedge", "red", 480, 610, 0, p => p.role === "wedge");
  const blue = seat("defensiveLine", "blue", 930, 300, 180);
  return svg(
    "Flying wedge",
    units(blue) +
      arrow(`M475 300 L 870 300`, "red") +
      arrow(`M520 640 C 820 760, 1130 700, 1100 560 S 1010 470, 975 470`, "red", { width: 12 }) +
      units(red) +
      units(wedge) +
      label("riders in a wedge of their own", 330, 748) +
      label("ride wide round the end", 900, 740) +
      label("and fall on it from beyond", 1240, 610)
  );
};

S.defensiveLine = () => {
  const blue = seat("defensiveLine", "blue", 920, 380, 180);
  const red = seat("assault", "red", 260, 380, 0, p => p.role === "line" || p.role === "support");
  return svg(
    "Defensive line",
    hill(1000, 380, 300, 290) +
      woods([[800, 40], [1080, 20], [1180, 90], [1060, 150], [860, 150], [770, 100]], 3) +
      water([[790, 640], [940, 600], [1110, 630], [1160, 720], [960, 760], [800, 740]]) +
      `<path d="M690 0 C 660 200, 720 420, 680 760" fill="none" stroke="${C.waterEdge}" stroke-width="7"/>` +
      units(red) +
      [290, 380, 470].map(y => arrow(`M320 ${y}L 600 ${y}`, "red", { dashed: true, width: 7 })).join("") +
      units(blue) +
      label("on the high ground", 1180, 330) +
      label("ends covered", 1230, 205) +
      label("by woods and water", 1230, 233) +
      label("a brook to cross", 690, 740) +
      label("reserve behind the ends", 1215, 590)
  );
};

S.refusedFlanks = () => {
  const blue = seat("refusedFlanks", "blue", 900, 380, 180);
  const red = seat("assault", "red", 380, 380, 0);
  return svg(
    "Refused flanks",
    units(red) +
      arrow(`M420 40 C 760 10, 1000 90, 1000 220`, "red", { dashed: true }) +
      arrow(`M420 720 C 760 750, 1000 670, 1000 540`, "red", { dashed: true }) +
      arrow(`M440 380 L 820 380`, "red", { width: 7 }) +
      units(blue) +
      label("ends bent back", 1190, 388) +
      label("who comes round meets a front, not a flank", 680, 145) +
      label("outnumbered and outridden", 1120, 630)
  );
};

S.crossing = () => {
  const blue = seat("crossing", "blue", 860, 380, 180);
  const red = [0, 1, 2, 3].map(i => ({ side: "red", kind: "line", x: 580 - i * 72, y: 380, angle: 0 }));
  const bank = seat("assault", "red", 360, 380, 0, p => p.role === "support");
  return svg(
    "Defence of a crossing",
    `<rect x="700" y="0" width="54" height="${H}" fill="${C.water}"/>` +
      `<rect x="700" y="335" width="54" height="90" fill="${C.ford}"/>` +
      units(red) +
      units(bank) +
      arrow(`M610 380 L 790 380`, "red", { width: 12 }) +
      fire(blue.filter(u => u.role === "line" || u.role === "support"), [{ x: 780, y: 380 }], "blue") +
      units(blue) +
      label("ford", 727, 315) +
      label("the line wraps round the far end of the ford:", 1050, 120) +
      label("who crosses is under fire from three sides", 1050, 150) +
      label("the river", 727, 730)
  );
};

S.wagenburg = () => {
  const blue = seat("wagenburg", "blue", 900, 380, 180);
  const ring = blue.filter(u => u.role === "line");
  // wagons round the ring, out past the blocks' fronts
  const pts = ring
    .map(u => Math.atan2(u.y - 380, u.x - 900))
    .sort((a, b) => a - b)
    .flatMap(a => [-0.32, 0.32].map(k => [900 + Math.cos(a + k) * 190, 380 + Math.sin(a + k) * 190]));
  const riders = [
    [560, 250, 20], [560, 380, 0], [560, 510, -20],
    [700, 120, 40], [700, 640, -40], [1180, 300, 160], [1180, 470, 200]
  ].map(([x, y, angle]) => ({ side: "red", kind: "rider", x, y, angle }));
  return svg(
    "Wagenburg",
    wagons(pts) +
      units(blue) +
      units(riders) +
      arrow(`M650 680 C 1000 800, 1250 600, 1220 380`, "red", { dashed: true }) +
      arrow(`M760 80 C 980 -10, 1200 120, 1230 280`, "red", { dashed: true }) +
      label("wagons all round", 900, 620) +
      label("riders cannot cross them or fight over them", 640, 740) +
      label("shooters and engines inside", 900, 140)
  );
};

const ambushField = (both, title) => {
  const roadY = 400;
  const column = Array.from({ length: 11 }, (_, i) => ({
    side: "red",
    kind: i < 2 ? "rider" : i > 8 ? "shooter" : "line",
    x: 1130 - i * 82,
    y: roadY,
    angle: 0
  }));
  const north = Array.from({ length: both ? 5 : 9 }, (_, i) => ({
    side: "blue",
    kind: i % 3 === 2 ? "shooter" : "line",
    x: (both ? 420 : 300) + i * (both ? 140 : 105),
    y: 285,
    angle: 90
  }));
  const south = both
    ? Array.from({ length: 5 }, (_, i) => ({ side: "blue", kind: i % 3 === 1 ? "shooter" : "line", x: 490 + i * 140, y: 515, angle: -90 }))
    : [];
  const fall = [...north.filter((_, i) => i % 2 === 0)].map(u => arrow(`M${u.x} ${u.y + 25} L ${u.x} ${roadY - 30}`, "blue", { width: 8 }));
  const rise = south.filter((_, i) => i % 2 === 0).map(u => arrow(`M${u.x} ${u.y - 25} L ${u.x} ${roadY + 30}`, "blue", { width: 8 }));
  return svg(
    title,
    woods([[170, 110], [700, 90], [1250, 120], [1290, 220], [1250, 318], [700, 322], [180, 318], [120, 220]], 5) +
      (both ? woods([[150, 482], [700, 478], [1260, 490], [1290, 600], [1200, 690], [700, 705], [170, 690], [110, 590]], 7) : "") +
      road(`M0 ${roadY} L ${W} ${roadY}`, 30) +
      units(column) +
      arrow(`M1180 ${roadY} L 1300 ${roadY}`, "red", { width: 7, dashed: true }) +
      units(north) +
      units(south) +
      fall.join("") +
      rise.join("") +
      label("column of march,", 150, roadY - 45) +
      label("caught on the road", 150, roadY + 60) +
      label("ambushers lie at the edge of the trees", 1110, 72) +
      (both ? "" : label("open ground: nobody to fear on this side", 700, 640, { color: C.muted }))
  );
};
S.ambuscadeBothSides = () => ambushField(true, "Ambuscade on both sides");
S.ambuscadeOneSide = () => ambushField(false, "Ambuscade on one side");

S.siegeLines = () => {
  const cx = 1000;
  const cy = 380;
  const red = seat("assault", "red", 560, 380, 0);
  const engines = [-60, 60].map(a => ({ side: "red", kind: "engine", x: 450, y: 380 + a, angle: 0 }));
  const garrison = [
    { kind: "shooter", x: 920, y: 330 }, { kind: "shooter", x: 915, y: 430 }, { kind: "line", x: 905, y: 380 },
    { kind: "line", x: 1095, y: 380 }, { kind: "rider", x: 1005, y: 380 }, { kind: "shooter", x: 1000, y: 300 }
  ].map(u => ({ ...u, side: "blue", angle: 180 }));
  return svg(
    "Siege lines and the garrison on the walls",
    road(`M0 380 L ${W} 380`, 22) +
      `<circle cx="${cx}" cy="${cy}" r="345" fill="none" stroke="${C.muted}" stroke-width="2.5" stroke-dasharray="10 9"/>` +
      burg(cx, cy, 120) +
      fire(engines, [{ x: 885, y: 345 }, { x: 885, y: 420 }], "red") +
      units(red.filter(u => u.role !== "reserve" && u.role !== "wing")) +
      units(engines) +
      units(garrison) +
      arrow(`M615 380 L 860 380`, "red", { dashed: true, width: 9 }) +
      label("out of bowshot", 790, 95) +
      label("engines batter the walls", 330, 505) +
      label("storm once strong enough", 740, 450) +
      label("shooters on the walls facing the foe,", 1000, 560) +
      label("foot by the gates", 1000, 590)
  );
};

S.ring = () => {
  const cx = 700;
  const cy = 380;
  const n = 12;
  const ring = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return { side: "red", kind: i % 4 === 1 ? "rider" : i % 4 === 3 ? "shooter" : "line", x: cx + Math.cos(a) * 330, y: cy + Math.sin(a) * 300, angle: (a * 180) / Math.PI + 180 };
  });
  const garrison = [[650, 360], [750, 400], [700, 330], [690, 430]].map(([x, y], i) => ({ side: "blue", kind: i % 2 ? "shooter" : "line", x, y, angle: 0 }));
  const watch = [0, 180].map(g => {
    const a = rad(g);
    return arrow(`M${cx + Math.cos(a) * 295} ${cy} L ${cx + Math.cos(a) * 150} ${cy}`, "red", { width: 6, dashed: true });
  });
  return svg(
    "Ring round the walls",
    road(`M0 380 L ${W} 380`, 22) +
      burg(cx, cy, 120) +
      units(garrison) +
      units(ring) +
      watch.join("") +
      label("all round, out of bowshot", 1210, 160) +
      label("the strongest by the gates", 1210, 560) +
      label("the burg is cut off and starves", 700, 40 + 20)
  );
};

S.landing = () => {
  const shore = [[0, 0], [470, 0], [500, 120], [470, 260], [510, 400], [480, 540], [505, 660], [490, H], [0, H]];
  const shallows = [[0, 0], [540, 0], [570, 120], [540, 260], [580, 400], [550, 540], [575, 660], [560, H], [0, H]];
  const red = seat("waves", "red", 360, 380, 0);
  const blue = seat("defensiveLine", "blue", 690, 380, 180);
  return svg(
    "Landing in waves",
    `<path d="${poly(shallows)}" fill="${C.shallow}"/>` +
      `<path d="${poly(shore)}" fill="${C.water}"/>` +
      units(red) +
      [300, 380, 460].map(y => arrow(`M400 ${y} L 610 ${y}`, "red")).join("") +
      units(blue) +
      label("first wave: foot", 300, 250) +
      label("second wave", 230, 590) +
      label("the shallows: waded at half strength", 560, 735) +
      label("defenders at the water's edge,", 1110, 370) +
      label("or inland, to meet them once ashore", 1110, 400, { color: C.muted })
  );
};

function poly(pts) {
  return `M${pts.map(p => p.map(f1).join(" ")).join("L")}Z`;
}

// the wiki's file names
const FILES = {
  assault: "assault",
  oblique: "oblique",
  envelopment: "envelopment",
  wedge: "wedge",
  harass: "harass",
  flyingWedge: "flying-wedge",
  defensiveLine: "defensive-line",
  refusedFlanks: "refused-flanks",
  crossing: "crossing",
  wagenburg: "wagenburg",
  ambuscadeBothSides: "ambuscade-both-sides",
  ambuscadeOneSide: "ambuscade-one-side",
  siegeLines: "siege-lines",
  ring: "ring",
  landing: "landing"
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: PNG_WIDTH, height: Math.round((PNG_WIDTH * H) / W) } });
fs.mkdirSync(OUT, { recursive: true });
for (const [scene, make] of Object.entries(S)) {
  if (ONLY && !ONLY.includes(scene) && !ONLY.includes(FILES[scene])) continue;
  const file = path.join(OUT, `Battle-tactic-${FILES[scene]}`);
  const drawing = make();
  if (args.includes("--svg")) fs.writeFileSync(`${file}.svg`, drawing);
  const sized = drawing.replace("<svg ", `<svg style="display:block;width:${PNG_WIDTH}px;height:auto" `);
  await page.setContent(`<body style="margin:0">${sized}</body>`);
  await page.screenshot({ path: `${file}.png`, fullPage: true });
  console.log(path.relative(ROOT, `${file}.png`));
}
await browser.close();
