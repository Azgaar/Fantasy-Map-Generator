// Building blocks shared by every editor dialog
import type { WorkspaceDialogPlacement } from "@/components/ui/dialog-position";
import { findEl } from "@/utils";

export type DialogParams = {
  height?: number | string;
  maxHeight?: number | string;
  placement?: WorkspaceDialogPlacement;
  position?: { my: string; at: string; of: string; collision: string };
  resizable?: boolean;
  title?: string;
  width?: number | string;
};

interface ManagedDialog {
  close: () => void;
  requestClose?: () => void;
  stable: boolean;
  update?: (params: DialogParams) => void;
}

const managedDialogs = new Map<string, ManagedDialog>();

export function registerManagedDialog(
  id: string,
  close: () => void,
  stable = false,
  update?: (params: DialogParams) => void,
  requestClose?: () => void
): () => void {
  const dialog = { close, requestClose, stable, update };
  managedDialogs.set(id, dialog);
  return () => {
    if (managedDialogs.get(id) === dialog) managedDialogs.delete(id);
  };
}

function isExcepted(id: string, dialog: ManagedDialog, except: string): boolean {
  return except
    .split(",")
    .map(selector => selector.trim())
    .some(selector => selector === `#${id}` || (selector === ".stable" && dialog.stable));
}

/** Close all open dialogs except the stated one */
export function closeDialogs(except = "#except"): void {
  for (const [id, dialog] of [...managedDialogs]) {
    if (!isExcepted(id, dialog, except)) (dialog.requestClose ?? dialog.close)();
  }
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

  void import("@/components/ui/message-dialog").then(({ showMessageDialog }) => {
    showMessageDialog({
      actions: [
        { label: cancel, onClick: onCancel },
        { intent: "danger", label: confirm, onClick: onConfirm }
      ],
      id: "confirmationDialog",
      messageHtml: message,
      title
    });
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

export const updateDialog = (id: string, params: DialogParams) => {
  const managedDialog = managedDialogs.get(id);
  managedDialog?.update?.(params);
};

// Close a managed dialog, or remove an unmanaged dialog element
export const destroyDialog = (id: string): void => {
  const managedDialog = managedDialogs.get(id);
  if (managedDialog) {
    managedDialog.close();
    return;
  }

  const el = findEl(id);
  el?.remove();
};

window.closeDialogs = closeDialogs;
window.confirmationDialog = confirmationDialog;
