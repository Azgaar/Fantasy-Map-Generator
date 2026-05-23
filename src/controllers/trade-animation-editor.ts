import { ensureEl } from "../utils";

interface SliderDef {
  id: string;
  label: string;
  tip: string;
  min: number;
  max: number;
  step: number;
  attr: string;
  default: number;
  restart?: boolean;
}

const SLIDERS: SliderDef[] = [
  {
    id: "tradeAnimInterval",
    label: "Spawn interval",
    tip: "Milliseconds between spawn ticks. Lower = more frequent waves of travellers (was MAX_INTERVAL).",
    min: 200,
    max: 10000,
    step: 100,
    attr: "data-interval",
    default: 3000,
    restart: true
  },
  {
    id: "tradeAnimMaxSpawn",
    label: "Max per tick",
    tip: "Upper bound on traders launched per tick. Each tick spawns 1..N of them (was MAX_SPAWN).",
    min: 1,
    max: 20,
    step: 1,
    attr: "data-max-spawn",
    default: 5
  },
  {
    id: "tradeAnimDuration",
    label: "Travel duration",
    tip: "Milliseconds per map unit travelled. Lower = faster traders.",
    min: 10,
    max: 500,
    step: 10,
    attr: "data-duration",
    default: 50
  },
  {
    id: "tradeAnimFadeDuration",
    label: "Path fade",
    tip: "Fade-in / fade-out duration for the route trail, in milliseconds.",
    min: 0,
    max: 10000,
    step: 100,
    attr: "data-fade-duration",
    default: 2000
  }
];

export function open(): void {
  if (!document.getElementById("tradeAnimationEditor")) {
    document.body.insertAdjacentHTML("beforeend", buildDialogHTML());
  }

  for (const def of SLIDERS) {
    const slider = ensureEl<HTMLInputElement>(def.id);
    const output = ensureEl(`${def.id}Out`);
    const resetBtn = ensureEl(`${def.id}Reset`);

    const current = Number(tradeAnimation.attr(def.attr)) || def.default;
    slider.value = String(current);
    output.textContent = String(current);

    slider.on("input", () => {
      const value = slider.valueAsNumber;
      tradeAnimation.attr(def.attr, value);
      output.textContent = String(value);
      if (def.restart && layerIsOn("toggleTrade")) TradeAnimation.restart();
    });

    resetBtn.on("click", () => {
      tradeAnimation.attr(def.attr, def.default);
      slider.value = String(def.default);
      output.textContent = String(def.default);
      if (def.restart && layerIsOn("toggleTrade")) TradeAnimation.restart();
    });
  }

  closeDialogs("#tradeAnimationEditor, .stable");

  $("#tradeAnimationEditor").dialog({
    title: "Trade Animation Editor",
    resizable: false,
    width: "auto",
    position: { my: "right top", at: "right-10 top+10", of: "svg" }
  });
}

function buildDialogHTML(): string {
  const rows = SLIDERS.map(({ id, label, tip, min, max, step, attr, default: def }) => {
    const current = Number(tradeAnimation.attr(attr)) || def;
    return /* html */ `
      <tr data-tip="${tip}">
        <td style="padding:2px 0;white-space:nowrap">${label}</td>
        <td style="padding:2px 4px">
          <input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${current}"
            style="width:200px;vertical-align:middle"/>
        </td>
        <td style="padding:2px 6px;min-width:3em;text-align:right">
          <span id="${id}Out" style="font-family:monospace;font-size:.85em">${current}</span>
        </td>
        <td style="padding:2px 0">
          <button id="${id}Reset" title="Reset to default"
            style="font-size:.75em;padding:1px 5px;cursor:pointer">↺</button>
        </td>
      </tr>`;
  }).join("");

  return /* html */ `
    <div id="tradeAnimationEditor" style="display:none">
      <div style="color:#666;font-size:.85em;margin-bottom:6px">
        Controls how trade deal animations are spawned and rendered. Open layer style editor for visual look (color, opacity, dasharray).
      </div>
      <table style="border-collapse:collapse;width:100%">
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

declare global {
  interface Window {
    TradeAnimationEditor: { open: () => void };
  }
}

window.TradeAnimationEditor = { open };
