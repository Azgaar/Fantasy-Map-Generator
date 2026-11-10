import Alea from "alea";
import { color, shuffler } from "d3";
import { CULTURE_TYPES } from "@/data/culture-types";
import { type ENTITY_MULTIPLIERS, GOODS_DATA, GOODS_ICON_SET } from "@/data/goods";
import { Icons } from "@/model/icons";
import { Options } from "@/model/options/options-model";
import { Tags } from "@/model/tags";
import type { Good } from "@/types/economy";
import { requireColor } from "@/utils/color-utils";
import { log } from "@/utils/logger";
import { rn } from "@/utils/number-utils";
import { requireName } from "@/utils/validation-utils";
import { DEMAND_PRIORITY } from "./demand";

type ProductionRules = Partial<{
  deposits: [number, number] | null;
  recipes: Record<number, number>[] | null;
  biomeOutput: Partial<Record<number, number>> | null;
  multipliers: Good["multipliers"] | null;
  demandCoverage: Good["demandCoverage"] | null;
}>;

export const DEFAULT_CARRIAGE = 0.5; // carriage price of a new good
const DEPOSIT_CLUSTERING = 0.5; // chance a deposit lands beside the previous one of its good

export class GoodsModule {
  readonly iconSet = GOODS_ICON_SET;

  private goodById: Good[] = [];

  generate(config: { randomSeed?: number } = {}) {
    Math.random = Alea(config.randomSeed ?? options.map.seed);
    if (!options.map.goods.length) this.restoreDefaults();

    pack.cells.good = new Uint16Array(pack.cells.i.length);
    for (const good of shuffler(() => Math.random())([...options.map.goods])) {
      this.placeDeposits(good, this.getDepositCount(good));
    }
    this.sync();
  }

  regenerate(): void {
    this.generate({ randomSeed: Math.random() });
  }

  regeneratePlacement(goodId: number) {
    this.sync();
    const good = this.get(goodId);
    if (!good) return;
    const { cells } = pack;
    if (cells.good?.length !== cells.i.length) cells.good = new Uint16Array(cells.i.length);
    for (const cellId of cells.i) if (cells.good[cellId] === goodId) cells.good[cellId] = 0;
    this.placeDeposits(good, this.getDepositCount(good));
  }

