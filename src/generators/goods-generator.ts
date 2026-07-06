import Alea from "alea";
import { color, shuffler } from "d3";
import type { PackedGraph } from "../types/PackedGraph";
import type { CultureType } from "./cultures-generator";

export interface Good {
  i: number;

  // generation
  chance?: number;
  distribution?: string;
  biomeOutput?: Partial<Record<number, number>>;
  recipes?: Record<number, number>[];

  // multipliers; absent or 1 = no effect; 0 = fully suppressed
  multipliers?: {
    cultureType?: Partial<Record<CultureType, number>>;
    culture?: Partial<Record<number, number>>;
    state?: Partial<Record<number, number>>;
    religion?: Partial<Record<number, number>>;
    biome?: Partial<Record<number, number>>;
    zone?: Partial<Record<number, number>>; // keyed by zone.i; rare, resolved via cell membership
  };

  // effects
  demandCoverage?: Partial<Record<DemandCategory, number>>;

  // lore
  name: string;
  tags: string[];
  value: number;
  unit: string;

  // ui
  icon: string;
  color: string;
  visible?: boolean; // whether the good is shown on the Goods layer
}

export const DEMAND_PRIORITY = ["food", "utilities", "construction", "military", "luxury"] as const;
export type DemandCategory = (typeof DEMAND_PRIORITY)[number];
export const DEMAND_TARGET_FACTORS: Record<DemandCategory, number> = {
  food: 0.2,
  utilities: 0.15,
  construction: 0.1,
  military: 0.08,
  luxury: 0.07
};
export const DEMAND_CATEGORY_ICONS: Record<DemandCategory, string> = {
  food: "🍖",
  utilities: "🛠️",
  construction: "🧱",
  military: "🛡️",
  luxury: "💎"
};

export function getDemandTargets(population: number): number[] {
  return DEMAND_PRIORITY.map(category => population * DEMAND_TARGET_FACTORS[category]);
}

