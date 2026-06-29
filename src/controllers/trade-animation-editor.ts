import { ensureEl } from "../utils";

const DEFAULTS = TradeAnimation.getDefaultOptions();
const INPUTS = [
  {
    type: "select",
    id: "tradeAnimDisplayType",
    label: "Trade type",
    tip: "Which trade types to display: local (burg-market), global (market-market), or both",
    key: "displayType",
    default: DEFAULTS.displayType,
    selectOptions: ["local", "global", "both"]
  },
  {
    type: "slider",
    id: "tradeAnimConcurrent",
    label: "Animations",
    tip: "Target number of trade animations visible at once. New ones spawn as old ones finish. Higher = more simultaneous animations, can cause lag on slower devices",
    min: 1,
    max: 500,
    step: 1,
    key: "concurrent",
    default: DEFAULTS.concurrent
  },
  {
    type: "slider",
    id: "tradeAnimDuration",
    label: "Travel duration",
    tip: "Milliseconds per map unit travelled. Lower = faster animations",
    min: 1,
    max: 1000,
    step: 1,
    key: "duration",
    default: DEFAULTS.duration
  },
  {
    type: "slider",
    id: "tradeAnimLandDurationModifier",
    label: "Land slowdown",
    tip: "Multiplier applied to travel duration on land segments. Higher = slower land animations",
    min: 0.1,
    max: 20,
    step: 0.1,
    key: "landDurationModifier",
    default: DEFAULTS.landDurationModifier
  },
  {
    type: "slider",
    id: "tradeAnimSegmentChangePause",
    label: "Segment pause",
    tip: "Pause between land and water legs of a trip, in milliseconds. Higher = longer pause",
    min: 0,
    max: 5000,
    step: 100,
    key: "segmentChangePause",
    default: DEFAULTS.segmentChangePause
  },
  {
    type: "slider",
    id: "tradeAnimMarkerSize",
    label: "Marker size",
    tip: "Marker icon size in map units. Wagons render at half this size. Higher = bigger icons",
    min: 1,
    max: 50,
    step: 0.5,
    key: "markerSize",
    default: DEFAULTS.markerSize
  }
];

function open(): void {
  if (customization) return;
  closeDialogs("#tradeAnimationEditor, .stable");
  document.body.insertAdjacentHTML("beforeend", buildDialogHTML());

  for (const def of INPUTS) {
    const key = def.key as keyof typeof options.trade.animation;
    const input = ensureEl<HTMLInputElement | HTMLSelectElement>(def.id);
    const resetBtn = ensureEl(`${def.id}Reset`);

    const current = options.trade.animation[key] ?? def.default;
    input.value = String(current);

    input.on("input", e => {
      // slider-input re-dispatches a bubbling event from its inner controls; ignore those duplicates
      if (e.target !== e.currentTarget) return;
      const value =
        def.type === "slider" ? (input as HTMLInputElement).valueAsNumber : (input as HTMLSelectElement).value;
      options.trade.animation = { ...options.trade.animation, [key]: value };
      localStorage.setItem("trade-animation", JSON.stringify(options.trade.animation));
      TradeAnimation.restart();
    });

    resetBtn.on("click", () => {
      options.trade.animation = { ...options.trade.animation, [key]: def.default };
      input.value = String(def.default);
      localStorage.setItem("trade-animation", JSON.stringify(options.trade.animation));
      TradeAnimation.restart();
    });
  }

  $("#tradeAnimationEditor").dialog({
    title: "Trade Animation Editor",
    resizable: false,
    position: { my: "right top", at: "right-10 top+10", of: "svg" },
    close: () => {
      $("#tradeAnimationEditor").dialog("destroy").remove();
    }
  });
}

function buildDialogHTML(): string {
  const rows = INPUTS.map(({ id, label, type, selectOptions, tip, min, max, step, key, default: def }) => {
    const current = options.trade.animation[key as keyof typeof options.trade.animation] ?? def;
    const input =
      type === "select" && selectOptions
        ? `<select id="${id}" style="width: 100%; font-size: smaller;">${selectOptions.map((opt: string) => `<option value="${opt}" ${opt === current ? "selected" : ""}>${opt}</option>`).join("")}</select>`
        : `<slider-input id="${id}" min="${min}" max="${max}" step="${step}" value="${current}"></slider-input>`;
    return /* html */ `
      <tr data-tip="${tip}">
        <td style="padding: 0">${label}</td>
        <td style="padding: 0">${input}</td>
        <td style="padding: 0">
          <button id="${id}Reset" data-tip="Reset to default"
            style="font-size:.85em; padding:1px 5px; margin-left: 0.3em">↺</button>
        </td>
      </tr>`;
  }).join("");

  return /* html */ `
    <div id="tradeAnimationEditor" class="dialog" style="display:none">
      <style>
        #tradeAnimationEditor slider-input { width: 100%; }
        #tradeAnimationEditor slider-input input[type=range] { flex: 1; min-width: 0; }
      </style>
      <table style="border-collapse: collapse;width:100%">
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

export const TradeAnimationEditor = { open };
