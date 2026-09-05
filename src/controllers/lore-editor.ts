// The Lore Editor: what the map is called, when it is set, and what the author has to say about
// it. Every control here edits `facts.lore` - the dialog is built and filled from the object on
// open, and nothing outside reads its inputs. See docs/architecture/configuration.md
import { closeDialogs, destroyDialog } from "@/components/dialog/dialog-helpers";
import { tip } from "@/components/tooltips";
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
      data-tip="Current year. Dates state history and battle reports"
      type="number"
      step="1"
    />
    <span></span>

    <i data-locked="0" id="lock_era" data-ids="era,eraShort" class="icon-lock-open"></i>
    <label for="loreEra">Era:</label>
    <span class="le-era" data-tip="Name of the era the current year belongs to, and its abbreviation">
      <input id="loreEra" autocorrect="off" spellcheck="false" type="text" placeholder="Winter Era" />
      <input id="loreEraShort" autocorrect="off" spellcheck="false" type="text" placeholder="WE" />
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

/** The object is the source: push what it holds into the control that shows it */
function fillInputs(): void {
  const { name, description, calendar } = facts.lore;
  ensureEl<HTMLInputElement>("loreMapName").value = name;
  ensureEl<HTMLInputElement>("loreYear").value = String(calendar.year);
  ensureEl<HTMLInputElement>("loreEra").value = calendar.era;
  ensureEl<HTMLInputElement>("loreEraShort").value = calendar.eraShort;
  ensureEl<HTMLTextAreaElement>("loreDescription").value = description;
}

function addListeners(): void {
  ensureEl("loreMapName").addEventListener("change", changeMapName);
  ensureEl("loreYear").addEventListener("change", changeYear);
  ensureEl("loreEra").addEventListener("change", changeEra);
  ensureEl("loreEraShort").addEventListener("change", changeEraShort);
  ensureEl("loreDescription").addEventListener("change", changeDescription);
  ensureEl("loreMapNameRegenerate").addEventListener("click", regenerateMapName);
  ensureEl("loreEraRegenerate").addEventListener("click", regenerateEra);
}

function changeMapName(this: HTMLInputElement): void {
  facts.lore.name = this.value;
  lock("mapName"); // named by hand: the next map keeps it
}

function changeYear(this: HTMLInputElement): void {
  if (!this.value) return;
  if (Number.isNaN(+this.value)) return void tip("Current year should be a number", false, "error");

  facts.lore.calendar.year = +this.value;
  lock("year");
}

/** Renaming the era re-derives its abbreviation, which the user can then override below */
function changeEra(this: HTMLInputElement): void {
  if (!this.value) return;
  facts.lore.calendar.era = this.value;
  facts.lore.calendar.eraShort = Facts.shortEra();
  lock("era");
  lock("eraShort");
  ensureEl<HTMLInputElement>("loreEraShort").value = facts.lore.calendar.eraShort;
}

function changeEraShort(this: HTMLInputElement): void {
  if (!this.value) return;
  facts.lore.calendar.eraShort = this.value;
  lock("eraShort");
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
