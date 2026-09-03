// The options store: what this browser wants, and nothing else.
// See docs/architecture/configuration.md
import { getDefaultOptions, type OptionsData } from "@/components/options-schema";

export type { OptionsData } from "@/components/options-schema";
export { CELLS_BY_DENSITY, DEFAULT_DENSITY, STORAGE_KEY } from "@/components/options-schema";

declare global {
  /** this browser's options, read bare across the app and replaced wholesale on restore */
  var options: OptionsData;
}

globalThis.options = getDefaultOptions();
