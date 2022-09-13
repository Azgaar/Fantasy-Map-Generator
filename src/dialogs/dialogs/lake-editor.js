import * as d3 from "d3";

import {closeDialogs} from "dialogs/utils";
import {layerIsOn, toggleLayer} from "layers";
import {tip} from "scripts/tooltips";
import {getPackPolygon} from "utils/graphUtils";
import {rn} from "utils/numberUtils";
import {rand} from "utils/probabilityUtils";
import {round} from "utils/stringUtils";
import {getArea, getAreaUnit, getHeight, si} from "utils/unitUtils";
import {unselect} from "modules/ui/editors";

let isLoaded = false;

export function open({el}) {
  closeDialogs(".stable");
  if (layerIsOn("toggleCells")) toggleLayer("toggleCells");

  $("#lakeEditor").dialog({
    title: "Edit Lake",
    resizable: false,
    position: {my: "center top+20", at: "top", of: d3.event, collision: "fit"},
    close: closeLakesEditor
  });

  debug.append("g").attr("id", "vertices");
  elSelected = d3.select(el);
  updateLakeValues();
  selectLakeGroup(el);
  drawLakeVertices();
  viewbox.on("touchmove mousemove", null);

  if (isLoaded) return;
  isLoaded = true;

  // add listeners
  byId("lakeName")?.on("input", changeName);
  byId("lakeNameCulture")?.on("click", generateNameCulture);
  byId("lakeNameRandom")?.on("click", generateNameRandom);

  byId("lakeGroup")?.on("change", changeLakeGroup);
  byId("lakeGroupAdd")?.on("click", toggleNewGroupInput);
  byId("lakeGroupName")?.on("change", createNewGroup);
  byId("lakeGroupRemove")?.on("click", removeLakeGroup);

  byId("lakeEditStyle")?.on("click", editGroupStyle);
  byId("lakeLegend")?.on("click", editLakeLegend);

  function getLake() {
    const lakeId = +elSelected.attr("data-f");
    return pack.features.find(feature => feature.i === lakeId);
  }

  function updateLakeValues() {
    const cells = pack.cells;

    const l = getLake();
    byId("lakeName").value = l.name;
    byId("lakeArea").value = si(getArea(l.area)) + " " + getAreaUnit();

    const length = d3.polygonLength(l.vertices.map(v => pack.vertices.p[v]));
    byId("lakeShoreLength").value = si(length * distanceScaleInput.value) + " " + distanceUnitInput.value;

    const lakeCells = Array.from(cells.i.filter(i => cells.f[i] === l.i));
    const heights = lakeCells.map(i => cells.h[i]);

    byId("lakeElevation").value = getHeight(l.height);
    byId("lakeAverageDepth").value = getHeight(d3.mean(heights), true);
    byId("lakeMaxDepth").value = getHeight(d3.min(heights), true);

    byId("lakeFlux").value = l.flux;
    byId("lakeEvaporation").value = l.evaporation;

    const inlets = l.inlets && l.inlets.map(inlet => pack.rivers.find(river => river.i === inlet)?.name);
    const outlet = l.outlet ? pack.rivers.find(river => river.i === l.outlet)?.name : "no";
    byId("lakeInlets").value = inlets ? inlets.length : "no";
    byId("lakeInlets").title = inlets ? inlets.join(", ") : "";
    byId("lakeOutlet").value = outlet;
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

  const lineGen = d3.line().curve(d3.curveBasisClosed);

  function redrawLake() {
    const feature = getLake();
    const points = feature.vertices.map(v => pack.vertices.p[v]);
    const d = round(lineGen(points));
    elSelected.attr("d", d);
    defs.select("mask#land > path#land_" + feature.i).attr("d", d); // update land mask

    feature.area = Math.abs(d3.polygonArea(points));
    byId("lakeArea").value = si(getArea(feature.area)) + " " + getAreaUnit();
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
