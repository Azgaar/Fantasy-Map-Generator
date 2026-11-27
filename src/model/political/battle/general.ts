// The side level: a general appraises the field, picks a tactic, draws the troops up and gives orders
import { least, sum } from "d3";
import type { Point } from "@/types/global";
import { Battalions } from "./battalion";
import type { Battalion, Battle, GeneralChoice, Muster, Order, Plan, Wedge } from "./battle";
import {
  ASSAULT_ODDS,
  BOLD,
  BREACH_BLOWS,
  BREACHES,
  CHARGE,
  CONTACT,
  COUNTER,
  DUPED,
  KEEN,
  KILL_RATE,
  REPULSED,
  RING_BATTALIONS,
  RING_ODDS,
  SHAKEN,
  STARVED,
  STORM_ODDS,
  WARY
} from "./battle-balance";
import {
  BattleRules,
  COMMANDS,
  type Command,
  FEINT,
  type Phase,
  POSTURES,
  SIDES,
  type Side,
  SURRENDER
} from "./battle-rules";
import { COLS, ROWS } from "./battle-scale";
import { type Battlefield, Battlefields, type FieldBurg, type FieldWall, type WallPost } from "./battlefield";
import { Formations, GAP, type Place, ROLES, ROW_GAP, TACTICS, type TacticName } from "./formations";
import { Movement, PACE, ROUND_TICKS } from "./movement";
import { Pathfinding } from "./pathfinding";
import { Sight } from "./sight";
import { Works } from "./works";

const SORTIE_ROUNDS = 8; // a sortie at engines is out so long once it goes for them
const MUSTER_ROUNDS = [2, 8]; // a sortie waits so long at least and at most to form up outside the walls
const MUSTER_SLACK = 1.5; // and half as long again as the march of its slowest battalion takes

// in metres
const BOWSHOT = 205; // what the besiegers keep out of when the garrison has no shooters
const RING = 340; // and how far out of the walls they stand at most
const RING_GAP = 14; // metres beyond the garrison's reach the ring stands
const WATCH = 70; // how much further than the ring stands from the walls a besieger keeps a gate shut
const BROW = 1; // how much better the ground has to be for a place of a line to bend to it
const AMBUSH = [45, 120]; // how far from the column ambushers lie: a javelin's throw under trees, within their own bowshot in the open
const APPROACH = 3; // sights apart the sides form up at most in the dark or the murk
const CHARGE_CLEAR = 0.5; // fronts beyond its own charge a line standing off halts, so it does not go in by itself
const AHEAD_MOST = 2; // fronts before the first line shooters step out to at most to stand off
const STAND_OFF = 0.8; // of its sight of the foe's line a formation that stands off halts within: it shoots at what it sees
const WALLS_SEEN = 200; // metres: walls tell fully against stormers seen so far off, less the nearer they are first seen
const DARK_WALLS = 0.5; // and no less than so much
const SORTIE = 400; // how far from the burg a sortie goes

// in battalion fronts
const WARD = 3.4; // how near the shooters or engines it goes for a foe has to be for friends to come to their aid
const LEAST_HALF = 0.45; // half the first line, at the least
const STEP_IN = 0.45; // riders kept off trees and bogs close in to the line by so much at a time
const AHEAD = 0.45; // what a place ahead costs a battalion put out of water it shuns: rather back than forward
const WING = 0.7; // a foe so far from the middle of the line is on a wing
const LEVEL = 0.7; // so near the line or the place, a battalion counts as level with it
const APART = 0.7; // garrison battalions keep so far apart in the streets
const ON_WALLS = 0.5; // of the line troops not holding a gate, the share that man the walls; the rest stand in the streets
const AT_WALLS = 1.5; // fronts from a post a stormer comes at it: a battalion in the streets goes up to hold it
const MUSTER_OUT = 1; // the nearest row of a sortie forms up so far out of the gate
const MUSTER_ROW = 4; // battalions abreast at most
const MUSTER_FURTHEST = 3; // fronts further out of the gate a sortie may form up to find room
const MUSTER_MET = 1.5; // a foe so near a battalion of a sortie forming up: it goes at once
const MUSTERED = 0.5; // so near its place a battalion of a sortie has formed up
const MUSTER_CLEAR = 1.75; // fronts a place of a sortie forming up keeps from the foe: beyond its reach to meet them
const BEYOND = 1.15; // the ground beyond the ends of a line that covers them
const BANK = 1.7; // a line holding a crossing stands so far behind its bank
const STALLED = 4; // rounds an advancing side comes no nearer on a field with cliffs before it goes in
const DECLINED = 8; // rounds attackers that will not go in, with nobody coming at them, stand off before they leave the field
const FEINT_AFTER = 4; // rounds of fighting before a side drawn up to feign flight may
const FEINT_ROUNDS = 4; // and the longest it runs before it turns
const FEINT_BACK = 4; // fronts it falls back by
const LURED = 2; // fronts the foe comes out after it for the trap to be sprung
const EDGE = 0.5; // and one holding the water's edge, its middle a battalion deep from it: who comes at it is still wading
const BEND = 1.5; // how far a line bent to the ground goes ahead of its frame or back
const FACING = 2; // what attackers give up a shift of the field's reach off the defenders' line for: woods do not draw them aside
const KINK = 0.35; // and how much further than its neighbour, a front along a front across
const CLIMB = 1.5; // the slope below a line the foe charges up
const FILE = 0.6; // between the battalions of a column, besides their depth
const KEPT_MARCHES = 64; // ways of a column with no road, kept
const WADE = 2; // ways on open ground a way through a ford or a bog costs a column with no road to keep to
const SURPRISE = 5; // rounds of fighting the surprise of an ambush lasts: four minutes for the column to find its feet
const WAVERING = 70; // morale of an ambushed column at which ambushers who shoot first fall on it
const ROAD_REACH = 0.35; // a road so near the middle of the field, in its heights, is the one an ambushed column is on
const COVER = [-1, -0.5, 0, 0.5, 1]; // where along their line ambushers look at the ground, in shares of its half
const LAIR = 3.4; // battalion fronts, half the line they look over at the most
const HIDDEN = 0.6; // of a line under trees hides it
const SEEN = 0.8; // of the nearest they lie from the column: nearer than that at any point of it they would be seen
const OVERLOOK = 10; // metres above the road that tell fully on where ambushers lie: they charge downhill
const ROUND_END = 2; // riders going round the foe's line pass its end by so much
const FOES_NEAR = 3.6; // a gap in the line with foes so near is filled
const THREAT = 9; // foes come round further than that from the formation are no threat to it
const WHEEL = 1.8; // a formation wheels to face a foe no nearer than that
const POST = 2; // the point of a wedge waits so far beyond the end of the line
const WIDE = 3; // and a wedge by so much: out of reach of the end of his line till it falls on him
const FLANKED = 1.05; // radians off its facing a blow comes from in the flank
const HOOKS = 3; // battalions turned out at an end of the line, at most
const ROUND_SIDE = 0.9; // so far beyond the end of the line and no further ahead than that, a foe has come round a flank
const ROUND_AHEAD = 0.45;

const WEDGE_TURN = 0.5; // radians a round a wedge wheels
const DOWNHILL = 10; // what a lane down a slope of one in ten is worth, as against one all over bad ground

// of a pace a tick
const CLOSING = 0.7; // how much nearer the foe has to come in a round for the side to be closing

// in shares of the field's width
const MARGIN = 0.02; // troops keep that far from the edge of the field

/** What a general sees of a side */
interface SideView {
  ready: Battalion[]; // battalions in order
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

interface Frame {
  x: number;
  y: number;
  heading: number;
}

/** The way an ambushed column marches: the road through the middle of the field, else straight on along the attack */
interface Route {
  at: (s: number) => Frame; // the point that far along the way, heading on along it
  middle: number; // how far along it the middle of the field lies
  room: [number, number]; // and where it is on the field
}

type Seen = { battalion: Battalion; at: [across: number, along: number] }[];

// a side drawn up on its ground (`drawUp`) may take any of these by hand; the crossing and the Wagenburg where they apply
const ATTACKS: TacticName[] = ["assault", "oblique", "envelopment", "wedge", "harass", "flyingWedge", "feignedRetreat"];
const DEFENCES: TacticName[] = ["defensiveLine", "refusedFlanks", "crossing", "wagenburg", "strategicRetreat"];

class GeneralModule {
  private readonly walks = new WeakMap<Battle, { tick: number; walk: number }>();
  private readonly marches = new Map<string, Point[]>();

  private far(a: { x: number; y: number }, b: { x: number; y: number }): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  /** In order and fighting on: not broken, and not marching off the field */
  private isInOrder(battalion: Battalion): boolean {
    return battalion.status === "ready" && !battalion.leaving;
  }

  private survey(battle: Battle, side: Side): SideView {
    const all = battle.battalions.filter(battalion => battalion.side === side);
    const ready = all.filter(battalion => this.isInOrder(battalion));
    const troops = sum(ready, battalion => battalion.troops) || 1;
    return {
      ready,
      power: sum(ready, battalion => Battalions.getStrength(battalion)),
      fire: sum(ready, battalion => (battalion.stats.range ? Battalions.getStrength(battalion) : 0)),
      grip: sum(ready, battalion => Battalions.getStrength(battalion) * this.getGrip(battalion)),
      riders: sum(ready, battalion => (battalion.kind === "mounted" ? Battalions.getStrength(battalion) : 0)),
      morale: sum(ready, battalion => battalion.morale * battalion.troops) / troops,
      losses: battle[side].casualties + battle[side].captured,
      share: all.length ? ready.length / all.length : 0,
      x: sum(ready, battalion => battalion.x * battalion.troops) / troops,
      y: sum(ready, battalion => battalion.y * battalion.troops) / troops
    };
  }

  /** Share of a side's troops lost to it, the parts of men too */
  private getHarm(battle: Battle, side: Side): number {
    const battalions = battle.battalions.filter(battalion => battalion.side === side);
    const initial = sum(battalions, battalion => battalion.initial);
    const lost = (battalion: Battalion): number =>
      battalion.initial -
      battalion.troops +
      battalion.harm -
      0.5 +
      (battalion.status === "surrendered" ? battalion.troops : 0); // harm begins at half a man
    return initial ? sum(battalions, lost) / initial : 0;
  }

  /** How much of its strength a battalion brings hand to hand: shooters and riders who shoot fight on, engines and ships hardly */
  private getGrip(battalion: Battalion): number {
    const kind = Battalions.getKind(battalion.type, battalion.stats.range); // as its unit fights, in a naval or an air battle too
    return kind === "machinery" ? 0.1 : kind === "ranged" || (kind === "mounted" && battalion.stats.range) ? 0.5 : 1;
  }

  // Deployment

  /** Draw both sides up: the defenders take their ground, the attackers form up in sight of them; the hopeless to leave */
  deploy(battle: Battle, retreating: Side[] = []): void {
    const { type, field } = battle;
    for (const side of [...SIDES].reverse()) {
      const battalions = battle.battalions.filter(battalion => battalion.side === side);
      const attacking = side === "attackers";
      if (type === "ambush") attacking ? this.marchColumn(battle, battalions) : this.layAmbush(battle, battalions);
      else if (type === "siege" && field.held !== null && attacking)
        this.isRinging(battle, battalions) ? this.ringIn(battle, battalions) : this.layLines(battle, battalions);
      else if (type === "siege" && Movement.hasWalls(battle)) this.manWalls(battle, battalions);
      else this.drawUp(battle, side, battalions, retreating.includes(side));
    }
    // the defenders' riders pick the wing to go round by the attackers in sight of them, not by where they stood before
    const drawn = type !== "ambush" && !(type === "siege" && Movement.hasWalls(battle));
    if (drawn && battle.defenders.plan.wedge)
      this.drawUp(
        battle,
        "defenders",
        battle.battalions.filter(battalion => battalion.side === "defenders"),
        retreating.includes("defenders")
      );
    for (const side of SIDES)
      battle[side].advancing = this.isAttacking(battle, side, battle[side].plan.tactic === "crossing");
    battle.attackers.plan.opening = battle.defenders.plan.opening = SURPRISE;
  }

  /**
   * Who comes to whom in the open: attackers unless much the weaker, defenders when much the stronger and behind no river;
   * a side given an attack by hand
   */
  private isAttacking(battle: Battle, side: Side, crossing: boolean): boolean {
    if (!this.isOpenFight(battle)) return side === "attackers" || (battle.type === "ambush" && !battle[side].waits); // ambushers fall on the column
    if (battle[side].waits) return false; // its general thought it through and saw nothing to gain by it
    if (ATTACKS.includes(this.getHandTactic(battle, side)!)) return true; // told by hand to attack
    return side === "attackers" ? this.getOdds(battle, side) >= BOLD : this.getOdds(battle, side) >= KEEN && !crossing;
  }

  private isOpenFight(battle: Battle): boolean {
    return BattleRules.isOpen(battle.type);
  }

  /** Told by hand to hold or to skirmish where no phase says so; ambushers who shoot from cover first */
  private keepsOff(battle: Battle, side: Side): boolean {
    return (
      ["hold", "fortify", "skirmish"].includes(Battalions.getBearing(battle, side) ?? "") ||
      this.isShootingFirst(battle, side)
    );
  }

  private isShootingFirst(battle: Battle, side: Side): boolean {
    return battle.type === "ambush" && side === "defenders" && battle[side].waits;
  }

  private getOdds(battle: Battle, side: Side): number {
    return this.survey(battle, side).power / (this.survey(battle, BattleRules.enemyOf(side)).power || 1e-9);
  }

  private createPlan(tactic: TacticName, frame: Frame, fixed = false): Plan {
    return {
      tactic,
      strike: 1,
      ...frame,
      camp: [frame.x, frame.y],
      fixed,
      half: 0,
      halt: 0,
      reach: 0,
      since: 0,
      fired: null,
      byHand: { order: null, round: null, defiant: false, stands: false },
      opening: 0,
      gap: Infinity,
      apart: Infinity,
      walk: Infinity,
      idle: 0,
      losses: 0,
      bled: 0,
      fortify: false,
      arrival: Infinity,
      wedge: null,
      muster: null,
      hooks: [[], []],
      lure: null,
      declined: false
    };
  }

  private toField({ x, y, heading }: Frame, across: number, along: number): Point {
    return [
      x + Math.cos(heading) * along - Math.sin(heading) * across,
      y + Math.sin(heading) * along + Math.cos(heading) * across
    ];
  }

