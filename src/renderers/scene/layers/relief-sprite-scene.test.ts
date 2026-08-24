import { describe, expect, it } from "vitest";
import { buildReliefSpriteScene } from "./relief-sprite-scene";

describe("buildReliefSpriteScene", () => {
  it("builds stable sprite instances and aggregate bounds without DOM or Pixi", () => {
    const scene = buildReliefSpriteScene(
      [
        { i: 11, icon: "relief-mount-1", s: 8, x: 10, y: 20 },
        { i: 12, icon: "relief-hill-2", s: 4, x: -2, y: 5 }
      ],
      "relief:7"
    );

    expect(scene).toEqual({
      bounds: { maxX: 18, maxY: 28, minX: -2, minY: 5 },
      domainIds: [11, 12],
      instances: [
        { domainId: 11, height: 8, icon: "relief-mount-1", width: 8, x: 10, y: 20 },
        { domainId: 12, height: 4, icon: "relief-hill-2", width: 4, x: -2, y: 5 }
      ],
      kind: "sprite-batch",
      layer: "relief",
      revision: "relief:7"
    });
  });

  it("returns an empty bounded batch", () => {
    expect(buildReliefSpriteScene([], 1)).toMatchObject({ bounds: null, domainIds: [], instances: [] });
  });
});
