// Field works: stakes, a ditch, a wagon ring. Lines on the field before a side's first line that hinder its foes and
// shelter it. All their rules are here. See docs/domain/battles.md#works.

import type { Battle, Block } from "./battle";
import { enemyOf, POSTURES, SIDES, type Side, SURRENDER } from "./battle-rules";
import { type FieldWork, getWorksBetween, isStanding, type WorkKind } from "./battlefield";
import { GAP } from "./formations";

/** Works are part of the battle; tests switch them off to compare with the battle without them */
export const WORKS = { on: true };

const AHEAD = 6; // metres a stretch stands ahead of its battalion's front: at grips it lies between the two
const RIDERS = 1 / 3; // share of a foe's power in riders that makes it strong in them: stakes, not a ditch

/** Ticks a full battalion takes to build a stretch; a wagon ring is the side's train, built as one */
export const BUILD_TICKS: Record<WorkKind, number> = { stakes: 15, wagons: 30, ditch: 112 };

// how hard blows and shots that come over a work land on its holders; a charge over it has no impetus
const BLOWS: Record<WorkKind, number> = { stakes: 0.75, ditch: 0.6, wagons: 0.5 };
const SHOTS: Record<WorkKind, number> = { stakes: 1, ditch: 0.6, wagons: 0.5 };

/** Who stakes stop: troops on horse */
export const isRider = (block: Block): boolean =>
  block.type !== "aviation" && (block.kind === "rider" || block.type === "mounted");

/** Whether the stretch stops the block crossing it: wagons the foe, stakes the foe's riders; a side's own never */
export function bars(work: FieldWork, block: Block): boolean {
  if (work.side === block.side || block.type === "aviation" || !isStanding(work)) return false;
  return work.kind === "wagons" || (work.kind === "stakes" && isRider(block));
}

/** A work that stands between two points and stops the block going from one to the other */
export const isBarredByWorks = (battle: Battle, block: Block, from: [number, number], to: [number, number]): boolean =>
  battle.field.works.length > 0 && getWorksBetween(battle.field, from, to).some(work => bars(work, block));

/** Riders do not come to contact with a foe over works that bar them: they stand before stakes or wagons, or go round */
export function isStaked(battle: Battle, a: Block, b: Block): boolean {
  if (!battle.field.works.length || (!isRider(a) && !isRider(b))) return false;
  return getWorksBetween(battle.field, [a.x, a.y], [b.x, b.y]).some(work => bars(work, a) || bars(work, b));
}

/** What a blow or a shot of the striker keeps of its power over the target's works: the strongest one counts */
export function getShelter(battle: Battle, striker: Block, target: Block, shot: boolean): number {
  let factor = 1;
  for (const work of getWorksBetween(battle.field, [striker.x, striker.y], [target.x, target.y], target.side))
    factor = Math.min(factor, (shot ? SHOTS : BLOWS)[work.kind]);
  return factor;
}

/** Works of the target's side stand between it and the striker: a charge over them has no impetus */
export const isSheltered = (battle: Battle, striker: Block, target: Block): boolean =>
  getWorksBetween(battle.field, [striker.x, striker.y], [target.x, target.y], target.side).length > 0;

// Building

/** Sides that may dig in: either in a field battle, the besiegers of a siege, the defenders of a landing */
export function mayBuild(battle: Battle, side: Side): boolean {
  if (!WORKS.on || battle.field.open) return false;
  if (battle.type === "field") return true;
  return battle.type === (side === "attackers" ? "siege" : "landing");
}

/** A side that stands where it is: it neither advances, chases nor runs; besiegers do while they do not storm */
export function isHolding(battle: Battle, side: Side): boolean {
  const { phase, advancing } = battle[side];
  if (battle.type === "siege" && side === "attackers") return phase === "blockade" || phase === "bombardment";
  const { chase, run } = POSTURES[battle.type][side];
  return !advancing && phase !== chase && phase !== run && phase !== SURRENDER;
}

/** A battalion of the first line on foot builds the stretch before its place; a laager builds wagons instead */
export function isBuilder(battle: Battle, block: Block): boolean {
  const { order } = block;
  return (
    order.rank === 0 &&
    !order.sent &&
    (order.role === "line" || order.role === "support") &&
    (block.kind === "line" || block.kind === "shooter") &&
    block.type !== "naval" &&
    block.type !== "aviation" &&
    battle[block.side].plan.tactic !== "laager"
  );
}

