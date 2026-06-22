// GPU erosion-detail bake, a noise-based erosion appearance filter for the 3D view

import type * as THREEType from "three";

export type BakeParams = {
  strength: number;
  riverDepth: number;
  octaves: number;
  bakeResolution: number;
};

export type ErosionBakeResult = {
  key: string;
  heights: Float32Array; // normalized 0..1 over h 0-100, row 0 = map top
  pixels: Uint8Array; // raw bake RGBA: height 16-bit hi/lo, ridge/gully, drainage
  coast: Uint8Array; // RGBA: land mask, water surface byte, river mask, lake group code
  cols: number;
  rows: number;
};

type RiverPoint = [number, number, number];

const SEA_LEVEL = 20;

// lake group -> coast texture A channel code (byte = code * 40, 0 = none)
const LAKE_GROUP_CODES: Record<string, number> = {
  freshwater: 1,
  salt: 2,
  sinkhole: 3,
  dry: 4,
  lava: 5,
  frozen: 6
};

let cached: ErosionBakeResult | null = null;

// FNV-1a over typed arrays and a param string: cheap content hash to skip re-bakes
export function makeKey(params: BakeParams): string {
  let h = 0x811c9dc5;
  const mix = (byte: number) => {
    h ^= byte & 0xff;
    h = Math.imul(h, 16777619) >>> 0;
  };
  const mixArray = (array: ArrayLike<number> | undefined) => {
    if (!array) return;
    for (let i = 0; i < array.length; i++) {
      const v = array[i];
      mix(v);
      if (v > 255) mix(v >> 8);
    }
  };

  const paramString = [
    seed,
    graphWidth,
    graphHeight,
    grid.cellsX,
    grid.cellsY,
    params.strength,
    params.riverDepth,
    params.octaves,
    params.bakeResolution
  ].join("|");
  for (let i = 0; i < paramString.length; i++) mix(paramString.charCodeAt(i));

  mixArray(grid.cells.h);
  mixArray(pack.cells.r);
  mixArray(pack.cells.fl);

  return h.toString(36);
}

function getBakeSize(bakeResolution: number): [number, number] {
  const aspect = graphHeight / graphWidth;
  const long = bakeResolution;
  const short = Math.max(64, Math.round(long * (aspect <= 1 ? aspect : 1 / aspect)));
  return aspect <= 1 ? [long, short] : [short, long];
}

