import Alea from "alea";
import { color, shuffler } from "d3";
import { requireColor } from "@/utils/colorUtils";
import { requireName } from "@/utils/languageUtils";
import type { IconSet } from "../types/icons";
import type { PackedGraph } from "../types/PackedGraph";
import { CULTURE_TYPES, type CultureType } from "./cultures-generator";

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

  note?: string;
}

export type ProductionRules = Partial<{
  chance: number | null;
  recipes: Record<number, number>[] | null;
  biomeOutput: Partial<Record<number, number>> | null;
  multipliers: Good["multipliers"] | null;
  demandCoverage: Good["demandCoverage"] | null;
}>;

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
    icon: "goods-wood",
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
    icon: "goods-stone",
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
    icon: "goods-marble",
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
    icon: "goods-iron",
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
    icon: "goods-copper",
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
    icon: "goods-tin",
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
    icon: "goods-silver",
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
    icon: "goods-gold",
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
    icon: "goods-grain",
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
    icon: "goods-cattle",
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
    icon: "goods-fish",
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
    icon: "goods-game",
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
    icon: "goods-wine",
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
    icon: "goods-olives",
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
    icon: "goods-honey",
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
    icon: "goods-salt",
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
    icon: "goods-dates",
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
    icon: "goods-horses",
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
    icon: "goods-elephants",
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
    icon: "goods-camels",
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
    icon: "goods-hemp",
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
    icon: "goods-pearls",
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
    icon: "goods-gemstones",
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
    icon: "goods-dyes",
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
    icon: "goods-incense",
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
    icon: "goods-silk",
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
    icon: "goods-spices",
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
    icon: "goods-amber",
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
    icon: "goods-furs",
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
    icon: "goods-sheep",
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
    icon: "goods-slaves",
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
    icon: "goods-tar",
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
    icon: "goods-saltpeter",
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
    icon: "goods-coal",
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
    icon: "goods-oil",
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
    icon: "goods-tropicalTimber",
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
    icon: "goods-whales",
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
    icon: "goods-sugar",
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
    icon: "goods-tea",
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
    icon: "goods-tobacco",
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
    icon: "goods-clay",
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
    icon: "goods-sand",
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
    icon: "goods-leather",
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
    icon: "goods-cloth",
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
    icon: "goods-garments",
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
    icon: "goods-ceramics",
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
    icon: "goods-glass",
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
    icon: "goods-ropes",
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
    icon: "goods-paper",
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
    icon: "goods-ink",
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
    icon: "goods-books",
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
    icon: "goods-sails",
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
    icon: "goods-ships",
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
    icon: "goods-boots",
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
    icon: "goods-harnesses",
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
    icon: "goods-barrels",
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
    icon: "goods-bronze",
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
    icon: "goods-tools",
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
    icon: "goods-arms",
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
    icon: "goods-gunpowder",
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
    icon: "goods-artillery",
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
    icon: "goods-coins",
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
    icon: "goods-jewelry",
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
    icon: "goods-salted-fish",
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
    icon: "goods-vinegar",
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
    icon: "goods-cheese",
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
    icon: "goods-beer",
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
    icon: "goods-liquor",
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
    icon: "goods-candles",
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
    icon: "goods-soap",
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
    icon: "goods-perfume",
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
  readonly iconSet = {
    id: "goods",
    group: "Goods",
    paint: { stroke: "#000000", strokeWidth: 2 } // the linework of the default goods style
  } as const satisfies IconSet;

  private cells!: PackedGraph["cells"];
  private cellId: number = 0;
  private goodById: Good[] = [];

  regenerate(): void {
    this.generate({ randomSeed: Math.random() });
  }

  // Place a bonus good on every eligible cell based on the current catalogue
  generate(config: { randomSeed?: number } = {}) {
    Math.random = Alea(config.randomSeed ?? options.map.seed);
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
      if (this.cells.biome[cellId] === 11 && pack.biomes[11].habitability === 0) continue; // skip glaciers
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
      if (this.cells.biome[cellId] === 11 && pack.biomes[11].habitability === 0) continue; // skip glaciers
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
      minHabitability: (min: number) => pack.biomes[pack.cells.biome[cellId]].habitability >= min,
      habitability: () => pack.biomes[this.cells.biome[cellId]].habitability > Math.random() * 100,
      elevation: () => pack.cells.h[cellId] / 100 > Math.random(),
      biome: (...biomes: number[]) => biomes.includes(pack.cells.biome[cellId]),
      minHeight: (heigh: number) => pack.cells.h[cellId] >= heigh,
      maxHeight: (heigh: number) => pack.cells.h[cellId] <= heigh,
      minTemp: (temp: number) => grid.cells.temp[pack.cells.g[cellId]] >= temp,
      maxTemp: (temp: number) => grid.cells.temp[pack.cells.g[cellId]] <= temp,
      shore: (...rings: number[]) => rings.includes(pack.cells.t[cellId]),
      type: (...types: string[]) => {
        const feature = pack.features[pack.cells.f[cellId]];
        return types.includes(feature.subtype || feature.type);
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

  /** Rename a good */
  rename(goodId: number, name: string): void {
    this.living(goodId).name = requireName(name);
  }

  /** Set a good's icon: an emoji or an icon id */
  setIcon(goodId: number, icon: string): void {
    this.living(goodId).icon = requireName(icon);
  }

  /** Set a good's color on the Goods layer */
  recolor(goodId: number, color: string): void {
    this.living(goodId).color = requireColor(color);
  }

  /** Set a good's base value per unit, in the map's currency; markets price it from this on the next economy run */
  setPrice(goodId: number, value: number): void {
    if (typeof value !== "number" || !(value >= 0 && Number.isFinite(value)))
      throw new Error("The value must be a non-negative number");
    this.living(goodId).value = value;
  }

  /** Set the unit a good is counted in, such as "barrel"; empty for none */
  setUnit(goodId: number, unit: string): void {
    if (typeof unit !== "string") throw new Error("The unit must be text");
    this.living(goodId).unit = unit.trim();
  }

  /** Set a good's tags, such as "food, luxury" */
  setTags(goodId: number, tags: string[]): void {
    if (!Array.isArray(tags) || tags.some(tag => typeof tag !== "string")) throw new Error("Tags are a list of words");
    this.living(goodId).tags = [...new Set(tags.map(tag => tag.trim().toLocaleLowerCase()).filter(Boolean))];
  }

  /** Set how a good is produced: chance (0–100), recipes ([{ goodId: amount }]), biomeOutput ({ biomeId: amount }), multipliers ({ cultureType | culture | state | religion | biome | zone: { key: factor } }), demandCoverage ({ category: share }). A key set to null clears it. Takes effect on the next economy run */
  setProduction(goodId: number, rules: ProductionRules): void {
    const good = this.living(goodId);
    if (typeof rules !== "object" || rules === null) throw new Error("The production rules must be an object");
    const nonNegative = (value: unknown, label: string) => {
      if (typeof value !== "number" || !(value >= 0 && Number.isFinite(value)))
        throw new Error(`${label} must be a non-negative number`);
    };
    const record = (value: unknown, label: string, key: (id: string) => boolean) => {
      if (typeof value !== "object" || value === null || Array.isArray(value))
        throw new Error(`${label} must be an object`);
      for (const [id, amount] of Object.entries(value)) {
        if (!key(id)) throw new Error(`${label} names an unknown ${id}`);
        nonNegative(amount, `${label} ${id}`);
      }
    };
    const isId = (id: string) => /^\d+$/.test(id); // ids of other entities; stale ones are harmless
    const next: Partial<Good> = {};
    for (const [key, value] of Object.entries(rules)) {
      if (value === null) {
        next[key as keyof ProductionRules] = undefined;
        continue;
      }
      if (key === "chance") {
        nonNegative(value, "The chance");
        if ((value as number) > 100) throw new Error("The chance must be from 0 to 100");
      } else if (key === "recipes") {
        if (!Array.isArray(value)) throw new Error("Recipes are a list of { goodId: amount }");
        for (const recipe of value) {
          record(recipe, "A recipe", id => Boolean(this.findGood(+id)));
          if (!Object.keys(recipe).length) throw new Error("Each recipe needs at least one ingredient");
          if (Object.values(recipe).some(amount => !amount)) throw new Error("Recipe amounts must be positive");
        }
      } else if (key === "biomeOutput") record(value, "The biome output", isId);
      else if (key === "demandCoverage")
        record(value, "The demand coverage", id => (DEMAND_PRIORITY as readonly string[]).includes(id));
      else if (key === "multipliers") {
        const dimensions: Record<string, (id: string) => boolean> = {
          cultureType: id => (CULTURE_TYPES as readonly string[]).includes(id),
          culture: isId,
          state: isId,
          religion: isId,
          biome: isId,
          zone: isId
        };
        if (typeof value !== "object" || Array.isArray(value)) throw new Error("Multipliers must be an object");
        for (const [dimension, factors] of Object.entries(value)) {
          if (!dimensions[dimension])
            throw new Error(`Unknown multiplier ${dimension}; known: ${Object.keys(dimensions).join(", ")}`);
          record(factors, `The ${dimension} multiplier`, dimensions[dimension]);
        }
      } else
        throw new Error(
          `Unknown production rule ${key}; known: chance, recipes, biomeOutput, multipliers, demandCoverage`
        );
      next[key as keyof ProductionRules] = structuredClone(value) as never;
    }
    for (const [key, value] of Object.entries(next)) {
      if (value === undefined) delete good[key as keyof ProductionRules];
      else Object.assign(good, { [key]: value });
    }
  }

  private findGood(goodId: number): Good | undefined {
    return pack.goods?.find(good => good.i === goodId);
  }

  private living(goodId: number): Good {
    const good = this.findGood(goodId);
    if (!good) throw new Error(`Good ${goodId} does not exist`);
    return good;
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
