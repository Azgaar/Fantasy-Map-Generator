import Alea from "alea";

export interface CoastlineSettings {
  maxDepth: number; // max recursion depth per edge
  baseAmplitude: number; // peak displacement (scales with √edgeLength)
  amplitudeDecay: number; // amplitude multiplier per recursion level
  minEdge: number; // edges shorter than this are never subdivided
  smoothThreshold: number; // profile values below this → zero displacement
  roughnessContrast: number; // power applied to normalised roughness profile
}

export const coastSettings: CoastlineSettings = {
  maxDepth: 4,
  baseAmplitude: 2,
  amplitudeDecay: 0.55,
  minEdge: 1.2,
  smoothThreshold: 0.25,
  roughnessContrast: 1.5
};

export const PROFILE_SIZE = 256;

// Build a smooth closed roughness envelope via sum-of-cosine harmonics.
// Intrinsically seam-free; result raised to `contrast` power for calm/rough contrast.
export function makeRoughnessProfile(rand: () => number, contrast: number): Float32Array {
  const profile = new Float32Array(PROFILE_SIZE);
  const numHarmonics = 3 + Math.floor(rand() * 3); // 3, 4 or 5
  for (let k = 1; k <= numHarmonics; k++) {
    const amp = rand();
    const phase = rand() * Math.PI * 2;
    for (let i = 0; i < PROFILE_SIZE; i++) {
      profile[i] += amp * Math.cos((2 * Math.PI * k * i) / PROFILE_SIZE + phase);
    }
  }
  let min = Infinity,
    max = -Infinity;
  for (const v of profile) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min || 1;
  for (let i = 0; i < PROFILE_SIZE; i++) {
    profile[i] = ((profile[i] - min) / range) ** contrast;
  }
  return profile;
}

/** Linear interpolation into the envelope at normalised perimeter position t ∈ [0, 1). */
function sampleProfile(profile: Float32Array, t: number): number {
  const pos = (((t % 1) + 1) % 1) * PROFILE_SIZE;
  const i = Math.floor(pos) % PROFILE_SIZE;
  const f = pos - Math.floor(pos);
  return profile[i] * (1 - f) + profile[(i + 1) % PROFILE_SIZE] * f;
}

/** Circular midpoint of two normalised perimeter positions, handling the 0/1 seam. */
function midT(t0: number, t1: number): number {
  const diff = t1 - t0;
  if (Math.abs(diff) <= 0.5) return t0 + diff / 2;
  const t = t0 + (diff - Math.sign(diff)) / 2;
  return ((t % 1) + 1) % 1;
}

/** Recursively subdivide an edge, inserting displaced midpoints in rough zones. */
function subdivideEdge(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  t0: number,
  t1: number,
  depth: number,
  amplitude: number,
  profile: Float32Array,
  rand: () => number,
  resultPts: [number, number][],
  settings: CoastlineSettings
): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (depth === 0 || len < settings.minEdge) return;

  const tm = midT(t0, t1);
  const roughness = sampleProfile(profile, tm);
  if (roughness < settings.smoothThreshold) return;

  const px = -dy / len;
  const py = dx / len;
  const disp = (rand() - 0.5) * Math.sqrt(len) * amplitude * roughness;
  const mx = (x0 + x1) / 2 + px * disp;
  const my = (y0 + y1) / 2 + py * disp;

  const nextAmp = amplitude * settings.amplitudeDecay;
  subdivideEdge(x0, y0, mx, my, t0, tm, depth - 1, nextAmp, profile, rand, resultPts, settings);
  resultPts.push([mx, my]);
  subdivideEdge(mx, my, x1, y1, tm, t1, depth - 1, nextAmp, profile, rand, resultPts, settings);
}

export interface FractalizedShape {
  points: [number, number][];
  origIndices: number[]; // index in points[] where original vertex i lives
}

// Shared by the renderer and the dialog preview — accepts an explicit PRNG.
export function fractalizeWithRand(
  points: [number, number][],
  rand: () => number,
  settings: CoastlineSettings
): FractalizedShape {
  const profile = makeRoughnessProfile(rand, settings.roughnessContrast);

  const n = points.length;
  let total = 0;
  const segLens = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[(i + 1) % n];
    const dx = x1 - x0,
      dy = y1 - y0;
    segLens[i] = Math.sqrt(dx * dx + dy * dy);
    total += segLens[i];
  }
  let cum = 0;
  const tParams = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    tParams[i] = cum / total;
    cum += segLens[i];
  }

  const resultPts: [number, number][] = [];
  const origIndices: number[] = [];

  for (let i = 0; i < n; i++) {
    origIndices.push(resultPts.length);
    resultPts.push(points[i]);
    const [x0, y0] = points[i];
    const [x1, y1] = points[(i + 1) % n];
    subdivideEdge(
      x0,
      y0,
      x1,
      y1,
      tParams[i],
      tParams[(i + 1) % n],
      settings.maxDepth,
      settings.baseAmplitude,
      profile,
      rand,
      resultPts,
      settings
    );
  }

  return {points: resultPts, origIndices};
}

export function fractalizeCoastline(
  points: [number, number][],
  featureIndex: number,
  settings: CoastlineSettings = coastSettings
): FractalizedShape {
  if (points.length < 3) return {points, origIndices: points.map((_, i) => i)};
  const rand = Alea(`${seed}_c${featureIndex}`);
  return fractalizeWithRand(points, rand, settings);
}

