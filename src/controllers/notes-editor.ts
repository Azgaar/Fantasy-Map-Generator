import type Quill from "quill";
import { confirmationDialog, destroyDialog } from "@/components/dialog/dialog-helpers";
import { tip } from "@/components/tooltips";
import { highlightElement } from "@/renderers/overlays/highlight";
import { downloadFile, getFileName, speak, uploadFile } from "@/utils";
import { ensureEl } from "../utils";
import {
  canEditAsRichText,
  createRichTextEditor,
  getEditorHtml,
  runTableAction,
  setEditorHtml,
  TOOLBAR_HTML
} from "./notes-rich-text";

export interface Note {
  id: string;
  name: string;
  legend: string;
}

let quill: Quill | null = null;
let windowed: { width: number; height: number; position: unknown } | null = null;

function open(id?: string, name?: string): void {
  renderDialog();

  const notesName = ensureEl<HTMLInputElement>("notesName");
  const notesSelect = ensureEl<HTMLSelectElement>("notesSelect");
  const notesPin = ensureEl("notesPin");

  const notesList = notes as Note[];

  // update list of objects
  notesList.forEach(note => {
    notesSelect.options.add(new Option(note.id, note.id));
  });

  // update pin notes icon
  if (options.pinNotes) notesPin.classList.add("pressed");
  else notesPin.classList.remove("pressed");

  quill = createRichTextEditor(ensureEl("notesLegend"), ensureEl("notesToolbar"), updateLegend);

  // select an object
  if (notesList.length || id) {
    if (!id) id = notesList[0].id;
    let note = notesList.find(note => note.id === id);
    if (!note) {
      if (!name) name = id;
      note = { id, name, legend: "" };
      notesList.push(note);
      notesSelect.options.add(new Option(id, id));
    }

    notesSelect.value = id;
    notesName.value = note.name;
    loadNote(note);
    updateNotesBox(note);
  } else {
    // if notes array is empty: the editor placeholder explains what to do
    notesName.value = "";
    quill.disable();
  }

  $("#notesEditor").dialog({
    title: "Notes Editor",
    width: svgWidth * 0.8,
    height: svgHeight * 0.75,
    position: { my: "center", at: "center", of: "svg" },
    close: closeNotesEditor
  });
}

function renderDialog(): void {
  destroyDialog("notesEditor");
  quill = null;
  windowed = null;

  const editorHtml = /* html */ `<div id="notesEditor" class="dialog stable">
    <div id="notesLayout">
      <div style="margin-bottom: 0.3em">
        <strong>Element: </strong>
        <select id="notesSelect" data-tip="Select element id" style="width: 12em"></select>
        <strong>Element name: </strong>
        <input id="notesName" data-tip="Set element name" autocorrect="off" spellcheck="false" style="width: 16em" />
        <span id="notesNameSpeak" data-tip="Speak the name. You can change voice and language in options" class="speaker">🔊</span>
      </div>
      ${TOOLBAR_HTML}
      <div id="notesLegend"></div>
      <textarea id="notesSource" hidden spellcheck="false"></textarea>
      <div style="margin-top: 0.3em">
        <button id="notesFocus" data-tip="Focus on selected object" class="icon-target"></button>
        <button id="notesGenerateWithAi" data-tip="Ask the assistant to write or rewrite this note" class="icon-robot"></button>
        <button id="notesPin" data-tip="Toggle notes box display: hide or do not hide the box on mouse move" class="icon-pin"></button>
        <select id="notesTable" data-tip="Insert a table or edit the one under the cursor">
          <option value="">Table</option>
          <option value="insert">Insert table</option>
          <option value="row-above">Add row above</option>
          <option value="row-below">Add row below</option>
          <option value="column-left">Add column left</option>
          <option value="column-right">Add column right</option>
          <option value="delete-row">Delete row</option>
          <option value="delete-column">Delete column</option>
          <option value="delete-table">Delete table</option>
        </select>
        <button id="notesSourceToggle" data-tip="Edit the note as HTML" class="icon-edit"></button>
        <button id="notesFullscreen" data-tip="Toggle fullscreen" class="icon-resize-full"></button>
        <button id="notesDownload" data-tip="Download notes to PC" class="icon-download"></button>
        <button id="notesUpload" data-tip="Upload notes from PC" class="icon-upload"></button>
        <button id="notesRemove" data-tip="Remove this note" class="icon-trash fastDelete"></button>
      </div>
    </div>`;

  ensureEl("dialogs").insertAdjacentHTML("beforeend", editorHtml);

  ensureEl<HTMLSelectElement>("notesSelect").addEventListener("change", changeElement);
  ensureEl<HTMLInputElement>("notesName").addEventListener("input", changeName);
  ensureEl("notesNameSpeak").addEventListener("click", () => speak(ensureEl<HTMLInputElement>("notesName").value));
  ensureEl<HTMLTextAreaElement>("notesSource").addEventListener("input", updateLegend);
  ensureEl<HTMLSelectElement>("notesTable").addEventListener("change", applyTableAction);
  ensureEl("notesSourceToggle").addEventListener("click", toggleSourceMode);
  ensureEl("notesFullscreen").addEventListener("click", toggleFullscreen);
  ensureEl("notesPin").addEventListener("click", toggleNotesPin);
  ensureEl("notesFocus").addEventListener("click", validateHighlightElement);
  ensureEl("notesGenerateWithAi").addEventListener("click", () => void Controllers.HelpAssistant.open({ mode: "map" }));
  ensureEl("notesDownload").addEventListener("click", downloadLegends);
  ensureEl("notesUpload").addEventListener("click", () => ensureEl("legendsToLoad").click());
  ensureEl<HTMLInputElement>("legendsToLoad").addEventListener("change", function (this: HTMLInputElement) {
    uploadFile(this, uploadLegends);
  });
  ensureEl("notesRemove").addEventListener("click", triggerNotesRemove);
}

