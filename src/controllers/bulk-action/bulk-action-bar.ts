import { bulkDeleteConfirm } from "./bulk-delete-confirm";
import type { BulkEntityAdapter } from "./bulk-entity-adapter";
import { BulkSelection } from "./bulk-selection";

/**
 * DOM glue for one list menu. Adds a "Bulk Options" toggle at the top-right of the
 * menu; opening it reveals per-row checkboxes plus an inline toolbar (Select all +
 * Delete / Lock / Unlock / Set color, as the adapter supports). The toolbar stays
 * open across actions and the selection is kept (deleted rows simply drop off), so
 * actions can be chained. Wires DOM events to a shared BulkSelection and the menu's
 * BulkEntityAdapter, and re-syncs after the list re-renders. Attaches to both
 * legacy-JS and migrated-TS lists, which share the same `.table` of row `<div>`s.
 */
export class BulkActionBar {
  private readonly adapter: BulkEntityAdapter;
  private readonly selection: BulkSelection;
  private container: HTMLElement | null = null;
  private bar: HTMLElement | null = null;
  private toggle: HTMLButtonElement | null = null;
  private toolbar: HTMLElement | null = null;
  private selectAllCheckbox: HTMLInputElement | null = null;
  private countLabel: HTMLElement | null = null;
  private bulkMode = false;

  constructor(adapter: BulkEntityAdapter) {
    this.adapter = adapter;
    this.selection = new BulkSelection(id => adapter.isDeletable(id));
  }

  /** Create the bar (idempotent) and wire events. Call once the container exists. */
  mount(): void {
    this.container = document.getElementById(this.adapter.containerId);
    if (!this.container) return;
    if (this.bar) {
      this.sync();
      return;
    }

    const canLock = typeof this.adapter.setLock === "function";
    const canColor = this.adapter.supportsColor && typeof this.adapter.setColor === "function";
    const lockButtons = canLock
      ? /* html */ `
        <button type="button" class="bulkLock" data-tip="Lock selected rows (protects from regeneration and bulk delete)">Lock</button>
        <button type="button" class="bulkUnlock" data-tip="Unlock selected rows">Unlock</button>`
      : "";
    const colorButton = canColor
      ? /* html */ `<button type="button" class="bulkColor" data-tip="Set color of selected rows">Set color</button>`
      : "";

    const bar = document.createElement("div");
    bar.className = "bulkActionBar";
    bar.innerHTML = /* html */ `
      <button type="button" class="bulkOptionsToggle" data-tip="Show bulk selection options" aria-expanded="false">Bulk Options ▾</button>
      <div class="bulkToolbar" hidden>
        <label class="bulkSelectAll" data-tip="Select or deselect all visible rows">
          <input type="checkbox" class="bulkSelectAllCheckbox native" /> Select all
        </label>
        <span class="bulkCount">0 selected</span>
        <button type="button" class="bulkDelete" data-tip="Delete selected rows">Delete</button>
        ${lockButtons}
        ${colorButton}
      </div>`;

    // place at the top of the menu (above the column header)
    const host = this.container.closest(".dialog") ?? this.container.parentElement ?? this.container;
    host.insertAdjacentElement("afterbegin", bar);

    this.bar = bar;
    this.toggle = bar.querySelector(".bulkOptionsToggle");
    this.toolbar = bar.querySelector(".bulkToolbar");
    this.selectAllCheckbox = bar.querySelector(".bulkSelectAllCheckbox");
    this.countLabel = bar.querySelector(".bulkCount");

    this.toggle?.addEventListener("click", () => this.toggleBulkMode());
    this.selectAllCheckbox?.addEventListener("change", () => this.onToggleSelectAll());
    bar.querySelector(".bulkDelete")?.addEventListener("click", () => this.onDelete());
    bar.querySelector(".bulkLock")?.addEventListener("click", () => this.onSetLock(true));
    bar.querySelector(".bulkUnlock")?.addEventListener("click", () => this.onSetLock(false));
    bar.querySelector(".bulkColor")?.addEventListener("click", () => this.onSetColor());

    // delegate per-row checkbox changes from the container
    this.container.addEventListener("change", event => {
      const target = event.target as HTMLElement;
      if (!target.classList?.contains("bulkRowCheckbox")) return;
      const row = target.parentElement as HTMLElement | null;
      const id = row && this.adapter.getRowId(row);
      if (id === null || id === undefined) return;
      this.selection.toggle(id);
      this.updateBar();
    });

    this.sync();
  }

