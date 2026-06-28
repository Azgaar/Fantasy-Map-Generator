import { bulkDeleteConfirm } from "./bulk-delete-confirm";
import type { BulkEntityAdapter } from "./bulk-entity-adapter";
import { BulkSelection } from "./bulk-selection";

/**
 * DOM glue for one list menu. Adds a single icon button to the menu's footer button
 * row (like the other footer buttons). Toggling it on reveals per-row checkboxes plus
 * a compact set of inline footer controls — Select all, an "N selected" count, and
 * Delete / Lock / Unlock / Set color icon buttons (only those the adapter supports).
 * The controls stay open across actions and the selection is kept (deleted rows simply
 * drop off), so actions can be chained. Wires DOM events to a shared BulkSelection and
 * the menu's BulkEntityAdapter, and re-syncs after the list re-renders. Attaches to both
 * legacy-JS and migrated-TS lists, which share the same `.table` of row `<div>`s.
 */
export class BulkActionBar {
  private readonly adapter: BulkEntityAdapter;
  private readonly selection: BulkSelection;
  private container: HTMLElement | null = null;
  private footer: HTMLElement | null = null;
  private toggle: HTMLButtonElement | null = null;
  private inline: HTMLElement | null = null;
  private selectAllCheckbox: HTMLInputElement | null = null;
  private countLabel: HTMLElement | null = null;
  private bulkMode = false;

  constructor(adapter: BulkEntityAdapter) {
    this.adapter = adapter;
    this.selection = new BulkSelection(id => adapter.isDeletable(id));
  }

  /** Create the footer controls (idempotent) and wire events. Call once the menu exists. */
  mount(): void {
    this.container = document.getElementById(this.adapter.containerId);
    this.footer = document.getElementById(this.adapter.footerId);
    if (!this.container || !this.footer) return;
    if (this.toggle) {
      this.sync();
      return;
    }

    const canLock = typeof this.adapter.setLock === "function";
    const canColor = this.adapter.supportsColor && typeof this.adapter.setColor === "function";
    const lockButtons = canLock
      ? /* html */ `
        <button type="button" class="bulkLock icon-lock" data-tip="Lock selected rows (protects from regeneration and bulk delete)"></button>
        <button type="button" class="bulkUnlock icon-lock-open" data-tip="Unlock selected rows"></button>`
      : "";
    const colorButton = canColor
      ? /* html */ `<button type="button" class="bulkColor icon-brush" data-tip="Set color of selected rows"></button>`
      : "";

    // The single entry button — styled like the menu's other footer icon buttons.
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "bulkToggle icon-check-empty";
    toggle.dataset.tip = "Bulk select: pick multiple rows, then delete/lock/recolor at once";
    toggle.setAttribute("aria-pressed", "false");

    // The inline controls, hidden until bulk mode is on.
    const inline = document.createElement("span");
    inline.className = "bulkInline";
    inline.hidden = true;
    inline.innerHTML = /* html */ `
      <label class="bulkSelectAll" data-tip="Select or deselect all visible rows">
        <input type="checkbox" class="bulkSelectAllCheckbox native" /> All
      </label>
      <span class="bulkCount">0 selected</span>
      <button type="button" class="bulkDelete icon-trash" data-tip="Delete selected rows"></button>
      ${lockButtons}
      ${colorButton}`;

    // Place the controls before a trailing search box if there is one, else at the end.
    const searchAnchor = this.footer.querySelector(":scope > label");
    this.footer.insertBefore(toggle, searchAnchor);
    this.footer.insertBefore(inline, searchAnchor);

    this.toggle = toggle;
    this.inline = inline;
    this.selectAllCheckbox = inline.querySelector(".bulkSelectAllCheckbox");
    this.countLabel = inline.querySelector(".bulkCount");

    toggle.addEventListener("click", () => this.toggleBulkMode());
    this.selectAllCheckbox?.addEventListener("change", () => this.onToggleSelectAll());
    inline.querySelector(".bulkDelete")?.addEventListener("click", () => this.onDelete());
    inline.querySelector(".bulkLock")?.addEventListener("click", () => this.onSetLock(true));
    inline.querySelector(".bulkUnlock")?.addEventListener("click", () => this.onSetLock(false));
    inline.querySelector(".bulkColor")?.addEventListener("click", () => this.onSetColor());

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
    if (!this.container || !this.toggle) return;
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
    if (this.inline) this.inline.hidden = !this.bulkMode;
    this.toggle?.setAttribute("aria-pressed", String(this.bulkMode));
    this.toggle?.classList.toggle("active", this.bulkMode);
    this.toggle?.classList.toggle("icon-check-empty", !this.bulkMode);
    this.toggle?.classList.toggle("icon-ok-squared", this.bulkMode);
    if (!this.bulkMode) this.selection.clear();
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
    if (!this.toggle) return;
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
