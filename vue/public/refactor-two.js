    function addRoutePoint(point) {
      const controlPoints = debug.select(".controlPoints").size()
        ? debug.select(".controlPoints")
        : debug.append("g").attr("class", "controlPoints");
      controlPoints.append("circle")
        .attr("cx", point.x).attr("cy", point.y).attr("r", 0.35)
        .call(d3.drag().on("drag", routePointDrag))
        .on("click", function(d) {
          if ($("#routeSplit").hasClass('pressed')) {
            routeSplitInPoint(this);
          } else {
            $(this).remove();
            routeRedraw();
          }
        });
    }

    function routePointDrag() {
      d3.select(this).attr("cx", d3.event.x).attr("cy", d3.event.y);
      routeRedraw();
    }

    function routeRedraw() {
      let points = [];
      debug.select(".controlPoints").selectAll("circle").each(function() {
        const el = d3.select(this);
        points.push({scX: +el.attr("cx"), scY: +el.attr("cy")});
      });
      lineGen.curve(d3.curveCatmullRom.alpha(0.1));
      elSelected.attr("d", lineGen(points));
      // get route distance
      const l = elSelected.node().getTotalLength();
      routeLength.innerHTML = rn(l * distanceScale.value) + " " + distanceUnit.value;
    }

    function addNewRoute() {
      let routeType = elSelected && elSelected.node() ? elSelected.node().parentNode.id : "searoutes";
      const group = routes.select("#"+routeType);
      const id = routeType + "" + group.selectAll("*").size();
      elSelected = group.append("path").attr("data-route", "new").attr("id", id).on("click", editRoute);
      routeUpdateGroups();
      $("#routeEditor").dialog({
        title: "Edit Route", minHeight: 30, width: "auto", resizable: false,
        close: function() {
          if ($("#addRoute").hasClass('pressed')) completeNewRoute();
          if ($("#routeSplit").hasClass('pressed')) $("#routeSplit").removeClass('pressed');
          unselect();
        }
      });
    }

    function newRouteAddPoint() {
      const point = d3.mouse(this);
      const x = rn(point[0],2), y = rn(point[1],2);
      addRoutePoint({x, y});
      routeRedraw();
    }

    function completeNewRoute() {
      $("#routeNew, #addRoute").removeClass('pressed');
      restoreDefaultEvents();
      if (!elSelected.size()) return;
      if (elSelected.attr("data-route") === "new") {
        routeRedraw();
        elSelected.attr("data-route", "");
        const node = elSelected.node();
        const l = node.getTotalLength();
        let pathCells = [];
        for (let i = 0; i <= l; i ++) {
          const p = node.getPointAtLength(i);
          const cell = diagram.find(p.x, p.y);
          if (!cell) {return;}
          pathCells.push(cell.index);
        }
        const uniqueCells = [...new Set(pathCells)];
        uniqueCells.map(function(c) {
          if (cells[c].path !== undefined) {cells[c].path += 1;}
          else {cells[c].path = 1;}
        });
      }
      tip("", true);
    }

    function routeUpdateGroups() {
      routeGroup.innerHTML = "";
      routes.selectAll("g").each(function() {
        const opt = document.createElement("option");
        opt.value = opt.innerHTML = this.id;
        routeGroup.add(opt);
      });
    }

    function routeSplitInPoint(clicked) {
      const group = d3.select(elSelected.node().parentNode);
      $("#routeSplit").removeClass('pressed');
      const points1 = [],points2 = [];
      let points = points1;
      debug.select(".controlPoints").selectAll("circle").each(function() {
        const el = d3.select(this);
        points.push({scX: +el.attr("cx"), scY: +el.attr("cy")});
        if (this === clicked) {
          points = points2;
          points.push({scX: +el.attr("cx"), scY: +el.attr("cy")});
        }
        el.remove();
      });
      lineGen.curve(d3.curveCatmullRom.alpha(0.1));
      elSelected.attr("d", lineGen(points1));
      const id = routeGroup.value + "" + group.selectAll("*").size();
      group.append("path").attr("id", id).attr("d", lineGen(points2)).on("click", editRoute);
      routeDrawPoints();
    }

    $("#routeGroup").change(function() {
      $(elSelected.node()).detach().appendTo($("#"+this.value));
    });

    // open legendsEditor
    document.getElementById("routeLegend").addEventListener("click", function() {
      let id = elSelected.attr("id");
      editLegends(id, id);
    });

    $("#routeNew").click(function() {
      if ($(this).hasClass('pressed')) {
        completeNewRoute();
      } else {
        // enter creation mode
        $(".pressed").removeClass('pressed');
        $("#routeNew, #addRoute").addClass('pressed');
        debug.select(".controlPoints").selectAll("*").remove();
        addNewRoute();
        viewbox.style("cursor", "crosshair").on("click", newRouteAddPoint);
        tip("Click on map to add route point", true);
      }
    });

    $("#routeRemove").click(function() {
      alertMessage.innerHTML = `Are you sure you want to remove the route?`;
      $("#alert").dialog({resizable: false, title: "Remove route",
        buttons: {
          Remove: function() {
            $(this).dialog("close");
            elSelected.remove();
            $("#routeEditor").dialog("close");
          },
          Cancel: function() {$(this).dialog("close");}
        }
      })
    });
  }

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

  function editBurg() {
    if (customization) return;
    unselect();
    closeDialogs("#burgEditor, .stable");
    elSelected = d3.select(this);
    const id = +elSelected.attr("data-id");
    if (id === undefined) return;
    d3.selectAll("[data-id='" + id + "']").call(d3.drag().on("start", elementDrag)).classed("draggable", true);

    // update Burg details
    const type = elSelected.node().parentNode.id;
    const labelGroup = burgLabels.select("#"+type);
    const iconGroup = burgIcons.select("#"+type);
    burgNameInput.value = manors[id].name;
    updateBurgsGroupOptions();
    burgSelectGroup.value = labelGroup.attr("id");
    burgSelectDefaultFont.value = fonts.indexOf(labelGroup.attr("data-font"));
    burgSetLabelSize.value = labelGroup.attr("data-size");
    burgLabelColorInput.value = toHEX(labelGroup.attr("fill"));
    burgLabelOpacity.value = labelGroup.attr("opacity") === undefined ? 1 : +labelGroup.attr("opacity");
    const tr = parseTransform(elSelected.attr("transform"));
    burgLabelAngle.value = tr[2];
    burgLabelAngleOutput.innerHTML = Math.abs(+tr[2]) + "°";
    burgIconSize.value = iconGroup.attr("size");
    burgIconFillOpacity.value = iconGroup.attr("fill-opacity") === undefined ? 1 : +iconGroup.attr("fill-opacity");
    burgIconFillColor.value = iconGroup.attr("fill");
    burgIconStrokeWidth.value = iconGroup.attr("stroke-width");
    burgIconStrokeOpacity.value = iconGroup.attr("stroke-opacity") === undefined ? 1 : +iconGroup.attr("stroke-opacity");
    burgIconStrokeColor.value = iconGroup.attr("stroke");
    const cell = cells[manors[id].cell];
    if (cell.region !== "neutral" && cell.region !== undefined) {
      burgToggleCapital.disabled = false;
      const capital = states[manors[id].region] ? id === states[manors[id].region].capital ? 1 : 0 : 0;
      d3.select("#burgToggleCapital").classed("pressed", capital);
    } else {
      burgToggleCapital.disabled = true;
      d3.select("#burgToggleCapital").classed("pressed", false);
    }
    d3.select("#burgTogglePort").classed("pressed", cell.port !== undefined);
    burgPopulation.value = manors[id].population;
    burgPopulationFriendly.value = rn(manors[id].population * urbanization.value * populationRate.value * 1000);

    $("#burgEditor").dialog({
      title: "Edit Burg: " + manors[id].name,
      minHeight: 30, width: "auto", resizable: false,
      position: {my: "center top+40", at: "top", of: d3.event},
      close: function() {
        d3.selectAll("[data-id='" + id + "']").call(d3.drag().on("drag", null)).classed("draggable", false);
        elSelected = null;
      }
    });

    if (modules.editBurg) return;
    modules.editBurg = true;

    loadDefaultFonts();

    function updateBurgsGroupOptions() {
      burgSelectGroup.innerHTML = "";
      burgIcons.selectAll("g").each(function(d) {
        const opt = document.createElement("option");
        opt.value = opt.innerHTML = d3.select(this).attr("id");
        burgSelectGroup.add(opt);
      });
    }

    $("#burgEditor > button").not("#burgAddfromEditor").not("#burgRelocate").not("#burgRemove").click(function() {
      if ($(this).next().is(":visible")) {
        $("#burgEditor > button").show();
        $(this).next("div").hide();
      } else {
        $("#burgEditor > *").not(this).hide();
        $(this).next("div").show();
      }
    });

    $("#burgEditor > div > button").click(function() {
      if ($(this).next().is(":visible")) {
        $("#burgEditor > div > button").show();
        $(this).parent().prev().show();
        $(this).next("div").hide();
      } else {
        $("#burgEditor > div > button").not(this).hide();
        $(this).parent().prev().hide();
        $(this).next("div").show();
      }
    });

    $("#burgSelectGroup").change(function() {
      const id = +elSelected.attr("data-id");
      const g = this.value;
      moveBurgToGroup(id, g);
    });

    $("#burgInputGroup").change(function() {
      let newGroup = this.value.toLowerCase().replace(/ /g, "_").replace(/[^\w\s]/gi, "");
      if (Number.isFinite(+newGroup.charAt(0))) newGroup = "g" + newGroup;
      if (burgLabels.select("#"+newGroup).size()) {
        tip('The group "'+ newGroup + '" is already exists');
        return;
      }
      burgInputGroup.value = "";
      // clone old group assigning new id
      const id = elSelected.node().parentNode.id;
      const l = burgLabels.select("#"+id).node().cloneNode(false);
      l.id = newGroup;
      const i = burgIcons.select("#"+id).node().cloneNode(false);
      i.id = newGroup;
      burgLabels.node().insertBefore(l, null);
      burgIcons.node().insertBefore(i, null);
      // select new group
      const opt = document.createElement("option");
      opt.value = opt.innerHTML = newGroup;
      burgSelectGroup.add(opt);
      $("#burgSelectGroup").val(newGroup).change();
      $("#burgSelectGroup, #burgInputGroup").toggle();
      updateLabelGroups();
    });

    $("#burgAddGroup").click(function() {
      if ($("#burgInputGroup").css("display") === "none") {
        $("#burgInputGroup").css("display", "inline-block");
        $("#burgSelectGroup").css("display", "none");
        burgInputGroup.focus();
      } else {
        $("#burgSelectGroup").css("display", "inline-block");
        $("#burgInputGroup").css("display", "none");
      }
    });

    $("#burgRemoveGroup").click(function() {
      const group = d3.select(elSelected.node().parentNode);
      const type = group.attr("id");
      const id = +elSelected.attr("data-id");
      const count = group.selectAll("*").size();
      const message = "Are you sure you want to remove all Burgs (" + count + ") of that group?";
      alertMessage.innerHTML = message;
      $("#alert").dialog({resizable: false, title: "Remove Burgs",
        buttons: {
          Remove: function() {
            $(this).dialog("close");
            group.selectAll("*").each(function(d) {
              const id = +d3.select(this).attr("data-id");
              if (id === undefined) return;
              const cell = manors[id].cell;
              const state = manors[id].region;
              if (states[state]) {
                if (states[state].capital === id) states[state].capital = "select";
                states[state].burgs --;
              }
              manors[id].region = "removed";
              cells[cell].manor = undefined;
            });
            burgLabels.select("#"+type).selectAll("*").remove();
            burgIcons.select("#"+type).selectAll("*").remove();
            $("#icons g[id*='anchors'] [data-id=" + id + "]").parent().children().remove();
            closeDialogs(".stable");
            updateCountryEditors();
            $("#burgEditor").dialog("close");
          },
          Cancel: function() {$(this).dialog("close");}
        }
      });

    });

    $("#burgNameInput").on("input", function() {
      if (this.value === "") {
        tip("Name should not be blank, set opacity to 0 to hide label or remove button to delete");
        return;
      }
      const id = +elSelected.attr("data-id");
      burgLabels.selectAll("[data-id='" + id + "']").text(this.value);
      manors[id].name = this.value;
      $("div[aria-describedby='burgEditor'] .ui-dialog-title").text("Edit Burg: " + this.value);
    });

    $("#burgNameReCulture, #burgNameReRandom").click(function() {
      const id = +elSelected.attr("data-id");
      const culture = this.id === "burgNameReCulture" ? manors[id].culture : Math.floor(Math.random() * cultures.length);
      const name = generateName(culture);
      burgLabels.selectAll("[data-id='" + id + "']").text(name);
      manors[id].name = name;
      burgNameInput.value = name;
      $("div[aria-describedby='burgEditor'] .ui-dialog-title").text("Edit Burg: " + name);
    });

    $("#burgToggleExternalFont").click(function() {
      if ($("#burgInputExternalFont").css("display") === "none") {
        $("#burgInputExternalFont").css("display", "inline-block");
        $("#burgSelectDefaultFont").css("display", "none");
        burgInputExternalFont.focus();
      } else {
        $("#burgSelectDefaultFont").css("display", "inline-block");
        $("#burgInputExternalFont").css("display", "none");
      }
    });

    $("#burgSelectDefaultFont").change(function() {
      const type = elSelected.node().parentNode.id;
      const group = burgLabels.select("#"+type);
      if (burgSelectDefaultFont.value === "") return;
      const font = fonts[burgSelectDefaultFont.value].split(':')[0].replace(/\+/g, " ");
      group.attr("font-family", font).attr("data-font", fonts[burgSelectDefaultFont.value]);
    });

    $("#burgInputExternalFont").change(function() {
      fetchFonts(this.value).then(fetched => {
        if (!fetched) return;
        burgToggleExternalFont.click();
        burgInputExternalFont.value = "";
        if (fetched === 1) $("#burgSelectDefaultFont").val(fonts.length - 1).change();
      });
    });

    $("#burgSetLabelSize").on("input", function() {
      const type = elSelected.node().parentNode.id;
      const group = burgLabels.select("#"+type);
      group.attr("data-size", +this.value);
      invokeActiveZooming();
    });

    $("#burgLabelColorInput").on("input", function() {
      const type = elSelected.node().parentNode.id;
      const group = burgLabels.select("#"+type);
      group.attr("fill", this.value);
    });

    $("#burgLabelOpacity").on("input", function() {
      const type = elSelected.node().parentNode.id;
      const group = burgLabels.select("#"+type);
      group.attr("opacity", +this.value);
    });

    $("#burgLabelAngle").on("input", function() {
      const id = +elSelected.attr("data-id");
      const el = burgLabels.select("[data-id='"+ id +"']");
      const tr = parseTransform(el.attr("transform"));
      const c = el.node().getBBox();
      burgLabelAngleOutput.innerHTML = Math.abs(+this.value) + "°";
      const angle = +this.value;
      const transform = `translate(${tr[0]},${tr[1]}) rotate(${angle} ${(c.x+c.width/2)} ${(c.y+c.height/2)})`;
      el.attr("transform", transform);
    });

    $("#burgIconSize").on("input", function() {
      const type = elSelected.node().parentNode.id;
      const group = burgIcons.select("#"+type);
      const size = +this.value;
      group.attr("size", size);
      group.selectAll("*").each(function() {d3.select(this).attr("r", size)});
    });

    $("#burgIconFillOpacity").on("input", function() {
      const type = elSelected.node().parentNode.id;
      const group = burgIcons.select("#"+type);
      group.attr("fill-opacity", +this.value);
    });

    $("#burgIconFillColor").on("input", function() {
      const type = elSelected.node().parentNode.id;
      const group = burgIcons.select("#"+type);
      group.attr("fill", this.value);
    });

    $("#burgIconStrokeWidth").on("input", function() {
      const type = elSelected.node().parentNode.id;
      const group = burgIcons.select("#"+type);
      group.attr("stroke-width", +this.value);
    });

    $("#burgIconStrokeOpacity").on("input", function() {
      const type = elSelected.node().parentNode.id;
      const group = burgIcons.select("#"+type);
      group.attr("stroke-opacity", +this.value);
    });

    $("#burgIconStrokeColor").on("input", function() {
      const type = elSelected.node().parentNode.id;
      const group = burgIcons.select("#"+type);
      group.attr("stroke", this.value);
    });

    $("#burgToggleCapital").click(function() {
      const id = +elSelected.attr("data-id");
      const state = manors[id].region;
      if (states[state] === undefined) return;
      const capital = states[manors[id].region] ? id === states[manors[id].region].capital ? 0 : 1 : 1;
      if (capital && states[state].capital !== "select") {
        // move oldCapital to a town group
        const oldCapital = states[state].capital;
        moveBurgToGroup(oldCapital, "towns");
      }
      states[state].capital = capital ? id : "select";
      d3.select("#burgToggleCapital").classed("pressed", capital);
      const g = capital ? "capitals" : "towns";
      moveBurgToGroup(id, g);
    });

    $("#burgTogglePort").click(function() {
      const id = +elSelected.attr("data-id");
      const cell = cells[manors[id].cell];
      const markAsPort = cell.port === undefined ? true : undefined;
      cell.port = markAsPort;
      d3.select("#burgTogglePort").classed("pressed", markAsPort);
      if (markAsPort) {
        const type = elSelected.node().parentNode.id;
        const ag = type === "capitals" ? "#capital-anchors" : "#town-anchors";
        const group = icons.select(ag);
        const size = +group.attr("size");
        const x = rn(manors[id].x - size * 0.47, 2);
        const y = rn(manors[id].y - size * 0.47, 2);
        group.append("use").attr("xlink:href", "#icon-anchor").attr("data-id", id)
          .attr("x", x).attr("y", y).attr("width", size).attr("height", size)
          .on("click", editIcon);
      } else {
        $("#icons g[id*='anchors'] [data-id=" + id + "]").remove();
      }
    });

    $("#burgPopulation").on("input", function() {
      const id = +elSelected.attr("data-id");
      burgPopulationFriendly.value = rn(this.value * urbanization.value * populationRate.value * 1000);
      manors[id].population = +this.value;
    });

    $("#burgRelocate").click(function() {
      if ($(this).hasClass('pressed')) {
        $(".pressed").removeClass('pressed');
        restoreDefaultEvents();
        tip("", true);
      } else {
        $(".pressed").removeClass('pressed');
        const id = elSelected.attr("data-id");
        $(this).addClass('pressed').attr("data-id", id);
        viewbox.style("cursor", "crosshair").on("click", relocateBurgOnClick);
        tip("Click on map to relocate burg. Hold Shift for continuous move", true);
      }
    });

    // open legendsEditor
    document.getElementById("burglLegend").addEventListener("click", function() {
      let burg = +elSelected.attr("data-id");
      let id = "burg" + burg;
      let name = manors[burg].name;
      editLegends(id, name);
    });

    // move burg to a different cell
    function relocateBurgOnClick() {
      const point = d3.mouse(this);
      const index = getIndex(point);
      const i = +$("#burgRelocate").attr("data-id");
      if (isNaN(i) || !manors[i]) return;

      if (cells[index].height < 20) {
        tip("Cannot place burg in the water! Select a land cell", null, "error");
        return;
      }

      if (cells[index].manor !== undefined && cells[index].manor !== i) {
        tip("There is already a burg in this cell. Please select a free cell", null, "error");
        $('#grid').fadeIn();
        d3.select("#toggleGrid").classed("buttonoff", false);
        return;
      }

      let region = cells[index].region;
      const oldRegion = manors[i].region;
      // relocating capital to other country you "conquer" target cell
      if (states[oldRegion] && states[oldRegion].capital === i) {
        if (region !== oldRegion) {
          tip("Capital cannot be moved to another country!", null, "error");
          return;
        }
      }

      if (d3.event.shiftKey === false) {
        $("#burgRelocate").removeClass("pressed");
        restoreDefaultEvents();
        tip("", true);
        if (region !== oldRegion) {
          recalculateStateData(oldRegion);
          recalculateStateData(region);
          updateCountryEditors();
        }
      }

      const x = rn(point[0],2), y = rn(point[1],2);
      burgIcons.select("circle[data-id='"+i+"']").attr("transform", null).attr("cx", x).attr("cy", y);
      burgLabels.select("text[data-id='"+i+"']").attr("transform", null).attr("x", x).attr("y", y);
      const anchor = icons.select("use[data-id='"+i+"']");
      if (anchor.size()) {
        const size = anchor.attr("width");
        const xa = rn(x - size * 0.47, 2);
        const ya = rn(y - size * 0.47, 2);
        anchor.attr("transform", null).attr("x", xa).attr("y", ya);
      }
      cells[index].manor = i;
      cells[manors[i].cell].manor = undefined;
      manors[i].x = x, manors[i].y = y, manors[i].region = region, manors[i].cell = index;
    }

    // open in MFCG
    $("#burgSeeInMFCG").click(function() {
      const id = +elSelected.attr("data-id");
      const name = manors[id].name;
      const cell = manors[id].cell;
      const pop = rn(manors[id].population);
      const size = pop > 65 ? 65 : pop < 6 ? 6 : pop;
      const s = seed + "" + id;
      const hub = cells[cell].crossroad > 2 ? 1 : 0;
      const river = cells[cell].river ? 1 : 0;
      const coast = cells[cell].port !== undefined ? 1 : 0;
      const sec = pop > 40 ? 1 : Math.random() < pop / 100 ? 1 : 0;
      const thr = sec && Math.random() < 0.8 ? 1 : 0;
      const url = "http://fantasycities.watabou.ru/";
      let params = `?name=${name}&size=${size}&seed=${s}&hub=${hub}&random=0&continuous=0`;
      params += `&river=${river}&coast=${coast}&citadel=${id&1}&plaza=${sec}&temple=${thr}&walls=${sec}&shantytown=${sec}`;
      const win = window.open(url+params, '_blank');
      win.focus();
    });

    $("#burgAddfromEditor").click(function() {
      clickToAdd(); // to load on click event function
      $("#addBurg").click();
    });

    $("#burgRemove").click(function() {
      alertMessage.innerHTML = `Are you sure you want to remove the Burg?`;
      $("#alert").dialog({resizable: false, title: "Remove Burg",
        buttons: {
          Remove: function() {
            $(this).dialog("close");
            const id = +elSelected.attr("data-id");
            d3.selectAll("[data-id='" + id + "']").remove();
            const cell = manors[id].cell;
            const state = manors[id].region;
            if (states[state]) {
              if (states[state].capital === id) states[state].capital = "select";
              states[state].burgs --;
            }
            manors[id].region = "removed";
            cells[cell].manor = undefined;
            closeDialogs(".stable");
            updateCountryEditors();
          },
          Cancel: function() {$(this).dialog("close");}
        }
      })
    });
  }

  function editMarker() {
    if (customization) return;

    unselect();
    closeDialogs("#markerEditor, .stable");
    elSelected = d3.select(this).call(d3.drag().on("start", elementDrag)).classed("draggable", true);

    $("#markerEditor").dialog({
      title: "Edit Marker",
      minHeight: 30, width: "auto", maxWidth: 275, resizable: false,
      position: {my: "center top+30", at: "bottom", of: d3.event},
      close: unselect
    });

    // update inputs
    let id = elSelected.attr("href");
    let symbol = d3.select("#defs-markers").select(id);
    let icon = symbol.select("text");
    markerSelectGroup.value = id.slice(1);
    markerIconSize.value = parseFloat(icon.attr("font-size"));
    markerIconShiftX.value = parseFloat(icon.attr("x"));
    markerIconShiftY.value = parseFloat(icon.attr("y"));
    markerIconFill.value = icon.attr("fill");
    markerIconStrokeWidth.value = icon.attr("stroke-width");
    markerIconStroke.value = icon.attr("stroke");
    markerSize.value = elSelected.attr("data-size");
    markerBase.value = symbol.select("path").attr("fill");
    markerFill.value = symbol.select("circle").attr("fill");
    let opacity = symbol.select("circle").attr("opacity");
    markerToggleBubble.className = opacity === "0" ? "icon-info" : "icon-info-circled";

    let table = document.getElementById("markerIconTable");
    let selected = table.getElementsByClassName("selected");
    if (selected.length) selected[0].removeAttribute("class");
    selected = document.querySelectorAll("#markerIcon" + icon.text().codePointAt());
    if (selected.length) selected[0].className = "selected";
    markerIconCustom.value = selected.length ? "" : icon.text();

    if (modules.editMarker) return;
    modules.editMarker = true;

    $("#markerGroup").click(function() {
      $("#markerEditor > button").not(this).toggle();
      $("#markerGroupSection").toggle();
      updateMarkerGroupOptions();
    });

    function updateMarkerGroupOptions() {
      markerSelectGroup.innerHTML = "";
      d3.select("#defs-markers").selectAll("symbol").each(function() {
        let opt = document.createElement("option");
        opt.value = opt.innerHTML = this.id;
        markerSelectGroup.add(opt);
      });
      let id = elSelected.attr("href").slice(1);
      markerSelectGroup.value = id;
    }

    // on add marker type click
    document.getElementById("markerAddGroup").addEventListener("click", function() {
      if ($("#markerInputGroup").css("display") === "none") {
        $("#markerInputGroup").css("display", "inline-block");
        $("#markerSelectGroup").css("display", "none");
        markerInputGroup.focus();
      } else {
        $("#markerSelectGroup").css("display", "inline-block");
        $("#markerInputGroup").css("display", "none");
      }
    });

    // on marker type change
    document.getElementById("markerSelectGroup").addEventListener("change", function() {
      elSelected.attr("href", "#"+this.value);
      elSelected.attr("data-id", "#"+this.value);
    });

    // on new type input
    document.getElementById("markerInputGroup").addEventListener("change", function() {
      let newGroup = this.value.toLowerCase().replace(/ /g, "_").replace(/[^\w\s]/gi, "");
      if (Number.isFinite(+newGroup.charAt(0))) newGroup = "m" + newGroup;
      if (d3.select("#defs-markers").select("#"+newGroup).size()) {
        tip('The type "'+ newGroup + '" is already exists');
        return;
      }
      markerInputGroup.value = "";
      // clone old group assigning new id
      let id = elSelected.attr("href");
      let l = d3.select("#defs-markers").select(id).node().cloneNode(true);
      l.id = newGroup;
      elSelected.attr("href", "#"+newGroup);
      elSelected.attr("data-id", "#"+newGroup);
      document.getElementById("defs-markers").insertBefore(l, null);

      // select new group
      let opt = document.createElement("option");
      opt.value = opt.innerHTML = newGroup;
      markerSelectGroup.add(opt);
      $("#markerSelectGroup").val(newGroup).change();
      $("#markerSelectGroup, #markerInputGroup").toggle();
      updateMarkerGroupOptions();
    });

    $("#markerIconButton").click(function() {
      $("#markerEditor > button").not(this).toggle();
      $("#markerIconButtons").toggle();
      if (!$("#markerIconTable").text()) drawIconsList(icons);
    });

    $("#markerRemoveGroup").click(function() {
      let id = elSelected.attr("href");
      let used = document.querySelectorAll("use[data-id='"+id+"']");
      let count = used.length === 1 ? "1 element" : used.length + " elements";
      const message = "Are you sure you want to remove the marker (" + count + ")?";
      alertMessage.innerHTML = message;
      $("#alert").dialog({resizable: false, title: "Remove marker",
        buttons: {
          Remove: function() {
            $(this).dialog("close");
            if (id !== "#marker0") d3.select("#defs-markers").select(id).remove();
            used.forEach(function(e) {e.remove();});
            updateMarkerGroupOptions();
            $("#markerEditor").dialog("close");
          },
          Cancel: function() {$(this).dialog("close");}
        }
      });
    });
