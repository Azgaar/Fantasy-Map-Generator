import Alea from "alea";
import {color, shuffler} from "d3";
import type {PackedGraph} from "../types/PackedGraph";
import {createTypedArray, TYPED_ARRAY_MAX} from "../utils";
import type {CultureType} from "./cultures-generator";

export interface Good {
  i: number;

  // generation
  chance: number; // generation chance
  distribution?: string; // spread function string for raw goods, e.g. "biome(5, 6, 7, 8, 9)"
  biome?: Partial<Record<number, number>>; // baseline production per biome id (units per biome cell), e.g. {6: 0.5, 7: 0.5}
  recipes?: Record<number, number>[]; // good id and required amount to produce 1 unit of this good; presence marks a manufactured good
  culture: Partial<Record<CultureType, number>>; // modifier to production based on culture, e.g. {Nomadic: 2} means that nomadic cultures produce twice as much of this good

  // lore
  name: string;
  tags: string[];
  value: number; // price per unit
  unit: string; // e.g. "wagon", "barrel", "head"

  // effects
  bonus: Partial<Record<BonusType, number>>; // e.g. {population: 2} means that this good gives population +2 if is produced in a cell

  // ui
  icon: string;
  color: string;
  stroke?: string;

  // editor state
  cells?: number;
  pinned?: boolean;

  // post-simulation market prices (set by ProductionModule.produce())
  buyPrice?: number; // current buy price of raw ingredients (rises with extraction)
  sellPrice?: number; // current sell price of manufactured output (falls with supply)
}

type BonusType = "population" | "prestige" | "defence" | "fleet" | "infantry" | "archers" | "cavalry" | "artillery";

