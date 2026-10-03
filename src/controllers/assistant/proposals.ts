import { refreshEditors } from "@/components/dialog/dialog-helpers";
import { Layers } from "@/components/layers";
import { MapEntities } from "@/components/map-entities";
import { Options } from "@/components/options-model";
import { Controllers } from "@/controllers";
import type { ChangeRow, Proposal } from "@/services/assistant/chats";
import { errorText } from "@/utils/stringUtils";
import { OPERATIONS, runOperation } from "./operations";
import { layersFor } from "./redraw";

// Preview → Apply → Undo for batches of registered operations. See docs/prd/assistant.md

type Batch = Proposal["operations"];
type Side = "before" | "after";
export type Action = "apply" | "undo" | "redo";
type Item = { i: number } & Record<string, unknown>;
type Cells = Record<number, unknown>;

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

/** The map's lore, recorded field by field under this key */
const LORE = "lore";
const lore = () => globalThis.options?.map.lore as unknown as Record<string, unknown> | undefined;

const itemsOf = (field: string, map = pack) => MapEntities.list(field, map) as Item[] | undefined;
const isItem = (value: unknown): value is Item =>
  typeof value === "object" && value !== null && Number.isInteger((value as Item).i);
const cellData = (field: string, map = pack) =>
  (map.cells as unknown as Record<string, Cells | undefined> | undefined)?.[field];

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
    if (typeof op !== "string" || !OPERATIONS.has(op))
      return `Unknown operation ${JSON.stringify(op)}. Registered operations: ${[...OPERATIONS].join(", ")}`;
    if (!Array.isArray(args)) return `The args of ${op} must be a list, in the order of its parameters`;
    batch.push({ op, args });
  }
  return batch;
}

/** The data operations edit: the pack and the map's lore */
interface World {
  pack: typeof pack;
  lore?: Record<string, unknown>;
}

/** Cell geometry no operation edits, shared with the draft instead of copied */
const GEOMETRY = new Set(["v", "c", "b", "p"]);

/** A copy of the live map for a dry run to write to */
function draft(): World {
  const { vertices, cells, ...rest } = pack;
  const copy = { ...structuredClone(rest), vertices } as typeof pack;
  if (cells)
    copy.cells = Object.fromEntries(
      Object.entries(cells).map(([field, data]) => [
        field,
        GEOMETRY.has(field) ? data : ArrayBuffer.isView(data) ? (data as Uint32Array).slice() : structuredClone(data)
      ])
    ) as typeof cells;
  const record = lore();
  return { pack: copy, lore: record && structuredClone(record) };
}

/** Make a world the one operations see */
function enter(world: World): void {
  globalThis.pack = world.pack;
  if (world.lore && globalThis.options) globalThis.options.map.lore = world.lore as unknown as typeof options.map.lore;
}

const isContainer = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !ArrayBuffer.isView(value);
const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

type Difference = Omit<ChangeRow, "key" | "entity">;

/** Changed paths between two values; records and same-length arrays are compared field by field, a list that only
 * grew at its end records the added items */
function diff(before: unknown, after: unknown, path: string[] = []): Difference[] {
  if (Array.isArray(before) && Array.isArray(after) && after.length > before.length)
    if (before.every((item, index) => same(item, after[index])))
      return [{ field: path.join("."), after: after.slice(before.length), append: true }];
  const nested =
    isContainer(before) &&
    isContainer(after) &&
    Array.isArray(before) === Array.isArray(after) &&
    (!Array.isArray(before) || before.length === (after as unknown as unknown[]).length);
  if (nested)
    return [...new Set([...Object.keys(before), ...Object.keys(after)])].flatMap(field =>
      diff(before[field], after[field], [...path, field])
    );
  return same(before, after) ? [] : [{ field: path.join("."), before: structuredClone(before), after }];
}

/** The recorded differences from the live world to a draft. Before values are copied, as the live map changes later */
function compare(live: World, draft: World): Omit<ChangeRow, "entity">[] {
  const rows: Omit<ChangeRow, "entity">[] = [];
  const byId = (map: typeof pack, field: string) =>
    new Map((itemsOf(field, map) ?? []).filter(isItem).map(item => [item.i, item]));
  for (const { type, field, indexed } of MapEntities.collections()) {
    const [was, now] = [byId(live.pack, field), byId(draft.pack, field)];
    for (const i of new Set([...was.keys(), ...now.keys()])) {
      const key = `${type}:${i}`;
      const [before, after] = [was.get(i), now.get(i)];
      if (!before || !after) {
        const row: Omit<ChangeRow, "entity"> = { key, field: "", before: structuredClone(before), after };
        if (!indexed) {
          // Added items are written in order, so each goes before the next item that was already there; removed
          // ones are restored in reverse, so the very next item is back by then
          const list = itemsOf(field, before ? live.pack : draft.pack)!;
          const following = list.slice(list.indexOf((before ?? after)!) + 1).filter(isItem);
          row.nextId = (before ? following[0] : following.find(item => was.has(item.i)))?.i ?? null;
        }
        rows.push(row);
      } else for (const row of diff(before, after)) rows.push({ key, ...row });
    }
  }
  for (const field of CELL_FIELDS) {
    const [was, now] = [cellData(field, live.pack), cellData(field, draft.pack) ?? {}];
    if (!was) continue;
    const before: Cells = {};
    const after: Cells = {};
    const indexes = ArrayBuffer.isView(was)
      ? Array.from(was as unknown as ArrayLike<number>, (_, index) => index)
      : [...new Set([...Object.keys(was), ...Object.keys(now)])].map(Number);
    for (const index of indexes) {
      if (was[index] === now[index] || same(was[index], now[index])) continue;
      before[index] = structuredClone(was[index]);
      after[index] = now[index];
    }
    if (Object.keys(after).length) rows.push({ key: CELLS, field, before, after });
  }
  if (live.lore) for (const row of diff(live.lore, draft.lore)) rows.push({ key: LORE, ...row });
  return rows;
}

