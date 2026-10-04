// A whole style preset as one operation. Presets are files, so a batch's presets are loaded before it runs
import type { StylesData } from "@/types/styles";

const APPLY = "StylePresets.apply";

class StylePresetOperations {
  private readonly loaded = new Map<string, StylesData>();
  private ensureGroupStyles?: () => void;

  /** Load every preset the operations in a value name, so `apply` needs no wait */
  async preload(value: unknown): Promise<void> {
    const names = new Set<string>();
    const visit = (node: unknown): void => {
      if (Array.isArray(node)) node.forEach(visit);
      else if (node && typeof node === "object") {
        const { op, args } = node as { op?: unknown; args?: unknown };
        if (op === APPLY && Array.isArray(args) && typeof args[0] === "string") names.add(args[0]);
        else Object.values(node).forEach(visit);
      }
    };
    visit(value);
    if (!names.size) return;
    // loaded here, not at the top: they reach the app shell, which the operation registry must not
    const [{ StylePresetsService: service }, { ensureGroupStyles }] = await Promise.all([
      import("@/services/style-presets"),
      import("@/controllers/style-preset")
    ]);
    this.ensureGroupStyles = ensureGroupStyles;
    for (const name of names) {
      const custom = !service.isSystem(name);
      if (custom) this.loaded.delete(name); // Style Saver can overwrite or remove it; system files are fixed
      if (this.loaded.has(name) || (custom && !service.listCustom().includes(name))) continue;
      const { styles, error } = await service.load(name);
      const record = !error && service.parse(styles);
      if (record) this.loaded.set(name, record);
    }
  }

  /** Replace the whole style with a preset's, such as "ancient", keeping the relief density; Styles.setValue after it adjusts the result */
  apply(name: string): void {
    const record = this.loaded.get(name);
    if (!record) throw new Error(`No style preset "${name}"; read_docs(["Styles"]) lists them`);
    const density = styles.relief.options.density; // a new density regenerates the relief, which Undo cannot restore
    Object.assign(styles, structuredClone(record)); // in place: a proposal runs on a draft of this record
    styles.relief.options.density = density;
    this.ensureGroupStyles?.();
  }
}

export const StylePresets = new StylePresetOperations();
