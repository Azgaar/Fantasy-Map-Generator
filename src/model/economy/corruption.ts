import { Pack } from "@/model/graph/pack-generator";
import type { Burg } from "@/model/political/burgs-generator";
import type { State } from "@/model/political/states-generator";
import { getDecima } from "@/model/units";

/** What sets a province's corruption apart from its state's: its distance from the capital and its minorities */
export type ProvinceCorruption = {
  id: number; // the province; 0 for the state's cells outside any province
  burg: Burg | undefined; // the province's capital, the state's for cells outside any province
  people: number; // population points, urban counted whole as budgets count them
  share: number; // of the state's people
  diversity: number; // share outside the state's culture and its capital's faith, each counting half
  remoteness: number; // its capital's distance from the state's, 1 at REMOTE_DECIMAS or overseas
  factor: number; // its corruption against the state's: above 1 where more remote or diverse than average
};

const REMOTE_DECIMAS = 2; // tenths of the map's diagonal from the capital at which a province is fully remote
const REMOTE_CORRUPTION = 0.5; // how much more corrupt a fully remote province is than its state's average
const DIVERSITY_CORRUPTION = 1; // likewise a province of strangers only
const ADMINISTRATION_NEED = 0.1; // administration's money a person a day that curbs corruption fully
const ADMINISTRATION_CURB = 0.5; // the share of corruption a fully paid administration curbs

/** Percent of a state's spending officials pocket: its budget's, varied by province and curbed by administration */
class CorruptionModule {
  private sources: unknown[] = []; // the deals, states and provinces the cache describes
  private byState: ProvinceCorruption[][] = [];
  private ofCells: (ProvinceCorruption | undefined)[] = []; // as of indexing, which edits to cells and burgs renew

  /** In the province, curbed by administration */
  ofProvince(state: State, province: ProvinceCorruption, collected: number): number {
    return this.curb(state, collected, this.getTendency(state, province));
  }

  /** By where each expense is spent, or by people when it spends nothing */
  ofState(state: State, collected: number): number {
    return this.byExpenses(state, d => this.ofProvince(state, d, collected)) ?? this.curb(state, collected);
  }

  /** Before administration: the state's, higher where more remote or diverse than its average */
  getTendency(state: State, province: ProvinceCorruption): number {
    return Math.min(100, state.economy.budget.corruption * province.factor);
  }

  /** The state's before administration, weighed as ofState */
  getStateTendency(state: State): number {
    return this.byExpenses(state, d => this.getTendency(state, d)) ?? state.economy.budget.corruption;
  }

  /** Percent officials pocket once this much is collected, curbed as administration meets its need */
  curb(state: State, collected: number, corruption = state.economy.budget.corruption): number {
    const { administration } = state.economy.budget;
    const need = ADMINISTRATION_NEED * ((state.urban || 0) + (state.rural || 0));
    if (!corruption || !need || collected <= 0) return corruption;
    // pay = allotted × (1 − graft), graft = corruption × (1 − curb × pay ÷ need): solved for pay
    const allotted = (collected * administration) / 100;
    const graft = corruption / 100;
    const rest = 1 - (allotted * graft * ADMINISTRATION_CURB) / need;
    const pay = rest > 0 ? (allotted * (1 - graft)) / rest : Infinity;
    return corruption * (1 - ADMINISTRATION_CURB * Math.min(1, pay / need));
  }

  /** The state's provinces with people, and its cells outside any province */
  getProvinces(stateId: number): ProvinceCorruption[] {
    this.index();
    return this.byState[stateId] ?? [];
  }

  ofCell(cellId: number): ProvinceCorruption | undefined {
    this.index();
    return this.ofCells[cellId];
  }

  /** Where the capital is, and the court and the army spend */
  ofCapital(state: State): ProvinceCorruption | undefined {
    const capital = pack.burgs[state.capital];
    return capital ? this.ofCell(capital.cell) : undefined;
  }

