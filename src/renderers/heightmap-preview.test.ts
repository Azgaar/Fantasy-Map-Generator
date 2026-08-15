import { describe, expect, it } from "vitest";
import { drawHeightmapPreview } from "./heightmap-preview";

describe("drawHeightmapPreview", () => {
  it("converts water and land heights to grayscale pixels", () => {
    const data = new Uint8ClampedArray(8);
    const context = {
      createImageData: () => ({ data }),
      putImageData: () => {}
    };
    const canvas = { getContext: () => context } as unknown as HTMLCanvasElement;

    drawHeightmapPreview(canvas, Uint8Array.from([15, 50]), 2, 1);

    expect([...data]).toEqual([26, 26, 26, 255, 128, 128, 128, 255]);
  });
});