const GOODS_DATA = [
  {
    name: "Wood",
    tags: ["construction", "fuel"],
    icon: "good-wood",
    color: "#966F33",
    value: 1,
    chance: 4,
    distribution: "biome(5, 6, 7, 8, 9)",
    unit: "pile",
    bonus: {fleet: 2, defence: 1},
    culture: {Hunting: 2},
    biome: {3: 0.5, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 12: 1}
  },
  {
    name: "Stone",
    tags: ["construction"],
    icon: "good-stone",
    color: "#979EA2",
    value: 2,
    chance: 4,
    distribution: "minHeight(40) || (minHeight(20) && elevation())",
    unit: "pallet",
    bonus: {defence: 2},
    culture: {Hunting: 0.6, Nomadic: 0.6},
    biome: {1: 1, 2: 1}
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
    bonus: {prestige: 2},
    culture: {Highland: 2}
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
    bonus: {artillery: 1, infantry: 1, defence: 1},
    culture: {Highland: 2},
    biome: {12: 1}
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
    bonus: {artillery: 2, defence: 1, prestige: 1},
    culture: {Highland: 2}
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
    bonus: {artillery: 1, defence: 1},
    culture: {Highland: 2}
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
    bonus: {prestige: 1},
    culture: {Hunting: 0.5, Highland: 2, Nomadic: 0.5}
  },
  {
    name: "Gold",
    tags: ["ore", "luxury"],
    icon: "good-gold",
    color: "#d4af37",
    value: 15,
    chance: 2,
    distribution: "river() && minHeight(40)",
    unit: "bullion",
    bonus: {prestige: 2},
    culture: {Highland: 2, Nomadic: 0.5}
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
    bonus: {population: 4},
    culture: {River: 2, Lake: 2, Nomadic: 0.5},
    biome: {5: 1, 6: 1, 7: 1, 8: 1}
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
    bonus: {population: 2},
    culture: {Nomadic: 3},
    biome: {3: 1, 4: 1}
  },
  {
    name: "Fish",
    tags: ["food", "aquatic"],
    icon: "good-fish",
    color: "#7fcdff",
    value: 1,
    chance: 2,
    distribution: 'shore(-1) && (type("ocean", "freshwater", "salt") || (river() && shore(1, 2)))',
    unit: "wain",
    bonus: {population: 2},
    culture: {River: 2, Lake: 2, Naval: 2, Nomadic: 0.2},
    biome: {0: 1}
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
    bonus: {archers: 2, population: 1},
    culture: {Naval: 0.6, Nomadic: 2, Hunting: 3},
    biome: {3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1}
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
    bonus: {population: 1, prestige: 1},
    culture: {Highland: 1.2, Nomadic: 0.5},
    biome: {6: 1}
  },
  {
    name: "Olives",
    tags: ["food"],
    icon: "good-olives",
    color: "#BDBD7D",
    value: 2,
    chance: 3,
    distribution: "biome(6) || (biome(4) && random(50) && river())",
    unit: "barrel",
    bonus: {population: 1},
    culture: {Generic: 0.8, Nomadic: 0.5},
    biome: {6: 1}
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
    bonus: {population: 1},
    culture: {Hunting: 2, Highland: 2},
    biome: {6: 1, 8: 1, 9: 1}
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
    bonus: {population: 1, defence: 1},
    culture: {Naval: 1.2, Nomadic: 1.4},
    biome: {1: 1, 2: 1}
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
    bonus: {population: 1},
    culture: {Hunting: 0.8, Highland: 0.8},
    biome: {1: 1}
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
    bonus: {cavalry: 2},
    culture: {Nomadic: 3},
    biome: {4: 0.5}
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
    bonus: {cavalry: 1},
    culture: {Nomadic: 1.2, Highland: 0.5}
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
    bonus: {cavalry: 1},
    culture: {Nomadic: 3},
    biome: {1: 1, 2: 1}
  },
  {
    name: "Hemp",
    tags: ["clothing", "naval"],
    icon: "good-hemp",
    color: "#069a06",
    value: 1,
    chance: 4,
    distribution: "biome(6, 7, 8)",
    unit: "wain",
    bonus: {fleet: 2},
    culture: {River: 2, Lake: 2, Naval: 2},
    biome: {6: 1, 7: 1, 8: 1}
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
    bonus: {prestige: 1},
    culture: {Naval: 2}
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
    bonus: {prestige: 1},
    culture: {Generic: 2}
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
    bonus: {prestige: 1},
    culture: {Generic: 2}
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
    bonus: {prestige: 1},
    culture: {Generic: 2}
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
    bonus: {prestige: 1},
    culture: {River: 1.2, Lake: 1.2}
  },
  {
    name: "Spices",
    tags: ["luxury"],
    icon: "good-spices",
    color: "#e99c75",
    value: 14,
    chance: 2,
    distribution: "biome(7)",
    unit: "chest",
    bonus: {prestige: 1},
    culture: {Generic: 2}
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
    bonus: {prestige: 1},
    culture: {Generic: 2}
  },
  {
    name: "Furs",
    tags: ["clothing", "luxury"],
    icon: "good-furs",
    color: "#8a5e51",
    value: 5,
    chance: 2,
    distribution: "biome(9) || (biome(10) && nth(2)) || (biome(6, 8) && nth(5)) || (biome(12) && nth(10))",
    unit: "pelt",
    bonus: {prestige: 1},
    culture: {Hunting: 3},
    biome: {9: 1, 10: 1, 6: 0.5, 8: 0.5, 12: 0.5}
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
    bonus: {infantry: 1},
    culture: {Naval: 2, Highland: 2},
    biome: {4: 1}
  },
  {
    name: "Slaves",
    tags: ["supply"],
    icon: "good-slaves",
    color: "#757575",
    value: 5,
    chance: 2,
    distribution: "shore(1) && minHabitability(1) && !habitability()",
    unit: "slave",
    bonus: {population: 2},
    culture: {Naval: 2, Nomadic: 3, Hunting: 0.6, Highland: 0.4}
  },
  {
    name: "Tar",
    tags: ["naval"],
    icon: "good-tar",
    color: "#727272",
    value: 3,
    chance: 0,
    unit: "barrel",
    bonus: {fleet: 1},
    culture: {Hunting: 1.5},
    recipes: [{Wood: 1}]
  },
  {
    name: "Saltpeter",
    tags: ["military", "mineral"],
    icon: "good-saltpeter",
    color: "#e6e3e3",
    value: 2,
    chance: 2,
    distribution: "biome(1, 2) || (minHeight(50) && random(10))",
    unit: "barrel",
    bonus: {artillery: 3},
    culture: {Generic: 1.5}
  },
  {
    name: "Coal",
    tags: ["fuel"],
    icon: "good-coal",
    color: "#36454f",
    value: 3,
    chance: 3,
    distribution: "minHeight(40) || (minHeight(20) && elevation())",
    unit: "wain",
    bonus: {artillery: 2},
    culture: {Generic: 2},
    recipes: [{Wood: 1.5}, {"Tropical timber": 1}]
  },
  {
    name: "Oil",
    tags: ["fuel"],
    icon: "good-oil",
    color: "#565656",
    value: 4,
    chance: 2,
    distribution: "biome(1, 2, 10) || (shore(-1) && minTemp(18) && random(15))",
    unit: "barrel",
    bonus: {artillery: 1},
    culture: {Generic: 2},
    recipes: [{Olives: 1}, {Hemp: 1}, {Whales: 1}]
  },
  {
    name: "Tropical timber",
    tags: ["luxury"],
    icon: "good-tropicalTimber",
    color: "#a45a52",
    value: 8,
    chance: 2,
    distribution: "biome(5, 7)",
    unit: "pile",
    bonus: {prestige: 1},
    culture: {Generic: 2},
    biome: {5: 1, 7: 1}
  },
  {
    name: "Whales",
    tags: ["food", "aquatic", "fuel"],
    icon: "good-whales",
    color: "#cccccc",
    value: 2,
    chance: 3,
    distribution: "biome(0) && type('ocean') && maxTemp(7)",
    unit: "barrel",
    bonus: {population: 1},
    culture: {Naval: 2}
  },
  {
    name: "Sugar",
    tags: ["preservative", "food"],
    icon: "good-sugar",
    color: "#7abf87",
    value: 4,
    chance: 3,
    distribution: "biome(7)",
    unit: "bag",
    bonus: {population: 1},
    culture: {Lake: 2, River: 2}
  },
  {
    name: "Tea",
    tags: ["luxury"],
    icon: "good-tea",
    color: "#d0f0c0",
    value: 5,
    chance: 3,
    distribution: "minHeight(40) && biome(7)",
    unit: "bag",
    bonus: {prestige: 1},
    culture: {Lake: 2, River: 2, Highland: 2}
  },
  {
    name: "Tobacco",
    tags: ["luxury"],
    icon: "good-tobacco",
    color: "#6D5843",
    value: 5,
    chance: 2,
    distribution: "biome(7)",
    unit: "bag",
    bonus: {prestige: 1},
    culture: {Lake: 2, River: 2}
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
    bonus: {defence: 1},
    culture: {River: 2, Lake: 2}
  },
  {
    name: "White sand",
    tags: ["mineral"],
    icon: "good-sand",
    color: "#e6d69c",
    value: 1,
    chance: 5,
    distribution: "minTemp(8) && (shore(1) || river())",
    unit: "wain",
    bonus: {},
    culture: {River: 2, Lake: 2}
  },
  {
    name: "Leather",
    tags: ["clothing", "military"],
    icon: "good-leather",
    color: "#8b5a2b",
    value: 4,
    chance: 0,
    recipes: [{Cattle: 1}, {Game: 1}, {Horses: 1}, {Camels: 1}],
    unit: "roll",
    bonus: {infantry: 1, cavalry: 1},
    culture: {Naval: 0.6, Hunting: 2}
  },
  {
    name: "Cloth",
    tags: ["clothing"],
    icon: "good-cloth",
    color: "#b55239",
    value: 6,
    chance: 0,
    recipes: [{Sheep: 1}, {Hemp: 1}, {Silk: 0.25}],
    unit: "bolt",
    bonus: {population: 2, fleet: 1},
    culture: {Generic: 2}
  },
  {
    name: "Garments",
    tags: ["clothing"],
    icon: "good-garments",
    color: "#bd21ec",
    value: 13,
    chance: 0,
    recipes: [{Cloth: 1, Dyes: 0.5}, {Furs: 1}],
    unit: "set",
    bonus: {prestige: 2},
    culture: {Generic: 2}
  },
  {
    name: "Ceramics",
    tags: ["storage", "construction"],
    icon: "good-pottery",
    color: "#c1440e",
    value: 4,
    chance: 0,
    recipes: [
      {Clay: 0.5, Coal: 0.5},
      {Clay: 0.5, Wood: 1}
    ],
    unit: "wain",
    bonus: {population: 1},
    culture: {River: 2, Lake: 2}
  },
  {
    name: "Glass",
    tags: ["storage", "construction"],
    icon: "good-glass",
    color: "#a0c8e8",
    value: 5,
    chance: 0,
    recipes: [{"White sand": 0.5, Coal: 0.5}],
    unit: "wain",
    bonus: {prestige: 1},
    culture: {River: 2, Lake: 2, Nomadic: 0.1}
  },
  {
    name: "Ropes",
    tags: ["naval", "construction"],
    icon: "good-ropes",
    color: "#654321",
    value: 4,
    chance: 0,
    recipes: [{Hemp: 1}],
    unit: "coil",
    bonus: {fleet: 2},
    culture: {Naval: 2}
  },
  {
    name: "Paper",
    tags: ["ritual", "educational"],
    icon: "good-paper",
    color: "#f5f5dc",
    value: 4,
    chance: 0,
    recipes: [{Hemp: 1}],
    unit: "ream",
    bonus: {prestige: 2},
    culture: {River: 2, Nomadic: 0.1, Hunting: 0.5}
  },
  {
    name: "Ink",
    tags: ["ritual", "educational"],
    icon: "good-ink",
    color: "#000000",
    value: 6,
    chance: 0,
    recipes: [{Oil: 1}, {Dyes: 0.5}],
    unit: "bottle",
    bonus: {prestige: 1},
    culture: {River: 2, Nomadic: 0.1, Hunting: 0.5}
  },
  {
    name: "Books",
    tags: ["ritual", "educational"],
    icon: "good-books",
    color: "#deb887",
    value: 18,
    chance: 0,
    recipes: [
      {Paper: 1, Ink: 0.5},
      {Leather: 1, Ink: 0.5}
    ],
    unit: "volume",
    bonus: {prestige: 3},
    culture: {Nomadic: 0.1, Hunting: 0.5}
  },
  {
    name: "Sails",
    tags: ["naval"],
    icon: "good-sails",
    color: "#ffffff",
    value: 12,
    chance: 0,
    recipes: [{Cloth: 1}],
    unit: "set",
    bonus: {fleet: 2},
    culture: {Naval: 2}
  },
  {
    name: "Ships",
    tags: ["naval"],
    icon: "good-ships",
    color: "#654321",
    value: 42,
    chance: 0,
    recipes: [{Wood: 2, Sails: 1, Ropes: 1, Tar: 1}],
    unit: "ship",
    bonus: {fleet: 4},
    culture: {Naval: 2}
  },
  {
    name: "Boots",
    tags: ["clothing", "military"],
    icon: "good-boots",
    color: "#654321",
    value: 6,
    chance: 0,
    recipes: [{Leather: 1}, {Furs: 0.5}],
    unit: "pair",
    bonus: {infantry: 1, cavalry: 1},
    culture: {Naval: 0.6, Hunting: 2}
  },
  {
    name: "Harnesses",
    tags: ["military"],
    icon: "good-harnesses",
    color: "#654321",
    value: 8,
    chance: 0,
    recipes: [
      {Leather: 1, Iron: 0.25},
      {Leather: 1, Bronze: 0.25},
      {Leather: 1, Copper: 0.25}
    ],
    unit: "set",
    bonus: {cavalry: 2},
    culture: {Nomadic: 2}
  },
  {
    name: "Barrels",
    tags: ["naval", "storage"],
    icon: "good-barrels",
    color: "#6b3d1b",
    value: 3,
    chance: 0,
    recipes: [{Wood: 1}],
    unit: "barrel",
    bonus: {fleet: 1, population: 1},
    culture: {Naval: 1.5}
  },
  {
    name: "Bronze",
    tags: ["military"],
    icon: "good-bronze",
    color: "#e46f21",
    value: 9,
    chance: 0,
    recipes: [
      {Copper: 0.5, Coal: 1},
      {Tin: 0.5, Coal: 1}
    ],
    unit: "wagon",
    bonus: {infantry: 1, cavalry: 1, defence: 1, artillery: 1},
    culture: {Highland: 2}
  },
  {
    name: "Tools",
    tags: ["construction", "military"],
    icon: "good-tools",
    color: "#808080",
    value: 17,
    chance: 0,
    recipes: [
      {Iron: 1, Coal: 2},
      {Bronze: 1, Coal: 1}
    ],
    unit: "set",
    bonus: {defence: 1, infantry: 1, cavalry: 1, artillery: 1},
    culture: {Highland: 2, Nomadic: 0.5}
  },
  {
    name: "Arms",
    tags: ["military"],
    icon: "good-weapons",
    color: "#333333",
    value: 24,
    chance: 0,
    recipes: [
      {Iron: 1, Coal: 2, Leather: 1},
      {Bronze: 1, Coal: 1, Leather: 1}
    ],
    unit: "set",
    bonus: {infantry: 2, cavalry: 2, artillery: 2, defence: 2},
    culture: {Nomadic: 0.5, Naval: 0.5}
  },
  {
    name: "Gunpowder",
    tags: ["military"],
    icon: "good-gunpowder",
    color: "#4b5320",
    value: 10,
    chance: 0,
    recipes: [{Saltpeter: 1, Coal: 1}],
    unit: "barrel",
    bonus: {artillery: 3},
    culture: {Highland: 2, Nomadic: 0.2}
  },
  {
    name: "Artillery",
    tags: ["military"],
    icon: "good-artillery",
    color: "#2f4f4f",
    value: 24,
    chance: 0,
    recipes: [
      {Iron: 2, Coal: 1},
      {Bronze: 1, Coal: 1}
    ],
    unit: "cannon",
    bonus: {artillery: 5},
    culture: {Highland: 2, Nomadic: 0.2}
  },
  {
    name: "Coins",
    tags: ["currency"],
    icon: "good-coins",
    color: "#ffd700",
    value: 25,
    chance: 0,
    recipes: [
      {Gold: 0.5, Coal: 1},
      {Silver: 1, Coal: 1}
    ],
    unit: "bag",
    bonus: {prestige: 2},
    culture: {Generic: 2}
  },
  {
    name: "Jewelry",
    tags: ["luxury"],
    icon: "good-jewelry",
    color: "#e0115f",
    value: 40,
    chance: 0,
    recipes: [
      {Gemstones: 1, Gold: 0.5},
      {Pearls: 1, Gold: 0.5},
      {Amber: 2, Gold: 0.5},
      {Gemstones: 1, Silver: 1},
      {Pearls: 1, Silver: 1},
      {Amber: 2, Silver: 1}
    ],
    unit: "piece",
    bonus: {prestige: 2},
    culture: {Generic: 2}
  },
  {
    name: "Preserved food",
    tags: ["food"],
    icon: "good-salted-fish",
    color: "#c2b280",
    value: 6,
    chance: 0,
    recipes: [
      {Fish: 1, Salt: 1},
      {Cattle: 1, Salt: 1},
      {Game: 1, Salt: 1},
      {Sheep: 1, Salt: 1},
      {Fish: 1, Vinegar: 0.5},
      {Cattle: 1, Vinegar: 0.5},
      {Game: 1, Vinegar: 0.5},
      {Sheep: 1, Vinegar: 0.5},
      {Fish: 1, Wood: 1}
    ],
    unit: "wain",
    bonus: {population: 1, fleet: 1},
    culture: {River: 2, Lake: 2, Naval: 2}
  },
  {
    name: "Vinegar",
    tags: ["food", "preservative"],
    icon: "good-vinegar",
    color: "#9b111e",
    value: 4,
    chance: 0,
    recipes: [{Wine: 1}, {Honey: 1}],
    unit: "barrel",
    bonus: {population: 1},
    culture: {Generic: 2}
  },
  {
    name: "Cheese",
    tags: ["food"],
    icon: "good-cheese",
    color: "#f5e1a4",
    value: 4,
    chance: 0,
    recipes: [
      {Cattle: 0.5, Salt: 0.25},
      {Sheep: 0.5, Salt: 0.25},
      {Sheep: 0.5, Vinegar: 0.25},
      {Cattle: 0.5, Vinegar: 0.25}
    ],
    unit: "wain",
    bonus: {population: 1},
    culture: {Generic: 2}
  },
  {
    name: "Beer",
    tags: ["food"],
    icon: "good-beer",
    color: "#fbb117",
    value: 7,
    chance: 0,
    recipes: [
      {Grain: 1, Barrels: 1},
      {Honey: 0.5, Barrels: 1}
    ],
    unit: "barrel",
    bonus: {population: 1},
    culture: {Generic: 2}
  },
  {
    name: "Liquor",
    tags: ["food", "luxury"],
    icon: "good-liquor",
    color: "#8a0303",
    value: 9,
    chance: 0,
    recipes: [
      {Grain: 2, Wood: 1, Barrels: 0.5},
      {Wine: 1, Wood: 1, Barrels: 0.5},
      {Grain: 2, Wood: 1, Ceramics: 0.5},
      {Wine: 1, Wood: 1, Ceramics: 0.5},
      {Grain: 2, Wood: 1, Glass: 0.5},
      {Wine: 1, Wood: 1, Glass: 0.5}
    ],
    unit: "vessel",
    bonus: {prestige: 2},
    culture: {Generic: 2}
  },
  {
    name: "Candles",
    tags: ["luxury", "ritual"],
    icon: "good-candles",
    color: "#fffacd",
    value: 8,
    chance: 0,
    recipes: [
      {Honey: 1, Hemp: 1},
      {Oil: 1, Hemp: 1}
    ],
    unit: "block",
    bonus: {prestige: 1},
    culture: {Generic: 2}
  },
  {
    name: "Soap",
    tags: ["luxury", "ritual"],
    icon: "good-soap",
    color: "#e0e4cc",
    value: 8,
    chance: 0,
    recipes: [
      {Olives: 1, Wood: 1},
      {Cattle: 1, Wood: 1}
    ],
    unit: "barrel",
    bonus: {prestige: 1},
    culture: {Generic: 2}
  },
  {
    name: "Perfume",
    tags: ["luxury", "ritual"],
    icon: "good-perfume",
    color: "#ff69b4",
    value: 16,
    chance: 0,
    recipes: [
      {Olives: 1, Incense: 0.25, Glass: 1},
      {Olives: 1, Game: 1, Glass: 1},
      {Liquor: 0.25, Incense: 0.25, Whales: 0.5, Ceramics: 1}
    ],
    unit: "bottle",
    bonus: {prestige: 2},
    culture: {Generic: 2}
  }
] satisfies (Omit<Good, "i" | "cells"> & {
  recipes?: Record<string, number>[];
})[];