// R: height 0-100: bilinear filtering approximates the heightfield.
// G: delta 0-255: the max height delta to a LAND neighbor cell, scaled x10.
function buildHeightTexture() {
  const { cellsX, cellsY } = grid;
  const n = grid.cells.h.length;
  const data = new Uint8Array(n * 4);

  const heights = Uint8Array.from(grid.cells.h);
  const sums = new Float64Array(n);
  const counts = new Uint16Array(n);
  for (let p = 0; p < pack.cells.g.length; p++) {
    const g = pack.cells.g[p];
    sums[g] += pack.cells.h[p];
    counts[g]++;
  }
  for (let i = 0; i < n; i++) {
    if (counts[i] > 0) heights[i] = Math.round(sums[i] / counts[i]);
  }

  for (let i = 0; i < n; i++) {
    const h = heights[i];
    let maxDelta = 0;
    if (grid.cells.c[i]) {
      for (const c of grid.cells.c[i]) {
        if (heights[c] < SEA_LEVEL) continue;
        const delta = Math.abs(h - heights[c]);
        if (delta > maxDelta) maxDelta = delta;
      }
    }
    data[i * 4] = h;
    data[i * 4 + 1] = Math.min(maxDelta * 10, 255);
    data[i * 4 + 3] = 255;
  }

  const texture = new THREE.DataTexture(data, cellsX, cellsY, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

// R: land mask blurred so its 0.5 contour sits exactly on the true vector
// G: water surface height 0-100 as byte (20 for ocean, feature.height for lakes)
// B: river mask at true 2D widths, A: lake group code * 40
// Returns {texture, data}; data is kept in the bake cache for the terrain
// texture pass (see renderers/draw-satellite-texture)
function buildCoastTexture(bakeW: number, bakeH: number) {
  const scaleX = bakeW / graphWidth;
  const scaleY = bakeH / graphHeight;
  const isLand = (feature: any) => feature && feature.type !== "ocean" && feature.type !== "lake";

  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = bakeW;
  maskCanvas.height = bakeH;
  const maskCtx = maskCanvas.getContext("2d")!;
  maskCtx.fillStyle = "#000";
  maskCtx.fillRect(0, 0, bakeW, bakeH);
  maskCtx.save();
  maskCtx.scale(scaleX, scaleY);
  maskCtx.fillStyle = "#fff";
  for (const feature of pack.features) {
    if (!isLand(feature)) continue;
    maskCtx.fill(new Path2D(window.getFeaturePath(feature)));
  }
  maskCtx.fillStyle = "#000";
  for (const feature of pack.features) {
    if (!feature || feature.type !== "lake") continue;
    maskCtx.fill(new Path2D(window.getFeaturePath(feature)));
  }
  maskCtx.restore();

  const taperPx = Math.max(1, grid.spacing * 0.5 * scaleX);

  // river courses for the satellite texture: the actual river polygons
  // (same geometry as the 2D rivers layer) rasterized white on black; the
  // hardware bilinear filtering of the coast texture antialiases the edges.
  // The filled polygon carries the true flux/length width taper; per-segment
  // centerline strokes at the same local width (clamped to ~1 bake texel)
  // keep sub-texel headwaters continuous without inflating the wide
  // downstream course
  const riverCanvas = document.createElement("canvas");
  riverCanvas.width = bakeW;
  riverCanvas.height = bakeH;
  const riverCtx = riverCanvas.getContext("2d")!;
  riverCtx.fillStyle = "#000";
  riverCtx.fillRect(0, 0, bakeW, bakeH);
  riverCtx.save();
  riverCtx.scale(scaleX, scaleY);
  riverCtx.fillStyle = riverCtx.strokeStyle = "#fff";
  riverCtx.lineJoin = riverCtx.lineCap = "round";
  const minRiverWidth = 1.1 / scaleX;
  for (const river of pack.rivers || []) {
    if (!river.cells || river.cells.length < 2) continue;
    const points = river.points && river.points.length === river.cells.length ? river.points : null;
    try {
      const meandered = Rivers.addMeandering(river.cells, points);
      riverCtx.fill(new Path2D(Rivers.getRiverPath(meandered, river.widthFactor, river.sourceWidth)));
      let flux = meandered[0][2];
      for (let pointIndex = 1; pointIndex < meandered.length; pointIndex++) {
        if (meandered[pointIndex][2] > flux) flux = meandered[pointIndex][2];
        const offset = Rivers.getOffset({
          flux,
          pointIndex,
          widthFactor: river.widthFactor,
          startingWidth: river.sourceWidth
        });
        riverCtx.lineWidth = Math.max(2 * offset, minRiverWidth);
        riverCtx.beginPath();
        riverCtx.moveTo(meandered[pointIndex - 1][0], meandered[pointIndex - 1][1]);
        riverCtx.lineTo(meandered[pointIndex][0], meandered[pointIndex][1]);
        riverCtx.stroke();
      }
    } catch {
      // a malformed river just goes missing from the texture
    }
  }
  riverCtx.restore();

  // the coastline must follow the river into its mouth: cut the river
  // polygons out of the land mask near water — and only near water, since
  // cutting whole courses would flatten elevated rivers to the water
  // surface via the shader's coast flattening. The mask blur below then
  // rounds the notch exactly like the rest of the coastline
  const mouthRadius = taperPx * 2; // <= the 3*taperPx lake-surface dilation
  const mouthZoneCanvas = document.createElement("canvas");
  mouthZoneCanvas.width = bakeW;
  mouthZoneCanvas.height = bakeH;
  const mouthZoneCtx = mouthZoneCanvas.getContext("2d")!;
  mouthZoneCtx.fillStyle = "#fff";
  mouthZoneCtx.fillRect(0, 0, bakeW, bakeH);
  mouthZoneCtx.save();
  mouthZoneCtx.scale(scaleX, scaleY);
  mouthZoneCtx.fillStyle = "#000";
  for (const feature of pack.features) {
    if (!isLand(feature)) continue;
    mouthZoneCtx.fill(new Path2D(window.getFeaturePath(feature)));
  }
  // white water plus a white stroke along every shoreline = water dilated
  // inland by mouthRadius
  mouthZoneCtx.strokeStyle = "#fff";
  mouthZoneCtx.lineJoin = "round";
  mouthZoneCtx.lineWidth = (mouthRadius * 2) / scaleX;
  for (const feature of pack.features) {
    if (!feature || feature.type === "ocean") continue;
    const path = new Path2D(window.getFeaturePath(feature));
    if (feature.type === "lake") mouthZoneCtx.fill(path);
    mouthZoneCtx.stroke(path);
  }
  mouthZoneCtx.restore();

  // all canvases are opaque black/white, so multiply acts as a luminance
  // AND: rivers ∩ mouth zone, then land ∧ ¬cut via an inverted multiply
  const mouthCutCanvas = document.createElement("canvas");
  mouthCutCanvas.width = bakeW;
  mouthCutCanvas.height = bakeH;
  const mouthCutCtx = mouthCutCanvas.getContext("2d")!;
  mouthCutCtx.drawImage(riverCanvas, 0, 0);
  mouthCutCtx.globalCompositeOperation = "multiply";
  mouthCutCtx.drawImage(mouthZoneCanvas, 0, 0);

  maskCtx.globalCompositeOperation = "multiply";
  maskCtx.filter = "invert(1)";
  maskCtx.drawImage(mouthCutCanvas, 0, 0);
  maskCtx.filter = "none";
  maskCtx.globalCompositeOperation = "source-over";

  // Gaussian blur of a binary edge keeps its 0.5 level set at the original
  // edge location, so blurring the land/water mask turns the coastline into
  // a short, precisely-placed taper instead of moving it
  const blurCanvas = document.createElement("canvas");
  blurCanvas.width = bakeW;
  blurCanvas.height = bakeH;
  const blurCtx = blurCanvas.getContext("2d")!;
  blurCtx.filter = `blur(${taperPx}px)`;
  blurCtx.drawImage(maskCanvas, 0, 0);

  const surfaceCanvas = document.createElement("canvas");
  surfaceCanvas.width = bakeW;
  surfaceCanvas.height = bakeH;
  const surfaceCtx = surfaceCanvas.getContext("2d")!;
  surfaceCtx.fillStyle = `rgb(${SEA_LEVEL},${SEA_LEVEL},${SEA_LEVEL})`;
  surfaceCtx.fillRect(0, 0, bakeW, bakeH);
  surfaceCtx.save();
  surfaceCtx.scale(scaleX, scaleY);
  surfaceCtx.lineJoin = "round";
  for (const feature of pack.features) {
    if (!feature || feature.type !== "lake") continue;
    const surface = Math.round(Math.max(feature.height || SEA_LEVEL, SEA_LEVEL));
    const path = new Path2D(window.getFeaturePath(feature));
    surfaceCtx.fillStyle = surfaceCtx.strokeStyle = `rgb(${surface},${surface},${surface})`;
    surfaceCtx.lineWidth = (taperPx * 6) / scaleX;
    surfaceCtx.fill(path);
    surfaceCtx.stroke(path);
  }
  surfaceCtx.restore();

  const blurSurfaceCanvas = document.createElement("canvas");
  blurSurfaceCanvas.width = bakeW;
  blurSurfaceCanvas.height = bakeH;
  const blurSurfaceCtx = blurSurfaceCanvas.getContext("2d")!;
  blurSurfaceCtx.filter = `blur(${taperPx}px)`;
  blurSurfaceCtx.drawImage(surfaceCanvas, 0, 0);

  // lake groups for the satellite texture: A channel = group code * 40
  // (freshwater 1 .. frozen 6, 0 = ocean/none). Filled and dilated like the
  // G surface channel so the bilinear blend toward 0 happens on land, where
  // the satellite shader ignores the code; no blur (codes must stay discrete)
  const groupCanvas = document.createElement("canvas");
  groupCanvas.width = bakeW;
  groupCanvas.height = bakeH;
  const groupCtx = groupCanvas.getContext("2d")!;
  groupCtx.fillStyle = "#000";
  groupCtx.fillRect(0, 0, bakeW, bakeH);
  groupCtx.save();
  groupCtx.scale(scaleX, scaleY);
  groupCtx.lineJoin = "round";
  groupCtx.lineWidth = (taperPx * 6) / scaleX;
  for (const feature of pack.features) {
    if (!feature || feature.type !== "lake") continue;
    const code = LAKE_GROUP_CODES[feature.group as string] ?? 1;
    const gray = code * 40;
    const path = new Path2D(window.getFeaturePath(feature));
    groupCtx.fillStyle = groupCtx.strokeStyle = `rgb(${gray},${gray},${gray})`;
    groupCtx.fill(path);
    groupCtx.stroke(path);
  }
  groupCtx.restore();

  const riverData = riverCtx.getImageData(0, 0, bakeW, bakeH).data;
  const landData = blurCtx.getImageData(0, 0, bakeW, bakeH).data;
  const surfaceData = blurSurfaceCtx.getImageData(0, 0, bakeW, bakeH).data;
  const groupData = groupCtx.getImageData(0, 0, bakeW, bakeH).data;
  const data = new Uint8Array(bakeW * bakeH * 4);
  for (let i = 0; i < bakeW * bakeH; i++) {
    data[i * 4] = landData[i * 4];
    data[i * 4 + 1] = surfaceData[i * 4];
    data[i * 4 + 2] = riverData[i * 4];
    data[i * 4 + 3] = groupData[i * 4];
  }

  const texture = new THREE.DataTexture(data, bakeW, bakeH, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return { texture, data };
}

// Chaikin corner cutting: smooths the cell-center polyline (zigzag walls
// read as artificial terraces in the carved valleys). Widths interpolate
function chaikinSmooth(points: RiverPoint[], iterations: number): RiverPoint[] {
  let result = points;
  for (let it = 0; it < iterations; it++) {
    const smoothed: RiverPoint[] = [result[0]];
    for (let k = 0; k < result.length - 1; k++) {
      const a = result[k];
      const b = result[k + 1];
      smoothed.push(
        [a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25, a[2] * 0.75 + b[2] * 0.25],
        [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75, a[2] * 0.25 + b[2] * 0.75]
      );
    }
    smoothed.push(result[result.length - 1]);
    result = smoothed;
  }
  return result;
}

// Valley: rivers stroked in widening, dimming passes
function buildRiverCanvas(bakeW: number, bakeH: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(256, Math.round(bakeW / 4));
  canvas.height = Math.max(2, Math.round((canvas.width * bakeH) / bakeW));
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const toTexture = () => {
    const texture = new THREE.CanvasTexture(canvas);
    texture.flipY = false; // keep canvas row 0 (map top) at v = 0, like the DataTextures
    texture.minFilter = texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    return texture;
  };

  if (!pack.rivers?.length || !pack.cells.fl) return toTexture();

  // constants from Rivers (river-generator.ts): FLUX_FACTOR 500, LENGTH_FACTOR 200
  const LENGTH_PROGRESSION = [1, 1, 2, 3, 5, 8, 13, 21, 34].map(n => n / 200);
  const riverLines: RiverPoint[][] = [];
  for (const river of pack.rivers) {
    const points: RiverPoint[] = [];
    for (let k = 0; k < river.cells.length; k++) {
      const cell = river.cells[k];
      if (cell < 0 || pack.cells.h[cell] < SEA_LEVEL) continue;
      const fluxWidth = Math.min(pack.cells.fl[cell] ** 0.7 / 500, 1);
      const lengthWidth = k / 200 + (LENGTH_PROGRESSION[k] ?? 0.17);
      const offset = river.widthFactor * (lengthWidth + fluxWidth) + (river.sourceWidth || 0);
      points.push([pack.cells.p[cell][0], pack.cells.p[cell][1], offset]);
    }
    if (points.length > 1) riverLines.push(chaikinSmooth(points, 2));
  }

  const scale = canvas.width / graphWidth;
  const valleyBase = grid.spacing * 0.6; // minimum valley width in map units
  const passes = [
    { grow: 1, gray: 255 },
    { grow: 2, gray: 140 },
    { grow: 3.4, gray: 70 },
    { grow: 5.2, gray: 30 }
  ];

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.globalCompositeOperation = "lighten";
  for (const { grow, gray } of passes) {
    ctx.strokeStyle = `rgb(${gray},${gray},${gray})`;
    for (const points of riverLines) {
      for (let k = 0; k < points.length - 1; k++) {
        const [x0, y0, w0] = points[k];
        const [x1, y1, w1] = points[k + 1];
        const valleyWidth = valleyBase + ((w0 + w1) / 2) * 3;
        ctx.lineWidth = Math.max(1, valleyWidth * grow * scale);
        ctx.beginPath();
        ctx.moveTo(x0 * scale, y0 * scale);
        ctx.lineTo(x1 * scale, y1 * scale);
        ctx.stroke();
      }
    }
  }

  // faint drainage channels below the river threshold
  const RIVER_FLUX = 20;
  const MAX_RIVER_FLUX = 100;
  const { fl, h, c: neighbors, p, r } = pack.cells;
  for (const i of pack.cells.i) {
    if (h[i] < SEA_LEVEL || r[i] || !fl[i] || fl[i] < RIVER_FLUX) continue;
    let down = -1;
    let minH = h[i];
    for (const n of neighbors[i]) {
      if (h[n] < minH) {
        minH = h[n];
        down = n;
      }
    }
    if (down === -1) continue;
    const intensity = Math.min(fl[i] / MAX_RIVER_FLUX, 1);
    const gray = Math.round(12 + 28 * intensity);
    ctx.strokeStyle = `rgb(${gray},${gray},${gray})`;
    ctx.lineWidth = Math.max(1, valleyBase * 0.4 * scale);
    ctx.beginPath();
    ctx.moveTo(p[i][0] * scale, p[i][1] * scale);
    ctx.lineTo(p[down][0] * scale, p[down][1] * scale);
    ctx.stroke();
  }

  return toTexture();
}

const vertexShader = /* glsl */ `
    precision highp float;
    attribute vec3 position;
    void main() {
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `;

const fragmentShader = /* glsl */ `
    precision highp float;

    uniform sampler2D uHeight; // R: height byte 0-100, G: local relief
    uniform sampler2D uCoast;  // R: blurred land mask (0.5 = true coastline),
                               // G: water surface byte 0-100 -- bake resolution, sampled directly
    uniform sampler2D uRivers; // R: valley intensity
    uniform vec2 uGridSize;    // (cellsX, cellsY)
    uniform vec2 uResolution;  // bake size in px
    uniform float uAspect;     // graphHeight / graphWidth
    uniform float uSeed;
    uniform float uStrength;   // gully amplitude factor (1 = default)
    uniform float uRiverDepth; // 0..1
    uniform int uOctaves;

    const int MAX_OCTAVES = 6;
    const float TAU = 6.2831853;
    const float SEA = 0.20;

    const float BASE_NOISE_CELLS = 0.7;  // base-FBM wavelength in grid cells
    const float BASE_NOISE_AMP = 0.008;
    const float NOISE_STEER = 0.5;       // fraction of FBM gradient perturbing the flow
    const float GULLY_CELLS0 = 0.16;     // octave-0 erosion lattice: ~6 grid cells per kernel
    const float GULLY_AMP0 = 0.07;
    const float GULLY_GAIN = 0.55;       // per-octave amplitude falloff
    const float DIR_SCALE = 0.5;         // stripes per lattice cell per unit slope
    const float MAX_STRIPE_FREQ = 4.0;   // cap stripes per lattice cell
    const float RIVER_RELIEF_CAP = 0.15; // max carve depth, in 0..1 height units
    const float COAST_RAMP = 0.2;        // land mask span
    const float RIDGE_SHARPEN = 0.8;      // unsharp-mask strength for crest sharpening
    const float EDGE_SHARP = 0.7;         // edge-shaping exponent: sharper crests, rounder gully floors
    const float SLOPE_LO = 0.015;         // gradient trick: local slope (height delta per grid cell
    const float SLOPE_HI = 0.05;          // slope above which erosion energy is unaffected
    const float FLAT_ENERGY_FLOOR = 0.5;  // min energy fraction kept on dead-flat ground
    const bool QUANTIZE_GULLY_DIR = true; // runevision sign trick: feed back only the sign of the derivative

    float hash12(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    vec2 hash22(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.xx + p3.yz) * p3.zy);
    }

    // value noise with analytic derivative: (value [-1,1], d/dx, d/dy)
    vec3 noised(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      float a = hash12(i);
      float b = hash12(i + vec2(1.0, 0.0));
      float c = hash12(i + vec2(0.0, 1.0));
      float d = hash12(i + vec2(1.0, 1.0));
      vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
      vec2 du = 30.0 * f * f * (f * (f - 2.0) + 1.0);
      float k0 = b - a;
      float k1 = c - a;
      float k2 = a - b - c + d;
      float value = a + k0 * u.x + k1 * u.y + k2 * u.x * u.y;
      vec2 grad = vec2((k0 + k2 * u.y) * du.x, (k1 + k2 * u.x) * du.y);
      return vec3(value * 2.0 - 1.0, grad * 2.0);
    }

    // sample the coarse heightmap; half-texel alignment maps uv 0..1 onto
    // cell centers 0..N-1, matching how the classic mesh spans the map.
    // returns (height 0..1, local relief: max land-neighbor delta, 0..1 height units)
    vec2 heightSample(vec2 uv) {
      vec2 t = 1.0 / uGridSize;
      vec2 huv = uv * (1.0 - t) + 0.5 * t;
      vec2 rg = texture2D(uHeight, huv).rg;
      return vec2(rg.x * 2.55, rg.y * 0.255);
    }

    float baseHeight(vec2 uv) {
      return heightSample(uv).x;
    }

    // unsharp-mask blur: average of 4 taps at ~1.5 grid cells, used to pull
    // out the high-frequency detail the bilinear base already implies
    float blurredHeight(vec2 uv) {
      vec2 e = 1.5 / uGridSize;
      float h0 = baseHeight(uv + vec2(e.x, 0.0));
      float h1 = baseHeight(uv - vec2(e.x, 0.0));
      float h2 = baseHeight(uv + vec2(0.0, e.y));
      float h3 = baseHeight(uv - vec2(0.0, e.y));
      return (h0 + h1 + h2 + h3) * 0.25;
    }

    // built at bake resolution from the actual coastline geometry, sampled
    // directly (no half-texel cell alignment): R = blurred land mask, 0.5 at
    // the true coastline; G = water surface byte 0-100
    vec4 coastSample(vec2 uv) {
      return texture2D(uCoast, uv);
    }

    // gradient in isotropic map space p = (u, v * aspect), per unit map width
    vec2 baseGradient(vec2 uv) {
      vec2 e = 1.0 / uGridSize;
      float hx1 = baseHeight(uv + vec2(e.x, 0.0));
      float hx0 = baseHeight(uv - vec2(e.x, 0.0));
      float hy1 = baseHeight(uv + vec2(0.0, e.y));
      float hy0 = baseHeight(uv - vec2(0.0, e.y));
      return vec2((hx1 - hx0) / (2.0 * e.x), (hy1 - hy0) / (2.0 * e.y) / uAspect);
    }

    // Erosion kernel after the technique of clayjohn (2018) / Fewes (2023),
    // implemented from the published descriptions: a 4x4 window of cosine-wave
    // kernels around jittered pivots, blended with a gaussian falloff. The
    // phase is dot(p - pivot, dir) with UNNORMALIZED dir, so stripe frequency
    // scales with the slope: steep faces get dense gullies, flats degenerate
    // to cos(0) = 1 — a constant — which is the technique's built-in fade and
    // what makes summits (slope 0) rise into points. The sine term carries the
    // analytic derivative used to steer later octaves (kernel-falloff
    // derivatives are deliberately ignored, like the reference, to keep the
    // steering smooth). Returns (value, d/dx, d/dy) in lattice units
    vec3 erosionKernel(vec2 p, vec2 dir) {
      vec2 ip = floor(p);
      vec2 fp = fract(p);
      vec3 acc = vec3(0.0);
      float wsum = 0.0;
      for (int j = -2; j <= 1; j++) {
        for (int i = -2; i <= 1; i++) {
          vec2 o = vec2(float(i), float(j));
          vec2 pivot = o + hash22(ip + o + uSeed * 7.0) * 0.5;
          vec2 d = fp - pivot;
          float w = exp(-2.0 * dot(d, d));
          float phase = TAU * dot(d, dir);
          acc += w * vec3(cos(phase), -sin(phase) * dir);
          wsum += w;
        }
      }
      return acc / wsum;
    }

    vec2 pack16(float v) {
      float s = clamp(v, 0.0, 1.0) * 65535.0;
      float hi = floor(s / 256.0);
      float lo = floor(s - hi * 256.0);
      return vec2(hi, lo) / 255.0;
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / uResolution;
      vec2 p = vec2(uv.x, uv.y * uAspect); // isotropic map space

      float base = baseHeight(uv);
      vec2 grad = baseGradient(uv);
      vec4 coast = coastSample(uv);
      float landFactor = coast.r; // 0.5 = the true coastline
      float waterSurface = coast.g * 2.55;

      // keep detail off the water and let it ramp in over the first ~10 height
      // units of land, so beaches and shores stay clean
      float land = landFactor;
      float aboveSea = clamp((base - SEA) / 0.10, 0.0, 1.0);
      float contrib = land * aboveSea;

      // erosion energy follows the map's terrain classes: h 50+ are hills and
      // h 70+ mountains (full sculpting), rugged areas qualify via local
      // relief regardless of elevation. Flat lowlands get exactly zero energy
      // h<=30 gets none even if locally rugged)
      vec2 heightData = heightSample(uv);
      float localRelief = heightData.y;
      float hillCurve = smoothstep(0.40, 0.70, base);
      float reliefCurve = smoothstep(0.03, 0.10, localRelief);
      float anomalyWeight = smoothstep(0.30, 0.55, base);
      float energy = max(hillCurve, reliefCurve * anomalyWeight);

      // gradient trick: scale energy by the local slope of the base
      // heightmap so genuinely flat ground (plains, plateau tops, valley
      // floors) stays smooth even inside a height band that would
      // otherwise get full erosion detail
      float slopeMag = length(grad) / uGridSize.x;
      float slopeCurve = smoothstep(SLOPE_LO, SLOPE_HI, slopeMag);
      energy *= mix(FLAT_ENERGY_FLOOR, 1.0, slopeCurve);

      float gate = contrib * energy;

      float h = base;

      // small analytic FBM perturbs the flow direction so gullies on the
      // blobby bilinear base don't all run perfectly parallel
      float baseFreq = uGridSize.x * BASE_NOISE_CELLS;
      vec3 n = noised(p * baseFreq + uSeed * 17.0);
      h += n.x * BASE_NOISE_AMP * gate;
      grad += n.yz * BASE_NOISE_AMP * baseFreq * NOISE_STEER * gate;

      // octave stack after the reference technique: each octave's stripes run
      // along the slope of base + previous octaves (analytic derivative
      // feedback), branching like real drainage. The slope-scaled phase makes
      // summits rise toward +1 (pointy peaks) and flats stay quiet — no
      // explicit fade or slope gating is needed
      vec3 acc = vec3(0.0); // accumulated erosion: value, d/dx, d/dy (map units)
      float amp = GULLY_AMP0 * uStrength;
      float freq = uGridSize.x * GULLY_CELLS0;
      for (int i = 0; i < MAX_OCTAVES; i++) {
        if (i >= uOctaves) break;
        if (freq > uResolution.x * 0.3) break; // Nyquist guard

        vec2 flowGrad = grad + acc.yz;
        vec2 dir = vec2(flowGrad.y, -flowGrad.x) * DIR_SCALE;
        float dirLen = length(dir);
        if (dirLen > MAX_STRIPE_FREQ) dir *= MAX_STRIPE_FREQ / dirLen;
        vec3 e = erosionKernel(p * freq, dir);

        // edge shaping (runevision "edge rounding"): sharpens crests between
        // gullies while rounding the gully floors. Only the value channel is
        // reshaped; e.yz keeps the kernel's raw derivative for steering
        e.x = 1.0 - 2.0 * pow(clamp((1.0 - e.x) * 0.5, 1e-4, 1.0), EDGE_SHARP);

        // on flats the kernel returns ~+1 (its built-in fade). Keep that lift
        // only for mountain summits (pointy peaks); neutralize it elsewhere so
        // plains, plateau tops and coastal shelves are not raised into mesas
        float flatness = 1.0 - smoothstep(0.05, 0.4, dirLen);
        e.x = mix(e.x, hillCurve, flatness);

        acc.x += e.x * amp;
        // runevision sign trick: feed back the sign of the derivative rather
        // than its value, so smaller-scale gullies snap to a consistent
        // angle instead of wobbling with the noise magnitude
        vec2 feedback = QUANTIZE_GULLY_DIR ? sign(e.yz) : e.yz;
        acc.yz += feedback * freq * amp;

        amp *= GULLY_GAIN;
        freq *= 2.0;
      }
      float ridgeAcc = acc.x * gate;
      h += ridgeAcc;

      // unsharp-mask crest sharpening: pull the high-frequency detail the
      // bilinear base already implies into defined peaked crests, gated to
      // the hill/mountain band so lowlands stay untouched
      float detail = base - blurredHeight(uv);
      float crestDetail = detail * RIDGE_SHARPEN * hillCurve;
      h += crestDetail;

      // texturing signal: positive on ridges/crests, negative in gullies,
      // ~0 on untouched ground. Consumed by the terrain texture pass
      // (draw-satellite-texture) to blend exposed rock vs. dirt-filled gullies
      float erosionDetail = ridgeAcc + crestDetail;

      // carve valleys toward the real rivers; depth is limited by the relief
      // above the local water surface, so beds never drop below water level.
      // pow() narrows the deep core and softens the rims (V-profile), and the
      // terrain modulation keeps floodplain rivers in shallow swales while
      // rivers cutting through hills get real valleys
      float riverIntensity = pow(texture2D(uRivers, uv).r, 1.4);
      float carveMod = mix(0.3, 1.0, max(hillCurve, 0.85 * reliefCurve));
      float available = max(h - waterSurface, 0.0);
      h -= uRiverDepth * riverIntensity * carveMod * min(available, RIVER_RELIEF_CAP);

      // water flattening + coastal taper in one step, driven by the true
      // coastline mask: fully flat at the water surface for landFactor <= 0.5
      // (the coastline itself and everything seaward of it), ramping up to
      // the full land height over the next COAST_RAMP of mask inland. The
      // 0-elevation line therefore sits exactly on the true coastline, not in
      // the middle of a grid cell
      float coastBlend = smoothstep(0.5, 0.5 + COAST_RAMP, landFactor);
      h = mix(waterSurface, max(h, waterSurface), coastBlend);

      // pack the texturing signals alongside the height: B = erosion detail
      // (ridge/gully, scaled to fit ±0.4 into 0..1), A = drainage intensity
      // (rivers + sub-river flow, already 0..1)
      float erosionPacked = clamp(erosionDetail / 0.4 + 0.5, 0.0, 1.0);
      gl_FragColor = vec4(pack16(h), erosionPacked, riverIntensity);
    }
  `;

function runErosionPass(
  renderer: THREEType.WebGLRenderer,
  params: BakeParams,
  bakeW: number,
  bakeH: number,
  textures: { height: THREEType.DataTexture; coast: THREEType.DataTexture; rivers: THREEType.Texture }
) {
  const renderTarget = new THREE.WebGLRenderTarget(bakeW, bakeH, {
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: false,
    stencilBuffer: false
  });

  const material = new THREE.RawShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uHeight: { value: textures.height },
      uCoast: { value: textures.coast },
      uRivers: { value: textures.rivers },
      uGridSize: { value: new THREE.Vector2(grid.cellsX, grid.cellsY) },
      uResolution: { value: new THREE.Vector2(bakeW, bakeH) },
      uAspect: { value: graphHeight / graphWidth },
      uSeed: { value: (Number.parseInt(seed, 10) % 1e5 || 1) / 1e5 + 1 },
      uStrength: { value: params.strength / 50 },
      uRiverDepth: { value: params.riverDepth / 100 },
      uOctaves: { value: params.octaves }
    },
    depthTest: false,
    depthWrite: false
  });

  // fullscreen triangle
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const quad = new THREE.Mesh(geometry, material);
  quad.frustumCulled = false;
  const bakeScene = new THREE.Scene();
  bakeScene.add(quad);
  const bakeCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const previousTarget = renderer.getRenderTarget();
  renderer.setRenderTarget(renderTarget);
  renderer.render(bakeScene, bakeCamera);

  const pixels = new Uint8Array(bakeW * bakeH * 4);
  renderer.readRenderTargetPixels(renderTarget, 0, 0, bakeW, bakeH, pixels);
  renderer.setRenderTarget(previousTarget);

  renderTarget.dispose();
  material.dispose();
  geometry.dispose();

  return pixels;
}

