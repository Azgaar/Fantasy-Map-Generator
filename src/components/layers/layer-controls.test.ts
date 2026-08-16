import { describe, expect, test } from "vitest";
import { getLayerNeighbors, type LayerView, moveLayerBefore, moveLayerByDirection } from "./layer-controls";

const layers: LayerView[] = [
  { id: "height", label: "Height", description: "", shortcut: "H", visible: true, fixed: false },
  { id: "rivers", label: "Rivers", description: "", shortcut: "V", visible: true, fixed: false },
  { id: "labels", label: "Labels", description: "", shortcut: "L", visible: false, fixed: false },
  { id: "scale", label: "Scale bar", description: "", shortcut: "/", visible: true, fixed: true }
];

describe("layer ordering", () => {
  test("moves a layer one position for keyboard controls", () => {
    const reordered = moveLayerByDirection(layers, "rivers", 1);

    expect(reordered.map(layer => layer.id)).toEqual(["height", "labels", "rivers", "scale"]);
    expect(getLayerNeighbors(reordered, "rivers")).toEqual(["labels", "scale"]);
  });

  test("moves a dragged layer before its drop target", () => {
    const reordered = moveLayerBefore(layers, "labels", "height");
    expect(reordered.map(layer => layer.id)).toEqual(["labels", "height", "rivers", "scale"]);
  });

  test("does not move fixed layers or cross a fixed boundary", () => {
    expect(moveLayerByDirection(layers, "scale", -1).map(layer => layer.id)).toEqual(layers.map(layer => layer.id));
    expect(moveLayerByDirection(layers, "labels", 1).map(layer => layer.id)).toEqual(layers.map(layer => layer.id));
    expect(moveLayerBefore(layers, "labels", "scale").map(layer => layer.id)).toEqual(layers.map(layer => layer.id));
  });
});
