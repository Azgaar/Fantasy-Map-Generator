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

export function menuRoot(): WheelNode[] {
  return [
    layersBranch(),
    node("Style", "icon-brush", { run: openTab("styleTab") }),
    node("Options", "icon-cog", { run: openTab("optionsTab") }),
    node("Tools", "icon-wrench", { run: openTab("toolsTab") }),
    node("About", "icon-info-circled", { run: openTab("aboutTab") })
  ];
}
