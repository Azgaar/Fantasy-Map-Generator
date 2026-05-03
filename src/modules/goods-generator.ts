import Alea from "alea";
import {color, shuffler} from "d3";
import type {PackedGraph} from "../types/PackedGraph";
import {createTypedArray, TYPED_ARRAY_MAX} from "../utils";

export interface Good {
  i: number;

  // generation
  chance: number; // generation chance
  distribution?: string; // spread function string for raw goods, e.g. "biome(5, 6, 7, 8, 9)"
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
}

type BonusType = "population" | "prestige" | "defence" | "fleet" | "infantry" | "archers" | "cavalry" | "artillery";
type CultureType = "Generic" | "Hunting" | "Highland" | "River" | "Lake" | "Naval" | "Nomadic";

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
    culture: {Hunting: 2}
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
    culture: {Hunting: 0.6, Nomadic: 0.6}
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
    culture: {Highland: 2}
  },
  {
    name: "Copper",
    tags: ["ore"],
    icon: "good-copper",
    color: "#b87333",
    value: 5,
    chance: 2,
    distribution: "minHeight(60) || (minHeight(30) && elevation())",
    unit: "wagon",
    bonus: {artillery: 2, defence: 1, prestige: 1},
    culture: {Highland: 2}
  },
  {
    name: "Lead",
    tags: ["ore"],
    icon: "good-lead",
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
    bonus: {prestige: 2},
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
    bonus: {prestige: 3},
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
    culture: {River: 3, Lake: 2, Nomadic: 0.5}
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
    culture: {Nomadic: 3}
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
    culture: {River: 2, Lake: 3, Naval: 3, Nomadic: 0.5}
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
    culture: {Naval: 0.6, Nomadic: 2, Hunting: 3}
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
    culture: {Highland: 1.2, Nomadic: 0.5}
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
    culture: {Generic: 0.8, Nomadic: 0.5}
  },
  {
    name: "Honey and wax",
    tags: ["food", "fuel", "ritual"],
    icon: "good-honey",
    color: "#DCBC66",
    value: 3,
    chance: 3,
    distribution: "biome(6, 8, 9)",
    unit: "barrel",
    bonus: {population: 1},
    culture: {Hunting: 2, Highland: 2}
  },
  {
    name: "Salt",
    tags: ["preservative", "mineral"],
    icon: "good-salt",
    color: "#E5E4E5",
    value: 3,
    chance: 3,
    distribution: 'shore(1) && type("salt", "dry") || (biome(1, 2) && random(70)) || (biome(12) && nth(10))',
    unit: "bag",
    bonus: {population: 1, defence: 1},
    culture: {Naval: 1.2, Nomadic: 1.4}
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
    culture: {Hunting: 0.8, Highland: 0.8}
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
    culture: {Nomadic: 3}
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
    culture: {Nomadic: 3}
  },
  {
    name: "Hemp",
    tags: ["clothing", "naval"],
    icon: "good-hemp",
    color: "#069a06",
    value: 2,
    chance: 3,
    distribution: "biome(6, 7, 8)",
    unit: "wain",
    bonus: {fleet: 2},
    culture: {River: 2, Lake: 2, Naval: 2}
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
    culture: {Naval: 3}
  },
  {
    name: "Gemstones",
    tags: ["luxury", "mineral"],
    icon: "good-gemstones",
    color: "#e463e4",
    value: 18,
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
    value: 7,
    chance: 0.5,
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
    value: 12,
    chance: 2,
    distribution: "biome(1, 7)",
    unit: "chest",
    bonus: {prestige: 2},
    culture: {Generic: 2}
  },
  {
    name: "Silk",
    tags: ["luxury", "clothing"],
    icon: "good-silk",
    color: "#e0f0f8",
    value: 14,
    chance: 1,
    distribution: "biome(7)",
    unit: "bolt",
    bonus: {prestige: 2},
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
    bonus: {prestige: 2},
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
    value: 6,
    chance: 2,
    distribution: "biome(9) || (biome(10) && nth(2)) || (biome(6, 8) && nth(5)) || (biome(12) && nth(10))",
    unit: "pelt",
    bonus: {prestige: 1},
    culture: {Hunting: 3}
  },
  {
    name: "Wool",
    tags: ["clothing"],
    icon: "good-sheeps",
    color: "#53b574",
    value: 2,
    chance: 3,
    distribution: "(biome(3, 4) && !elevation()) || (biome(6) && random(70)) || (biome(5) && nth(5))",
    unit: "head",
    bonus: {infantry: 1},
    culture: {Naval: 2, Highland: 2}
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
    value: 2,
    chance: 3,
    distribution: "biome(5, 6, 7, 8, 9)",
    unit: "barrel",
    bonus: {fleet: 1},
    culture: {Hunting: 3}
  },
  {
    name: "Saltpeter",
    tags: ["military", "mineral"],
    icon: "good-saltpeter",
    color: "#e6e3e3",
    value: 4,
    chance: 2,
    distribution: "biome(1, 2) || (minHeight(50) && random(10))",
    unit: "barrel",
    bonus: {artillery: 3},
    culture: {Generic: 2}
  },
  {
    name: "Coal",
    tags: ["fuel"],
    icon: "good-coal",
    color: "#36454f",
    value: 2,
    chance: 3,
    distribution: "minHeight(40) || (minHeight(20) && elevation())",
    unit: "wain",
    bonus: {artillery: 2},
    culture: {Generic: 2}
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
    bonus: {artillery: 1},
    culture: {Generic: 2}
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
    culture: {Generic: 2}
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
    name: "Fine clay",
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
    recipes: [{Cattle: 1}, {Game: 2}],
    unit: "roll",
    bonus: {infantry: 1, cavalry: 1},
    culture: {Nomadic: 2, Hunting: 2}
  },
  {
    name: "Cloth",
    tags: ["clothing"],
    icon: "good-cloth",
    color: "#b55239",
    value: 5,
    chance: 0,
    recipes: [{Wool: 1}, {Hemp: 1}, {Silk: 1}],
    unit: "bolt",
    bonus: {population: 2, fleet: 1},
    culture: {Generic: 1.5}
  }
] satisfies (Omit<Good, "i" | "cells"> & {recipes?: Record<string, number>[]})[];

export class GoodsModule {
  private cells!: PackedGraph["cells"];
  private cellId: number = 0;

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

  private readonly defaultGoods = GOODS_DATA.map((good, index): Good => {
    let recipes: Good["recipes"];
    if ("recipes" in good && good.recipes) {
      recipes = good.recipes.map(recipe => {
        const entries = Object.entries(recipe).map(([key, value]) => {
          const i = GOODS_DATA.findIndex(g => g.name === key);
          return [i, value];
        });
        return Object.fromEntries(entries);
      });
    }

    return {...good, i: index, cells: 0, ...recipes};
  });

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
