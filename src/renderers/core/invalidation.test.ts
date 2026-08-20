import { describe, expect, it, vi } from "vitest";
import { coalesceInvalidations } from "./invalidation";
import { RenderScheduler } from "./render-scheduler";

describe("coalesceInvalidations", () => {
  it("keeps camera changes out of scene rebuilds", () => {
    expect(coalesceInvalidations([{ kind: "camera" }, { kind: "camera" }])).toEqual({
      invalidations: [{ kind: "camera" }],
      requiresSceneBuild: false
    });
  });

  it("merges cell assignments and lets topology supersede geometry work", () => {
    expect(
      coalesceInvalidations([
        { cellIds: [4, 2], kind: "assignment", layer: "states" },
        { cellIds: [2, 8], kind: "assignment", layer: "states" },
        { kind: "geometry", layer: "borders" }
      ])
    ).toEqual({
      invalidations: [
        { kind: "geometry", layer: "borders" },
        { cellIds: [2, 4, 8], kind: "assignment", layer: "states" }
      ],
      requiresSceneBuild: true
    });

    expect(
      coalesceInvalidations([
        { cellIds: [2], kind: "assignment", layer: "states" },
        { kind: "geometry", layer: "borders" },
        { kind: "camera" },
        { kind: "topology" }
      ])
    ).toEqual({
      invalidations: [{ kind: "topology" }, { kind: "camera" }],
      requiresSceneBuild: true
    });
  });
});

describe("RenderScheduler", () => {
  it("renders only on demand and coalesces one frame", async () => {
    let callback: FrameRequestCallback | undefined;
    const render = vi.fn();
    const scheduler = new RenderScheduler(render, {
      requestFrame: next => {
        callback = next;
        return 7;
      }
    });

    scheduler.invalidate({ kind: "camera" });
    scheduler.invalidate({ kind: "camera" });
    expect(render).not.toHaveBeenCalled();
    expect(callback).toBeTypeOf("function");

    callback!(0);
    await vi.waitFor(() => expect(render).toHaveBeenCalledTimes(1));
    expect(render).toHaveBeenCalledWith({ invalidations: [{ kind: "camera" }], requiresSceneBuild: false });
  });

  it("cancels pending work on destroy", () => {
    const cancelFrame = vi.fn();
    const render = vi.fn();
    const scheduler = new RenderScheduler(render, { cancelFrame, requestFrame: () => 9 });
    scheduler.invalidate({ kind: "world" });
    scheduler.destroy();

    expect(cancelFrame).toHaveBeenCalledWith(9);
    expect(render).not.toHaveBeenCalled();
  });

  it("clears stale invalidations while keeping the scheduler reusable", async () => {
    const cancelFrame = vi.fn();
    const render = vi.fn();
    const scheduler = new RenderScheduler(render, { cancelFrame, requestFrame: () => 11 });
    scheduler.invalidate({ kind: "world" });
    scheduler.clear();
    scheduler.invalidate({ kind: "camera" });
    await scheduler.flush();

    expect(cancelFrame).toHaveBeenCalledWith(11);
    expect(render).toHaveBeenCalledWith({ invalidations: [{ kind: "camera" }], requiresSceneBuild: false });
  });
});
