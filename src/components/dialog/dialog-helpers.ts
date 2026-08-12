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

// TODO: editors should register a refresh callback when they open,
// so it can call them without needing to know their button IDs
const REFRESHABLE_EDITORS = [
  "culturesEditorRefresh",
  "biomesEditorRefresh",
  "diplomacyEditorRefresh",
  "provincesEditorRefresh",
  "religionsEditorRefresh",
  "statesEditorRefresh",
  "zonesEditorRefresh",
  "goodsEditorRefresh",
  "marketsOverviewRefresh",
  "marketOverviewRefresh",
  "marketDealsRefresh",
  "burgsOverviewRefresh",
  "routesOverviewRefresh",
  "riversOverviewRefresh",
  "militaryOverviewRefresh",
  "regimentsOverviewRefresh",
  "markersOverviewRefresh"
];

/** Refresh every editor that is currently open */
export function refreshEditors(): void {
  for (const buttonId of REFRESHABLE_EDITORS) findEl(buttonId)?.click();
}

type DialogParams = {
  title?: string;
  resizable?: boolean;
  width?: string;
  position?: { my: string; at: string; of: string; collision: string };
};

export const updateDialog = (id: string, params: DialogParams) => {
  const el = findEl(id);
  if (!el) return;
  if (el.classList.contains("ui-dialog-content")) window.$(el).dialog(params);
};

// Remove an element, destroying its jQuery UI dialog widget first
export const destroyDialog = (id: string): void => {
  const el = findEl(id);
  if (!el) return;
  if (el.classList.contains("ui-dialog-content")) window.$(el).dialog("destroy");
  el.remove();
};

window.closeDialogs = closeDialogs;
window.confirmationDialog = confirmationDialog;
