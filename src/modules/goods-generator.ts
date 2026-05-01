import * as d3 from "d3";

declare global {
  var Goods: GoodsModule;
}

export interface Good {
  i: number;
  name: string;
  category: string;
  icon: string;
  color: string;
  value: number;
  chance: number;
  model: string;
  unit: string;
  bonus: Record<string, number>;
  culture: Record<string, number>;
  cells?: number;
  custom?: string;
  fn?: (methods: any) => boolean;
  pinned?: boolean;
  stroke?: string;
}

export class GoodsModule {
  private cells: any;
  private cellId: number = 0;

  private defaultGoods: Good[] = [
    {
      i: 1,
      name: "Wood",
      category: "Construction",
      icon: "good-wood",
      color: "#966F33",
      value: 2,
      chance: 4,
      model: "Any_forest",
      unit: "pile",
      bonus: {fleet: 2, defence: 1},
      culture: {Hunting: 2}
    },
    {
      i: 2,
      name: "Stone",
      category: "Construction",
      icon: "good-stone",
      color: "#979EA2",
      value: 2,
      chance: 4,
      model: "Hills",
      unit: "pallet",
      bonus: {prestige: 1, defence: 2},
      culture: {Hunting: 0.6, Nomadic: 0.6}
    },
    {
      i: 3,
      name: "Marble",
      category: "Construction",
      icon: "good-marble",
      color: "#d6d0bf",
      value: 7,
      chance: 1,
      model: "Mountains",
      unit: "pallet",
      bonus: {prestige: 2},
      culture: {Highland: 2}
    },
    {
      i: 4,
      name: "Iron",
      category: "Ore",
      icon: "good-iron",
      color: "#5D686E",
      value: 4,
      chance: 4,
      model: "Mountains_and_wetlands",
      unit: "wagon",
      bonus: {artillery: 1, infantry: 1, defence: 1},
      culture: {Highland: 2}
    },
    {
      i: 5,
      name: "Copper",
      category: "Ore",
      icon: "good-copper",
      color: "#b87333",
      value: 5,
      chance: 3,
      model: "Mountains",
      unit: "wagon",
      bonus: {artillery: 2, defence: 1, prestige: 1},
      culture: {Highland: 2}
    },
    {
      i: 6,
      name: "Lead",
      category: "Ore",
      icon: "good-lead",
      color: "#454343",
      value: 4,
      chance: 3,
      model: "Mountains",
      unit: "wagon",
      bonus: {artillery: 1, defence: 1},
      culture: {Highland: 2}
    },
    {
      i: 7,
      name: "Silver",
      category: "Ore",
      icon: "good-silver",
      color: "#C0C0C0",
      value: 8,
      chance: 3,
      model: "Mountains",
      unit: "bullion",
      bonus: {prestige: 2},
      culture: {Hunting: 0.5, Highland: 2, Nomadic: 0.5}
    },
    {
      i: 8,
      name: "Gold",
      category: "Ore",
      icon: "good-gold",
      color: "#d4af37",
      value: 15,
      chance: 1,
      model: "Headwaters",
      unit: "bullion",
      bonus: {prestige: 3},
      culture: {Highland: 2, Nomadic: 0.5}
    },
    {
      i: 9,
      name: "Grain",
      category: "Food",
      icon: "good-grain",
      color: "#F5DEB3",
      value: 1,
      chance: 4,
      model: "More_habitable",
      unit: "wain",
      bonus: {population: 4},
      culture: {River: 3, Lake: 2, Nomadic: 0.5}
    },
    {
      i: 10,
      name: "Cattle",
      category: "Food",
      icon: "good-cattle",
      color: "#56b000",
      value: 2,
      chance: 4,
      model: "Pastures_and_temperate_forest",
      unit: "head",
      bonus: {population: 2},
      culture: {Nomadic: 3}
    },
    {
      i: 11,
      name: "Fish",
      category: "Food",
      icon: "good-fish",
      color: "#7fcdff",
      value: 1,
      chance: 2,
      model: "Marine_and_rivers",
      unit: "wain",
      bonus: {population: 2},
      culture: {River: 2, Lake: 3, Naval: 3, Nomadic: 0.5}
    },
    {
      i: 12,
      name: "Game",
      category: "Food",
      icon: "good-game",
      color: "#c38a8a",
      value: 2,
      chance: 3,
      model: "Any_forest",
      unit: "wain",
      bonus: {archers: 2, population: 1},
      culture: {Naval: 0.6, Nomadic: 2, Hunting: 3}
    },
    {
      i: 13,
      name: "Wine",
      category: "Food",
      icon: "good-wine",
      color: "#963e48",
      value: 2,
      chance: 3,
      model: "Tropical_forests",
      unit: "barrel",
      bonus: {population: 1, prestige: 1},
      culture: {Highland: 1.2, Nomadic: 0.5}
    },
    {
      i: 14,
      name: "Olives",
      category: "Food",
      icon: "good-olives",
      color: "#BDBD7D",
      value: 2,
      chance: 3,
      model: "Tropical_forests",
      unit: "barrel",
      bonus: {population: 1},
      culture: {Generic: 0.8, Nomadic: 0.5}
    },
    {
      i: 15,
      name: "Honey",
      category: "Preservative",
      icon: "good-honey",
      color: "#DCBC66",
      value: 2,
      chance: 3,
      model: "Temperate_and_boreal_forests",
      unit: "barrel",
      bonus: {population: 1},
      culture: {Hunting: 2, Highland: 2}
    },
    {
      i: 16,
      name: "Salt",
      category: "Preservative",
      icon: "good-salt",
      color: "#E5E4E5",
      value: 3,
      chance: 3,
      model: "Arid_land_and_salt_lakes",
      unit: "bag",
      bonus: {population: 1, defence: 1},
      culture: {Naval: 1.2, Nomadic: 1.4}
    },
    {
      i: 17,
      name: "Dates",
      category: "Food",
      icon: "good-dates",
      color: "#dbb2a3",
      value: 2,
      chance: 2,
      model: "Hot_desert",
      unit: "wain",
      bonus: {population: 1},
      culture: {Hunting: 0.8, Highland: 0.8}
    },
    {
      i: 18,
      name: "Horses",
      category: "Supply",
      icon: "good-horses",
      color: "#ba7447",
      value: 5,
      chance: 4,
      model: "Grassland_and_cold_desert",
      unit: "head",
      bonus: {cavalry: 2},
      culture: {Nomadic: 3}
    },
    {
      i: 19,
      name: "Elephants",
      category: "Supply",
      icon: "good-elephants",
      color: "#C5CACD",
      value: 7,
      chance: 2,
      model: "Hot_biomes",
      unit: "head",
      bonus: {cavalry: 1},
      culture: {Nomadic: 1.2, Highland: 0.5}
    },
    {
      i: 20,
      name: "Camels",
      category: "Supply",
      icon: "good-camels",
      color: "#C19A6B",
      value: 7,
      chance: 3,
      model: "Deserts",
      unit: "head",
      bonus: {cavalry: 1},
      culture: {Nomadic: 3}
    },
    {
      i: 21,
      name: "Hemp",
      category: "Material",
      icon: "good-hemp",
      color: "#069a06",
      value: 2,
      chance: 3,
      model: "Deciduous_forests",
      unit: "wain",
      bonus: {fleet: 2},
      culture: {River: 2, Lake: 2, Naval: 2}
    },
    {
      i: 22,
      name: "Pearls",
      category: "Luxury",
      icon: "good-pearls",
      color: "#EAE0C8",
      value: 16,
      chance: 2,
      model: "Tropical_waters",
      unit: "pearl",
      bonus: {prestige: 1},
      culture: {Naval: 3}
    },
    {
      i: 23,
      name: "Gemstones",
      category: "Luxury",
      icon: "good-gemstones",
      color: "#e463e4",
      value: 17,
      chance: 2,
      model: "Mountains",
      unit: "stone",
      bonus: {prestige: 1},
      culture: {Naval: 2}
    },
    {
      i: 24,
      name: "Dyes",
      category: "Luxury",
      icon: "good-dyes",
      color: "#fecdea",
      value: 6,
      chance: 0.5,
      model: "Habitable_biome_or_marine",
      unit: "bag",
      bonus: {prestige: 1},
      culture: {Generic: 2}
    },
    {
      i: 25,
      name: "Incense",
      category: "Luxury",
      icon: "good-incense",
      color: "#ebe5a7",
      value: 12,
      chance: 2,
      model: "Hot_desert_and_tropical_forest",
      unit: "chest",
      bonus: {prestige: 2},
      culture: {Generic: 2}
    },
    {
      i: 26,
      name: "Silk",
      category: "Luxury",
      icon: "good-silk",
      color: "#e0f0f8",
      value: 15,
      chance: 1,
      model: "Tropical_rainforest",
      unit: "bolt",
      bonus: {prestige: 2},
      culture: {River: 1.2, Lake: 1.2}
    },
    {
      i: 27,
      name: "Spices",
      category: "Luxury",
      icon: "good-spices",
      color: "#e99c75",
      value: 15,
      chance: 2,
      model: "Tropical_rainforest",
      unit: "chest",
      bonus: {prestige: 2},
      culture: {Generic: 2}
    },
    {
      i: 28,
      name: "Amber",
      category: "Luxury",
      icon: "good-amber",
      color: "#e68200",
      value: 7,
      chance: 2,
      model: "Foresty_seashore",
      unit: "stone",
      bonus: {prestige: 1},
      culture: {Generic: 2}
    },
    {
      i: 29,
      name: "Furs",
      category: "Material",
      icon: "good-furs",
      color: "#8a5e51",
      value: 6,
      chance: 2,
      model: "Boreal_forests",
      unit: "pelt",
      bonus: {prestige: 1},
      culture: {Hunting: 3}
    },
    {
      i: 30,
      name: "Sheep",
      category: "Material",
      icon: "good-sheeps",
      color: "#53b574",
      value: 2,
      chance: 3,
      model: "Pastures_and_temperate_forest",
      unit: "head",
      bonus: {infantry: 1},
      culture: {Naval: 2, Highland: 2}
    },
    {
      i: 31,
      name: "Slaves",
      category: "Supply",
      icon: "good-slaves",
      color: "#757575",
      value: 5,
      chance: 2,
      model: "Less_habitable_seashore",
      unit: "slave",
      bonus: {population: 2},
      culture: {Naval: 2, Nomadic: 3, Hunting: 0.6, Highland: 0.4}
    },
    {
      i: 32,
      name: "Tar",
      category: "Material",
      icon: "good-tar",
      color: "#727272",
      value: 2,
      chance: 3,
      model: "Any_forest",
      unit: "barrel",
      bonus: {fleet: 1},
      culture: {Hunting: 3}
    },
    {
      i: 33,
      name: "Saltpeter",
      category: "Material",
      icon: "good-saltpeter",
      color: "#e6e3e3",
      value: 3,
      chance: 2,
      model: "Less_habitable_biomes",
      unit: "barrel",
      bonus: {artillery: 3},
      culture: {Generic: 2}
    },
    {
      i: 34,
      name: "Coal",
      category: "Material",
      icon: "good-coal",
      color: "#36454f",
      value: 2,
      chance: 3,
      model: "Hills",
      unit: "wain",
      bonus: {artillery: 2},
      culture: {Generic: 2}
    },
    {
      i: 35,
      name: "Oil",
      category: "Material",
      icon: "good-oil",
      color: "#565656",
      value: 3,
      chance: 2,
      model: "Less_habitable_biomes",
      unit: "barrel",
      bonus: {artillery: 1},
      culture: {Generic: 2, Nomadic: 2}
    },
    {
      i: 36,
      name: "Tropical timber",
      category: "Luxury",
      icon: "good-tropicalTimber",
      color: "#a45a52",
      value: 10,
      chance: 2,
      model: "Tropical_rainforest",
      unit: "pile",
      bonus: {prestige: 1},
      culture: {Generic: 2}
    },
    {
      i: 37,
      name: "Whales",
      category: "Food",
      icon: "good-whales",
      color: "#cccccc",
      value: 2,
      chance: 3,
      model: "Arctic_waters",
      unit: "barrel",
      bonus: {population: 1},
      culture: {Naval: 2}
    },
    {
      i: 38,
      name: "Sugar",
      category: "Preservative",
      icon: "good-sugar",
      color: "#7abf87",
      value: 3,
      chance: 3,
      model: "Tropical_rainforest",
      unit: "bag",
      bonus: {population: 1},
      culture: {Lake: 2, River: 2}
    },
    {
      i: 39,
      name: "Tea",
      category: "Luxury",
      icon: "good-tea",
      color: "#d0f0c0",
      value: 5,
      chance: 3,
      model: "Hilly_tropical_rainforest",
      unit: "bag",
      bonus: {prestige: 1},
      culture: {Lake: 2, River: 2, Highland: 2}
    },
    {
      i: 40,
      name: "Tobacco",
      category: "Luxury",
      icon: "good-tobacco",
      color: "#6D5843",
      value: 5,
      chance: 2,
      model: "Tropical_rainforest",
      unit: "bag",
      bonus: {prestige: 1},
      culture: {Lake: 2, River: 2}
    }
  ];

