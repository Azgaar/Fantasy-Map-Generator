import type { LayerId } from "@/components/layers";
import { MapEntities } from "@/components/map-entities";
import type { ChangeRow } from "@/services/assistant/chats";
import { CELL_FIELDS } from "./fields";
import { layersFor } from "./redraw";
import { type Cells, type Item, World } from "./world";

export type Side = "before" | "after";
type Row = Omit<ChangeRow, "entity">;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !ArrayBuffer.isView(value);
const isSame = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

/** Where `items` were last appended to `list`, or -1 */
function findAppended(list: unknown[], items: unknown[]): number {
  for (let at = list.length - items.length; at >= 0; at--)
    if (items.every((item, offset) => isSame(list[at + offset], item))) return at;
  return -1;
}

/** What a proposal changes, as a list of values before and after (see `ChangeRow`). Apply writes the "after" side,
 * Undo the "before" side. Both work from the recorded values alone, without running the operations again */
export class Change {
  static readonly CELLS = "cells"; // the key of per-cell rows
  static readonly LORE = "lore"; // the key of the map's lore rows
  static readonly STYLE = "style"; // the key of the map's style rows, by store path

  /** Entities the change adds or removes, so they may be missing on one side */
  private readonly addedOrRemoved: Set<string>;

  constructor(private readonly rows: readonly ChangeRow[]) {
    this.addedOrRemoved = new Set(rows.filter(row => !row.field || row.field === "removed").map(row => row.key));
  }

  /** Compare the live map with a draft the operations ran on, and record every difference. The before values are
   * copied, because the live map keeps changing */
  static record(live: World, draft: World): Row[] {
    return [
      ...Change.entityRows(live, draft),
      ...Change.cellRows(live, draft),
      ...Change.recordRows(Change.LORE, live, draft),
      ...Change.recordRows(Change.STYLE, live, draft)
    ];
  }

  get keys(): Set<string> {
    return new Set(this.rows.map(row => row.key));
  }

  /** The map layers that draw what the change touches */
  get layers(): LayerId[] {
    return layersFor(this.rows);
  }

  /** The style values the change touches, as store paths */
  get stylePaths(): string[][] {
    return this.rows.filter(row => row.key === Change.STYLE).map(row => row.field.split("."));
  }

  /** The map still shows this side of the change: nobody edited the same values since */
  matches(world: World, side: Side): boolean {
    const otherSide = side === "before" ? "after" : "before";
    const removing = new Set(this.rows.filter(row => !row.field && row[otherSide] === undefined).map(row => row.key));
    return this.rows.every(row => {
      if (!this.rowMatches(world, row, side)) return false;
      if (row.field || !removing.has(row.key)) return true;
      // a list keeping entities at the index of their id can only lose its last ones
      const { list, indexed, i } = world.find(row.key)!;
      const type = row.key.split(":")[0];
      return (
        !indexed || list.every(entry => !World.isItem(entry) || entry.i <= i || removing.has(`${type}:${entry.i}`))
      );
    });
  }

  /** Writing this side breaks no reference between entities. A change that adds or removes entities is checked on a
   * draft it is written to first */
  keepsReferencesIntact(world: World, side: Side): boolean {
    const result = this.addedOrRemoved.size ? this.writtenDraft(world, side) : world;
    const edited = [...this.keys].filter(key => key !== Change.CELLS && !Change.isRecord(key));
    const missing = edited.filter(key => !result.exists(key));
    // an entity the change edits but does not remove is gone: someone removed it since
    if (missing.some(key => !this.addedOrRemoved.has(key))) return false;
    return this.pointsOnlyAtExisting(result, side) && this.nothingPointsAt(result, new Set(missing));
  }

  /** Write one side to the world. Rows go forward in order and back in reverse, so added entities leave in the order
   * they came */
  writeTo(world: World, side: Side): void {
    const rows = side === "after" ? this.rows : [...this.rows].reverse();
    for (const row of rows) this.writeRow(world, row, side);
  }

  // --- recording ---------------------------------------------------------------------------------------------------

