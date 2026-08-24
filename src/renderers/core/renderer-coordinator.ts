import type { MapLayerDefinition, MapLayerId, MapLayerOwner } from "./layer-registry";

export interface CoordinatedLayer extends MapLayerDefinition {
  owner: MapLayerOwner;
  visible: boolean;
}

export class RendererCoordinator {
  private readonly definitions: ReadonlyMap<MapLayerId, MapLayerDefinition>;
  private readonly owners = new Map<MapLayerId, MapLayerOwner>();
  private readonly visibility = new Map<MapLayerId, boolean>();

  constructor(registry: readonly MapLayerDefinition[], defaultOwner: MapLayerOwner = "svg") {
    this.definitions = new Map(registry.map(definition => [definition.id, definition]));
    for (const definition of registry) {
      this.owners.set(definition.id, defaultOwner);
      this.visibility.set(definition.id, true);
    }
  }

  getLayer(layer: MapLayerId): CoordinatedLayer {
    const definition = this.getDefinition(layer);
    return {
      ...definition,
      owner: this.owners.get(layer)!,
      visible: this.visibility.get(layer)!
    };
  }

  getLayers(): CoordinatedLayer[] {
    return [...this.definitions.keys()]
      .map(layer => this.getLayer(layer))
      .sort((left, right) => left.order - right.order);
  }

  getOwner(layer: MapLayerId): MapLayerOwner {
    this.getDefinition(layer);
    return this.owners.get(layer)!;
  }

  isOwnedBy(layer: MapLayerId, owner: MapLayerOwner): boolean {
    return this.getOwner(layer) === owner;
  }

  setOwner(layer: MapLayerId, owner: MapLayerOwner): void {
    this.getDefinition(layer);
    this.owners.set(layer, owner);
  }

  setOwners(owner: MapLayerOwner, layers: Iterable<MapLayerId>): void {
    for (const layer of layers) this.setOwner(layer, owner);
  }

  resetOwners(owner: MapLayerOwner = "svg"): void {
    for (const layer of this.definitions.keys()) this.owners.set(layer, owner);
  }

  setVisibility(layer: MapLayerId, visible: boolean): void {
    this.getDefinition(layer);
    this.visibility.set(layer, visible);
  }

  isVisible(layer: MapLayerId): boolean {
    const definition = this.getDefinition(layer);
    return this.visibility.get(layer)! && definition.dependencies.every(dependency => this.isVisible(dependency));
  }

  private getDefinition(layer: MapLayerId): MapLayerDefinition {
    const definition = this.definitions.get(layer);
    if (!definition) throw new Error(`Unknown map layer: ${layer}`);
    return definition;
  }
}