  models = {
    Deciduous_forests: "biome(6, 7, 8)",
    Any_forest: "biome(5, 6, 7, 8, 9)",
    Temperate_and_boreal_forests: "biome(6, 8, 9)",
    Hills: "minHeight(40) || (minHeight(30) && nth(10))",
    Mountains: "minHeight(60) || (minHeight(20) && nth(10))",
    Mountains_and_wetlands: "minHeight(60) || (biome(12) && nth(7)) || (minHeight(20) && nth(10))",
    Headwaters: "river() && minHeight(40)",
    More_habitable: "minHabitability(20) && habitability()",
    Marine_and_rivers: 'shore(-1) && (type("ocean", "freshwater", "salt") || (river() && shore(1, 2)))',
    Pastures_and_temperate_forest: "(biome(3, 4) && !elevation()) || (biome(6) && random(70)) || (biome(5) && nth(5))",
    Tropical_forests: "biome(5, 7)",
    Arid_land_and_salt_lakes:
      'shore(1) && type("salt", "dry") || (biome(1, 2) && random(70)) || (biome(12) && nth(10))',
    Hot_desert: "biome(1)",
    Deserts: "biome(1, 2)",
    Grassland_and_cold_desert: "biome(3) || (biome(2) && nth(4))",
    Hot_biomes: "biome(1, 3, 5, 7)",
    Hot_desert_and_tropical_forest: "biome(1, 7)",
    Tropical_rainforest: "biome(7)",
    Tropical_waters: "shore(-1) && minTemp(18)",
    Hilly_tropical_rainforest: "minHeight(40) && biome(7)",
    Subtropical_waters: "shore(-1) && minTemp(14)",
    Habitable_biome_or_marine: "shore(-1) || minHabitability(1)",
    Foresty_seashore: "shore(1) && biome(6, 7, 8, 9)",
    Boreal_forests: "biome(9) || (biome(10) && nth(2)) || (biome(6, 8) && nth(5)) || (biome(12) && nth(10))",
    Less_habitable_seashore: "shore(1) && minHabitability(1) && !habitability()",
    Less_habitable_biomes: "minHabitability(1) && !habitability()",
    Arctic_waters: "shore(-1) && biome(0) && maxTemp(7)"
  };

