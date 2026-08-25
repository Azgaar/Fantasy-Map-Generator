export interface ViewSessionState {
  layerOrder: readonly string[];
  layerVisibility: ReadonlyMap<string, boolean>;
  selection: ViewSessionSelection | null;
}

export interface ViewSessionSelection {
  cellId: number;
  domainId?: string;
  domainKind?: string;
}

let layerVisibility: Map<string, boolean> | null = null;
let layerOrder: string[] | null = null;
let selection: ViewSessionSelection | null = null;
const layerOverrides = new Map<string, boolean>();

export function startViewSession(
  initialLayerVisibility: ReadonlyMap<string, boolean>,
  initialLayerOrder: readonly string[] = []
): void {
  layerVisibility = new Map(initialLayerVisibility);
  layerOrder = [...initialLayerOrder];
  layerOverrides.clear();
  selection = null;
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

export function getDocumentLayerOrder<T extends string>(fallback: readonly T[]): T[] {
  return (layerOrder ? [...layerOrder] : [...fallback]) as T[];
}

export function getViewSessionState(): ViewSessionState | null {
  return layerVisibility
    ? { layerOrder: layerOrder ?? [], layerVisibility: new Map(layerVisibility), selection }
    : null;
}

export function setViewSessionSelection(nextSelection: ViewSessionSelection | null): void {
  if (layerVisibility) selection = nextSelection;
}

export function endViewSession(
  restoreLayerVisibility: (layerId: string, visible: boolean) => void,
  restoreLayerOrder?: (order: readonly string[]) => void
): void {
  if (layerVisibility) {
    for (const [layerId, visible] of layerVisibility) restoreLayerVisibility(layerId, visible);
  }
  if (layerOrder?.length) restoreLayerOrder?.(layerOrder);
  layerOverrides.clear();
  layerVisibility = null;
  layerOrder = null;
  selection = null;
}

export function resetViewSessionForTests(): void {
  layerOverrides.clear();
  layerVisibility = null;
  layerOrder = null;
  selection = null;
}
