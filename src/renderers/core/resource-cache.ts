import type { RendererResourceKind, RendererResourceTracker } from "./resource-budget";

export interface RendererResourceHandle<T> {
  readonly value: T;
  release: () => void;
}

export interface RendererResourceCacheOptions<T> {
  budgetBytes: number;
  destroy: (value: T, key: string) => void;
  estimateBytes: (value: T, key: string) => number;
  kind: RendererResourceKind;
  tracker?: RendererResourceTracker;
}

interface CacheEntry<T> {
  bytes: number;
  lastUsed: number;
  references: number;
  resourceId: string;
  value: T;
}

export class RendererResourceCache<T> {
  private static sequence = 0;
  private readonly cacheId = `renderer-cache:${++RendererResourceCache.sequence}`;
  private readonly entries = new Map<string, CacheEntry<T>>();
  private readonly pending = new Map<string, Promise<CacheEntry<T>>>();
  private clock = 0;
  private generation = 0;
  private totalBytes = 0;

  constructor(private readonly options: RendererResourceCacheOptions<T>) {
    if (!Number.isFinite(options.budgetBytes) || options.budgetBytes < 0) {
      throw new Error(`Invalid renderer cache budget: ${options.budgetBytes}`);
    }
  }

  async acquire(key: string, load: () => Promise<T>): Promise<RendererResourceHandle<T>> {
    const entry = this.entries.get(key) ?? (await this.load(key, load));
    entry.references++;
    entry.lastUsed = ++this.clock;
    this.evictUnused();

    let released = false;
    return {
      value: entry.value,
      release: () => {
        if (released) return;
        released = true;
        entry.references = Math.max(0, entry.references - 1);
        entry.lastUsed = ++this.clock;
        this.evictUnused();
      }
    };
  }

  clear(): void {
    this.generation++;
    this.pending.clear();
    for (const [key, entry] of this.entries) this.destroyEntry(key, entry);
    this.entries.clear();
    this.totalBytes = 0;
  }

  getSnapshot(): { bytes: number; entries: number; referenced: number } {
    return {
      bytes: this.totalBytes,
      entries: this.entries.size,
      referenced: [...this.entries.values()].filter(entry => entry.references > 0).length
    };
  }

  private load(key: string, load: () => Promise<T>): Promise<CacheEntry<T>> {
    const pending = this.pending.get(key);
    if (pending) return pending;
    const generation = this.generation;
    const promise = load()
      .then(value => {
        if (generation !== this.generation) {
          this.options.destroy(value, key);
          throw new Error(`Renderer resource load superseded: ${key}`);
        }
        const bytes = this.options.estimateBytes(value, key);
        if (!Number.isFinite(bytes) || bytes < 0) {
          this.options.destroy(value, key);
          throw new Error(`Invalid cached renderer resource size: ${bytes}`);
        }
        const entry: CacheEntry<T> = {
          bytes,
          lastUsed: ++this.clock,
          references: 0,
          resourceId: `${this.cacheId}:${key}`,
          value
        };
        this.entries.set(key, entry);
        this.totalBytes += bytes;
        this.options.tracker?.acquire(entry.resourceId, this.options.kind, bytes);
        return entry;
      })
      .finally(() => {
        if (this.pending.get(key) === promise) this.pending.delete(key);
      });
    this.pending.set(key, promise);
    return promise;
  }

  private evictUnused(): void {
    while (this.totalBytes > this.options.budgetBytes) {
      const candidate = [...this.entries.entries()]
        .filter(([, entry]) => entry.references === 0)
        .sort(([, left], [, right]) => left.lastUsed - right.lastUsed)[0];
      if (!candidate) return;
      const [key, entry] = candidate;
      this.entries.delete(key);
      this.destroyEntry(key, entry);
    }
  }

  private destroyEntry(key: string, entry: CacheEntry<T>): void {
    this.totalBytes -= entry.bytes;
    this.options.tracker?.release(entry.resourceId);
    this.options.destroy(entry.value, key);
  }
}
