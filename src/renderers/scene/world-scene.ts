import type { RenderInvalidation } from "../core/invalidation";
import type { MapLayerId } from "../core/layer-registry";
import type { SceneRevision } from "./primitives";

export interface WorldSceneRevisionSnapshot {
  layerRevisions: Readonly<Partial<Record<MapLayerId, number>>>;
  topology: number;
  world: number;
}

export class WorldSceneRevisionTracker {
  private readonly layerRevisions = new Map<MapLayerId, number>();
  private topologyRevision = 0;
  private worldRevision = 0;

  apply(invalidations: Iterable<RenderInvalidation>): void {
    for (const invalidation of invalidations) {
      if (invalidation.kind === "world") {
        this.worldRevision++;
        this.topologyRevision++;
      } else if (invalidation.kind === "topology") {
        this.topologyRevision++;
      } else if (
        invalidation.kind === "assignment" ||
        invalidation.kind === "entity" ||
        invalidation.kind === "geometry" ||
        invalidation.kind === "style"
      ) {
        this.layerRevisions.set(invalidation.layer, (this.layerRevisions.get(invalidation.layer) ?? 0) + 1);
      }
    }
  }

  getLayerRevision(layer: MapLayerId): SceneRevision {
    return `world:${this.worldRevision}:topology:${this.topologyRevision}:${layer}:${this.layerRevisions.get(layer) ?? 0}`;
  }

  getTopologyRevision(): SceneRevision {
    return `world:${this.worldRevision}:topology:${this.topologyRevision}`;
  }

  getSnapshot(): WorldSceneRevisionSnapshot {
    return {
      layerRevisions: Object.fromEntries(this.layerRevisions),
      topology: this.topologyRevision,
      world: this.worldRevision
    };
  }

  reset(): void {
    this.layerRevisions.clear();
    this.topologyRevision = 0;
    this.worldRevision = 0;
  }
}
