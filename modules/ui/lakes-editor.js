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
  byId("lakeName").on("input", changeName);
  byId("lakeNameCulture").on("click", generateNameCulture);
  byId("lakeNameRandom").on("click", generateNameRandom);
  byId("lakeGroup").on("change", changeLakeGroup);
  byId("lakeGroupAdd").on("click", toggleNewGroupInput);
  byId("lakeGroupName").on("change", createNewGroup);
  byId("lakeGroupRemove").on("click", removeLakeGroup);
  byId("lakeEditStyle").on("click", editGroupStyle);
  byId("lakeLegend").on("click", editLakeLegend);

  function getLake() {
    const lakeId = +elSelected.attr("data-f");
    return pack.features.find(feature => feature.i === lakeId);
  }

  function updateLakeValues() {
    const {cells, vertices, rivers} = pack;

    const l = getLake();
    byId("lakeName").value = l.name;
    byId("lakeArea").value = si(getArea(l.area)) + " " + getAreaUnit();

    const length = d3.polygonLength(l.vertices.map(v => vertices.p[v]));
    byId("lakeShoreLength").value = si(length * distanceScale) + " " + distanceUnitInput.value;

    const lakeCells = Array.from(cells.i.filter(i => cells.f[i] === l.i));
    const heights = lakeCells.map(i => cells.h[i]);

    byId("lakeElevation").value = getHeight(l.height);
    byId("lakeAverageDepth").value = getHeight(d3.mean(heights), "abs");
    byId("lakeMaxDepth").value = getHeight(d3.min(heights), "abs");

    byId("lakeFlux").value = l.flux;
    byId("lakeEvaporation").value = l.evaporation;

    const inlets = l.inlets && l.inlets.map(inlet => rivers.find(river => river.i === inlet)?.name);
    const outlet = l.outlet ? rivers.find(river => river.i === l.outlet)?.name : "no";
    byId("lakeInlets").value = inlets ? inlets.length : "no";
    byId("lakeInlets").title = inlets ? inlets.join(", ") : "";
    byId("lakeOutlet").value = outlet;
  }

  function drawLakeVertices() {
    const vertices = getLake().vertices;

    const neibCells = unique(vertices.map(v => pack.vertices.c[v]).flat());
    debug
      .select("#vertices")
      .selectAll("polygon")
      .data(neibCells)
      .enter()
      .append("polygon")
      .attr("points", getPackPolygon)
      .attr("data-c", d => d);

    debug
      .select("#vertices")
      .selectAll("circle")
      .data(vertices)
      .enter()
      .append("circle")
      .attr("cx", d => pack.vertices.p[d][0])
      .attr("cy", d => pack.vertices.p[d][1])
      .attr("r", 0.4)
      .attr("data-v", d => d)
      .call(d3.drag().on("drag", handleVertexDrag).on("end", handleVertexDragEnd))
      .on("mousemove", () =>
        tip("Drag to move the vertex. Please use for fine-tuning only! Edit heightmap to change actual cell heights")
      );
  }

  function handleVertexDrag() {
    const x = rn(d3.event.x, 2);
    const y = rn(d3.event.y, 2);
    this.setAttribute("cx", x);
    this.setAttribute("cy", y);

    const vertexId = d3.select(this).datum();
    pack.vertices.p[vertexId] = [x, y];

    const feature = getLake();

    // update lake path
    defs.select("#featurePaths > path#feature_" + feature.i).attr("d", getFeaturePath(feature));

    // update area
    const points = feature.vertices.map(vertex => pack.vertices.p[vertex]);
    feature.area = Math.abs(d3.polygonArea(points));
    byId("lakeArea").value = si(getArea(feature.area)) + " " + getAreaUnit();

    // update cell
    debug.select("#vertices").selectAll("polygon").attr("points", getPackPolygon);
  }

  function handleVertexDragEnd() {
    if (layerIsOn("toggleStates")) drawStates();
    if (layerIsOn("toggleProvinces")) drawProvinces();
    if (layerIsOn("toggleBorders")) drawBorders();
    if (layerIsOn("toggleBiomes")) drawBiomes();
    if (layerIsOn("toggleReligions")) drawReligions();
    if (layerIsOn("toggleCultures")) drawCultures();
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
    const select = byId("lakeGroup");
    select.options.length = 0; // remove all options

    lakes.selectAll("g").each(function () {
      select.options.add(new Option(this.id, this.id, false, this.id === group));
    });
  }

  function changeLakeGroup() {
    byId(this.value).appendChild(elSelected.node());
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

    if (byId(group)) {
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
      byId("lakeGroup").selectedOptions[0].remove();
      byId("lakeGroup").options.add(new Option(group, group, false, true));
      oldGroup.id = group;
      toggleNewGroupInput();
      byId("lakeGroupName").value = "";
      return;
    }

    // create a new group
    const newGroup = elSelected.node().parentNode.cloneNode(false);
    byId("lakes").appendChild(newGroup);
    newGroup.id = group;
    byId("lakeGroup").options.add(new Option(group, group, false, true));
    byId(group).appendChild(elSelected.node());

    toggleNewGroupInput();
    byId("lakeGroupName").value = "";
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
          const freshwater = byId("freshwater");
          const groupEl = byId(group);
          while (groupEl.childNodes.length) {
            freshwater.appendChild(groupEl.childNodes[0]);
          }
          groupEl.remove();
          byId("lakeGroup").selectedOptions[0].remove();
          byId("lakeGroup").value = "freshwater";
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
