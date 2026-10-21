/**
 * panels/dialog.ts — Total War's modals, in FMG's own dialog widget.
 *
 * Decisions, confirmations and reports go through the same jQuery UI dialog FMG
 * uses for its editors (MOD-PLAN A.6), so they inherit FMG's styling, z-order and
 * Escape handling instead of arriving as a second modal system. That also means
 * no new CSS and nothing for FMG to know about.
 *
 * Phase A has no decisions to raise yet — the engine that produces them is Phase
 * B — but it does have confirmations, and this is what they use.
 */
import { fmg, twWarn } from "../fmg";

interface TwDialogOptions {
  title: string;
  /** body markup; callers escape their own text */
  html: string;
  /** label → action. Closing happens after the action returns. */
  buttons: Record<string, () => void>;
  width?: number;
}

/** Open a modal in FMG's dialog widget. @returns false when FMG's jQuery is absent. */
export function openDialog(options: TwDialogOptions): boolean {
  const dialog = fmg()?.$;
  if (!dialog) {
    twWarn("jQuery UI unavailable — cannot open dialog");
    return false;
  }
  const buttons: Record<string, () => void> = {};
  for (const [label, action] of Object.entries(options.buttons)) {
    buttons[label] = function (this: unknown) {
      try {
        action();
      } catch (error) {
        twWarn(`dialog action '${label}' failed`, error);
      }
      const jq = (globalThis as unknown as { $?: (sel: unknown) => { dialog(close: string): void } }).$;
      if (jq && this instanceof Element) jq(this).dialog("close");
    };
  }
  try {
    dialog(`<div id="tw-dialog" class="tw-dialog" style="padding:4px 2px">${options.html}</div>`).dialog({
      title: options.title,
      resizable: true,
      width: options.width ?? 460,
      buttons
    });
    const el = globalThis.document?.getElementById("tw-dialog");
    const uiDialog = el?.closest(".ui-dialog") as HTMLElement | null;
    if (uiDialog) {
      uiDialog.classList.add("tw-dialog");
      uiDialog.classList.add("tw-dialog-box");
      uiDialog.style.opacity = "1";
    }
    return true;
  } catch (error) {
    twWarn("failed to open dialog", error);
    return false;
  }
}
