const dialogsMap = {
  biomesEditor: "biomes-editor",
  burgEditor: "burg-editor",
  burgsOverview: "burgs-overview",
  chartsOverview: "charts-overview",
  coastlineEditor: "coastline-editor",
  culturesEditor: "cultures-editor",
  diplomacyEditor: "diplomacy-editor",
  emblemEditor: "emblem-editor",
  heightmapEditor: "heightmap-editor",
  heightmapSelection: "heightmap-selection",
  hierarchyTree: "hierarchy-tree",
  iceEditor: "ice-editor",
  labelEditor: "label-editor",
  lakeEditor: "lake-editor",
  religionsEditor: "religions-editor",
  statesEditor: "states-editor",
  unitsEditor: "units-editor"
};

type TDialog = keyof typeof dialogsMap;

const defaultOptions = {
  allowDuringCustomization: false
};

// dynamically load UI dialog
// dialog is a es module with the only exported function 'open'
export async function openDialog(dialog: TDialog, options?: null | typeof defaultOptions, props?: UnknownObject) {
  const {allowDuringCustomization} = options || defaultOptions;
  if (customization && !allowDuringCustomization) return;

  const Dialog = await import(`./dialogs/${dialogsMap[dialog]}.js`);
  Dialog.open(props);
}