type GoodData = Omit<Good, "i"> & { recipes?: Record<string, number>[] };
const GOODS_DATA: GoodData[] = [
  {
    name: "Wood",
    tags: ["construction", "fuel"],
    icon: "good-wood",
    color: "#966F33",
    value: 1,
    chance: 4,
    distribution: "biome(5, 6, 7, 8, 9)",
    unit: "pile",
    demandCoverage: { construction: 1, utilities: 1 },
    multipliers: { cultureType: { Hunting: 1.5 } },
    biomeOutput: { 5: 0.1, 6: 0.1, 7: 0.1, 8: 0.1, 9: 0.1, 12: 0.05 }
  },
  {
    name: "Stone",
    tags: ["construction"],
    icon: "good-stone",
    color: "#979EA2",
    value: 2,
    chance: 4,
    distribution: "(minHeight(40) || (minHeight(20) && elevation())) && biome(1, 2, 3, 4)",
    unit: "pallet",
    demandCoverage: { construction: 1 },
    multipliers: { cultureType: { Hunting: 0.6, Nomadic: 0.6 } },
    biomeOutput: { 1: 0.05, 2: 0.05 }
  },
  {
    name: "Marble",
    tags: ["construction", "luxury"],
    icon: "good-marble",
    color: "#d6d0bf",
    value: 6,
    chance: 1,
    distribution: "minHeight(60) || (minHeight(30) && elevation())",
    unit: "pallet",
    demandCoverage: { construction: 0.5, luxury: 0.5 },
    multipliers: { cultureType: { Highland: 1.4 } }
  },
  {
    name: "Iron",
    tags: ["ore", "military"],
    icon: "good-iron",
    color: "#5D686E",
    value: 3,
    chance: 5,
    distribution: "minHeight(60) || (biome(12) && nth(7)) || (minHeight(20) && nth(10))",
    unit: "wagon",
    multipliers: { cultureType: { Highland: 1.4 } },
    biomeOutput: { 12: 0.1 }
  },
  {
    name: "Copper",
    tags: ["ore"],
    icon: "good-copper",
    color: "#b87333",
    value: 4,
    chance: 2,
    distribution: "minHeight(60) || (minHeight(30) && elevation())",
    unit: "wagon",
    multipliers: { cultureType: { Highland: 1.4 } }
  },
  {
    name: "Tin",
    tags: ["ore"],
    icon: "good-tin",
    color: "#454343",
    value: 4,
    chance: 2,
    distribution: "minHeight(60) || (minHeight(30) && elevation())",
    unit: "wagon",
    multipliers: { cultureType: { Highland: 1.4 } }
  },
  {
    name: "Silver",
    tags: ["ore", "luxury"],
    icon: "good-silver",
    color: "#C0C0C0",
    value: 8,
    chance: 2,
    distribution: "minHeight(60) || (minHeight(30) && elevation())",
    unit: "bullion",
    multipliers: { cultureType: { Hunting: 0.5, Highland: 1.4, Nomadic: 0.5 } }
  },
  {
    name: "Gold",
    tags: ["ore", "luxury"],
    icon: "good-gold",
    color: "#ffd700",
    value: 15,
    chance: 2,
    distribution: "river() && minHeight(40)",
    unit: "bullion",
    multipliers: { cultureType: { Highland: 1.4, Nomadic: 0.5 } }
  },
  {
    name: "Grain",
    tags: ["food"],
    icon: "good-grain",
    color: "#F5DEB3",
    value: 1,
    chance: 4,
    distribution: "minHabitability(20) && habitability()",
    unit: "wain",
    demandCoverage: { food: 1 },
    multipliers: { cultureType: { River: 1.2, Lake: 1.2, Nomadic: 0.5 } },
    biomeOutput: { 5: 0.1, 6: 0.1, 7: 0.1, 8: 0.1 }
  },
  {
    name: "Cattle",
    tags: ["food"],
    icon: "good-cattle",
    color: "#56b000",
    value: 2,
    chance: 4,
    distribution: "(biome(3, 4) && !elevation()) || (biome(6) && random(70)) || (biome(5) && nth(5))",
    unit: "head",
    demandCoverage: { food: 1 },
    multipliers: { cultureType: { Nomadic: 2 } },
    biomeOutput: { 3: 0.1, 4: 0.1 }
  },
  {
    name: "Fish",
    tags: ["food", "aquatic"],
    icon: "good-fish",
    color: "#7fcdff",
    value: 1,
    chance: 4,
    distribution: 'shore(-1) && (type("ocean", "freshwater", "salt") || (river() && shore(1, 2)))',
    unit: "wain",
    demandCoverage: { food: 1 },
    multipliers: { cultureType: { River: 1.4, Lake: 1.4, Naval: 1.4, Nomadic: 0.2 } }
  },
  {
    name: "Game",
    tags: ["food"],
    icon: "good-game",
    color: "#c38a8a",
    value: 2,
    chance: 3,
    distribution: "biome(5, 6, 7, 8, 9)",
    unit: "wain",
    demandCoverage: { food: 1 },
    multipliers: { cultureType: { Naval: 0.6, Nomadic: 1.4, Hunting: 2 } },
    biomeOutput: { 3: 0.01, 4: 0.01, 5: 0.02, 6: 0.02, 7: 0.02, 8: 0.02, 9: 0.05 }
  },
  {
    name: "Wine",
    tags: ["food", "luxury"],
    icon: "good-wine",
    color: "#963e48",
    value: 2,
    chance: 3,
    distribution: "biome(6) || (biome(4) && random(50) && river())",
    unit: "barrel",
    demandCoverage: { food: 0.5, luxury: 0.5 },
    multipliers: { cultureType: { Highland: 1.2, Nomadic: 0.5 } },
    biomeOutput: { 6: 0.1 }
  },
  {
    name: "Olives",
    tags: ["food"],
    icon: "good-olives",
    color: "#BDBD7D",
    value: 2,
    chance: 3,
    distribution: "biome(3) && shore(1, 2)",
    unit: "barrel",
    demandCoverage: { food: 1 },
    multipliers: { cultureType: { Generic: 0.8, Nomadic: 0.5 } },
    biomeOutput: { 3: 0.1 }
  },
  {
    name: "Honey",
    tags: ["food", "preservative"],
    icon: "good-honey",
    color: "#DCBC66",
    value: 2,
    chance: 3,
    distribution: "biome(6, 8, 9)",
    unit: "barrel",
    demandCoverage: { food: 0.5 },
    multipliers: { cultureType: { Generic: 1.2 } },
    biomeOutput: { 6: 0.05, 8: 0.03, 9: 0.03 }
  },
  {
    name: "Salt",
    tags: ["preservative", "mineral"],
    icon: "good-salt",
    color: "#E5E4E5",
    value: 2,
    chance: 3,
    distribution: 'shore(1) && type("salt", "dry") || (biome(1, 2) && random(70)) || (biome(12) && nth(10))',
    unit: "bag",
    demandCoverage: { utilities: 1 },
    multipliers: { cultureType: { Naval: 1.2 } },
    biomeOutput: { 1: 0.1, 2: 0.1 }
  },
  {
    name: "Dates",
    tags: ["food"],
    icon: "good-dates",
    color: "#dbb2a3",
    value: 2,
    chance: 2,
    distribution: "biome(1)",
    unit: "wain",
    demandCoverage: { food: 1 },
    multipliers: { cultureType: { Hunting: 0.8, Highland: 0.8 } },
    biomeOutput: { 1: 0.1 }
  },
  {
    name: "Horses",
    tags: ["supply", "military"],
    icon: "good-horses",
    color: "#ba7447",
    value: 5,
    chance: 4,
    distribution: "biome(3) || (biome(2) && nth(4))",
    unit: "head",
    demandCoverage: { utilities: 0.6, military: 0.4 },
    multipliers: { cultureType: { Nomadic: 2 } },
    biomeOutput: { 4: 0.01 }
  },
  {
    name: "Elephants",
    tags: ["supply", "military"],
    icon: "good-elephants",
    color: "#C5CACD",
    value: 7,
    chance: 2,
    distribution: "biome(1, 3, 5, 7)",
    unit: "head",
    demandCoverage: { utilities: 0.2, military: 0.8 },
    multipliers: { cultureType: { Highland: 0.2 } }
  },
  {
    name: "Camels",
    tags: ["supply", "military"],
    icon: "good-camels",
    color: "#C19A6B",
    value: 5,
    chance: 3,
    distribution: "biome(1, 2)",
    unit: "head",
    demandCoverage: { utilities: 0.7, military: 0.3 },
    multipliers: { cultureType: { Nomadic: 2, Generic: 0.8 } },
    biomeOutput: { 1: 0.05, 2: 0.05 }
  },
  {
    name: "Hemp",
    tags: ["clothing", "naval"],
    icon: "good-hemp",
    color: "#069a06",
    value: 1,
    chance: 3,
    distribution: "biome(6, 7, 8)",
    unit: "wain",
    multipliers: { cultureType: { River: 1.4, Lake: 1.4 } },
    biomeOutput: { 6: 0.1, 7: 0.1, 8: 0.1 }
  },
  {
    name: "Pearls",
    tags: ["luxury", "aquatic"],
    icon: "good-pearls",
    color: "#EAE0C8",
    value: 13,
    chance: 2,
    distribution: "shore(-1) && minTemp(18)",
    unit: "pearl",
    demandCoverage: { luxury: 0.6 },
    multipliers: { cultureType: { Naval: 1.4 } }
  },
  {
    name: "Gemstones",
    tags: ["luxury", "mineral"],
    icon: "good-gemstones",
    color: "#e463e4",
    value: 15,
    chance: 2,
    distribution: "minHeight(60) || (minHeight(30) && elevation())",
    unit: "gem",
    demandCoverage: { luxury: 0.6 },
    multipliers: { cultureType: { Highland: 1.4 } }
  },
  {
    name: "Dyes",
    tags: ["luxury"],
    icon: "good-dyes",
    color: "#fecdea",
    value: 5,
    chance: 1,
    distribution: "shore(-1) || minHabitability(1)",
    unit: "bag",
    multipliers: { cultureType: { Generic: 1.2 } }
  },
  {
    name: "Incense",
    tags: ["luxury", "ritual"],
    icon: "good-incense",
    color: "#ebe5a7",
    value: 10,
    chance: 2,
    distribution: "biome(1, 7)",
    unit: "chest",
    demandCoverage: { luxury: 1 }
  },
  {
    name: "Silk",
    tags: ["luxury", "clothing"],
    icon: "good-silk",
    color: "#e0f0f8",
    value: 9,
    chance: 1,
    distribution: "biome(7)",
    unit: "bolt",
    demandCoverage: { luxury: 1 },
    multipliers: { cultureType: { River: 1.2, Lake: 1.2 } }
  },
  {
    name: "Spices",
    tags: ["luxury"],
    icon: "good-spices",
    color: "#e99c75",
    value: 15,
    chance: 2,
    distribution: "biome(7)",
    unit: "chest",
    demandCoverage: { luxury: 1 },
    multipliers: { cultureType: { Generic: 1.2 } }
  },
  {
    name: "Amber",
    tags: ["luxury"],
    icon: "good-amber",
    color: "#e68200",
    value: 7,
    chance: 2,
    distribution: "shore(1) && biome(6, 7, 8, 9)",
    unit: "stone",
    demandCoverage: { luxury: 0.5 },
    multipliers: { cultureType: { Generic: 1.2 } }
  },
  {
    name: "Furs",
    tags: ["clothing", "luxury"],
    icon: "good-furs",
    color: "#8a5e51",
    value: 4,
    chance: 2,
    distribution: "biome(9) || (biome(10) && nth(2)) || (biome(6, 8) && nth(5)) || (biome(12) && nth(10))",
    unit: "pelt",
    demandCoverage: { luxury: 0.5, utilities: 0.3 },
    multipliers: { cultureType: { Hunting: 2 } },
    biomeOutput: { 9: 0.02, 10: 0.02, 6: 0.02, 8: 0.02, 12: 0.02 }
  },
  {
    name: "Sheep",
    tags: ["clothing"],
    icon: "good-sheep",
    color: "#53b574",
    value: 2,
    chance: 3,
    distribution: "(biome(3, 4) && !elevation()) || (biome(6) && random(70)) || (biome(5) && nth(5))",
    unit: "head",
    demandCoverage: { food: 1 },
    multipliers: { cultureType: { Naval: 1.4, Highland: 1.4 } },
    biomeOutput: { 4: 0.1 }
  },
  {
    name: "Slaves",
    tags: ["supply"],
    icon: "good-slaves",
    color: "#757575",
    value: 8,
    chance: 2,
    distribution: "shore(1) && minHabitability(1) && !habitability()",
    unit: "slave",
    demandCoverage: { utilities: 1 },
    multipliers: { cultureType: { Naval: 1.4, Nomadic: 2, Hunting: 0.6, Highland: 0.4 } }
  },
  {
    name: "Tar",
    tags: ["naval"],
    icon: "good-tar",
    color: "#727272",
    value: 3,
    chance: 0,
    unit: "barrel",
    demandCoverage: { utilities: 0.4, military: 0.1 },
    multipliers: { cultureType: { Hunting: 1.2 } },
    recipes: [{ Wood: 1 }]
  },
  {
    name: "Saltpeter",
    tags: ["military", "mineral"],
    icon: "good-saltpeter",
    color: "#e6e3e3",
    value: 2,
    chance: 3,
    distribution: "biome(1, 2) || (minHeight(50) && random(20))",
    unit: "barrel",
    demandCoverage: {}
  },
  {
    name: "Coal",
    tags: ["fuel"],
    icon: "good-coal",
    color: "#5a6a75",
    value: 3,
    chance: 3,
    distribution: "minHeight(40) || (minHeight(20) && elevation(25))",
    unit: "wain",
    demandCoverage: { utilities: 0.5 },
    recipes: [{ Wood: 1.5 }]
  },
  {
    name: "Oil",
    tags: ["fuel"],
    icon: "good-oil",
    color: "#565656",
    value: 3,
    chance: 2,
    distribution: "biome(1, 2, 10) || (shore(-1) && minTemp(18) && random(15))",
    unit: "barrel",
    demandCoverage: { utilities: 1 },
    recipes: [{ Olives: 1 }, { Whales: 1 }]
  },
  {
    name: "Mahogany",
    tags: ["luxury"],
    icon: "good-tropicalTimber",
    color: "#a45a52",
    value: 7,
    chance: 1,
    distribution: "biome(5, 7) && random(50)",
    unit: "pile",
    demandCoverage: { luxury: 1 }
  },
  {
    name: "Whales",
    tags: ["food", "aquatic", "fuel"],
    icon: "good-whales",
    color: "#7fcdff",
    value: 1,
    chance: 3,
    distribution: "shore(-1) && type('ocean') && maxTemp(7)",
    unit: "barrel",
    demandCoverage: { food: 1, utilities: 0.2 },
    multipliers: { cultureType: { Naval: 1.4, Nomadic: 0.5 } }
  },
  {
    name: "Sugarcane",
    tags: ["preservative", "food"],
    icon: "good-sugar",
    color: "#7abf87",
    value: 4,
    chance: 3,
    distribution: "biome(7)",
    unit: "bag",
    demandCoverage: { food: 0.6, luxury: 0.4 }
  },
  {
    name: "Tea",
    tags: ["luxury"],
    icon: "good-tea",
    color: "#d0f0c0",
    value: 5,
    chance: 2,
    distribution: "minHeight(40) && (biome(5) || (biome(7) || biome(8)))",
    unit: "bag",
    demandCoverage: { luxury: 1 },
    multipliers: { cultureType: { Highland: 1.2 } }
  },
  {
    name: "Tobacco",
    tags: ["luxury"],
    icon: "good-tobacco",
    color: "#6D5843",
    value: 5,
    chance: 1,
    distribution: "random(20) && (biome(3) || (biome(5) || biome(6)))",
    unit: "bag",
    demandCoverage: { luxury: 1 }
  },
  {
    name: "Clay",
    tags: ["mineral", "construction"],
    icon: "good-clay",
    color: "#b07c60",
    value: 1,
    chance: 5,
    distribution: "minTemp(8) && (shore(1) || river())",
    unit: "wain",
    demandCoverage: { construction: 1 },
    multipliers: { cultureType: { River: 1.4, Lake: 1.4 } }
  },
  {
    name: "White sand",
    tags: ["mineral"],
    icon: "good-sand",
    color: "#e6d69c",
    value: 1,
    chance: 4,
    distribution: "minTemp(8) && (shore(1) || river())",
    unit: "wain",
    multipliers: { cultureType: { River: 1.4, Lake: 1.4 } }
  },
  {
    name: "Leather",
    tags: ["clothing", "military"],
    icon: "good-leather",
    color: "#8b5a2b",
    value: 4,
    chance: 0,
    recipes: [{ Cattle: 1 }, { Game: 1 }, { Horses: 1 }, { Camels: 1 }],
    unit: "roll",
    multipliers: { cultureType: { Naval: 0.6 } }
  },
  {
    name: "Cloth",
    tags: ["clothing"],
    icon: "good-cloth",
    color: "#e8e69c",
    value: 4,
    chance: 0,
    recipes: [{ Sheep: 1 }, { Hemp: 1 }, { Silk: 0.5 }],
    unit: "bolt",
    demandCoverage: { utilities: 0.2 }
  },
  {
    name: "Garments",
    tags: ["clothing"],
    icon: "good-garments",
    color: "#bd21ec",
    value: 9,
    chance: 0,
    recipes: [
      { Cloth: 1, Dyes: 0.5 },
      { Cloth: 0.5, Furs: 1 }
    ],
    unit: "set",
    demandCoverage: { utilities: 1 }
  },
  {
    name: "Ceramics",
    tags: ["storage", "construction"],
    icon: "good-ceramics",
    color: "#c1440e",
    value: 6,
    chance: 0,
    recipes: [{ Clay: 1 }],
    unit: "wain",
    demandCoverage: { utilities: 1 }
  },
  {
    name: "Glass",
    tags: ["storage", "construction"],
    icon: "good-glass",
    color: "#a0c8e8",
    value: 7,
    chance: 0,
    recipes: [{ "White sand": 1 }],
    unit: "wain",
    demandCoverage: { luxury: 1 },
    multipliers: { cultureType: { Nomadic: 0.2 } }
  },
  {
    name: "Ropes",
    tags: ["naval", "construction"],
    icon: "good-ropes",
    color: "#ba9773",
    value: 4,
    chance: 0,
    recipes: [{ Hemp: 1 }],
    unit: "coil",
    demandCoverage: { utilities: 1 }
  },
  {
    name: "Paper",
    tags: ["ritual", "educational"],
    icon: "good-paper",
    color: "#f5f5dc",
    value: 5,
    chance: 0,
    recipes: [{ Hemp: 1 }],
    unit: "ream",
    demandCoverage: {}
  },
  {
    name: "Ink",
    tags: ["ritual", "educational"],
    icon: "good-ink",
    color: "#000000",
    value: 5,
    chance: 0,
    recipes: [{ Oil: 1 }, { Dyes: 0.5 }],
    unit: "bottle",
    demandCoverage: {}
  },
  {
    name: "Books",
    tags: ["ritual", "educational"],
    icon: "good-books",
    color: "#deb887",
    value: 13,
    chance: 0,
    recipes: [
      { Paper: 1, Ink: 0.5 },
      { Leather: 1, Ink: 0.5 }
    ],
    unit: "volume",
    demandCoverage: { luxury: 1 },
    multipliers: { cultureType: { Nomadic: 0.2, Hunting: 0.5 } }
  },
  {
    name: "Sails",
    tags: ["naval"],
    icon: "good-sails",
    color: "#ffffff",
    value: 7,
    chance: 0,
    recipes: [{ Cloth: 1 }],
    unit: "set",
    demandCoverage: { military: 1 }
  },
  {
    name: "Ships",
    tags: ["naval"],
    icon: "good-ships",
    color: "#654321",
    value: 50,
    chance: 0,
    recipes: [{ Wood: 4, Sails: 4, Ropes: 4, Tar: 2 }],
    unit: "ship",
    demandCoverage: { military: 0.5 },
    multipliers: { cultureType: { Naval: 2 } }
  },
  {
    name: "Boots",
    tags: ["clothing", "military"],
    icon: "good-boots",
    color: "#654321",
    value: 6,
    chance: 0,
    recipes: [{ Leather: 1 }, { Furs: 0.5 }],
    unit: "pair",
    demandCoverage: { utilities: 1 }
  },
  {
    name: "Harnesses",
    tags: ["military"],
    icon: "good-harnesses",
    color: "#a0522d",
    value: 8,
    chance: 0,
    recipes: [
      { Leather: 0.5, Iron: 0.25 },
      { Leather: 0.5, Bronze: 0.25 },
      { Leather: 0.5, Copper: 0.25 }
    ],
    unit: "set",
    demandCoverage: { military: 1 },
    multipliers: { cultureType: { Nomadic: 1.2 } }
  },
  {
    name: "Barrels",
    tags: ["naval", "storage"],
    icon: "good-barrels",
    color: "#b46e3b",
    value: 3,
    chance: 0,
    recipes: [{ Wood: 1 }],
    unit: "barrel",
    demandCoverage: { utilities: 1 }
  },
  {
    name: "Bronze",
    tags: ["military"],
    icon: "good-bronze",
    color: "#e46f21",
    value: 9,
    chance: 0,
    recipes: [
      { Copper: 0.5, Coal: 1 },
      { Tin: 0.5, Coal: 1 }
    ],
    unit: "wagon",
    multipliers: { cultureType: { Highland: 1.2 } }
  },
  {
    name: "Tools",
    tags: ["construction", "military"],
    icon: "good-tools",
    color: "#808080",
    value: 17,
    chance: 0,
    recipes: [
      { Iron: 0.5, Coal: 1 },
      { Bronze: 0.5, Coal: 1 }
    ],
    unit: "set",
    demandCoverage: { utilities: 1 }
  },
  {
    name: "Arms",
    tags: ["military"],
    icon: "good-arms",
    color: "#333333",
    value: 25,
    chance: 0,
    recipes: [
      { Iron: 0.5, Coal: 1, Leather: 0.5 },
      { Bronze: 0.25, Coal: 1, Leather: 0.5 }
    ],
    unit: "set",
    demandCoverage: { military: 1 }
  },
  {
    name: "Gunpowder",
    tags: ["military"],
    icon: "good-gunpowder",
    color: "#b0c4de",
    value: 10,
    chance: 0,
    recipes: [{ Saltpeter: 0.5, Coal: 0.5 }],
    unit: "barrel",
    demandCoverage: { military: 2 }
  },
  {
    name: "Artillery",
    tags: ["military"],
    icon: "good-artillery",
    color: "#cd7f32",
    value: 21,
    chance: 0,
    recipes: [
      { Iron: 2, Coal: 1 },
      { Bronze: 1, Coal: 1 }
    ],
    unit: "cannon",
    demandCoverage: { military: 1 }
  },
  {
    name: "Coins",
    tags: ["currency"],
    icon: "good-coins",
    color: "#ffd700",
    value: 25,
    chance: 0,
    recipes: [
      { Gold: 0.5, Coal: 1 },
      { Silver: 1, Coal: 1 }
    ],
    unit: "bag",
    demandCoverage: { luxury: 1 }
  },
  {
    name: "Jewelry",
    tags: ["luxury"],
    icon: "good-jewelry",
    color: "#34861b",
    value: 34,
    chance: 0,
    recipes: [
      { Gemstones: 1, Gold: 0.5 },
      { Pearls: 1, Gold: 0.5 },
      { Amber: 2, Gold: 0.5 },
      { Gemstones: 1, Silver: 1 },
      { Pearls: 1, Silver: 1 },
      { Amber: 2, Silver: 1 }
    ],
    unit: "piece",
    demandCoverage: { luxury: 1 }
  },
  {
    name: "Preserved food",
    tags: ["food"],
    icon: "good-salted-fish",
    color: "#c2b280",
    value: 4,
    chance: 0,
    recipes: [
      { Fish: 1, Salt: 1 },
      { Cattle: 1, Salt: 1 },
      { Game: 1, Salt: 1 },
      { Sheep: 1, Salt: 1 },
      { Fish: 1, Vinegar: 0.5 },
      { Cattle: 1, Vinegar: 0.5 },
      { Game: 1, Vinegar: 0.5 },
      { Sheep: 1, Vinegar: 0.5 },
      { Fish: 1, Wood: 1 }
    ],
    unit: "wain",
    demandCoverage: { food: 1 }
  },
  {
    name: "Vinegar",
    tags: ["food", "preservative"],
    icon: "good-vinegar",
    color: "#9b111e",
    value: 2,
    chance: 0,
    recipes: [{ Wine: 1 }, { Honey: 1 }],
    unit: "barrel",
    demandCoverage: { utilities: 0.5 }
  },
  {
    name: "Cheese",
    tags: ["food"],
    icon: "good-cheese",
    color: "#f5e1a4",
    value: 4,
    chance: 0,
    recipes: [
      { Cattle: 0.5, Salt: 0.25 },
      { Sheep: 0.5, Salt: 0.25 },
      { Sheep: 0.5, Vinegar: 0.25 },
      { Cattle: 0.5, Vinegar: 0.25 }
    ],
    unit: "wain",
    demandCoverage: { food: 1 }
  },
  {
    name: "Beer",
    tags: ["food"],
    icon: "good-beer",
    color: "#fbb117",
    value: 7,
    chance: 0,
    recipes: [
      { Grain: 1, Barrels: 1 },
      { Honey: 0.5, Barrels: 1 }
    ],
    unit: "barrel",
    demandCoverage: { food: 1 }
  },
  {
    name: "Liquor",
    tags: ["food", "luxury"],
    icon: "good-liquor",
    color: "#8a0303",
    value: 9,
    chance: 0,
    recipes: [
      { Grain: 2, Wood: 1, Barrels: 0.5 },
      { Wine: 1, Wood: 1, Barrels: 0.5 },
      { Grain: 2, Wood: 1, Ceramics: 0.25 },
      { Wine: 1, Wood: 1, Ceramics: 0.25 },
      { Grain: 2, Wood: 1, Glass: 0.25 },
      { Wine: 1, Wood: 1, Glass: 0.25 }
    ],
    unit: "vessel",
    demandCoverage: { luxury: 1 }
  },
  {
    name: "Candles",
    tags: ["luxury", "ritual"],
    icon: "good-candles",
    color: "#fffacd",
    value: 8,
    chance: 0,
    recipes: [{ Honey: 2 }, { Oil: 1 }],
    unit: "block",
    demandCoverage: { utilities: 0.5, luxury: 0.5 }
  },
  {
    name: "Soap",
    tags: ["luxury", "ritual"],
    icon: "good-soap",
    color: "#e0e4cc",
    value: 5,
    chance: 0,
    recipes: [{ Olives: 1 }, { Cattle: 1 }],
    unit: "barrel",
    demandCoverage: { utilities: 0.4, luxury: 0.6 }
  },
  {
    name: "Perfume",
    tags: ["luxury", "ritual"],
    icon: "good-perfume",
    color: "#ff69b4",
    value: 17,
    chance: 0,
    recipes: [
      { Olives: 1, Incense: 0.5, Glass: 0.5 },
      { Olives: 1, Game: 3, Glass: 0.5 },
      { Liquor: 0.25, Incense: 0.5, Whales: 0.5, Ceramics: 0.5 }
    ],
    unit: "bottle",
    demandCoverage: { luxury: 2 }
  }
];