function closeNotesEditor(): void {
  quill = null;
  $("#notesEditor").dialog("destroy");
  ensureEl("notesEditor").remove();
}

function selectedNote(): Note | undefined {
  const notesSelect = ensureEl<HTMLSelectElement>("notesSelect");
  const note = (notes as Note[]).find(note => note.id === notesSelect.value);
  if (!note) tip("Note element is not found", true, "error", 4000);
  return note;
}

// a note whose markup Quill would rewrite (the dungeon marker's iframe, a legacy hr) is edited as HTML
function loadNote(note: Note): void {
  if (!quill) return;
  quill.enable();
  const rich = canEditAsRichText(note.legend);
  if (rich) setEditorHtml(quill, note.legend);
  else ensureEl<HTMLTextAreaElement>("notesSource").value = note.legend;
  setSourceMode(!rich);
}

function setSourceMode(raw: boolean): void {
  ensureEl("notesToolbar").hidden = raw;
  ensureEl("notesLegend").hidden = raw;
  ensureEl("notesSource").hidden = !raw;
  ensureEl<HTMLSelectElement>("notesTable").disabled = raw;
  ensureEl("notesSourceToggle").classList.toggle("pressed", raw);
}

function toggleSourceMode(): void {
  const note = selectedNote();
  if (!note || !quill) return;

  const source = ensureEl<HTMLTextAreaElement>("notesSource");
  if (source.hidden) {
    source.value = note.legend;
    setSourceMode(true);
  } else if (canEditAsRichText(source.value)) {
    setEditorHtml(quill, source.value);
    setSourceMode(false);
  } else {
    tip("The note has markup the rich text editor cannot keep, so it stays in HTML mode", false, "error", 4000);
  }
}

function applyTableAction(this: HTMLSelectElement): void {
  if (quill && this.value) runTableAction(quill, this.value);
  this.value = "";
}

function toggleFullscreen(): void {
  const dialog = $("#notesEditor");
  if (windowed) {
    dialog.dialog("option", "width", windowed.width);
    dialog.dialog("option", "height", windowed.height);
    dialog.dialog("option", "position", windowed.position);
    windowed = null;
  } else {
    windowed = {
      width: dialog.dialog("option", "width"),
      height: dialog.dialog("option", "height"),
      position: dialog.dialog("option", "position")
    };
    dialog.dialog("option", "width", window.innerWidth);
    dialog.dialog("option", "height", window.innerHeight);
    dialog.dialog("option", "position", { my: "left top", at: "left top", of: window });
  }
  ensureEl("notesFullscreen").classList.toggle("pressed", Boolean(windowed));
}

