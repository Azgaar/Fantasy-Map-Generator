import { Controllers } from "@/controllers";
import type { Era } from "@/data/development";
import { Options } from "@/model/options/options-model";
import { Development } from "@/model/society/development-generator";
import { getEraColor } from "@/renderers/overlays/development-overlay";
import { eraName } from "@/ui/development-view";
import { Dialog } from "@/ui/dialog/dialog";
import { type EditorColumn, getRowId, initColumnVisibility, renderEditorHeader } from "@/ui/dialog/table";
import { tip } from "@/ui/tooltips";
import { t } from "@/utils/i18n";
import { ensureEl, findEl } from "@/utils/node-utils";
import { escapeHtml } from "@/utils/string-utils";

const dialogId = "erasEditor" as const;
const position = { my: "center", at: "center", of: "svg" };

const columns: EditorColumn<Era>[] = [
  { key: "name", label: t("Era"), width: "14em", permanent: true },
  { key: "levels", label: t("Levels"), width: "5em" }
];

function open(): void {
  if (options.app.mode) return;
  Dialog.closeAll(`#${dialogId}, .stable`);

  renderDialog();
  renderEras();

  Dialog.open(dialogId, { title: t("Eras"), position, onClose: () => Dialog.destroy(dialogId) });
}

function renderDialog(): void {
  Dialog.destroy(dialogId);

  const html = /* html */ `<div id="${dialogId}" class="dialog stable editorDialog">
    <div id="erasBody" class="table">${renderEditorHeader({ dialogId, columns })}</div>
    <div id="erasBottom" class="editorToolbar">
      <button id="erasRestore" data-tip="${t("Restore default era names")}" class="icon-ccw"></button>
    </div>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);

  initColumnVisibility({
    dialogId,
    columns,
    onUpdate: () => Dialog.update(dialogId, { width: "fit-content", position })
  });
  ensureEl("erasRestore").addEventListener("click", confirmRestore);
}

function renderEras(): void {
  const { eras } = Development;
  const body = ensureEl("erasBody");
  body.querySelectorAll(":scope > .states").forEach(row => {
    row.remove();
  });

  const lines = eras.map(({ level, name }, i) => {
    const to = (eras[i + 1]?.level ?? 101) - 1;
    return /* html */ `<div class="states" data-id="${i}">
      <div data-col="name">
        <fill-box fill="${getEraColor(i)}" disabled></fill-box>
        <input class="eraName" value="${escapeHtml(eraName(name))}" data-tip="${t("Name")}" />
      </div>
      <div data-col="levels" data-tip="${t("Development levels of the era")}">${level === to ? level : `${level}-${to}`}</div>
    </div>`;
  });
  body.insertAdjacentHTML("beforeend", lines.join(""));

  body.querySelectorAll<HTMLInputElement>(".eraName").forEach(input => {
    input.addEventListener("change", onNameChange);
  });
}

function onNameChange(this: HTMLInputElement): void {
  const era = Development.eras[getRowId(this)];
  const name = this.value.trim();
  if (!name) {
    this.value = eraName(era.name);
    tip(t("Name cannot be empty"), true, "error", 8000);
    return;
  }

  era.name = name;
  saved();
}

function confirmRestore(): void {
  Dialog.confirm({
    title: t("Restore default era names"),
    message: t("Restore the default era names? Your names will be lost"),
    confirm: t("Restore"),
    onConfirm: () => {
      options.map.eras = Development.getDefaultEras();
      saved();
      renderEras();
    }
  });
}

function saved(): void {
  Options.save();
  if (findEl("developmentEditor")) void Controllers.DevelopmentEditor.refreshNames();
}

export const ErasEditor = { open };
