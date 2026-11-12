// The side level: a general appraises the field, picks a tactic, draws the troops up and, each round, sets the phase
// and gives every battalion its order. Nothing here is rolled. See docs/domain/battles.md.

import { CHARGE, COUNTER, SHAKEN } from "./battalion";
import type { Battle, Block, Order, Plan } from "./battle";
import { enemyOf, getPhasePower, getStance, POSTURES, SIDES, type Side } from "./battle-rules";
import { FIELD, nodeAt, nodeCentre, terrainAt } from "./battlefield";
import { form, GAP, type Place, ROW_GAP, TACTICS, type TacticName } from "./formations";
import { getPace, getTurn, hasWalls, isStorming, type Point, ROUND_TICKS, shuns, turn } from "./movement";
import { spread, trace } from "./pathfinding";

const ORDER_ROUNDS = 10; // a phase ordered by hand stands that long
const STORM_ODDS = [4, 2.5, 1.8, 1.4]; // besiegers to besieged it takes to storm walls, by the breaches in them
const ASSAULT_ODDS = 1.25; // and a burg without walls
const SORTIE_ROUNDS = 8;
const MARGIN = 20; // troops keep that far from the edge of the field

/** What a general sees of a side */
interface View {
  ready: Block[]; // battalions in order
  power: number; // as the military screens count it
  fire: number; // what it shoots with
  grip: number; // what it fights hand to hand with
  riders: number; // power of its riders
  morale: number;
  losses: number; // share of the troops lost
  share: number; // of its battalions still in order
  x: number; // the middle of those in order
  y: number;
}

const strength = (block: Block): number => block.troops * block.unitPower * block.upkeep;
const sum = <T>(items: T[], value: (item: T) => number): number =>
  items.reduce((total, item) => total + value(item), 0);
const far = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);

function survey(battle: Battle, side: Side): View {
  const all = battle.blocks.filter(block => block.side === side);
  const ready = all.filter(block => block.status === "ready");
  const names = POSTURES[battle.type][side];
  const troops = sum(ready, block => block.troops) || 1;
  const { boost } = battle[side];
  return {
    ready,
    power: sum(ready, strength) * boost,
    fire: sum(ready, block => (block.range ? strength(block) * getPhasePower(names.apart, block.type) : 0)) * boost,
    grip: sum(ready, block => strength(block) * getPhasePower(names.close, block.type)) * boost,
    riders: sum(ready, block => (block.kind === "rider" ? strength(block) : 0)) * boost,
    morale: sum(ready, block => block.morale * block.troops) / troops,
    losses: battle[side].casualties,
    share: all.length ? ready.length / all.length : 0,
    x: sum(ready, block => block.x * block.troops) / troops,
    y: sum(ready, block => block.y * block.troops) / troops
  };
}

// Deployment

/** Draw both sides up: the defenders take their ground, the attackers form up in sight of them */
export function deploy(battle: Battle): void {
  const { type, field } = battle;
  for (const side of [...SIDES].reverse()) {
    const blocks = battle.blocks.filter(block => block.side === side);
    const attacking = side === "attackers";
    if (type === "ambush") attacking ? marchColumn(battle, blocks) : layAmbush(battle, blocks);
    else if (type === "siege" && field.held !== null && attacking) layLines(battle, blocks);
    else if (type === "siege" && hasWalls(battle)) manWalls(battle, blocks);
    else drawUp(battle, side, blocks);
  }
  for (const side of SIDES) battle[side].advancing = isAttacking(battle, side, battle[side].plan.tactic === "crossing");
  // an ambush is the longer a surprise the weaker the column
  const odds = getOdds(battle, "attackers");
  battle.attackers.plan.opening = battle.defenders.plan.opening = Math.min(Math.max(Math.round(4 / odds), 2), 8);
}

const BOLD = 0.75; // odds at which attackers still attack
const KEEN = 1.25; // and at which defenders come out to meet them

/** Who comes to whom in the open: attackers unless much the weaker, defenders when much the stronger and behind no river */
function isAttacking(battle: Battle, side: Side, crossing: boolean): boolean {
  if (!isOpenFight(battle)) return side === "attackers";
  if (battle[side].waits) return false; // its general thought it through and saw nothing to gain by it
  return side === "attackers" ? getOdds(battle, side) >= BOLD : getOdds(battle, side) >= KEEN && !crossing;
}

/** A battle of two lines: no walls, no ambush, no ships to land from */
const isOpenFight = (battle: Battle): boolean =>
  battle.type === "field" || battle.type === "naval" || battle.type === "air";

const getOdds = (battle: Battle, side: Side): number =>
  survey(battle, side).power / (survey(battle, enemyOf(side)).power || 1e-9);

function createPlan(tactic: TacticName, frame: Frame, fixed = false): Plan {
  return {
    tactic,
    strike: 1,
    ...frame,
    camp: [frame.x, frame.y],
    fixed,
    half: 0,
    halt: COUNTER * 2,
    since: 0,
    fired: null,
    byHand: null,
    opening: 0,
    gap: Infinity,
    idle: 0,
    losses: 0,
    bled: 0
  };
}

interface Frame {
  x: number;
  y: number;
  heading: number;
}

const toField = ({ x, y, heading }: Frame, across: number, along: number): Point => [
  x + Math.cos(heading) * along - Math.sin(heading) * across,
  y + Math.sin(heading) * along + Math.cos(heading) * across
];

const toFrame = ({ x, y, heading }: Frame, point: { x: number; y: number }): [across: number, along: number] => {
  const [dx, dy] = [point.x - x, point.y - y];
  return [-Math.sin(heading) * dx + Math.cos(heading) * dy, Math.cos(heading) * dx + Math.sin(heading) * dy];
};

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);
const onField = ([x, y]: Point): Point => [
  clamp(x, MARGIN, FIELD.width - MARGIN),
  clamp(y, MARGIN, FIELD.height - MARGIN)
];

/** Shift the formation so that every place of it is on the field, as far as it fits there */
function keepOnField(frame: Frame, places: { across: number; along: number }[]): void {
  if (!places.length) return;
  const points = places.map(({ across, along }) => toField(frame, across, along));
  for (const axis of [0, 1] as const) {
    const size = axis ? FIELD.height : FIELD.width;
    const low = Math.min(...points.map(point => point[axis]));
    const high = Math.max(...points.map(point => point[axis]));
    const shift = Math.max(MARGIN - low, 0) - Math.max(high - (size - MARGIN), 0);
    if (axis) frame.y += shift;
    else frame.x += shift;
  }
}

