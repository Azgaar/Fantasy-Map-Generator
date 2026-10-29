import Alea from "alea";
import { color, shuffler } from "d3";
import { GOODS_DATA } from "@/data/goods";
import { Icons } from "@/model/icons";
import { CULTURE_TYPES, type CultureType } from "@/model/society/cultures-generator";
import { Tags } from "@/model/tags";
import type { IconSet } from "@/types/icons";
import { requireColor } from "@/utils/color-utils";
import { rn } from "@/utils/number-utils";
import { requireName } from "@/utils/validation-utils";

export interface Good {
  i: number;

  // generation
  deposits?: [number, number]; // deposits on the map, min and max
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
  carriage: number; // price of carrying one unit over a decima, in the map's currency
  unit: string;

  // ui
  icon: string;
  color: string;
  visible?: boolean; // whether the good is shown on the Goods layer

  note?: string;
}

type ProductionRules = Partial<{
  deposits: [number, number] | null;
  recipes: Record<number, number>[] | null;
  biomeOutput: Partial<Record<number, number>> | null;
  multipliers: Good["multipliers"] | null;
  demandCoverage: Good["demandCoverage"] | null;
}>;

export const DEFAULT_CARRIAGE = 0.5; // carriage price of a new good
const DEPOSIT_CLUSTERING = 0.5; // chance a deposit lands beside the previous one of its good
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

export const WANT_SHARES: Record<DemandCategory, number> = {
  food: 0.25,
  utilities: 0.2,
  construction: 0.15,
  military: 0.1,
  luxury: 0.3
}; // how spare money is split once needs are met
export const WANT_LIMITS: Record<DemandCategory, number> = {
  food: 1,
  utilities: 1,
  construction: 1,
  military: 1,
  luxury: 4
}; // the most a person buys beyond their needs, in days of need: richer people eat only so much more
export const SAVINGS_RATE = 0.38; // share of a day's income households keep
export const VARIETY = 2.92; // buyers spread their spending over the goods covering a need, by (price per coverage)^-VARIETY: higher buys only the cheapest
export const NOVELTY = 6.94; // how much more a buyer pays per tenfold of affluence for a good it has had none of yet
export const WEALTH_WANTS: readonly DemandCategory[] = ["luxury"]; // wants that grow with affluence: the rich display; staples stay capped, or the first in line buy them out

/** Shares of spending each option gets: cheaper coverage gets more, but every option gets some */
export function getVarietyShares(costs: number[], variety = VARIETY): number[] {
  const cheapest = Math.min(...costs.filter(cost => cost > 0));
  const weights = costs.map(cost => (cost > 0 ? (cost / cheapest) ** -variety : 0));
  const total = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  return weights.map(weight => weight / total);
}

/** A person's daily needs at base prices, each covered the cheapest way */
export function getNeedsCost(goods: Good[]): number {
  return DEMAND_PRIORITY.reduce((sum, category) => {
    const costs = goods.flatMap(good =>
      good.demandCoverage?.[category] ? [good.value / good.demandCoverage[category]!] : []
    );
    return sum + (costs.length ? DEMAND_TARGET_FACTORS[category] * Math.min(...costs) : 0);
  }, 0);
}

export function getDemandTargets(population: number): number[] {
  return DEMAND_PRIORITY.map(category => population * DEMAND_TARGET_FACTORS[category]);
}

export class GoodsModule {
  readonly iconSet = {
    id: "goods",
    group: "Goods",
    paint: { stroke: "#000000", strokeWidth: 2 } // the linework of the default goods style
  } as const satisfies IconSet;

  private goodById: Good[] = [];

  regenerate(): void {
    this.generate({ randomSeed: Math.random() });
  }

  // Place every good's deposits, as many as its range gives
  generate(config: { randomSeed?: number } = {}) {
    Math.random = Alea(config.randomSeed ?? options.map.seed);
    if (!pack.goods?.length) this.restoreDefaults();

    pack.cells.good = new Uint16Array(pack.cells.i.length);
    for (const good of shuffler(() => Math.random())([...pack.goods])) {
      this.placeDeposits(good, { count: this.getDepositCount(good) });
    }
    this.sync();
  }

  regeneratePlacement(goodId: number) {
    const good = this.prepareDeposits(goodId);
    if (good) this.placeDeposits(good, { count: this.getDepositCount(good) });
  }

  /** Re-place a good's deposits until they yield the units a day; output is what a deposit on the cell would yield. Returns the deposits placed */
  placeOutput(goodId: number, units: number, output: (cellId: number) => number): number {
    const good = this.prepareDeposits(goodId);
    return good ? this.placeDeposits(good, { units, output }) : 0;
  }

  private prepareDeposits(goodId: number): Good | undefined {
    this.sync();
    const good = this.get(goodId);
    if (!good) return;
    const { cells } = pack;
    if (cells.good?.length !== cells.i.length) cells.good = new Uint16Array(cells.i.length);
    for (const cellId of cells.i) if (cells.good[cellId] === goodId) cells.good[cellId] = 0;
    return good;
  }

