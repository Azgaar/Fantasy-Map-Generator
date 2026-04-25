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
  baseAmplitude: 1.5,
  amplitudeDecay: 0.9,
  minEdge: 1,
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

export function fractalize(
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
  return fractalize(points, rand, settings);
}

/**
 * Build a closed SVG path string applying the correct curve algorithm per span:
 * Smooth span: Q midpoint B-spline — identical to curveBasisClosed. Produces flowing arcs that hide Voronoi angularity.
 * Jagged span: centripetal Catmull-Rom (α=0.5) through every fractal sub-point. Rounds sharp kinks into gentle curves.
 */
export function buildCoastlinePath(shape: FractalizedShape) {
  const {points: pts, origIndices} = shape;
  const N = pts.length;
  const M = origIndices.length;
  if (M < 3) return "";

  const smooth: boolean[] = new Array(M);
  for (let i = 0; i < M; i++) {
    const a = origIndices[i];
    const b = origIndices[(i + 1) % M];
    smooth[i] = (b > a ? b - a : b + N - a) === 1;
  }

  // Start at the B-spline midpoint of the last→first span when that span is
  // smooth so the closed loop is fully seamless; otherwise start at vertex 0.
  const p0 = pts[origIndices[0]];
  const pL = pts[origIndices[M - 1]];
  let atMid = smooth[M - 1];
  const sx = atMid ? (pL[0] + p0[0]) / 2 : p0[0];
  const sy = atMid ? (pL[1] + p0[1]) / 2 : p0[1];
  const d: string[] = [`M${sx},${sy}`];

  for (let i = 0; i < M; i++) {
    const ci = origIndices[i];
    const ni = origIndices[(i + 1) % M];
    const [cpx, cpy] = pts[ci];
    const [npx, npy] = pts[ni];

    if (smooth[i]) {
      // Q midpoint B-spline ≡ curveBasisClosed.
      // When arriving from a jagged span the cursor is already at cpx,cpy
      // so just line to the midpoint instead of emitting a degenerate Q.
      const mx = (cpx + npx) / 2;
      const my = (cpy + npy) / 2;
      d.push(atMid ? `Q${cpx},${cpy} ${mx},${my}` : `L${mx},${my}`);
      atMid = true;
    } else {
      // Step from the B-spline midpoint to the original vertex when needed.
      if (atMid) d.push(`L${cpx},${cpy}`);

      // Centripetal Catmull-Rom through every fractal sub-segment.
      const end = ni > ci ? ni : ni + N;
      for (let j = ci; j < end; j++) {
        const a = pts[j % N];
        const b = pts[(j + 1) % N];
        const prev = pts[(j - 1 + N) % N];
        const nnext = pts[(j + 2) % N];
        // Catmull-Rom tangents → Hermite control points (tension ≈ 0.25 for less radical curvature)
        const cp1x = a[0] + (b[0] - prev[0]) / 8;
        const cp1y = a[1] + (b[1] - prev[1]) / 8;
        const cp2x = b[0] - (nnext[0] - a[0]) / 8;
        const cp2y = b[1] - (nnext[1] - a[1]) / 8;
        d.push(`C${cp1x},${cp1y} ${cp2x},${cp2y} ${b[0]},${b[1]}`);
      }
      atMid = false;
    }
  }

  return d.join("");
}

