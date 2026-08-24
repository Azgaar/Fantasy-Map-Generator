import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { LayerControlsSnapshot, LegacyLayerControls } from "./layer-controls";
import { MapPreviewSelector } from "./map-preview-selector";

const snapshot: LayerControlsSnapshot = {
  canRemovePreset: false,
  canSavePreset: false,
  layers: [],
  presetSelectionDisabled: false,
  presetOptions: [
    { hidden: false, label: "Political map", value: "political" },
    { hidden: false, label: "Religions map", value: "religions" },
    { hidden: true, label: "Custom (not saved)", value: "custom" }
  ],
  selectedPreset: "religions"
};

const controls: LegacyLayerControls = {
  applyPreset: vi.fn(),
  drawActiveLayers: vi.fn(),
  getLayerOrder: vi.fn(() => []),
  getSnapshot: () => snapshot,
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

describe("MapPreviewSelector", () => {
  test("renders the current map view and available previews", () => {
    const markup = renderToStaticMarkup(
      <MapPreviewSelector controls={controls} initialSnapshot={snapshot} />
    );

    expect(markup.includes('id="layersPreset"')).toBe(false);
    expect(markup.includes('class="fmg-map-preview"')).toBe(true);
    expect(markup.includes('id="mapPreviewTrigger"')).toBe(true);
    expect(markup.includes('aria-haspopup="menu"')).toBe(true);
    expect(markup.includes('aria-expanded="false"')).toBe(true);
    expect(markup.includes('aria-label="Map view: Religions map"')).toBe(true);
    expect(markup.includes("Political map")).toBe(false);
  });

  test("disables preset switching while a map editor owns the layer state", () => {
    const markup = renderToStaticMarkup(
      <MapPreviewSelector
        controls={controls}
        initialSnapshot={{ ...snapshot, presetSelectionDisabled: true }}
      />
    );

    expect(markup.includes("disabled=\"\"")).toBe(true);
  });
});
