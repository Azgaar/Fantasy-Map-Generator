import { capitalize, findEl } from "@/utils";
import { dialogState } from "./state";

const EDITOR_PAGE_SIZE = 100;
const EDITOR_PAGE_SIZE_MOBILE = 20;

// MOBILE is a bare global set by main.js after ES modules evaluate, so it must be read lazily here, never at module scope
const defaultPageSize = () => (typeof MOBILE !== "undefined" && MOBILE ? EDITOR_PAGE_SIZE_MOBILE : EDITOR_PAGE_SIZE);

export type TableView<T> = { rows: T[]; all: T[]; page: number; totalPages: number; total: number };

type EditorTable<T> = {
  view: () => TableView<T>;
  goto: (page: number) => void;
  refresh: () => void;
  reset: () => void;
};

export function initEditorTable<T>({
  getData,
  onUpdate,
  pageSize
}: {
  getData: () => T[];
  onUpdate: (view: TableView<T>) => void;
  pageSize?: number;
}): EditorTable<T> {
  let page = 1;
  let current: TableView<T> = { rows: [], all: [], page: 1, totalPages: 1, total: 0 };

  const refresh = () => {
    const size = pageSize ?? defaultPageSize();
    const all = getData();
    const total = all.length;
    const totalPages = Math.max(1, Math.ceil(total / size));
    page = Math.min(Math.max(1, page), totalPages);
    const start = (page - 1) * size;
    current = { rows: all.slice(start, start + size), all, page, totalPages, total };
    onUpdate(current);
  };

  return {
    view: () => current,
    goto: (p: number) => {
      page = p;
      refresh();
    },
    refresh,
    reset: () => {
      page = 1;
      refresh();
    }
  };
}

export function renderEditorPagination(
  footer: HTMLElement,
  view: { page: number; totalPages: number },
  onGoto: (page: number) => void
): void {
  let nav = footer.querySelector<HTMLElement>(":scope > .editorPagination");
  if (!nav) {
    footer.style.display = "flex";
    footer.style.flexWrap = "wrap";
    footer.style.alignItems = "center";
    footer.style.width = "0";
    footer.style.minWidth = "100%";
    nav = document.createElement("div");
    nav.className = "editorPagination";
    nav.style.cssText = "margin-left: auto; display: inline-flex; gap: 0.3em; align-items: center;";
    footer.appendChild(nav);
  }

  if (view.totalPages <= 1) {
    nav.style.display = "none";
    nav.innerHTML = "";
    return;
  }
  nav.style.display = "inline-flex";
  nav.innerHTML = /* html */ `
    <button class="icon-left-open editorPagePrev" data-tip="Previous page" style="padding: 0 4px;" ${view.page <= 1 ? "disabled" : ""}></button>
    <span>Page&nbsp;<input class="editorPageInput" type="number" min="1" max="${view.totalPages}" value="${view.page}" style="width: 3.5em" data-tip="Jump to page" />&nbsp;of&nbsp;${view.totalPages}</span>
    <button class="icon-right-open editorPageNext" data-tip="Next page" style="padding: 0 4px;" ${view.page >= view.totalPages ? "disabled" : ""}></button>`;
  nav.querySelector<HTMLElement>(".editorPagePrev")?.addEventListener("click", () => onGoto(view.page - 1));
  nav.querySelector<HTMLElement>(".editorPageNext")?.addEventListener("click", () => onGoto(view.page + 1));
  nav.querySelector<HTMLInputElement>(".editorPageInput")?.addEventListener("change", event => {
    onGoto(Number((event.target as HTMLInputElement).value));
  });
}

export type EditorColumn<T = any> = {
  key: string;
  label?: string;
  width?: string;
  tip?: string;
  sortBy?: (item: T) => string | number;
  sortType?: "alpha" | "number";
  defaultSort?: "asc" | "desc";
  permanent?: boolean;
  hidden?: boolean;
  mobileHidden?: boolean;
  align?: "left" | "right";
  marginLeft?: string;
};

export function buildTracks(columns: EditorColumn[], hidden: Set<string>): string {
  return columns
    .filter(column => !hidden.has(column.key))
    .map(column => column.width ?? "auto")
    .join(" ");
}

export function getLastVisibleIndex(columns: EditorColumn[], hidden: Set<string>): number {
  return columns.findLastIndex(column => !hidden.has(column.key));
}

