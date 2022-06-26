import {tip} from "/src/scripts/tooltips";

export function editNotes(id, name) {
  // elements
  const notesLegend = document.getElementById("notesLegend");
  const notesName = document.getElementById("notesName");
  const notesSelect = document.getElementById("notesSelect");
  const notesPin = document.getElementById("notesPin");

  // update list of objects
  notesSelect.options.length = 0;
  for (const note of notes) {
    notesSelect.options.add(new Option(note.id, note.id));
  }

  // update pin notes icon
  const notesArePinned = options.pinNotes;
  if (notesArePinned) notesPin.classList.add("pressed");
  else notesPin.classList.remove("pressed");

  // select an object
  if (notes.length || id) {
    if (!id) id = notes[0].id;
    let note = notes.find(note => note.id === id);
    if (note === undefined) {
      if (!name) name = id;
      note = {id, name, legend: ""};
      notes.push(note);
      notesSelect.options.add(new Option(id, id));
    }

    notesSelect.value = id;
    notesName.value = note.name;
    notesLegend.innerHTML = note.legend;
    initEditor();
    updateNotesBox(note);
  } else {
    // if notes array is empty
    notesName.value = "";
    notesLegend.innerHTML = "No notes added. Click on an element (e.g. label or marker) and add a free text note";
  }

  $("#notesEditor").dialog({
    title: "Notes Editor",
    width: "minmax(80vw, 540px)",
    height: window.innerHeight * 0.75,
    position: {my: "center", at: "center", of: "svg"},
    close: removeEditor
  });
  $("[aria-describedby='notesEditor']").css("top", "10vh");

  if (modules.editNotes) return;
  modules.editNotes = true;

  // add listeners
  document.getElementById("notesSelect").addEventListener("change", changeElement);
  document.getElementById("notesName").addEventListener("input", changeName);
  document.getElementById("notesLegend").addEventListener("blur", updateLegend);
  document.getElementById("notesPin").addEventListener("click", toggleNotesPin);
  document.getElementById("notesFocus").addEventListener("click", validateHighlightElement);
  document.getElementById("notesDownload").addEventListener("click", downloadLegends);
  document.getElementById("notesUpload").addEventListener("click", () => legendsToLoad.click());
  document.getElementById("legendsToLoad").addEventListener("change", function () {
    uploadFile(this, uploadLegends);
  });
  document.getElementById("notesRemove").addEventListener("click", triggerNotesRemove);

  async function initEditor() {
    if (!window.tinymce) {
      const url = "https://cdn.tiny.cloud/1/4i6a79ymt2y0cagke174jp3meoi28vyecrch12e5puyw3p9a/tinymce/5/tinymce.min.js";
      try {
        await import(/* @vite-ignore */ url);
      } catch (error) {
        // error may be caused by failed request being cached, try again with random hash
        try {
          const hash = Math.random().toString(36).substring(2, 15);
          await import(/* @vite-ignore */ `${url}#${hash}`);
        } catch (error) {
          console.error(error);
        }
      }
    }

    if (window.tinymce) {
      tinymce.init({
        selector: "#notesLegend",
        height: "90%",
        menubar: false,
        plugins: `autolink lists link charmap print code fullscreen image link media table paste hr wordcount`,
        toolbar: `code | undo redo | removeformat | bold italic strikethrough | forecolor backcolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | link image media table | fontselect fontsizeselect | blockquote hr charmap | print fullscreen`,
        media_alt_source: false,
        media_poster: false,
        browser_spellcheck: true,
        contextmenu: false,
        setup: editor => {
          editor.on("Change", updateLegend);
        }
      });
    }
  }

  function updateLegend() {
    const note = notes.find(note => note.id === notesSelect.value);
    if (!note) return tip("Note element is not found", true, "error", 4000);

    const isTinyEditorActive = window.tinymce?.activeEditor;
    note.legend = isTinyEditorActive ? tinymce.activeEditor.getContent() : notesLegend.innerHTML;
    updateNotesBox(note);
  }

  function updateNotesBox(note) {
    document.getElementById("notesHeader").innerHTML = note.name;
    document.getElementById("notesBody").innerHTML = note.legend;
  }

  function changeElement() {
    const note = notes.find(note => note.id === this.value);
    if (!note) return tip("Note element is not found", true, "error", 4000);

    notesName.value = note.name;
    notesLegend.innerHTML = note.legend;
    updateNotesBox(note);

    if (window.tinymce) tinymce.activeEditor.setContent(note.legend);
  }

  function changeName() {
    const note = notes.find(note => note.id === notesSelect.value);
    if (!note) return tip("Note element is not found", true, "error", 4000);

    note.name = this.value;
  }

  function validateHighlightElement() {
    const element = document.getElementById(notesSelect.value);
    if (element) return highlightElement(element, 3);

    confirmationDialog({
      title: "Element not found",
      message: "Note element is not found. Would you like to remove the note?",
      confirm: "Remove",
      cancel: "Keep",
      onConfirm: removeLegend
    });
  }

  function downloadLegends() {
    const notesData = JSON.stringify(notes);
    const name = getFileName("Notes") + ".txt";
    downloadFile(notesData, name);
  }

  function uploadLegends(dataLoaded) {
    if (!dataLoaded) return tip("Cannot load the file. Please check the data format", false, "error");
    notes = JSON.parse(dataLoaded);
    notesSelect.options.length = 0;
    editNotes(notes[0].id, notes[0].name);
  }

  function triggerNotesRemove() {
    confirmationDialog({
      title: "Remove note",
      message: "Are you sure you want to remove the selected note? There is no way to undo this action",
      confirm: "Remove",
      onConfirm: removeLegend
    });
  }

  function removeLegend() {
    const index = notes.findIndex(n => n.id === notesSelect.value);
    notes.splice(index, 1);
    notesSelect.options.length = 0;
    if (!notes.length) {
      $("#notesEditor").dialog("close");
      return;
    }
    editNotes(notes[0].id, notes[0].name);
  }

  function toggleNotesPin() {
    options.pinNotes = !options.pinNotes;
    this.classList.toggle("pressed");
  }

  function removeEditor() {
    if (window.tinymce) tinymce.remove();
  }
}
