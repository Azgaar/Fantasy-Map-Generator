import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { LayerControlsSnapshot, LegacyLayerControls } from "./layer-controls";
import { MapPreviewSelector } from "./map-preview-selector";

const snapshot: LayerControlsSnapshot = {
  canRemovePreset: false,
  canSavePreset: false,
  layers: [],
  presetOptions: [
    { hidden: false, label: "Political map", value: "political" },
    { hidden: false, label: "Religions map", value: "religions" },
    { hidden: true, label: "Custom (not saved)", value: "custom" }
  ],
  selectedPreset: "religions"
};

const controls: LegacyLayerControls = {
  applyPreset: vi.fn(),
  getSnapshot: () => snapshot,
  moveLayer: vi.fn(),
  removePreset: vi.fn(),
  savePreset: vi.fn(),
  toggleLayer: vi.fn(() => true)
};

describe("MapPreviewSelector", () => {
  test("renders the current map view and available previews", () => {
    const markup = renderToStaticMarkup(
      <MapPreviewSelector controls={controls} initialSnapshot={snapshot} />
    );

    expect(markup.includes('id="layersPreset"')).toBe(true);
    expect(markup.includes('aria-label="Map view"')).toBe(true);
    expect(markup.includes('<option value="political">Political map</option>')).toBe(true);
    expect(markup.includes('<option value="religions" selected="">Religions map</option>')).toBe(true);
    expect(markup.includes('value="custom"')).toBe(false);
  });
});
