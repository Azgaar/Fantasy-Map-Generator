import { GOODS_DATA } from "@/data/goods";
import { Icons } from "@/model/icons";
import type { MilitaryUnit } from "@/types/military";
import { rn } from "@/utils/number-utils";

export const FOOT_SPEED = 4.3; // km/h of troops on foot: 1.2 m/s
const RANGE_POWER = 680; // metres of range that double the power

type Traits = Pick<MilitaryUnit, "attack" | "defense" | "speed" | "range" | "morale">;

/** Military power of a unit: its upkeep and its weight in a state's forces */
export function getUnitPower(unit: Traits): number {
  const strength = (unit.attack + unit.defense) / 2;
  const speed = Math.sqrt((unit.speed + FOOT_SPEED) / (FOOT_SPEED * 2));
  const range = 1 + Math.max(unit.range, 0) / RANGE_POWER;
  const morale = Math.max(unit.morale, 0); // losses shake a unit the less the steadier it is
  return strength * speed * range * morale || 0;
}

/** A unit saved with a single power gets the traits of the default unit of its type, else of infantry, scaled to keep that power */
export function upgradeLegacyMilitaryUnit(value: unknown): unknown {
  if (!value || typeof value !== "object" || !("power" in value)) return value;
  const { power, ...unit } = value as Record<string, unknown>;
  if ("attack" in unit) return unit;
  const defaults = getDefaultMilitaryUnits();
  const model = defaults.find(({ type }) => type === unit.type) ?? defaults.find(({ type }) => type === "melee")!;
  const { attack, defense, speed, range, morale } = model;
  const scale = Math.max(Number(power) || 0, 0) / getUnitPower(model);
  return { ...unit, attack: rn(attack * scale, 2), defense: rn(defense * scale, 2), speed, range, morale };
}

export function getDefaultMilitaryUnits(): MilitaryUnit[] {
  const units = [
    {
      icon: "🪓",
      name: "levies",
      rural: 0,
      urban: 0,
      crew: 1,
      attack: 0.5,
      defense: 0.5,
      speed: 4.3,
      range: 0,
      morale: 0.5,
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
      speed: 4.3,
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
      attack: 1.1,
      defense: 0.42,
      speed: 4.3,
      range: 160,
      morale: 0.8,
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
      attack: 1.5,
      defense: 1.4,
      speed: 12.6,
      range: 0,
      morale: 1.2,
      type: "mounted",
      separate: 0,
      goods: ["Horses", "Camels", "Tack"]
    },
    {
      icon: "💣",
      name: "artillery",
      rural: 0,
      urban: 0.03,
      crew: 8,
      attack: 16,
      defense: 3.1,
      speed: 1.8,
      range: 380,
      morale: 0.8,
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
      speed: 3.1,
      range: 270,
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
