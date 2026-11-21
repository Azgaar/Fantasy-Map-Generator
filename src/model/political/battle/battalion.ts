// The battalion level: what one battalion does this tick, by its order and by what is around it. See docs/domain/battles.md.

import type { Battalion, Battle, TaskKind } from "./battle";
import { CHARGE, CHARGE_HASTE, COUNTER, SHAKEN } from "./battle-balance";
import { BattleRules, COMMANDS, type Command, type Side } from "./battle-rules";
import { Battlefields, type FieldWork } from "./battlefield";
import { ARRIVED, Movement, ROUND_TICKS, type Spot } from "./movement";
import { Sight } from "./sight";
import { AT_WORK, Works } from "./works";

/** How a battalion fights, by its unit type: line troops, shooters, riders, engines */
export type Kind = "melee" | "ranged" | "mounted" | "machinery";
const KINDS: Record<string, Kind> = {
  ranged: "ranged",
  mounted: "mounted",
  aviation: "mounted",
  machinery: "machinery",
  naval: "machinery"
};

const PRIZE = 0.3; // how much nearer a foe that only hits looks to who picks a target
const UNDER = (1 + PRIZE) * (1 + 1e-9); // the worth over the straight line over this is less than over any way

// in metres
const EVADE = 55; // shooters step back from foes this near
const LEASH = 80; // how far shooters step from their place to get in range

// in battalion fronts
const WATCH = 5; // how far a guard goes for riders
const GUARD = 2; // how near a friend it protects a foe is gone for
const CROWD = 1; // what each friend going for a foe adds to the way to it: they spread along the line
const ROUTED = 9; // and a foe on the run, to who does not chase

/** What a battalion means to do this tick */
export interface Intent {
  target: Battalion | null; // the foe to strike or shoot
  to: Spot | null; // where to go; none to stand
  stop: number; // how far from there to stop
  key: number; // of the way there: it is found anew when the key changes
  shared: boolean; // many go to that point: the ways to it are found once for all
  shoot: boolean; // shoot the target once in range rather than close with it
  facing: number; // where to face with no foe at hand
  haste: number;
  keep: boolean; // to its place in the formation: there by the end of the round, not in a dash and a wait
  build: boolean; // to work on its stretch of the works
  steady: boolean; // keeps its facing whatever it strikes or shoots: a garrison on its wall
}

/** What every battalion sees this tick */
export interface Sense {
  onField: Battalion[];
  crowd: Map<number, number>; // friends already going for a foe
  held: Set<number>; // those at grips
}

class BattalionModule {
  /** What a battalion weighs in a fight: its troops by the power of its unit and how well it is kept */
  getStrength(battalion: Battalion): number {
    return battalion.troops * battalion.stats.power * battalion.stats.upkeep;
  }

  /** Troops in a naval or an air battle are all of a kind: they shoot and close as their side does. Ships with no shot board */
  getKind(type: string, range: number, open = false): Kind {
    if (open || (type === "naval" && !range)) return "melee";
    return KINDS[type] ?? "melee";
  }

  /** Comes to grips rather than stands off to shoot: who has no shot, and line troops on land whatever they throw */
  closes(battle: Battle, battalion: Battalion): boolean {
    return !battalion.stats.range || (battalion.kind === "melee" && !battle.field.open);
  }

  /** The tasks a battalion can be given on its own spot: shooters skirmish, who comes to grips defends, who is on foot fortifies */
  getTasks(battle: Battle, battalion: Battalion): TaskKind[] {
    const tasks: TaskKind[] = ["hold"];
    if (Works.mayDig(battle, battalion)) tasks.push("fortify");
    if (battalion.stats.range) tasks.push("skirmish");
    if ((battalion.kind === "melee" || battalion.kind === "mounted") && battle.type !== "bombardment")
      tasks.push("defend");
    if (COMMANDS[battle.type][battalion.side].retreat) tasks.push("retreat"); // the besieged cannot
    tasks.push("surrender");
    return tasks;
  }

  /** What an order by hand has the side do where the phase is not the order's to change: in an ambush, in a landing */
  getBearing(battle: Battle, side: Side): Command | null {
    const { order } = battle[side].plan.byHand;
    return order && BattleRules.keepsPhase(battle.type, order) ? order : null;
  }

