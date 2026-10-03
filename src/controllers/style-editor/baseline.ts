// The preset the store is compared with: a row whose value differs from the current preset's is
// "changed" and can be reset to it. The preset must define the path; what it never had is never marked

import { StylePresetsService } from "@/services/style-presets";
import type { StylesData } from "@/types/styles";
import { getPath } from "@/utils/objectUtils";

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
        const record = StylePresetsService.parse(styles);
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

  /** How the store compares with the preset at a store path; undefined when the preset does not define it
   * (every container must exist and the leaf must be an own key) */
  diffAt(path: string[]): { changed: boolean; presetValue: unknown } | undefined {
    const parent = getPath(this.record, path.slice(0, -1));
    if (typeof parent !== "object" || parent === null || !Object.hasOwn(parent, path.at(-1)!)) return undefined;

    const presetValue = (parent as Record<string, unknown>)[path.at(-1)!];
    const current = getPath(styles, path);
    return { changed: JSON.stringify(current ?? null) !== JSON.stringify(presetValue ?? null), presetValue };
  }
}
