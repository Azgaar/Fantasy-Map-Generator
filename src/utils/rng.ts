// A seeded dice stream over alea. Moved out of the Astral generator (ported from VerseEras
// game/js/state/rng.js, 2026-10-25) because anything that must be reproducible *without*
// disturbing the main `Math.random` stream needs its own source — see the culture traits layer.
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