  /** Changed fields of every entity, and entities added or removed as whole rows */
  private static entityRows(live: World, draft: World): Row[] {
    const rows: Row[] = [];
    const byId = (world: World, field: string) =>
      new Map((world.items(field) ?? []).filter(World.isItem).map(item => [item.i, item]));
    for (const { type, field, indexed } of MapEntities.collections()) {
      const [was, now] = [byId(live, field), byId(draft, field)];
      for (const i of new Set([...was.keys(), ...now.keys()])) {
        const key = `${type}:${i}`;
        const [before, after] = [was.get(i), now.get(i)];
        if (before && after) {
          for (const row of Change.diff(before, after)) rows.push({ key, ...row });
          continue;
        }
        const row: Row = { key, field: "", before: structuredClone(before), after };
        if (!indexed) {
          // remember the neighbour that follows, so the entity goes back to its place in the drawing order
          const list = (before ? live : draft).items(field)!;
          const following = list.slice(list.indexOf((before ?? after)!) + 1).filter(World.isItem);
          row.nextId = (before ? following[0] : following.find(item => was.has(item.i)))?.i ?? null;
        }
        rows.push(row);
      }
    }
    return rows;
  }

  /** One row per cell field that changed, holding only the cells that changed */
  private static cellRows(live: World, draft: World): Row[] {
    const rows: Row[] = [];
    for (const field of Object.keys(CELL_FIELDS)) {
      const [was, now] = [live.cells(field), draft.cells(field) ?? {}];
      if (!was) continue;
      const before: Cells = {};
      const after: Cells = {};
      const cellIds = ArrayBuffer.isView(was)
        ? Array.from(was as unknown as ArrayLike<number>, (_, cell) => cell)
        : [...new Set([...Object.keys(was), ...Object.keys(now)])].map(Number);
      for (const cell of cellIds) {
        if (isSame(was[cell], now[cell])) continue;
        before[cell] = structuredClone(was[cell]);
        after[cell] = now[cell];
      }
      if (Object.keys(after).length) rows.push({ key: Change.CELLS, field, before, after });
    }
    return rows;
  }

  /** The map's lore or style, recorded field by field */
  private static recordRows(key: string, live: World, draft: World): Row[] {
    const was = Change.recordOf(live, key);
    return was ? Change.diff(was, Change.recordOf(draft, key)).map(row => ({ key, ...row })) : [];
  }

  private static isRecord(key: string): boolean {
    return key === Change.LORE || key === Change.STYLE;
  }

  private static recordOf(world: World, key: string): Record<string, unknown> | undefined {
    return (key === Change.LORE ? world.lore : world.styles) as Record<string, unknown> | undefined;
  }

  /** The paths that differ between two values. Records and same-length lists are compared field by field; a list
   * that only grew at its end records just the added items */
  private static diff(before: unknown, after: unknown, path: string[] = []): Omit<Row, "key">[] {
    if (Array.isArray(before) && Array.isArray(after) && after.length > before.length)
      if (before.every((item, index) => isSame(item, after[index])))
        return [{ field: path.join("."), after: after.slice(before.length), append: true }];
    const bothRecords =
      isRecord(before) &&
      isRecord(after) &&
      Array.isArray(before) === Array.isArray(after) &&
      (!Array.isArray(before) || before.length === (after as unknown as unknown[]).length);
    if (bothRecords)
      return [...new Set([...Object.keys(before), ...Object.keys(after)])].flatMap(field =>
        Change.diff(before[field], after[field], [...path, field])
      );
    return isSame(before, after) ? [] : [{ field: path.join("."), before: structuredClone(before), after }];
  }

  // --- checking ----------------------------------------------------------------------------------------------------

  private rowMatches(world: World, row: ChangeRow, side: Side): boolean {
    const expected = row[side];
    if (row.key === Change.CELLS) {
      const data = world.cells(row.field);
      return Boolean(data) && Object.entries(expected as Cells).every(([cell, value]) => isSame(data![+cell], value));
    }
    const found = Change.isRecord(row.key) ? undefined : world.find(row.key);
    const root = Change.isRecord(row.key) ? Change.recordOf(world, row.key) : found?.item;
    if (!row.field) return Boolean(found) && isSame(root, expected);
    if (!root) return false;
    const value = row.field.split(".").reduce<unknown>((node, key) => (isRecord(node) ? node[key] : undefined), root);
    if (row.append)
      return Array.isArray(value) && (side === "before" || findAppended(value, expected as unknown[]) >= 0);
    return isSame(value, expected);
  }

