import { describe, expect, it } from "vitest";
import type { MilitaryUnit } from "@/types/military";
import { getUnitPower, upgradeLegacyMilitaryUnit } from "./military-units";

const legacy = (name: string, type: string, power: number) =>
  upgradeLegacyMilitaryUnit({ icon: "x", name, rural: 0, urban: 0, crew: 1, type, separate: 0, power }) as MilitaryUnit;

describe("upgradeLegacyMilitaryUnit", () => {
  it("keeps the power of every default unit saved before v1.159.0", () => {
    const old: [string, string, number][] = [
      ["levies", "levies", 0.5],
      ["infantry", "melee", 1],
      ["archers", "ranged", 1],
      ["cavalry", "mounted", 2],
      ["artillery", "machinery", 12],
      ["fleet", "naval", 50]
    ];
    for (const [name, type, power] of old) expect(getUnitPower(legacy(name, type, power))).toBeCloseTo(power, 1);
  });

  it("takes the traits of the default unit of its type, else of infantry, in their proportion", () => {
    const riders = legacy("Horse archers", "mounted", 3);
    expect(riders).toMatchObject({ speed: 12.6, range: 0, morale: 1.2 });
    expect(riders.attack / riders.defense).toBeCloseTo(1.5 / 1.4, 1);
    expect(legacy("Golems", "magical", 2)).toMatchObject({ attack: 2, defense: 2, speed: 4.3, range: 0, morale: 1 });
  });

  it("leaves a unit that has its traits alone", () => {
    const unit = { name: "x", attack: 2, defense: 1, speed: 4.3, range: 0, morale: 1 };
    expect(upgradeLegacyMilitaryUnit({ ...unit, power: 9 })).toEqual(unit);
  });
});
