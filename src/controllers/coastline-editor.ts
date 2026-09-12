import { closeDialogs, destroyDialog } from "@/components/dialog/dialog-helpers";
import { Controllers } from "@/controllers";
import { Coastline, type CoastlineSettings, type FractalizedShape } from "@/generators/coastline-generator";
import type { Feature } from "@/generators/features";
import type { Point } from "@/types/global";
import { ensureEl, findEl } from "../utils";

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
    tip: "Maximum recursion levels per edge. Each +1 can double point count in rough zones: 6 gives a tiny isle a real shoreline, but makes a continent heavy to draw",
    min: 1,
    max: 5,
    step: 1,
    key: "maxDepth"
  },
  {
    id: "coastBaseAmplitude",
    label: "Roughness amplitude",
    tip: "Peak perpendicular displacement. Scales with √(edge length) so large edges stay proportional. 0 keeps the arcs as they are, high values carve deep inlets",
    min: 0,
    max: 8,
    step: 0.1,
    key: "baseAmplitude"
  },
  {
    id: "coastAmplitudeDecay",
    label: "Amplitude decay",
    tip: "Amplitude multiplier per recursion level (Hurst exponent). Low = detail fades quickly into smooth curves; above 1 = the finest level is displaced the most, a spiky, crumbled shore",
    min: 0.1,
    max: 1.3,
    step: 0.01,
    key: "amplitudeDecay"
  },
  {
    id: "coastMinEdge",
    label: "Minimum edge",
    tip: "Edges shorter than this (map units) are never subdivided regardless of roughness. Small values let tiny isles get detail, large ones keep only the big features rough",
    min: 0,
    max: 20,
    step: 0.1,
    key: "minEdge"
  },
  {
    id: "coastSmoothThreshold",
    label: "Smooth threshold",
    tip: "Places where the roughness field is below this receive zero displacement → glassy arc. 0 = the whole coast is rough, 0.9 = only the rare peaks",
    min: 0,
    max: 0.9,
    step: 0.01,
    key: "smoothThreshold"
  },
  {
    id: "coastRoughnessContrast",
    label: "Roughness contrast",
    tip: "Power applied to the roughness field. Below 1 = roughness spread evenly along the coast; higher = sharper calm/rough transition",
    min: 0.1,
    max: 10,
    step: 0.1,
    key: "roughnessContrast"
  },
  {
    id: "coastRoughnessScale",
    label: "Roughness zone size",
    tip: "Size of a calm or rough stretch of coast, in map units. A few units vary the shore of a single isle; hundreds give a continent a few long calm and rough coasts",
    min: 2,
    max: 600,
    step: 1,
    key: "roughnessScale"
  },
  {
    id: "coastVariant",
    label: "Variant",
    tip: "Reshuffles the coastline. Each value is a different set of coasts, with the same character",
    min: 0,
    max: 99,
    step: 1,
    key: "variant"
  },
  {
    id: "coastLakeSmoothThreshMult",
    label: "Lake smooth multiplier",
    tip: "Smooth-threshold multiplier for lake shores. 1 = same roughness as ocean, 0 = every lake shore is rough, high = glassy lakes",
    min: 0,
    max: 5,
    step: 0.1,
    key: "lakeSmoothThreshMult"
  }
];

const COAST_PRESETS: Record<string, Omit<CoastlineSettings, "enabled" | "variant">> = {
  Default: Coastline.getDefaultSettings(),
  Smooth: {
    maxDepth: 3,
    baseAmplitude: 1,
    amplitudeDecay: 0.6,
    minEdge: 1,
    smoothThreshold: 0.3,
    roughnessContrast: 2.0,
    roughnessScale: 240,
    lakeSmoothThreshMult: 3.0
  },
  Rocky: {
    maxDepth: 4,
    baseAmplitude: 3.0,
    amplitudeDecay: 0.7,
    minEdge: 0.5,
    smoothThreshold: 0.05,
    roughnessContrast: 0.8,
    roughnessScale: 35,
    lakeSmoothThreshMult: 1.2
  },
  Fjords: {
    maxDepth: 4,
    baseAmplitude: 2.8,
    amplitudeDecay: 0.92,
    minEdge: 0.3,
    smoothThreshold: 0.25,
    roughnessContrast: 5.0,
    roughnessScale: 120,
    lakeSmoothThreshMult: 2.5
  },
  Archipelago: {
    maxDepth: 4,
    baseAmplitude: 1.8,
    amplitudeDecay: 0.88,
    minEdge: 0.5,
    smoothThreshold: 0.18,
    roughnessContrast: 1.0,
    roughnessScale: 30,
    lakeSmoothThreshMult: 1.5
  }
};

