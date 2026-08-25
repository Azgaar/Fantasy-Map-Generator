import type { RegenerateOptions } from "@/components/options/options-controller";
import { requireWorkspaceCapability } from "./workspace-mode";

export interface ApplicationControllerApi {
  focusOn: () => void;
  generateMapOnLoad: () => Promise<void>;
  regenerateMap: (config?: string | RegenerateOptions) => void;
  undraw: () => void;
}

let target: ApplicationControllerApi | null = null;

export function bindApplicationController(nextTarget: ApplicationControllerApi): () => void {
  target = nextTarget;
  return () => {
    if (target === nextTarget) target = null;
  };
}

export const ApplicationController: ApplicationControllerApi = {
  focusOn: () => target?.focusOn(),
  generateMapOnLoad: () => target?.generateMapOnLoad() ?? Promise.resolve(),
  regenerateMap: config => {
    if (!requireWorkspaceCapability("map:generate")) return;
    target?.regenerateMap(config);
  },
  undraw: () => target?.undraw()
};