/** Give the battalions their places and stand them there */
function seat(battle: Battle, side: Side, plan: Plan, places: Place[]): void {
  if (!plan.fixed) keepOnField(plan, places);
  plan.camp = [plan.x, plan.y];
  plan.half = Math.max(...places.filter(place => place.rank === 0).map(place => Math.abs(place.across)), 20);
  // shooters stop where their shots reach the foe's front
  const shooters = places.filter(place => place.block.range && place.block.kind !== "engine");
  if (shooters.length)
    plan.halt = Math.max(
      Math.min(...shooters.map(({ block, along }) => block.range * 0.9 + along)) - places[0].block.depth,
      COUNTER * 2
    );
  battle[side].plan = plan;
  for (const place of places) {
    // riders do not stand among trees or in a bog: they close in to the line till the ground is open
    const bad = (): boolean => {
      const { wood, marsh } = terrainAt(battle.field, ...onField(toField(plan, place.across, place.along)));
      return wood || marsh;
    };
    for (let i = 0; i < 12 && place.block.kind === "rider" && Math.abs(place.across) > 20 && bad(); i++)
      place.across -= Math.sign(place.across) * 20;
    const { block, role, mission, rank, across, along } = place;
    const [x, y] = onField(toField(plan, across, along));
    block.order = { role, mission, rank, across, along, x, y, facing: plan.heading, target: null, sent: false };
    [block.x, block.y, block.facing] = [x, y, plan.heading];
  }
}

/** Distance from the middle of the field towards its edge, with a margin */
export function reach(angle: number): number {
  return 1 / Math.hypot(Math.cos(angle) / (FIELD.width / 2 - 60), Math.sin(angle) / (FIELD.height / 2 - 50));
}

/** About where a side forms up, before its ground is chosen: the attackers where they came from, the defenders at the battle point */
export function getBase(battle: Battle, side: Side): Point {
  const { field, axis } = battle;
  if (side === "defenders" && field.held !== null) return [field.burgs[field.held].x, field.burgs[field.held].y];
  const deep = reach(axis) * (side === "attackers" ? -0.8 : 0.35);
  return [FIELD.width / 2 + Math.cos(axis) * deep, FIELD.height / 2 + Math.sin(axis) * deep];
}

/** The room a line has across the attack */
const getRoom = (battle: Battle): number => reach(battle.axis + Math.PI / 2) * 1.7;

/** The usual way: a tactic by the odds, a formation by the tactic, on the best ground in reach */
function drawUp(battle: Battle, side: Side, blocks: Block[]): void {
  const forward = side === "attackers" ? battle.axis : battle.axis + Math.PI;
  const crossing = side === "defenders" ? findCrossing(battle) : null;
  const [tactic, strike] = chooseTactic(battle, side, blocks, crossing !== null);
  const places = form(blocks, TACTICS[tactic], strike, getRoom(battle));
  // defenders ready for a landing meet it at the shore, unless their general would rather fight inland
  const meets = battle.type === "landing" && side === "defenders" && isReady(battle) && !battle[side].waits;
  const shore = meets ? findShore(battle) : null;
  const frame = crossing ?? shore ?? findGround(battle, side, places, forward);
  const plan = createPlan(tactic, frame);
  plan.strike = strike;
  seat(battle, side, plan, places);
}

/** Score every tactic the side may use against what it knows of both armies, the best first, and name the wing to mass on */
function rateTactics(
  battle: Battle,
  side: Side,
  blocks: Block[],
  crossing: boolean
): [scores: [TacticName, number][], strike: number] {
  const own = survey(battle, side);
  const foe = survey(battle, enemyOf(side));
  const odds = own.power / (foe.power || 1e-9);
  const count = (kind: Block["kind"]): number => blocks.filter(block => block.kind === kind).length;
  const [line, shooters, riders] = [count("line"), count("shooter"), count("rider")];
  const riderOdds = foe.riders ? own.riders / foe.riders : own.riders ? 3 : 1;
  const fireShare = own.fire / (own.fire + foe.fire || 1);
  const gripShare = own.grip / (own.grip + foe.grip || 1);
  const foeBlocks = battle.blocks.filter(block => block.side !== side);
  const width = (all: Block[]): number => sum(all, block => (block.kind === "line" ? block.width + GAP : 0));
  const weight = (all: Block[]): number => sum(all, block => (block.kind === "line" ? strength(block) : 0));
  const heavier = weight(blocks) / (width(blocks) || 1) > (weight(foeBlocks) / (width(foeBlocks) || 1)) * 1.15;

  // the wing to mass against: the foe's weaker one when it is in sight, else the right
  const frame = {
    x: FIELD.width / 2,
    y: FIELD.height / 2,
    heading: side === "attackers" ? battle.axis : battle.axis + Math.PI
  };
  const wing = (sign: number): number =>
    sum(foe.ready, block => (block.x && toFrame(frame, block)[0] * sign > 30 ? strength(block) : 0));
  const strike = wing(-1) < wing(1) ? -1 : 1;

  if (battle.type === "landing" && side === "attackers") return [[["waves", 1]], strike];
  const attacking = isAttacking(battle, side, crossing);
  const scores: [TacticName, number][] = attacking
    ? [
        ["assault", 1 + (odds - 1) * 0.5],
        ["oblique", line >= 4 ? 1 + (1 - odds) * 0.8 + Math.abs(wing(1) - wing(-1)) / (foe.power || 1) : 0],
        ["envelopment", riders >= 2 ? 0.6 + Math.min(riderOdds - 1, 1.5) * 0.5 + (odds - 1) * 0.3 : 0],
        ["wedge", line >= 5 ? 0.7 + (width(foeBlocks) / (width(blocks) || 1) - 1) * 0.8 + (heavier ? 0.25 : 0) : 0],
        ["harass", shooters >= Math.max(line, 2) ? 0.5 + (fireShare - gripShare) * 3 : 0]
      ]
    : [
        ["stand", 1],
        ["crescent", line >= 3 ? 0.8 + (1 / odds - 1) * 0.6 + (riderOdds < 0.67 ? 0.3 : 0) : 0],
        ["crossing", crossing ? 3 : 0]
      ];
  return [scores.filter(([, score]) => score > 0).sort((a, b) => b[1] - a[1]), strike];
}

/** The tactic of a side: the one its general settled on thinking the battle through, else the best by the scores */
function chooseTactic(battle: Battle, side: Side, blocks: Block[], crossing: boolean): [TacticName, number] {
  const [scores, strike] = rateTactics(battle, side, blocks, crossing);
  const settled = scores.find(([name]) => name === battle[side].tactic);
  return [(settled ?? scores[0])[0], strike];
}