const PROFILE_SAMPLES = 256; // points sampled around the preview island for the roughness graph
const PREVIEW_CENTER: Point = [700, 450]; // the previews sit on an island of map size, so the
const PREVIEW_RADIUS = 200; // settings read the same here as they do on the map

let scope: Feature | null = null; // the feature the editor shapes, or the whole map
const current = (): CoastlineSettings => scope?.coastline || Coastline.settings;
const previewSeed = () => Coastline.seedFrom(`preview_coastline_${current().variant}`);

function open(featureId?: number): void {
  if (customization) return;
  closeDialogs("#culturesEditor, .stable");
  destroyDialog("coastlineSettingsDialog");
  document.body.insertAdjacentHTML(
    "beforeend",
    `<div id="coastlineSettingsDialog" style="display:none" class="dialog"></div>`
  );
  setScope(featureId ? pack.features[featureId] : null);

  $("#coastlineSettingsDialog").dialog({
    title: "Coastline Settings",
    resizable: false,
    position: { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" },
    close: () => {
      scope = null;
      destroyDialog("coastlineSettingsDialog");
    }
  });
}

/** the whole dialog follows the scope: the controls show its settings, the previews its shape */
function setScope(feature: Feature | null): void {
  scope = feature;
  ensureEl("coastlineSettingsDialog").innerHTML = buildDialogHTML();
  updatePreviews();

  ensureEl<HTMLSelectElement>("coastScopeSelect").addEventListener("change", function () {
    setScope(pack.features[+this.value] || null);
  });
  ensureEl("coastScopeReset").addEventListener("click", dropOwnSettings);

  const resetTo = scope ? Coastline.settings : Coastline.getDefaultSettings(); // for a feature, the map settings are the baseline
  for (const { id, key } of SLIDER_DEFS) {
    const slider = ensureEl<HTMLInputElement>(id);

    slider.addEventListener("input", e => {
      // slider-input re-dispatches a bubbling event from its inner controls; ignore those duplicates
      if (e.target !== e.currentTarget) return;
      applyChange({ [key]: slider.valueAsNumber });
    });

    ensureEl(`${id}Reset`).addEventListener("click", () => {
      slider.value = String(resetTo[key]);
      applyChange({ [key]: resetTo[key] });
    });
  }

  ensureEl<HTMLInputElement>("coastEnabled").addEventListener("change", function () {
    applyChange({ enabled: this.checked });
    syncForm();
  });

  for (const name of Object.keys(COAST_PRESETS)) {
    ensureEl<HTMLButtonElement>(`coastPreset_${name}`).addEventListener("click", () => {
      const preset = COAST_PRESETS[name];
      for (const { id, key } of SLIDER_DEFS) {
        if (key in preset) ensureEl<HTMLInputElement>(id).value = String(preset[key as keyof typeof preset]);
      }
      applyChange(preset);
    });
  }
}

function applyChange(change: Partial<CoastlineSettings>): void {
  if (scope) {
    const firstChange = !scope.coastline; // the feature gets its own settings
    scope.coastline = { ...current(), ...change };
    findEl(`feature_${scope.i}`)?.setAttribute("d", Coastline.getFeaturePath(scope)); // every layer uses this path
    if (firstChange) syncScope();
  } else {
    Coastline.update(change);
    Layers.draw("landmass", "coastline", "lakes");
  }
  updatePreviews();
}

/** back to the map settings: the feature is outlined like every other one again */
function dropOwnSettings(): void {
  if (!scope) return;
  delete scope.coastline;
  findEl(`feature_${scope.i}`)?.setAttribute("d", Coastline.getFeaturePath(scope));
  syncScope();
  syncForm();
  updatePreviews();
}

/** the controls show the settings in effect */
function syncForm(): void {
  const settings = current();
  for (const { id, key } of SLIDER_DEFS) ensureEl<HTMLInputElement>(id).value = String(settings[key]);

  const { enabled } = settings;
  ensureEl<HTMLInputElement>("coastEnabled").checked = enabled;
  ensureEl("coastEnabledTrack").style.background = enabled ? "#33bb88" : "#bbb";
  ensureEl("coastEnabledThumb").style.left = enabled ? "18px" : "2px";
  const slidersDiv = ensureEl("coastSliders");
  slidersDiv.style.opacity = enabled ? "" : "0.4";
  slidersDiv.style.pointerEvents = enabled ? "" : "none";
  for (const name of Object.keys(COAST_PRESETS)) ensureEl<HTMLButtonElement>(`coastPreset_${name}`).disabled = !enabled;
}

/** a feature got its own settings or lost them: the selector, the remove button and the overview follow */
function syncScope(): void {
  if (!scope) return;
  const select = ensureEl<HTMLSelectElement>("coastScopeSelect");
  select.options[select.selectedIndex].text = featureLabel(scope);
  ensureEl("coastScopeReset").style.display = scope.coastline ? "" : "none";
  void Controllers.FeaturesOverview.refresh();
}

// "Kenon (lake) •": the mark says the feature has its own settings
const featureLabel = (feature: Feature) =>
  `${feature.name ? `${feature.name} (${feature.type})` : `Unnamed ${feature.type} #${feature.i}`}${feature.coastline ? " •" : ""}`;

function buildDialogHTML(): string {
  const settings = current();
  const features = pack.features
    .filter(feature => feature?.type === "island" || feature?.type === "lake")
    .sort((a, b) => a.type.localeCompare(b.type) || b.area - a.area);
  const scopeOptions = features
    .map(
      feature => `<option value="${feature.i}" ${feature === scope ? "selected" : ""}>${featureLabel(feature)}</option>`
    )
    .join("");

  const presetButtons = Object.keys(COAST_PRESETS)
    .map(name => `<button id="coastPreset_${name}" style="font-size:.85em; padding:2px 8px">${name}</button>`)
    .join("");

  const rows = SLIDER_DEFS.map(({ id, label, tip, min, max, step, key }) => {
    const hidden = scope?.type === "island" && key === "lakeSmoothThreshMult"; // lake shores only
    return /* html */ `
      <tr data-tip="${tip}" ${hidden ? "hidden" : ""}>
        <td style="padding:2px 0; white-space:nowrap">${label}</td>
        <td style="padding:2px 4px">
          <slider-input id="${id}" min="${min}" max="${max}" step="${step}" value="${settings[key]}"></slider-input>
        </td>
        <td style="padding:2px 0">
          <button id="${id}Reset" title="${scope ? "Reset to the map setting" : "Reset to default"}"
            style="font-size:.8em; padding:1px 5px; cursor:pointer">↺</button>
        </td>
      </tr>`;
  }).join("");

  return /* html */ `
      <style>
        #coastlineSettingsDialog slider-input input[type=range] { width:100%; }
      </style>
      <div style="display:flex; align-items:center; gap:0.5em; margin-bottom:0.5em">
        <select id="coastScopeSelect" style="flex:1; min-width:0; height: 18px" data-tip="What to shape: every coastline of the map, or one island or lake. A feature with its own settings is marked with •; it is not affected by the map settings">
          <option value="0" ${scope ? "" : "selected"}>Map default</option>
          ${scopeOptions}
        </select>
        <button id="coastScopeReset" style="display:${scope?.coastline ? "" : "none"}" data-tip="Reset to follow global map settings">Reset</button>
      </div>
      <div style="display:flex; justify-content:space-between; gap:0.5em; margin-bottom:0.5em; padding-bottom:0.5em; border-bottom:1px solid #ddd">
        <label style="display:flex; align-items:center; gap:0.5em; cursor:pointer; user-select:none" data-tip="Enable or disable coastline fractalization. When disabled, coastlines are simple arcs between feature vertices. Enabling adds naturalistic roughness but can increase rendering time, especially at high detail levels.">
          <input id="coastEnabled" type="checkbox" ${settings.enabled ? "checked" : ""}
            style="position:absolute; opacity:0; pointer-events:none; width:0; height:0"/>
          <span id="coastEnabledTrack" style="position:relative; display:inline-block; width:36px; height:20px; border-radius:10px; background:${settings.enabled ? "#33bb88" : "#bbb"}; cursor:pointer; flex-shrink:0">
            <span id="coastEnabledThumb" style="position:absolute; top:2px; left:${settings.enabled ? "18px" : "2px"};width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3)"></span>
          </span>
        </label>
        <div style="display:flex; align-items:center; gap:0.4em">
          <span style="color:#999; font-size:.9em">Preset</span>
          ${presetButtons}
        </div>
      </div>
      <div id="coastSliders" style="width: 100%">
        <table style="border-collapse:collapse; width:100%">
          <colgroup>
            <col style="width:35%">
            <col style="width:60%">
            <col style="width:5%">
          </colgroup>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div style="display:flex; gap:0.5em; margin-top:0.5em; align-items:flex-start">
        <div style="flex:1;min-width:0">
          <div style="color:#999; font-size:.85em; margin-bottom:3px">Roughness profile</div>
          <canvas id="coastRoughnessGraph" width="auto" height="100" style="display:block"></canvas>
        </div>
        <div>
          <div style="color:#999; font-size:.85em; margin-bottom:3px">Shape preview</div>
          <canvas id="coastShapePreview" width="100" height="100" style="display:block"></canvas>
        </div>
      </div>
`;
}

/** The previews are built from the scoped feature itself, or from a stock island of map size so the settings read the same as on the map */
function previewSubject(): {
  outline: Point[];
  shape: FractalizedShape;
  profile: Float32Array;
  threshold: number;
  lake: boolean;
} {
  if (scope) {
    const settings = Coastline.shoreSettings(scope);
    const outline = Coastline.getFeatureOutline(scope);
    const seed = Coastline.featureSeed(scope.i, settings);
    const profile = Coastline.sampleRoughness(seed, resample(outline, PROFILE_SAMPLES), settings);
    return {
      outline,
      shape: Coastline.getFeatureShape(scope, outline),
      profile,
      threshold: settings.smoothThreshold,
      lake: scope.type === "lake"
    };
  }

  const settings = current();
  const [cx, cy] = PREVIEW_CENTER;
  const ring = Array.from({ length: PROFILE_SAMPLES }, (_, i) => {
    const angle = (2 * Math.PI * i) / PROFILE_SAMPLES - Math.PI / 2;
    return [cx + PREVIEW_RADIUS * Math.cos(angle), cy + PREVIEW_RADIUS * Math.sin(angle)] as Point;
  });
  const outline: Point[] = [
    [cx, cy - PREVIEW_RADIUS],
    [cx + PREVIEW_RADIUS, cy],
    [cx, cy + PREVIEW_RADIUS],
    [cx - PREVIEW_RADIUS, cy]
  ];
  const shape = settings.enabled
    ? Coastline.fractalize(outline, previewSeed(), settings)
    : { points: outline, origIndices: [0, 1, 2, 3] };
  const profile = Coastline.sampleRoughness(previewSeed(), ring, settings);
  return { outline, shape, profile, threshold: settings.smoothThreshold, lake: false };
}

/** `count` points evenly spaced along the closed polygon: a walk along the coast for the roughness graph */
function resample(polygon: Point[], count: number): Point[] {
  const n = polygon.length;
  const lengths = polygon.map(([x, y], i) => Math.hypot(polygon[(i + 1) % n][0] - x, polygon[(i + 1) % n][1] - y));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  if (!total) return polygon;

  const step = total / count;
  const points: Point[] = [];
  let edge = 0;
  let along = 0; // distance walked on the current edge
  for (let i = 0; i < count; i++) {
    while (along >= lengths[edge] && edge < n - 1) {
      along -= lengths[edge]; // steps over zero-length edges too
      edge++;
    }
    const [ax, ay] = polygon[edge];
    const [bx, by] = polygon[(edge + 1) % n];
    const t = lengths[edge] ? along / lengths[edge] : 0;
    points.push([ax + (bx - ax) * t, ay + (by - ay) * t]);
    along += step;
  }
  return points;
}

function updatePreviews(): void {
  const subject = previewSubject();
  drawRoughnessGraph(ensureEl<HTMLCanvasElement>("coastRoughnessGraph"), subject);
  drawShapePreview(ensureEl<HTMLCanvasElement>("coastShapePreview"), subject);
}

function drawRoughnessGraph(
  canvas: HTMLCanvasElement,
  { profile, threshold }: ReturnType<typeof previewSubject>
): void {
  const W = canvas.width;
  const H = canvas.height;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, W, H);

  const thresh = Math.min(Math.max(threshold, 0), 1);
  const threshY = H * (1 - thresh);
  const baseY = H;

  // Pre-compute curve points
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i <= PROFILE_SAMPLES; i++) {
    xs.push((i / PROFILE_SAMPLES) * W);
    ys.push(H * (1 - profile[i % PROFILE_SAMPLES]));
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
  const strokeBand = (clipTop: number, clipBot: number, color: string): void => {
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

  if (!current().enabled) {
    ctx.fillStyle = "rgba(0,0,0,0.38)";
    ctx.fillRect(0, 0, W, H);
  }
}

function drawShapePreview(
  canvas: HTMLCanvasElement,
  { outline, shape, lake }: ReturnType<typeof previewSubject>
): void {
  const W = canvas.width;
  const H = canvas.height;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, W, H);

  // the shape is built in map units, then fitted into the canvas
  const xs = shape.points.map(([x]) => x);
  const ys = shape.points.map(([, y]) => y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const PAD = 8;
  const scale = Math.min((W - 2 * PAD) / (maxX - minX || 1), (H - 2 * PAD) / (maxY - minY || 1));
  const cx = W / 2;
  const cy = H / 2;
  const r = (Math.max(maxX - minX, maxY - minY) * scale) / 2;
  const toCanvas = ([x, y]: Point): Point => [
    cx + (x - (minX + maxX) / 2) * scale,
    cy + (y - (minY + maxY) / 2) * scale
  ];
  const path = new Path2D(
    `${Coastline.buildPath({ points: shape.points.map(toCanvas), origIndices: shape.origIndices })}Z`
  );

  // Water — radial gradient, lighter at centre; land — with a drop shadow. A lake is water inside land
  const waterGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.85);
  waterGrad.addColorStop(0, "#cce5f5");
  waterGrad.addColorStop(1, "#6aa4cb");
  const landGrad = ctx.createRadialGradient(cx - r * 0.1, cy - r * 0.1, r * 0.05, cx, cy, r * 1.1);
  landGrad.addColorStop(0, "#d8c87a");
  landGrad.addColorStop(0.5, "#9cbc60");
  landGrad.addColorStop(1, "#5c8e40");

  ctx.fillStyle = lake ? landGrad : waterGrad;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.shadowColor = "rgba(0,20,60,0.35)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = lake ? waterGrad : landGrad;
  ctx.fill(path);
  ctx.restore();

  // Coastline stroke
  ctx.strokeStyle = "#5c4526";
  ctx.lineWidth = 1.5;
  ctx.stroke(path);

  // Original polygon skeleton — the raw input before fractalization
  const origPts = outline.map(toCanvas);
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

  // Original vertex dots: on the stock island only, a feature has too many
  for (const [x, y] of scope ? [] : origPts) {
    ctx.beginPath();
    ctx.arc(x, y, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fill();
    ctx.strokeStyle = "rgba(60,40,10,0.55)";
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  if (!current().enabled) {
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

export const CoastlineEditor = { open };
