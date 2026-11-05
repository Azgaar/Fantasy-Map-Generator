// Building blocks shared by editor dialogs

import { Dialog } from "@/ui/dialog/dialog";
import { t } from "@/utils/i18n";
import { findEl } from "@/utils/node-utils";

type EconomyRerunQuestion = {
  title: string;
  message: string;
  both: string; // the button that reruns it
  only: string; // the button that leaves it
  onChoice: (withEconomy: boolean) => void;
};

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
  "burgsOverviewRefresh",
  "routesOverviewRefresh",
  "riversOverviewRefresh",
  "featuresOverviewRefresh",
  "militaryOverviewRefresh",
  "regimentsOverviewRefresh",
  "markersOverviewRefresh",
  "journeysOverviewRefresh"
];

/** Close the dialogs about one burg, state, province or trade: after a regeneration their ids may name another */
export function closeEntityDialogs(): void {
  const dialogs = document.querySelectorAll(
    ".burgEconomyDialog, .stateEconomyDialog, .provinceEconomyDialog, #tradeDetails, #stateBudgetEditor, #tariffSelectorDialog"
  );
  for (const { id } of dialogs) Dialog.close(id);
}

/** Regenerating what the economy rests on asks each time whether the economy follows: it never reruns unasked */
export function askEconomyRerun({ title, message, both, only, onChoice }: EconomyRerunQuestion): void {
  Dialog.message({
    title,
    message,
    width: "32em",
    buttons: [
      { label: both, onClick: () => onChoice(true) },
      { label: only, onClick: () => onChoice(false) },
      { label: t("Cancel") }
    ]
  });
}

/** Refresh every editor that is currently open */
export function refreshEditors(): void {
  for (const buttonId of REFRESHABLE_EDITORS) findEl(buttonId)?.click();
}
