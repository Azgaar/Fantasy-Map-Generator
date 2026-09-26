/**
 * One icon set: a directory of SVG files under `src/assets/icons/`, loaded as one lazy chunk.
 * Symbol id = `<id>-<file path within the folder, "/" → "-">`; nothing else composes ids.
 * A model declares its sets; `components/icon-sets.ts` loads any of them the same way.
 */
export interface IconSet {
  /** the chunk id and the symbol id prefix */
  id: string;
  /** the directory under `src/assets/icons/` */
  folder: string;
  /** user units per em for art drawn around its anchor: the loader sizes such symbols in em so `<use x y>` draws them at the group's font size */
  em?: number;
  /** symbols for ids the directory has no file for, each drawn through one it has */
  aliases?: (names: readonly string[]) => IconAlias[];
  /** the names a picker offers, when not every file: a relief set offers one variant per type */
  choices?: readonly string[];
}

export interface IconAlias {
  name: string;
  target: string;
}
