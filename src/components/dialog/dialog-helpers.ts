// Building blocks shared by every editor dialog

import { dialogState } from "@/components/dialog/state";
import { ensureEl, findEl, minmax } from "@/utils";
import { t } from "@/utils/i18n";

/** The note button every entity dialog puts in its toolbar, with its translated tooltip */
export function noteButton(id: string, tip: string): string {
  return `<button id="${id}" data-tip="${tip}" class="icon-book"></button>`;
}

/** The same button as a table row action, in the `note` column every editor table gives it */
export function noteIcon(tip: string): string {
  return `<span data-col="note" data-tip="${tip}" class="icon-book pointer"></span>`;
}

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
    title = t("Confirm action"),
    message = `${t("Are you sure you want to continue?")}<br>${t("This action cannot be reverted")}`,
    cancel = t("Cancel"),
    confirm = t("Continue"),
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

interface AlertOptions {
  title?: string;
  message: string;
  width?: string;
}

/** Tell the user something they only need to acknowledge */
export function alertDialog({ title = t("Warning"), message, width = "26em" }: AlertOptions): void {
  ensureEl("alertMessage").innerHTML = message;

  $("#alert").dialog({
    resizable: false,
    title,
    width,
    // the #alert dialog is shared with raw .dialog() callers: reset what they may have set
    height: "auto",
    modal: false,
    close: () => {},
    position: { my: "center", at: "center", of: "svg" },
    buttons: {
      [t("OK")]: function (this: HTMLElement) {
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
  "diplomacyOverviewRefresh",
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
  "featuresOverviewRefresh",
  "militaryOverviewRefresh",
  "regimentsOverviewRefresh",
  "markersOverviewRefresh",
  "journeysOverviewRefresh"
];

/** Refresh every editor that is currently open */
export function refreshEditors(): void {
  for (const buttonId of REFRESHABLE_EDITORS) findEl(buttonId)?.click();
}

type DialogPosition = { top: number; left: number };

// #alert is a single shared dialog reused for unrelated messages, each setting its own position; excluded here
const POSITION_EXCLUDED_IDS = new Set(["alert"]);

// Pin a dialog to where the user last dragged it, overriding whatever hard-coded position was just applied
function applySavedPosition(el: HTMLElement): void {
  if (POSITION_EXCLUDED_IDS.has(el.id)) return;
  const position = dialogState.get<DialogPosition | null>(el.id, "position", () => null);
  if (!position) return;

  const widget = $(el).dialog("widget");
  widget.css(clampPosition(position, widget[0] as HTMLElement));
}

/** A position saved on a wider screen would put the dialog out of reach, so keep it on screen */
function clampPosition({ top, left }: DialogPosition, widget: HTMLElement | undefined): DialogPosition {
  const maxLeft = Math.max(window.innerWidth - (widget?.offsetWidth || 0), 0);
  const maxTop = Math.max(window.innerHeight - (widget?.offsetHeight || 0), 0);
  return { left: minmax(left, 0, maxLeft), top: minmax(top, 0, maxTop) };
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
  if (!el.classList.contains("ui-dialog-content")) return;
  window.$(el).dialog(params);
  if (params.position) applySavedPosition(el);
};

// Remove an element, destroying its jQuery UI dialog widget first
export const destroyDialog = (id: string): void => {
  const el = findEl(id);
  if (!el) return;
  if (el.classList.contains("ui-dialog-content")) window.$(el).dialog("destroy");
  el.remove();
  dialogState.forget(id);
};

// A titlebar button next to minimize and close that forgets the remembered layout of this dialog; shown only while there is one
function addResetButton(el: HTMLElement): void {
  const titlebar = $(el).dialog("widget")[0]?.querySelector(".ui-dialog-titlebar");
  if (!titlebar || titlebar.querySelector(".ui-dialog-titlebar-reset")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "ui-dialog-titlebar-reset icon-ccw";
  button.dataset.tip = t("Reset the dialog: restore its default position, columns and sorting");
  button.setAttribute("aria-label", t("Reset the dialog"));
  button.addEventListener("click", () => dialogState.reset(el.id));
  titlebar.insertBefore(button, titlebar.querySelector(".ui-dialog-titlebar-collapse"));

  const updateVisibility = () => {
    button.hidden = !dialogState.hasLayout(el.id);
  };
  updateVisibility();
  dialogState.onChange(el.id, updateVisibility);

  // re-setting the option makes jQuery UI re-run its positioning with the dialog's own defaults
  dialogState.onReset(el.id, "position", () => {
    $(el).dialog("option", "position", $(el).dialog("option", "position"));
  });
}

// jQuery UI writes its titlebar buttons in English
function translateTitlebar(event: { target: EventTarget | null }): void {
  const titlebar = (event.target as HTMLElement).parentElement?.querySelector(".ui-dialog-titlebar");
  titlebar?.querySelector(".ui-dialog-titlebar-collapse")?.setAttribute("data-tip", t("Minimize / maximize"));
  const close = titlebar?.querySelector(".ui-dialog-titlebar-close");
  close?.setAttribute("data-tip", t("Close"));
  close?.setAttribute("title", t("Close"));
}

/** Restore each dialog to where the user last dragged it, and remember new drags. Called once by boot() */
export function initDialogPositionPersistence(): void {
  $(document).on("dialogcreate", translateTitlebar);
  $(document).on("dialogcreate", ".dialog", function (this: HTMLElement) {
    if (!POSITION_EXCLUDED_IDS.has(this.id)) addResetButton(this);
  });

  $(document).on("dialogopen", ".dialog", function (this: HTMLElement) {
    applySavedPosition(this);
  });

  $(document).on(
    "dialogdragstop",
    ".dialog",
    function (this: HTMLElement, _event: unknown, ui: { position: DialogPosition }) {
      if (POSITION_EXCLUDED_IDS.has(this.id)) return;
      dialogState.set(this.id, "position", ui.position);
    }
  );
}

window.closeDialogs = closeDialogs;
window.confirmationDialog = confirmationDialog;
