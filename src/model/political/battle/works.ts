// Field works: stakes, a ditch, a wagon ring. Lines on the field before a side's first line that hinder its foes and
// shelter it. All their rules are here. See docs/domain/battles.md#works.

import type { Battle, Block } from "./battle";
import { BUILD_TICKS, SHELTER } from "./battle-balance";
import { BattleRules, POSTURES, SIDES, type Side, SURRENDER } from "./battle-rules";
import { Battlefields, type FieldWork, type WorkKind } from "./battlefield";
import { GAP } from "./formations";
import type { Point } from "./movement";
import { Sight } from "./sight";

/** Works are part of the battle; tests switch them off to compare with the battle without them */
export const WORKS = { on: true };

const AHEAD = 6; // metres a stretch stands ahead of its battalion's front: at grips it lies between the two
const STRONG = 1 / 3; // share of a foe's power that makes it strong in riders (stakes, not a ditch), or riders and shooters (wagons)
const AT_ONCE = 3; // stretches of wagons the train builds at once
const BENDS = [Math.PI / 4, Math.PI / 2]; // turns back of a wagon line at its ends, to a half circle
const MOST_TURN = (Math.PI * 2) / 3; // between neighbours on a wagon ring
export const GAP_WAGONS = 2; // wagons knocked out of a stretch, one a shot, that open a gap troops get in by

/** Ticks a full battalion takes to build a stretch; wagons are the side's train's, a few stretches at once */

class WorksModule {
  private readonly barring = new WeakMap<FieldWork[], { length: number; lists: FieldWork[][] }>(); // by side and riding; works only ever join the list

  /** How a wagon line turns back at its ends; siege lines ring a burg in and do not */
  private getBends(battle: Battle): number[] {
    return battle.type === "siege" ? [] : BENDS;
  }

  /** Who stakes stop: troops on horse */
  isRider(block: Block): boolean {
    return block.type === "mounted";
  }

  /** Whether the stretch stops the block crossing it: wagons the foe, stakes the foe's riders; a side's own never */
  bars(work: FieldWork, block: Block): boolean {
    if (work.side === block.side || block.type === "aviation" || !Battlefields.isStanding(work)) return false;
    return work.kind === "wagons" || (work.kind === "stakes" && this.isRider(block));
  }

  /** A work that stands between two points and stops the block going from one to the other */
  isBarredByWorks(battle: Battle, block: Block, from: [number, number], to: [number, number]): boolean {
    return (
      battle.field.works.length > 0 &&
      block.type !== "aviation" &&
      Battlefields.crossesStanding(this.getBarring(battle, block), from, to)
    );
  }

  /** The works that bar the block while they stand: the wagons of its foe, and the foe's stakes when it rides */
  private getBarring(battle: Battle, block: Block): FieldWork[] {
    const { works } = battle.field;
    let known = this.barring.get(works);
    if (known?.length !== works.length) {
      known = { length: works.length, lists: [] };
      this.barring.set(works, known);
    }
    const rider = this.isRider(block);
    const key = (block.side === "attackers" ? 0 : 2) + +rider;
    known.lists[key] ??= works.filter(
      work => work.side !== block.side && (work.kind === "wagons" || (work.kind === "stakes" && rider))
    );
    return known.lists[key];
  }

  /** Riders do not come to contact with a foe over works that bar them: they stand before stakes or wagons, or go round */
  isStaked(battle: Battle, a: Block, b: Block): boolean {
    if (!battle.field.works.length || (!this.isRider(a) && !this.isRider(b))) return false;
    const barred = (rider: Block, work: FieldWork): boolean => this.isRider(rider) && this.bars(work, rider);
    return Battlefields.hasWorksBetween(
      battle.field,
      [a.x, a.y],
      [b.x, b.y],
      work => barred(a, work) || barred(b, work)
    );
  }

  /** What a blow or a shot of the striker keeps of its power: half over the target's wagons, all over other works */
  getShelter(battle: Battle, striker: Block, target: Block): number {
    const wagons = (work: FieldWork): boolean => work.side === target.side && work.kind === "wagons";
    return Battlefields.hasWorksBetween(battle.field, [striker.x, striker.y], [target.x, target.y], wagons)
      ? SHELTER
      : 1;
  }

