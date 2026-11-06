import { Markets } from "@/model/economy/markets-generator";
import { getDecima } from "@/model/units";
import type { Burg } from "./burgs-generator";
import { PROVISION_NEED, type State, States } from "./states-generator";

export type District = {
  province: number; // 0 for the crown lands
  seat: Burg | undefined; // the capital for the crown lands
  people: number; // population points, townspeople counted whole as budgets count them
  share: number; // of the state's people
  diversity: number; // share outside the state's culture and its capital's faith, each counting half
  remoteness: number; // its seat's distance from the capital, 1 at REMOTE_DECIMAS or overseas; 0 for the crown lands
  graft: number; // its corruption against the state's: above 1 where more remote or diverse than average
};

const REMOTE_DECIMAS = 2; // tenths of the map's diagonal from the capital at which a seat is fully remote
const REMOTE_CORRUPTION = 0.5; // how much more corrupt a fully remote district is than its state's average
const DIVERSITY_CORRUPTION = 1; // likewise a district of strangers only

class DistrictsModule {
  private sources: unknown[] = []; // the deals, states and provinces the cache describes
  private byState: District[][] = [];
  private ofCell: (District | undefined)[] = []; // as of indexing, so cells painted to another state since keep theirs

  get(stateId: number): District[] {
    this.index();
    return this.byState[stateId] ?? [];
  }

  /** The district a cell's people belong to, if any */
  at(cellId: number): District | undefined {
    this.index();
    return this.ofCell[cellId];
  }

  /** The district holding the capital, where the court and the army spend */
  getCapital(state: State): District | undefined {
    const capital = pack.burgs[state.capital];
    return capital ? this.at(capital.cell) : undefined;
  }

  /** Before administration: the state's, higher where more remote or diverse than average */
  getTendency(state: State, district: District): number {
    return Math.min(100, state.economy.budget.corruption * district.graft);
  }

  /** Percent officials pocket of what is spent in the district, curbed by administration */
  getCorruption(state: State, district: District, collected: number): number {
    return States.getCorruption(state, collected, this.getTendency(state, district));
  }

  /** By where each expense is spent, or by people when it spends nothing */
  getStateCorruption(state: State, collected: number): number {
    return (
      this.byExpenses(state, d => this.getCorruption(state, d, collected)) ?? States.getCorruption(state, collected)
    );
  }

  /** Corruption before administration, weighed as getStateCorruption */
  getStateTendency(state: State): number {
    return this.byExpenses(state, d => this.getTendency(state, d)) ?? state.economy.budget.corruption;
  }

  /** Districts' rate for the state by expense or else by people; null without districts */
  private byExpenses(state: State, rate: (district: District) => number): number | null {
    const districts = this.get(state.i);
    const capital = this.getCapital(state);
    if (!districts.length || !capital) return null;
    const atSeats = districts.reduce((sum, d) => sum + d.share * rate(d), 0);
    const { court, military, administration, infrastructure } = state.economy.budget;
    const total = court + military + administration + infrastructure;
    if (!total) return atSeats;
    return ((court + military) * rate(capital) + (administration + infrastructure) * atSeats) / total;
  }

  /** How fully last run's infrastructure spending served each district, 0 to 1, by district index */
  getInfrastructure(state: State): number[] {
    const districts = this.get(state.i);
    if (!state.economy) return [];
    const kept = districts.map(d => d.share * (1 - this.getCorruption(state, d, state.economy.collected) / 100));
    const total = kept.reduce((sum, value) => sum + value, 0);
    const spent = state.economy.spent.infrastructure || 0;
    return districts.map((d, k) =>
      d.people && total ? Math.min(1, (spent * kept[k]) / total / (PROVISION_NEED.infrastructure * d.people)) : 0
    );
  }

  private index(): void {
    const sources = [pack.deals, pack.states, pack.provinces, pack.cells?.i];
    if (sources.every((source, k) => source === this.sources[k])) return;
    this.sources = sources;
    this.byState = [];
    const { cells, burgs, provinces, states } = pack;
    this.ofCell = [];
    if (!cells?.i) return;

    const keys: Map<number, number>[] = []; // by state: province id (0 for the crown lands) -> district index
    const strangers: number[][] = [];
    const faiths: number[] = []; // by state: its capital's
    for (const cellId of cells.i) {
      const state = states[cells.state?.[cellId]];
      if (!state?.i || state.removed) continue;
      const province = provinces?.[cells.province?.[cellId] || 0];
      const seat = province && !province.removed ? burgs[province.burg] : undefined;
      const key =
        province && seat?.i && !seat.removed && seat.state === state.i && Markets.ofBurg(seat) ? province.i : 0;

      keys[state.i] ??= new Map();
      this.byState[state.i] ??= [];
      strangers[state.i] ??= [];
      const own = keys[state.i];
      const list = this.byState[state.i];
      let index = own.get(key);
      if (index === undefined) {
        index = list.length;
        own.set(key, index);
        list.push({
          province: key,
          seat: key ? seat : burgs[state.capital],
          people: 0,
          share: 0,
          diversity: 0,
          remoteness: 0,
          graft: 1
        });
        strangers[state.i].push(0);
      }
      this.ofCell[cellId] = list[index];

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
      list.forEach((district, k) => {
        district.share = total ? district.people / total : 0;
        district.diversity = district.people ? strangers[stateId][k] / district.people : 0;
        const seat = district.seat;
        if (!district.province || !seat || !capital) return;
        const overseas = cells.f?.[seat.cell] !== cells.f?.[capital.cell];
        reach ||= REMOTE_DECIMAS * getDecima();
        district.remoteness = overseas ? 1 : Math.min(1, Math.hypot(seat.x - capital.x, seat.y - capital.y) / reach);
      });
      const mean = (key: "remoteness" | "diversity") => list.reduce((sum, d) => sum + d.share * d[key], 0);
      const [remoteness, diversity] = [mean("remoteness"), mean("diversity")];
      for (const district of list)
        district.graft = Math.max(
          0,
          1 +
            REMOTE_CORRUPTION * (district.remoteness - remoteness) +
            DIVERSITY_CORRUPTION * (district.diversity - diversity)
        );
    });
  }
}

export const Districts = new DistrictsModule();
