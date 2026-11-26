import type Quill from "quill";
import { Controllers } from "@/controllers";
import { ENTITY_TYPES, type EntityRef, MapEntities } from "@/model/map-entities";
import { Options } from "@/model/options/options-model";
import { type NoteEntry, Notes } from "@/model/story/notes";
import { viewport } from "@/renderers/viewport/viewport";
import { fonts } from "@/services/fonts";
import { Csv } from "@/services/io/csv";
import { speak } from "@/services/speech";
import { Dialog } from "@/ui/dialog/dialog";

import { highlightElement } from "@/ui/map/highlight";
import { zoomTo } from "@/ui/map/zoom";
import { tip } from "@/ui/tooltips";
import { sentences, t } from "@/utils/i18n";
import { ensureEl, findEl } from "@/utils/node-utils";
import { errorText } from "@/utils/string-utils";
import {
  canEditAsRichText,
  createRichTextEditor,
  getEditorHtml,
  getToolbarHtml,
  RICH_TEXT_STYLE,
  runTableAction,
  setEditorHtml
} from "./notes-rich-text";

let quill: Quill | null = null;
let lastSelection: { index: number; length: number } | null = null;
let fullscreen = false;

/** Open the editor on the given entity, or on the first note when called with no reference */
function open(ref?: EntityRef): void {
  renderDialog();

  const notesSelect = ensureEl<HTMLSelectElement>("notesSelect");
  const notesPin = ensureEl("notesPin");

  const entries = Notes.list();
  fillSelect(notesSelect, entries, ref);

  if (options.app.notesPinned) notesPin.classList.add("pressed");
  else notesPin.classList.remove("pressed");

  quill = createRichTextEditor(
    ensureEl("notesLegend"),
    ensureEl("notesToolbar"),
    updateLegend,
    fonts.map(font => font.family)
  );

  quill.on("selection-change", range => {
    if (range) lastSelection = { index: range.index, length: range.length };
  });

  const selected = ref || entries[0]?.ref;
  if (selected) {
    notesSelect.value = MapEntities.key(selected);
    showNote(selected);
  } else {
    ensureEl("notesName").textContent = "";
    quill.root.dataset.placeholder = t(
      "No notes yet. Click a burg, marker, state or other element on the map and add a note from its editor"
    );
    quill.disable();
    lastSelection = null;
    window.dispatchEvent(new Event("notes:context-changed"));
  }

  Dialog.open("notesEditor", {
    title: t("Notes Editor"),
    width: viewport.width * 0.8,
    height: viewport.height * 0.75,
    position: { my: "center", at: "center", of: "svg" },
    resizable: true,
    onClose: closeNotesEditor
  });
}

/** Notes grouped by entity type, plus the requested entity when it has no note yet */
function fillSelect(select: HTMLSelectElement, entries: NoteEntry[], ref?: EntityRef): void {
  select.innerHTML = "";

  const requestedKey = ref && MapEntities.key(ref);
  const listed = new Set(entries.map(entry => entry.key));

  for (const type of ENTITY_TYPES) {
    const typeEntries = entries.filter(entry => entry.ref.type === type);
    if (ref?.type === type && requestedKey && !listed.has(requestedKey))
      typeEntries.unshift({ ref, key: requestedKey, note: "" });
    if (!typeEntries.length) continue;

    const group = document.createElement("optgroup");
    group.label = MapEntities.getTypeLabel(type);
    for (const entry of typeEntries) group.append(new Option(MapEntities.getName(entry.ref) || entry.key, entry.key));
    select.append(group);
  }
}

const STYLES = /* html */ `
    <style>
      ${RICH_TEXT_STYLE}
      /* the dialog sets its content height inline; the layout column fills it, the editor takes the rest */
      #notesLayout { display: flex; flex-direction: column; height: 100%; width: auto; }
      #notesHead { display: flex; align-items: center; gap: 0.4em; flex-shrink: 0; margin-bottom: 5px; }
      #notesHead select { flex: 0 1 12em; min-width: 5em; }
      #notesHead input { flex: 0 1 18em; min-width: 5em; }
      #notesFooter { display: flex; gap: 3px; flex-shrink: 0; margin-top: 5px; }
      #notesLegend, #notesSource { flex: 1; min-height: 0; background-color: #fff; }
      #notesSource { padding: 10px 12px; font-family: var(--monospace); font-size: 13px; line-height: 1.5; border: 1px solid #ccc; border-radius: 3px; resize: none; }
    </style>`;