export class GoodsModule {
  private cells!: PackedGraph["cells"];
  private cellId: number = 0;
  private goodById: Good[] = [];

  // Place a bonus good on every eligible cell based on the current catalogue
  generate(options: { randomSeed?: number } = {}) {
    TIME && console.time("generateGoods");
    Math.random = Alea(options.randomSeed ?? seed);
    const shuffle = shuffler(() => Math.random());

    if (!pack.goods?.length) this.restoreDefaults();

    // by default show the first good on the Goods layer
    if (pack.goods.length && !pack.goods.some(good => good.visible)) pack.goods[0].visible = true;

    this.cells = pack.cells;
    this.cells.good = new Uint16Array(this.cells.i.length);

    const resourceMaxCells = Math.ceil((200 * this.cells.i.length) / 5000);
    const resources: Record<number, number> = {};

    const methods = `{${Object.keys(this.getMethods()).join(", ")}}`;
    const shuffledCells = shuffle(this.cells.i.slice());
    const goods = [...pack.goods];

    for (const cellId of shuffledCells) {
      if (!(cellId % 10)) shuffle(goods);
      if (this.cells.biome[cellId] === 11 && biomesData.habitability[11] === 0) continue; // skip glaciers
      this.cellId = cellId;

      for (const good of goods) {
        if (!good.distribution || !good.chance) continue;
        if (resources[good.i] >= resourceMaxCells) continue;
        if (Math.random() * 100 > good.chance) continue;

        const spread = new Function(methods, `return ${good.distribution}`);
        if (!spread(this.getMethods())) continue;

        this.cells.good[cellId] = good.i;
        resources[good.i] = (resources[good.i] || 0) + 1;
        break;
      }
    }

    TIME && console.timeEnd("generateGoods");
    this.sync();
  }

