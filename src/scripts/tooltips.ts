import {MOBILE} from "../config/constants";
import {byId} from "../utils/shorthands";

const $tooltip = byId("tooltip")!;

const tipBackgroundMap = {
  info: "linear-gradient(0.1turn, #ffffff00, #5e5c5c80, #ffffff00)",
  success: "linear-gradient(0.1turn, #ffffff00, #127912cc, #ffffff00)",
  warn: "linear-gradient(0.1turn, #ffffff00, #be5d08cc, #ffffff00)",
  error: "linear-gradient(0.1turn, #ffffff00, #e11d1dcc, #ffffff00)"
} as const;
type TTooltipType = keyof typeof tipBackgroundMap;

export function tip(text: string, main = false, type: TTooltipType = "info", time = 0) {
  $tooltip.textContent = text;
  $tooltip.style.background = tipBackgroundMap[type];

  if (main) {
    $tooltip.dataset.main = text;
    $tooltip.dataset.color = $tooltip.style.background;
  }
  if (time) setTimeout(clearMainTip, time);
}

export function clearMainTip() {
  $tooltip.dataset.color = "";
  $tooltip.dataset.main = "";
  $tooltip.textContent = "";
}

export function showMainTip() {
  $tooltip.style.background = $tooltip.dataset.color || "";
  $tooltip.textContent = $tooltip.dataset.main || "";
}

function showDataTip(event: Event) {
  if (!event.target) return;

  const target = event.target as HTMLElement;
  const {parentNode, dataset} = target;

  const targetTip = dataset.tip;
  const parentTip = (parentNode as HTMLElement)?.dataset.tip;

  let tooltip = targetTip || parentTip;
  if (!tooltip) return;

  if (dataset.shortcut && !MOBILE) tooltip += `. Shortcut: ${dataset.shortcut}`;
  tip(tooltip);
}

// show tip on mousemove for all non-svg elemets with data-tip
export function addTooptipListers() {
  byId("dialogs")?.on("mousemove", showDataTip);
  byId("optionsContainer")?.on("mousemove", showDataTip);
  byId("exitCustomization")?.on("mousemove", showDataTip);
}
