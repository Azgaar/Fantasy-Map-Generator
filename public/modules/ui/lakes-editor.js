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
  selectLakeGroup();
  drawLakeVertices();
  viewbox.on("touchmove mousemove", null);

  if (modules.editLake) return;
  modules.editLake = true;

  // add listeners
  ensureEl("lakeName").on("input", changeName);
  ensureEl("lakeNameCulture").on("click", generateNameCulture);
  ensureEl("lakeNameRandom").on("click", generateNameRandom);
  ensureEl("lakeGroup").on("change", changeLakeGroup);
  ensureEl("lakeGroupAdd").on("click", toggleNewGroupInput);
  ensureEl("lakeGroupName").on("change", createNewGroup);
  ensureEl("lakeGroupRemove").on("click", removeLakeGroup);
  ensureEl("lakeEditStyle").on("click", editGroupStyle);
  ensureEl("lakeLegend").on("click", editLakeLegend);

  function getLake() {
    const lakeId = +elSelected.attr("data-f");
    return pack.features.find(feature => feature.i === lakeId);
  }

  function updateLakeValues() {
    const {cells, vertices, rivers} = pack;

    const l = getLake();
    ensureEl("lakeName").value = l.name;
    ensureEl("lakeArea").value = si(getArea(l.area)) + " " + getAreaUnit();

    const length = d3.polygonLength(l.vertices.map(v => vertices.p[v]));
    ensureEl("lakeShoreLength").value = si(length * distanceScale) + " " + distanceUnitInput.value;

    const lakeCells = Array.from(cells.i.filter(i => cells.f[i] === l.i));
    const heights = lakeCells.map(i => cells.h[i]);

    ensureEl("lakeElevation").value = getHeight(l.height);
    ensureEl("lakeAverageDepth").value = getHeight(d3.mean(heights), "abs");
    ensureEl("lakeMaxDepth").value = getHeight(d3.min(heights), "abs");

    ensureEl("lakeFlux").value = l.flux;
    ensureEl("lakeEvaporation").value = l.evaporation;

    const inlets = l.inlets && l.inlets.map(inlet => rivers.find(river => river.i === inlet)?.name);
    const outlet = l.outlet ? rivers.find(river => river.i === l.outlet)?.name : "no";
    ensureEl("lakeInlets").value = inlets ? inlets.length : "no";
    ensureEl("lakeInlets").title = inlets ? inlets.join(", ") : "";
    ensureEl("lakeOutlet").value = outlet;
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
    ensureEl("lakeArea").value = si(getArea(feature.area)) + " " + getAreaUnit();

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

  function selectLakeGroup() {
    const lake = getLake();

    const select = ensureEl("lakeGroup");
    select.options.length = 0; // remove all options
    lakes.selectAll("g").each(function () {
      select.options.add(new Option(this.id, this.id, false, this.id === lake.group));
    });
  }

  function changeLakeGroup() {
    ensureEl(this.value).appendChild(elSelected.node());
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

    if (ensureEl(group)) {
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
      ensureEl("lakeGroup").selectedOptions[0].remove();
      ensureEl("lakeGroup").options.add(new Option(group, group, false, true));
      oldGroup.id = group;
      toggleNewGroupInput();
      ensureEl("lakeGroupName").value = "";
      return;
    }

    // create a new group
    const newGroup = elSelected.node().parentNode.cloneNode(false);
    ensureEl("lakes").appendChild(newGroup);
    newGroup.id = group;
    ensureEl("lakeGroup").options.add(new Option(group, group, false, true));
    ensureEl(group).appendChild(elSelected.node());

    toggleNewGroupInput();
    ensureEl("lakeGroupName").value = "";
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
          const freshwater = ensureEl("freshwater");
          const groupEl = ensureEl(group);
          while (groupEl.childNodes.length) {
            freshwater.appendChild(groupEl.childNodes[0]);
          }
          groupEl.remove();
          ensureEl("lakeGroup").selectedOptions[0].remove();
          ensureEl("lakeGroup").value = "freshwater";
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
