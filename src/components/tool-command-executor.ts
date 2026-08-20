import { Controllers } from "@/controllers";
import { tip } from "./tooltips";

const TOOL_COMMAND_HANDLERS = {
  addBurgTool: () => Controllers.BurgCreator.toggle(),
  addLabel: () => Controllers.LabelCreator.toggle(),
  addMarker: () => Controllers.MarkerCreator.toggle(),
  addRiver: () => Controllers.RiverAutoCreator.toggle(),
  addRoute: () => Controllers.RouteCreator.open(),
  configRegenerateMarkers: () => Controllers.MarkersSettings.open(),
  editBiomesButton: () => Controllers.BiomesEditor.open(),
  editCoastlineSettings: () => Controllers.CoastlineEditor.open(),
  editCulturesButton: () => Controllers.CulturesEditor.open(),
  editDiplomacyButton: () => Controllers.DiplomacyEditor.open(),
  editEmblemButton: () => Controllers.EmblemsEditor.openDefault(),
  editGoods: () => Controllers.GoodsEditor.open(),
  editHeightmapButton: () => Controllers.HeightmapEditor.open(),
  editMeasurersButton: () => Controllers.MeasurersEditor.open(),
  editNamesBaseButton: () => Controllers.NamesbaseEditor.open(),
  editNotesButton: () => Controllers.NotesEditor.open(),
  editProvincesButton: () => Controllers.ProvincesEditor.open(),
  editReligions: () => Controllers.ReligionsEditor.open(),
  editStatesButton: () => Controllers.StatesEditor.open(),
  editTradeAnimationButton: () => Controllers.TradeAnimationEditor.open(),
  editUnitsButton: () => Controllers.UnitsEditor.open(),
  editZonesButton: () => Controllers.ZonesEditor.open(),
  openSubmapTool: () => Controllers.SubmapTool.open(),
  openTransformTool: () => Controllers.TransformTool.open(),
  overviewBurgsButton: () => Controllers.BurgsOverview.open(),
  overviewCellsButton: () => Controllers.CellInfo.open(),
  overviewChartsButton: () => Controllers.ChartsOverview.open(),
  overviewLabelsButton: () => Controllers.LabelsOverview.open(),
  overviewMarketsButton: () => Controllers.MarketsOverview.open(),
  overviewMarkersButton: () => Controllers.MarkersOverview.open(),
  overviewMilitaryButton: () => Controllers.MilitaryOverview.open(),
  overviewRiversButton: () => Controllers.RiversOverview.open(),
  overviewRoutesButton: () => Controllers.RoutesOverview.open()
} satisfies Record<string, () => unknown>;

export type ToolControllerCommandId = keyof typeof TOOL_COMMAND_HANDLERS;
export type ToolCommandResult = "blocked" | "executed" | "missing";

export function toolsAreAvailable(): boolean {
  if (typeof customization === "undefined" || !customization) return true;
  tip("Please exit the customization mode first", false, "error");
  return false;
}

export function invokeToolControllerCommand(commandId: string): ToolCommandResult {
  if (!toolsAreAvailable()) return "blocked";

  const handler = TOOL_COMMAND_HANDLERS[commandId as ToolControllerCommandId];
  if (!handler) return "missing";

  void handler();
  return "executed";
}
