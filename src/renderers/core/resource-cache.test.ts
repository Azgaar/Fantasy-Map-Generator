import { describe, expect, it, vi } from "vitest";
import { RendererResourceTracker } from "./resource-budget";
import { RendererResourceCache } from "./resource-cache";

interface Resource {
  bytes: number;
  name: string;
}

const createCache = (budgetBytes = 10) => {
  const destroy = vi.fn();
  const tracker = new RendererResourceTracker({ geometry: 100, glyph: 100, texture: budgetBytes });
  const cache = new RendererResourceCache<Resource>({
    budgetBytes,
    destroy,
    estimateBytes: resource => resource.bytes,
    kind: "texture",
    tracker
  });
  return { cache, destroy, tracker };
};

describe("RendererResourceCache", () => {
  it("deduplicates concurrent loads and releases handles idempotently", async () => {
    const { cache } = createCache();
    const load = vi.fn(async () => ({ bytes: 4, name: "atlas" }));
    const [first, second] = await Promise.all([cache.acquire("atlas", load), cache.acquire("atlas", load)]);

    expect(load).toHaveBeenCalledOnce();
    expect(first.value).toBe(second.value);
    expect(cache.getSnapshot()).toEqual({ bytes: 4, entries: 1, referenced: 1 });
    first.release();
    first.release();
    second.release();
    expect(cache.getSnapshot()).toEqual({ bytes: 4, entries: 1, referenced: 0 });
  });

  it("evicts least-recently-used unreferenced entries when over budget", async () => {
    const { cache, destroy, tracker } = createCache(10);
    const first = await cache.acquire("first", async () => ({ bytes: 6, name: "first" }));
    first.release();
    const second = await cache.acquire("second", async () => ({ bytes: 6, name: "second" }));

    expect(destroy).toHaveBeenCalledWith(first.value, "first");
    expect(cache.getSnapshot()).toEqual({ bytes: 6, entries: 1, referenced: 1 });
    expect(tracker.getSnapshot()).toMatchObject({ totalBytes: 6, totalCount: 1 });
    second.release();
  });

  it("destroys every retained entry and returns accounting to baseline on clear", async () => {
    const { cache, destroy, tracker } = createCache(100);
    await cache.acquire("first", async () => ({ bytes: 6, name: "first" }));
    await cache.acquire("second", async () => ({ bytes: 8, name: "second" }));
    cache.clear();

    expect(destroy).toHaveBeenCalledTimes(2);
    expect(cache.getSnapshot()).toEqual({ bytes: 0, entries: 0, referenced: 0 });
    expect(tracker.getSnapshot()).toMatchObject({ totalBytes: 0, totalCount: 0 });
  });

  it("disposes a load that completes after clear", async () => {
    const { cache, destroy } = createCache();
    let resolve!: (resource: Resource) => void;
    const acquiring = cache.acquire("late", () => new Promise<Resource>(done => (resolve = done)));
    cache.clear();
    const late = { bytes: 4, name: "late" };
    resolve(late);

    await expect(acquiring).rejects.toThrow("superseded");
    expect(destroy).toHaveBeenCalledWith(late, "late");
  });

  it("does not let a superseded load remove a newer pending load for the same key", async () => {
    const { cache, destroy } = createCache();
    let resolveOld!: (resource: Resource) => void;
    let resolveNew!: (resource: Resource) => void;
    const oldAcquire = cache.acquire("shared", () => new Promise<Resource>(done => (resolveOld = done)));
    cache.clear();
    const newLoad = vi.fn(() => new Promise<Resource>(done => (resolveNew = done)));
    const firstNewAcquire = cache.acquire("shared", newLoad);

    const old = { bytes: 3, name: "old" };
    resolveOld(old);
    await expect(oldAcquire).rejects.toThrow("superseded");

    const secondNewAcquire = cache.acquire("shared", newLoad);
    expect(newLoad).toHaveBeenCalledOnce();
    resolveNew({ bytes: 4, name: "new" });

    const [first, second] = await Promise.all([firstNewAcquire, secondNewAcquire]);
    expect(first.value).toBe(second.value);
    expect(destroy).toHaveBeenCalledWith(old, "shared");
    first.release();
    second.release();
  });
});
