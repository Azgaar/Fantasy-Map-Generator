// The Points slider: a density step, and the cell count each step stands for. The step is what is
// stored; the count is derived here and nowhere else. See docs/architecture/configuration.md
export const POINTS_BY_DENSITY: Record<number, number> = {
  1: 1000,
  2: 2000,
  3: 5000,
  4: 10000,
  5: 20000,
  6: 30000,
  7: 40000,
  8: 50000,
  9: 60000,
  10: 70000,
  11: 80000,
  12: 90000,
  13: 100000,
  14: 150000,
  15: 200000,
  16: 250000,
  17: 300000,
  18: 400000,
  19: 500000,
  20: 750000,
  21: 1000000,
  22: 1500000,
  23: 2000000,
  24: 2500000,
  25: 3000000
};

export const DENSITY_STEPS = Object.keys(POINTS_BY_DENSITY).map(Number);
export const MIN_DENSITY = Math.min(...DENSITY_STEPS);
export const MAX_DENSITY = Math.max(...DENSITY_STEPS);
export const DEFAULT_DENSITY = 4;

export function getPointsNumber(density: number): number {
  return POINTS_BY_DENSITY[density] ?? POINTS_BY_DENSITY[DEFAULT_DENSITY];
}
