// The battalion level: what one battalion does this tick, by its order and by what is around it. See docs/domain/battles.md.

import type { Battle, Block } from "./battle";
import { getStance, POSTURES } from "./battle-rules";
import { getDistance, inContact, normalize, PACE, type Spot } from "./movement";

export type Kind = "line" | "shooter" | "rider" | "engine";

export const LONG_SHOT = 200; // shooters of this range and more are engines
export const CHARGE = 120; // how far from its place a battalion goes for a foe when its side closes
export const COUNTER = 45; // and when it holds
export const SHAKEN = 30; // morale under which a battalion does not attack
const WATCH = 220; // how far a guard goes for riders
const EVADE = 80; // shooters step back from foes this near
const LEASH = 60; // how far shooters step from their place to get in range
const ARRIVED = 3; // how near its place a battalion stops: closer, neighbours would only jostle it
const PRIZE = 0.3; // how much nearer a foe that only hits looks to who picks a target

/** What a battalion means to do this tick */
export interface Intent {
  target: Block | null; // the foe to strike or shoot
  to: Spot | null; // where to go; none to stand
  stop: number; // how far from there to stop
  key: number; // of the way there: it is found anew when the key changes
  shoot: boolean; // shoot the target once in range rather than close with it
  facing: number; // where to face with no foe at hand
  haste: number;
}

/** What every battalion sees this tick */
export interface Sense {
  onField: Block[];
  crowd: Map<number, number>; // friends already going for a foe
  held: Set<number>; // those at grips
}

/** Troops in a naval or an air battle are all of a kind: they shoot and close as their side does */
export function getKind(unit: { range: number; speed: number }, open: boolean): Kind {
  if (open) return "line";
  if (unit.range >= LONG_SHOT) return "engine";
  if (unit.range > 0) return "shooter";
  return unit.speed >= PACE * 2 ? "rider" : "line";
}