// The shader carves valleys from the cell-level uRivers raster, which cannot
// guarantee the bed along the actual meandered course descends: the course
// wanders off the cell-center line and erosion noise can lift single spans.
// Walk each river's true course (same geometry as the 2D layer and the coast
// river mask) downstream, keep a running minimum of the baked bed height and
// stamp any uphill span back down to it, so rendered rivers always flow
// downhill. Lowering clamps to the local water surface and never raises
// anything; it writes through to both the heights field and the packed
// pixels consumed by the satellite texture pass
function enforceDownhillCourses(bakeResult: ErosionBakeResult) {
  if (!pack.rivers?.length) return;
  const { heights, pixels, coast, cols, rows } = bakeResult;
  const scaleX = cols / graphWidth;
  const scaleY = rows / graphHeight;
  const EPSILON = 1e-4; // ~0.01 height units: ignore sub-visible bumps

  const lowerTexel = (index: number, target: number) => {
    if (heights[index] <= target) return;
    heights[index] = target;
    const packed = Math.round(target * 65535);
    pixels[index * 4] = packed >> 8;
    pixels[index * 4 + 1] = packed & 0xff;
  };

  // lower a disc of texels to the bed height: flat core sized to the river
  // half-width (so the bilinear surface under the whole course drops), with a
  // smoothstep feather that widens with cut depth to avoid slot-canyon walls
  const stamp = (x: number, y: number, coreRadius: number, depth: number, bed: number) => {
    const featherRadius = coreRadius + Math.min(Math.max(depth * 150, 1.5), 10);
    const cx = x * scaleX - 0.5;
    const cy = y * scaleY - 0.5;
    const minX = Math.max(Math.ceil(cx - featherRadius), 0);
    const maxX = Math.min(Math.floor(cx + featherRadius), cols - 1);
    const minY = Math.max(Math.ceil(cy - featherRadius), 0);
    const maxY = Math.min(Math.floor(cy + featherRadius), rows - 1);
    for (let ty = minY; ty <= maxY; ty++) {
      for (let tx = minX; tx <= maxX; tx++) {
        const dist = Math.hypot(tx - cx, ty - cy);
        if (dist > featherRadius) continue;
        const index = ty * cols + tx;
        const waterSurface = coast[index * 4 + 1] / 100; // G: surface byte 0-100
        let target = Math.max(bed, waterSurface);
        if (dist > coreRadius) {
          const t = (dist - coreRadius) / (featherRadius - coreRadius);
          target += (heights[index] - target) * t * t * (3 - 2 * t);
        }
        lowerTexel(index, target);
      }
    }
  };

  for (const river of pack.rivers) {
    if (!river.cells || river.cells.length < 2) continue;
    const points = river.points && river.points.length === river.cells.length ? river.points : null;
    let course: RiverPoint[];
    try {
      course = Rivers.addMeandering(river.cells, points);
    } catch {
      continue; // same policy as the river mask: a malformed river is skipped
    }
    if (course.length < 2) continue;

    const startingWidth = river.sourceWidth || 0;
    let flux = 0;
    let bed = Infinity;
    let [prevX, prevY] = course[0];
    let prevOffset = startingWidth;

    for (let k = 0; k < course.length; k++) {
      const [x, y, pointFlux] = course[k];
      if (pointFlux > flux) flux = pointFlux;
      const offset = Rivers.getOffset({ flux, pointIndex: k, widthFactor: river.widthFactor, startingWidth });

      // densify segments to ~0.75-texel steps so no texel span is skipped
      const segmentTexels = Math.hypot((x - prevX) * scaleX, (y - prevY) * scaleY);
      const steps = k === 0 ? 1 : Math.max(Math.ceil(segmentTexels / 0.75), 1);
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const sx = prevX + (x - prevX) * t;
        const sy = prevY + (y - prevY) * t;
        const sampled = sampleField(bakeResult, heights, sx, sy);
        if (sampled > bed + EPSILON) {
          const halfWidth = (prevOffset + (offset - prevOffset) * t) * scaleX;
          stamp(sx, sy, halfWidth + 1, sampled - bed, bed);
        } else if (sampled < bed) {
          bed = sampled;
        }
      }

      prevX = x;
      prevY = y;
      prevOffset = offset;
    }
  }
}