  regeneratePlacement(goodId: number) {
    this.sync();
    const good = this.get(goodId);
    if (!good) return;

    TIME && console.time("regenerateGoodPlacement");
    this.cells = pack.cells;
    if (!this.cells.good || this.cells.good.length !== this.cells.i.length) {
      this.cells.good = new Uint16Array(this.cells.i.length);
    }

    for (const cellId of this.cells.i) {
      if (this.cells.good[cellId] === goodId) this.cells.good[cellId] = 0;
    }

    if (!good.distribution || !good.chance) {
      TIME && console.timeEnd("regenerateGoodPlacement");
      return;
    }

    const resourceMaxCells = Math.ceil((200 * this.cells.i.length) / 5000);
    const resources: Record<number, number> = {};
    const methods = `{${Object.keys(this.getMethods()).join(", ")}}`;
    const shuffledCells = shuffler(() => Math.random())(this.cells.i.slice());
    const spread = new Function(methods, `return ${good.distribution}`);

    for (const cellId of shuffledCells) {
      if (this.cells.biome[cellId] === 11 && biomesData.habitability[11] === 0) continue; // skip glaciers
      this.cellId = cellId;

      if (this.cells.good[cellId]) continue;
      if (resources[good.i] >= resourceMaxCells) continue;
      if (Math.random() * 100 > good.chance) continue;

      if (!spread(this.getMethods())) continue;

      this.cells.good[cellId] = good.i;
      resources[good.i] = (resources[good.i] || 0) + 1;
    }

    TIME && console.timeEnd("regenerateGoodPlacement");
  }

