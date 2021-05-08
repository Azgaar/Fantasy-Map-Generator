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

  // add line for each resource
  function resourcesEditorAddLines() {
    let lines = "";
    const categories = [...new Set(pack.resources.map(r => r.category))].sort();
    const categoryOptions = category => categories.map(c => `<option ${c === category ? "selected" : ""} value="${c}">${c}</option>`).join("");

    const models = [...new Set(pack.resources.map(r => r.model))].sort();
    const modelOptions = model => models.map(m => `<option ${m === model ? "selected" : ""} value="${m}">${m.replaceAll("_", " ")}</option>`).join("");

    // // {i: 33, name: "Saltpeter", icon: "resource-saltpeter", color: "#e6e3e3", value: 8, chance: 2, model: "habitability", bonus: {artillery: 3}}
    for (const r of pack.resources) {
      const stroke = Resources.getStroke(r.color);
      lines += `<div class="states resources" data-id=${r.i} data-name="${r.name}" data-color="${r.color}"
        data-category="${r.category}" data-chance="${r.chance}"
        data-value="${r.value}" data-model="${r.model}" data-cells="${r.cells}">
        <svg data-tip="Resource icon. Click to change" width="2em" height="2em" class="icon">
          <circle cx="50%" cy="50%" r="42%" fill="${r.color}" stroke="${stroke}"/>
          <use href="#${r.icon}" x="10%" y="10%" width="80%" height="80%"/>
        </svg>
        <input data-tip="Resource name. Click and category to change" class="resourceName" value="${r.name}" autocorrect="off" spellcheck="false">
        <select data-tip="Resource category. Select to change">${categoryOptions(r.category)}</select>
        <select data-tip="Resource spread model. Select to change" class="model">${modelOptions(r.model)}</select>

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
