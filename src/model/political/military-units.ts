import { GOODS_DATA } from "@/data/goods";
import { Icons } from "@/model/icons";
import type { MilitaryUnit } from "@/types/military";
import { rn } from "@/utils/number-utils";

export const FOOT_SPEED = 7; // of troops on foot, in battle plan units a tick

/** What a unit of a type is like unless set otherwise; `attack` is the share of attack in its attack and defense */
export const UNIT_TYPE_TRAITS: Record<string, { speed: number; range: number; morale: number; attack: number }> = {
  levies: { speed: 7, range: 0, morale: 0.6, attack: 0.46 },
  melee: { speed: 7, range: 0, morale: 1, attack: 0.5 },
  ranged: { speed: 7, range: 170, morale: 1, attack: 0.6 },
  mounted: { speed: 20, range: 0, morale: 1, attack: 0.59 },
  machinery: { speed: 2, range: 280, morale: 1, attack: 0.83 },
  naval: { speed: 5, range: 200, morale: 1, attack: 0.6 },
  armored: { speed: 9, range: 0, morale: 1, attack: 0.45 },
  aviation: { speed: 24, range: 120, morale: 1, attack: 0.65 },
  magical: { speed: 6, range: 150, morale: 1, attack: 0.7 }
};

type Traits = Pick<MilitaryUnit, "attack" | "defense" | "speed" | "range" | "morale">;

// what speed, range and steadiness add to the mean of attack and defense
const getReach = ({ speed, range, morale }: Pick<Traits, "speed" | "range" | "morale">): number =>
  Math.sqrt((Math.max(speed, 0) + FOOT_SPEED) / (FOOT_SPEED * 2)) *
  (1 + Math.max(range, 0) / 500) *
  Math.sqrt(Math.max(morale, 0));

/** Military power of a unit: its upkeep and its weight in a state's forces */
export function getUnitPower(unit: Traits): number {
  return ((Math.max(unit.attack, 0) + Math.max(unit.defense, 0)) / 2) * getReach(unit) || 0;
}

/** A unit saved with a single power gets the traits of its type, split to keep that power */
export function upgradeMilitaryUnit(value: unknown): unknown {
  if (!value || typeof value !== "object" || !("power" in value)) return value;
  const { power, ...unit } = value as Record<string, unknown>;
  if ("attack" in unit && "defense" in unit) return unit;
  const { attack, ...traits } = UNIT_TYPE_TRAITS[String(unit.type)] ?? UNIT_TYPE_TRAITS.melee;
  const both = (Math.max(Number(power) || 0, 0) * 2) / getReach(traits);
  return { ...unit, attack: rn(both * attack, 2), defense: rn(both * (1 - attack), 2), ...traits };
}

export function getDefaultMilitaryUnits(): MilitaryUnit[] {
  const units = [
    {
      icon: "🪓",
      name: "levies",
      rural: 0,
      urban: 0,
      crew: 1,
      attack: 0.6,
      defense: 0.7,
      speed: 7,
      range: 0,
      morale: 0.6,
      type: "levies",
      separate: 0
    },
    {
      icon: "⚔️",
      name: "infantry",
      rural: 0.25,
      urban: 0.2,
      crew: 1,
      attack: 1,
      defense: 1,
      speed: 7,
      range: 0,
      morale: 1,
      type: "melee",
      separate: 0,
      goods: ["Arms"]
    },
    {
      icon: "🏹",
      name: "archers",
      rural: 0.12,
      urban: 0.2,
      crew: 1,
      attack: 0.9,
      defense: 0.6,
      speed: 7,
      range: 170,
      morale: 1,
      type: "ranged",
      separate: 0,
      goods: ["Arms"]
    },
    {
      icon: "🐴",
      name: "cavalry",
      rural: 0.12,
      urban: 0.03,
      crew: 1,
      attack: 1.7,
      defense: 1.2,
      speed: 20,
      range: 0,
      morale: 1,
      type: "mounted",
      separate: 0,
      goods: ["Horses", "Camels", "Harnesses"]
    },
    {
      icon: "💣",
      name: "artillery",
      rural: 0,
      urban: 0.03,
      crew: 8,
      attack: 16,
      defense: 3.2,
      speed: 2,
      range: 280,
      morale: 1,
      type: "machinery",
      separate: 0,
      goods: ["Artillery", "Gunpowder"]
    },
    {
      icon: "🌊",
      name: "fleet",
      rural: 0,
      urban: 0.015,
      crew: 100,
      attack: 46,
      defense: 31.2,
      speed: 5,
      range: 200,
      morale: 1,
      type: "naval",
      separate: 1,
      goods: ["Boats"]
    }
  ];
  const goodId = (name: string) => GOODS_DATA.findIndex(good => good.name === name) + 1; // default goods' ids
  return units.map(
    ({ goods, ...unit }): MilitaryUnit => ({
      ...unit,
      icon: Icons.glyph(unit.icon),
      ...(goods && { goods: goods.map(goodId) })
    })
  );
}
