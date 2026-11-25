import { Controllers } from "@/controllers";
import { Names } from "@/model/society/names/names-generator";
import { getFileName } from "@/services/io/file-name";
import type { NameBase, NameBaseEntry } from "@/types/names";
import { Dialog } from "@/ui/dialog/dialog";
import { bindColumnSorting, sortDataByColumns } from "@/ui/dialog/sorting";
import { dialogState } from "@/ui/dialog/state";
import {
  type EditorColumn,
  getRowId,
  initColumnVisibility,
  initEditorTable,
  renderEditorHeader,
  renderEditorPagination,
  type TableView
} from "@/ui/dialog/table";
import { tip } from "@/ui/tooltips";
import { wiki } from "@/utils/common-utils";
import { createFileInput, downloadFile, uploadFile } from "@/utils/file-utils";
import { sentences, t } from "@/utils/i18n";
import { ensureEl, findEl } from "@/utils/node-utils";
import { escapeHtml } from "@/utils/string-utils";
import { NamesbaseFile } from "./namesbase-file";

const dialogId = "namesbasesOverview" as const;
const position = { my: "right top", at: "right-10 top+10", of: "svg" };
const EXAMPLE =
  "This,is,an,example,of,name,base,showing,correct,format,It,should,have,at,least,one,hundred,names,separated,with,comma";

/** A base as a row of the table: `i` is its place in the list. Only what is known before the base loads */
interface Row {
  i: number;
  base: NameBaseEntry;
  status: string;
  cultures: string[];
}

const columns: EditorColumn<Row>[] = [
  {
    key: "name",
    label: t("Namesbase"),
    width: "12em",
    permanent: true,
    sortBy: ({ base }) => base.name,
    sortType: "alpha",
    defaultSort: "asc"
  },
  { key: "status", label: t("Status"), width: "6em", sortBy: ({ status }) => status, sortType: "alpha" },
  {
    key: "cultures",
    label: t("Cultures"),
    width: "14em",
    sortBy: ({ cultures }) => cultures.length,
    sortType: "number"
  },
  { key: "edit", width: "1.4em", permanent: true },
  { key: "remove", width: "1.4em", permanent: true }
];
const table = initEditorTable<Row>({ dialogId, getData: getRows, onUpdate: renderRows });

let fileInput: HTMLInputElement | null = null;
let filterState: { search: string };

function open(): void {
  if (options.app.mode) return;
  filterState = dialogState.get(dialogId, "filters", () => ({ search: "" }));
  Dialog.closeAll(`#${dialogId}, .stable`);

  renderDialog();
  table.reset();
  Dialog.open(dialogId, { title: t("Namesbases Overview"), position, onClose: () => Dialog.destroy(dialogId) });
}

/** Show what an editor has changed */
function refresh(): void {
  if (findEl(dialogId)) table.refresh();
}

