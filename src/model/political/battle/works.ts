// Field works: stakes, a ditch, a wagon ring. Lines on the field before a side's first line that hinder its foes and
// shelter it. All their rules are here. See docs/domain/battles.md#works.

import type { Point } from "@/types/global";
import type { Battalion, Battle } from "./battle";
import { BUILD_TICKS, SHELTER } from "./battle-balance";
import { BattleRules, POSTURES, SIDES, type Side, SURRENDER } from "./battle-rules";
import { Battlefields, type FieldWork, type WorkKind } from "./battlefield";
import { GAP } from "./formations";
import { ARRIVED, Movement, type Spot } from "./movement";
import { Sight } from "./sight";

/** Works are part of the battle; tests switch them off to compare with the battle without them */
export const WORKS = { on: true };

export const AT_WORK = 0.21; // fronts from its place or its spot within which a battalion builds
const AHEAD = 6; // metres a stretch stands ahead of its battalion's front: at grips it lies between the two
const STRONG = 1 / 3; // share of a foe's power that makes it strong in riders (stakes, not a ditch), or riders and shooters (wagons)
const CROWD = 0.75; // builders stand no nearer than this share of their fronts: corner to corner at a turned-back end
const BENDS = [Math.PI / 4, Math.PI / 2]; // turns back of a wagon line at its ends, to a half circle
const MOST_TURN = (Math.PI * 2) / 3; // between neighbours on a wagon ring
export const GAP_WAGONS = 2; // wagons knocked out of a stretch, one a shot, that open a gap troops get in by

class WorksModule {
  private readonly barring = new WeakMap<FieldWork[], { length: number; lists: FieldWork[][] }>(); // by side and riding; works only ever join the list

  /** How a wagon line turns back at its ends; siege lines ring a burg in and do not */
  private getBends(battle: Battle): number[] {
    return battle.type === "siege" ? [] : BENDS;
  }

  /** Who stakes stop: troops on horse */
  isRider(battalion: Battalion): boolean {
    return battalion.type === "mounted";
  }

  /** Whether the stretch stops the battalion crossing it: wagons the foe, stakes the foe's riders; a side's own never */
  bars(work: FieldWork, battalion: Battalion): boolean {
    if (work.side === battalion.side || battalion.type === "aviation" || !Battlefields.isStanding(work)) return false;
    return work.kind === "wagons" || (work.kind === "stakes" && this.isRider(battalion));
  }

  /** A work that stands between two points and stops the battalion going from one to the other */
  isBarredByWorks(battle: Battle, battalion: Battalion, from: [number, number], to: [number, number]): boolean {
    return (
      battle.field.works.length > 0 &&
      battalion.type !== "aviation" &&
      Battlefields.crossesStanding(this.getBarring(battle, battalion), from, to)
    );
  }

  /** The works that bar the battalion while they stand: the wagons of its foe, and the foe's stakes when it rides */
  private getBarring(battle: Battle, battalion: Battalion): FieldWork[] {
    const { works } = battle.field;
    let known = this.barring.get(works);
    if (known?.length !== works.length) {
      known = { length: works.length, lists: [] };
      this.barring.set(works, known);
    }
    const rider = this.isRider(battalion);
    const key = (battalion.side === "attackers" ? 0 : 2) + +rider;
    known.lists[key] ??= works.filter(
      work => work.side !== battalion.side && (work.kind === "wagons" || (work.kind === "stakes" && rider))
    );
    return known.lists[key];
  }

  /** Riders do not come to contact with a foe over works that bar them: they stand before stakes or wagons, or go round */
  isStaked(battle: Battle, a: Battalion, b: Battalion): boolean {
    if (!battle.field.works.length || (!this.isRider(a) && !this.isRider(b))) return false;
    const barred = (rider: Battalion, work: FieldWork): boolean => this.isRider(rider) && this.bars(work, rider);
    return Battlefields.hasWorksBetween(
      battle.field,
      [a.x, a.y],
      [b.x, b.y],
      work => barred(a, work) || barred(b, work)
    );
  }

