// The MENU channel. Pure data plus thunks — no geometry, no DOM building.
//
// Every leaf routes to something that already exists: a Controllers entry where there is one, and
// a click on the real top-bar button where there is not. The wheel is a second route in, never a
// second implementation.
import type { LayerId } from "@/components/layers";
import { findEl } from "@/utils/nodeUtils";
import type { WheelNode } from "./types";

/** Fire the app's own button. Optional chaining, so a build without it is a no-op, not a crash. */
export const click = (id: string) => () => findEl<HTMLButtonElement>(id)?.click();

const node = (label: string, icon: string, extra: Partial<WheelNode> = {}): WheelNode => ({
  label,
  icon,
  ...extra
});

// -- layers ------------------------------------------------------------------------------------
// Toggleable layers, grouped so no ring exceeds its cap. Order inside a group follows the
// registry's z-order, which is the order the Layers list shows. Permanent layers (ocean,
// landmass, coastline, fogging, debug, legend) have no off state and never appear here.

export interface LayerGroup {
  label: string;
  icon: string;
  layers: LayerId[];
}

export const LAYER_GROUPS: LayerGroup[] = [
  {
    label: "Terrain",
    icon: "icon-mountain",
    layers: ["heightmap", "relief", "biomes", "rivers", "lakes", "ice", "texture"]
  },
  {
    label: "Political",
    icon: "icon-flag",
    layers: ["states", "provinces", "borders", "burgIcons", "emblems", "military", "zones"]
  },
  { label: "Cultural", icon: "icon-users", layers: ["cultures", "religions", "labels", "markers"] },
  {
    label: "Economy",
    icon: "icon-exchange",
    layers: ["routes", "goods", "markets", "trade", "population", "journeys"]
  },
  { label: "Climate", icon: "icon-temperature-high", layers: ["temperature", "precipitation"] },
  {
    label: "Overlay",
    icon: "icon-sitemap",
    layers: ["grid", "coordinates", "compass", "scaleBar", "vignette", "cells", "rulers"]
  }
];

export const LAYER_PRESETS: Array<[string, string]> = [
  ["political", "Political"],
  ["cultural", "Cultural"],
  ["religions", "Religions"],
  ["provinces", "Provinces"],
  ["biomes", "Biomes"],
  ["heightmap", "Heightmap"],
  ["physical", "Physical"],
  ["poi", "Places"],
  ["goods", "Goods"],
  ["trade", "Trade"],
  ["military", "Military"],
  ["emblems", "Emblems"],
  ["landmass", "Landmass"]
];

const applyLayerPreset = (value: string) => () => {
  const select = findEl<HTMLSelectElement>("layersPreset");
  if (!select) return;
  select.value = value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
};

/** "burgIcons" -> "Burg Icons", "scaleBar" -> "Scale Bar" */
const layerLabel = (id: string): string => id.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, c => c.toUpperCase());

const layerToggle = (id: LayerId): WheelNode => node(layerLabel(id), "icon-eye", { toggle: id });

const openTab = (tabId: string) => () => {
  findEl("optionsTrigger")?.click();
  findEl(tabId)?.click();
};

const layersBranch = (): WheelNode =>
  node("Layers", "icon-layer-group", {
    children: [
      node("Presets", "icon-sliders", {
        children: LAYER_PRESETS.map(([value, label]) => node(label, "icon-map-o", { run: applyLayerPreset(value) }))
      }),
      ...LAYER_GROUPS.map(group => node(group.label, group.icon, { children: () => group.layers.map(layerToggle) })),
      // ordering is a drag position in #mapLayers - a linear gesture with no radial equivalent,
      // so hand off to the list rather than invent a worse one
      node("Reorder layers…", "icon-sort-alt-down", { run: openTab("layersTab") })
    ]
  });

// -- options -----------------------------------------------------------------------------------
// #optionsContent is flat: two headings over two tables of one-setting rows, with no section
// containers. So a theme is just a set of control ids; the drawer hides the rows outside it.
// Every row is claimed exactly once - a test enforces the partition, so it cannot silently rot.

