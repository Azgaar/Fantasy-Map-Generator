import { describe, expect, test, vi } from "vitest";
import {
  bindLayerControls,
  getLayerNeighbors,
  LayerControls,
  type LayerView,
  moveLayerBefore,
  moveLayerByDirection
} from "./layer-controls";

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

describe("layer controls facade", () => {
  test("forwards bundled callers to the initialized runtime", () => {
    const runtime = {
      applyPreset: vi.fn(),
      drawActiveLayers: vi.fn(),
      getLayerOrder: vi.fn(() => []),
      getSnapshot: vi.fn(),
      isLayerOn: vi.fn(() => true),
      moveLayer: vi.fn(),
      redrawLayer: vi.fn(() => true),
      removePreset: vi.fn(),
      restoreSavedPreset: vi.fn(),
      savePreset: vi.fn(),
      setLayerOrder: vi.fn(),
      setPresetState: vi.fn(),
      setLayerVisibility: vi.fn(),
      syncPreset: vi.fn(),
      toggleLayer: vi.fn(() => true)
    };
    const release = bindLayerControls(runtime);

    expect(LayerControls.isLayerOn("toggleLabels")).toBe(true);
    LayerControls.drawActiveLayers();
    LayerControls.setLayerOrder(["markers", "labels"]);
    LayerControls.syncPreset(false);

    expect(runtime.isLayerOn).toHaveBeenCalledWith("toggleLabels");
    expect(runtime.drawActiveLayers).toHaveBeenCalledOnce();
    expect(runtime.setLayerOrder).toHaveBeenCalledWith(["markers", "labels"]);
    expect(runtime.syncPreset).toHaveBeenCalledWith(false);
    release();
  });
});
