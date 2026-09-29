import { refreshEditors } from "@/components/dialog/dialog-helpers";
import { Layers } from "@/components/layers";
import { type EntityRef, MapEntities } from "@/components/map-entities";
import { Controllers } from "@/controllers";
import type { ChangeRow, Proposal } from "@/services/assistant/chats";
import { OPERATIONS } from "./assistant-operations";

// Preview → Apply → Undo for batches of registered operations. See docs/prd/assistant.md

type Batch = Proposal["operations"];
type Entry = { ref: EntityRef; entity: object; copy: object };

function parse(operations: unknown): Batch | string {
  if (!Array.isArray(operations) || !operations.length) return "Propose at least one operation";
  const batch: Batch = [];
  for (const item of operations) {
    const { op, args } = (item ?? {}) as { op?: unknown; args?: unknown };
    if (typeof op !== "string" || !OPERATIONS[op])
      return `Unknown operation ${JSON.stringify(op)}. Registered operations: ${Object.keys(OPERATIONS).join(", ")}`;
    batch.push({ op, args: Array.isArray(args) ? args : [] });
  }
  return batch;
}

/** Copies of every entity the batch may change, by entity key */
function snapshot(batch: Batch): Map<string, Entry> {
  const entries = new Map<string, Entry>();
  const add = (ref: EntityRef, entity: object) =>
    entries.set(MapEntities.key(ref), { ref, entity, copy: structuredClone(entity) });
  for (const { op, args } of batch) {
    for (const touch of OPERATIONS[op].touches) {
      if (touch !== "entity") for (const { ref, entity } of MapEntities.collect(touch)) add(ref, entity);
      else {
        const ref = typeof args[0] === "string" ? MapEntities.parseKey(args[0]) : undefined;
        const entity = ref && MapEntities.get(ref);
        if (ref && entity) add(ref, entity);
      }
    }
  }
  return entries;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value) && !ArrayBuffer.isView(value);
const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

function diff(before: unknown, after: unknown, path: string[] = []): Omit<ChangeRow, "key" | "entity">[] {
  if (isRecord(before) && isRecord(after))
    return [...new Set([...Object.keys(before), ...Object.keys(after)])].flatMap(field =>
      diff(before[field], after[field], [...path, field])
    );
  return same(before, after) ? [] : [{ field: path.join("."), before, after: structuredClone(after) }];
}

function read(entity: object, field: string): unknown {
  return field.split(".").reduce<unknown>((node, key) => (isRecord(node) ? node[key] : undefined), entity);
}

function write(entity: object, field: string, value: unknown): void {
  const keys = field.split(".");
  const last = keys.pop()!;
  let node = entity as Record<string, unknown>;
  for (const key of keys) {
    if (!isRecord(node[key])) node[key] = {};
    node = node[key] as Record<string, unknown>;
  }
  if (value === undefined) delete node[last];
  else node[last] = structuredClone(value);
}

const entityOf = (row: ChangeRow) => {
  const ref = MapEntities.parseKey(row.key);
  return ref && MapEntities.get(ref);
};

const holds = (change: ChangeRow[], side: "before" | "after") =>
  change.every(row => {
    const entity = entityOf(row);
    return entity !== undefined && same(read(entity, row.field), row[side]);
  });

function put(change: ChangeRow[], side: "before" | "after"): void {
  for (const row of change) write(entityOf(row)!, row.field, row[side]);
}

/** Dry run: run the batch on the live map, record what changed, then restore it. All or nothing */
function propose(summary: string, operations: unknown, number: number, mapId: number): Proposal | string {
  const batch = parse(operations);
  if (typeof batch === "string") return batch;
  let entries: Map<string, Entry>;
  try {
    entries = snapshot(batch);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  let failure: unknown = null;
  try {
    for (const { op, args } of batch) OPERATIONS[op].run(...args);
  } catch (error) {
    failure = error;
  }
  const rows = [...entries.values()].flatMap(({ ref, entity, copy }) =>
    diff(copy, entity).map(row => ({ ...row, ref, entity }))
  );
  for (const { entity, field, before } of rows) write(entity, field, before);
  if (failure) return failure instanceof Error ? failure.message : String(failure);
  if (!rows.length) return "These operations change nothing";
  const change = rows.map(({ ref, field, before, after }) => ({
    key: MapEntities.key(ref),
    entity: `${MapEntities.getDisplay(ref).kind} ${MapEntities.getName(ref)}`,
    field,
    before,
    after
  }));
  return { number, mapId, summary, operations: batch, change, state: "proposed" };
}

/** Apply only while every "before" value still holds */
const canApply = (proposal: Proposal, mapId: number) =>
  proposal.state === "proposed" && proposal.mapId === mapId && holds(proposal.change, "before");

/** Undo only while every "after" value still holds */
const canUndo = (proposal: Proposal, mapId: number) =>
  proposal.state === "applied" && proposal.mapId === mapId && holds(proposal.change, "after");

function apply(proposal: Proposal, mapId: number): boolean {
  if (!canApply(proposal, mapId)) return false;
  put(proposal.change, "after");
  proposal.state = "applied";
  refresh(proposal);
  return true;
}

function undo(proposal: Proposal, mapId: number): boolean {
  if (!canUndo(proposal, mapId)) return false;
  put(proposal.change, "before");
  proposal.state = "undone";
  refresh(proposal);
  return true;
}

function discard(proposal: Proposal): void {
  if (proposal.state === "proposed") proposal.state = "discarded";
}

function refresh(proposal: Proposal): void {
  Layers.draw(...new Set(proposal.operations.flatMap(({ op }) => OPERATIONS[op]?.redraw ?? [])));
  refreshEditors();
  for (const key of new Set(proposal.change.map(row => row.key))) refreshNameInputs(key);
  if (document.getElementById("notesEditor")) void Controllers.NotesEditor.refresh();
}

// Entity editors show the name in an input; update it only when that editor shows this entity
function refreshNameInputs(key: string): void {
  const ref = MapEntities.parseKey(key);
  const entity = ref && (MapEntities.get(ref) as { name?: string; fullName?: string } | undefined);
  if (!ref || !entity) return;
  const value = entity.name ?? "";
  if (ref.type === "state" || ref.type === "province") {
    const dialog = document.getElementById(`${ref.type}NameEditor`);
    if (dialog?.dataset[ref.type] !== String(ref.id)) return;
    const short = document.getElementById(`${ref.type}NameEditorShort`) as HTMLInputElement | null;
    const full = document.getElementById(`${ref.type}NameEditorFull`) as HTMLInputElement | null;
    if (short) short.value = value;
    if (full) full.value = entity.fullName ?? value;
  } else {
    const dialog = document.getElementById(`${ref.type}Editor`);
    const input = document.getElementById(`${ref.type}Name`) as HTMLInputElement | null;
    if (dialog?.dataset.entity === key && input) input.value = value;
  }
}

export const Proposals = { propose, canApply, canUndo, apply, undo, discard };