  private getDepositCount(good: Good): number {
    if (!good.distribution || !good.deposits) return 0;
    const [min, max] = good.deposits.map(Math.ceil);
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  /** A rule that fails to compile or run places nothing, so the map still generates */
  private placeDeposits(good: Good, count: number) {
    if (!good.distribution) return;
    try {
      this.spreadDeposits(good, count);
    } catch (error) {
      log.error(`Goods: invalid distribution of ${good.name}, no deposits placed`, error);
      const { good: cellGood } = pack.cells;
      for (let cellId = 0; cellId < cellGood.length; cellId++) if (cellGood[cellId] === good.i) cellGood[cellId] = 0;
    }
  }

  private spreadDeposits(good: Good, count: number) {
    const { cells } = pack;
    const methods = `{${Object.keys(this.getMethods()).join(", ")}}`;
    const spread = new Function(methods, `return ${good.distribution}`);
    const free = (cellId: number) =>
      !cells.good[cellId] && !(cells.biome[cellId] === 11 && pack.biomes[11].habitability === 0); // glaciers
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
    let previous = -1;
    while (placed < count) {
      let cellId = -1;
      if (previous >= 0 && Math.random() < DEPOSIT_CLUSTERING) {
        const near = cells.c[previous].filter(fits);
        if (near.length) cellId = near[Math.floor(Math.random() * near.length)];
      }
      if (cellId < 0) cellId = pickAnywhere();
      if (cellId < 0) break;

      cells.good[cellId] = good.i;
      placed++;
      previous = cellId;
    }
  }

  getDefaultDeposits(name: string): [number, number] | undefined {
    return this.defaultGoods.find(good => good.name === name)?.deposits;
  }

  getDefaultDevelopment(name: string): number | undefined {
    return this.defaultGoods.find(good => good.name === name)?.development;
  }

  restoreDefaults() {
    options.map.goods = structuredClone(this.defaultGoods);
    this.sync();
  }

  /** Regeneration renumbers or drops entities: their multipliers follow the kept ones, the rest go */
  remapEntityMultipliers(dimension: (typeof ENTITY_MULTIPLIERS)[number], newIds: Map<number, number>): void {
    let changed = false;
    for (const { multipliers } of options.map.goods) {
      if (!multipliers?.[dimension]) continue;
      const kept = Object.entries(multipliers[dimension]).filter(([id]) => newIds.has(+id));
      multipliers[dimension] = Object.fromEntries(kept.map(([id, value]) => [newIds.get(+id), value]));
      if (!kept.length) delete multipliers[dimension];
      changed = true;
    }
    if (changed) Options.save();
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
        return types.includes(feature.type) || (!!feature.subtype && types.includes(feature.subtype));
      },
      river: () => pack.cells.r[cellId]
    };
  }

  getBiomesProduction(): Record<number, { goodId: number; production: number }[]> {
    return options.map.goods.reduce(
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
    return Boolean(good && (good.visible || !options.map.goods.some(g => g.visible)));
  }

  get(i: number): Good | undefined {
    return this.goodById[i];
  }

  /** Rename a good */
  rename(goodId: number, name: string): void {
    this.edit(goodId).name = requireName(name);
  }

  /** Set a good's icon: an emoji or an icon id */
  setIcon(goodId: number, icon: string): void {
    this.edit(goodId).icon = Icons.reference(icon);
  }

  /** Set a good's color on the Goods layer */
  recolor(goodId: number, color: string): void {
    this.edit(goodId).color = requireColor(color);
  }

  /** Set a good's base value per unit, in the map's currency; markets price it from this on the next economy run */
  setPrice(goodId: number, value: number): void {
    if (typeof value !== "number" || !(value >= 0 && Number.isFinite(value)))
      throw new Error("The value must be a non-negative number");
    this.edit(goodId).value = value;
  }

  /** Set the price of carrying one unit over a decima, a tenth of the map's diagonal, in the map's currency; takes effect on the next economy run */
  setCarriage(goodId: number, carriage: number): void {
    if (typeof carriage !== "number" || !(carriage >= 0 && Number.isFinite(carriage)))
      throw new Error("The carriage price must be a non-negative number");
    this.edit(goodId).carriage = carriage;
  }

  /** Set the least development, 0–100, a cell needs to produce a good; 0 for none. Takes effect on the next economy run */
  setDevelopment(goodId: number, development: number): void {
    if (!Number.isInteger(development) || development < 0 || development > 100)
      throw new Error("The development must be a whole number from 0 to 100");
    this.edit(goodId).development = development || undefined;
  }

  /** The default good's carriage price by name, otherwise a tenth of the good's value */
  getDefaultCarriage(good: Pick<Good, "name" | "value">): number {
    return GOODS_DATA.find(({ name }) => name === good.name)?.carriage ?? rn(good.value / 10, 1);
  }

  /** Set the unit a good is counted in, such as "barrel"; empty for none */
  setUnit(goodId: number, unit: string): void {
    if (typeof unit !== "string") throw new Error("The unit must be text");
    this.edit(goodId).unit = unit.trim();
  }

  /** Set a good's tags, such as "food, luxury" */
  setTags(goodId: number, tags: string[]): void {
    if (!Array.isArray(tags) || tags.some(tag => typeof tag !== "string")) throw new Error("Tags are a list of words");
    Tags.set(this.edit(goodId), tags);
  }

  /** Set how a good is produced: deposits ([min, max] on the map), recipes ([{ goodId: amount }]), biomeOutput ({ biomeId: amount }), multipliers ({ cultureType | culture | state | religion | biome | zone: { key: factor } }), demandCoverage ({ category: share }). A key set to null clears it. Takes effect on the next economy run */
  setProduction(goodId: number, rules: ProductionRules): void {
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
    const good = this.edit(goodId);
    for (const [key, value] of Object.entries(next)) {
      if (value === undefined) delete good[key as keyof ProductionRules];
      else Object.assign(good, { [key]: value });
    }
  }

  private findGood(goodId: number): Good | undefined {
    return options.map.goods.find(good => good.i === goodId);
  }

  /** The good about to change: the options remember it */
  private edit(goodId: number): Good {
    const good = this.findGood(goodId);
    if (!good) throw new Error(`Good ${goodId} does not exist`);
    Options.save();
    return good;
  }

  /** Removes the good, its deposits, recipes taking it and its share of the run; units ignore it */
  remove(goodId: number): void {
    const { cells } = pack;
    for (const cell of cells.i) if (cells.good[cell] === goodId) cells.good[cell] = 0;
    options.map.goods = options.map.goods.filter(good => good.i !== goodId);
    for (const good of options.map.goods) {
      if (!good.recipes) continue;
      good.recipes = good.recipes.filter(recipe => !(goodId in recipe));
      if (!good.recipes.length) delete good.recipes;
    }
    pack.deals = pack.deals.filter(([, , dealGood]) => dealGood !== goodId);
    const others = ([id]: [number, number]) => id !== goodId;
    for (const burg of pack.burgs) burg.production &&= burg.production.filter(others);
    for (const market of pack.markets) {
      delete market.goods[goodId];
      if (!market.rural) continue;
      market.rural.bought = market.rural.bought.filter(others);
      market.rural.kept &&= market.rural.kept.filter(others);
    }
    Options.save();
    this.sync();
  }

  sync() {
    this.goodById = [];
    for (const good of options.map.goods) this.goodById[good.i] = good;
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
