// Building blocks shared by editor dialogs

import { Dialog } from "@/ui/dialog/dialog";
import { findEl } from "@/utils/node-utils";

/** The note button every entity dialog puts in its toolbar, with its translated tooltip */
export function noteButton(id: string, tip: string): string {
  return `<button id="${id}" data-tip="${tip}" class="icon-book"></button>`;
}

/** The same button as a table row action, in the `note` column every editor table gives it */
export function noteIcon(tip: string): string {
  return `<span data-col="note" data-tip="${tip}" class="icon-book pointer"></span>`;
}

// TODO: editors should register a refresh callback when they open,
// so it can call them without needing to know their button IDs
const REFRESHABLE_EDITORS = [
  "culturesEditorRefresh",
  "biomesEditorRefresh",
  "diplomacyOverviewRefresh",
  "provincesEditorRefresh",
  "religionsEditorRefresh",
  "statesEditorRefresh",
  "zonesEditorRefresh",
  "goodsEditorRefresh",
  "marketsOverviewRefresh",
  "marketOverviewRefresh",
  "marketDealsRefresh",
  "marketsGoodCompareRefresh",
  "burgsOverviewRefresh",
  "routesOverviewRefresh",
  "riversOverviewRefresh",
  "featuresOverviewRefresh",
  "militaryOverviewRefresh",
  "developmentRefresh",
  "regimentsOverviewRefresh",
  "markersOverviewRefresh",
  "journeysOverviewRefresh"
];

/** Close dialogs about one entity: after a regeneration their ids may name another */
export function closeEntityDialogs(): void {
  const dialogs = document.querySelectorAll(
    ".burgEconomyDialog, .economyOverviewDialog, .stabilityDialog, [id^='stateEconomy'][id$='Table'], #marketOverview, #marketDeals, #tradeDetails, #stateBudgetEditor, #tariffSelectorDialog"
  );
  for (const { id } of dialogs) Dialog.close(id);
}

/** Refresh every editor that is currently open */
export function refreshEditors(): void {
  for (const buttonId of REFRESHABLE_EDITORS) findEl(buttonId)?.click();
}
