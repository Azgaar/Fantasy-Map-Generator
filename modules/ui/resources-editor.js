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
  document.getElementById("resourcesEditStyle").addEventListener("click", () => editStyle("goods"));
  document.getElementById("resourcesLegend").addEventListener("click", toggleLegend);
  document.getElementById("resourcesPercentage").addEventListener("click", togglePercentageMode);
  document.getElementById("resourcesExport").addEventListener("click", downloadResourcesData);

  // add line for each resource
  function resourcesEditorAddLines() {
    let lines = "";

    // // {i: 33, name: "Saltpeter", icon: "resource-saltpeter", color: "#e6e3e3", value: 8, chance: 2, model: "habitability", bonus: {artillery: 3}}
    for (const r of pack.resources) {
      lines += `<div class="states resources" data-id=${r.i} data-name="${r.name}" data-color="${r.color}" data-chance="${r.chance}" data-value="${r.value}" data-model="${r.model}" data-cells="${r.cells}">
        <svg data-tip="Resource icon. Click to change" width="2em" height="2em" class="icon">
          <circle cx="50%" cy="50%" r="42%" fill="${r.color}" stroke="${r.stroke}"/>
          <use href="#${r.icon}" x="10%" y="10%" width="80%" height="80%"/>
        </svg>
        <input data-tip="Resource name. Click and type to change" class="resourceName" value="${r.name}" autocorrect="off" spellcheck="false">
        <select data-tip="Resource type. Select to change" class="resourceType"><option selected>No data</option></select>
        <input data-tip="Resource spread model. Select to change" value="${r.model}" class="model"/>

        <input data-tip="Resource basic value. Click and type to change" value="${r.value}" type="number">
        <input data-tip="Resource generation chance in eligible cell. Click and type to change" value="${r.chance}" type="number">
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
    // body.querySelectorAll("rect.fillRect").forEach(el => el.addEventListener("click", resourceChangeColor));

    if (body.dataset.type === "percentage") {body.dataset.type = "absolute"; togglePercentageMode();}
    applySorting(resourcesHeader);
    $("#resourcesEditor").dialog({width: fitContent()});
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
    let data = "Id,Resource,Type,Color,Icon,Value,Chance,Model,Cells\n"; // headers

    body.querySelectorAll(":scope > div").forEach(function(el) {
      data += el.dataset.id + ",";
      data += el.dataset.name + ",";
      data += el.dataset.type + ",";
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