export function renderEditorHeader({ dialogId, columns }: { dialogId: string; columns: EditorColumn[] }) {
  const defaultHidden = new Set(columns.filter(column => column.hidden).map(column => column.key));
  const lastVisibleIndex = getLastVisibleIndex(columns, defaultHidden);
  const cells = columns.map((column, index) => {
    const classes: string[] = [];
    if (column.sortBy) {
      classes.push("sortable");
      if (column.sortType === "alpha") classes.push("alphabetically");
      if (column.defaultSort) {
        const type = column.sortType === "alpha" ? "name" : "number";
        classes.push(`icon-sort-${type}-${column.defaultSort === "desc" ? "down" : "up"}`);
      }
    }
    const tip = column.tip ?? (column.sortBy && column.label ? `Click to sort by ${column.label}` : "");
    const attributes = [
      `data-col="${column.key}"`,
      classes.length ? `class="${classes.join(" ")}"` : "",
      column.sortBy ? `data-sortby="${column.key}"` : "",
      tip ? `data-tip="${tip}"` : ""
    ]
      .filter(Boolean)
      .join(" ");

    const style = [
      "white-space:nowrap",
      column.align ? `text-align:${column.align}` : "",
      column.marginLeft ? `margin-left:${column.marginLeft}` : ""
    ]
      .filter(Boolean)
      .join("; ");

    const button =
      index === lastVisibleIndex
        ? `<button id="${dialogId}ColumnsButton" data-tip="Show or hide columns" class="icon-sliders" style="line-height: 0;padding: 0 .2em;"></button>`
        : "";
    return `<div ${attributes} style="${style}">${column.label ?? ""}${button}</div>`;
  });
  return `<div id="${dialogId}Header" class="header">${cells.join("")}</div>`;
}

type ColumnVisibilityState = { hidden: string[]; shown: string[] };

export function loadHiddenColumns(dialogId: string, columns: EditorColumn[]): Set<string> {
  const configurable = new Set(columns.filter(column => !column.permanent).map(column => column.key));
  const defaults = columns.filter(column => column.hidden).map(column => column.key);
  const saved = dialogState.get<ColumnVisibilityState | null>(dialogId, "columns", () => null);
  if (saved === null) {
    const mobile = typeof MOBILE !== "undefined" && MOBILE;
    if (mobile) defaults.push(...columns.filter(column => column.mobileHidden).map(column => column.key));
  }

  const hidden = new Set(defaults.filter(key => configurable.has(key)));
  for (const key of saved?.hidden ?? []) if (configurable.has(key)) hidden.add(key);
  for (const key of saved?.shown ?? []) hidden.delete(key);
  return hidden;
}

export function saveHiddenColumns(dialogId: string, hidden: Set<string>, columns: EditorColumn[]): void {
  const configurable = columns.filter(column => !column.permanent).map(column => column.key);
  const saved = {
    hidden: configurable.filter(key => hidden.has(key)),
    shown: configurable.filter(key => !hidden.has(key))
  };
  dialogState.set(dialogId, "columns", saved);
}

export function restoreDefaultColumnVisibility(dialogId: string, columns: EditorColumn[]): Set<string> {
  dialogState.remove(dialogId, "columns");
  return loadHiddenColumns(dialogId, columns);
}

export function invertColumnVisibility(dialogId: string, columns: EditorColumn[]): Set<string> {
  const hidden = loadHiddenColumns(dialogId, columns);
  const inverted = new Set(
    columns.filter(column => !column.permanent && !hidden.has(column.key)).map(column => column.key)
  );
  saveHiddenColumns(dialogId, inverted, columns);
  return inverted;
}

const dialogColumnsRegistry = new Map<string, { columns: EditorColumn[]; modeHidden: Set<string> }>();

function effectiveHidden(dialogId: string): Set<string> {
  const entry = dialogColumnsRegistry.get(dialogId);
  if (!entry) return new Set();
  const hidden = loadHiddenColumns(dialogId, entry.columns);
  for (const key of entry.modeHidden) hidden.add(key);
  return hidden;
}

function applyColumnVisibility(dialogId: string, hidden: Set<string>): void {
  const dialog = document.getElementById(dialogId);
  const styleId = `${dialogId}ColumnsStyle`;
  let style = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = styleId;
    document.head.appendChild(style);
  }
  style.textContent = Array.from(hidden)
    .map(key => `#${dialogId} [data-col="${key}"] {display: none}`)
    .join("\n");
  if (!dialog) return;

  const entry = dialogColumnsRegistry.get(dialogId);
  if (!entry) return;

  dialog.style.setProperty("--table-columns", buildTracks(entry.columns, hidden));

  const lastVisibleIndex = getLastVisibleIndex(entry.columns, hidden);
  const header = document.getElementById(`${dialogId}Header`);
  const lastVisibleCell = header?.querySelectorAll<HTMLElement>(":scope > [data-col]")[lastVisibleIndex];
  const button = document.getElementById(`${dialogId}ColumnsButton`);
  if (!lastVisibleCell || !button) return;

  lastVisibleCell.appendChild(button);
  const popup = document.getElementById(`${dialogId}ColumnsPicker`);
  if (popup) button.insertAdjacentElement("afterend", popup);
}

