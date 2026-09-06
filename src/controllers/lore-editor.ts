// The Lore Editor: what the map is called, when it is set, and what the author has to say about
// it. Every control here edits `facts.lore` - the dialog is built and filled from the object on
// open, and nothing outside reads its inputs. See docs/architecture/configuration.md
import { closeDialogs, destroyDialog } from "@/components/dialog/dialog-helpers";
import type { SettingKey } from "@/components/settings";
import { bindSettings, syncSetting, syncSettings } from "@/components/settings-binding";
import { Names } from "@/generators/names-generator";
import { ensureEl } from "../utils";
import { bindLockIcons, lock, unlock } from "../utils/preferences";

const DIALOG_ID = "loreEditor";

const TEMPLATE = /* html */ `
  <style>
    #${DIALOG_ID} .le { display: grid; grid-template-columns: 1em 5.6em minmax(0, 1fr) 1.2em; gap: .3em; align-items: center; width: 23em; }
    #${DIALOG_ID} .le > label[for="loreDescription"] { align-self: start; padding-top: .35em; }
    #${DIALOG_ID} .le-era { display: flex; align-items: center; gap: .4em; min-width: 0; }
    #${DIALOG_ID} .le-era > input:first-child { flex: 1; min-width: 0; }
    #${DIALOG_ID} .le-era > input:last-child { flex: 0 0 3.4em; }
    #${DIALOG_ID} input, #${DIALOG_ID} textarea { width: 100%; box-sizing: border-box; font: inherit; }
    #${DIALOG_ID} textarea { resize: vertical; }
    #${DIALOG_ID} .le > i { cursor: pointer; justify-self: center; }
    #${DIALOG_ID} .le > i[data-locked] { font-size: .8em; color: #626573; }
  </style>

  <div class="le">
    <i data-locked="0" id="lock_mapName" class="icon-lock-open"></i>
    <label for="loreMapName">Map name:</label>
    <input
      id="loreMapName"
      data-stored="mapName"
      data-tip="Name of the map. Used to name the files it is downloaded as"
      autocorrect="off"
      spellcheck="false"
      type="text"
    />
    <i data-tip="Generate a new map name" id="loreMapNameRegenerate" class="icon-arrows-cw"></i>

    <i data-locked="0" id="lock_year" class="icon-lock-open"></i>
    <label for="loreYear">Year:</label>
    <input
      id="loreYear"
      data-stored="year"
      data-tip="Current year. Dates state history and battle reports"
      type="number"
      step="1"
    />
    <span></span>

    <i data-locked="0" id="lock_era" data-ids="era,eraShort" class="icon-lock-open"></i>
    <label for="loreEra">Era:</label>
    <span class="le-era" data-tip="Name of the era the current year belongs to, and its abbreviation">
      <input id="loreEra" data-stored="era" autocorrect="off" spellcheck="false" type="text" placeholder="Winter Era" />
      <input id="loreEraShort" data-stored="eraShort" autocorrect="off" spellcheck="false" type="text" placeholder="WE" />
    </span>
    <i data-tip="Generate a new era" id="loreEraRegenerate" class="icon-arrows-cw"></i>

    <span></span>
    <label for="loreDescription">Description:</label>
    <textarea
      id="loreDescription"
      rows="5"
      data-tip="Your own description of this world. Free text, carried in the map file"
      placeholder="Describe the map, its age, its peoples – whatever the map should carry with it."
    ></textarea>
    <span></span>
  </div>
`;

function open(): void {
  closeDialogs("#loreEditor, .stable");
  renderDialog();

  $(`#${DIALOG_ID}`).dialog({
    title: "Setup Lore",
    width: "auto",
    minWidth: 340,
    position: { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" },
    close: () => destroyDialog(DIALOG_ID)
  });
}

function renderDialog(): void {
  destroyDialog(DIALOG_ID);
  ensureEl("dialogs").insertAdjacentHTML(
    "beforeend",
    /* html */ `<div id="${DIALOG_ID}" class="dialog stable">${TEMPLATE}</div>`
  );

  fillInputs();
  addListeners();
  bindLockIcons(ensureEl(DIALOG_ID));
}

const LORE_KEYS: SettingKey[] = ["mapName", "year", "era", "eraShort"];

/** The object is the source: push what it holds into the control that shows it */
function fillInputs(): void {
  syncSettings(LORE_KEYS);
  ensureEl<HTMLTextAreaElement>("loreDescription").value = facts.lore.description;
}

function addListeners(): void {
  bindSettings(ensureEl(DIALOG_ID), abbreviateEra);

  // the description is the one lore value with no pin: nothing ever re-rolls an author's note
  ensureEl("loreDescription").addEventListener("change", changeDescription);
  ensureEl("loreMapNameRegenerate").addEventListener("click", regenerateMapName);
  ensureEl("loreEraRegenerate").addEventListener("click", regenerateEra);
}

/**
 * Renaming the era suggests an abbreviation, which the user can then override in the field beside
 * it. Not a derived fact - a short form the user typed outlives the era it was made for
 */
function abbreviateEra(key: SettingKey): void {
  if (key !== "era") return;
  facts.lore.calendar.eraShort = Facts.shortEra();
  lock("eraShort");
  syncSetting("eraShort");
}

function changeDescription(this: HTMLTextAreaElement): void {
  facts.lore.description = this.value;
}

function regenerateMapName(): void {
  Names.getMapName(true); // writes facts.lore.name, and unpins the name if the user had pinned it
  fillInputs();
}

function regenerateEra(): void {
  unlock("era");
  unlock("eraShort");
  facts.lore.calendar.era = Facts.randomEra();
  facts.lore.calendar.eraShort = Facts.shortEra();
  fillInputs();
}

export const LoreEditor = { open };
