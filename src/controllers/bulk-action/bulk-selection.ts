/**
 * Pure, DOM-free selection state for a single list menu. Tracks which entity ids
 * are selected and enforces an optional "can this id be selected" predicate, used
 * to keep non-deletable rows (such as the neutral state 0) out of any selection.
 * Knows nothing about entity types or the DOM — the bar feeds it filtered id sets.
 */
export class BulkSelection {
  private readonly selected = new Set<number>();
  private readonly canSelect: (id: number) => boolean;

  constructor(canSelect: (id: number) => boolean = () => true) {
    this.canSelect = canSelect;
  }

  add(id: number): void {
    if (this.canSelect(id)) this.selected.add(id);
  }

  remove(id: number): void {
    this.selected.delete(id);
  }

  toggle(id: number): void {
    if (this.selected.has(id)) this.selected.delete(id);
    else this.add(id);
  }

  /** Filter-aware select-all: select every selectable id in the supplied set. */
  selectAll(ids: Iterable<number>): void {
    for (const id of ids) this.add(id);
  }

  clear(): void {
    this.selected.clear();
  }

  isSelected(id: number): boolean {
    return this.selected.has(id);
  }

  getSelected(): number[] {
    return [...this.selected];
  }

  get count(): number {
    return this.selected.size;
  }
}