  /** What a blow or a shot of the striker keeps of its power: half over the target's wagons, all over other works */
  getShelter(battle: Battle, striker: Battalion, target: Battalion): number {
    const wagons = (work: FieldWork): boolean => work.side === target.side && work.kind === "wagons";
    return Battlefields.hasWorksBetween(battle.field, [striker.x, striker.y], [target.x, target.y], wagons)
      ? SHELTER
      : 1;
  }

  /** The battalion is astride a ditch, of either side, the way it heads: it goes at a ford's pace till all of it is over */
  isInDitch(battle: Battle, battalion: Battalion, heading: number): boolean {
    if (!battle.field.works.length || battalion.type === "aviation") return false;
    const [dx, dy] = [(Math.cos(heading) * battalion.depth) / 2, (Math.sin(heading) * battalion.depth) / 2];
    const ditch = (work: FieldWork): boolean => work.kind === "ditch";
    return Battlefields.hasWorksBetween(
      battle.field,
      [battalion.x - dx, battalion.y - dy],
      [battalion.x + dx, battalion.y + dy],
      ditch
    );
  }

  /** Works of the target's side stand between it and the striker: a charge over them has no impetus */
  isSheltered(battle: Battle, striker: Battalion, target: Battalion): boolean {
    const own = (work: FieldWork): boolean => work.side === target.side;
    return Battlefields.hasWorksBetween(battle.field, [striker.x, striker.y], [target.x, target.y], own);
  }

  // Building

  /** Sides that may dig in: either in a field battle, the besiegers of a siege, the defenders of a landing */
  mayBuild(battle: Battle, side: Side): boolean {
    if (!WORKS.on || battle.field.open) return false;
    if (battle.type === "field") return true;
    return battle.type === (side === "attackers" ? "siege" : "landing");
  }

  /** A side that stands where it is: it neither advances, chases nor runs; besiegers do while they do not storm */
  isHolding(battle: Battle, side: Side): boolean {
    const { phase, advancing } = battle[side];
    if (battle.type === "siege" && side === "attackers") return phase === "blockade" || phase === "bombardment";
    const { chase, run } = POSTURES[battle.type][side];
    return !advancing && phase !== chase && phase !== run && phase !== SURRENDER;
  }

  /** A battalion of the first line on foot builds the stretch before its place; a Wagenburg builds wagons instead */
  isBuilder(battle: Battle, battalion: Battalion): boolean {
    const { order } = battalion;
    return (
      order.rank === 0 &&
      !order.sent &&
      (order.role === "line" || order.role === "support") &&
      this.isOnFoot(battalion) &&
      battle[battalion.side].plan.tactic !== "wagenburg" &&
      !battle[battalion.side].plan.hooks.some(hook => hook.includes(battalion.id)) && // wheeled out from the line
      !this.isAtSea(battle, battalion)
    );
  }

  /** A battalion told to fortify by hand: on foot, of a side that may build */
  mayDig(battle: Battle, battalion: Battalion): boolean {
    return this.mayBuild(battle, battalion.side) && this.isOnFoot(battalion);
  }

  private isOnFoot(battalion: Battalion): boolean {
    return (
      (battalion.kind === "melee" || battalion.kind === "ranged") &&
      battalion.type !== "naval" &&
      battalion.type !== "aviation"
    );
  }

  /** A battalion that may build wagons: in order, on foot, of the line or the reserve, or shooters in the first rank */
  private isWagoner(battle: Battle, battalion: Battalion): boolean {
    const { order } = battalion;
    return (
      battalion.status === "ready" &&
      !battalion.leaving &&
      !battalion.byHand.task &&
      !order.sent &&
      (order.role === "line" || order.role === "reserve" || (order.role === "support" && order.rank === 0)) &&
      this.isOnFoot(battalion) &&
      !battle[battalion.side].plan.hooks.some(hook => hook.includes(battalion.id))
    );
  }

