// Tools tab: buttons dispatch the same commands as global search.
import { MAP_COMMANDS } from "@/components/map-commands";
import { tip } from "@/components/tooltips";
import { ensureEl } from "@/utils";
import { sentences, t } from "@/utils/i18n";

const TEMPLATE = /* html */ `
  <div class="separator">${t("Edit")}</div>
  <div class="grid">
    <button id="editBiomesButton" data-tip="${t("Open Biomes Editor")}" data-shortcut="Shift + B">
      ${t("Biomes")}
    </button>
    <button id="overviewBurgsButton" data-tip="${t("Open Burgs Overview")}" data-shortcut="Shift + T">
      ${t("Burgs")}
    </button>
    <button
      id="editCoastlineSettings"
      data-tip="${t("Open Coastline Editor")}"
    >
      ${t("Coastlines")}
    </button>
    <button id="editCulturesButton" data-tip="${t("Open Cultures Editor")}" data-shortcut="Shift + C">
      ${t("Cultures")}
    </button>
    <button
      id="editDiplomacyButton"
      data-tip="${t("Click to open Diplomatical relationships Editor")}"
      data-shortcut="Shift + D"
    >
      ${t("Diplomacy")}
    </button>
    <button id="editEmblemButton" data-tip="${t("Click to open Emblem Editor")}" data-shortcut="Shift + Y">
      ${t("Emblems")}
    </button>
    <button id="overviewFeaturesButton" data-tip="${t("Open Geographical Features Overview")}" data-shortcut="Shift + F">
      ${t("Features")}
    </button>
    <button id="editGoods" data-tip="${t("Open Goods Editor")}" data-shortcut="Shift + G">${t("Goods")}</button>
    <button
      id="editHeightmapButton"
      data-tip="${t("Click to open Heightmap customization menu")}"
      data-shortcut="Shift + H"
    >
      ${t("Heightmap")}
    </button>
    <button id="overviewMarkersButton" data-tip="${t("Open Markers Overview")}" data-shortcut="Shift + K">
      ${t("Markers")}
    </button>
    <button id="overviewMarketsButton" data-tip="${t("Open Markets Overview")}">
      ${t("Markets")}
    </button>
    <button id="editMeasurersButton" data-tip="${t("Open Measurers Editor")}" data-shortcut="Shift + =">
      ${t("Measurers")}
    </button>
    <button id="overviewLabelsButton" data-tip="${t("Open Labels Overview")}" data-shortcut="Shift + L">
      ${t("Labels")}
    </button>
    <button
      id="overviewMilitaryButton"
      data-tip="${t("Click to open Military Forces Overview")}"
      data-shortcut="Shift + M"
    >
      ${t("Military")}
    </button>
    <button id="editNamesBaseButton" data-tip="${t("Open Namesbase Editor")}" data-shortcut="Shift + N">
      ${t("Namesbase")}
    </button>
    <button id="editNotesButton" data-tip="${t("Open Notes Editor")}" data-shortcut="Shift + O">${t("Notes")}</button>
    <button id="editProvincesButton" data-tip="${t("Open Provinces Editor")}" data-shortcut="Shift + P">
      ${t("Provinces")}
    </button>
    <button id="editReligions" data-tip="${t("Open Religions Editor")}" data-shortcut="Shift + R">
      ${t("Religions")}
    </button>
    <button id="overviewRiversButton" data-tip="${t("Open Rivers Overview")}" data-shortcut="Shift + V">
      ${t("Rivers")}
    </button>
    <button id="overviewRoutesButton" data-tip="${t("Open Routes Overview")}" data-shortcut="Shift + U">
      ${t("Routes")}
    </button>
    <button id="overviewJourneysButton" data-tip="${t("Open Journeys Overview")}" data-shortcut="Shift + J">
      ${t("Journeys")}
    </button>
    <button id="editStatesButton" data-tip="${t("Open States Editor")}" data-shortcut="Shift + S">
      ${t("States")}
    </button>
    <button id="editTradeAnimationButton" data-tip="${t("Open Trade Animation Editor")}">
      ${t("Trade")}
    </button>
    <button id="editUnitsButton" data-tip="${t("Open Units Editor")}" data-shortcut="Shift + Q">${t("Units")}</button>
    <button id="editZonesButton" data-tip="${t("Open Zones Editor")}" data-shortcut="Shift + Z">${t("Zones")}</button>
  </div>
  <div class="separator">${t("Regenerate")}</div>
  <div id="regenerateFeature" class="grid">
    <button
      id="regenerateBurgs"
      data-tip="${sentences(t("Click to regenerate all unlocked burgs and routes"), t("States will remain as they are"), t("Note: burgs are only generated in populated areas with culture assigned"))}"
    >
      ${t("Burgs")}
    </button>
    <button id="regenerateCultures" data-tip="${t("Click to regenerate non-locked cultures")}">${t("Cultures")}</button>
    <button
      id="regenerateEconomy"
      data-tip="${t("Rebuild market territories, production, trade deals, and taxes from the current goods and markets")}"
    >
      ${t("Economy")}
    </button>
    <button id="regenerateEmblems" data-tip="${t("Click to regenerate all emblems")}">${t("Emblems")}</button>
    <button id="regenerateGoods" data-tip="${t("Regenerate bonus goods placement")}">${t("Goods")}</button>
    <button id="regenerateIce" data-tip="${t("Click to regenerate icebergs and glaciers")}">${t("Ice")}</button>
    <button
      id="regenerateStateLabels"
      data-tip="${t("Click to update state labels placement based on current borders")}"
    >
      ${t("State Labels")}
    </button>
    <button id="regenerateMarkers" data-tip="${t("Regenerate unlocked markers")}">
      ${t("Markers")} <i id="configRegenerateMarkers" class="icon-cog" data-tip="${t("Click to set number multiplier")}"></i>
    </button>
    <button id="regenerateMarkets" data-tip="${t("Regenerate markets and their territories")}">
      ${t("Markets")}
    </button>
    <button
      id="regenerateMilitary"
      data-tip="${t("Recalculate military forces based on current options")}"
    >
      ${t("Military")}
    </button>
    <button id="regeneratePopulation" data-tip="${t("Click to recalculate rural and urban population")}">
      ${t("Population")}
    </button>
    <button
      id="regenerateProduction"
      data-tip="${t("Regenerate production and trade deals")}"
    >
      ${t("Production")}
    </button>
    <button
      id="regenerateProvinces"
      data-tip="${sentences(t("Click to regenerate non-locked provinces"), t("States will remain as they are"))}"
    >
      ${t("Provinces")}
    </button>
    <button
      id="regenerateReliefIcons"
      data-tip="${t("Click to regenerate all relief icons based on current cell biome and elevation")}"
    >
      ${t("Relief")}
    </button>
    <button id="regenerateReligions" data-tip="${t("Click to regenerate non-locked religions")}">${t("Religions")}</button>
    <button id="regenerateRivers" data-tip="${t("Click to regenerate all rivers (restore default state)")}">
      ${t("Rivers")}
    </button>
    <button id="regenerateRoutes" data-tip="${t("Click to regenerate all unlocked routes")}">${t("Routes")}</button>
    <button
      id="regenerateStates"
      data-tip="${t("Click to regenerate non-locked states. Emblems and military forces will be regenerated as well, burgs will remain as they are, but capitals will be different")}"
    >
      ${t("States")}
    </button>
    <button
      id="regenerateZones"
      data-tip="${t("Click to regenerate zones. Hold Ctrl and click to set zones number multiplier")}"
    >
      ${t("Zones")}
    </button>
  </div>
  <div class="separator">${t("Add")}</div>
  <div id="addFeature" class="grid">
    <button
      id="addBurgTool"
      data-tip="${sentences(t("Click on map to place a burg"), t("Hold Shift to add multiple"))}"
      data-shortcut="Shift + 1"
    >
      ${t("Burg")}
    </button>
    <button
      id="addLabel"
      data-tip="${sentences(t("Click on map to place label"), t("Hold Shift to add multiple"))}"
      data-shortcut="Shift + 2"
    >
      ${t("Label")}
    </button>
    <button
      id="addMarker"
      data-tip="${sentences(t("Click on map to place a marker"), t("Hold Shift to add multiple"))}"
      data-shortcut="Shift + 3"
    >
      ${t("Marker")}
    </button>
    <input type="hidden" id="addedMarkerType" name="addedMarkerType" value="" />
    <button
      id="addRiver"
      data-tip="${sentences(t("Click on map to place a river"), t("Hold Shift to add multiple"))}"
      data-shortcut="Shift + 4"
    >
      ${t("River")}
    </button>
    <button id="addRoute" data-tip="${t("Open route creation dialog")}" data-shortcut="Shift + 5">${t("Route")}</button>
  </div>
  <div class="separator">${t("Show")}</div>
  <div class="grid">
    <button id="overviewCellsButton" data-tip="${t("Click to open Cell details view")}" data-shortcut="Shift + E">
      ${t("Cells")}
    </button>
    <button
      id="overviewChartsButton"
      data-tip="${t("Click to open Charts to overview cells data")}"
      data-shortcut="Shift + A"
    >
      ${t("Charts")}
    </button>
    <button id="openMinimapButton" data-tip="${t("Click to open minimap overview. Click minimap to center view")}">
      ${t("Minimap")}
    </button>
  </div>
  <div class="separator">${t("Create")}</div>
  <div class="grid">
    <button id="openSubmapTool" data-tip="${t("Click to generate a submap from the current viewport")}">${t("Submap")}</button>
    <button id="openTransformTool" data-tip="${t("Click to transform the map")}">${t("Transform")}</button>
    <button id="openWrapTool" data-tip="${t("Adjust cell shapes with a brush")}">${t("Wrap")}</button>
  </div>
`;

ensureEl("toolsContent").innerHTML = TEMPLATE;

ensureEl("toolsContent").addEventListener("click", event => {
  if (customization) return tip(t("Exit customization mode first"), false, "error");
  if (!(event instanceof MouseEvent) || !(event.target instanceof HTMLElement)) return;
  if (!["BUTTON", "I"].includes(event.target.tagName)) return;
  const command = MAP_COMMANDS.find(command => command.id === (event.target as HTMLElement).id);
  if (command) void command.run(event);
});
