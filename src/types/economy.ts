// The economy's data shapes, free of the models that work on them

import type { CultureType } from "@/data/culture-types";

export type DemandCategory = "food" | "utilities" | "construction" | "military" | "luxury";

export interface Good {
  i: number;

  // generation
  deposits?: [number, number]; // deposits on the map, min and max
  distribution?: string;
  biomeOutput?: Partial<Record<number, number>>;
  recipes?: Record<number, number>[];
  development?: number; // the least technological development, 0–100, a cell needs to produce it

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

export type Market = {
  i: number;
  centerBurgId: number;
  color: string;
  name?: string;
  goods: Record<number, { stock: number; price: number }>;
  rural?: RuralDay; // its rural people's last day, kept from the economy run
  feePaid?: number; // license fee its center burg paid its state in the last economy run
  note?: string;
};

/** A market's rural day: earnings, purchases, unsold produce, poll tax owed and paid by state */
export type RuralDay = {
  earned: number;
  spent: number;
  bought: [goodId: number, units: number][];
  kept?: [goodId: number, units: number][]; // their produce left unsold, which they keep; missing in maps saved before it
  margin?: number; // what the market's center took on their produce sold and their purchases, in no deal
  pollTax?: [stateId: number, owed: number, paid: number][];
};

/** sale, input, demand, kept, order: named by DEAL_KINDS */
export type DealKind = 0 | 1 | 2 | 3 | 4;

/** A burg's trade with a market in one good and kind, summed over the run; id: pack.deals index */
export type Deal = [
  burg: number,
  market: number,
  good: number,
  kind: DealKind,
  units: number,
  price: number, // average per unit
  tax: number, // sales tax: the burg's on a sale, the selling market's on a purchase
  tariff: number, // the importer's, on an import
  carriage: number // average per unit, between the market's center and the burg, in the price
];

/** One trade's amounts: price and carriage per unit, tax and tariff in total */
export type Transaction = { units: number; price: number; tax: number; tariff?: number; carriage?: number };

/** Units of each good a burg made in the last run, deposit output included */
export type BurgProduction = [good: number, units: number][];