  /** The stretch of wagons a battalion is to build: it goes up to it and builds there */
  getWagonJob(battle: Battle, battalion: Battalion): FieldWork | undefined {
    return battle.field.works.find(work => work.builder === battalion.id && work.kind === "wagons" && work.done < 1);
  }

  /** A battalion at the stretch it is to build: building, just come up to it, or holding off a foe there */
  private isAtWork(battle: Battle, battalion: Battalion, work: FieldWork): boolean {
    if (battalion.action === "build") return true;
    const { x, y } = this.getWorkSpot(battalion, work);
    const far = Math.hypot(battalion.x - x, battalion.y - y) / battle.field.front;
    return battalion.action === "move" ? far < ARRIVED : battalion.action === "fight" && far < AT_WORK;
  }

  /** Where a battalion stands to build a stretch: its front at the stretch's back, facing out */
  getWorkSpot(battalion: Battalion, work: FieldWork): Spot & { facing: number } {
    const facing = Math.atan2(work.b[1] - work.a[1], work.b[0] - work.a[0]) - Math.PI / 2; // the front is on the left of a → b
    const [x, y] = this.middle(work);
    const back = battalion.depth / 2 + 1;
    return { x: x - Math.cos(facing) * back, y: y - Math.sin(facing) * back, facing };
  }

  /** Where a battalion's stretch runs: across the front of its place, or of the spot it was told to fortify */
  getStretchLine(battle: Battle, battalion: Battalion): [[number, number], [number, number]] {
    const { x, y, facing } = battalion.byHand.task?.kind === "fortify" ? battalion.byHand.task : battalion.order;
    const ahead = battalion.depth / 2 + AHEAD;
    const half = (battalion.width + GAP * battle.field.front) / 2;
    const [cx, cy] = [x + Math.cos(facing) * ahead, y + Math.sin(facing) * ahead];
    const [dx, dy] = [-Math.sin(facing) * half, Math.cos(facing) * half]; // the front is on the left of a → b
    return [
      [cx - dx, cy - dy],
      [cx + dx, cy + dy]
    ];
  }

  private middle(work: { a: [number, number]; b: [number, number] }): [number, number] {
    return [(work.a[0] + work.b[0]) / 2, (work.a[1] + work.b[1]) / 2];
  }

  /** The stretch before the battalion would lie in the water: nothing is built there */
  isAtSea(battle: Battle, battalion: Battalion): boolean {
    const [a, b] = this.getStretchLine(battle, battalion);
    return Battlefields.terrainAt(battle.field, ...this.middle({ a, b })).water > 0;
  }

  /** The stretch before the battalion's place, begun or laid in advance; one left behind by a moved formation is not */
  findStretch(battle: Battle, battalion: Battalion): FieldWork | undefined {
    const [a, b] = this.getStretchLine(battle, battalion);
    const [x, y] = this.middle({ a, b });
    return battle.field.works.find(work => {
      if (work.side !== battalion.side) return false;
      const [wx, wy] = this.middle(work);
      return Math.hypot(wx - x, wy - y) < battalion.depth / 2;
    });
  }

  /** Share of a side's power in battalions of a sort, of those in order */
  private getShare(battle: Battle, side: Side, sort: (battalion: Battalion) => boolean): number {
    let some = 0;
    let all = 0;
    for (const battalion of battle.battalions) {
      if (battalion.side !== side || battalion.status !== "ready" || battalion.leaving) continue;
      const strength = battalion.troops * battalion.stats.power * battalion.stats.upkeep;
      all += strength;
      if (sort(battalion)) some += strength;
    }
    return all ? some / all : 0;
  }

  /** Ticks the side takes to build the front of its wagon line, a battalion at each stretch: the back is closed last */
  private getWagonTicks(battle: Battle, side: Side): number {
    const wagoners = battle.battalions.filter(
      battalion => battalion.side === side && this.isWagoner(battle, battalion)
    ).length;
    return Math.ceil(this.getWagonLine(battle, side, false).length / Math.max(wagoners, 1)) * BUILD_TICKS.wagons;
  }

