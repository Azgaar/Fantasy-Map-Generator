// What people need and how they spend: read by the run, the accounts and the dialogs

import type { DemandCategory, Good } from "@/types/economy";

export const DEMAND_PRIORITY = [
  "food",
  "utilities",
  "construction",
  "military",
  "luxury"
] as const satisfies readonly DemandCategory[];

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
}; // the most a person buys beyond needs, in days of need: richer people eat only so much more

export const WEALTH_WANTS: readonly DemandCategory[] = ["luxury"]; // wants that grow with affluence; staples stay capped, or the first in line buy them out

export const SAVINGS_RATE = 0.32; // share of a day's income households keep
export const VARIETY = 2.8; // spending over a need's goods goes by (price per coverage)^-VARIETY: higher buys only the cheapest
export const NOVELTY = 5.3; // how much more a buyer pays per tenfold of affluence for a good it has had none of yet

/** Spending shares: cheaper coverage gets more, every option gets some */
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
