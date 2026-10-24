import { debounce } from "@/utils/common-utils";
import { isMobile } from "@/utils/environment";
import { sentences, t } from "@/utils/i18n";
import { findEl } from "@/utils/node-utils";
import { onNotice } from "@/utils/notices";

type TipType = "info" | "success" | "warn" | "error";

const TIP_BACKGROUND: Record<TipType, string> = {
  info: "linear-gradient(0.1turn, #ffffff00, #5e5c5c80, #ffffff00)",
  success: "linear-gradient(0.1turn, #ffffff00, #127912cc, #ffffff00)",
  warn: "linear-gradient(0.1turn, #ffffff00, #be5d08cc, #ffffff00)",
  error: "linear-gradient(0.1turn, #ffffff00, #e11d1dcc, #ffffff00)"
};

const getTooltip = () => findEl("tooltip"); // absent before the shell renders and in unit tests

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
  if (!tooltip) return;
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

let pendingLoads = 0;

/** The registries' feedback while a lazy module downloads */
export const loadingTip = {
  start(): void {
    pendingLoads++;
    tip(`${t("Loading")}…`, false, "info");
  },
  end(): void {
    if (--pendingLoads > 0) return;
    pendingLoads = 0;
    showMainTip(); // back to whatever is pinned, e.g. an edit mode's hint
  }
};

/** Pin a message over the main tip; the returned function puts the covered one back, unless another was pinned
 * since. A timed tip is not brought back: its time ran while covered */
export function overlayMainTip(message: string, type: TipType = "info"): () => void {
  const tooltip = getTooltip();
  if (!tooltip) return () => {};
  const covered = autoClearTimeout ? { main: "", color: "" } : { ...tooltip.dataset };
  tip(message, true, type);
  return () => {
    if (tooltip.dataset.main !== message) return;
    tooltip.dataset.main = covered.main || "";
    tooltip.dataset.color = covered.color || "";
    showMainTip();
  };
}

export function showMainTip(): void {
  const tooltip = getTooltip();
  if (!tooltip) return;
  tooltip.style.background = tooltip.dataset.color || "";
  tooltip.innerHTML = tooltip.dataset.main || "";
}

export function clearMainTip(): void {
  if (autoClearTimeout) {
    clearTimeout(autoClearTimeout);
    autoClearTimeout = undefined;
  }
  const tooltip = getTooltip();
  if (!tooltip) return;
  tooltip.dataset.color = "";
  tooltip.dataset.main = "";
  tooltip.innerHTML = "";
}

/** Show the data-tip of the hovered element, appending its shortcut on desktop */
export function showDataTip(event: Event): void {
  const target = event.target as HTMLElement | null;
  if (!target) return;
  if (target.dataset?.lockTip !== undefined) {
    showLockTip(target);
    return;
  }

  const parent = target.parentNode as HTMLElement | null;
  let dataTip = target.dataset?.tip || parent?.dataset?.tip;
  if (!dataTip) return;

  const shortcut = target.dataset.shortcut;
  if (shortcut && !isMobile()) dataTip = sentences(dataTip, `${t("Shortcut")}: ${shortcut}`);

  const isRemove =
    target.dataset.col === "remove" ||
    parent?.dataset?.col === "remove" ||
    target.classList.contains("icon-trash-empty") ||
    target.classList.contains("fastDelete");
  const removeHint = t("Shift+Click to remove without confirmation");
  if (isRemove && !isMobile() && !dataTip.includes(removeHint)) dataTip = sentences(dataTip, removeHint);

  tip(dataTip);
}

function showLockTip(target: HTMLElement): void {
  const locked = target.classList.contains("icon-lock");
  tip(
    locked
      ? t("Locked. Click to unlock the element and allow it to be changed by regeneration tools")
      : t("Unlocked. Click to lock the element and prevent changes to it by regeneration tools")
  );
}

// non-svg containers holding elements with data-tip
const TIP_CONTAINERS = ["dialogs", "optionsContainer", "heightmapFinalize", "tourPromptButton"];

function initialize(): void {
  const onDataTipMove = debounce(showDataTip, 50);
  for (const id of TIP_CONTAINERS) findEl(id)?.addEventListener("mousemove", onDataTipMove);
}

initialize();

onNotice((message, type, time) => tip(message, false, type, time));
