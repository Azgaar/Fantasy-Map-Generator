// Ported from VerseEras game/js/world/generators/feral-system/astro/util.js (2026-10-25).
import type { Rng } from "./rng";

/** Clamp `value` to the inclusive range [lo, hi]. */
export function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

export interface DiceSpec {
  count: number;
  sides: number;
  add?: number;
}

/** Roll `count` dice of `sides` plus a flat `add` (may be negative). */
export function rollDice(rng: Rng, { count, sides, add = 0 }: DiceSpec): number {
  let total = add;
  for (let i = 0; i < count; i += 1) {
    total += rng.d(sides);
  }
  return total;
}

/** Roulette-wheel pick over parallel item/weight arrays. Non-positive weights are excluded. */
export function pickWeighted<T>(rng: Rng, items: readonly T[], weights: readonly number[]): T {
  const total = weights.reduce((sum, weight) => sum + Math.max(0, weight), 0);
  let roll = rng.range(0, total);

  for (let i = 0; i < items.length; i += 1) {
    const weight = Math.max(0, weights[i]);
    if (roll < weight) return items[i];
    roll -= weight;
  }

  // Floating-point edge: fall back to the last positively-weighted item.
  for (let i = items.length - 1; i >= 0; i -= 1) {
    if (weights[i] > 0) return items[i];
  }
  return items[items.length - 1];
}
