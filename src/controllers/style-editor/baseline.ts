// The preset the store is compared with: a row whose value differs from the current preset's is
// "changed" and can be reset to it. The preset must define the path; what it never had is never marked

import { parsePreset } from "@/controllers/style-preset";
import { StylePresetsService } from "@/services/style-presets";
import type { PathSelection, StylesData } from "@/types/styles";

const getPath = (root: unknown, path: string[]): unknown =>
  path.reduce<unknown>((node, key) => (node == null ? undefined : (node as Record<string, unknown>)[key]), root);

/** The store path of a form field: the composed burgIcons form addresses two records, every other
 * relative path hangs off the selection's node */
export function storePath(sel: PathSelection, relative: string[]): string[] {
  if (sel.element === "burgIcons" && relative[0] === "anchors") {
    return ["burgIcons", "anchors", "groups", sel.group ?? "", ...relative.slice(1)];
  }
  return [...sel.path, ...relative];
}

/** What the store holds for a form field */
export const storeValue = (sel: PathSelection, relative: string[]): unknown =>
  getPath(styles, storePath(sel, relative));

export class Baseline {
  // system presets never change; a custom one can be re-saved, so it is read again on every load
  private static cache = new Map<string, Promise<Baseline | undefined>>();

  /** The parsed record of a preset; undefined when the name resolves to another preset or does not parse */
  static load(name: string): Promise<Baseline | undefined> {
    const cached = Baseline.cache.get(name);
    if (cached) return cached;

    const pending = StylePresetsService.load(name).then(({ name: resolved, styles }) => {
      if (resolved !== name) return undefined;
      try {
        const record = parsePreset(styles);
        return record && new Baseline(record);
      } catch (error) {
        ERROR && console.error(`Cannot parse style preset ${name} for comparison`, error);
        return undefined;
      }
    });
    if (StylePresetsService.isSystem(name)) Baseline.cache.set(name, pending);
    return pending;
  }

  private constructor(private readonly record: Readonly<StylesData>) {}

  /** How the store compares with the preset at a path relative to the selection; undefined when the preset
   * does not define it (every container must exist and the leaf must be an own key) */
  diffAt(sel: PathSelection, relative: string[]): { changed: boolean; presetValue: unknown } | undefined {
    const path = storePath(sel, relative);
    const parent = getPath(this.record, path.slice(0, -1));
    if (typeof parent !== "object" || parent === null || !Object.hasOwn(parent, path.at(-1)!)) return undefined;

    const presetValue = (parent as Record<string, unknown>)[path.at(-1)!];
    const current = getPath(styles, path);
    return { changed: JSON.stringify(current ?? null) !== JSON.stringify(presetValue ?? null), presetValue };
  }
}