  private writtenDraft(world: World, side: Side): World {
    const draft = world.draft();
    this.writeTo(draft, side);
    return draft;
  }

  /** Every id this side writes points at an entity that exists, such as a burg's new culture */
  private pointsOnlyAtExisting(world: World, side: Side): boolean {
    const exists = (key: string) => world.exists(key);
    return this.rows.every(row => {
      const value = row[side];
      if (Change.isRecord(row.key)) return true;
      if (row.key === Change.CELLS)
        return Object.values(value as Cells).every(id =>
          Change.everyId(CELL_FIELDS[row.field]?.references, id, exists)
        );
      if (!world.exists(row.key)) return true; // removed by this change
      const type = row.key.split(":")[0];
      const fields = row.field ? [[row.field.split(".")[0], value] as const] : Object.entries(value as Item);
      return fields.every(([field, id]) => Change.everyId(MapEntities.referenceType(type, field), id, exists));
    });
  }

  /** No entity or cell left on the map refers to one the change removed, such as a burg of a removed culture */
  private nothingPointsAt(world: World, removed: Set<string>): boolean {
    if (!removed.size) return true;
    const kept = (key: string) => !removed.has(key);
    for (const { field, references = {} } of MapEntities.collections()) {
      const refs = Object.entries(references);
      if (!refs.length) continue;
      for (const item of world.items(field) ?? []) {
        if (!World.isItem(item) || item.removed) continue;
        if (!refs.every(([field, type]) => Change.everyId(type, item[field], kept))) return false;
      }
    }
    return Object.entries(CELL_FIELDS).every(
      ([field, { references }]) =>
        !references || Object.values(world.cells(field) ?? {}).every(id => Change.everyId(references, id, kept))
    );
  }

  /** Every id in a value (one id or a list) passes the test as `type:id`; 0 and non-ids are no reference */
  private static everyId(type: string | undefined, value: unknown, test: (key: string) => boolean): boolean {
    if (!type) return true;
    if (Array.isArray(value)) return value.every(id => Change.everyId(type, id, test));
    return !value || typeof value !== "number" || test(`${type}:${value}`);
  }

  // --- writing -----------------------------------------------------------------------------------------------------

  private writeRow(world: World, row: ChangeRow, side: Side): void {
    const value = row[side];
    if (row.key === Change.CELLS) {
      const data = world.cells(row.field)!;
      for (const [cell, next] of Object.entries(value as Cells)) {
        if (next === undefined) delete data[+cell];
        else data[+cell] = structuredClone(next);
      }
      return;
    }
    const { list, i, item } = Change.isRecord(row.key)
      ? { list: [] as Item[], i: 0, item: Change.recordOf(world, row.key) as Item }
      : world.find(row.key)!;

    if (!row.field) {
      // a whole entity: take it out, then put the recorded one back in its place
      if (item) list.splice(list.indexOf(item), 1);
      if (value === undefined) return;
      const at = list.findIndex(
        entry => World.isItem(entry) && (row.nextId === undefined ? entry.i > i : entry.i === row.nextId)
      );
      list.splice(at < 0 ? list.length : at, 0, structuredClone(value) as Item);
      return;
    }

    const path = row.field.split(".");
    const last = path.pop()!;
    let node = item as Record<string, unknown>;
    for (const key of path) {
      if (!isRecord(node[key])) node[key] = {};
      node = node[key] as Record<string, unknown>;
    }
    if (row.append) {
      const [list, items] = [node[last] as unknown[], row.after as unknown[]];
      if (side === "after") list.push(...structuredClone(items));
      else list.splice(findAppended(list, items), items.length);
      return;
    }
    if (value === undefined) delete node[last];
    else node[last] = structuredClone(value);
  }
}
