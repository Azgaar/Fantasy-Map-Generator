"use strict";
function editNotes(id, name) {
  // update list of objects
  const select = document.getElementById("notesSelect");
  for (let i = select.options.length; i < notes.length; i++) {
    select.options.add(new Option(notes[i].id, notes[i].id));
  }

  // select an object
  if (notes.length) {
    if (!id) id = notes[0].id;
    let note = notes.find(note => note.id === id);
    if (note === undefined) {
      if (!name) name = id;
      note = {id, name, legend: ""};
      notes.push(note);
      select.options.add(new Option(id, id));
    }
    select.value = id;
    notesName.value = note.name;
    notesText.value = note.legend;
  } else {
    if (!notes.length) {
      const value = "There are no added notes. Click on element (e.g. label) and add a free text note";
      document.getElementById("notesText").value = value;
    }
  }

  // open a dialog
  $("#notesEditor").dialog({
    title: "Notes Editor", minWidth: "40em",
    position: {my: "center", at: "center", of: "svg"}
  });

  if (modules.editNotes) return;
  modules.editNotes = true;

  // add listeners
  document.getElementById("notesSelect").addEventListener("change", changeObject);
  document.getElementById("notesName").addEventListener("input", changeName);
  document.getElementById("notesText").addEventListener("input", changeText);
  document.getElementById("notesFocus").addEventListener("click", validateHighlightElement);
  document.getElementById("notesDownload").addEventListener("click", downloadLegends);
  document.getElementById("notesUpload").addEventListener("click", () => legendsToLoad.click());
  document.getElementById("legendsToLoad").addEventListener("change", function() {uploadFile(this, uploadLegends)});
  document.getElementById("notesRemove").addEventListener("click", triggernotesRemove);

  function changeObject() {
    const note = notes.find(note => note.id === this.value);
    notesName.value = note.name;
    notesText.value = note.legend;
  }

  function changeName() {
    const id = document.getElementById("notesSelect").value;
    const note = notes.find(note => note.id === id);
    note.name = this.value;
  }

  function changeText() {
    const id = document.getElementById("notesSelect").value;
    const note = notes.find(note => note.id === id);
    note.legend = this.value;
  }

  function validateHighlightElement() {
    const select = document.getElementById("notesSelect");
    const element = document.getElementById(select.value);

    // if element is not found
    if (element === null) {
      alertMessage.innerHTML = "Related element is not found. Would you like to remove the note?";
      $("#alert").dialog({resizable: false, title: "Element not found",
        buttons: {
          Remove: function() {$(this).dialog("close"); removeLegend();},
          Keep: function() {$(this).dialog("close");}
        }
      });
      return;
    }
    
    highlightElement(element); // if element is found
  }

  function downloadLegends() {
    const data = JSON.stringify(notes);
    const name = getFileName("Notes") + ".txt";
    downloadFile(data, name);
  }

  function uploadLegends(dataLoaded) {
    if (!dataLoaded) {tip("Cannot load the file. Please check the data format", false, "error"); return;}
    notes = JSON.parse(dataLoaded);
    document.getElementById("notesSelect").options.length = 0;
    editNotes(notes[0].id, notes[0].name);
  }

  function triggernotesRemove() {
    alertMessage.innerHTML = "Are you sure you want to remove the selected note?";
    $("#alert").dialog({resizable: false, title: "Remove note",
      buttons: {
        Remove: function() {$(this).dialog("close"); removeLegend();},
        Keep: function() {$(this).dialog("close");}
      }
    });
  }

  function removeLegend() {
    const select = document.getElementById("notesSelect");
    const index = notes.findIndex(n => n.id === select.value);
    notes.splice(index, 1);
    select.options.length = 0;
    if (!notes.length) {$("#notesEditor").dialog("close"); return;}
    editNotes(notes[0].id, notes[0].name);
  }

}