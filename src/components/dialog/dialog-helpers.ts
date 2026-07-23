// Building blocks shared by every editor dialog
import { ensureEl, findEl } from "@/utils";

/** Close all open dialogs except the stated one */
export function closeDialogs(except = "#except"): void {
  $(".dialog:visible")
    .not(except)
    .each(function (this: HTMLElement) {
      try {
        $(this).dialog("close");
      } catch {
        // uninitialized or mid-teardown dialog; skip it so the rest still close
      }
    });
}

interface ConfirmationOptions {
  title?: string;
  message?: string;
  cancel?: string;
  confirm?: string;
  onCancel?: () => void;
  onConfirm?: () => void;
}

/** Ask the user to confirm an action that cannot be reverted */
export function confirmationDialog(options: ConfirmationOptions): void {
  const {
    title = "Confirm action",
    message = "Are you sure you want to continue? <br>The action cannot be reverted",
    cancel = "Cancel",
    confirm = "Continue",
    onCancel,
    onConfirm
  } = options;

  ensureEl("alertMessage").innerHTML = message;

  $("#alert").dialog({
    resizable: false,
    title,
    buttons: {
      [confirm]: function (this: HTMLElement) {
        onConfirm?.();
        $(this).dialog("close");
      },
      [cancel]: function (this: HTMLElement) {
        onCancel?.();
        $(this).dialog("close");
      }
    }
  });
}

// TODO: inverted dependency — this knows every refreshable editor by its button id. Once editors
// can register a refresh callback when they open, this list goes away and the loop walks the
// registrations instead
const REFRESHABLE_EDITORS = [
  "culturesEditorRefresh",
  "biomesEditorRefresh",
  "diplomacyEditorRefresh",
  "provincesEditorRefresh",
  "religionsEditorRefresh",
  "statesEditorRefresh",
  "zonesEditorRefresh",
  "goodsEditorRefresh",
  "marketsOverviewRefresh"
];

/** Refresh every editor that is currently open */
export function refreshAllEditors(): void {
  for (const buttonId of REFRESHABLE_EDITORS) findEl(buttonId)?.click();
}

window.refreshAllEditors = refreshAllEditors;
window.closeDialogs = closeDialogs;
window.confirmationDialog = confirmationDialog;
