/**
 * world-snapshot.ts — read FMG's live world into a structured-cloneable snapshot.
 *
 * The host's half of the compile pipeline. It touches FMG's globals (so it is the
 * one file in this area that is not engine code) and does as little as possible:
 * it takes *references* to FMG's typed arrays and packages them for transfer. All
 * per-cell work happens in the worker.
 *
 * Note what it does NOT do: it does not copy the arrays into row objects. That is
 * `cellsFromColumns`' job, and doing it here would put ~600k property writes on
 * the main thread — the exact jank this split exists to avoid.
 */

import type { FmgWorldSnapshot } from "../engine/compile/from-fmg";
import { type FmgCells, fmg } from "../ui/fmg";

/** Only these columns are copied: the compiler reads nothing else. */
const COLUMNS = [
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
 * Copy the world out of FMG's globals, or null when no world is loaded.
 *
 * The columns are copied, not borrowed: `postMessage` would otherwise hand the
 * worker *references into FMG's live world*, and a compile triggered while the
 * player edits the map would race FMG's own writes. A copy costs a few
 * megabytes and makes the snapshot immutable, which is the point.
 */
export function snapshotFromFmg(): FmgWorldSnapshot | null {
  const globals = fmg();
  const pack = globals?.pack;
  const graph = globals?.options?.map?.graph;
  if (!pack?.cells?.p || !graph) return null;

  const cells = pack.cells as unknown as Record<string, ArrayLike<number>>;
  const columns: Record<string, ArrayLike<number> | number[][]> = {};
  for (const name of COLUMNS) {
    const column = cells[name];
    if (column) columns[name] = toPlainArray(column);
  }

  const history = globals?.mapHistory;
  const last = history?.length ? history[history.length - 1] : null;
  const info = {
    // FMG's own title carries the version; anything is better than "unknown"
    // because it ends up in the pack's provenance.
    version: /v(\d+\.\d+(\.\d+)?)/.exec(document.title)?.[1] ?? "1.154",
    mapName: (globals?.options?.map?.name as string | undefined) ?? "World",
    seed: last?.seed != null ? String(last.seed) : String(graph.width),
    mapId: Number(last?.created ?? 0),
    width: Number(graph.width),
    height: Number(graph.height)
  };

  return {
    info,
    // These three are FMG's documented defaults (they live in module scope, not in
    // the .map), and the compiler already falls back to them if they are wrong.
    settings: { populationRate: 1000, urbanization: 50, distanceScale: 1 },
    columns,
    burgs: asArray(pack.burgs),
    states: asArray(pack.states),
    provinces: asArray(pack.provinces),
    religions: asArray(pack.religions),
    features: asArray(pack.features),
    biomes: asArray(pack.biomes),
    cultures: asArray(pack.cultures),
    markers: asArray(pack.markers),
    zones: asArray(pack.zones),
    routes: (pack as unknown as { routes?: Record<string, unknown> }).routes ?? {},
    // Azgaar's trade goods, for regional specialties (ECONOMY-PLAN Phase 2).
    // The compiler only reads each good's `biomeOutput`, so a save that never
    // ran Production simply contributes no specialties.
    goods: asArray((pack as unknown as { goods?: unknown[] }).goods),
    // FMG 1.154 does not publish nameBases on the pack; names come from the
    // content pack instead (Phase D), so this is honestly empty rather than faked.
    nameBases: asArray((pack as unknown as { nameBases?: unknown[] }).nameBases)
  };
}

/**
 * Typed array → plain array, so the value survives structured clone unchanged.
 *
 * The shape is preserved exactly, because the columns are not all the same kind:
 *
 *  - `h`, `area`, `pop`, `province`… are flat numeric columns → copy as-is;
 *  - `p` is one `[x, y]` pair per cell, and `c` / `v` are one *list* per cell
 *    (neighbour ids, vertex ids).
 *
 * Flattening the second group would turn `c` into a single run of numbers, and
 * the compiler would fail deep inside with "cell.c is not iterable" — a symptom
 * three layers away from this line.
 */
function toPlainArray(column: ArrayLike<number> | number[][]): ArrayLike<number> | number[][] {
  const value: unknown = column;
  if (!Array.isArray(value)) return Array.from(value as ArrayLike<number>);
  const list = value as unknown[];
  if (list.length > 0 && Array.isArray(list[0])) {
    return list.map(entry => Array.from(entry as number[]));
  }
  return list.slice() as number[];
}

function asArray<T>(value: T[] | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

export type { FmgCells };
