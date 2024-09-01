"use strict";
function editLabel() {
  if (customization) return;
  closeDialogs();
  if (!layerIsOn("toggleLabels")) toggleLabels();

  const tspan = d3.event.target;
  const textPath = tspan.parentNode;
  const text = textPath.parentNode;
  elSelected = d3.select(text).call(d3.drag().on("start", dragLabel)).classed("draggable", true);
  viewbox.on("touchmove mousemove", showEditorTips);

  $("#labelEditor").dialog({
    title: "Edit Label",
    resizable: false,
    width: fitContent(),
    position: {my: "center top+10", at: "bottom", of: text, collision: "fit"},
    close: closeLabelEditor
  });

  drawControlPointsAndLine();
  selectLabelGroup(text);
  updateValues(textPath);

  if (modules.editLabel) return;
  modules.editLabel = true;

  // add listeners
  byId("labelGroupShow").on("click", showGroupSection);
  byId("labelGroupHide").on("click", hideGroupSection);
  byId("labelGroupSelect").on("click", changeGroup);
  byId("labelGroupInput").on("change", createNewGroup);
  byId("labelGroupNew").on("click", toggleNewGroupInput);
  byId("labelGroupRemove").on("click", removeLabelsGroup);

  byId("labelTextShow").on("click", showTextSection);
  byId("labelTextHide").on("click", hideTextSection);
  byId("labelText").on("input", changeText);
  byId("labelTextRandom").on("click", generateRandomName);

  byId("labelEditStyle").on("click", editGroupStyle);

  byId("labelSizeShow").on("click", showSizeSection);
  byId("labelSizeHide").on("click", hideSizeSection);
  byId("labelStartOffset").on("input", changeStartOffset);
  byId("labelRelativeSize").on("input", changeRelativeSize);

  byId("labelLetterSpacingShow").on("click", showLetterSpacingSection);
  byId("labelLetterSpacingHide").on("click", hideLetterSpacingSection);
  byId("labelLetterSpacingSize").on("input", changeLetterSpacingSize);

  byId("labelAlign").on("click", editLabelAlign);
  byId("labelLegend").on("click", editLabelLegend);
  byId("labelRemoveSingle").on("click", removeLabel);

  function showEditorTips() {
    showMainTip();
    if (d3.event.target.parentNode.parentNode.id === elSelected.attr("id")) tip("Drag to shift the label");
    else if (d3.event.target.parentNode.id === "controlPoints") {
      if (d3.event.target.tagName === "circle") tip("Drag to move, click to delete the control point");
      if (d3.event.target.tagName === "path") tip("Click to add a control point");
    }
  }

  function selectLabelGroup(text) {
    const group = text.parentNode.id;

    if (group === "states" || group === "burgLabels") {
      byId("labelGroupShow").style.display = "none";
      return;
    }

    hideGroupSection();
    const select = byId("labelGroupSelect");
    select.options.length = 0; // remove all options

    labels.selectAll(":scope > g").each(function () {
      if (this.id === "states") return;
      if (this.id === "burgLabels") return;
      select.options.add(new Option(this.id, this.id, false, this.id === group));
    });
  }

  function updateValues(textPath) {
    byId("labelText").value = [...textPath.querySelectorAll("tspan")].map(tspan => tspan.textContent).join("|");
    byId("labelStartOffset").value = parseFloat(textPath.getAttribute("startOffset"));
    byId("labelRelativeSize").value = parseFloat(textPath.getAttribute("font-size"));
    let letterSpacingSize = textPath.getAttribute("letter-spacing") ? textPath.getAttribute("letter-spacing") : 0;
    byId("labelLetterSpacingSize").value = parseFloat(letterSpacingSize);
  }

  function drawControlPointsAndLine() {
    debug.select("#controlPoints").remove();
    debug.append("g").attr("id", "controlPoints").attr("transform", elSelected.attr("transform"));
    const path = byId("textPath_" + elSelected.attr("id"));
    debug.select("#controlPoints").append("path").attr("d", path.getAttribute("d")).on("click", addInterimControlPoint);
    const l = path.getTotalLength();
    if (!l) return;
    const increment = l / Math.max(Math.ceil(l / 200), 2);
    for (let i = 0; i <= l; i += increment) {
      addControlPoint(path.getPointAtLength(i));
    }
  }

  function addControlPoint(point) {
    debug
      .select("#controlPoints")
      .append("circle")
      .attr("cx", point.x)
      .attr("cy", point.y)
      .attr("r", 2.5)
      .attr("stroke-width", 0.8)
      .call(d3.drag().on("drag", dragControlPoint))
      .on("click", clickControlPoint);
  }

  function dragControlPoint() {
    this.setAttribute("cx", d3.event.x);
    this.setAttribute("cy", d3.event.y);
    redrawLabelPath();
  }

  function redrawLabelPath() {
    const path = byId("textPath_" + elSelected.attr("id"));
    lineGen.curve(d3.curveBundle.beta(1));
    const points = [];
    debug
      .select("#controlPoints")
      .selectAll("circle")
      .each(function () {
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
    debug
      .select("#controlPoints")
      .selectAll("circle")
      .each(function () {
        const x = +this.getAttribute("cx");
        const y = +this.getAttribute("cy");
        dists.push((point[0] - x) ** 2 + (point[1] - y) ** 2);
      });

    let index = dists.length;
    if (dists.length > 1) {
      const sorted = dists.slice(0).sort((a, b) => a - b);
      const closest = dists.indexOf(sorted[0]);
      const next = dists.indexOf(sorted[1]);
      if (closest <= next) index = closest + 1;
      else index = next + 1;
    }

    const before = ":nth-child(" + (index + 2) + ")";
    debug
      .select("#controlPoints")
      .insert("circle", before)
      .attr("cx", point[0])
      .attr("cy", point[1])
      .attr("r", 2.5)
      .attr("stroke-width", 0.8)
      .call(d3.drag().on("drag", dragControlPoint))
      .on("click", clickControlPoint);

    redrawLabelPath();
  }

  function dragLabel() {
    const tr = parseTransform(elSelected.attr("transform"));
    const dx = +tr[0] - d3.event.x,
      dy = +tr[1] - d3.event.y;

    d3.event.on("drag", function () {
      const x = d3.event.x,
        y = d3.event.y;
      const transform = `translate(${dx + x},${dy + y})`;
      elSelected.attr("transform", transform);
      debug.select("#controlPoints").attr("transform", transform);
    });
  }

  function showGroupSection() {
    document.querySelectorAll("#labelEditor > button").forEach(el => (el.style.display = "none"));
    byId("labelGroupSection").style.display = "inline-block";
  }

  function hideGroupSection() {
    document.querySelectorAll("#labelEditor > button").forEach(el => (el.style.display = "inline-block"));
    byId("labelGroupSection").style.display = "none";
    byId("labelGroupInput").style.display = "none";
    byId("labelGroupInput").value = "";
    byId("labelGroupSelect").style.display = "inline-block";
  }

  function changeGroup() {
    byId(this.value).appendChild(elSelected.node());
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
    if (oldGroup !== "states" && oldGroup !== "addedLabels" && oldGroup.childElementCount === 1) {
      byId("labelGroupSelect").selectedOptions[0].remove();
      byId("labelGroupSelect").options.add(new Option(group, group, false, true));
      oldGroup.id = group;
      toggleNewGroupInput();
      byId("labelGroupInput").value = "";
      return;
    }

    const newGroup = elSelected.node().parentNode.cloneNode(false);
    byId("labels").appendChild(newGroup);
    newGroup.id = group;
    byId("labelGroupSelect").options.add(new Option(group, group, false, true));
    byId(group).appendChild(elSelected.node());

    toggleNewGroupInput();
    byId("labelGroupInput").value = "";
  }

  function removeLabelsGroup() {
    const group = elSelected.node().parentNode.id;
    const basic = group === "states" || group === "addedLabels";
    const count = elSelected.node().parentNode.childElementCount;
    alertMessage.innerHTML = /* html */ `Are you sure you want to remove ${
      basic ? "all elements in the group" : "the entire label group"
    }? <br /><br />Labels to be
      removed: ${count}`;
    $("#alert").dialog({
      resizable: false,
      title: "Remove route group",
      buttons: {
        Remove: function () {
          $(this).dialog("close");
          $("#labelEditor").dialog("close");
          hideGroupSection();
          labels
            .select("#" + group)
            .selectAll("text")
            .each(function () {
              byId("textPath_" + this.id).remove();
              this.remove();
            });
          if (!basic) labels.select("#" + group).remove();
        },
        Cancel: function () {
          $(this).dialog("close");
        }
      }
    });
  }

  function showTextSection() {
    document.querySelectorAll("#labelEditor > button").forEach(el => (el.style.display = "none"));
    byId("labelTextSection").style.display = "inline-block";
  }

  function hideTextSection() {
    document.querySelectorAll("#labelEditor > button").forEach(el => (el.style.display = "inline-block"));
    byId("labelTextSection").style.display = "none";
  }

  function changeText() {
    const input = byId("labelText").value;
    const el = elSelected.select("textPath").node();

    const lines = input.split("|");
    if (lines.length > 1) {
      const top = (lines.length - 1) / -2; // y offset
      el.innerHTML = lines.map((line, index) => `<tspan x="0" dy="${index ? 1 : top}em">${line}</tspan>`).join("");
    } else el.innerHTML = `<tspan x="0">${lines}</tspan>`;

    if (elSelected.attr("id").slice(0, 10) === "stateLabel")
      tip("Use States Editor to change an actual state name, not just a label", false, "warning");
  }

  function generateRandomName() {
    let name = "";
    if (elSelected.attr("id").slice(0, 10) === "stateLabel") {
      const id = +elSelected.attr("id").slice(10);
      const culture = pack.states[id].culture;
      name = Names.getState(Names.getCulture(culture, 4, 7, ""), culture);
    } else {
      const box = elSelected.node().getBBox();
      const cell = findCell((box.x + box.width) / 2, (box.y + box.height) / 2);
      const culture = pack.cells.culture[cell];
      name = Names.getCulture(culture);
    }
    byId("labelText").value = name;
    changeText();
  }

  function editGroupStyle() {
    const g = elSelected.node().parentNode.id;
    editStyle("labels", g);
  }

  function showSizeSection() {
    document.querySelectorAll("#labelEditor > button").forEach(el => (el.style.display = "none"));
    byId("labelSizeSection").style.display = "inline-block";
  }

  function hideSizeSection() {
    document.querySelectorAll("#labelEditor > button").forEach(el => (el.style.display = "inline-block"));
    byId("labelSizeSection").style.display = "none";
  }

  function showLetterSpacingSection() {
    document.querySelectorAll("#labelEditor > button").forEach(el => (el.style.display = "none"));
    byId("labelLetterSpacingSection").style.display = "inline-block";
  }

  function hideLetterSpacingSection() {
    document.querySelectorAll("#labelEditor > button").forEach(el => (el.style.display = "inline-block"));
    byId("labelLetterSpacingSection").style.display = "none";
  }

  function changeStartOffset() {
    elSelected.select("textPath").attr("startOffset", this.value + "%");
    tip("Label offset: " + this.value + "%");
  }

  function changeRelativeSize() {
    elSelected.select("textPath").attr("font-size", this.value + "%");
    tip("Label relative size: " + this.value + "%");
    changeText();
  }

  function changeLetterSpacingSize() {
    elSelected.select("textPath").attr("letter-spacing", this.value + "px");
    tip("Label letter-spacing size: " + this.value + "px");
    changeText();
  }

  function editLabelAlign() {
    const bbox = elSelected.node().getBBox();
    const c = [bbox.x + bbox.width / 2, bbox.y + bbox.height / 2];
    const path = defs.select("#textPath_" + elSelected.attr("id"));
    path.attr("d", `M${c[0] - bbox.width},${c[1]}h${bbox.width * 2}`);
    drawControlPointsAndLine();
  }

  function editLabelLegend() {
    const id = elSelected.attr("id");
    const name = elSelected.text();
    editNotes(id, name);
  }

  function removeLabel() {
    alertMessage.innerHTML = "Are you sure you want to remove the label?";
    $("#alert").dialog({
      resizable: false,
      title: "Remove label",
      buttons: {
        Remove: function () {
          $(this).dialog("close");
          defs.select("#textPath_" + elSelected.attr("id")).remove();
          elSelected.remove();
          $("#labelEditor").dialog("close");
        },
        Cancel: function () {
          $(this).dialog("close");
        }
      }
    });
  }

  function closeLabelEditor() {
    debug.select("#controlPoints").remove();
    unselect();
  }
}
