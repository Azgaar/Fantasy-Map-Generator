import { DEMAND_PRIORITY, DEMAND_TARGET_FACTORS, Goods, getNeedsCost } from "./goods-generator";
import { DEAL_KINDS, Markets } from "./markets-generator";
import { Production } from "./production-generator";

const NEEDS_SHARE = 0.2; // what needs met alone are worth, living on bare needs: the rest comes from comfort and variety
const COMFORT_SHARE = 0.4;
const VARIETY_SHARE = 0.4;
const COMFORT_TOP = 15; // consuming this many times bare needs at the cheapest is full comfort
const VARIETY_TOP = 14; // consuming this many goods in even measure is full variety

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

/** A people's living: needs met (0–1), consumption at base prices in days of bare needs, the effective number of goods, and prosperity (0–1) */
export type Living = { needs: number; comfort: number; variety: number; prosperity: number };
type Consumption = { people: number; goods: number[]; needsCost: number; needsMet?: number }; // goods: units by good id
/** A cell's rural people: their living and their share of their market's rural earnings */
export type RuralCell = { people: number; earned: number; living: Living };

class ProsperityModule {
  private source: unknown = null; // the deals the cache describes
  private burgs = new Map<number, Living>();
  private consumed = new Map<number, number[]>();
  private cellsSource: unknown = null;
  private rural = new Map<number, RuralCell>(); // by cell id

  /** Units of each good the burg's people bought or kept for themselves in the last run, by good id */
  getConsumption(burgId: number): number[] {
    this.index();
    return this.consumed.get(burgId) ?? [];
  }

  getBurg(burgId: number): Living | null {
    this.index();
    return this.burgs.get(burgId) ?? null;
  }

  /** A cell's rural people in the last run: their needs come from their fields; they buy their wants with what their produce earned */
  getRuralCell(cellId: number): RuralCell | null {
    this.indexRural();
    return this.rural.get(cellId) ?? null;
  }

  /** Each cell's rural prosperity as a percent, 0 where no one lives or the economy has not run, to keep in the cells */
  getCellsProsperity(): Uint8Array {
    this.indexRural();
    const prosperity = new Uint8Array(pack.cells.i.length);
    for (const [cellId, { living }] of this.rural)
      prosperity[cellId] = Math.max(1, Math.round(living.prosperity * 100));
    return prosperity;
  }

  getLevel(prosperity: number): (typeof PROSPERITY_LEVELS)[number] {
    return PROSPERITY_LEVELS[Math.min(PROSPERITY_LEVELS.length - 1, Math.max(0, Math.floor(prosperity * 10)))];
  }

  private index(): void {
    if (this.source === pack.deals) return;
    this.source = pack.deals;
    this.burgs.clear();
    this.consumed.clear();
    if (!pack.deals?.length) return; // no economy run: nothing to measure
    const needsCost = getNeedsCost(pack.goods);
    for (const [burgId, , goodId, kind, units] of pack.deals) {
      if (kind !== DEAL_KINDS.demand && kind !== DEAL_KINDS.kept) continue;
      const goods = this.consumed.get(burgId) ?? [];
      goods[goodId] = (goods[goodId] || 0) + units;
      this.consumed.set(burgId, goods);
    }
    for (const burg of pack.burgs) {
      if (!burg.i || burg.removed || !burg.population || !burg.market) continue;
      const goods = this.consumed.get(burg.i) ?? [];
      this.burgs.set(burg.i, this.measure({ people: burg.population, goods, needsCost }));
    }
  }

  /** A market's rural earnings and purchases go to its peopled cells by the value of their produce, or by their people where none */
  private indexRural(): void {
    if (this.cellsSource === pack.deals) return;
    this.cellsSource = pack.deals;
    this.rural.clear();
    if (!pack.deals?.length) return;
    const needsCost = getNeedsCost(pack.goods);
    const kept = Markets.getCellProduce(); // the run's, or worked out again for a loaded map
    const biomes = kept ? null : Goods.getBiomesProduction();
    const byMarket = new Map<number, { cellId: number; people: number; produce: number }[]>();
    for (const cellId of pack.cells.i) {
      const people = pack.cells.pop[cellId] || 0;
      const marketId = pack.cells.market[cellId];
      if (!people || !marketId) continue;
      let produce = kept?.[cellId] ?? 0;
      if (biomes)
        for (const [goodId, units] of Object.entries(Production.getCellProduction(cellId, biomes)))
          produce += units * (Goods.get(+goodId)?.value || 0);
      const cells = byMarket.get(marketId) ?? [];
      cells.push({ cellId, people, produce });
      byMarket.set(marketId, cells);
    }

    for (const market of pack.markets) {
      const cells = byMarket.get(market.i);
      if (!market.i || !market.rural || !cells) continue;
      const totalProduce = cells.reduce((sum, cell) => sum + cell.produce, 0);
      const totalPeople = cells.reduce((sum, cell) => sum + cell.people, 0);
      for (const { cellId, people, produce } of cells) {
        const share = totalProduce ? produce / totalProduce : people / totalPeople;
        const goods: number[] = [];
        for (const [goodId, units] of market.rural.bought) goods[goodId] = units * share;
        const living = this.measure({ people, goods, needsCost, needsMet: 1 });
        this.rural.set(cellId, { people, earned: market.rural.earned * share, living });
      }
    }
  }

  private measure({ people, goods, needsCost, needsMet }: Consumption): Living {
    const bare = people * needsCost;
    const totalFactor = DEMAND_PRIORITY.reduce((sum, category) => sum + DEMAND_TARGET_FACTORS[category], 0);
    const covered = DEMAND_PRIORITY.map(() => 0);
    const values: number[] = needsMet === undefined ? [] : [bare]; // rural fields count as one good worth bare needs
    goods.forEach((units, goodId) => {
      const good = Goods.get(goodId);
      if (!good || !units) return;
      values.push(units * good.value);
      DEMAND_PRIORITY.forEach((category, index) => {
        covered[index] += units * (good.demandCoverage?.[category] || 0);
      });
    });

    // each need counts by its size
    const needs =
      needsMet ??
      DEMAND_PRIORITY.reduce((sum, category, index) => {
        const target = people * DEMAND_TARGET_FACTORS[category];
        return sum + (DEMAND_TARGET_FACTORS[category] / totalFactor) * Math.min(1, covered[index] / target);
      }, 0);
    const total = values.reduce((sum, value) => sum + value, 0);
    const comfort = bare ? total / bare : 0;
    const entropy = values.reduce(
      (sum, value) => (value > 0 ? sum - (value / total) * Math.log(value / total) : sum),
      0
    );
    const variety = total ? Math.exp(entropy) : 0;

    const comfortScore = comfort > 1 ? Math.min(1, Math.log(comfort) / Math.log(COMFORT_TOP)) : 0;
    const varietyScore = variety > 1 ? Math.min(1, (variety - 1) / (VARIETY_TOP - 1)) : 0;
    const prosperity = needs * (NEEDS_SHARE + COMFORT_SHARE * comfortScore + VARIETY_SHARE * varietyScore);
    return { needs, comfort, variety, prosperity };
  }
}

export const Prosperity = new ProsperityModule();
