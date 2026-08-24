import type { MapLayerId } from "../core/layer-registry";
import type { MapRenderWorld } from "./render-world";
import type { MapStyle } from "./styles";

export const RENDER_SNAPSHOT_VERSION = 1 as const;

export interface RenderSnapshotBounds {
  height: number;
  width: number;
}

/** Immutable-by-contract world input shared by export and the standalone viewer. */
export type WorldSnapshot = Readonly<MapRenderWorld>;

export interface RenderSnapshot {
  bounds: Readonly<RenderSnapshotBounds>;
  layerVisibility: Readonly<Partial<Record<MapLayerId, boolean>>>;
  style: Readonly<MapStyle>;
  version: typeof RENDER_SNAPSHOT_VERSION;
  world: WorldSnapshot;
}

export interface CreateRenderSnapshotOptions {
  bounds?: RenderSnapshotBounds;
  layerVisibility?: Readonly<Partial<Record<MapLayerId, boolean>>>;
  style: MapStyle;
  world: MapRenderWorld;
}

/** Detaches mutable editor state and GPU-free scene inputs at a command boundary. */
export function createRenderSnapshot(options: CreateRenderSnapshotOptions): RenderSnapshot {
  const bounds = normalizeBounds(options.bounds ?? getRenderWorldBounds(options.world));
  return {
    bounds,
    layerVisibility: structuredClone(options.layerVisibility ?? {}),
    style: structuredClone(options.style),
    version: RENDER_SNAPSHOT_VERSION,
    world: structuredClone(options.world)
  };
}

export function assertRenderSnapshot(value: unknown): asserts value is RenderSnapshot {
  if (!value || typeof value !== "object") throw new Error("Viewer data must be an object");
  const snapshot = value as Partial<RenderSnapshot>;
  if (snapshot.version !== RENDER_SNAPSHOT_VERSION) {
    throw new Error(`Unsupported viewer data version: ${String(snapshot.version)}`);
  }
  if (!snapshot.world?.cells?.i || !snapshot.world.vertices?.p) throw new Error("Viewer data is missing map topology");
  if (!snapshot.style || !snapshot.bounds) throw new Error("Viewer data is missing render style or bounds");
  normalizeBounds(snapshot.bounds);
}

export function getRenderWorldBounds(world: Pick<MapRenderWorld, "vertices">): RenderSnapshotBounds {
  let width = 0;
  let height = 0;
  for (const [x, y] of world.vertices.p) {
    if (Number.isFinite(x)) width = Math.max(width, x);
    if (Number.isFinite(y)) height = Math.max(height, y);
  }
  return normalizeBounds({ height, width });
}

function normalizeBounds(bounds: RenderSnapshotBounds): RenderSnapshotBounds {
  if (!Number.isFinite(bounds.width) || bounds.width <= 0 || !Number.isFinite(bounds.height) || bounds.height <= 0) {
    throw new Error("Render snapshot bounds must be positive finite dimensions");
  }
  return { height: bounds.height, width: bounds.width };
}
