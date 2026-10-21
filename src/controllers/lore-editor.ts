// The Lore Editor: what the map is called, when it is set, and what the author has to say about
// it. Every control edits `options.map.lore` through the Lore model - the dialog is built and filled from
// the object on open, and nothing outside reads its inputs. See docs/architecture/configuration.md
import { closeDialogs, destroyDialog } from "@/components/dialog/dialog-helpers";
import { Pins } from "@/components/pins";
import { Lore } from "@/generators/lore";
import { Names } from "@/generators/names-generator";
import { ensureEl } from "../utils";

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

    <span></span>
    <label for="loreHistorySpan">History span:</label>
    <input
      id="loreHistorySpan"
      data-tip="How many years before the current year the chronicle reaches back. Regenerate history to apply"
      type="number"
      step="100"
      min="100"
    />
    <span></span>

    <span></span>
    <label for="loreHistoryRealms">Fallen realms:</label>
    <input
      id="loreHistoryRealms"
      data-tip="How many fallen empires the chronicle weaves into the map. 0 turns them off. Regenerate history to apply"
      type="number"
      step="1"
      min="0"
      max="10"
    />
    <span></span>

    <span></span>
    <label for="loreHistoryDensity">Event density:</label>
    <input
      id="loreHistoryDensity"
      data-tip="Multiplier on how many events the chronicle records. Regenerate history to apply"
      type="number"
      step="0.5"
      min="0"
      max="10"
    />
    <span></span>

    <span></span>
    <label for="loreHistoryEchoes">Echoes:</label>
    <span data-tip="Let fallen realms leave ruins, battlefields and notes on the map">
      <input id="loreHistoryEchoes" type="checkbox" />
    </span>
    <span></span>

    <span></span>
    <label for="loreHistoryRenames">Renames:</label>
    <span data-tip="Let a successor state inherit the fallen realm's name (New X)">
      <input id="loreHistoryRenames" type="checkbox" />
    </span>
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
  Pins.bindIcons(ensureEl(DIALOG_ID), loreValue);
}

/** What each lock icon in this dialog pins; the era icon pins its abbreviation alongside */
function loreValue(key: string): string | number | undefined {
  const { name, calendar } = options.map.lore;
  if (key === "mapName") return name;
  if (key === "year") return calendar.year;
  if (key === "era") return calendar.era;
  if (key === "eraShort") return calendar.eraShort;
  return undefined;
}

/** The object is the source: push what it holds into the control that shows it */
function fillInputs(): void {
  const { name, description, calendar, history } = options.map.lore;
  ensureEl<HTMLInputElement>("loreMapName").value = name;
  ensureEl<HTMLInputElement>("loreYear").value = String(calendar.year);
  ensureEl<HTMLInputElement>("loreEra").value = calendar.era;
  ensureEl<HTMLInputElement>("loreEraShort").value = calendar.eraShort;
  ensureEl<HTMLTextAreaElement>("loreDescription").value = description;
  ensureEl<HTMLInputElement>("loreHistorySpan").value = String(history.span);
  ensureEl<HTMLInputElement>("loreHistoryRealms").value = String(history.realms);
  ensureEl<HTMLInputElement>("loreHistoryDensity").value = String(history.density);
  ensureEl<HTMLInputElement>("loreHistoryEchoes").checked = history.echoes;
  ensureEl<HTMLInputElement>("loreHistoryRenames").checked = history.renames;
}

function addListeners(): void {
  ensureEl(DIALOG_ID).addEventListener("change", onLoreChange);
  ensureEl("loreMapNameRegenerate").addEventListener("click", regenerateMapName);
  ensureEl("loreEraRegenerate").addEventListener("click", regenerateEra);
}

/** Every control edits the lore, and pins what the user typed */
function onLoreChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  const value = input.value;
  const { lore } = options.map;

  switch (input.id) {
    case "loreMapName":
      if (!value.trim()) return;
      Lore.rename(value);
      Pins.set("mapName", lore.name); // named by hand: the next map keeps it
      break;

    case "loreYear":
      if (!value || Number.isNaN(+value)) return;
      Lore.setYear(+value);
      Pins.set("year", lore.calendar.year);
      break;

    case "loreEra":
      // renaming the era suggests an abbreviation, which the user can override in the field beside it
      if (!value.trim()) return;
      Lore.setEra(value);
      Pins.set("era", lore.calendar.era);
      Pins.set("eraShort", lore.calendar.eraShort);
      ensureEl<HTMLInputElement>("loreEraShort").value = lore.calendar.eraShort;
      break;

    case "loreEraShort":
      if (!value.trim()) return;
      Lore.setEra(lore.calendar.era, value);
      Pins.set("eraShort", lore.calendar.eraShort);
      break;

    // the description is the one lore value with no pin: nothing ever re-rolls an author's note
    case "loreDescription":
      Lore.setDescription(value);
      break;

    case "loreHistorySpan":
      if (value === "") return;
      Lore.setHistory({ span: +value });
      break;

    case "loreHistoryRealms":
      if (value === "") return;
      Lore.setHistory({ realms: +value });
      break;

    case "loreHistoryDensity":
      if (value === "") return;
      Lore.setHistory({ density: +value });
      break;

    case "loreHistoryEchoes":
      Lore.setHistory({ echoes: (input as HTMLInputElement).checked });
      break;

    case "loreHistoryRenames":
      Lore.setHistory({ renames: (input as HTMLInputElement).checked });
      break;

    default:
      return;
  }

  Options.save();
}

function regenerateMapName(): void {
  Pins.clear("mapName");
  Lore.rename(Names.getMapName());
  Options.save();
  fillInputs();
}

function regenerateEra(): void {
  Pins.clear("era");
  Pins.clear("eraShort");
  Lore.setEra(Names.getEra());
  Options.save();
  fillInputs();
}

/** Show the lore again after something else changed it */
function refresh(): void {
  if (document.getElementById(DIALOG_ID)) fillInputs();
}

export const LoreEditor = { open, refresh };
