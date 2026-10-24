// The composition root's commands, for the controllers and services below it. `app/index` binds them at start-up:
// a handle like the `Controllers` and `Services` registries, so no module imports upward into `app/`

import type { pickMapFile, showExportPane } from "@/app/chrome/io-panes";
import type { openTab } from "@/app/chrome/options-panel";
import type { changeCellsDensity, syncOptionInputs } from "@/app/chrome/tabs/options-tab";
import type { applyLayersPreset, applyURLLayers } from "@/app/layers-presets";
import type { generate, regenerateMap, regeneratePrompt } from "@/app/lifecycle";
import type { isLinkable, MAP_COMMANDS } from "@/app/map-commands";

interface AppCommands {
  generate: typeof generate;
  regenerateMap: typeof regenerateMap;
  regeneratePrompt: typeof regeneratePrompt;
  syncOptionInputs: typeof syncOptionInputs;
  changeCellsDensity: typeof changeCellsDensity;
  openTab: typeof openTab;
  pickMapFile: typeof pickMapFile;
  showExportPane: typeof showExportPane;
  applyLayersPreset: typeof applyLayersPreset;
  applyURLLayers: typeof applyURLLayers;
  mapCommands: typeof MAP_COMMANDS;
  isLinkable: typeof isLinkable;
}

export const App = {} as AppCommands;

export function bindApp(commands: AppCommands): void {
  Object.assign(App, commands);
}
