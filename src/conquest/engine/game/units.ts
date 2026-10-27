/**
 * Unit roster helpers — now content-driven (total-war/.plans/PLAN.md Phase 2).
 * `UnitType` lives in common/content.ts; every function takes the resolved
 * unit types / roster explicitly so the engine has no hardcoded pool.
 */
import type { ResolvedRoster, UnitType } from "../common/content";
import type { ArmyUnit } from "../common/types";

export type { UnitCategory, UnitType } from "../common/content";

interface RegimentConversion {
  units: ArmyUnit[];
  strength: number;
}

/**
 * Convert an Azgaar regiment composition into ≤ maxUnits TW-style units via the
 * faction's roster regimentMap (total-war/.plans/PLAN.md §3.1 step 5). Fleets keep their crews as
 * melee "units" and are immobile in Phase 1 (transports arrive later).
 */
export function regimentToUnits(
  roster: ResolvedRoster,
  unitTypes: Record<string, UnitType>,
  u: { infantry?: number; archers?: number; cavalry?: number; artillery?: number },
  strength: number,
  fleet: boolean,
  maxUnits: number
): RegimentConversion {
  const map = roster.regimentMap;
  const want: { type: UnitType; men: number }[] = [
    { type: unitTypes[map.infantry]!, men: fleet ? Math.round(strength * 0.6) : (u.infantry ?? 0) },
    { type: unitTypes[map.archers]!, men: u.archers ?? 0 },
    { type: unitTypes[map.cavalry]!, men: u.cavalry ?? 0 },
    { type: unitTypes[map.artillery]!, men: u.artillery ?? 0 }
  ].filter(w => w.type !== undefined && w.men > 0);
  // Some Azgaar regiments carry strength but no composition — fall back to melee.
  if (want.length === 0 && strength > 0) {
    const melee = unitTypes[map.infantry];
    if (melee) want.push({ type: melee, men: strength });
  }
  if (want.length === 0) return { units: [], strength: 0 };

  // Ideal slots at full unit size, then trim the largest categories (keeping ≥1
  // slot per present category) until the army fits the cap. Overflow men are
  // dropped — a documented composition approximation (total-war/.plans/PLAN.md §3.1 step 5).
  const slots = want.map(w => Math.max(1, Math.ceil(w.men / w.type.men)));
  const total = (): number => slots.reduce((a, b) => a + b, 0);
  while (total() > maxUnits) {
    let big = -1;
    for (let i = 0; i < slots.length; i++) {
      if (slots[i]! > 1 && (big < 0 || slots[i]! > slots[big]!)) big = i;
    }
    if (big < 0) break;
    slots[big]!--;
  }

  const units: ArmyUnit[] = [];
  for (let i = 0; i < want.length; i++) {
    const { type, men } = want[i]!;
    const n = slots[i]!;
    const per = Math.min(type.men, Math.ceil(men / n));
    let left = men;
    for (let k = 0; k < n; k++) {
      const count = Math.min(per, left);
      if (count <= 0) break;
      left -= count;
      units.push({ type: type.id, count, exp: 0 });
    }
  }
  return { units, strength: units.reduce((a, u) => a + u.count, 0) };
}

/** Garrison for a region's major settlement (total-war/.plans/PLAN.md §5.5): walls tier scales militia. */
export function garrisonUnits(roster: ResolvedRoster, unitTypes: Record<string, UnitType>, walls: number): ArmyUnit[] {
  const units: ArmyUnit[] = [];
  const melee = unitTypes[roster.garrison.melee] ?? Object.values(unitTypes)[0]!;
  const ranged = unitTypes[roster.garrison.ranged] ?? melee;
  const spears = 2 + walls * 2;
  const archers = 1 + walls;
  for (let i = 0; i < spears; i++) units.push({ type: melee.id, count: melee.men, exp: 0 });
  for (let i = 0; i < archers; i++) units.push({ type: ranged.id, count: ranged.men, exp: 0 });
  return units;
}

/** Local militia garrison for an undefended minor settlement. */
export function minorGarrisonUnits(
  roster: ResolvedRoster,
  unitTypes: Record<string, UnitType>,
  tier: number,
  walls: number
): ArmyUnit[] {
  const units: ArmyUnit[] = [];
  const melee = unitTypes[roster.garrison.melee] ?? Object.values(unitTypes)[0]!;
  const ranged = unitTypes[roster.garrison.ranged] ?? melee;
  const spears = 1 + Math.max(0, walls);
  const archers = tier >= 2 || walls > 0 ? 1 : 0;
  for (let i = 0; i < spears; i++) units.push({ type: melee.id, count: melee.men, exp: 0 });
  for (let i = 0; i < archers; i++) units.push({ type: ranged.id, count: ranged.men, exp: 0 });
  return units;
}