/** What a general may settle on before a battle: a tactic, to wait for the foe rather than go to meet him, to storm at once */
export interface Option {
  tactic: TacticName | null;
  waits: boolean;
  storms: boolean;
}

const option = (tactic: TacticName | null, waits = false, storms = false): Option => ({ tactic, waits, storms });

/**
 * What a general plays through in his mind before the battle, the likeliest first.
 * In the open: every tactic open to him, and for an attacker who is the weaker to stand and wait instead; where water or
 * walls make the going slow to reckon only such an attacker does it, with his likeliest tactic.
 * In an ambush: to lie on both sides of the road or on one. The column has no plan: it is caught.
 * In a landing: for ready defenders, to meet it at the shore or to wait inland.
 * In a siege: for besiegers a little short of the odds the walls ask for, to storm at once all the same or to keep to the rule.
 */
export function getOptions(battle: Battle, side: Side): Option[] {
  const { type, field } = battle;
  if (type === "ambush") return side === "defenders" ? [option("ambuscade"), option("waylay")] : [];
  if (type === "landing")
    return side === "defenders" && isReady(battle) && findShore(battle) ? [option(null), option(null, true)] : [];
  if (type === "siege") {
    // a storm of many battalions is too slow to play through in the time there is
    if (side === "defenders" || field.held === null || battle.blocks.length > 28) return [];
    const short = getOdds(battle, side) / getStormOdds(battle);
    return short >= 2 / 3 && short < 1 ? [option(null), option(null, false, true)] : [];
  }

  const rough = field.water.some(Boolean) || field.walls.length > 0;
  if (rough && side === "defenders") return [];
  const blocks = battle.blocks.filter(block => block.side === side);
  const names = rateTactics(battle, side, blocks, battle[side].plan.tactic === "crossing")[0].map(([name]) => name);
  const options = (rough ? names.slice(0, 1) : names).map(name => option(name));
  // an attacker who is the weaker may think better of it; one who is not came to fight
  const free = battle[side].plan.byHand === null; // not ordered what to do by hand
  const cautious = side === "attackers" && free && isAttacking(battle, side, false) && getOdds(battle, side) < 1;
  if (cautious) options.push(option(null, true));
  return options.length < 2 ? [] : options;
}

/** Where a side forms up: the attackers where they came from, the defenders on the best ground about the battle point */
function findGround(battle: Battle, side: Side, places: Place[], forward: number): Frame {
  const { axis, field } = battle;
  const [along, width] = [reach(axis), reach(axis + Math.PI / 2)];
  const half = Math.max(...places.filter(place => place.rank === 0).map(place => Math.abs(place.across)), 20);
  const depth = -Math.min(...places.map(place => place.along), 0);
  const defending = side === "defenders";
  if (defending && field.held !== null) return { ...field.burgs[field.held], heading: forward };

  const at = (deep: number, shift: number): Frame => ({
    x: FIELD.width / 2 + Math.cos(axis) * along * deep + Math.cos(axis + Math.PI / 2) * width * shift,
    y: FIELD.height / 2 + Math.sin(axis) * along * deep + Math.sin(axis + Math.PI / 2) * width * shift,
    heading: forward
  });
  // a line is worth the ground under it, what covers its ends and what the foe has to cross to come at it
  const score = (frame: Frame, deep: number, shift: number): number => {
    let value = -Math.abs(shift) / 4 - Math.abs(deep - 0.35) / 2;
    for (const share of [-1, -0.5, 0, 0.5, 1]) {
      const terrain = terrainAt(field, ...toField(frame, share * half, 0));
      if (terrain.water && !field.open) value -= 2;
      if (terrain.wood || terrain.marsh) value -= 0.2;
      if (!defending) continue;
      value += terrain.height + (terrain.town ? 0.2 : 0);
      for (const ahead of [70, 130]) {
        const before = terrainAt(field, ...toField(frame, share * half, ahead));
        if (before.water || before.marsh) value += 0.15;
        value += (terrain.height - before.height) * 0.3;
      }
    }
    if (defending) {
      for (const sign of [-1, 1]) {
        const [x, y] = toField(frame, sign * (half + 50), 0);
        const beyond = terrainAt(field, x, y);
        const off = x < MARGIN || y < MARGIN || x > FIELD.width - MARGIN || y > FIELD.height - MARGIN;
        if (off || beyond.water || beyond.wood || beyond.town) value += 0.3;
      }
    }
    return value;
  };

  let best: Frame | null = null;
  let most = -Infinity;
  for (const deep of defending ? [0.35, 0.2, 0.5] : [-0.8]) {
    for (const shift of [0, -0.2, 0.2, -0.4, 0.4]) {
      const frame = at(deep, shift);
      const value = score(frame, deep, shift);
      if (value > most) [best, most] = [frame, value];
    }
  }
  // the last line stands on the field too
  const frame = best!;
  const inside = ([x, y]: Point): boolean =>
    x >= MARGIN + 10 && y >= MARGIN + 10 && x <= FIELD.width - MARGIN - 10 && y <= FIELD.height - MARGIN - 10;
  for (let i = 0; i < 30 && !inside(toField(frame, 0, -depth)); i++) [frame.x, frame.y] = toField(frame, 0, 10);
  return frame;
}

/**
 * A river the attackers have to cross on their way: the defenders stand round the far end of the ford or the bridge
 * they will come by, when it is on their half of the field
 */
function findCrossing(battle: Battle): Frame | null {
  const { field, axis } = battle;
  if (field.open || battle.type !== "field" || !field.water.some(Boolean)) return null;
  const along = reach(axis);
  const point = (deep: number): Point => [
    FIELD.width / 2 + Math.cos(axis) * along * deep,
    FIELD.height / 2 + Math.sin(axis) * along * deep
  ];
  const passable = (node: number): boolean => !field.water[node] || field.ford[node] === 1;
  const costs = Float32Array.from(field.water, (_, node) => (passable(node) ? (field.water[node] ? 3 : 1) : Infinity));
  const way = trace(spread(FIELD.cols, FIELD.rows, [nodeAt(...point(-0.8))], costs), nodeAt(...point(0.35)));
  const wet = (node: number): boolean => field.water[node] > 0 || field.deck[node] === 1;
  const last = way.findLastIndex(wet);
  if (last < way.length * 0.4 || last >= way.length - 2) return null;
  const [x, y] = nodeCentre(way[last]);
  const [bx, by] = nodeCentre(way[Math.min(last + 8, way.length - 1)]); // the way on from the crossing
  const heading = Math.atan2(y - by, x - bx);
  return { x: x - Math.cos(heading) * 75, y: y - Math.sin(heading) * 75, heading };
}