function renderDialog(): void {
  Dialog.destroy("notesEditor");
  quill = null;
  fullscreen = false;

  const editorHtml = /* html */ `<div id="notesEditor" class="dialog stable">
    ${STYLES}
    <div id="notesLayout">
      <div id="notesHead">
        <strong>${t("Element")}:</strong>
        <select id="notesSelect" data-tip="${t("Select the element the note belongs to")}"></select>
        <strong id="notesName" data-tip="${t("The element name, edited in the element's own editor")}"></strong>
        <span id="notesNameSpeak" data-tip="${sentences(t("Speak the name"), t("You can change voice and language in options"))}" class="speaker">🔊</span>
      </div>
      ${getToolbarHtml("notesToolbar")}
      <div id="notesLegend" class="notes-legend"></div>
      <textarea id="notesSource" hidden spellcheck="false"></textarea>
      <div id="notesFooter">
        <button id="notesFocus" data-tip="${t("Focus on selected object")}" class="icon-target"></button>
        <button id="notesGenerateWithAi" data-tip="${t("Azgaar Assistant")}" class="icon-robot"></button>
        <button id="notesPin" data-tip="${t("Toggle notes box display: hide or do not hide the box on mouse move")}" class="icon-pin"></button>
        <button id="notesSourceToggle" data-tip="${t("Edit the note as HTML")}" class="icon-edit"></button>
        <button id="notesFullscreen" data-tip="${t("Toggle fullscreen")}" class="icon-resize-full"></button>
        <button id="notesDownload" data-tip="${t("Download notes to PC")}" class="icon-download"></button>
        <button id="notesUpload" data-tip="${t("Upload notes from PC")}" class="icon-upload"></button>
        <button id="notesRemove" data-tip="${t("Remove")}" class="icon-trash fastDelete"></button>
      </div>
    </div>
  </div>`;

  ensureEl("dialogs").insertAdjacentHTML("beforeend", editorHtml);

  ensureEl<HTMLSelectElement>("notesSelect").addEventListener("change", changeElement);
  ensureEl("notesNameSpeak").addEventListener("click", () => speak(ensureEl("notesName").textContent || ""));
  ensureEl<HTMLTextAreaElement>("notesSource").addEventListener("input", updateLegend);
  ensureEl("notesToolbar").querySelector(".notes-table")!.addEventListener("change", applyTableAction);
  ensureEl("notesSourceToggle").addEventListener("click", toggleSourceMode);
  ensureEl("notesFullscreen").addEventListener("click", toggleFullscreen);
  ensureEl("notesPin").addEventListener("click", toggleNotesPin);
  ensureEl("notesFocus").addEventListener("click", validateHighlightElement);
  ensureEl("notesGenerateWithAi").addEventListener("click", openAiGenerator);
  ensureEl("notesDownload").addEventListener("click", downloadLegends);
  ensureEl("notesUpload").addEventListener("click", () => Csv.pick(uploadLegends, ".csv,.txt"));
  ensureEl("notesRemove").addEventListener("click", triggerNotesRemove);
}

function closeNotesEditor(): void {
  quill = null;
  lastSelection = null;
  Dialog.destroy("notesEditor");
  window.dispatchEvent(new Event("notes:context-changed"));
}

function selectedRef(): EntityRef | undefined {
  const ref = MapEntities.parseKey(ensureEl<HTMLSelectElement>("notesSelect").value);
  if (!ref) tip(t("Note element is not found"), true, "error", 4000);
  return ref;
}

function showNote(ref: EntityRef): void {
  ensureEl("notesName").textContent = MapEntities.getName(ref);
  loadNote(Notes.get(ref) || "");
  lastSelection = null;
  updateNotesBox(ref);
  window.dispatchEvent(new Event("notes:context-changed"));
}

// A note whose markup Quill would rewrite (such as a dungeon iframe) is edited as HTML.
function loadNote(note: string): void {
  if (!quill) return;
  quill.enable();
  const rich = canEditAsRichText(note);
  if (rich) setEditorHtml(quill, note);
  else ensureEl<HTMLTextAreaElement>("notesSource").value = note;
  setSourceMode(!rich);
}

function setSourceMode(raw: boolean): void {
  ensureEl("notesToolbar").hidden = raw;
  ensureEl("notesLegend").hidden = raw;
  ensureEl("notesSource").hidden = !raw;
  ensureEl("notesSourceToggle").classList.toggle("pressed", raw);
}

function toggleSourceMode(): void {
  const ref = selectedRef();
  if (!ref || !quill) return;

  const source = ensureEl<HTMLTextAreaElement>("notesSource");
  if (source.hidden) {
    source.value = Notes.get(ref) || "";
    setSourceMode(true);
  } else if (canEditAsRichText(source.value)) {
    setEditorHtml(quill, source.value);
    setSourceMode(false);
  } else {
    tip(t("The note has markup the rich text editor cannot keep, so it stays in HTML mode"), false, "error", 4000);
  }
}

function applyTableAction(this: HTMLSelectElement): void {
  const action = this.value;
  if (!action) return; // the reset below re-enters through the event Quill's picker listens for

  if (quill) runTableAction(quill, action);
  this.value = "";
  this.dispatchEvent(new Event("change")); // Quill's picker only syncs its label from a change event
}

function toggleFullscreen(): void {
  fullscreen = !fullscreen;
  Dialog.update("notesEditor", { fullscreen });
  ensureEl("notesFullscreen").classList.toggle("pressed", fullscreen);
}

