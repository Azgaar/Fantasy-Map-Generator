import { describe, expect, it } from "vitest";
import { sampleCatmullRom } from "./curve";

describe("sampleCatmullRom", () => {
  it("returns deterministic renderer-neutral points for a curved line", () => {
    const anchors: [number, number][] = [
      [0, 0],
      [10, 5],
      [20, 0]
    ];
    const first = sampleCatmullRom(anchors, 0.1);

    expect(first.length).toBeGreaterThan(anchors.length);
    expect(first[0]).toEqual(anchors[0]);
    expect(first.at(-1)).toEqual(anchors.at(-1));
    expect(first).toEqual(sampleCatmullRom(anchors, 0.1));
  });
});
