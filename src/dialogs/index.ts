const dialogsMap = {
  biomesEditor: "biomes-editor",
  burgEditor: "burg-editor",
  chartsOverview: "charts-overview",
  culturesEditor: "cultures-editor",
  heightmapSelection: "heightmap-selection",
  hierarchyTree: "hierarchy-tree",
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
export async function openDialog(dialog: TDialog, options: null | typeof defaultOptions, props?: UnknownObject) {
  const {allowDuringCustomization} = options || defaultOptions;
  if (customization && !allowDuringCustomization) return;

  const Dialog = await import(`./dialogs/${dialogsMap[dialog]}.js`);
  Dialog.open(props);
}