/** The defenders of a landing are ready for it when they are no less steady than the attackers at the outset */
const isReady = (battle: Battle): boolean => battle.defenders.morale >= battle.attackers.morale;

/** Defenders ready for a landing stand a bowshot from where the attackers come out of the water */
function findShore(battle: Battle): Frame | null {
  const { axis, field } = battle;
  const along = reach(axis);
  const at = (deep: number): Point => [
    FIELD.width / 2 + Math.cos(axis) * deep,
    FIELD.height / 2 + Math.sin(axis) * deep
  ];
  let shore: number | null = null;
  for (let deep = -along * 0.8; deep < along * 0.35 - 110; deep += FIELD.cell)
    if (terrainAt(field, ...at(deep)).water === 1) shore = deep;
  if (shore === null) return null;
  const [x, y] = at(shore + 110);
  return { x, y, heading: axis + Math.PI };
}

/** An ambush: the attackers are caught on the march, in a column along the road */
function marchColumn(battle: Battle, blocks: Block[]): void {
  const order = ["rider", "line", "shooter", "engine"];
  const column = [...blocks].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || a.id - b.id);
  const pitch = blocks[0]?.depth + 26;
  const files = Math.max(Math.ceil((column.length * pitch) / (reach(battle.axis) * 1.8)), 1);
  const frame = { x: FIELD.width / 2, y: FIELD.height / 2, heading: battle.axis };
  const places = column.map((block, i): Place => {
    const role = ROLES[block.kind];
    const row = Math.floor(i / files);
    const across = ((i % files) - (files - 1) / 2) * (block.width + GAP);
    const along = ((Math.ceil(column.length / files) - 1) / 2 - row) * pitch;
    return { block, role, mission: role === "wing" ? "guard" : role, rank: 0, across, along };
  });
  seat(battle, "attackers", createPlan("column", frame, true), places);
}

/**
 * The ambushers lie by the road and fall on the column at once: on both sides of it, or all on one side,
 * the better covered, when their general thinks that ends better
 */
function layAmbush(battle: Battle, blocks: Block[]): void {
  const sorted = [...blocks].sort((a, b) => a.kind.localeCompare(b.kind) || a.id - b.id);
  const at = (side: number): Frame => {
    const out = battle.axis + (side ? Math.PI / 2 : -Math.PI / 2);
    const distance = Math.min(reach(out) * 0.75, 170);
    return {
      x: FIELD.width / 2 + Math.cos(out) * distance,
      y: FIELD.height / 2 + Math.sin(out) * distance,
      heading: out + Math.PI
    };
  };
  // trees and high ground hide those who lie in wait
  const cover = (frame: Frame): number =>
    sum([-150, -75, 0, 75, 150], across => {
      const { wood, height } = terrainAt(battle.field, ...toField(frame, across, 0));
      return +wood + height;
    });
  const tactic: TacticName = battle.defenders.tactic === "waylay" ? "waylay" : "ambuscade";
  const wings =
    tactic === "waylay"
      ? [{ troops: sorted, frame: cover(at(1)) > cover(at(0)) ? at(1) : at(0) }]
      : [0, 1].map(side => ({ troops: sorted.filter((_, i) => i % 2 === side), frame: at(side) }));
  for (const { troops, frame } of wings) {
    const places = form(troops, TACTICS[tactic], 1, reach(battle.axis) * 1.7);
    for (const place of places) if (place.role !== "support" && place.role !== "battery") place.mission = "hunt";
    seat(battle, "defenders", createPlan(tactic, frame, true), places);
  }
  battle.defenders.plan.half = 0;
}

/** The besiegers stand out of bowshot of the walls, their engines before them in range */
function layLines(battle: Battle, blocks: Block[]): void {
  const burg = battle.field.burgs[battle.field.held!];
  const bowshot = Math.max(...battle.blocks.map(block => (block.side === "defenders" ? block.range : 0)), 150);
  const engines = blocks.filter(block => block.kind === "engine");
  const places = form(
    blocks.filter(block => block.kind !== "engine"),
    TACTICS.lines,
    1,
    getRoom(battle)
  );
  if (engines.length) {
    for (const place of places) place.along -= ROW_GAP;
    let offset = -sum(engines, block => block.width + GAP) / 2;
    for (const block of engines) {
      places.push({ block, role: "battery", mission: "battery", rank: 0, across: offset + block.width / 2, along: 0 });
      offset += block.width + GAP;
    }
  }
  const away = battle.axis + Math.PI;
  const depth = -Math.min(...places.map(place => place.along), 0);
  const inside = (distance: number): boolean => {
    const [x, y] = [burg.x + Math.cos(away) * distance, burg.y + Math.sin(away) * distance];
    return x >= MARGIN && y >= MARGIN && x <= FIELD.width - MARGIN && y <= FIELD.height - MARGIN;
  };
  let distance = burg.radius + Math.min(bowshot + 10, 250); // the engines reach the middle of the burg from there
  while (distance > burg.radius + 60 && !inside(distance + depth)) distance -= 10;
  const frame = { x: burg.x + Math.cos(away) * distance, y: burg.y + Math.sin(away) * distance, heading: battle.axis };
  seat(battle, "attackers", createPlan("lines", frame), places);
}

