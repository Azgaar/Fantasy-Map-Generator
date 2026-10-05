import { MapEntities } from "@/components/map-entities";
import { Styles } from "@/generators/styles";
import type { StylesData } from "@/types/styles";

export type Item = { i: number } & Record<string, unknown>;
export type Cells = Record<number, unknown>;
type Lore = Record<string, unknown>;

/** An entity found by its key, with the list holding it */
export interface Found {
  list: Item[];
  indexed: boolean; // the list keeps each entity at the index of its id
  i: number;
  item: Item | undefined;
}

/** Everything a proposal can change: the map data (`pack`), the map's lore and its style. Either the live map,
 * or a draft copy that a proposal is tried on first */
export class World {
  private constructor(
    readonly pack: typeof globalThis.pack,
    readonly lore: Lore | undefined,
    readonly styles: StylesData | undefined
  ) {}

  static live(): World {
    return new World(globalThis.pack, globalThis.options?.map.lore as unknown as Lore | undefined, globalThis.styles);
  }

  static isItem(value: unknown): value is Item {
    return typeof value === "object" && value !== null && Number.isInteger((value as Item).i);
  }

  /** A copy that is safe to change. Cell geometry, which nothing edits, is shared instead of copied */
  draft(): World {
    const GEOMETRY = new Set(["v", "c", "b", "p"]);
    const { vertices, cells, ...rest } = this.pack;
    const copy = { ...structuredClone(rest), vertices } as typeof globalThis.pack;
    if (cells)
      copy.cells = Object.fromEntries(
        Object.entries(cells).map(([field, data]) => [
          field,
          GEOMETRY.has(field) ? data : ArrayBuffer.isView(data) ? (data as Uint32Array).slice() : structuredClone(data)
        ])
      ) as typeof cells;
    return new World(copy, this.lore && structuredClone(this.lore), this.styles && structuredClone(this.styles));
  }

  /** Run a task as if this world were the live map. The generators read and write the global map, so it is swapped
   * in for the task and the real one is always put back */
  asLive<T>(task: () => T): T {
    const live = World.live();
    this.makeLive();
    try {
      return task();
    } finally {
      live.makeLive();
    }
  }

  /** An entity list by its `pack` field, such as `burgs` */
  items(field: string): Item[] | undefined {
    return MapEntities.list(field, this.pack) as Item[] | undefined;
  }

  /** Per-cell data by its `pack.cells` field, such as `state` */
  cells(field: string): Cells | undefined {
    return (this.pack.cells as unknown as Record<string, Cells | undefined> | undefined)?.[field];
  }

  /** An entity by its key, such as `burg:12` */
  find(key: string): Found | undefined {
    const ref = MapEntities.parseKey(key);
    const collection = MapEntities.collections().find(({ type }) => type === ref?.type);
    const list = collection && this.items(collection.field);
    if (!ref || !collection || !list) return undefined;
    const i = ref.id;
    const atIndex = list[i];
    const item = World.isItem(atIndex) && atIndex.i === i ? atIndex : list.find(e => World.isItem(e) && e.i === i);
    return { list, indexed: collection.indexed, i, item };
  }

  /** The entity is on the map and not marked removed */
  exists(key: string): boolean {
    const item = this.find(key)?.item;
    return Boolean(item && !item.removed);
  }

  private makeLive(): void {
    globalThis.pack = this.pack;
    if (this.lore && globalThis.options) globalThis.options.map.lore = this.lore as unknown as typeof options.map.lore;
    if (this.styles) Styles.set(this.styles);
  }
}
