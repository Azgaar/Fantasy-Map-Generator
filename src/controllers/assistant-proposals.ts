import { refreshEditors } from "@/components/dialog/dialog-helpers";
import { Layers } from "@/components/layers";
import { type EntityType, MapEntities } from "@/components/map-entities";
import { Controllers } from "@/controllers";
import type { ChangeRow, Proposal } from "@/services/assistant/chats";
import { OPERATIONS, runOperation } from "./assistant-operations";

// Preview → Apply → Undo for batches of registered operations. See docs/prd/assistant.md

type Batch = Proposal["operations"];
type Side = "before" | "after";
export type Action = "apply" | "undo" | "redo";
type Item = { i: number } & Record<string, unknown>;
type Cells = Record<number, unknown>;

/** Entity collections a proposal records, keyed by `i`. Indexed ones keep `i` equal to the array index */
const COLLECTIONS: [EntityType, () => Item[] | undefined, boolean][] = [
  ["burg", () => pack.burgs as unknown as Item[], true],
  ["state", () => pack.states as unknown as Item[], true],
  ["province", () => pack.provinces as unknown as Item[], true],
  ["culture", () => pack.cultures as unknown as Item[], true],
  ["religion", () => pack.religions as unknown as Item[], true],
  ["biome", () => pack.biomes as unknown as Item[], true],
  ["feature", () => pack.features as unknown as Item[], true],
  ["marker", () => pack.markers as unknown as Item[], false],
  ["zone", () => pack.zones as unknown as Item[], false],
  ["river", () => pack.rivers as unknown as Item[], false],
  ["route", () => pack.routes as unknown as Item[], false],
  ["addedLabel", () => pack.addedLabels as unknown as Item[], false],
  ["journey", () => pack.journeys as unknown as Item[], false],
  ["market", () => pack.markets as unknown as Item[], false],
  ["good", () => pack.goods as unknown as Item[], false]
];

/** Per-cell data a proposal records; a change to any of them is one row per field */
const CELL_FIELDS = [
  "burg",
  "state",
  "province",
  "culture",
  "religion",
  "biome",
  "pop",
  "r",
  "fl",
  "conf",
  "routes"
] as const;
const CELLS = "cells";

/** Single objects a proposal records by key, compared field by field */
const RECORDS: Record<string, { get: () => Record<string, unknown> | undefined; label: string }> = {
  lore: { get: () => globalThis.options?.map.lore as unknown as Record<string, unknown> | undefined, label: "Map lore" }
};

const collectionOf = (type: string) => COLLECTIONS.find(([name]) => name === type);
const isItem = (value: unknown): value is Item =>
  typeof value === "object" && value !== null && Number.isInteger((value as Item).i);
const cellData = (field: string) => (pack.cells as unknown as Record<string, Cells | undefined> | undefined)?.[field];

/** `{ result: n }` in args stands for what operation n (0-based) of the same batch returned, such as a new id;
 * `{ result: n, type: "burg" }` stands for its key, such as "burg:12" */
function resolve(arg: unknown, results: unknown[]): unknown {
  if (Array.isArray(arg)) return arg.map(item => resolve(item, results));
  if (!isContainer(arg) || !Number.isInteger(arg.result)) return arg;
  const { result: n, type, ...rest } = arg as { result: number; type?: unknown };
  if (Object.keys(rest).length || (type !== undefined && typeof type !== "string")) return arg;
  if (n < 0 || n >= results.length)
    throw new Error(`{ result: ${n} } must name an earlier operation of the batch, counted from 0`);
  if (results[n] === undefined) throw new Error(`Operation ${n} returns nothing to refer to`);
  return type === undefined ? results[n] : `${type}:${results[n]}`;
}

function parse(operations: unknown): Batch | string {
  if (!Array.isArray(operations) || !operations.length) return "Propose at least one operation";
  const batch: Batch = [];
  for (const item of operations) {
    const { op, args = [] } = (item ?? {}) as { op?: unknown; args?: unknown };
    if (typeof op !== "string" || !Object.hasOwn(OPERATIONS, op))
      return `Unknown operation ${JSON.stringify(op)}. Registered operations: ${Object.keys(OPERATIONS).join(", ")}`;
    if (!Array.isArray(args)) return `The args of ${op} must be a list, in the order of its parameters`;
    batch.push({ op, args });
  }
  return batch;
}

interface Snapshot {
  items: Map<string, Map<number, Item>>;
  cells: Map<string, Cells>;
  records: Map<string, Record<string, unknown>>;
}