  restoreDefaults() {
    pack.goods = structuredClone(this.defaultGoods);
    this.sync();
  }

  getMethods(cellId: number = this.cellId) {
    return {
      random: (number: number) => number >= 100 || (number > 0 && number / 100 > Math.random()),
      nth: (number: number) => !(cellId % number),
      minHabitability: (min: number) => biomesData.habitability[pack.cells.biome[cellId]] >= min,
      habitability: () => biomesData.habitability[this.cells.biome[cellId]] > Math.random() * 100,
      elevation: () => pack.cells.h[cellId] / 100 > Math.random(),
      biome: (...biomes: number[]) => biomes.includes(pack.cells.biome[cellId]),
      minHeight: (heigh: number) => pack.cells.h[cellId] >= heigh,
      maxHeight: (heigh: number) => pack.cells.h[cellId] <= heigh,
      minTemp: (temp: number) => grid.cells.temp[pack.cells.g[cellId]] >= temp,
      maxTemp: (temp: number) => grid.cells.temp[pack.cells.g[cellId]] <= temp,
      shore: (...rings: number[]) => rings.includes(pack.cells.t[cellId]),
      type: (...types: string[]) => {
        const feature = pack.features[pack.cells.f[cellId]];
        return types.includes(feature.group || feature.type);
      },
      river: () => pack.cells.r[cellId]
    };
  }

