/// <reference types="node" />

import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { LayerControlsSnapshot, LegacyLayerControls } from "./layers/layer-controls";
import { getToolCommands } from "./tool-registry";
import { EditMenuItems, LayerMenuItems, ViewsMenuItems, WorkspaceToolbar } from "./workspace-toolbar";

const dialogStyles = readFileSync(new URL("./ui/dialog.css", import.meta.url), "utf8");
const workspacePanelStyles = readFileSync(new URL("./ui/workspace-panel.css", import.meta.url), "utf8");
const workspaceToolbarStyles = readFileSync(new URL("./workspace-toolbar.css", import.meta.url), "utf8");

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
  test("stays above modal overlays", () => {
    const toolbarZIndex = Number(workspaceToolbarStyles.match(/#mapPreviewRoot\s*\{[^}]*z-index:\s*(\d+)/s)?.[1]);
    const overlayZIndices = [dialogStyles, workspacePanelStyles].map(styles =>
      Number(styles.match(/(?:\.fmg-dialog-overlay|\.kui-overlay)\s*\{[^}]*z-index:\s*(\d+)/s)?.[1])
    );

    expect(toolbarZIndex).toBeGreaterThan(Math.max(...overlayZIndices));
  });

  test("renders the floating workspace menus in the requested order", () => {
    const markup = renderToStaticMarkup(
      <WorkspaceToolbar
        initialMapName="Eldoria"
        initialMapSnapshot={snapshot}
        mapControls={controls}
        onOpenSection={vi.fn()}
      />
    );

    const labels = ["Eldoria", "Project", "Inspect", "Generate", "Create", "Edit", "Views"];
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

  test("keeps Edit focused and consolidates 2D layers in Views", () => {
    const menuSnapshot: LayerControlsSnapshot = {
      ...snapshot,
      layers: [
        {
          description: "Temperature map",
          fixed: false,
          id: "toggleTemperature",
          label: "Temperature",
          shortcut: "T",
          visible: true
        },
        {
          description: "Scale bar",
          fixed: true,
          id: "toggleScaleBar",
          label: "Scale Bar",
          shortcut: "/",
          visible: false
        },
        {
          description: "States",
          fixed: false,
          id: "toggleStates",
          label: "States",
          shortcut: "S",
          visible: true
        },
        {
          description: "Trade",
          fixed: false,
          id: "toggleTrade",
          label: "Trade",
          shortcut: "`",
          visible: false
        },
        {
          description: "Plugin layer",
          fixed: false,
          id: "togglePluginLayer",
          label: "Plugin Layer",
          shortcut: "",
          visible: false
        }
      ]
    };
    const closeViews = vi.fn();
    const onOpenSection = vi.fn();
    const editItems = EditMenuItems({ close: vi.fn() });
    const layerItems = LayerMenuItems({ controls, snapshot: menuSnapshot });
    const viewsItems = ViewsMenuItems({
      close: closeViews,
      controls,
      onOpenSection,
      snapshot: menuSnapshot
    });
    const editMarkup = renderToStaticMarkup(editItems);
    const viewsMarkup = renderToStaticMarkup(viewsItems);

    expect(editMarkup.includes(">World<")).toBe(true);
    expect(editMarkup.includes(">Heightmap<")).toBe(true);
    expect(editMarkup.includes(">Show on map<")).toBe(false);
    expect(editMarkup.includes(">Temperature<")).toBe(false);

    const showIndex = viewsMarkup.indexOf(">Show on map<");
    const layerGroupIndex = viewsMarkup.indexOf(">Terrain &amp; climate<");
    const layerIndex = viewsMarkup.indexOf(">Temperature<");
    expect(showIndex).toBeGreaterThan(-1);
    expect(layerGroupIndex).toBeGreaterThan(showIndex);
    expect(layerIndex).toBeGreaterThan(layerGroupIndex);
    expect(viewsMarkup.includes(">Scale Bar<")).toBe(true);
    expect(viewsMarkup.includes(">Map decorations<")).toBe(true);
    expect(viewsMarkup.includes(">Politics &amp; population<")).toBe(true);
    expect(viewsMarkup.includes(">Features &amp; trade<")).toBe(true);
    expect(viewsMarkup.includes(">Other<")).toBe(true);
    expect(viewsMarkup.includes(">Plugin Layer<")).toBe(true);
    expect(viewsMarkup.includes(">Manage Layers…<")).toBe(false);
    expect(viewsMarkup.includes(">View mode<")).toBe(false);
    expect(viewsMarkup.includes(">3D scene<")).toBe(false);
    expect(viewsMarkup.includes(">Globe<")).toBe(false);

    const layerGroups = layerItems.props.children[0];
    const terrainGroup = layerGroups[0];
    const temperatureLayer = terrainGroup.props.children[0];
    temperatureLayer.props.onClick();
    expect(controls.toggleLayer).toHaveBeenCalledWith("toggleTemperature");

    viewsItems.props.children[5].props.onClick();
    expect(closeViews).toHaveBeenCalledOnce();
    expect(onOpenSection).toHaveBeenCalledWith("style");
  });

  test("docks editors launched from Edit", () => {
    const close = vi.fn();
    const heightmapCommand = getToolCommands("world")[0];
    const invoke = vi.spyOn(heightmapCommand, "invoke").mockReturnValue("executed");
    const editItems = EditMenuItems({ close });
    const worldGroup = editItems.props.children[0];
    const heightmapItem = worldGroup.props.children[0];

    heightmapItem.props.onClick();

    expect(close).toHaveBeenCalledOnce();
    expect(invoke).toHaveBeenCalledWith({ dialogPresentation: "panel" });
    invoke.mockRestore();
  });
});
