import type { IconName } from "@patkepa/kantzen-ui/icons";
import {
  invokeToolControllerCommand,
  type ToolCommandResult,
  type ToolControllerCommandId
} from "./tool-command-executor";
import { dispatchRegenerationCommand, type RegenerationCommandTarget } from "./ui/regeneration-command";

export type ToolGroupId = "world" | "politics" | "settlements" | "geography" | "analysis" | "create" | "regenerate";

export interface ToolGroup {
  description: string;
  icon: IconName;
  id: ToolGroupId;
  label: string;
}

export interface ToolCommandContext {
  ctrlKey?: boolean;
  metaKey?: boolean;
  regenerationTarget?: RegenerationCommandTarget;
}

export interface ToolSecondaryAction {
  ariaLabel: string;
  controlId: ToolControllerCommandId;
  icon: IconName;
  id: string;
  invoke: () => ToolCommandResult;
  label: string;
}

export interface ToolCommand {
  controlId: string;
  description: string;
  destructive?: boolean;
  group: ToolGroupId;
  icon: IconName;
  id: string;
  invoke: (context?: ToolCommandContext) => ToolCommandResult | boolean;
  label: string;
  searchTerms: readonly string[];
  secondaryAction?: ToolSecondaryAction;
  shortcut?: string;
}

export const TOOL_GROUPS: readonly ToolGroup[] = [
  { id: "world", label: "World", icon: "globe-network", description: "Terrain, climate, biomes, and map units" },
  { id: "politics", label: "Politics", icon: "people", description: "States, cultures, faiths, and diplomacy" },
  { id: "settlements", label: "Settlements", icon: "home", description: "Burgs, markets, trade, and goods" },
  { id: "geography", label: "Geography", icon: "map", description: "Rivers, routes, labels, and map features" },
  { id: "analysis", label: "Analysis", icon: "chart", description: "Inspect and compare map data" },
  { id: "create", label: "Create", icon: "plus", description: "Place features or derive a new map" },
  { id: "regenerate", label: "Regenerate", icon: "refresh", description: "Rebuild generated map data" }
] as const;

const GROUPS_BY_ID = Object.fromEntries(TOOL_GROUPS.map(group => [group.id, group])) as Record<ToolGroupId, ToolGroup>;

interface ControllerCommandOptions {
  controlId: ToolControllerCommandId;
  description: string;
  group: Exclude<ToolGroupId, "regenerate">;
  id: string;
  label: string;
  searchTerms?: readonly string[];
  shortcut?: string;
}

interface RegenerationCommandOptions {
  controlId: string;
  description: string;
  id: string;
  label: string;
  searchTerms?: readonly string[];
  secondaryAction?: ToolSecondaryAction;
}

function controllerCommand(options: ControllerCommandOptions): ToolCommand {
  return {
    ...options,
    icon: GROUPS_BY_ID[options.group].icon,
    invoke: () => invokeToolControllerCommand(options.controlId),
    searchTerms: options.searchTerms ?? []
  };
}

function regenerationCommand(options: RegenerationCommandOptions): ToolCommand {
  return {
    ...options,
    destructive: true,
    group: "regenerate",
    icon: GROUPS_BY_ID.regenerate.icon,
    invoke: context =>
      dispatchRegenerationCommand(
        options.controlId,
        { ctrlKey: Boolean(context?.ctrlKey), metaKey: Boolean(context?.metaKey) },
        context?.regenerationTarget
      ),
    searchTerms: options.searchTerms ?? []
  };
}

const MARKER_SETTINGS_ACTION: ToolSecondaryAction = {
  ariaLabel: "Marker regeneration settings",
  controlId: "configRegenerateMarkers",
  icon: "settings",
  id: "regenerate.markers.settings",
  invoke: () => invokeToolControllerCommand("configRegenerateMarkers"),
  label: "Settings"
};

