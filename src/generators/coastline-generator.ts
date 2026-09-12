import type { Point } from "@/types/global";
import { clipPoly, minmax, round } from "../utils";
import type { Feature } from "./features-generator";

declare global {
  // vendored lib, loaded as a classic script from public/libs/simplify.js
  var simplify: (points: Point[], tolerance: number, highestQuality?: boolean) => Point[];
}

export interface CoastlineSettings {
  enabled: boolean; // master toggle — false bypasses all fractalization
  maxDepth: number; // max recursion depth per edge
  baseAmplitude: number; // peak displacement (scales with √edgeLength)
  amplitudeDecay: number; // amplitude multiplier per recursion level
  minEdge: number; // edges shorter than this are never subdivided
  smoothThreshold: number; // roughness values below this → zero displacement
  roughnessContrast: number; // power applied to the roughness field
  roughnessScale: number; // size of a calm or rough stretch of coast, in map units
  lakeSmoothThreshMult: number; // smooth-threshold multiplier for lake shores (1 = same as ocean, higher = calmer)
  variant: number; // reshuffles the coastlines of the map, changing nothing else about them
}

export interface FractalizedShape {
  points: Point[];
  origIndices: number[]; // index in points[] where original vertex i lives
}

/** The coastline every new map starts from. The one definition of these values */
const DEFAULT_COASTLINE: Readonly<CoastlineSettings> = {
  enabled: true,
  maxDepth: 4,
  baseAmplitude: 1.5,
  amplitudeDecay: 0.9,
  minEdge: 1,
  smoothThreshold: 0.25,
  roughnessContrast: 1.5,
  roughnessScale: 60,
  lakeSmoothThreshMult: 2.0,
  variant: 0
};

const SIMPLIFICATION_TOLERANCE = 0.3;

// The noise is indexed by geometry, never by position in a sequence: the displacement of a segment is a
// pure function of where that segment is, so editing one vertex leaves the rest of the coast untouched.

const QUANTUM = 64; // coordinates are keyed to 1/64 of a map unit, below which a move changes nothing
const OCTAVE_WEIGHT = 0.35; // share of the roughness field coming from the half-scale octave
const FIELD_STRETCH = 1.9; // interpolated noise clusters around ½; spread it like the profile it replaces

/**
 * Owns everything coastlines: the user-tunable settings, the fractal displacement of the
 * feature outlines and the SVG path built from them. Renderers and editors ask it for a path,
 * they never fractalize on their own.
 */
class CoastlineGenerator {
  /** Settings of the map on screen: a fact, read at render time and saved with the file */
  get settings(): CoastlineSettings {
    return options.map.coastline;
  }

  /** Apply a user change: it shapes this map, and the next map starts from it */
  update(change: Partial<CoastlineSettings>): void {
    Object.assign(options.map.coastline, change);
    Options.save();
  }

  getDefaultSettings(): CoastlineSettings {
    return { ...DEFAULT_COASTLINE };
  }

  /** The seed a feature's coastline is generated from: its own, and the same after any redraw */
  featureSeed(featureId: number, settings = this.settings): number {
    return this.seedFrom(`${options.map.seed}_c${featureId}_${settings.variant}`);
  }

  /** Stable integer seed for a seed string, so a map and a feature keep their coastline */
  seedFrom(text: string): number {
    let h = 0x811c9dc5 | 0;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
    return h | 0;
  }

  /** The settings a feature's shore is displaced with: a lake shore is calmer by its multiplier */
  shoreSettings(feature: Pick<Feature, "type" | "coastline">): CoastlineSettings {
    const settings = feature.coastline || this.settings;
    const { lakeSmoothThreshMult, smoothThreshold } = settings;
    if (feature.type !== "lake" || lakeSmoothThreshMult === 1) return settings;
    return { ...settings, smoothThreshold: Math.min(1, smoothThreshold * lakeSmoothThreshMult) };
  }

