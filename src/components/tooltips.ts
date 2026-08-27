import { debounce, ensureEl, findEl } from "@/utils";

type TipType = "info" | "success" | "warn" | "error";

const TIP_BACKGROUND: Record<TipType, string> = {
  info: "linear-gradient(0.1turn, #ffffff00, #5e5c5c80, #ffffff00)",
  success: "linear-gradient(0.1turn, #ffffff00, #127912cc, #ffffff00)",
  warn: "linear-gradient(0.1turn, #ffffff00, #be5d08cc, #ffffff00)",
  error: "linear-gradient(0.1turn, #ffffff00, #e11d1dcc, #ffffff00)"
};

const getTooltip = () => ensureEl("tooltip");

let autoClearTimeout: number | undefined;

/**
 * Show a message in the tooltip line
 * @param message - text to show, may contain html
 * @param main - pin the message so it is restored after transient tips
 * @param type - defines the tooltip background color
 * @param time - if set, clear the main tip after that many ms
 */
export function tip(message: string, main = false, type: TipType = "info", time = 0): void {
  const tooltip = getTooltip();
  tooltip.innerHTML = message;
  tooltip.style.background = TIP_BACKGROUND[type];

  if (main) {
    tooltip.dataset.main = message;
    tooltip.dataset.color = tooltip.style.background;
  }

  // Only a pinned or timed tip supersedes a pending auto-clear. Transient hover tips
  // must leave it alone, or moving the mouse would keep a timed message alive forever.
  if (main || time) {
    if (autoClearTimeout) clearTimeout(autoClearTimeout);
    autoClearTimeout = time ? window.setTimeout(clearMainTip, time) : undefined;
  }
}

export function showMainTip(): void {
  const tooltip = getTooltip();
  tooltip.style.background = tooltip.dataset.color || "";
  tooltip.innerHTML = tooltip.dataset.main || "";
}

export function clearMainTip(): void {
  if (autoClearTimeout) {
    clearTimeout(autoClearTimeout);
    autoClearTimeout = undefined;
  }
  const tooltip = getTooltip();
  tooltip.dataset.color = "";
  tooltip.dataset.main = "";
  tooltip.innerHTML = "";
}

/** Show the data-tip of the hovered element, appending its shortcut on desktop */
export function showDataTip(event: Event): void {
  const target = event.target as HTMLElement | null;
  if (!target) return;

  const parent = target.parentNode as HTMLElement | null;
  let dataTip = target.dataset?.tip || parent?.dataset?.tip;
  if (!dataTip) return;

  const shortcut = target.dataset.shortcut;
  if (shortcut && !MOBILE) dataTip += `. Shortcut: ${shortcut}`;

  tip(dataTip);
}

export function showElementLockTip(event: Event): void {
  const locked = (event.target as HTMLElement | null)?.classList?.contains("icon-lock");
  tip(
    locked
      ? "Locked. Click to unlock the element and allow it to be changed by regeneration tools"
      : "Unlocked. Click to lock the element and prevent changes to it by regeneration tools"
  );
}

// non-svg containers holding elements with data-tip
const TIP_CONTAINERS = ["dialogs", "optionsContainer", "exitCustomization", "tourPromptButton"];

function initialize(): void {
  const onDataTipMove = debounce(showDataTip, 50);
  for (const id of TIP_CONTAINERS) findEl(id)?.addEventListener("mousemove", onDataTipMove);
}

initialize();

export const Tooltips = { tip, showMainTip, clearMainTip, showDataTip, showElementLockTip };

window.tip = tip;
window.clearMainTip = clearMainTip;
window.showDataTip = showDataTip;
window.showElementLockTip = showElementLockTip;