export async function bake(renderer: THREEType.WebGLRenderer, params: BakeParams): Promise<ErosionBakeResult | null> {
  const key = makeKey(params);
  if (cached && cached.key === key) return cached;

  try {
    TIME && console.time("erosionBake");
    const [bakeW, bakeH] = getBakeSize(params.bakeResolution);

    const coast = buildCoastTexture(bakeW, bakeH);
    const textures = {
      height: buildHeightTexture(),
      coast: coast.texture,
      rivers: buildRiverCanvas(bakeW, bakeH)
    };

    const pixels = runErosionPass(renderer, params, bakeW, bakeH, textures);
    for (const texture of Object.values(textures)) texture.dispose();

    const heights = new Float32Array(bakeW * bakeH);
    for (let i = 0, j = 0; i < heights.length; i++, j += 4) {
      heights[i] = (pixels[j] * 256 + pixels[j + 1]) / 65535;
    }

    // pixels (raw RGBA: height 16-bit, ridge/gully, drainage) and the coast
    // mask are kept for the satellite texture pass (draw-satellite-texture)
    const result: ErosionBakeResult = { key, heights, pixels, coast: coast.data, cols: bakeW, rows: bakeH };
    if (params.riverDepth > 0) enforceDownhillCourses(result);
    cached = result;
    TIME && console.timeEnd("erosionBake");
    return cached;
  } catch (error) {
    console.error("3D erosion bake failed:", error);
    cached = null;
    return null;
  }
}

