import Alea from "alea";

export const coastSettings: CoastlineSettings = {
  maxDepth: 4,
  baseAmplitude: 3,
  amplitudeDecay: 0.5,
  minEdge: 1.5,
  smoothThreshold: 0.25,
  roughnessContrast: 1.5
};

export interface CoastlineSettings {
  /** Maximum recursion depth. Rough edges get up to 2^maxDepth − 1 points. */
  maxDepth: number;
  /** Base perpendicular displacement amplitude (scales with √edgeLength). */
  baseAmplitude: number;
  /** Amplitude multiplier per recursion level (Hurst exponent ≈ log2(decay)). */
  amplitudeDecay: number;
  /** Edges shorter than this (map units) are never subdivided. */
  minEdge: number;
  /** Profile values below this threshold receive zero displacement. */
  smoothThreshold: number;
  /** Power applied to the normalised roughness profile. Higher = more contrast. */
  roughnessContrast: number;
}

// Resolution of the roughness envelope (points around the full perimeter)
const PROFILE_SIZE = 256;

/**
 * Build a smooth, perfectly closed roughness envelope using a sum of
 * low-frequency cosine harmonics evaluated around [0, 1).
 *
 * A sum of k·cos(2π k t + φ) is intrinsically periodic with period 1,
 * so the result is seam-free. Only 3–5 harmonics are used to keep the
 * variation long-range; raising the normalised result to a high power
 * creates stark contrast — glassy bays vs. wild rocky headlands.
 */