  /** The block is astride a ditch, of either side, the way it heads: it goes at a ford's pace till all of it is over */
  isInDitch(battle: Battle, block: Block, heading: number): boolean {
    if (!battle.field.works.length || block.type === "aviation") return false;
    const [dx, dy] = [(Math.cos(heading) * block.depth) / 2, (Math.sin(heading) * block.depth) / 2];
    const ditch = (work: FieldWork): boolean => work.kind === "ditch";
    return Battlefields.hasWorksBetween(
      battle.field,
      [block.x - dx, block.y - dy],
      [block.x + dx, block.y + dy],
      ditch
    );
  }

  /** Works of the target's side stand between it and the striker: a charge over them has no impetus */
  isSheltered(battle: Battle, striker: Block, target: Block): boolean {
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
  isBuilder(battle: Battle, block: Block): boolean {
    const { order } = block;
    return (
      order.rank === 0 &&
      !order.sent &&
      (order.role === "line" || order.role === "support") &&
      this.isOnFoot(block) &&
      battle[block.side].plan.tactic !== "wagenburg" &&
      !battle[block.side].plan.hooks.some(hook => hook.includes(block.id)) && // wheeled out from the line
      !this.isAtSea(battle, block)
    );
  }

  /** A battalion told to fortify by hand: on foot, of a side that may build */
  mayDig(battle: Battle, block: Block): boolean {
    return this.mayBuild(battle, block.side) && this.isOnFoot(block);
  }

  private isOnFoot(block: Block): boolean {
    return (block.kind === "melee" || block.kind === "ranged") && block.type !== "naval" && block.type !== "aviation";
  }

  /** Where a battalion's stretch runs: across the front of its place, or of the spot it was told to fortify */
  getStretchLine(battle: Battle, block: Block): [[number, number], [number, number]] {
    const { x, y, facing } = block.task?.kind === "fortify" ? block.task : block.order;
    const ahead = block.depth / 2 + AHEAD;
    const half = (block.width + GAP * battle.field.front) / 2;
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
  isAtSea(battle: Battle, block: Block): boolean {
    const [a, b] = this.getStretchLine(battle, block);
    return Battlefields.terrainAt(battle.field, ...this.middle({ a, b })).water > 0;
  }

  /** The stretch before the battalion's place, begun or laid in advance; one left behind by a moved formation is not */
  findStretch(battle: Battle, block: Block): FieldWork | undefined {
    const [a, b] = this.getStretchLine(battle, block);
    const [x, y] = this.middle({ a, b });
    return battle.field.works.find(work => {
      if (work.side !== block.side) return false;
      const [wx, wy] = this.middle(work);
      return Math.hypot(wx - x, wy - y) < block.depth / 2;
    });
  }

  /** Share of a side's power in battalions of a sort, of those in order */
  private getShare(battle: Battle, side: Side, sort: (block: Block) => boolean): number {
    let some = 0;
    let all = 0;
    for (const block of battle.blocks) {
      if (block.side !== side || block.status !== "ready" || block.leaving) continue;
      const strength = block.troops * block.unitPower * block.upkeep;
      all += strength;
      if (sort(block)) some += strength;
    }
    return all ? some / all : 0;
  }

  /** Ticks the train takes to build the front of the side's wagon line, a few stretches at once: the back is closed last */
  private getWagonTicks(battle: Battle, side: Side): number {
    return Math.ceil(this.getWagonLine(battle, side, false).length / AT_ONCE) * BUILD_TICKS.wagons;
  }

  /**
   * The best kind a battalion of the side has done before the foe comes: wagons against a foe strong in riders and
   * shooters, a ditch against one weak in riders, else stakes; none when neither is done in time
   * @param rate share of a full battalion's work it does a tick
   * @param ticks till the foe is there
   * @param train the side's train builds wagons: not for a battalion fortifying by hand
   */
  chooseKind(battle: Battle, side: Side, rate: number, ticks: number, train = true): WorkKind | null {
    if (!rate) return null;
    const foe = BattleRules.enemyOf(side);
    const mobile = this.getShare(battle, foe, block => this.isRider(block) || block.kind === "ranged") >= STRONG;
    if (train && mobile && this.getWagonTicks(battle, side) <= ticks) return "wagons";
    if (this.getShare(battle, foe, block => this.isRider(block)) < STRONG && BUILD_TICKS.ditch / rate <= ticks)
      return "ditch";
    return BUILD_TICKS.stakes / rate <= ticks ? "stakes" : null;
  }

  /** Something of the side's works is still to be built: its wagons, or a battalion of the first line without its stretch */
  hasWorkLeft(battle: Battle, side: Side): boolean {
    const wagons = battle.field.works.filter(work => work.side === side && work.kind === "wagons");
    if (wagons.some(work => !work.up)) return true;
    if (battle[side].plan.tactic === "wagenburg") return !wagons.length && this.getRing(battle, side) !== null;
    return battle.blocks.some(block => {
      if (block.side !== side || block.status !== "ready" || block.leaving || !this.isBuilder(battle, block))
        return false;
      return !this.findStretch(battle, block)?.up;
    });
  }

  /** A side that stands behind works it finished at its first line */
  holdsWorks(battle: Battle, side: Side): boolean {
    const { works } = battle.field;
    if (!works.some(work => work.side === side && Battlefields.isStanding(work))) return false;
    if (battle[side].plan.tactic === "wagenburg") return true;
    return battle.blocks.some(
      block =>
        block.side === side &&
        block.status === "ready" &&
        this.isBuilder(battle, block) &&
        Boolean(this.findStretch(battle, block)?.up)
    );
  }

  /** A stretch its side still works on: wagons, the train's, or one before a builder's place; one left behind is not */
  private isInHand(battle: Battle, work: FieldWork): boolean {
    if (work.kind === "wagons") return true;
    return battle.blocks.some(
      block =>
        block.side === work.side &&
        block.status === "ready" &&
        this.isBuilder(battle, block) &&
        this.findStretch(battle, block) === work
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
   * A tick of building: each battalion at work on its stretch of stakes or a ditch, the train of a fortifying side on its
   * wagons, a few stretches at once
   * @param elapsed ticks since the general reckoned when the foe comes
   */
  buildWorks(battle: Battle, elapsed: number): void {
    for (const block of battle.blocks) {
      if (block.action !== "build") continue;
      let work = this.findStretch(battle, block);
      if (!work) {
        const rate = block.troops / battle.battalion;
        const hand = block.task?.kind === "fortify"; // with all the time it is given
        const ticks = hand ? Infinity : battle[block.side].plan.arrival - elapsed;
        let kind = this.chooseKind(battle, block.side, rate, ticks, !hand) ?? "stakes";
        if (kind === "wagons" && !this.hasWagons(battle, block.side)) this.layWagons(battle, block.side, false);
        work = this.findStretch(battle, block);
        if (!work) {
          if (kind === "wagons") kind = "stakes"; // the train laid its line before this place
          const [a, b] = this.getStretchLine(battle, block);
          work = { a, b, kind, side: block.side, builder: block.id, done: 0, up: false, harm: 0 };
          battle.field.works.push(work);
        }
      }
      if (work.kind !== "wagons")
        work.done = this.advance(work.done, block.troops / battle.battalion / BUILD_TICKS[work.kind]);
    }
    for (const side of SIDES) {
      const { plan } = battle[side];
      if (!plan.fortify) continue;
      if (plan.tactic === "wagenburg" && !this.hasWagons(battle, side)) this.layRing(battle, side, false);
      const pending = battle.field.works
        .filter(work => work.side === side && work.kind === "wagons" && work.done < 1)
        .sort((a, b) => b.done - a.done) // those begun first
        .slice(0, AT_ONCE);
      for (const work of pending) work.done = this.advance(work.done, 1 / BUILD_TICKS.wagons);
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
      for (const engine of battle.blocks) {
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
  getBattered(battle: Battle, engine: Block): FieldWork | null {
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
    for (const block of battle.blocks) {
      if (block.side !== side || block.status !== "ready" || !this.isBuilder(battle, block)) continue;
      const [a, b] = this.getStretchLine(battle, block);
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
    const line = battle.blocks
      .filter(block => block.side === side && block.status === "ready" && this.isBuilder(battle, block))
      .map(block => this.getStretchLine(battle, block));
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
    return this.getShare(battle, BattleRules.enemyOf(side), block => this.isRider(block)) >= STRONG;
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
        ...battle.blocks
          .filter(block => block.side === side && block.status === "ready")
          .map(block => depth([block.order.x, block.order.y]) + block.depth / 2)
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
    const blocks = battle.blocks.filter(
      block => block.side === side && block.status === "ready" && block.order.rank === 0
    );
    if (blocks.length < 3) return null;
    const cx = blocks.reduce((sum, block) => sum + block.order.x, 0) / blocks.length;
    const cy = blocks.reduce((sum, block) => sum + block.order.y, 0) / blocks.length;
    const spots = blocks
      .map(block => {
        const { x, y } = block.order;
        const angle = Math.atan2(y - cy, x - cx);
        // out past the corners of its front: a battalion stands wholly within the wagons
        const radius = Math.hypot(Math.hypot(x - cx, y - cy) + block.depth / 2, block.width / 2) + AHEAD;
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
