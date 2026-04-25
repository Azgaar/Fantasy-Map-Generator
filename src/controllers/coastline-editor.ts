import Alea from "alea";
import {
  buildCoastlinePath,
  type CoastlineSettings,
  coastSettings,
  fractalize,
  makeRoughnessProfile,
  PROFILE_SIZE,
} from "../renderers/coastline-fractal";

declare global {
  var showCoastlineSettings: () => void;
}

const PREVIEW_SEED = "preview_coastline_42";

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
];

function drawRoughnessGraph(canvas: HTMLCanvasElement): void {
  const W = canvas.width;
  const H = canvas.height;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, W, H);

  const rand = Alea(PREVIEW_SEED);
  const profile = makeRoughnessProfile(rand, coastSettings.roughnessContrast);

  const pl = 2,
    pr = 2,
    pt = 6,
    pb = 6;
  const gW = W - pl - pr;
  const gH = H - pt - pb;
  const thresh = Math.min(Math.max(coastSettings.smoothThreshold, 0), 1);
  const threshY = pt + gH * (1 - thresh);
  const baseY = pt + gH;

  // Pre-compute curve points
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i <= PROFILE_SIZE; i++) {
    xs.push(pl + (i / PROFILE_SIZE) * gW);
    ys.push(pt + gH * (1 - profile[i % PROFILE_SIZE]));
  }

  // Helper: fill area under curve clipped to a horizontal band
  const fillBand = (clipTop: number, clipBot: number, color: string): void => {
    const h = clipBot - clipTop;
    if (h <= 0) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(pl, clipTop, gW, h);
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
    ctx.rect(pl, clipTop, gW, h);
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
  fillBand(pt, threshY, "rgba(210,90,30,0.20)");
  strokeBand(pt, threshY, "#c85520");

  // Smooth zone (below threshold): cool teal
  fillBand(threshY, baseY, "rgba(30,165,135,0.20)");
  strokeBand(threshY, baseY, "#18a888");

  // Threshold dashed line
  ctx.save();
  ctx.beginPath();
  ctx.setLineDash([4, 3]);
  ctx.moveTo(pl, threshY);
  ctx.lineTo(W - pr, threshY);
  ctx.strokeStyle = "rgba(30,140,100,0.75)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // Zone labels
  ctx.font = "bold 8px sans-serif";
  ctx.textAlign = "left";
  if (threshY > pt + 12) {
    ctx.fillStyle = "#c85520";
    ctx.fillText("ROUGH", pl + 3, pt + 9);
  }
  if (baseY - threshY > 10) {
    ctx.fillStyle = "#18a888";
    ctx.fillText("CALM", pl + 3, baseY - 2);
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

  const shape = fractalize(basePts, Alea(PREVIEW_SEED), coastSettings);
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
}

function updatePreviews(): void {
  const graph = document.getElementById("coastRoughnessGraph");
  const shape = document.getElementById("coastShapePreview");
  if (graph) drawRoughnessGraph(graph as HTMLCanvasElement);
  if (shape) drawShapePreview(shape as HTMLCanvasElement);
}

function buildDialogHTML(): string {
  const rows = SLIDER_DEFS.map(({ id, label, tip, min, max, step, key }) => {
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
          <canvas id="coastRoughnessGraph" width="266" height="100"
            style="border:1px solid #ccc;border-radius:2px;display:block"></canvas>
        </div>
        <div>
          <div style="font-size:.72em;color:#999;margin-bottom:3px">Shape preview</div>
          <canvas id="coastShapePreview" width="100" height="100"
            style="border:1px solid #ccc;border-radius:2px;display:block"></canvas>
        </div>
      </div>
    </div>`;
}

function setupCoastlineEditor(): void {
  if (!document.getElementById("coastlineSettingsDialog")) {
    document.body.insertAdjacentHTML("beforeend", buildDialogHTML());
  }

  for (const { id, key } of SLIDER_DEFS) {
    const slider = document.getElementById(id) as HTMLInputElement | null;
    const output = document.getElementById(`${id}Out`) as HTMLElement | null;
    const resetBtn = document.getElementById(
      `${id}Reset`,
    ) as HTMLElement | null;

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
      position: { my: "center", at: "center", of: "svg" },
    });
  };
}

setupCoastlineEditor();