function makeRoughnessProfile(rand: () => number, contrast: number): Float32Array {
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

/** Linear interpolation into the envelope at t ∈ [0, 1). */
function sampleProfile(profile: Float32Array, t: number): number {
  const pos = (((t % 1) + 1) % 1) * PROFILE_SIZE;
  const i = Math.floor(pos) % PROFILE_SIZE;
  const f = pos - Math.floor(pos);
  return profile[i] * (1 - f) + profile[(i + 1) % PROFILE_SIZE] * f;
}

/**
 * Circular average of two t-values in [0, 1). Handles the wraparound at the seam (e.g. t0=0.95, t1=0.05 → 0.0).
 */
function midT(t0: number, t1: number): number {
  const diff = t1 - t0;
  if (Math.abs(diff) <= 0.5) return t0 + diff / 2;
  const t = t0 + (diff - Math.sign(diff)) / 2;
  return ((t % 1) + 1) % 1;
}

/**
 * Recursively subdivide one edge of the coastline polygon.
 * In smooth zones the roughness check fires immediately — zero intermediate points.
 * In rough zones all `maxDepth` levels fire, inserting up to 2^maxDepth−1 intermediate points on a single original edge.
 */
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

/** Core algorithm with an explicit PRNG — shared by the renderer and the dialog preview. */
function fractalizeWithRand(
  points: [number, number][],
  rand: () => number,
  settings: CoastlineSettings
): [number, number][] {
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

  for (let i = 0; i < n; i++) {
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

  return resultPts;
}

export function fractalizeCoastline(
  points: [number, number][],
  featureIndex: number,
  settings: CoastlineSettings = coastSettings
): [number, number][] {
  if (points.length < 3) return points;
  const rand = Alea(`${seed}_c${featureIndex}`);
  return fractalizeWithRand(points, rand, settings);
}

// ---------------------------------------------------------------------------
// Advanced Settings dialog
// ---------------------------------------------------------------------------

declare global {
  var showCoastlineSettings: () => void;
}

interface SliderDef {
  id: string;
  label: string;
  tip: string;
  min: number;
  max: number;
  step: number;
  key: keyof CoastlineSettings;
}

const SLIDER_DEFS: SliderDef[] = [
  {
    id: "coastMaxDepth",
    label: "Detail depth",
    tip: "Maximum recursion levels per edge. Each +1 can double point count in rough zones.",
    min: 1,
    max: 5,
    step: 1,
    key: "maxDepth"
  },
  {
    id: "coastBaseAmplitude",
    label: "Roughness amplitude",
    tip: "Peak perpendicular displacement. Scales with √(edge length) so large edges stay proportional.",
    min: 0.2,
    max: 4,
    step: 0.1,
    key: "baseAmplitude"
  },
  {
    id: "coastAmplitudeDecay",
    label: "Amplitude decay",
    tip: "Amplitude multiplier per recursion level (Hurst exponent). Lower = more jagged finer detail.",
    min: 0.3,
    max: 0.9,
    step: 0.01,
    key: "amplitudeDecay"
  },
  {
    id: "coastMinEdge",
    label: "Minimum edge",
    tip: "Edges shorter than this (map units) are never subdivided regardless of roughness.",
    min: 0.1,
    max: 5,
    step: 0.1,
    key: "minEdge"
  },
  {
    id: "coastSmoothThreshold",
    label: "Smooth threshold",
    tip: "Profile values below this receive zero displacement → glassy arc. Controls calm-coast coverage.",
    min: 0.01,
    max: 0.5,
    step: 0.01,
    key: "smoothThreshold"
  },
  {
    id: "coastRoughnessContrast",
    label: "Roughness contrast",
    tip: "Power applied to the roughness profile. Higher = sharper calm/rough transition.",
    min: 1,
    max: 10,
    step: 0.5,
    key: "roughnessContrast"
  }
];

// ---------------------------------------------------------------------------
// Dialog preview canvases
// ---------------------------------------------------------------------------

// Fixed seed so the previews are stable and don't change when the map regenerates.
const PREVIEW_SEED = "preview_coastline_42";

/**
 * Draw the roughness envelope as a line graph.
 * The green-tinted region below the dashed threshold line shows areas that
 * receive zero displacement (glassy arcs). The orange curve shows the full
 * envelope produced by the sum-of-cosines profile generator.
 */
function drawRoughnessGraph(canvas: HTMLCanvasElement): void {
  const W = canvas.width;
  const H = canvas.height;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, W, H);

  const rand = Alea(PREVIEW_SEED);
  const profile = makeRoughnessProfile(rand, coastSettings.roughnessContrast);

  const pl = 2,
    pr = 2,
    pt = 4,
    pb = 14;
  const gW = W - pl - pr;
  const gH = H - pt - pb;
  const threshY = pt + gH * (1 - Math.min(coastSettings.smoothThreshold, 1));

  // Smooth zone fill (below threshold)
  ctx.fillStyle = "rgba(80,175,80,0.15)";
  ctx.fillRect(pl, threshY, gW, H - pb - threshY);

  // Roughness profile curve
  ctx.beginPath();
  for (let i = 0; i <= PROFILE_SIZE; i++) {
    const x = pl + (i / PROFILE_SIZE) * gW;
    const y = pt + gH * (1 - profile[i % PROFILE_SIZE]);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.strokeStyle = "#c05820";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Threshold dashed line
  ctx.beginPath();
  ctx.setLineDash([3, 3]);
  ctx.moveTo(pl, threshY);
  ctx.lineTo(W - pr, threshY);
  ctx.strokeStyle = "rgba(40,140,40,0.85)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.setLineDash([]);

  // Axis labels
  ctx.fillStyle = "#999";
  ctx.font = "9px sans-serif";
  ctx.fillText("rough", pl + 1, pt + 8);
  ctx.fillText("smooth threshold", pl + 1, H - pb + 10);
}

/**
 * Draw a fractalized circle as a mini coastline preview.
 * Uses the same algorithm and PREVIEW_SEED so the graph and the shape
 * always show the same roughness profile.
 */
function drawShapePreview(canvas: HTMLCanvasElement): void {
  const W = canvas.width;
  const H = canvas.height;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, W, H);

  const cx = W / 2;
  const cy = H / 2;
  const r = Math.min(W, H) * 0.33;
  const n = 18;
  const pts: [number, number][] = Array.from({length: n}, (_, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });

  const frac = fractalizeWithRand(pts, Alea(PREVIEW_SEED), coastSettings);

  ctx.beginPath();
  ctx.moveTo(frac[0][0], frac[0][1]);
  for (let i = 1; i < frac.length; i++) ctx.lineTo(frac[i][0], frac[i][1]);
  ctx.closePath();
  ctx.fillStyle = "rgba(70,130,190,0.22)";
  ctx.fill();
  ctx.strokeStyle = "#2e6fa0";
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function updatePreviews(): void {
  const rg = document.getElementById("coastRoughnessGraph") as HTMLCanvasElement | null;
  const sp = document.getElementById("coastShapePreview") as HTMLCanvasElement | null;
  if (rg) drawRoughnessGraph(rg);
  if (sp) drawShapePreview(sp);
}

function buildDialogHTML(): string {
  const rows = SLIDER_DEFS.map(({id, label, tip, min, max, step, key}) => {
    const val = coastSettings[key] as number;
    return /* html */ `
      <tr data-tip="${tip}">
        <td style="padding:4px 8px;white-space:nowrap">${label}</td>
        <td style="padding:4px 4px">
          <input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${val}"
            style="width:160px;vertical-align:middle"/>
        </td>
        <td style="padding:4px 6px;min-width:2.8em;text-align:right">
          <span id="${id}Out" style="font-family:monospace;font-size:.85em">${val}</span>
        </td>
        <td style="padding:4px 4px">
          <button id="${id}Reset" title="Reset to default"
            style="font-size:.75em;padding:1px 5px;cursor:pointer">↺</button>
        </td>
      </tr>`;
  }).join("");

  return /* html */ `
    <div id="coastlineSettingsDialog" style="display:none">
      <table style="border-collapse:collapse;width:100%">
        <tbody>${rows}</tbody>
      </table>
      <div style="display:flex;gap:6px;margin-top:10px;align-items:flex-start">
        <div style="flex:1;min-width:0">
          <div style="font-size:.72em;color:#999;margin-bottom:3px">Roughness profile</div>
          <canvas id="coastRoughnessGraph" width="204" height="72"
            style="border:1px solid #ccc;border-radius:2px;display:block"></canvas>
        </div>
        <div>
          <div style="font-size:.72em;color:#999;margin-bottom:3px">Shape preview</div>
          <canvas id="coastShapePreview" width="100" height="100"
            style="border:1px solid #ccc;border-radius:2px;display:block"></canvas>
        </div>
      </div>
      <div style="margin-top:6px;font-size:.8em;color:#888;line-height:1.4">
        Changes apply immediately. Open a new map or click <em>Regenerate</em> to see
        the effect on large continent coastlines.
      </div>
    </div>`;
}

function setupCoastlineSettingsDialog(): void {
  // Inject HTML once
  if (!document.getElementById("coastlineSettingsDialog")) {
    document.body.insertAdjacentHTML("beforeend", buildDialogHTML());
  }

  // Wire up each slider
  for (const {id, key} of SLIDER_DEFS) {
    const slider = document.getElementById(id) as HTMLInputElement | null;
    const output = document.getElementById(`${id}Out`) as HTMLElement | null;
    const resetBtn = document.getElementById(`${id}Reset`) as HTMLElement | null;

    if (!slider || !output || !resetBtn) continue;

    const defaultVal = coastSettings[key] as number;

    slider.addEventListener("input", () => {
      const val = parseFloat(slider.value);
      (coastSettings[key] as number) = val;
      output.textContent = String(val);
      updatePreviews();
      if (typeof drawFeatures === "function") drawFeatures();
    });

    resetBtn.addEventListener("click", () => {
      (coastSettings[key] as number) = defaultVal;
      slider.value = String(defaultVal);
      output.textContent = String(defaultVal);
      updatePreviews();
      if (typeof drawFeatures === "function") drawFeatures();
    });
  }

  updatePreviews();

  window.showCoastlineSettings = () => {
    $("#coastlineSettingsDialog").dialog({
      title: "Coastline Advanced Settings",
      resizable: false,
      width: "auto",
      position: {my: "center", at: "center", of: "svg"}
    });
  };
}

setupCoastlineSettingsDialog();
