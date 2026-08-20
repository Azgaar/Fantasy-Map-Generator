import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { LayerControlsSnapshot, LegacyLayerControls } from "./layers/layer-controls";
import { WorkspaceToolbar } from "./workspace-toolbar";

const snapshot: LayerControlsSnapshot = {
  canRemovePreset: false,
  canSavePreset: false,
  layers: [],
  presetOptions: [{ hidden: false, label: "Political map", value: "political" }],
  selectedPreset: "political"
};

const controls: LegacyLayerControls = {
  applyPreset: vi.fn(),
  getSnapshot: () => snapshot,
  moveLayer: vi.fn(),
  removePreset: vi.fn(),
  savePreset: vi.fn(),
  toggleLayer: vi.fn(() => true)
};

describe("WorkspaceToolbar", () => {
  test("renders Edit, the map chooser, and an icon-only Preferences control", () => {
    const markup = renderToStaticMarkup(
      <WorkspaceToolbar initialMapSnapshot={snapshot} mapControls={controls} onOpenPreferences={vi.fn()} />
    );

    expect(markup.includes('id="workspaceEditTrigger"')).toBe(true);
    expect(markup.includes('aria-controls="workspaceEditMenu"')).toBe(true);
    expect(markup.indexOf('id="workspaceEditTrigger"')).toBeLessThan(markup.indexOf('id="mapPreviewTrigger"'));
    expect(markup.includes('id="mapPreviewTrigger"')).toBe(true);
    expect(markup.includes('id="workspacePreferencesTrigger"')).toBe(true);
    expect(markup.indexOf('id="mapPreviewTrigger"')).toBeLessThan(markup.indexOf('id="workspacePreferencesTrigger"'));
    expect(markup.includes('aria-label="Preferences"')).toBe(true);
    expect(markup.includes(">Preferences</button>")).toBe(false);
  });
});