  /** The polygon a feature's coastline is built from: its vertices, simplified and clipped to the map */
  getFeatureOutline(feature: Feature): Point[] {
    const points = feature.vertices.map(vertex => pack.vertices.p[vertex]);
    if (points.some(point => point === undefined)) {
      ERROR && console.error("Undefined point in getFeatureOutline");
      return [];
    }

    const simplifiedPoints = simplify(points, SIMPLIFICATION_TOLERANCE);
    return clipPoly(simplifiedPoints, options.map.graph.width, options.map.graph.height, 1);
  }

  /** The feature outline displaced into its coastline. Seeded per feature, so it keeps its shape no matter what else was generated or drawn before */
  getFeatureShape(feature: Feature, outline = this.getFeatureOutline(feature)): FractalizedShape {
    const settings = this.shoreSettings(feature);
    if (outline.length < 3 || !settings.enabled) return { points: outline, origIndices: outline.map((_, i) => i) };
    return this.fractalizePolygon(outline, this.featureSeed(feature.i, settings), settings);
  }

  /** Closed SVG path of the feature outline, fractalized as configured */
  getFeaturePath(feature: Feature): string {
    const outline = this.getFeatureOutline(feature);
    if (!outline.length) return "";
    return `${round(this.buildCoastlinePath(this.getFeatureShape(feature, outline)))}Z`;
  }

  /** Displace a polygon into a naturalistic coastline. Deterministic: the same seed and settings repeat the shape */
  fractalize(points: Point[], seed: number, settings = this.settings): FractalizedShape {
    return this.fractalizePolygon(points, seed, settings);
  }

  buildPath(shape: FractalizedShape): string {
    return this.buildCoastlinePath(shape);
  }

  /** Roughness of the field along a line of points: which stretches of a coast are jagged and which stay calm */
  sampleRoughness(seed: number, points: Point[], settings = this.settings): Float32Array {
    const profile = new Float32Array(points.length);
    for (let i = 0; i < points.length; i++) {
      profile[i] = this.roughnessAt(seed, points[i][0], points[i][1], settings);
    }
    return profile;
  }

  /**
   * How rough the coast is at a place, in [0, 1]. Two octaves of value noise, so a coast has both large
   * calm and rough stretches and smaller variation inside them. Roughness belongs to the place, not to a
   * position along the perimeter: that is what keeps a local edit local.
   */
  roughnessAt(seed: number, x: number, y: number, settings = this.settings): number {
    const scale = Math.max(settings.roughnessScale, 1);
    const base = this.fieldAt(seed, x, y, scale);
    const detail = this.fieldAt(seed ^ 0x9e3779b9, x, y, scale / 2);
    const combined = base * (1 - OCTAVE_WEIGHT) + detail * OCTAVE_WEIGHT;

    // interpolated noise clusters around ½, while the harmonic profile this replaces was stretched over
    // its whole range; without the same spread here the contrast below would flatten every coast
    const spread = minmax((combined - 0.5) * FIELD_STRETCH + 0.5, 0, 1);
    return spread ** settings.roughnessContrast;
  }

  private fractalizePolygon(points: Point[], seed: number, settings: CoastlineSettings): FractalizedShape {
    const n = points.length;
    const resultPts: Point[] = [];
    const origIndices: number[] = [];

    for (let i = 0; i < n; i++) {
      origIndices.push(resultPts.length);
      resultPts.push(points[i]);

      const [a, b] = [points[i], points[(i + 1) % n]];
      if (this.isOnBorder(a) && this.isOnBorder(b)) continue; // skip edges running along the map border

      this.subdivideEdge(a, b, settings.maxDepth, settings.baseAmplitude, seed, resultPts, settings);
    }

    return { points: resultPts, origIndices };
  }

  /** Recursively subdivide an edge, inserting displaced midpoints in rough zones */
  private subdivideEdge(
    a: Point,
    b: Point,
    depth: number,
    amplitude: number,
    seed: number,
    resultPts: Point[],
    settings: CoastlineSettings
  ): void {
    const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
    const len = Math.sqrt(dx * dx + dy * dy);
    if (depth === 0 || len < settings.minEdge || amplitude === 0) return; // no amplitude: the arc stays as it is

    const [mx, my] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const roughness = this.roughnessAt(seed, mx, my, settings);
    if (roughness < settings.smoothThreshold) return;

    const disp = (this.segmentNoise(seed, a, b, depth) - 0.5) * Math.sqrt(len) * amplitude * roughness;
    const mid: Point = [mx + (-dy / len) * disp, my + (dx / len) * disp];

    const nextAmp = amplitude * settings.amplitudeDecay;
    this.subdivideEdge(a, mid, depth - 1, nextAmp, seed, resultPts, settings);
    resultPts.push(mid);
    this.subdivideEdge(mid, b, depth - 1, nextAmp, seed, resultPts, settings);
  }

