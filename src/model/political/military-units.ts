import { GOODS_DATA } from "@/data/goods";
import { Icons } from "@/model/icons";
import type { MilitaryUnit } from "@/types/military";

export function getDefaultMilitaryUnits(): MilitaryUnit[] {
  const units = [
    {
      icon: "🪓",
      name: "levies",
      rural: 0,
      urban: 0,
      crew: 1,
      power: 0.5,
      type: "levies",
      separate: 0
    },
    {
      icon: "⚔️",
      name: "infantry",
      rural: 0.25,
      urban: 0.2,
      crew: 1,
      power: 1,
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
      power: 1,
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
      power: 2,
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
      power: 12,
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
      power: 50,
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