/** The besieged man their walls: shooters where the foe stands, line troops by the gates, the rest in the middle */
function manWalls(battle: Battle, blocks: Block[]): void {
  const { field } = battle;
  const held = field.held!;
  const burg = field.burgs[held];
  let nodes = field.walled.map((_, node) => node).filter(node => field.walled[node] === held + 1);
  if (nodes.some(node => !field.rampart[node])) nodes = nodes.filter(node => !field.rampart[node]);
  const frame = { x: burg.x, y: burg.y, heading: battle.axis + Math.PI };
  const plan = createPlan("garrison", frame, true);
  battle.defenders.plan = plan;
  if (!nodes.length) return;

  const taken: Point[] = [];
  /** The free spot that scores best, apart from those taken */
  const take = (score: (point: Point) => number): Point => {
    let best = nodeCentre(nodes[0]);
    let most = -Infinity;
    for (const node of nodes) {
      const point = nodeCentre(node);
      const crowd = sum(taken, other => Math.max(30 - Math.hypot(other[0] - point[0], other[1] - point[1]), 0));
      const value = score(point) - crowd * 4;
      if (value > most) [best, most] = [point, value];
    }
    taken.push(best);
    return best;
  };
  const gates = field.walls.filter(wall => wall.burg === held && wall.gate).map(wall => wall.a);
  const toFoe = ([x, y]: Point): number =>
    (x - burg.x) * Math.cos(frame.heading) + (y - burg.y) * Math.sin(frame.heading);
  const toGate = ([x, y]: Point): number =>
    gates.length ? -Math.min(...gates.map(gate => Math.hypot(gate[0] - x, gate[1] - y))) : 0;
  const toMiddle = ([x, y]: Point): number => -Math.hypot(x - burg.x, y - burg.y);
  const spots: Record<Block["kind"], (point: Point) => number> = {
    shooter: toFoe,
    line: point => toGate(point) + toFoe(point) * 0.3,
    engine: point => toMiddle(point) + toFoe(point) * 0.5,
    rider: toMiddle
  };
  for (const block of blocks) {
    const [x, y] = take(spots[block.kind]);
    const role = block.kind === "rider" ? "reserve" : ROLES[block.kind];
    const mission = role === "wing" ? "reserve" : role;
    const [across, along] = toFrame(frame, { x, y });
    block.order = { role, mission, rank: 0, across, along, x, y, facing: frame.heading, target: null, sent: false };
    [block.x, block.y, block.facing] = [x, y, frame.heading];
  }
}

const ROLES: Record<Block["kind"], Order["role"]> = {
  line: "line",
  shooter: "support",
  rider: "wing",
  engine: "battery"
};

/** Nobody is drawn up in water it keeps out of: such a block steps to the nearest ground, rather back than forward */
export function settle(battle: Battle): void {
  for (const block of battle.blocks) {
    if (!shuns(battle, block, block.x, block.y)) continue;
    const forward = block.side === "attackers" ? battle.axis : battle.axis + Math.PI;
    const node = nodeAt(block.x, block.y);
    const col = node % FIELD.cols;
    const row = (node - col) / FIELD.cols;
    let best: Point | null = null;
    let least = Infinity;
    for (let y = Math.max(row - 8, 0); y <= Math.min(row + 8, FIELD.rows - 1); y++) {
      for (let x = Math.max(col - 8, 0); x <= Math.min(col + 8, FIELD.cols - 1); x++) {
        const [nx, ny] = nodeCentre(y * FIELD.cols + x);
        if (shuns(battle, block, nx, ny)) continue;
        const ahead = (nx - block.x) * Math.cos(forward) + (ny - block.y) * Math.sin(forward) > 0;
        const score = Math.hypot(nx - block.x, ny - block.y) + (ahead ? 20 : 0);
        if (score < least) [best, least] = [[nx, ny], score];
      }
    }
    if (best) [block.x, block.y] = best;
    takePlace(battle, block);
  }
}

/** A battalion moved by hand, or off the ground it could not stand on, keeps the place it is in now */
export function takePlace(battle: Battle, block: Block): void {
  const plan = battle[block.side].plan;
  [block.order.across, block.order.along] = toFrame(plan, block);
  [block.order.x, block.order.y] = [block.x, block.y];
}

/** Latecomers form up behind their side and wait there */
export function enlist(battle: Battle, side: Side, blocks: Block[]): void {
  const plan = battle[side].plan;
  const friends = battle.blocks.filter(
    block => block.side === side && block.status === "ready" && !blocks.includes(block)
  );
  const rear = Math.min(...friends.map(block => toFrame(plan, block)[1]), 0) - ROW_GAP;
  const places = form(blocks, TACTICS.assault, 1, getRoom(battle));
  for (const { block, role, rank, across, along } of places) {
    const [x, y] = onField(toField(plan, across, rear + along));
    const mission = role === "line" ? "reserve" : role === "wing" ? "guard" : role;
    block.order = {
      role: role === "line" ? "reserve" : role,
      mission,
      rank: rank + 1,
      across,
      along: rear + along,
      x,
      y,
      facing: plan.heading,
      target: null,
      sent: false
    };
    [block.x, block.y, block.facing] = [x, y, plan.heading];
  }
}

// Command

/** A round begins: both generals read the field, set their phase and give their orders */
export function command(battle: Battle): void {
  const views = { attackers: survey(battle, "attackers"), defenders: survey(battle, "defenders") };
  const gap = getGap(views.attackers.ready, views.defenders.ready);
  const phases = SIDES.map(side => choosePhase(battle, side, views[side], views[enemyOf(side)], gap));
  SIDES.forEach((side, i) => {
    if (phases[i] !== battle[side].phase) battle[side].plan.since = battle.round;
  });
  if (phases[0] !== battle.attackers.phase || phases[1] !== battle.defenders.phase)
    battle.log.push({ tick: battle.tick, event: "phases", params: { attackers: phases[0], defenders: phases[1] } });
  [battle.attackers.phase, battle.defenders.phase] = phases;
  for (const side of SIDES) direct(battle, side, views[side], views[enemyOf(side)], gap);
}

/** A phase ordered by hand: the general keeps to it for a while */
export function obey(battle: Battle, side: Side): void {
  const data = battle[side];
  data.plan.byHand = battle.round;
  data.plan.since = battle.round;
  // ordered to close with the foe, a general who meant to wait attacks
  const { close, chase } = POSTURES[battle.type][side];
  if (isOpenFight(battle) && (data.phase === close || data.phase === chase))
    Object.assign(data, { advancing: true, waits: false });
  if (battle.tick) direct(battle, side, survey(battle, side), survey(battle, enemyOf(side)), battle[side].plan.gap);
}

/** The space between the nearest troops in order of the two sides, engines apart */
function getGap(own: Block[], foes: Block[]): number {
  let gap = Infinity;
  for (const block of own) {
    if (block.kind === "engine") continue;
    for (const foe of foes) if (foe.kind !== "engine") gap = Math.min(gap, far(block, foe) - block.depth);
  }
  return gap;
}

