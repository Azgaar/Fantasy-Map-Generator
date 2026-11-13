// Places in a formation, by tactic. See docs/domain/battles.md.

import type { Block, Mission, Role } from "./battle";

export const ROW_GAP = 40; // between the lines of a formation
export const GAP = 10; // between neighbours in a line

/** How a general draws his troops up; every number is read by the one builder below */
export interface Tactic {
  lines: number; // lines of line troops, at least
  reserve: number; // share of the line troops held behind them
  span: number; // share of the room the first line may take
  massed: boolean; // one wing is the stronger: the best troops, the second line and the reserve behind it
  refuse: number; // how far back the other wing ends up
  bow: number; // how far ahead of the centre the ends of the line stand; behind when negative
  shooters: "behind" | "front" | "wings";
  riders: "wings" | "strike" | "behind";
}

const tactic = (
  lines: number,
  reserve: number,
  span: number,
  massed: boolean,
  refuse: number,
  bow: number,
  shooters: Tactic["shooters"],
  riders: Tactic["riders"]
): Tactic => ({ lines, reserve, span, massed, refuse, bow, shooters, riders });

export const TACTICS = {
  // attack
  assault: tactic(1, 0.2, 1, false, 0, 0, "behind", "wings"),
  oblique: tactic(1, 0.15, 1, true, 110, 0, "behind", "strike"),
  envelopment: tactic(1, 0.1, 0.8, false, 0, 45, "behind", "wings"),
  wedge: tactic(2, 0.15, 0.6, false, 0, -70, "wings", "behind"),
  harass: tactic(1, 0, 1, false, 0, 0, "front", "wings"),
  // defence
  stand: tactic(1, 0.2, 1, false, 0, 0, "behind", "behind"),
  crescent: tactic(1, 0.15, 0.8, false, 0, -60, "behind", "behind"),
  crossing: tactic(1, 0.25, 0.7, false, 0, 40, "behind", "behind"),
  // of a battle type
  column: tactic(1, 0, 1, false, 0, 0, "behind", "wings"),
  ambuscade: tactic(1, 0, 1, false, 0, 0, "behind", "wings"),
  waylay: tactic(1, 0, 1, false, 0, 0, "behind", "wings"),
  lines: tactic(1, 0.2, 1, false, 0, 0, "behind", "wings"),
  ring: tactic(1, 0, 1, false, 0, 0, "behind", "behind"),
  garrison: tactic(1, 0, 1, false, 0, 0, "behind", "behind"),
  waves: tactic(2, 0, 0.8, false, 0, 0, "behind", "behind")
} satisfies Record<string, Tactic>;

export type TacticName = keyof typeof TACTICS;

/** A battalion's place: across the formation from its middle, to the right, and along it from the first line, ahead */
export interface Place {
  block: Block;
  role: Role;
  mission: Mission;
  rank: number; // the line it stands in, 0 the first
  across: number;
  along: number;
}

/**
 * Draw the battalions up by the tactic in the room across the field
 * @param strike the massed wing: -1 the left, 1 the right
 */
