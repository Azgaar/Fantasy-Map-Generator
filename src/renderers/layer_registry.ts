export type Bounds = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  scale: number;
};

export type RenderContext = {
  bounds: Bounds;
  scale: number;
};

export type LayerEntry<T> = {
  id: string;
  rootId: string;
  groupId: string;
  enabled: () => boolean;
  scaleMin?: number;
  scaleMax?: number;
  getItems?: () => T[];
  filter?: (item: T) => boolean;
  inViewport?: (item: T, bounds: Bounds) => boolean;
  render?: (group: SVGGElement, items: T[], context: RenderContext) => void;
  update?: (group: SVGGElement, context: RenderContext) => void;
};

const registry: LayerEntry<unknown>[] = [];

export function registerLayer<T>(entry: LayerEntry<T>): void {
  const index = registry.findIndex(layer => layer.id === entry.id);
  const registeredEntry = entry as LayerEntry<unknown>;

  if (index === -1) registry.push(registeredEntry);
  else registry[index] = registeredEntry;
}

export function unregisterLayer(id: string): void {
  const index = registry.findIndex(layer => layer.id === id);
  if (index !== -1) registry.splice(index, 1);
}

export function getLayers(): readonly LayerEntry<unknown>[] {
  return registry;
}