/** Where a battalion's stretch runs: across the front of its place, as long as the block and the gap to a neighbour */
export function getStretchLine(battle: Battle, block: Block): [[number, number], [number, number]] {
  const { x, y, facing } = block.order;
  const ahead = block.depth / 2 + AHEAD;
  const half = (block.width + GAP * battle.field.front) / 2;
  const [cx, cy] = [x + Math.cos(facing) * ahead, y + Math.sin(facing) * ahead];
  const [dx, dy] = [-Math.sin(facing) * half, Math.cos(facing) * half]; // the front is on the left of a → b
  return [
    [cx - dx, cy - dy],
    [cx + dx, cy + dy]
  ];
}

const middle = (work: { a: [number, number]; b: [number, number] }): [number, number] => [
  (work.a[0] + work.b[0]) / 2,
  (work.a[1] + work.b[1]) / 2
];

/** The stretch before the battalion's place, begun or laid in advance; one left behind by a moved formation is not */
export function findStretch(battle: Battle, block: Block): FieldWork | undefined {
  const [a, b] = getStretchLine(battle, block);
  const [x, y] = middle({ a, b });
  return battle.field.works.find(work => {
    if (work.side !== block.side || work.kind === "wagons") return false;
    const [wx, wy] = middle(work);
    return Math.hypot(wx - x, wy - y) < block.depth / 2;
  });
}

/** Share of a side's power in riders, of the battalions in order */
function getRiderShare(battle: Battle, side: Side): number {
  let riders = 0;
  let all = 0;
  for (const block of battle.blocks) {
    if (block.side !== side || block.status !== "ready" || block.leaving) continue;
    const strength = block.troops * block.unitPower * block.upkeep;
    all += strength;
    if (isRider(block)) riders += strength;
  }
  return all ? riders / all : 0;
}

/**
 * The best kind a battalion of the side has done before the foe comes: a ditch against a foe weak in riders, else
 * stakes; none when neither is done in time
 * @param rate share of a full battalion's work it does a tick
 * @param ticks till the foe is there
 */
export function chooseKind(battle: Battle, side: Side, rate: number, ticks: number): WorkKind | null {
  if (!rate) return null;
  const riders = getRiderShare(battle, enemyOf(side)) >= RIDERS;
  if (!riders && BUILD_TICKS.ditch / rate <= ticks) return "ditch";
  return BUILD_TICKS.stakes / rate <= ticks ? "stakes" : null;
}

/** Something of the side's works is still to be built: a battalion of the first line without its stretch, or the wagons */
export function hasWorkLeft(battle: Battle, side: Side): boolean {
  if (battle[side].plan.tactic === "laager") {
    const wagons = battle.field.works.filter(work => work.side === side && work.kind === "wagons");
    return !wagons.length || wagons.some(work => !work.up);
  }
  return battle.blocks.some(block => {
    if (block.side !== side || block.status !== "ready" || block.leaving || !isBuilder(battle, block)) return false;
    return !findStretch(battle, block)?.up;
  });
}

/** A side that stands behind works it finished at its first line */
export function holdsWorks(battle: Battle, side: Side): boolean {
  const { works } = battle.field;
  if (!works.some(work => work.side === side && isStanding(work))) return false;
  if (battle[side].plan.tactic === "laager") return true;
  return battle.blocks.some(
    block =>
      block.side === side &&
      block.status === "ready" &&
      isBuilder(battle, block) &&
      Boolean(findStretch(battle, block)?.up)
  );
}

/** The foe begins a ditch or a wagon ring: a side no weaker comes on before it stands */
export const isDigging = (battle: Battle, side: Side): boolean =>
  battle.field.works.some(work => work.side === side && !work.up && work.kind !== "stakes");

/** A tick of building: each battalion at work on its stretch, and the train of a fortifying laager on its wagons
 * @param elapsed ticks since the general reckoned when the foe comes */
export function buildWorks(battle: Battle, elapsed: number): void {
  for (const block of battle.blocks) {
    if (block.action !== "build") continue;
    let work = findStretch(battle, block);
    if (!work) {
      const rate = block.troops / battle.battalion;
      const kind = chooseKind(battle, block.side, rate, battle[block.side].plan.arrival - elapsed) ?? "stakes";
      const [a, b] = getStretchLine(battle, block);
      work = { a, b, kind, side: block.side, builder: block.id, done: 0, up: false, harm: 0 };
      battle.field.works.push(work);
    }
    work.done = advance(work.done, block.troops / battle.battalion / BUILD_TICKS[work.kind]);
  }
  for (const side of SIDES) {
    const { plan } = battle[side];
    if (plan.tactic !== "laager" || !plan.fortify) continue;
    if (!battle.field.works.some(work => work.side === side && work.kind === "wagons")) layRing(battle, side, false);
    for (const work of battle.field.works)
      if (work.side === side && work.kind === "wagons" && !work.up)
        work.done = advance(work.done, 1 / BUILD_TICKS.wagons);
  }
}

