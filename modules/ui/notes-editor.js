'use strict';
function editNotes(id, name) {
  // update list of objects
  const select = document.getElementById('notesSelect');
  select.options.length = 0;
  for (const note of notes) {
    select.options.add(new Option(note.id, note.id));
  }

  // initiate pell (html editor)
  const editor = Pell.init({
    element: document.getElementById('notesText'),
    onChange: (html) => {
      const id = document.getElementById('notesSelect').value;
      const note = notes.find((note) => note.id === id);
      if (!note) return;
      note.legend = html;
      showNote(note);
    }
  });

  // select an object
  if (notes.length || id) {
    if (!id) id = notes[0].id;
    let note = notes.find((note) => note.id === id);
    if (note === undefined) {
      if (!name) name = id;
      note = {id, name, legend: ''};
      notes.push(note);
      select.options.add(new Option(id, id));
    }
    select.value = id;
    notesName.value = note.name;
    editor.content.innerHTML = note.legend;
    showNote(note);
  } else {
    editor.content.innerHTML = 'There are no added notes. Click on element (e.g. label) and add a free text note';
    document.getElementById('notesName').value = '';
  }

  // open a dialog
  $('#notesEditor').dialog({
    title: 'Notes Editor',
    minWidth: '40em',
    width: '50vw',
    position: {my: 'center', at: 'center', of: 'svg'},
    close: () => (notesText.innerHTML = '')
  });

  if (modules.editNotes) return;
  modules.editNotes = true;

  // add listeners
  document.getElementById('notesSelect').addEventListener('change', changeObject);
  document.getElementById('notesName').addEventListener('input', changeName);
  document.getElementById('notesPin').addEventListener('click', () => (options.pinNotes = !options.pinNotes));
  document.getElementById('notesSpeak').addEventListener('click', () => speak(editor.content.innerHTML));
  document.getElementById('notesFocus').addEventListener('click', validateHighlightElement);
  document.getElementById('notesDownload').addEventListener('click', downloadLegends);
  document.getElementById('notesUpload').addEventListener('click', () => legendsToLoad.click());
  document.getElementById('legendsToLoad').addEventListener('change', function () {
    uploadFile(this, uploadLegends);
  });
  document.getElementById('notesClearStyle').addEventListener('click', clearStyle);
  document.getElementById('notesRemove').addEventListener('click', triggerNotesRemove);

  function showNote(note) {
    document.getElementById('notes').style.display = 'block';
    document.getElementById('notesHeader').innerHTML = note.name;
    document.getElementById('notesBody').innerHTML = note.legend;
  }

  function changeObject() {
    const note = notes.find((note) => note.id === this.value);
    if (!note) return;
    notesName.value = note.name;
    editor.content.innerHTML = note.legend;
  }

  function changeName() {
    const id = document.getElementById('notesSelect').value;
    const note = notes.find((note) => note.id === id);
    if (!note) return;
    note.name = this.value;
    showNote(note);
  }

  function validateHighlightElement() {
    const select = document.getElementById('notesSelect');
    const element = document.getElementById(select.value);

    if (element === null) {
      alertMessage.innerHTML = 'Related element is not found. Would you like to remove the note?';
      $('#alert').dialog({
        resizable: false,
        title: 'Element not found',
        buttons: {
          Remove: function () {
            $(this).dialog('close');
            removeLegend();
          },
          Keep: function () {
            $(this).dialog('close');
          }
        }
      });
      return;
    }

    highlightElement(element); // if element is found
  }

  function downloadLegends() {
    const data = JSON.stringify(notes);
    const name = getFileName('Notes') + '.txt';
    downloadFile(data, name);
  }

  function uploadLegends(dataLoaded) {
    if (!dataLoaded) {
      tip('Cannot load the file. Please check the data format', false, 'error');
      return;
    }
    notes = JSON.parse(dataLoaded);
    document.getElementById('notesSelect').options.length = 0;
    editNotes(notes[0].id, notes[0].name);
  }

  function clearStyle() {
    editor.content.innerHTML = editor.content.textContent;
  }

  function triggerNotesRemove() {
    alertMessage.innerHTML = 'Are you sure you want to remove the selected note?';
    $('#alert').dialog({
      resizable: false,
      title: 'Remove note',
      buttons: {
        Remove: function () {
          $(this).dialog('close');
          removeLegend();
        },
        Keep: function () {
          $(this).dialog('close');
        }
      }
    });
  }

  function removeLegend() {
    const select = document.getElementById('notesSelect');
    const index = notes.findIndex((n) => n.id === select.value);
    notes.splice(index, 1);
    select.options.length = 0;
    if (!notes.length) {
      $('#notesEditor').dialog('close');
      return;
    }
    notesText.innerHTML = '';
    editNotes(notes[0].id, notes[0].name);
  }
}
