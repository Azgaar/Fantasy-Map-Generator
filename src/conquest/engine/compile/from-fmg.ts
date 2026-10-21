/**
 * from-fmg.ts — FMG's columnar world → the compiler's row-per-cell input.
 *
 * This is the adapter the overlay used to carry in `fmg-shell.js`
 * (`cellsFromColumns` + `fmgWorldPayload`), promoted here as the canonical one.
 * It is the *only* place that knows FMG stores cells struct-of-arrays; everything
 * downstream of it speaks the plain row shape FMG's own "Export to JSON" produces.
 *
 * It runs where the data is expensive, not where it is convenient: on 20k cells ×
 * ~30 columns, spreading the columns back into objects is the single most
 * expensive thing in the whole pipeline, which is why `compileInPage` hands the
 * raw columns to a Worker and calls `azgaarMapFromSnapshot` *inside* it. The
 * snapshot crossing the boundary is a structured clone of typed arrays — a few
 * megabytes, no per-cell work on the main thread.
 */

import { canonicalHash } from "../common/prng";
import type {
  AzgaarBurg,
  AzgaarCell,
  AzgaarMap,
  AzgaarProvince,
  AzgaarReligion,
  AzgaarState
} from "../compiler/azgaar";

/**
 * A world's worth of FMG globals, structured-cloneable.
 *
 * Deliberately *not* `AzgaarMap`: this is the cheap thing to build (references
 * to data FMG already holds) and the expensive thing to consume. The conversion
 * is the worker's job.
 */
export interface FmgWorldSnapshot {
  info: AzgaarMap["info"];
  settings: AzgaarMap["settings"];
  /**
   * FMG's `pack.cells`: column name → column.
   *
   * Deliberately heterogeneous: most columns are one scalar per cell, but `p` is
   * one `[x, y]` pair and `c` / `v` are one *list* per cell. Both shapes travel;
   * `cellsFromColumns` copies whichever it finds.
   */
  columns: Record<string, ArrayLike<number> | number[][]>;
  burgs: unknown[];
  states: unknown[];
  provinces: unknown[];
  religions: unknown[];
  features: unknown[];
  biomes: unknown[];
  cultures: unknown[];
  markers: unknown[];
  zones: unknown[];
  routes: Record<string, unknown>;
  /**
   * `pack.goods` — Azgaar's trade goods (ECONOMY-PLAN Phase 2). Absent on very
   * old saves; the compiler then reports no regional specialties rather than
   * failing, consistent with the honest-zeros policy above.
   */
  goods?: unknown[];
  nameBases: unknown[];
}

/** Columns the compiler reads. A column missing from FMG's pack reads as 0. */
const REQUIRED_COLUMNS = [
  "v",
  "c",
  "p",
  "h",
  "area",
  "f",
  "haven",
  "harbor",
  "fl",
  "r",
  "biome",
  "s",
  "pop",
  "culture",
  "burg",
  "state",
  "religion",
  "province",
  "g"
] as const;

/**
 * Spread FMG's struct-of-arrays back into one record per cell.
 *
 * Exported because it is genuinely reusable (the overlay's own copy is identical
 * in behaviour) and because it is the hot loop worth testing on its own.
 */
export function cellsFromColumns(columns: Record<string, ArrayLike<number> | number[][]>): Record<string, AzgaarCell> {
  const names = Object.keys(columns);
  const count = columns.v ? columns.v.length : 0;
  const cells: Record<string, AzgaarCell> = {};
  for (let id = 0; id < count; id++) {
    const row: Record<string, unknown> = {};
    for (const name of names) row[name] = columnValue(columns[name]![id]);
    row.i = id;
    cells[id] = row as unknown as AzgaarCell;
  }
  return cells;
}

/**
 * One column value, normalised for the row shape.
 *
 * Column values are scalars today. If FMG ever adds a list-valued column (a
 * neighbour ring, say), convert it so JSON.stringify emits [1,2,3] rather than
 * {"0":1,"1":2} — which would silently change the compiler's view of the world.
 */
function columnValue(value: number | number[]): number | number[] {
  const asArray = value as unknown as ArrayLike<number>;
  if (typeof value === "string" || asArray == null || typeof asArray.length !== "number") return value;
  return Array.from(asArray);
}

/**
 * A snapshot → the compiler's input.
 *
 * Missing columns and absent entities are filled with honest zeros rather than
 * throwing: a mod that cannot compile an unusual FMG save should say so once, in
 * one place, instead of failing deep inside the compiler.
 */