  /** The provinces' rate for the state by expense or else by people; null without provinces */
  private byExpenses(state: State, rate: (province: ProvinceCorruption) => number): number | null {
    const provinces = this.getProvinces(state.i);
    const capital = this.ofCapital(state);
    if (!provinces.length || !capital) return null;
    const inProvinces = provinces.reduce((sum, d) => sum + d.share * rate(d), 0);
    const { court, military, administration, infrastructure } = state.economy.budget;
    const total = court + military + administration + infrastructure;
    if (!total) return inProvinces;
    return ((court + military) * rate(capital) + (administration + infrastructure) * inProvinces) / total;
  }

  private index(): void {
    const sources = [pack.deals, pack.states, pack.provinces, pack.cells?.i, Pack.revision];
    if (sources.every((source, k) => source === this.sources[k])) return;
    this.sources = sources;
    this.byState = [];
    this.ofCells = [];
    const { cells, burgs, provinces, states } = pack;
    if (!cells?.i) return;

    const positions: Map<number, number>[] = []; // by state: province id -> index in its list
    const strangers: number[][] = [];
    const faiths: number[] = []; // by state: its capital's
    for (const cellId of cells.i) {
      const state = states[cells.state?.[cellId]];
      if (!state?.i || state.removed) continue;
      const province = provinces?.[cells.province?.[cellId] || 0];
      const id = province && !province.removed && province.state === state.i ? province.i : 0;

      positions[state.i] ??= new Map();
      this.byState[state.i] ??= [];
      strangers[state.i] ??= [];
      const list = this.byState[state.i];
      let index = positions[state.i].get(id);
      if (index === undefined) {
        index = list.length;
        positions[state.i].set(id, index);
        const burg = id ? burgs[province.burg] : undefined;
        const own = burg?.i && !burg.removed && burg.state === state.i;
        const capital = own ? burg : burgs[state.capital];
        list.push({ id, burg: capital, people: 0, share: 0, diversity: 0, remoteness: 0, factor: 1 });
        strangers[state.i].push(0);
      }
      this.ofCells[cellId] = list[index];

      const burgId = cells.burg?.[cellId];
      const people = (cells.pop?.[cellId] || 0) + (burgId ? burgs[burgId]?.population || 0 : 0);
      list[index].people += people;
      faiths[state.i] ??= cells.religion?.[burgs[state.capital]?.cell ?? -1] || 0;
      if (cells.culture?.[cellId] !== state.culture) strangers[state.i][index] += people / 2;
      if ((cells.religion?.[cellId] || 0) !== faiths[state.i]) strangers[state.i][index] += people / 2;
    }

    let reach = 0; // read when first needed
    this.byState.forEach((list, stateId) => {
      const capital = burgs[states[stateId].capital];
      const total = list.reduce((sum, d) => sum + d.people, 0);
      list.forEach((province, k) => {
        province.share = total ? province.people / total : 0;
        province.diversity = province.people ? strangers[stateId][k] / province.people : 0;
        const burg = province.burg;
        if (!burg || !capital || burg === capital) return;
        const overseas = cells.f?.[burg.cell] !== cells.f?.[capital.cell];
        reach ||= REMOTE_DECIMAS * getDecima();
        province.remoteness = overseas ? 1 : Math.min(1, Math.hypot(burg.x - capital.x, burg.y - capital.y) / reach);
      });
      const mean = (key: "remoteness" | "diversity") => list.reduce((sum, d) => sum + d.share * d[key], 0);
      const [remoteness, diversity] = [mean("remoteness"), mean("diversity")];
      for (const province of list)
        province.factor = Math.max(
          0,
          1 +
            REMOTE_CORRUPTION * (province.remoteness - remoteness) +
            DIVERSITY_CORRUPTION * (province.diversity - diversity)
        );
    });
  }
}

export const Corruption = new CorruptionModule();