function find(key: string): { list: Item[]; indexed: boolean; i: number; item: Item | undefined } | undefined {
  const ref = MapEntities.parseKey(key);
  const collection = MapEntities.collections().find(({ type }) => type === ref?.type);
  const list = collection && itemsOf(collection.field);
  if (!ref || !collection || !list) return undefined;
  const i = ref.id;
  const item = isItem(list[i]) && list[i].i === i ? list[i] : list.find(entry => isItem(entry) && entry.i === i);
  return { list, indexed: collection.indexed, i, item };
}

function read(row: ChangeRow, side: Side): boolean {
  const expected = row[side];
  if (row.key === CELLS) {
    const data = cellData(row.field);
    return Boolean(data) && Object.entries(expected as Cells).every(([cell, value]) => same(data![+cell], value));
  }
  const found = row.key === LORE ? undefined : find(row.key);
  const root = row.key === LORE ? lore() : found?.item;
  if (!row.field) return Boolean(found) && same(root, expected);
  if (!root) return false;
  const value = row.field.split(".").reduce<unknown>((node, key) => (isContainer(node) ? node[key] : undefined), root);
  if (row.append) return Array.isArray(value) && (side === "before" || lastRun(value, expected as unknown[]) >= 0);
  return same(value, expected);
}

/** Where `items` last stand in a row in `list`, or -1 */
function lastRun(list: unknown[], items: unknown[]): number {
  for (let at = list.length - items.length; at >= 0; at--)
    if (items.every((item, offset) => same(list[at + offset], item))) return at;
  return -1;
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
  const { list, i, item } =
    row.key === LORE ? { list: [] as Item[], i: 0, item: lore() as unknown as Item } : find(row.key)!;
  if (!row.field) {
    if (item) list.splice(list.indexOf(item), 1);
    if (value === undefined) return;
    const at = list.findIndex(
      entry => isItem(entry) && (row.nextId === undefined ? entry.i > i : entry.i === row.nextId)
    );
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
  if (row.append) {
    const [list, items] = [node[last] as unknown[], row.after as unknown[]];
    if (side === "after") list.push(...structuredClone(items));
    else list.splice(lastRun(list, items), items.length);
    return;
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

// `cells` and `lore` are not entity keys, so they parse to nothing
function name(key: string): string {
  const ref = MapEntities.parseKey(key);
  return ref ? MapEntities.getName(ref) : "";
}

function label(key: string, fallback: string): string {
  if (key === LORE) return "Map lore";
  const ref = MapEntities.parseKey(key);
  if (!ref) return "Cells";
  const { kind } = MapEntities.getDisplay(ref);
  const shown = name(key) || fallback;
  return shown ? `${kind}: ${shown}` : kind;
}

/** Dry run on a draft of the map: the live map is never written, so proposing changes nothing. All or nothing */
function propose(summary: string, operations: unknown, number: number, mapId: number): Proposal | string {
  const batch = parse(operations);
  if (typeof batch === "string") return batch;
  const live: World = { pack, lore: lore() };
  const scratch = draft();
  const results: unknown[] = [];
  let rows: Omit<ChangeRow, "entity">[];
  let names: Map<string, string>;
  try {
    enter(scratch);
    for (const { op, args } of batch) results.push(runOperation(op, resolve(args, results) as unknown[]));
    rows = compare(live, scratch);
    names = new Map(rows.map(({ key }) => [key, name(key)])); // added entities are named only in the draft
  } catch (error) {
    return errorText(error);
  } finally {
    enter(live);
  }
  if (!rows.length) return "These operations change nothing";
  const change = rows.map(row => ({ ...row, entity: label(row.key, names.get(row.key)!) }));
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
  Layers.draw(...layersFor(proposal.change));
  refreshEditors();
  for (const key of new Set(proposal.change.map(row => row.key))) refreshNameInputs(key);
  if (document.getElementById("notesEditor")) void Controllers.NotesEditor.refresh();
  if (proposal.change.some(({ key }) => key === LORE)) {
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