  /** Re-apply per-row checkboxes (only in bulk mode) after a list re-render. */
  sync(): void {
    if (!this.container || !this.bar) return;
    const rows = Array.from(this.container.children) as HTMLElement[];
    rows.forEach(row => {
      const id = this.adapter.getRowId(row);
      const existing = row.querySelector<HTMLInputElement>(":scope > input.bulkRowCheckbox");

      if (!this.bulkMode || id === null || !this.adapter.isDeletable(id)) {
        existing?.remove();
        return;
      }

      const checkbox = existing ?? row.insertBefore(this.makeRowCheckbox(), row.firstChild);
      checkbox.checked = this.selection.isSelected(id);
    });
    this.updateBar();
  }

  private makeRowCheckbox(): HTMLInputElement {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    // `native` opts out of the app's global rule that hides unstyled checkboxes
    checkbox.className = "bulkRowCheckbox native";
    return checkbox;
  }

  private toggleBulkMode(): void {
    this.bulkMode = !this.bulkMode;
    if (this.toolbar) this.toolbar.hidden = !this.bulkMode;
    this.toggle?.setAttribute("aria-expanded", String(this.bulkMode));
    this.toggle?.classList.toggle("active", this.bulkMode);
    if (this.toggle) this.toggle.textContent = this.bulkMode ? "Bulk Options ▴" : "Bulk Options ▾";
    this.sync();
  }

  private onToggleSelectAll(): void {
    const visibleIds = this.getSelectableVisibleIds();
    if (this.selectAllCheckbox?.checked) {
      this.selection.selectAll(visibleIds);
    } else {
      visibleIds.forEach(id => {
        this.selection.remove(id);
      });
    }
    this.sync();
  }

  private onDelete(): void {
    const ids = this.selection.getSelected();
    bulkDeleteConfirm({
      typeLabel: this.adapter.type,
      childKind: this.adapter.childKind,
      describe: deleteChildren => this.adapter.describeCascade(ids, { deleteChildren }),
      onConfirm: deleteChildren => {
        const deletedIds = ids.filter(id => this.adapter.isDeletable(id) && !this.adapter.isLocked(id));
        deletedIds.forEach(id => {
          this.adapter.deleteEntity(id, { deleteChildren });
          this.selection.remove(id); // drop removed rows; keep skipped (locked) ones selected
        });
        this.adapter.redraw(); // single redraw + list refresh (which re-syncs the bar)
        this.sync();
      }
    });
  }

  private onSetLock(locked: boolean): void {
    if (!this.adapter.setLock) return;
    this.selection.getSelected().forEach(id => {
      this.adapter.setLock?.(id, locked);
    });
    this.adapter.redraw();
    this.sync(); // selection kept so actions can be chained
  }

  private onSetColor(): void {
    if (!this.adapter.setColor) return;
    const ids = this.selection.getSelected();
    if (!ids.length) return;
    openPicker("#ffffff", chosenColor => {
      ids.forEach(id => {
        this.adapter.setColor?.(id, chosenColor);
      });
      this.adapter.redraw();
      this.sync(); // selection kept so actions can be chained
    });
  }

  private getSelectableVisibleIds(): number[] {
    if (!this.container) return [];
    const ids: number[] = [];
    (Array.from(this.container.children) as HTMLElement[]).forEach(row => {
      if (row.classList.contains("hidden") || row.style.display === "none") return;
      const id = this.adapter.getRowId(row);
      if (id !== null && this.adapter.isDeletable(id)) ids.push(id);
    });
    return ids;
  }

  private updateBar(): void {
    if (!this.bar) return;
    const count = this.selection.count;
    if (this.countLabel) this.countLabel.textContent = `${count} selected`;

    const visibleIds = this.getSelectableVisibleIds();
    const allSelected = visibleIds.length > 0 && visibleIds.every(id => this.selection.isSelected(id));
    if (this.selectAllCheckbox) {
      this.selectAllCheckbox.checked = allSelected;
      this.selectAllCheckbox.indeterminate = count > 0 && !allSelected;
    }
  }
}
