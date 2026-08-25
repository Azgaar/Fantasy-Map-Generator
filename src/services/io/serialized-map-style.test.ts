import { describe, expect, test } from "vitest";
import type { Style } from "@/types/style";
import { createSerializedMapStyle } from "./serialized-map-style";

describe("serialized map style", () => {
  test("captures layer presentation into a detached style value", () => {
    const style: Style = {
      labels: { groups: {} },
      mapLayerOrder: ["states"],
      mapLayerVisibility: { states: true, texture: false },
      relief: { density: 0.4, set: "simple", size: 1 }
    };

    const serialized = createSerializedMapStyle(style, ["rivers", "states"], controlId => controlId !== "toggleStates");

    expect(serialized).not.toBe(style);
    expect(serialized.mapLayerOrder).toEqual(["rivers", "states"]);
    expect(serialized.mapLayerVisibility).toMatchObject({ rivers: true, states: false });
    expect(serialized.mapLayerVisibility).not.toHaveProperty("texture");
    expect(style).toEqual({
      labels: { groups: {} },
      mapLayerOrder: ["states"],
      mapLayerVisibility: { states: true, texture: false },
      relief: { density: 0.4, set: "simple", size: 1 }
    });
  });
});
