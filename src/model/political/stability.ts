import { Accounts } from "@/model/economy/accounts";
import { Corruption, type ProvinceCorruption } from "@/model/economy/corruption";
import { Prosperity } from "@/model/economy/prosperity";
import { StateOrders } from "@/model/economy/state-orders";
import { Pack } from "@/model/graph/pack-generator";
import { minmax } from "@/utils/number-utils";
import { Military } from "./military-generator";

export const STABILITY_PARTS = [
  "base",
  "prosperity",
  "court",
  "army",
  "remoteness",
  "diversity",
  "corruption",
  "burden"
] as const;
export type StabilityPart = (typeof STABILITY_PARTS)[number];
type StateStability = { stability: number; parts: Record<StabilityPart, number> };
type ProvinceStability = StateStability & { province: ProvinceCorruption };

const BASE = 0.5;
const PROSPERITY = 0.5; // added at PROSPERITY_TOP prosperity or more
const PROSPERITY_TOP = 0.5;
const COURT = 0.25; // added by a fully provided court and clergy
const ARMY = 0.15; // an army of ARMY_SHARE of the people or more: added when fully kept, taken when not kept at all
const ARMY_SHARE = 0.005;
const REMOTENESS = 0.15; // taken from a fully remote province
const DIVERSITY = 0.2; // taken from a province of strangers only
const CORRUPTION = 0.2; // taken at CORRUPTION_TOP percent or more
const CORRUPTION_TOP = 40;
const BURDEN = 0.15; // taken when taxes are BURDEN_TOP of the product or more
const BURDEN_TOP = 0.5;

class StabilityModule {
  private sources: unknown[] = []; // what the provinces are indexed on: their objects key the cache
  private prosperity = new Map<ProvinceCorruption, number>(); // its people's, by their numbers

  /** A state's, from 0 (falling apart) to 1 (unshakable); null for neutrals and before the run */
  get(stateId: number): StateStability | null {
    const provinces = this.getProvinces(stateId);
    if (!provinces.length) return null;
    const parts = Object.fromEntries(
      STABILITY_PARTS.map(part => [part, provinces.reduce((sum, d) => sum + d.province.share * d.parts[part], 0)])
    ) as Record<StabilityPart, number>;
    return {
      stability: minmax(
        STABILITY_PARTS.reduce((sum, part) => sum + parts[part], 0),
        0,
        1
      ),
      parts
    };
  }

  getProvince(provinceId: number): ProvinceStability | null {
    const province = pack.provinces?.[provinceId];
    if (!provinceId || !province || province.removed) return null;
    return this.getProvinces(province.state).find(d => d.province.id === provinceId) ?? null;
  }

  /** Each province's, and of the state's cells outside any province */
  getProvinces(stateId: number): ProvinceStability[] {
    const state = pack.states[stateId];
    const accounts = Accounts.ofState(stateId);
    if (!stateId || !state || state.removed || accounts?.prosperity == null) return [];
    this.index();

    const points = (state.rural || 0) + (state.urban || 0) * options.map.units.population.urbanization.rate;
    const troops = (state.military ?? []).reduce((sum, regiment) => sum + (regiment.a || 0), 0);
    const army = points ? Math.min(1, troops / points / ARMY_SHARE) : 0;
    const shared = {
      base: BASE,
      court: COURT * StateOrders.getProvision(state, "court"),
      army: ARMY * army * (2 * Military.getUpkeep(stateId) - 1),
      burden: -BURDEN * Math.min(1, accounts.product > 0 ? accounts.taxes / accounts.product / BURDEN_TOP : 0)
    };

    return Corruption.getProvinces(stateId).map(province => {
      const prosperity = this.prosperity.get(province) ?? accounts.prosperity!;
      const corruption = Corruption.ofProvince(state, province, state.economy.collected);
      const parts: Record<StabilityPart, number> = {
        ...shared,
        prosperity: PROSPERITY * Math.min(1, prosperity / PROSPERITY_TOP),
        remoteness: -REMOTENESS * province.remoteness,
        diversity: -DIVERSITY * province.diversity,
        corruption: -CORRUPTION * Math.min(1, corruption / CORRUPTION_TOP)
      };
      const stability = minmax(
        STABILITY_PARTS.reduce((sum, part) => sum + parts[part], 0),
        0,
        1
      );
      return { province, stability, parts };
    });
  }

  /** Each province's prosperity: its urban and rural people's by their numbers */
  private index(): void {
    const sources = [pack.deals, pack.states, pack.provinces, pack.cells?.i, Pack.revision];
    if (sources.every((source, k) => source === this.sources[k])) return;
    this.sources = sources;
    const sums = new Map<ProvinceCorruption, [number, number]>(); // people, people × prosperity
    const add = (cellId: number, people: number, prosperity: number | undefined) => {
      const province = Corruption.ofCell(cellId);
      if (!province || !people || prosperity === undefined) return;
      const sum = sums.get(province) ?? [0, 0];
      sums.set(province, sum);
      sum[0] += people;
      sum[1] += people * prosperity;
    };
    for (const burg of pack.burgs)
      if (burg.i && !burg.removed) add(burg.cell, burg.population || 0, Prosperity.getBurg(burg.i)?.prosperity);
    for (const cellId of pack.cells.i)
      add(cellId, pack.cells.pop[cellId] || 0, Prosperity.getRuralCell(cellId)?.living.prosperity);
    this.prosperity = new Map([...sums].map(([province, [people, total]]) => [province, total / people]));
  }
}

export const Stability = new StabilityModule();