/** Work done after a tick more of it: fifteen fifteenths make a whole */
const advance = (done: number, step: number): number => (done + step > 1 - 1e-9 ? 1 : done + step);

/**
 * Stretches finished in the last round stand from now on, all at once; the log says when a side's last one does.
 * True when one of them bars the way to somebody: the ways are to be found anew
 */
export function raiseWorks(battle: Battle): boolean {
  let barring = false;
  const raised = new Map<Side, WorkKind>();
  for (const work of battle.field.works) {
    if (work.up || work.done < 1) continue;
    work.up = true;
    raised.set(work.side, work.kind);
    if (work.kind !== "ditch") barring = true;
  }
  for (const [side, kind] of raised) {
    if (battle.field.works.some(work => work.side === side && !work.up)) continue;
    battle.log.push({ tick: battle.tick, event: "fortified", side, params: { kind } });
  }
  return barring;
}

const WRECK = 0.04; // of a stretch of wagons an engine knocks down a round
const MAX_WRECK = 0.2;

/**
 * Engines in range of the foe's wagons knock them down, the stretch nearest them first: a gap a stretch wide that
 * troops get in by. True when one comes down
 */
export function breakWagons(battle: Battle): boolean {
  let broken = false;
  for (const side of SIDES) {
    const wagons = battle.field.works.filter(work => work.side !== side && work.kind === "wagons" && isStanding(work));
    if (!wagons.length) continue;
    const engines = battle.blocks.filter(
      block => block.side === side && block.status === "ready" && block.kind === "engine"
    );
    if (!engines.length) continue;
    const far = (work: FieldWork, block: Block): number => {
      const [x, y] = middle(work);
      return Math.hypot(x - block.x, y - block.y);
    };
    const engine = engines.reduce((a, b) => (b.troops > a.troops ? b : a));
    const work = wagons.reduce((a, b) => (far(b, engine) < far(a, engine) ? b : a));
    const firing = engines.filter(block => far(work, block) <= block.range).length;
    if (!firing) continue;
    battle.lastLoss = battle.tick; // no lull while the engines are at the wagons
    work.harm = Math.min(work.harm + Math.min(firing * WRECK, MAX_WRECK), 1);
    if (work.harm < 1) continue;
    broken = true;
    battle.log.push({ tick: battle.tick, event: "gap", side: work.side });
  }
  return broken;
}

/** Works laid in advance before a side's places: what its rule would build with all the time there is */
export function layWorks(battle: Battle, side: Side): void {
  if (battle[side].plan.tactic === "laager") {
    layRing(battle, side, true);
    return;
  }
  const kind = chooseKind(battle, side, 1, Infinity)!;
  for (const block of battle.blocks) {
    if (block.side !== side || block.status !== "ready" || !isBuilder(battle, block)) continue;
    const [a, b] = getStretchLine(battle, block);
    battle.field.works.push({ a, b, kind, side, builder: null, done: 1, up: true, harm: 0 });
  }
}

/** A wagon ring round a laager: a stretch before each battalion standing on it, joined end to end */
function layRing(battle: Battle, side: Side, done: boolean): void {
  const { plan } = battle[side];
  const ring = battle.blocks
    .filter(block => block.side === side && block.status === "ready" && block.order.rank === 0)
    .map(block => {
      const { x, y } = block.order;
      const angle = Math.atan2(y - plan.y, x - plan.x);
      return { angle, radius: Math.hypot(x - plan.x, y - plan.y) + block.depth / 2 + AHEAD };
    })
    .sort((a, b) => a.angle - b.angle);
  if (ring.length < 3) return;
  // the corners lie between neighbours; going round by the angle, the front of a stretch is on its left
  const corners = ring.map((spot, i): [number, number] => {
    const next = ring[(i + 1) % ring.length];
    const turn = (next.angle - spot.angle + Math.PI * 2) % (Math.PI * 2);
    const angle = spot.angle + turn / 2;
    const radius = (spot.radius + next.radius) / 2 / Math.max(Math.cos(turn / 2), 0.5);
    return [plan.x + Math.cos(angle) * radius, plan.y + Math.sin(angle) * radius];
  });
  corners.forEach((b, i) => {
    const a = corners[(i - 1 + corners.length) % corners.length];
    battle.field.works.push({ a, b, kind: "wagons", side, builder: null, done: +done, up: done, harm: 0 });
  });
}
