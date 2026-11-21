import { describe, expect, it } from "vitest";
import type { Battalion } from "./battle";
import { Formations, type Place, TACTICS, type TacticName } from "./formations";

// lengths in fronts: a full battalion 1 wide and half a front deep
let id = 0;
const battalion = (kind: Battalion["kind"], width = 1): Battalion =>
  ({ id: id++, kind, troops: 300, stats: { power: 1 }, width, depth: 0.5 }) as Battalion;
const many = (count: number, kind: Battalion["kind"], width = 1): Battalion[] =>
  Array.from({ length: count }, () => battalion(kind, width));

/** Pairs of places whose battalions stand on each other, squared to the formation's heading */
const stacked = (places: Place[]): string[] => {
  const found: string[] = [];
  const line = places.filter(place => place.role !== "wedge" && place.facing === undefined);
  for (const [i, p] of line.entries()) {
    for (const q of line.slice(i + 1)) {
      const across = Math.abs(p.across - q.across) < (p.battalion.width + q.battalion.width) / 2 - 1e-6;
      const along = Math.abs(p.along - q.along) < (p.battalion.depth + q.battalion.depth) / 2 - 1e-6;
      if (across && along) found.push(`${p.battalion.kind} ${p.role} on ${q.battalion.kind} ${q.role}`);
    }
  }
  return found;
};

describe("formations", () => {
  const armies: [string, Battalion[]][] = [
    ["foot, engines and riders", [...many(8, "melee"), ...many(8, "machinery", 0.5), ...many(4, "mounted")]],
    ["foot, shooters and riders", [...many(10, "melee"), ...many(4, "ranged", 0.7), ...many(4, "mounted")]],
    ["small battalions", [...many(12, "melee", 0.6), ...many(6, "ranged", 0.41), ...many(2, "mounted", 0.5)]],
    ["one battalion", many(1, "melee")]
  ];

  it("stands no two battalions on each other, whatever the tactic", () => {
    for (const name of Object.keys(TACTICS) as TacticName[]) {
      if (TACTICS[name].ring) continue;
      for (const [army, battalions] of armies) {
        for (const strike of [-1, 1]) {
          const places = Formations.form(battalions, TACTICS[name], strike, 30, 1);
          expect(places.length, `${name}, ${army}`).toBe(battalions.length);
          expect(stacked(places), `${name}, ${army}`).toEqual([]);
        }
      }
    }
  });

  it("keeps the riders held back behind the engines, not among them", () => {
    const battalions = [...many(6, "melee"), ...many(6, "machinery", 0.6), ...many(2, "mounted")];
    const places = Formations.form(battalions, TACTICS.defensiveLine, 1, 30, 1);
    const engines = Math.min(...places.filter(place => place.battalion.kind === "machinery").map(place => place.along));
    for (const rider of places.filter(place => place.battalion.kind === "mounted"))
      expect(rider.along).toBeLessThan(engines);
  });

  it("stands the troops inside a ring clear of the battalions on it", () => {
    for (const battalions of [
      [...many(6, "melee"), ...many(16, "ranged"), ...many(4, "mounted")],
      [...many(3, "melee"), ...many(12, "mounted")],
      [...many(4, "melee"), ...many(30, "ranged", 0.5)]
    ]) {
      const places = Formations.form(battalions, TACTICS.wagenburg, 1, 30, 1);
      expect(places.length).toBe(battalions.length);
      const ring = places.filter(place => place.facing !== undefined);
      const radius = Math.hypot(ring[0].across, ring[0].along);
      for (const place of places.filter(place => place.facing === undefined)) {
        const { width, depth } = place.battalion;
        const corner = Math.hypot(Math.abs(place.across) + width / 2, Math.abs(place.along) + depth / 2);
        expect(corner).toBeLessThanOrEqual(radius - ring[0].battalion.depth / 2); // the inner face of the ring
      }
    }
  });

  it("forms nobody when there is nobody", () => {
    expect(Formations.form([], TACTICS.assault, 1, 30, 1)).toEqual([]);
    expect(Formations.form([], TACTICS.wagenburg, 1, 30, 1)).toEqual([]);
  });
  it("lays ambushers with the shooters in front and the line troops a step behind, each with a clear way on", () => {
    for (const name of ["ambuscadeBothSides", "ambuscadeOneSide"] as const) {
      const places = Formations.form([...many(5, "melee"), ...many(3, "ranged", 0.7)], TACTICS[name], 1, 30, 1);
      const shooters = places.filter(place => place.battalion.kind === "ranged");
      const line = places.filter(place => place.battalion.kind === "melee");
      expect(shooters.every(place => place.rank === 0 && place.along === 0)).toBe(true);
      expect(line.every(place => place.along === -0.5)).toBe(true); // a battalion's depth behind
      for (const foot of line)
        for (const shooter of shooters)
          expect(Math.abs(foot.across - shooter.across)).toBeGreaterThan(
            (foot.battalion.width + shooter.battalion.width) / 2
          );
      // spread along the line, not bunched at an end of it
      const ends = Math.max(...line.map(place => Math.abs(place.across)));
      expect(shooters.every(place => Math.abs(place.across) < ends)).toBe(true);
    }
  });
});