export const OPTION_GROUPS = [
  { label: "World", icon: "icon-globe", rows: ["mapWidthInput", "pointsInput", "templateInput", "optionsSeed"] },
  {
    label: "Realms",
    icon: "icon-flag",
    rows: ["statesNumber", "provincesRatio", "sizeVariety", "growthRate", "manorsInput"]
  },
  { label: "Peoples", icon: "icon-users", rows: ["culturesInput", "culturesSet", "religionsNumber"] },
  { label: "Identity", icon: "icon-tag", rows: ["mapName", "yearInput", "emblemShape"] },
  {
    label: "Interface",
    icon: "icon-sliders",
    rows: ["uiSize", "tooltipSize", "themeHueInput", "transparencyInput", "azgaarAssistant"]
  },
  {
    label: "Behaviour",
    icon: "icon-cog-alt",
    rows: [
      "autosaveIntervalInput",
      "onloadBehavior",
      "speakerVoice",
      "zoomExtentMin",
      "shapeRendering",
      "viewportRedraw",
      "resetLanguage"
    ]
  }
] as const;

const FILE_ACTIONS: Array<[string, string, string]> = [
  ["New map", "icon-cw", "newMapButton"],
  ["Save", "icon-download", "saveButton"],
  ["Load", "icon-upload", "loadButton"],
  ["Export", "icon-export", "exportButton"]
];

/** Every top-bar button this tree clicks. Exported so a test can prove they all still exist. */
export const BOUND_BUTTON_IDS: string[] = [
  "layersPreset",
  "layersTab",
  "styleTab",
  "optionsTab",
  "toolsTab",
  "aboutTab",
  "optionsTrigger",
  "addStyleButton",
  "removeStyleButton",
  "stylePreset",
  "editUnitsButton",
  "configureWorld",
  "optionsReset",
  ...FILE_ACTIONS.map(([, , id]) => id)
];

const optionsBranch = (): WheelNode =>
  node("Options", "icon-cog", {
    children: [
      ...OPTION_GROUPS.map(group =>
        node(group.label, group.icon, {
          panel: { host: "optionsContent", title: group.label, only: [...group.rows] }
        })
      ),
      node("Units", "icon-ruler", { run: click("editUnitsButton") }),
      node("World configuration", "icon-globe-africa", { run: click("configureWorld") }),
      node("File", "icon-doc", {
        children: FILE_ACTIONS.map(([label, icon, id]) => node(label, icon, { run: click(id) }))
      }),
      node("Reset options", "icon-ccw", { danger: true, run: click("optionsReset") })
    ]
  });

// -- style -------------------------------------------------------------------------------------
// The prototype's Fonts / Colours / Filters do not exist as menus here: the Style tab is a live
// form over #styleElementSelect. So the form goes in the drawer and only the presets are sectors.

export const STYLE_PRESETS = [
  "ancient",
  "atlas",
  "clean",
  "cyberpunk",
  "darkSeas",
  "gloom",
  "light",
  "monochrome",
  "night",
  "pale",
  "watercolor"
];

const applyStylePreset = (value: string) => () => {
  const select = findEl<HTMLSelectElement>("stylePreset");
  if (!select) return;
  select.value = value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
};

const title = (value: string): string => value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, c => c.toUpperCase());

const styleBranch = (): WheelNode =>
  node("Style", "icon-brush", {
    children: [
      node("Presets", "icon-paint-roller", {
        children: STYLE_PRESETS.map(preset => node(title(preset), "icon-adjust", { run: applyStylePreset(preset) }))
      }),
      node("Style editor", "icon-sliders", { panel: { host: "styleContent", title: "Style" } }),
      node("Save as preset", "icon-plus", { run: click("addStyleButton") }),
      node("Remove preset", "icon-trash-empty", { danger: true, run: click("removeStyleButton") })
    ]
  });

export function menuRoot(): WheelNode[] {
  return [
    layersBranch(),
    styleBranch(),
    optionsBranch(),
    node("Tools", "icon-wrench", { run: openTab("toolsTab") }),
    node("About", "icon-info-circled", { panel: { host: "aboutContent", title: "About" } })
  ];
}
