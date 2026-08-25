export interface ViewSessionState {
  layerVisibility: ReadonlyMap<string, boolean>;
}

let layerVisibility: Map<string, boolean> | null = null;
const layerOverrides = new Map<string, boolean>();

export function startViewSession(initialLayerVisibility: ReadonlyMap<string, boolean>): void {
  layerVisibility = new Map(initialLayerVisibility);
  layerOverrides.clear();
}

export function isViewSessionActive(): boolean {
  return layerVisibility !== null;
}

export function setViewSessionLayerVisibility(layerId: string, visible: boolean): void {
  if (!layerVisibility) return;
  if (layerVisibility.get(layerId) === visible) layerOverrides.delete(layerId);
  else layerOverrides.set(layerId, visible);
}

export function getEffectiveLayerVisibility(layerId: string, documentVisibility: boolean): boolean {
  return layerOverrides.get(layerId) ?? documentVisibility;
}

export function getDocumentLayerVisibility(layerId: string, fallback: boolean): boolean {
  return layerVisibility?.get(layerId) ?? fallback;
}

export function getViewSessionState(): ViewSessionState | null {
  return layerVisibility ? { layerVisibility: new Map(layerVisibility) } : null;
}

export function endViewSession(restoreLayerVisibility: (layerId: string, visible: boolean) => void): void {
  if (layerVisibility) {
    for (const [layerId, visible] of layerVisibility) restoreLayerVisibility(layerId, visible);
  }
  layerOverrides.clear();
  layerVisibility = null;
}

export function resetViewSessionForTests(): void {
  layerOverrides.clear();
  layerVisibility = null;
}
