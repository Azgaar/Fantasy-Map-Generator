// Places in a formation, by tactic. Lengths are in battalion fronts. See docs/domain/battles.md.

import type { Block, Mission, Role } from "./battle";

export const ROW_GAP = 0.9; // between the lines of a formation
export const GAP = 0.23; // between neighbours in a line
const ROW = 2.7; // a row of shooters, reserves or engines is at least so long
const STAGGER = 0.5; // line troops stand so far behind the shooters ahead of them: a battalion's depth

/** How a general draws his troops up; every number is read by the one builder below */
export interface Tactic {
  lines: number; // lines of line troops, at least
  reserve: number; // share of the line troops held behind them
  span: number; // share of the room the first line may take
  massed: boolean; // one wing is the stronger: the best troops, the second line and the reserve behind it
  refuse: number; // how far back the other wing ends up
  bow: number; // how far ahead of the centre the ends of the line stand; behind when negative
  shooters: "behind" | "front" | "wings" | "ahead"; // ahead: before the gaps of the first line, which goes through them
  riders: "wings" | "strike" | "behind" | "wedge"; // a wedge of their own, apart from the line
  ring?: boolean; // a ring facing out, the riders and the reserve inside
  ends?: boolean; // the reserve stands behind the ends of the line, to turn out at them
}

export type TacticName =
  | "assault"
  | "oblique"
  | "envelopment"
  | "wedge"
  | "harass"
  | "flyingWedge"
  | "feignedRetreat"
  | "defensiveLine"
  | "refusedFlanks"
  | "crossing"
  | "wagenburg"
  | "column"
  | "ambuscadeBothSides"
  | "ambuscadeOneSide"
  | "lines"
  | "ring"
  | "garrison"
  | "waves";

export const TACTICS: Record<TacticName, Tactic> = {
  // attack
  assault: { lines: 1, reserve: 0.2, span: 1, massed: false, refuse: 0, bow: 0, shooters: "behind", riders: "wings" },
  oblique: {
    lines: 1,
    reserve: 0.15,
    span: 1,
    massed: true,
    refuse: 2.5,
    bow: 0,
    shooters: "behind",
    riders: "strike"
  },
  envelopment: {
    lines: 1,
    reserve: 0.1,
    span: 0.8,
    massed: false,
    refuse: 0,
    bow: 1,
    shooters: "behind",
    riders: "wings"
  },
  wedge: {
    lines: 2,
    reserve: 0.15,
    span: 0.6,
    massed: false,
    refuse: 0,
    bow: -1.6,
    shooters: "wings",
    riders: "behind"
  },
  harass: { lines: 1, reserve: 0, span: 1, massed: false, refuse: 0, bow: 0, shooters: "front", riders: "wings" },
  flyingWedge: {
    lines: 1,
    reserve: 0.2,
    span: 1,
    massed: false,
    refuse: 0,
    bow: 0,
    shooters: "behind",
    riders: "wedge"
  },
  // drawn up as an assault: the feint is in the phases, not the formation
  feignedRetreat: {
    lines: 1,
    reserve: 0.2,
    span: 1,
    massed: false,
    refuse: 0,
    bow: 0,
    shooters: "behind",
    riders: "wings"
  },
  // defence
  defensiveLine: {
    lines: 1,
    reserve: 0.2,
    span: 1,
    massed: false,
    refuse: 0,
    bow: 0,
    shooters: "behind",
    riders: "behind",
    ends: true
  },
  refusedFlanks: {
    lines: 1,
    reserve: 0.15,
    span: 0.8,
    massed: false,
    refuse: 0,
    bow: -1.35,
    shooters: "behind",
    riders: "behind",
    ends: true
  },
  crossing: {
    lines: 1,
    reserve: 0.25,
    span: 0.7,
    massed: false,
    refuse: 0,
    bow: 0.9,
    shooters: "behind",
    riders: "behind",
    ends: true
  },
  wagenburg: {
    lines: 1,
    reserve: 0.2,
    span: 1,
    massed: false,
    refuse: 0,
    bow: 0,
    shooters: "behind",
    riders: "behind",
    ring: true
  },
  // of a battle type
  column: { lines: 1, reserve: 0, span: 1, massed: false, refuse: 0, bow: 0, shooters: "behind", riders: "wings" },
  ambuscadeBothSides: {
    lines: 1,
    reserve: 0,
    span: 1,
    massed: false,
    refuse: 0,
    bow: 0,
    shooters: "ahead",
    riders: "wings"
  },
  ambuscadeOneSide: {
    lines: 1,
    reserve: 0,
    span: 1,
    massed: false,
    refuse: 0,
    bow: 0,
    shooters: "ahead",
    riders: "wings"
  },
  lines: { lines: 1, reserve: 0.2, span: 1, massed: false, refuse: 0, bow: 0, shooters: "behind", riders: "wings" },
  ring: { lines: 1, reserve: 0, span: 1, massed: false, refuse: 0, bow: 0, shooters: "behind", riders: "behind" },
  garrison: { lines: 1, reserve: 0, span: 1, massed: false, refuse: 0, bow: 0, shooters: "behind", riders: "behind" },
  waves: { lines: 2, reserve: 0, span: 0.8, massed: false, refuse: 0, bow: 0, shooters: "behind", riders: "behind" }
};