  /**
   * The best kind a battalion of the side has done before the foe comes: wagons against a foe strong in riders and
   * shooters, a ditch against one weak in riders, else stakes; none when neither is done in time
   * @param rate share of a full battalion's work it does a tick
   * @param ticks till the foe is there
   * @param train the side's train brings wagons: not for a battalion fortifying by hand
   */
  chooseKind(battle: Battle, side: Side, rate: number, ticks: number, train = true): WorkKind | null {
    if (!rate) return null;
    const foe = BattleRules.enemyOf(side);
    const mobile =
      this.getShare(battle, foe, battalion => this.isRider(battalion) || battalion.kind === "ranged") >= STRONG;
    if (train && mobile && this.getWagonTicks(battle, side) <= ticks) return "wagons";
    if (this.getShare(battle, foe, battalion => this.isRider(battalion)) < STRONG && BUILD_TICKS.ditch / rate <= ticks)
      return "ditch";
    return BUILD_TICKS.stakes / rate <= ticks ? "stakes" : null;
  }

  /** Something of the side's works is still to be built: its wagons, or a battalion of the first line without its stretch */
  hasWorkLeft(battle: Battle, side: Side): boolean {
    const wagons = battle.field.works.filter(work => work.side === side && work.kind === "wagons");
    if (wagons.some(work => !work.up)) return true;
    if (battle[side].plan.tactic === "wagenburg") return !wagons.length && this.getRing(battle, side) !== null;
    return battle.battalions.some(battalion => {
      if (
        battalion.side !== side ||
        battalion.status !== "ready" ||
        battalion.leaving ||
        !this.isBuilder(battle, battalion)
      )
        return false;
      return !this.findStretch(battle, battalion)?.up;
    });
  }

  /** A side that stands behind works it finished at its first line */
  holdsWorks(battle: Battle, side: Side): boolean {
    const { works } = battle.field;
    if (!works.some(work => work.side === side && Battlefields.isStanding(work))) return false;
    if (battle[side].plan.tactic === "wagenburg") return true;
    return battle.battalions.some(
      battalion =>
        battalion.side === side &&
        battalion.status === "ready" &&
        this.isBuilder(battle, battalion) &&
        Boolean(this.findStretch(battle, battalion)?.up)
    );
  }

  /** A stretch its side still works on: wagons, or one before a builder's place; one left behind is not */
  private isInHand(battle: Battle, work: FieldWork): boolean {
    if (work.kind === "wagons") return true;
    return battle.battalions.some(
      battalion =>
        battalion.side === work.side &&
        battalion.status === "ready" &&
        this.isBuilder(battle, battalion) &&
        this.findStretch(battle, battalion) === work
    );
  }

  /** The foe is at a ditch or wagons: a side no weaker comes on before they stand */
  isDigging(battle: Battle, side: Side): boolean {
    return (
      battle[side].plan.fortify &&
      battle.field.works.some(
        work => work.side === side && !work.up && work.kind !== "stakes" && this.isInHand(battle, work)
      )
    );
  }

