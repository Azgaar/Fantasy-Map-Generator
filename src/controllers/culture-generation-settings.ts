import type { CultureGenerationSettings } from "@/generators/cultures-generator";
import { ensureEl } from "@/utils/nodeUtils";

/** Reads culture controls at the UI boundary for generator calls. */
export function getCultureGenerationSettings(): CultureGenerationSettings {
  return {
    emblemShape: ensureEl<HTMLSelectElement>("emblemShape").value
  };
}

declare global {
  // biome-ignore lint/suspicious/noRedeclare: exposed for the classic generation pipeline
  var getCultureGenerationSettings: () => CultureGenerationSettings;
}

window.getCultureGenerationSettings = getCultureGenerationSettings;
