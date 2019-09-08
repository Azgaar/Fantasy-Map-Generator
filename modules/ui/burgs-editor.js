"use strict";
function editBurgs() {
  if (customization) return;
  closeDialogs("#burgsEditor, .stable");
  if (!layerIsOn("toggleIcons")) toggleIcons();
  if (!layerIsOn("toggleLabels")) toggleLabels();

  const body = document.getElementById("burgsBody");
  updateFilter();
  burgsEditorAddLines();
  $("#burgsEditor").dialog();

  if (modules.editBurgs) return;
  modules.editBurgs = true;

  $("#burgsEditor").dialog({
    title: "Burgs Editor", resizable: false, width: fitContent(), close: exitAddBurgMode,
    position: {my: "right top", at: "right-10 top+10", of: "svg", collision: "fit"}
  });

  // add listeners
  document.getElementById("burgsEditorRefresh").addEventListener("click", refreshBurgsEditor);
  document.getElementById("burgsFilterState").addEventListener("change", burgsEditorAddLines);
  document.getElementById("burgsFilterCulture").addEventListener("change", burgsEditorAddLines);
  document.getElementById("regenerateBurgNames").addEventListener("click", regenerateNames);
  document.getElementById("addNewBurg").addEventListener("click", enterAddBurgMode);
  document.getElementById("burgsExport").addEventListener("click", downloadBurgsData);
  document.getElementById("burgNamesImport").addEventListener("click", e => burgsListToLoad.click());
  document.getElementById("burgsListToLoad").addEventListener("change", importBurgNames);
  document.getElementById("burgsRemoveAll").addEventListener("click", triggerAllBurgsRemove);

  function refreshBurgsEditor() {
    updateFilter();
    burgsEditorAddLines();
  }

  function updateFilter() {
    const stateFilter = document.getElementById("burgsFilterState");
    const selectedState = stateFilter.value || 1;
    stateFilter.options.length = 0; // remove all options
    stateFilter.options.add(new Option(`all`, -1, false, selectedState == -1));
    stateFilter.options.add(new Option(pack.states[0].name, 0, false, !selectedState));
    const statesSorted = pack.states.filter(s => s.i && !s.removed).sort((a, b) => (a.name > b.name) ? 1 : -1);
    statesSorted.forEach(s => stateFilter.options.add(new Option(s.name, s.i, false, s.i == selectedState)));

    const cultureFilter = document.getElementById("burgsFilterCulture");
    const selectedCulture = cultureFilter.value || -1;
    cultureFilter.options.length = 0; // remove all options
    cultureFilter.options.add(new Option(`all`, -1, false, selectedCulture == -1));
    cultureFilter.options.add(new Option(pack.cultures[0].name, 0, false, !selectedCulture));
    const culturesSorted = pack.cultures.filter(c => c.i && !c.removed).sort((a, b) => (a.name > b.name) ? 1 : -1);
    culturesSorted.forEach(c => cultureFilter.options.add(new Option(c.name, c.i, false, c.i == selectedCulture)));
  }

  // add line for each state
  function burgsEditorAddLines() {
    const selectedState = +document.getElementById("burgsFilterState").value;
    const selectedCulture = +document.getElementById("burgsFilterCulture").value;
    let filtered = pack.burgs.filter(b => b.i && !b.removed); // all valid burgs
    if (selectedState != -1) filtered = filtered.filter(b => b.state === selectedState); // filtered by state
    if (selectedCulture != -1) filtered = filtered.filter(b => b.culture === selectedCulture); // filtered by culture

    const showState = selectedState == -1 ? "visible" : "hidden";
    document.getElementById("burgStateHeader").style.display = `${selectedState == -1 ? "inline-block" : "none"}`;
    body.innerHTML = "";
    let lines = "", totalPopulation = 0;

    for (const b of filtered) {
      const population = b.population * populationRate.value * urbanization.value;
      totalPopulation += population;
      const type = b.capital && b.port ? "a-capital-port" : b.capital ? "c-capital" : b.port ? "p-port" : "z-burg";
      const state = pack.states[b.state].name;
      const culture = pack.cultures[b.culture].name;

      lines += `<div class="states" data-id=${b.i} data-name=${b.name} data-state=${state} data-culture=${culture} data-population=${population} data-type=${type}>
        <span data-tip="Click to zoom into view" class="icon-dot-circled pointer"></span>
        <input data-tip="Burg name. Click and type to change" class="burgName" value="${b.name}" autocorrect="off" spellcheck="false">
        <span data-tip="Burg state" class="burgState ${showState}">${state}</span>
        <select data-tip="Dominant culture. Click to change" class="stateCulture">${getCultureOptions(b.culture)}</select>
        <span data-tip="Burg population" class="icon-male"></span>
        <input data-tip="Burg population. Type to change" class="burgPopulation" value=${si(population)}>
        <div class="burgType">
          <span data-tip="${b.capital ? ' This burg is a state capital' : 'Click to assign a capital status'}" class="icon-star-empty${b.capital ? '' : ' inactive pointer'}"></span>
          <span data-tip="Click to toggle port status" class="icon-anchor pointer${b.port ? '' : ' inactive'}" style="font-size:.9em"></span>
        </div>
        <span data-tip="Remove burg" class="icon-trash-empty"></span>
      </div>`;
    }
    body.insertAdjacentHTML("beforeend", lines);

    // update footer
    burgsFooterBurgs.innerHTML = filtered.length;
    burgsFooterPopulation.innerHTML = filtered.length ? si(totalPopulation / filtered.length) : 0;

    // add listeners
    body.querySelectorAll("div.states").forEach(el => el.addEventListener("mouseenter", ev => burgHighlightOn(ev)));
    body.querySelectorAll("div.states").forEach(el => el.addEventListener("mouseleave", ev => burgHighlightOff(ev)));
    body.querySelectorAll("div > input.burgName").forEach(el => el.addEventListener("input", changeBurgName));
    body.querySelectorAll("div > span.icon-dot-circled").forEach(el => el.addEventListener("click", zoomIntoBurg));
    body.querySelectorAll("div > select.stateCulture").forEach(el => el.addEventListener("change", changeBurgCulture));
    body.querySelectorAll("div > input.burgPopulation").forEach(el => el.addEventListener("change", changeBurgPopulation));
    body.querySelectorAll("div > span.icon-star-empty").forEach(el => el.addEventListener("click", toggleCapitalStatus));
    body.querySelectorAll("div > span.icon-anchor").forEach(el => el.addEventListener("click", togglePortStatus));
    body.querySelectorAll("div > span.icon-trash-empty").forEach(el => el.addEventListener("click", triggerBurgRemove));

    applySorting(burgsHeader);
  }

  function getCultureOptions(culture) {
    let options = "";
    pack.cultures.forEach(c => options += `<option ${c.i === culture ? "selected" : ""} value="${c.i}">${c.name}</option>`);
    return options;
  }

  function burgHighlightOn(event) {
    if (!layerIsOn("toggleLabels")) toggleLabels();
    const burg = +event.target.dataset.id;
    burgLabels.select("[data-id='" + burg + "']").classed("drag", true);
  }

  function burgHighlightOff() {
    burgLabels.selectAll("text.drag").classed("drag", false);
  }

  function changeBurgName() {
    if (this.value == "")tip("Please provide a name", false, "error");
    const burg = +this.parentNode.dataset.id;
    pack.burgs[burg].name = this.value;
    this.parentNode.dataset.name = this.value;
    const label = document.querySelector("#burgLabels [data-id='" + burg + "']");
    if (label) label.innerHTML = this.value;
  }

  function zoomIntoBurg() {
    const burg = +this.parentNode.dataset.id;
    const label = document.querySelector("#burgLabels [data-id='" + burg + "']");
    const x = +label.getAttribute("x"), y = +label.getAttribute("y");
    zoomTo(x, y, 8, 2000);
  }

  function changeBurgCulture() {
    const burg = +this.parentNode.dataset.id;
    const v = +this.value;
    pack.burgs[burg].culture = v;
    this.parentNode.dataset.culture = pack.cultures[v].name;
  }

  function changeBurgPopulation() {
    const burg = +this.parentNode.dataset.id;
    if (this.value == "" || isNaN(+this.value)) {
      tip("Please provide an integer number (like 10000, not 10K)", false, "error");
      this.value = si(pack.burgs[burg].population * populationRate.value * urbanization.value);
      return;
    }
    pack.burgs[burg].population = this.value / populationRate.value / urbanization.value;
    this.parentNode.dataset.population = this.value;
    this.value = si(this.value);

    const population = [];
    body.querySelectorAll(":scope > div").forEach(el => population.push(+getInteger(el.dataset.population)));
    burgsFooterPopulation.innerHTML = si(d3.mean(population));
  }

  function toggleCapitalStatus() {
    const burg = +this.parentNode.parentNode.dataset.id, state = pack.burgs[burg].state;
    if (pack.burgs[burg].capital) {tip("To change capital please assign a capital status to another burg", false, "error"); return;}
    if (!state) {tip("Neutral lands do not have a capital", false, "error"); return;}
    const old = pack.states[state].capital;

    // change statuses
    pack.states[state].capital = burg;
    pack.states[state].center = pack.burgs[burg].cell;
    pack.burgs[burg].capital = true;
    pack.burgs[old].capital = false;
    moveBurgToGroup(burg, "cities");
    moveBurgToGroup(old, "towns");

    burgsEditorAddLines();
  }

  function togglePortStatus() {
    const burg = +this.parentNode.parentNode.dataset.id;
    const anchor = document.querySelector("#anchors [data-id='" + burg + "']");
    if (anchor) anchor.remove();

    if (!pack.burgs[burg].port) {
      const haven = pack.cells.haven[pack.burgs[burg].cell];
      const port = haven ? pack.cells.f[haven] : -1;
      if (!haven) tip("Port haven is not found, system won't be able to make a searoute", false, "warn");
      pack.burgs[burg].port = port;

      const g = pack.burgs[burg].capital ? "cities" : "towns";
      const group = anchors.select("g#"+g);
      const size = +group.attr("size");
      group.append("use").attr("xlink:href", "#icon-anchor").attr("data-id", burg)
        .attr("x", rn(pack.burgs[burg].x - size * .47, 2)).attr("y", rn(pack.burgs[burg].y - size * .47, 2))
        .attr("width", size).attr("height", size);
    } else {
      pack.burgs[burg].port = 0;
    }

    burgsEditorAddLines();
  }

  function triggerBurgRemove() {
    const burg = +this.parentNode.dataset.id;
    if (pack.burgs[burg].capital) {tip("You cannot remove the capital. Please change the capital first", false, "error"); return;}
    removeBurg(burg);
    burgsEditorAddLines();
  }

  function regenerateNames() {
    body.querySelectorAll(":scope > div").forEach(function(el) {
      const burg = +el.dataset.id;
      const culture = pack.burgs[burg].culture;
      const name = Names.getCulture(culture);
      el.querySelector(".burgName").value = name;
      pack.burgs[burg].name = el.dataset.name = name;
      burgLabels.select("[data-id='" + burg + "']").text(name);
    });
  }

  function enterAddBurgMode() {
    if (this.classList.contains("pressed")) {exitAddBurgMode(); return;};
    customization = 3;
    this.classList.add("pressed");
    tip("Click on the map to create a new burg. Hold Shift to add multiple", true);
    viewbox.style("cursor", "crosshair").on("click", addBurgOnClick);
    body.querySelectorAll("div > *").forEach(e => e.disabled = true);
  }

  function addBurgOnClick() {
    const point = d3.mouse(this);
    const cell = findCell(point[0], point[1]);
    if (pack.cells.h[cell] < 20) {tip("You cannot place state into the water. Please click on a land cell", false, "error"); return;}
    if (pack.cells.burg[cell]) {tip("There is already a burg in this cell. Please select a free cell", false, "error"); return;}
    addBurg(point); // add new burg

    if (d3.event.shiftKey === false) {
      exitAddBurgMode();
      burgsEditorAddLines();
    }
  }

  function exitAddBurgMode() {
    customization = 0;
    restoreDefaultEvents();
    clearMainTip();
    body.querySelectorAll("div > *").forEach(e => e.disabled = false);
    if (addBurgTool.classList.contains("pressed")) addBurgTool.classList.remove("pressed");
    if (addNewBurg.classList.contains("pressed")) addNewBurg.classList.remove("pressed");
  }

  function downloadBurgsData() {
    let data = "Id,Burg,State,Culture,Population,Capital,Port,Longitude,Latitude,Elevation\n"; // headers
    const valid = pack.burgs.filter(b => b.i && !b.removed); // all valid burgs

    valid.forEach(b => {
      data += b.i + ",";
      data += b.name + ",";
      data += pack.states[b.state].name + ",";
      data += pack.cultures[b.culture].name + ",";
      data += rn(b.population * populationRate.value * urbanization.value) + ",";
      data += b.capital ? "capital," : ",";
      data += b.port ? "port," : ",";

      // add geography data
      data += mapCoordinates.lonW + (b.x / graphWidth) * mapCoordinates.lonT + ",";
      data += mapCoordinates.latN - (b.y / graphHeight) * mapCoordinates.latT + ","; // this is inverted in QGIS otherwise
      data += parseInt(getFriendlyHeight(pack.cells.h[b.cell])) + "\n";
    });

    const dataBlob = new Blob([data], {type: "text/plain"});
    const url = window.URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    document.body.appendChild(link);
    link.download = "burgs_data" + Date.now() + ".csv";
    link.href = url;
    link.click();
    window.setTimeout(function() {window.URL.revokeObjectURL(url);}, 2000);
  }

  function importBurgNames() {
    const el = document.getElementById("burgsListToLoad");
    const fileToLoad = el.files[0];
    el.value = "";

    const fileReader = new FileReader();

    fileReader.onload = function(e) {
      const dataLoaded = e.target.result;
      const data = dataLoaded.split("\r\n");
      if (!data.length) {tip("Cannot parse the list, please check the file format", false, "error"); return;}

      let change = [];
      let message = `Burgs will be renamed as below. Please confirm;
                    <div class="overflow-div"><table class="overflow-table"><tr><th>Id</th><th>Current name</th><th>New Name</th></tr>`;

      for (let i=0; i < data.length && i <= pack.burgs.length; i++) {
        const v = data[i];
        if (!v || !pack.burgs[i+1] || v == pack.burgs[i+1].name) continue;
        change.push({id:i+1, name: v});
        message += `<tr><td style="width:20%">${i+1}</td><td style="width:40%">${pack.burgs[i+1].name}</td><td style="width:40%">${v}</td></tr>`;
      }
      message += `</tr></table></div>`;
      alertMessage.innerHTML = message;

      $("#alert").dialog({title: "Burgs bulk renaming", position: {my: "center", at: "center", of: "svg"},
        buttons: {
          Cancel: function() {$(this).dialog("close");},
          Confirm: function() {
            for (let i=0; i < change.length; i++) {
              const id = change[i].id;
              pack.burgs[id].name = change[i].name;
              burgLabels.select("[data-id='" + id + "']").text(change[i].name);
            }
            $(this).dialog("close");
            burgsEditorAddLines();
          }
        }
      });
    }

    fileReader.readAsText(fileToLoad, "UTF-8");
  }

  function triggerAllBurgsRemove() {
    alertMessage.innerHTML = `Are you sure you want to remove all burgs except of capitals?
      <br>To remove a capital you have to remove its state first`;
    $("#alert").dialog({resizable: false, title: "Remove all burgs",
      buttons: {
        Remove: function() {
          $(this).dialog("close");
          removeAllBurgs();
        },
        Cancel: function() {$(this).dialog("close");}
      }
    });
  }

  function removeAllBurgs() {
    pack.burgs.filter(b => b.i && !b.capital).forEach(b => removeBurg(b.i));
    burgsEditorAddLines();
  }

}
