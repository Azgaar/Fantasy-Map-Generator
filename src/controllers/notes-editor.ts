import { ensureEl } from "../utils";

interface Note {
  id: string;
  name: string;
  legend: string;
}

function open(id?: string, name?: string): void {
  renderDialog();

  const notesLegend = ensureEl("notesLegend");
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
    notesLegend.innerHTML = note.legend;
    void initEditor();
    updateNotesBox(note);
  } else {
    // if notes array is empty
    notesName.value = "";
    notesLegend.innerHTML = "No notes added. Click on an element (e.g. label or marker) and add a free text note";
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
  window.tinymce?.remove();
  document.getElementById("notesEditor")?.remove();
  const editorHtml = /* html */ `<div id="notesEditor" class="dialog stable">
    <div style="margin-bottom: 0.3em">
      <strong>Element: </strong>
      <select id="notesSelect" data-tip="Select element id" style="width: 12em"></select>
      <strong>Element name: </strong>
      <input id="notesName" data-tip="Set element name" autocorrect="off" spellcheck="false" style="width: 16em" />
      <span data-tip="Speak the name. You can change voice and language in options" class="speaker">🔊</span>
    </div>
    <div id="notesLegend" contenteditable="true"></div>
    <div style="margin-top: 0.3em">
      <button id="notesFocus" data-tip="Focus on selected object" class="icon-target"></button>
      <button id="notesGenerateWithAi" data-tip="Generate note with AI" class="icon-robot"></button>
      <button id="notesPin" data-tip="Toggle notes box display: hide or do not hide the box on mouse move" class="icon-pin"></button>
      <button id="notesDownload" data-tip="Download notes to PC" class="icon-download"></button>
      <button id="notesUpload" data-tip="Upload notes from PC" class="icon-upload"></button>
      <button id="notesRemove" data-tip="Remove this note" class="icon-trash fastDelete"></button>
    </div>`;

  ensureEl("dialogs").insertAdjacentHTML("beforeend", editorHtml);

  ensureEl<HTMLSelectElement>("notesSelect").on("change", changeElement);
  ensureEl<HTMLInputElement>("notesName").on("input", changeName);
  ensureEl("notesLegend").on("blur", updateLegend);
  ensureEl("notesPin").on("click", toggleNotesPin);
  ensureEl("notesFocus").on("click", validateHighlightElement);
  ensureEl("notesGenerateWithAi").on("click", openAiGenerator);
  ensureEl("notesDownload").on("click", downloadLegends);
  ensureEl("notesUpload").on("click", () => ensureEl("legendsToLoad").click());
  ensureEl<HTMLInputElement>("legendsToLoad").on("change", function (this: HTMLInputElement) {
    uploadFile(this, uploadLegends);
  });
  ensureEl("notesRemove").on("click", triggerNotesRemove);
}

function closeNotesEditor(): void {
  window.tinymce?.remove();
  $("#notesEditor").dialog("destroy");
  ensureEl("notesEditor").remove();
}

async function initEditor(): Promise<void> {
  if (!window.tinymce) {
    const url = "https://azgaar.github.io/Fantasy-Map-Generator/libs/tinymce/tinymce.min.js";
    try {
      await import(/* @vite-ignore */ url);
    } catch {
      // error may be caused by failed request being cached, try again with random hash
      try {
        const hash = Math.random().toString(36).substring(2, 15);
        await import(/* @vite-ignore */ `${url}#${hash}`);
      } catch (error) {
        console.error(error);
      }
    }
  }

  const tinymce = window.tinymce;
  if (!tinymce) return;

  tinymce._setBaseUrl("https://azgaar.github.io/Fantasy-Map-Generator/libs/tinymce");
  tinymce.init({
    license_key: "gpl",
    selector: "#notesLegend",
    height: "90%",
    menubar: false,
    plugins: `autolink lists link charmap code fullscreen image link media table wordcount`,
    toolbar: `code | undo redo | removeformat | bold italic strikethrough | forecolor backcolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | link image media table | fontselect fontsizeselect | blockquote hr charmap | print fullscreen`,
    media_alt_source: false,
    media_poster: false,
    browser_spellcheck: true,
    contextmenu: false,
    setup: (editor: { on: (event: string, cb: () => void) => void }) => {
      editor.on("Change", updateLegend);
    }
  });
}

function updateLegend(): void {
  const notesSelect = ensureEl<HTMLSelectElement>("notesSelect");
  const note = (notes as Note[]).find(note => note.id === notesSelect.value);
  if (!note) {
    tip("Note element is not found", true, "error", 4000);
    return;
  }

  const activeEditor = window.tinymce?.activeEditor;
  note.legend = activeEditor ? activeEditor.getContent() : ensureEl("notesLegend").innerHTML;
  updateNotesBox(note);
}

function updateNotesBox(note: Note): void {
  ensureEl("notesHeader").innerHTML = note.name;
  ensureEl("notesBody").innerHTML = note.legend;
}

function changeElement(this: HTMLSelectElement): void {
  const note = (notes as Note[]).find(note => note.id === this.value);
  if (!note) {
    tip("Note element is not found", true, "error", 4000);
    return;
  }

  ensureEl<HTMLInputElement>("notesName").value = note.name;
  ensureEl("notesLegend").innerHTML = note.legend;
  updateNotesBox(note);

  window.tinymce?.activeEditor?.setContent(note.legend);
}

function changeName(this: HTMLInputElement): void {
  const notesSelect = ensureEl<HTMLSelectElement>("notesSelect");
  const note = (notes as Note[]).find(note => note.id === notesSelect.value);
  if (!note) {
    tip("Note element is not found", true, "error", 4000);
    return;
  }

  note.name = this.value;
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
  const notesSelect = ensureEl<HTMLSelectElement>("notesSelect");
  notes = (notes as Note[]).filter(note => note.id !== notesSelect.value);

  if (!notes.length) {
    $("#notesEditor").dialog("close");
    return;
  }

  open((notes as Note[])[0].id, (notes as Note[])[0].name);
}

function openAiGenerator(): void {
  const notesSelect = ensureEl<HTMLSelectElement>("notesSelect");
  const note = (notes as Note[]).find(note => note.id === notesSelect.value);

  let prompt = `Respond with description. Use simple dry language. Invent facts, names and details. Split to paragraphs and format to HTML. Remove h tags, remove markdown.`;
  if (note?.name) prompt += ` Name: ${note.name}.`;
  if (note?.legend) prompt += ` Data: ${note.legend}`;

  const onApply = (result: string): void => {
    ensureEl("notesLegend").innerHTML = result;
    if (note) {
      note.legend = result;
      updateNotesBox(note);
      window.tinymce?.activeEditor?.setContent(note.legend);
    }
  };

  generateWithAi(prompt, onApply);
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

export const NotesEditor = { open };
