"use strict";
function editBurg(id) {
  if (customization) return;
  closeDialogs(".stable");
  if (!layerIsOn("toggleIcons")) toggleIcons();
  if (!layerIsOn("toggleLabels")) toggleLabels();

  const burg = id || d3.event.target.dataset.id;
  elSelected = burgLabels.select("[data-id='" + burg + "']");
  burgLabels.selectAll("text").call(d3.drag().on("start", dragBurgLabel)).classed("draggable", true);
  updateBurgValues();

  $("#burgEditor").dialog({
    title: "Edit Burg",
    resizable: false,
    close: closeBurgEditor,
    position: {my: "left top", at: "left+10 top+10", of: "svg", collision: "fit"}
  });

  if (modules.editBurg) return;
  modules.editBurg = true;

  // add listeners
  byId("burgGroupShow").addEventListener("click", showGroupSection);
  byId("burgGroupHide").addEventListener("click", hideGroupSection);
  byId("burgSelectGroup").addEventListener("change", changeGroup);
  byId("burgInputGroup").addEventListener("change", createNewGroup);
  byId("burgAddGroup").addEventListener("click", toggleNewGroupInput);
  byId("burgRemoveGroup").addEventListener("click", removeBurgsGroup);

  byId("burgName").addEventListener("input", changeName);
  byId("burgNameReRandom").addEventListener("click", generateNameRandom);
  byId("burgType").addEventListener("input", changeType);
  byId("burgCulture").addEventListener("input", changeCulture);
  byId("burgNameReCulture").addEventListener("click", generateNameCulture);
  byId("burgPopulation").addEventListener("change", changePopulation);
  burgBody.querySelectorAll(".burgFeature").forEach(el => el.addEventListener("click", toggleFeature));
  byId("burgLinkOpen").addEventListener("click", openBurgLink);
  byId("burgLinkEdit").addEventListener("click", changeBurgLink);

  byId("burgStyleShow").addEventListener("click", showStyleSection);
  byId("burgStyleHide").addEventListener("click", hideStyleSection);
  byId("burgEditLabelStyle").addEventListener("click", editGroupLabelStyle);
  byId("burgEditIconStyle").addEventListener("click", editGroupIconStyle);
  byId("burgEditAnchorStyle").addEventListener("click", editGroupAnchorStyle);

  byId("burgEmblem").addEventListener("click", openEmblemEdit);
  byId("burgTogglePreview").addEventListener("click", toggleBurgPreview);
  byId("burgEditEmblem").addEventListener("click", openEmblemEdit);
  byId("burgLocate").addEventListener("click", zoomIntoBurg);
  byId("burgRelocate").addEventListener("click", toggleRelocateBurg);
  byId("burglLegend").addEventListener("click", editBurgLegend);
  byId("burgLock").addEventListener("click", toggleBurgLockButton);
  byId("burgRemove").addEventListener("click", removeSelectedBurg);
  byId("burgTemperatureGraph").addEventListener("click", showTemperatureGraph);

  function updateBurgValues() {
    const id = +elSelected.attr("data-id");
    const b = pack.burgs[id];
    const province = pack.cells.province[b.cell];
    const provinceName = province ? pack.provinces[province].fullName + ", " : "";
    const stateName = pack.states[b.state].fullName || pack.states[b.state].name;
    byId("burgProvinceAndState").innerHTML = provinceName + stateName;

    byId("burgName").value = b.name;
    byId("burgType").value = b.type || "Generic";
    byId("burgPopulation").value = rn(b.population * populationRate * urbanization);
    byId("burgEditAnchorStyle").style.display = +b.port ? "inline-block" : "none";

    // update list and select culture
    const cultureSelect = byId("burgCulture");
    cultureSelect.options.length = 0;
    const cultures = pack.cultures.filter(c => !c.removed);
    cultures.forEach(c => cultureSelect.options.add(new Option(c.name, c.i, false, c.i === b.culture)));

    const temperature = grid.cells.temp[pack.cells.g[b.cell]];
    byId("burgTemperature").innerHTML = convertTemperature(temperature);
    byId("burgTemperatureLikeIn").innerHTML = getTemperatureLikeness(temperature);
    byId("burgElevation").innerHTML = getHeight(pack.cells.h[b.cell]);

    // toggle features
    if (b.capital) byId("burgCapital").classList.remove("inactive");
    else byId("burgCapital").classList.add("inactive");
    if (b.port) byId("burgPort").classList.remove("inactive");
    else byId("burgPort").classList.add("inactive");
    if (b.citadel) byId("burgCitadel").classList.remove("inactive");
    else byId("burgCitadel").classList.add("inactive");
    if (b.walls) byId("burgWalls").classList.remove("inactive");
    else byId("burgWalls").classList.add("inactive");
    if (b.plaza) byId("burgPlaza").classList.remove("inactive");
    else byId("burgPlaza").classList.add("inactive");
    if (b.temple) byId("burgTemple").classList.remove("inactive");
    else byId("burgTemple").classList.add("inactive");
    if (b.shanty) byId("burgShanty").classList.remove("inactive");
    else byId("burgShanty").classList.add("inactive");

    //toggle lock
    updateBurgLockIcon();

    // select group
    const group = elSelected.node().parentNode.id;
    const select = byId("burgSelectGroup");
    select.options.length = 0; // remove all options

    burgLabels.selectAll("g").each(function () {
      select.options.add(new Option(this.id, this.id, false, this.id === group));
    });

    // set emlem image
    const coaID = "burgCOA" + id;
    COArenderer.trigger(coaID, b.coa);
    byId("burgEmblem").setAttribute("href", "#" + coaID);

    if (options.showBurgPreview) {
      byId("burgPreviewSection").style.display = "block";
      updateBurgPreview(b);
    } else {
      byId("burgPreviewSection").style.display = "none";
    }
  }

  function dragBurgLabel() {
    const tr = parseTransform(this.getAttribute("transform"));
    const dx = +tr[0] - d3.event.x,
      dy = +tr[1] - d3.event.y;

    d3.event.on("drag", function () {
      const x = d3.event.x,
        y = d3.event.y;
      this.setAttribute("transform", `translate(${dx + x},${dy + y})`);
      tip('Use dragging for fine-tuning only, to actually move burg use "Relocate" button', false, "warning");
    });
  }

  function showGroupSection() {
    document.querySelectorAll("#burgBottom > button").forEach(el => (el.style.display = "none"));
    byId("burgGroupSection").style.display = "inline-block";
  }

  function hideGroupSection() {
    document.querySelectorAll("#burgBottom > button").forEach(el => (el.style.display = "inline-block"));
    byId("burgGroupSection").style.display = "none";
    byId("burgInputGroup").style.display = "none";
    byId("burgInputGroup").value = "";
    byId("burgSelectGroup").style.display = "inline-block";
  }

  function changeGroup() {
    const id = +elSelected.attr("data-id");
    moveBurgToGroup(id, this.value);
  }

  function toggleNewGroupInput() {
    if (burgInputGroup.style.display === "none") {
      burgInputGroup.style.display = "inline-block";
      burgInputGroup.focus();
      burgSelectGroup.style.display = "none";
    } else {
      burgInputGroup.style.display = "none";
      burgSelectGroup.style.display = "inline-block";
    }
  }

  function createNewGroup() {
    if (!this.value) {
      tip("Please provide a valid group name", false, "error");
      return;
    }
    const group = this.value
      .toLowerCase()
      .replace(/ /g, "_")
      .replace(/[^\w\s]/gi, "");

    if (byId(group)) {
      tip("Element with this id already exists. Please provide a unique name", false, "error");
      return;
    }

    if (Number.isFinite(+group.charAt(0))) {
      tip("Group name should start with a letter", false, "error");
      return;
    }

    const id = +elSelected.attr("data-id");
    const oldGroup = elSelected.node().parentNode.id;

    const label = document.querySelector("#burgLabels [data-id='" + id + "']");
    const icon = document.querySelector("#burgIcons [data-id='" + id + "']");
    const anchor = document.querySelector("#anchors [data-id='" + id + "']");
    if (!label || !icon) {
      ERROR && console.error("Cannot find label or icon elements");
      return;
    }

    const labelG = document.querySelector("#burgLabels > #" + oldGroup);
    const iconG = document.querySelector("#burgIcons > #" + oldGroup);
    const anchorG = document.querySelector("#anchors > #" + oldGroup);

    // just rename if only 1 element left
    const count = elSelected.node().parentNode.childElementCount;
    if (oldGroup !== "cities" && oldGroup !== "towns" && count === 1) {
      byId("burgSelectGroup").selectedOptions[0].remove();
      byId("burgSelectGroup").options.add(new Option(group, group, false, true));
      toggleNewGroupInput();
      byId("burgInputGroup").value = "";
      labelG.id = group;
      iconG.id = group;
      if (anchor) anchorG.id = group;
      return;
    }

    // create new groups
    byId("burgSelectGroup").options.add(new Option(group, group, false, true));
    toggleNewGroupInput();
    byId("burgInputGroup").value = "";

    addBurgsGroup(group);
    moveBurgToGroup(id, group);
  }

  function removeBurgsGroup() {
    const group = elSelected.node().parentNode;
    const basic = group.id === "cities" || group.id === "towns";

    const burgsInGroup = [];
    for (let i = 0; i < group.children.length; i++) {
      burgsInGroup.push(+group.children[i].dataset.id);
    }
    const burgsToRemove = burgsInGroup.filter(b => !(pack.burgs[b].capital || pack.burgs[b].lock));
    const capital = burgsToRemove.length < burgsInGroup.length;

    confirmationDialog({
      title: "Remove burg group",
      message: `Are you sure you want to remove ${
        basic || capital ? "all unlocked elements in the burg group" : "the entire burg group"
      }?<br />Please note that capital or locked burgs will not be deleted. <br /><br />Burgs to be removed: ${
        burgsToRemove.length
      }. This action cannot be reverted`,
      confirm: "Remove",
      onConfirm: () => {
        $("#burgEditor").dialog("close");
        hideGroupSection();
        burgsToRemove.forEach(b => removeBurg(b));

        if (!basic && !capital) {
          const labelG = document.querySelector("#burgLabels > #" + group.id);
          const iconG = document.querySelector("#burgIcons > #" + group.id);
          const anchorG = document.querySelector("#anchors > #" + group.id);
          if (labelG) labelG.remove();
          if (iconG) iconG.remove();
          if (anchorG) anchorG.remove();
        }
      }
    });
  }

  function changeName() {
    const id = +elSelected.attr("data-id");
    pack.burgs[id].name = burgName.value;
    elSelected.text(burgName.value);
  }

  function generateNameRandom() {
    const base = rand(nameBases.length - 1);
    burgName.value = Names.getBase(base);
    changeName();
  }

  function changeType() {
    const id = +elSelected.attr("data-id");
    pack.burgs[id].type = this.value;
  }

  function changeCulture() {
    const id = +elSelected.attr("data-id");
    pack.burgs[id].culture = +this.value;
  }

  function generateNameCulture() {
    const id = +elSelected.attr("data-id");
    const culture = pack.burgs[id].culture;
    burgName.value = Names.getCulture(culture);
    changeName();
  }

  function changePopulation() {
    const id = +elSelected.attr("data-id");
    const burg = pack.burgs[id];

    pack.burgs[id].population = rn(burgPopulation.value / populationRate / urbanization, 4);
    updateBurgPreview(burg);
  }

  function toggleFeature() {
    const id = +elSelected.attr("data-id");
    const burg = pack.burgs[id];
    const feature = this.dataset.feature;
    const turnOn = this.classList.contains("inactive");
    if (feature === "port") togglePort(id);
    else if (feature === "capital") toggleCapital(id);
    else burg[feature] = +turnOn;
    if (burg[feature]) this.classList.remove("inactive");
    else if (!burg[feature]) this.classList.add("inactive");

    if (burg.port) byId("burgEditAnchorStyle").style.display = "inline-block";
    else byId("burgEditAnchorStyle").style.display = "none";
    updateBurgPreview(burg);
  }

  function toggleBurgLockButton() {
    const id = +elSelected.attr("data-id");
    const burg = pack.burgs[id];
    burg.lock = !burg.lock;

    updateBurgLockIcon();
  }

  function updateBurgLockIcon() {
    const id = +elSelected.attr("data-id");
    const b = pack.burgs[id];
    if (b.lock) {
      byId("burgLock").classList.remove("icon-lock-open");
      byId("burgLock").classList.add("icon-lock");
    } else {
      byId("burgLock").classList.remove("icon-lock");
      byId("burgLock").classList.add("icon-lock-open");
    }
  }

  function showStyleSection() {
    document.querySelectorAll("#burgBottom > button").forEach(el => (el.style.display = "none"));
    byId("burgStyleSection").style.display = "inline-block";
  }

  function hideStyleSection() {
    document.querySelectorAll("#burgBottom > button").forEach(el => (el.style.display = "inline-block"));
    byId("burgStyleSection").style.display = "none";
  }

  function editGroupLabelStyle() {
    const g = elSelected.node().parentNode.id;
    editStyle("labels", g);
  }

  function editGroupIconStyle() {
    const g = elSelected.node().parentNode.id;
    editStyle("burgIcons", g);
  }

  function editGroupAnchorStyle() {
    const g = elSelected.node().parentNode.id;
    editStyle("anchors", g);
  }

  function updateBurgPreview(burg) {
    const src = getBurgLink(burg) + "&preview=1";

    // recreate object to force reload (Chrome bug)
    const container = byId("burgPreviewObject");
    container.innerHTML = "";
    const object = document.createElement("object");
    object.style.width = "100%";
    object.data = src;
    container.insertBefore(object, null);
  }

  function openBurgLink() {
    const id = +elSelected.attr("data-id");
    const burg = pack.burgs[id];

    openURL(getBurgLink(burg));
  }

  function changeBurgLink() {
    const id = +elSelected.attr("data-id");
    const burg = pack.burgs[id];

    prompt(
      "Provide custom link to the burg map. It can be a link to Medieval Fantasy City Generator, a different tool, or just an image. Leave empty to use the default map",
      {default: getBurgLink(burg), required: false},
      link => {
        if (link) burg.link = link;
        else delete burg.link;
        updateBurgPreview(burg);
      }
    );
  }

  function openEmblemEdit() {
    const id = +elSelected.attr("data-id"),
      burg = pack.burgs[id];
    editEmblem("burg", "burgCOA" + id, burg);
  }

  function toggleBurgPreview() {
    options.showBurgPreview = !options.showBurgPreview;
    byId("burgPreviewSection").style.display = options.showBurgPreview ? "block" : "none";
    byId("burgTogglePreview").className = options.showBurgPreview ? "icon-map" : "icon-map-o";
  }

  function zoomIntoBurg() {
    const id = +elSelected.attr("data-id");
    const burg = pack.burgs[id];
    const x = burg.x;
    const y = burg.y;
    zoomTo(x, y, 8, 2000);
  }

  function toggleRelocateBurg() {
    const toggler = byId("toggleCells");
    byId("burgRelocate").classList.toggle("pressed");
    if (byId("burgRelocate").classList.contains("pressed")) {
      viewbox.style("cursor", "crosshair").on("click", relocateBurgOnClick);
      tip("Click on map to relocate burg. Hold Shift for continuous move", true);
      if (!layerIsOn("toggleCells")) {
        toggleCells();
        toggler.dataset.forced = true;
      }
    } else {
      clearMainTip();
      viewbox.on("click", clicked).style("cursor", "default");
      if (layerIsOn("toggleCells") && toggler.dataset.forced) {
        toggleCells();
        toggler.dataset.forced = false;
      }
    }
  }

  function relocateBurgOnClick() {
    const cells = pack.cells;
    const point = d3.mouse(this);
    const cell = findCell(point[0], point[1]);
    const id = +elSelected.attr("data-id");
    const burg = pack.burgs[id];

    if (cells.h[cell] < 20) {
      tip("Cannot place burg into the water! Select a land cell", false, "error");
      return;
    }

    if (cells.burg[cell] && cells.burg[cell] !== id) {
      tip("There is already a burg in this cell. Please select a free cell", false, "error");
      return;
    }

    const newState = cells.state[cell];
    const oldState = burg.state;

    if (newState !== oldState && burg.capital) {
      tip("Capital cannot be relocated into another state!", false, "error");
      return;
    }

    // change UI
    const x = rn(point[0], 2),
      y = rn(point[1], 2);
    burgIcons
      .select("[data-id='" + id + "']")
      .attr("transform", null)
      .attr("cx", x)
      .attr("cy", y);
    burgLabels
      .select("text[data-id='" + id + "']")
      .attr("transform", null)
      .attr("x", x)
      .attr("y", y);
    const anchor = anchors.select("use[data-id='" + id + "']");
    if (anchor.size()) {
      const size = anchor.attr("width");
      const xa = rn(x - size * 0.47, 2);
      const ya = rn(y - size * 0.47, 2);
      anchor.attr("transform", null).attr("x", xa).attr("y", ya);
    }

    // change data
    cells.burg[burg.cell] = 0;
    cells.burg[cell] = id;
    burg.cell = cell;
    burg.state = newState;
    burg.x = x;
    burg.y = y;
    if (burg.capital) pack.states[newState].center = burg.cell;

    if (d3.event.shiftKey === false) toggleRelocateBurg();
  }

  function editBurgLegend() {
    const id = elSelected.attr("data-id");
    const name = elSelected.text();
    editNotes("burg" + id, name);
  }

  function showTemperatureGraph() {
    const id = elSelected.attr("data-id");
    showBurgTemperatureGraph(id);
  }

  function removeSelectedBurg() {
    const id = +elSelected.attr("data-id");
    if (pack.burgs[id].capital) {
      alertMessage.innerHTML = /* html */ `You cannot remove the burg as it is a state capital.<br /><br />
        You can change the capital using Burgs Editor (shift + T)`;
      $("#alert").dialog({
        resizable: false,
        title: "Remove burg",
        buttons: {
          Ok: function () {
            $(this).dialog("close");
          }
        }
      });
    } else {
      confirmationDialog({
        title: "Remove burg",
        message: "Are you sure you want to remove the burg? <br>This action cannot be reverted",
        confirm: "Remove",
        onConfirm: () => {
          removeBurg(id); // see Editors module
          $("#burgEditor").dialog("close");
        }
      });
    }
  }

  function closeBurgEditor() {
    byId("burgRelocate").classList.remove("pressed");
    burgLabels.selectAll("text").call(d3.drag().on("drag", null)).classed("draggable", false);
    unselect();
  }
}

// in °C, array from -1 °C; source: https://en.wikipedia.org/wiki/List_of_cities_by_average_temperature
function getTemperatureLikeness(temperature) {
  if (temperature < -5) return "Yakutsk";
  const cities = [
    "Snag (Yukon)",
    "Yellowknife (Canada)",
    "Okhotsk (Russia)",
    "Fairbanks (Alaska)",
    "Nuuk (Greenland)",
    "Murmansk", // -5 - 0
    "Arkhangelsk",
    "Anchorage",
    "Tromsø",
    "Reykjavik",
    "Riga",
    "Stockholm",
    "Halifax",
    "Prague",
    "Copenhagen",
    "London", // 1 - 10
    "Antwerp",
    "Paris",
    "Milan",
    "Batumi",
    "Rome",
    "Dubrovnik",
    "Lisbon",
    "Barcelona",
    "Marrakesh",
    "Alexandria", // 11 - 20
    "Tegucigalpa",
    "Guangzhou",
    "Rio de Janeiro",
    "Dakar",
    "Miami",
    "Jakarta",
    "Mogadishu",
    "Bangkok",
    "Aden",
    "Khartoum"
  ]; // 21 - 30
  if (temperature > 30) return "Mecca";
  return cities[temperature + 5] || null;
}
