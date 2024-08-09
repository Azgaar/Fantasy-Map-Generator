"use strict";
function editLake() {
  if (customization) return;
  closeDialogs(".stable");
  if (layerIsOn("toggleCells")) toggleCells();

  $("#lakeEditor").dialog({
    title: "Edit Lake",
    resizable: false,
    position: {my: "center top+20", at: "top", of: d3.event, collision: "fit"},
    close: closeLakesEditor
  });

  const node = d3.event.target;
  debug.append("g").attr("id", "vertices");
  elSelected = d3.select(node);
  updateLakeValues();
  selectLakeGroup(node);
  drawLakeVertices();
  viewbox.on("touchmove mousemove", null);

  if (modules.editLake) return;
  modules.editLake = true;

  // add listeners
  document.getElementById("lakeName").addEventListener("input", changeName);
  document.getElementById("lakeNameCulture").addEventListener("click", generateNameCulture);
  document.getElementById("lakeNameRandom").addEventListener("click", generateNameRandom);

  document.getElementById("lakeGroup").addEventListener("change", changeLakeGroup);
  document.getElementById("lakeGroupAdd").addEventListener("click", toggleNewGroupInput);
  document.getElementById("lakeGroupName").addEventListener("change", createNewGroup);
  document.getElementById("lakeGroupRemove").addEventListener("click", removeLakeGroup);

  document.getElementById("lakeEditStyle").addEventListener("click", editGroupStyle);
  document.getElementById("lakeLegend").addEventListener("click", editLakeLegend);

  function getLake() {
    const lakeId = +elSelected.attr("data-f");
    return pack.features.find(feature => feature.i === lakeId);
  }

  function updateLakeValues() {
    const cells = pack.cells;

    const l = getLake();
    document.getElementById("lakeName").value = l.name;
    document.getElementById("lakeArea").value = si(getArea(l.area)) + " " + getAreaUnit();

    const length = d3.polygonLength(l.vertices.map(v => pack.vertices.p[v]));
    document.getElementById("lakeShoreLength").value = si(length * distanceScale) + " " + distanceUnitInput.value;

    const lakeCells = Array.from(cells.i.filter(i => cells.f[i] === l.i));
    const heights = lakeCells.map(i => cells.h[i]);

    document.getElementById("lakeElevation").value = getHeight(l.height);
    document.getElementById("lakeAverageDepth").value = getHeight(d3.mean(heights), "abs");
    document.getElementById("lakeMaxDepth").value = getHeight(d3.min(heights), "abs");

    document.getElementById("lakeFlux").value = l.flux;
    document.getElementById("lakeEvaporation").value = l.evaporation;

    const inlets = l.inlets && l.inlets.map(inlet => pack.rivers.find(river => river.i === inlet)?.name);
    const outlet = l.outlet ? pack.rivers.find(river => river.i === l.outlet)?.name : "no";
    document.getElementById("lakeInlets").value = inlets ? inlets.length : "no";
    document.getElementById("lakeInlets").title = inlets ? inlets.join(", ") : "";
    document.getElementById("lakeOutlet").value = outlet;
  }

  function drawLakeVertices() {
    const v = getLake().vertices; // lake outer vertices

    const c = [...new Set(v.map(v => pack.vertices.c[v]).flat())];
    debug
      .select("#vertices")
      .selectAll("polygon")
      .data(c)
      .enter()
      .append("polygon")
      .attr("points", d => getPackPolygon(d))
      .attr("data-c", d => d);

    debug
      .select("#vertices")
      .selectAll("circle")
      .data(v)
      .enter()
      .append("circle")
      .attr("cx", d => pack.vertices.p[d][0])
      .attr("cy", d => pack.vertices.p[d][1])
      .attr("r", 0.4)
      .attr("data-v", d => d)
      .call(d3.drag().on("drag", dragVertex))
      .on("mousemove", () =>
        tip("Drag to move the vertex, please use for fine-tuning only. Edit heightmap to change actual cell heights")
      );
  }

  function dragVertex() {
    const x = rn(d3.event.x, 2),
      y = rn(d3.event.y, 2);
    this.setAttribute("cx", x);
    this.setAttribute("cy", y);
    const v = +this.dataset.v;
    pack.vertices.p[v] = [x, y];
    debug
      .select("#vertices")
      .selectAll("polygon")
      .attr("points", d => getPackPolygon(d));
    redrawLake();
  }

  function redrawLake() {
    lineGen.curve(d3.curveBasisClosed);
    const feature = getLake();
    const points = feature.vertices.map(v => pack.vertices.p[v]);
    const d = round(lineGen(points));
    elSelected.attr("d", d);
    defs.select("mask#land > path#land_" + feature.i).attr("d", d); // update land mask

    feature.area = Math.abs(d3.polygonArea(points));
    document.getElementById("lakeArea").value = si(getArea(feature.area)) + " " + getAreaUnit();
  }

  function changeName() {
    getLake().name = this.value;
  }

  function generateNameCulture() {
    const lake = getLake();
    lake.name = lakeName.value = Lakes.getName(lake);
  }

  function generateNameRandom() {
    const lake = getLake();
    lake.name = lakeName.value = Names.getBase(rand(nameBases.length - 1));
  }

  function selectLakeGroup(node) {
    const group = node.parentNode.id;
    const select = document.getElementById("lakeGroup");
    select.options.length = 0; // remove all options

    lakes.selectAll("g").each(function () {
      select.options.add(new Option(this.id, this.id, false, this.id === group));
    });
  }

  function changeLakeGroup() {
    document.getElementById(this.value).appendChild(elSelected.node());
    getLake().group = this.value;
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
    if (!this.value) {
      tip("Please provide a valid group name");
      return;
    }
    const group = this.value
      .toLowerCase()
      .replace(/ /g, "_")
      .replace(/[^\w\s]/gi, "");

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
    const basic = ["freshwater", "salt", "sinkhole", "frozen", "lava", "dry"].includes(oldGroup.id);
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
    if (["freshwater", "salt", "sinkhole", "frozen", "lava", "dry"].includes(group)) {
      tip("This is one of the default groups, it cannot be removed", false, "error");
      return;
    }

    const count = elSelected.node().parentNode.childElementCount;
    alertMessage.innerHTML = /* html */ `Are you sure you want to remove the group? All lakes of the group (${count}) will be turned into Freshwater`;
    $("#alert").dialog({
      resizable: false,
      title: "Remove lake group",
      width: "26em",
      buttons: {
        Remove: function () {
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
        Cancel: function () {
          $(this).dialog("close");
        }
      }
    });
  }

  function editGroupStyle() {
    const g = elSelected.node().parentNode.id;
    editStyle("lakes", g);
  }

  function editLakeLegend() {
    const id = elSelected.attr("id");
    editNotes(id, getLake().name + " " + lakeGroup.value + " lake");
  }

  function closeLakesEditor() {
    debug.select("#vertices").remove();
    unselect();
  }
}