  getBiomesProduction(): Record<number, { goodId: number; production: number }[]> {
    return pack.goods.reduce(
      (acc, good) => {
        if (!good.biomeOutput) return acc;
        for (const [biomeIdStr, production] of Object.entries(good.biomeOutput)) {
          const biomeId = +biomeIdStr;
          if (production) {
            if (!acc[biomeId]) acc[biomeId] = [];
            acc[biomeId].push({ goodId: good.i, production });
          }
        }
        return acc;
      },
      {} as Record<number, { goodId: number; production: number }[]>
    );
  }

  getStroke(colorHex: string): string {
    return (color(colorHex) as any).darker(2).hex();
  }

  get(i: number): Good | undefined {
    return this.goodById[i];
  }

  sync() {
    this.goodById = [];
    for (const good of pack.goods) this.goodById[good.i] = good;
  }

  private readonly defaultGoods = GOODS_DATA.map((good, index): Good => {
    let recipes: Good["recipes"];
    if ("recipes" in good && good.recipes) {
      recipes = good.recipes.map(recipe => {
        const entries = Object.entries(recipe).map(([key, value]) => {
          const i = GOODS_DATA.findIndex(g => g.name === key);
          if (i === -1) throw new Error(`Unknown ingredient ${key} in good ${good.name}`);
          return [i + 1, value];
        });
        return Object.fromEntries(entries);
      });
    }

    return { i: index + 1, ...good, ...(recipes && { recipes }) };
  });
}

declare global {
  var Goods: GoodsModule;
}

window.Goods = new GoodsModule();
