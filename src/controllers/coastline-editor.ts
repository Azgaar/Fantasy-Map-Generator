import Alea from "alea";
import {
  buildCoastlinePath,
  type CoastlineSettings,
  defaultCoastSettings,
  fractalize,
  makeRoughnessProfile,
  PROFILE_SIZE,
} from "../renderers/coastline-fractal";
import { byId } from "../utils";

interface SliderDef {
  id: string;
  label: string;
  tip: string;
  min: number;
  max: number;
  step: number;
  key: keyof Omit<CoastlineSettings, "enabled">;
}

const SLIDER_DEFS: SliderDef[] = [
  {
    id: "coastMaxDepth",
    label: "Detail depth",
    tip: "Maximum recursion levels per edge. Each +1 can double point count in rough zones.",
    min: 1,
    max: 5,
    step: 1,
    key: "maxDepth",
  },
  {
    id: "coastBaseAmplitude",
    label: "Roughness amplitude",
    tip: "Peak perpendicular displacement. Scales with √(edge length) so large edges stay proportional.",
    min: 0.2,
    max: 4,
    step: 0.1,
    key: "baseAmplitude",
  },
  {
    id: "coastAmplitudeDecay",
    label: "Amplitude decay",
    tip: "Amplitude multiplier per recursion level (Hurst exponent). Lower = more jagged finer detail.",
    min: 0.01,
    max: 0.99,
    step: 0.01,
    key: "amplitudeDecay",
  },
  {
    id: "coastMinEdge",
    label: "Minimum edge",
    tip: "Edges shorter than this (map units) are never subdivided regardless of roughness.",
    min: 0.1,
    max: 10,
    step: 0.1,
    key: "minEdge",
  },
  {
    id: "coastSmoothThreshold",
    label: "Smooth threshold",
    tip: "Profile values below this receive zero displacement → glassy arc. Controls calm-coast coverage.",
    min: 0.01,
    max: 0.5,
    step: 0.01,
    key: "smoothThreshold",
  },
  {
    id: "coastRoughnessContrast",
    label: "Roughness contrast",
    tip: "Power applied to the roughness profile. Higher = sharper calm/rough transition.",
    min: 0.5,
    max: 10,
    step: 0.1,
    key: "roughnessContrast",
  },
  {
    id: "coastProfileHarmonics",
    label: "Roughness zones",
    tip: "Number of cosine harmonics shaping the roughness envelope. 1 = one large concentrated patch; 8 = many small scattered zones.",
    min: 1,
    max: 8,
    step: 1,
    key: "profileHarmonics",
  },
  {
    id: "coastLakeSmoothThreshMult",
    label: "Lake smooth multiplier",
    tip: "Smooth-threshold multiplier for lake shores. 1 = same roughness as ocean.",
    min: 0.1,
    max: 5,
    step: 0.1,
    key: "lakeSmoothThreshMult",
  },
];

const COAST_PRESETS: Record<string, Omit<CoastlineSettings, "enabled">> = {
  Default: {
    ...defaultCoastSettings,
  },
  Smooth: {
    maxDepth: 3,
    baseAmplitude: 1,
    amplitudeDecay: 0.6,
    minEdge: 1,
    smoothThreshold: 0.3,
    roughnessContrast: 2.0,
    profileHarmonics: 1,
    lakeSmoothThreshMult: 3.0,
  },
  Rocky: {
    maxDepth: 4,
    baseAmplitude: 3.0,
    amplitudeDecay: 0.7,
    minEdge: 0.5,
    smoothThreshold: 0.05,
    roughnessContrast: 0.8,
    profileHarmonics: 7,
    lakeSmoothThreshMult: 1.2,
  },
  Fjords: {
    maxDepth: 4,
    baseAmplitude: 2.8,
    amplitudeDecay: 0.92,
    minEdge: 0.3,
    smoothThreshold: 0.25,
    roughnessContrast: 5.0,
    profileHarmonics: 2,
    lakeSmoothThreshMult: 2.5,
  },
  Archipelago: {
    maxDepth: 4,
    baseAmplitude: 1.8,
    amplitudeDecay: 0.88,
    minEdge: 0.5,
    smoothThreshold: 0.18,
    roughnessContrast: 1.0,
    profileHarmonics: 8,
    lakeSmoothThreshMult: 1.5,
  },
};

