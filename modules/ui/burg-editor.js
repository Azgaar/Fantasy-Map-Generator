"use strict";
function editBurg() {
  if (customization) return;
  closeDialogs(".stable");
  if (!layerIsOn("toggleIcons")) toggleIcons();
  if (!layerIsOn("toggleLabels")) toggleLabels();

  const id = +d3.event.target.dataset.id;
  elSelected = burgLabels.select("[data-id='" + id + "']");
  burgLabels.selectAll("text").call(d3.drag().on("start", dragBurgLabel)).classed("draggable", true);

  selectBurgGroup(d3.event.target);
  document.getElementById("burgNameInput").value = elSelected.text();
  const my = elSelected.attr("id") == d3.event.target.id ? "center bottom" : "center top+10";
  const at = elSelected.attr("id") == d3.event.target.id ? "top" : "bottom";

  document.getElementById("burgEditAnchorStyle").style.display = +pack.burgs[id].port ? "inline-block" : "none";

  $("#burgEditor").dialog({
    title: "Edit Burg: " + elSelected.text(), resizable: false,
    position: {my, at, of: d3.event.target, collision: "fit"},
    close: closeBurgEditor
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

  document.getElementById("burgNameShow").addEventListener("click", showNameSection);
  document.getElementById("burgNameHide").addEventListener("click", hideNameSection);
  document.getElementById("burgNameInput").addEventListener("input", changeName);
  document.getElementById("burgNameReCulture").addEventListener("click", generateNameCulture);
  document.getElementById("burgNameReRandom").addEventListener("click", generateNameRandom);

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

  function dragBurgLabel() {
    const tr = parseTransform(this.getAttribute("transform"));
    const dx = +tr[0] - d3.event.x, dy = +tr[1] - d3.event.y;

    d3.event.on("drag", function() {
      const x = d3.event.x, y = d3.event.y;
      this.setAttribute("transform", `translate(${(dx+x)},${(dy+y)})`);
      tip('Use dragging for fine-tuning only, to actually move burg use "Relocate" button', false, "warning");
    });
  }

  function selectBurgGroup(node) {
    const group = node.parentNode.id;
    const select = document.getElementById("burgSelectGroup");
    select.options.length = 0; // remove all options

    burgLabels.selectAll("g").each(function() {
      select.options.add(new Option(this.id, this.id, false, this.id === group));
    });
  }

  function showGroupSection() {
    document.querySelectorAll("#burgEditor > button").forEach(el => el.style.display = "none");
    document.getElementById("burgGroupSection").style.display = "inline-block";
  }

  function hideGroupSection() {
    document.querySelectorAll("#burgEditor > button").forEach(el => el.style.display = "inline-block");
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

  function showNameSection() {
    document.querySelectorAll("#burgEditor > button").forEach(el => el.style.display = "none");
    document.getElementById("burgNameSection").style.display = "inline-block";
  }

  function hideNameSection() {
    document.querySelectorAll("#burgEditor > button").forEach(el => el.style.display = "inline-block");
    document.getElementById("burgNameSection").style.display = "none";
  }

  function changeName() {
    const id = +elSelected.attr("data-id");
    pack.burgs[id].name = burgNameInput.value;
    elSelected.text(burgNameInput.value);
  }

  function generateNameCulture() {
    const id = +elSelected.attr("data-id");
    const culture = pack.burgs[id].culture;
    burgNameInput.value = Names.getCulture(culture);
    changeName();
  }

  function generateNameRandom() {
    const base = rand(nameBase.length-1);
    burgNameInput.value = Names.getBase(base);
    changeName();
  }

  function showStyleSection() {
    document.querySelectorAll("#burgEditor > button").forEach(el => el.style.display = "none");
    document.getElementById("burgStyleSection").style.display = "inline-block";
  }

  function hideStyleSection() {
    document.querySelectorAll("#burgEditor > button").forEach(el => el.style.display = "inline-block");
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

  function openInMFCG() {
    const id = elSelected.attr("data-id");
    const name = elSelected.text();
    const cell = pack.burgs[id].cell;
    const pop = rn(pack.burgs[id].population);
    const size = Math.max(Math.min(pop, 65), 6);

    // MFCG seed is FMG map seed + burg id padded to 4 chars with zeros
    const s = seed + id.padStart(4, 0);
    const hub = +pack.cells.road[cell] > 50;
    const river = pack.cells.r[cell] ? 1 : 0;
    const coast = +pack.burgs[id].port;

    const half = rn(pop) % 2;
    const most = (+id + rn(pop)) % 3 ? 1 : 0;
    const walls = pop > 10 && half || pop > 20 && most || pop > 30 ? 1 : 0;;
    const shanty = pop > 40 && half || pop > 60 && most || pop > 80 ? 1 : 0;
    const temple = pop > 50 && half || pop > 80 && most || pop > 100 ? 1 : 0;

    const url = `http://fantasycities.watabou.ru/?name=${name}&size=${size}&seed=${s}&hub=${hub}&random=0&continuous=0&river=${river}&coast=${coast}&citadel=${half}&plaza=${half}&temple=${temple}&walls=${walls}&shantytown=${shanty}`;
    window.open(url, '_blank');
  }

  function openInIAHG() {
    const id = elSelected.attr("data-id");
    const url = `https://ironarachne.com/heraldry/${seed}-b${id}`;
    window.open(url, '_blank');
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
    const capital = pack.burgs[id].capital;

    if (capital) {
      alertMessage.innerHTML = `You cannot remove the burg as it is a capital.<br><br>
        You can change the capital using the Burgs Editor`;
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