  methods = {
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
    type: (...types: string[]) => types.includes(pack.features[this.cells.f[this.cellId]].group),
    river: () => pack.cells.r[this.cellId]
  };

  generate(regenerate: boolean = false) {
    TIME && console.time("generateGoods");
    this.cells = pack.cells;
    this.cells.good = new Uint8Array(this.cells.i.length); // goods array [0, 255]
    const resourceMaxCells = Math.ceil((200 * this.cells.i.length) / 5000);
    if (!pack.goods || regenerate) pack.goods = this.defaultGoods;
    pack.goods.forEach((r: Good) => {
      r.cells = 0;
      const model = r.custom || this.models[r.model as keyof typeof this.models];
      const allMethods = `{${Object.keys(this.methods).join(", ")}}`;
      r.fn = new Function(allMethods, `return ${model}`) as (methods: any) => boolean;
    });

    const skipGlaciers = biomesData.habitability[11] === 0;
    const shuffledCells = d3.shuffle((this.cells.i as number[]).slice());

    for (const cellId of shuffledCells) {
      if (!(cellId % 10)) d3.shuffle(pack.goods);
      if (skipGlaciers && this.cells.biome[cellId] === 11) continue;
      const rnd = Math.random() * 100;
      this.cellId = cellId;

      for (const resource of pack.goods) {
        if (resource.cells! >= resourceMaxCells) continue;
        if (resource.cells ? rnd > resource.chance : Math.random() * 100 > resource.chance) continue;
        if (!resource.fn!({...this.methods})) continue;

        this.cells.good[cellId] = resource.i;
        resource.cells!++;
        break;
      }
    }
    pack.goods.sort((a: Good, b: Good) => (a.i > b.i ? 1 : -1)).forEach((r: Good) => delete r.fn);

    TIME && console.timeEnd("generateGoods");
  }

  getStroke(color: string): string {
    return (d3.color(color) as any).darker(2).hex();
  }

  get(i: number): Good | undefined {
    return pack.goods.find((resource: Good) => resource.i === i);
  }
}

window.Goods = new GoodsModule();