  private toFrame({ x, y, heading }: Frame, point: { x: number; y: number }): [across: number, along: number] {
    const [dx, dy] = [point.x - x, point.y - y];
    return [-Math.sin(heading) * dx + Math.cos(heading) * dy, Math.cos(heading) * dx + Math.sin(heading) * dy];
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  private getMargin(field: Battlefield): number {
    return MARGIN * field.width;
  }

  /** The point, moved off the edge of the field into it */
  onField(field: Battlefield, [x, y]: Point): Point {
    const margin = this.getMargin(field);
    return [this.clamp(x, margin, field.width - margin), this.clamp(y, margin, field.height - margin)];
  }

  /** Shift the formation so that every place of it is on the field, as far as it fits there */
  private keepOnField(field: Battlefield, frame: Frame, places: { across: number; along: number }[]): void {
    if (!places.length) return;
    const points = places.map(({ across, along }) => this.toField(frame, across, along));
    const margin = this.getMargin(field);
    for (const axis of [0, 1] as const) {
      const size = axis ? field.height : field.width;
      const low = Math.min(...points.map(point => point[axis]));
      const high = Math.max(...points.map(point => point[axis]));
      const shift = Math.max(margin - low, 0) - Math.max(high - (size - margin), 0);
      if (axis) frame.y += shift;
      else frame.x += shift;
    }
  }

  /** Give the battalions their places and stand them there */
  private seat(battle: Battle, side: Side, plan: Plan, places: Place[]): void {
    if (!places.length) return; // a side with no troops, as of units its roster lacks
    const { field } = battle;
    const { front } = field;
    const line = places.filter(place => place.role !== "wedge");
    const wedge = places.filter(place => place.role === "wedge");
    if (!plan.fixed) this.keepOnField(field, plan, line);
    plan.camp = [plan.x, plan.y];
    plan.half = Math.max(
      ...line.filter(place => place.rank === 0).map(place => Math.abs(place.across)),
      front * LEAST_HALF
    );
    if (wedge.length) {
      plan.wedge = { ...this.getPost(battle, plan), launched: false, charging: false, target: null };
      this.keepOnField(field, plan.wedge, wedge);
    }
    // shooters stop where their shots reach the foe's front, in the dark at its torches. Standing off in the open, those
    // that would not reach him from their place step before the line so far that they do while it halts beyond its own
    // charge; who would have to go too far out stays where it is
    const shooters = places.filter(
      place => place.battalion.stats.range && (place.battalion.kind === "ranged" || field.open)
    );
    const depth = places[0].battalion.depth;
    const reach = (battalion: Battalion): number => Sight.getReach(battle, battalion, true) * 0.9;
    const aheads = new Map<Battalion, number>();
    for (const { battalion, along } of shooters) {
      const out = (CHARGE + CHARGE_CLEAR) * front + depth - reach(battalion);
      if (this.isOpenFight(battle) && along < out && out <= AHEAD_MOST * front) aheads.set(battalion, out);
    }
    const shot = shooters.length
      ? Math.min(...shooters.map(({ battalion, along }) => reach(battalion) + (aheads.get(battalion) ?? along))) - depth
      : 0;
    plan.halt = Math.max(shot, COUNTER * 2 * front);
    plan.reach = shot;
    battle[side].plan = plan;
    for (const place of places) {
      // riders do not stand among trees or in a bog: they close in to the line till the ground is open
      const bad = (): boolean => {
        const { wood, marsh } = Battlefields.terrainAt(
          field,
          ...this.onField(field, this.toField(plan, place.across, place.along))
        );
        return wood || marsh;
      };
      const shift = front * STEP_IN;
      const wing = place.battalion.kind === "mounted" && place.role !== "wedge";
      const post = place.across;
      for (let i = 0; i < 12 && wing && Math.abs(place.across) > shift && bad(); i++)
        place.across -= Math.sign(place.across) * shift;
      if (wing && bad()) place.across = post; // no open ground to the middle of the line: they keep their wing
      const { battalion, role, mission, rank, across, along } = place;
      const frame = this.frameOf(plan, role);
      const [x, y] = this.onField(field, this.toField(frame, across, along));
      const facing = frame.heading + (place.facing ?? 0);
      battalion.order = {
        role,
        mission,
        rank,
        across,
        along,
        ahead: aheads.get(battalion) ?? null,
        x,
        y,
        facing,
        target: null,
        sent: false
      };
      [battalion.x, battalion.y, battalion.facing] = [x, y, facing];
    }
  }

  /** Distance from the middle of the field towards its edge, with a margin */
  reach({ width, height }: Battlefield, angle: number): number {
    return 1 / Math.hypot(Math.cos(angle) / (width * 0.44), Math.sin(angle) / (height / 2 - width * 0.05));
  }

  /**
   * About where a side forms up, before its ground is chosen: the attackers where they came from, the defenders at the
   * battle point
   */
  getBase(battle: Battle, side: Side): Point {
    const { field, axis } = battle;
    if (side === "defenders" && field.held !== null) return [field.burgs[field.held].x, field.burgs[field.held].y];
    const deep = this.reach(field, axis) * (side === "attackers" ? this.getApproach(battle) : 0.35);
    return [field.width / 2 + Math.cos(axis) * deep, field.height / 2 + Math.sin(axis) * deep];
  }

  /** Where the attackers come from, in shares of the field's reach from its middle: in the dark or the murk no further off than a few sights */
  private getApproach(battle: Battle): number {
    return Math.max(-0.8, 0.35 - (APPROACH * Sight.getSight(battle)) / this.reach(battle.field, battle.axis));
  }

  /** The room a line has across the attack */
  private getRoom(battle: Battle): number {
    return this.reach(battle.field, battle.axis + Math.PI / 2) * 1.7;
  }

  /** The usual way: a tactic by the odds, a formation by the tactic, on the best ground in reach */
  private drawUp(battle: Battle, side: Side, battalions: Battalion[], retreats = false): void {
    const forward = side === "attackers" ? battle.axis : battle.axis + Math.PI;
    const crossing = side === "defenders" ? this.findCrossing(battle) : null;
    const [chosen, strike] = this.chooseTactic(battle, side, battalions, crossing !== null);
    const tactic = retreats ? "strategicRetreat" : chosen;
    const places = Formations.form(battalions, TACTICS[tactic], strike, this.getRoom(battle), battle.field.front);
    // defenders ready for a landing or a bombardment meet it at the water's edge, unless their general would rather wait inland
    const meets = BattleRules.isFromSea(battle.type) && side === "defenders" && !battle[side].waits;
    const shore = meets ? this.findShore(battle) : null;
    const frame = crossing ?? shore ?? this.findGround(battle, side, places, forward)[0];
    // a line that holds follows the ground: the water's edge, or the brow of the slope the foe has to come up
    if (shore) this.bend(places, battle.field.front, place => this.getShoreOffset(battle, frame, place));
    else if (tactic === "defensiveLine" || tactic === "refusedFlanks")
      this.bend(places, battle.field.front, place => this.getBrowOffset(battle, side, frame, place));
    const plan = this.createPlan(tactic, frame);
    plan.strike = TACTICS[tactic].riders === "wedge" ? this.chooseLane(battle, side, frame, places) : strike;
    this.seat(battle, side, plan, places);
    plan.fixed = Boolean(TACTICS[tactic].ring); // a Wagenburg stands where it formed
  }

  /** Score every tactic the side may use against what it knows of both armies, the best first, and name the wing to mass on */
  private rateTactics(
    battle: Battle,
    side: Side,
    battalions: Battalion[],
    crossing: boolean
  ): [scores: [TacticName, number][], strike: number] {
    const own = this.survey(battle, side);
    const foe = this.survey(battle, BattleRules.enemyOf(side));
    const odds = own.power / (foe.power || 1e-9);
    const count = (kind: Battalion["kind"]): number => battalions.filter(battalion => battalion.kind === kind).length;
    const [line, shooters, riders] = [count("melee"), count("ranged"), count("mounted")];
    const riderOdds = foe.riders ? own.riders / foe.riders : own.riders ? 3 : 1;
    const fireShare = own.fire / (own.fire + foe.fire || 1);
    const gripShare = own.grip / (own.grip + foe.grip || 1);
    const foeBattalions = battle.battalions.filter(battalion => battalion.side !== side);
    const { field } = battle;
    const width = (all: Battalion[]): number =>
      sum(all, battalion => (battalion.kind === "melee" ? battalion.width + GAP * field.front : 0));
    const weight = (all: Battalion[]): number =>
      sum(all, battalion => (battalion.kind === "melee" ? Battalions.getStrength(battalion) : 0));
    const heavier =
      weight(battalions) / (width(battalions) || 1) > (weight(foeBattalions) / (width(foeBattalions) || 1)) * 1.15;

    // the wing to mass against: the foe's weaker one when it is in sight, else the right
    const frame = {
      x: field.width / 2,
      y: field.height / 2,
      heading: side === "attackers" ? battle.axis : battle.axis + Math.PI
    };
    const wing = (sign: number): number =>
      sum(foe.ready, battalion =>
        battalion.x && this.toFrame(frame, battalion)[0] * sign > field.front * WING
          ? Battalions.getStrength(battalion)
          : 0
      );
    const strike = wing(-1) < wing(1) ? -1 : 1;

    if (battle.type === "landing" && side === "attackers") return [[["waves", 1]], strike];
    const attacking = this.isAttacking(battle, side, crossing);
    // a foe dug in is beaten round the ends of its works, or worn down from out of reach of its wagons
    const enemy = BattleRules.enemyOf(side);
    const dug = this.isDugIn(battle, enemy);
    // the defenders are drawn up first: the attackers' plan is not made yet, only what they settled on
    const theirs =
      side === "defenders" ? (this.getHandTactic(battle, enemy) ?? battle[enemy].tactic) : battle[enemy].plan.tactic;
    const [ends, ring] = [dug && theirs !== "wagenburg" ? 0.4 : 0, dug && theirs === "wagenburg" ? 0.6 : 0];
    const scores: [TacticName, number][] = attacking
      ? [
          ["assault", 1 + (odds - 1) * 0.5],
          ["oblique", line >= 4 ? 1 + (1 - odds) * 0.8 + Math.abs(wing(1) - wing(-1)) / (foe.power || 1) + ends : 0],
          ["envelopment", riders >= 2 ? 0.6 + Math.min(riderOdds - 1, 1.5) * 0.5 + (odds - 1) * 0.3 + ends : 0],
          [
            "wedge",
            line >= 5 ? 0.7 + (width(foeBattalions) / (width(battalions) || 1) - 1) * 0.8 + (heavier ? 0.25 : 0) : 0
          ],
          ["harass", shooters >= Math.max(line, 2) ? 0.5 + (fireShare - gripShare) * 3 + ring : 0],
          [
            "flyingWedge",
            riders >= 2 && own.riders >= own.power * 0.2
              ? 0.55 + Math.min(riderOdds - 1, 1.5) * 0.5 + (odds - 1) * 0.3
              : 0
          ],
          // riders who can run and turn again draw a foe off strong ground
          [
            "feignedRetreat",
            battle.type === "field" && riders >= 2 && own.riders >= own.power / 3
              ? 0.5 + (this.getPurchase(battle, own, foe) < this.getPurchase(battle, foe, own) ? 0.4 : 0) + ends
              : 0
          ]
        ]
      : [
          ["defensiveLine", 1],
          ["refusedFlanks", line >= 3 ? 0.8 + (1 / odds - 1) * 0.6 + (riderOdds < 0.67 ? 0.3 : 0) : 0],
          ["crossing", crossing ? 3 : 0],
          [
            "wagenburg",
            !crossing && this.isOutridden(own, foe) && line + shooters >= 4 && this.isBare(battle, side, battalions)
              ? 2.5
              : 0
          ]
        ];
    return [scores.filter(([, score]) => score > 0).sort((a, b) => b[1] - a[1]), strike];
  }

  /** The foe's riders outweigh the side's two to one and make two fifths of its power: a wagon ring is the answer */
  private isOutridden(own: SideView, foe: SideView): boolean {
    return foe.riders >= own.riders * 2 && foe.riders >= foe.power * 0.4;
  }

  /** The ground about the battle point covers neither end of a line: nothing for it to lean on, a Wagenburg stands anywhere */
  private isBare(battle: Battle, side: Side, battalions: Battalion[]): boolean {
    if (!Works.mayBuild(battle, side)) return false;
    const places = Formations.form(battalions, TACTICS.defensiveLine, 1, this.getRoom(battle), battle.field.front);
    const forward = side === "attackers" ? battle.axis : battle.axis + Math.PI;
    return this.findGround(battle, side, places, forward)[1] === 0;
  }

  /** The tactic of a side: the one given by hand, else the one its general settled on, else the best by the scores */
  private chooseTactic(battle: Battle, side: Side, battalions: Battalion[], crossing: boolean): [TacticName, number] {
    const [scores, strike] = this.rateTactics(battle, side, battalions, crossing);
    const hand = this.getHandTactic(battle, side);
    if (hand && this.getDrawUpTactics(battle, side, crossing).includes(hand)) return [hand, strike];
    const settled = scores.find(([name]) => name === battle[side].tactic);
    return [(settled ?? scores[0])[0], strike];
  }

  /** Every tactic a side drawn up on its ground may take by hand, whether its general would or not */
  private getDrawUpTactics(battle: Battle, side: Side, crossing: boolean): TacticName[] {
    if (battle.type === "landing" && side === "attackers") return ["waves"];
    return [...ATTACKS, ...DEFENCES].filter(
      name =>
        (name !== "crossing" || crossing) &&
        (name !== "wagenburg" || Works.mayBuild(battle, side)) &&
        (name !== "feignedRetreat" || battle.type === "field")
    );
  }

  /** Besiegers ring the burg in when they can, or when told to by hand; told to draw up in lines, they do */
  private isRinging(battle: Battle, battalions: Battalion[]): boolean {
    const hand = this.getHandTactic(battle, "attackers");
    if (!Movement.hasWalls(battle) || hand === "lines") return false;
    return hand === "ring" || this.canRing(battle, battalions);
  }

  /** The tactic a side was given by hand before the start: the last word stands, null gives it back to its general */
  getHandTactic(battle: Battle, side: Side): TacticName | null {
    const change = battle.interventions.findLast(change => change.kind === "tactic" && change.side === side);
    return change?.kind === "tactic" ? change.tactic : null;
  }

  /** Every tactic the battle type lets a side be drawn up in, the likeliest first; none when there is no choice */
  getTactics(battle: Battle, side: Side): TacticName[] {
    const { type, field } = battle;
    const battalions = battle.battalions.filter(battalion => battalion.side === side);
    if (type === "ambush") return side === "defenders" ? ["ambuscadeBothSides", "ambuscadeOneSide"] : [];
    if (type === "siege" && field.held !== null && side === "attackers") {
      if (!Movement.hasWalls(battle)) return [];
      return this.canRing(battle, battalions) ? ["ring", "lines"] : ["lines", "ring"];
    }
    if (type === "siege" && Movement.hasWalls(battle)) return [];
    const crossing = side === "defenders" && this.findCrossing(battle) !== null;
    const retreats = battle[side].plan.tactic === "strategicRetreat" && !this.getHandTactic(battle, side);
    const likely = this.rateTactics(battle, side, battalions, crossing)[0].map(([name]) => name);
    if (retreats) likely.unshift("strategicRetreat");
    const names = [...new Set([...likely, ...this.getDrawUpTactics(battle, side, crossing)])];
    return names.length > 1 ? names : [];
  }

  private choice(tactic: TacticName | null, waits = false, storms = false): GeneralChoice {
    return { tactic, waits, storms };
  }

  /**
   * What a general plays through in his mind before the battle, the likeliest first.
   * In the open: every tactic open to him, and for an attacker who is the weaker to stand and wait instead; where water or
   * walls make the going slow to reckon only such an attacker does it, with his likeliest tactic.
   * In an ambush: to lie on both sides of the road or on one; only on one where trees hide them on one side alone.
   * The column has no plan: it is caught.
   * In a landing and a bombardment: for ready defenders, to meet it at the shore or to wait inland.
   * In a siege: for besiegers a little short of the odds the walls ask for, to storm at once all the same or to keep to the rule.
   */
  getChoices(battle: Battle, side: Side): GeneralChoice[] {
    const { type, field } = battle;
    const byHand = this.getHandTactic(battle, side) !== null; // the general has nothing to settle
    if (battle[side].plan.tactic === "strategicRetreat") return []; // nor one who leaves the field
    if (type === "ambush") {
      if (side === "attackers" || byHand) return [];
      const shooters = battle.battalions.some(battalion => battalion.side === side && battalion.kind === "ranged");
      // where trees hide them on one side only, those across the road would be seen from it
      const [a, b] = this.findLairs(battle).lairs;
      const alike = a.hidden === b.hidden && a.fits === b.fits; // nor across water from it
      const tactics: TacticName[] = alike ? ["ambuscadeBothSides", "ambuscadeOneSide"] : ["ambuscadeOneSide"];
      return [
        ...tactics.map(tactic => this.choice(tactic)),
        ...(shooters ? tactics.map(tactic => this.choice(tactic, true)) : [])
      ];
    }
    if (BattleRules.isFromSea(battle.type))
      return side === "defenders" && this.findShore(battle) ? [this.choice(null), this.choice(null, true)] : [];
    if (type === "siege") {
      // a storm of many battalions is too slow to play through in the time there is
      if (side === "defenders" || field.held === null || battle.battalions.length > 28) return [];
      const short = this.getOdds(battle, side) / this.getStormOdds(battle);
      return short >= 2 / 3 && short < 1 ? [this.choice(null), this.choice(null, false, true)] : [];
    }

    // wagons, or stakes before a foe with riders, make the going slow to reckon too
    const riders = (of: Side): boolean =>
      battle.battalions.some(battalion => battalion.side === of && Works.isRider(battalion));
    const barring = field.works.some(
      work =>
        Battlefields.isStanding(work) &&
        (work.kind === "wagons" || (work.kind === "stakes" && riders(BattleRules.enemyOf(work.side))))
    );
    const ring = battle[BattleRules.enemyOf(side)].plan.tactic === "wagenburg"; // and a foe that rings its wagons
    const rough = Battlefields.isRoughField(field) || barring || ring;
    if ((rough && side === "defenders") || byHand) return [];
    const battalions = battle.battalions.filter(battalion => battalion.side === side);
    const names = this.rateTactics(battle, side, battalions, battle[side].plan.tactic === "crossing")[0].map(
      ([name]) => name
    );
    const choices = (rough ? names.slice(0, 1) : names).map(name => this.choice(name));
    // with engines before wagons: to batter them first, or to storm them at once
    const engines = battalions.some(battalion => battalion.kind === "machinery");
    if (engines && (barring || ring)) choices.push(this.choice(names[0], false, true));
    // an attacker who is the weaker, or short of the odds strong ground asks for, may think better of it
    const free = !battle[side].plan.byHand.order; // not ordered what to do by hand
    const [own, foe] = [this.survey(battle, side), this.survey(battle, BattleRules.enemyOf(side))];
    const strong = rough || this.getPurchase(battle, own, foe) < this.getPurchase(battle, foe, own); // the foe's ground
    const cautious =
      side === "attackers" &&
      free &&
      this.isAttacking(battle, side, false) &&
      own.power < foe.power * (strong ? WARY : 1);
    if (cautious) choices.push(this.choice(null, true));
    return choices.length < 2 ? [] : choices;
  }

  /**
   * Where a side forms up: the attackers where they came from, the defenders on the best ground about the battle point;
   * and how many ends of its line the ground there covers
   */
  private findGround(battle: Battle, side: Side, places: Place[], forward: number): [Frame, number] {
    const { axis, field } = battle;
    const { front } = field;
    const [along, width] = [this.reach(field, axis), this.reach(field, axis + Math.PI / 2)];
    const half = Math.max(
      ...places.filter(place => place.rank === 0).map(place => Math.abs(place.across)),
      front * LEAST_HALF
    );
    const depth = -Math.min(...places.map(place => place.along), 0);
    const defending = side === "defenders";
    if (defending && field.held !== null) return [{ ...field.burgs[field.held], heading: forward }, 2];
    const foe = this.survey(battle, BattleRules.enemyOf(side));
    const climb = 0.3 * (1 + foe.riders / (foe.power || 1)); // a slope before the line, the more worth the more riders come
    // the attackers form up over against the defenders' line and face it
    const target = defending ? null : this.getDefendersLine(battle);
    const across = axis + Math.PI / 2;
    const facing = target
      ? ((target[0] - field.width / 2) * Math.cos(across) + (target[1] - field.height / 2) * Math.sin(across)) / width
      : 0;

    const at = (deep: number, shift: number): Frame => {
      const x = field.width / 2 + Math.cos(axis) * along * deep + Math.cos(across) * width * shift;
      const y = field.height / 2 + Math.sin(axis) * along * deep + Math.sin(across) * width * shift;
      return { x, y, heading: target ? Math.atan2(target[1] - y, target[0] - x) : forward };
    };
    /** The ends of a line there that water, wood or a burg covers. The edge of the field is where the view ends, no cover */
    const getEnds = (frame: Frame): number => {
      let ends = 0;
      for (const sign of [-1, 1]) {
        const point = this.toField(frame, sign * (half + front * BEYOND), 0);
        const beyond = Battlefields.terrainAt(field, ...point);
        const cliff = Battlefields.getCliffsBetween(field, this.toField(frame, sign * half, 0), point).length > 0;
        if (beyond.water || beyond.wood || beyond.burg || cliff) ends += 1;
      }
      return ends;
    };
    // the defenders of a burg hold it: their first line across its front half, the rest within
    const burg = defending ? this.getFieldBurg(battle) : null;
    if (burg) {
      const frame = {
        x: burg.x + (Math.cos(forward) * burg.radius) / 2,
        y: burg.y + (Math.sin(forward) * burg.radius) / 2,
        heading: forward
      };
      return [frame, getEnds(frame)];
    }
    // nobody stands in the water or beyond it, as seen from the middle of the formation
    const line = places.filter(place => place.role !== "wedge");
    const isAcross = (frame: Frame, [x, y]: Point): boolean => {
      const steps = Math.ceil(Math.hypot(x - frame.x, y - frame.y) / (field.cell / 2));
      for (let i = 1; i <= steps; i++) {
        const share = i / steps;
        if (Battlefields.terrainAt(field, frame.x + (x - frame.x) * share, frame.y + (y - frame.y) * share).water)
          return true;
      }
      return false;
    };
    const afloat = field.open || (BattleRules.isFromSea(battle.type) && !defending); // who comes from the sea starts on it
    const wetPlaces = (frame: Frame): number => {
      if (afloat) return 0;
      const stood = { ...frame };
      this.keepOnField(field, stood, line); // as it will stand
      return line.filter(place => isAcross(stood, this.toField(stood, place.across, place.along))).length;
    };
    const home = defending ? 0.35 : this.getApproach(battle);

    // a line is worth the ground under it, what covers its ends and what the foe has to cross to come at it
    const score = (frame: Frame, deep: number, shift: number): number => {
      let value = -Math.abs(shift - facing) * (target ? FACING : 0.25) - Math.abs(deep - home) / 2 - wetPlaces(frame);
      // no line across a cliff, half of it above and half below
      for (const share of [-1, -0.5, 0, 0.5])
        if (
          Battlefields.getCliffsBetween(
            field,
            this.toField(frame, share * half, 0),
            this.toField(frame, (share + 0.5) * half, 0)
          ).length
        )
          value -= 2;
      for (const share of [-1, -0.5, 0, 0.5, 1]) {
        const terrain = Battlefields.terrainAt(field, ...this.toField(frame, share * half, 0));
        if (terrain.water && !field.open) value -= 2;
        if (terrain.wood || terrain.marsh) value -= 0.2;
        if (!defending) continue;
        value += terrain.height + (terrain.burg ? 0.2 : 0);
        for (const ahead of [0.07, 0.13].map(share => share * field.width)) {
          const before = Battlefields.terrainAt(field, ...this.toField(frame, share * half, ahead));
          if (before.water || before.marsh) value += 0.15;
          value += (terrain.height - before.height) * climb;
        }
      }
      if (defending) value += getEnds(frame) * 0.3;
      return value;
    };

    let best: Frame | null = null;
    let most = -Infinity;
    let dry = false;
    // attackers come nearer only when water cuts the ground they came to; from the sea they start where they lie
    for (const deep of defending ? [0.35, 0.2, 0.5] : afloat ? [home] : [home, home + 0.15, home + 0.3]) {
      if (!defending && deep !== home && dry) break;
      for (const shift of [0, -0.2, 0.2, -0.4, 0.4].map(offset => offset + facing)) {
        const frame = at(deep, shift);
        const value = score(frame, deep, shift);
        if (value > most) [best, most, dry] = [frame, value, !wetPlaces(frame)];
      }
    }
    // the last line stands on the field too
    const frame = best!;
    const [margin, step] = [this.getMargin(field) + field.cell, field.cell];
    const inside = ([x, y]: Point): boolean =>
      x >= margin && y >= margin && x <= field.width - margin && y <= field.height - margin;
    for (let i = 0; i < 30 && !inside(this.toField(frame, 0, -depth)); i++)
      [frame.x, frame.y] = this.toField(frame, 0, step);
    return [frame, getEnds(frame)];
  }

  /** The burg a field battle is fought before, the one it is named after: its defenders hold it */
  getFieldBurg(battle: Battle): FieldBurg | null {
    if (battle.type !== "field") return null;
    return battle.field.burgs.find(burg => burg.name === battle.place) ?? null;
  }

  /** The middle of the defenders' first line, once they are drawn up on the ground: null where they man walls or lie in wait */
  private getDefendersLine(battle: Battle): Point | null {
    const { type } = battle;
    if (type === "ambush" || (type === "siege" && Movement.hasWalls(battle))) return null;
    const { x, y } = battle.defenders.plan;
    return x || y ? [x, y] : null;
  }

  /**
   * A river the attackers have to cross on their way: the defenders stand round the far end of the ford or the bridge
   * they will come by, when it is on their half of the field. A brook is waded anywhere: no crossing to hold
   */
  private findCrossing(battle: Battle): Frame | null {
    const { field, axis } = battle;
    if (field.open || battle.type !== "field" || !field.water.some(Boolean)) return null;
    const along = this.reach(field, axis);
    const point = (deep: number): Point => [
      field.width / 2 + Math.cos(axis) * along * deep,
      field.height / 2 + Math.sin(axis) * along * deep
    ];
    const passable = (node: number): boolean => !field.water[node] || Battlefields.isFordable(field, node);
    const costs = Float32Array.from(field.water, (_, node) =>
      passable(node) ? (field.water[node] ? 3 : 1) : Infinity
    );
    const way = Pathfinding.trace(
      Pathfinding.spread(COLS, ROWS, [Battlefields.nodeAt(field, ...point(-0.8))], costs),
      Battlefields.nodeAt(field, ...point(0.35))
    );
    const wet = (node: number): boolean =>
      (field.water[node] > 0 || field.deck[node] === 1) && !this.isBrook(field, Battlefields.nodeCentre(field, node));
    const last = way.findLastIndex(wet);
    if (last < way.length * 0.4 || last >= way.length - 2) return null;
    const [x, y] = Battlefields.nodeCentre(field, way[last]);
    const heading = axis + Math.PI; // the line faces the attack, not the way over
    const back = field.front * BANK;
    return { x: x - Math.cos(heading) * back, y: y - Math.sin(heading) * back, heading };
  }

  /** Whether the river nearest a point is a brook */
  private isBrook(field: Battlefield, point: Point): boolean {
    const nearest = least(field.rivers, river => Battlefields.distanceToLine(point, river.points));
    return nearest?.brook ?? false;
  }

  /** Defenders ready for a landing hold the water's edge where the attackers come out of it */
  private findShore(battle: Battle): Frame | null {
    const { axis, field } = battle;
    const along = this.reach(field, axis);
    const at = (deep: number): Point => [
      field.width / 2 + Math.cos(axis) * deep,
      field.height / 2 + Math.sin(axis) * deep
    ];
    let shore: number | null = null;
    for (let deep = -along * 0.8; deep < along * 0.35; deep += field.cell)
      if (Battlefields.terrainAt(field, ...at(deep)).water === 1) shore = deep;
    if (shore === null) return null;
    const inland = field.cell / 2 + field.front * EDGE;
    const beach = this.findBeach(field, at(shore));
    const [x, y] = beach
      ? [beach[0] + Math.cos(axis) * inland, beach[1] + Math.sin(axis) * inland]
      : at(shore + field.cell / 2 + field.front * EDGE);
    return { x, y, heading: axis + Math.PI };
  }

  /** Where the shore at a point is cliffed: the shallows nearest it with no cliff within a front, to come ashore at */
  private findBeach(field: Battlefield, shore: Point): Point | null {
    const cliffed = (point: Point): boolean =>
      field.cliffs.some(cliff => Battlefields.distanceToLine(point, [cliff.a, cliff.b]) < field.front);
    if (!cliffed(shore)) return null;
    let [best, least] = [shore, Infinity];
    for (let node = 0; node < field.water.length; node++) {
      if (!Battlefields.terrainAt(field, ...Battlefields.nodeCentre(field, node)).shallow) continue;
      const point = Battlefields.nodeCentre(field, node);
      const distance = Math.hypot(point[0] - shore[0], point[1] - shore[1]);
      if (distance < least && !cliffed(point)) [best, least] = [point, distance];
    }
    return best;
  }

  /**
   * Bend a formation to a line on the ground, as `bow` bends it to a shape: each place goes ahead or back by the line
   * where it stands across, the lines behind with the first, so neighbours stay closed and nobody stands on another.
   * `wish` is how far ahead a place of the first line would rather stand, null where the ground does not say; a place
   * goes back rather than ahead of what its neighbours allow
   */
  private bend(places: Place[], front: number, wish: (place: Place) => number | null): void {
    const first = places
      .filter(place => place.rank === 0 && (place.role === "line" || place.role === "support"))
      .sort((a, b) => a.across - b.across);
    if (!first.length) return;
    const limit = BEND * front;
    const wished = first.map(place => this.clamp(wish(place) ?? 0, -limit, limit));
    const offsets = wished.map((offset, i) =>
      Math.min(offset, ...wished.map((other, j) => other + KINK * Math.abs(first[i].across - first[j].across)))
    );
    const at = (across: number): number => {
      const next = first.findIndex(place => place.across >= across);
      if (next <= 0) return offsets[next < 0 ? offsets.length - 1 : 0];
      const [a, b] = [first[next - 1].across, first[next].across];
      return offsets[next - 1] + ((offsets[next] - offsets[next - 1]) * (across - a)) / (b - a || 1);
    };
    for (const place of places) if (place.role !== "wedge") place.along += at(place.across); // the wedge stands about its own point
  }

  /** How far ahead a place stands best at the water's edge: those who come at it wade the shallows as they meet it */
  private getShoreOffset(battle: Battle, frame: Frame, place: Place): number | null {
    const { field } = battle;
    const limit = BEND * field.front;
    const step = field.cell / 2;
    for (let ahead = -limit; ahead <= limit + field.front * EDGE; ahead += step) {
      if (Battlefields.terrainAt(field, ...this.toField(frame, place.across, place.along + ahead)).water !== 1)
        continue;
      return ahead === -limit ? null : ahead - step / 2 - field.front * EDGE;
    }
    return null;
  }

  /**
   * How far ahead a place stands best on a slope: high, and above what the foe has to come up, the more so the more
   * riders he has, whose charge the climb takes the speed out of; none where the ground is no better than a metre
   */
  private getBrowOffset(battle: Battle, side: Side, frame: Frame, place: Place): number | null {
    const { field } = battle;
    if (!field.relief) return null;
    const foe = this.survey(battle, BattleRules.enemyOf(side));
    const riders = foe.riders / (foe.power || 1);
    const value = (ahead: number): number => {
      const point = this.toField(frame, place.across, place.along + ahead);
      const terrain = Battlefields.terrainAt(field, ...point);
      if (terrain.water || terrain.marsh) return -Infinity;
      const height = Battlefields.getElevation(field, ...point);
      const below = Battlefields.getElevation(
        field,
        ...this.toField(frame, place.across, place.along + ahead + field.front * CLIMB)
      );
      return height + (height - below) * (1 + riders);
    };
    const here = value(0);
    let best: number | null = null;
    let most = here + BROW;
    const limit = BEND * field.front;
    for (let step = field.cell / 2; step <= limit; step += field.cell / 2) {
      for (const ahead of [step, -step]) {
        const worth = value(ahead);
        if (worth > most) [best, most] = [ahead, worth];
      }
    }
    return best;
  }

  private getRoute(battle: Battle): Route {
    const { field, axis } = battle;
    const middle: Point = [field.width / 2, field.height / 2];
    const road = least(field.roads, road => Battlefields.distanceToLine(middle, road));
    const onRoad = road && road.length > 1 && Battlefields.distanceToLine(middle, road) < field.height * ROAD_REACH;
    const ahead = (line: Point[]): boolean =>
      (line.at(-1)![0] - line[0][0]) * Math.cos(axis) + (line.at(-1)![1] - line[0][1]) * Math.sin(axis) >= 0;
    const out = this.reach(field, axis);
    const straight: Point[] = [-1, 1].map(sign => [
      middle[0] + Math.cos(axis) * out * sign,
      middle[1] + Math.sin(axis) * out * sign
    ]);
    const way = onRoad ? (ahead(road) ? road : [...road].reverse()) : this.findMarch(field, straight);
    const points = Battlefields.densify(way, field.cell / 2);

    const lengths = [0];
    for (let i = 1; i < points.length; i++)
      lengths.push(lengths[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
    const at = (s: number): Frame => {
      let i = 1;
      while (i < points.length - 1 && lengths[i] < s) i++;
      const [a, b] = [points[i - 1], points[i]];
      const share = this.clamp((s - lengths[i - 1]) / (lengths[i] - lengths[i - 1] || 1), 0, 1);
      return {
        x: a[0] + (b[0] - a[0]) * share,
        y: a[1] + (b[1] - a[1]) * share,
        heading: Math.atan2(b[1] - a[1], b[0] - a[0])
      };
    };
    // the stretch on the field about the middle
    const margin = this.getMargin(field);
    const inside = ([x, y]: Point): boolean =>
      x >= margin && y >= margin && x <= field.width - margin && y <= field.height - margin;
    const nearest = points.reduce(
      (best, point, i) =>
        Math.hypot(point[0] - middle[0], point[1] - middle[1]) <
        Math.hypot(points[best][0] - middle[0], points[best][1] - middle[1])
          ? i
          : best,
      0
    );
    let [first, last] = [nearest, nearest];
    while (first > 0 && inside(points[first - 1])) first--;
    while (last < points.length - 1 && inside(points[last + 1])) last++;
    return { at, middle: lengths[nearest], room: [lengths[first], lengths[last]] };
  }

  /** Where no road leads a column marches straight on, or round the water, the bogs and the cliffs that would lead it into */
  private findMarch(field: Battlefield, straight: Point[]): Point[] {
    const at = ([x, y]: Point): number => Battlefields.nodeAt(field, x, y);
    const line = Battlefields.densify(straight, field.cell / 2).filter(point => field.water[at(point)] !== 1);
    if (line.length < 2) return straight;
    const cliffs = field.cliffs.length > 0;
    const cliffed = cliffs && Battlefields.getCliffsBetween(field, straight[0], straight[1]).length > 0;
    if (!cliffed && line.every(point => !field.water[at(point)] && !field.marsh[at(point)])) return straight;
    const toll = (node: number): number => {
      if (field.water[node] === 1) return Infinity;
      if (field.water[node]) return Battlefields.isFordable(field, node) ? WADE : Infinity;
      return field.marsh[node] ? WADE : 0;
    };
    const shut = (from: Point, to: Point): boolean => Battlefields.getCliffsBetween(field, from, to).length > 0;
    // the generals ask again and again, of copies of the field too: kept by the ground it was found over
    let hash = 2166136261;
    const mix = (value: number, i: number) => {
      hash = (Math.imul(hash ^ value, 16777619) + i) | 0;
    };
    for (const grid of [field.water, field.marsh, field.ford]) for (let i = 0; i < grid.length; i++) mix(grid[i], i);
    for (let i = 0; i < field.elevation.length; i++) mix(Math.round(field.elevation[i] * field.relief * 100), i); // the climbs
    field.cliffs.forEach(({ a, b }, i) => {
      for (const value of [...a, ...b]) mix(Math.round(value * 100), i);
    });
    const key = [hash, field.width, field.frozen, ...straight.flat()].join();
    let way = this.marches.get(key);
    if (!way) {
      if (this.marches.size >= KEPT_MARCHES) this.marches.clear();
      way = Battlefields.leadWay(field, line, toll, cliffs ? shut : undefined) ?? straight;
      this.marches.set(key, way);
    }
    return way;
  }

  /**
   * The column on the march: riders ahead, engines last, in as many files as it takes to fit the road on the field;
   * its middle where the ambush is sprung (`at`, along the road), else at the middle of the field, as far as the road lets it
   */
  private getColumn(battle: Battle, battalions: Battalion[], at?: number) {
    const order = ["mounted", "melee", "ranged", "machinery"];
    const { field } = battle;
    const route = this.getRoute(battle);
    const column = [...battalions].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || a.id - b.id);
    const pitch = (battalions[0]?.depth ?? 0) + field.front * FILE;
    const room = Math.max(route.room[1] - route.room[0], pitch);
    const files = Math.max(Math.ceil((column.length * pitch) / room), 1);
    const rows = Math.ceil(column.length / files);
    const spacing = Math.max(...battalions.map(battalion => battalion.width), 0) + GAP * field.front;
    const length = (rows - 1) * pitch;
    const span = [route.room[0] + length / 2, Math.max(route.room[1] - length / 2, route.room[0] + length / 2)];
    const middle = this.clamp(at ?? route.middle, span[0], span[1]);
    return { route, column, pitch, files, rows, middle, span, length, half: (files * spacing) / 2, spacing };
  }

  /** An ambush: the attackers are caught on the march, in a column along the road */
  private marchColumn(battle: Battle, battalions: Battalion[]): void {
    const { field } = battle;
    const { route, column, pitch, files, rows, middle, spacing } = this.getColumn(
      battle,
      battalions,
      this.findLairs(battle).middle
    );
    const frame = route.at(middle);
    const spots = column.map((battalion, i) => {
      const row = Math.floor(i / files);
      const across = ((i % files) - (files - 1) / 2) * spacing;
      return { battalion, across, along: middle + ((rows - 1) / 2 - row) * pitch };
    });
    const places = spots.map(({ battalion, across, along }): Place => {
      const role = ROLES[battalion.kind];
      return { battalion, role, mission: role === "wing" ? "guard" : role, rank: 0, across, along: along - middle };
    });
    this.seat(battle, "attackers", this.createPlan("column", frame, true), places);
    // each battalion on the road where it is, heading on along it
    for (const { battalion, across, along } of spots) {
      const there = route.at(along);
      [battalion.x, battalion.y] = this.onField(field, this.toField(there, across, 0));
      battalion.facing = battalion.order.facing = there.heading;
      this.takePlace(battle, battalion);
    }
  }

  /** The side of the road to lie on alone: where the dash is not barred, then under trees, then the better ground */
  private getLair<T extends { cover: number; hidden: boolean; fits: boolean }>([a, b]: T[]): T {
    if (a.fits !== b.fits) return a.fits ? a : b;
    if (a.hidden !== b.hidden) return a.hidden ? a : b;
    return b.cover > a.cover ? b : a;
  }

  /**
   * The ambushers lie by the road and fall on the column: on both sides of it, or all on one side, the better covered,
   * when their general thinks that ends better. One with shooters may have them shoot from cover first (`waits`)
   */
  private layAmbush(battle: Battle, battalions: Battalion[]): void {
    const { field } = battle;
    const sorted = [...battalions].sort((a, b) => a.kind.localeCompare(b.kind) || a.id - b.id);
    const { road, lairs } = this.findLairs(battle);
    const chosen = this.getHandTactic(battle, "defenders") ?? battle.defenders.tactic;
    const tactic: TacticName = chosen === "ambuscadeOneSide" ? "ambuscadeOneSide" : "ambuscadeBothSides";
    const wings =
      tactic === "ambuscadeOneSide"
        ? [{ troops: sorted, frame: this.getLair(lairs).frame }]
        : lairs.map((lair, side) => ({ troops: sorted.filter((_, i) => i % 2 === side), frame: lair.frame }));
    const hunting = !battle.defenders.waits; // who shoot first keep where they lie till the column wavers
    for (const { troops, frame } of wings) {
      if (!troops.length) continue; // a single battalion lies on one side
      const places = Formations.form(troops, TACTICS[tactic], 1, this.reach(field, road.heading) * 1.7, field.front);
      for (const place of places)
        if (hunting && place.role !== "support" && place.role !== "battery") place.mission = "hunt";
      this.seat(battle, "defenders", this.createPlan(tactic, frame, true), places);
    }
    battle.defenders.plan.half = 0;
  }

  /**
   * Where the ambushers spring the ambush and where they lie: the stretch of the road the column fits that gives them
   * the best ground, and on either side of it the lair worth most. Trees hide a line, reeds half as well; high ground
   * lets it charge downhill; water, a cliff or the field's edge between it and the column bar it, a bog on the way
   * slows it. Hidden it lies as near as it may, a short dash from the road; in the open a bowshot off
   */
  private findLairs(battle: Battle): {
    road: Frame;
    middle: number; // of the column, along the road
    lairs: { frame: Frame; cover: number; hidden: boolean; fits: boolean }[];
  } {
    const { field } = battle;
    const { front, cell } = field;
    const column = battle.battalions.filter(battalion => battalion.side === "attackers");
    const { route, half, length, span, middle: centre } = this.getColumn(battle, column);
    const liers = battle.battalions.filter(battalion => battalion.side === "defenders");
    const line =
      liers.filter(battalion => battalion.kind === "melee" || battalion.kind === "ranged").length || liers.length;
    const reach = this.clamp((line * front * (1 + GAP)) / 4, front, LAIR * front); // half the line of one wing of two
    const margin = this.getMargin(field) + front;
    const onField = ([x, y]: Point): boolean =>
      x >= margin && y >= margin && x <= field.width - margin && y <= field.height - margin;
    const cliffs = field.cliffs.length > 0;
    // in the dark or the murk they lie as near as the column cannot see them, hidden in the open too
    const [unseen, unseenInCover] = [false, true].map(covered => Sight.getSeenLying(battle, covered));
    const nearest = Math.min(AMBUSH[0], unseenInCover);
    const furthest = AMBUSH[1];

    const rate = (road: Frame, trail: Point[], side: number, distance: number, far: number) => {
      const out = road.heading + (side ? Math.PI / 2 : -Math.PI / 2);
      const away = half + distance; // from the flank of the column
      const frame = { x: road.x + Math.cos(out) * away, y: road.y + Math.sin(out) * away, heading: out + Math.PI };
      let [cover, barred, slowed, rise] = [0, 0, 0, 0];
      for (const share of COVER) {
        const point = this.toField(frame, share * reach, 0);
        const here = Battlefields.terrainAt(field, ...point);
        const near = least(trail, ([x, y]) => Math.hypot(x - point[0], y - point[1]))!;
        const run = Math.hypot(near[0] - point[0], near[1] - point[1]);
        if (!onField(point) || here.water || run - half < nearest * SEEN) {
          barred++;
          continue;
        }
        // the dash to the column: what lies on it
        let [wet, soft] = [cliffs && Battlefields.getCliffsBetween(field, point, near).length > 0, here.marsh];
        const steps = Math.ceil(run / cell);
        for (let k = 1; k < steps && !wet; k++) {
          const t = k / steps;
          const on = Battlefields.terrainAt(
            field,
            point[0] + (near[0] - point[0]) * t,
            point[1] + (near[1] - point[1]) * t
          );
          if (on.water && !on.ford) wet = true;
          else if (on.water || on.marsh) soft = true;
        }
        if (wet) barred++;
        else if (soft) slowed++;
        cover += here.wood ? 1 : here.marsh ? 0.5 : 0;
        rise += (here.height - Battlefields.terrainAt(field, ...near).height) * field.relief;
      }
      const count = COVER.length;
      const hidden = cover / count >= HIDDEN || distance >= unseen;
      const off = far > nearest ? (distance - nearest) / (far - nearest) : 0;
      const worth =
        (cover / count) * 2 +
        this.clamp(rise / count / OVERLOOK, -0.5, 0.5) -
        (slowed / count) * 0.5 -
        (barred / count) * 3 -
        off * 0.5; // as near as they may, to close before the column finds its feet
      return { frame, cover: worth, hidden, fits: !barred };
    };

    const spring = (at: number) => {
      const road = route.at(at);
      const trail: Point[] = [];
      for (let along = at - length / 2; along <= at + length / 2 + cell / 2; along += cell) {
        const { x, y } = route.at(along);
        trail.push([x, y]);
      }
      const far = Math.max(Math.min(this.reach(field, road.heading + Math.PI / 2) * 0.75 - half, furthest), nearest);
      const lairs = [0, 1].map(side => {
        let best = rate(road, trail, side, far, far);
        for (let distance = nearest; distance < far; distance += cell) {
          const lair = rate(road, trail, side, distance, far);
          if (lair.cover > best.cover) best = lair;
        }
        return best;
      });
      const [low, high] = [lairs[0].cover, lairs[1].cover].sort((a, b) => a - b);
      const worth = high + low / 2 - (Math.abs(at - centre) / Math.max(span[1] - span[0], 1)) * 0.2;
      return { road, middle: at, lairs, worth };
    };

    let best = spring(centre); // on even ground the middle of the field
    for (let at = span[0]; at <= span[1]; at += front) {
      const site = spring(at);
      if (site.worth > best.worth) best = site;
    }
    return best;
  }

  /** The besiegers stand out of bowshot of the walls, their engines a row behind the first line, still in range */
  private layLines(battle: Battle, battalions: Battalion[]): void {
    const { field } = battle;
    const { front } = field;
    const burg = field.burgs[field.held!];
    const engines = battalions.filter(battalion => battalion.kind === "machinery");
    const places = Formations.form(
      battalions.filter(battalion => battalion.kind !== "machinery"),
      TACTICS.lines,
      1,
      this.getRoom(battle),
      front
    );
    const rowGap = ROW_GAP * front;
    if (engines.length) {
      for (const place of places) if (place.rank > 0) place.along -= rowGap;
      let offset = -sum(engines, battalion => battalion.width + GAP * front) / 2;
      for (const battalion of engines) {
        const across = offset + battalion.width / 2;
        places.push({ battalion, role: "battery", mission: "battery", rank: 1, across, along: -rowGap });
        offset += battalion.width + GAP * front;
      }
    }
    const away = battle.axis + Math.PI;
    const depth = -Math.min(...places.map(place => place.along), 0);
    const margin = this.getMargin(field);
    const inside = (distance: number): boolean => {
      const [x, y] = [burg.x + Math.cos(away) * distance, burg.y + Math.sin(away) * distance];
      return x >= margin && y >= margin && x <= field.width - margin && y <= field.height - margin;
    };
    // the line comes nearer than the ring where the engines behind it would not reach the walls
    const reach = Math.min(...engines.map(battalion => Sight.getReach(battle, battalion, true))) - rowGap - 14;
    const edge = Battlefields.getEdge(burg, away); // the walls before the line, not the burg's far end
    let distance = edge + Math.min(this.getRingDistance(battle), Math.max(reach, 80));
    while (distance > edge + 80 && !inside(distance + depth)) distance -= 14;
    const frame = {
      x: burg.x + Math.cos(away) * distance,
      y: burg.y + Math.sin(away) * distance,
      heading: battle.axis
    };
    this.seat(battle, "attackers", this.createPlan("lines", frame), places);
  }

  /** How far out of the walls the besiegers will stand, by the garrison's arms: the field of a siege is sized to it */
  getSiegeRing(battle: Battle): number {
    const ranges = battle.defenders.regiments.flatMap(regiment =>
      Object.entries(regiment.troops)
        .filter(([, troops]) => troops > 0)
        .map(([name]) => battle.units.find(unit => unit.name === name)?.range ?? 0)
    );
    return this.getRing(ranges);
  }

  private getRingDistance(battle: Battle): number {
    return this.getRing(
      battle.battalions.map(battalion => (battalion.side === "defenders" ? Sight.getReach(battle, battalion, true) : 0))
    );
  }

  /** Out of the reach of the garrison's shooters: those that outrange the ring, engines, it cannot keep out of */
  private getRing(reaches: number[]): number {
    const outranged = reaches.filter(reach => reach + RING_GAP <= RING);
    return Math.max(...outranged, BOWSHOT) + RING_GAP;
  }

  /** Whether a besieger keeps the gate shut: near it, with the ring all but at the gate; neighbours a battalion along do too */
  private watches(battle: Battle, battalion: Battalion, wall: FieldWall): boolean {
    return (
      Math.hypot(battalion.x - (wall.a[0] + wall.b[0]) / 2, battalion.y - (wall.a[1] + wall.b[1]) / 2) <
      this.getRingDistance(battle) + WATCH
    );
  }

  /** Besiegers three times as strong and many enough ring a walled burg in */
  private canRing(battle: Battle, battalions: Battalion[]): boolean {
    return (
      Movement.hasWalls(battle) &&
      battalions.length >= RING_BATTALIONS &&
      this.getOdds(battle, "attackers") >= RING_ODDS
    );
  }

  /**
   * The besiegers ring the burg in out of bowshot: the strongest battalions by its gates, the rest spread round between,
   * the engines behind them, ships off its quay and on the water about it
   */
  private ringIn(battle: Battle, battalions: Battalion[]): void {
    const { field } = battle;
    const held = field.held!;
    const burg = field.burgs[held];
    const distance = this.getRingDistance(battle);
    const frame = { x: burg.x, y: burg.y, heading: battle.axis };
    const plan = this.createPlan("ring", frame, true);
    battle.attackers.plan = plan;

    // spots round the walls, on the field: on land for troops, on the water for ships
    const around = (distance: number): Point[] =>
      Array.from({ length: 72 }, (_, i): Point => {
        const angle = (i / 72) * Math.PI * 2;
        const edge = Battlefields.getEdge(burg, angle); // the walls that way
        return this.onField(field, [
          burg.x + Math.cos(angle) * (edge + distance),
          burg.y + Math.sin(angle) * (edge + distance)
        ]);
      });
    const spots = around(distance);
    const wet = (point: Point): boolean => Battlefields.terrainAt(field, ...point).water > 0;
    const taken: Point[] = [];
    /** The spot nearest the point, or the one furthest from the others taken when there is no point */
    const take = (ships: boolean, near: Point | null): Point | null => {
      const kind = spots.filter(spot => wet(spot) === ships);
      const free = kind.filter(spot => !taken.includes(spot));
      let best: Point | null = null;
      let most = -Infinity;
      for (const spot of free.length ? free : kind) {
        const value = near
          ? -Math.hypot(spot[0] - near[0], spot[1] - near[1])
          : Math.min(...taken.map(other => Math.hypot(other[0] - spot[0], other[1] - spot[1])), Infinity);
        if (value > most) [best, most] = [spot, value];
      }
      if (best) taken.push(best);
      return best;
    };

    const gates = Battlefields.getGates(field, held);
    const mid = (wall: FieldWall): Point => [(wall.a[0] + wall.b[0]) / 2, (wall.a[1] + wall.b[1]) / 2];
    const byStrength = (a: Battalion, b: Battalion): number => Battalions.getStrength(b) - Battalions.getStrength(a);
    const ships = battalions.filter(battalion => Movement.isMoored(battle, battalion)).sort(byStrength);
    const troops = battalions.filter(battalion => !Movement.isMoored(battle, battalion));
    const fighters = troops.filter(battalion => battalion.kind !== "machinery").sort(byStrength);
    const engines = troops.filter(battalion => battalion.kind === "machinery");
    const places = new Map<Battalion, Point>();
    const put = (battalion: Battalion | undefined, near: Point | null): void => {
      if (!battalion) return;
      const spot = take(Movement.isMoored(battle, battalion), near);
      // ships with no water round the walls put out off the quay; settle finds them the water
      places.set(battalion, spot ?? near ?? [burg.x, burg.y]);
    };
    for (const gate of gates) put(gate.water === 1 ? ships.shift() : fighters.shift(), mid(gate));
    for (const battalion of [...fighters, ...ships]) put(battalion, null);

    // the engines a row behind the ring, each behind a battalion and spread round, still in reach of the walls
    const reach = Math.min(...engines.map(battalion => Sight.getReach(battle, battalion, true))) - 14;
    const back = around(Math.max(Math.min(distance + ROW_GAP * field.front, reach), distance));
    const guarded = [...places]
      .filter(([battalion]) => !Movement.isMoored(battle, battalion))
      .map(([, spot]) => spots.indexOf(spot))
      .filter(i => i >= 0 && !wet(back[i]));
    const dry = back.map((_, i) => i).filter(i => !wet(back[i]));
    const sited: Point[] = [];
    for (const battalion of engines) {
      const free = (list: number[]): number[] => list.filter(i => !sited.includes(back[i]));
      const choice = [free(guarded), free(dry), dry].find(list => list.length);
      if (!choice) {
        places.set(battalion, [burg.x, burg.y]);
        continue;
      }
      const apart = (i: number): number =>
        Math.min(...sited.map(other => Math.hypot(other[0] - back[i][0], other[1] - back[i][1])), Infinity);
      const best = choice.reduce((a, b) => (apart(b) > apart(a) ? b : a));
      sited.push(back[best]);
      places.set(battalion, back[best]);
    }

    for (const [battalion, [x, y]] of places) {
      const role = ROLES[battalion.kind];
      const [across, along] = this.toFrame(frame, { x, y });
      const facing = Math.atan2(burg.y - y, burg.x - x);
      const mission = role === "wing" ? "guard" : role;
      const rank = battalion.kind === "machinery" ? 1 : 0;
      battalion.order = { role, mission, rank, across, along, ahead: null, x, y, facing, target: null, sent: false };
      [battalion.x, battalion.y, battalion.facing] = [x, y, facing];
    }
  }

  /** The burg is cut off: every gate has a besieger in order near, a ship by a quay, troops by a road, either by a river */
  isCutOff(battle: Battle): boolean {
    const { field } = battle;
    if (battle.attackers.plan.tactic !== "ring" || battle.attackers.phase === "retreat") return false;
    const watchers = battle.battalions.filter(battalion => battalion.side === "attackers" && this.isInOrder(battalion));
    return Battlefields.getGates(field, field.held).every(wall => {
      return watchers.some(battalion => {
        const fits = wall.water === 2 || (wall.water === 1) === Movement.isMoored(battle, battalion);
        return fits && this.watches(battle, battalion, wall);
      });
    });
  }

  /** The besieged man their walls: engines, shooters and some line troops on them where the foe stands, line troops in the gates, the rest in the middle */
  private manWalls(battle: Battle, battalions: Battalion[]): void {
    const burg = battle.field.burgs[battle.field.held!];
    battle.defenders.plan = this.createPlan("garrison", { x: burg.x, y: burg.y, heading: battle.axis + Math.PI }, true);
    this.postWithin(battle, battalions, []);
  }

  /** Stand the battalions within the walls, each where its kind serves best and apart from the spots taken */
  private postWithin(battle: Battle, battalions: Battalion[], taken: Point[]): void {
    const { field } = battle;
    const held = field.held!;
    const burg = field.burgs[held];
    const frame = battle.defenders.plan;
    const take = this.getStreetTaker(field, taken);
    const toFoe = ([x, y]: Point): number =>
      (x - burg.x) * Math.cos(frame.heading) + (y - burg.y) * Math.sin(frame.heading);
    const toMiddle = ([x, y]: Point): number => -Math.hypot(x - burg.x, y - burg.y);
    const spots: Record<Battalion["kind"], (point: Point) => number> = {
      ranged: toFoe,
      melee: point => toMiddle(point) + toFoe(point) * 0.3, // the gates have their own
      machinery: point => toMiddle(point) + toFoe(point) * 0.5,
      mounted: toMiddle
    };
    const posts = Battlefields.getWallPosts(field, held);
    /** The free post of the kind that scores best for the battalion: its front on the wall, facing out; none when all are taken */
    const manned: [Point, number][] = [];
    const post = (battalion: Battalion, opening: boolean): [Point, number] | null => {
      // a neighbour on the wall is a width away, and a depth more as far as the wall bends between them
      const clear = (at: Point, out: number): boolean =>
        manned.every(([other, turn]) => {
          const apart = battalion.width * 1.05 + battalion.depth * Math.abs(Math.sin(out - turn));
          return Math.hypot(other[0] - at[0], other[1] - at[1]) >= apart;
        });
      let best: [Point, number] | null = null;
      let most = -Infinity;
      for (const spot of posts) {
        if (spot.opening !== opening) continue;
        const at = Battlefields.toPost(field, battalion, spot);
        if (
          !at ||
          !clear(at, spot.out) ||
          taken.some(other => Math.hypot(other[0] - at[0], other[1] - at[1]) < battalion.width)
        )
          continue;
        if (toFoe(at) > most) [best, most] = [[at, spot.out], toFoe(at)];
      }
      if (best) {
        taken.push(best[0]);
        manned.push(best);
      }
      return best;
    };
    let streets = 0; // line troops past the gates so far: every other one goes up on the walls
    // engines take the walls first, where the foe stands: from their height they reach the furthest; then shooters,
    // then line troops the gates and some the walls. Ships keep to the water
    const engine = (battalion: Battalion): boolean => battalion.kind === "machinery" && battalion.type !== "naval";
    const rank = (battalion: Battalion): number => (engine(battalion) ? 2 : battalion.kind === "ranged" ? 1 : 0);
    const order = [...battalions].sort((a, b) => rank(b) - rank(a));
    for (const battalion of order) {
      let posted = engine(battalion) || battalion.kind === "ranged" ? post(battalion, false) : null;
      if (battalion.kind === "melee") {
        posted = post(battalion, true);
        if (!posted && streets++ % Math.round(1 / ON_WALLS) === 0) posted = post(battalion, false);
      }
      const [[x, y], facing] = posted ?? [take(spots[battalion.kind]), frame.heading];
      const role = battalion.kind === "mounted" ? "reserve" : ROLES[battalion.kind];
      const mission = role === "wing" ? "reserve" : role;
      const [across, along] = this.toFrame(frame, { x, y });
      battalion.order = {
        role,
        mission,
        rank: 0,
        across,
        along,
        ahead: null,
        x,
        y,
        facing,
        target: null,
        sent: false
      };
      [battalion.x, battalion.y, battalion.facing] = [x, y, facing];
    }
  }

  /** A picker of the free spot in the streets that scores best, apart from those taken; it takes the spot */
  private getStreetTaker(field: Battlefield, taken: Point[]): (score: (point: Point) => number) => Point {
    const held = field.held!;
    const burg = field.burgs[held];
    let nodes = field.walled.map((_, node) => node).filter(node => field.walled[node] === held + 1);
    if (nodes.some(node => !field.rampart[node])) nodes = nodes.filter(node => !field.rampart[node]);
    if (!nodes.length) nodes = [Battlefields.nodeAt(field, burg.x, burg.y)]; // a burg smaller than a node of the grid
    const apart = field.front * APART;
    return score => {
      let best = Battlefields.nodeCentre(field, nodes[0]);
      let most = -Infinity;
      for (const node of nodes) {
        const point = Battlefields.nodeCentre(field, node);
        const crowd = sum(taken, other => Math.max(apart - Math.hypot(other[0] - point[0], other[1] - point[1]), 0));
        const value = score(point) - crowd * 4;
        if (value > most) [best, most] = [point, value];
      }
      taken.push(best);
      return best;
    };
  }

  /**
   * The garrison on its walls: under bombardment who holds a post takes cover in the streets, and goes back up
   * when it ends; in a storm battalions from the streets and from posts nobody comes at go to those stormers come at.
   * A garrison battalion's across and along keep its post, its x and y where it stands now
   */
  private holdWalls(battle: Battle, own: SideView, foe: SideView): void {
    const { field } = battle;
    const plan = battle.defenders.plan;
    const held = field.held!;
    const posts = Battlefields.getWallPosts(field, held);
    const reach = field.front;
    const near = (spot: WallPost, at: { x: number; y: number }): number =>
      Math.hypot(spot.at[0] - at.x, spot.at[1] - at.y);
    const postOf = (battalion: Battalion): Point => this.toField(plan, battalion.order.across, battalion.order.along);
    const isPosted = (battalion: Battalion): boolean => {
      const [x, y] = postOf(battalion);
      return posts.some(spot => near(spot, { x, y }) < battalion.depth + reach / 2);
    };
    // under bombardment those on the walls take cover in the streets, as far from the engines as they find room
    const bombarded = battle.attackers.phase === "bombardment";
    const posted = own.ready.filter(
      battalion =>
        !battalion.order.sent && !battalion.byHand.task && battalion.kind !== "machinery" && isPosted(battalion)
    );
    const engines = foe.ready.filter(battalion => battalion.kind === "machinery");
    const take = this.getStreetTaker(
      field,
      own.ready
        .filter(battalion => !posted.includes(battalion))
        .map(battalion => [battalion.order.x, battalion.order.y])
    );
    const cover = ([x, y]: Point): number => Math.min(...engines.map(engine => Math.hypot(engine.x - x, engine.y - y)));
    for (const battalion of posted)
      [battalion.order.x, battalion.order.y] = bombarded && engines.length ? take(cover) : postOf(battalion);
    if (!Movement.isStorming(battle)) return;

    // the posts stormers come at, the breaches and gates first; who stands in the streets or at a post nobody comes at
    // goes to those nobody holds
    const within = (battalion: Battalion): boolean =>
      Battlefields.terrainAt(field, battalion.x, battalion.y).walled === held + 1;
    const nearest = (at: { x: number; y: number }): WallPost =>
      posts.reduce((a, b) => (near(b, at) < near(a, at) ? b : a));
    const threats = new Set<WallPost>();
    for (const stormer of foe.ready) {
      if (within(stormer) || stormer.kind === "machinery") continue;
      const spot = nearest(stormer);
      if (near(spot, stormer) <= AT_WALLS * reach) threats.add(spot);
    }
    const covers = (battalion: Battalion, spot: WallPost, [x, y] = postOf(battalion)): boolean =>
      near(spot, { x, y }) < battalion.width / 2 + battalion.depth; // its front runs over the post
    const isThreatened = (battalion: Battalion): boolean => [...threats].some(spot => covers(battalion, spot));
    const spare = own.ready.filter(
      battalion =>
        (battalion.kind === "melee" || battalion.kind === "mounted") &&
        !battalion.order.sent &&
        !battalion.byHand.task &&
        battalion.morale >= SHAKEN &&
        !(isPosted(battalion) && isThreatened(battalion))
    );
    for (const spot of [...threats].sort((a, b) => Number(b.opening) - Number(a.opening))) {
      if (!spare.length) return;
      if (own.ready.some(battalion => covers(battalion, spot, [battalion.order.x, battalion.order.y]))) continue; // held
      const battalion = spare.reduce((a, b) => (near(spot, b) < near(spot, a) ? b : a));
      const at = Battlefields.toPost(field, battalion, spot);
      if (!at) continue;
      spare.splice(spare.indexOf(battalion), 1);
      const { order } = battalion;
      [order.x, order.y, order.facing] = [...at, spot.out];
      [order.across, order.along] = this.toFrame(plan, { x: at[0], y: at[1] });
      order.mission = "line";
    }
  }

  /**
   * Nobody is drawn up in the water, a ford neither, nor a besieger within the walls: such a battalion steps to the nearest
   * ground, rather back than forward, and not on a battalion of its side standing there. Ships put out to the nearest
   * water they sail, however far
   */
  settle(battle: Battle, battalions = battle.battalions): void {
    const { field } = battle;
    const shunned = (battalion: Battalion, x: number, y: number): boolean =>
      Movement.shuns(battle, battalion, x, y) ||
      Movement.isWet(battle, battalion, x, y) ||
      (battalion.side === "attackers" &&
        field.held !== null &&
        field.walled[Battlefields.nodeAt(field, x, y)] === field.held + 1); // besiegers stand outside the walls
    const radius = (battalion: Battalion): number => Math.max(battalion.width, battalion.depth) / 2;
    const unsettled = new Set(battalions.filter(battalion => shunned(battalion, battalion.x, battalion.y)));
    const standing = battle.battalions.filter(
      battalion => !unsettled.has(battalion) && (battalion.status === "ready" || battalion.status === "routed")
    );
    for (const battalion of unsettled) {
      const own = standing.filter(other => other.side === battalion.side);
      const taken = (x: number, y: number): boolean =>
        own.some(other => Math.hypot(other.x - x, other.y - y) < radius(battalion) + radius(other));
      const forward = battalion.side === "attackers" ? battle.axis : battle.axis + Math.PI;
      const node = Battlefields.nodeAt(field, battalion.x, battalion.y);
      const col = node % COLS;
      const row = (node - col) / COLS;
      const find = (span: number, spaced = true): Point | null => {
        let best: Point | null = null;
        let least = Infinity;
        for (let y = Math.max(row - span, 0); y <= Math.min(row + span, ROWS - 1); y++) {
          for (let x = Math.max(col - span, 0); x <= Math.min(col + span, COLS - 1); x++) {
            const [nx, ny] = Battlefields.nodeCentre(field, y * COLS + x);
            if (shunned(battalion, nx, ny) || (spaced && taken(nx, ny))) continue;
            const ahead = (nx - battalion.x) * Math.cos(forward) + (ny - battalion.y) * Math.sin(forward) > 0;
            const score = Math.hypot(nx - battalion.x, ny - battalion.y) + (ahead ? field.front * AHEAD : 0);
            if (score < least) [best, least] = [[nx, ny], score];
          }
        }
        return best;
      };
      const nearest = Movement.isMoored(battle, battalion) ? find(COLS) : (find(8) ?? find(COLS)); // the nearest ground, however far
      const best = nearest ?? find(COLS, false); // no room clear of the others: on them rather than in the water
      if (best) [battalion.x, battalion.y] = best;
      standing.push(battalion);
      this.takePlace(battle, battalion);
    }
  }

  /** A battalion moved by hand, or off the ground it could not stand on, keeps the place it is in now */
  takePlace(battle: Battle, battalion: Battalion): void {
    const plan = battle[battalion.side].plan;
    [battalion.order.across, battalion.order.along] = this.toFrame(this.frameOf(plan, battalion.order.role), battalion);
    [battalion.order.x, battalion.order.y] = [battalion.x, battalion.y];
  }

  /** Latecomers form up behind their side and wait there */
  enlist(battle: Battle, side: Side, battalions: Battalion[]): void {
    const plan = battle[side].plan;
    const friends = battle.battalions.filter(
      battalion => battalion.side === side && this.isInOrder(battalion) && !battalions.includes(battalion)
    );
    const { field } = battle;
    if (plan.tactic === "garrison" && field.held !== null) {
      this.postWithin(
        battle,
        battalions,
        friends.map(battalion => [battalion.x, battalion.y])
      ); // within its walls
      this.settle(battle, battalions);
      return;
    }
    const rear = Math.min(...friends.map(battalion => this.toFrame(plan, battalion)[1]), 0) - ROW_GAP * field.front;
    const places = Formations.form(battalions, TACTICS.assault, 1, this.getRoom(battle), field.front);
    for (const place of places) place.along += rear;
    const frame = { x: plan.x, y: plan.y, heading: plan.heading };
    this.keepOnField(field, frame, places); // as a body: places clamped one by one end up on each other
    for (const { battalion, role, rank, across, along } of places) {
      const [x, y] = this.onField(field, this.toField(frame, across, along));
      const mission = role === "line" ? "reserve" : role === "wing" || role === "wedge" ? "guard" : role;
      const [right, ahead] = this.toFrame(plan, { x, y });
      battalion.order = {
        role: role === "line" ? "reserve" : role,
        mission,
        rank: rank + 1,
        across: right,
        along: ahead,
        ahead: null,
        x,
        y,
        facing: plan.heading,
        target: null,
        sent: false
      };
      [battalion.x, battalion.y, battalion.facing] = [x, y, plan.heading];
    }
    this.settle(battle, battalions); // off the water behind the line
  }

  /** A round begins: both generals read the field, set their phase and give their orders */
  command(battle: Battle): void {
    const views = { attackers: this.survey(battle, "attackers"), defenders: this.survey(battle, "defenders") };
    const gap = this.getGap(views.attackers.ready, views.defenders.ready);
    const before = this.getCommands(battle);
    for (const side of SIDES)
      battle[side].plan.arrival = this.getArrival(battle, side, views[BattleRules.enemyOf(side)], gap);
    for (const side of SIDES) this.release(battle, side);
    this.spring(battle, views.defenders, views.attackers);
    const phases = SIDES.map(side =>
      this.choosePhase(battle, side, views[side], views[BattleRules.enemyOf(side)], gap)
    );
    SIDES.forEach((side, i) => {
      const was = battle[side].phase;
      if (phases[i] === was) return;
      battle[side].plan.since = battle.round;
      if (phases[i] === FEINT) battle.log.push({ tick: battle.tick, event: "feint", side });
      else if (was === FEINT && phases[i] === POSTURES[battle.type][side].close) this.turnAbout(battle, side);
    });
    [battle.attackers.phase, battle.defenders.phase] = phases;
    for (const side of SIDES) this.direct(battle, side, views[side], views[BattleRules.enemyOf(side)], gap);
    this.getCommands(battle).forEach((order, i) => {
      if (!battle.tick || order !== before[i])
        battle.log.push({ tick: battle.tick, event: "order", side: SIDES[i], params: { order } });
    });
  }

  /** The order a side is under: the one given by hand while it stands, else what its phase comes to */
  getOrder(battle: Battle, side: Side): Command {
    const { phase, advancing, plan } = battle[side];
    if (!plan.byHand.order && this.isShootingFirst(battle, side)) return "skirmish";
    return plan.byHand.order ?? (plan.fortify ? "fortify" : BattleRules.getCommand(battle.type, phase, advancing));
  }

  /**
   * Ticks till the foe is within a charge of the side, by how fast it closed last round; in the first round a foe that
   * advances comes at the pace of its first line. Infinity when it does not come, none when it is there
   */
  private getArrival(battle: Battle, side: Side, foe: SideView, gap: number): number {
    const { plan } = battle[side];
    const left = gap - CHARGE * battle.field.front;
    if (left <= 0) return 0;
    let rate = plan.gap - gap;
    if (!Number.isFinite(plan.gap)) {
      const first = foe.ready.filter(battalion => battalion.order.rank === 0 && battalion.order.role !== "wing");
      const advancing = battle[BattleRules.enemyOf(side)].advancing && first.length > 0;
      rate = advancing ? Math.min(...first.map(battalion => Movement.getPace(battle, battalion))) * ROUND_TICKS : 0;
    }
    return rate > PACE * CLOSING ? (left / rate) * ROUND_TICKS : Infinity;
  }

  getCommands(battle: Battle): Command[] {
    return SIDES.map(side => this.getOrder(battle, side));
  }

  /** An order given by hand: the side goes over to the phase it takes, and its general keeps to it for a while */
  obey(battle: Battle, side: Side, command: Command): void {
    const data = battle[side];
    const phase = COMMANDS[battle.type][side][command];
    if (!phase || (data.phase === SURRENDER && battle.tick)) return; // not an order for such a battle, or arms laid down
    // told to fight on from a retreat, it does in any battle, and its general gives up the field no more
    const lifted = data.phase === POSTURES[battle.type][side].run && command !== "retreat" && command !== "surrender";
    if (lifted) {
      data.plan.byHand.stands = true;
      data.plan.declined = false;
      if (side === "attackers") battle.raised = false;
    } else if (command === "retreat") data.plan.byHand.stands = false;
    if (
      lifted ||
      (!BattleRules.keepsPhase(battle.type, command) &&
        (this.getOrder(battle, side) !== command || data.phase === FEINT))
    ) {
      if (data.phase === FEINT && phase === POSTURES[battle.type][side].close) this.turnAbout(battle, side);
      data.phase = phase;
    }
    Object.assign(data.plan.byHand, { order: command, round: battle.round });
    data.plan.since = battle.round;
    // the order also says who comes to whom; in a siege the phase does. Told to go for the foe, a general who meant to wait attacks
    if (battle.type !== "siege" && command !== "retreat" && command !== "surrender") {
      data.advancing = command !== "hold" && command !== "defend" && command !== "fortify";
      if (data.advancing) data.waits = false;
    }
    data.plan.fortify = command === "fortify";
    if (battle.tick)
      this.direct(
        battle,
        side,
        this.survey(battle, side),
        this.survey(battle, BattleRules.enemyOf(side)),
        battle[side].plan.gap,
        false
      );
  }

  /** Ambushers who shoot from cover fall on the column once it wavers, has come to grips with them, or the surprise is spent */
  private spring(battle: Battle, own: SideView, foe: SideView): void {
    const data = battle.defenders;
    if (!this.isShootingFirst(battle, "defenders") || data.plan.byHand.order) return;
    const fought = battle.engaged === null ? 0 : battle.round - battle.engaged;
    const upon = own.ready.some(battalion => battalion.action === "fight"); // they lie a javelin's throw off: nearness says nothing
    if (own.fire && !upon && foe.morale >= WAVERING && fought < data.plan.opening) return;
    Object.assign(data, { waits: false, advancing: true });
  }

  /** An order given by hand has stood its time: the general decides again */
  private release(battle: Battle, side: Side): void {
    const { plan } = battle[side];
    if (plan.byHand.round === null || battle.round - plan.byHand.round < battle.settings.orderRounds) return;
    Object.assign(plan.byHand, { order: null, round: null });
    // in the open the general goes over to the attack as he would have, but does not call off one under way
    if (!this.isOpenFight(battle)) battle[side].advancing = this.isAttacking(battle, side, false);
    else if (!BattleRules.isBeaten(battle.type, side, battle[side].phase))
      battle[side].advancing ||= this.isAttacking(battle, side, plan.tactic === "crossing");
  }

  /** The space between the nearest troops in order of the two sides, engines apart */
  private getGap(own: Battalion[], foes: Battalion[]): number {
    // engines are no line, nor shooters who step before it to stand off
    const lines = (battalions: Battalion[]): Battalion[] => {
      const all = battalions.filter(battalion => battalion.kind !== "machinery");
      const line = all.filter(battalion => battalion.order.ahead === null);
      return line.length ? line : all;
    };
    const theirs = lines(foes);
    let gap = Infinity;
    for (const battalion of lines(own))
      for (const foe of theirs) gap = Math.min(gap, this.far(battalion, foe) - battalion.depth);
    return gap;
  }

  private choosePhase(battle: Battle, side: Side, own: SideView, foe: SideView, gap: number): Phase {
    const { phase, plan } = battle[side];
    if (phase === SURRENDER) return phase;
    if (plan.byHand.order && !BattleRules.keepsPhase(battle.type, plan.byHand.order)) return phase; // the order is the phase
    const next = this.readPhase(battle, side, own, foe, gap);
    const { chase, run } = POSTURES[battle.type][side];
    // the fight takes its course, but the side neither runs nor gives chase against its order
    if (plan.byHand.order && (next === chase || next === run)) return phase;
    if (plan.byHand.stands && next === run) return phase;
    return next;
  }

  /** Attackers of a landing still on the water, ships apart: they keep to it */
  private isAfloat(battle: Battle): boolean {
    return battle.battalions.some(
      battalion =>
        battalion.side === "attackers" &&
        this.isInOrder(battalion) &&
        !Movement.isMoored(battle, battalion) &&
        Battlefields.terrainAt(battle.field, battalion.x, battalion.y).water === 1
    );
  }

  /** The phase a general puts his side in, by how the fight stands */
  private readPhase(battle: Battle, side: Side, own: SideView, foe: SideView, gap: number): Phase {
    const { phase, plan } = battle[side];
    const names = POSTURES[battle.type][side];
    if (battle.type === "siege" && battle.field.held !== null)
      return side === "attackers" ? this.besiege(battle, own, foe) : this.withstand(battle, own, foe);
    if (phase === names.run || plan.tactic === "strategicRetreat") return names.run; // a side that turned to run does not come back
    if (phase === FEINT) return this.feign(battle, side, own, foe);

    const fought = battle.engaged === null ? -1 : battle.round - battle.engaged;
    if (battle.type === "ambush" && fought < plan.opening && !this.isLost(battle, own, foe)) return names.apart; // surprise and shock
    // the surprise spent, ambushers much the weaker who shot from cover slip away unless the column wavers
    const loose = !own.ready.some(battalion => battalion.action === "fight");
    const slips =
      side === "defenders" && loose && fought >= plan.opening && own.power * KEEN < foe.power && foe.morale >= WAVERING;
    if (battle.type === "ambush" && slips) return names.run;
    if (battle.type === "landing") {
      const landing = battle.attackers.phase === "landing";
      if (side === "attackers" && landing && this.isAfloat(battle) && !this.isLost(battle, own, foe)) return phase; // the fight for the shore
      if (side === "defenders") {
        if (battle.attackers.phase === "flee") {
          const ashore = battle.battalions.some(
            battalion =>
              battalion.side === "attackers" &&
              this.isOnField(battalion) &&
              !Battlefields.terrainAt(battle.field, battalion.x, battalion.y).water
          );
          return ashore ? "pursue" : "waiting";
        }
        if (landing && !this.isLost(battle, own, foe)) return battle.round ? phase : "defense";
      }
    }
    return this.engage(battle, side, own, foe, gap);
  }

  private isOnField(battalion: Battalion): boolean {
    return battalion.status === "ready" || battalion.status === "routed";
  }

  /** The day is lost: too few are left in order to go on, as the blows would land on the ground both sides stand on */
  private isLost(battle: Battle, own: SideView, foe: SideView): boolean {
    if (!own.ready.length) return true;
    const odds =
      (own.power * this.getPurchase(battle, own, foe)) / (foe.power * this.getPurchase(battle, foe, own) || 1e-9);
    const bled = own.losses >= 1 / 2 ? 1 : own.losses >= 1 / 4 ? 2 / 3 : 1 / 3; // the more is lost the better odds it takes to go on
    return odds < bled || own.morale < 25;
  }

  /**
   * The day is lost in a fight in the open; in a bombardment ships and troops only shoot: fire against fire.
   * A side told by hand to fight a day its general gave up before it began is not sent off by the odds he saw: by blood and
   * heart only
   */
  private isDayLost(battle: Battle, side: Side, own: SideView, foe: SideView): boolean {
    const lost =
      battle.type === "bombardment"
        ? this.isLost(battle, { ...own, power: own.fire }, { ...foe, power: foe.fire })
        : this.isLost(battle, own, foe);
    return lost && (!battle[side].plan.byHand.defiant || own.losses >= 1 / 4 || own.morale < 25 || !own.ready.length);
  }

  /**
   * The sides whose generals see the day lost before it begins and leave the field, read once the troops stand, works and
   * all, as the first round will read it. A side given a tactic by hand fights it all the same; one told to go on by an
   * order does so while the order stands
   */
  giveUp(battle: Battle, retreating: Side[]): Side[] {
    if (battle.type === "ambush" || battle.type === "siege") return [];
    return SIDES.filter(side => {
      if (retreating.includes(side)) return false;
      const order = battle.interventions.findLast(change => change.kind === "order" && change.side === side);
      if (order?.kind === "order" && order.order !== "retreat") return false;
      const own = this.survey(battle, side);
      if (!this.isDayLost(battle, side, own, this.survey(battle, BattleRules.enemyOf(side)))) return false;
      const hand = this.getHandTactic(battle, side);
      battle[side].plan.byHand.defiant = hand !== null && hand !== "strategicRetreat";
      return hand === null;
    });
  }

  /**
   * How well a side's blows would tell on the foe where it stands: the striker's footing just before the foe's line over the
   * foe's own footing, and the foe's wagons between, as the blows reckon them. A uniform slope favours neither side.
   * Field battles only: a landing wades ashore by its plan, ships and fliers have no footing, a siege has its walls
   */
  private getPurchase(battle: Battle, from: SideView, at: SideView): number {
    const striker = from.ready[0];
    if (battle.type !== "field" || !striker || !at.ready.length) return 1;
    const { field } = battle;
    let landed = 0;
    let total = 0;
    for (const target of at.ready) {
      const away = Math.atan2(from.y - target.y, from.x - target.x);
      const reach = target.depth / 2 + CONTACT;
      const there = { ...striker, x: target.x + Math.cos(away) * reach, y: target.y + Math.sin(away) * reach };
      const strikes = Movement.getFooting(battle, there, Battlefields.terrainAt(field, there.x, there.y));
      const stands = Movement.getFooting(battle, target, Battlefields.terrainAt(field, target.x, target.y));
      const weight = Battalions.getStrength(target);
      landed += (weight * strikes * Works.getShelter(battle, there, target)) / stands;
      total += weight;
    }
    return total ? landed / total : 1;
  }

  /** Two armies in the open: stand off and shoot, close, chase or run */
  private engage(battle: Battle, side: Side, own: SideView, foe: SideView, gap: number): Phase {
    const data = battle[side];
    const { phase, plan } = data;
    const names = POSTURES[battle.type][side];
    if (this.isDayLost(battle, side, own, foe)) return names.run;
    const enemy = battle[BattleRules.enemyOf(side)];
    if (
      BattleRules.isBeaten(battle.type, BattleRules.enemyOf(side), enemy.phase) ||
      enemy.phase === FEINT ||
      foe.share <= 0.25
    )
      return names.chase; // a foe who feigns flight is taken at his word
    // the attack is called off: it costs far more blood than it draws
    const [fallen, felled] = [data.casualties, battle[BattleRules.enemyOf(side)].casualties];
    if (data.advancing && fallen >= REPULSED && fallen >= felled * 3) return names.run;
    // the attackers will not go in and nobody comes at them: who sought the battle leaves the field
    const standing = !data.advancing && !battle[BattleRules.enemyOf(side)].advancing && phase === names.apart;
    const idle =
      standing && battle.round - plan.since >= DECLINED && !own.ready.some(battalion => battalion.action === "fight");
    if (side === "attackers" && this.isOpenFight(battle) && idle) {
      plan.declined = true;
      return names.run;
    }
    if (this.feints(battle, side, own)) return this.fallBack(battle, side, foe);
    if (phase === names.close || phase === names.chase) return names.close;
    if (!this.isOpenFight(battle)) return names.close;

    // standing off
    const atGrips = own.ready.some(battalion => battalion.action === "fight");
    // the engines are at the wagons: the troops wait out of the fight unless the foe comes out of them, whoever skirmishes
    const fort = data.advancing && !plan.byHand.order ? this.getFort(battle, side) : null;
    if (fort === "batter" && !battle[BattleRules.enemyOf(side)].advancing) return phase;
    if (atGrips || gap <= COUNTER * 1.5 * battle.field.front) return names.close; // the foe is upon us
    if (fort === "breached") return names.close; // in by the gaps
    // on broken ground the formation cannot always go where its battalions can: one that comes no nearer goes in
    if (data.advancing && battle.field.cliffs.length && data.plan.idle >= STALLED) return names.close;
    if (!data.advancing) return phase; // a defender waits
    if (!own.fire) return names.close; // nothing to stand off with
    if (battle.engaged === null) return phase; // an attacker is still coming up

    // a general shoots while he is better at it than at grips, and no longer than it pays
    const fireShare = own.fire / (own.fire + foe.fire);
    const gripShare = own.grip / (own.grip + foe.grip);
    if (gripShare > fireShare + 0.05) return names.close;
    if (own.ready.some(battalion => battalion.action === "shoot")) plan.fired ??= battle.round;
    // made for shooting: it closes to its range and no nearer, unless its shots fall short of where it halts (big battalions)
    if (own.grip <= own.fire && (plan.fired !== null || plan.reach >= this.getHalt(battle, plan))) return phase;
    if (fireShare < 0.5) return names.close; // the worse fire: nothing to gain by trading shots
    if (plan.fired === null) return battle.round - battle.engaged >= 4 ? names.close : phase; // out of his range
    const patience = this.clamp(Math.round(4 + 16 * (fireShare - 0.5)), 4, 12);
    return battle.round - plan.fired >= patience ? names.close : phase;
  }

  // A feigned retreat

  /**
   * Drawn up to feign flight, a field side at grips falls back as if broken, once in the battle: when its attack has stalled,
   * a while into the fight it has lost as many men as it took, while it is still fresh enough to turn
   */
  private feints(battle: Battle, side: Side, own: SideView): boolean {
    const { plan, phase } = battle[side];
    if (battle.type !== "field" || plan.tactic !== "feignedRetreat" || plan.lure) return false;
    if (phase !== POSTURES.field[side].close || battle.engaged === null) return false;
    if (battle.round - battle.engaged < FEINT_AFTER || !own.ready.some(battalion => battalion.action === "fight"))
      return false;
    if (own.morale < WAVERING) return false; // too worn to turn again: it would run for good
    return this.getFallen(battle, side) >= this.getFallen(battle, BattleRules.enemyOf(side));
  }

  /** Men a side has lost so far */
  private getFallen(battle: Battle, side: Side): number {
    return sum(battle.battalions, battalion => (battalion.side === side ? battalion.initial - battalion.troops : 0));
  }

  /** The formation falls back behind where it stood; the general marks where the foe stands, to see him come out */
  private fallBack(battle: Battle, side: Side, foe: SideView): Phase {
    const { plan } = battle[side];
    const { field } = battle;
    plan.lure = [foe.x, foe.y];
    plan.x -= Math.cos(plan.heading) * FEINT_BACK * field.front;
    plan.y -= Math.sin(plan.heading) * FEINT_BACK * field.front;
    const places = battle.battalions
      .filter(battalion => battalion.side === side && this.isInOrder(battalion))
      .map(battalion => battalion.order);
    this.keepOnField(field, plan, places);
    return FEINT;
  }

  /**
   * A side feigning flight turns once the foe has come out after it, has stood his ground after all, or it is back at its
   * places, or has run its course; a side that loses heart on the way runs for good
   */
  private feign(battle: Battle, side: Side, own: SideView, foe: SideView): Phase {
    const { plan } = battle[side];
    const names = POSTURES[battle.type][side];
    if (own.morale < SHAKEN || this.isDayLost(battle, side, own, foe)) return names.run;
    const rounds = battle.round - plan.since;
    if (rounds < 1) return FEINT;
    const [x, y] = plan.lure!;
    const lured = Math.hypot(foe.x - x, foe.y - y) >= LURED * battle.field.front;
    const stood = rounds >= 2 && battle[BattleRules.enemyOf(side)].phase !== names.chase; // he saw the foe run a round ago
    const back = own.ready.every(battalion => battalion.action === "hold");
    return lured || stood || back || rounds >= FEINT_ROUNDS ? names.close : FEINT;
  }

  /** The feint is over: the side goes for the foe, and who chased it out of order is caught so */
  private turnAbout(battle: Battle, side: Side): void {
    battle[side].advancing = true;
    battle.log.push({ tick: battle.tick, event: "turned", side });
    const enemy = BattleRules.enemyOf(side);
    if (battle[enemy].phase !== POSTURES[battle.type][enemy].chase) return;
    for (const battalion of battle.battalions) {
      const { role } = battalion.order;
      if (battalion.side !== enemy || !this.isInOrder(battalion) || role === "support" || role === "battery") continue;
      battalion.morale = Math.max(battalion.morale - DUPED / battalion.stats.steadiness, 0);
    }
  }

  // A siege

  /** Whether the besiegers are strong enough to storm the burg, with its walls as they stand */
  private getStormOdds(battle: Battle): number {
    const breaches = battle.field.breaches.filter(breach => breach.burg === battle.field.held).length;
    return Movement.hasWalls(battle) ? this.getWallsOdds(battle, breaches) : ASSAULT_ODDS;
  }

  /** The odds walls with so many breaches ask for: what they add tells less in the dark or the murk, stormers seen late */
  private getWallsOdds(battle: Battle, breaches: number): number {
    const seen = Sight.isLimited(battle) ? this.clamp(Sight.getSight(battle) / WALLS_SEEN, DARK_WALLS, 1) : 1;
    return 1 + (STORM_ODDS[Math.min(breaches, STORM_ODDS.length - 1)] - 1) * seen;
  }

  /** Besiegers in order on the walls of the burg, within them or at grips with those within */
  private isOnWalls(battle: Battle): boolean {
    const { held } = battle.field;
    const within = (battalion: Battalion): boolean => {
      const { walled, rampart } = Battlefields.terrainAt(battle.field, battalion.x, battalion.y);
      return walled === held! + 1 || rampart > 0;
    };
    return battle.battalions.some(battalion => {
      if (battalion.side !== "attackers" || !this.isInOrder(battalion)) return false;
      return within(battalion) || (battalion.action === "fight" && within(battle.battalions[battalion.target!]));
    });
  }

  /** Battalions of the side in order within the walls of the burg */
  private isWithin(battle: Battle, side: Side): boolean {
    return battle.battalions.some(
      battalion =>
        battalion.side === side &&
        this.isInOrder(battalion) &&
        Battlefields.terrainAt(battle.field, battalion.x, battalion.y).walled === battle.field.held! + 1
    );
  }

  private besiege(battle: Battle, own: SideView, foe: SideView): Phase {
    const { phase } = battle.attackers;
    if (phase === "retreat" || phase === "looting") return phase;
    if (battle.defenders.phase === SURRENDER || !foe.ready.length) return "looting";
    const odds = own.power / (foe.power || 1e-9);
    if (this.isLost(battle, own, foe) && !this.isOnWalls(battle)) return "retreat";
    // a garrison out in force that is half as strong again: the siege is raised
    if (battle.defenders.phase === "sortie" && this.isStrongGarrison(foe, own)) {
      battle.raised = true;
      return "retreat";
    }

    // a burg is stormed at the odds its walls ask for; a storm that lost them by a third is called off
    const need = this.getStormOdds(battle);
    const bold = battle.attackers.storms && !battle.round; // its general thought it through and storms at once
    // foot climbs the walls; riders get in by a breach only, engines not at all
    const breached = battle.field.breaches.some(breach => breach.burg === battle.field.held);
    const stormers = own.ready.some(
      battalion => Movement.canClimb(battalion) || (battalion.kind === "mounted" && breached)
    );
    const storm =
      stormers && (phase === "storming" ? odds >= (need * 2) / 3 || this.isOnWalls(battle) : odds >= need || bold);
    if (storm) {
      if (phase !== "storming") {
        battle.storm = battle.round;
        battle.lastLoss = battle.tick; // the lull is over
      }
      battle.attackers.plan.fired = battle.round; // a storm called off, the engines take it up again for a while
      return "storming";
    }
    battle.storm = null;
    const { plan } = battle.attackers;
    const patience = battle.settings.lullRounds;
    // a blockade bled by the garrison's engines, which it cannot answer, is raised
    const raise = (): Phase => {
      battle.raised = true;
      return "retreat";
    };
    if (!own.ready.some(battalion => battalion.kind === "machinery"))
      return phase === "blockade" && plan.bled >= patience ? raise() : "blockade";
    // engines fire while that brings the walls down before the day is out, and a while longer, to break the garrison
    // or draw it out; then they hold their fire
    const due =
      !Movement.hasWalls(battle) || this.getBatteringRounds(battle, odds) <= battle.settings.maxRounds - battle.round;
    if (due || plan.fired === null) plan.fired = battle.round;
    if (due || battle.defenders.phase === "sortie" || battle.round - plan.fired < patience) return "bombardment";
    return plan.bled >= patience ? raise() : "blockade";
  }

  /**
   * Rounds the engines take to bring the walls down to what the besiegers can storm at their odds, or as far as walls
   * get weaker when no breach would do: Infinity once they are
   */
  private getBatteringRounds(battle: Battle, odds: number): number {
    const breaches = battle.field.breaches.filter(breach => breach.burg === battle.field.held).length;
    if (!Battlefields.getBurgWalls(battle.field, battle.field.held).length) return Infinity; // all broken: nothing to batter
    const enough = STORM_ODDS.findIndex((_, i) => i >= breaches && odds >= this.getWallsOdds(battle, i));
    const aim = enough < 0 ? STORM_ODDS.length - 1 : enough;
    if (aim <= breaches) return Infinity;
    // engines tire at their work: they are reckoned at the half strength they keep it up with
    const blows =
      sum(Movement.getBatterers(battle), engine => engine.troops * engine.stats.upkeep * engine.stats.attack) / 2;
    return (aim - breaches - battle.battered) / (blows * (KILL_RATE / BREACH_BLOWS));
  }

  private withstand(battle: Battle, own: SideView, foe: SideView): Phase {
    const { phase, plan } = battle.defenders;
    const besiegers = battle.attackers.phase;
    if (besiegers === "retreat" || besiegers === SURRENDER) return "pursue";
    // the burg is given up when the garrison's heart is gone, or half of it with the besiegers on the walls and the stronger,
    // when it is cut off and starved, or when stormers stand in it and none of the garrison does: it is taken
    const fallen = own.losses >= 1 / 2 && own.power < foe.power && this.isOnWalls(battle);
    const starved = battle.cutOff && own.morale <= STARVED + 1;
    const taken = besiegers === "storming" && this.isWithin(battle, "attackers") && !this.isWithin(battle, "defenders");
    if (!own.ready.length || own.morale < 15 || fallen || starved || taken) return SURRENDER;
    if (besiegers === "storming" || besiegers === "looting") return "defense";

    // a sortie at engines left with fewer guards than the party: it comes home when they are done for, or it is.
    // A garrison half as strong again as the besiegers comes out to drive them off, and stays out while it is the stronger;
    // under the fire of their engines, which it cannot answer from the walls, one that is the stronger at all.
    // A garrison cut off has less to lose: it goes out on a lower heart and stays out longer
    const party = own.ready.filter(battalion => battalion.order.role === "reserve" || battalion.order.sent);
    const prey = this.getSortiePrey(battle, own, foe);
    const strong = this.isStrongGarrison(own, foe) || (besiegers === "bombardment" && own.power >= foe.power);
    const heart = battle.cutOff ? SHAKEN : 40;
    if (phase === "sortie") {
      const spent =
        sum(party, battalion => battalion.morale * battalion.troops) /
          (sum(party, battalion => battalion.troops) || 1) <
        heart;
      const out = plan.muster ? (plan.muster.launched ?? battle.round) : plan.since; // the time it formed up is not counted
      if (strong ? !spent && own.power >= foe.power : prey && !spent && battle.round - out < SORTIE_ROUNDS)
        return phase;
    } else {
      const sallies = own.ready.some(
        battalion => battalion.order.role === "reserve" || battalion.order.role === "line"
      ); // shooters and engines stay on the walls
      if (sallies && (prey || strong) && own.morale >= heart + 10 && battle.round - plan.since >= 3) return "sortie";
    }
    return own.ready.some(battalion => battalion.kind === "machinery") ? "bombardment" : "sheltering";
  }

  private isStrongGarrison(own: SideView, foe: SideView): boolean {
    return own.power >= foe.power * 1.5;
  }

  /**
   * The party of a sortie forms up outside a gate in rows facing its prey, or the besiegers: by the gate nearest them
   * with a front of open ground between the rows and the foe. Null when it is too few or no gate has that room
   */
  private musterSortie(battle: Battle, party: Battalion[], prey: Battalion | null, foe: SideView): Muster | null {
    const { field } = battle;
    const { front } = field;
    const burg = field.burgs[field.held!];
    const ashore = foe.ready.filter(battalion => !Movement.isMoored(battle, battalion));
    if (party.length < 2 || !ashore.length) return null;
    const goal = prey ?? {
      x: sum(ashore, battalion => battalion.x) / ashore.length,
      y: sum(ashore, battalion => battalion.y) / ashore.length
    };

    const abreast = Math.min(Math.max(Math.ceil(party.length / 2), 2), MUSTER_ROW);
    const depth = (Math.ceil(party.length / abreast) - 1) * ROW_GAP * front;
    const reach = MUSTER_OUT * front + depth / 2; // of the middle of the rows from the gate
    const clear = MUSTER_CLEAR * front;
    const open = ([x, y]: Point): boolean =>
      !Battlefields.terrainAt(field, x, y).walled &&
      !Movement.shuns(battle, party[0], x, y) &&
      ashore.every(battalion => this.far(battalion, this.toSpot([x, y])) >= clear);
    /**
     * The rows out of a gate, as near it as all of them stand out of the walls and the water and clear of the foe;
     * none on the far side of the burg from the goal
     */
    const lay = ([gx, gy]: Point) => {
      const out = Math.atan2(gy - burg.y, gx - burg.x);
      for (let further = 0; further <= MUSTER_FURTHEST; further += 0.5) {
        const distance = reach + further * front;
        const centre = { x: gx + Math.cos(out) * distance, y: gy + Math.sin(out) * distance };
        if (this.far(centre, goal) >= this.far(burg, goal)) return null; // a march round the burg is no sortie
        const heading = Math.atan2(goal.y - centre.y, goal.x - centre.x);
        const places = party.map((_, i): Point => {
          const row = Math.floor(i / abreast);
          const inRow = Math.min(abreast, party.length - row * abreast);
          const across = ((i % abreast) - (inRow - 1) / 2) * front * (1 + GAP);
          return this.onField(field, this.toField({ ...centre, heading }, across, depth / 2 - row * ROW_GAP * front));
        });
        if (places.every(open)) return { centre, heading, places, gate: this.toSpot([gx, gy]) };
      }
      return null;
    };
    let best: NonNullable<ReturnType<typeof lay>> | null = null;
    for (const wall of Battlefields.getGates(field, field.held)) {
      if (wall.water === 1) continue;
      const muster = lay([(wall.a[0] + wall.b[0]) / 2, (wall.a[1] + wall.b[1]) / 2]);
      if (muster && (!best || this.far(muster.centre, goal) < this.far(best.centre, goal))) best = muster;
    }
    if (!best) return null;

    // who is out of the gate first goes furthest, so nobody stands in the way of those behind
    const { centre, heading, places, gate } = best;
    places.sort((a, b) => this.far(this.toSpot(b), gate) - this.far(this.toSpot(a), gate));
    let march = 0; // ticks the slowest battalion takes to its place
    const homes: Muster["homes"] = {};
    [...party]
      .sort((a, b) => this.far(a, gate) - this.far(b, gate))
      .forEach((battalion, i) => {
        const [x, y] = places[i];
        homes[battalion.id] = [battalion.order.x, battalion.order.y, battalion.order.facing];
        Object.assign(battalion.order, { mission: "flank", sent: true, target: null, x, y, facing: heading });
        march = Math.max(march, this.far(battalion, { x, y }) / Movement.getPace(battle, battalion));
      });
    const [least, most] = MUSTER_ROUNDS;
    const rounds = Math.min(Math.max(Math.ceil((march * MUSTER_SLACK) / ROUND_TICKS), least), most);
    return { ...centre, heading, until: battle.round + rounds, launched: null, homes };
  }

  private toSpot([x, y]: Point): { x: number; y: number } {
    return { x, y };
  }

  /** A sortie formed up, kept waiting too long or met by the foe goes for its prey */
  private launchSortie(battle: Battle, own: SideView, foe: SideView): void {
    const muster = battle.defenders.plan.muster!;
    if (muster.launched !== null) return;
    const { front } = battle.field;
    const party = own.ready.filter(battalion => battalion.order.sent);
    const formed =
      party.filter(battalion => this.far(battalion, battalion.order) < MUSTERED * front).length >=
      (party.length * 2) / 3;
    const late = battle.round >= muster.until;
    const met = foe.ready.some(battalion => party.some(own => this.far(battalion, own) < MUSTER_MET * front)); // it comes upon the rows
    if (!formed && !late && !met) return;
    muster.launched = battle.round;
    const prey = this.getSortiePrey(battle, own, foe);
    for (const battalion of party) Object.assign(battalion.order, { mission: "hunt", target: prey?.id ?? null });
  }

  /**
   * What a sortie may go for, the nearest first: an engine whose guards the party outweighs by half, and when the burg
   * is cut off, a battalion that keeps a gate shut whose guards it outweighs at all
   */
  private getSortiePrey(battle: Battle, own: SideView, foe: SideView): Battalion | null {
    const { field } = battle;
    const burg = field.burgs[field.held!];
    const party = own.ready.filter(battalion => battalion.kind === "mounted" || battalion.kind === "melee");
    const might =
      sum(party, battalion => Battalions.getStrength(battalion)) / 2 +
      sum(party, battalion => (battalion.kind === "mounted" ? Battalions.getStrength(battalion) / 2 : 0));
    const ashore = foe.ready.filter(
      battalion => !Movement.isMoored(battle, battalion) && this.far(battalion, burg) < burg.radius + SORTIE
    );
    const gates = battle.cutOff ? Battlefields.getGates(field, field.held).filter(wall => wall.water !== 1) : [];
    const preys = ashore
      .filter(battalion => battalion.kind === "machinery" || gates.some(wall => this.watches(battle, battalion, wall)))
      .sort((a, b) => this.far(a, burg) - this.far(b, burg));
    for (const prey of preys) {
      // the engines themselves are a quarter of their worth hand to hand
      const guards = sum(foe.ready, battalion =>
        this.far(battalion, prey) < CHARGE * field.front
          ? Battalions.getStrength(battalion) * (battalion.kind === "machinery" ? 0.25 : 1)
          : 0
      );
      if (might > guards * (prey.kind === "machinery" ? 1.5 : 1)) return prey;
    }
    return null;
  }

  // Orders

  /** Move the formation and tell every battalion in order what to do this round; off a round (an order by hand) only the orders */
  private direct(battle: Battle, side: Side, own: SideView, foe: SideView, gap: number, round = true): void {
    const data = battle[side];
    const { plan, phase } = data;
    const names = POSTURES[battle.type][side];
    const tactic = TACTICS[plan.tactic];
    const siege = battle.type === "siege" && battle.field.held !== null;
    const stance = BattleRules.getStance(phase);
    const odds = own.power / (foe.power || 1e-9);
    const { field } = battle;

    // who comes to whom: a defender goes over when the attack is spent or does not come at all.
    // On broken ground the way round counts: who walks round a cliff to the foe comes on
    if (round) {
      const walk = field.cliffs.length ? this.getWalkBetween(battle) : Infinity;
      const closing = field.cliffs.length ? walk < plan.walk - PACE * CLOSING : gap < plan.gap - PACE * CLOSING;
      plan.walk = walk;
      // nor while its body does, behind the first who met: a long march on a big field
      const apart = this.far(own, foe);
      const nearing = apart < plan.apart - PACE * CLOSING;
      plan.apart = apart;
      // no lull while a side comes on; one that sits out a blockade does not, whoever shuffles about
      if (data.advancing && !BattleRules.isIdle(phase) && (closing || nearing)) battle.lastLoss = battle.tick;
      plan.idle = closing || gap < CHARGE * field.front ? 0 : plan.idle + 1;
      plan.gap = gap;
      const losses = this.getHarm(battle, side); // a trickle of shots tells every round, before a whole man falls
      plan.bled =
        losses > plan.losses && !own.ready.some(battalion => battalion.action === "fight") ? plan.bled + 1 : 0;
      plan.losses = losses;
    }
    const holds = plan.tactic === "crossing"; // who holds a crossing stays behind it till the foe runs
    const sheltered = Works.holdsWorks(battle, side); // and who holds works, till the foe is spent
    if (siege) data.advancing = side === "attackers" || phase === "sortie" || phase === "pursue";
    else if (phase === names.chase && names.chase !== names.close)
      data.advancing = true; // not a bombardment's one phase
    else if (!data.advancing && !plan.byHand.order && this.isOpenFight(battle) && phase !== names.run && !holds) {
      const spent = phase === names.close && odds >= 1.5;
      // the foe does not come: a side no weaker goes for it, unless that is a march into fire it cannot answer
      const waited =
        plan.idle >= 6 && odds >= 1 && battle.round >= 6 && !data.waits && own.fire >= foe.fire / 2 && !sheltered;
      // shot at with little to answer with, and better at grips: it will not stand there and take it
      const outshot = plan.bled >= 2 && own.fire < foe.fire / 2 && own.grip / (own.grip + foe.grip) > 1 / 3;
      // the foe digs a ditch or rings its wagons: a side no weaker comes on before they stand
      const provoked = !sheltered && odds >= 1 && !data.waits && Works.isDigging(battle, BattleRules.enemyOf(side));
      if (spent || waited || outshot || provoked) data.advancing = true;
    }
    plan.fortify = this.fortifies(battle, side);
    // no lull while a side builds within sight of the foe
    if (
      own.ready.some(battalion => battalion.action === "build") &&
      foe.ready.some(battalion => this.far(battalion, own) < field.width)
    )
      battle.lastLoss = battle.tick;

    // on broken ground a formation that went in and comes no nearer lets its battalions find their own ways to the foe
    if (round && field.cliffs.length && data.advancing && phase === names.close && plan.idle >= STALLED)
      for (const battalion of own.ready)
        if (!battalion.order.sent) Object.assign(battalion.order, { mission: "hunt", sent: true });

    if (siege && side === "attackers" && !Movement.isStorming(battle))
      [plan.x, plan.y] = plan.camp; // back to the lines
    else if (round && !plan.fixed && phase !== FEINT && (data.advancing || !(plan.fortify || sheltered)))
      this.moveFrame(battle, side, own, foe, gap); // the formation stays with its works till it advances
    const frameFoes = foe.ready.map(battalion => ({ battalion, at: this.toFrame(plan, battalion) }));
    if (round && plan.wedge && stance !== "flee") this.moveWedge(battle, side, own, frameFoes, gap);
    const standing = data.advancing && phase === names.apart && this.isOpenFight(battle); // shooters stand before the line

    for (const battalion of own.ready) {
      const order = battalion.order;
      if (stance === "flee") {
        order.mission = phase === FEINT ? "feint" : "withdraw";
        [order.sent, order.target] = [false, null]; // or one sent off would keep running once the side turns about
        if (phase === FEINT) {
          // to its place in the formation fallen back
          [order.x, order.y] = this.onField(field, this.toField(plan, order.across, order.along));
          order.facing = plan.heading;
        }
        continue;
      }
      if (order.sent) {
        const target = order.target === null ? null : battle.battalions[order.target];
        const gone = target ? !this.isInOrder(target) : phase !== names.close;
        if (plan.tactic === "garrison" ? phase === "sortie" : !gone) continue;
        [order.sent, order.target] = [false, null]; // back to its place
      }
      // engines of a siege stay where they were set up; in a formation that does not move only who went in or round the
      // foe's end goes back to its place
      if (plan.fixed ? order.mission === "flank" : !(siege && order.role === "battery")) {
        const frame = this.frameOf(plan, order.role);
        const along = standing && order.ahead !== null ? order.ahead : order.along; // before the line standing off
        [order.x, order.y] = this.onField(field, this.toField(frame, order.across, along));
        if (!plan.fixed) order.facing = frame.heading;
      }
      order.mission = this.getMission(battle, side, battalion, own, frameFoes);
      if (order.role === "wedge") order.target = plan.wedge?.target ?? null; // the foe it falls on
      if (siege && side === "attackers" && (phase === "storming" || phase === "looting") && order.mission === "hunt") {
        // who got in stays in: with no foe in sight it makes for the middle, not back over the walls to its place outside.
        // Riders with no breach to ride in by keep their places outside
        const within = this.isInside(battle, battalion);
        const barred =
          !Movement.canClimb(battalion) && !battle.field.breaches.some(breach => breach.burg === field.held);
        if (within || (phase === "storming" && !barred)) [order.x, order.y] = this.getMiddle(field);
        if (!within && phase === "storming") order.mission = barred ? "guard" : "flank";
      } else if (order.mission === "flank" && order.role !== "wedge") {
        // round the end of the foe's line on its own wing, and a little beyond
        const sign = Math.sign(order.across) || plan.strike;
        const end = frameFoes
          .filter(({ battalion }) => battalion.kind !== "mounted")
          .reduce<[number, number] | null>(
            (best, { at }) => (!best || at[0] * sign > best[0] * sign ? at : best),
            null
          );
        if (end)
          [order.x, order.y] = this.onField(
            field,
            this.toField(plan, end[0] + sign * field.front * ROUND_END, end[1] + field.front * LEVEL)
          );
      }
    }

    // the weak wing of an oblique attack holds back until the day is won
    if (tactic.massed && phase !== names.chase) {
      for (const battalion of own.ready) {
        const { order } = battalion;
        const refused = (plan.strike * plan.half - order.across * plan.strike) / (plan.half * 2) > 0.55;
        if (order.mission === "line" && order.rank === 0 && refused) order.mission = "guard";
      }
    }
    if (stance !== "flee") {
      this.hookFlanks(battle, side, own, frameFoes);
      this.sendReserve(battle, side, own, foe, frameFoes);
    }
  }

  /** The foe strikes a battalion in the flank or the rear */
  private isOnFlank(battle: Battle, foe: Battalion): boolean {
    const target = foe.action === "fight" && foe.target !== null ? battle.battalions[foe.target] : null;
    if (!target || target.side === foe.side) return false;
    const bearing = Math.atan2(foe.y - target.y, foe.x - target.x) - target.facing;
    return Math.abs(Math.atan2(Math.sin(bearing), Math.cos(bearing))) > FLANKED;
  }

  private isHooked(battle: Battle, battalion: Battalion): boolean {
    return battle[battalion.side].plan.hooks.some(hook => hook.includes(battalion.id));
  }

  /**
   * A side that holds turns battalions out at an end of its line, facing out in a short line back from it: its reserve
   * and the lines behind as soon as the foe has riders on that wing, the first line from the end in once foes come
   * beyond it. As strong as those foes, the more threatened end first; an end with no foes at it lends its reserve
   */
  private hookFlanks(battle: Battle, side: Side, own: SideView, foes: Seen): void {
    const { plan, advancing } = battle[side];
    const { field } = battle;
    const { front } = field;
    const ground = battle.type === "field" || (battle.type === "landing" && side === "defenders");
    const old = plan.hooks;
    plan.hooks = [[], []];
    if (advancing || plan.fixed || field.open || !ground) return;

    const byId = new Map(own.ready.map(battalion => [battalion.id, battalion]));
    const free = (battalion: Battalion): boolean =>
      !battalion.order.sent && !battalion.byHand.task && battalion.morale >= SHAKEN && battalion.action !== "fight";
    const wheels = (battalion: Battalion): boolean => battalion.order.rank === 0 && battalion.order.role === "line";
    const first = own.ready.filter(
      battalion => wheels(battalion) && !battalion.order.sent && battalion.kind === "melee"
    );
    // a battalion of the first line with no foe before it within a charge may wheel back
    const idle = ({ order, width }: Battalion): boolean =>
      !foes.some(
        ({ at }) =>
          Math.abs(at[0] - order.across) < width && at[1] > order.along && at[1] - order.along < CHARGE * front
      );

    const coming = battle[BattleRules.enemyOf(side)].advancing;
    const ends = [-1, 1].map(sign => {
      const end = first.reduce<Battalion | null>(
        (a, b) => (a && a.order.across * sign >= b.order.across * sign ? a : b),
        null
      );
      if (!end) return { sign, end, beyond: 0, round: 0, riders: 0 };
      const { across, along } = end.order;
      const edge = across * sign + end.width / 2; // the outer side of the end battalion
      const off = ({ at }: Seen[number]): number => Math.hypot(at[0] - across, at[1] - along);
      const out = (seen: Seen[number]): boolean => seen.at[0] * sign > edge;
      // foes beyond it, no further ahead than a charge and two rounds' march: the reserve needs time to turn out
      const beyond = sum(foes, seen => {
        const near = seen.at[1] < along + CHARGE * front + Movement.getPace(battle, seen.battalion) * ROUND_TICKS * 2;
        return out(seen) && near && off(seen) < THREAT * front ? Battalions.getStrength(seen.battalion) : 0;
      });
      // foes of an advancing side coming round it, level with the line within a charge: the first line wheels back
      const round = sum(foes, seen =>
        coming && out(seen) && seen.at[1] < along + COUNTER * front && off(seen) < CHARGE * front
          ? Battalions.getStrength(seen.battalion)
          : 0
      );
      // riders on that wing within reach of the end: far off, a shift of the foe's frame would swing them to the other end
      const riders = sum(foes, seen =>
        seen.battalion.kind === "mounted" && seen.at[0] * sign > 0 && off(seen) < THREAT * front
          ? Battalions.getStrength(seen.battalion)
          : 0
      );
      return { sign, end, beyond, round, riders };
    });
    const quiet = (sign: number): boolean => ends.some(end => end.sign === sign && !end.beyond && !end.riders);
    const hooked = new Set<number>();
    for (const { sign, end, beyond, round, riders } of [...ends].sort(
      (a, b) => b.beyond + b.riders - a.beyond - a.riders
    )) {
      if (!end || (!beyond && !riders)) continue;
      const { across, along } = end.order;
      const edge = across * sign + end.width / 2;
      const kept = old[(sign + 1) / 2]
        .map(id => byId.get(id))
        .filter(
          (battalion): battalion is Battalion =>
            battalion !== undefined && !battalion.order.sent && (round > 0 || !wheels(battalion))
        );
      const corner = this.onField(field, this.toField(plan, across, along - end.depth));
      const near = (battalion: Battalion): number => Math.hypot(battalion.x - corner[0], battalion.y - corner[1]);
      const behind = own.ready
        .filter(
          battalion =>
            battalion.kind === "melee" &&
            free(battalion) &&
            (battalion.order.role === "reserve" || (battalion.order.role === "line" && battalion.order.rank > 0)) &&
            (battalion.order.across * sign >= 0 || quiet(-sign)) // of its own wing, or of a quiet one
        )
        .sort((a, b) => near(a) - near(b));
      // the first line from the end in, as far as nobody stands before it, against foes coming round only
      const wheel: Battalion[] = [];
      for (const battalion of [...first].sort((a, b) => (b.order.across - a.order.across) * sign)) {
        if (!round || hooked.has(battalion.id) || !free(battalion) || !idle(battalion)) break;
        wheel.push(battalion);
      }
      const hook: Battalion[] = [];
      for (const battalion of [...kept, ...behind, ...wheel]) {
        const need = wheels(battalion) ? round : beyond + riders;
        if (
          hooked.has(battalion.id) ||
          hook.length >= HOOKS ||
          sum(hook, battalion => Battalions.getStrength(battalion)) >= need
        )
          continue;
        hook.push(battalion);
        hooked.add(battalion.id);
      }
      // a new hook: beyond the end, back from its rear corner, the first line nearest the end first, the others behind it;
      // those in a hook keep their places in it and newcomers fall in behind
      const fresh = hook.slice(kept.filter(battalion => hook.includes(battalion)).length);
      fresh.sort((a, b) => +wheels(b) - +wheels(a) || (b.order.across - a.order.across) * sign);
      hook.splice(hook.length - fresh.length, fresh.length, ...fresh);
      let back = along + end.depth / 2;
      for (const battalion of hook) {
        const place = this.toField(plan, (edge + battalion.depth / 2) * sign, back - battalion.width / 2); // clear of the rows behind
        back -= battalion.width + GAP * 2 * front;
        [battalion.order.x, battalion.order.y] = this.onField(field, place);
        battalion.order.facing = plan.heading + (sign * Math.PI) / 2;
        battalion.order.mission = "line";
      }
      plan.hooks[(sign + 1) / 2] = hook.map(battalion => battalion.id);
    }
  }

  /** A besieger in the streets of the burg, off its walls */
  private isInside(battle: Battle, battalion: Battalion): boolean {
    const { walled, rampart } = Battlefields.terrainAt(battle.field, battalion.x, battalion.y);
    return walled === battle.field.held! + 1 && !rampart;
  }

  /**
   * Where stormers go: the middle of the burg, by the cheapest way from where each stands: over the wall before it, or by
   * a breach when one is about as near: riders only so. So the walls are stormed on a broad front. The street node nearest
   * the burg's centre when the centre is no street: on a wall, or out of a burg that curves round it
   */
  private getMiddle(field: Battlefield): Point {
    const held = field.held!;
    const { x, y } = field.burgs[held];
    const node = Battlefields.nodeAt(field, x, y);
    if (field.walled[node] === held + 1 && !field.rampart[node]) return [x, y];
    let best: Point = [x, y];
    let least = Infinity;
    for (let street = 0; street < field.walled.length; street++) {
      if (field.walled[street] !== held + 1 || field.rampart[street]) continue;
      const centre = Battlefields.nodeCentre(field, street);
      const distance = Math.hypot(centre[0] - x, centre[1] - y);
      if (distance < least) [best, least] = [centre, distance];
    }
    return best;
  }

  /** What a battalion is to do, by what it is in the formation and how the day goes */
  private getMission(battle: Battle, side: Side, battalion: Battalion, own: SideView, foes: Seen): Order["mission"] {
    const { phase, plan, advancing } = battle[side];
    const names = POSTURES[battle.type][side];
    const { role } = battalion.order;
    const siege = battle.type === "siege" && battle.field.held !== null;
    const free = phase === names.chase || phase === "looting" || (siege && phase === "storming");
    if (role === "support" || role === "battery") return role;
    const lying = plan.tactic === "ambuscadeBothSides" || plan.tactic === "ambuscadeOneSide";
    const off = this.keepsOff(battle, side);
    if (lying && advancing && !off) return "hunt"; // told to stand, ambushers keep where they lie
    if (free)
      return role === "line" && !siege && phase === names.chase && battalion.kind !== "mounted" ? "line" : "hunt";
    if (role === "wedge") return plan.wedge?.charging ? "hunt" : "flank"; // on its way, or charging
    if (role === "line") return "line";
    if (role === "reserve") return "reserve";

    // riders on a wing go round the foe's line when the lines close, unless the foe's riders there outweigh them
    const sign = Math.sign(battalion.order.across) || 1;
    const near = advancing && plan.gap < CHARGE * battle.field.front && this.getFort(battle, side) !== "batter";
    const launched = phase === names.close || near; // to fall on the foe as the lines meet
    if (!launched || off || battalion.morale < SHAKEN || siege) return "guard";
    const there = (all: Battalion[], at: (battalion: Battalion) => number): number =>
      sum(all, battalion =>
        battalion.kind === "mounted" && at(battalion) * sign > 0 ? Battalions.getStrength(battalion) : 0
      );
    const mine = there(own.ready, other => other.order.across);
    const theirs = sum(foes, ({ battalion, at }) =>
      battalion.kind === "mounted" && at[0] * sign > 0 ? Battalions.getStrength(battalion) : 0
    );
    if (theirs * 0.7 > mine) return "guard";
    const [, along] = this.toFrame(plan, battalion);
    const end = Math.min(...foes.filter(({ at }) => at[0] * sign > -plan.half).map(({ at }) => at[1]), Infinity);
    return along >= end - battle.field.front * LEVEL ? "hunt" : "flank"; // level with the foe's line: it is round
  }

  /** Send those kept behind where they are needed, the nearest first */
  private sendReserve(battle: Battle, side: Side, own: SideView, foe: SideView, foes: Seen): void {
    const { plan, phase } = battle[side];
    const names = POSTURES[battle.type][side];
    const spare = (): Battalion[] =>
      own.ready.filter(
        battalion =>
          battalion.order.role === "reserve" &&
          !battalion.order.sent &&
          !battalion.byHand.task && // one under a task by hand is not the general's to send
          battalion.morale >= SHAKEN &&
          !this.isHooked(battle, battalion)
      );
    const nearest = (among: Battalion[], to: { x: number; y: number }): Battalion | undefined =>
      among.reduce<Battalion | undefined>(
        (best, battalion) => (best && this.far(best, to) <= this.far(battalion, to) ? best : battalion),
        undefined
      );
    const send = (battalion: Battalion | undefined, target: Battalion | null): void => {
      if (battalion) Object.assign(battalion.order, { mission: "hunt", sent: true, target: target?.id ?? null });
    };

    const { front } = battle.field;
    if (plan.tactic !== "garrison") this.guardWards(battle, own, foe, WARD * front, spare, nearest, send);
    const sally = plan.tactic === "wagenburg" && battle[side].advancing; // out of the wagons once the foe is spent
    if (plan.fixed && plan.tactic !== "garrison" && !sally) return;

    if (plan.tactic === "garrison") {
      // a sortie: the riders and every other battalion of the line go out, at the engine when there is one to go for;
      // the whole line when the garrison comes out to drive the besiegers off. They form up outside a gate first
      if (phase !== "sortie") {
        // the sortie is over: its party goes back to the places it left
        for (const battalion of plan.muster ? own.ready : []) {
          const home = plan.muster!.homes[battalion.id];
          if (home) [battalion.order.x, battalion.order.y, battalion.order.facing] = home;
        }
        plan.muster = null;
        this.holdWalls(battle, own, foe);
        return;
      }
      if (plan.muster) {
        this.launchSortie(battle, own, foe);
        return;
      }
      if (own.ready.some(battalion => battalion.order.sent)) return;
      const line = own.ready.filter(battalion => battalion.order.role === "line" && battalion.morale >= SHAKEN);
      const prey = this.getSortiePrey(battle, own, foe);
      const all = this.isStrongGarrison(own, foe);
      const party = [...spare(), ...line.filter((_, i) => all || i % 2 === 0)];
      plan.muster = this.musterSortie(battle, party, prey, foe);
      if (!plan.muster) for (const battalion of party) send(battalion, prey);
      return;
    }

    // 1. a gap where a battalion of the first line broke with foes near: the one behind it steps in
    for (const lost of battle.battalions) {
      const { order } = lost;
      if (lost.side !== side || lost.status === "ready" || order.role !== "line" || order.rank !== 0) continue;
      order.rank = -1; // seen to
      if (!foe.ready.some(battalion => this.far(battalion, order) < front * FOES_NEAR)) continue;
      const behind = own.ready.filter(
        battalion =>
          battalion.order.role === "line" &&
          battalion.order.rank > 0 &&
          !battalion.order.sent &&
          !battalion.byHand.task &&
          !this.isHooked(battle, battalion)
      );
      const heir = nearest([...behind, ...spare()], order);
      if (heir)
        Object.assign(heir.order, { role: "line", mission: "line", rank: 0, across: order.across, along: order.along });
    }

    // 2. foes come round a flank or through the line, or at grips with a battalion's flank or rear: riders first, as
    // many sent at each as match it
    const answered = new Set(own.ready.map(battalion => battalion.order.target));
    const going = new Map<number, number>();
    for (const battalion of own.ready)
      if (battalion.order.sent && battalion.order.target !== null)
        going.set(battalion.order.target, (going.get(battalion.order.target) ?? 0) + Battalions.getStrength(battalion));
    const urgent = ({ battalion, at }: Seen[number]): number => (battalion.kind === "mounted" ? -1000 : 0) + at[1]; // riders, then the deepest
    for (const { battalion: threat, at } of [...foes].sort((a, b) => urgent(a) - urgent(b))) {
      const flank = Math.abs(at[0]) > plan.half + front * ROUND_SIDE && at[1] < front * ROUND_AHEAD;
      const round = at[1] < (-ROW_GAP * front) / 2 || flank;
      if (!(round || this.isOnFlank(battle, threat)) || this.far(threat, plan) > front * THREAT) continue;
      while ((going.get(threat.id) ?? 0) < Battalions.getStrength(threat)) {
        const guards = own.ready.filter(
          battalion =>
            battalion.order.mission === "guard" &&
            !battalion.order.sent &&
            !battalion.byHand.task &&
            battalion.kind === "mounted"
        );
        const battalion = nearest([...spare(), ...guards], threat);
        if (!battalion) break;
        send(battalion, threat);
        going.set(threat.id, (going.get(threat.id) ?? 0) + Battalions.getStrength(battalion));
      }
    }

    if (phase !== names.close || this.keepsOff(battle, side)) return;
    // 3. where a foe at grips wavers, to break it
    const held = new Set(own.ready.map(battalion => (battalion.action === "fight" ? battalion.target : null)));
    const wavering = foe.ready.filter(
      battalion => battalion.morale < SHAKEN + 10 && held.has(battalion.id) && !answered.has(battalion.id)
    );
    if (wavering.length) send(nearest(spare(), wavering[0]), wavering[0]);

    // 4. everywhere, once the fight has stood long enough: a reserve never used is wasted
    if (battle.round - plan.since >= 8) for (const battalion of spare()) send(battalion, null);
  }

  /**
   * Foes that fall on the shooters or the engines, those at the engines first: the nearest battalion free to go, of the
   * reserve, the riders on guard or the line troops not at grips, goes for each. It comes back once the foe is gone.
   * Nobody goes out over the side's works for a foe that fights over them
   */
  private guardWards(
    battle: Battle,
    own: SideView,
    foe: SideView,
    ward: number,
    spare: () => Battalion[],
    nearest: (among: Battalion[], to: Battalion) => Battalion | undefined,
    send: (battalion: Battalion | undefined, target: Battalion) => void
  ): void {
    const wards = own.ready
      .filter(battalion => battalion.kind === "ranged" || battalion.kind === "machinery")
      .sort((a, b) => +(b.kind === "machinery") - +(a.kind === "machinery"));
    const answered = new Set(own.ready.map(battalion => (battalion.order.sent ? battalion.order.target : null)));
    for (const shot of wards) {
      for (const threat of foe.ready) {
        if (threat.stats.range || answered.has(threat.id) || threat.target !== shot.id || this.far(threat, shot) > ward)
          continue;
        if (Battlefields.getWorksBetween(battle.field, [threat.x, threat.y], [shot.x, shot.y], shot.side).length)
          continue;
        const free = own.ready.filter(
          battalion =>
            (battalion.kind === "melee" || battalion.kind === "mounted") &&
            battalion.order.role !== "wedge" &&
            !battalion.order.sent &&
            !battalion.byHand.task &&
            !this.isHooked(battle, battalion) &&
            battalion.action !== "fight" &&
            battalion.morale >= SHAKEN &&
            this.far(battalion, threat) < ward * 2
        );
        const guard = nearest([...spare(), ...free], threat);
        if (!guard) continue;
        send(guard, threat);
        answered.add(threat.id);
      }
    }
  }

  /** The formation goes for the foe at the pace of its slowest, along the way its troops would take, and no further ahead than they can keep */
  private moveFrame(battle: Battle, side: Side, own: SideView, foe: SideView, gap: number): void {
    const data = battle[side];
    const { plan, phase } = data;
    const names = POSTURES[battle.type][side];
    const foremost = own.ready.filter(
      battalion => battalion.order.rank === 0 && !battalion.order.sent && battalion.order.role !== "wedge"
    );
    const line = foremost.filter(battalion => battalion.order.role !== "wing");
    const first = line.length ? line : foremost; // an army of riders alone leads with its wings
    const lead = first.find(battalion => battalion.kind === "melee") ?? first[0];
    if (!lead || !foe.ready.length) return;

    const there: Point = [foe.x, foe.y];
    const [tx, ty] = Movement.getTurn(battle, lead, [plan.x, plan.y], there);
    const bearing = Math.atan2(ty - plan.y, tx - plan.x);
    const straight = tx === there[0] && ty === there[1];
    // it wheels to face the foe, not for a trifle
    const { field } = battle;
    const off = Math.abs(Math.atan2(Math.sin(bearing - plan.heading), Math.cos(bearing - plan.heading)));
    if (Math.hypot(foe.x - plan.x, foe.y - plan.y) > field.front * WHEEL && off > (data.advancing ? 0.15 : 0.35))
      plan.heading = Movement.turn(plan.heading, bearing, straight ? 0.12 : 0.4);
    if (!data.advancing) return;

    const apart = this.keepsOff(battle, side) || (phase === names.apart && this.isOpenFight(battle));
    // the engines come up with the line when they are to batter the foe's wagons, and it halts once they reach them
    const guns =
      this.getFort(battle, side) === "batter" ? own.ready.filter(battalion => battalion.kind === "machinery") : [];
    const wagons = field.works.filter(
      work => work.side !== side && work.kind === "wagons" && Battlefields.isStanding(work)
    );
    const inRange = (gun: Battalion): boolean =>
      wagons.some(
        work => Battlefields.distanceToLine([gun.x, gun.y], [work.a, work.b]) < Sight.getReach(battle, gun) * 0.9
      );
    if (guns.length && guns.every(inRange)) return;
    const want = guns.length ? COUNTER * 2 * field.front : apart ? this.getHalt(battle, plan) : -Infinity;
    const pace = Math.min(
      ...[...first, ...guns].map(battalion =>
        Movement.getPace(battle, battalion, Battlefields.terrainAt(battle.field, battalion.x, battalion.y))
      )
    );
    // no further than its next turn: past the corner of a cliff the way would lead back
    const turnAt = straight || !field.cliffs.length ? Infinity : Math.hypot(tx - plan.x, ty - plan.y);
    const advance = Math.min(pace * ROUND_TICKS, gap - want, turnAt);
    const lags = first
      .map(battalion => this.toFrame(plan, battalion.order)[1] - this.toFrame(plan, battalion)[1])
      .sort((a, b) => a - b);
    if (advance <= 0 || lags[lags.length >> 1] > field.front * LEVEL) return; // most of the line is behind
    plan.x += Math.cos(bearing) * advance;
    plan.y += Math.sin(bearing) * advance;
    this.keepOnField(
      field,
      plan,
      own.ready
        .filter(battalion => !battalion.order.sent && battalion.order.role !== "wedge")
        .map(battalion => battalion.order)
    );
  }

  /** How far from the foe a formation standing off halts: where its shooters reach, but in the dark or the murk where they see */
  private getHalt(battle: Battle, plan: Plan): number {
    return Sight.isLimited(battle) ? Math.min(plan.halt, Sight.getSight(battle, true) * STAND_OFF) : plan.halt;
  }

  /** The shortest way between the sides round water, walls and cliffs, found once a round for both: it is the same way */
  private getWalkBetween(battle: Battle): number {
    const known = this.walks.get(battle);
    if (known?.tick === battle.tick) return known.walk;
    const ready = (side: Side): Battalion[] =>
      battle.battalions.filter(battalion => battalion.side === side && this.isInOrder(battalion));
    const walk = Movement.getWalkGap(battle, ready("attackers"), ready("defenders"));
    this.walks.set(battle, { tick: battle.tick, walk });
    return walk;
  }

  // The wedge

  /** The frame a place is about: the wedge's for its riders, the formation's for the rest */
  private frameOf(plan: Plan, role: Order["role"]): Frame {
    return role === "wedge" && plan.wedge ? plan.wedge : plan;
  }

  /** Where the wedge waits: beyond the end of the line on its wing, a little back */
  private getPost(battle: Battle, plan: Plan): Frame {
    const { front } = battle.field;
    const [x, y] = this.toField(plan, plan.strike * (plan.half + front * POST), -ROW_GAP * front);
    return { x, y, heading: plan.heading };
  }

  /** The end of the foe's line on a wing, foot before riders, as the formation sees it */
  private getEnd(foes: Seen, sign: number): Seen[number] | null {
    const foot = foes.filter(({ battalion }) => battalion.kind !== "mounted");
    return (foot.length ? foot : foes).reduce<Seen[number] | null>(
      (best, seen) => (!best || seen.at[0] * sign > best.at[0] * sign ? seen : best),
      null
    );
  }

  /**
   * Where the wedge goes round the end of the foe's line to fall on its flank: beyond the end and level with its rear,
   * on the higher and the more open ground of the few spots there are
   */
  private getVia(battle: Battle, frame: Frame, end: Seen[number], sign: number): Point {
    const { field } = battle;
    const { front } = field;
    let best: Point | null = null;
    let most = -Infinity;
    for (const shift of [0, 1, -1]) {
      const via = this.onField(
        field,
        this.toField(frame, end.at[0] + sign * front * WIDE, end.at[1] + front * (LEVEL + shift))
      );
      const worth = this.getLaneWorth(battle, via, [end.battalion.x, end.battalion.y]);
      if (worth > most) [best, most] = [via, worth];
    }
    return best!;
  }

  /** How good the ground is for a charge from one point to another: open, and down the slope */
  private getLaneWorth(battle: Battle, [x, y]: Point, [tx, ty]: Point): number {
    const { field } = battle;
    const length = Math.hypot(tx - x, ty - y) || 1;
    const samples = Math.max(Math.ceil(length / field.cell), 1);
    let bad = 0;
    for (let i = 0; i <= samples; i++) {
      const terrain = Battlefields.terrainAt(field, x + ((tx - x) * i) / samples, y + ((ty - y) * i) / samples);
      if (terrain.water || terrain.wood || terrain.marsh) bad += 1;
    }
    const fall = Battlefields.getElevation(field, x, y) - Battlefields.getElevation(field, tx, ty);
    return -bad / (samples + 1) + (fall / length) * DOWNHILL;
  }

  /** The wing the wedge goes round: the better ground for the ride and the charge, and the weaker foe */
  private chooseLane(battle: Battle, side: Side, frame: Frame, places: Place[]): number {
    const { front } = battle.field;
    const foe = this.survey(battle, BattleRules.enemyOf(side));
    const foes: Seen = foe.ready.map(battalion => ({ battalion, at: this.toFrame(frame, battalion) }));
    const half = Math.max(
      ...places.filter(place => place.rank === 0 && place.role !== "wedge").map(place => Math.abs(place.across)),
      0
    );
    const worth = (sign: number): number => {
      const end = this.getEnd(foes, sign);
      if (!end) return 0;
      const post = this.toField(frame, sign * (half + front * POST), -ROW_GAP * front);
      const via = this.getVia(battle, frame, end, sign);
      const wing = sum(foes, ({ battalion, at }) =>
        at[0] * sign > front * WING ? Battalions.getStrength(battalion) : 0
      );
      return (
        this.getLaneWorth(battle, post, via) +
        this.getLaneWorth(battle, via, [end.battalion.x, end.battalion.y]) -
        wing / (foe.power || 1)
      );
    };
    return worth(-1) > worth(1) ? -1 : 1;
  }

  /**
   * The wedge waits beside the line till the ride round the foe takes as long as the walk of the line to him, then
   * goes round the end of his line at the pace of its slowest and falls on his flank. Once it charges it is a wedge no more
   */
  private moveWedge(battle: Battle, side: Side, own: SideView, foes: Seen, gap: number): void {
    const data = battle[side];
    const { plan } = data;
    const wedge = plan.wedge!;
    const riders = own.ready.filter(battalion => battalion.order.role === "wedge" && !battalion.order.sent);
    if (wedge.charging) {
      if (wedge.target !== null && !this.isInOrder(battle.battalions[wedge.target])) wedge.target = null; // the riders hunt on
      return;
    }
    const sign = plan.strike;
    const end = this.getEnd(foes, sign);
    if (!riders.length || !end) return;
    const { front } = battle.field;
    const target = end.battalion;
    const via = this.getVia(battle, plan, end, sign);
    if (!wedge.launched) {
      Object.assign(wedge, this.getPost(battle, plan));
      this.keepOnField(
        battle.field,
        wedge,
        riders.map(battalion => battalion.order)
      );
      if (!this.isWedgeDue(battle, side, wedge, riders, via, target, gap)) return;
      wedge.launched = true;
    }
    // beyond the end of the line and level with it, or as far round as the field lets it: at its flank
    const [across, along] = this.toFrame(plan, wedge);
    const level = along >= end.at[1] || Math.hypot(via[0] - wedge.x, via[1] - wedge.y) < front * LEVEL;
    const outside = across * sign >= end.at[0] * sign + front && level;
    if (outside && Math.hypot(target.x - wedge.x, target.y - wedge.y) <= CHARGE * front) {
      // it falls on him once the line has him at grips, so he cannot turn to meet it, or the lines are at grips without him
      const met = own.ready.some(
        battalion => battalion.order.role === "line" && !battalion.order.rank && battalion.action === "fight"
      );
      if (target.action === "fight" || met || !data.advancing) [wedge.charging, wedge.target] = [true, target.id];
      return;
    }
    // it goes on as fast as its slowest, and waits for those left behind
    const lags = riders.map(battalion => this.far(battalion, battalion.order)).sort((a, b) => a - b);
    if (lags[lags.length >> 1] > front * LEVEL) {
      // held up by a fight before its time, it breaks up into it
      if (riders.some(battalion => battalion.action === "fight")) [wedge.charging, wedge.target] = [true, target.id];
      return;
    }
    const goal: Point = outside ? [target.x, target.y] : via;
    const bearing = Math.atan2(goal[1] - wedge.y, goal[0] - wedge.x);
    const pace = Math.min(...riders.map(battalion => Movement.getPace(battle, battalion)));
    const advance = Math.min(pace * ROUND_TICKS, Math.hypot(goal[0] - wedge.x, goal[1] - wedge.y));
    wedge.heading = Movement.turn(wedge.heading, bearing, WEDGE_TURN);
    wedge.x += Math.cos(bearing) * advance;
    wedge.y += Math.sin(bearing) * advance;
    [wedge.x, wedge.y] = this.onField(battle.field, [wedge.x, wedge.y]);
  }

  /** Time to go: the ride round the foe takes no less than the walk of the line up to him, or the lines meet already */
  private isWedgeDue(
    battle: Battle,
    side: Side,
    wedge: Wedge,
    riders: Battalion[],
    via: Point,
    target: Battalion,
    gap: number
  ): boolean {
    const { phase, advancing } = battle[side];
    // a side that comes on times the ride by the walk of its line, even one that closes from the start
    if (phase === POSTURES[battle.type][side].close && (!advancing || !Number.isFinite(gap))) return true;
    if (!advancing || this.keepsOff(battle, side)) return false;
    const pace = Math.min(...riders.map(battalion => Movement.getPace(battle, battalion)));
    const ride =
      (Math.hypot(via[0] - wedge.x, via[1] - wedge.y) + Math.hypot(target.x - via[0], target.y - via[1])) / pace;
    const walk = Math.max(gap - CHARGE * battle.field.front, 0) / PACE;
    return ride >= walk;
  }

  // Works

  /**
   * Whether the side builds works this round. It begins when it holds, may build, and some kind is done before the foe
   * comes, unless its general chose to wait rather than fight; a Wagenburg from the first tick. Once begun it goes on till the works stand,
   * it advances or the foe is upon its line; an order by hand stands for its time
   */
  private fortifies(battle: Battle, side: Side): boolean {
    const { plan } = battle[side];
    if (!Works.mayBuild(battle, side) || !Works.isHolding(battle, side) || !Works.hasWorkLeft(battle, side))
      return false;
    if (plan.byHand.order) return plan.byHand.order === "fortify";
    if (plan.tactic === "wagenburg") return true;
    if (this.isFoeUpon(battle, side)) return false; // no battalion of the line could build: it fights
    if (plan.fortify) return true;
    // a general who chose not to fight here does not dig in: both would, till the lull. In a landing `waits` is to stand inland
    if (battle[side].waits && this.isOpenFight(battle)) return false;
    return Works.chooseKind(battle, side, 1, plan.arrival) !== null;
  }

  /** A foe in order could be upon a battalion of the side's line within a round: none of them would build */
  private isFoeUpon(battle: Battle, side: Side): boolean {
    const reach = CHARGE * battle.field.front;
    const builders = battle.battalions.filter(
      battalion => battalion.side === side && this.isInOrder(battalion) && Works.isBuilder(battle, battalion)
    );
    return battle.battalions.some(
      foe =>
        foe.side !== side &&
        this.isInOrder(foe) &&
        builders.some(
          battalion =>
            Math.hypot(foe.x - battalion.x, foe.y - battalion.y) < Movement.getPace(battle, foe) * ROUND_TICKS + reach
        )
    );
  }

  /**
   * How a side with engines goes at a foe behind wagons, unless its general chose to storm them at once: it batters them
   * till its engines have knocked gaps enough in them, then it goes in by the gaps. Null without engines or such a foe
   */
  private getFort(battle: Battle, side: Side): "batter" | "breached" | null {
    if (battle[side].storms || !this.isOpenFight(battle)) return null;
    const engines = battle.battalions.filter(
      battalion => battalion.side === side && this.isInOrder(battalion) && battalion.kind === "machinery"
    );
    if (!engines.length) return null;
    // from their row behind a line halted out of the foe's reach, the engines must reach the wagons: big battalions go in
    const reach = Math.max(
      ...engines.map(battalion => Sight.getReach(battle, battalion) * 0.9 + battalion.order.along)
    );
    if (reach < COUNTER * 2 * battle.field.front) return null;
    const wagons = battle.field.works.filter(work => work.side !== side && work.kind === "wagons" && work.up);
    if (!wagons.some(work => Battlefields.isStanding(work))) return null;
    return wagons.filter(work => !Battlefields.isStanding(work)).length < BREACHES ? "batter" : "breached";
  }

  /**
   * Whether the side starts the battle behind its works: as set by hand before the start, else where the battle type
   * means days to prepare: besiegers ringing a burg in, defenders ready for a landing at the shore
   */
  isDugIn(battle: Battle, side: Side): boolean {
    if (!Works.mayBuild(battle, side)) return false;
    const set = battle.interventions.findLast(change => change.kind === "dig" && change.side === side);
    if (set?.kind === "dig") return set.on;
    if (battle[side].plan.tactic === "strategicRetreat") return false; // nothing to dig in for
    if (battle.type === "siege") return battle.attackers.plan.tactic === "ring";
    return battle.type === "landing" && !battle.defenders.waits && this.findShore(battle) !== null;
  }

  /** Sides dug in have their works laid at their places, finished; laid anew whenever the troops are drawn up */
  digIn(battle: Battle): void {
    battle.field.works = [];
    for (const side of SIDES) if (this.isDugIn(battle, side)) Works.layWorks(battle, side);
  }
}

export const Generals = new GeneralModule();
