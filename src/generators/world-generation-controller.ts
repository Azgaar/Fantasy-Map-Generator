export interface WorldGenerationControllerApi {
  addLakesInDeepDepressions: () => void;
  calculateMapCoordinates: () => void;
  calculateTemperatures: () => void;
  generatePrecipitation: () => void;
  openNearSeaLakes: () => void;
  rankCells: () => void;
  reGraph: () => void;
  showStatistics: () => void;
}

let target: WorldGenerationControllerApi | null = null;

export function bindWorldGenerationController(nextTarget: WorldGenerationControllerApi): () => void {
  target = nextTarget;
  return () => {
    if (target === nextTarget) target = null;
  };
}

export const WorldGenerationController: WorldGenerationControllerApi = {
  addLakesInDeepDepressions: () => target?.addLakesInDeepDepressions(),
  calculateMapCoordinates: () => target?.calculateMapCoordinates(),
  calculateTemperatures: () => target?.calculateTemperatures(),
  generatePrecipitation: () => target?.generatePrecipitation(),
  openNearSeaLakes: () => target?.openNearSeaLakes(),
  rankCells: () => target?.rankCells(),
  reGraph: () => target?.reGraph(),
  showStatistics: () => target?.showStatistics()
};
