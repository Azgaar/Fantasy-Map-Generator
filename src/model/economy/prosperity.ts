import { Pack } from "@/model/graph/pack-generator";
import type { Good } from "@/types/economy";
import { Corruption, type ProvinceCorruption } from "./corruption";
import { DEAL_KINDS } from "./deals";
import { DEMAND_PRIORITY, DEMAND_TARGET_FACTORS, getNeedsCost } from "./demand";
import { Goods } from "./goods-generator";
import { Output } from "./output";
import { StateOrders } from "./state-orders";

const NEEDS_SHARE = 0.2; // what needs met alone are worth: the rest comes from comfort and variety
const COMFORT_SHARE = 0.4;
const VARIETY_SHARE = 0.4;
const COMFORT_TOP = 15; // consuming this many times bare needs at the cheapest is full comfort
const VARIETY_TOP = 8; // consuming this many goods in even measure is full variety
const RURAL_COMFORT_TOP = 6; // a village's plenty: rural people are measured against village wants, not a city's
const RURAL_VARIETY_TOP = 8;
const INFRASTRUCTURE_SHARE = 0.15; // of prosperity, the state's public works serving its people

export const PROSPERITY_LEVELS = [
  "Desolate",
  "Destitute",
  "Poor",
  "Modest",
  "Comfortable",
  "Thriving",
  "Affluent",
  "Opulent",
  "Splendid",
  "Peerless"
] as const;
export type ProsperityLevel = (typeof PROSPERITY_LEVELS)[number];

/** needs, infrastructure, prosperity: 0–1; comfort: days of bare needs; variety: effective goods */
export type Living = { needs: number; comfort: number; variety: number; infrastructure: number; prosperity: number };
type Consumption = {
  people: number;
  goods: number[]; // units by good id
  needsCost: number;
  infrastructure: number;
  needsMet?: number;
  comfortTop?: number;
  varietyTop?: number;
};
/** A cell's rural people: share of rural earnings and purchases, units lived on by good id */
type RuralCell = { people: number; earned: number; bought: number[]; goods: number[]; living: Living };

class ProsperityModule {
  private source: unknown[] = []; // the deals and Pack revision the cache describes
  private burgs = new Map<number, Living>();
  private consumed = new Map<number, number[]>();
  private cellsSource: unknown[] = [];
  private rural = new Map<number, RuralCell>(); // by cell id

  /** Units of each good the burg's people bought or kept in the last run, by good id */
  getConsumption(burgId: number): number[] {
    this.index();
    return this.consumed.get(burgId) ?? [];
  }

  getBurg(burgId: number): Living | null {
    this.index();
    return this.burgs.get(burgId) ?? null;
  }

  getRuralCell(cellId: number): RuralCell | null {
    this.indexRural();
    return this.rural.get(cellId) ?? null;
  }

  /** Each cell's rural prosperity percent, 0 where no one lives or before the economy has run */
  getCellsProsperity(output: Record<number, number>[]): Uint8Array {
    this.indexRural(output);
    const prosperity = new Uint8Array(pack.cells.i.length);
    for (const [cellId, { living }] of this.rural)
      prosperity[cellId] = Math.max(1, Math.round(living.prosperity * 100));
    return prosperity;
  }

  getLevel(prosperity: number): ProsperityLevel {
    return PROSPERITY_LEVELS[Math.min(PROSPERITY_LEVELS.length - 1, Math.max(0, Math.floor(prosperity * 10)))];
  }

  private index(): void {
    if (isCurrent(this.source)) return;
    this.source = [pack.deals, Pack.revision];
    this.burgs.clear();
    this.consumed.clear();
    if (!pack.deals?.length) return; // no economy run: nothing to measure
    const needsCost = getNeedsCost(options.map.goods);
    const infrastructure = this.getInfrastructure();
    for (const [burgId, , goodId, kind, units] of pack.deals) {
      if (kind !== DEAL_KINDS.demand && kind !== DEAL_KINDS.kept) continue;
      const goods = this.consumed.get(burgId) ?? [];
      goods[goodId] = (goods[goodId] || 0) + units;
      this.consumed.set(burgId, goods);
    }
    for (const burg of pack.burgs) {
      if (!burg.i || burg.removed || !burg.population || !pack.cells.market[burg.cell]) continue;
      const goods = this.consumed.get(burg.i) ?? [];
      this.burgs.set(
        burg.i,
        this.measure({
          people: burg.population,
          goods,
          needsCost,
          infrastructure: infrastructure(burg.cell)
        })
      );
    }
  }

