"use strict";
function editLabel() {
  if (customization) return;
  closeDialogs(".stable");
  if (!layerIsOn("toggleLabels")) toggleLabels();

  const node = d3.event.target;
  elSelected = d3.select(node.parentNode).call(d3.drag().on("start", dragLabel)).classed("draggable", true);
  viewbox.on("touchmove mousemove", showEditorTips);

  $("#labelEditor").dialog({
    title: "Edit Label: " + node.innerHTML, resizable: false,
    position: {my: "center top+10", at: "bottom", of: node, collision: "fit"},
    close: closeLabelEditor
  });

  debug.append("g").attr("id", "controlPoints").attr("transform", elSelected.attr("transform"));
  drawControlPointsAndLine();
  selectLabelGroup(node);
  updateValues(node);

  if (modules.editLabel) return;
  modules.editLabel = true;

  // add listeners
  document.getElementById("labelGroupShow").addEventListener("click", showGroupSection);
  document.getElementById("labelGroupHide").addEventListener("click", hideGroupSection);
  document.getElementById("labelGroupSelect").addEventListener("click", changeGroup);
  document.getElementById("labelGroupInput").addEventListener("change", createNewGroup);
  document.getElementById("labelGroupNew").addEventListener("click", toggleNewGroupInput);
  document.getElementById("labelGroupRemove").addEventListener("click", removeLabelsGroup);

  document.getElementById("labelTextShow").addEventListener("click", showTextSection);
  document.getElementById("labelTextHide").addEventListener("click", hideTextSection);
  document.getElementById("labelText").addEventListener("input", changeText);
  document.getElementById("labelTextRandom").addEventListener("click", generateRandomName); 

  document.getElementById("labelSizeShow").addEventListener("click", showSizeSection);
  document.getElementById("labelSizeHide").addEventListener("click", hideSizeSection);
  document.getElementById("labelStartOffset").addEventListener("input", changeStartOffset);
  document.getElementById("labelRelativeSize").addEventListener("input", changeRelativeSize);

  document.getElementById("labelLegend").addEventListener("click", editLabelLegend);
  document.getElementById("labelRemoveSingle").addEventListener("click", removeLabel);

  function showEditorTips() {
    showMainTip();
    if (d3.event.target.parentNode.id === elSelected.attr("id")) tip("Drag to shift the label"); else
    if (d3.event.target.parentNode.id === "controlPoints") {
      if (d3.event.target.tagName === "circle") tip("Drag to move, click to delete the control point");
      if (d3.event.target.tagName === "path") tip("Click to add a control point");
    }
  }

  function selectLabelGroup(node) {
    const group = node.parentNode.parentNode.id;
    const select = document.getElementById("labelGroupSelect");
    select.options.length = 0; // remove all options

    labels.selectAll(":scope > g").each(function() {
      if (this.id === "burgLabels") return;
      select.options.add(new Option(this.id, this.id, false, this.id === group));
    });
  }

  function updateValues(node) {
    document.getElementById("labelText").value = node.innerHTML;
    document.getElementById("labelStartOffset").value = parseFloat(node.getAttribute("startOffset"));
    document.getElementById("labelRelativeSize").value = parseFloat(node.getAttribute("font-size"));  
  }

  function drawControlPointsAndLine() {
    const path = document.getElementById("textPath_" + elSelected.attr("id"));
    debug.select("#controlPoints").append("path").attr("d", path.getAttribute("d")).on("click", addInterimControlPoint);
    const l = path.getTotalLength();
    const increment = l / Math.max(Math.ceil(l / 100), 2);
    for (let i=0; i <= l; i += increment) {addControlPoint(path.getPointAtLength(i));}
  }

  function addControlPoint(point) {
    debug.select("#controlPoints").append("circle")
      .attr("cx", point.x).attr("cy", point.y).attr("r", 1)
      .call(d3.drag().on("drag", dragControlPoint))
      .on("click", clickControlPoint);
  }

  function dragControlPoint() {
    this.setAttribute("cx", d3.event.x);
    this.setAttribute("cy", d3.event.y);
    redrawLabelPath();
  }

  function redrawLabelPath() {
    const path = document.getElementById("textPath_" + elSelected.attr("id"));
    lineGen.curve(d3.curveBundle.beta(1));
    const points = [];
    debug.select("#controlPoints").selectAll("circle").each(function() {
      points.push([this.getAttribute("cx"), this.getAttribute("cy")]);
    });
    const d = round(lineGen(points));
    path.setAttribute("d", d);
    debug.select("#controlPoints > path").attr("d", d);
  }

  function clickControlPoint() {
    this.remove(); 
    redrawLabelPath();
  }

  function addInterimControlPoint() {
    const point = d3.mouse(this);

    const dists = [];
    debug.select("#controlPoints").selectAll("circle").each(function() {
      const x = +this.getAttribute("cx");
      const y = +this.getAttribute("cy");
      dists.push((point[0] - x) ** 2 + (point[1] - y) ** 2);
    });

    let index = dists.length;
    if (dists.length > 1) {
      const sorted = dists.slice(0).sort((a, b) => a-b);
      const closest = dists.indexOf(sorted[0]);
      const next = dists.indexOf(sorted[1]);
      if (closest <= next) index = closest+1; else index = next+1;
    }

    const before = ":nth-child(" + (index + 2) + ")";
    debug.select("#controlPoints").insert("circle", before)
      .attr("cx", point[0]).attr("cy", point[1]).attr("r", 1)
      .call(d3.drag().on("drag", dragControlPoint))
      .on("click", clickControlPoint);

      redrawLabelPath();
  }

  function dragLabel() {
    const tr = parseTransform(elSelected.attr("transform"));
    const dx = +tr[0] - d3.event.x, dy = +tr[1] - d3.event.y;
  
    d3.event.on("drag", function() {
      const x = d3.event.x, y = d3.event.y;
      const transform = `translate(${(dx+x)},${(dy+y)})`;
      elSelected.attr("transform", transform);
      debug.select("#controlPoints").attr("transform", transform);
    });
  }

  function showGroupSection() {
    document.querySelectorAll("#labelEditor > button").forEach(el => el.style.display = "none");
    document.getElementById("labelGroupSection").style.display = "inline-block";
  }

  function hideGroupSection() {
    document.querySelectorAll("#labelEditor > button").forEach(el => el.style.display = "inline-block");
    document.getElementById("labelGroupSection").style.display = "none";
    document.getElementById("labelGroupInput").style.display = "none";
    document.getElementById("labelGroupInput").value = "";
    document.getElementById("labelGroupSelect").style.display = "inline-block"; 
  }

  function changeGroup() {
    document.getElementById(this.value).appendChild(elSelected.node());
  }

  function toggleNewGroupInput() {
    if (labelGroupInput.style.display === "none") {
      labelGroupInput.style.display = "inline-block";
      labelGroupInput.focus();
      labelGroupSelect.style.display = "none";
    } else {
      labelGroupInput.style.display = "none";
      labelGroupSelect.style.display = "inline-block";
    }   
  }

  function createNewGroup() {
    if (!this.value) {tip("Please provide a valid group name"); return;}
    let group = this.value.toLowerCase().replace(/ /g, "_").replace(/[^\w\s]/gi, "");
    if (Number.isFinite(+group.charAt(0))) group = "g" + group;

    if (document.getElementById(group)) {
      tip("Element with this id already exists. Please provide a unique name", false, "error");
      return;
    }

    // just rename if only 1 element left
    const oldGroup = elSelected.node().parentNode;
    if (oldGroup !== "states" && oldGroup !== "addedLabels" && oldGroup.childElementCount === 1) {
      document.getElementById("labelGroupSelect").selectedOptions[0].remove();
      document.getElementById("labelGroupSelect").options.add(new Option(group, group, false, true));
      oldGroup.id = group;
      toggleNewGroupInput();
      document.getElementById("labelGroupInput").value = "";
      return;
    }

    const newGroup = elSelected.node().parentNode.cloneNode(false);
    document.getElementById("labels").appendChild(newGroup);
    newGroup.id = group;
    document.getElementById("labelGroupSelect").options.add(new Option(group, group, false, true));
    document.getElementById(group).appendChild(elSelected.node());

    toggleNewGroupInput();
    document.getElementById("labelGroupInput").value = "";
  }

  function removeLabelsGroup() {
    const group = elSelected.node().parentNode.id;
    const basic = group === "states" || group === "addedLabels";
    const count = elSelected.node().parentNode.childElementCount;
    alertMessage.innerHTML = `Are you sure you want to remove 
      ${basic ? "all elements in the group" : "the entire label group"}?
      <br><br>Labels to be removed: ${count}`;
    $("#alert").dialog({resizable: false, title: "Remove route group",
      buttons: {
        Remove: function() {
          $(this).dialog("close");
          $("#labelEditor").dialog("close");
          hideGroupSection();
          labels.select("#"+group).selectAll("text").each(function() {
            document.getElementById("textPath_" + this.id).remove();
            this.remove();
          });
          if (!basic) labels.select("#"+group).remove();
        },
        Cancel: function() {$(this).dialog("close");}
      }
    });
  }
  
  function showTextSection() {
    document.querySelectorAll("#labelEditor > button").forEach(el => el.style.display = "none");
    document.getElementById("labelTextSection").style.display = "inline-block";
  }

  function hideTextSection() {
    document.querySelectorAll("#labelEditor > button").forEach(el => el.style.display = "inline-block");
    document.getElementById("labelTextSection").style.display = "none";
  }
  
  function changeText() {
    const text = document.getElementById("labelText").value;
    elSelected.select("textPath").text(text);
    if (elSelected.attr("id").slice(0,10) === "stateLabel") {
      const id = +elSelected.attr("id").slice(10);
      pack.states[id].name = text;    
    }
  }

  function generateRandomName() {
    let name = "";
    if (elSelected.attr("id").slice(0,10) === "stateLabel") {
      const id = +elSelected.attr("id").slice(10);
      const culture = pack.states[id].culture;
      name = Names.getState(Names.getCulture(culture, 4, 7, ""), culture);
    } else {
      const box = elSelected.node().getBBox();
      const cell = findCell((box.x + box.width) / 2, (box.y + box.height) / 2);
      const culture = pack.cells.culture[cell];
      name = Names.getCulture(culture);
    }
    document.getElementById("labelText").value = name;
    changeText();
  }

  function showSizeSection() {
    document.querySelectorAll("#labelEditor > button").forEach(el => el.style.display = "none");
    document.getElementById("labelSizeSection").style.display = "inline-block";
  }

  function hideSizeSection() {
    document.querySelectorAll("#labelEditor > button").forEach(el => el.style.display = "inline-block");
    document.getElementById("labelSizeSection").style.display = "none";
  }

  function changeStartOffset() {
    elSelected.select("textPath").attr("startOffset", this.value + "%");
    tip("Label offset: " + this.value + "%");
  }

  function changeRelativeSize() {
    elSelected.select("textPath").attr("font-size", this.value + "%");
    tip("Label relative size: " + this.value + "%");
  }

  function editLabelLegend() {
    const id = elSelected.attr("id");
    const name = elSelected.text();
    editLegends(id, name);
  }

  function removeLabel() {
    alertMessage.innerHTML = "Are you sure you want to remove the label?";
    $("#alert").dialog({resizable: false, title: "Remove label",
      buttons: {
        Remove: function() {
          $(this).dialog("close");
          defs.select("#textPath_" + elSelected.attr("id")).remove();
          elSelected.remove();
          $("#labelEditor").dialog("close");
        },
        Cancel: function() {$(this).dialog("close");}
      }
    });
  }

  function closeLabelEditor() {
    debug.select("#controlPoints").remove();
    unselect();
  }
}
