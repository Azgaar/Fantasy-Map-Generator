import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type ZoomChanges, ZoomSettler } from "./zoom-settler";

let frames: Map<number, FrameRequestCallback>;
let nextFrameId: number;

beforeEach(() => {
  frames = new Map();
  nextFrameId = 1;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    const id = nextFrameId++;
    frames.set(id, callback);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
});

afterEach(() => vi.unstubAllGlobals());

function runAnimationFrame(): void {
  const callbacks = [...frames.values()];
  frames.clear();
  for (const callback of callbacks) callback(performance.now());
}

describe("ZoomSettler", () => {
  it("coalesces superseded gestures without dropping their change flags", () => {
    const settled: ZoomChanges[] = [];
    const settler = new ZoomSettler(changes => settled.push(changes));

    settler.schedule({ scale: true, position: false });
    settler.cancel();
    settler.schedule({ scale: false, position: true });
    runAnimationFrame();

    expect(settled).toEqual([{ scale: true, position: true }]);
  });

  it("runs only the latest scheduled frame", () => {
    const settle = vi.fn();
    const settler = new ZoomSettler(settle);

    settler.schedule({ scale: true, position: false });
    settler.schedule({ scale: true, position: false });
    runAnimationFrame();

    expect(settle).toHaveBeenCalledOnce();
  });
});
