import { Grid } from "../../core/types";

export function bakeErosion(
  grid: Grid,
  heights: Uint8Array,
  flowDirections: Int32Array,
  iterations = 3
): Uint8Array {
  const pointsN = heights.length;
  const eroded = new Uint8Array(heights);

  for (let iter = 0; iter < iterations; iter++) {
    const sediment = new Float32Array(pointsN);

    // Step 1: Erode (dissolve sediment from high slopes)
    for (let i = 0; i < pointsN; i++) {
      if (eroded[i] < 20) continue; // skip sea
      const next = flowDirections[i];
      if (next !== -1) {
        const slope = Math.max(0, eroded[i] - eroded[next]);
        if (slope > 0) {
          const amount = slope * 0.05; // 5% of slope gets eroded
          eroded[i] = Math.max(Math.round(eroded[i] - amount), 20);
          sediment[next] += amount;
        }
      }
    }

    // Step 2: Deposit (sediment settles downhill)
    for (let i = 0; i < pointsN; i++) {
      if (sediment[i] > 0) {
        eroded[i] = Math.min(Math.round(eroded[i] + sediment[i]), 100);
      }
    }
  }

  return eroded;
}
