"use strict";
function editLake() {
  if (customization) return;
  closeDialogs(".stable");
  if (layerIsOn("toggleCells")) toggleCells();

  $("#lakeEditor").dialog({
    title: "Edit Lake", resizable: false,
    position: {my: "center top+20", at: "top", of: d3.event, collision: "fit"},
    close: closeLakesEditor
  });

  const node = d3.event.target;
  debug.append("g").attr("id", "vertices");
  elSelected = d3.select(node);
  selectLakeGroup(node);
  drawLakeVertices();
  viewbox.on("touchmove mousemove", null);

  if (modules.editLake) return;
  modules.editLake = true;

  // add listeners
  document.getElementById("lakeGroupsShow").addEventListener("click", showGroupSection);
  document.getElementById("lakeGroup").addEventListener("change", changeLakeGroup);
  document.getElementById("lakeGroupAdd").addEventListener("click", toggleNewGroupInput);
  document.getElementById("lakeGroupName").addEventListener("change", createNewGroup);
  document.getElementById("lakeGroupRemove").addEventListener("click", removeLakeGroup);
  document.getElementById("lakeGroupsHide").addEventListener("click", hideGroupSection);

  document.getElementById("lakeEditStyle").addEventListener("click", editGroupStyle);
  document.getElementById("lakeLegend").addEventListener("click", editLakeLegend);

  function drawLakeVertices() {
    const f = +elSelected.attr("data-f"); // feature id
    const v = pack.features[f].vertices; // lake outer vertices

    const c = [... new Set(v.map(v => pack.vertices.c[v]).flat())];
    debug.select("#vertices").selectAll("polygon").data(c).enter().append("polygon")
      .attr("points", d => getPackPolygon(d)).attr("data-c", d => d);

    debug.select("#vertices").selectAll("circle").data(v).enter().append("circle")
      .attr("cx", d => pack.vertices.p[d][0]).attr("cy", d => pack.vertices.p[d][1])
      .attr("r", .4).attr("data-v", d => d).call(d3.drag().on("drag", dragVertex))
      .on("mousemove", () => tip("Drag to move the vertex, please use for fine-tuning only. Edit heightmap to change actual cell heights"));

    const unit = areaUnit.value === "square" ? " " + distanceUnitInput.value + "²" : " " + areaUnit.value;
    const area = pack.features[f].area;
    lakeArea.innerHTML = si(area * distanceScaleInput.value ** 2) + unit;
  }

  function dragVertex() {
    const x = rn(d3.event.x, 2), y = rn(d3.event.y, 2);
    this.setAttribute("cx", x);
    this.setAttribute("cy", y);
    const v = +this.dataset.v;
    pack.vertices.p[v] = [x, y];
    debug.select("#vertices").selectAll("polygon").attr("points", d => getPackPolygon(d));
    redrawLake();
  }

  function redrawLake() {
    lineGen.curve(d3.curveBasisClosed);
    const f = +elSelected.attr("data-f");
    const vertices = pack.features[f].vertices;
    const points = vertices.map(v => pack.vertices.p[v]);
    const d = round(lineGen(points));
    elSelected.attr("d", d);
    defs.select("mask#land > path#land_"+f).attr("d", d); // update land mask

    const unit = areaUnit.value === "square" ? " " + distanceUnitInput.value + "²" : " " + areaUnit.value;
    const area = Math.abs(d3.polygonArea(points));
    lakeArea.innerHTML = si(area * distanceScaleInput.value ** 2) + unit;
  }

  function showGroupSection() {
    document.querySelectorAll("#lakeEditor > button").forEach(el => el.style.display = "none");
    document.getElementById("lakeGroupsSelection").style.display = "inline-block";
  }

  function hideGroupSection() {
    document.querySelectorAll("#lakeEditor > button").forEach(el => el.style.display = "inline-block");
    document.getElementById("lakeGroupsSelection").style.display = "none";
    document.getElementById("lakeGroupName").style.display = "none";
    document.getElementById("lakeGroupName").value = "";
    document.getElementById("lakeGroup").style.display = "inline-block"; 
  }

  function selectLakeGroup(node) {
    const group = node.parentNode.id;
    const select = document.getElementById("lakeGroup");
    select.options.length = 0; // remove all options

    lakes.selectAll("g").each(function() {
      select.options.add(new Option(this.id, this.id, false, this.id === group));
    });
  }

  function changeLakeGroup() {
    document.getElementById(this.value).appendChild(elSelected.node());
  }

  function toggleNewGroupInput() {
    if (lakeGroupName.style.display === "none") {
      lakeGroupName.style.display = "inline-block";
      lakeGroupName.focus();
      lakeGroup.style.display = "none";
    } else {
      lakeGroupName.style.display = "none";
      lakeGroup.style.display = "inline-block";
    }   
  }

  function createNewGroup() {
    if (!this.value) {tip("Please provide a valid group name"); return;}
    const group = this.value.toLowerCase().replace(/ /g, "_").replace(/[^\w\s]/gi, "");

    if (document.getElementById(group)) {
      tip("Element with this id already exists. Please provide a unique name", false, "error");
      return;
    }

    if (Number.isFinite(+group.charAt(0))) {
      tip("Group name should start with a letter", false, "error");
      return;
    }

    // just rename if only 1 element left
    const oldGroup = elSelected.node().parentNode;
    const basic = ["freshwater", "salt", "sinkhole", "frozen", "lava"].includes(oldGroup.id);
    if (!basic && oldGroup.childElementCount === 1) {
      document.getElementById("lakeGroup").selectedOptions[0].remove();
      document.getElementById("lakeGroup").options.add(new Option(group, group, false, true));
      oldGroup.id = group;
      toggleNewGroupInput();
      document.getElementById("lakeGroupName").value = "";
      return;
    }

    // create a new group
    const newGroup = elSelected.node().parentNode.cloneNode(false);
    document.getElementById("lakes").appendChild(newGroup);
    newGroup.id = group;
    document.getElementById("lakeGroup").options.add(new Option(group, group, false, true));
    document.getElementById(group).appendChild(elSelected.node());

    toggleNewGroupInput();
    document.getElementById("lakeGroupName").value = "";
  }
  
  function removeLakeGroup() {
    const group = elSelected.node().parentNode.id;
    if (["freshwater", "salt", "sinkhole", "frozen", "lava"].includes(group)) {
      tip("This is one of the default groups, it cannot be removed", false, "error");
      return;
    }

    const count = elSelected.node().parentNode.childElementCount;
    alertMessage.innerHTML = `Are you sure you want to remove the group? 
      All lakes of the group (${count}) will be turned into Freshwater`;
    $("#alert").dialog({resizable: false, title: "Remove lake group", width:"26em",
      buttons: {
        Remove: function() {
          $(this).dialog("close");
          const freshwater = document.getElementById("freshwater");
          const groupEl = document.getElementById(group);
          while (groupEl.childNodes.length) {
            freshwater.appendChild(groupEl.childNodes[0]);
          }
          groupEl.remove();
          document.getElementById("lakeGroup").selectedOptions[0].remove();
          document.getElementById("lakeGroup").value = "freshwater";
        },
        Cancel: function() {$(this).dialog("close");}
      }
    });
  }

  function editGroupStyle() {
    const g = elSelected.node().parentNode.id;
    editStyle("lakes", g);
  }

  function editLakeLegend() {
    const id = elSelected.attr("id");
    editNotes(id, id);
  }

  function closeLakesEditor() {
    debug.select("#vertices").remove();
    unselect();
  }
}