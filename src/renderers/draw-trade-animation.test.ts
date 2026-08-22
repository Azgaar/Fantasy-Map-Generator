import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clear, draw, subscribeTradeAnimation, type TradeAnimationSnapshot } from "./draw-trade-animation";

describe("Pixi trade animation scheduler", () => {
  let nextFrame: FrameRequestCallback | null;
  let snapshots: TradeAnimationSnapshot[];
  let unsubscribe: () => void;

  beforeEach(() => {
    nextFrame = null;
    snapshots = [];
    globalThis.options = {
      trade: {
        animation: {
          concurrent: 1,
          displayType: "both",
          duration: 1,
          landDurationModifier: 1,
          markerSize: 4,
          segmentChangePause: 0
        }
      }
    } as unknown as typeof options;
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn(callback => {
        nextFrame = callback;
        return 1;
      })
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    unsubscribe = subscribeTradeAnimation(snapshot => snapshots.push(snapshot));
  });

  afterEach(() => {
    clear();
    unsubscribe();
    vi.unstubAllGlobals();
  });

  it("ticks only while markers exist and removes the final marker on completion", () => {
    const onComplete = vi.fn();
    draw(
      { deals: [], endBurgId: 2, id: "1-2", startBurgId: 1, type: "local" },
      [
        {
          points: [
            [0, 0],
            [10, 0]
          ],
          type: "land"
        }
      ],
      onComplete
    );

    expect(requestAnimationFrame).toHaveBeenCalledOnce();
    nextFrame?.(0);
    expect(snapshots.at(-1)?.markers[0]).toMatchObject({ angle: 0, x: 0, y: 0 });

    nextFrame?.(5);
    expect(snapshots.at(-1)?.markers[0]).toMatchObject({ x: 5, y: 0 });

    nextFrame?.(10);
    expect(snapshots.at(-1)?.markers).toEqual([]);
    expect(onComplete).toHaveBeenCalledOnce();
    expect(requestAnimationFrame).toHaveBeenCalledTimes(3);
  });

  it("cancels the scheduled frame and clears markers deterministically", () => {
    draw({ deals: [], endBurgId: 2, id: "1-2", startBurgId: 1, type: "local" }, [
      {
        points: [
          [0, 0],
          [10, 0]
        ],
        type: "water"
      }
    ]);
    clear();

    expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
    expect(snapshots.at(-1)?.markers).toEqual([]);
  });
});