export function setModeHiddenColumns(dialogId: string, keys: string[]): void {
  const entry = dialogColumnsRegistry.get(dialogId);
  if (!entry) return;
  entry.modeHidden = new Set(keys);
  applyColumnVisibility(dialogId, effectiveHidden(dialogId));
}

function bindColumnsPicker({
  dialogId,
  columns,
  onChange
}: {
  dialogId: string;
  columns: EditorColumn[];
  onChange: (hidden: Set<string>) => void;
}): void {
  const popupId = `${dialogId}ColumnsPicker`;
  let closePopup: (() => void) | null = null;

  const button = findEl(`${dialogId}ColumnsButton`);
  if (!button) return;
  button.addEventListener("click", () => {
    const existing = document.getElementById(popupId);
    if (existing) {
      closePopup?.();
      return;
    }
    const hidden = loadHiddenColumns(dialogId, columns);
    const popup = document.createElement("div");
    popup.id = popupId;
    popup.style.cssText = /*css*/ `
      position: fixed;
      z-index: 100;
      width: max-content;
      min-width: 100px;
      max-height: 50vh;
      overflow-y: auto;
      white-space: nowrap;
      padding: 0.6em 0.4em;
      background: #eee;
      border: 1px solid #bbb;
    `;

    const getOption = (
      column: EditorColumn
    ) => /* html */ `<label style="display: flex; align-items: center; cursor: pointer;">
      <input class="native" type="checkbox" data-key="${column.key}" ${hidden.has(column.key) ? "" : "checked"} />
      ${column.label || capitalize(column.key)}
    </label>`;
    const options = columns
      .filter(column => !column.permanent)
      .map(getOption)
      .join("");
    popup.innerHTML = `${options}
      <div style="display: flex; justify-content: flex-end; gap: 0.2em; margin-top: 0.5em;">
        <button id="${popupId}Invert" type="button" class="icon-exchange" data-tip="Invert columns visibility" aria-label="Invert columns visibility"></button>
        <button id="${popupId}RestoreDefaults" type="button" class="icon-ccw" data-tip="Restore default columns visibility" aria-label="Restore default columns visibility"></button>
      </div>`;

    const updateCheckboxes = (updated: Set<string>) => {
      popup.querySelectorAll<HTMLInputElement>("input[data-key]").forEach(checkbox => {
        checkbox.checked = !updated.has(checkbox.dataset.key as string);
      });
    };

    popup.addEventListener("change", event => {
      const checkbox = event.target as HTMLInputElement;
      const updated = loadHiddenColumns(dialogId, columns);
      const key = checkbox.dataset.key as string;
      if (checkbox.checked) updated.delete(key);
      else updated.add(key);
      saveHiddenColumns(dialogId, updated, columns);
      onChange(updated);
    });

    popup.querySelector(`#${popupId}Invert`)?.addEventListener("click", () => {
      const inverted = invertColumnVisibility(dialogId, columns);
      updateCheckboxes(inverted);
      onChange(inverted);
    });

    popup.querySelector(`#${popupId}RestoreDefaults`)?.addEventListener("click", () => {
      const restored = restoreDefaultColumnVisibility(dialogId, columns);
      updateCheckboxes(restored);
      onChange(restored);
    });

    button.insertAdjacentElement("afterend", popup);
    const positionPopup = () => {
      const rect = button.getBoundingClientRect();
      const margin = 4;
      const { width: popupWidth, height: popupHeight } = popup.getBoundingClientRect();
      const fitsBelow = rect.bottom + 2 + popupHeight <= window.innerHeight - margin;
      const fitsAbove = rect.top - 2 - popupHeight >= margin;
      const top = fitsBelow || !fitsAbove ? rect.bottom + 2 : rect.top - popupHeight - 2;
      popup.style.top = `${Math.max(margin, Math.min(top, window.innerHeight - popupHeight - margin))}px`;
      popup.style.left = `${Math.max(margin, Math.min(rect.left, window.innerWidth - popupWidth - margin))}px`;
    };
    positionPopup();

    closePopup = () => {
      popup.remove();
      document.removeEventListener("mousedown", close);
    };

    const close = (event: MouseEvent) => {
      if (!popup.contains(event.target as Node) && event.target !== button) {
        closePopup?.();
      }
    };
    document.addEventListener("mousedown", close);
  });
}

export function initColumnVisibility({
  dialogId,
  columns,
  onUpdate
}: {
  dialogId: string;
  columns: EditorColumn[];
  onUpdate: VoidFunction;
}): void {
  dialogColumnsRegistry.set(dialogId, { columns, modeHidden: new Set() });
  applyColumnVisibility(dialogId, effectiveHidden(dialogId));

  bindColumnsPicker({
    dialogId,
    columns,
    onChange: () => {
      applyColumnVisibility(dialogId, effectiveHidden(dialogId));
      onUpdate();
    }
  });
}