  /**
   * A tick of building: each battalion at work on its stretch of stakes or a ditch; the wagons of a fortifying side by
   * the battalions sent to them, once they have come up to them
   * @param elapsed ticks since the general reckoned when the foe comes
   */
  buildWorks(battle: Battle, elapsed: number): void {
    for (const battalion of battle.battalions) {
      if (battalion.action !== "build" || this.getWagonJob(battle, battalion)) continue;
      let work = this.findStretch(battle, battalion);
      if (!work) {
        const rate = battalion.troops / battle.battalionSize;
        const hand = battalion.byHand.task?.kind === "fortify"; // with all the time it is given
        const ticks = hand ? Infinity : battle[battalion.side].plan.arrival - elapsed;
        let kind = this.chooseKind(battle, battalion.side, rate, ticks, !hand) ?? "stakes";
        if (kind === "wagons" && !this.hasWagons(battle, battalion.side)) this.layWagons(battle, battalion.side, false);
        work = this.findStretch(battle, battalion);
        if (!work) {
          if (kind === "wagons") kind = "stakes"; // the wagon line was laid before this place
          const [a, b] = this.getStretchLine(battle, battalion);
          work = { a, b, kind, side: battalion.side, builder: battalion.id, done: 0, up: false, harm: 0 };
          battle.field.works.push(work);
        }
      }
      if (work.kind !== "wagons")
        work.done = this.advance(work.done, battalion.troops / battle.battalionSize / BUILD_TICKS[work.kind]);
    }
    for (const side of SIDES) {
      const { plan } = battle[side];
      if (!plan.fortify) continue;
      if (plan.tactic === "wagenburg" && !this.hasWagons(battle, side)) this.layRing(battle, side, false);
      const left = battle.field.works.filter(work => work.side === side && work.kind === "wagons" && work.done < 1);
      const wagoners = battle.battalions.filter(
        battalion => battalion.side === side && this.isWagoner(battle, battalion)
      );
      const busy = new Map<Battalion, { spot: Spot; left: number }>(); // where each builder stands, ticks its stretch takes yet
      for (const work of left) {
        const builder = wagoners.find(battalion => battalion.id === work.builder);
        if (!builder) work.builder = null;
        else {
          if (this.isAtWork(battle, builder, work)) work.done = this.advance(work.done, 1 / BUILD_TICKS.wagons);
          const spot = this.getWorkSpot(builder, work);
          if (work.done < 1) busy.set(builder, { spot, left: (1 - work.done) * BUILD_TICKS.wagons }); // done: free at once
        }
      }
      this.sendWagoners(battle, left, wagoners, busy);
    }
  }

  /**
   * Who builds the stretches of wagons nobody builds: the battalion that could begin it soonest, the walk there and what
   * it is at now, from the next tick. A stretch waits for a busy one, and for a builder standing where it would stand.
   * The first line builds only before its places while the side has others to send: they lay the rest
   */
  private sendWagoners(
    battle: Battle,
    left: FieldWork[],
    wagoners: Battalion[],
    busy: Map<Battalion, { spot: Spot; left: number }>
  ): void {
    const open = left.filter(work => work.builder === null);
    if (!open.length) return;
    const spare = wagoners.some(battalion => battalion.order.rank > 0);
    const reach = AT_WORK * battle.field.front;
    const pairs = open.flatMap(work =>
      wagoners
        .filter(battalion => battalion.action !== "fight")
        .map(battalion => {
          const spot = this.getWorkSpot(battalion, work);
          const from = busy.get(battalion)?.spot ?? battalion;
          const walk = Math.hypot(from.x - spot.x, from.y - spot.y) / Movement.getPace(battle, battalion);
          return { work, battalion, spot, ticks: walk + (busy.get(battalion)?.left ?? 0) };
        })
        .filter(
          ({ battalion, spot }) =>
            !spare ||
            battalion.order.rank > 0 ||
            Math.hypot(battalion.order.x - spot.x, battalion.order.y - spot.y) < reach
        )
    );
    pairs.sort((a, b) => a.ticks - b.ticks);
    const decided = new Set<FieldWork>();
    for (const { work, battalion, spot } of pairs) {
      if (decided.has(work)) continue;
      decided.add(work);
      const apart = ([other, { spot: at }]: [Battalion, { spot: Spot }]): boolean =>
        Math.hypot(spot.x - at.x, spot.y - at.y) >= ((battalion.width + other.width) / 2) * CROWD;
      if (busy.has(battalion) || ![...busy].every(apart)) continue;
      work.builder = battalion.id;
      busy.set(battalion, { spot, left: BUILD_TICKS.wagons });
    }
  }

  private hasWagons(battle: Battle, side: Side): boolean {
    return battle.field.works.some(work => work.side === side && work.kind === "wagons");
  }

