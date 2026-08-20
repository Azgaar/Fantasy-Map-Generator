import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { LayerControlsSnapshot, LegacyLayerControls } from "./layer-controls";
import { LayersPanel } from "./layers-panel";

const snapshot: LayerControlsSnapshot = {
  canRemovePreset: false,
  canSavePreset: true,
  layers: [
    {
      id: "toggleRivers",
      label: "Rivers",
      description: "Rivers layer",
      shortcut: "V",
      visible: true,
      fixed: false
    },
    {
      id: "toggleScaleBar",
      label: "Scale Bar",
      description: "Scale bar layer",
      shortcut: "/",
      visible: false,
      fixed: true
    }
  ],
  presetOptions: [
    { hidden: false, label: "Political map", value: "political" },
    { hidden: false, label: "Custom", value: "custom" }
  ],
  selectedPreset: "custom"
};

const controls: LegacyLayerControls = {
  applyPreset: vi.fn(),
  getSnapshot: () => snapshot,
  moveLayer: vi.fn(),
  removePreset: vi.fn(),
  savePreset: vi.fn(),
  toggleLayer: vi.fn(() => true)
};

describe("LayersPanel", () => {
  test("renders preset management, accessible layer state, ordering controls, and view modes", () => {
    const markup = renderToStaticMarkup(<LayersPanel controls={controls} initialSnapshot={snapshot} />);

    expect(markup.includes('id="layersPreset"')).toBe(false);
    expect(markup.includes('id="savePresetButton"')).toBe(true);
    expect(markup.includes('id="mapLayers"')).toBe(true);
    expect(markup.includes('id="toggleRivers"')).toBe(true);
    expect(markup.includes('aria-pressed="true"')).toBe(true);
    expect(markup.includes("fmg-layer-row--fixed")).toBe(true);
    expect(markup.includes("Move Rivers down")).toBe(true);
    expect(markup.includes('id="viewStandard"')).toBe(true);
    expect(markup.includes('id="viewGlobe"')).toBe(true);
  });
});
