"use strict";
function editLegends(id, name) {
  // update list of objects
  const select = document.getElementById("legendSelect");
  for (let i = select.options.length; i < notes.length; i++) {
    select.options.add(new Option(notes[i].id, notes[i].id));
  }

  // select an object
  if (id) {
    let note = notes.find(note => note.id === id);
    if (note === undefined) {
      if (!name) name = id;
      note = {id, name, legend: ""};
      notes.push(note);
      select.options.add(new Option(id, id));
    }
    select.value = id;
    legendName.value = note.name;
    legendText.value = note.legend;
  }

  // open a dialog
  $("#legendEditor").dialog({
    title: "Legends Editor", minWidth: Math.min(svgWidth, 400),
    position: {my: "center", at: "center", of: "svg"}
  });

  if (modules.editLegends) return;
  modules.editLegends = true;

  // add listeners
  document.getElementById("legendSelect").addEventListener("change", changeObject);
  document.getElementById("legendName").addEventListener("input", changeName);
  document.getElementById("legendText").addEventListener("input", changeText);
  document.getElementById("legendFocus").addEventListener("click", validateHighlightElement);
  document.getElementById("legendDownload").addEventListener("click", downloadLegends);
  document.getElementById("legendUpload").addEventListener("click", () => legendsToLoad.click());
  document.getElementById("legendsToLoad").addEventListener("change", uploadLegends);
  document.getElementById("legendRemove").addEventListener("click", triggerLegendRemove);

  function changeObject() {
    const note = notes.find(note => note.id === this.value);
    legendName.value = note.name;
    legendText.value = note.legend;
  }

  function changeName() {
    const id = document.getElementById("legendSelect").value;
    const note = notes.find(note => note.id === id);
    note.name = this.value;
  }

  function changeText() {
    const id = document.getElementById("legendSelect").value;
    const note = notes.find(note => note.id === id);
    note.legend = this.value;
  }

  function validateHighlightElement() {
    const select = document.getElementById("legendSelect");
    const element = document.getElementById(select.value);

    // if element is not found
    if (element === null) {
      alertMessage.innerHTML = "Related element is not found. Would you like to remove the note (legend item)?";
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

  function highlightElement(element) {
    if (debug.select(".highlighted").size()) return; // allow only 1 highlight element simultaniosly
    const box = element.getBBox();
    const transform = element.getAttribute("transform") || null;
    const t = d3.transition().duration(1000).ease(d3.easeBounceOut);
    const r = d3.transition().duration(500).ease(d3.easeLinear);

    const highlight = debug.append("rect").attr("x", box.x).attr("y", box.y)
      .attr("width", box.width).attr("height", box.height).attr("transform", transform);

    highlight.classed("highlighted", 1)
      .transition(t).style("outline-offset", "0px")
      .transition(r).style("outline-color", "transparent").remove();

    const tr = parseTransform(transform);
    let x = box.x + box.width / 2;
    if (tr[0]) x += tr[0];
    let y = box.y + box.height / 2;
    if (tr[1]) y += tr[1];
    if (scale >= 2) zoomTo(x, y, scale, 1600);
  }

  function downloadLegends() {
    const legendString = JSON.stringify(notes);
    const dataBlob = new Blob([legendString],{type:"text/plain"});
    const url = window.URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.download = "legends" + Date.now() + ".txt";
    link.href = url;
    link.click();
  }

  function uploadLegends() {
    const fileToLoad = this.files[0];
    this.value = "";
    const fileReader = new FileReader();
    fileReader.onload = function(fileLoadedEvent) {
      const dataLoaded = fileLoadedEvent.target.result;
      if (dataLoaded) {
        notes = JSON.parse(dataLoaded);
        document.getElementById("legendSelect").options.length = 0;
        editLegends(notes[0].id, notes[0].name);
      } else {
        tip("Cannot load a file. Please check the data format", false, "error")
      }
    }
    fileReader.readAsText(fileToLoad, "UTF-8");
  }

  function triggerLegendRemove() {
    alertMessage.innerHTML = "Are you sure you want to remove the selected legend?";
    $("#alert").dialog({resizable: false, title: "Remove legend element",
      buttons: {
        Remove: function() {$(this).dialog("close"); removeLegend();},
        Keep: function() {$(this).dialog("close");}
      }
    });
  }

  function removeLegend() {
    const select = document.getElementById("legendSelect");
    const index = notes.findIndex(n => n.id === select.value);
    notes.splice(index, 1);
    select.options.length = 0;
    if (!notes.length) {$("#legendEditor").dialog("close"); return;}
    editLegends(notes[0].id, notes[0].name);
  }

}