  /** Work done after a tick more of it: fifteen fifteenths make a whole */
  private advance(done: number, step: number): number {
    return done + step > 1 - 1e-9 ? 1 : done + step;
  }

  /**
   * Stretches finished in the last round stand from now on, all at once; the log says when a side's last one does.
   * True when one of them bars the way to somebody: the ways are to be found anew
   */
  raiseWorks(battle: Battle): boolean {
    let barring = false;
    const raised = new Map<Side, WorkKind>();
    for (const work of battle.field.works) {
      if (work.up || work.done < 1) continue;
      work.up = true;
      raised.set(work.side, work.kind);
      if (work.kind !== "ditch") barring = true;
    }
    for (const [side, kind] of raised) {
      if (battle.field.works.some(work => work.side === side && !work.up && this.isInHand(battle, work))) continue;
      battle.log.push({ tick: battle.tick, event: "fortified", side, params: { kind } });
    }
    return barring;
  }

  /**
   * Each engine in range of the foe's wagons knocks a wagon out of the stretch nearest it, one a round: `GAP_WAGONS` of
   * them open a gap troops get in by. True when one opens
   */
  breakWagons(battle: Battle): boolean {
    let broken = false;
    for (const side of SIDES) {
      if (BattleRules.isBeaten(battle.type, side, battle[side].phase)) continue; // a side on the run or giving itself up batters nothing
      for (const engine of battle.battalions) {
        if (engine.side !== side) continue;
        const work = this.getBattered(battle, engine);
        if (!work) continue;
        work.harm = Math.min(work.harm + 1 / GAP_WAGONS, 1);
        battle.lastLoss = battle.tick; // no lull while the engines are at the wagons
        if (work.harm < 1) continue;
        broken = true;
        battle.log.push({ tick: battle.tick, event: "gap", side: work.side });
      }
    }
    return broken;
  }

  /** The stretch of the foe's wagons an engine shells: the standing one nearest it in its reach, that it sees */
  getBattered(battle: Battle, engine: Battalion): FieldWork | null {
    if (engine.status !== "ready" || engine.leaving || engine.kind !== "machinery") return null;
    if (BattleRules.isBeaten(battle.type, engine.side, battle[engine.side].phase)) return null;
    const reach = Sight.getReach(battle, engine);
    const far = (work: FieldWork): number =>
      Math.hypot(this.middle(work)[0] - engine.x, this.middle(work)[1] - engine.y);
    return battle.field.works
      .filter(
        work =>
          work.side !== engine.side && work.kind === "wagons" && Battlefields.isStanding(work) && far(work) <= reach
      )
      .reduce<FieldWork | null>((a, b) => (a && far(a) <= far(b) ? a : b), null);
  }

  /** Works laid in advance before a side's places: what its rule would build with all the time there is */
  layWorks(battle: Battle, side: Side): void {
    if (battle[side].plan.tactic === "wagenburg") {
      this.layRing(battle, side, true);
      return;
    }
    const kind = this.chooseKind(battle, side, 1, Infinity)!;
    if (kind === "wagons") {
      this.layWagons(battle, side, true);
      return;
    }
    for (const battalion of battle.battalions) {
      if (battalion.side !== side || battalion.status !== "ready" || !this.isBuilder(battle, battalion)) continue;
      const [a, b] = this.getStretchLine(battle, battalion);
      battle.field.works.push({ a, b, kind, side, builder: null, done: 1, up: true, harm: 0 });
    }
  }

  /** A wagon line: a stretch before each battalion of the first line, and at each end turned back to a half circle */
  private layWagons(battle: Battle, side: Side, done: boolean): void {
    for (const [a, b] of this.getWagonLine(battle, side))
      battle.field.works.push({ a, b, kind: "wagons", side, builder: null, done: +done, up: done, harm: 0 });
  }

