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
  document.getElementById("namesbaseAnalyze").addEventListener("click", analyzeNamesbase);
  document.getElementById("namesbaseDefault").addEventListener("click", namesbaseRestoreDefault);
  document.getElementById("namesbaseDownload").addEventListener("click", namesbaseDownload);

  const uploader = document.getElementById("namesbaseToLoad");
  document.getElementById("namesbaseUpload").addEventListener("click", () => {
    uploader.addEventListener("change", function (event) {
      uploadFile(event.target, d => namesbaseUpload(d, true));
    }, { once: true });
    uploader.click();
  });
  document.getElementById("namesbaseUploadExtend").addEventListener("click", () => {
    uploader.addEventListener("change", function (event) {
      uploadFile(event.target, d => namesbaseUpload(d, false));
    }, { once: true });
    uploader.click();
  });

  document.getElementById("namesbaseCA").addEventListener("click", () => {
    openURL("https://cartographyassets.com/asset-category/specific-assets/azgaars-generator/namebases/");
  });
  document.getElementById("namesbaseSpeak").addEventListener("click", () => speak(namesbaseExamples.textContent));

  createBasesList();
  updateInputs();

  $("#namesbaseEditor").dialog({
    title: "Namesbase Editor",
    width: "auto",
    position: {my: "center", at: "center", of: "svg"}
  });

  function createBasesList() {
    const select = document.getElementById("namesbaseSelect");
    select.innerHTML = "";
    nameBases.forEach((b, i) => select.options.add(new Option(b.name, i)));
  }

  function updateInputs() {
    const base = +document.getElementById("namesbaseSelect").value;
    if (!nameBases[base]) {
      tip(`Namesbase ${base} is not defined`, false, "error");
      return;
    }
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
    for (let i = 0; i < 10; i++) {
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
    if (+this.value > nameBases[base].max) {
      tip("Minimal length cannot be greater than maximal", false, "error");
      return;
    }
    nameBases[base].min = +this.value;
  }

  function updateBaseMax() {
    const base = +document.getElementById("namesbaseSelect").value;
    if (+this.value < nameBases[base].min) {
      tip("Maximal length should be greater than minimal", false, "error");
      return;
    }
    nameBases[base].max = +this.value;
  }

  function updateBaseDublication() {
    const base = +document.getElementById("namesbaseSelect").value;
    nameBases[base].d = this.value;
  }

  function analyzeNamesbase() {
    const namesSourceString = document.getElementById("namesbaseTextarea").value;
    const namesArray = namesSourceString.toLowerCase().split(",");
    const length = namesArray.length;
    if (!namesSourceString || !length) return tip("Names data should not be empty", false, "error");

    const chain = Names.calculateChain(namesSourceString);
    const variety = rn(d3.mean(Object.values(chain).map(keyValue => keyValue.length)));

    const wordsLength = namesArray.map(n => n.length);

    const nonLatin = namesSourceString.match(/[^\u0000-\u007f]/g);
    const nonBasicLatinChars = nonLatin
      ? unique(
          namesSourceString
            .match(/[^\u0000-\u007f]/g)
            .join("")
            .toLowerCase()
        ).join("")
      : "none";

    const geminate = namesArray.map(name => name.match(/[^\w\s]|(.)(?=\1)/g) || []).flat();
    const doubled = unique(geminate).filter(char => geminate.filter(doudledChar => doudledChar === char).length > 3) || ["none"];

    const duplicates = unique(namesArray.filter((e, i, a) => a.indexOf(e) !== i)).join(", ") || "none";
    const multiwordRate = d3.mean(namesArray.map(n => +n.includes(" ")));

    const getLengthQuality = () => {
      if (length < 30) return "<span data-tip='Namesbase contains < 30 names - not enough to generate reasonable data' style='color:red'>[not enough]</span>";
      if (length < 100) return "<span data-tip='Namesbase contains < 100 names - not enough to generate good names' style='color:darkred'>[low]</span>";
      if (length <= 400) return "<span data-tip='Namesbase contains a reasonable number of samples' style='color:green'>[good]</span>";
      return "<span data-tip='Namesbase contains > 400 names. That is too much, try to reduce it to ~300 names' style='color:darkred'>[overmuch]</span>";
    };

    const getVarietyLevel = () => {
      if (variety < 15) return "<span data-tip='Namesbase average variety < 15 - generated names will be too repetitive' style='color:red'>[low]</span>";
      if (variety < 30) return "<span data-tip='Namesbase average variety < 30 - names can be too repetitive' style='color:orange'>[mean]</span>";
      return "<span data-tip='Namesbase variety is good' style='color:green'>[good]</span>";
    };

    alertMessage.innerHTML = /* html */ `<div style="line-height: 1.6em; max-width: 20em">
      <div data-tip="Number of names provided">Namesbase length: ${length} ${getLengthQuality()}</div>
      <div data-tip="Average number of generation variants for each key in the chain">Namesbase variety: ${variety} ${getVarietyLevel()}</div>
      <hr />
      <div data-tip="The shortest name length">Min name length: ${d3.min(wordsLength)}</div>
      <div data-tip="The longest name length">Max name length: ${d3.max(wordsLength)}</div>
      <div data-tip="Average name length">Mean name length: ${rn(d3.mean(wordsLength), 1)}</div>
      <div data-tip="Common name length">Median name length: ${d3.median(wordsLength)}</div>
      <hr />
      <div data-tip="Characters outside of Basic Latin have bad font support">Non-basic chars: ${nonBasicLatinChars}</div>
      <div data-tip="Characters that are frequently (more than 3 times) doubled">Doubled chars: ${doubled.join("")}</div>
      <div data-tip="Names used more than one time">Duplicates: ${duplicates}</div>
      <div data-tip="Percentage of names containing space character">Multi-word names: ${rn(multiwordRate * 100, 2)}%</div>
    </div>`;

    $("#alert").dialog({
      resizable: false,
      title: "Data Analysis",
      position: {my: "left top-30", at: "right+10 top", of: "#namesbaseEditor"},
      buttons: {
        OK: function () {
          $(this).dialog("close");
        }
      }
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
    alertMessage.innerHTML = /* html */ `Are you sure you want to restore default namesbase?`;
    $("#alert").dialog({
      resizable: false,
      title: "Restore default data",
      buttons: {
        Restore: function () {
          $(this).dialog("close");
          Names.clearChains();
          nameBases = Names.getNameBases();
          createBasesList();
          updateInputs();
        },
        Cancel: function () {
          $(this).dialog("close");
        }
      }
    });
  }

  function namesbaseDownload() {
    const data = nameBases.map((b, i) => `${b.name}|${b.min}|${b.max}|${b.d}|${b.m}|${b.b}`).join("\r\n");
    const name = getFileName("Namesbase") + ".txt";
    downloadFile(data, name);
  }

  function namesbaseUpload(dataLoaded, override=true) {
    const data = dataLoaded.split("\r\n");
    if (!data || !data[0]) {
      tip("Cannot load a namesbase. Please check the data format", false, "error");
      return;
    }

    Names.clearChains();
    if (override) nameBases = [];
    data.forEach(d => {
      const e = d.split("|");
      nameBases.push({name: e[0], min: e[1], max: e[2], d: e[3], m: e[4], b: e[5]});
    });

    createBasesList();
    updateInputs();
  }
}