export function decide(battle: Battle, block: Block, sense: Sense): Intent {
  const { order } = block;
  const foes = sense.onField.filter(foe => foe.side !== block.side);
  const ready = foes.filter(foe => foe.status === "ready");
  const stand: Intent = { target: null, to: null, stop: 0, key: -1, shoot: false, facing: order.facing, haste: 1 };
  const far = (foe: Spot, from: Spot = block): number => Math.hypot(foe.x - from.x, foe.y - from.y);
  const pick = (among: Block[]): Block | null => {
    let best: Block | null = null;
    let least = Infinity;
    for (const foe of among) {
      const score = getWorth(battle, block, foe, sense);
      if (score < least) [best, least] = [foe, score];
    }
    return best;
  };
  const goHome = (): Intent => (far(order) < ARRIVED ? stand : { ...stand, to: order, key: getPointKey(order) });
  const charge = (target: Block): Intent => ({ ...stand, target, to: target, key: target.id });
  const shoot = (target: Block, approach = false): Intent => ({
    ...stand,
    target,
    to: approach ? target : null,
    stop: block.range * 0.85,
    key: target.id,
    shoot: true
  });

  // at grips: the foe it fights already, or the one most to its front
  const grips = ready.filter(foe => inContact(battle, foe, block));
  if (grips.length) {
    const off = (foe: Block): number =>
      Math.abs(normalize(Math.atan2(foe.y - block.y, foe.x - block.x) - block.facing));
    const target = grips.find(foe => foe.id === block.target) ?? grips.reduce((a, b) => (off(b) < off(a) ? b : a));
    return { ...stand, target };
  }

  const shaken = block.morale < SHAKEN;
  const bold = getStance(battle[block.side].phase) === "advance" && !shaken;
  const inRange = (): Block[] => ready.filter(foe => far(foe) <= block.range);

  if (order.mission === "battery") {
    const target = pick(inRange());
    return target ? shoot(target) : goHome();
  }

  if (order.mission === "support") {
    // out of reach of those who come for it
    const threat = ready
      .filter(foe => !foe.range && !sense.held.has(foe.id) && far(foe) < EVADE)
      .reduce<Block | null>((a, b) => (a && far(a) <= far(b) ? a : b), null);
    if (threat) {
      const away = Math.atan2(block.y - threat.y, block.x - threat.x);
      const to = { x: block.x + Math.cos(away) * EVADE, y: block.y + Math.sin(away) * EVADE };
      return { ...stand, to, key: getPointKey(to) };
    }
    const target = pick(inRange());
    if (target) return shoot(target);
    // nothing in range: a step forward from the place, no further than the leash
    const next = bold ? pick(ready.filter(foe => far(foe, order) <= block.range + LEASH)) : null;
    return next ? shoot(next, true) : goHome();
  }

  if (order.mission === "flank") {
    // only who bars the way
    const barring = pick(ready.filter(foe => far(foe) <= COUNTER + foe.width / 2));
    if (barring && !shaken) return charge(barring);
    return far(order) < ARRIVED ? stand : { ...stand, to: order, key: getPointKey(order) };
  }

  if (order.mission === "hunt") {
    const target = pick(ready.length ? (bold ? foes : ready) : foes);
    if (!target) return goHome();
    if (block.range && block.kind !== "line") return shoot(target, true);
    return shaken ? stand : charge(target);
  }

  // line, reserve and guard keep their place and go for what comes within reach of it
  const guard = order.mission === "guard";
  const reach = order.mission === "line" && bold && battle[block.side].advancing ? CHARGE : COUNTER; // who waits, holds
  const within = ready.filter(foe => {
    const distance = far(foe, order) - foe.width / 2;
    if (foe.id === order.target || distance <= reach) return true;
    if (guard && foe.kind === "rider" && distance <= WATCH) return true;
    return sense.held.has(foe.id) && distance <= reach * 1.5; // the flank of a foe a neighbour holds
  });
  // ships and fliers close when their side does, shooting from their place till then; others who shoot do not close
  const boarding = Boolean(battle.field.open) && bold;
  if (within.length && !shaken && (!block.range || boarding)) return charge(pick(within)!);
  if (block.range && (!boarding || far(order) < PACE)) {
    const target = pick(inRange());
    if (target) return shoot(target);
  }
  return goHome();
}

/** The key of the way to a point: the same while the point stays, so a way to a fixed place is found once */
const getPointKey = (point: Spot): number => -1 - (Math.round(point.x) * 2000 + Math.round(point.y));

/** How little a foe is worth going for: the way to it, shortened by all that makes it a better prey */
function getWorth(battle: Battle, block: Block, foe: Block, sense: Sense): number {
  let score = getDistance(battle, block, foe);
  const chasing =
    getStance(battle[block.side].phase) === "advance" && battle[foe.side].phase === POSTURES[battle.type][foe.side].run;
  if (foe.status === "routed") score = chasing || block.order.mission === "hunt" ? score * 0.9 : score + 400;
  if (foe.id === block.target) score *= 0.75;
  else if (!block.range) score += (sense.crowd.get(foe.id) ?? 0) * 45; // spread along the line
  if (foe.id === block.order.target) score *= 0.5; // the general points at it

  const edge = (foe.attack - foe.defense) / (foe.attack + foe.defense || 1); // hits harder than it stands
  if (block.range) return score * (1 - PRIZE * edge);

  const bearing = Math.abs(normalize(Math.atan2(block.y - foe.y, block.x - foe.x) - foe.facing)); // 0 at its front
  const held = sense.held.has(foe.id);
  if (held && bearing > 1.05) score *= bearing > 2.1 ? 0.6 : 0.75; // the flank and the rear of a foe held by a friend
  if (foe.morale < SHAKEN) score *= 0.85;
  if (block.kind === "rider") {
    if (foe.kind === "shooter" || foe.kind === "engine") score *= 0.7;
    else if (foe.kind === "line" && bearing < 1.05 && !held && foe.morale >= SHAKEN) score *= 1.6; // formed, head on
  }
  if (score <= CHARGE) score *= 1 - PRIZE * edge;
  return score;
}