  /**
   * Where a side's wagon line runs: its stretches before the battalions of the first line, closed where neighbours do not
   * stand level (a crescent, a brow): a small step is taken up by the next stretch, a larger one by a stretch of its own
   */
  private getWagonLine(battle: Battle, side: Side, closed = true): [Point, Point][] {
    const { field } = battle;
    const line = battle.battalions
      .filter(battalion => battalion.side === side && battalion.status === "ready" && this.isBuilder(battle, battalion))
      .map(battalion => this.getStretchLine(battle, battalion));
    if (!line.length) return [];
    // along the line by the way its stretches run: the front is on the left of a → b, the back on the right
    const [ux, uy] = line
      .reduce(([x, y], [a, b]) => [x + b[0] - a[0], y + b[1] - a[1]], [0, 0])
      .map((value, _, [x, y]) => value / (Math.hypot(x, y) || 1));
    line.sort(([a], [b]) => a[0] * ux + a[1] * uy - (b[0] * ux + b[1] * uy));
    const stretches: [Point, Point][] = [];
    for (const [a, b] of line) {
      const end = stretches.at(-1)?.[1];
      const step = end ? Math.hypot(a[0] - end[0], a[1] - end[1]) : 0;
      if (!end || battle.type === "siege")
        stretches.push([a, b]); // siege lines ring a burg in: no line to close
      else if (step > AHEAD) stretches.push([end, a], [a, b]);
      else stretches.push([end, b]);
    }
    const onLand = (point: Point): boolean =>
      point[0] > 0 &&
      point[1] > 0 &&
      point[0] < field.width &&
      point[1] < field.height &&
      !Battlefields.terrainAt(field, ...point).water;
    const tails: Point[] = []; // where each end's wagons stop, the right end's first
    for (const end of [1, -1]) {
      const [a, b] = end > 0 ? line.at(-1)! : line[0];
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const [vx, vy] = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
      let from = end > 0 ? b : a;
      const bends = this.getBends(battle);
      for (const turn of bends) {
        // round to the back, the front out: on from `b` along the line, back from `a` against it
        const [cos, sin] = [Math.cos(turn), Math.sin(turn * end)];
        const [dx, dy] = [vx * cos - vy * sin, vy * cos + vx * sin];
        const to: Point = [from[0] + dx * length * end, from[1] + dy * length * end];
        if (!onLand(this.middle({ a: from, b: to }))) break;
        stretches.push(end > 0 ? [from, to] : [to, from]);
        from = to;
      }
      if (bends.length) tails.push(from);
    }
    if (closed && tails.length === 2 && this.isRidden(battle, side)) this.closeWagons(battle, side, tails, stretches);
    return stretches;
  }

  /** The foe is strong in riders: a wagon line closes behind the side, or they ride round it into its back */
  private isRidden(battle: Battle, side: Side): boolean {
    return this.getShare(battle, BattleRules.enemyOf(side), battalion => this.isRider(battalion)) >= STRONG;
  }

