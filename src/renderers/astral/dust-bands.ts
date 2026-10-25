// Dust bands: cell elevation bucketed evenly over the land range; 0 means void

const SEA_LEVEL = 20;
const PEAK = 100;

export function buildDustBands(heights: ArrayLike<number>, levels: number): Uint8Array {
  const bands = new Uint8Array(heights.length);
  const span = (PEAK - SEA_LEVEL) / levels;
  for (let i = 0; i < heights.length; i++) {
    const height = heights[i];
    if (height < SEA_LEVEL) continue;
    bands[i] = Math.min(levels, 1 + Math.floor((height - SEA_LEVEL) / span));
  }
  return bands;
}