  /** Rural earnings and purchases go to cells by produce value, or by people where none */
  private indexRural(output?: Record<number, number>[]): void {
    if (!output && isCurrent(this.cellsSource)) return;
    this.cellsSource = [pack.deals, Pack.revision];
    this.rural.clear();
    if (!pack.deals?.length) return;
    const needsCost = getNeedsCost(options.map.goods);
    const infrastructure = this.getInfrastructure();
    const worked = this.getWorked(output ?? Output.getRural());
    const byMarket = new Map<number, { cellId: number; people: number; produce: number }[]>();
    for (const cellId of pack.cells.i) {
      const people = pack.cells.pop[cellId] || 0;
      const marketId = pack.cells.market[cellId];
      if (!people || !marketId) continue;
      let produce = 0;
      for (const [goodId, units] of Object.entries(worked[cellId])) produce += units * (Goods.get(+goodId)?.value || 0);
      const cells = byMarket.get(marketId) ?? [];
      cells.push({ cellId, people, produce });
      byMarket.set(marketId, cells);
    }

    for (const market of pack.markets) {
      const cells = byMarket.get(market.i);
      if (!market.i || !market.rural || !cells) continue;
      const totalProduce = cells.reduce((sum, cell) => sum + cell.produce, 0);
      const totalPeople = cells.reduce((sum, cell) => sum + cell.people, 0);
      // unsold produce stays with those who grew it; only what meets a need is lived on
      const grown: number[] = [];
      for (const { cellId } of cells)
        for (const [goodId, units] of Object.entries(worked[cellId])) grown[+goodId] = (grown[+goodId] || 0) + units;
      const kept = (market.rural.kept ?? []).filter(([goodId]) => grown[goodId] && isNeeded(Goods.get(goodId)));
      for (const { cellId, people, produce } of cells) {
        const share = totalProduce ? produce / totalProduce : people / totalPeople;
        const bought: number[] = [];
        for (const [goodId, units] of market.rural.bought) bought[goodId] = units * share;
        const goods = bought.slice();
        for (const [goodId, units] of kept)
          goods[goodId] = (goods[goodId] || 0) + (units * (worked[cellId][goodId] || 0)) / grown[goodId];
        const living = this.measure({
          people,
          goods,
          needsCost,
          infrastructure: infrastructure(cellId),
          needsMet: 1,
          comfortTop: RURAL_COMFORT_TOP,
          varietyTop: RURAL_VARIETY_TOP
        });
        this.rural.set(cellId, { people, earned: market.rural.earned * share, bought, goods, living });
      }
    }
  }

  /** Each cell's output, with the water deposits its people work from the shore of the same market */
  private getWorked(output: Record<number, number>[]): Record<number, number>[] {
    const { h, market, pop } = pack.cells;
    const worked = output.slice();
    for (const cellId of pack.cells.i) {
      if (h[cellId] >= 20 || !market[cellId]) continue;
      const shore = Output.getWorkingCell(cellId);
      if (shore === cellId || !pop[shore] || market[shore] !== market[cellId]) continue;
      const merged = { ...worked[shore] };
      for (const [goodId, units] of Object.entries(output[cellId])) merged[+goodId] = (merged[+goodId] || 0) + units;
      worked[shore] = merged;
    }
    return worked;
  }

  /** Infrastructure provision of the province a cell is in */
  private getInfrastructure(): (cellId: number) => number {
    const served = new Map<ProvinceCorruption, number>();
    for (const state of pack.states) {
      if (!state.i || state.removed) continue;
      const provision = StateOrders.getInfrastructure(state);
      for (const province of Corruption.getProvinces(state.i)) served.set(province, provision.get(province.id) ?? 0);
    }
    return cellId => {
      const province = Corruption.ofCell(cellId);
      return province ? (served.get(province) ?? 0) : 0;
    };
  }

  /** Each need counts by its size */
  private getNeedsMet(people: number, covered: number[]): number {
    const totalFactor = DEMAND_PRIORITY.reduce((sum, category) => sum + DEMAND_TARGET_FACTORS[category], 0);
    return DEMAND_PRIORITY.reduce((sum, category, index) => {
      const target = people * DEMAND_TARGET_FACTORS[category];
      return sum + (DEMAND_TARGET_FACTORS[category] / totalFactor) * Math.min(1, covered[index] / target);
    }, 0);
  }

  private measure({
    people,
    goods,
    needsCost,
    infrastructure,
    needsMet,
    comfortTop = COMFORT_TOP,
    varietyTop = VARIETY_TOP
  }: Consumption): Living {
    const bare = people * needsCost;
    const covered = DEMAND_PRIORITY.map(() => 0);
    const values: number[] = needsMet === undefined ? [] : [bare]; // rural fields count as one good worth bare needs
    goods.forEach((units, goodId) => {
      const good = Goods.get(goodId);
      if (!good || !units) return;
      values.push(units * good.value);
      if (needsMet !== undefined) return; // no need to count what they cover
      DEMAND_PRIORITY.forEach((category, index) => {
        covered[index] += units * (good.demandCoverage?.[category] || 0);
      });
    });

    const needs = needsMet ?? this.getNeedsMet(people, covered);
    const total = values.reduce((sum, value) => sum + value, 0);
    const comfort = bare ? total / bare : 0;
    const entropy = values.reduce(
      (sum, value) => (value > 0 ? sum - (value / total) * Math.log(value / total) : sum),
      0
    );
    const variety = total ? Math.exp(entropy) : 0;

    const comfortScore = comfort > 1 ? Math.min(1, Math.log(comfort) / Math.log(comfortTop)) : 0;
    const varietyScore = variety > 1 ? Math.min(1, (variety - 1) / (varietyTop - 1)) : 0;
    const living = needs * (NEEDS_SHARE + COMFORT_SHARE * comfortScore + VARIETY_SHARE * varietyScore);
    const prosperity = (1 - INFRASTRUCTURE_SHARE) * living + INFRASTRUCTURE_SHARE * infrastructure;
    return { needs, comfort, variety, infrastructure, prosperity };
  }
}

export const Prosperity = new ProsperityModule();

function isNeeded(good?: Good): boolean {
  return Object.values(good?.demandCoverage ?? {}).some(Boolean);
}

const isCurrent = ([deals, revision]: unknown[]) => deals === pack.deals && revision === Pack.revision;