const PREVIEW_SEED = "preview_coastline";

export function open(): void {
  if (!byId("coastlineSettingsDialog")) {
    document.body.insertAdjacentHTML("beforeend", buildDialogHTML());
  }

  for (const { id, key } of SLIDER_DEFS) {
    const slider = byId(id) as HTMLInputElement | null;
    const output = byId(`${id}Out`) as HTMLElement | null;
    const resetBtn = byId(`${id}Reset`) as HTMLElement | null;

    if (!slider || !output || !resetBtn) continue;

    const defaultVal = defaultCoastSettings[key] as number;

    slider.on("input", () => {
      const value = slider.valueAsNumber;
      defaultCoastSettings[key] = value;
      output.textContent = String(value);
      updatePreviews();
      drawFeatures();
    });

    resetBtn.on("click", () => {
      (defaultCoastSettings[key] as number) = defaultVal;
      slider.value = String(defaultVal);
      output.textContent = String(defaultVal);
      updatePreviews();
      drawFeatures();
    });
  }

  const enabledCb = byId("coastEnabled") as HTMLInputElement | null;
  const slidersDiv = byId("coastSliders") as HTMLElement | null;
  const track = byId("coastEnabledTrack") as HTMLElement | null;
  const thumb = byId("coastEnabledThumb") as HTMLElement | null;
  if (!enabledCb || !slidersDiv || !track || !thumb) return;

  enabledCb.checked = defaultCoastSettings.enabled;
  const syncToggle = () => {
    track.style.background = defaultCoastSettings.enabled ? "#33bb88" : "#bbb";
    thumb.style.left = defaultCoastSettings.enabled ? "18px" : "2px";
    slidersDiv.style.opacity = defaultCoastSettings.enabled ? "" : "0.4";
    slidersDiv.style.pointerEvents = defaultCoastSettings.enabled ? "" : "none";
    Object.keys(COAST_PRESETS).forEach((name) => {
      const btn = byId(`coastPreset_${name}`) as HTMLButtonElement | null;
      if (btn) btn.disabled = !defaultCoastSettings.enabled;
    });
  };

  syncToggle();
  enabledCb.on("change", () => {
    defaultCoastSettings.enabled = enabledCb.checked;
    syncToggle();
    updatePreviews();
    drawFeatures();
  });

  // Preset buttons
  for (const name of Object.keys(COAST_PRESETS)) {
    const btn = byId(`coastPreset_${name}`) as HTMLButtonElement | null;
    if (!btn) continue;
    btn.on("click", () => {
      const preset = COAST_PRESETS[name];
      for (const { id, key } of SLIDER_DEFS) {
        if (!(key in preset)) continue;
        const val = preset[key as keyof typeof preset];
        defaultCoastSettings[key] = val;
        const slider = byId(id) as HTMLInputElement | null;
        const output = byId(`${id}Out`) as HTMLElement | null;
        if (slider) slider.value = String(val);
        if (output) output.textContent = String(val);
      }
      updatePreviews();
      drawFeatures();
    });
  }

  updatePreviews();
  closeDialogs("#culturesEditor, .stable");

  $("#coastlineSettingsDialog").dialog({
    title: "Coastline Settings Editor",
    resizable: false,
    width: "auto",
    position: { my: "right top", at: "right-10 top+10", of: "svg" },
  });
}