// bilinear sample of a baked field at map coordinates (x, y)
function sampleField(bakeData: ErosionBakeResult, field: ArrayLike<number>, x: number, y: number) {
  const { cols, rows } = bakeData;

  const fx = Math.min(Math.max((x / graphWidth) * cols - 0.5, 0), cols - 1);
  const fy = Math.min(Math.max((y / graphHeight) * rows - 0.5, 0), rows - 1);
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(x0 + 1, cols - 1);
  const y1 = Math.min(y0 + 1, rows - 1);
  const tx = fx - x0;
  const ty = fy - y0;

  const top = field[y0 * cols + x0] * (1 - tx) + field[y0 * cols + x1] * tx;
  const bottom = field[y1 * cols + x0] * (1 - tx) + field[y1 * cols + x1] * tx;
  return top * (1 - ty) + bottom * ty;
}

const LOWER_BY_WATER = 18;
const DIVIDER = 100 - LOWER_BY_WATER;

// world y for map coordinates; bilinear over the baked field. Used both for
// mesh vertices and for label/icon placement (do not raycast the dense mesh)
export function heightAt(x: number, y: number, scale: number): number {
  if (!cached) return 0;
  const h = sampleField(cached, cached.heights, x, y);
  return ((h * 100 - LOWER_BY_WATER) / DIVIDER) * scale;
}

export function isCached(key?: string): boolean {
  if (key === undefined) return Boolean(cached);
  return Boolean(cached && cached.key === key);
}

export function dispose(): void {
  cached = null;
}