export class GoodsModule {
  private cells!: PackedGraph["cells"];
  private cellId: number = 0;

  private readonly defaultGoods = GOODS_DATA.map((good, index): Good => {
    let recipes: Good["recipes"];
    if ("recipes" in good && good.recipes) {
      recipes = good.recipes.map(recipe => {
        const entries = Object.entries(recipe).map(([key, value]) => {
          const i = GOODS_DATA.findIndex(g => g.name === key);
          if (i === -1) throw new Error(`Unknown ingredient ${key} in good ${good.name}`);
          return [i, value];
        });
        return Object.fromEntries(entries);
      });
    }

    return {
      i: index,
      ...good,
      ...(recipes && {recipes}),
      cells: 0
    };
  });

  private methods = {
    random: (number: number) => number >= 100 || (number > 0 && number / 100 > Math.random()),
    nth: (number: number) => !(this.cellId % number),
    minHabitability: (min: number) => biomesData.habitability[pack.cells.biome[this.cellId]] >= min,
    habitability: () => biomesData.habitability[this.cells.biome[this.cellId]] > Math.random() * 100,
    elevation: () => pack.cells.h[this.cellId] / 100 > Math.random(),
    biome: (...biomes: number[]) => biomes.includes(pack.cells.biome[this.cellId]),
    minHeight: (heigh: number) => pack.cells.h[this.cellId] >= heigh,
    maxHeight: (heigh: number) => pack.cells.h[this.cellId] <= heigh,
    minTemp: (temp: number) => grid.cells.temp[pack.cells.g[this.cellId]] >= temp,
    maxTemp: (temp: number) => grid.cells.temp[pack.cells.g[this.cellId]] <= temp,
    shore: (...rings: number[]) => rings.includes(pack.cells.t[this.cellId]),
    type: (...types: string[]) => {
      const feature = pack.features[this.cells.f[this.cellId]];
      return types.includes(feature.group || feature.type);
    },
    river: () => pack.cells.r[this.cellId]
  };