function buildDialogHTML(): string {
  const presetButtons = Object.keys(COAST_PRESETS)
    .map(
      (name) =>
        `<button id="coastPreset_${name}" style="font-size:.78em;padding:2px 8px">${name}</button>`,
    )
    .join("");

  const rows = SLIDER_DEFS.map(({ id, label, tip, min, max, step, key }) => {
    const value = defaultCoastSettings[key];
    return /* html */ `
      <tr data-tip="${tip}">
        <td style="padding:2px 0;white-space:nowrap">${label}</td>
        <td style="padding:2px 4px">
          <input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"
            style="width:160px;vertical-align:middle"/>
        </td>
        <td style="padding:2px 6px;min-width:2em;text-align:right">
          <span id="${id}Out" style="font-family:monospace;font-size:.85em">${value}</span>
        </td>
        <td style="padding:2px 0">
          <button id="${id}Reset" title="Reset to default"
            style="font-size:.75em;padding:1px 5px;cursor:pointer">↺</button>
        </td>
      </tr>`;
  }).join("");

  return /* html */ `
    <div id="coastlineSettingsDialog" style="display:none">
      <div style="display:flex;justify-content:space-between;gap:10px;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #ddd">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;user-select:none" data-tip="Enable or disable coastline fractalization. When disabled, coastlines are simple arcs between feature vertices. Enabling adds naturalistic roughness but can increase rendering time, especially at high detail levels.">
          <input id="coastEnabled" type="checkbox" ${defaultCoastSettings.enabled ? "checked" : ""}
            style="position:absolute;opacity:0;pointer-events:none;width:0;height:0"/>
          <span id="coastEnabledTrack" style="position:relative;display:inline-block;width:36px;height:20px;border-radius:10px;background:${defaultCoastSettings.enabled ? "#33bb88" : "#bbb"};cursor:pointer;flex-shrink:0">
            <span id="coastEnabledThumb" style="position:absolute;top:2px;left:${defaultCoastSettings.enabled ? "18px" : "2px"};width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3)"></span>
          </span>
        </label>
        <div style="display:flex;align-items:center;gap:4px">
          <span style="color:#999;font-size:.85em">Preset</span>
          ${presetButtons}
        </div>
      </div>
      <div id="coastSliders">
        <table style="border-collapse:collapse;width:100%">
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div style="display:flex;gap:6px;margin-top:10px;align-items:flex-start">
        <div style="flex:1;min-width:0">
          <div style="color:#999;font-size:.85em;margin-bottom:3px">Roughness profile</div>
          <canvas id="coastRoughnessGraph" width="auto" height="100" style="display:block"></canvas>
        </div>
        <div>
          <div style="color:#999;font-size:.85em;margin-bottom:3px">Shape preview</div>
          <canvas id="coastShapePreview" width="100" height="100" style="display:block"></canvas>
        </div>
      </div>
    </div>`;
}

function updatePreviews(): void {
  const graph = byId("coastRoughnessGraph");
  const shape = byId("coastShapePreview");
  if (graph) drawRoughnessGraph(graph as HTMLCanvasElement);
  if (shape) drawShapePreview(shape as HTMLCanvasElement);
}

function drawRoughnessGraph(canvas: HTMLCanvasElement): void {
  const W = canvas.width;
  const H = canvas.height;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, W, H);

  const rand = Alea(PREVIEW_SEED);
  const profile = makeRoughnessProfile(
    rand,
    defaultCoastSettings.roughnessContrast,
    defaultCoastSettings.profileHarmonics,
  );

  const thresh = Math.min(Math.max(defaultCoastSettings.smoothThreshold, 0), 1);
  const threshY = H * (1 - thresh);
  const baseY = H;

  // Pre-compute curve points
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i <= PROFILE_SIZE; i++) {
    xs.push((i / PROFILE_SIZE) * W);
    ys.push(H * (1 - profile[i % PROFILE_SIZE]));
  }

  // Helper: fill area under curve clipped to a horizontal band
  const fillBand = (clipTop: number, clipBot: number, color: string): void => {
    const h = clipBot - clipTop;
    if (h <= 0) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, clipTop, W, h);
    ctx.clip();
    ctx.beginPath();
    ctx.moveTo(xs[0], ys[0]);
    for (let i = 1; i < xs.length; i++) ctx.lineTo(xs[i], ys[i]);
    ctx.lineTo(xs[xs.length - 1], baseY);
    ctx.lineTo(xs[0], baseY);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  };

  // Helper: stroke curve clipped to a horizontal band
  const strokeBand = (
    clipTop: number,
    clipBot: number,
    color: string,
  ): void => {
    const h = clipBot - clipTop;
    if (h <= 0) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, clipTop, W, h);
    ctx.clip();
    ctx.beginPath();
    ctx.moveTo(xs[0], ys[0]);
    for (let i = 1; i < xs.length; i++) ctx.lineTo(xs[i], ys[i]);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  };

  // Rough zone (above threshold): warm orange
  fillBand(0, threshY, "rgba(210,90,30,0.20)");
  strokeBand(0, threshY, "#c85520");

  // Smooth zone (below threshold): cool teal
  fillBand(threshY, baseY, "rgba(30,165,135,0.20)");
  strokeBand(threshY, baseY, "#18a888");

  // Threshold dashed line
  ctx.save();
  ctx.beginPath();
  ctx.setLineDash([4, 3]);
  ctx.moveTo(0, threshY);
  ctx.lineTo(W, threshY);
  ctx.strokeStyle = "rgba(30,140,100,0.75)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // Zone labels
  ctx.font = "bold 8px sans-serif";
  ctx.textAlign = "left";
  if (threshY > 12) {
    ctx.fillStyle = "#c85520";
    ctx.fillText("ROUGH", 12, 11);
  }
  if (baseY - threshY > 10) {
    ctx.fillStyle = "#18a888";
    ctx.fillText("CALM", 12, baseY - 4);
  }

  if (!defaultCoastSettings.enabled) {
    ctx.fillStyle = "rgba(0,0,0,0.38)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#fff";
  }
}

