/** Bounded undo stack used by manual territory-assignment modes. */
export class ManualAssignmentHistory {
  private snapshots: string[] = [];

  constructor(private readonly limit = 100) {}

  get hasSnapshots(): boolean {
    return this.snapshots.length > 0;
  }

  reset(): void {
    this.snapshots = [];
  }

  push(markup: string): void {
    this.snapshots.push(markup);
    if (this.snapshots.length > this.limit) this.snapshots.shift();
  }

  pop(): string | undefined {
    return this.snapshots.pop();
  }
}

export function selectTerritoryEditorRow(root: ParentNode, row: HTMLElement | null): void {
  root.querySelector<HTMLElement>("div.selected")?.classList.remove("selected");
  row?.classList.add("selected");
}
