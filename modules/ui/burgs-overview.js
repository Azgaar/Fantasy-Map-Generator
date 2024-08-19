"use strict";
function overviewBurgs(settings = {stateId: null, cultureId: null}) {
  if (customization) return;
  closeDialogs("#burgsOverview, .stable");
  if (!layerIsOn("toggleIcons")) toggleIcons();
  if (!layerIsOn("toggleLabels")) toggleLabels();

  const body = byId("burgsBody");
  updateFilter();
  updateLockAllIcon();
  burgsOverviewAddLines();
  $("#burgsOverview").dialog();

  if (modules.overviewBurgs) return;
  modules.overviewBurgs = true;

  $("#burgsOverview").dialog({
    title: "Burgs Overview",
    resizable: false,
    width: fitContent(),
    close: exitAddBurgMode,
    position: {my: "right top", at: "right-10 top+10", of: "svg", collision: "fit"}
  });

  // add listeners
  byId("burgsOverviewRefresh").addEventListener("click", refreshBurgsEditor);
  byId("burgsChart").addEventListener("click", showBurgsChart);
  byId("burgsFilterState").addEventListener("change", burgsOverviewAddLines);
  byId("burgsFilterCulture").addEventListener("change", burgsOverviewAddLines);
  byId("regenerateBurgNames").addEventListener("click", regenerateNames);
  byId("addNewBurg").addEventListener("click", enterAddBurgMode);
  byId("burgsExport").addEventListener("click", downloadBurgsData);
  byId("burgNamesImport").addEventListener("click", renameBurgsInBulk);
  byId("burgsListToLoad").addEventListener("change", function () {
    uploadFile(this, importBurgNames);
  });
  byId("burgsLockAll").addEventListener("click", toggleLockAll);
  byId("burgsRemoveAll").addEventListener("click", triggerAllBurgsRemove);

  function refreshBurgsEditor() {
    updateFilter();
    burgsOverviewAddLines();
  }

  function updateFilter() {
    const stateFilter = byId("burgsFilterState");
    const selectedState = settings.stateId !== null ? settings.stateId : stateFilter.value || -1;
    stateFilter.options.length = 0; // remove all options
    stateFilter.options.add(new Option("all", -1, false, selectedState === -1));
    stateFilter.options.add(new Option(pack.states[0].name, 0, false, selectedState === 0));
    const statesSorted = pack.states.filter(s => s.i && !s.removed).sort((a, b) => (a.name > b.name ? 1 : -1));
    statesSorted.forEach(s => stateFilter.options.add(new Option(s.name, s.i, false, s.i == selectedState)));

    const cultureFilter = byId("burgsFilterCulture");
    const selectedCulture = settings.cultureId !== null ? settings.cultureId : cultureFilter.value || -1;
    cultureFilter.options.length = 0; // remove all options
    cultureFilter.options.add(new Option(`all`, -1, false, selectedCulture === -1));
    cultureFilter.options.add(new Option(pack.cultures[0].name, 0, false, selectedCulture === 0));
    const culturesSorted = pack.cultures.filter(c => c.i && !c.removed).sort((a, b) => (a.name > b.name ? 1 : -1));
    culturesSorted.forEach(c => cultureFilter.options.add(new Option(c.name, c.i, false, c.i == selectedCulture)));
  }

  // add line for each burg
  function burgsOverviewAddLines() {
    const selectedStateId = +byId("burgsFilterState").value;
    const selectedCultureId = +byId("burgsFilterCulture").value;
    let filtered = pack.burgs.filter(b => b.i && !b.removed); // all valid burgs
    if (selectedStateId !== -1) filtered = filtered.filter(b => b.state === selectedStateId); // filtered by state
    if (selectedCultureId !== -1) filtered = filtered.filter(b => b.culture === selectedCultureId); // filtered by culture

    body.innerHTML = "";
    let lines = "";
    let totalPopulation = 0;

    for (const b of filtered) {
      const population = b.population * populationRate * urbanization;
      totalPopulation += population;
      const type = b.capital && b.port ? "a-capital-port" : b.capital ? "c-capital" : b.port ? "p-port" : "z-burg";
      const state = pack.states[b.state].name;
      const prov = pack.cells.province[b.cell];
      const province = prov ? pack.provinces[prov].name : "";
      const culture = pack.cultures[b.culture].name;

      lines += /* html */ `<div
        class="states"
        data-id=${b.i}
        data-name="${b.name}"
        data-state="${state}"
        data-province="${province}"
        data-culture="${culture}"
        data-population=${population}
        data-type="${type}"
      >
        <span data-tip="Click to zoom into view" class="icon-dot-circled pointer"></span>
        <input data-tip="Burg name. Click and type to change" class="burgName" value="${
          b.name
        }" autocorrect="off" spellcheck="false" />
        <input data-tip="Burg province" class="burgState" value="${province}" disabled />
        <input data-tip="Burg state" class="burgState" value="${state}" disabled />
        <select data-tip="Dominant culture. Click to change burg culture (to change cell culture use Cultures Editor)" class="stateCulture">
          ${getCultureOptions(b.culture)}
        </select>
        <span data-tip="Burg population" class="icon-male"></span>
        <input data-tip="Burg population. Type to change" class="burgPopulation" value=${si(population)} />
        <div class="burgType">
          <span
            data-tip="${b.capital ? " This burg is a state capital" : "Click to assign a capital status"}"
            class="icon-star-empty${b.capital ? "" : " inactive pointer"}"
          ></span>
          <span data-tip="Click to toggle port status" class="icon-anchor pointer${
            b.port ? "" : " inactive"
          }" style="font-size:.9em"></span>
        </div>
        <span data-tip="Edit burg" class="icon-pencil"></span>
        <span class="locks pointer ${
          b.lock ? "icon-lock" : "icon-lock-open inactive"
        }" onmouseover="showElementLockTip(event)"></span>
        <span data-tip="Remove burg" class="icon-trash-empty"></span>
      </div>`;
    }
    if (!filtered.length) body.innerHTML = /* html */ `<div style="padding-block: 0.3em;">No burgs found</div>`;
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
    body
      .querySelectorAll("div > input.burgPopulation")
      .forEach(el => el.addEventListener("change", changeBurgPopulation));
    body
      .querySelectorAll("div > span.icon-star-empty")
      .forEach(el => el.addEventListener("click", toggleCapitalStatus));
    body.querySelectorAll("div > span.icon-anchor").forEach(el => el.addEventListener("click", togglePortStatus));
    body.querySelectorAll("div > span.locks").forEach(el => el.addEventListener("click", toggleBurgLockStatus));
    body.querySelectorAll("div > span.icon-pencil").forEach(el => el.addEventListener("click", openBurgEditor));
    body.querySelectorAll("div > span.icon-trash-empty").forEach(el => el.addEventListener("click", triggerBurgRemove));

    applySorting(burgsHeader);
  }

  function getCultureOptions(culture) {
    let options = "";
    pack.cultures
      .filter(c => !c.removed)
      .forEach(c => (options += `<option ${c.i === culture ? "selected" : ""} value="${c.i}">${c.name}</option>`));
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
    if (this.value == "") tip("Please provide a name", false, "error");
    const burg = +this.parentNode.dataset.id;
    pack.burgs[burg].name = this.value;
    this.parentNode.dataset.name = this.value;
    const label = document.querySelector("#burgLabels [data-id='" + burg + "']");
    if (label) label.innerHTML = this.value;
  }

  function zoomIntoBurg() {
    const burg = +this.parentNode.dataset.id;
    const label = document.querySelector("#burgLabels [data-id='" + burg + "']");
    const x = +label.getAttribute("x");
    const y = +label.getAttribute("y");
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
      this.value = si(pack.burgs[burg].population * populationRate * urbanization);
      return;
    }
    pack.burgs[burg].population = this.value / populationRate / urbanization;
    this.parentNode.dataset.population = this.value;
    this.value = si(this.value);

    const population = [];
    body.querySelectorAll(":scope > div").forEach(el => population.push(+getInteger(el.dataset.population)));
    burgsFooterPopulation.innerHTML = si(d3.mean(population));
  }

  function toggleCapitalStatus() {
    const burg = +this.parentNode.parentNode.dataset.id;
    toggleCapital(burg);
    burgsOverviewAddLines();
  }

  function togglePortStatus() {
    const burg = +this.parentNode.parentNode.dataset.id;
    togglePort(burg);
    if (this.classList.contains("inactive")) this.classList.remove("inactive");
    else this.classList.add("inactive");
  }

  function toggleBurgLockStatus() {
    const burgId = +this.parentNode.dataset.id;

    const burg = pack.burgs[burgId];
    burg.lock = !burg.lock;

    if (this.classList.contains("icon-lock")) {
      this.classList.remove("icon-lock");
      this.classList.add("icon-lock-open");
      this.classList.add("inactive");
    } else {
      this.classList.remove("icon-lock-open");
      this.classList.add("icon-lock");
      this.classList.remove("inactive");
    }
  }

  function openBurgEditor() {
    const burg = +this.parentNode.dataset.id;
    editBurg(burg);
  }

  function triggerBurgRemove() {
    const burg = +this.parentNode.dataset.id;
    if (pack.burgs[burg].capital)
      return tip("You cannot remove the capital. Please change the capital first", false, "error");

    confirmationDialog({
      title: "Remove burg",
      message: "Are you sure you want to remove the burg? This actiove cannot be reverted",
      confirm: "Remove",
      onConfirm: () => {
        removeBurg(burg);
        burgsOverviewAddLines();
      }
    });
  }

  function regenerateNames() {
    body.querySelectorAll(":scope > div").forEach(function (el) {
      const burg = +el.dataset.id;
      if (pack.burgs[burg].lock) return;

      const culture = pack.burgs[burg].culture;
      const name = Names.getCulture(culture);

      el.querySelector(".burgName").value = name;
      pack.burgs[burg].name = el.dataset.name = name;
      burgLabels.select("[data-id='" + burg + "']").text(name);
    });
  }

  function enterAddBurgMode() {
    if (this.classList.contains("pressed")) return exitAddBurgMode();
    customization = 3;
    this.classList.add("pressed");
    tip("Click on the map to create a new burg. Hold Shift to add multiple", true, "warn");
    viewbox.style("cursor", "crosshair").on("click", addBurgOnClick);
  }

  function addBurgOnClick() {
    const point = d3.mouse(this);
    const cell = findCell(...point);

    if (pack.cells.h[cell] < 20)
      return tip("You cannot place state into the water. Please click on a land cell", false, "error");
    if (pack.cells.burg[cell])
      return tip("There is already a burg in this cell. Please select a free cell", false, "error");

    addBurg(point); // add new burg

    if (d3.event.shiftKey === false) {
      exitAddBurgMode();
      burgsOverviewAddLines();
    }
  }

  function exitAddBurgMode() {
    customization = 0;
    restoreDefaultEvents();
    clearMainTip();
    if (addBurgTool.classList.contains("pressed")) addBurgTool.classList.remove("pressed");
    if (addNewBurg.classList.contains("pressed")) addNewBurg.classList.remove("pressed");
  }

  function showBurgsChart() {
    // build hierarchy tree
    const states = pack.states.map(s => {
      const color = s.color ? s.color : "#ccc";
      const name = s.fullName ? s.fullName : s.name;
      return {id: s.i, state: s.i ? 0 : null, color, name};
    });

    const burgs = pack.burgs
      .filter(b => b.i && !b.removed)
      .map(b => {
        const id = b.i + states.length - 1;
        const population = b.population;
        const capital = b.capital;
        const province = pack.cells.province[b.cell];
        const parent = province ? province + states.length - 1 : b.state;
        return {
          id,
          i: b.i,
          state: b.state,
          culture: b.culture,
          province,
          parent,
          name: b.name,
          population,
          capital,
          x: b.x,
          y: b.y
        };
      });
    const data = states.concat(burgs);
    if (data.length < 2) return tip("No burgs to show", false, "error");

    const root = d3
      .stratify()
      .parentId(d => d.state)(data)
      .sum(d => d.population)
      .sort((a, b) => b.value - a.value);

    const width = 150 + 200 * uiSize.value;
    const height = 150 + 200 * uiSize.value;
    const margin = {top: 0, right: -50, bottom: -10, left: -50};
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;
    const treeLayout = d3.pack().size([w, h]).padding(3);

    // prepare svg
    alertMessage.innerHTML = /* html */ `<select id="burgsTreeType" style="display:block; margin-left:13px; font-size:11px">
      <option value="states" selected>Group by state</option>
      <option value="cultures">Group by culture</option>
      <option value="parent">Group by province and state</option>
      <option value="provinces">Group by province</option>
    </select>`;
    alertMessage.innerHTML += `<div id='burgsInfo' class='chartInfo'>&#8205;</div>`;
    const svg = d3
      .select("#alertMessage")
      .insert("svg", "#burgsInfo")
      .attr("id", "burgsTree")
      .attr("width", width)
      .attr("height", height - 10)
      .attr("stroke-width", 2);
    const graph = svg.append("g").attr("transform", `translate(-50, -10)`);
    byId("burgsTreeType").addEventListener("change", updateChart);

    treeLayout(root);

    const node = graph
      .selectAll("circle")
      .data(root.leaves())
      .join("circle")
      .attr("data-id", d => d.data.i)
      .attr("r", d => d.r)
      .attr("fill", d => d.parent.data.color)
      .attr("cx", d => d.x)
      .attr("cy", d => d.y)
      .on("mouseenter", d => showInfo(event, d))
      .on("mouseleave", d => hideInfo(event, d))
      .on("click", d => zoomTo(d.data.x, d.data.y, 8, 2000));

    function showInfo(ev, d) {
      d3.select(ev.target).transition().duration(1500).attr("stroke", "#c13119");
      const name = d.data.name;
      const parent = d.parent.data.name;
      const population = si(d.value * populationRate * urbanization);

      burgsInfo.innerHTML = /* html */ `${name}. ${parent}. Population: ${population}`;
      burgHighlightOn(ev);
      tip("Click to zoom into view");
    }

    function hideInfo(ev) {
      burgHighlightOff(ev);
      if (!byId("burgsInfo")) return;
      burgsInfo.innerHTML = "&#8205;";
      d3.select(ev.target).transition().attr("stroke", null);
      tip("");
    }

    function updateChart() {
      const getStatesData = () =>
        pack.states.map(s => {
          const color = s.color ? s.color : "#ccc";
          const name = s.fullName ? s.fullName : s.name;
          return {id: s.i, state: s.i ? 0 : null, color, name};
        });

      const getCulturesData = () =>
        pack.cultures.map(c => {
          const color = c.color ? c.color : "#ccc";
          return {id: c.i, culture: c.i ? 0 : null, color, name: c.name};
        });

      const getParentData = () => {
        const states = pack.states.map(s => {
          const color = s.color ? s.color : "#ccc";
          const name = s.fullName ? s.fullName : s.name;
          return {id: s.i, parent: s.i ? 0 : null, color, name};
        });
        const provinces = pack.provinces
          .filter(p => p.i && !p.removed)
          .map(p => {
            return {id: p.i + states.length - 1, parent: p.state, color: p.color, name: p.fullName};
          });
        return states.concat(provinces);
      };

      const getProvincesData = () =>
        pack.provinces.map(p => {
          const color = p.color ? p.color : "#ccc";
          const name = p.fullName ? p.fullName : p.name;
          return {id: p.i ? p.i : 0, province: p.i ? 0 : null, color, name};
        });

      const value = d => {
        if (this.value === "states") return d.state;
        if (this.value === "cultures") return d.culture;
        if (this.value === "parent") return d.parent;
        if (this.value === "provinces") return d.province;
      };

      const mapping = {
        states: getStatesData,
        cultures: getCulturesData,
        parent: getParentData,
        provinces: getProvincesData
      };

      const base = mapping[this.value]();
      burgs.forEach(b => (b.id = b.i + base.length - 1));

      const data = base.concat(burgs);

      const root = d3
        .stratify()
        .parentId(d => value(d))(data)
        .sum(d => d.population)
        .sort((a, b) => b.value - a.value);

      node
        .data(treeLayout(root).leaves())
        .transition()
        .duration(2000)
        .attr("data-id", d => d.data.i)
        .attr("fill", d => d.parent.data.color)
        .attr("cx", d => d.x)
        .attr("cy", d => d.y)
        .attr("r", d => d.r);
    }

    $("#alert").dialog({
      title: "Burgs bubble chart",
      width: fitContent(),
      position: {my: "left bottom", at: "left+10 bottom-10", of: "svg"},
      buttons: {},
      close: () => (alertMessage.innerHTML = "")
    });
  }

  function downloadBurgsData() {
    let data = `Id,Burg,Province,Province Full Name,State,State Full Name,Culture,Religion,Population,X,Y,Latitude,Longitude,Elevation (${heightUnit.value}),Temperature,Temperature likeness,Capital,Port,Citadel,Walls,Plaza,Temple,Shanty Town,Emblem,City Generator Link\n`; // headers
    const valid = pack.burgs.filter(b => b.i && !b.removed); // all valid burgs

    valid.forEach(b => {
      data += b.i + ",";
      data += b.name + ",";
      const province = pack.cells.province[b.cell];
      data += province ? pack.provinces[province].name + "," : ",";
      data += province ? pack.provinces[province].fullName + "," : ",";
      data += pack.states[b.state].name + ",";
      data += pack.states[b.state].fullName + ",";
      data += pack.cultures[b.culture].name + ",";
      data += pack.religions[pack.cells.religion[b.cell]].name + ",";
      data += rn(b.population * populationRate * urbanization) + ",";

      // add geography data
      data += b.x + ",";
      data += b.y + ",";
      data += getLatitude(b.y, 2) + ",";
      data += getLongitude(b.x, 2) + ",";
      data += parseInt(getHeight(pack.cells.h[b.cell])) + ",";
      const temperature = grid.cells.temp[pack.cells.g[b.cell]];
      data += convertTemperature(temperature) + ",";
      data += getTemperatureLikeness(temperature) + ",";

      // add status data
      data += b.capital ? "capital," : ",";
      data += b.port ? "port," : ",";
      data += b.citadel ? "citadel," : ",";
      data += b.walls ? "walls," : ",";
      data += b.plaza ? "plaza," : ",";
      data += b.temple ? "temple," : ",";
      data += b.shanty ? "shanty town," : ",";
      data += b.coa ? JSON.stringify(b.coa).replace(/"/g, "").replace(/,/g, ";") + "," : ",";
      data += getBurgLink(b);

      data += "\n";
    });

    const name = getFileName("Burgs") + ".csv";
    downloadFile(data, name);
  }

  function renameBurgsInBulk() {
    alertMessage.innerHTML = /* html */ `Download burgs list as a text file, make changes and re-upload the file. Make sure the file is a plain text document with each
    name on its own line (the dilimiter is CRLF). If you do not want to change the name, just leave it as is`;

    $("#alert").dialog({
      title: "Burgs bulk renaming",
      width: "22em",
      position: {my: "center", at: "center", of: "svg"},
      buttons: {
        Download: function () {
          const data = pack.burgs
            .filter(b => b.i && !b.removed)
            .map(b => b.name)
            .join("\r\n");
          const name = getFileName("Burg names") + ".txt";
          downloadFile(data, name);
        },
        Upload: () => burgsListToLoad.click(),
        Cancel: function () {
          $(this).dialog("close");
        }
      }
    });
  }

  function importBurgNames(dataLoaded) {
    if (!dataLoaded) return tip("Cannot load the file, please check the format", false, "error");
    const data = dataLoaded.split("\r\n");
    if (!data.length) return tip("Cannot parse the list, please check the file format", false, "error");

    let change = [];
    let message = `Burgs to be renamed as below:`;
    message += `<table class="overflow-table"><tr><th>Id</th><th>Current name</th><th>New Name</th></tr>`;

    const burgs = pack.burgs.filter(b => b.i && !b.removed);
    for (let i = 0; i < data.length && i <= burgs.length; i++) {
      const v = data[i];
      if (!v || !burgs[i] || v == burgs[i].name) continue;
      change.push({id: burgs[i].i, name: v});
      message += `<tr><td style="width:20%">${burgs[i].i}</td><td style="width:40%">${burgs[i].name}</td><td style="width:40%">${v}</td></tr>`;
    }
    message += `</tr></table>`;

    if (!change.length) message = "No changes found in the file. Please change some names to get a result";
    alertMessage.innerHTML = message;

    const onConfirm = () => {
      for (let i = 0; i < change.length; i++) {
        const id = change[i].id;
        pack.burgs[id].name = change[i].name;
        burgLabels.select("[data-id='" + id + "']").text(change[i].name);
      }
      burgsOverviewAddLines();
    };

    confirmationDialog({
      title: "Burgs bulk renaming",
      message,
      confirm: "Rename",
      onConfirm
    });
  }

  function triggerAllBurgsRemove() {
    const number = pack.burgs.filter(b => b.i && !b.removed && !b.capital && !b.lock).length;
    confirmationDialog({
      title: `Remove ${number} burgs`,
      message: `
        Are you sure you want to remove all <i>unlocked</i> burgs except for capitals?
        <br><i>To remove a capital you have to remove a state first</i>`,
      confirm: "Remove",
      onConfirm: removeAllBurgs
    });
  }

  function removeAllBurgs() {
    pack.burgs.filter(b => b.i && !(b.capital || b.lock)).forEach(b => removeBurg(b.i));
    burgsOverviewAddLines();
  }

  function toggleLockAll() {
    const activeBurgs = pack.burgs.filter(b => b.i && !b.removed);
    const allLocked = activeBurgs.every(burg => burg.lock);

    pack.burgs.forEach(burg => {
      burg.lock = !allLocked;
    });

    burgsOverviewAddLines();
    byId("burgsLockAll").className = allLocked ? "icon-lock" : "icon-lock-open";
  }

  function updateLockAllIcon() {
    const allLocked = pack.burgs.every(({lock, i, removed}) => lock || !i || removed);
    byId("burgsLockAll").className = allLocked ? "icon-lock-open" : "icon-lock";
  }
}