function updateLegend(): void {
  const ref = selectedRef();
  if (!ref || !quill) return;

  const source = ensureEl<HTMLTextAreaElement>("notesSource");
  Notes.set(ref, source.hidden ? getEditorHtml(quill) : source.value);
  updateNotesBox(ref);
}

function updateNotesBox(ref: EntityRef): void {
  ensureEl("notesHeader").textContent = MapEntities.getName(ref); // plain text: an & in a name is not an entity
  ensureEl("notesBody").innerHTML = Notes.get(ref) || "";
}

function changeElement(): void {
  const ref = selectedRef();
  if (ref) showNote(ref);
}

function validateHighlightElement(): void {
  const ref = selectedRef();
  if (!ref) return;

  if (!MapEntities.get(ref)) {
    Dialog.confirm({
      title: t("Element not found"),
      message: sentences(t("Note element is not found"), t("Would you like to remove the note?")),
      confirm: t("Remove"),
      onConfirm: removeSelectedNote
    });
    return;
  }

  // the viewport renderers hold only what is on screen, so an off-screen element is not in the dom
  const elementId = MapEntities.getElementId(ref);
  const element = elementId ? findEl(elementId) : null;
  if (element) return void highlightElement(element, 3);

  const position = MapEntities.getPosition(ref);
  if (position) return void zoomTo(position[0], position[1], 8, 1600);

  tip(t("This element is not drawn on the map on its own"), false, "warn", 4000);
}

function removeSelectedNote(): void {
  const ref = selectedRef();
  if (!ref) return;

  Notes.set(ref, "");

  const [first] = Notes.list();
  if (!first) {
    Dialog.close("notesEditor");
    return;
  }

  open(first.ref);
}

function openAiGenerator(): void {
  Controllers.Assistant.open();
}

/** Notes are exchanged as csv addressed by entity, so an uploaded note always has an owner */
function downloadLegends(): void {
  const rows = Notes.list().map(entry => {
    const id = entry.ref.sub === undefined ? String(entry.ref.id) : `${entry.ref.id}-${entry.ref.sub}`;
    return [entry.ref.type, id, entry.note];
  });
  Csv.download("Notes", ["type", "id", "note"], rows);
}

function uploadLegends(text: string): void {
  let rows: string[][];
  try {
    rows = Csv.parse(text).filter(row => row.length >= 3 && row[0].trim() !== "type");
  } catch (error) {
    Dialog.message({ message: errorText(error) });
    return;
  }
  if (!rows.length) {
    Dialog.message({ message: sentences(t("Cannot load the file"), t("Please check the data format")) });
    return;
  }

  let applied = 0;
  let rejected = 0;
  for (const [type, id, ...note] of rows) {
    const ref = MapEntities.parseKey(`${type.trim()}:${id.trim()}`);
    if (ref && Notes.set(ref, note.join(","))) applied++;
    else rejected++;
  }

  if (!applied) {
    Dialog.message({ message: t("No note matched an element on this map. Nothing was loaded") });
    return;
  }

  const message = rejected
    ? t("Loaded {{applied}} note(s), {{rejected}} skipped as their element is not on the map", { applied, rejected })
    : t("Loaded {{applied}} note(s)", { applied });
  tip(message, true, "success", 6000);

  const [first] = Notes.list();
  if (first) open(first.ref);
}

function triggerNotesRemove(): void {
  Dialog.confirm({
    title: t("Remove"),
    message: t("Are you sure you want to remove the selected note? There is no way to undo this action"),
    confirm: t("Remove"),
    onConfirm: removeSelectedNote
  });
}

function toggleNotesPin(this: HTMLElement): void {
  Options.set(o => (o.app.notesPinned = !o.app.notesPinned));
  this.classList.toggle("pressed");
}

// The assistant uses stable entity keys; note titles remain the entity's own name.
export interface Note {
  id: string;
  name: string;
  legend: string;
}

function current(): Note | null {
  if (!findEl("notesEditor")) return null;
  const ref = selectedRef();
  if (!ref || !MapEntities.get(ref)) return null;
  return { id: MapEntities.key(ref), name: MapEntities.getName(ref), legend: Notes.get(ref) || "" };
}

/** Show notes and names changed outside the editor, keeping the selected entity */
function refresh(): void {
  if (!findEl("notesEditor")) return;
  const select = ensureEl<HTMLSelectElement>("notesSelect");
  const selected = MapEntities.parseKey(select.value);
  fillSelect(select, Notes.list(), selected);
  if (!selected || !MapEntities.get(selected)) return;
  select.value = MapEntities.key(selected);
  showNote(selected);
}

function getSelectionHtml(): string | null {
  if (!findEl("notesEditor") || !quill) return null;
  const source = ensureEl<HTMLTextAreaElement>("notesSource");
  if (!source.hidden) return source.value.slice(source.selectionStart, source.selectionEnd) || null;
  const range = quill.getSelection() ?? lastSelection;
  return range?.length ? quill.getSemanticHTML(range.index, range.length) : null;
}

export const NotesEditor = { open, exportCsv: downloadLegends, current, refresh, getSelectionHtml };
