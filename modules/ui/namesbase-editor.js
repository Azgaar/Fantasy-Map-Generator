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
  document.getElementById("namesbaseUpload").addEventListener("click", () => namesbaseToLoad.click());
  document.getElementById("namesbaseToLoad").addEventListener("change", function() {uploadFile(this, namesbaseUpload)});

  createBasesList();
  updateInputs();

  $("#namesbaseEditor").dialog({
    title: "Namesbase Editor", width: "42.5em",
    position: {my: "center", at: "center", of: "svg"}
  });

  function createBasesList() {
    const select = document.getElementById("namesbaseSelect");
    select.innerHTML = "";
    nameBases.forEach((b, i) => select.options.add(new Option(b.name, i)));
  }

  function updateInputs() {
    const base = +document.getElementById("namesbaseSelect").value;
    if (!nameBases[base]) {tip(`Namesbase ${base} is not defined`, false, "error"); return;}
    document.getElementById("namesbaseTextarea").value = nameBases[base].b;
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
    const b = document.getElementById("namesbaseTextarea").value.replace(/ /g, "");
    if (b.split(",").length < 3) {
      tip("The names data provided is not correct", false, "error");
      document.getElementById("namesbaseTextarea").value = nameBases[base].b;
      return;
    }
    nameBases[base].b = b;
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
    const b = "This,is,an,example,of,name,base,showing,correct,format,It,should,have,at,least,one,hundred,names,separated,with,comma";
    nameBases.push({name: "Base" + base, min: 5, max: 12, d: "", m: 0, b});
    document.getElementById("namesbaseSelect").add(new Option("Base" + base, base));
    document.getElementById("namesbaseSelect").value = base;
    document.getElementById("namesbaseTextarea").value = b;
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
          Names.clearChains();
          nameBases = Names.getNameBases();
          createBasesList();
          updateInputs();
        },
        Cancel: function() {$(this).dialog("close");}
      }
    });
  }

  function namesbaseDownload() {
    const data = nameBases.map((b,i) => `${b.name}|${b.min}|${b.max}|${b.d}|${b.m}|${b.b}`).join("\r\n");
    const name = getFileName("Namesbase") + ".txt";
    downloadFile(data, name);
  }

  function namesbaseUpload(dataLoaded) {
    const data = dataLoaded.split("\r\n");
    if (!data || !data[0]) {tip("Cannot load a namesbase. Please check the data format", false, "error"); return;}

    Names.clearChains();
    nameBases = [];
    data.forEach(d => {
      const e = d.split("|");
      nameBases.push({name:e[0], min:e[1], max:e[2], d:e[3], m:e[4], b:e[5]});
    });

    createBasesList();
    updateInputs();
  }
}