function renderDialog(): void {
  Dialog.destroy(dialogId);

  const html = /* html */ `<div id="${dialogId}" class="dialog stable editorDialog">
      ${renderEditorHeader({ dialogId, columns })}
      <div id="namesbasesBody" class="table"></div>
      <div class="editorFilters">
        <label data-tip="${t("Filter by name or culture")}">${t("Search")}:
          <input id="namesbasesSearch" type="search" value="${escapeHtml(filterState.search)}" /></label>
      </div>
      <div id="namesbasesFooter" class="totalLine">
        <div>${t("Namesbases")}: <span id="namesbasesNumber"></span></div>
      </div>
      <div class="editorToolbar">
        <button id="namesbasesAdd" data-tip="${t("Add")}" class="icon-plus"></button>
        <button id="namesbasesDownload" data-tip="${t("Download all")}" class="icon-download"></button>
        <button id="namesbasesUpload" data-tip="${t("Upload")}" class="icon-upload"></button>
        <button id="namesbasesRestore" data-tip="${t("Restore default")}" class="icon-retweet"></button>
        <button id="namesbasesWiki" data-tip="${t("Open the wiki page")}" class="icon-info"></button>
      </div>
    </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);

  bindColumnSorting(dialogId, table.reset);
  initColumnVisibility({ dialogId, columns, onUpdate: () => Dialog.update(dialogId, { position }) });

  ensureEl("namesbasesBody").addEventListener("click", onRowClick);
  ensureEl("namesbasesSearch").addEventListener("input", search);
  ensureEl("namesbasesAdd").addEventListener("click", addBase);
  ensureEl("namesbasesDownload").addEventListener("click", downloadAll);
  ensureEl("namesbasesUpload").addEventListener("click", pickFile);
  ensureEl("namesbasesRestore").addEventListener("click", restoreDefault);
  ensureEl("namesbasesWiki").addEventListener("click", () => wiki("Names"));
}

function getRows(): Row[] {
  const cultures = pack.cultures.filter(({ removed }) => !removed);
  const search = filterState.search.trim().toLowerCase();
  const rows = Names.nameBases.flatMap((base, i): Row[] => {
    const users = cultures.filter(culture => culture.base === base.id).map(({ name }) => name);
    const status = Names.isShipped(base) ? t("Built-in") : Names.isChanged(base) ? t("Edited") : t("Custom");
    const text = [base.name, ...users].join("\n").toLowerCase();
    return text.includes(search) ? [{ i, base, status, cultures: users }] : [];
  });
  return sortDataByColumns(dialogId, rows, columns);
}

function renderRows(view: TableView<Row>): void {
  const lines = view.rows.map(({ i, base, status, cultures }) => {
    const users = escapeHtml(cultures.join(", "));
    const removeTip = cultures.length ? t("Used by a culture") : t("Remove");
    return /* html */ `<div class="states" data-id="${i}">
      <div data-col="name" class="pointer" data-action="edit" data-tip="${t("Edit")}">${escapeHtml(base.name)}</div>
      <div data-col="status">${status}</div>
      <div data-col="cultures" data-tip="${users}"><span style="overflow: hidden; text-overflow: ellipsis">${users}</span></div>
      <div data-col="edit"><span data-action="edit" data-tip="${t("Edit")}" class="icon-pencil"></span></div>
      <div data-col="remove"><span data-action="remove" data-tip="${removeTip}" class="icon-trash-empty${cultures.length ? " disabled" : ""}"></span></div>
    </div>`;
  });
  ensureEl("namesbasesBody").innerHTML = lines.join("");
  ensureEl("namesbasesNumber").textContent = String(view.total);
  renderEditorPagination(ensureEl("namesbasesFooter"), view, table.goto);
}

function onRowClick(event: MouseEvent): void {
  const target = (event.target as HTMLElement).closest<HTMLElement>("[data-action]");
  if (!target || target.classList.contains("disabled")) return;
  const i = getRowId(target);
  if (target.dataset.action === "edit") void Controllers.NamesbaseEditor.open(i);
  else void triggerRemove(i);
}

async function triggerRemove(i: number): Promise<void> {
  const { id, name } = Names.nameBases[i];
  await Names.loadAll(); // only a loaded base tells what it extends
  const heirs = Names.loaded().filter(base => base.extends === id);
  if (heirs.length) {
    const bases = heirs.map(heir => heir.name).join(", ");
    tip(t("Cannot remove the base, others extend it: {{bases}}", { bases }), false, "error", 4000);
    return;
  }
  Dialog.confirm({
    title: t("Remove"),
    message: t("Remove the namesbase {{name}}?", { name }),
    confirm: t("Remove"),
    onConfirm: () => {
      Dialog.close("namesbaseEditor");
      Names.remove(id);
      table.refresh();
    }
  });
}

function search(this: HTMLInputElement): void {
  filterState.search = this.value;
  dialogState.set(dialogId, "filters", filterState);
  table.reset();
}

function addBase(): void {
  const name = `Base${Names.nameBases.length}`;
  Names.add(Names.composeBase(Names.uniqueId(name, Names.ids()), name, [5, 12], EXAMPLE.split(",")));
  table.refresh();
  void Controllers.NamesbaseEditor.open(Names.nameBases.length - 1);
}

async function downloadAll(): Promise<void> {
  await Names.loadAll();
  downloadFile(NamesbaseFile.format(Names.loaded()), `${getFileName("Namesbase")}.json`, "application/json");
}

/** Own the file input here so repeat opens cannot stack listeners on a shared element */
function pickFile(): void {
  fileInput ??= createFileInput(".json,.txt");
  fileInput.onchange = () => uploadFile(fileInput!, offerUpload);
  fileInput.click();
}

function offerUpload(data: string): void {
  const bases = NamesbaseFile.parse(data);
  if (!bases.length) return;
  Dialog.message({
    title: t("Upload namesbases"),
    message: sentences(
      t("Namesbases in the file: {{- names}}", { names: escapeHtml(bases.map(({ name }) => name).join(", ")) }),
      t("Add them to the current ones or replace all of them?")
    ),
    buttons: [
      { label: t("Add"), onClick: () => void take(NamesbaseFile.withOwnIds(bases, Names.ids()), false) },
      { label: t("Replace"), onClick: () => void take(bases, true) },
      { label: t("Cancel") }
    ]
  });
}

async function take(bases: NameBase[], replace: boolean): Promise<void> {
  Dialog.close("namesbaseEditor");
  Names.replace(replace ? bases : [...Names.nameBases, ...bases]);
  await Names.loadUsed();
  refresh();
  tip(t("Namesbases uploaded: {{number}}", { number: bases.length }), false, "success", 4000);
}

function restoreDefault(): void {
  Dialog.confirm({
    title: t("Restore default data"),
    message: t("Are you sure you want to restore default namesbase?"),
    confirm: t("Restore"),
    onConfirm: async () => {
      Dialog.close("namesbaseEditor");
      Names.replace(Names.getNameBases());
      await Names.loadUsed();
      refresh();
    }
  });
}

export const NamesbasesOverview = { open, refresh };
