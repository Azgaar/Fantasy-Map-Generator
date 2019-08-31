"use strict";
function editNamesbase() {
  if (customization) return;
  closeDialogs("#namesbaseEditor, .stable");
  $("#namesbaseEditor").dialog();

  if (modules.editNamesbase) return;
  modules.editNamesbase = true;

  // add listeners
  document.getElementById("namesbaseSelect").addEventListener("change", updateInputs);
  document.getElementById("namesbaseTextarea").addEventListener("change", updateNamesData);
  document.getElementById("namesbaseUpdateExamples").addEventListener("click", updateExamples);
  document.getElementById("namesbaseExamples").addEventListener("click", updateExamples);
  document.getElementById("namesbaseName").addEventListener("input", updateBaseName);
  document.getElementById("namesbaseMin").addEventListener("input", updateBaseMin);
  document.getElementById("namesbaseMax").addEventListener("input", updateBaseMax);
  document.getElementById("namesbaseDouble").addEventListener("input", updateBaseDublication);
  document.getElementById("namesbaseMulti").addEventListener("input", updateBaseMiltiwordRate);
  document.getElementById("namesbaseAdd").addEventListener("click", namesbaseAdd);
  document.getElementById("namesbaseDefault").addEventListener("click", namesbaseRestoreDefault);
  document.getElementById("namesbaseDownload").addEventListener("click", namesbaseDownload);
  document.getElementById("namesbaseUpload").addEventListener("click", e => namesbaseToLoad.click());
  document.getElementById("namesbaseToLoad").addEventListener("change", namesbaseUpload);

  createBasesList();
  updateInputs();

  $("#namesbaseEditor").dialog({
    title: "Namesbase Editor", width: 468,
    position: {my: "center", at: "center", of: "svg"}
  });

  function createBasesList() {
    const select = document.getElementById("namesbaseSelect");
    select.innerHTML = "";
    nameBases.forEach(function(b, i) {
      const option = new Option(b.name, i);
      select.options.add(option);
    });
  }

  function updateInputs() {
    const base = +document.getElementById("namesbaseSelect").value;
    if (!nameBases[base]) {tip(`Namesbase ${base} is not defined`, false, "error"); return;}
    document.getElementById("namesbaseTextarea").value = nameBase[base].join(", ");
    document.getElementById("namesbaseName").value = nameBases[base].name;
    document.getElementById("namesbaseMin").value = nameBases[base].min;
    document.getElementById("namesbaseMax").value = nameBases[base].max;
    document.getElementById("namesbaseDouble").value = nameBases[base].d;
    document.getElementById("namesbaseMulti").value = nameBases[base].m;
    updateExamples();
  }

  function updateExamples() {
    const base = +document.getElementById("namesbaseSelect").value;
    let examples = "";
    for (let i=0; i < 10; i++) {
      const example = Names.getBase(base);
      if (example === undefined) {
        examples = "Cannot generate examples. Please verify the data";
        break;
      }
      if (i) examples += ", ";
      examples += example;
    }
    document.getElementById("namesbaseExamples").innerHTML = examples;
  }

  function updateNamesData() {
    const base = +document.getElementById("namesbaseSelect").value;
    const data = document.getElementById("namesbaseTextarea").value.replace(/ /g, "").split(",");
    if (data.length < 3) {
      tip("The names data provided is not correct", false, "error");
      document.getElementById("namesbaseTextarea").value = nameBase[base].join(", ");
      return;
    }
    nameBase[base] = data;
    Names.updateChain(base);
  }

  function updateBaseName() {
    const base = +document.getElementById("namesbaseSelect").value;
    const select = document.getElementById("namesbaseSelect");
    select.options[namesbaseSelect.selectedIndex].innerHTML = this.value;
    nameBases[base].name = this.value;
  }

  function updateBaseMin() {
    const base = +document.getElementById("namesbaseSelect").value;
    if (+this.value > nameBases[base].max) {tip("Minimal length cannot be greater than maximal", false, "error"); return;}
    nameBases[base].min = +this.value;
  }

  function updateBaseMax() {
    const base = +document.getElementById("namesbaseSelect").value;
    if (+this.value < nameBases[base].min) {tip("Maximal length should be greater than minimal", false, "error"); return;}
    nameBases[base].max = +this.value;
  }

  function updateBaseDublication() {
    const base = +document.getElementById("namesbaseSelect").value;
    nameBases[base].d = this.value;
  }

  function updateBaseMiltiwordRate() {
    if (isNaN(+this.value) || +this.value < 0 || +this.value > 1) {tip("Please provide a number within [0-1] range", false, "error"); return;}
    const base = +document.getElementById("namesbaseSelect").value;
    nameBases[base].m = +this.value;
  }
  
  function namesbaseAdd() {
    const base = nameBases.length;
    nameBases.push({name: "Base" + base, min: 5, max: 12, d: "", m: 0});
    nameBase[base] = ["This", "is", "an", "example", "data", "Please", "replace", "with", "an", "actual", "names", "data", "with", "at", "least", "100", "names"];
    document.getElementById("namesbaseSelect").add(new Option("Base" + base, base));
    document.getElementById("namesbaseSelect").value = base;
    document.getElementById("namesbaseTextarea").value = nameBase[base].join(", ");
    document.getElementById("namesbaseName").value = "Base" + base;
    document.getElementById("namesbaseMin").value = 5;
    document.getElementById("namesbaseMax").value = 12;
    document.getElementById("namesbaseDouble").value = "";
    document.getElementById("namesbaseMulti").value = 0;
    document.getElementById("namesbaseExamples").innerHTML = "Please provide names data";
  }

  function namesbaseRestoreDefault() {
    alertMessage.innerHTML = `Are you sure you want to restore default namesbase?`;
    $("#alert").dialog({resizable: false, title: "Restore default data",
      buttons: {
        Restore: function() {
          $(this).dialog("close");
          applyDefaultNamesData();
          createBasesList();
          updateInputs();
          Names.updateChains();
        },
        Cancel: function() {$(this).dialog("close");}
      }
    });  
  }
  
  function namesbaseDownload() {
    const data = nameBases.map((b,i) => `${b.name}|${b.min}|${b.max}|${b.d}|${b.m}|${nameBase[i]}`);
    const dataBlob = new Blob([data.join("\r\n")], {type:"text/plain"});
    const url = window.URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.download = "namesbase" + Date.now() + ".txt";
    link.href = url;
    link.click();
  }

  function namesbaseUpload() {
    const fileToLoad = this.files[0];
    this.value = "";
    const fileReader = new FileReader();

    fileReader.onload = function(fileLoadedEvent) {
      const dataLoaded = fileLoadedEvent.target.result;
      const data = dataLoaded.split("\r\n");
      if (!data || !data[0]) {tip("Cannot load a namesbase. Please check the data format", false, "error"); return;}

      nameBases = [], nameBase = [];
      data.forEach(d => {
        const e = d.split("|");
        nameBases.push({name:e[0], min:e[1], max:e[2], d:e[3], m:e[4]});
        nameBase.push(e[5].split(","));
      });

      createBasesList();
      updateInputs();
      Names.updateChains();
    };

    fileReader.readAsText(fileToLoad, "UTF-8");    
  } 
}