  decide(battle: Battle, battalion: Battalion, sense: Sense): Intent {
    const { order } = battalion;
    const limited = Sight.isLimited(battle);
    const foes = sense.onField.filter(
      foe => foe.side !== battalion.side && (!limited || Sight.knows(battle, battalion, foe))
    );
    const ready = foes.filter(foe => foe.status === "ready");
    const prey = ready.filter(foe => Movement.canGrip(battle, battalion, foe)); // whom it can come to grips with
    const stand: Intent = {
      target: null,
      to: null,
      stop: 0,
      key: -1,
      shared: false,
      shoot: false,
      facing: order.facing,
      haste: 1,
      keep: false,
      build: false,
      steady: false
    };
    const { front } = battle.field;
    const far = (foe: Spot, from: Spot = battalion): number => Math.hypot(foe.x - from.x, foe.y - from.y);
    const pick = (among: Battalion[]): Battalion | null => {
      // best first by the worth over the straight line: no way is shorter, so a foe that cannot beat the best even so is
      // passed over without finding the way to it; of foes worth the same the first in the list is kept
      const bounds = among.map(foe => this.getWorth(battle, battalion, foe, sense, far(foe)) / UNDER);
      const order = among.map((_, i) => i).sort((a, b) => bounds[a] - bounds[b]);
      let best = -1;
      let least = Infinity;
      for (const i of order) {
        if (bounds[i] > least) break;
        const score = this.getWorth(battle, battalion, among[i], sense);
        if (score < least || (score === least && i < best)) [best, least] = [i, score];
      }
      return best < 0 ? null : among[best];
    };
    const goHome = (): Intent =>
      far(order) < ARRIVED * front ? stand : { ...stand, to: order, key: this.getPointKey(battle, order), keep: true };
    // the last stretch at a run: what it covers in a tick so, at a foe in sight; engines do not charge
    const run = (target: Battalion): number =>
      battalion.kind !== "machinery" &&
      Movement.getGap(battalion, target)[0] <= Movement.getPace(battle, battalion) * CHARGE_HASTE &&
      Sight.sees(battle, battalion, target)
        ? CHARGE_HASTE
        : 1;
    const charge = (target: Battalion): Intent => ({
      ...stand,
      target,
      to: target,
      key: target.id,
      haste: run(target)
    });
    const shoot = (target: Battalion, approach = false): Intent => ({
      ...stand,
      target,
      to: approach ? target : null,
      stop: Movement.getRange(battle, battalion, target) * 0.85,
      key: target.id,
      shoot: true
    });

    // the broken are shot too, once no foe in order is in range
    const inRange = (): Battalion[] => {
      const reached = foes.filter(foe => Movement.canShoot(battle, battalion, foe));
      const inOrder = reached.filter(foe => foe.status === "ready");
      return inOrder.length ? inOrder : reached;
    };

    // at grips: the foe it fights already, or the one most to its front
    const grips = ready.filter(foe => Movement.inContact(battle, foe, battalion));
    if (grips.length) {
      const off = (foe: Battalion): number =>
        Math.abs(Movement.normalize(Math.atan2(foe.y - battalion.y, foe.x - battalion.x) - battalion.facing));
      const target =
        grips.find(foe => foe.id === battalion.target) ?? grips.reduce((a, b) => (off(b) < off(a) ? b : a));
      return { ...stand, target, steady: Movement.holdsWall(battle, battalion) };
    }
    // on the wall top a garrison battalion stands fast: it fights who comes up to it and shoots from there, going only for
    // stormers that got in over the walls by its post
    const isIn = (foe: Battalion): boolean =>
      Battlefields.terrainAt(battle.field, foe.x, foe.y).walled === battle.field.held! + 1;
    const inside = (): boolean => prey.some(foe => isIn(foe) && far(foe, order) - foe.width / 2 <= COUNTER * front);
    if (Movement.holdsWall(battle, battalion) && !inside()) {
      const target = pick(inRange()); // who has nothing to shoot throws
      return target ? { ...shoot(target), steady: true } : { ...stand, steady: true };
    }

    // out of reach of those who come for it; riders keep that far from the foe's front, not its middle
    const apart = (foe: Battalion): number =>
      battalion.kind === "mounted" ? Movement.getGap(battalion, foe)[0] : far(foe);
    const evade = (): Intent | null => {
      const threat = ready
        .filter(
          foe =>
            !foe.stats.range &&
            !sense.held.has(foe.id) &&
            apart(foe) < EVADE &&
            !Works.isBarredByWorks(battle, foe, [foe.x, foe.y], [battalion.x, battalion.y]) // riders before stakes, foes outside wagons
        )
        .reduce<Battalion | null>((a, b) => (a && far(a) <= far(b) ? a : b), null);
      if (!threat) return null;
      const away = Math.atan2(battalion.y - threat.y, battalion.x - threat.x);
      const to = { x: battalion.x + Math.cos(away) * EVADE, y: battalion.y + Math.sin(away) * EVADE };
      return { ...stand, to, key: this.getPointKey(battle, to) };
    };
    // at its place to build while no foe can be upon it within a round; the work is kept for when the foe is gone
    const atWork = (place: Spot): boolean => {
      if (far(place) >= AT_WORK * front) return false;
      const work = Works.findStretch(battle, battalion);
      const near = ready.some(foe => far(foe) < Movement.getPace(battle, foe) * ROUND_TICKS + CHARGE * front);
      return (!work || (work.kind !== "wagons" && work.done < 1)) && !near; // wagons are built by who is sent to them
    };

    const closes = this.closes(battle, battalion);
    // riders who shoot keep out of reach of those who come for them on any errand, as shooters do
    const skirmishes = battalion.kind === "mounted" && battalion.stats.range > 0;

    if (battalion.byHand.task) {
      const { task } = battalion.byHand;
      const shot = (among: Battalion[]): Battalion | null =>
        pick(among.filter(foe => Movement.canShoot(battle, battalion, foe)));
      if (task.kind === "skirmish") {
        const target = pick(ready);
        return evade() ?? (target ? shoot(target, true) : { ...stand, facing: battalion.facing });
      }
      if (task.target === null) {
        // a spot to go to or to keep: a defender meets what comes near it, one told to fortify builds there
        if (task.kind === "defend" && battalion.morale >= SHAKEN) {
          const near = pick(prey.filter(foe => far(foe, task) - foe.width / 2 <= COUNTER * front));
          if (near) return charge(near);
        }
        if (
          task.kind === "fortify" &&
          Works.mayDig(battle, battalion) &&
          !Works.isAtSea(battle, battalion) &&
          atWork(task)
        )
          return { ...stand, build: true, facing: task.facing };
        if (far(task) >= ARRIVED * front)
          return { ...stand, to: task, key: this.getPointKey(battle, task), facing: task.facing };
        const target = battalion.stats.range ? pick(inRange()) : null; // there it shoots what comes in range, and fights what comes at it
        return target ? shoot(target) : { ...stand, facing: task.facing };
      }
      const other = sense.onField.find(other => other.id === task.target);
      if (other && (task.kind === "attack" || task.kind === "pursue"))
        return closes ? charge(other) : shoot(other, true);
      if (other) {
        // the foes that come at the friend, the nearest to it first
        const near = (foe: Battalion): boolean => far(foe, other) - foe.width / 2 <= GUARD * front;
        const threat = closes ? pick(prey.filter(near)) : shot(ready.filter(near));
        if (threat) return closes ? charge(threat) : shoot(threat);
        const by = (other.width + battalion.width) / 2 + front;
        if (far(other) > by + ARRIVED * front)
          return { ...stand, to: other, stop: by, key: other.id, facing: other.facing };
        return { ...stand, facing: other.facing };
      }
    }

    const { plan } = battle[battalion.side];
    const job = plan.fortify ? Works.getWagonJob(battle, battalion) : undefined;
    if (job) {
      // up to the wagons: it builds once there, and goes on with what it began when pushed a little off
      const spot = Works.getWorkSpot(battalion, job);
      const there = far(spot) < ARRIVED * front || (job.done > 0 && far(spot) < AT_WORK * front);
      if (there) return { ...stand, build: true, facing: spot.facing };
      return { ...stand, to: spot, key: this.getPointKey(battle, spot), facing: spot.facing };
    }
    if (plan.fortify && Works.isBuilder(battle, battalion) && atWork(order)) return { ...stand, build: true };
    const away = skirmishes ? evade() : null;
    if (away) return away;

    const { phase, advancing } = battle[battalion.side];
    const told = this.getBearing(battle, battalion.side);
    // a column caught on the march fights who falls on it and shoots back, but goes for nobody till the shock is over
    const stunned = phase === "shock" && !told;
    const shaken = battalion.morale < SHAKEN || stunned;
    const forward = told ? told === "attack" || told === "defend" : BattleRules.getStance(phase) === "advance";
    const bold = forward && !shaken;
    const keen = told === "skirmish"; // shooters go as far as it takes where the formation stays

    if (order.mission === "battery") {
      const target = pick(inRange());
      return target ? shoot(target) : goHome();
    }

    if (order.mission === "support") {
      const away = evade();
      if (away) return away;
      const target = pick(inRange());
      if (target) return shoot(target);
      // nothing in range: a step forward from the place, no further than the leash
      const leash = keen && plan.fixed ? Infinity : LEASH;
      const next = bold || keen ? pick(ready.filter(foe => far(foe, order) <= battalion.stats.range + leash)) : null;
      return next ? shoot(next, true) : goHome();
    }

    if (order.mission === "flank") {
      // only who bars the way
      const barring = pick(prey.filter(foe => far(foe) <= COUNTER * front + foe.width / 2));
      if (barring && !shaken) return skirmishes ? shoot(barring, true) : charge(barring);
      // stormers all make for the middle of the burg
      const shared = battle.type === "siege";
      return far(order) < ARRIVED * front
        ? stand
        : { ...stand, to: order, key: this.getPointKey(battle, order), shared };
    }

    if (order.mission === "hunt") {
      const shooting = Boolean(battalion.stats.range) && battalion.kind !== "melee"; // in a naval or an air battle all close
      const among = shooting ? foes : foes.filter(foe => Movement.canGrip(battle, battalion, foe));
      const inOrder = among.filter(foe => foe.status === "ready");
      const target = pick(inOrder.length && !bold ? inOrder : among);
      if (!target) return goHome();
      if (shooting) return shoot(target, true);
      return shaken ? stand : charge(target);
    }

    // line, reserve and guard keep their place and go for what comes within reach of it
    const guard = order.mission === "guard";
    const reach = (order.mission === "line" && bold && advancing ? CHARGE : COUNTER) * front; // who waits, holds
    // behind its own works, a side that holds lets the foe come over them rather than lose them
    const behind = battle.field.works.length > 0 && Works.isHolding(battle, battalion.side);
    const own = (work: FieldWork): boolean => work.side === battalion.side;
    const over = (foe: Battalion): boolean =>
      behind && Battlefields.hasWorksBetween(battle.field, [battalion.x, battalion.y], [foe.x, foe.y], own);
    const within = prey.filter(foe => {
      const distance = far(foe, order) - foe.width / 2;
      const near =
        foe.id === order.target ||
        distance <= reach ||
        (guard && foe.kind === "mounted" && distance <= WATCH * front) ||
        (sense.held.has(foe.id) && distance <= reach * 1.5); // the flank of a foe a neighbour holds
      return near && !over(foe) && !Movement.isAboard(battle, foe); // the boats are let come: who wades out of them is the prey
    });
    // ships and fliers close when their side does, shooting from their place till then; riders who shoot ride within shot
    const boarding = Boolean(battle.field.open) && bold;
    if (within.length && !shaken && (closes || boarding)) return charge(pick(within)!);
    if (within.length && !shaken && skirmishes) return shoot(pick(within)!, true);
    if (battalion.stats.range && (!boarding || far(order) < Movement.getPace(battle, battalion))) {
      const target = pick(inRange());
      if (target) return shoot(target);
    }
    return goHome();
  }

