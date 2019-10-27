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

  const my = id || d3.event.target.tagName === "text" ? "center bottom" : "center top+10";
  const at = id ? "center" : d3.event.target.tagName === "text" ? "top" : "bottom";
  const of = id ? "svg" : d3.event.target;

  $("#burgEditor").dialog({
    title: "Edit Burg", resizable: false, close: closeBurgEditor, 
    position: {my, at, of, collision: "fit"}
  });

  if (modules.editBurg) return;
  modules.editBurg = true;

  // add listeners
  document.getElementById("burgGroupShow").addEventListener("click", showGroupSection);
  document.getElementById("burgGroupHide").addEventListener("click", hideGroupSection);
  document.getElementById("burgSelectGroup").addEventListener("change", changeGroup);
  document.getElementById("burgInputGroup").addEventListener("change", createNewGroup);
  document.getElementById("burgAddGroup").addEventListener("click", toggleNewGroupInput);
  document.getElementById("burgRemoveGroup").addEventListener("click", removeBurgsGroup);

  document.getElementById("burgName").addEventListener("input", changeName);
  document.getElementById("burgNameReCulture").addEventListener("click", generateNameCulture);
  document.getElementById("burgNameReRandom").addEventListener("click", generateNameRandom);
  document.getElementById("burgPopulation").addEventListener("change", changePopulation);
  burgBody.querySelectorAll(".burgFeature").forEach(el => el.addEventListener("click", toggleFeature));

  document.getElementById("burgStyleShow").addEventListener("click", showStyleSection);
  document.getElementById("burgStyleHide").addEventListener("click", hideStyleSection);
  document.getElementById("burgEditLabelStyle").addEventListener("click", editGroupLabelStyle);
  document.getElementById("burgEditIconStyle").addEventListener("click", editGroupIconStyle);
  document.getElementById("burgEditAnchorStyle").addEventListener("click", editGroupAnchorStyle);

  document.getElementById("burgSeeInMFCG").addEventListener("click", openInMFCG);
  document.getElementById("burgOpenCOA").addEventListener("click", openInIAHG);
  document.getElementById("burgRelocate").addEventListener("click", toggleRelocateBurg);
  document.getElementById("burglLegend").addEventListener("click", editBurgLegend);
  document.getElementById("burgRemove").addEventListener("click", removeSelectedBurg);

  function updateBurgValues() {
    const id = +elSelected.attr("data-id");
    const b = pack.burgs[id];
    document.getElementById("burgName").value = b.name;
    document.getElementById("burgPopulation").value = rn(b.population * populationRate.value * urbanization.value);
    document.getElementById("burgEditAnchorStyle").style.display = +b.port ? "inline-block" : "none";

    // toggle features
    if (b.capital) document.getElementById("burgCapital").classList.remove("inactive"); 
    else document.getElementById("burgCapital").classList.add("inactive");
    if (b.port) document.getElementById("burgPort").classList.remove("inactive"); 
    else document.getElementById("burgPort").classList.add("inactive");
    if (b.citadel) document.getElementById("burgCitadel").classList.remove("inactive"); 
    else document.getElementById("burgCitadel").classList.add("inactive");
    if (b.walls) document.getElementById("burgWalls").classList.remove("inactive"); 
    else document.getElementById("burgWalls").classList.add("inactive");
    if (b.plaza) document.getElementById("burgPlaza").classList.remove("inactive"); 
    else document.getElementById("burgPlaza").classList.add("inactive");
    if (b.temple) document.getElementById("burgTemple").classList.remove("inactive"); 
    else document.getElementById("burgTemple").classList.add("inactive");
    if (b.shanty) document.getElementById("burgShanty").classList.remove("inactive"); 
    else document.getElementById("burgShanty").classList.add("inactive");

    // select group
    const group = elSelected.node().parentNode.id;
    const select = document.getElementById("burgSelectGroup");
    select.options.length = 0; // remove all options

    burgLabels.selectAll("g").each(function() {
      select.options.add(new Option(this.id, this.id, false, this.id === group));
    });
  }

  function dragBurgLabel() {
    const tr = parseTransform(this.getAttribute("transform"));
    const dx = +tr[0] - d3.event.x, dy = +tr[1] - d3.event.y;

    d3.event.on("drag", function() {
      const x = d3.event.x, y = d3.event.y;
      this.setAttribute("transform", `translate(${(dx+x)},${(dy+y)})`);
      tip('Use dragging for fine-tuning only, to actually move burg use "Relocate" button', false, "warning");
    });
  }

  function showGroupSection() {
    document.querySelectorAll("#burgBottom > button").forEach(el => el.style.display = "none");
    document.getElementById("burgGroupSection").style.display = "inline-block";
  }

  function hideGroupSection() {
    document.querySelectorAll("#burgBottom > button").forEach(el => el.style.display = "inline-block");
    document.getElementById("burgGroupSection").style.display = "none";
    document.getElementById("burgInputGroup").style.display = "none";
    document.getElementById("burgInputGroup").value = "";
    document.getElementById("burgSelectGroup").style.display = "inline-block"; 
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
    if (!this.value) {tip("Please provide a valid group name", false, "error"); return;}
    const group = this.value.toLowerCase().replace(/ /g, "_").replace(/[^\w\s]/gi, "");

    if (document.getElementById(group)) {
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
    if (!label || !icon) {console.error("Cannot find label or icon elements"); return;}

    const labelG = document.querySelector("#burgLabels > #"+oldGroup);
    const iconG = document.querySelector("#burgIcons > #"+oldGroup);
    const anchorG = document.querySelector("#anchors > #"+oldGroup);

    // just rename if only 1 element left
    const count = elSelected.node().parentNode.childElementCount;
    if (oldGroup !== "cities" && oldGroup !== "towns" && count === 1) {
      document.getElementById("burgSelectGroup").selectedOptions[0].remove();
      document.getElementById("burgSelectGroup").options.add(new Option(group, group, false, true));
      toggleNewGroupInput();
      document.getElementById("burgInputGroup").value = "";
      labelG.id = group;
      iconG.id = group;
      if (anchor) anchorG.id = group;
      return;
    }

    // create new groups
    document.getElementById("burgSelectGroup").options.add(new Option(group, group, false, true));
    toggleNewGroupInput();
    document.getElementById("burgInputGroup").value = "";

    const newLabelG = document.querySelector("#burgLabels").appendChild(labelG.cloneNode(false));
    newLabelG.id = group;
    const newIconG = document.querySelector("#burgIcons").appendChild(iconG.cloneNode(false));
    newIconG.id = group;
    if (anchor) {
      const newAnchorG = document.querySelector("#anchors").appendChild(anchorG.cloneNode(false));
      newAnchorG.id = group;
    }
    moveBurgToGroup(id, group);
  }

  function removeBurgsGroup() {
    const group = elSelected.node().parentNode;
    const basic = group.id === "cities" || group.id === "towns";

    const burgsInGroup = [];
    for (let i=0; i < group.children.length; i++) {
      burgsInGroup.push(+group.children[i].dataset.id);
    }
    const burgsToRemove = burgsInGroup.filter(b => !pack.burgs[b].capital);
    const capital = burgsToRemove.length < burgsInGroup.length;

    alertMessage.innerHTML = `Are you sure you want to remove 
      ${basic || capital ? "all elements in the group" : "the entire burg group"}?
      <br>Please note that capital burgs will not be deleted.
      <br><br>Burgs to be removed: ${burgsToRemove.length}`;
    $("#alert").dialog({resizable: false, title: "Remove route group",
      buttons: {
        Remove: function() {
          $(this).dialog("close");
          $("#burgEditor").dialog("close");
          hideGroupSection();
          burgsToRemove.forEach(b => removeBurg(b));

          if (!basic && !capital) {
            // entirely remove group
            const labelG = document.querySelector("#burgLabels > #"+group.id);
            const iconG = document.querySelector("#burgIcons > #"+group.id);
            const anchorG = document.querySelector("#anchors > #"+group.id);
            if (labelG) labelG.remove();
            if (iconG) iconG.remove();
            if (anchorG) anchorG.remove();
          }
        },
        Cancel: function() {$(this).dialog("close");}
      }
    });
  }

  function changeName() {
    const id = +elSelected.attr("data-id");
    pack.burgs[id].name = burgName.value;
    elSelected.text(burgName.value);
  }

  function generateNameCulture() {
    const id = +elSelected.attr("data-id");
    const culture = pack.burgs[id].culture;
    burgName.value = Names.getCulture(culture);
    changeName();
  }

  function generateNameRandom() {
    const base = rand(nameBases.length-1);
    burgName.value = Names.getBase(base);
    changeName();
  }

  function changePopulation() {
    const id = +elSelected.attr("data-id");
    pack.burgs[id].population = rn(burgPopulation.value / populationRate.value / urbanization.value, 4);
  }

  function toggleFeature() {
    const id = +elSelected.attr("data-id");
    const b = pack.burgs[id];
    const feature = this.dataset.feature;
    const turnOn = this.classList.contains("inactive");
    if (feature === "port") togglePort(id); 
    else if(feature === "capital") toggleCapital(id);
    else b[feature] = +turnOn;
    if (b[feature]) this.classList.remove("inactive");
    else if (!b[feature]) this.classList.add("inactive");

    if (b.port) document.getElementById("burgEditAnchorStyle").style.display = "inline-block";
    else document.getElementById("burgEditAnchorStyle").style.display = "none";
  }

  function showStyleSection() {
    document.querySelectorAll("#burgBottom > button").forEach(el => el.style.display = "none");
    document.getElementById("burgStyleSection").style.display = "inline-block";
  }

  function hideStyleSection() {
    document.querySelectorAll("#burgBottom > button").forEach(el => el.style.display = "inline-block");
    document.getElementById("burgStyleSection").style.display = "none";
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

  function openInMFCG(event) {
    const id = elSelected.attr("data-id");
    const burg = pack.burgs[id];
    const defSeed = seed + id.padStart(4, 0);

    if (event.ctrlKey) {
      const newSeed = prompt(`Please provide a Medieval Fantasy City Generator seed. `+ 
        `Seed should be a number. Default seed is FMG map seed + burg id padded to 4 chars with zeros (${defSeed}). `+
        `Please note that if seed is custom, "Overworld" button from MFCG will open a different map`, burg.MFCG || defSeed);
      if (newSeed) burg.MFCG = newSeed; else return;
    }

    const name = elSelected.text();
    const size = Math.max(Math.min(rn(burg.population), 65), 6);

    const s = burg.MFCG || defSeed;
    const cell = burg.cell;
    const hub = +pack.cells.road[cell] > 50;
    const river = pack.cells.r[cell] ? 1 : 0;

    const coast = +burg.port;
    const citadel = +burg.citadel;
    const walls = +burg.walls;
    const plaza = +burg.plaza;
    const temple = +burg.temple;
    const shanty = +burg.shanty;

    const url = `http://fantasycities.watabou.ru/?name=${name}&size=${size}&seed=${s}&hub=${hub}&random=0&continuous=0&river=${river}&coast=${coast}&citadel=${citadel}&plaza=${plaza}&temple=${temple}&walls=${walls}&shantytown=${shanty}`;
    openURL(url);
  }

  function openInIAHG(event) {
    const id = elSelected.attr("data-id");
    const burg = pack.burgs[id];
    const defSeed = `${seed}-b${id}`;

    if (event.ctrlKey) {
      const newSeed = prompt(`Please provide an Iron Arachne Heraldry Generator seed. `+ 
        `Default seed is a combination of FMG map seed and burg id (${defSeed})`, burg.IAHG || defSeed);
      if (newSeed) burg.IAHG = newSeed; else return;
    }

    const s = burg.IAHG || defSeed;
    openURL("https://ironarachne.com/heraldry/" + s);
  }

  function toggleRelocateBurg() {
    const toggler = document.getElementById("toggleCells");
    document.getElementById("burgRelocate").classList.toggle("pressed");
    if (document.getElementById("burgRelocate").classList.contains("pressed")) {
      viewbox.style("cursor", "crosshair").on("click", relocateBurgOnClick);
      tip("Click on map to relocate burg. Hold Shift for continuous move", true);
      if (!layerIsOn("toggleCells")) {toggleCells(); toggler.dataset.forced = true;}
    } else {
      clearMainTip();
      viewbox.on("click", clicked).style("cursor", "default");
      if (layerIsOn("toggleCells") && toggler.dataset.forced) {toggleCells(); toggler.dataset.forced = false;}
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
    const x = rn(point[0], 2), y = rn(point[1], 2);
    burgIcons.select("[data-id='" + id + "']").attr("transform", null).attr("cx", x).attr("cy", y);
    burgLabels.select("text[data-id='" + id + "']").attr("transform", null).attr("x", x).attr("y", y);
    const anchor = anchors.select("use[data-id='" + id+ "']");
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
    editNotes("burg"+id, name);
  }

  function removeSelectedBurg() {
    const id = +elSelected.attr("data-id");
    if (pack.burgs[id].capital) {
      alertMessage.innerHTML = `You cannot remove the burg as it is a state capital.<br><br>
        You can change the capital using Burgs Editor (shift + T)`;
      $("#alert").dialog({resizable: false, title: "Remove burg",
        buttons: {Ok: function() {$(this).dialog("close");}}
      });
    } else {
      alertMessage.innerHTML = "Are you sure you want to remove the burg?";
      $("#alert").dialog({resizable: false, title: "Remove burg",
        buttons: {
          Remove: function() {
            $(this).dialog("close");
            removeBurg(id); // see Editors module
            $("#burgEditor").dialog("close");
          },
          Cancel: function() {$(this).dialog("close");}
        }
      });
    }
  }

  function closeBurgEditor() {
    document.getElementById("burgRelocate").classList.remove("pressed");
    burgLabels.selectAll("text").call(d3.drag().on("drag", null)).classed("draggable", false);
    unselect();
  }

}