export const TOOL_COMMANDS: readonly ToolCommand[] = [
  controllerCommand({
    id: "world.heightmap",
    controlId: "editHeightmapButton",
    label: "Heightmap",
    description: "Edit terrain elevation and land shape",
    group: "world",
    shortcut: "Shift + H",
    searchTerms: ["terrain", "elevation", "land"]
  }),
  controllerCommand({
    id: "world.biomes",
    controlId: "editBiomesButton",
    label: "Biomes",
    description: "Edit biome assignments and colors",
    group: "world",
    shortcut: "Shift + B",
    searchTerms: ["climate", "environment", "vegetation"]
  }),
  controllerCommand({
    id: "world.units",
    controlId: "editUnitsButton",
    label: "Units",
    description: "Configure distance, height, area, and temperature units",
    group: "world",
    shortcut: "Shift + Q",
    searchTerms: ["scale", "measurement", "temperature"]
  }),
  controllerCommand({
    id: "world.namesbase",
    controlId: "editNamesBaseButton",
    label: "Namesbase",
    description: "Manage generated name sets",
    group: "world",
    shortcut: "Shift + N",
    searchTerms: ["names", "language", "generator"]
  }),
  controllerCommand({
    id: "politics.states",
    controlId: "editStatesButton",
    label: "States",
    description: "Edit states and their attributes",
    group: "politics",
    shortcut: "Shift + S",
    searchTerms: ["countries", "nations", "borders"]
  }),
  controllerCommand({
    id: "politics.provinces",
    controlId: "editProvincesButton",
    label: "Provinces",
    description: "Edit state provinces",
    group: "politics",
    shortcut: "Shift + P",
    searchTerms: ["regions", "administration"]
  }),
  controllerCommand({
    id: "politics.diplomacy",
    controlId: "editDiplomacyButton",
    label: "Diplomacy",
    description: "Edit relationships between states",
    group: "politics",
    shortcut: "Shift + D",
    searchTerms: ["relations", "allies", "wars"]
  }),
  controllerCommand({
    id: "politics.cultures",
    controlId: "editCulturesButton",
    label: "Cultures",
    description: "Edit cultures and their territories",
    group: "politics",
    shortcut: "Shift + C",
    searchTerms: ["people", "ethnicity", "society"]
  }),
  controllerCommand({
    id: "politics.religions",
    controlId: "editReligions",
    label: "Religions",
    description: "Edit religions and their territories",
    group: "politics",
    shortcut: "Shift + R",
    searchTerms: ["faith", "belief"]
  }),
  controllerCommand({
    id: "politics.emblems",
    controlId: "editEmblemButton",
    label: "Emblems",
    description: "Edit state, province, and burg emblems",
    group: "politics",
    shortcut: "Shift + Y",
    searchTerms: ["coat of arms", "heraldry", "coa"]
  }),
  controllerCommand({
    id: "politics.military",
    controlId: "overviewMilitaryButton",
    label: "Military",
    description: "Review military forces and regiments",
    group: "politics",
    shortcut: "Shift + M",
    searchTerms: ["army", "forces", "regiments"]
  }),
  controllerCommand({
    id: "settlements.burgs",
    controlId: "overviewBurgsButton",
    label: "Burgs",
    description: "Review and edit settlements",
    group: "settlements",
    shortcut: "Shift + T",
    searchTerms: ["cities", "towns", "population"]
  }),
  controllerCommand({
    id: "settlements.markets",
    controlId: "overviewMarketsButton",
    label: "Markets",
    description: "Review markets and their territories",
    group: "settlements",
    searchTerms: ["economy", "commerce", "trade"]
  }),
  controllerCommand({
    id: "settlements.goods",
    controlId: "editGoods",
    label: "Goods",
    description: "Edit resources and production goods",
    group: "settlements",
    shortcut: "Shift + G",
    searchTerms: ["economy", "resources", "production"]
  }),
  controllerCommand({
    id: "settlements.trade",
    controlId: "editTradeAnimationButton",
    label: "Trade",
    description: "Inspect animated trade routes",
    group: "settlements",
    searchTerms: ["economy", "deals", "commerce"]
  }),
  controllerCommand({
    id: "geography.coastlines",
    controlId: "editCoastlineSettings",
    label: "Coastlines",
    description: "Edit coastline groups and rendering",
    group: "geography",
    searchTerms: ["ocean", "land", "shore"]
  }),
  controllerCommand({
    id: "geography.rivers",
    controlId: "overviewRiversButton",
    label: "Rivers",
    description: "Review and edit rivers",
    group: "geography",
    shortcut: "Shift + V",
    searchTerms: ["water", "hydrology"]
  }),
  controllerCommand({
    id: "geography.routes",
    controlId: "overviewRoutesButton",
    label: "Routes",
    description: "Review and edit roads and sea routes",
    group: "geography",
    shortcut: "Shift + U",
    searchTerms: ["roads", "paths", "transport"]
  }),
  controllerCommand({
    id: "geography.zones",
    controlId: "editZonesButton",
    label: "Zones",
    description: "Edit map zones and annotations",
    group: "geography",
    shortcut: "Shift + Z",
    searchTerms: ["areas", "regions", "overlays"]
  }),
  controllerCommand({
    id: "geography.markers",
    controlId: "overviewMarkersButton",
    label: "Markers",
    description: "Review and edit map markers",
    group: "geography",
    shortcut: "Shift + K",
    searchTerms: ["points", "icons", "locations"]
  }),
  controllerCommand({
    id: "geography.labels",
    controlId: "overviewLabelsButton",
    label: "Labels",
    description: "Review and edit map labels",
    group: "geography",
    shortcut: "Shift + L",
    searchTerms: ["text", "names", "typography"]
  }),
  controllerCommand({
    id: "geography.measurers",
    controlId: "editMeasurersButton",
    label: "Measurers",
    description: "Measure distance and area on the map",
    group: "geography",
    shortcut: "Shift + =",
    searchTerms: ["ruler", "distance", "area"]
  }),
  controllerCommand({
    id: "analysis.cells",
    controlId: "overviewCellsButton",
    label: "Cell Details",
    description: "Inspect data for an individual map cell",
    group: "analysis",
    shortcut: "Shift + E",
    searchTerms: ["inspect", "details", "data"]
  }),
  controllerCommand({
    id: "analysis.charts",
    controlId: "overviewChartsButton",
    label: "Charts",
    description: "Explore map data in charts",
    group: "analysis",
    shortcut: "Shift + A",
    searchTerms: ["statistics", "graphs", "data"]
  }),
  controllerCommand({
    id: "analysis.notes",
    controlId: "editNotesButton",
    label: "Notes",
    description: "Review and edit feature notes",
    group: "analysis",
    shortcut: "Shift + O",
    searchTerms: ["annotations", "text", "information"]
  }),
  controllerCommand({
    id: "create.burg",
    controlId: "addBurgTool",
    label: "Place Burg",
    description: "Place a settlement on the map",
    group: "create",
    shortcut: "Shift + 1",
    searchTerms: ["add", "city", "town", "settlement"]
  }),
  controllerCommand({
    id: "create.label",
    controlId: "addLabel",
    label: "Place Label",
    description: "Place a custom label on the map",
    group: "create",
    shortcut: "Shift + 2",
    searchTerms: ["add", "text", "name"]
  }),
  controllerCommand({
    id: "create.marker",
    controlId: "addMarker",
    label: "Place Marker",
    description: "Place a marker on the map",
    group: "create",
    shortcut: "Shift + 3",
    searchTerms: ["add", "point", "icon"]
  }),
  controllerCommand({
    id: "create.river",
    controlId: "addRiver",
    label: "Draw River",
    description: "Create a river from a map point",
    group: "create",
    shortcut: "Shift + 4",
    searchTerms: ["add", "water", "hydrology"]
  }),
  controllerCommand({
    id: "create.route",
    controlId: "addRoute",
    label: "Draw Route",
    description: "Create a road or sea route",
    group: "create",
    shortcut: "Shift + 5",
    searchTerms: ["add", "road", "path"]
  }),
  controllerCommand({
    id: "create.submap",
    controlId: "openSubmapTool",
    label: "Create Submap",
    description: "Generate a map from the current viewport",
    group: "create",
    searchTerms: ["crop", "derive", "viewport"]
  }),
  controllerCommand({
    id: "create.transform",
    controlId: "openTransformTool",
    label: "Transform Map",
    description: "Rotate, mirror, or rescale the map",
    group: "create",
    searchTerms: ["resize", "rotate", "flip"]
  }),
  regenerationCommand({
    id: "regenerate.burgs",
    controlId: "regenerateBurgs",
    label: "Burgs",
    description: "Regenerate unlocked burgs and routes",
    searchTerms: ["settlements", "cities", "towns"]
  }),
  regenerationCommand({
    id: "regenerate.cultures",
    controlId: "regenerateCultures",
    label: "Cultures",
    description: "Regenerate non-locked cultures",
    searchTerms: ["politics", "people"]
  }),
  regenerationCommand({
    id: "regenerate.economy",
    controlId: "regenerateEconomy",
    label: "Economy",
    description: "Rebuild markets, production, trade, and taxes",
    searchTerms: ["settlements", "commerce"]
  }),
  regenerationCommand({
    id: "regenerate.emblems",
    controlId: "regenerateEmblems",
    label: "Emblems",
    description: "Regenerate all coats of arms",
    searchTerms: ["politics", "heraldry", "coa"]
  }),
  regenerationCommand({
    id: "regenerate.goods",
    controlId: "regenerateGoods",
    label: "Goods",
    description: "Regenerate bonus goods placement",
    searchTerms: ["settlements", "resources"]
  }),
  regenerationCommand({
    id: "regenerate.ice",
    controlId: "regenerateIce",
    label: "Ice",
    description: "Regenerate icebergs and glaciers",
    searchTerms: ["world", "climate"]
  }),
  regenerationCommand({
    id: "regenerate.state-labels",
    controlId: "regenerateStateLabels",
    label: "State Labels",
    description: "Update state-label placement from current borders",
    searchTerms: ["politics", "geography", "text"]
  }),
  regenerationCommand({
    id: "regenerate.markers",
    controlId: "regenerateMarkers",
    label: "Markers",
    description: "Regenerate unlocked markers",
    searchTerms: ["geography", "points", "icons"],
    secondaryAction: MARKER_SETTINGS_ACTION
  }),
  regenerationCommand({
    id: "regenerate.markets",
    controlId: "regenerateMarkets",
    label: "Markets",
    description: "Regenerate markets and their territories",
    searchTerms: ["settlements", "economy"]
  }),
  regenerationCommand({
    id: "regenerate.military",
    controlId: "regenerateMilitary",
    label: "Military",
    description: "Recalculate military forces",
    searchTerms: ["politics", "army", "regiments"]
  }),
  regenerationCommand({
    id: "regenerate.population",
    controlId: "regeneratePopulation",
    label: "Population",
    description: "Recalculate rural and urban population",
    searchTerms: ["world", "settlements", "people"]
  }),
  regenerationCommand({
    id: "regenerate.production",
    controlId: "regenerateProduction",
    label: "Production",
    description: "Regenerate production and trade deals",
    searchTerms: ["settlements", "economy", "goods"]
  }),
  regenerationCommand({
    id: "regenerate.provinces",
    controlId: "regenerateProvinces",
    label: "Provinces",
    description: "Regenerate non-locked provinces",
    searchTerms: ["politics", "regions"]
  }),
  regenerationCommand({
    id: "regenerate.relief",
    controlId: "regenerateReliefIcons",
    label: "Relief",
    description: "Regenerate relief icons from biome and elevation",
    searchTerms: ["geography", "terrain", "mountains"]
  }),
  regenerationCommand({
    id: "regenerate.religions",
    controlId: "regenerateReligions",
    label: "Religions",
    description: "Regenerate non-locked religions",
    searchTerms: ["politics", "faith"]
  }),
  regenerationCommand({
    id: "regenerate.rivers",
    controlId: "regenerateRivers",
    label: "Rivers",
    description: "Restore generated rivers",
    searchTerms: ["geography", "water", "hydrology"]
  }),
  regenerationCommand({
    id: "regenerate.routes",
    controlId: "regenerateRoutes",
    label: "Routes",
    description: "Regenerate unlocked routes",
    searchTerms: ["geography", "roads", "paths"]
  }),
  regenerationCommand({
    id: "regenerate.states",
    controlId: "regenerateStates",
    label: "States",
    description: "Regenerate non-locked states",
    searchTerms: ["politics", "countries", "nations"]
  }),
  regenerationCommand({
    id: "regenerate.zones",
    controlId: "regenerateZones",
    label: "Zones",
    description: "Regenerate map zones",
    searchTerms: ["geography", "areas", "regions"]
  })
] as const;

export function matchesToolCommand(command: ToolCommand, query: string): boolean {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return true;

  const group = GROUPS_BY_ID[command.group];
  return [command.id, command.label, command.description, group.label, group.description, ...command.searchTerms]
    .join(" ")
    .toLocaleLowerCase()
    .includes(normalizedQuery);
}

export function getToolCommands(group: ToolGroupId, query = ""): ToolCommand[] {
  return TOOL_COMMANDS.filter(command => command.group === group && matchesToolCommand(command, query));
}
