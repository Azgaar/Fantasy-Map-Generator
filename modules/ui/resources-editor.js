"use strict";
function editResources() {
  if (customization) return;
  closeDialogs("#resourcesEditor, .stable");
  if (!layerIsOn("toggleResources")) toggleResources();
  const body = document.getElementById("resourcesBody");

  resourcesEditorAddLines();

  if (modules.editResources) return;
  modules.editResources = true;

  $("#resourcesEditor").dialog({
    title: "Resources Editor", resizable: false, width: fitContent(), close: closeResourcesEditor,
    position: {my: "right top", at: "right-10 top+10", of: "svg"}
  });

  // add listeners
  document.getElementById("resourcesEditorRefresh").addEventListener("click", resourcesEditorAddLines);
  document.getElementById("resourcesRegenerate").addEventListener("click", regenerateResources);
  document.getElementById("resourcesLegend").addEventListener("click", toggleLegend);
  document.getElementById("resourcesPercentage").addEventListener("click", togglePercentageMode);
  document.getElementById("resourcesExport").addEventListener("click", downloadResourcesData);

  body.addEventListener("click", function(ev) {
    const el = ev.target, cl = el.classList, line = el.parentNode, i = +line.dataset.id;
    const resource = Resources.get(+line.dataset.id);
    if (cl.contains("resourceCategory")) return changeCategory(resource, line, el);
    if (cl.contains("resourceModel")) return changeModel(resource, line, el);
  });

  body.addEventListener("change", function(ev) {
    const el = ev.target, cl = el.classList, line = el.parentNode;
    const resource = Resources.get(+line.dataset.id);
    if (cl.contains("resourceName")) return changeName(resource, el.value, line);
  });

  // add line for each resource
  function resourcesEditorAddLines() {
    const addTitle = (string, max) => string.length < max ? "" : `title="${string}"`;
    let lines = "";

    // // {i: 33, name: "Saltpeter", icon: "resource-saltpeter", color: "#e6e3e3", value: 8, chance: 2, model: "habitability", bonus: {artillery: 3}}
    for (const r of pack.resources) {
      const stroke = Resources.getStroke(r.color);
      const model = r.model.replaceAll("_", " ");

      lines += `<div class="states resources" data-id=${r.i} data-name="${r.name}" data-color="${r.color}"
        data-category="${r.category}" data-chance="${r.chance}"
        data-value="${r.value}" data-model="${r.model}" data-cells="${r.cells}">
        <svg data-tip="Resource icon. Click to change" width="2em" height="2em" class="icon">
          <circle cx="50%" cy="50%" r="42%" fill="${r.color}" stroke="${stroke}"/>
          <use href="#${r.icon}" x="10%" y="10%" width="80%" height="80%"/>
        </svg>
        <input data-tip="Resource name. Click and category to change" class="resourceName" value="${r.name}" autocorrect="off" spellcheck="false">
        <div data-tip="Resource category. Select to change" class="resourceCategory" ${addTitle(r.category, 8)}">${r.category}</div>
        <div data-tip="Resource spread model. Select to change" class="resourceModel" ${addTitle(model, 8)}">${model}</div>

        <input data-tip="Resource basic value. Click and type to change" value="${r.value}" type="number" min=0 max=100 step=1 />
        <input data-tip="Resource generation chance in eligible cell. Click and type to change" value="${r.chance}" type="number" min=0 max=100 step=.1 />
        <div data-tip="Number of cells with resource" class="cells">${r.cells}</div>

        <span data-tip="Remove resource" class="icon-trash-empty hide"></span>
      </div>`;
    }
    body.innerHTML = lines;

    // update footer
    document.getElementById("resourcesNumber").innerHTML = pack.resources.length;

    // add listeners
    // body.querySelectorAll("div.resources").forEach(el => el.addEventListener("mouseenter", ev => resourceHighlightOn(ev)));
    // body.querySelectorAll("div.resources").forEach(el => el.addEventListener("mouseleave", ev => resourceHighlightOff(ev)));
    // body.querySelectorAll("div.states").forEach(el => el.addEventListener("click", selectResourceOnLineClick));
    body.querySelectorAll("svg.icon").forEach(el => el.addEventListener("click", resourceChangeColor));

    if (body.dataset.type === "percentage") {body.dataset.type = "absolute"; togglePercentageMode();}
    applySorting(resourcesHeader);
    $("#resourcesEditor").dialog({width: fitContent()});
  }

  function changeName(resource, name, line) {
    resource.name = line.dataset.name = name;
  }

  function changeCategory(resource, line, el) {
    const categories = [...new Set(pack.resources.map(r => r.category))].sort();
    const categoryOptions = category => categories.map(c => `<option ${c === category ? "selected" : ""} value="${c}">${c}</option>`).join("");

    alertMessage.innerHTML = `
      <div style="margin-bottom:.2em" data-tip="Select category from the list">
        <div style="display: inline-block; width: 9em">Select category:</div>
        <select style="width: 9em" id="resouceCategorySelect">${categoryOptions(line.dataset.category)}</select>
      </div>

      <div style="margin-bottom:.2em" data-tip="Type new category name">
        <div style="display: inline-block; width: 9em">Custom category:</div>
        <input style="width: 9em" id="resouceCategoryAdd" placeholder="Category name" />
      </div>
    `;

    $("#alert").dialog({resizable: false, title: "Change category",
      buttons: {
        Cancel: function() {$(this).dialog("close");},
        Apply: function() {applyChanges(); $(this).dialog("close");}
      }
    });

    function applyChanges() {
      const custom = document.getElementById("resouceCategoryAdd").value;
      const select = document.getElementById("resouceCategorySelect").value;
      const category = custom ? capitalize(custom) : select;
      resource.category = line.dataset.category = el.innerHTML = category;
    }
  }

  function changeModel(resource, line, el) {
    const defaultModels = Resources.defaultModels;
    const model = line.dataset.model;
    const modelOptions = Object.keys(defaultModels).map(m => `<option ${m === model ? "selected" : ""} value="${m}">${m.replaceAll("_", " ")}</option>`).join("");
    const wikiURL = "https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Resources:-spread-functions";

    alertMessage.innerHTML = `
      <fieldset data-tip="Select one of the predefined spread models from the list" style="border: 1px solid #999; margin-bottom: 1em">
        <legend>Predefined models</legend>
        <div style="margin-bottom:.2em">
          <div style="display: inline-block; width: 6em">Name:</div>
          <select onchange="resouceModelFunction.innerHTML = Resources.defaultModels[this.value]" style="width: 14em" id="resouceModelSelect">${modelOptions}</select>
        </div>

        <div style="margin-bottom:.2em">
          <div style="display: inline-block; width: 6em">Function:</div>
          <div style="display: inline-block; width: 14em; font-family: monospace" id="resouceModelFunction">${defaultModels[model]}</div>
        </div>
      </fieldset>

      <fieldset data-tip="Advanced option. Define custom spread model, click on 'Help' for details" style="border: 1px solid #999">
        <legend>Custom model</legend>
        <div style="margin-bottom:.2em">
          <div style="display: inline-block; width: 6em">Name:</div>
          <input style="width: 14em" id="resouceModelCustomName" />
        </div>

        <div>
          <div style="display: inline-block; width: 6em">Function:</div>
          <input style="width: 14em" id="resouceModelCustomFunction" />
        </div>
      </fieldset>

      <div id="resourceModelMessage" style="color: #b20000; margin: .4em 1em 0"></div>
    `;

    $("#alert").dialog({resizable: false, title: "Change spread model",
      buttons: {
        Help: () => openURL(wikiURL),
        Cancel: function() {$(this).dialog("close");},
        Apply: function() {applyChanges(this);}
      }
    });

    function applyChanges(dialog) {
      const customName = document.getElementById("resouceModelCustomName").value;
      const customFn = document.getElementById("resouceModelCustomFunction").value;

      const message = document.getElementById("resourceModelMessage");
      if (customName && !customFn) return message.innerHTML = "Error. Custom model function is required";
      if (!customName && customFn) return message.innerHTML = "Error. Custom model name is required";
      message.innerHTML = "";

      if (customName && customFn) {
        resource.model = line.dataset.model = el.innerHTML = customName;
        resource.custom = customFn;
        return;
      }

      const model = document.getElementById("resouceModelSelect").value;
      resource.model = line.dataset.model = el.innerHTML = model;
      $(dialog).dialog("close");
    }
  }

  function resourceChangeColor() {
    const circle = this.querySelector("circle");
    const resource = Resources.get(+this.parentNode.dataset.id);

    const callback = function(fill) {
      const stroke = Resources.getStroke(fill);
      circle.setAttribute("fill", fill);
      circle.setAttribute("stroke", stroke);
      resource.color = fill;
      resource.stroke = stroke;
      goods.selectAll(`circle[data-i='${resource.i}']`).attr("fill", fill).attr("stroke", stroke);
    }

    openPicker(resource.color, callback, {allowHatching: false});
  }

  function toggleLegend() {
    if (legend.selectAll("*").size()) {clearLegend(); return;}; // hide legend
    const data = pack.resources.filter(r => r.i && r.cells).sort((a, b) => b.cells - a.cells).map(r => [r.i, r.color, r.name]);
    drawLegend("Resources", data);
  }

  function togglePercentageMode() {
    if (body.dataset.type === "absolute") {
      body.dataset.type = "percentage";
      const totalCells = pack.cells.resource.filter(r => r !== 0).length;

      body.querySelectorAll(":scope > div").forEach(function(el) {
        el.querySelector(".cells").innerHTML = rn(+el.dataset.cells / totalCells * 100) + "%";
      });
    } else {
      body.dataset.type = "absolute";
      resourcesEditorAddLines();
    }
  }

  function downloadResourcesData() {
    let data = "Id,Resource,Category,Color,Icon,Value,Chance,Model,Cells\n"; // headers

    body.querySelectorAll(":scope > div").forEach(function(el) {
      data += el.dataset.id + ",";
      data += el.dataset.name + ",";
      data += el.dataset.category + ",";
      data += el.dataset.color + ",";
      data += el.dataset.icon + ",";
      data += el.dataset.value + ",";
      data += el.dataset.chance + ",";
      data += el.dataset.model + ",";
      data += el.dataset.cells + "\n";
    });

    const name = getFileName("Resources") + ".csv";
    downloadFile(data, name);
  }
  
  function closeResourcesEditor() {

  }

}
