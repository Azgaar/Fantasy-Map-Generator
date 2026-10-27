// Ported from VerseEras game/js/state/rng.js (2026-10-25): the createRng surface over alea.
import Alea from "alea";

export interface Rng {
  next: () => number;
  range: (lo: number, hi: number) => number;
  int: (lo: number, hi: number) => number;
  d: (sides: number) => number;
  choice: <T>(items: readonly T[]) => T;
  chance: (p: number) => boolean;
}

export function createRng(seed: string): Rng {
  const random = Alea(seed);
  const next = () => random();
  const range = (lo: number, hi: number) => lo + (hi - lo) * next();

  return {
    next,
    range,
    int: (lo, hi) => Math.floor(range(lo, hi + 1)),
    d: sides => Math.floor(range(1, sides + 1)),
    choice: <T>(items: readonly T[]) => items[Math.floor(items.length * next())],
    chance: p => next() < p
  };
}
