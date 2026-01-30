export interface MapControllerAPI {
  rebuildMap: (seed: string) => void;
  setWaterLevel: (level: number) => void;
}

declare global {
  interface Window {
    MapController: MapControllerAPI;
  }
}

export function initBridge(api: MapControllerAPI) {
  window.MapController = api;
  console.log("MapController API initialized");
}
