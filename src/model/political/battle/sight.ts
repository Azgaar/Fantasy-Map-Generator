// What battalions see: as far as the light and the sky let them, a foe in cover or lying in wait nearer, one with
// torches lit in the dark further. The generals see all. See docs/domain/battles.md#sight

import type { Battalion, Battle } from "./battle";
import type { Side } from "./battle-rules";
import { Battlefields } from "./battlefield";
import { ROUND_TICKS } from "./movement";
import { BattleTime } from "./time";
import { SKIES } from "./weather";

const NIGHT = 120; // metres a battalion sees at night under a clear sky
const CLOSE = 30; // whatever the light, so near is always seen: who is at grips knows his foe
const COVER = 0.5; // woods and houses hide a battalion in them so much
const STILL = 0.5; // and lying still in wait
const TORCH = 1.5; // torches carried in the dark show a battalion so much further

class SightModule {
  private readonly known = new WeakMap<Battle, { round: number; sides: Record<Side, Set<number>> }>();
  // asked for at every turn of a tick: the last battle's answer is kept, the battle itself not, so a closed one is freed
  private last = {
    battle: null as WeakRef<Battle> | null,
    tick: -1,
    hour: -1,
    weather: "",
    daylight: 1,
    limited: false
  };

  /** Whether sight is short at all: by day under a clear sky everybody sees the whole field */
  isLimited(battle: Battle): boolean {
    return this.remember(battle).limited;
  }

  /** How far a battalion sees a foe standing in the open, with its torches lit or dark: the dark and the murk add up */
  getSight(battle: Battle, lit = false): number {
    const daylight = this.getDaylight(battle);
    const dark = daylight >= 1 ? 0 : (1 - daylight) ** 2 / (NIGHT * (lit ? TORCH : 1));
    return Math.max(1 / (dark + 1 / SKIES[battle.weather].sight), CLOSE);
  }

  /** How far a foe is seen: nearer in woods or houses and lying in wait, further with its torches lit in the dark */
  getSeenAt(battle: Battle, foe: Battalion): number {
    if (!this.isLimited(battle)) return Infinity;
    const node = Battlefields.nodeAt(battle.field, foe.x, foe.y);
    const covered = battle.field.wood[node] || battle.field.burg[node] ? COVER : 1;
    const still = this.isLying(battle, foe) ? STILL : 1;
    return Math.max(this.getSight(battle, this.isLit(battle, foe)) * covered * still, CLOSE);
  }

  /** How far troops lying in wait are seen, in the open or in cover: where ambushers may lie unseen */
  getSeenLying(battle: Battle, covered: boolean): number {
    return this.isLimited(battle) ? Math.max(this.getSight(battle) * STILL * (covered ? COVER : 1), CLOSE) : Infinity;
  }

  /** A battalion sees a foe itself */
  sees(battle: Battle, battalion: Battalion, foe: Battalion): boolean {
    return Math.hypot(foe.x - battalion.x, foe.y - battalion.y) <= this.getSeenAt(battle, foe);
  }

  /** What a battalion knows of a foe: what it sees, what friends saw last round, and whom it is pointed at */
  knows(battle: Battle, battalion: Battalion, foe: Battalion): boolean {
    if (!this.isLimited(battle)) return true;
    if (battalion.order.target === foe.id || battalion.byHand.task?.target === foe.id) return true;
    return this.getKnown(battle, battalion.side).has(foe.id) || this.sees(battle, battalion, foe);
  }

  /** How far a battalion's shots reach with the light and the sky shortening them: at a foe with torches lit, or without */
  getReach(battle: Battle, battalion: Battalion, lit = false): number {
    if (!this.isLimited(battle)) return battalion.stats.range;
    return Math.min(battalion.stats.range, this.getSight(battle, lit));
  }

  /** In the dark every battalion carries torches but those lying in wait and stormers stealing up to the walls */
  isLit(battle: Battle, battalion: Battalion): boolean {
    if (this.getDaylight(battle) >= 1 || this.isLying(battle, battalion)) return false;
    return !(battle.type === "siege" && battalion.side === "attackers" && battle.attackers.phase === "storming");
  }

  /** Ambushers keep still and dark where they lie till the first blow is struck */
  private isLying(battle: Battle, battalion: Battalion): boolean {
    return (
      battle.type === "ambush" &&
      battalion.side === "defenders" &&
      battle.engaged === null &&
      battalion.action === "hold"
    );
  }

  /** The foes a side's battalions in order saw at the start of the round, word of them passed along the line */
  private getKnown(battle: Battle, side: Side): Set<number> {
    const round = Math.floor(battle.tick / ROUND_TICKS);
    let known = this.known.get(battle);
    if (!known || known.round !== round) {
      const sides = { attackers: new Set<number>(), defenders: new Set<number>() };
      const present = battle.battalions.filter(
        battalion => battalion.status === "ready" || battalion.status === "routed"
      );
      for (const battalion of present) {
        if (battalion.status !== "ready") continue;
        for (const foe of present)
          if (foe.side !== battalion.side && this.sees(battle, battalion, foe)) sides[battalion.side].add(foe.id);
      }
      known = { round, sides };
      this.known.set(battle, known);
    }
    return known.sides[side];
  }

  private getDaylight(battle: Battle): number {
    return this.remember(battle).daylight;
  }

  private remember(battle: Battle) {
    const { last } = this;
    if (
      last.battle?.deref() === battle &&
      last.tick === battle.tick &&
      last.hour === battle.hour &&
      last.weather === battle.weather
    )
      return last;
    const daylight = BattleTime.getDaylight(BattleTime.getTime(battle.hour, battle.tick));
    const limited = Number.isFinite(SKIES[battle.weather].sight) || daylight < 1;
    this.last = {
      battle: new WeakRef(battle),
      tick: battle.tick,
      hour: battle.hour,
      weather: battle.weather,
      daylight,
      limited
    };
    return this.last;
  }
}

export const Sight = new SightModule();
