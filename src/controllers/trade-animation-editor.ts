import { ensureEl } from "../utils";

const DEFAULTS = TradeAnimation.getDefaultOptions();

const TOGGLES = [
  {
    id: "tradeAnimShowLocal",
    label: "Local trades",
    tip: "Show animations for local trades (between a burg and its market).",
    key: "showLocal",
    default: DEFAULTS.showLocal as boolean
  },
  {
    id: "tradeAnimShowGlobal",
    label: "Global trades",
    tip: "Show animations for global trades (between two markets).",
    key: "showGlobal",
    default: DEFAULTS.showGlobal as boolean
  }
];

const SLIDERS = [
  {
    id: "tradeAnimMaxSpawn",
    label: "Max per tick",
    tip: "Max number of simultaneous trade animations spawned per tick. Higher = more crowded map.",
    min: 1,
    max: 50,
    step: 1,
    key: "maxSpawn",
    default: DEFAULTS.maxSpawn,
    restart: true
  },
  {
    id: "tradeAnimInterval",
    label: "Spawn interval",
    tip: "Milliseconds between spawn ticks. Lower = more frequent spawns.",
    min: 100,
    max: 10000,
    step: 100,
    key: "interval",
    default: DEFAULTS.interval,
    restart: true
  },
  {
    id: "tradeAnimDuration",
    label: "Travel duration",
    tip: "Milliseconds per map unit travelled. Lower = faster animations.",
    min: 1,
    max: 1000,
    step: 1,
    key: "duration",
    default: DEFAULTS.duration
  },
  {
    id: "tradeAnimLandDurationModifier",
    label: "Land slowdown",
    tip: "Multiplier applied to travel duration on land segments. Land legs render at this factor of sea speed.",
    min: 1,
    max: 20,
    step: 0.5,
    key: "landDurationModifier",
    default: DEFAULTS.landDurationModifier
  },
  {
    id: "tradeAnimSegmentChangePause",
    label: "Segment pause",
    tip: "Pause between land and water legs of a trip, in milliseconds.",
    min: 0,
    max: 5000,
    step: 100,
    key: "segmentChangePause",
    default: DEFAULTS.segmentChangePause
  },
  {
    id: "tradeAnimFadeDuration",
    label: "Path fade",
    tip: "Fade-in / fade-out duration for the route trail, in milliseconds.",
    min: 0,
    max: 10000,
    step: 100,
    key: "fadeDuration",
    default: DEFAULTS.fadeDuration
  },
  {
    id: "tradeAnimMarkerSize",
    label: "Marker size",
    tip: "Marker icon size in map units. Wagons render at half this size.",
    min: 1,
    max: 50,
    step: 0.5,
    key: "markerSize",
    default: DEFAULTS.markerSize
  }
];

export function open(): void {
  closeDialogs("#tradeAnimationEditor, .stable");

  if (!document.getElementById("tradeAnimationEditor")) {
    document.body.insertAdjacentHTML("beforeend", buildDialogHTML());
  }

  for (const def of SLIDERS) {
    const slider = ensureEl<HTMLInputElement>(def.id);
    const output = ensureEl(`${def.id}Out`);
    const resetBtn = ensureEl(`${def.id}Reset`);

    const current = options.tradeAnimation[def.key] ?? def.default;
    slider.value = String(current);
    output.textContent = String(current);

    slider.on("input", () => {
      const value = slider.valueAsNumber;
      options.tradeAnimation[def.key] = value;
      output.textContent = String(value);
      if (def.restart && layerIsOn("toggleTrade")) TradeAnimation.restart();
    });

    resetBtn.on("click", () => {
      options.tradeAnimation[def.key] = def.default;
      slider.value = String(def.default);
      output.textContent = String(def.default);
      if (def.restart && layerIsOn("toggleTrade")) TradeAnimation.restart();
    });
  }

  for (const def of TOGGLES) {
    const checkbox = ensureEl<HTMLInputElement>(def.id);
    const stored = options.tradeAnimation[def.key];
    const current = typeof stored === "boolean" ? stored : def.default;
    checkbox.checked = current;
    options.tradeAnimation[def.key] = current;

    checkbox.on("change", () => {
      options.tradeAnimation[def.key] = checkbox.checked;
    });
  }

  $("#tradeAnimationEditor").dialog({
    title: "Trade Animation Editor",
    resizable: false,
    position: { my: "right top", at: "right-10 top+10", of: "svg" }
  });
}

function buildDialogHTML(): string {
  const rows = SLIDERS.map(({ id, label, tip, min, max, step, key, default: def }) => {
    const current = options.tradeAnimation[key] ?? def;
    return /* html */ `
      <tr data-tip="${tip}">
        <td style="padding:0">${label}</td>
        <td style="padding:0">
          <input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${current}" style="width: 100%; vertical-align:middle"/>
        </td>
        <td style="padding: 0; width:3em; text-align:right">
          <span id="${id}Out" style="font-family:monospace; font-size:.85em">${current}</span>
        </td>
        <td style="padding: 0">
          <button id="${id}Reset" data-tip="Reset to default"
            style="font-size:.85em; padding:1px 5px; margin-left: 0.3em">↺</button>
        </td>
      </tr>`;
  }).join("");

  const toggleRows = TOGGLES.map(({ id, label, tip, key, default: def }) => {
    const stored = options.tradeAnimation[key];
    const current = typeof stored === "boolean" ? stored : def;
    return /* html */ `
      <tr data-tip="${tip}">
        <td style="padding:0">${label}</td>
        <td colspan="3" style="padding:0">
          <input id="${id}" type="checkbox" ${current ? "checked" : ""} style="vertical-align:middle"/>
        </td>
      </tr>`;
  }).join("");

  return /* html */ `
    <div id="tradeAnimationEditor" style="display:none">
      <div style="color:#666; font-size:.85em; margin-bottom: 0.3em">
        Control trade deal animations. Open layer style editor for paths look settings.
      </div>
      <table style="border-collapse: collapse;width:100%">
        <tbody>${rows}${toggleRows}</tbody>
      </table>
    </div>`;
}

declare global {
  interface Window {
    TradeAnimationEditor: { open: () => void };
  }
}

window.TradeAnimationEditor = { open };