function choosePhase(battle: Battle, side: Side, own: View, foe: View, gap: number): string {
  const { phase, plan } = battle[side];
  const names = POSTURES[battle.type][side];
  if (plan.byHand !== null && battle.round - plan.byHand < ORDER_ROUNDS) return phase;
  if (battle.type === "siege" && battle.field.held !== null)
    return side === "attackers" ? besiege(battle, own, foe) : withstand(battle, own, foe);
  if (phase === names.run) return phase; // a side that turned to run does not come back

  const fought = battle.engaged === null ? -1 : battle.round - battle.engaged;
  if (battle.type === "ambush" && fought < plan.opening && !isLost(own, foe)) return names.apart; // surprise and shock
  if (battle.type === "landing") {
    const landing = battle.attackers.phase === "landing";
    if (side === "attackers" && landing && fought < 3 && !isLost(own, foe)) return phase; // the fight for the shore
    if (side === "defenders") {
      if (battle.attackers.phase === "flee") {
        const ashore = battle.blocks.some(
          block => block.side === "attackers" && isOnField(block) && !terrainAt(battle.field, block.x, block.y).water
        );
        return ashore ? "pursue" : "waiting";
      }
      if (landing && !isLost(own, foe)) return battle.round ? phase : isReady(battle) ? "defense" : "shock";
    }
  }
  return engage(battle, side, own, foe, gap);
}

const isOnField = (block: Block): boolean => block.status === "ready" || block.status === "routed";

/** The day is lost: too few are left in order to go on; behind a river a side holds out at half the odds */
function isLost(own: View, foe: View, grit = 1): boolean {
  if (!own.ready.length) return true;
  const odds = (own.power / (foe.power || 1e-9)) * grit;
  const bled = own.losses >= 1 / 2 ? 1 : own.losses >= 1 / 4 ? 2 / 3 : 1 / 3; // the more is lost the better odds it takes to go on
  return odds < bled || own.morale < 25;
}

/** Two armies in the open: stand off and shoot, close, chase or run */
function engage(battle: Battle, side: Side, own: View, foe: View, gap: number): string {
  const data = battle[side];
  const { phase, plan } = data;
  const names = POSTURES[battle.type][side];
  if (isLost(own, foe, plan.tactic === "crossing" && !data.advancing ? 2 : 1)) return names.run;
  if (battle[enemyOf(side)].phase === POSTURES[battle.type][enemyOf(side)].run || foe.share <= 0.25) return names.chase;
  if (phase === names.close || phase === names.chase) return names.close;
  if (!isOpenFight(battle)) return names.close;

  // standing off
  const atGrips = own.ready.some(block => block.action === "fight");
  if (atGrips || gap <= COUNTER * 1.5) return names.close; // the foe is upon us
  if (!data.advancing || battle.engaged === null) return phase; // a defender waits; an attacker is still coming up
  if (!own.fire) return names.close;

  // a general shoots while he is better at it than at grips, and no longer than it pays
  const fireShare = own.fire / (own.fire + foe.fire);
  const gripShare = own.grip / (own.grip + foe.grip);
  if (gripShare > fireShare + 0.05) return names.close;
  if (own.ready.some(block => block.action === "shoot")) plan.fired ??= battle.round;
  if (own.grip <= own.fire) return phase; // made for shooting: it closes to its range and no nearer
  if (plan.fired === null) return battle.round - battle.engaged >= 4 ? names.close : phase; // out of his range
  const patience = clamp(Math.round(4 + 16 * (fireShare - 0.5)), 4, 12);
  return battle.round - plan.fired >= patience ? names.close : phase;
}

// A siege

/** Whether the besiegers are strong enough to storm the burg, with its walls as they stand */
function getStormOdds(battle: Battle): number {
  const breaches = battle.field.breaches.filter(breach => breach.burg === battle.field.held).length;
  return hasWalls(battle) ? STORM_ODDS[Math.min(breaches, STORM_ODDS.length - 1)] : ASSAULT_ODDS;
}

/** Besiegers in order on the walls of the burg, within them or at grips with those within */
function isOnWalls(battle: Battle): boolean {
  const { held } = battle.field;
  const within = (block: Block): boolean => {
    const { walled, rampart } = terrainAt(battle.field, block.x, block.y);
    return walled === held! + 1 || rampart > 0;
  };
  return battle.blocks.some(block => {
    if (block.side !== "attackers" || block.status !== "ready") return false;
    return within(block) || (block.action === "fight" && within(battle.blocks[block.target!]));
  });
}

function besiege(battle: Battle, own: View, foe: View): string {
  const { phase } = battle.attackers;
  if (phase === "retreat" || phase === "looting") return phase;
  if (battle.defenders.phase === "surrendering" || !foe.ready.length) return "looting";
  const odds = own.power / (foe.power || 1e-9);
  if (isLost(own, foe) && !isOnWalls(battle)) return "retreat";
  // a garrison out in force that is half as strong again: the siege is raised
  if (battle.defenders.phase === "sortie" && isStrongGarrison(foe, own)) return "retreat";

  // a burg is stormed at the odds its walls ask for; a storm that lost them by a third is called off
  const need = getStormOdds(battle);
  const bold = battle.attackers.storms && !battle.round; // its general thought it through and storms at once
  const stormers = own.ready.some(block => block.kind === "line" || block.kind === "rider"); // engines climb no walls
  const storm = stormers && (phase === "storming" ? odds >= (need * 2) / 3 || isOnWalls(battle) : odds >= need || bold);
  if (storm) {
    if (phase !== "storming") {
      battle.storm = battle.round;
      battle.lastLoss = battle.tick; // the lull is over
    }
    return "storming";
  }
  battle.storm = null;
  return own.ready.some(block => block.type === "machinery") ? "bombardment" : "blockade";
}

function withstand(battle: Battle, own: View, foe: View): string {
  const { phase, plan } = battle.defenders;
  const besiegers = battle.attackers.phase;
  if (phase === "surrendering") return phase;
  if (besiegers === "retreat") return "pursue";
  // the burg is given up when the garrison's heart is gone, or half of it with the besiegers on the walls and the stronger
  const fallen = own.losses >= 1 / 2 && own.power < foe.power && isOnWalls(battle);
  if (!own.ready.length || own.morale < 15 || fallen) return "surrendering";
  if (besiegers === "storming" || besiegers === "looting") return "defense";

  // a sortie at engines left with fewer guards than the party: it comes home when they are done for, or it is.
  // A garrison half as strong again as the besiegers comes out to drive them off, and stays out while it is the stronger.
  const party = own.ready.filter(block => block.order.role === "reserve" || block.order.sent);
  const prey = getSortiePrey(battle, own, foe);
  const strong = isStrongGarrison(own, foe);
  if (phase === "sortie") {
    const spent = sum(party, block => block.morale * block.troops) / (sum(party, block => block.troops) || 1) < 40;
    if (strong ? !spent && own.power >= foe.power : prey && !spent && battle.round - plan.since < SORTIE_ROUNDS)
      return phase;
  } else if ((prey || strong) && own.morale >= 50 && battle.round - plan.since >= 3) return "sortie";
  return own.ready.some(block => block.type === "machinery") ? "bombardment" : "sheltering";
}

