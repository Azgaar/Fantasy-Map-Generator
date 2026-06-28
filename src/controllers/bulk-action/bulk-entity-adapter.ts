/**
 * The per-type seam for the Bulk Action Bar. Each list menu supplies one adapter
 * describing how to operate on its entity type without the bar knowing the type.
 * Action-specific members (lock/color/children) are optional so a menu only
 * implements what it supports; the bar reads the flags to decide which controls
 * to show.
 */

export interface CascadeSummary {
  /** Human-readable lines describing what a bulk delete will do. */
  lines: string[];
  /** How many selected ids will actually be deleted (locked rows excluded). */
  deletable: number;
  /** How many selected ids are skipped because they are locked. */
  skippedLocked: number;
}

export interface BulkDeleteOptions {
  /** Delete contained children (burgs) instead of reassigning them (States/Provinces only). */
  deleteChildren?: boolean;
}

export interface BulkEntityAdapter {
  /** Stable type name, e.g. "states". */
  readonly type: string;
  /** DOM id of the list container (`<div class="table">`) whose rows get checkboxes. */
  readonly containerId: string;
  /** DOM id of the menu's footer button row (`<prefix>Bottom`) where the bulk controls live. */
  readonly footerId: string;
  /** Whether the "Set color" action is offered for this type. */
  readonly supportsColor: boolean;
  /** Name of the contained child entity, e.g. "burgs" — only set for States/Provinces. */
  readonly childKind?: string;

  /** Extract the entity id from a row element, or null if the row carries none. */
  getRowId(row: HTMLElement): number | null;
  /** False for special rows the app forbids deleting (e.g. neutral state 0). */
  isDeletable(id: number): boolean;
  isLocked(id: number): boolean;

  setLock?(id: number, locked: boolean): void;
  setColor?(id: number, color: string): void;

  /** Delete one entity, delegating to the type's existing single-delete cascade. */
  deleteEntity(id: number, options?: BulkDeleteOptions): void;
  /** Delete the entity's contained children (States/Provinces only). */
  deleteChildren?(id: number): void;

  /** Summarize the effect of deleting the given ids, for the confirmation dialog. */
  describeCascade(ids: number[], options?: BulkDeleteOptions): CascadeSummary;

  /** Redraw the map/list once after a bulk action completes. */
  redraw(): void;
}