function snapshot(): Snapshot {
  const items = new Map<string, Map<number, Item>>();
  for (const [type, list] of COLLECTIONS)
    items.set(type, new Map((list() ?? []).filter(isItem).map(item => [item.i, structuredClone(item)])));
  const cells = new Map<string, Cells>();
  for (const field of CELL_FIELDS) {
    const data = cellData(field);
    if (data)
      cells.set(field, ArrayBuffer.isView(data) ? (data as unknown as Uint32Array).slice() : structuredClone(data));
  }
  const records = new Map<string, Record<string, unknown>>();
  for (const [key, { get }] of Object.entries(RECORDS)) {
    const record = get();
    if (record) records.set(key, structuredClone(record));
  }
  return { items, cells, records };
}

const isContainer = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !ArrayBuffer.isView(value);
const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

/** Changed paths between two values; records and same-length arrays are compared field by field */
function diff(
  before: unknown,
  after: unknown,
  path: string[] = []
): { field: string; before: unknown; after: unknown }[] {
  const nested =
    isContainer(before) &&
    isContainer(after) &&
    Array.isArray(before) === Array.isArray(after) &&
    (!Array.isArray(before) || before.length === (after as unknown as unknown[]).length);
  if (nested)
    return [...new Set([...Object.keys(before), ...Object.keys(after)])].flatMap(field =>
      diff(before[field], after[field], [...path, field])
    );
  return same(before, after) ? [] : [{ field: path.join("."), before, after: structuredClone(after) }];
}

function compare({ items, cells, records }: Snapshot): Omit<ChangeRow, "entity">[] {
  const rows: Omit<ChangeRow, "entity">[] = [];
  for (const [type, list] of COLLECTIONS) {
    const copies = items.get(type)!;
    const live = new Map((list() ?? []).filter(isItem).map(item => [item.i, item]));
    for (const i of new Set([...copies.keys(), ...live.keys()])) {
      const key = `${type}:${i}`;
      const [before, after] = [copies.get(i), live.get(i)];
      if (!before || !after) rows.push({ key, field: "", before, after: structuredClone(after) });
      else for (const row of diff(before, after)) rows.push({ key, ...row });
    }
  }
  for (const [field, copy] of cells) {
    const data = cellData(field) ?? {};
    const before: Cells = {};
    const after: Cells = {};
    const indexes = ArrayBuffer.isView(copy)
      ? Array.from(copy as unknown as ArrayLike<number>, (_, index) => index)
      : [...new Set([...Object.keys(copy), ...Object.keys(data)])].map(Number);
    for (const index of indexes) {
      if (copy[index] === data[index] || same(copy[index], data[index])) continue;
      before[index] = copy[index];
      after[index] = structuredClone(data[index]);
    }
    if (Object.keys(after).length) rows.push({ key: CELLS, field, before, after });
  }
  for (const [key, copy] of records) for (const row of diff(copy, RECORDS[key].get())) rows.push({ key, ...row });
  return rows;
}

function find(key: string): { list: Item[]; indexed: boolean; i: number; item: Item | undefined } | undefined {
  const [type, id] = key.split(":");
  const collection = collectionOf(type);
  const list = collection?.[1]();
  if (!collection || !list) return undefined;
  const i = Number(id);
  const item = isItem(list[i]) && list[i].i === i ? list[i] : list.find(entry => isItem(entry) && entry.i === i);
  return { list, indexed: collection[2], i, item };
}

function read(row: ChangeRow, side: Side): boolean {
  const expected = row[side];
  if (row.key === CELLS) {
    const data = cellData(row.field);
    return Boolean(data) && Object.entries(expected as Cells).every(([cell, value]) => same(data![+cell], value));
  }
  const record = RECORDS[row.key]?.get();
  const found = RECORDS[row.key] ? undefined : find(row.key);
  if (!record && !found) return false;
  if (!row.field) return same(found?.item, expected);
  const root = record ?? found?.item;
  if (!root) return false;
  const value = row.field.split(".").reduce<unknown>((node, key) => (isContainer(node) ? node[key] : undefined), root);
  return same(value, expected);
}

function write(row: ChangeRow, side: Side): void {
  const value = row[side];
  if (row.key === CELLS) {
    const data = cellData(row.field)!;
    for (const [cell, next] of Object.entries(value as Cells)) {
      if (next === undefined) delete data[+cell];
      else data[+cell] = structuredClone(next);
    }
    return;
  }
  const record = RECORDS[row.key]?.get();
  const { list, i, item } = record ? { list: [] as Item[], i: 0, item: record as unknown as Item } : find(row.key)!;
  if (!row.field) {
    if (item) list.splice(list.indexOf(item), 1);
    if (value === undefined) return;
    const at = list.findIndex(entry => isItem(entry) && entry.i > i);
    list.splice(at < 0 ? list.length : at, 0, structuredClone(value) as Item);
    return;
  }
  const keys = row.field.split(".");
  const last = keys.pop()!;
  let node = item as Record<string, unknown>;
  for (const key of keys) {
    if (!isContainer(node[key])) node[key] = {};
    node = node[key] as Record<string, unknown>;
  }
  if (value === undefined) delete node[last];
  else node[last] = structuredClone(value);
}

