import type { StateExpansionSettings } from "@/generators/states-generator";
import { ensureEl, findEl } from "@/utils/nodeUtils";

/** Reads state-growth controls at the UI boundary instead of inside the generator. */
export function getStateExpansionSettings(): StateExpansionSettings {
  return {
    globalGrowthRate: ensureEl<HTMLInputElement>("growthRate").valueAsNumber || 1,
    statesGrowthRate: findEl<HTMLInputElement>("statesGrowthRate")?.valueAsNumber || 1
  };
}

declare global {
  // biome-ignore lint/suspicious/noRedeclare: exposed for the classic generation pipeline
  var getStateExpansionSettings: () => StateExpansionSettings;
}

window.getStateExpansionSettings = getStateExpansionSettings;