  /** The key of the way to a point: the same while the point stays, so a way to a fixed place is found once */
  private getPointKey(battle: Battle, point: Spot): number {
    const span = Math.ceil(battle.field.height) * 3; // a point may lie off the field
    return -1 - (Math.round(point.x) * span + Math.round(point.y) + span / 3);
  }

  /** How little a foe is worth going for: the way to it, shortened by all that makes it a better prey */
  private getWorth(
    battle: Battle,
    battalion: Battalion,
    foe: Battalion,
    sense: Sense,
    way = Movement.getDistance(battle, battalion, foe)
  ): number {
    let score = way;
    const chasing =
      BattleRules.getStance(battle[battalion.side].phase) === "advance" &&
      BattleRules.isBeaten(battle.type, foe.side, battle[foe.side].phase);
    const { front } = battle.field;
    if (foe.status === "routed")
      score = chasing || battalion.order.mission === "hunt" ? score * 0.9 : score + ROUTED * front;
    const closes = this.closes(battle, battalion);
    if (foe.id === battalion.target) score *= 0.75;
    else if (closes) score += (sense.crowd.get(foe.id) ?? 0) * CROWD * front;
    if (foe.id === battalion.order.target) score *= 0.5; // the general points at it

    const edge = (foe.stats.attack - foe.stats.defense) / (foe.stats.attack + foe.stats.defense || 1); // hits harder than it stands
    if (!closes) return score * (1 - PRIZE * edge);

    const bearing = Math.abs(Movement.normalize(Math.atan2(battalion.y - foe.y, battalion.x - foe.x) - foe.facing)); // 0 at its front
    const held = sense.held.has(foe.id);
    if (held && bearing > 1.05) score *= bearing > 2.1 ? 0.6 : 0.75; // the flank and the rear of a foe held by a friend
    if (foe.morale < SHAKEN) score *= 0.85;
    if (battalion.kind === "mounted") {
      if (foe.kind === "ranged" || foe.kind === "machinery") score *= 0.7;
      else if (foe.kind === "melee" && bearing < 1.05 && !held && foe.morale >= SHAKEN) score *= 1.6; // formed, head on
    }
    if (score <= CHARGE * front) score *= 1 - PRIZE * edge;
    return score;
  }
}

export const Battalions = new BattalionModule();
