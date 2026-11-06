import { DEFAULT_TRADE_ANIMATION } from "@/data/trade-animation-options";
import { Options } from "@/model/options/options-model";
import { Layers } from "@/renderers/layers";
import { Dialog } from "@/ui/dialog/dialog";
import { bindEconomyWiki, economyWikiButton } from "@/ui/economy-view";
import { t } from "@/utils/i18n";
import { ensureEl } from "@/utils/node-utils";

const DEFAULTS = DEFAULT_TRADE_ANIMATION;
const INPUTS = [
  {
    id: "tradeAnimConcurrent",
    label: t("Animations"),
    tip: t(
      "Target number of trade animations visible at once. New ones spawn as old ones finish. Higher = more simultaneous animations, can cause lag on slower devices"
    ),
    min: 1,
    max: 500,
    step: 1,
    key: "concurrent",
    default: DEFAULTS.concurrent
  },
  {
    id: "tradeAnimDuration",
    label: t("Travel duration"),
    tip: t("Milliseconds per map unit travelled. Lower = faster animations"),
    min: 1,
    max: 1000,
    step: 1,
    key: "duration",
    default: DEFAULTS.duration
  },
  {
    id: "tradeAnimLandDurationModifier",
    label: t("Land slowdown"),
    tip: t("Multiplier applied to travel duration on land segments. Higher = slower land animations"),
    min: 0.1,
    max: 20,
    step: 0.1,
    key: "landDurationModifier",
    default: DEFAULTS.landDurationModifier
  },
  {
    id: "tradeAnimSegmentChangePause",
    label: t("Segment pause"),
    tip: t("Pause between land and water legs of a trip, in milliseconds. Higher = longer pause"),
    min: 0,
    max: 5000,
    step: 100,
    key: "segmentChangePause",
    default: DEFAULTS.segmentChangePause
  },
  {
    id: "tradeAnimMarkerSize",
    label: t("Marker size"),
    tip: t("Marker icon size in map units. Wagons render at half this size. Higher = bigger icons"),
    min: 1,
    max: 50,
    step: 0.5,
    key: "markerSize",
    default: DEFAULTS.markerSize
  }
];

function open(): void {
  if (options.app.mode) return;
  Dialog.closeAll("#tradeAnimationEditor, .stable");
  renderDialog();

  Dialog.open("tradeAnimationEditor", {
    title: t("Trade Animation Editor"),
    position: { my: "right top", at: "right-10 top+10", of: "svg" },
    footer: economyWikiButton("tradeAnimationWiki")
  });
  bindEconomyWiki("tradeAnimationWiki");
}

function renderDialog(): void {
  Dialog.destroy("tradeAnimationEditor");
  document.body.insertAdjacentHTML("beforeend", buildDialogHTML());

  for (const def of INPUTS) {
    const key = def.key as keyof typeof options.app.trade.animation;
    const input = ensureEl<HTMLInputElement>(def.id);
    const resetBtn = ensureEl(`${def.id}Reset`);

    const current = options.app.trade.animation[key] ?? def.default;
    input.value = String(current);

    input.addEventListener("input", e => {
      // slider-input re-dispatches a bubbling event from its inner controls; ignore those duplicates
      if (e.target !== e.currentTarget) return;
      Options.set(o => (o.app.trade.animation = { ...o.app.trade.animation, [key]: input.valueAsNumber }));
      Layers.draw("trade");
    });

    resetBtn.addEventListener("click", () => {
      Options.set(o => (o.app.trade.animation = { ...o.app.trade.animation, [key]: def.default }));
      input.value = String(def.default);
      Layers.draw("trade");
    });
  }
}

function buildDialogHTML(): string {
  const rows = INPUTS.map(({ id, label, tip, min, max, step, key, default: def }) => {
    const current = options.app.trade.animation[key as keyof typeof options.app.trade.animation] ?? def;
    return /* html */ `
      <tr data-tip="${tip}">
        <td style="padding: 0">${label}</td>
        <td style="padding: 0"><slider-input id="${id}" min="${min}" max="${max}" step="${step}" value="${current}"></slider-input></td>
        <td style="padding: 0">
          <button id="${id}Reset" data-tip="${t("Reset to default")}"
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