  private getDepositCount(good: Good): number {
    if (!good.distribution || !good.deposits) return 0;
    const [min, max] = good.deposits.map(Math.ceil);
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  /** Deposits form loose clusters: each next one lands beside the previous one by chance, or anywhere the good fits */
  private placeDeposits(
    good: Good,
    target: { count: number } | { units: number; output: (cellId: number) => number }
  ): number {
    if (!good.distribution) return 0;
    const { cells } = pack;
    const methods = `{${Object.keys(this.getMethods()).join(", ")}}`;
    const spread = new Function(methods, `return ${good.distribution}`);
    const output = "output" in target ? target.output : null;
    const free = (cellId: number) =>
      !cells.good[cellId] &&
      !(cells.biome[cellId] === 11 && pack.biomes[11].habitability === 0) && // glaciers
      (!output || output(cellId) > 0);
    const fits = (cellId: number) => free(cellId) && spread(this.getMethods(cellId));

    let eligible: number[] | null = null; // listed once random draws keep missing
    const pickAnywhere = () => {
      if (!eligible) {
        for (let tries = 0; tries < 100; tries++) {
          const cellId = cells.i[Math.floor(Math.random() * cells.i.length)];
          if (fits(cellId)) return cellId;
        }
        eligible = Array.from(cells.i).filter(fits);
      }
      while (eligible.length) {
        const index = Math.floor(Math.random() * eligible.length);
        const cellId = eligible[index];
        eligible[index] = eligible[eligible.length - 1];
        eligible.pop();
        if (free(cellId)) return cellId;
      }
      return -1;
    };

    let placed = 0;
    let made = 0;
    let previous = -1;
    while ("count" in target ? placed < target.count : made < target.units) {
      let cellId = -1;
      if (previous >= 0 && Math.random() < DEPOSIT_CLUSTERING) {
        const near = cells.c[previous].filter(fits);
        if (near.length) cellId = near[Math.floor(Math.random() * near.length)];
      }
      if (cellId < 0) cellId = pickAnywhere();
      if (cellId < 0) break;

      cells.good[cellId] = good.i;
      placed++;
      if (output) made += output(cellId);
      previous = cellId;
    }
    return placed;
  }

  /** The default deposit range of a good by its name, if it is one of the defaults */
  getDefaultDeposits(name: string): [number, number] | undefined {
    return this.defaultGoods.find(good => good.name === name)?.deposits;
  }

  restoreDefaults() {
    pack.goods = structuredClone(this.defaultGoods);
    this.sync();
  }

  getMethods(cellId = 0) {
    return {
      random: (number: number) => number >= 100 || (number > 0 && number / 100 > Math.random()),
      nth: (number: number) => !(cellId % number),
      minHabitability: (min: number) => pack.biomes[pack.cells.biome[cellId]].habitability >= min,
      habitability: () => pack.biomes[pack.cells.biome[cellId]].habitability > Math.random() * 100,
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
    return color(colorHex)!.darker(2).hex();
  }

  /** Shown on the Goods layer: a selected good, or every good while none is selected */
  isDisplayed(good: Good | undefined): boolean {
    return Boolean(good && (good.visible || !pack.goods.some(g => g.visible)));
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
    this.living(goodId).icon = Icons.reference(icon);
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

  /** Set the price of carrying one unit of a good over a decima, a tenth of the map's diagonal, in the map's currency; takes effect on the next economy run */
  setCarriage(goodId: number, carriage: number): void {
    if (typeof carriage !== "number" || !(carriage >= 0 && Number.isFinite(carriage)))
      throw new Error("The carriage price must be a non-negative number");
    this.living(goodId).carriage = carriage;
  }

  /** The default good's carriage price by name, otherwise a tenth of the good's value */
  getDefaultCarriage(good: Pick<Good, "name" | "value">): number {
    return GOODS_DATA.find(({ name }) => name === good.name)?.carriage ?? rn(good.value / 10, 1);
  }

  /** Set the unit a good is counted in, such as "barrel"; empty for none */
  setUnit(goodId: number, unit: string): void {
    if (typeof unit !== "string") throw new Error("The unit must be text");
    this.living(goodId).unit = unit.trim();
  }

  /** Set a good's tags, such as "food, luxury" */
  setTags(goodId: number, tags: string[]): void {
    if (!Array.isArray(tags) || tags.some(tag => typeof tag !== "string")) throw new Error("Tags are a list of words");
    Tags.set(this.living(goodId), tags);
  }

  /** Set how a good is produced: deposits ([min, max] on the map), recipes ([{ goodId: amount }]), biomeOutput ({ biomeId: amount }), multipliers ({ cultureType | culture | state | religion | biome | zone: { key: factor } }), demandCoverage ({ category: share }). A key set to null clears it. Takes effect on the next economy run */
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
      if (key === "deposits") {
        if (!Array.isArray(value) || value.length !== 2) throw new Error("The deposits are a [min, max] range");
        nonNegative(value[0], "The minimum deposits");
        nonNegative(value[1], "The maximum deposits");
        if (value[0] > value[1]) throw new Error("The minimum deposits must not exceed the maximum");
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
          `Unknown production rule ${key}; known: deposits, recipes, biomeOutput, multipliers, demandCoverage`
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

export const Goods = new GoodsModule();
