// Test helpers driving real dialog windows in jsdom

/** The page skeleton dialogs mount in */
export const DIALOGS_MARKUP = `<div id="dialogs"></div>`;

/** The button labelled `label` in the newest open dialog window that has one, or in the one holding `dialogId` */
export function dialogButton(label: string, dialogId?: string): HTMLButtonElement {
  const windows = dialogId
    ? [document.getElementById(dialogId)?.closest(".dialog-window")]
    : Array.from(document.querySelectorAll(".dialog-window:not([hidden])")).reverse();
  const button = windows
    .flatMap(frame => Array.from(frame?.querySelectorAll<HTMLButtonElement>(".dialog-buttonset > button") ?? []))
    .find(candidate => candidate.textContent === label);
  if (!button) throw new Error(`No dialog button "${label}"`);
  return button;
}
