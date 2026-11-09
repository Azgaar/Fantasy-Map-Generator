import { sum } from "d3";
import { DEFAULT_CULTURE_TYPE } from "@/data/culture-types";
import type { Zone } from "@/model/political/zones-generator";
import { Development } from "@/model/society/development-generator";
import type { Good } from "@/types/economy";
import { rn } from "@/utils/number-utils";
import { Goods } from "./goods-generator";

const RURAL_OUTPUT_FACTOR = 0.9;
export const DEPOSIT_RICHNESS = 2.2; // units a day per population point of its cell, on a map of DEPOSIT_MAP_CELLS
const DEPOSIT_MAP_CELLS = 5000; // deposit counts are per map, so their yield grows with the map's cells
const DEPOSIT_MAX_POPULATION = 10; // a deposit's yield stops growing past this population
const PRODUCTIVITY_START = 30; // development past this makes more of every good

/** What the land yields at the map's people and good rules: rural output, deposits and their multipliers */
class OutputModule {
  private zoneCellSets: Map<number, Set<number>> | null = null; // lazy zoneId -> cells lookup, built only when a good uses zone multipliers
  private zoneCellSetsSource: Zone[] | null = null;

  forgetZones(): void {
    this.zoneCellSets = null;
  }

  /** Each cell's rural output a day, units by good id */
  getRural(): Record<number, number>[] {
    const biomes = Goods.getBiomesProduction();
    return Array.from(pack.cells.i, cellId => this.getCell(cellId, biomes));
  }

  /** The land cell whose people work a cell's output: its own, or a shore cell of the same market */
  getWorkingCell(cellId: number): number {
    const { c, h, market } = pack.cells;
    if (h[cellId] >= 20) return cellId;
    const shore = c[cellId].filter(neighbor => h[neighbor] >= 20);
    return shore.find(neighbor => market[neighbor] === market[cellId]) ?? shore[0] ?? cellId;
  }

  ofCell(cellId: number): Record<number, number> {
    return this.getCell(cellId, Goods.getBiomesProduction());
  }

  private getCell(cellId: number, biomes: ReturnType<typeof Goods.getBiomesProduction>): Record<number, number> {
    const produced: Record<number, number> = {};

    const modifier = (good: Good) => this.getModifiers(good, cellId);
    const add = (goodId: number, amount: number) => {
      produced[goodId] = rn((produced[goodId] || 0) + amount * RURAL_OUTPUT_FACTOR, 2);
    };

    const pop = this.getCellPopulation(cellId);
    if (pop > 0) {
      for (const { goodId, production } of biomes[pack.cells.biome[cellId]] || []) {
        const good = Goods.get(goodId);
        if (good) add(goodId, pop * production * modifier(good));
      }

      const deposit = Goods.get(pack.cells.good[cellId]);
      if (deposit) produced[deposit.i] = rn((produced[deposit.i] || 0) + this.getDeposit(deposit, cellId), 2);
    }

    return produced;
  }

  /** Units a day, capped by people; more on bigger maps, as their deposits are as few */
  getDeposit(good: Good, cellId: number): number {
    const pop = Math.min(this.getCellPopulation(cellId), DEPOSIT_MAX_POPULATION);
    const mapScale = pack.cells.i.length / DEPOSIT_MAP_CELLS;
    return pop * DEPOSIT_RICHNESS * mapScale * this.getModifiers(good, cellId);
  }

  /** A land cell's people, or a water cell's from the land around it */
  private getCellPopulation(cellId: number): number {
    const { cells } = pack;
    if (cells.h[cellId] >= 20) return cells.pop[cellId];
    return sum(cells.c[cellId].map(c => cells.pop[c])) || 0;
  }

  /** Multipliers and development on the good at the cell; 0 beyond its technology */
  getModifiers(good: Good, cellId: number): number {
    const development = Development.ofCell(cellId);
    if (good.development && development < good.development) return 0; // beyond the cell's technology
    const productivity = Math.max(1, development / PRODUCTIVITY_START);
    const mult = good.multipliers;
    if (!mult) return productivity;

    const biomeId = pack.cells.biome[cellId];
    const cultureId = pack.cells.culture[cellId];
    const stateId = pack.cells.state[cellId];
    const religionId = pack.cells.religion[cellId];

    const burgId = pack.cells.burg[cellId];
    const cultureType = (burgId ? pack.burgs[burgId]?.type : pack.cultures[cultureId]?.type) ?? DEFAULT_CULTURE_TYPE;

    let modifier =
      (mult.cultureType?.[cultureType] ?? 1) *
      (mult.culture?.[cultureId] ?? 1) *
      (mult.state?.[stateId] ?? 1) *
      (mult.religion?.[religionId] ?? 1) *
      (mult.biome?.[biomeId] ?? 1);

    if (mult.zone) {
      const zoneCellSets = this.getZoneCellSets();
      for (const zoneIdStr in mult.zone) {
        const value = mult.zone[+zoneIdStr];
        if (value === undefined || value === 1) continue;
        if (zoneCellSets.get(+zoneIdStr)?.has(cellId)) modifier *= value;
      }
    }

    return modifier * productivity;
  }

  private getZoneCellSets(): Map<number, Set<number>> {
    const zones = pack.zones || [];
    if (this.zoneCellSets && this.zoneCellSetsSource === zones) return this.zoneCellSets;

    const sets = new Map<number, Set<number>>();
    for (const zone of zones) sets.set(zone.i, new Set(zone.cells));
    this.zoneCellSets = sets;
    this.zoneCellSetsSource = zones;
    return sets;
  }
}

export const Output = new OutputModule();
