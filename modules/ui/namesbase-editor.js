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
  document.getElementById("namesbaseAdd").addEventListener("click", namesbaseAdd);
  document.getElementById("namesbaseAnalize").addEventListener("click", analizeNamesbase);
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
    const b = document.getElementById("namesbaseTextarea").value;
    if (b.split(",").length < 3) {
      tip("The names data provided is too short of incorrect", false, "error");
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

  function analizeNamesbase() {
    const string = document.getElementById("namesbaseTextarea").value;
    if (!string) {tip("Names data field should not be empty", false, "error"); return;}
    const base = string.toLowerCase();
    const array = base.split(",");
    const l = array.length;
    if (!l) {tip("Names data should not be empty", false, "error"); return;}

    const wordsLength = array.map(n => n.length);
    const multi = rn(d3.mean(array.map(n => (n.match(/ /i)||[]).length)) * 100, 2);
    const geminate = array.map(name => name.match(/[^\w\s]|(.)(?=\1)/g)||[]).flat();
    const doubled = ([...new Set(geminate)].filter(l => geminate.filter(d => d === l).length > 3)||["none"]).join("");
    const chain = Names.calculateChain(string);
    const depth = rn(d3.mean(Object.keys(chain).map(key => chain[key].filter(c => c !== " ").length)));
    const nonLatin = (string.match(/[^\u0000-\u007f]/g)||["none"]).join("");

    const lengthStat = 
      l < 30 ? "<span style='color:red'>[not enough]</span>" :
      l < 150 ? "<span style='color:darkred'>[low]</span>" :
      l < 150 ? "<span style='color:orange'>[low]</span>" :
      l < 400 ? "<span style='color:green'>[good]</span>" :
      l < 600 ? "<span style='color:orange'>[overmuch]</span>" :
      "<span style='color:darkred'>[overmuch]</span>";

    const rangeStat = 
      l < 10 ? "<span style='color:red'>[low]</span>" :
      l < 15 ? "<span style='color:darkred'>[low]</span>" :
      l < 20 ? "<span style='color:orange'>[low]</span>" :
      "<span style='color:green'>[good]</span>";

    const depthStat = 
      l < 15 ? "<span style='color:red'>[low]</span>" :
      l < 20 ? "<span style='color:darkred'>[low]</span>" :
      l < 25 ? "<span style='color:orange'>[low]</span>" :
      "<span style='color:green'>[good]</span>";

    alertMessage.innerHTML = `<div style="line-height: 1.6em; max-width: 20em">
      <div>Namesbase length: ${l} ${lengthStat}</div>
      <div>Namesbase range: ${Object.keys(chain).length-1} ${rangeStat}</div>
      <div>Namesbase depth: ${depth} ${depthStat}</div>
      <div>Non-basic chars: ${nonLatin}</div>
      <hr>
      <div>Min name length: ${d3.min(wordsLength)}</div>
      <div>Max name length: ${d3.max(wordsLength)}</div>
      <div>Mean name length: ${rn(d3.mean(wordsLength), 1)}</div>
      <div>Median name length: ${d3.median(wordsLength)}</div>
      <div>Doubled chars: ${doubled}</div>
      <div>Multi-word names: ${multi}%</div>
    </div>`;
    $("#alert").dialog({
      resizable: false, title: "Data Analysis",
      position: {my: "left top-30", at: "right+10 top", of: "#namesbaseEditor"},
      buttons: {OK: function() {$(this).dialog("close");}}
    });
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