export function azgaarMapFromSnapshot(snapshot: FmgWorldSnapshot): AzgaarMap {
  const columns: Record<string, ArrayLike<number> | number[][]> = { ...snapshot.columns };
  for (const name of REQUIRED_COLUMNS) if (!columns[name]) columns[name] = [];

  return {
    info: snapshot.info,
    settings: snapshot.settings,
    pack: {
      cells: cellsFromColumns(columns) as unknown as Record<string, AzgaarCell>,
      features: byId(snapshot.features),
      biomes: snapshot.biomes as AzgaarMap["pack"]["biomes"],
      cultures: snapshot.cultures as AzgaarMap["pack"]["cultures"],
      burgs: snapshot.burgs as AzgaarMap["pack"]["burgs"],
      states: snapshot.states as AzgaarMap["pack"]["states"],
      provinces: snapshot.provinces as AzgaarMap["pack"]["provinces"],
      religions: snapshot.religions as AzgaarMap["pack"]["religions"],
      routes: snapshot.routes as AzgaarMap["pack"]["routes"],
      markers: snapshot.markers as AzgaarMap["pack"]["markers"],
      zones: snapshot.zones as AzgaarMap["pack"]["zones"],
      goods: (snapshot.goods ?? []) as AzgaarMap["pack"]["goods"]
    },
    nameBases: snapshot.nameBases as AzgaarMap["nameBases"]
  };
}

/** FMG ships entity arrays indexed by id, with `0` as the empty slot. */
function byId<T>(list: unknown[]): Record<string, T> {
  const out: Record<string, T> = {};
  for (const entry of list) {
    if (!entry) continue;
    const id = (entry as { i?: number }).i;
    if (typeof id === "number") out[id] = entry as T;
  }
  return out;
}

/** The entities the compiler reads, re-exported so callers need not reach into azgaar.ts. */
export type { AzgaarBurg, AzgaarProvince, AzgaarReligion, AzgaarState };

/**
 * A compact structural signature of the FMG world.
 *
 * Structural = changes the compiled pack's topology, identity sets or
 * assignment that can make a campaign's command log diverge (E2). Cosmetic
 * changes (labels, styles, visibility) do not change this.
 */
export function structuralSignature(snapshot: FmgWorldSnapshot): string {
  const columns = snapshot.columns ?? {};
  const cellCount = Array.isArray(columns.v) ? columns.v.length : 0;
  let vertexCount = 0;
  if (cellCount > 0) {
    const vcol = columns.v as unknown[];
    for (let i = 0; i < vcol.length; i++) {
      const verts = vcol[i];
      if (Array.isArray(verts)) vertexCount += verts.length;
    }
  }
  const countIf = (arr: unknown[] | undefined | null): number => (Array.isArray(arr) ? arr.length : 0);
  let ringCount = 0;
  if (cellCount > 0) {
    const ccol = columns.c as unknown[] | undefined;
    if (Array.isArray(ccol)) {
      for (let i = 0; i < ccol.length; i++) {
        const ring = ccol[i];
        if (Array.isArray(ring)) ringCount += ring.length;
      }
    }
  }
  let pointsCount = 0;
  if (cellCount > 0) {
    const pcol = columns.p as unknown[] | undefined;
    if (Array.isArray(pcol)) {
      for (let i = 0; i < pcol.length; i++) {
        const pt = pcol[i];
        if (Array.isArray(pt)) pointsCount += (pt as ArrayLike<number>).length;
      }
    }
  }

  // The core arrays that drive compilation and assignment.
  const strips: unknown[] = [];
  const pushScalar = (name: keyof typeof columns) => {
    const col = columns[name];
    if (Array.isArray(col)) strips.push(col.length, ...col);
  };
  const pushArrays = (name: keyof typeof columns) => {
    const col = columns[name] as unknown[] | undefined;
    if (!Array.isArray(col)) return;
    strips.push(col.length);
    for (const item of col) {
      if (Array.isArray(item)) strips.push(item.length, ...item);
      else strips.push(item ?? 0);
    }
  };
  const pushEntities = (list: unknown[] | undefined) => {
    if (!Array.isArray(list)) return strips.push(0);
    strips.push(list.length);
    for (const entity of list) {
      if (!entity || typeof entity !== "object") continue;
      // id is the identity; a few fields that affect assignment/topology.
      const e = entity as Record<string, unknown>;
      strips.push(e.i ?? e.id ?? 0);
      if ("cells" in e && Array.isArray(e.cells)) strips.push(e.cells.length, ...e.cells.slice(0, 64));
      if ("state" in e) strips.push(e.state ?? 0);
      if ("province" in e) strips.push(e.province ?? 0);
      if ("culture" in e) strips.push(e.culture ?? 0);
      if ("religion" in e) strips.push(e.religion ?? 0);
      if ("type" in e) strips.push(typeof e.type === "number" ? e.type : ((e.type as string)?.length ?? 0));
    }
  };

  pushScalar("h");
  pushScalar("biome");
  pushScalar("s");
  pushScalar("pop");
  pushScalar("culture");
  pushScalar("burg");
  pushScalar("state");
  pushScalar("religion");
  pushScalar("province");
  pushArrays("p");
  pushArrays("v");
  pushArrays("c");

  pushEntities(snapshot.burgs);
  pushEntities(snapshot.states);
  pushEntities(snapshot.provinces);
  pushEntities(snapshot.cultures);
  pushEntities(snapshot.religions);
  pushEntities(snapshot.features);

  strips.unshift(
    cellCount,
    vertexCount,
    ringCount,
    pointsCount,
    countIf(snapshot.features),
    countIf(snapshot.biomes),
    countIf(snapshot.cultures),
    countIf(snapshot.burgs),
    countIf(snapshot.states),
    countIf(snapshot.provinces),
    countIf(snapshot.religions)
  );

  return canonicalHash(strips);
}