/** Every row holds `from`, and removing an item of an indexed collection never shifts the items after it */
function holds(change: ChangeRow[], from: Side): boolean {
  const to = from === "before" ? "after" : "before";
  const removed = new Set(change.filter(row => !row.field && row[to] === undefined).map(row => row.key));
  return change.every(row => {
    if (!read(row, from)) return false;
    if (row.field || !removed.has(row.key)) return true;
    const { list, indexed, i } = find(row.key)!;
    return (
      !indexed ||
      list.every(entry => !isItem(entry) || entry.i <= i || removed.has(`${row.key.split(":")[0]}:${entry.i}`))
    );
  });
}

/** Rows go forward in order and back in reverse, so added items leave in the order they came */
function put(change: ChangeRow[], side: Side): void {
  const rows = side === "after" ? change : [...change].reverse();
  for (const row of rows) write(row, side);
}

function name(key: string): string {
  const ref = key === CELLS ? undefined : MapEntities.parseKey(key);
  return ref ? MapEntities.getName(ref) : "";
}

function label(key: string, fallback: string): string {
  if (RECORDS[key]) return RECORDS[key].label;
  const ref = key === CELLS ? undefined : MapEntities.parseKey(key);
  if (!ref) return "Cells";
  const { kind } = MapEntities.getDisplay(ref);
  const shown = name(key) || fallback;
  return shown ? `${kind}: ${shown}` : kind;
}

/** Dry run: run the batch on the live map, record what changed, then restore it. All or nothing */
function propose(summary: string, operations: unknown, number: number, mapId: number): Proposal | string {
  const batch = parse(operations);
  if (typeof batch === "string") return batch;
  const copy = snapshot();
  let failure: unknown = null;
  const results: unknown[] = [];
  try {
    for (const { op, args } of batch) results.push(runOperation(op, resolve(args, results) as unknown[]));
  } catch (error) {
    failure = error;
  }
  const rows = compare(copy);
  const names = new Map(rows.map(({ key }) => [key, name(key)])); // added entities are named only while the dry run lasts
  put(rows as ChangeRow[], "before");
  if (failure) return failure instanceof Error ? failure.message : String(failure);
  if (!rows.length) return "These operations change nothing";
  const change = rows.map(({ key, field, before, after }) => ({
    key,
    entity: label(key, names.get(key)!),
    field,
    before,
    after
  }));
  return { number, mapId, summary, operations: batch, change, state: "proposed" };
}

/** Each action needs one side of the change to still hold and writes the other */
const ACTIONS: Record<Action, { from: Proposal["state"]; to: Proposal["state"]; write: Side }> = {
  apply: { from: "proposed", to: "applied", write: "after" },
  undo: { from: "applied", to: "undone", write: "before" },
  redo: { from: "undone", to: "applied", write: "after" }
};

function can(action: Action, proposal: Proposal, mapId: number): boolean {
  const { from, write } = ACTIONS[action];
  const expected = write === "after" ? "before" : "after";
  return proposal.state === from && proposal.mapId === mapId && holds(proposal.change, expected);
}

function run(action: Action, proposal: Proposal, mapId: number): boolean {
  if (!can(action, proposal, mapId)) return false;
  put(proposal.change, ACTIONS[action].write);
  proposal.state = ACTIONS[action].to;
  refresh(proposal);
  return true;
}

function discard(proposal: Proposal): void {
  if (proposal.state === "proposed") proposal.state = "discarded";
}

function refresh(proposal: Proposal): void {
  Layers.draw(...new Set(proposal.operations.flatMap(({ op }) => OPERATIONS[op] ?? [])));
  refreshEditors();
  for (const key of new Set(proposal.change.map(row => row.key))) refreshNameInputs(key);
  if (document.getElementById("notesEditor")) void Controllers.NotesEditor.refresh();
  if (proposal.change.some(({ key }) => RECORDS[key])) {
    Options.save();
    if (document.getElementById("loreEditor")) void Controllers.LoreEditor.refresh();
  }
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

export const Proposals = { propose, can, run, discard };