/** A battalion's place: across the formation from its middle, to the right, and along it from the first line, ahead */
export interface Place {
  block: Block;
  role: Role;
  mission: Mission;
  rank: number; // the line it stands in, 0 the first
  across: number;
  along: number;
  facing?: number; // turned from the heading of the formation, when it does not face its way
}

const ROLES: Record<Block["kind"], Role> = { melee: "line", ranged: "support", mounted: "wing", machinery: "battery" };
const MISSIONS: Record<Role, Mission> = {
  line: "line",
  support: "support",
  battery: "battery",
  wing: "guard",
  reserve: "reserve",
  wedge: "flank"
};

class FormationModule {
  /**
   * Draw the battalions up by the tactic in the room across the field; places are in metres
   * @param strike the massed wing: -1 the left, 1 the right
   * @param front metres a full battalion stands wide
   */
  form(blocks: Block[], tactic: Tactic, strike: number, room: number, front: number): Place[] {
    if (tactic.ring) return this.formRing(blocks, tactic, front);
    const [gap, rowGap, row] = [GAP * front, ROW_GAP * front, ROW * front];
    const strength = (block: Block): number => block.troops * block.unitPower;
    const of = (kind: Block["kind"]): Block[] =>
      blocks.filter(block => block.kind === kind).sort((a, b) => strength(b) - strength(a) || a.id - b.id);
    let line = of("melee");
    let shooters = of("ranged");
    let riders = of("mounted");
    let engines = of("machinery");
    // somebody has to stand in front
    if (!line.length) {
      if (shooters.length) [line, shooters] = [shooters, []];
      else if (riders.length) [line, riders] = [riders, []];
      else [line, engines] = [engines, []];
    }

    // shooters in front: they are the first line, the line troops stand behind them
    if (tactic.shooters === "front" && shooters.length) [line, shooters] = [shooters, line];

    const places: Place[] = [];
    const widthOf = (row: Block[]): number => row.reduce((sum, block) => sum + block.width + gap, -gap);
    /** A row side by side, its middle at `centre`; listed left to right */
    const seat = (row: Block[], rank: number, along: number, centre = 0, role?: Role): void => {
      let offset = centre - widthOf(row) / 2;
      for (const block of row) {
        const own: Role = role ?? ROLES[block.kind];
        places.push({ block, role: own, mission: MISSIONS[own], rank, across: offset + block.width / 2, along });
        offset += block.width + gap;
      }
    };
    /** The best in the middle, or at the massed wing */
    const arrange = (row: Block[]): Block[] => {
      if (tactic.massed) return strike > 0 ? [...row].reverse() : row;
      const out: Block[] = [];
      row.forEach((block, i) => {
        if (i % 2) out.unshift(block);
        else out.push(block);
      });
      return out;
    };
    const wrap = (row: Block[], limit: number): Block[][] => {
      const rows: Block[][] = [[]];
      for (const block of row) {
        if (rows.at(-1)!.length && widthOf([...rows.at(-1)!, block]) > limit) rows.push([]);
        rows.at(-1)!.push(block);
      }
      return row.length ? rows : [];
    };

    const kept = line.length >= 4 ? Math.round(line.length * tactic.reserve) : 0;
    const reserve = kept ? line.splice(line.length - kept) : [];
    // riders stand beyond the room of the line, where they have the way round
    const wings = tactic.shooters === "wings" && shooters.length ? widthOf(shooters) + gap * 2 : 0;
    const span = Math.max(room * tactic.span - wings, room * 0.4);

    // the lines: as many as the room asks for, the first the longest and the best
    // shooters ahead stand in one row with the first line, so it is the shorter by them
    const ahead = tactic.shooters === "ahead" && shooters.length > 0;
    const abreast = ahead ? [...line, ...shooters] : line;
    const count = Math.max(Math.ceil(widthOf(abreast) / span), Math.min(tactic.lines, Math.floor(line.length / 2)), 1);
    const first = Math.ceil(line.length / count);
    const lines = [line.slice(0, first), ...wrap(line.slice(first), widthOf(line.slice(0, first)))];
    const front0 = ahead ? this.mingle(arrange(lines[0]), shooters) : arrange(lines[0]);
    const half = widthOf(front0) / 2;
    const aside = (row: Block[]): number => (tactic.massed ? strike * (half - widthOf(row) / 2) : 0); // behind the massed wing

    const split = (row: Block[]): [Block[], Block[]] => [
      row.filter((_, i) => i % 2 === 0),
      row.filter((_, i) => i % 2 === 1)
    ];
    let rank = 0;
    let along = 0;
    const next = (): void => {
      rank += 1;
      along -= rowGap;
    };
    if (ahead) {
      // each has its own stretch of the row: the shooters in front, the line troops a step behind, with a clear way on
      let offset = -half;
      for (const block of front0) {
        const [role, back] = [ROLES[block.kind], block.kind === "ranged" ? 0 : STAGGER * front];
        places.push({
          ...{ block, role, mission: MISSIONS[role], rank: back ? 1 : 0 },
          ...{ across: offset + block.width / 2, along: -back }
        });
        offset += block.width + gap;
      }
      rank = 1;
      along = -STAGGER * front;
    } else seat(front0, 0, 0);
    if (tactic.shooters !== "wings" && !ahead) {
      for (const shot of wrap(shooters, Math.max(half * 2, row))) {
        next();
        seat(shot, rank, along);
      }
    }
    for (const rest of lines.slice(1)) {
      next();
      seat(arrange(rest), rank, along, aside(rest));
    }
    if (tactic.ends && reserve.length > 1) {
      // half behind each end battalion
      const [right, left] = split(reserve);
      const rows = Math.max(left.length, right.length);
      for (let i = 0; i < rows; i++) {
        next();
        for (const [wing, sign] of [
          [left, -1],
          [right, 1]
        ] as const) {
          const block = wing[i];
          if (block) seat([block], rank, along, sign * Math.max(half - lines[0][0].width / 2, 0), "reserve");
        }
      }
    } else {
      for (const kept of wrap(reserve, Math.max(half * 2, row))) {
        next();
        seat(kept, rank, along, aside(kept), "reserve");
      }
    }
    for (const guns of wrap(engines, Math.max(half * 2, row))) {
      next();
      seat(guns, rank, along);
    }
    const back = along; // of the troops on foot and the engines

    // the wings: shooters at the ends of the line, riders beyond them and a little back
    const flank = (wing: Block[], side: number, from: number, back: number, role?: Role): number => {
      if (!wing.length) return from;
      const width = widthOf(wing);
      seat(side > 0 ? wing : [...wing].reverse(), 0, back, side * (from + gap + width / 2), role);
      return from + gap + width;
    };
    let ends = [half, half]; // left, right
    if (tactic.shooters === "wings") {
      const [right, left] = split(shooters);
      ends = [flank(left, -1, ends[0], 0), flank(right, 1, ends[1], 0)];
    }
    if (tactic.riders === "wedge") places.push(...this.formWedge(riders, front));
    else if (tactic.riders !== "behind") {
      // in a column of twos on each wing, a little back
      const all = tactic.massed || tactic.riders === "strike";
      const [right, left] = all ? (strike > 0 ? [riders, []] : [[], riders]) : split(riders);
      for (let i = 0; i < left.length; i += 2)
        flank(left.slice(i, i + 2), -1, ends[0] + gap, -rowGap * (i / 2 + 0.5), "wing");
      for (let i = 0; i < right.length; i += 2)
        flank(right.slice(i, i + 2), 1, ends[1] + gap, -rowGap * (i / 2 + 0.5), "wing");
    } else {
      // kept back behind the ends of the line, where nobody stands in their way out
      const [right, left] = split(riders);
      const inside = (wing: Block[]): number => Math.max(half - (wing[0]?.width ?? 0) - gap * 2, 0);
      left.forEach((block, i) => {
        flank([block], -1, inside(left), back - rowGap * (i + 1), "reserve");
      });
      right.forEach((block, i) => {
        flank([block], 1, inside(right), back - rowGap * (i + 1), "reserve");
      });
    }

    // the shape: the ends ahead of the centre or behind it, the weak wing held back
    const shaped = places.filter(place => place.role !== "wedge");
    const reach = Math.max(...shaped.map(place => Math.abs(place.across)), 1);
    for (const place of shaped) {
      place.along += tactic.bow * front * (place.across / reach) ** 2;
      if (tactic.massed) {
        const fromStrike = (strike * reach - place.across * strike) / (reach * 2); // 0 at the massed end, 1 at the other
        place.along -= tactic.refuse * front * Math.max(fromStrike - 0.35, 0);
      }
    }
    this.unstack(shaped, gap / 2);
    return places;
  }