  generate(regenerate: boolean = false) {
    TIME && console.time("generateGoods");
    Math.random = Alea(seed);
    const shuffle = shuffler(() => Math.random());

    this.cells = pack.cells;
    this.cells.good = createTypedArray({
      maxValue: TYPED_ARRAY_MAX.UINT16,
      length: this.cells.i.length
    });
    if (!pack.goods || regenerate) {
      pack.goods = this.defaultGoods;
    }

    const resourceMaxCells = Math.ceil((200 * this.cells.i.length) / 5000);
    const methods = `{${Object.keys(this.methods).join(", ")}}`;
    const shuffledCells = shuffle(this.cells.i.slice());

    for (const cellId of shuffledCells) {
      if (!(cellId % 10)) shuffle(pack.goods);
      if (this.cells.biome[cellId] === 11 && biomesData.habitability[11] === 0) continue; // skip glaciers
      const rnd = Math.random() * 100;
      this.cellId = cellId;

      for (const good of pack.goods) {
        if (good.recipes || !good.distribution) continue;
        if (good.cells! >= resourceMaxCells) continue;
        if (good.cells ? rnd > good.chance : Math.random() * 100 > good.chance) continue;

        const spread = new Function(methods, `return ${good.distribution}`);
        if (!spread(this.methods)) continue;

        this.cells.good[cellId] = good.i;
        good.cells!++;
        break;
      }
    }

    TIME && console.timeEnd("generateGoods");
  }

  getStroke(colorHex: string): string {
    return (color(colorHex) as any).darker(2).hex();
  }

  get(i: number): Good | undefined {
    return pack.goods.find((resource: Good) => resource.i === i);
  }
}

declare global {
  var Goods: GoodsModule;
}

window.Goods = new GoodsModule();
