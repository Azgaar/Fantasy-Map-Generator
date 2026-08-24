import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { LayerControlsSnapshot, LegacyLayerControls } from "./layers/layer-controls";
import { WorkspaceToolbar } from "./workspace-toolbar";

const snapshot: LayerControlsSnapshot = {
  canRemovePreset: false,
  canSavePreset: false,
  layers: [],
  presetSelectionDisabled: false,
  presetOptions: [{ hidden: false, label: "Political map", value: "political" }],
  selectedPreset: "political"
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

describe("WorkspaceToolbar", () => {
  test("renders the floating workspace menus in the requested order", () => {
    const markup = renderToStaticMarkup(
      <WorkspaceToolbar
        initialMapName="Eldoria"
        initialMapSnapshot={snapshot}
        mapControls={controls}
        onOpenSection={vi.fn()}
      />
    );

    const labels = ["Eldoria", "Project", "Inspect", "Generate", "Create", "Map", "Views"];
    labels.reduce((previousIndex, label) => {
      const index = markup.indexOf(`>${label}<`);
      expect(index).toBeGreaterThan(previousIndex);
      return index;
    }, -1);

    expect(markup.includes('id="workspaceProjectTrigger"')).toBe(true);
    expect(markup.includes('id="workspaceCreateTrigger"')).toBe(true);
    expect(markup.includes('id="workspaceInspectTrigger"')).toBe(true);
    expect(markup.includes('id="workspaceMapTrigger"')).toBe(true);
    expect(markup.includes('id="workspaceViewsTrigger"')).toBe(true);
    expect(markup.includes('id="workspaceGenerateTrigger"')).toBe(true);
    expect(markup.includes("Fantasia")).toBe(false);
  });
});
