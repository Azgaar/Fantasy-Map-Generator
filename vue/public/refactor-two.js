
  function editIcon() {
    if (customization) return;
    if (elSelected) if (this.isSameNode(elSelected.node())) return;

    unselect();
    closeDialogs("#iconEditor, .stable");
    elSelected = d3.select(this).call(d3.drag().on("start", elementDrag)).classed("draggable", true);

    // update group parameters
    const group = d3.select(this.parentNode);
    iconUpdateGroups();
    iconGroup.value = group.attr("id");
    iconFillColor.value = group.attr("fill");
    iconStrokeColor.value = group.attr("stroke");
    iconSize.value = group.attr("size");
    iconStrokeWidth.value = group.attr("stroke-width");

    $("#iconEditor").dialog({
      title: "Edit icon: " + group.attr("id"),
      minHeight: 30, width: "auto", resizable: false,
      position: {my: "center top+20", at: "top", of: d3.event},
      close: unselect
    });

    if (modules.editIcon) {return;}
    modules.editIcon = true;

    $("#iconGroups").click(function() {
      $("#iconEditor > button").not(this).toggle();
      $("#iconGroupsSelection").toggle();
    });

    function iconUpdateGroups() {
      iconGroup.innerHTML = "";
      const anchor = group.attr("id").includes("anchor");
      icons.selectAll("g").each(function(d) {
        const id = d3.select(this).attr("id");
        if (id === "burgs") return;
        if (!anchor && id.includes("anchor")) return;
        if (anchor && !id.includes("anchor")) return;
        const opt = document.createElement("option");
        opt.value = opt.innerHTML = id;
        iconGroup.add(opt);
      });
    }

    $("#iconGroup").change(function() {
      const newGroup = this.value;
      const to = $("#icons > #"+newGroup);
      $(elSelected.node()).detach().appendTo(to);
    });

    $("#iconCopy").click(function() {
      const group = d3.select(elSelected.node().parentNode);
      const copy = elSelected.node().cloneNode();
      copy.removeAttribute("data-id"); // remove assignment to burg if any
      const tr = parseTransform(copy.getAttribute("transform"));
      const shift = 10 / Math.sqrt(scale);
      let transform = "translate(" + rn(tr[0] - shift, 1)  + "," + rn(tr[1] - shift, 1)  + ")";
      for (let i=2; group.selectAll("[transform='" + transform + "']").size() > 0; i++) {
        transform = "translate(" + rn(tr[0] - shift * i, 1)  + "," + rn(tr[1] - shift * i, 1)  + ")";
      }
      copy.setAttribute("transform", transform);
      group.node().insertBefore(copy, null);
      copy.addEventListener("click", editIcon);
    });

    $("#iconRemoveGroup").click(function() {
      const group = d3.select(elSelected.node().parentNode);
      const count = group.selectAll("*").size();
      if (count < 2) {
        group.remove();
        $("#labelEditor").dialog("close");
        return;
      }
      const message = "Are you sure you want to remove all '" + iconGroup.value + "' icons (" + count + ")?";
      alertMessage.innerHTML = message;
      $("#alert").dialog({resizable: false, title: "Remove icon group",
        buttons: {
          Remove: function() {
            $(this).dialog("close");
            group.remove();
            $("#iconEditor").dialog("close");
          },
          Cancel: function() {$(this).dialog("close");}
        }
      });
    });

    $("#iconColors").click(function() {
      $("#iconEditor > button").not(this).toggle();
      $("#iconColorsSection").toggle();
    });

    $("#iconFillColor").change(function() {
      const group = d3.select(elSelected.node().parentNode);
      group.attr("fill", this.value);
    });

    $("#iconStrokeColor").change(function() {
      const group = d3.select(elSelected.node().parentNode);
      group.attr("stroke", this.value);
    });

    $("#iconSetSize").click(function() {
      $("#iconEditor > button").not(this).toggle();
      $("#iconSizeSection").toggle();
    });

    $("#iconSize").change(function() {
      const group = d3.select(elSelected.node().parentNode);
      const size = +this.value;
      group.attr("size", size);
      group.selectAll("*").each(function() {d3.select(this).attr("width", size).attr("height", size)});
    });

    $("#iconStrokeWidth").change(function() {
      const group = d3.select(elSelected.node().parentNode);
      group.attr("stroke-width", this.value);
    });

    $("#iconRemove").click(function() {
      alertMessage.innerHTML = `Are you sure you want to remove the icon?`;
      $("#alert").dialog({resizable: false, title: "Remove icon",
        buttons: {
          Remove: function() {
            $(this).dialog("close");
            elSelected.remove();
            $("#iconEditor").dialog("close");
          },
          Cancel: function() {$(this).dialog("close");}
        }
      })
    });
  }

  function editReliefIcon() {
    if (customization) return;
    if (elSelected) if (this.isSameNode(elSelected.node())) return;

    unselect();
    closeDialogs("#reliefEditor, .stable");
    elSelected = d3.select(this).raise().call(d3.drag().on("start", elementDrag)).classed("draggable", true);
    const group = elSelected.node().parentNode.id;
    reliefGroup.value = group;

    let bulkRemoveSection = document.getElementById("reliefBulkRemoveSection");
    if (bulkRemoveSection.style.display != "none") reliefBulkRemove.click();

    $("#reliefEditor").dialog({
      title: "Edit relief icon",
      minHeight: 30, width: "auto", resizable: false,
      position: {my: "center top+40", at: "top", of: d3.event},
      close: unselect
    });

    if (modules.editReliefIcon) {return;}
    modules.editReliefIcon = true;

    $("#reliefGroups").click(function() {
      $("#reliefEditor > button").not(this).toggle();
      $("#reliefGroupsSelection").toggle();
    });

    $("#reliefGroup").change(function() {
      const type = this.value;
      const bbox = elSelected.node().getBBox();
      const cx = bbox.x;
      const cy = bbox.y + bbox.height / 2;
      const cell = diagram.find(cx, cy).index;
      const height = cell !== undefined ? cells[cell].height : 50;
      elSelected.remove();
      elSelected = addReliefIcon(height / 100, type, cx, cy, cell);
      elSelected.call(d3.drag().on("start", elementDrag));
    });

    $("#reliefCopy").click(function() {
      const group = d3.select(elSelected.node().parentNode);
      const copy = elSelected.node().cloneNode(true);
      const tr = parseTransform(copy.getAttribute("transform"));
      const shift = 10 / Math.sqrt(scale);
      let transform = "translate(" + rn(tr[0] - shift, 1)  + "," + rn(tr[1] - shift, 1)  + ")";
      for (let i=2; group.selectAll("[transform='" + transform + "']").size() > 0; i++) {
        transform = "translate(" + rn(tr[0] - shift * i, 1)  + "," + rn(tr[1] - shift * i, 1)  + ")";
      }
      copy.setAttribute("transform", transform);
      group.node().insertBefore(copy, null);
      copy.addEventListener("click", editReliefIcon);
    });

    $("#reliefAddfromEditor").click(function() {
      clickToAdd(); // to load on click event function
      $("#addRelief").click();
    });

    $("#reliefRemoveGroup").click(function() {
      const group = d3.select(elSelected.node().parentNode);
      const count = group.selectAll("*").size();
      if (count < 2) {
        group.selectAll("*").remove();
        $("#labelEditor").dialog("close");
        return;
      }
      const message = "Are you sure you want to remove all '" + reliefGroup.value + "' icons (" + count + ")?";
      alertMessage.innerHTML = message;
      $("#alert").dialog({resizable: false, title: "Remove all icons within group",
        buttons: {
          Remove: function() {
            $(this).dialog("close");
            group.selectAll("*").remove();
            $("#reliefEditor").dialog("close");
          },
          Cancel: function() {$(this).dialog("close");}
        }
      });
    });

    $("#reliefBulkRemove").click(function() {
      $("#reliefEditor > button").not(this).toggle();
      let section = document.getElementById("reliefBulkRemoveSection");
      if (section.style.display === "none") {
        section.style.display = "inline-block";
        tip("Drag to remove relief icons in radius", true);
        viewbox.style("cursor", "crosshair").call(d3.drag().on("drag", dragToRemoveReliefIcons));
        customization = 5;
      } else {
        section.style.display = "none";
        restoreDefaultEvents();
        customization = 0;
      }
    });

    function dragToRemoveReliefIcons() {
      let point = d3.mouse(this);
      let cell = diagram.find(point[0], point[1]).index;
      let radius = +reliefBulkRemoveRadius.value;
      let r = rn(6 / graphSize * radius, 1);
      moveCircle(point[0], point[1], r);
      let selection = defineBrushSelection(cell, radius);
      if (selection) removeReliefIcons(selection);
    }

    function removeReliefIcons(selection) {
      if (selection.length === 0) return;
      selection.map(function(index) {
        const selected = terrain.selectAll("g").selectAll("g[data-cell='"+index+"']");
        selected.remove();
      });
    }

    $("#reliefRemove").click(function() {
      alertMessage.innerHTML = `Are you sure you want to remove the icon?`;
      $("#alert").dialog({resizable: false, title: "Remove relief icon",
        buttons: {
          Remove: function() {
            $(this).dialog("close");
            elSelected.remove();
            $("#reliefEditor").dialog("close");
          },
          Cancel: function() {$(this).dialog("close");}
        }
      })
    });
  }