  /** One row of the line troops with the shooters spread evenly among them */
  private mingle(line: Block[], shooters: Block[]): Block[] {
    const row: (Block | undefined)[] = new Array(line.length + shooters.length);
    shooters.forEach((block, i) => {
      row[Math.floor(((i + 0.5) * row.length) / shooters.length)] = block;
    });
    let next = 0;
    return Array.from(row, block => block ?? line[next++]);
  }

  /** A place the shape pulled onto one further ahead goes back behind it, so far as to keep the gap */
  private unstack(places: Place[], gap: number): void {
    const order = places.map((place, i) => ({ place, i })).sort((a, b) => b.place.along - a.place.along || a.i - b.i);
    const done: Place[] = [];
    for (const { place } of order) {
      const { block } = place;
      for (let moved = true; moved; ) {
        moved = false;
        for (const ahead of done) {
          if (Math.abs(place.across - ahead.across) >= (block.width + ahead.block.width) / 2) continue;
          const reach = (block.depth + ahead.block.depth) / 2;
          if (Math.abs(place.along - ahead.along) >= reach) continue;
          place.along = ahead.along - reach - gap;
          moved = true;
        }
      }
      done.push(place);
    }
  }

  /**
   * Riders in a wedge, its point the best battalion: rows of one, two, three and so on, each behind the gaps of the one
   * before. Places are about the point, not the formation: the wedge has a frame of its own
   */
  private formWedge(riders: Block[], front: number): Place[] {
    const pitch = Math.max(...riders.map(block => block.width), 0) + GAP * front;
    const places: Place[] = [];
    for (let row = 0, seated = 0; seated < riders.length; row++) {
      const count = Math.min(row + 1, riders.length - seated);
      for (let i = 0; i < count; i++) {
        const block = riders[seated + i];
        const across = (i - (count - 1) / 2) * pitch;
        places.push({ block, role: "wedge", mission: "flank", rank: 0, across, along: -row * ROW_GAP * front });
      }
      seated += count;
    }
    return places;
  }

