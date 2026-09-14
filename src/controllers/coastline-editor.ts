import { closeDialogs, destroyDialog } from "@/components/dialog/dialog-helpers";
import { Controllers } from "@/controllers";
import { Coastline, type CoastlineSettings, type FractalizedShape } from "@/generators/coastline-generator";
import type { Feature } from "@/generators/features-generator";
import { drawFeaturePath } from "@/renderers/draw-landmass";
import type { Point } from "@/types/global";
import { ensureEl, escapeHtml, findEl } from "@/utils";

interface InputParams {
  id: string;
  label: string;
  tip: string;
  min: number;
  max: number;
  step: number;
  key: keyof Omit<CoastlineSettings, "enabled">;
}

const INPUTS_CONFIG: InputParams[] = [
  {
    id: "coastMaxDepth",
    label: "Detail",
    tip: "How fine the shore detail is. Higher adds ever smaller bays and points but makes the map slower to draw",
    min: 1,
    max: 5,
    step: 1,
    key: "maxDepth"
  },
  {
    id: "coastBaseAmplitude",
    label: "Ruggedness",
    tip: "How far the coast bends in and out. 0 keeps the smooth arcs, high values carve deep bays and headlands",
    min: 0,
    max: 8,
    step: 0.1,
    key: "baseAmplitude"
  },
  {
    id: "coastAmplitudeDecay",
    label: "Fine detail",
    tip: "How much the small details stand out. Low gives soft, rounded shores; high gives jagged, crumbly ones",
    min: 0.1,
    max: 1.3,
    step: 0.01,
    key: "amplitudeDecay"
  },
  {
    id: "coastMinEdge",
    label: "Smallest edge",
    tip: "Coast segments shorter than this stay as they are. Raise it to keep tiny isles simple and the map faster to draw",
    min: 0,
    max: 20,
    step: 0.1,
    key: "minEdge"
  },
  {
    id: "coastSmoothThreshold",
    label: "Calm shores",
    tip: "How much of the coast stays calm. 0 makes every shore rough, high values leave only a few rough stretches",
    min: 0,
    max: 0.9,
    step: 0.01,
    key: "smoothThreshold"
  },
  {
    id: "coastRoughnessContrast",
    label: "Contrast",
    tip: "How sharply calm shores turn into rough ones. Low blends them, high gives clear-cut calm and rough coasts",
    min: 0.1,
    max: 10,
    step: 0.1,
    key: "roughnessContrast"
  },
  {
    id: "coastRoughnessScale",
    label: "Stretch length",
    tip: "How long a calm or rough stretch of coast is. Small mixes them along a single isle, large gives a continent a few long coasts of each kind",
    min: 2,
    max: 600,
    step: 1,
    key: "roughnessScale"
  },
  {
    id: "coastVariant",
    label: "Variant",
    tip: "Reshuffles where the calm and rough stretches fall",
    min: 0,
    max: 99,
    step: 1,
    key: "variant"
  },
  {
    id: "coastLakeSmoothThreshMult",
    label: "Calmer lakes",
    tip: "How much calmer lake shores are than the sea. 1 is the same, higher gives glassy lakes, 0 makes every lake shore rough",
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
  Skerries: {
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

let selectedFeature: Feature | null = null; // the feature the editor shapes, or the whole map

function open(featureId?: number): void {
  if (customization) return;
  closeDialogs(".stable");
  destroyDialog("coastlineSettingsDialog");
  ensureEl("dialogs").insertAdjacentHTML(
    "beforeend",
    `<div id="coastlineSettingsDialog" style="display:none" class="dialog"></div>`
  );
  setFeature(featureId ? pack.features[featureId] : null);

  $("#coastlineSettingsDialog").dialog({
    title: "Coastline Settings",
    resizable: false,
    position: { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" },
    close: () => {
      selectedFeature = null;
      destroyDialog("coastlineSettingsDialog");
    }
  });
  updatePreviews();
}

/** the whole dialog follows the scope: the controls show its settings, the previews its shape */
function setFeature(feature: Feature | null): void {
  selectedFeature = feature;
  ensureEl("coastlineSettingsDialog").innerHTML = buildDialogHTML();
  updatePreviews();

  ensureEl<HTMLSelectElement>("coastScopeSelect").addEventListener("change", function () {
    setFeature(pack.features[+this.value] || null);
  });
  ensureEl("coastScopeReset").addEventListener("click", dropOwnSettings);

  const resetTo = selectedFeature ? Coastline.settings : Coastline.getDefaultSettings(); // for a feature, the map settings are the baseline
  for (const { id, key } of INPUTS_CONFIG) {
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
      for (const { id, key } of INPUTS_CONFIG) {
        if (key in preset) ensureEl<HTMLInputElement>(id).value = String(preset[key as keyof typeof preset]);
      }
      applyChange(preset);
    });
  }
}

function applyChange(change: Partial<CoastlineSettings>): void {
  if (selectedFeature) {
    const firstChange = !selectedFeature.coastline; // the feature gets its own settings
    selectedFeature.coastline = { ...(selectedFeature.coastline || Coastline.settings), ...change };
    drawFeaturePath(selectedFeature);
    if (firstChange) syncScope();
  } else {
    Coastline.update(change);
    Layers.draw("landmass", "coastline", "lakes");
  }
  updatePreviews();
}

/** back to the map settings: the feature is outlined like every other one again */
function dropOwnSettings(): void {
  if (!selectedFeature) return;
  delete selectedFeature.coastline;
  drawFeaturePath(selectedFeature);
  syncScope();
  syncForm();
  updatePreviews();
}

/** the controls show the settings in effect */
function syncForm(): void {
  const settings = selectedFeature?.coastline || Coastline.settings;
  for (const { id, key } of INPUTS_CONFIG) ensureEl<HTMLInputElement>(id).value = String(settings[key]);

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
  if (!selectedFeature) return;
  const select = ensureEl<HTMLSelectElement>("coastScopeSelect");
  select.options[select.selectedIndex].text = featureLabel(selectedFeature);
  ensureEl("coastScopeReset").style.display = selectedFeature.coastline ? "" : "none";
  ensureEl("coastScopeFollows").style.display = selectedFeature && !selectedFeature.coastline ? "" : "none";
  ensureEl("coastScopeMap").style.display = selectedFeature ? "none" : "";

  if (findEl("featuresOverview")) void Controllers.FeaturesOverview.refresh(); // only when open: skip loading the chunk
}

const featureLabel = (feature: Feature) =>
  `${feature.name ? `${feature.name} • ${feature.subtype} ${feature.type}` : `Unnamed ${feature.subtype || feature.type} #${feature.i}`}${feature.coastline ? " •" : ""}`;

function buildDialogHTML(): string {
  const settings = selectedFeature?.coastline || Coastline.settings;
  const features = pack.features
    .filter(feature => feature?.type === "island" || feature?.type === "lake")
    .sort((a, b) => a.type.localeCompare(b.type) || b.area - a.area);
  const scopeOptions = features
    .map(
      feature =>
        `<option value="${feature.i}" ${feature === selectedFeature ? "selected" : ""}>${escapeHtml(featureLabel(feature))}</option>`
    )
    .join("");

  const presetButtons = Object.keys(COAST_PRESETS)
    .map(name => `<button id="coastPreset_${name}" style="padding:0.2em 0.8em">${name}</button>`)
    .join("");

  const rows = INPUTS_CONFIG.map(({ id, label, tip, min, max, step, key }) => {
    const hidden = selectedFeature?.type === "island" && key === "lakeSmoothThreshMult"; // lake shores only
    return /* html */ `
      <tr data-tip="${tip}" ${hidden ? "hidden" : ""}>
        <td style="white-space:nowrap">${label}</td>
        <td>
          <slider-input id="${id}" min="${min}" max="${max}" step="${step}" value="${settings[key]}"></slider-input>
        </td>
        <td style="padding:0.2em">
          <button id="${id}Reset" title="${selectedFeature ? "Reset to the map globals" : "Reset to default"}" style="font-size:.8em; padding:1px 5px; cursor:pointer">↺</button>
        </td>
      </tr>`;
  }).join("");

  return /* html */ `
      <style>
        #coastlineSettingsDialog slider-input input[type=range] { width:100%; }
      </style>
      <div style="display:flex; align-items:center; gap:0.5em; margin-bottom:0.5em">
        <select id="coastScopeSelect" style="flex:1; min-width:0; height: 18px" data-tip="Select feature. Features with custom settings are bullet-marked">
          <option value="0" ${selectedFeature ? "" : "selected"}>Whole map</option>
          ${scopeOptions}
        </select>
        <button id="coastScopeReset" style="display:${selectedFeature?.coastline ? "" : "none"}" data-tip="Reset custom override and follow the global map settings">Reset to map settings</button>
        <span id="coastScopeFollows" style="display:${selectedFeature && !selectedFeature.coastline ? "" : "none"}; color:#999">follows the map settings</span>
        <span id="coastScopeMap" style="display:${selectedFeature ? "none" : ""}; color:#999">apply to all non-overwritten features</span>
      </div>
      <div style="display:flex; justify-content:space-between; gap:0.5em; margin-bottom:0.5em; padding-bottom:0.5em; border-bottom:1px solid #ddd">
        <label style="display:flex; align-items:center; gap:0.5em; cursor:pointer; user-select:none" data-tip="Enable or disable coastline fractalization. When disabled, coastlines are simple arcs between feature vertices. Enabling adds naturalistic roughness but can increase rendering time">
          <input id="coastEnabled" type="checkbox" ${settings.enabled ? "checked" : ""}
            style="position:absolute; opacity:0; pointer-events:none; width:0; height:0"/>
          <span id="coastEnabledTrack" style="position:relative; display:inline-block; width:36px; height:20px; border-radius:10px; background:${settings.enabled ? "#33bb88" : "#bbb"}; cursor:pointer; flex-shrink:0">
            <span id="coastEnabledThumb" style="position:absolute; top:2px; left:${settings.enabled ? "18px" : "2px"};width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3)"></span>
          </span>
        </label>
        <div style="display:flex; align-items:center; gap:0.4em" data-tip="A ready-made look. Sets every slider, tune from there">
          <span style="color:#999">Preset</span>
          ${presetButtons}
        </div>
      </div>
      <div id="coastSliders" style="max-width: 35em">
        <table style="border-collapse:collapse; width:100%">
          <colgroup>
            <col style="width:30%">
            <col style="width:65%">
            <col style="width:5%">
          </colgroup>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div style="margin-top:0.5em">
        <div style="display:flex; justify-content:space-between; color:#999; font-size:.85em; margin-bottom:0.2em">
          <span>Shape preview</span>
          <span id="coastPreviewStats" data-tip="Coastline rendering cost"></span>
        </div>
        <canvas id="coastShapePreview" style="display:block; height:170px"></canvas>
        <canvas id="coastRoughnessGraph" style="display:block; height:56px"></canvas>
      </div>
`;
}

interface PreviewPart {
  shape: FractalizedShape; // the coastline as drawn on the map
  rough: (boolean | null)[]; // per raw edge: subdivided as rough, left a calm arc, or null along the map border
  lake: boolean;
}

interface PreviewSubject {
  parts: PreviewPart[];
  samples: Point[]; // a walk along every coast, PROFILE_SAMPLES points in all
  profile: Float32Array; // roughness at each sample
  focus: number; // sample the magnifier looks at: chosen under the default settings, so it stays put while they are tuned
  roughSamples: number;
  points: number;
  vertices: number; // outline vertices before fractalization: what the feature is, whatever the settings
}

const PROFILE_SAMPLES = 256; // points sampled around the preview island for the roughness graph
/** The previews are built from the map itself: the scoped feature, or every island and lake, with the settings each is drawn with */
function previewSubject(): PreviewSubject {
  const features = selectedFeature
    ? [selectedFeature]
    : pack.features.filter(feature => feature && feature.type !== "ocean");
  const outlines = features.map(feature => Coastline.getFeatureOutline(feature));
  const perimeters = outlines.map(perimeter);
  const total = perimeters.reduce((sum, length) => sum + length, 0) || 1;
  const onBorder = ([x, y]: Point) =>
    x === 0 || y === 0 || x === options.map.graph.width || y === options.map.graph.height;

  const parts: PreviewPart[] = [];
  const samples: Point[] = [];
  const profile: number[] = [];
  let roughSamples = 0;
  let points = 0;
  let vertices = 0;
  let focus = 0;
  let focusRoughness = -1;
  const defaults = Coastline.getDefaultSettings();

  features.forEach((feature, i) => {
    const outline = outlines[i];
    if (outline.length < 3) return;
    const settings = Coastline.shoreSettings(feature);
    const seed = Coastline.featureSeed(feature.i, settings);
    const shape = Coastline.getFeatureShape(feature, outline);
    const rough = shape.origIndices.map((start, j) => {
      // the roughness the edge was subdivided with: at its midpoint. Fractalization off: every edge stays a calm arc
      const a = shape.points[start];
      const b = shape.points[shape.origIndices[(j + 1) % shape.origIndices.length]];
      if (onBorder(a) && onBorder(b)) return null;
      if (!settings.enabled) return false;
      return Coastline.roughnessAt(seed, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, settings) >= settings.smoothThreshold;
    });
    parts.push({ shape, rough, lake: feature.type === "lake" });
    points += shape.points.length;
    vertices += outline.length;

    const count = Math.max(2, Math.round((PROFILE_SAMPLES * perimeters[i]) / total));
    const own = resample(outline, count).filter(point => !onBorder(point)); // the border is never a coast
    const roughness = Coastline.sampleRoughness(seed, own, settings);
    Coastline.sampleRoughness(Coastline.featureSeed(feature.i, defaults), own, defaults).forEach((value, j) => {
      if (value <= focusRoughness) return;
      focusRoughness = value;
      focus = samples.length + j;
    });
    samples.push(...own);
    profile.push(...roughness);
    if (settings.enabled) roughSamples += roughness.filter(value => value >= settings.smoothThreshold).length;
  });

  return { parts, samples, profile: Float32Array.from(profile), focus, roughSamples, points, vertices };
}

const perimeter = (polygon: Point[]) =>
  polygon.reduce((sum, [x, y], i) => {
    const [nx, ny] = polygon[(i + 1) % polygon.length];
    return sum + Math.hypot(nx - x, ny - y);
  }, 0);

/** `count` points evenly spaced along the closed polygon: a walk along the coast for the roughness graph */
function resample(polygon: Point[], count: number): Point[] {
  const n = polygon.length;
  const lengths = polygon.map(([x, y], i) => Math.hypot(polygon[(i + 1) % n][0] - x, polygon[(i + 1) % n][1] - y));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  if (!total) return [];

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
  drawShapePreview(ensureEl<HTMLCanvasElement>("coastShapePreview"), subject);
  drawRoughnessGraph(ensureEl<HTMLCanvasElement>("coastRoughnessGraph"), subject);

  const share = Math.round((100 * subject.roughSamples) / (subject.profile.length || 1));
  const complexity = subject.points / (subject.vertices || 1);
  ensureEl("coastPreviewStats").textContent =
    `${subject.points} points · ${complexity === 1 ? "default" : `${complexity.toFixed(1)}x`} complexity · ${share}% rough`;
}

/** Crisp on any screen: the buffer follows the css size and the pixel ratio, drawing is in css pixels */
function prepareCanvas(canvas: HTMLCanvasElement): {
  ctx: CanvasRenderingContext2D;
  W: number;
  H: number;
  dpr: number;
} {
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = `${ensureEl("coastSliders").clientWidth}px`; // the dialog shrinks to fit, so a percent width resolves against nothing
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, W, H, dpr };
}

/** by outline vertices, not fractalized points: the zoom is a property of the feature, the settings do not shift it */
function magnification(vertices: number) {
  if (vertices < 20) return 0;
  if (vertices < 40) return 2;
  if (vertices < 200) return 4;
  if (vertices < 300) return 6;
  if (vertices < 450) return 8;
  if (vertices < 650) return 10;
  if (vertices < 2000) return 12;
  if (vertices < 4000) return 14;
  return 20;
}

const ROUGH_COLOR = "#c85520";
const CALM_COLOR = "#18a888";
const GREY_COLOR = "#888888";

function drawShapePreview(
  canvas: HTMLCanvasElement,
  { parts, samples, focus: focusIndex, vertices }: PreviewSubject
): void {
  const { ctx, W, H, dpr } = prepareCanvas(canvas);
  if (!W || !H || !parts.length) return;
  let [minX, maxX, minY, maxY] = [Infinity, -Infinity, Infinity, -Infinity]; // a loop: spreading 100K+ points overflows the call stack
  for (const { shape } of parts) {
    for (const [x, y] of shape.points) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  const extent = Math.max(maxX - minX, maxY - minY) || 1;
  const PAD = 10;
  const scale = Math.min((W - 2 * PAD) / (maxX - minX || 1), (H - 2 * PAD) / (maxY - minY || 1));
  const center: Point = [(minX + maxX) / 2, (minY + maxY) / 2];
  const lakeAlone = parts.length === 1 && parts[0].lake; // a lake on its own sits in land

  const paths = parts.map(({ shape }) => new Path2D(`${Coastline.buildPath(shape)}Z`)); // map units: every view is a transform
  const indices = parts.map((_, i) => i);
  const islands = indices.filter(i => !parts[i].lake);
  const lakes = indices.filter(i => parts[i].lake);

  /** paint the coasts with `zoom` css px per map unit, map point `at` placed at canvas point `to` */
  const paint = (zoom: number, at: Point, to: Point, fringe: number): void => {
    ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, dpr * (to[0] - at[0] * zoom), dpr * (to[1] - at[1] * zoom));
    const px = 1 / zoom; // one css pixel in map units

    const water = ctx.createRadialGradient(at[0], at[1], 0, at[0], at[1], extent);
    water.addColorStop(0, "#cce5f5");
    water.addColorStop(1, "#6aa4cb");
    const land = ctx.createRadialGradient(center[0], center[1], 0, center[0], center[1], extent * 0.7);
    land.addColorStop(0, "#d8c87a");
    land.addColorStop(0.5, "#9cbc60");
    land.addColorStop(1, "#5c8e40");

    // the fringe is drawn under the fill that follows it, so it shows on the far side of the coast only
    const fringes = (indices: number[]) => {
      ctx.lineWidth = fringe * 2 * px; // half of it is under the fill
      ctx.lineCap = "round";
      ctx.lineJoin = "round"; // a jagged stretch turns sharply: a miter would spike out of the coast
      ctx.globalAlpha = 0.85;
      for (const i of indices) {
        const { shape, rough } = parts[i];
        const N = shape.points.length;
        shape.origIndices.forEach((start, j) => {
          if (rough[j] === null) return;
          const end = shape.origIndices[(j + 1) % shape.origIndices.length];
          ctx.strokeStyle = rough[j] ? ROUGH_COLOR : CALM_COLOR;
          ctx.beginPath();
          for (let k = start; k !== end; k = (k + 1) % N) {
            const [x, y] = shape.points[k];
            k === start ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          }
          ctx.lineTo(...shape.points[end]);
          ctx.stroke();
        });
      }
      ctx.globalAlpha = 1;
    };
    const fill = (indices: number[], style: CanvasGradient) => {
      ctx.fillStyle = style;
      for (const i of indices) ctx.fill(paths[i]);
    };

    ctx.fillStyle = lakeAlone ? land : water;
    ctx.fillRect(at[0] - extent * 4, at[1] - extent * 4, extent * 8, extent * 8);
    fringes(islands);
    fill(islands, land);
    fringes(lakes);
    fill(lakes, water);

    ctx.strokeStyle = "#5c4526";
    ctx.lineWidth = 1 * px;
    ctx.lineJoin = "round";
    for (const path of paths) ctx.stroke(path);
  };

  paint(scale, center, [W / 2, H / 2], 0.5);

  const MAGNIFICATION = magnification(vertices);
  if (MAGNIFICATION && samples.length) {
    const focus = samples[focusIndex];
    const R = Math.min(W, H) * 0.24;
    const zoom = scale * MAGNIFICATION;
    const half = R / zoom; // map units shown around the focus
    const insetCenter: Point = [W - R - 10, H - R - 10];

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.save();
    ctx.beginPath();
    ctx.arc(insetCenter[0], insetCenter[1], R, 0, Math.PI * 2);
    ctx.clip();
    paint(zoom, focus, insetCenter, 0.5);
    ctx.restore();

    // where the magnifier looks, and the magnifier itself
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(
      W / 2 + (focus[0] - center[0]) * scale,
      H / 2 + (focus[1] - center[1]) * scale,
      Math.max(half * scale, 4),
      0,
      Math.PI * 2
    );
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(insetCenter[0], insetCenter[1], R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "bold 9px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`×${MAGNIFICATION}`, insetCenter[0], insetCenter[1] + R - 5);
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const { enabled } = selectedFeature?.coastline || Coastline.settings;
  if (!enabled) drawOffBadge(ctx, W);
}

function drawRoughnessGraph(canvas: HTMLCanvasElement, { profile, focus, vertices }: PreviewSubject): void {
  const { ctx, W, H } = prepareCanvas(canvas);
  if (!W || !H || !profile.length) return;
  const { enabled, smoothThreshold } = selectedFeature?.coastline || Coastline.settings;

  const thresh = Math.min(Math.max(smoothThreshold, 0), 1);
  const threshY = H * (1 - thresh);
  const n = profile.length;
  const xs = Array.from({ length: n + 1 }, (_, i) => (i / n) * W);
  const ys = Array.from({ length: n + 1 }, (_, i) => H * (1 - profile[i % n]));

  const curve = () => {
    ctx.beginPath();
    ctx.moveTo(xs[0], ys[0]);
    for (let i = 1; i < xs.length; i++) ctx.lineTo(xs[i], ys[i]);
  };

  // the curve, filled and stroked, clipped to the band of each zone
  const band = (top: number, bottom: number, color: string, fill: string): void => {
    if (bottom <= top) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, top, W, bottom - top);
    ctx.clip();
    curve();
    ctx.lineTo(xs[n], H);
    ctx.lineTo(xs[0], H);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    curve();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  };
  band(0, threshY, ROUGH_COLOR, "rgba(210,90,30,0.2)");
  band(threshY, H, CALM_COLOR, "rgba(30,165,135,0.2)");

  ctx.save();
  ctx.setLineDash([4, 3]);
  ctx.strokeStyle = "rgba(30,140,100,0.75)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, threshY);
  ctx.lineTo(W, threshY);
  ctx.stroke();
  ctx.restore();

  // where the magnifier above looks
  if (magnification(vertices)) {
    const x = ((focus + 0.5) / n) * W;
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }

  ctx.font = "bold 8px sans-serif";
  ctx.fillStyle = GREY_COLOR;
  if (threshY > 12) ctx.fillText("ROUGH", 4, 10);
  if (H - threshY > 10) ctx.fillText("CALM", 4, H - 3);

  if (!enabled) drawOffBadge(ctx, W);
}

/** fractalization off: the previews still show the map, marked as such */
function drawOffBadge(ctx: CanvasRenderingContext2D, W: number): void {
  ctx.font = "bold 9px sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(W - 30, 4, 26, 13);
  ctx.fillStyle = "#fff";
  ctx.fillText("OFF", W - 8, 6);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
}

export const CoastlineEditor = { open };
