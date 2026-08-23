import { debounce, ensureEl, findEl } from "@/utils";

const getTooltip = () => ensureEl("tooltip");

/**
 * Show a message in the hover-tooltip line
 * @param message - text to show, may contain html
 * @param main - pin the message so it is restored after transient tips
 */
export function tip(message: string, main = false): void {
  const tooltip = getTooltip();
  tooltip.innerHTML = message;

  if (main) tooltip.dataset.main = message;
}

export function showMainTip(): void {
  const tooltip = getTooltip();
  tooltip.innerHTML = tooltip.dataset.main || "";
}

export function clearMainTip(): void {
  const tooltip = getTooltip();
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
