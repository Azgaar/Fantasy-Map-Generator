import type { RegenerateOptions } from "@/components/options/options-controller";

export interface ApplicationControllerApi {
  addLakesInDeepDepressions: () => void;
  calculateMapCoordinates: () => void;
  calculateTemperatures: () => void;
  focusOn: () => void;
  generateMapOnLoad: () => Promise<void>;
  generatePrecipitation: () => void;
  openNearSeaLakes: () => void;
  rankCells: () => void;
  reGraph: () => void;
  regenerateMap: (config?: string | RegenerateOptions) => void;
  showStatistics: () => void;
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
  addLakesInDeepDepressions: () => target?.addLakesInDeepDepressions(),
  calculateMapCoordinates: () => target?.calculateMapCoordinates(),
  calculateTemperatures: () => target?.calculateTemperatures(),
  focusOn: () => target?.focusOn(),
  generateMapOnLoad: () => target?.generateMapOnLoad() ?? Promise.resolve(),
  generatePrecipitation: () => target?.generatePrecipitation(),
  openNearSeaLakes: () => target?.openNearSeaLakes(),
  rankCells: () => target?.rankCells(),
  reGraph: () => target?.reGraph(),
  regenerateMap: config => target?.regenerateMap(config),
  showStatistics: () => target?.showStatistics(),
  undraw: () => target?.undraw()
};
