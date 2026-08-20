export type RendererResourceKind = "geometry" | "glyph" | "texture";

export interface RendererResourceBudget {
  geometry: number;
  glyph: number;
  texture: number;
}

export interface RendererResourceSnapshot {
  bytes: Record<RendererResourceKind, number>;
  counts: Record<RendererResourceKind, number>;
  overBudget: readonly RendererResourceKind[];
  totalBytes: number;
  totalCount: number;
}

export const DEFAULT_RENDERER_RESOURCE_BUDGET: Readonly<RendererResourceBudget> = {
  geometry: 128 * 1024 * 1024,
  glyph: 64 * 1024 * 1024,
  texture: 256 * 1024 * 1024
};

interface TrackedResource {
  bytes: number;
  kind: RendererResourceKind;
}

export class RendererResourceTracker {
  private readonly resources = new Map<string, TrackedResource>();

  constructor(private readonly budget: RendererResourceBudget = { ...DEFAULT_RENDERER_RESOURCE_BUDGET }) {}

  acquire(id: string, kind: RendererResourceKind, bytes: number): void {
    if (this.resources.has(id)) throw new Error(`Renderer resource already tracked: ${id}`);
    if (!Number.isFinite(bytes) || bytes < 0) throw new Error(`Invalid renderer resource size: ${bytes}`);
    this.resources.set(id, { bytes, kind });
  }

  release(id: string): void {
    this.resources.delete(id);
  }

  clear(): void {
    this.resources.clear();
  }

  getSnapshot(): RendererResourceSnapshot {
    const bytes = { geometry: 0, glyph: 0, texture: 0 };
    const counts = { geometry: 0, glyph: 0, texture: 0 };
    for (const resource of this.resources.values()) {
      bytes[resource.kind] += resource.bytes;
      counts[resource.kind]++;
    }
    const kinds: readonly RendererResourceKind[] = ["geometry", "glyph", "texture"];
    return {
      bytes,
      counts,
      overBudget: kinds.filter(kind => bytes[kind] > this.budget[kind]),
      totalBytes: kinds.reduce((total, kind) => total + bytes[kind], 0),
      totalCount: kinds.reduce((total, kind) => total + counts[kind], 0)
    };
  }
}
