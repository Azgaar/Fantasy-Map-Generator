import { coalesceInvalidations, type RenderInvalidation, type RenderInvalidationBatch } from "./invalidation";

export interface RenderScheduleDiagnostic {
  duration: number;
  invalidationCount: number;
  requiresSceneBuild: boolean;
}

export interface RenderSchedulerOptions {
  cancelFrame?: (frameId: number) => void;
  now?: () => number;
  onDiagnostic?: (diagnostic: RenderScheduleDiagnostic) => void;
  requestFrame?: (callback: FrameRequestCallback) => number;
}

export class RenderScheduler {
  private readonly cancelFrame: (frameId: number) => void;
  private readonly now: () => number;
  private readonly onDiagnostic?: (diagnostic: RenderScheduleDiagnostic) => void;
  private readonly render: (batch: RenderInvalidationBatch) => void | Promise<void>;
  private readonly requestFrame: (callback: FrameRequestCallback) => number;
  private frameId: number | null = null;
  private invalidations: RenderInvalidation[] = [];
  private destroyed = false;

  constructor(render: (batch: RenderInvalidationBatch) => void | Promise<void>, options: RenderSchedulerOptions = {}) {
    this.render = render;
    this.requestFrame = options.requestFrame ?? (callback => globalThis.requestAnimationFrame(callback));
    this.cancelFrame = options.cancelFrame ?? (frameId => globalThis.cancelAnimationFrame(frameId));
    this.now = options.now ?? (() => performance.now());
    this.onDiagnostic = options.onDiagnostic;
  }

  invalidate(invalidation: RenderInvalidation): void {
    if (this.destroyed) return;
    this.invalidations.push(invalidation);
    if (this.frameId !== null) return;
    this.frameId = this.requestFrame(() => {
      this.frameId = null;
      void this.flush();
    });
  }

  async flush(): Promise<void> {
    if (this.destroyed || !this.invalidations.length) return;
    if (this.frameId !== null) this.cancelFrame(this.frameId);
    this.frameId = null;
    const batch = coalesceInvalidations(this.invalidations);
    this.invalidations = [];
    const started = this.now();
    await this.render(batch);
    this.onDiagnostic?.({
      duration: this.now() - started,
      invalidationCount: batch.invalidations.length,
      requiresSceneBuild: batch.requiresSceneBuild
    });
  }

  clear(): void {
    this.invalidations = [];
    if (this.frameId !== null) this.cancelFrame(this.frameId);
    this.frameId = null;
  }

  destroy(): void {
    this.destroyed = true;
    this.clear();
  }
}
