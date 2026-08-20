import { describe, expect, it, vi } from "vitest";
import { monitorWebGlContext } from "./context-recovery";

describe("monitorWebGlContext", () => {
  it("prevents permanent loss, requests recovery, and detaches deterministically", () => {
    const canvas = new EventTarget();
    const lost = vi.fn();
    const restored = vi.fn();
    const release = monitorWebGlContext(canvas as HTMLCanvasElement, { lost, restored });
    const lossEvent = new Event("webglcontextlost", { cancelable: true });

    canvas.dispatchEvent(lossEvent);
    canvas.dispatchEvent(new Event("webglcontextrestored"));
    expect(lossEvent.defaultPrevented).toBe(true);
    expect(lost).toHaveBeenCalledOnce();
    expect(restored).toHaveBeenCalledOnce();

    release();
    canvas.dispatchEvent(new Event("webglcontextrestored"));
    expect(restored).toHaveBeenCalledOnce();
  });
});