const isStrongGarrison = (own: View, foe: View): boolean => own.power >= foe.power * 1.5;

/** The besiegers' engine a sortie may go for: the nearest one whose guards the party outweighs */
function getSortiePrey(battle: Battle, own: View, foe: View): Block | null {
  const burg = battle.field.burgs[battle.field.held!];
  const party = own.ready.filter(block => block.kind === "rider" || block.kind === "line");
  const might = sum(party, strength) / 2 + sum(party, block => (block.kind === "rider" ? strength(block) / 2 : 0));
  const engines = foe.ready.filter(block => block.kind === "engine").sort((a, b) => far(a, burg) - far(b, burg));
  for (const engine of engines) {
    // the engines themselves are a quarter of their worth hand to hand
    const guards = sum(foe.ready, block =>
      far(block, engine) < CHARGE ? strength(block) * (block.kind === "engine" ? 0.25 : 1) : 0
    );
    if (might > guards * 1.5 && far(engine, burg) < burg.radius + 300) return engine;
  }
  return null;
}

// Orders

/** Move the formation and tell every battalion in order what to do this round */
function direct(battle: Battle, side: Side, own: View, foe: View, gap: number): void {
  const data = battle[side];
  const { plan, phase } = data;
  const names = POSTURES[battle.type][side];
  const tactic = TACTICS[plan.tactic];
  const siege = battle.type === "siege" && battle.field.held !== null;
  const stance = getStance(phase);
  const odds = own.power / (foe.power || 1e-9);

  // who comes to whom: a defender goes over when the attack is spent or does not come at all
  if (data.advancing && gap < plan.gap - 5) battle.lastLoss = battle.tick; // no lull while a side comes on
  plan.idle = gap < plan.gap - 5 || gap < CHARGE ? 0 : plan.idle + 1;
  plan.gap = gap;
  plan.bled = own.losses > plan.losses && !own.ready.some(block => block.action === "fight") ? plan.bled + 1 : 0;
  plan.losses = own.losses;
  if (siege) data.advancing = side === "attackers" || phase === "sortie" || phase === "pursue";
  else if (phase === names.chase) data.advancing = true;
  else if (!data.advancing && isOpenFight(battle) && phase !== names.run && plan.tactic !== "crossing") {
    // who holds a crossing stays behind it till the foe runs
    const spent = phase === names.close && odds >= 1.5;
    // the foe does not come: a side no weaker goes for it, unless that is a march into fire it cannot answer
    const waited = plan.idle >= 6 && odds >= 1 && battle.round >= 6 && !data.waits && own.fire >= foe.fire / 2;
    // shot at with little to answer with, and better at grips: it will not stand there and take it
    const outshot = plan.bled >= 2 && own.fire < foe.fire / 2 && own.grip / (own.grip + foe.grip) > 1 / 3;
    if (spent || waited || outshot) {
      data.advancing = true;
      battle.log.push({ tick: battle.tick, event: "advance", side });
    }
  }

  if (siege && side === "attackers" && !isStorming(battle))
    [plan.x, plan.y] = plan.camp; // back to the lines
  else if (!plan.fixed) moveFrame(battle, side, own, foe, gap);
  const frameFoes = foe.ready.map(block => ({ block, at: toFrame(plan, block) }));

  for (const block of own.ready) {
    const order = block.order;
    if (stance === "flee") {
      order.mission = "withdraw";
      continue;
    }
    if (order.sent) {
      const target = order.target === null ? null : battle.blocks[order.target];
      const gone = target ? target.status !== "ready" : phase !== names.close;
      if (plan.tactic === "garrison" ? phase === "sortie" : !gone) continue;
      [order.sent, order.target] = [false, null]; // back to its place
    }
    // engines of a siege stay where they were set up
    if (!plan.fixed && !(siege && order.role === "battery")) {
      [order.x, order.y] = onField(toField(plan, order.across, order.along));
      order.facing = plan.heading;
    }
    order.mission = getMission(battle, side, block, own, frameFoes);
    if (siege && side === "attackers" && phase === "storming" && order.mission === "hunt") {
      const entry = getEntry(battle, block);
      if (entry) [order.mission, order.x, order.y] = ["flank", ...entry];
    } else if (order.mission === "flank") {
      // round the end of the foe's line on its own wing, and a little beyond
      const sign = Math.sign(order.across) || plan.strike;
      const end = frameFoes
        .filter(({ block }) => block.kind !== "rider")
        .reduce<[number, number] | null>((best, { at }) => (!best || at[0] * sign > best[0] * sign ? at : best), null);
      if (end) [order.x, order.y] = onField(toField(plan, end[0] + sign * 90, end[1] + 30));
    }
  }

  // the weak wing of an oblique attack holds back until the day is won
  if (tactic.massed && phase !== names.chase) {
    for (const block of own.ready) {
      const { order } = block;
      const refused = (plan.strike * plan.half - order.across * plan.strike) / (plan.half * 2) > 0.55;
      if (order.mission === "line" && order.rank === 0 && refused) order.mission = "guard";
    }
  }
  if (stance !== "flee") sendReserve(battle, side, own, foe, frameFoes);
}

/**
 * Where a stormer goes: the middle of the burg, by the cheapest way from where it stands: over the wall before it, or by
 * a breach or a gate when one is about as near. So the walls are stormed on a broad front. None once it is within.
 */
function getEntry(battle: Battle, block: Block): Point | null {
  const { field } = battle;
  const burg = field.burgs[field.held!];
  const terrain = terrainAt(field, block.x, block.y);
  return terrain.walled === field.held! + 1 && !terrain.rampart ? null : [burg.x, burg.y];
}

type Seen = { block: Block; at: [across: number, along: number] }[];

