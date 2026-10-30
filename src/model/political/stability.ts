// Stability after the last economy run, district by district: how well its people live, the state's court and clergy and
// a kept army hold it together against remoteness from the capital, minorities, corruption and the tax burden.
// A state's parts are its districts' by their people. Worked out on demand, nothing saved

import { Prosperity } from "@/model/economy/prosperity";
import { StateEconomy } from "@/model/economy/state-economy";
import { minmax } from "@/utils/number-utils";
import { type District, Districts } from "./districts";
import { Military } from "./military-generator";
import { States } from "./states-generator";

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
export type StateStability = { stability: number; parts: Record<StabilityPart, number> };
export type DistrictStability = StateStability & { district: District };

const BASE = 0.5;
const PROSPERITY = 0.5; // added at PROSPERITY_TOP prosperity or more
const PROSPERITY_TOP = 0.5;
const COURT = 0.25; // added by a fully provided court and clergy
const ARMY = 0.15; // an army of ARMY_SHARE of the people or more: added when fully kept, taken when not kept at all
const ARMY_SHARE = 0.005;
const REMOTENESS = 0.15; // taken from a fully remote district
const DIVERSITY = 0.2; // taken from a district of strangers only
const CORRUPTION = 0.2; // taken at CORRUPTION_TOP percent or more
const CORRUPTION_TOP = 40;
const BURDEN = 0.15; // taken when taxes are BURDEN_TOP of the product or more
const BURDEN_TOP = 0.5;

class StabilityModule {
  private sources: unknown[] = []; // what the districts are indexed on: their objects key the cache
  private prosperity = new Map<District, number>(); // its people's, by their numbers

  /** A state's, from 0 (falling apart) to 1 (unshakable): its districts' parts by their people, summed; null for the neutral lands and before the economy has run */
  get(stateId: number): StateStability | null {
    const districts = this.getDistricts(stateId);
    if (!districts.length) return null;
    const parts = Object.fromEntries(
      STABILITY_PARTS.map(part => [part, districts.reduce((sum, d) => sum + d.district.share * d.parts[part], 0)])
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

  /** A province's district's: its own if its seat has a market, else the crown lands' */
  getProvince(provinceId: number): DistrictStability | null {
    const province = pack.provinces?.[provinceId];
    if (!provinceId || !province || province.removed) return null;
    const district = Districts.at(province.center);
    return this.getDistricts(province.state).find(d => d.district === district) ?? null;
  }

  /** Each district's, in the state's district order */
  getDistricts(stateId: number): DistrictStability[] {
    const state = pack.states[stateId];
    const accounts = StateEconomy.getAccounts(stateId);
    if (!stateId || !state || state.removed || accounts?.prosperity == null) return [];
    this.index();

    const { scale, urbanization } = options.map.units.population;
    const people = ((state.rural || 0) + (state.urban || 0) * urbanization.rate) * scale;
    const troops = (state.military ?? []).reduce((sum, regiment) => sum + (regiment.a || 0), 0);
    const army = people ? Math.min(1, troops / people / ARMY_SHARE) : 0;
    const shared = {
      base: BASE,
      court: COURT * States.getProvision(state, "court"),
      army: ARMY * army * (2 * Military.getUpkeep(stateId) - 1),
      burden: -BURDEN * Math.min(1, accounts.product > 0 ? accounts.taxes / accounts.product / BURDEN_TOP : 0)
    };

    return Districts.get(stateId).map(district => {
      const prosperity = this.prosperity.get(district) ?? accounts.prosperity!;
      const corruption = Districts.getCorruption(state, district, state.economy.collected);
      const parts: Record<StabilityPart, number> = {
        ...shared,
        prosperity: PROSPERITY * Math.min(1, prosperity / PROSPERITY_TOP),
        remoteness: -REMOTENESS * district.remoteness,
        diversity: -DIVERSITY * district.diversity,
        corruption: -CORRUPTION * Math.min(1, corruption / CORRUPTION_TOP)
      };
      const stability = minmax(
        STABILITY_PARTS.reduce((sum, part) => sum + parts[part], 0),
        0,
        1
      );
      return { district, stability, parts };
    });
  }

  /** Each district's prosperity: its townspeople's and rural people's by their numbers */
  private index(): void {
    const sources = [pack.deals, pack.states, pack.provinces, pack.cells?.i];
    if (sources.every((source, k) => source === this.sources[k])) return;
    this.sources = sources;
    const sums = new Map<District, [number, number]>(); // people, people × prosperity
    const add = (cellId: number, people: number, prosperity: number | undefined) => {
      const district = Districts.at(cellId);
      if (!district || !people || prosperity === undefined) return;
      const sum = sums.get(district) ?? [0, 0];
      sums.set(district, sum);
      sum[0] += people;
      sum[1] += people * prosperity;
    };
    for (const burg of pack.burgs)
      if (burg.i && !burg.removed) add(burg.cell, burg.population || 0, Prosperity.getBurg(burg.i)?.prosperity);
    for (const cellId of pack.cells.i)
      add(cellId, pack.cells.pop[cellId] || 0, Prosperity.getRuralCell(cellId)?.living.prosperity);
    this.prosperity = new Map([...sums].map(([district, [people, total]]) => [district, total / people]));
  }
}

export const Stability = new StabilityModule();