  /**
   * A ring round the middle of the formation, facing out: line troops on it, shooters and engines in the middle with
   * the riders and a reserve about them; shooters and engines fill out a ring too short to close
   */
  private formRing(blocks: Block[], tactic: Tactic, front: number): Place[] {
    const [gap, rowGap] = [GAP * front, ROW_GAP * front];
    const strength = (block: Block): number => block.troops * block.unitPower;
    const of = (kind: Block["kind"]): Block[] =>
      blocks.filter(block => block.kind === kind).sort((a, b) => strength(b) - strength(a) || a.id - b.id);
    const line = of("melee");
    const kept = line.length >= 4 ? Math.round(line.length * tactic.reserve) : 0;
    const reserve = kept ? line.splice(line.length - kept) : [];
    const fire = [...of("ranged"), ...of("machinery")];
    const closed = line.length >= 3;
    // shooters and engines spread evenly among the line troops
    const spread = (row: Block[]): { block: Block; at: number }[] =>
      row.map((block, i) => ({ block, at: (i + 0.5) / row.length }));
    const ring = closed
      ? line
      : [...spread(line), ...spread(fire)]
          .sort((a, b) => a.at - b.at || a.block.id - b.block.id)
          .map(({ block }) => block);
    const inside = [...(closed ? fire : []), ...of("mounted"), ...reserve];

    const around = ring.reduce((sum, block) => sum + block.width + gap, 0);
    let radius = Math.max(around / (Math.PI * 2), front * (0.8 + 0.6 * Math.sqrt(inside.length)));
    const places: Place[] = [];
    // inside: rows facing the way the formation does, the first row in the middle and the rest out from it
    const rows: Block[][] = [];
    for (const block of inside) {
      const last = rows.at(-1);
      if (last && last.reduce((sum, other) => sum + other.width + gap, block.width) <= radius) last.push(block);
      else rows.push([block]);
    }
    const slots = rows
      .map((_, i) => ((rows.length - 1) / 2 - i) * rowGap)
      .sort((a, b) => Math.abs(a) - Math.abs(b) || b - a);
    // the ring stands out past the far corners of the rows inside it
    const depth = Math.max(...ring.map(block => block.depth), 0);
    rows.forEach((row, i) => {
      const half = row.reduce((sum, block) => sum + block.width + gap, -gap) / 2;
      const deep = Math.max(...row.map(block => block.depth)) / 2;
      radius = Math.max(radius, Math.hypot(half, Math.abs(slots[i]) + deep) + depth / 2 + gap);
    });
    let walked = 0;
    for (const block of ring) {
      const angle = ((walked + (block.width + gap) / 2) / around) * Math.PI * 2;
      walked += block.width + gap;
      const role = ROLES[block.kind];
      const [across, along] = [Math.sin(angle) * radius, Math.cos(angle) * radius];
      places.push({ block, role, mission: MISSIONS[role], rank: 0, across, along, facing: angle });
    }
    rows.forEach((row, i) => {
      let offset = -row.reduce((sum, block) => sum + block.width + gap, -gap) / 2;
      for (const block of row) {
        const role: Role = block.kind === "ranged" || block.kind === "machinery" ? ROLES[block.kind] : "reserve";
        places.push({
          block,
          role,
          mission: MISSIONS[role],
          rank: 1,
          across: offset + block.width / 2,
          along: slots[i]
        });
        offset += block.width + gap;
      }
    });
    return places;
  }
}

export const Formations = new FormationModule();