  /**
   * Close a wagon line behind the side: from the ends of its half circle straight back past the rearmost of its places,
   * then across, pulled in where that runs off the field. No wagons are laid in water: it closes the ring there
   */
  private closeWagons(battle: Battle, side: Side, [right, left]: Point[], stretches: [Point, Point][]): void {
    const { field } = battle;
    const { heading } = battle[side].plan;
    const [bx, by] = [-Math.cos(heading), -Math.sin(heading)]; // to the back
    const [a, b] = stretches[0];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const depth = (point: Point): number => point[0] * bx + point[1] * by;
    const rear =
      Math.max(
        ...battle.battalions
          .filter(battalion => battalion.side === side && battalion.status === "ready")
          .map(battalion => depth([battalion.order.x, battalion.order.y]) + battalion.depth / 2)
      ) + AHEAD;
    const margin = field.front / 4;
    const inside = ([x, y]: Point): Point => [
      Math.min(Math.max(x, margin), field.width - margin),
      Math.min(Math.max(y, margin), field.height - margin)
    ];
    const back = (point: Point): Point => {
      const behind = Math.max(rear - depth(point), 0);
      return inside([point[0] + bx * behind, point[1] + by * behind]);
    };
    // round the ring the way the half circle goes: on from the right end, back, across, and up to the left end
    const corners = [right, back(right), back(left), left];
    for (let i = 1; i < corners.length; i++) {
      const [from, to] = [corners[i - 1], corners[i]];
      const count = Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1]) / length);
      for (let j = 0; j < count; j++) {
        const at = (k: number): Point => [
          from[0] + ((to[0] - from[0]) * k) / count,
          from[1] + ((to[1] - from[1]) * k) / count
        ];
        const work = { a: at(j), b: at(j + 1) };
        if (!Battlefields.terrainAt(field, ...this.middle(work)).water) stretches.push([work.a, work.b]);
      }
    }
  }

  /**
   * Where the wagons of a Wagenburg go: about each battalion standing on its ring, by the angle from the middle of them
   * where they stand now, moved by hand or not; none for fewer than three
   */
  private getRing(battle: Battle, side: Side): { centre: Point; spots: { angle: number; radius: number }[] } | null {
    const battalions = battle.battalions.filter(
      battalion => battalion.side === side && battalion.status === "ready" && battalion.order.rank === 0
    );
    if (battalions.length < 3) return null;
    const cx = battalions.reduce((sum, battalion) => sum + battalion.order.x, 0) / battalions.length;
    const cy = battalions.reduce((sum, battalion) => sum + battalion.order.y, 0) / battalions.length;
    const spots = battalions
      .map(battalion => {
        const { x, y } = battalion.order;
        const angle = Math.atan2(y - cy, x - cx);
        // out past the corners of its front: a battalion stands wholly within the wagons
        const radius = Math.hypot(Math.hypot(x - cx, y - cy) + battalion.depth / 2, battalion.width / 2) + AHEAD;
        return { angle, radius };
      })
      .sort((a, b) => a.angle - b.angle);
    return { centre: [cx, cy], spots };
  }

  /** A wagon ring round a Wagenburg: a stretch before each battalion standing on it, joined end to end */
  private layRing(battle: Battle, side: Side, done: boolean): void {
    const found = this.getRing(battle, side);
    if (!found) return;
    const {
      centre: [cx, cy],
      spots: ring
    } = found;
    // a gap wider than a third of the ring gets spots of its own, so no corner lies too far out to close it
    const spots = ring.flatMap((spot, i) => {
      const next = ring[(i + 1) % ring.length];
      const turn = i === ring.length - 1 ? Math.PI * 2 + next.angle - spot.angle : next.angle - spot.angle;
      const parts = Math.max(Math.ceil(turn / MOST_TURN - 1e-9), 1);
      const radius = Math.max(spot.radius, next.radius);
      return [
        spot,
        ...Array.from({ length: parts - 1 }, (_, k) => ({ angle: spot.angle + (turn * (k + 1)) / parts, radius }))
      ];
    });
    // each spot's stretch square to it at its radius, the corners between neighbours, a step across where the radii differ;
    // the front of a stretch is on its left
    const corners = spots.flatMap((spot, i): [number, number][] => {
      const next = spots[(i + 1) % spots.length];
      const turn = (next.angle - spot.angle + Math.PI * 2) % (Math.PI * 2);
      const angle = spot.angle + turn / 2;
      const at = (radius: number): [number, number] => [
        cx + (Math.cos(angle) * radius) / Math.cos(turn / 2),
        cy + (Math.sin(angle) * radius) / Math.cos(turn / 2)
      ];
      return Math.abs(spot.radius - next.radius) < 0.01 ? [at(spot.radius)] : [at(spot.radius), at(next.radius)];
    });
    corners.forEach((b, i) => {
      const a = corners[(i - 1 + corners.length) % corners.length];
      battle.field.works.push({ a, b, kind: "wagons", side, builder: null, done: +done, up: done, harm: 0 });
    });
  }
}

export const Works = new WorksModule();