export function form(blocks: Block[], tactic: Tactic, strike: number, room: number): Place[] {
  const strength = (block: Block): number => block.troops * block.unitPower;
  const of = (kind: Block["kind"]): Block[] =>
    blocks.filter(block => block.kind === kind).sort((a, b) => strength(b) - strength(a) || a.id - b.id);
  let line = of("line");
  let shooters = of("shooter");
  let riders = of("rider");
  let engines = of("engine");
  // somebody has to stand in front
  if (!line.length) {
    if (shooters.length) [line, shooters] = [shooters, []];
    else if (riders.length) [line, riders] = [riders, []];
    else [line, engines] = [engines, []];
  }

  // shooters in front: they are the first line, the line troops stand behind them
  if (tactic.shooters === "front" && shooters.length) [line, shooters] = [shooters, line];

  const places: Place[] = [];
  const widthOf = (row: Block[]): number => row.reduce((sum, block) => sum + block.width + GAP, -GAP);
  /** A row side by side, its middle at `centre`; listed left to right */
  const seat = (row: Block[], rank: number, along: number, centre = 0, role?: Role): void => {
    let offset = centre - widthOf(row) / 2;
    for (const block of row) {
      const own: Role = role ?? ROLES[block.kind];
      places.push({ block, role: own, mission: MISSIONS[own], rank, across: offset + block.width / 2, along });
      offset += block.width + GAP;
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
  const wings = tactic.shooters === "wings" && shooters.length ? widthOf(shooters) + GAP * 2 : 0;
  const span = Math.max(room * tactic.span - wings, room * 0.4);

  // the lines: as many as the room asks for, the first the longest and the best
  const count = Math.max(Math.ceil(widthOf(line) / span), Math.min(tactic.lines, Math.floor(line.length / 2)), 1);
  const first = Math.ceil(line.length / count);
  const lines = [line.slice(0, first), ...wrap(line.slice(first), widthOf(line.slice(0, first)))];
  const half = widthOf(lines[0]) / 2;
  const aside = (row: Block[]): number => (tactic.massed ? strike * (half - widthOf(row) / 2) : 0); // behind the massed wing

  let rank = 0;
  let along = 0;
  const next = (): void => {
    rank += 1;
    along -= ROW_GAP;
  };
  seat(arrange(lines[0]), 0, 0);
  if (tactic.shooters !== "wings") {
    for (const row of wrap(shooters, Math.max(half * 2, 120))) {
      next();
      seat(row, rank, along);
    }
  }
  for (const row of lines.slice(1)) {
    next();
    seat(arrange(row), rank, along, aside(row));
  }
  for (const row of wrap(reserve, Math.max(half * 2, 120))) {
    next();
    seat(row, rank, along, aside(row), "reserve");
  }
  const back = along; // of the troops on foot
  for (const row of wrap(engines, Math.max(half * 2, 120))) {
    next();
    seat(row, rank, along);
  }

  // the wings: shooters at the ends of the line, riders beyond them and a little back
  const flank = (row: Block[], side: number, from: number, back: number, role?: Role): number => {
    if (!row.length) return from;
    const width = widthOf(row);
    seat(side > 0 ? row : [...row].reverse(), 0, back, side * (from + GAP + width / 2), role);
    return from + GAP + width;
  };
  const split = (row: Block[]): [Block[], Block[]] => [
    row.filter((_, i) => i % 2 === 0),
    row.filter((_, i) => i % 2 === 1)
  ];
  let ends = [half, half]; // left, right
  if (tactic.shooters === "wings") {
    const [right, left] = split(shooters);
    ends = [flank(left, -1, ends[0], 0), flank(right, 1, ends[1], 0)];
  }
  if (tactic.riders !== "behind") {
    // in a column of twos on each wing, a little back
    const all = tactic.massed || tactic.riders === "strike";
    const [right, left] = all ? (strike > 0 ? [riders, []] : [[], riders]) : split(riders);
    for (let i = 0; i < left.length; i += 2)
      flank(left.slice(i, i + 2), -1, ends[0] + GAP, -ROW_GAP * (i / 2 + 0.5), "wing");
    for (let i = 0; i < right.length; i += 2)
      flank(right.slice(i, i + 2), 1, ends[1] + GAP, -ROW_GAP * (i / 2 + 0.5), "wing");
  } else {
    // kept back behind the ends of the line, where nobody stands in their way out
    const [right, left] = split(riders);
    const inside = (row: Block[]): number => Math.max(half - (row[0]?.width ?? 0) - GAP * 2, 0);
    left.forEach((block, i) => {
      flank([block], -1, inside(left), back - ROW_GAP * (i + 1), "reserve");
    });
    right.forEach((block, i) => {
      flank([block], 1, inside(right), back - ROW_GAP * (i + 1), "reserve");
    });
  }

  // the shape: the ends ahead of the centre or behind it, the weak wing held back
  const reach = Math.max(...places.map(place => Math.abs(place.across)), 1);
  for (const place of places) {
    place.along += tactic.bow * (place.across / reach) ** 2;
    if (tactic.massed) {
      const fromStrike = (strike * reach - place.across * strike) / (reach * 2); // 0 at the massed end, 1 at the other
      place.along -= tactic.refuse * Math.max(fromStrike - 0.35, 0);
    }
  }
  return places;
}

const ROLES: Record<Block["kind"], Role> = { line: "line", shooter: "support", rider: "wing", engine: "battery" };
const MISSIONS: Record<Role, Mission> = {
  line: "line",
  support: "support",
  battery: "battery",
  wing: "guard",
  reserve: "reserve"
};