function drawShapePreview(canvas: HTMLCanvasElement): void {
  const W = canvas.width;
  const H = canvas.height;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, W, H);

  const cx = W / 2;
  const cy = H / 2;
  const r = Math.min(W, H) * 0.34;

  // Generate at canvas scale so all setting changes are immediately visible.
  const basePts: [number, number][] = [
    [cx, cy - r], // top
    [cx + r, cy], // right
    [cx, cy + r], // bottom
    [cx - r, cy], // left
  ];

  const shape = defaultCoastSettings.enabled
    ? fractalize(basePts, Alea(PREVIEW_SEED), defaultCoastSettings)
    : { points: basePts, origIndices: [0, 1, 2, 3] };
  const path = new Path2D(`${buildCoastlinePath(shape)}Z`);

  // Ocean background — radial gradient, lighter at centre
  const bgGrad = ctx.createRadialGradient(
    cx,
    cy,
    0,
    cx,
    cy,
    Math.max(W, H) * 0.85,
  );
  bgGrad.addColorStop(0, "#cce5f5");
  bgGrad.addColorStop(1, "#6aa4cb");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Land fill with drop shadow
  const landGrad = ctx.createRadialGradient(
    cx - r * 0.1,
    cy - r * 0.1,
    r * 0.05,
    cx,
    cy,
    r * 1.1,
  );
  landGrad.addColorStop(0, "#d8c87a");
  landGrad.addColorStop(0.5, "#9cbc60");
  landGrad.addColorStop(1, "#5c8e40");

  ctx.save();
  ctx.shadowColor = "rgba(0,20,60,0.35)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = landGrad;
  ctx.fill(path);
  ctx.restore();

  // Coastline stroke
  ctx.strokeStyle = "#5c4526";
  ctx.lineWidth = 1.5;
  ctx.stroke(path);

  // Original polygon skeleton — shows the raw 4-vertex input before fractalization
  const origPts = shape.origIndices.map((i) => shape.points[i]);
  ctx.beginPath();
  for (let j = 0; j < origPts.length; j++) {
    const [x, y] = origPts[j];
    j === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.lineWidth = 0.8;
  ctx.setLineDash([3, 3]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Original vertex dots
  for (const [x, y] of origPts) {
    ctx.beginPath();
    ctx.arc(x, y, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fill();
    ctx.strokeStyle = "rgba(60,40,10,0.55)";
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  if (!defaultCoastSettings.enabled) {
    ctx.fillStyle = "rgba(0,0,0,0.38)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("OFF", cx, cy);
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
  }
}

declare global {
  interface Window {
    CoastlineEditor: { open: () => void };
  }
}

window.CoastlineEditor = { open };