  /** One displacement per segment, keyed by the segment's own ends */
  private segmentNoise(seed: number, [x0, y0]: Point, [x1, y1]: Point, depth: number): number {
    const quantize = (value: number) => Math.round(value * QUANTUM);
    return this.noise(seed, quantize(x0), quantize(y0), quantize(x1), quantize(y1), depth);
  }

  /** Smoothstep-interpolated value noise on a lattice of `scale` map units */
  private fieldAt(seed: number, x: number, y: number, scale: number): number {
    const [fx, fy] = [x / scale, y / scale];
    const [ix, iy] = [Math.floor(fx), Math.floor(fy)];
    const [tx, ty] = [fx - ix, fy - iy];
    const [sx, sy] = [tx * tx * (3 - 2 * tx), ty * ty * (3 - 2 * ty)];

    const corner = (cx: number, cy: number) => this.noise(seed, cx, cy);
    const top = corner(ix, iy) * (1 - sx) + corner(ix + 1, iy) * sx;
    const bottom = corner(ix, iy + 1) * (1 - sx) + corner(ix + 1, iy + 1) * sx;
    return top * (1 - sy) + bottom * sy;
  }

  /** Deterministic value in [0, 1) for a tuple of integers (murmur3-style mixing) */
  private noise(seed: number, ...values: number[]): number {
    let h = seed | 0;
    for (const value of values) {
      h = Math.imul(h ^ (value | 0), 0x5bd1e995);
      h ^= h >>> 13;
    }
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  private isOnBorder([x, y]: Point): boolean {
    return x === 0 || x === options.map.graph.width || y === 0 || y === options.map.graph.height;
  }

  /**
   * Build a closed SVG path string applying the correct curve algorithm per span:
   * Smooth span: Q midpoint B-spline — identical to curveBasisClosed. Produces flowing arcs that hide Voronoi angularity.
   * Jagged span: centripetal Catmull-Rom (α=0.5) through every fractal sub-point. Rounds sharp kinks into gentle curves.
   */
  private buildCoastlinePath({ points, origIndices }: FractalizedShape): string {
    const N = points.length;
    const M = origIndices.length;
    if (N < 3 || M < 3) return "";

    const smooth: boolean[] = new Array(M);
    for (let i = 0; i < M; i++) {
      const a = origIndices[i];
      const b = origIndices[(i + 1) % M];
      smooth[i] = (b > a ? b - a : b + N - a) === 1;
    }

    // Start at the B-spline midpoint of the last→first span when that span is
    // smooth so the closed loop is fully seamless; otherwise start at vertex 0.
    const p0 = points[origIndices[0]];
    const pL = points[origIndices[M - 1]];
    let atMid = smooth[M - 1];
    const sx = atMid ? (pL[0] + p0[0]) / 2 : p0[0];
    const sy = atMid ? (pL[1] + p0[1]) / 2 : p0[1];
    const d: string[] = [`M${sx},${sy}`];

    for (let i = 0; i < M; i++) {
      const ci = origIndices[i];
      const ni = origIndices[(i + 1) % M];
      const [cpx, cpy] = points[ci];

      if (smooth[i]) {
        // Q midpoint B-spline ≡ curveBasisClosed.
        // When arriving from a jagged span the cursor is already at cpx,cpy
        // so just line to the midpoint instead of emitting a degenerate Q.
        const [npx, npy] = points[ni];
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
          const a = points[j % N];
          const b = points[(j + 1) % N];
          const prev = points[(j - 1 + N) % N];
          const nnext = points[(j + 2) % N];
          // Catmull-Rom tangents → Hermite control points (tension ≈ 0.25 for less radical curvature).
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
}

export const Coastline = new CoastlineGenerator();