/** What a battalion is to do, by what it is in the formation and how the day goes */
function getMission(battle: Battle, side: Side, block: Block, own: View, foes: Seen): Order["mission"] {
  const { phase, plan, advancing } = battle[side];
  const names = POSTURES[battle.type][side];
  const { role } = block.order;
  const siege = battle.type === "siege" && battle.field.held !== null;
  const free = phase === names.chase || phase === "looting" || (siege && phase === "storming");
  if (role === "support" || role === "battery") return role;
  if (plan.tactic === "ambuscade" || plan.tactic === "waylay") return "hunt";
  if (free) return role === "line" && !siege && phase === names.chase && block.kind !== "rider" ? "line" : "hunt";
  if (role === "line") return "line";
  if (role === "reserve") return "reserve";

  // riders on a wing go round the foe's line when the lines close, unless the foe's riders there outweigh them
  const sign = Math.sign(block.order.across) || 1;
  const launched = phase === names.close || (advancing && plan.gap < CHARGE); // to fall on the foe as the lines meet
  if (!launched || block.morale < SHAKEN || siege) return "guard";
  const there = (all: Block[], at: (block: Block) => number): number =>
    sum(all, block => (block.kind === "rider" && at(block) * sign > 0 ? strength(block) : 0));
  const mine = there(own.ready, other => other.order.across);
  const theirs = sum(foes, ({ block, at }) => (block.kind === "rider" && at[0] * sign > 0 ? strength(block) : 0));
  if (theirs * 0.7 > mine) return "guard";
  const [, along] = toFrame(plan, block);
  const end = Math.min(...foes.filter(({ at }) => at[0] * sign > -plan.half).map(({ at }) => at[1]), Infinity);
  return along >= end - 30 ? "hunt" : "flank"; // level with the foe's line: it is round
}

/** Send those kept behind where they are needed, the nearest first */
function sendReserve(battle: Battle, side: Side, own: View, foe: View, foes: Seen): void {
  const { plan, phase } = battle[side];
  const names = POSTURES[battle.type][side];
  if (plan.fixed && plan.tactic !== "garrison") return;
  const spare = (): Block[] =>
    own.ready.filter(block => block.order.role === "reserve" && !block.order.sent && block.morale >= SHAKEN);
  const nearest = (among: Block[], to: { x: number; y: number }): Block | undefined =>
    among.reduce<Block | undefined>(
      (best, block) => (best && far(best, to) <= far(block, to) ? best : block),
      undefined
    );
  const send = (block: Block | undefined, target: Block | null): void => {
    if (block) Object.assign(block.order, { mission: "hunt", sent: true, target: target?.id ?? null });
  };

  if (plan.tactic === "garrison") {
    // a sortie: the riders and every other battalion of the line go out, at the engine when there is one to go for;
    // the whole line when the garrison comes out to drive the besiegers off
    if (phase !== "sortie" || own.ready.some(block => block.order.sent)) return;
    const line = own.ready.filter(block => block.order.role === "line" && block.morale >= SHAKEN);
    const prey = getSortiePrey(battle, own, foe);
    const all = isStrongGarrison(own, foe);
    for (const block of [...spare(), ...line.filter((_, i) => all || i % 2 === 0)]) send(block, prey);
    return;
  }

  // 1. a gap where a battalion of the first line broke with foes near: the one behind it steps in
  for (const lost of battle.blocks) {
    const { order } = lost;
    if (lost.side !== side || lost.status === "ready" || order.role !== "line" || order.rank !== 0) continue;
    order.rank = -1; // seen to
    if (!foe.ready.some(block => far(block, order) < 160)) continue;
    const behind = own.ready.filter(block => block.order.role === "line" && block.order.rank > 0 && !block.order.sent);
    const heir = nearest([...behind, ...spare()], order);
    if (heir)
      Object.assign(heir.order, { role: "line", mission: "line", rank: 0, across: order.across, along: order.along });
  }

  // 2. foes come round a flank or through the line
  const answered = new Set(own.ready.map(block => block.order.target));
  const urgent = ({ block, at }: Seen[number]): number => (block.kind === "rider" ? -1000 : 0) + at[1]; // riders, then the deepest
  for (const { block: threat, at } of [...foes].sort((a, b) => urgent(a) - urgent(b))) {
    const round = at[1] < -ROW_GAP / 2 || (Math.abs(at[0]) > plan.half + 40 && at[1] < 20);
    if (!round || answered.has(threat.id) || far(threat, plan) > 400) continue;
    const guards = own.ready.filter(
      block => block.order.mission === "guard" && !block.order.sent && block.kind === "rider"
    );
    send(nearest([...spare(), ...guards], threat), threat);
  }

  if (phase !== names.close) return;
  // 3. where a foe at grips wavers, to break it
  const held = new Set(own.ready.map(block => (block.action === "fight" ? block.target : null)));
  const wavering = foe.ready.filter(
    block => block.morale < SHAKEN + 10 && held.has(block.id) && !answered.has(block.id)
  );
  if (wavering.length) send(nearest(spare(), wavering[0]), wavering[0]);

  // 4. everywhere, once the fight has stood long enough: a reserve never used is wasted
  if (battle.round - plan.since >= 8) for (const block of spare()) send(block, null);
}

/** The formation goes for the foe at the pace of its slowest, along the way its troops would take, and no further ahead than they can keep */
function moveFrame(battle: Battle, side: Side, own: View, foe: View, gap: number): void {
  const data = battle[side];
  const { plan, phase } = data;
  const names = POSTURES[battle.type][side];
  const first = own.ready.filter(block => block.order.rank === 0 && !block.order.sent && block.order.role !== "wing");
  const lead = first.find(block => block.kind === "line") ?? first[0];
  if (!lead || !foe.ready.length) return;

  const there: Point = [foe.x, foe.y];
  const [tx, ty] = getTurn(battle, lead, [plan.x, plan.y], there);
  const bearing = Math.atan2(ty - plan.y, tx - plan.x);
  const straight = tx === there[0] && ty === there[1];
  // it wheels to face the foe, not for a trifle
  const off = Math.abs(Math.atan2(Math.sin(bearing - plan.heading), Math.cos(bearing - plan.heading)));
  if (Math.hypot(foe.x - plan.x, foe.y - plan.y) > 80 && off > (data.advancing ? 0.15 : 0.35))
    plan.heading = turn(plan.heading, bearing, straight ? 0.12 : 0.4);
  if (!data.advancing) return;

  const want = phase === names.apart && isOpenFight(battle) ? plan.halt : -Infinity;
  const pace = Math.min(...first.map(block => getPace(battle, block, terrainAt(battle.field, block.x, block.y).water)));
  const advance = Math.min(pace * ROUND_TICKS, gap - want);
  const lags = first.map(block => toFrame(plan, block.order)[1] - toFrame(plan, block)[1]).sort((a, b) => a - b);
  if (advance <= 0 || lags[lags.length >> 1] > 30) return; // most of the line is behind
  plan.x += Math.cos(bearing) * advance;
  plan.y += Math.sin(bearing) * advance;
  keepOnField(
    plan,
    own.ready.filter(block => !block.order.sent).map(block => block.order)
  );
}
