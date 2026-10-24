// The app's modules, loaded once the interface language's strings are: their markup is translated as they load
import "@/services/logging";
import "@/model/globals";
import "@/model/options/options-defaults";
import "./chrome/tabs";

import "@/data/supporters";
import "@/data/heightmap-templates";
import "@/data/precreated-heightmaps";
import "@/model/options/options-model";
import "@/ui/dialog/system-dialogs";
import "./chrome/app-info";
import "@/ui/tooltips";
import "@/ui/map/map-tooltip";
import "@/ui/map/zoom";
import "@/ui/map/viewbox-events";
import "./hotkeys";
import "@/renderers/layers";
import "./layers-presets";
import "@/ui/map/canvas";
import "./chrome/io-panes";
import "@/renderers/view-mode";
import "./chrome/options-panel";
import "./seed";
import "./lifecycle";
import "@/ui/dialog/dialog-helpers";
import "@/ui/dialog/sorting";
import "@/ui/elements/fill-box";
import "@/ui/elements/slider-input";
import "@/controllers";
import "@/services";
import "@/services/platform";
import "@/services/autosave";
import "@/services/url-params";
import "@/services/versioning";
import "@/services/io/styles-legacy";
import "./fmg";

bindApp({
  generate,
  regenerateMap,
  regeneratePrompt,
  syncOptionInputs,
  changeCellsDensity,
  openTab,
  pickMapFile,
  showExportPane,
  applyLayersPreset,
  applyURLLayers,
  mapCommands: MAP_COMMANDS,
  isLinkable
});

export { boot } from "./lifecycle";

import { bindApp } from "@/ui/app-commands";
import { pickMapFile, showExportPane } from "./chrome/io-panes";
import { openTab } from "./chrome/options-panel";
import { changeCellsDensity, syncOptionInputs } from "./chrome/tabs/options-tab";
import { applyLayersPreset, applyURLLayers } from "./layers-presets";
import { generate, regenerateMap, regeneratePrompt } from "./lifecycle";
import { isLinkable, MAP_COMMANDS } from "./map-commands";
