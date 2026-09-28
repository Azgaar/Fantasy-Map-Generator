/**
 * One icon set: a directory of SVG files under `src/assets/icons/`, loaded as one lazy chunk.
 * Symbol id = `<id>-<file path within the folder, "/" → "-">`; nothing else composes ids.
 * A model declares its sets; `components/icon-sets.ts` loads any of them the same way.
 */
export interface IconSet {
  /** the chunk id and the symbol id prefix; its folder is the id with the first "-" as "/" (`relief-simple` → `relief/simple`) */
  id: string;
  /** the picker heading the set is listed under */
  group: string;
  /** user units per em for art drawn around its anchor: the loader sizes such symbols in em so `<use x y>` draws them at the group's font size */
  em?: number;
  /** symbols for ids the directory has no file for, each drawn through one it has */
  aliases?: (names: readonly string[]) => IconAlias[];
  /** rewrites a file before it becomes a symbol, for art kept in another tool's format */
  prepare?: (svg: string, symbolId: string) => string;
  /** the paint of the art's open fill and stroke where the slot drawing it sets none */
  paint?: IconPaint;
}

/** the fill and stroke an icon's art leaves open, in its own units */
export interface IconPaint {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}

export interface IconAlias {
  name: string;
  target: string;
}
