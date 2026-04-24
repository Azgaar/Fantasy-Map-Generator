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

  const pl = 2, pr = 2, pt = 4, pb = 14;
  const gW = W - pl - pr;
  const gH = H - pt - pb;
  const threshY = pt + gH * (1 - Math.min(coastSettings.smoothThreshold, 1));

  ctx.fillStyle = "rgba(80,175,80,0.15)";
  ctx.fillRect(pl, threshY, gW, H - pb - threshY);

  ctx.beginPath();
  for (let i = 0; i <= PROFILE_SIZE; i++) {
    const x = pl + (i / PROFILE_SIZE) * gW;
    const y = pt + gH * (1 - profile[i % PROFILE_SIZE]);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.strokeStyle = "#c05820";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.setLineDash([3, 3]);
  ctx.moveTo(pl, threshY);
  ctx.lineTo(W - pr, threshY);
  ctx.strokeStyle = "rgba(40,140,40,0.85)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "#999";
  ctx.font = "9px sans-serif";
  ctx.fillText("rough", pl + 1, pt + 8);
  ctx.fillText("smooth threshold", pl + 1, H - pb + 10);
}

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

  const shape = fractalize(pts, Alea(PREVIEW_SEED), coastSettings);

  ctx.beginPath();
  const path = new Path2D(`${buildCoastlinePath(shape)}Z`);
  ctx.fillStyle = "rgba(70,130,190,0.22)";
  ctx.fill(path);
  ctx.strokeStyle = "#2e6fa0";
  ctx.lineWidth = 1.5;
  ctx.stroke(path);
}

function updatePreviews(): void {
  const graph = document.getElementById("coastRoughnessGraph");
  const shape = document.getElementById("coastShapePreview");
  if (graph) drawRoughnessGraph(graph as HTMLCanvasElement);
  if (shape) drawShapePreview(shape as HTMLCanvasElement);
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
    </div>`;
}

function setupCoastlineEditor(): void {
  if (!document.getElementById("coastlineSettingsDialog")) {
    document.body.insertAdjacentHTML("beforeend", buildDialogHTML());
  }

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
      position: {my: "center", at: "center", of: "svg"},
    });
  };
}

setupCoastlineEditor();
