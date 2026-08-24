import {
  commitTerritoryAssignments,
  type EditorMutationResult,
  paintTerritoryAssignments,
  setZoneCells
} from "@/controllers/editor-mutations";
import type { Zone } from "@/generators/zones-generator";
import type { MapLayerId } from "@/renderers/core/layer-registry";
import type { TypedArray } from "@/types/PackedGraph";

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

/**
 * Undoable working copy for cell-assignment editors. Preview writes are applied to the domain array so Pixi can
 * render them, while commit restores the original first to produce an exact affected-domain result.
 */
export class TerritoryAssignmentSession {
  private readonly history: TypedArray[] = [];
  private readonly original: TypedArray;
  private working: TypedArray;

  constructor(
    private readonly layer: MapLayerId,
    private readonly target: TypedArray,
    private readonly limit = 100
  ) {
    this.original = cloneAssignments(target);
    this.working = cloneAssignments(target);
  }

  get hasSnapshots(): boolean {
    return this.history.length > 0;
  }

  get(cellId: number): number {
    return this.working[cellId];
  }

  beginStroke(): void {
    this.history.push(cloneAssignments(this.working));
    if (this.history.length > this.limit) this.history.shift();
  }

  paint(cellIds: readonly number[], domainId: number) {
    const result = paintTerritoryAssignments(this.layer, this.working, cellIds, domainId);
    if (result.changed) this.target.set(this.working);
    return result;
  }

  undo(): boolean {
    const snapshot = this.history.pop();
    if (!snapshot) return false;
    this.working = snapshot;
    this.target.set(this.working);
    return true;
  }

  commit() {
    this.target.set(this.original);
    return commitTerritoryAssignments(this.layer, this.target, this.working);
  }

  cancel(): void {
    this.target.set(this.original);
  }
}

/** Working-copy session for overlapping zone memberships. */
export class ZoneAssignmentSession {
  private readonly original = new Map<number, number[]>();
  private readonly working = new Map<number, Set<number>>();

  constructor(
    private readonly zones: Zone[],
    zoneIds: readonly number[]
  ) {
    for (const zoneId of zoneIds) {
      const cells = zones.find(zone => zone.i === zoneId)?.cells ?? [];
      this.original.set(zoneId, [...cells]);
      this.working.set(zoneId, new Set(cells));
    }
  }

  getZoneIdsAtCell(cellId: number): number[] {
    return [...this.working].filter(([, cells]) => cells.has(cellId)).map(([zoneId]) => zoneId);
  }

  paint(zoneId: number, cellIds: readonly number[], erase: boolean): EditorMutationResult {
    const cells = this.working.get(zoneId);
    if (!cells) return emptyZoneMutation();
    for (const cellId of cellIds) erase ? cells.delete(cellId) : cells.add(cellId);
    return setZoneCells(this.zones, zoneId, [...cells]);
  }

  commit(): EditorMutationResult {
    const finalCells = new Map([...this.working].map(([zoneId, cells]) => [zoneId, [...cells]]));
    this.restore(this.original);
    return this.apply(finalCells);
  }

  cancel(): void {
    this.restore(this.original);
  }

  private apply(assignments: Map<number, number[]>): EditorMutationResult {
    return mergeZoneMutations(
      [...assignments].map(([zoneId, cells]) => setZoneCells(this.zones, zoneId, cells))
    );
  }

  private restore(assignments: Map<number, number[]>): void {
    for (const [zoneId, cells] of assignments) setZoneCells(this.zones, zoneId, cells);
  }
}

export function selectTerritoryEditorRow(root: ParentNode, row: HTMLElement | null): void {
  root.querySelector<HTMLElement>("div.selected")?.classList.remove("selected");
  row?.classList.add("selected");
}

function cloneAssignments(assignments: TypedArray): TypedArray {
  return assignments.slice() as TypedArray;
}

function emptyZoneMutation(): EditorMutationResult {
  return { affectedCellIds: [], affectedDomainIds: [], changed: false, layers: ["zones"] };
}

function mergeZoneMutations(mutations: EditorMutationResult[]): EditorMutationResult {
  return {
    affectedCellIds: [...new Set(mutations.flatMap(mutation => mutation.affectedCellIds))],
    affectedDomainIds: [...new Set(mutations.flatMap(mutation => mutation.affectedDomainIds))],
    changed: mutations.some(mutation => mutation.changed),
    layers: ["zones"]
  };
}