function updateLegend(): void {
  const note = selectedNote();
  if (!note || !quill) return;

  const source = ensureEl<HTMLTextAreaElement>("notesSource");
  note.legend = source.hidden ? getEditorHtml(quill) : source.value;
  updateNotesBox(note);
}

function updateNotesBox(note: Note): void {
  ensureEl("notesHeader").innerHTML = note.name;
  ensureEl("notesBody").innerHTML = note.legend;
}

function changeElement(): void {
  const note = selectedNote();
  if (!note) return;

  ensureEl<HTMLInputElement>("notesName").value = note.name;
  loadNote(note);
  updateNotesBox(note);
}

function changeName(this: HTMLInputElement): void {
  const note = selectedNote();
  if (note) note.name = this.value;
}

function validateHighlightElement(): void {
  const notesSelect = ensureEl<HTMLSelectElement>("notesSelect");
  const element = document.getElementById(notesSelect.value);
  if (element) {
    highlightElement(element, 3);
    return;
  }

  confirmationDialog({
    title: "Element not found",
    message: "Note element is not found. Would you like to remove the note?",
    confirm: "Remove",
    onConfirm: removeSelectedNote
  });
}

function removeSelectedNote(): void {
  remove(ensureEl<HTMLSelectElement>("notesSelect").value);
}

function downloadLegends(): void {
  const notesData = JSON.stringify(notes);
  const name = `${getFileName("Notes")}.txt`;
  downloadFile(notesData, name);
}

function uploadLegends(dataLoaded: string): void {
  if (!dataLoaded) {
    tip("Cannot load the file. Please check the data format", false, "error");
    return;
  }
  notes = JSON.parse(dataLoaded);
  open((notes as Note[])[0].id, (notes as Note[])[0].name);
}

function triggerNotesRemove(): void {
  confirmationDialog({
    title: "Remove note",
    message: "Are you sure you want to remove the selected note? There is no way to undo this action",
    confirm: "Remove",
    onConfirm: removeSelectedNote
  });
}

function toggleNotesPin(this: HTMLElement): void {
  options.pinNotes = !options.pinNotes;
  this.classList.toggle("pressed");
}

// Bridge for the assistant (help-assistant-notes.ts): read the note on screen, write notes so an
// open editor stays in sync, and remove what an undo has to take back

const isOpen = (): boolean => document.getElementById("notesEditor") !== null;

function current(): Note | null {
  if (!isOpen()) return null;
  const id = ensureEl<HTMLSelectElement>("notesSelect").value;
  return (notes as Note[]).find(note => note.id === id) ?? null;
}

function write(id: string, legend: string, name?: string): Note {
  const list = notes as Note[];
  let note = list.find(note => note.id === id);
  if (note) {
    note.legend = legend;
    if (name !== undefined) note.name = name;
  } else {
    note = { id, name: name ?? id, legend };
    list.push(note);
    if (isOpen()) ensureEl<HTMLSelectElement>("notesSelect").options.add(new Option(id, id));
  }
  if (current()?.id === id) {
    ensureEl<HTMLInputElement>("notesName").value = note.name;
    loadNote(note); // silent Quill load or the raw textarea, by representability — the AI-apply path
    updateNotesBox(note);
  }
  return note;
}

function remove(id: string): void {
  const wasCurrent = current()?.id === id;
  notes = (notes as Note[]).filter(note => note.id !== id);
  if (!wasCurrent) return;
  if (!notes.length) {
    $("#notesEditor").dialog("close");
    return;
  }
  open((notes as Note[])[0].id, (notes as Note[])[0].name);
}

// The Quill selection as self-contained HTML; nothing in raw-HTML mode or when the editor is closed
function getSelectionHtml(): string | null {
  if (!isOpen() || !quill || !ensureEl("notesSource").hidden) return null;
  const range = quill.getSelection();
  if (!range?.length) return null;
  return quill.getSemanticHTML(range.index, range.length);
}

export const NotesEditor = { open, current, write, remove, getSelectionHtml };
